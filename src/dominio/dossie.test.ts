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
  colunasDaTabela,
  comoNumero,
  comoTexto,
  corDaPrioridade,
  lacunasDoDossie,
  mesCurto,
  temExemplo,
} from '@/dominio/dossie';
import type { Bloco, Dossie, Ficha } from '@/dominio/dossie';

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
    evolucao: bloco({ tipo: 'barras_empilhadas' }),
    fatos: [],
    paineis: [],
    curadoria: {
      manchete: null,
      leitura: [],
      revela: [],
      status: 'publicado',
      automatica: false,
      exemplo: false,
      ficha: FICHA,
    },
    encaminhamentos: [],
    ficha_dos_encaminhamentos: FICHA,
    ...parcial,
  };
}

describe('temExemplo', () => {
  it('acusa exemplo em qualquer bloco, não só na curadoria', () => {
    // O aviso aparece ANTES dos números: quem vê o gráfico primeiro já tirou a
    // conclusão quando chega no rodapé.
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
