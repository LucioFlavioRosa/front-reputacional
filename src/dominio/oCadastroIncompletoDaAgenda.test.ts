/** O destaque que diz "revise este cadastro depois".
 *
 *  POR QUE ESTE ARQUIVO EXISTE. A importação de planilha deixou de barrar nome
 *  que não está no cadastro: a instituição nasce com o que houver e fica
 *  incompleta até alguém completá-la na plataforma. Sem um destaque, "fica
 *  incompleta" quer dizer "ninguém nunca mais olha" — e foi por isso que o dono
 *  do produto o pediu, em 11/10/2026.
 *
 *  E O CRITÉRIO FOI ESCOLHIDO POR MEDIDA, não por gosto. A primeira ideia era
 *  "instituição sem categoria de público"; no banco, das 99 instituições que
 *  aparecem em agendas apenas 58 têm categoria, e o destaque acenderia em 250 das
 *  544 agendas. Alerta que acende em metade da Base ensina a ignorar alerta.
 *  Tier está preenchido em 99 das 99 — a ausência dele não existe hoje, então
 *  quando aparecer significa algo.
 */

import { describe, expect, it } from 'vitest';

import { montarCatalogo, oQueFaltaNoCadastroDaAgenda } from '@/dominio/derivacoes';
import type { Dicionarios, Instituicao, Interacao } from '@/dominio/tipos';

const DICIONARIOS = {
  temas: [],
  areas_pessoa: [],
  unidades_negocio: [],
  formatos_interacao: [],
  esferas: [],
  relevancias: [],
  status: [],
  climas: [],
  resultados: [],
  iniciativas: [],
  categorias_publico: [],
  subcategorias_publico: [],
} as unknown as Dicionarios;

function instituicao(sobrescrever: Partial<Instituicao> = {}): Instituicao {
  return {
    id: 'i1',
    nome: 'Prefeitura de Campinas',
    tipo: 'orgao',
    uf: 'SP',
    ativo: true,
    tier: 2,
    ...sobrescrever,
  } as Instituicao;
}

function agenda(): Interacao {
  return { id: 'a1', instituicao_id: 'i1' } as Interacao;
}

function catalogoCom(inst: Instituicao) {
  return montarCatalogo(DICIONARIOS, [inst], [], []);
}

describe('o cadastro incompleto da agenda', () => {
  it('não acusa nada quando a instituição tem relevância', () => {
    expect(oQueFaltaNoCadastroDaAgenda(catalogoCom(instituicao()), agenda())).toBeNull();
  });

  it('acusa a relevância ausente, com o nome que a pessoa reconhece', () => {
    const achado = oQueFaltaNoCadastroDaAgenda(
      catalogoCom(instituicao({ tier: null })),
      agenda(),
    );
    expect(achado).toEqual({ nome: 'Prefeitura de Campinas', falta: ['relevância'] });
  });

  it('NÃO acusa a categoria de público ausente, e isto é a decisão medida', () => {
    // 41% das instituições que aparecem em agendas não têm categoria: a ausência
    // é o estado normal do CRM, e acender por ela acenderia em metade da Base.
    // Se alguém a acrescentar ao critério, este teste cai e a medida está aqui.
    const achado = oQueFaltaNoCadastroDaAgenda(
      catalogoCom(instituicao({ categoria_publico_id: null })),
      agenda(),
    );
    expect(achado).toBeNull();
  });

  it('se apaga sozinho quando o cadastro é completado', () => {
    // É A RAZÃO DE SER DERIVADO em vez de gravado na agenda: não há nada a
    // marcar como revisado, e completar o cadastro limpa o destaque de TODAS as
    // agendas daquela instituição de uma vez.
    const incompleta = instituicao({ tier: null });
    expect(oQueFaltaNoCadastroDaAgenda(catalogoCom(incompleta), agenda())).not.toBeNull();
    expect(
      oQueFaltaNoCadastroDaAgenda(catalogoCom({ ...incompleta, tier: 3 }), agenda()),
    ).toBeNull();
  });

  it('não acusa nada quando a instituição não está no catálogo', () => {
    // Acontece com cadastro desativado que o catálogo da tela não trouxe. Dizer
    // "sem relevância" de uma instituição que não se conseguiu ler seria afirmar
    // o que não se sabe.
    const achado = oQueFaltaNoCadastroDaAgenda(
      montarCatalogo(DICIONARIOS, [], [], []),
      agenda(),
    );
    expect(achado).toBeNull();
  });
});
