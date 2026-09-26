/** A lógica da tela de conferência, fora do componente.
 *
 *  ELA SAI DO COMPONENTE PELO CRITÉRIO QUE O README DECLARA: não por tamanho de
 *  arquivo, mas por "o que acontece se isto estiver errado?". Se `podeConfirmar`
 *  errar, o botão acende com pendência aberta e alguém cria 54 agendas que não
 *  foram conferidas. Isso merece teste, e teste dentro de JSX é teste que não se
 *  escreve.
 *
 *  O CONTRATO VEM DA API, e os campos aqui são os que `ImportacaoSaida` devolve —
 *  `grupos` com `trava`, `a_criar` com o que já foi decidido, `pendencias` e
 *  `decisoes_pendentes`. Inventar uma forma própria aqui faria a tela funcionar
 *  nos testes e quebrar contra o servidor.
 */

import { describe, expect, it } from 'vitest';

import { cabecalho, pendencias, podeConfirmar, porUrgencia } from '@/paginas/importacao/grupos';
import type { Grupo } from '@/paginas/importacao/grupos';

const TRAVA: Grupo = {
  campo: 'instituicao_id',
  valor: 'Prefeitura de Campinas',
  linhas: [2, 3],
  trava: true,
  sugestoes: ['Prefeitura Municipal de Campinas'],
};

/** A duplicata possível vem sob o campo `duplicata`, e não `data_interacao`:
 *  o servidor a separa assim para o agrupamento não misturar "não consegui ler
 *  esta data" com "já existe agenda nesse dia". */
const AVISA: Grupo = {
  campo: 'duplicata',
  valor: '2026-09-25',
  linhas: [4],
  trava: false,
  sugestoes: [],
};

describe('podeConfirmar', () => {
  it('não confirma com divergência que trava', () => {
    expect(podeConfirmar([TRAVA, AVISA])).toBe(false);
  });

  it('confirma com apenas avisos', () => {
    // A duplicata possível avisa e não impede: duas reuniões com o mesmo órgão
    // no mesmo dia acontecem, e travar por isso ensinaria a ignorar o aviso.
    expect(podeConfirmar([AVISA])).toBe(true);
  });

  it('confirma sem divergência nenhuma', () => {
    expect(podeConfirmar([])).toBe(true);
  });
});

describe('pendencias', () => {
  it('conta só o que trava', () => {
    expect(pendencias([TRAVA, AVISA])).toBe(1);
  });

  it('conta grupos e não linhas — quem conta linhas é o servidor', () => {
    // O servidor manda `pendencias` em LINHAS, e a tela mostra os dois números.
    // Esta função conta as DECISÕES que a pessoa tem pela frente; confundir os
    // dois faria o cabeçalho dizer "2 pendências" para 12 linhas presas.
    expect(pendencias([TRAVA])).toBe(1);
  });
});

describe('porUrgencia', () => {
  it('põe o que trava antes do que só avisa', () => {
    expect(porUrgencia([AVISA, TRAVA]).map((grupo) => grupo.valor)).toEqual([
      TRAVA.valor,
      AVISA.valor,
    ]);
  });

  it('dentro da mesma severidade, o que segura mais linhas vem primeiro', () => {
    const poucas: Grupo = { ...TRAVA, valor: 'Poucas', linhas: [9] };

    expect(porUrgencia([poucas, TRAVA]).map((grupo) => grupo.valor)).toEqual([
      TRAVA.valor,
      'Poucas',
    ]);
  });

  it('não muda a lista que recebeu', () => {
    // `sort` ordena no lugar, e a lista vem do estado do React: ordenar a
    // original faria a tela reordenar por baixo de quem a estava lendo.
    const original = [AVISA, TRAVA];

    porUrgencia(original);

    expect(original.map((grupo) => grupo.valor)).toEqual([AVISA.valor, TRAVA.valor]);
  });
});

describe('cabecalho', () => {
  it('responde "quanto falta" com os três números', () => {
    // É a primeira coisa que a pessoa lê para decidir se tem tempo de conferir
    // agora. Os três saem daqui e não do JSX, pelo mesmo motivo que
    // `podeConfirmar` saiu.
    expect(
      cabecalho({
        agendas: 54,
        pendencias: 12,
        decisoesPendentes: 2,
        aCriar: [{ campo: 'instituicao_id', valor: 'A', acao: 'criar', alvo: null, linhas: [1] }],
      }),
    ).toEqual({
      agendas: 54,
      pendencias: 12,
      decisoes: 2,
      cadastrosNovos: 1,
    });
  });

  it('conta como cadastro novo só o que vai ser CRIADO', () => {
    // Apontar para um cadastro existente é decisão tomada, e aparece no mesmo
    // bloco — mas não cria nada, e somá-lo diria à pessoa que a importação vai
    // criar registros que ela justamente escolheu não criar.
    expect(
      cabecalho({
        agendas: 2,
        pendencias: 0,
        decisoesPendentes: 0,
        aCriar: [
          { campo: 'instituicao_id', valor: 'A', acao: 'criar', alvo: null, linhas: [2] },
          { campo: 'instituicao_id', valor: 'B', acao: 'apontar', alvo: 'id-1', linhas: [3] },
        ],
      }).cadastrosNovos,
    ).toBe(1);
  });
});
