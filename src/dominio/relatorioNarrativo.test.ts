/** O Relatório Executivo: texto corrido, participantes juntados com "e",
 *  Pendências de fora, e as duas granularidades (semana e mês).
 */

import { describe, expect, it } from 'vitest';
import { montarCatalogo } from '@/dominio/derivacoes';
import type { Catalogo } from '@/dominio/derivacoes';
import { chaveDaSemana } from '@/dominio/formato';
import {
  gerarRelatorioNarrativo,
  periodosDisponiveis,
  rotuloDoPeriodo,
} from '@/dominio/relatorioNarrativo';
import type {
  Dicionarios,
  Instituicao,
  Interacao,
  Interlocutor,
  ParticipanteDaOutraParte,
} from '@/dominio/tipos';

const DICIONARIOS = {
  climas: [{ id: 1, codigo: 'neutro', nome: 'Neutro', cor_hex: '#000', ordem: 1 }],
  temas: [
    { id: 1, nome: 'Copasa', nivel: 'estrategico' },
    { id: 2, nome: 'Clima', nivel: 'estrategico' },
    { id: 3, nome: 'Disciplina financeira', nivel: 'estrategico' },
  ],
} as unknown as Dicionarios;

const INSTITUICOES: Instituicao[] = [
  {
    id: 'i1', nome: 'Esfera Brasil', tipo: 'orgao', nome_completo: null, uf: 'SP', tier: 1,
    esfera_id: null, categoria_publico_id: null, subcategoria_publico_id: null, ativo: true,
  },
];

const INTERLOCUTORES: Interlocutor[] = [
  { id: 'p1', nome: 'Igor Bastos', instituicao_id: 'i1', cargo: null, email: null, tipo: null, ativo: true },
  { id: 'p2', nome: 'Juliane Silva', instituicao_id: 'i1', cargo: null, email: null, tipo: null, ativo: true },
  { id: 'p3', nome: 'Anderson Juiz', instituicao_id: 'i1', cargo: null, email: null, tipo: null, ativo: true },
];

const CATALOGO: Catalogo = montarCatalogo(DICIONARIOS, INSTITUICOES, INTERLOCUTORES, []);

function participante(interlocutor_id: string, principal = false): ParticipanteDaOutraParte {
  return { interlocutor_id, presenca: null, principal };
}

let contador = 0;
function interacao(ajustes: Partial<Interacao> = {}): Interacao {
  contador += 1;
  return {
    id: `r${contador}`,
    frente: 'governo',
    data_interacao: '2026-09-04',
    instituicao_id: 'i1',
    interlocutor_id: 'p1',
    unidade_negocio_id: null,
    esfera_id: null,
    formato_interacao_id: null,
    uf: 'SP',
    modalidade: null,
    local: null,
    tier: 1,
    status: 'atendido',
    clima: 'neutro',
    resultado: null,
    iniciativa: null,
    pauta: null,
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
    outra_parte: [],
    materiais: [],
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
    ...ajustes,
  };
}

describe('gerarRelatorioNarrativo', () => {
  it('devolve null quando o período não tem nenhuma interação', () => {
    const dados = [interacao({ data_interacao: '2026-09-04' })];
    expect(gerarRelatorioNarrativo(dados, CATALOGO, '2026-08', 'mes')).toBeNull();
  });

  it('sem outra_parte, usa só o interlocutor_id — registro antigo, de planilha', () => {
    const dados = [interacao({ interlocutor_id: 'p1', outra_parte: [] })];
    const relatorio = gerarRelatorioNarrativo(dados, CATALOGO, '2026-09', 'mes');
    expect(relatorio?.dias[0].entradas[0].participantes).toBe('Igor Bastos');
  });

  it('com outra_parte, junta todos com "e", o principal primeiro', () => {
    const dados = [
      interacao({ outra_parte: [participante('p2'), participante('p1', true), participante('p3')] }),
    ];
    const relatorio = gerarRelatorioNarrativo(dados, CATALOGO, '2026-09', 'mes');
    expect(relatorio?.dias[0].entradas[0].participantes).toBe(
      'Igor Bastos, Juliane Silva e Anderson Juiz',
    );
  });

  it('temas juntos com "e"', () => {
    const dados = [interacao({ temas: [1, 2, 3] })];
    const relatorio = gerarRelatorioNarrativo(dados, CATALOGO, '2026-09', 'mes');
    expect(relatorio?.dias[0].entradas[0].temas).toBe('Copasa, Clima e Disciplina financeira');
  });

  it('sem tema nenhum, o campo fica nulo — não vira um "—" no meio do texto', () => {
    const dados = [interacao({ temas: [] })];
    const relatorio = gerarRelatorioNarrativo(dados, CATALOGO, '2026-09', 'mes');
    expect(relatorio?.dias[0].entradas[0].temas).toBeNull();
  });

  it('clima nulo quando não informado — sem "—" na linha', () => {
    const dados = [interacao({ clima: null })];
    const relatorio = gerarRelatorioNarrativo(dados, CATALOGO, '2026-09', 'mes');
    expect(relatorio?.dias[0].entradas[0].clima).toBeNull();
  });

  it('clima com o rótulo do dicionário quando informado', () => {
    const dados = [interacao({ clima: 'neutro' })];
    const relatorio = gerarRelatorioNarrativo(dados, CATALOGO, '2026-09', 'mes');
    expect(relatorio?.dias[0].entradas[0].clima).toBe('Neutro');
  });

  it('pendências nunca aparece na entrada — é controle operacional, não relato', () => {
    const dados = [interacao({ pendencias: 'Enviar e-mail para Josefina' })];
    const relatorio = gerarRelatorioNarrativo(dados, CATALOGO, '2026-09', 'mes');
    expect(relatorio?.dias[0].entradas[0]).not.toHaveProperty('pendencias');
  });

  it('relato, encaminhamentos e observações aparados, e nulos quando em branco', () => {
    const dados = [interacao({ relato: '  Debate. ', encaminhamentos: '', observacoes: null })];
    const relatorio = gerarRelatorioNarrativo(dados, CATALOGO, '2026-09', 'mes');
    const entrada = relatorio?.dias[0].entradas[0];
    expect(entrada?.relato).toBe('Debate.');
    expect(entrada?.encaminhamentos).toBeNull();
    expect(entrada?.observacoes).toBeNull();
  });

  it('agrupa por dia e ordena do mais antigo ao mais recente', () => {
    const dados = [
      interacao({ data_interacao: '2026-09-10' }),
      interacao({ data_interacao: '2026-09-04' }),
      interacao({ data_interacao: '2026-09-04' }),
    ];
    const relatorio = gerarRelatorioNarrativo(dados, CATALOGO, '2026-09', 'mes');
    expect(relatorio?.dias.map((d) => d.data)).toEqual(['2026-09-04', '2026-09-10']);
    expect(relatorio?.dias[0].entradas).toHaveLength(2);
    expect(relatorio?.totalReunioes).toBe(3);
    expect(relatorio?.totalInstituicoes).toBe(1);
    expect(relatorio?.totalDias).toBe(2);
  });

  it('granularidade "semana" filtra pela semana, não pelo mês inteiro', () => {
    const dados = [
      interacao({ id: 'da-semana', data_interacao: '2026-09-04' }),
      interacao({ id: 'de-outra-semana', data_interacao: '2026-09-14' }),
    ];
    const semana = chaveDaSemana('2026-09-04');
    const relatorio = gerarRelatorioNarrativo(dados, CATALOGO, semana, 'semana');
    expect(relatorio?.totalReunioes).toBe(1);
    expect(relatorio?.dias[0].entradas[0].id).toBe('da-semana');
  });
});

describe('periodosDisponiveis / rotuloDoPeriodo', () => {
  it('"mes" delega para os meses com interação', () => {
    const dados = [interacao({ data_interacao: '2026-09-04' })];
    expect(periodosDisponiveis(dados, 'mes')).toEqual(['2026-09']);
    expect(rotuloDoPeriodo('2026-09', 'mes')).toBe('Setembro de 2026');
  });

  it('"semana" delega para as semanas com interação', () => {
    const dados = [interacao({ data_interacao: '2026-09-04' })];
    const semanas = periodosDisponiveis(dados, 'semana');
    expect(semanas).toEqual([chaveDaSemana('2026-09-04')]);
    expect(rotuloDoPeriodo(semanas[0], 'semana')).toMatch(/de Setembro de 2026$/);
  });
});
