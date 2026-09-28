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

import { porUrgencia } from '@/paginas/importacao/grupos';
import type { Grupo } from '@/paginas/importacao/grupos';

const TRAVA: Grupo = {
  campo: 'instituicao_id',
  valor: 'Prefeitura de Campinas',
  linhas: [2, 3],
  trava: true,
  sugestoes: [{ nome: 'Prefeitura Municipal de Campinas', alvo: 'id-da-prefeitura' }],
  pode_criar: true,
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
  // Duplicata não tem cadastro a criar: é aviso, não pendência de cadastro.
  pode_criar: false,
};



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

