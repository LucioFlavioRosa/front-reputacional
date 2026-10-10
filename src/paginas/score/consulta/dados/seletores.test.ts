import { describe, expect, it } from 'vitest';

import { DADOS } from './dados';
import {
  NOMES_DOS_NIVEIS,
  agruparPorImpacto,
  buscarNoDrill,
  escalaDeImpacto,
  filtrarItens,
  lenteDoDrill,
  mediaArredondada,
  montarIndiceDeBusca,
  normalizarBusca,
  opcoesDaAmostra,
  ordenarItens,
  participacao,
  pilarNavegavel,
  resolverCaminho,
  subtemaNavegavel,
  temaNavegavel,
} from './seletores';
import type { EnderecoDoDrill } from '../endereco';
import type { IndiceDeBusca } from './seletores';
import type { Dados, Item, No } from './tipos';

const imprensa = lenteDoDrill(DADOS, 'imprensa')!;
const mercado = lenteDoDrill(DADOS, 'mercado')!;
const eficiencia = imprensa.pilares.find((p) => p.id === 'eficiencia-operacional')!;
const abastecimento = eficiencia.filhos!.find((t) => t.id === 'abastecimento-agua')!;
const rompimento = abastecimento.filhos!.find((s) => s.id === 'rompimento-adutora')!;
const itensRompimento = rompimento.nivel4!.itens;

function no(id: string, impacto: number, volume = 1): No {
  return { id, nome: id, volume, impacto, sentimento: { pos: 0, neu: 100, neg: 0 } };
}

function item(id: string, data: string, impacto: number, extra: Partial<Item> = {}): Item {
  return {
    id,
    data,
    impacto,
    veiculo: 'V',
    jornalista: 'J',
    tier: 'Tier 1',
    sentimento: impacto < 0 ? 'negativo' : impacto > 0 ? 'positivo' : 'neutro',
    concessionaria: 'C',
    uf: 'RJ',
    titulo: 'T',
    trecho: '',
    url: null,
    ...extra,
  };
}

describe('níveis e navegabilidade (C.3)', () => {
  it('nomes dos níveis', () => {
    expect(NOMES_DOS_NIVEIS).toEqual({ 1: 'Lente e pilares', 2: 'Temas estratégicos', 3: 'Subtemas', 4: 'Matérias' });
  });

  it('lenteDoDrill', () => {
    expect(lenteDoDrill(DADOS, 'mercado')?.nome).toBe('Mercado');
    expect(lenteDoDrill(DADOS, 'xyz')).toBeUndefined();
  });

  it('os 7 pilares da Imprensa são navegáveis; nenhum do Mercado é', () => {
    expect(imprensa.pilares.every((p) => pilarNavegavel(imprensa, p))).toBe(true);
    expect(mercado.pilares.some((p) => pilarNavegavel(mercado, p))).toBe(false);
  });

  it('só Abastecimento de água e Contratos e Regulação são temas navegáveis', () => {
    const navegaveis = imprensa.pilares.flatMap((p) => p.filhos ?? []).filter(temaNavegavel).map((t) => t.id);
    expect(navegaveis).toEqual(['abastecimento-agua', 'contratos-regulacao']);
  });

  it('só Rompimento de adutora e Fiscalização regulatória são subtemas navegáveis', () => {
    const navegaveis = imprensa.pilares
      .flatMap((p) => p.filhos ?? [])
      .flatMap((t) => t.filhos ?? [])
      .filter(subtemaNavegavel)
      .map((s) => s.id);
    expect(navegaveis).toEqual(['rompimento-adutora', 'fiscalizacao-regulatoria']);
  });
});

describe('resolverCaminho (D.2 adaptada)', () => {
  it('hash vazio: Nível 1 da lente, sem correção', () => {
    const c = resolverCaminho(DADOS, 'imprensa', { ativo: false });
    expect(c.nivel).toBe(1);
    expect(c.lente.id).toBe('imprensa');
    expect(c.pilar).toBeUndefined();
    expect(c.corrigido).toBeUndefined();
  });

  it('marcador sozinho: Nível 1, corrigido só para pôr a lente', () => {
    const c = resolverCaminho(DADOS, 'imprensa', { ativo: true });
    expect(c.nivel).toBe(1);
    expect(c.corrigido).toEqual({ ativo: true, lente: 'imprensa' });
  });

  it('Nível 1 canônico: sem correção', () => {
    const c = resolverCaminho(DADOS, 'imprensa', { ativo: true, lente: 'imprensa' });
    expect(c.nivel).toBe(1);
    expect(c.corrigido).toBeUndefined();
  });

  it('Nível 2 válido', () => {
    const c = resolverCaminho(DADOS, 'imprensa', { ativo: true, lente: 'imprensa', pilar: 'governanca' });
    expect(c.nivel).toBe(2);
    expect(c.pilar?.id).toBe('governanca');
    expect(c.tema).toBeUndefined();
    expect(c.corrigido).toBeUndefined();
  });

  it('Nível 3 válido', () => {
    const c = resolverCaminho(DADOS, 'imprensa', {
      ativo: true,
      lente: 'imprensa',
      pilar: 'governanca',
      tema: 'contratos-regulacao',
    });
    expect(c.nivel).toBe(3);
    expect(c.tema?.id).toBe('contratos-regulacao');
    expect(c.corrigido).toBeUndefined();
  });

  it('Nível 4 válido, com filtros da lista (não há correção)', () => {
    const c = resolverCaminho(DADOS, 'imprensa', {
      ativo: true,
      lente: 'imprensa',
      pilar: 'eficiencia-operacional',
      tema: 'abastecimento-agua',
      subtema: 'rompimento-adutora',
      sent: 'negativas',
      ordem: 'data',
      tier: 'Tier 1',
      conc: 'Águas do Rio',
      uf: 'RJ',
      item: 'rom-01',
    });
    expect(c.nivel).toBe(4);
    expect(c.pilar).toBe(eficiencia);
    expect(c.tema).toBe(abastecimento);
    expect(c.subtema).toBe(rompimento);
    expect(c.corrigido).toBeUndefined();
  });

  it('pilar inválido: Nível 1, corrigido sem níveis e sem filtros', () => {
    const c = resolverCaminho(DADOS, 'imprensa', {
      ativo: true,
      lente: 'imprensa',
      pilar: 'nao-existe',
      tema: 'abastecimento-agua',
      sent: 'negativas',
      uf: 'RJ',
    });
    expect(c.nivel).toBe(1);
    expect(c.pilar).toBeUndefined();
    expect(c.corrigido).toEqual({ ativo: true, lente: 'imprensa' });
  });

  it('tema válido com pilar errado: para no Nível 2 do pilar', () => {
    const c = resolverCaminho(DADOS, 'imprensa', { ativo: true, pilar: 'governanca', tema: 'abastecimento-agua' });
    expect(c.nivel).toBe(2);
    expect(c.pilar?.id).toBe('governanca');
    expect(c.tema).toBeUndefined();
    expect(c.corrigido).toEqual({ ativo: true, lente: 'imprensa', pilar: 'governanca' });
  });

  it('subtema sem nivel4 (frequencia-continuidade): para no Nível 3', () => {
    const c = resolverCaminho(DADOS, 'imprensa', {
      ativo: true,
      lente: 'imprensa',
      pilar: 'eficiencia-operacional',
      tema: 'abastecimento-agua',
      subtema: 'frequencia-continuidade',
      ordem: 'data',
      conc: 'Águas do Rio',
      item: 'rom-01',
    });
    expect(c.nivel).toBe(3);
    expect(c.subtema).toBeUndefined();
    expect(c.corrigido).toEqual({
      ativo: true,
      lente: 'imprensa',
      pilar: 'eficiencia-operacional',
      tema: 'abastecimento-agua',
    });
  });

  it('tema sem nivel3 (esgoto): para no Nível 2', () => {
    const c = resolverCaminho(DADOS, 'imprensa', { ativo: true, pilar: 'eficiencia-operacional', tema: 'esgoto' });
    expect(c.nivel).toBe(2);
    expect(c.tema).toBeUndefined();
    expect(c.corrigido).toEqual({ ativo: true, lente: 'imprensa', pilar: 'eficiencia-operacional' });
  });

  it('tema sem pilar é descartado', () => {
    const c = resolverCaminho(DADOS, 'imprensa', { ativo: true, tema: 'abastecimento-agua' });
    expect(c.nivel).toBe(1);
    expect(c.tema).toBeUndefined();
    expect(c.corrigido).toEqual({ ativo: true, lente: 'imprensa' });
  });

  it('subtema sem tema é descartado', () => {
    const c = resolverCaminho(DADOS, 'imprensa', {
      ativo: true,
      pilar: 'eficiencia-operacional',
      subtema: 'rompimento-adutora',
    });
    expect(c.nivel).toBe(2);
    expect(c.corrigido).toEqual({ ativo: true, lente: 'imprensa', pilar: 'eficiencia-operacional' });
  });

  it('lente mercado com pilar=governanca fica no Nível 1', () => {
    const c = resolverCaminho(DADOS, 'mercado', { ativo: true, lente: 'mercado', pilar: 'governanca' });
    expect(c.lente.id).toBe('mercado');
    expect(c.nivel).toBe(1);
    expect(c.pilar).toBeUndefined();
    expect(c.corrigido).toEqual({ ativo: true, lente: 'mercado' });
  });

  it('lente inexistente cai em imprensa e o endereço é corrigido para ela', () => {
    const c = resolverCaminho(DADOS, 'xyz', { ativo: true, lente: 'xyz' });
    expect(c.lente.id).toBe('imprensa');
    expect(c.nivel).toBe(1);
    expect(c.corrigido).toEqual({ ativo: true, lente: 'imprensa' });
  });

  it('lente inexistente cai em imprensa e ainda desce nela, mantendo o nível', () => {
    const c = resolverCaminho(DADOS, 'xyz', { ativo: true, lente: 'xyz', pilar: 'governanca' });
    expect(c.lente.id).toBe('imprensa');
    expect(c.nivel).toBe(2);
    expect(c.corrigido).toEqual({ ativo: true, lente: 'imprensa', pilar: 'governanca' });
  });

  it('lente do endereço diferente da aba: corrigido para a lente da aba', () => {
    const c = resolverCaminho(DADOS, 'imprensa', { ativo: true, lente: 'mercado', pilar: 'governanca' });
    expect(c.lente.id).toBe('imprensa');
    expect(c.nivel).toBe(2);
    expect(c.corrigido).toEqual({ ativo: true, lente: 'imprensa', pilar: 'governanca' });
  });

  it('filtros da lista fora do Nível 4 são descartados', () => {
    const c = resolverCaminho(DADOS, 'imprensa', {
      ativo: true,
      lente: 'imprensa',
      pilar: 'governanca',
      sent: 'negativas',
      ordem: 'data',
      tier: 'Tier 1',
      conc: 'Corsan',
      uf: 'RS',
      item: 'rom-01',
    });
    expect(c.nivel).toBe(2);
    expect(c.corrigido).toEqual({ ativo: true, lente: 'imprensa', pilar: 'governanca' });
  });

  it('padrões da lista (sent=todas, ordem=impacto) fora do Nível 4 não pedem correção', () => {
    const c = resolverCaminho(DADOS, 'imprensa', {
      ativo: true,
      lente: 'imprensa',
      pilar: 'governanca',
      sent: 'todas',
      ordem: 'impacto',
    });
    expect(c.corrigido).toBeUndefined();
  });

  it('item de outro subtema e filtros fora da amostra: descartados, o resto fica', () => {
    const c = resolverCaminho(DADOS, 'imprensa', {
      ativo: true,
      lente: 'imprensa',
      pilar: 'governanca',
      tema: 'contratos-regulacao',
      subtema: 'fiscalizacao-regulatoria',
      sent: 'negativas',
      item: 'rom-01',
      tier: 'Tier 9',
      conc: 'Inexistente',
      uf: 'XX',
    });
    expect(c.nivel).toBe(4);
    expect(c.corrigido).toEqual({
      ativo: true,
      lente: 'imprensa',
      pilar: 'governanca',
      tema: 'contratos-regulacao',
      subtema: 'fiscalizacao-regulatoria',
      sent: 'negativas',
    });
  });

  it('o endereço corrigido é canônico: resolvê-lo de novo não corrige mais', () => {
    const enderecos: EnderecoDoDrill[] = [
      { ativo: true, lente: 'xyz', pilar: 'governanca', sent: 'negativas' },
      { ativo: true, pilar: 'governanca', tema: 'contratos-regulacao', subtema: 'fiscalizacao-regulatoria', item: 'rom-01' },
      { ativo: true, lente: 'imprensa', pilar: 'x', tier: 'Tier 1' },
    ];
    for (const e of enderecos) {
      const corrigido = resolverCaminho(DADOS, 'imprensa', e).corrigido;
      expect(corrigido).toBeDefined();
      expect(resolverCaminho(DADOS, 'imprensa', corrigido!).corrigido).toBeUndefined();
    }
  });

  it('correção preserva a lente da aba', () => {
    const c = resolverCaminho(DADOS, 'imprensa', { ativo: true, lente: 'imprensa', pilar: 'x' });
    expect(c.corrigido?.lente).toBe('imprensa');
  });

  it('base sem imprensa e lente inexistente: erro explícito', () => {
    const semImprensa: Dados = { ...DADOS, lentes: [mercado] };
    expect(() => resolverCaminho(semImprensa, 'xyz', { ativo: false })).toThrow(/imprensa/);
  });
});

describe('agruparPorImpacto (E.4.2)', () => {
  it('pressiona: do mais negativo ao menos; sustenta: do maior ao menor, zero por último', () => {
    const g = agruparPorImpacto([no('a', -1), no('b', 0), no('c', 2), no('d', -3.5), no('e', 0.4), no('f', -0.2)]);
    expect(g.pressiona.map((n) => n.id)).toEqual(['d', 'a', 'f']);
    expect(g.sustenta.map((n) => n.id)).toEqual(['c', 'e', 'b']);
    expect(g.somaPressiona).toBe(-4.7);
    expect(g.somaSustenta).toBe(2.4);
  });

  it('somas com 1 casa, sem resíduo de ponto flutuante', () => {
    const g = agruparPorImpacto([no('a', 0.1), no('b', 0.2), no('c', -0.1), no('d', -0.2)]);
    expect(g.somaSustenta).toBe(0.3);
    expect(g.somaPressiona).toBe(-0.3);
  });

  it('pilares da Imprensa: −11,1 e +3,1', () => {
    const g = agruparPorImpacto(imprensa.pilares);
    expect(g.somaPressiona).toBe(-11.1);
    expect(g.somaSustenta).toBe(3.1);
    expect(g.pressiona.map((p) => p.id)).toEqual(['eficiencia-operacional', 'governanca', 'responsabilidade-ambiental']);
  });

  it('temas da Eficiência: −7,8 e +0,4', () => {
    const g = agruparPorImpacto(eficiencia.filhos!);
    expect(g.somaPressiona).toBe(-7.8);
    expect(g.somaSustenta).toBe(0.4);
  });

  it('grupo vazio soma zero', () => {
    const g = agruparPorImpacto([no('a', 1)]);
    expect(g.pressiona).toEqual([]);
    expect(g.somaPressiona).toBe(0);
  });

  it('não altera a lista recebida', () => {
    const nos = [no('a', 1), no('b', 2)];
    agruparPorImpacto(nos);
    expect(nos.map((n) => n.id)).toEqual(['a', 'b']);
  });
});

describe('escalas e proporções', () => {
  it('escalaDeImpacto = max(|v|) × folga', () => {
    expect(escalaDeImpacto([-7.4, 1.2, 0.3])).toBeCloseTo(7.77, 10);
    expect(escalaDeImpacto([-2, 1], 1.15)).toBeCloseTo(2.3, 10);
    expect(escalaDeImpacto([0, 0])).toBe(1);
    expect(escalaDeImpacto([])).toBe(1);
  });

  it('participacao arredonda meio para cima', () => {
    expect(participacao(512, 1284)).toBe(40);
    expect(participacao(1, 8)).toBe(13);
    expect(participacao(5, 0)).toBe(0);
  });

  it('mediaArredondada', () => {
    expect(mediaArredondada([1, 2])).toBe(2);
    expect(mediaArredondada([10, 20, 31])).toBe(20);
    expect(mediaArredondada([])).toBe(0);
  });
});

describe('ordenarItens (F.9)', () => {
  it('impacto: |impacto| desc; empate, negativo antes; depois data crescente; depois id', () => {
    const itens = [
      item('z', '2026-08-10', 0.12),
      item('b', '2026-08-15', -0.12),
      item('a', '2026-08-15', -0.12),
      item('c', '2026-08-12', -0.12),
      item('d', '2026-08-01', -0.06),
      item('e', '2026-08-01', 0),
    ];
    expect(ordenarItens(itens, 'impacto').map((i) => i.id)).toEqual(['c', 'a', 'b', 'z', 'd', 'e']);
  });

  it('data: data desc; empate |impacto| desc; depois id', () => {
    const itens = [
      item('a', '2026-08-12', -0.06),
      item('c', '2026-08-14', 0.12),
      item('b', '2026-08-12', -0.12),
      item('e', '2026-08-12', 0.12),
      item('d', '2026-08-01', -0.12),
    ];
    expect(ordenarItens(itens, 'data').map((i) => i.id)).toEqual(['c', 'b', 'e', 'a', 'd']);
  });

  it('amostra do Rompimento de adutora por impacto', () => {
    expect(ordenarItens(itensRompimento, 'impacto').map((i) => i.id)).toEqual([
      'rom-01',
      'rom-02',
      'rom-03',
      'rom-04',
      'rom-05',
      'rom-06',
      'rom-07',
      'rom-08',
      'rom-09',
      'rom-10',
      'rom-11',
    ]);
  });

  it('não altera a lista recebida', () => {
    const itens = [item('b', '2026-08-01', 0), item('a', '2026-08-02', -0.12)];
    ordenarItens(itens, 'impacto');
    expect(itens.map((i) => i.id)).toEqual(['b', 'a']);
  });
});

describe('filtrarItens', () => {
  it('sem filtro ou "todas": tudo', () => {
    expect(filtrarItens(itensRompimento, {})).toHaveLength(11);
    expect(filtrarItens(itensRompimento, { sent: 'todas' })).toHaveLength(11);
  });

  it('abas de sentimento mapeiam para o sentimento do item', () => {
    expect(filtrarItens(itensRompimento, { sent: 'negativas' }).every((i) => i.sentimento === 'negativo')).toBe(true);
    expect(filtrarItens(itensRompimento, { sent: 'negativas' })).toHaveLength(9);
    expect(filtrarItens(itensRompimento, { sent: 'neutras' }).map((i) => i.id)).toEqual(['rom-11']);
    expect(filtrarItens(itensRompimento, { sent: 'positivas' }).map((i) => i.id)).toEqual(['rom-08']);
  });

  it('sentimento desconhecido não filtra, nem com nome de chave do protótipo', () => {
    expect(filtrarItens(itensRompimento, { sent: 'algumas' })).toHaveLength(11);
    for (const sent of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
      expect(filtrarItens(itensRompimento, { sent }), sent).toHaveLength(11);
    }
  });

  it('tier, concessionária e UF combinam com E', () => {
    expect(filtrarItens(itensRompimento, { tier: 'Tier 2' })).toHaveLength(3);
    expect(filtrarItens(itensRompimento, { conc: 'Corsan' }).map((i) => i.id)).toEqual(['rom-10']);
    expect(filtrarItens(itensRompimento, { uf: 'RJ', tier: 'Tier 2' }).map((i) => i.id)).toEqual(['rom-09', 'rom-11']);
    expect(filtrarItens(itensRompimento, { sent: 'positivas', tier: 'Tier 2' })).toEqual([]);
    expect(
      filtrarItens(itensRompimento, { sent: 'negativas', tier: 'Tier 1', conc: 'Águas do Rio', uf: 'RJ' }),
    ).toHaveLength(7);
  });
});

describe('opcoesDaAmostra', () => {
  it('valores únicos e em ordem', () => {
    expect(opcoesDaAmostra(itensRompimento)).toEqual({
      tiers: ['Tier 1', 'Tier 2'],
      concessionarias: ['Águas do Rio', 'Corsan'],
      ufs: ['RJ', 'RS'],
    });
  });
});

describe('normalizarBusca', () => {
  it('minúsculas, sem acento, espaços colapsados', () => {
    expect(normalizarBusca('  Fiscalização   REGULATÓRIA ')).toBe('fiscalizacao regulatoria');
    expect(normalizarBusca('Águas do Rio')).toBe('aguas do rio');
    expect(normalizarBusca('Crédito\te\nrating')).toBe('credito e rating');
  });
});

describe('montarIndiceDeBusca', () => {
  const entradas = montarIndiceDeBusca(DADOS);
  const indice = entradas.map((e) => e.resultado);

  it('a matéria leva título, veículo, jornalista e concessionária como textos pesquisáveis', () => {
    const rom10 = entradas.find((e) => e.resultado.destino.item === 'rom-10')!;
    const original = itensRompimento.find((i) => i.id === 'rom-10')!;
    expect(rom10.textos).toEqual([original.titulo, original.veiculo, original.jornalista, original.concessionaria]);
    expect(rom10.resultado.nome).toBe(original.titulo);
  });

  it('só lentes com drill: 7 pilares, temas, subtemas e as matérias das amostras', () => {
    const contar = (tipo: string) => indice.filter((r) => r.tipo === tipo).length;
    const temas = imprensa.pilares.flatMap((p) => p.filhos ?? []);
    const subtemas = temas.flatMap((t) => t.filhos ?? []);
    expect(contar('Pilar')).toBe(7);
    expect(contar('Tema')).toBe(temas.length);
    expect(contar('Subtema')).toBe(subtemas.length);
    expect(contar('Matéria')).toBe(18);
    expect(indice.every((r) => r.destino.lente === 'imprensa' && r.destino.ativo)).toBe(true);
  });

  it('ids únicos', () => {
    expect(new Set(indice.map((r) => r.id)).size).toBe(indice.length);
  });

  it('caminho do Subtema no formato da E.9', () => {
    const r = indice.find((x) => x.tipo === 'Subtema' && x.nome === 'Rompimento de adutora')!;
    expect(r.caminho).toBe('Imprensa › Eficiência Operacional e Qualidade › Abastecimento de água · 96 matérias');
  });

  it('caminho de Pilar, Tema e Matéria com o mesmo separador', () => {
    expect(indice.find((x) => x.id === 'pilar:eficiencia-operacional')!.caminho).toBe('Imprensa · 512 matérias');
    expect(indice.find((x) => x.id === 'tema:eficiencia-operacional/abastecimento-agua')!.caminho).toBe(
      'Imprensa › Eficiência Operacional e Qualidade · 214 matérias',
    );
    const materia = indice.find((x) => x.tipo === 'Matéria' && x.destino.item === 'rom-01')!;
    expect(materia.caminho).toBe(
      'Imprensa › Eficiência Operacional e Qualidade › Abastecimento de água › Rompimento de adutora · O Globo · 12/08',
    );
  });

  it('destinos de cada tipo (E.9)', () => {
    const destino = (id: string) => indice.find((x) => x.id === id)!.destino;
    expect(destino('pilar:governanca')).toEqual({ ativo: true, lente: 'imprensa', pilar: 'governanca' });
    expect(destino('tema:governanca/contratos-regulacao')).toEqual({
      ativo: true,
      lente: 'imprensa',
      pilar: 'governanca',
      tema: 'contratos-regulacao',
    });
    expect(destino('tema:eficiencia-operacional/esgoto')).toEqual({
      ativo: true,
      lente: 'imprensa',
      pilar: 'eficiencia-operacional',
    });
    expect(destino('subtema:eficiencia-operacional/abastecimento-agua/frequencia-continuidade')).toEqual({
      ativo: true,
      lente: 'imprensa',
      pilar: 'eficiencia-operacional',
      tema: 'abastecimento-agua',
    });
    expect(destino('subtema:eficiencia-operacional/abastecimento-agua/rompimento-adutora')).toEqual({
      ativo: true,
      lente: 'imprensa',
      pilar: 'eficiencia-operacional',
      tema: 'abastecimento-agua',
      subtema: 'rompimento-adutora',
    });
  });

  it('todo destino resolve sem correção', () => {
    for (const r of indice) {
      const c = resolverCaminho(DADOS, 'imprensa', r.destino);
      expect(c.corrigido, r.id).toBeUndefined();
    }
  });
});

describe('buscarNoDrill (E.9)', () => {
  const indice = montarIndiceDeBusca(DADOS);
  const buscar = (termo: string) => buscarNoDrill(indice, termo);
  const resumo = (termo: string) => buscar(termo).map((r) => `${r.tipo}:${r.destino.item ?? r.nome}`);

  it('menos de 2 caracteres não busca', () => {
    expect(buscar('')).toEqual([]);
    expect(buscar('a')).toEqual([]);
    expect(buscar(' á ')).toEqual([]);
  });

  it('adutora: o subtema e 3 matérias, destino Nível 4', () => {
    expect(resumo('adutora')).toEqual(['Subtema:Rompimento de adutora', 'Matéria:rom-01', 'Matéria:rom-02', 'Matéria:rom-03']);
    expect(buscar('adutora')[0].destino).toEqual({
      ativo: true,
      lente: 'imprensa',
      pilar: 'eficiencia-operacional',
      tema: 'abastecimento-agua',
      subtema: 'rompimento-adutora',
    });
  });

  it('agua (sem acento): temas antes das matérias, maior |impacto| primeiro', () => {
    const r = buscar('agua');
    expect(r.filter((x) => x.tipo === 'Tema').map((x) => x.nome)).toEqual(['Abastecimento de água', 'Qualidade da água']);
    expect(r.filter((x) => x.tipo === 'Matéria')).toHaveLength(3);
    expect(r[0].destino.tema).toBe('abastecimento-agua');
    expect(r[1].destino).toEqual({ ativo: true, lente: 'imprensa', pilar: 'eficiencia-operacional' });
  });

  it('O Globo: matérias do veículo, no máximo 3', () => {
    const r = buscar('O Globo');
    expect(r).toHaveLength(3);
    expect(r.every((x) => x.tipo === 'Matéria')).toBe(true);
    const itens = imprensa.pilares
      .flatMap((p) => p.filhos ?? [])
      .flatMap((t) => t.filhos ?? [])
      .flatMap((s) => s.nivel4?.itens ?? []);
    for (const x of r) expect(itens.find((i) => i.id === x.destino.item)?.veiculo).toBe('O Globo');
  });

  it('fiscalizacao: o subtema (Nível 4) e as matérias, quem começa com o termo primeiro', () => {
    expect(resumo('fiscalizacao')).toEqual(['Subtema:Fiscalização regulatória', 'Matéria:fis-03', 'Matéria:fis-06']);
    expect(buscar('fiscalizacao')[0].destino).toEqual({
      ativo: true,
      lente: 'imprensa',
      pilar: 'governanca',
      tema: 'contratos-regulacao',
      subtema: 'fiscalizacao-regulatoria',
    });
  });

  it('Corsan: busca na concessionária e leva ao item', () => {
    const r = buscar('Corsan');
    expect(r).toHaveLength(1);
    expect(r[0].tipo).toBe('Matéria');
    expect(r[0].destino).toEqual({
      ativo: true,
      lente: 'imprensa',
      pilar: 'eficiencia-operacional',
      tema: 'abastecimento-agua',
      subtema: 'rompimento-adutora',
      item: 'rom-10',
    });
  });

  it('rating: tema não navegável leva ao Nível 2 do pilar', () => {
    const r = buscar('rating');
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ tipo: 'Tema', nome: 'Crédito e rating', impacto: 0.8 });
    expect(r[0].destino).toEqual({ ativo: true, lente: 'imprensa', pilar: 'crescimento-solidez' });
  });

  it('todas as palavras precisam aparecer', () => {
    expect(resumo('globo renata').length).toBeGreaterThan(0);
    expect(buscar('globo corsan')).toEqual([]);
  });

  it('busca no jornalista', () => {
    expect(buscar('Julia Barcellos').map((r) => r.destino.item)).toEqual(['rom-09', 'fis-06']);
  });

  it('ordem dos tipos: Subtema, Tema, Pilar, Matéria; máximo de 8', () => {
    const ordem = ['Subtema', 'Tema', 'Pilar', 'Matéria'];
    for (const termo of ['ao', 'de', 'agua', 'rio', 'regula']) {
      const r = buscar(termo);
      expect(r.length).toBeLessThanOrEqual(8);
      expect(r.filter((x) => x.tipo === 'Matéria').length).toBeLessThanOrEqual(3);
      const posicoes = r.map((x) => ordem.indexOf(x.tipo));
      expect(posicoes).toEqual([...posicoes].sort((a, b) => a - b));
    }
    expect(buscar('de')).toHaveLength(8);
  });

  it('dentro do tipo: maior |impacto| primeiro, mas quem começa com o termo vem antes', () => {
    const r = buscar('regula').filter((x) => x.tipo !== 'Matéria');
    // "irregulares" contém "regula": a busca é por trecho, não por palavra inteira.
    expect(r.map((x) => x.nome)).toEqual([
      'Fiscalização regulatória',
      'Perdas, fraudes e ligações irregulares',
      'Agências reguladoras',
      'Contratos e Regulação',
    ]);
    const manual: IndiceDeBusca = [
      { id: 'a', nome: 'Grande crise da água', impacto: -5 },
      { id: 'b', nome: 'Água de reúso', impacto: 0.1 },
    ].map((r) => ({
      resultado: { ...r, tipo: 'Tema' as const, caminho: '', destino: { ativo: true } },
      textos: [r.nome],
    }));
    expect(buscarNoDrill(manual, 'agua').map((x) => x.id)).toEqual(['b', 'a']);
  });

  it('uma cópia do índice continua buscando em veículo e concessionária', () => {
    const copias: IndiceDeBusca[] = [
      indice.map((e) => ({ ...e, resultado: { ...e.resultado } })),
      structuredClone(indice),
      JSON.parse(JSON.stringify(indice)) as IndiceDeBusca,
    ];
    for (const copia of copias) {
      expect(buscarNoDrill(copia, 'Corsan').map((r) => r.destino.item)).toEqual(['rom-10']);
      expect(buscarNoDrill(copia, 'O Globo')).toHaveLength(3);
    }
  });

  it('tipo vem antes de começar com o termo', () => {
    expect(buscar('governanca').map((x) => `${x.tipo}:${x.nome}`)).toEqual([
      'Tema:Governança corporativa',
      'Pilar:Governança',
    ]);
  });
});
