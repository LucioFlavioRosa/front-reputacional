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
  Frente,
  Instituicao,
  Interacao,
  Interlocutor,
  PessoaAegea,
} from '@/dominio/tipos';
import { FRENTES } from '@/dominio/tipos';
import { CORES_DE_FRENTE, ROTULOS_DE_FRENTE } from '@/dominio/frentes';
import {
  categoriasDeArea,
  climaPorTema,
  comReativoNaBase,
  completarMeses,
  divergenciasDoCatalogo,
  distribuicaoPorUf,
  dividirEmJanelas,
  exposicaoDePortaVozes,
  filaDePendencias,
  idsPorCategoriaDeArea,
  jaAconteceu,
  kpis,
  montarCatalogo,
  novosContatos,
  panoramaDeInterlocutores,
  porArea,
  ranking,
  rankingDePortaVozes,
  resolutividade,
  resultados,
  resumoDeClimaPorFrente,
  scorePorCategoriaPublico,
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
  areas_pessoa: [
    { id: 1, codigo: 'comunicacao', nome: 'Comunicação', ordem: 1 },
    { id: 2, codigo: 'relacoes_institucionais', nome: 'Relações Institucionais', ordem: 2 },
    { id: 3, codigo: 'operacoes_financeiras', nome: 'Operações Financeiras', ordem: 3 },
    { id: 4, codigo: 'performance_e_dados', nome: 'Performance e Dados', ordem: 4 },
    { id: 5, codigo: 'relacoes_investidores', nome: 'Relações com Investidores', ordem: 5 },
  ],
  unidades_negocio: [{ id: 1, nome: 'Corsan', ordem: 1 }],
  temas: [
    { id: 10, nome: 'Tarifa', nivel: 'estrategico' },
    { id: 11, nome: 'IPO', nivel: 'estrategico' },
    { id: 12, nome: 'Copasa', nivel: 'estrategico' },
  ],
} as unknown as Dicionarios;

const INSTITUICOES: Instituicao[] = [
  {
    id: 'i1', nome: 'Valor Econômico', tipo: 'veiculo', nome_completo: null, uf: 'SP', tier: 1,
    esfera_id: null, categoria_publico_id: null, subcategoria_publico_id: null, ativo: true,
  },
  {
    id: 'i2', nome: 'ANA', tipo: 'orgao', nome_completo: null, uf: 'DF', tier: null,
    esfera_id: null, categoria_publico_id: null, subcategoria_publico_id: null, ativo: true,
  },
];

const INTERLOCUTORES: Interlocutor[] = [
  { id: 'p1', nome: 'Taís Hirata', instituicao_id: 'i1', cargo: null, email: null, tipo: null, ativo: true },
  { id: 'p2', nome: 'Ana Argolo', instituicao_id: 'i2', cargo: null, email: null, tipo: null, ativo: true },
];

const PESSOAS: PessoaAegea[] = [
  { id: 'a1', nome: 'Radamés Casseb', cargo: 'CEO', email: null, eh_porta_voz: true, area_id: null, ativo: true, temas: [] },
  { id: 'a2', nome: 'André Pires', cargo: 'CFO', email: null, eh_porta_voz: true, area_id: null, ativo: true, temas: [] },
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
    modalidade: null,
    local: null,
    interlocutor_id: 'p1',
    unidade_negocio_id: 1,
    esfera_id: 1,
    formato_interacao_id: null,
    uf: 'SP',
    tier: 1,
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
    areas: [],
    participacoes: [],
    fonte: 'cadastro_manual',
    visivel: true,
    criado_por: null,
    criado_em: null,
    atualizado_em: null,

    // O ciclo da agenda. O molde precisa trazer TODOS os campos: o `Partial`

    // dos ajustes cobre o que cada teste quer mudar, e o resto vem daqui.

    expectativa: null,

    clima_esperado: null,

    declinado_por: null,

    motivo_declinio: null,
    nota_situacao: null,

    origens: [],
    derivadas: 0,

    preve_desdobramento: null,

    outra_parte: [],

    materiais: [],
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

describe('resumoDeClimaPorFrente', () => {
  it('conta positivas e negativas de uma frente, ignorando neutro e sem clima', () => {
    const dados = [
      interacao({ frente: 'eventos', clima: 'propositivo' }),
      interacao({ frente: 'eventos', clima: 'propositivo' }),
      interacao({ frente: 'eventos', clima: 'tenso' }),
      interacao({ frente: 'eventos', clima: 'neutro' }),
      interacao({ frente: 'eventos', clima: null }),
      interacao({ frente: 'imprensa', clima: 'propositivo' }), // outra frente, não conta
    ];
    const resumo = resumoDeClimaPorFrente(dados, ['eventos']);
    expect(resumo).toEqual({ total: 5, positivas: 2, negativas: 1 });
  });

  it('soma mais de uma frente quando pedido (caso institucionais)', () => {
    const dados = [
      interacao({ frente: 'governo', clima: 'propositivo' }),
      interacao({ frente: 'parceiros', clima: 'tenso' }),
      interacao({ frente: 'legislativo', clima: 'propositivo' }), // fora do grupo, não conta
    ];
    const resumo = resumoDeClimaPorFrente(dados, ['governo', 'parceiros']);
    expect(resumo).toEqual({ total: 2, positivas: 1, negativas: 1 });
  });

  it('devolve zeros quando não há registro da frente', () => {
    const resumo = resumoDeClimaPorFrente([], ['bancos_credores']);
    expect(resumo).toEqual({ total: 0, positivas: 0, negativas: 0 });
  });
});

describe('porArea', () => {
  it('agrupa as áreas do dicionário nas 3 categorias fixas, mais as que o dicionário trouxer', () => {
    const dados = [
      interacao({ areas: [1] }), // Comunicação
      interacao({ areas: [2] }), // Relações Institucionais
      interacao({ areas: [3] }), // Operações Financeiras
      interacao({ areas: [5] }), // Relações com Investidores
    ];
    const resultado = porArea(dados, CATALOGO);
    // 3 fixas + "Performance e Dados", que a fixture tem ativa e nenhuma
    // categoria cobre — ver `categoriasDeArea`.
    expect(resultado).toHaveLength(4);
    expect(resultado.find((c) => c.rotulo === 'Performance e Dados')!.total).toBe(0);
    expect(resultado.find((c) => c.rotulo === 'Comunicação')!.total).toBe(1);
    expect(resultado.find((c) => c.rotulo === 'Relações Institucionais')!.total).toBe(1);
    // Operações Financeiras (3) + Relações com Investidores (5) somam na
    // mesma categoria — 1 interação de cada, 2 no total da categoria.
    expect(resultado.find((c) => c.rotulo === 'RI & Oper. Financeiras')!.total).toBe(2);
  });

  it('uma interação com as duas áreas da categoria composta conta uma vez só', () => {
    const dados = [interacao({ areas: [3, 5] })]; // Operações Financeiras + RI, mesma interação
    const resultado = porArea(dados, CATALOGO);
    expect(resultado.find((c) => c.rotulo === 'RI & Oper. Financeiras')!.total).toBe(1);
  });

  it('cada categoria tem a cor oficial fixa, não por posição no ranking', () => {
    // Só a categoria composta tem interação — se a cor fosse por posição no
    // ranking (a antiga PALETA_DE_AREAS[indice]), ela sairia na 1ª cor.
    const resultado = porArea([interacao({ areas: [5] })], CATALOGO);
    expect(resultado.find((c) => c.rotulo === 'RI & Oper. Financeiras')!.cor).toBe('#A11FFF');
    expect(resultado.find((c) => c.rotulo === 'Comunicação')!.cor).toBe('#E12379');
    expect(resultado.find((c) => c.rotulo === 'Relações Institucionais')!.cor).toBe('#17E3CB');
  });

  it('uma área ativa fora das 3 fixas conta na categoria própria; a desativada não conta', () => {
    // id 4 = "Performance e Dados": ATIVA no dicionário da fixture, fora das
    // 3 fixas — vira categoria própria e conta lá. Desativada de verdade, ela
    // nem chega ao dicionário, e aí não conta em lugar nenhum.
    const dados = [interacao({ areas: [4] }), interacao({ areas: [1] })];
    const resultado = porArea(dados, CATALOGO);
    expect(resultado.find((c) => c.rotulo === 'Performance e Dados')!.total).toBe(1);
    expect(resultado.find((c) => c.rotulo === 'Comunicação')!.total).toBe(1);

    const semAArea = montarCatalogo(
      { ...DICIONARIOS, areas_pessoa: DICIONARIOS.areas_pessoa.filter((a) => a.id !== 4) },
      INSTITUICOES,
      INTERLOCUTORES,
      PESSOAS,
    );
    const semEla = porArea(dados, semAArea);
    expect(semEla.reduce((soma, c) => soma + c.total, 0)).toBe(1);
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

  it('descarta uma coluna isolada bem distante do início, sem preencher o vão até ela', () => {
    // Uma interação de 2025-01 e o resto a partir de 2026-02: o vão até a
    // próxima coluna com dado (13 meses) passa do limite de 3, e sem o corte
    // a série encheria o eixo com um ano inteiro de meses vazios antes do
    // bloco de verdade — exatamente o efeito visual reportado no painel.
    const dados = [
      interacao({ data_interacao: '2025-01-08' }),
      interacao({ data_interacao: '2026-02-10' }),
      interacao({ data_interacao: '2026-03-15' }),
    ];
    const serie = completarMeses(
      serieMensal(dados, [{ chave: 'imprensa', rotulo: 'Imprensa', cor: '#000' }], () => [
        'imprensa',
      ]),
    );

    expect(serie.map((c) => c.mes)).toEqual(['2026-02', '2026-03']);
  });

  it('preenche um vão grande normalmente quando ele NÃO é o início da série', () => {
    // O vão de 6 meses aqui fica entre a segunda e a terceira coluna, não
    // entre a primeira e a segunda — o corte só olha o início, então este
    // vão continua preenchido como antes de existir o corte.
    const dados = [
      interacao({ data_interacao: '2026-01-10' }),
      interacao({ data_interacao: '2026-02-10' }),
      interacao({ data_interacao: '2026-08-10' }),
    ];
    const serie = completarMeses(
      serieMensal(dados, [{ chave: 'imprensa', rotulo: 'Imprensa', cor: '#000' }], () => [
        'imprensa',
      ]),
    );

    expect(serie.map((c) => c.mes)).toEqual([
      '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08',
    ]);
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

describe('rankingDePortaVozes', () => {
  it('conta o registro para cada porta-voz, chaveado pelo id', () => {
    const dados = [
      interacao({
        participacoes: [
          { pessoa_aegea_id: 'a1', papel: 'porta_voz', presenca: null },
          { pessoa_aegea_id: 'a2', papel: 'porta_voz', presenca: null },
        ],
      }),
    ];
    const lista = rankingDePortaVozes(dados, CATALOGO);
    expect(lista).toHaveLength(2);
    expect(lista.every((item) => item.total === 1)).toBe(true);
    // A CHAVE É O ID, não o nome — é o valor que o clique manda para
    // `recorte.portaVoz`, e o backend só entende um id (ver o comentário de
    // `rankingDePortaVozes`).
    expect(lista.map((item) => item.chave).sort()).toEqual(['a1', 'a2']);
  });

  it('ignora quem participou como equipe no ranking de porta-vozes', () => {
    const dados = [
      interacao({
        participacoes: [
          { pessoa_aegea_id: 'a1', papel: 'porta_voz', presenca: null },
          { pessoa_aegea_id: 'a2', papel: 'equipe', presenca: null },
        ],
      }),
    ];
    expect(rankingDePortaVozes(dados, CATALOGO)).toHaveLength(1);
  });
});

describe('ranking', () => {
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
          { pessoa_aegea_id: 'a1', papel: 'porta_voz', presenca: null },
          { pessoa_aegea_id: 'a2', papel: 'porta_voz', presenca: null },
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
          { pessoa_aegea_id: 'a1', papel: 'porta_voz', presenca: null },
          { pessoa_aegea_id: 'a2', papel: 'porta_voz', presenca: null },
        ],
      }),
      interacao({ participacoes: [{ pessoa_aegea_id: 'a1', papel: 'porta_voz', presenca: null }] }),
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
        participacoes: [{ pessoa_aegea_id: 'a1', papel: 'porta_voz', presenca: null }],
      }),
      interacao({
        data_interacao: '2026-06-10',
        temas: [11],
        participacoes: [{ pessoa_aegea_id: 'a1', papel: 'porta_voz', presenca: null }],
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
    // A contagem não pode ser descartada: sem ela, o ranking de temas por
    // frente desenha tudo com total 0 e barra vazia.
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

describe('categoriasDeArea', () => {
  it('as três fixas, mais uma por área ativa que nenhuma delas cobre', () => {
    // "Performance e Dados" está no dicionário da fixture e em categoria
    // nenhuma: vira categoria própria, em vez de ser contada em lugar nenhum.
    const rotulos = categoriasDeArea(CATALOGO).map((c) => c.rotulo);
    expect(rotulos).toEqual([
      'Comunicação',
      'Relações Institucionais',
      'RI & Oper. Financeiras',
      'Performance e Dados',
    ]);
    expect([...idsPorCategoriaDeArea(CATALOGO).get('Performance e Dados')!]).toEqual([4]);
  });

  it('sem área extra, são só as três', () => {
    const soAsTres = montarCatalogo(
      { ...DICIONARIOS, areas_pessoa: DICIONARIOS.areas_pessoa.filter((a) => a.id !== 4) },
      INSTITUICOES,
      INTERLOCUTORES,
      PESSOAS,
    );
    expect(categoriasDeArea(soAsTres)).toHaveLength(3);
  });
});

describe('comReativoNaBase', () => {
  it('reordena os segmentos de cada coluna com Reativo por último, sem mudar o original', () => {
    const coluna = {
      mes: '2026-05',
      total: 3,
      segmentos: [
        { chave: 'tenso', rotulo: 'Reativo', cor: '#3', total: 1 },
        { chave: 'propositivo', rotulo: 'Proativo', cor: '#1', total: 1 },
        { chave: 'novo', rotulo: 'Novo', cor: '#4', total: 1 },
      ],
    };
    const [ordenada] = comReativoNaBase([coluna]);
    expect(ordenada.segmentos.map((s) => s.chave)).toEqual(['propositivo', 'tenso', 'novo']);
    expect(coluna.segmentos.map((s) => s.chave)).toEqual(['tenso', 'propositivo', 'novo']);
  });
});

describe('divergenciasDoCatalogo', () => {
  const frentesAlinhadas = FRENTES.map((codigo, indice) => ({
    id: indice + 1,
    codigo,
    nome: ROTULOS_DE_FRENTE[codigo],
    cor_hex: CORES_DE_FRENTE[codigo],
    ordem: indice + 1,
  }));
  const catalogoCom = (frentes: typeof frentesAlinhadas) =>
    montarCatalogo({ ...DICIONARIOS, frentes }, INSTITUICOES, INTERLOCUTORES, PESSOAS);

  it('alinhado: nenhum aviso', () => {
    expect(divergenciasDoCatalogo(catalogoCom(frentesAlinhadas))).toEqual([]);
  });

  it('acusa nome e cor diferentes, frente só no código e frente só no dicionário', () => {
    const [imprensa, ...resto] = frentesAlinhadas;
    const avisos = divergenciasDoCatalogo(
      catalogoCom([
        { ...imprensa, nome: 'Mídia', cor_hex: '#000000' },
        ...resto.filter((f) => f.codigo !== 'interna'),
        { id: 99, codigo: 'ouvidoria' as Frente, nome: 'Ouvidoria', cor_hex: '#123456', ordem: 99 },
      ]),
    );
    expect(avisos).toEqual([
      expect.stringContaining('"imprensa" chama-se "Mídia"'),
      expect.stringContaining('"imprensa" tem a cor #000000'),
      expect.stringContaining('"interna" existe no código e não no dicionário'),
      expect.stringContaining('"ouvidoria" existe no dicionário e não no código'),
    ]);
  });
});

describe('climaPorTema', () => {
  it('conta propositivo/neutro/tenso por tema, ignorando quem não tem clima', () => {
    const dados = [
      interacao({ temas: [10], clima: 'propositivo' }),
      interacao({ temas: [10], clima: 'tenso' }),
      interacao({ temas: [10], clima: null }),
    ];
    expect(climaPorTema(dados, CATALOGO).Tarifa).toEqual({ propositivo: 1, neutro: 0, tenso: 1 });
  });

  it('uma interação com vários temas conta em cada um deles', () => {
    const dados = [interacao({ temas: [10, 11], clima: 'neutro' })];
    const resultado = climaPorTema(dados, CATALOGO);
    expect(resultado.Tarifa.neutro).toBe(1);
    expect(resultado.IPO.neutro).toBe(1);
  });

  it('tema sem nenhuma interação com clima não aparece no resultado', () => {
    expect(climaPorTema([], CATALOGO)).toEqual({});
  });
});

describe('scorePorCategoriaPublico', () => {
  const DICIONARIOS_COM_CATEGORIA = {
    ...DICIONARIOS,
    categorias_publico: [
      { id: 5, codigo: 'reguladores', nome: 'Reguladores', ordem: 1, padrao_de_quebra: 'sem_quebra', area_dona_id: null },
      { id: 7, codigo: 'poder_executivo', nome: 'Poder Executivo', ordem: 2, padrao_de_quebra: 'sem_quebra', area_dona_id: null },
    ],
  } as unknown as Dicionarios;

  const INSTITUICOES_COM_CATEGORIA: Instituicao[] = [
    { ...INSTITUICOES[0], id: 'i1', categoria_publico_id: 5 },
    { ...INSTITUICOES[1], id: 'i2', categoria_publico_id: 7 },
  ];

  const CATALOGO_COM_CATEGORIA = montarCatalogo(
    DICIONARIOS_COM_CATEGORIA,
    INSTITUICOES_COM_CATEGORIA,
    INTERLOCUTORES,
    PESSOAS,
  );

  it('conta positivas e negativas por categoria; neutro entra no total, sem clima não', () => {
    const dados = [
      interacao({ instituicao_id: 'i1', clima: 'propositivo' }),
      interacao({ instituicao_id: 'i1', clima: 'propositivo' }),
      interacao({ instituicao_id: 'i1', clima: 'tenso' }),
      interacao({ instituicao_id: 'i1', clima: 'neutro' }), // conta no total, não em pos/neg
      interacao({ instituicao_id: 'i1', clima: null }), // sem clima: fora do total inteiro
    ];
    const reguladores = scorePorCategoriaPublico(dados, CATALOGO_COM_CATEGORIA).itens.find(
      (c) => c.chave === '5',
    )!;
    expect(reguladores.total).toBe(4);
    expect(reguladores.positivas).toBe(2);
    expect(reguladores.negativas).toBe(1);
    expect(reguladores.score).toBe(Math.round(((2 - 1) / 4) * 100));
  });

  it('instituição sem categoria (ou inexistente no catálogo) não conta em lugar nenhum', () => {
    const dados = [interacao({ instituicao_id: 'i3', clima: 'propositivo' })];
    expect(scorePorCategoriaPublico(dados, CATALOGO_COM_CATEGORIA).itens).toHaveLength(0);
  });

  it('"quantos" corta por volume, mas categoriasForcadas acrescenta mais uma', () => {
    const dados = [
      interacao({ instituicao_id: 'i1', clima: 'propositivo' }),
      interacao({ instituicao_id: 'i1', clima: 'propositivo' }), // categoria 5: 2 interações
      interacao({ instituicao_id: 'i2', clima: 'tenso' }), // categoria 7: 1 interação
    ];
    const semForcar = scorePorCategoriaPublico(dados, CATALOGO_COM_CATEGORIA, 1);
    expect(semForcar.itens.map((c) => c.chave)).toEqual(['5']);

    const comForcar = scorePorCategoriaPublico(dados, CATALOGO_COM_CATEGORIA, 1, ['7']);
    expect(comForcar.itens.map((c) => c.chave).sort()).toEqual(['5', '7']);
  });

  it('ordena os itens exibidos do pior score para o melhor', () => {
    const dados = [
      interacao({ instituicao_id: 'i1', clima: 'tenso' }),
      interacao({ instituicao_id: 'i2', clima: 'propositivo' }),
    ];
    const resultado = scorePorCategoriaPublico(dados, CATALOGO_COM_CATEGORIA).itens;
    expect(resultado[0].chave).toBe('5');
    expect(resultado[resultado.length - 1].chave).toBe('7');
  });

  it('totalDeCategorias conta antes do corte por "quantos"', () => {
    const dados = [
      interacao({ instituicao_id: 'i1', clima: 'tenso' }),
      interacao({ instituicao_id: 'i2', clima: 'propositivo' }),
    ];
    const resultado = scorePorCategoriaPublico(dados, CATALOGO_COM_CATEGORIA, 1);
    expect(resultado.totalDeCategorias).toBe(2);
    expect(resultado.itens).toHaveLength(1);
  });
});

describe('jaAconteceu', () => {
  it('exige aceite E relato', () => {
    // Uma das duas sozinha não basta: aceito sem relato é reunião marcada que
    // ninguém contou; relato sem aceite é registro inconsistente.
    expect(jaAconteceu(interacao({ status: 'confirmada', relato: 'Houve.' }))).toBe(true);
    expect(jaAconteceu(interacao({ status: 'confirmada', relato: null }))).toBe(false);
    expect(jaAconteceu(interacao({ status: 'solicitado', relato: 'Houve.' }))).toBe(false);
  });

  it('a negada fica de fora mesmo com relato', () => {
    // O texto de uma recusa conta a recusa. Recusa não é reunião, e oferecê-la
    // como origem montaria uma cadeia a partir de algo que não aconteceu.
    expect(jaAconteceu(interacao({ status: 'declinado', relato: 'Recusamos.' }))).toBe(false);
  });
});
