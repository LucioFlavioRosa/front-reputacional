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
  sensivel: true,
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

  it('leva a camada sensível, e a zera junto com o papel', () => {
    /* A terceira camada (migration 0087). Sem papel ela não existe, e o
       backend a zera de todo jeito — revogar é estado limpo. Mandar `true`
       faria a tela afirmar uma coisa que o banco não guarda. */
    expect(montarConcessao(EXTERNO, formularioDe(EXTERNO)).sensivel).toBe(true);

    const semPapel = { ...formularioDe(EXTERNO), papel: '', sensivel: true };
    expect(montarConcessao(EXTERNO, semPapel).sensivel).toBe(false);
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

  it('barra sensível acima do teto do papel', () => {
    /* O backend recusa (migration 0087), e a recusa não protege dado nenhum — a
       conjunção `papel.ve_campos_sensiveis AND usuario.acesso_sensivel` já
       tornaria o acesso falso. Ela protege a TELA de dizer uma coisa e o
       sistema fazer outra: a pessoa apareceria "com acesso sensível", não veria
       o campo, e quem administra procuraria o defeito no lugar errado. */
    const papelComTetoFechado = {
      codigo: 'externo',
      nome: 'Externo sem sensível',
      administra_acessos: false,
      administra_dicionarios: false,
      ve_campos_sensiveis: false,
      ve_diretorio: false,
      pode_criar: false,
      pode_editar_proprio: false,
      pode_editar_tudo: false,
      pode_exportar: false,
      acessa_crm: true,
      acessa_inteligencia_de_mercado: false,
      acessa_score: false,
    };

    const forma = { ...formularioDe(EXTERNO), sensivel: true };
    expect(impedimento(forma, [papelComTetoFechado])).toMatch(/sensível/i);

    /* E não opina sobre o que não conhece: sem o catálogo, quem responde é o
       backend. Inventar um impedimento a partir de um catálogo vazio barraria
       toda concessão enquanto a lista de papéis não tivesse chegado. */
    expect(impedimento(forma)).toBeNull();

    /* Nem barra quando o teto está aberto. */
    expect(
      impedimento(forma, [{ ...papelComTetoFechado, ve_campos_sensiveis: true }]),
    ).toBeNull();
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
