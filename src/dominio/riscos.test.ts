/** O domínio do rastreio de risco.
 *
 *  O QUE SE TESTA AQUI são as decisões que enganam em silêncio: a variação que
 *  é verde para baixo (ao contrário do Score), a janela calculada sobre os meses
 *  QUE EXISTEM, e as colunas que uma fonte só tem.
 */

import { describe, expect, it } from 'vitest';

import {
  ORDEM_DOS_DEGRAUS,
  ROTULO_DO_DEGRAU,
  SEVERIDADES,
  alcanceDoIncidente,
  comoVariacao,
  corDaSeveridade,
  corDaVariacao,
  descendoEm,
  janelaDoRecorte,
  nomesDoRecorte,
  proximoNivelDoTema,
  quemDoIncidente,
  recorteDaJanela,
  rotuloDaSeveridade,
  subindoDe,
  tituloDoIncidente,
  trilhaDoRecorte,
} from '@/dominio/riscos';
import type {
  IncidenteNaTabela,
  NivelDoTema,
  OpcoesDoRisco,
} from '@/dominio/riscos';
import { camposDaBase } from '@/dominio/baseDasLentes';

const MESES = [
  '2026-01',
  '2026-02',
  '2026-03',
  '2026-04',
  '2026-05',
  '2026-06',
  '2026-07',
  '2026-08',
  '2026-09',
];

function incidente(ajustes: Partial<IncidenteNaTabela> = {}): IncidenteNaTabela {
  return {
    tipo: 'mencao',
    id: '1',
    data: '2026-09-04',
    quem: 'Jornal do Risco',
    incidente: 'Falta de água no bairro',
    link: 'https://exemplo/1',
    fonte: 'clipei',
    lente: 'imprensa',
    lente_nome: 'Imprensa',
    fonte_nome: 'Clipei',
    tema: 'Desabastecimento',
    tier: null,
    engajamento: null,
    severidade: 'alto',
    recorrencia: 2,
    riscos: [{ codigo: 'R1', nome: 'Entrega de água' }],
    ...ajustes,
  };
}

describe('a severidade', () => {
  it('vem da pior para a menos grave, como no servidor', () => {
    expect(SEVERIDADES.map((uma) => uma.codigo)).toEqual(['critico', 'alto', 'moderado']);
  });

  it('usa token e não hex, para a tela seguir o tema', () => {
    for (const uma of SEVERIDADES) {
      expect(uma.forte.startsWith('var(--')).toBe(true);
      expect(uma.area.startsWith('var(--')).toBe(true);
      expect(uma.texto.startsWith('var(--')).toBe(true);
    }
  });

  it('devolve o nome do banco quando a tela não conhece a severidade', () => {
    //: O CADASTRO É DA EMPRESA e pode ganhar um nível sem o front saber. Um
    //: travessão esconderia a informação; o nome cru a entrega.
    expect(rotuloDaSeveridade('catastrofico')).toBe('catastrofico');
    expect(rotuloDaSeveridade(null)).toBe('—');
    expect(corDaSeveridade('catastrofico')).toBe('var(--cinza-1)');
  });
});

describe('a variação', () => {
  it('é VERDE PARA BAIXO, ao contrário do Score', () => {
    //: Aqui o índice é EXPOSIÇÃO A RISCO: cair é bom. No Score, subir é bom.
    //: Duas telas da mesma divisão com a seta em cores opostas é o tipo de coisa
    //: que engana em silêncio — este teste é o que prende a decisão.
    expect(corDaVariacao(-8)).toBe('var(--ok-fg)');
    expect(corDaVariacao(8)).toBe('var(--erro-fg)');
    expect(corDaVariacao(0)).toBe('var(--cinza-3)');
    expect(corDaVariacao(null)).toBe('var(--cinza-3)');
  });

  it('escreve o sinal com o menos tipográfico', () => {
    expect(comoVariacao(-8)).toBe('−8');
    expect(comoVariacao(8)).toBe('+8');
    expect(comoVariacao(0)).toBe('0');
    expect(comoVariacao(null)).toBe('—');
  });
});

describe('a janela de análise', () => {
  it('converte a janela em `de`/`ate` pelos meses da série', () => {
    expect(recorteDaJanela(MESES, { inicio: 6, fim: 8 })).toEqual({
      de: '2026-07',
      ate: '2026-09',
    });
  });

  it('manda a SÉRIE INTEIRA sem recorte, para não congelar a janela', () => {
    //: Mandar o primeiro e o último mês daria o mesmo hoje e deixaria de dar
    //: quando um mês mais antigo entrasse na base.
    expect(recorteDaJanela(MESES, { inicio: 0, fim: MESES.length - 1 })).toEqual({
      de: null,
      ate: null,
    });
  });

  it('aguenta janela fora dos limites e série vazia', () => {
    expect(recorteDaJanela([], { inicio: 0, fim: 3 })).toEqual({ de: null, ate: null });
    //: Uma janela que começa antes do início é a série inteira, não um erro.
    expect(recorteDaJanela(MESES, { inicio: -2, fim: 99 })).toEqual({
      de: null,
      ate: null,
    });
  });

  it('faz o caminho de volta, do recorte para a moldura', () => {
    expect(janelaDoRecorte(MESES, '2026-04', '2026-06')).toEqual({ inicio: 3, fim: 5 });
  });

  it('SEM RECORTE é a série inteira — o estado em que a aba abre', () => {
    expect(janelaDoRecorte(MESES, null, null)).toEqual({
      inicio: 0,
      fim: MESES.length - 1,
    });
  });

  it('ignora mês que não está mais na série', () => {
    //: O cadastro e a base mudam; um link antigo pode citar um mês que saiu.
    expect(janelaDoRecorte(MESES, '2025-01', '2026-06')).toEqual({ inicio: 0, fim: 5 });
  });

  it('as duas conversões se desfazem uma à outra', () => {
    const janela = { inicio: 2, fim: 7 };
    const recorte = recorteDaJanela(MESES, janela);
    expect(janelaDoRecorte(MESES, recorte.de, recorte.ate)).toEqual(janela);
  });
});

describe('as colunas que uma fonte só tem', () => {
  it('mostra o tier da imprensa como veio', () => {
    const alcance = alcanceDoIncidente(incidente({ tier: 'muito relevante' }));
    expect(alcance).toEqual({
      valor: 'muito relevante',
      detalhe: 'relevância do veículo',
      ausente: false,
    });
  });

  it('mostra o engajamento das redes sem traduzir para tier', () => {
    //: TRADUZIR OBRIGARIA A INVENTAR EQUIVALÊNCIA entre "muito relevante" e
    //: 1.243 interações — um número que entraria na conversa como se fosse
    //: medido.
    const alcance = alcanceDoIncidente(incidente({ fonte: 'bites', engajamento: 1243 }));
    expect(alcance.valor).toBe('1,2 mil');
    expect(alcance.detalhe).toBe('interações');
    expect(alcance.ausente).toBe(false);
  });

  it('diz que a AGENDA NÃO TEM ALCANCE, em vez de deixar a célula vazia', () => {
    //: Célula vazia numa coluna que o resto da tabela preenche se lê como dado
    //: faltando, e manda a pessoa procurar o que cobrar do fornecedor.
    const alcance = alcanceDoIncidente(
      incidente({ tipo: 'agenda', fonte: 'crm', quem: null, incidente: null }),
    );
    expect(alcance.valor).toBe('não se aplica');
    expect(alcance.ausente).toBe(true);
  });

  it('separa "não se aplica" de "a fonte não informou"', () => {
    //: A MENÇÃO SEM TIER E SEM ENGAJAMENTO é outra coisa: a fonte tem o campo e
    //: não o preencheu naquela linha. Isso é cobrável; a agenda não é.
    const alcance = alcanceDoIncidente(incidente({ fonte: 'clipei' }));
    expect(alcance.valor).toBe('não informado');
    //: PELO NOME DE CADASTRO, e nao pelo codigo: a tela escreve
    //: "Clipei", como o resto do produto.
    expect(alcance.detalhe).toBe('pela Clipei');
  });

  it('escreve quem está do outro lado da agenda', () => {
    expect(quemDoIncidente(incidente())).toBe('Jornal do Risco');
    expect(quemDoIncidente(incidente({ tipo: 'agenda', quem: null }))).toBe('Agenda do CRM');
  });

  it('descreve a agenda pelo assunto, que é o que esta tela tem a dizer dela', () => {
    expect(tituloDoIncidente(incidente())).toBe('Falta de água no bairro');
    expect(
      tituloDoIncidente(incidente({ tipo: 'agenda', incidente: null, tema: 'Tarifa' })),
    ).toBe('Reunião de clima tenso sobre Tarifa');
  });
});

describe('a trilha do aprofundamento', () => {
  it('lista os degraus na ORDEM DO DOMÍNIO, não na da descida', () => {
    //: Dois links do mesmo recorte têm de se ler igual — é o mesmo cuidado que
    //: `RecorteDaLente` documenta para as Lentes.
    const trilha = trilhaDoRecorte({
      severidade: 'critico',
      bloco: 'governanca',
      lentes: ['imprensa'],
    });

    expect(trilha.map((degrau) => degrau.chave)).toEqual([
      'lentes',
      'bloco',
      'severidade',
    ]);
    expect(trilha[0]).toEqual({ chave: 'lentes', rotulo: 'Lente', valor: 'imprensa' });
  });

  it('chama os níveis como O RESTO DO PRODUTO os chama', () => {
    //: A CONVENÇÃO ESTÁ EM DEZ ARQUIVOS DA `main`: Base das Lentes, painel do
    //: CRM, Painel, derivações, filtros das Lentes, Base do Score e o back.
    //: Eu inventei duas vezes, sempre tirando o rótulo do nome da TABELA —
    //: "Macro tema (N2)" e "Tema (N3)". Este teste é o que impede a terceira.
    const trilha = trilhaDoRecorte({ bloco: 'g', macro: 'c', tema: 'Corrupção' });
    expect(trilha.map((degrau) => degrau.rotulo)).toEqual([
      'Pilar (N1)',
      'Tema estratégico (N2)',
      'Subtema (N3)',
    ]);
  });

  it('ignora o que está vazio', () => {
    expect(trilhaDoRecorte({ bloco: null, lentes: [], busca: '' })).toEqual([]);
  });

  it('tem a severidade por último, porque é corte transversal e não nível', () => {
    expect(ORDEM_DOS_DEGRAUS[ORDEM_DOS_DEGRAUS.length - 1]).toBe('severidade');
  });
});

describe('a escada da taxonomia', () => {
  const ARVORE: NivelDoTema[] = [
    {
      codigo: 'governanca',
      nome: 'Governança',
      incidentes: 12,
      dentro: [
        {
          codigo: 'conduta',
          nome: 'Conduta',
          incidentes: 7,
          dentro: [{ codigo: 'Corrupção', nome: 'Corrupção', incidentes: 5, dentro: [] }],
        },
      ],
    },
  ];

  it('oferece N1 sem recorte, N2 dentro do N1, N3 dentro do N2', () => {
    //: OFERECER OS 104 TEMAS DE UMA VEZ seria devolver a lista que a hierarquia
    //: existe para evitar.
    expect(proximoNivelDoTema(ARVORE, {})?.chave).toBe('bloco');

    const emN1 = proximoNivelDoTema(ARVORE, { bloco: 'governanca' });
    expect(emN1?.chave).toBe('macro');
    expect(emN1?.opcoes.map((opcao: NivelDoTema) => opcao.codigo)).toEqual(['conduta']);

    const emN2 = proximoNivelDoTema(ARVORE, { bloco: 'governanca', macro: 'conduta' });
    expect(emN2?.chave).toBe('tema');
    expect(emN2?.opcoes[0].incidentes).toBe(5);
  });

  it('acaba no N3: dali o que resta é risco, severidade e os registros', () => {
    expect(
      proximoNivelDoTema(ARVORE, {
        bloco: 'governanca',
        macro: 'conduta',
        tema: 'Corrupção',
      }),
    ).toBeNull();
  });

  it('aguenta recorte que não está na árvore', () => {
    //: O cadastro muda; um link antigo pode citar um bloco desativado.
    expect(proximoNivelDoTema(ARVORE, { bloco: 'sumiu' })).toBeNull();
  });
});

describe('descer e subir um degrau', () => {
  it('DESCER NUM NÍVEL LIMPA OS DE BAIXO', () => {
    //: Trocar de N1 com um N2 do outro N1 ainda escolhido daria recorte
    //: impossível — e a tela mostraria zero sem dizer por quê.
    const descido = descendoEm(
      { bloco: 'governanca', macro: 'conduta', tema: 'Corrupção' },
      'bloco',
      'ambiental',
    );
    expect(descido).toMatchObject({ bloco: 'ambiental', macro: null, tema: null });
  });

  it('descer num cluster limpa o risco', () => {
    const descido = descendoEm({ cluster: 'a', risco: 'R1' }, 'cluster', 'b');
    expect(descido.risco).toBeNull();
  });

  it('a lente e a fonte são listas, e descer nelas é escolher uma', () => {
    const descido = descendoEm({ lentes: ['imprensa', 'sociedade'] }, 'lentes', 'mercado');
    expect(descido.lentes).toEqual(['mercado']);
  });

  it('SUBIR TIRA O DEGRAU E OS QUE DEPENDEM DELE', () => {
    const subido = subindoDe(
      { bloco: 'governanca', macro: 'conduta', tema: 'Corrupção', severidade: 'alto' },
      'bloco',
    );
    expect(subido).toMatchObject({ bloco: null, macro: null, tema: null });
    //: E NÃO MEXE NO QUE NÃO DEPENDE: a severidade é corte transversal.
    expect(subido.severidade).toBe('alto');
  });

  it('subir numa lista a esvazia', () => {
    expect(subindoDe({ lentes: ['imprensa'] }, 'lentes').lentes).toEqual([]);
  });
});

describe('a tela escreve NOME, e não código', () => {
  //: O CÓDIGO É CHAVE DO CADASTRO. A trilha dizia "Lente: imprensa",
  //: "Pilar (N1): governanca" e "Severidade: critico", enquanto o resto do
  //: produto escreve "Imprensa", "Governança" e "Crítico" — e "sociedade" não é
  //: nem o nome da lente, que se chama "Sociedade digital".
  const OPCOES = {
    clusters: [
      {
        codigo: 'operacional',
        nome: 'Riscos Operacionais',
        riscos: [{ codigo: 'R1', nome: 'Entrega de água', severidade: 'critico' }],
      },
    ],
    fontes: [{ codigo: 'bites', nome: 'Bites' }],
    lentes: [{ codigo: 'sociedade', nome: 'Sociedade digital' }],
    temas: [
      {
        codigo: 'governanca',
        nome: 'Governança',
        incidentes: 3,
        dentro: [
          { codigo: 'conduta', nome: 'Conduta', incidentes: 3, dentro: [] },
        ],
      },
    ],
    dimensoes: [],
    meses: ['2026-09'],
  } as OpcoesDoRisco;

  it('traduz cada degrau pelo nome do cadastro', () => {
    const nome = nomesDoRecorte(OPCOES);
    expect(nome('lentes', 'sociedade')).toBe('Sociedade digital');
    expect(nome('fontes', 'bites')).toBe('Bites');
    expect(nome('cluster', 'operacional')).toBe('Riscos Operacionais');
    expect(nome('risco', 'R1')).toBe('Entrega de água');
    expect(nome('bloco', 'governanca')).toBe('Governança');
    expect(nome('macro', 'conduta')).toBe('Conduta');
    expect(nome('severidade', 'critico')).toBe('Crítico');
  });

  it('o TEMA (N3) já vem pelo nome, porque não tem código no cadastro', () => {
    expect(nomesDoRecorte(OPCOES)('tema', 'Desabastecimento')).toBe('Desabastecimento');
  });

  it('valor que o catálogo não conhece sai CRU, e não vazio', () => {
    //: O cadastro muda; um link antigo pode citar um risco desativado. Mostrar
    //: o código é pior que o nome e muito melhor que um chip vazio.
    expect(nomesDoRecorte(OPCOES)('risco', 'R99')).toBe('R99');
  });

  it('a TRILHA usa o tradutor, inclusive nas listas', () => {
    const trilha = trilhaDoRecorte(
      { lentes: ['sociedade'], bloco: 'governanca', severidade: 'critico' },
      nomesDoRecorte(OPCOES),
    );
    expect(trilha.map((degrau) => `${degrau.rotulo}: ${degrau.valor}`)).toEqual([
      'Lente: Sociedade digital',
      'Pilar (N1): Governança',
      'Severidade: Crítico',
    ]);
  });

  it('SEM tradutor o valor sai cru — a trilha continua pura e testável', () => {
    const trilha = trilhaDoRecorte({ bloco: 'governanca' });
    expect(trilha[0].valor).toBe('governanca');
  });
});

describe('o vocabulário dos níveis', () => {
  //: ESTE TESTE COMPARA COM O OUTRO MÓDULO, e não com uma string escrita aqui.
  //: Comparar com literal não impede nada: eu escreveria o rótulo errado no
  //: código e o mesmo rótulo errado no teste — foi o que aconteceu duas vezes,
  //: com "Macro tema (N2)" e "Tema (N3)", os dois tirados do nome da TABELA em
  //: vez do vocabulário de nível do produto.
  //:
  //: `camposDaBase` é a Base das Lentes, que é onde a convenção vive e de onde
  //: o painel do CRM, o Painel e a Base do Score a copiam. Se qualquer um dos
  //: dois lados andar sozinho, isto cai.
  const daBase = new Map(
    camposDaBase('imprensa').map((campo) => [campo.chave, campo.rotulo]),
  );

  it('o Risk Tracking chama os três níveis como a Base das Lentes', () => {
    expect(ROTULO_DO_DEGRAU.bloco).toBe(daBase.get('tema_n1'));
    expect(ROTULO_DO_DEGRAU.macro).toBe(daBase.get('tema_n2'));
    expect(ROTULO_DO_DEGRAU.tema).toBe(daBase.get('tema_n3'));
  });

  it('e o N3 do CADASTRO não se confunde com o SUBTEMA DO FORNECEDOR', () => {
    //: São duas coisas: `tema_n3` é o assunto do cadastro; `subtema` é o texto
    //: cru que o fornecedor mandou, e os dois podem discordar. Eles aparecem
    //: lado a lado na Base das Lentes, e é por isso que o qualificador existe.
    expect(daBase.get('tema_n3')).toBe('Subtema (N3)');
    expect(daBase.get('subtema')).toBe('Subtema (fornecedor)');
    expect(daBase.get('tema_n3')).not.toBe(daBase.get('subtema'));
  });
});
