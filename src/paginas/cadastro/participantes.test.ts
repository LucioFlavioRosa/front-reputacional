/** A lista "Pela Aegea": a área da interação primeiro, e o papel de cada um. */

import { describe, expect, it } from 'vitest';

import { opcoesDePessoasDaAegea } from '@/paginas/cadastro/formulario';

const AREAS: Record<number, string> = { 1: 'Comunicação', 2: 'Relações Institucionais' };
const nomeDaArea = (id: number) => AREAS[id] ?? '';

const PESSOAS = [
  { id: 'a', nome: 'Ana', eh_porta_voz: true, area_id: 2 },
  { id: 'b', nome: 'Bruna', eh_porta_voz: false, area_id: 1 },
  { id: 'c', nome: 'Carlos', eh_porta_voz: false, area_id: null },
  { id: 'd', nome: 'Diana', eh_porta_voz: true, area_id: 1 },
];

describe('opcoesDePessoasDaAegea', () => {
  it('põe quem é da área escolhida primeiro, mantendo a ordem por nome', () => {
    const ordem = opcoesDePessoasDaAegea(PESSOAS, [1], nomeDaArea).map((o) => o.rotulo);
    expect(ordem).toEqual(['Bruna', 'Diana', 'Ana', 'Carlos']);
  });

  it('sem área escolhida, mantém a ordem que veio', () => {
    const ordem = opcoesDePessoasDaAegea(PESSOAS, [], nomeDaArea).map((o) => o.rotulo);
    expect(ordem).toEqual(['Ana', 'Bruna', 'Carlos', 'Diana']);
  });

  it('o detalhe diz o papel e a área — a equipe também aparece rotulada', () => {
    const detalhes = Object.fromEntries(
      opcoesDePessoasDaAegea(PESSOAS, [1], nomeDaArea).map((o) => [o.rotulo, o.detalhe]),
    );
    expect(detalhes).toEqual({
      Bruna: 'equipe · Comunicação',
      Diana: 'porta-voz · Comunicação',
      Ana: 'porta-voz · Relações Institucionais',
      Carlos: 'equipe',
    });
  });
});
