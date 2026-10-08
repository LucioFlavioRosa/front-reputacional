/** Os três níveis da taxonomia de temas (N1 pilar, N2 tema estratégico, N3
 *  subtema) nas contas do Painel e no recorte. */

import { describe, expect, it } from 'vitest';

import {
  idDoTemaNoNivel,
  nomesDosTemasNoNivel,
  scorePorTema,
  temasMaisRecorrentes,
} from '@/dominio/derivacoes';
import type { Catalogo } from '@/dominio/derivacoes';
import { alternarTemaN1, alternarTemaN2, paraParametros, quantidadeDeFiltros } from '@/dominio/recorte';
import type { Interacao } from '@/dominio/tipos';

//: Dois pilares; Governança com dois temas estratégicos.
const CATALOGO = {
  dicionarios: {
    blocos_tema: [
      { id: 1, codigo: 'gov', nome: 'Governança', ordem: 1 },
      { id: 2, codigo: 'amb', nome: 'Responsabilidade Ambiental', ordem: 2 },
    ],
    macro_temas: [
      { id: 10, bloco_tema_id: 1, codigo: 'etica', nome: 'Ética', ordem: 1 },
      { id: 11, bloco_tema_id: 1, codigo: 'reg', nome: 'Regulação', ordem: 2 },
      { id: 20, bloco_tema_id: 2, codigo: 'agua', nome: 'Recursos hídricos', ordem: 1 },
    ],
    temas: [
      { id: 100, nome: 'Compliance', nivel: 'gerais', macro_tema_id: 10 },
      { id: 101, nome: 'Reajuste tarifário', nivel: 'estrategico', macro_tema_id: 11 },
      { id: 200, nome: 'Qualidade da água', nivel: 'estrategico', macro_tema_id: 20 },
    ],
    temas_inativos: [{ id: 999, nome: 'Tema antigo', nivel: 'gerais', macro_tema_id: null }],
  },
} as unknown as Catalogo;

const interacao = (temas: number[], clima: string | null = 'neutro') =>
  ({ id: `i${temas.join('-')}${clima}`, temas, clima, data_interacao: '2026-09-01' }) as unknown as Interacao;

describe('nomesDosTemasNoNivel', () => {
  it('sobe do N3 para o N2 e o N1, sem repetir o mesmo pilar', () => {
    const ids = [100, 101, 200];
    expect(nomesDosTemasNoNivel(CATALOGO, ids, 'n3')).toEqual([
      'Compliance',
      'Reajuste tarifário',
      'Qualidade da água',
    ]);
    expect(nomesDosTemasNoNivel(CATALOGO, ids, 'n2')).toEqual(['Ética', 'Regulação', 'Recursos hídricos']);
    expect(nomesDosTemasNoNivel(CATALOGO, ids, 'n1')).toEqual([
      'Governança',
      'Responsabilidade Ambiental',
    ]);
  });

  it('tema sem N2 aparece no N3 e fica fora de N1/N2', () => {
    expect(nomesDosTemasNoNivel(CATALOGO, [999], 'n3')).toEqual(['Tema antigo']);
    expect(nomesDosTemasNoNivel(CATALOGO, [999], 'n1')).toEqual([]);
  });

  it('acha o id de um N1/N2 pelo nome, para o clique virar filtro', () => {
    expect(idDoTemaNoNivel(CATALOGO, 'n1', 'Governança')).toBe(1);
    expect(idDoTemaNoNivel(CATALOGO, 'n2', 'Regulação')).toBe(11);
    expect(idDoTemaNoNivel(CATALOGO, 'n2', 'Inexistente')).toBeUndefined();
  });
});

describe('contas do Painel por nível', () => {
  const interacoes = [
    interacao([100, 101], 'tenso'), // dois temas de Governança: conta uma vez no N1
    interacao([200], 'propositivo'),
    interacao([101], 'propositivo'),
  ];

  it('temasMaisRecorrentes conta uma interação uma vez por pilar', () => {
    const n1 = temasMaisRecorrentes(interacoes, CATALOGO, 5, 'n1');
    expect(n1.map((t) => [t.rotulo, t.total])).toEqual([
      ['Governança', 2],
      ['Responsabilidade Ambiental', 1],
    ]);
  });

  it('scorePorTema calcula o saldo no nível pedido', () => {
    const { itens } = scorePorTema(interacoes, CATALOGO, 8, [], 'n1');
    const governanca = itens.find((i) => i.chave === 'Governança')!;
    // 1 positiva, 1 negativa em 2 → 0
    expect(governanca.total).toBe(2);
    expect(governanca.score).toBe(0);
    expect(itens.find((i) => i.chave === 'Responsabilidade Ambiental')!.score).toBe(100);
  });
});

describe('filtros N1 e N2 no recorte', () => {
  const pilarDoN2 = (id: number) =>
    (CATALOGO.dicionarios.macro_temas ?? []).find((m) => m.id === id)?.bloco_tema_id;

  it('viajam ao servidor como ids separados por vírgula e contam um filtro cada', () => {
    const recorte = alternarTemaN2(alternarTemaN1({}, 1, pilarDoN2), 11);
    const parametros = paraParametros(recorte);
    expect(parametros.get('temasN1')).toBe('1');
    expect(parametros.get('temasN2')).toBe('11');
    expect(quantidadeDeFiltros(recorte)).toBe(2);
  });

  it('marcar um pilar tira os N2 de outros pilares', () => {
    const comAgua = alternarTemaN2({}, 20);
    const soGovernanca = alternarTemaN1(comAgua, 1, pilarDoN2);
    expect(soGovernanca.temasN1).toEqual([1]);
    expect(soGovernanca.temasN2).toBeUndefined();
  });

  it('clicar de novo desliga', () => {
    const ligado = alternarTemaN1({}, 2, pilarDoN2);
    expect(alternarTemaN1(ligado, 2, pilarDoN2).temasN1).toBeUndefined();
  });
});
