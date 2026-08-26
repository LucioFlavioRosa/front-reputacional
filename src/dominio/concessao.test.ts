/** O payload da tela de acessos — onde os erros desta tela doem. */

import { describe, expect, it } from 'vitest';
import type { Acesso } from '@/dominio/tipos';
import { formularioDe, impedimento, listaDe, montarConcessao } from '@/dominio/concessao';

const EXTERNO: Acesso = {
  id: 'id-externo',
  nome: 'Agência Parceira',
  email: 'contato@agencia.com.br',
  ativo: true,
  papel: 'externo',
  acesso_irrestrito: false,
  externo: true,
  expira_em: '2026-12-31',
  frentes: ['imprensa'],
  unidades: ['Prolagos'],
  concedido_por: 'Coordenação',
  concedido_em: '2026-08-01T10:00:00-03:00',
};

describe('montarConcessao', () => {
  it('leva a versão que a tela viu ao abrir', () => {
    /* Sem isto, dois administradores editando a mesma pessoa fazem o segundo
       apagar o primeiro — sem conflito, sem aviso, e sem ninguém perceber,
       porque o acesso simplesmente volta a ser o de antes. */
    const corpo = montarConcessao(EXTERNO, formularioDe(EXTERNO));
    expect(corpo.versao_vista).toBe('2026-08-01T10:00:00-03:00');
  });

  it('manda versao_vista nula para quem nunca teve concessão', () => {
    /* Nulo NÃO é "aplique de qualquer jeito": o backend o compara como
       qualquer outro valor, e ele significa "vi esta pessoa sem concessão
       nenhuma". Se outra pessoa conceder no meio, a chamada é recusada em vez
       de apagar o que ela fez — ver a migration 0006.

       Este é o caso mais comum da tela, porque toda pessoa nova entra na lista
       com `concedido_em` nulo. */
    const nunca: Acesso = {
      ...EXTERNO,
      papel: null,
      externo: false,
      expira_em: null,
      frentes: [],
      unidades: [],
      concedido_por: null,
      concedido_em: null,
    };
    const corpo = montarConcessao(nunca, formularioDe(nunca));
    expect(corpo.versao_vista).toBeNull();
  });

  it('preserva o que não foi tocado', () => {
    const corpo = montarConcessao(EXTERNO, formularioDe(EXTERNO));
    expect(corpo.frentes).toEqual(['imprensa']);
    expect(corpo.unidades).toEqual(['Prolagos']);
    expect(corpo.expira_em).toBe('2026-12-31');
  });

  it('manda papel nulo quando a escolha é "sem acesso"', () => {
    /* O backend trata nulo como revogação e limpa escopo, prazo e a marca de
       externo — guardar o alcance de quem não tem papel é guardar uma surpresa
       para quem conceder papel depois. */
    const corpo = montarConcessao(EXTERNO, { ...formularioDe(EXTERNO), papel: '' });
    expect(corpo.papel).toBeNull();
  });
});

describe('impedimento', () => {
  it('barra externo sem prazo', () => {
    /* O backend recusa. Descobrir depois de preencher tudo é o que faz alguém
       desistir da tela. */
    const forma = { ...formularioDe(EXTERNO), expira: '' };
    expect(impedimento(forma)).toMatch(/prazo/i);
  });

  it('barra externo com alcance total', () => {
    const forma = { ...formularioDe(EXTERNO), irrestrito: true };
    expect(impedimento(forma)).toMatch(/irrestrito/i);
  });

  it('não barra revogação sem prazo', () => {
    /* "Sem acesso" não precisa de prazo: não há acesso a expirar. Exigir aqui
       impediria revogar justamente quem já estava vencido. */
    const forma = { ...formularioDe(EXTERNO), papel: '', expira: '' };
    expect(impedimento(forma)).toBeNull();
  });

  it('deixa passar o que está completo', () => {
    expect(impedimento(formularioDe(EXTERNO))).toBeNull();
  });
});

describe('listaDe', () => {
  it('separa por vírgula e descarta o que sobra', () => {
    expect(listaDe(' imprensa , , governo ')).toEqual(['imprensa', 'governo']);
  });

  it('vazio vira lista vazia, e não [""]', () => {
    /* `''.split(',')` devolve `['']` — uma frente chamada string vazia, que o
       backend recusaria como "frente desconhecida". */
    expect(listaDe('')).toEqual([]);
    expect(listaDe('   ')).toEqual([]);
  });
});
