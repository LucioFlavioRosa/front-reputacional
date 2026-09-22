import { describe, expect, it } from 'vitest';
import type { Interacao, Material } from '@/dominio/tipos';
import {
  COLUNA_ANTES,
  COLUNA_DEPOIS,
  climaAntesEDepois,
  contagemPorDicionario,
  documentosDasAgendas,
  portaVozesDe,
  rankingPorId,
} from '@/dominio/preparacao';

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
    consulta: null,
    alegacoes: [],
    fonte: 'cadastro_manual',
    visivel: true,
    criado_por: null,
    criado_em: null,
    atualizado_em: null,
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

function material(ajustes: Partial<Material> = {}): Material {
  return {
    id: null,
    momento: 'obtido',
    titulo: 'Ata',
    url: null,
    observacao: null,
    arquivo: null,
    referencia_id: null,
    temas: [],
    ...ajustes,
  };
}

const CLIMAS = [
  { codigo: 'propositivo', nome: 'Proativo', cor_hex: '#1' },
  { codigo: 'neutro', nome: 'Neutro', cor_hex: '#2' },
  { codigo: 'tenso', nome: 'Reativo', cor_hex: '#3' },
];

describe('documentosDasAgendas', () => {
  it('só materiais com arquivo ou link, das agendas mais recentes primeiro', () => {
    const antiga = interacao({
      data_interacao: '2026-01-01',
      materiais: [material({ id: 'm1', url: 'https://a' })],
    });
    const recente = interacao({
      data_interacao: '2026-06-01',
      materiais: [
        material({ id: 'm2', arquivo: { id: 'f', nome: 'ata.pdf', tipo_conteudo: 'application/pdf', tamanho: 1 } }),
        material({ id: 'm3' }), // sem arquivo nem link: não tem o que abrir
      ],
    });
    const docs = documentosDasAgendas([antiga, recente]);
    expect(docs.map((d) => d.chave)).toEqual(['m2', 'm1']);
    expect(docs[0].agenda).toBe(recente);
  });

  it('material sem id ganha chave estável pela agenda e posição', () => {
    const agenda = interacao({ id: 'x', materiais: [material({ url: 'https://a' })] });
    expect(documentosDasAgendas([agenda])[0].chave).toBe('x:0');
  });
});

describe('contagemPorDicionario', () => {
  it('um segmento por valor do dicionário, mesmo com zero, na cor do dicionário', () => {
    const dados = [interacao({ clima: 'tenso' }), interacao({ clima: 'tenso' }), interacao({ clima: null })];
    expect(contagemPorDicionario(dados, CLIMAS, (a) => a.clima)).toEqual([
      { chave: 'propositivo', rotulo: 'Proativo', total: 0, cor: '#1' },
      { chave: 'neutro', rotulo: 'Neutro', total: 0, cor: '#2' },
      { chave: 'tenso', rotulo: 'Reativo', total: 2, cor: '#3' },
    ]);
  });
});

describe('climaAntesEDepois', () => {
  it('duas colunas com as mesmas fatias: esperado e registrado', () => {
    const dados = [
      interacao({ clima_esperado: 'tenso', clima: 'neutro' }),
      interacao({ clima_esperado: 'neutro', clima: 'neutro' }),
      interacao({ clima_esperado: null, clima: 'propositivo' }),
    ];
    const { colunas, esperado, registrado } = climaAntesEDepois(dados, CLIMAS);
    expect(colunas.map((c) => c.mes)).toEqual([COLUNA_ANTES, COLUNA_DEPOIS]);
    expect(colunas[0].segmentos).toBe(esperado);
    expect(colunas[1].segmentos).toBe(registrado);
    expect(colunas[0].total).toBe(2); // uma sem esperado não conta no "antes"
    expect(colunas[1].total).toBe(3);
    expect(colunas[0].segmentos.map((s) => s.total)).toEqual([0, 1, 1]);
    expect(registrado.map((s) => s.total)).toEqual([1, 2, 0]);
  });

  it('o filtro é por REUNIÃO, não por fatia: filtradas pelo esperado, elas seguem no Depois', () => {
    // O que o servidor devolve com `climaEsperado=tenso`: todas esperavam
    // Reativo; o registrado é o que foi. A coluna "Antes" fica só Reativo e a
    // "Depois" mostra como essas MESMAS reuniões terminaram — quem ainda não
    // tem clima registrado só não entra no "Depois".
    const filtradas = [
      interacao({ clima_esperado: 'tenso', clima: 'propositivo' }),
      interacao({ clima_esperado: 'tenso', clima: 'tenso' }),
      interacao({ clima_esperado: 'tenso', clima: null }),
    ];
    const { colunas } = climaAntesEDepois(filtradas, CLIMAS);
    expect(colunas[0].total).toBe(3);
    expect(colunas[0].segmentos.map((s) => s.total)).toEqual([0, 0, 3]);
    expect(colunas[1].total).toBe(2);
    expect(colunas[1].segmentos.map((s) => s.total)).toEqual([1, 0, 1]);
  });
});

describe('rankingPorId', () => {
  it('conta ocorrências, ignora nulos, ordena e corta', () => {
    const itens = rankingPorId(['a', 'b', 'a', null, 'c', 'a', 'b'], (id) => id.toUpperCase(), 2);
    expect(itens).toEqual([
      { chave: 'a', rotulo: 'A', total: 3 },
      { chave: 'b', rotulo: 'B', total: 2 },
    ]);
  });
});

describe('portaVozesDe', () => {
  it('uma ocorrência por participação como porta-voz — equipe não conta', () => {
    const dados = [
      interacao({
        participacoes: [
          { pessoa_aegea_id: 'pv1', papel: 'porta_voz', presenca: null },
          { pessoa_aegea_id: 'pv2', papel: 'porta_voz', presenca: null },
          { pessoa_aegea_id: 'eq1', papel: 'equipe', presenca: null },
        ],
      }),
      interacao({ participacoes: [{ pessoa_aegea_id: 'pv1', papel: 'porta_voz', presenca: null }] }),
    ];
    expect(portaVozesDe(dados)).toEqual(['pv1', 'pv2', 'pv1']);
  });
});
