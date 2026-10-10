/** As 12 invariantes da C.4, checagem por checagem como em
 *  `docs/consulta-profundidade/validar_dados.py`, inclusive as tolerâncias
 *  (0,5 na nota; 0,051 nas somas de impacto entre pai e filhos, recortes e
 *  linhas do "O que mudou"; 0,05 no fechamento do "O que mudou"; 1e-9 nas
 *  igualdades exatas de ponto flutuante).
 *
 *  O JSON ENTREGUE PASSA EM TODAS (spec C.4). Se um teste daqui falhar, o
 *  defeito está na leitura (tipos, `fixtures/ilustrativo.ts`, cópia do
 *  arquivo), não no JSON.
 *
 *  NÓS DE FECHAMENTO (D5): a resposta real do endpoint `/consulta` traz
 *  'sem-pilar', 'sem-tema' e 'sem-subtema' como irmãos comuns. Eles entram nas
 *  somas (Σ filhos = pai, Σ pilares = nota − 50), mas não contam entre os 7
 *  pilares, nunca são destaque e nunca têm filhos nem `nivel2/3/4`. O JSON
 *  ilustrativo não tem nenhum; as regras abaixo valem para os dois.
 *
 *  O QUE A RESPOSTA REAL TEM DE DIFERENTE, e as regras já toleram: `nota` e os
 *  meses de `serie` vêm `null` quando o mês não tem dado (a 2 e a C.5 ignoram
 *  o buraco), e nó com volume 0 vem com sentimento {0, 0, 0} (a 4 exige 100 só
 *  com volume). A 12 NÃO SE APLICA À RESPOSTA DA API com a tolerância daqui:
 *  lá `de` e `para` são as notas inteiras e as linhas são impactos
 *  arredondados, então `de + Σ linhas` só fecha com `para` dentro do
 *  arredondamento da nota (até 0,5; medido: 62 + Σ = 42,40 contra 42).
 */

import { describe, expect, it } from 'vitest';

import { arred } from '../formatacao';
import { DADOS } from './fixtures/ilustrativo';
import { ehNoDeFechamento } from './seletores';
import type { Lente, No, Pilar, Sentimento, Subtema, Tema } from './tipos';

const LENTES = DADOS.lentes;
const LENTES_COM_DRILL = LENTES.filter((l) => l.drill);

const soma = (valores: number[]) => valores.reduce((s, v) => s + v, 0);

/** Todos os nós que o validador percorre, com o contexto para a mensagem. */
function pilaresDe(l: Lente): [string, Pilar][] {
  return l.pilares.map((p) => [`${l.id}/${p.id}`, p]);
}
function temasDe(l: Lente): [string, Tema][] {
  return l.pilares.flatMap((p) => (p.filhos ?? []).map((t): [string, Tema] => [`${l.id}/${p.id}/${t.id}`, t]));
}
function subtemasDe(l: Lente): [string, Subtema][] {
  return temasDe(l).flatMap(([ctx, t]) => (t.filhos ?? []).map((s): [string, Subtema] => [`${ctx}/${s.id}`, s]));
}
function subtemasComNivel4(l: Lente): [string, Subtema][] {
  return subtemasDe(l).filter(([, s]) => s.nivel4 !== undefined);
}

describe('C.4 · invariantes do JSON (validar_dados.py)', () => {
  it('a base tem as 5 lentes, e só a Imprensa desce além do Nível 1', () => {
    expect(LENTES.map((l) => l.id)).toEqual(['imprensa', 'mercado', 'sociedade', 'clientes', 'institucional']);
    expect(LENTES_COM_DRILL.map((l) => l.id)).toEqual(['imprensa']);
  });

  it('1 · pesos das lentes somam 1', () => {
    expect(Math.abs(soma(LENTES.map((l) => l.peso)) - 1)).toBeLessThan(1e-9);
  });

  it('C.5 · índice geral calculado é [55, 63, 53, 49, 51, 49]', () => {
    // `null` (mês sem dado, só nos dados reais) fica fora da soma.
    const isr = [0, 1, 2, 3, 4, 5].map((m) => arred(soma(LENTES.map((l) => l.peso * (l.serie[m] ?? 0)))));
    expect(isr).toEqual([55, 63, 53, 49, 51, 49]);
  });

  describe.each(LENTES.map((l) => [l.id, l] as const))('lente %s', (_id, l) => {
    it('2 · serie[5] === nota e |50 + Σ impacto dos pilares − nota| ≤ 0,5', () => {
      expect(l.serie).toHaveLength(6);
      expect(l.serie[l.serie.length - 1]).toBe(l.nota);
      // NOTA NULA (mês sem dado, nos dados reais): não há o que fechar.
      if (l.nota !== null) {
        expect(Math.abs(50 + soma(l.pilares.map((p) => p.impacto)) - l.nota)).toBeLessThanOrEqual(0.5);
      }
    });

    it('3 · Σ volume dos pilares === volumeTotal; sempre 7 pilares (fora o de fechamento)', () => {
      expect(soma(l.pilares.map((p) => p.volume))).toBe(l.volumeTotal);
      expect(l.pilares.filter((p) => !ehNoDeFechamento(p))).toHaveLength(7);
    });

    it('nós de fechamento (D5): só os três ids, sem filhos e sem nível abaixo', () => {
      const nos: [string, Pilar | Tema | Subtema, string][] = [
        ...pilaresDe(l).map(([ctx, p]): [string, Pilar, string] => [ctx, p, 'sem-pilar']),
        ...temasDe(l).map(([ctx, t]): [string, Tema, string] => [ctx, t, 'sem-tema']),
        ...subtemasDe(l).map(([ctx, x]): [string, Subtema, string] => [ctx, x, 'sem-subtema']),
      ];
      for (const [ctx, n, idEsperado] of nos) {
        if (!ehNoDeFechamento(n)) continue;
        expect(n.id, ctx).toBe(idEsperado);
        expect('filhos' in n ? n.filhos : undefined, ctx).toBeUndefined();
        expect('nivel2' in n ? n.nivel2 : undefined, ctx).toBeUndefined();
        expect('nivel3' in n ? n.nivel3 : undefined, ctx).toBeUndefined();
        expect('nivel4' in n ? n.nivel4 : undefined, ctx).toBeUndefined();
      }
    });

    it('4 · toda distribuição de sentimento soma 100 (ou tudo 0 com volume 0)', () => {
      const nos: [string, No][] = [...pilaresDe(l), ...temasDe(l), ...subtemasDe(l)];
      for (const [ctx, n] of nos) {
        expect(n.sentimento.pos + n.sentimento.neu + n.sentimento.neg, ctx).toBe(n.volume > 0 ? 100 : 0);
      }
    });

    it('6 · ids únicos entre irmãos', () => {
      const grupos: [string, { id: string }[]][] = [
        [l.id, l.pilares],
        ...l.pilares.map((p): [string, { id: string }[]] => [p.id, p.filhos ?? []]),
        ...temasDe(l).map(([ctx, t]): [string, { id: string }[]] => [ctx, t.filhos ?? []]),
        ...subtemasComNivel4(l).map(([ctx, s]): [string, { id: string }[]] => [ctx, s.nivel4!.itens]),
      ];
      for (const [ctx, irmaos] of grupos) {
        const ids = irmaos.map((x) => x.id);
        expect(new Set(ids).size, ctx).toBe(ids.length);
      }
    });

    it('12 · "O que mudou": de + Σ linhas = para, de === serie[4], linha = impacto − impactoMesAnterior do pilar', () => {
      for (const cl of l.cartoesLaterais) {
        if (cl.tipo !== 'oQueMudou') continue;
        expect(Math.abs(cl.de + soma(cl.linhas.map((x) => x.valor)) - cl.para)).toBeLessThanOrEqual(0.05);
        expect(cl.de).toBe(l.serie[l.serie.length - 2]);
        for (const x of cl.linhas) {
          const p = l.pilares.find((q) => q.nome === x.rotulo);
          expect(p, x.rotulo).toBeDefined();
          expect(p!.impactoMesAnterior, x.rotulo).toBeDefined();
          expect(Math.abs(p!.impacto - p!.impactoMesAnterior! - x.valor), x.rotulo).toBeLessThanOrEqual(0.051);
        }
      }
    });
  });

  it('12 · a Imprensa tem o cartão "O que mudou"', () => {
    expect(LENTES_COM_DRILL[0].cartoesLaterais.some((c) => c.tipo === 'oQueMudou')).toBe(true);
  });

  describe.each(LENTES_COM_DRILL.map((l) => [l.id, l] as const))('lente com drill %s', (_id, l) => {
    it('todo pilar (fora o de fechamento) tem temas e nivel2', () => {
      for (const [ctx, p] of pilaresDe(l)) {
        if (ehNoDeFechamento(p)) continue;
        expect(p.filhos, ctx).toBeDefined();
        expect(p.nivel2, ctx).toBeDefined();
      }
    });

    it('5 · nó com filhos: Σ volume === volume do pai e |Σ impacto − impacto do pai| ≤ 0,051', () => {
      const pais: [string, Pilar | Tema][] = [...pilaresDe(l), ...temasDe(l)];
      for (const [ctx, pai] of pais) {
        const filhos: No[] = pai.filhos ?? [];
        if (filhos.length === 0) continue;
        expect(soma(filhos.map((x) => x.volume)), ctx).toBe(pai.volume);
        expect(Math.abs(soma(filhos.map((x) => x.impacto)) - pai.impacto), ctx).toBeLessThanOrEqual(0.051);
      }
    });

    it('7 · tema em destaque do Nível 2: maior |impacto| (desempate por volume), evolução e concentração fecham', () => {
      for (const [ctx, p] of pilaresDe(l)) {
        if (ehNoDeFechamento(p)) continue;
        // O DESTAQUE É SEMPRE UM TEMA IDENTIFICADO: 'sem-tema' fica de fora.
        const filhos = p.filhos!.filter((x) => !ehNoDeFechamento(x));
        const de = p.nivel2!.destaque;
        const candidatos = filhos.filter((x) => x.id === de.temaId);
        expect(candidatos, `${ctx}: destaque inexistente`).toHaveLength(1);
        const t = candidatos[0];

        // Igual ao `max(..., key=(abs(impacto), volume))` do Python: o
        // primeiro dos maiores, comparando |impacto| e depois volume.
        const maior = filhos.reduce((m, x) => {
          const dif = Math.abs(x.impacto) - Math.abs(m.impacto);
          return dif > 0 || (dif === 0 && x.volume > m.volume) ? x : m;
        });
        expect(maior.id, `${ctx}: destaque não é o de maior |impacto|`).toBe(t.id);

        const ev = de.evolucao;
        expect(ev.impactos[ev.impactos.length - 1], `${ctx}: evolução (impacto)`).toBe(t.impacto);
        expect(ev.volumes[ev.volumes.length - 1], `${ctx}: evolução (volume)`).toBe(t.volume);
        if (t.impactoMesAnterior !== undefined) {
          expect(Math.abs(ev.impactos[ev.impactos.length - 2] - t.impactoMesAnterior), `${ctx}: mês anterior`).toBeLessThan(
            1e-9,
          );
        }

        for (const k of ['concessionarias', 'ufs'] as const) {
          const cc = de.concentracao[k];
          expect(soma(cc.map((x) => x.volume)), `${ctx}/${k}: volume`).toBe(t.volume);
          expect(Math.abs(soma(cc.map((x) => x.impacto)) - t.impacto), `${ctx}/${k}: impacto`).toBeLessThanOrEqual(0.051);
        }
      }
    });

    it('8 · recortes do Nível 3 (tiers e concessionárias) somam volume e impacto do subtema em destaque', () => {
      for (const [ctx, t] of temasDe(l)) {
        if (ehNoDeFechamento(t) || !t.filhos?.length) continue;
        expect(t.nivel3, `${ctx}: tema com subtemas sem nivel3`).toBeDefined();
        const n3 = t.nivel3!.destaque;
        const s = t.filhos.find((x) => x.id === n3.subtemaId);
        expect(s, `${ctx}: subtema em destaque inexistente`).toBeDefined();
        expect(ehNoDeFechamento(s!), `${ctx}: destaque é nó de fechamento`).toBe(false);
        for (const k of ['tiers', 'concessionarias'] as const) {
          const linhas = n3[k].linhas;
          expect(soma(linhas.map((x) => x.volume)), `${ctx}/${k}: volume`).toBe(s!.volume);
          expect(Math.abs(soma(linhas.map((x) => x.impacto)) - s!.impacto), `${ctx}/${k}: impacto`).toBeLessThanOrEqual(
            0.051,
          );
        }
      }
    });

    it('existem exatamente os dois subtemas com Nível 4 da C.3', () => {
      expect(subtemasComNivel4(l).map(([, s]) => s.id)).toEqual(['rompimento-adutora', 'fiscalizacao-regulatoria']);
      expect(subtemasComNivel4(l).map(([, s]) => s.nivel4!.itens.length)).toEqual([11, 7]);
    });

    it('9 · subtema com nivel4: contagens somam o volume; porDia com 31 dias, somas e nenhum dia com mais negativas que total', () => {
      for (const [ctx, s] of subtemasComNivel4(l)) {
        const n4 = s.nivel4!;
        expect(s.contagens, `${ctx}: sem contagens`).toBeDefined();
        const cg = s.contagens!;
        expect(cg.pos + cg.neu + cg.neg, `${ctx}: contagens`).toBe(s.volume);
        expect(soma(n4.porDia.total), `${ctx}: porDia total`).toBe(s.volume);
        expect(soma(n4.porDia.negativas), `${ctx}: porDia negativas`).toBe(cg.neg);
        n4.porDia.total.forEach((total, dia) => {
          expect(total, `${ctx}: negativas > total no dia ${dia + 1}`).toBeGreaterThanOrEqual(n4.porDia.negativas[dia]);
        });
        expect(n4.porDia.total, `${ctx}: 31 dias`).toHaveLength(31);
      }
    });

    it('10 · impacto do item = sinal × pesoTier × 50 ÷ totalPonderado, em 2 casas', () => {
      const sinal: Record<Sentimento, number> = { positivo: 1, neutro: 0, negativo: -1 };
      expect(l.totalPonderado, 'totalPonderado').toBeDefined();
      for (const [ctx, s] of subtemasComNivel4(l)) {
        for (const it of s.nivel4!.itens) {
          const esperado = arred((sinal[it.sentimento] * DADOS.pesoTier[it.tier] * 50) / l.totalPonderado!, 2);
          expect(Math.abs(it.impacto - esperado), `${ctx}/${it.id}`).toBeLessThan(1e-9);
        }
      }
      // O exemplo da spec: Tier 1 negativo = −0,12.
      expect(arred((-1 * DADOS.pesoTier['Tier 1'] * 50) / l.totalPonderado!, 2)).toBe(-0.12);
    });

    it('11 · a amostra tem ao menos um item de cada sentimento', () => {
      for (const [ctx, s] of subtemasComNivel4(l)) {
        for (const nome of ['positivo', 'neutro', 'negativo'] as const) {
          expect(
            s.nivel4!.itens.some((i) => i.sentimento === nome),
            `${ctx}: amostra sem ${nome}`,
          ).toBe(true);
        }
      }
    });
  });
});
