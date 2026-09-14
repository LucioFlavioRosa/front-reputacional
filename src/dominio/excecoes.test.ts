/** As contas da fila de exceções, medidas.
 *
 *  Cada regra aqui decide se alguém vai olhar para uma agenda. Uma regra que
 *  acusa demais vira ruído e é desligada; uma que acusa de menos esconde
 *  justamente o que o sistema existe para avisar.
 */

import { describe, expect, it } from 'vitest';
import { agendasApontadas, excecoes, foraDoEscopo } from '@/dominio/excecoes';
import { montarCatalogo } from '@/dominio/derivacoes';
import type { Catalogo } from '@/dominio/derivacoes';
import type { Dicionarios, Interacao, PessoaAegea } from '@/dominio/tipos';

const DICIONARIOS = {
  status: [
    { id: 1, codigo: 'solicitado', rotulo: 'Solicitado', grupo: 'aberto', ordem: 0 },
    { id: 2, codigo: 'confirmada', rotulo: 'Aceito', grupo: 'aberto', ordem: 1 },
    { id: 3, codigo: 'declinado', rotulo: 'Negado', grupo: 'declinado', ordem: 2 },
  ],
  temas: [
    { id: 1, nome: 'Tarifa', nivel: 'estrategico' },
    { id: 2, nome: 'Reúso', nivel: 'estrategico' },
    { id: 3, nome: 'Carbono', nivel: 'estrategico' },
  ],
} as unknown as Dicionarios;

const PESSOAS: PessoaAegea[] = [
  { id: 'p1', nome: 'Letícia', cargo: null, email: null, eh_porta_voz: true, area_id: null, ativo: true, temas: [1] },
  { id: 'p2', nome: 'Joseane', cargo: null, email: null, eh_porta_voz: true, area_id: null, ativo: true, temas: [2] },
  { id: 'p3', nome: 'Sem assunto', cargo: null, email: null, eh_porta_voz: true, area_id: null, ativo: true, temas: [] },
];

const CATALOGO: Catalogo = montarCatalogo(DICIONARIOS, [], [], PESSOAS);
const HOJE = new Date('2026-09-07T12:00:00Z');

let contador = 0;
function agenda(ajustes: Partial<Interacao> = {}): Interacao {
  contador += 1;
  return {
    id: `i${contador}`,
    frente: 'governo',
    data_interacao: '2026-09-01',
    instituicao_id: 'x',
    interlocutor_id: null,
    unidade_negocio_id: null,
    esfera_id: null,
    uf: 'SP',
    modalidade: null,
    local: null,
    tier: 2,
    stakeholder_id: null,
    status: 'confirmada',
    clima: null,
    resultado: null,
    iniciativa: null,
    pauta: 'Uma agenda',
    posicionamento: null,
    // COM RELATO por padrão: é o que diz que a reunião aconteceu, e a
    // maioria das regras só se aplica a agenda que houve.
    relato: 'A reunião aconteceu.',
    encaminhamentos: 'Combinado o próximo passo.',
    pendencias: null,
    observacoes: null,
    registro_url: null,
    extensao: null,
    temas: [],
    participacoes: [],
    expectativa: null,
    clima_esperado: null,
    declinado_por: null,
    motivo_declinio: null,
    nota_situacao: null,
    preve_desdobramento: null,
    outra_parte: [],
    materiais: [{ momento: 'apoio', titulo: 'Nota', url: 'x' }],
    origens: [],
    derivadas: 0,
    fonte: 'cadastro_manual',
    visivel: true,
    criado_por: null,
    criado_em: null,
    atualizado_em: null,
    ...ajustes,
  } as Interacao;
}

const so = (lista: ReturnType<typeof excecoes>, chave: string) =>
  lista.find((e) => e.chave === chave);

describe('a agenda que parou', () => {
  it('acusa o pedido que atravessou o ciclo sem resposta', () => {
    const lista = excecoes(
      [agenda({ status: 'solicitado', relato: null, data_interacao: '2026-06-01' })],
      CATALOGO,
      HOJE,
    );

    expect(so(lista, 'paradas')?.agendas).toHaveLength(1);
  });

  it('nao cobra decisao de agenda ja ACEITA', () => {
    // Com tres situacoes, "aceito" tambem e do grupo aberto. Cobrar decisao
    // dela encheria a fila com tudo o que ja foi resolvido.
    const lista = excecoes(
      [agenda({ status: 'confirmada', data_interacao: '2026-06-01' })],
      CATALOGO,
      HOJE,
    );

    expect(so(lista, 'paradas')).toBeUndefined();
  });

  it('não acusa a que foi resolvida, por antiga que seja', () => {
    // Resolvido é resolvido. Acusar por idade transformaria o histórico
    // inteiro em fila de pendências.
    const lista = excecoes(
      [agenda({ status: 'confirmada', data_interacao: '2025-01-01' })],
      CATALOGO,
      HOJE,
    );

    expect(so(lista, 'paradas')).toBeUndefined();
  });

  it('não acusa a que está em aberto há pouco tempo', () => {
    const lista = excecoes(
      [agenda({ status: 'solicitado', relato: null, data_interacao: '2026-09-01' })],
      CATALOGO,
      HOJE,
    );

    expect(so(lista, 'paradas')).toBeUndefined();
  });
});

describe('fora do escopo', () => {
  it('acusa quem conduziu assunto que não é seu', () => {
    // O caso que a base guardava e nenhuma tela media: o vínculo existia com
    // zero linhas preenchidas porque nada o cobrava.
    const i = agenda({
      temas: [2],
      participacoes: [{ pessoa_aegea_id: 'p1', papel: 'porta_voz', presenca: null }],
    });

    expect(foraDoEscopo(i, CATALOGO)).toBe(true);
  });

  it('não acusa quando um dos porta-vozes responde pelo assunto', () => {
    // Basta UM: agenda com dois porta-vozes, um deles dono da pauta, está
    // coberta. Exigir que todos respondam acusaria toda agenda com apoio.
    const i = agenda({
      temas: [2],
      participacoes: [
        { pessoa_aegea_id: 'p1', papel: 'porta_voz', presenca: null },
        { pessoa_aegea_id: 'p2', papel: 'porta_voz', presenca: null },
      ],
    });

    expect(foraDoEscopo(i, CATALOGO)).toBe(false);
  });

  it('não acusa quando o porta-voz não tem assunto cadastrado', () => {
    // Isso é falta de CADASTRO, não desvio de escopo — e tem outra linha na
    // fila. Misturar os dois faria a regra acusar a própria ausência dela.
    const i = agenda({
      temas: [1],
      participacoes: [{ pessoa_aegea_id: 'p3', papel: 'porta_voz', presenca: null }],
    });

    expect(foraDoEscopo(i, CATALOGO)).toBe(false);
  });

  it('não acusa agenda sem assunto classificado', () => {
    const i = agenda({
      temas: [],
      participacoes: [{ pessoa_aegea_id: 'p1', papel: 'porta_voz', presenca: null }],
    });

    expect(foraDoEscopo(i, CATALOGO)).toBe(false);
  });

  it('ignora quem foi como equipe, e não como porta-voz', () => {
    // Quem acompanha não responde pela pauta.
    const i = agenda({
      temas: [2],
      participacoes: [{ pessoa_aegea_id: 'p1', papel: 'equipe', presenca: null }],
    });

    expect(foraDoEscopo(i, CATALOGO)).toBe(false);
  });
});

describe('o desdobramento que ninguém cobrou', () => {
  it('acusa quem previu e não gerou', () => {
    const lista = excecoes(
      [agenda({ preve_desdobramento: true, derivadas: 0 })],
      CATALOGO,
      HOJE,
    );

    expect(so(lista, 'desdobramento-nao-cobrado')?.agendas).toHaveLength(1);
  });

  it('não acusa quem previu e gerou', () => {
    const lista = excecoes(
      [agenda({ preve_desdobramento: true, derivadas: 2 })],
      CATALOGO,
      HOJE,
    );

    expect(so(lista, 'desdobramento-nao-cobrado')).toBeUndefined();
  });

  it('não acusa quem não previu nada', () => {
    // Nulo é NÃO INFORMADO, e não "não". Tratá-lo como negativa faria a base
    // inteira, que nasceu sem o campo, virar exceção.
    const lista = excecoes([agenda({ preve_desdobramento: null })], CATALOGO, HOJE);

    expect(so(lista, 'desdobramento-nao-cobrado')).toBeUndefined();
  });
});

describe('assunto sem cobertura', () => {
  it('lista o que está no cadastro e não apareceu em agenda nenhuma', () => {
    const lista = excecoes([agenda({ temas: [1] })], CATALOGO, HOJE);

    expect(so(lista, 'assunto-sem-agenda')?.itens).toEqual(['Carbono', 'Reúso']);
  });
});

describe('a fila inteira', () => {
  it('some quando não há nada a apontar', () => {
    // Uma fila que nunca fica vazia deixa de ser fila. Se tudo está em ordem,
    // a tela precisa poder dizer isso.
    const limpa = agenda({ temas: [1, 2, 3], tier: 2 });
    const lista = excecoes([limpa], CATALOGO, HOJE);

    expect(lista).toEqual([]);
  });

  it('conta agendas distintas, e não a soma das linhas', () => {
    // Uma agenda Tier 1 sem material e sem porta-voz aparece em duas linhas.
    // Somar as linhas diria "2 precisam de você" onde há uma.
    const uma = agenda({ tier: 1, materiais: [], participacoes: [] });
    const lista = excecoes([uma], CATALOGO, HOJE);

    expect(lista.length).toBeGreaterThan(1);
    expect(agendasApontadas(lista)).toBe(1);
  });

  it('põe o que está parado há mais tempo primeiro', () => {
    const lista = excecoes(
      [
        agenda({ status: 'solicitado', relato: null, data_interacao: '2026-07-01' }),
        agenda({ status: 'solicitado', relato: null, data_interacao: '2026-03-01' }),
      ],
      CATALOGO,
      HOJE,
    );

    expect(so(lista, 'paradas')?.agendas[0].data_interacao).toBe('2026-03-01');
  });
});

describe('decisão e registro se leem separados', () => {
  it('cada regra declara a sua natureza', () => {
    // MEDIDO na base de demonstração: uma fila única apontava 163 de 293
    // agendas — 56%. O que precisa de decisão hoje sumia no meio do registro
    // por preencher, e uma fila que sinaliza metade da base deixa de ser fila.
    const lista = excecoes(
      [
        agenda({ status: 'solicitado', relato: null, data_interacao: '2026-01-01' }),
        agenda({ encaminhamentos: null }),
      ],
      CATALOGO,
      HOJE,
    );

    expect(so(lista, 'paradas')?.natureza).toBe('decisao');
    expect(so(lista, 'sem-encaminhamento')?.natureza).toBe('registro');
  });

  it('toda regra tem natureza — nenhuma fica de fora da separação', () => {
    // Sem isto, uma regra nova nasceria sem grupo e sumiria da tela: os dois
    // blocos filtram por natureza, e o que não é nem um nem outro não aparece.
    const lista = excecoes(
      [
        agenda({ status: 'solicitado', relato: null, data_interacao: '2026-01-01' }),
        agenda({ encaminhamentos: null, tier: 1, materiais: [], participacoes: [] }),
        agenda({ preve_desdobramento: true, derivadas: 0 }),
        agenda({
          temas: [2],
          participacoes: [{ pessoa_aegea_id: 'p1', papel: 'porta_voz', presenca: null }],
        }),
      ],
      CATALOGO,
      HOJE,
    );

    expect(lista.length).toBeGreaterThan(3);
    for (const excecao of lista) {
      expect(['decisao', 'registro']).toContain(excecao.natureza);
    }
  });
});
