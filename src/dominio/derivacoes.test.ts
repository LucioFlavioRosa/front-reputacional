/** As derivações são onde os números do painel nascem HOJE.
 *
 *  As mesmas regras existem no backend, em `/api/metricas/*`, que o front ainda
 *  não consome. Cada regra testada aqui é uma regra que precisa continuar
 *  valendo quando a origem trocar — e, enquanto não trocar, é uma regra que
 *  existe em dois lugares.
 */

import { describe, expect, it } from 'vitest';
import type {
  Dicionarios,
  Instituicao,
  Interacao,
  Interlocutor,
  PessoaAegea,
} from '@/dominio/tipos';
import {
  completarMeses,
  distribuicaoPorUf,
  dividirEmJanelas,
  exposicaoDePortaVozes,
  filaDePendencias,
  kpis,
  montarCatalogo,
  novosContatos,
  panoramaDeInterlocutores,
  ranking,
  resolutividade,
  resultados,
  serieMensal,
  temasMaisRecorrentes,
} from '@/dominio/derivacoes';

/* -- cenário ---------------------------------------------------------------- */

const DICIONARIOS = {
  frentes: [],
  status: [
    { id: 1, codigo: 'atendido', nome: 'Atendido', grupo: 'resolvido', ordem: 1 },
    { id: 2, codigo: 'agendado', nome: 'Agendado', grupo: 'aberto', ordem: 2 },
    { id: 3, codigo: 'declinado', nome: 'Declinado', grupo: 'declinado', ordem: 3 },
    { id: 4, codigo: 'cancelado', nome: 'Cancelado', grupo: 'declinado', ordem: 4 },
  ],
  esferas: [{ id: 1, codigo: 'federal', nome: 'Federal', ordem: 1 }],
  climas: [],
  resultados: [
    { id: 1, codigo: 'avancou', nome: 'Avançou', cor_hex: '#17E3CB', ordem: 1 },
    { id: 2, codigo: 'mantido', nome: 'Mantido', cor_hex: '#0027BD', ordem: 2 },
    { id: 3, codigo: 'recuou', nome: 'Recuou', cor_hex: '#FF5C60', ordem: 3 },
    { id: 4, codigo: 'sem_definicao', nome: 'Sem definição', cor_hex: '#D5DAEA', ordem: 4 },
  ],
  iniciativas: [],
  formatos: [],
  naturezas_orgao: [],
  casas: [],
  tramitacoes: [],
  tipos_investidor: [],
  stakeholders: [],
  unidades_negocio: [{ id: 1, nome: 'Corsan', ordem: 1 }],
  temas: [
    { id: 10, nome: 'Tarifa', nivel: 'estrategico' },
    { id: 11, nome: 'IPO', nivel: 'estrategico' },
    { id: 12, nome: 'Copasa', nivel: 'estrategico' },
  ],
} as unknown as Dicionarios;

const INSTITUICOES: Instituicao[] = [
  { id: 'i1', nome: 'Valor Econômico', tipo: 'veiculo', uf: 'SP' },
  { id: 'i2', nome: 'ANA', tipo: 'orgao', uf: 'DF' },
];

const INTERLOCUTORES: Interlocutor[] = [
  { id: 'p1', nome: 'Taís Hirata', instituicao_id: 'i1', cargo: null, tipo: null, ativo: true },
  { id: 'p2', nome: 'Ana Argolo', instituicao_id: 'i2', cargo: null, tipo: null, ativo: true },
];

const PESSOAS: PessoaAegea[] = [
  { id: 'a1', nome: 'Radamés Casseb', cargo: 'CEO', eh_porta_voz: true, ativo: true },
  { id: 'a2', nome: 'André Pires', cargo: 'CFO', eh_porta_voz: true, ativo: true },
];

const CATALOGO = montarCatalogo(DICIONARIOS, INSTITUICOES, INTERLOCUTORES, PESSOAS);

let contador = 0;
function interacao(ajustes: Partial<Interacao> = {}): Interacao {
  contador += 1;
  return {
    id: `r${contador}`,
    frente: 'imprensa',
    data_interacao: '2026-05-07',
    instituicao_id: 'i1',
    interlocutor_id: 'p1',
    unidade_negocio_id: 1,
    esfera_id: 1,
    uf: 'SP',
    tier: 1,
    stakeholder_id: null,
    status: 'atendido',
    clima: 'neutro',
    resultado: null,
    iniciativa: null,
    pauta: 'Pauta de teste',
    posicionamento: null,
    relato: null,
    encaminhamentos: null,
    pendencias: null,
    observacoes: null,
    registro_url: null,
    extensao: null,
    temas: [],
    participacoes: [],
    fonte: 'cadastro_manual',
    visivel: true,
    criado_por: null,
    criado_em: null,
    atualizado_em: null,
    ...ajustes,
  };
}

/* -- KPIs -------------------------------------------------------------------- */

describe('kpis', () => {
  it('soma governo e parceiros em agendas institucionais', () => {
    const dados = [
      interacao({ frente: 'governo' }),
      interacao({ frente: 'parceiros' }),
      interacao({ frente: 'imprensa' }),
    ];
    expect(kpis(dados, CATALOGO).institucionais).toBe(2);
  });

  it('calcula a taxa de aproveitamento da imprensa pelos resolvidos', () => {
    const dados = [
      interacao({ frente: 'imprensa', status: 'atendido' }),
      interacao({ frente: 'imprensa', status: 'declinado' }),
    ];
    const resultado = kpis(dados, CATALOGO).imprensa;
    expect(resultado.total).toBe(2);
    expect(resultado.atendidas).toBe(1);
    expect(resultado.taxa).toBe(0.5);
  });

  it('conta como internacional apenas a abrangência IN', () => {
    const dados = [
      interacao({ frente: 'investidores', uf: 'IN' }),
      interacao({ frente: 'investidores', uf: 'SP' }),
    ];
    expect(kpis(dados, CATALOGO).investidores).toEqual({ total: 2, internacionais: 1 });
  });

  it('não divide por zero com a base vazia', () => {
    const vazio = kpis([], CATALOGO);
    expect(vazio.imprensa.taxa).toBe(0);
    expect(vazio.tier1.percentual).toBe(0);
  });
});

/* -- séries ------------------------------------------------------------------ */

describe('serieMensal', () => {
  const categorias = [
    { chave: 'imprensa', rotulo: 'Imprensa', cor: '#0027BD' },
    { chave: 'governo', rotulo: 'Governo', cor: '#17E3CB' },
  ];

  it('agrupa por mês e empilha por categoria', () => {
    const dados = [
      interacao({ data_interacao: '2026-01-10', frente: 'imprensa' }),
      interacao({ data_interacao: '2026-01-20', frente: 'governo' }),
      interacao({ data_interacao: '2026-02-05', frente: 'imprensa' }),
    ];
    const serie = serieMensal(dados, categorias, (i) => [i.frente]);

    expect(serie.map((c) => c.mes)).toEqual(['2026-01', '2026-02']);
    expect(serie[0].total).toBe(2);
    expect(serie[1].total).toBe(1);
  });

  it('conta uma vez por tema quando a interação tem vários', () => {
    const temas = [
      { chave: 'Tarifa', rotulo: 'Tarifa', cor: '#0027BD' },
      { chave: 'IPO', rotulo: 'IPO', cor: '#17E3CB' },
    ];
    const dados = [interacao({ data_interacao: '2026-03-01', temas: [10, 11] })];
    const serie = serieMensal(dados, temas, () => ['Tarifa', 'IPO']);

    // Um registro, dois temas: o topo da pilha marca 2 ocorrências de tag.
    expect(serie[0].total).toBe(2);
    expect(serie[0].segmentos).toHaveLength(2);
  });

  it('omite segmentos zerados da pilha', () => {
    const dados = [interacao({ data_interacao: '2026-01-10', frente: 'imprensa' })];
    const serie = serieMensal(dados, categorias, (i) => [i.frente]);
    expect(serie[0].segmentos.map((s) => s.chave)).toEqual(['imprensa']);
  });
});

describe('completarMeses', () => {
  it('preenche o buraco entre dois meses com registros', () => {
    const dados = [
      interacao({ data_interacao: '2026-01-10' }),
      interacao({ data_interacao: '2026-04-10' }),
    ];
    const serie = completarMeses(
      serieMensal(dados, [{ chave: 'imprensa', rotulo: 'Imprensa', cor: '#000' }], () => [
        'imprensa',
      ]),
    );

    expect(serie.map((c) => c.mes)).toEqual(['2026-01', '2026-02', '2026-03', '2026-04']);
    expect(serie[1].total).toBe(0);
  });

  it('atravessa a virada de ano', () => {
    const dados = [
      interacao({ data_interacao: '2025-11-10' }),
      interacao({ data_interacao: '2026-02-10' }),
    ];
    const serie = completarMeses(
      serieMensal(dados, [{ chave: 'imprensa', rotulo: 'Imprensa', cor: '#000' }], () => [
        'imprensa',
      ]),
    );
    expect(serie.map((c) => c.mes)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });
});

/* -- geografia e rankings ---------------------------------------------------- */

describe('distribuicaoPorUf', () => {
  it('ordena por volume decrescente', () => {
    const dados = [
      interacao({ uf: 'SP' }),
      interacao({ uf: 'SP' }),
      interacao({ uf: 'RJ' }),
    ];
    expect(distribuicaoPorUf(dados)).toEqual([
      { uf: 'SP', total: 2 },
      { uf: 'RJ', total: 1 },
    ]);
  });

  it('mantém Nacional e Internacional na contagem', () => {
    const dados = [interacao({ uf: 'NA' }), interacao({ uf: 'IN' })];
    const ufs = distribuicaoPorUf(dados).map((p) => p.uf);
    expect(ufs).toContain('NA');
    expect(ufs).toContain('IN');
  });
});

describe('ranking', () => {
  it('conta o registro para cada porta-voz', () => {
    const dados = [
      interacao({
        participacoes: [
          { pessoa_aegea_id: 'a1', papel: 'porta_voz' },
          { pessoa_aegea_id: 'a2', papel: 'porta_voz' },
        ],
      }),
    ];
    const lista = ranking(dados, CATALOGO, 'portaVoz');
    expect(lista).toHaveLength(2);
    expect(lista.every((item) => item.total === 1)).toBe(true);
  });

  it('ignora quem participou como equipe no ranking de porta-vozes', () => {
    const dados = [
      interacao({
        participacoes: [
          { pessoa_aegea_id: 'a1', papel: 'porta_voz' },
          { pessoa_aegea_id: 'a2', papel: 'equipe' },
        ],
      }),
    ];
    expect(ranking(dados, CATALOGO, 'portaVoz')).toHaveLength(1);
  });

  it('resolve o nome da instituição', () => {
    const lista = ranking([interacao({ instituicao_id: 'i2' })], CATALOGO, 'entidade');
    expect(lista[0].rotulo).toBe('ANA');
  });

  it('desempata por ordem alfabética em português', () => {
    const dados = [interacao({ instituicao_id: 'i2' }), interacao({ instituicao_id: 'i1' })];
    expect(ranking(dados, CATALOGO, 'entidade').map((i) => i.rotulo)).toEqual([
      'ANA',
      'Valor Econômico',
    ]);
  });
});

/* -- status ------------------------------------------------------------------ */

describe('resolutividade', () => {
  it('exclui os declinados do denominador da taxa', () => {
    const dados = [
      interacao({ status: 'atendido' }),
      interacao({ status: 'agendado' }),
      interacao({ status: 'declinado' }),
    ];
    // 1 resolvido / (3 - 1 declinado) = 50%
    expect(resolutividade(dados, CATALOGO).taxa).toBe(0.5);
  });

  it('agrupa declinado e cancelado no mesmo grupo', () => {
    const dados = [interacao({ status: 'declinado' }), interacao({ status: 'cancelado' })];
    const grupo = resolutividade(dados, CATALOGO).grupos.find((g) => g.grupo === 'declinado');
    expect(grupo?.total).toBe(2);
    expect(grupo?.statusQueCompoem).toHaveLength(2);
  });

  it('não estoura quando tudo foi declinado', () => {
    const dados = [interacao({ status: 'declinado' })];
    expect(resolutividade(dados, CATALOGO).taxa).toBe(0);
  });

  it('usa o mesmo denominador na taxa geral e na taxa por frente', () => {
    // Regressão: porFrente usava o total da frente, incluindo declinados, e a
    // barra contradizia o número grande logo acima dela.
    const dados = [
      interacao({ frente: 'imprensa', status: 'atendido' }),
      interacao({ frente: 'imprensa', status: 'declinado' }),
    ];
    const calculado = resolutividade(dados, CATALOGO);
    const imprensa = calculado.porFrente.find((f) => f.frente === 'imprensa');

    expect(calculado.taxa).toBe(1);
    expect(imprensa?.taxa).toBe(1);
    expect(imprensa?.denominador).toBe(1);
    expect(imprensa?.total).toBe(2);
  });

  it('zera a taxa da frente sem estourar quando ela só tem declinados', () => {
    const dados = [interacao({ frente: 'governo', status: 'declinado' })];
    const governo = resolutividade(dados, CATALOGO).porFrente[0];
    expect(governo.denominador).toBe(0);
    expect(governo.taxa).toBe(0);
  });
});

describe('filaDePendencias', () => {
  const hoje = new Date(2026, 7, 24); // 24/08/2026

  it('traz só o que está em aberto', () => {
    const dados = [
      interacao({ status: 'agendado', data_interacao: '2026-06-01' }),
      interacao({ status: 'atendido' }),
      interacao({ status: 'declinado' }),
    ];
    expect(filaDePendencias(dados, CATALOGO, hoje)).toHaveLength(1);
  });

  it('classifica o risco pelas faixas de dias', () => {
    const dados = [
      interacao({ status: 'agendado', data_interacao: '2026-08-10' }), // 14d
      interacao({ status: 'agendado', data_interacao: '2026-07-10' }), // 45d
      interacao({ status: 'agendado', data_interacao: '2026-05-01' }), // 115d
    ];
    expect(filaDePendencias(dados, CATALOGO, hoje).map((i) => i.risco)).toEqual([
      'critico',
      'atencao',
      'no-prazo',
    ]);
  });

  it('ordena do mais parado para o menos', () => {
    const dados = [
      interacao({ status: 'agendado', data_interacao: '2026-08-01' }),
      interacao({ status: 'agendado', data_interacao: '2026-03-01' }),
    ];
    const fila = filaDePendencias(dados, CATALOGO, hoje);
    expect(fila[0].dias).toBeGreaterThan(fila[1].dias);
  });

  it('joga a agenda futura para o fim, com dias negativos', () => {
    const dados = [
      interacao({ status: 'agendado', data_interacao: '2027-01-15' }),
      interacao({ status: 'agendado', data_interacao: '2026-08-01' }),
    ];
    const fila = filaDePendencias(dados, CATALOGO, hoje);
    expect(fila[fila.length - 1].dias).toBeLessThan(0);
  });
});

/* -- resultado --------------------------------------------------------------- */

describe('resultados', () => {
  it('trata resultado nulo como sem definição', () => {
    const dados = [interacao({ resultado: null })];
    const semDefinicao = resultados(dados, CATALOGO).itens.find(
      (i) => i.chave === 'sem_definicao',
    );
    expect(semDefinicao?.total).toBe(1);
  });

  it('exclui os sem definição do denominador da taxa de avanço', () => {
    const dados = [
      interacao({ resultado: 'avancou' }),
      interacao({ resultado: 'mantido' }),
      interacao({ resultado: null }),
    ];
    const calculado = resultados(dados, CATALOGO);
    expect(calculado.denominador).toBe(2);
    expect(calculado.taxaDeAvanco).toBe(0.5);
  });

  it('devolve taxa zero quando ninguém tem desfecho', () => {
    expect(resultados([interacao({ resultado: null })], CATALOGO).taxaDeAvanco).toBe(0);
  });

  it('usa o mesmo denominador na taxa geral e na taxa por frente', () => {
    // Regressão: porFrente incluía os sem definição, punindo a frente por
    // falta de preenchimento e não por resultado ruim.
    const dados = [
      interacao({ frente: 'governo', resultado: 'avancou' }),
      interacao({ frente: 'governo', resultado: null }),
    ];
    const calculado = resultados(dados, CATALOGO);
    const governo = calculado.porFrente.find((f) => f.frente === 'governo');

    expect(calculado.taxaDeAvanco).toBe(1);
    expect(governo?.taxa).toBe(1);
    expect(governo?.denominador).toBe(1);
    expect(governo?.total).toBe(2);
  });
});

/* -- porta-vozes ------------------------------------------------------------- */

describe('exposicaoDePortaVozes', () => {
  it('soma aparições, não registros', () => {
    const dados = [
      interacao({
        participacoes: [
          { pessoa_aegea_id: 'a1', papel: 'porta_voz' },
          { pessoa_aegea_id: 'a2', papel: 'porta_voz' },
        ],
      }),
    ];
    const exposicao = exposicaoDePortaVozes(dados, CATALOGO);
    expect(exposicao.aparicoes).toBe(2);
    expect(exposicao.acionados).toBe(2);
  });

  it('mantém a concentração dentro de 100% com porta-voz múltiplo', () => {
    const dados = [
      interacao({
        participacoes: [
          { pessoa_aegea_id: 'a1', papel: 'porta_voz' },
          { pessoa_aegea_id: 'a2', papel: 'porta_voz' },
        ],
      }),
      interacao({ participacoes: [{ pessoa_aegea_id: 'a1', papel: 'porta_voz' }] }),
    ];
    const exposicao = exposicaoDePortaVozes(dados, CATALOGO);
    // a1 tem 2 de 3 aparições — e não 2 de 2 registros, que daria 100%.
    expect(exposicao.concentracaoNoPrimeiro).toBeCloseTo(2 / 3);
    expect(exposicao.concentracaoNoPrimeiro).toBeLessThanOrEqual(1);
  });

  it('reúne os temas e a última aparição de cada pessoa', () => {
    const dados = [
      interacao({
        data_interacao: '2026-01-10',
        temas: [10],
        participacoes: [{ pessoa_aegea_id: 'a1', papel: 'porta_voz' }],
      }),
      interacao({
        data_interacao: '2026-06-10',
        temas: [11],
        participacoes: [{ pessoa_aegea_id: 'a1', papel: 'porta_voz' }],
      }),
    ];
    const pessoa = exposicaoDePortaVozes(dados, CATALOGO).pessoas[0];
    expect(pessoa.temas).toEqual(['IPO', 'Tarifa']);
    expect(pessoa.ultimaAparicao).toBe('2026-06-10');
  });

  it('devolve zero sem estourar quando não há porta-voz', () => {
    const exposicao = exposicaoDePortaVozes([interacao()], CATALOGO);
    expect(exposicao.aparicoes).toBe(0);
    expect(exposicao.concentracaoNoPrimeiro).toBe(0);
  });
});

/* -- interlocutores ---------------------------------------------------------- */

describe('panoramaDeInterlocutores', () => {
  it('agrupa por pessoa e conta registros', () => {
    const dados = [
      interacao({ interlocutor_id: 'p1' }),
      interacao({ interlocutor_id: 'p1' }),
      interacao({ interlocutor_id: 'p2', instituicao_id: 'i2' }),
    ];
    const panorama = panoramaDeInterlocutores(dados, CATALOGO);
    expect(panorama[0]).toMatchObject({ nome: 'Taís Hirata', total: 2 });
    expect(panorama[1]).toMatchObject({ nome: 'Ana Argolo', instituicao: 'ANA' });
  });

  it('ignora registros sem interlocutor', () => {
    expect(panoramaDeInterlocutores([interacao({ interlocutor_id: null })], CATALOGO)).toEqual([]);
  });
});

describe('comparativo entre janelas', () => {
  const hoje = new Date(2026, 7, 24);

  it('separa os dois períodos sem sobreposição', () => {
    const dados = [
      interacao({ data_interacao: '2026-08-01' }), // atual
      interacao({ data_interacao: '2026-04-01' }), // anterior
      interacao({ data_interacao: '2025-01-01' }), // fora das duas
    ];
    const janelas = dividirEmJanelas(dados, 'trimestre', hoje);
    expect(janelas.atual).toHaveLength(1);
    expect(janelas.anterior).toHaveLength(1);
  });

  it('conta como novo quem não aparecia na janela anterior', () => {
    const dados = [
      interacao({ data_interacao: '2026-08-01', interlocutor_id: 'p2' }),
      interacao({ data_interacao: '2026-04-01', interlocutor_id: 'p1' }),
    ];
    expect(novosContatos(dividirEmJanelas(dados, 'trimestre', hoje))).toBe(1);
  });
});

/* -- temas ------------------------------------------------------------------- */

describe('temasMaisRecorrentes', () => {
  it('ordena por recorrência e limita a quantidade', () => {
    const dados = [
      interacao({ temas: [10, 11] }), // Tarifa, IPO
      interacao({ temas: [10] }), //     Tarifa
      interacao({ temas: [10] }), //     Tarifa
      interacao({ temas: [12] }), //     Copasa
    ];
    const temas = temasMaisRecorrentes(dados, CATALOGO, 2);
    expect(temas.map((t) => t.rotulo)).toEqual(['Tarifa', 'Copasa']);
  });

  it('desempata em ordem alfabética, para a legenda não dançar entre recargas', () => {
    // IPO e Copasa empatam em 1 ocorrência.
    const dados = [interacao({ temas: [11] }), interacao({ temas: [12] })];
    const temas = temasMaisRecorrentes(dados, CATALOGO, 2);
    expect(temas.map((t) => t.rotulo)).toEqual(['Copasa', 'IPO']);
  });

  it('devolve a contagem junto com a cor', () => {
    // Regressão: a contagem era descartada, e o ranking de temas por frente
    // desenhava tudo com total 0 e barra vazia.
    const dados = [
      interacao({ temas: [10, 11] }),
      interacao({ temas: [10] }),
    ];
    const temas = temasMaisRecorrentes(dados, CATALOGO, 5);
    expect(temas.find((t) => t.rotulo === 'Tarifa')?.total).toBe(2);
    expect(temas.find((t) => t.rotulo === 'IPO')?.total).toBe(1);
    expect(temas.every((t) => t.total > 0)).toBe(true);
  });

  it('dá uma cor distinta a cada tema', () => {
    const dados = [interacao({ temas: [10, 11, 12] })];
    const cores = temasMaisRecorrentes(dados, CATALOGO, 3).map((t) => t.cor);
    expect(new Set(cores).size).toBe(3);
  });
});
