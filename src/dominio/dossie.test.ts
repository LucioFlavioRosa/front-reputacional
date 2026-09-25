/** O que a tela do dossiê decide sozinha.
 *
 *  O CÁLCULO É DO SERVIDOR — nota, KPIs, séries e painéis chegam prontos. O que
 *  sobra para a tela é: montar as colunas de uma tabela a partir do que o
 *  servidor mandou, dizer a cor de uma prioridade, e converter o payload sem
 *  fingir que ele é tipado. É isso que este arquivo prova.
 *
 *  A TABELA É O CASO QUE MAIS IMPORTA. A primeira versão escolhia as colunas
 *  procurando a palavra "rating" no TÍTULO do bloco — e um título reescrito
 *  pela curadoria trocaria o schema da tabela em silêncio. Os testes abaixo
 *  travam a correção: quem manda é o `subtipo`, que não muda quando alguém
 *  melhora um texto.
 */

import { describe, expect, it } from 'vitest';

import {
  avisoDeExemplo,
  colunasDaTabela,
  comoNumero,
  comoTexto,
  corDaPrioridade,
  corDoTom,
  lacunasDoDossie,
  mesCurto,
  quantosSinaisReais,
  temExemplo,
} from '@/dominio/dossie';
import type { Bloco, Dossie, Ficha, SinalDoDossie } from '@/dominio/dossie';

const FICHA: Ficha = {
  origem: 'planilha',
  fonte: 'Approach · Community Management',
  colunas: ['TAG (motivo)'],
  lacunas: [],
  exemplo: false,
  conceitos: [],
};

function bloco(parcial: Partial<Bloco>): Bloco {
  return {
    tipo: 'tabela',
    subtipo: null,
    titulo: 'Teor das mensagens',
    conclusao: null,
    dados: [],
    legenda: [],
    colunas: [],
    ficha: FICHA,
    ...parcial,
  };
}

/* -- as colunas vêm do servidor ------------------------------------------------ */

describe('colunasDaTabela', () => {
  it('usa as colunas que o servidor mandou, na ordem que ele mandou', () => {
    const montadas = colunasDaTabela(
      bloco({
        colunas: [
          { chave: 'mes', titulo: 'Mês', alinhamento: 'esquerda' },
          { chave: 'Reclamação', titulo: 'Reclamação', alinhamento: 'direita' },
        ],
      }),
    );

    expect(montadas.map((coluna) => coluna.chave)).toEqual(['mes', 'Reclamação']);
    expect(montadas[1].alinhamento).toBe('direita');
  });

  it('NÃO escolhe o schema pelo título do bloco', () => {
    // Um título com a palavra "rating" não pode fazer a tabela de teor virar
    // tabela de rating: o título é texto editorial, e muda.
    const montadas = colunasDaTabela(
      bloco({
        titulo: 'Trajetória de rating dos nossos clientes',
        subtipo: 'teor',
        colunas: [{ chave: 'Reclamação', titulo: 'Reclamação', alinhamento: 'direita' }],
      }),
    );

    const destaque = montadas[0].destaque;
    expect(destaque).toBeDefined();
    // A regra aplicada é a do TEOR — metade das mensagens —, e não a do rating.
    expect(destaque?.({ Reclamação: 60, total: 100 })).toBe('alerta');
    expect(destaque?.({ Reclamação: 40, total: 100 })).toBeNull();
  });

  it('a reclamação só acende ao passar de metade', () => {
    const [coluna] = colunasDaTabela(
      bloco({
        subtipo: 'teor',
        colunas: [{ chave: 'Reclamação', titulo: 'Reclamação', alinhamento: 'direita' }],
      }),
    );

    expect(coluna.destaque?.({ Reclamação: 527, total: 1016 })).toBe('alerta');
    expect(coluna.destaque?.({ Reclamação: 288, total: 886 })).toBeNull();
    // Mês sem base não acende nada: dividir por zero acenderia tudo.
    expect(coluna.destaque?.({ Reclamação: 0, total: 0 })).toBeNull();
  });

  it('no rating, quem acende é o EFEITO que o servidor classificou', () => {
    // Repetir aqui a regra de "piorou" criaria uma segunda definição, livre
    // para divergir da que o índice usa.
    const [coluna] = colunasDaTabela(
      bloco({
        subtipo: 'rating',
        colunas: [{ chave: 'para', titulo: 'Para', alinhamento: 'esquerda' }],
      }),
    );

    expect(coluna.destaque?.({ para: 'B2', efeito: 'pressiona' })).toBe('alerta');
    expect(coluna.destaque?.({ para: 'BB+', efeito: 'sustenta' })).toBeNull();
  });

  it('o teor mostra volume E proporção, porque 288 de 886 não é 288 de 400', () => {
    const [coluna] = colunasDaTabela(
      bloco({
        subtipo: 'teor',
        colunas: [{ chave: 'Dúvida', titulo: 'Dúvida', alinhamento: 'direita' }],
      }),
    );

    expect(coluna.formatar?.(166, { total: 886 })).toBe('166 · 19%');
  });

  it('a célula sem dado do teor vira "—", e não zero', () => {
    const [coluna] = colunasDaTabela(
      bloco({
        subtipo: 'teor',
        colunas: [
          { chave: 'sem_classificacao', titulo: 'Sem motivo', alinhamento: 'direita' },
        ],
      }),
    );

    expect(coluna.formatar?.(0, {})).toBe('—');
    expect(coluna.formatar?.(12, {})).toBe('12');
  });

  it('o mês é formatado curto em qualquer tabela', () => {
    const [coluna] = colunasDaTabela(
      bloco({ colunas: [{ chave: 'mes', titulo: 'Mês', alinhamento: 'esquerda' }] }),
    );

    expect(coluna.formatar?.('2026-06', {})).toBe('jun/26');
  });
});

/* -- a conversão do payload ---------------------------------------------------- */

describe('comoNumero e comoTexto', () => {
  it('convertem o que dá, e devolvem o padrão para o que não dá', () => {
    expect(comoNumero(12)).toBe(12);
    expect(comoNumero('12')).toBe(12);
    // `undefined` num payload é campo ausente, e não zero por acaso: o padrão
    // é explícito em quem chama.
    expect(comoNumero(undefined)).toBe(0);
    expect(comoNumero(null, 7)).toBe(7);
    expect(comoNumero('doze', -1)).toBe(-1);
  });

  it('texto ausente vira vazio, e não a palavra "undefined"', () => {
    expect(comoTexto('Corsan')).toBe('Corsan');
    expect(comoTexto(undefined)).toBe('');
    expect(comoTexto(null, '—')).toBe('—');
    expect(comoTexto(12)).toBe('12');
  });
});

/* -- o resto do que a tela decide ---------------------------------------------- */

describe('mesCurto', () => {
  it('encurta para caber em oito colunas', () => {
    expect(mesCurto('2026-06')).toBe('jun/26');
    expect(mesCurto('2025-12')).toBe('dez/25');
  });

  it('devolve a chave intacta quando não reconhece', () => {
    // Melhor mostrar "2026-13" do que inventar um mês que não existe.
    expect(mesCurto('2026-13')).toBe('2026-13');
    expect(mesCurto('Antes')).toBe('Antes');
  });
});

describe('corDaPrioridade', () => {
  it('só a P1 é sólida', () => {
    // Quatro níveis com quatro cores fortes viram arco-íris, e a matriz existe
    // para responder "com quem falar primeiro".
    expect(corDaPrioridade(1).fundo).toBe('var(--azul-mar)');
    expect(corDaPrioridade(3).fundo).toBe(corDaPrioridade(4).fundo);
  });
});

/* -- o que a tela avisa antes dos números -------------------------------------- */

function dossie(parcial: Partial<Dossie>): Dossie {
  return {
    codigo: 'imprensa',
    nome: 'Imprensa',
    stakeholder: 'Formadores de opinião',
    mes: '2026-06',
    nota: 70,
    ns: 0.4,
    delta: 1,
    peso: 30,
    estimado: false,
    ausencia: null,
    fontes: ['clipei'],
    formula: '',
    kpis: [],
    ficha_do_destaque: FICHA,
    manchete: null,
    evolucao: bloco({ tipo: 'barras_empilhadas' }),
    sinais_da_evolucao: [],
    fatos: [],
    paineis: [],
    sinais: [],
    ...parcial,
  };
}

describe('temExemplo', () => {
  it('acusa exemplo em qualquer gráfico da lente', () => {
    const comPainelDeExemplo = dossie({
      paineis: [bloco({ ficha: { ...FICHA, exemplo: true } })],
    });
    expect(temExemplo(comPainelDeExemplo)).toBe(true);
  });

  it('não acusa quando tudo é medido', () => {
    expect(temExemplo(dossie({}))).toBe(false);
  });
});

describe('lacunasDoDossie', () => {
  it('junta as lacunas de todos os blocos', () => {
    const comLacunas = dossie({
      evolucao: bloco({ ficha: { ...FICHA, lacunas: ['não se sabe se respondeu'] } }),
      paineis: [bloco({ ficha: { ...FICHA, lacunas: ['a clipagem não traz o autor'] } })],
    });

    expect(lacunasDoDossie(comLacunas)).toEqual([
      'não se sabe se respondeu',
      'a clipagem não traz o autor',
    ]);
  });
});


describe('avisoDeExemplo', () => {
  it('NOMEIA o gráfico que é ilustração, em vez de mandar procurar', () => {
    const comMatriz = dossie({
      paineis: [
        bloco({ titulo: 'Tier × sentimento' }),
        bloco({ titulo: 'Matriz de jornalistas', ficha: { ...FICHA, exemplo: true } }),
      ],
    });

    expect(avisoDeExemplo(comMatriz)).toEqual({ graficos: ['Matriz de jornalistas'] });
  });

  it('NÃO acusa nada quando todos os gráficos são medidos', () => {
    // Desde que as frases passaram a ser calculadas dos dados, não existe mais
    // "texto de exemplo": ou o gráfico mostra ilustração, ou não mostra. Antes
    // este caso disparava um aviso sobre gráficos que não havia — e a pessoa
    // passava a desconfiar de números certos.
    expect(avisoDeExemplo(dossie({ paineis: [bloco({}), bloco({})] }))).toBeNull();
  });

  it('nada a avisar quando tudo é medido', () => {
    expect(avisoDeExemplo(dossie({ paineis: [bloco({}), bloco({})] }))).toBeNull();
  });
});


/* -- os sinais do período ------------------------------------------------------ */

function sinal(parcial: Partial<SinalDoDossie>): SinalDoDossie {
  return {
    tipo: 'Virada',
    frase: 'A nota caiu 10 pontos em junho: o negativo foi de 45% para 57%.',
    evidencia: '-10 pts',
    onde: 'Evolução',
    tom: 'neg',
    ...parcial,
  };
}

describe('corDoTom', () => {
  it('pinta positivo e negativo com as cores do produto', () => {
    expect(corDoTom('pos').texto).toBe('var(--ok-fg)');
    expect(corDoTom('neg').texto).toBe('var(--erro-fg)');
  });

  it('cai no cinza para o neutro', () => {
    expect(corDoTom('neu').texto).toBe('var(--cinza-3)');
  });

  it('cai no cinza para um tom que a tela não conhece', () => {
    // O servidor manda `pos`/`neg`/`neu`, mas um tom novo não pode deixar o
    // chip sem cor de fundo — ele sumiria da lista sem avisar.
    expect(corDoTom('roxo')).toEqual(corDoTom('neu'));
  });
});

describe('quantosSinaisReais', () => {
  it('não conta as lacunas de dado', () => {
    // "5 sinais" e "5 sinais, 2 deles lacunas" descrevem lentes muito
    // diferentes: uma teve cinco coisas acontecendo, a outra teve três.
    const lista = [
      sinal({}),
      sinal({ tipo: 'Pico', tom: 'neu' }),
      sinal({ tipo: 'Lacuna de dado', tom: 'neu' }),
    ];

    expect(quantosSinaisReais(lista)).toBe(2);
  });

  it('devolve zero numa lente só com lacunas', () => {
    expect(quantosSinaisReais([sinal({ tipo: 'Lacuna de dado' })])).toBe(0);
  });

  it('devolve zero sem sinal nenhum', () => {
    expect(quantosSinaisReais([])).toBe(0);
  });
});
