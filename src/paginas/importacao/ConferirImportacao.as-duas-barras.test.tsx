// @vitest-environment jsdom

/** A barra horizontal da grade fica SEMPRE na tela, e não no fim do diálogo.
 *
 *  DEFEITO RELATADO PELO DONO DO PRODUTO (11/10/2026): "na aba que abre para
 *  conferência da tabela de agendas a barra de rolagem horizontal sempre deve
 *  ficar visível; agora está visível somente no fim da página".
 *
 *  POR QUE O PR #77 NÃO PEGOU ESTE CASO. Ele corrigiu seis tabelas e deixou esta
 *  de fora com a razão escrita: "`ConferirImportacao` já fazia certo, com
 *  `maxHeight: 62vh`". A altura limitada era necessária e não suficiente, e a
 *  diferença é o MODAL — o corpo dele rola. Somados, 62vh de grade mais a lista
 *  de pendências e a linha de contagem passam da altura do corpo: o corpo rola, e
 *  a borda de baixo da grade, onde vive a barra horizontal, sai da tela.
 *
 *  A CORREÇÃO É DAR À GRADE O QUE SOBRA em vez de uma altura adivinhada, e é
 *  isso que estes testes afirmam. Eles olham o ESTILO, não a aparência: `jsdom`
 *  não faz layout, então "a barra está visível" não é observável aqui. O que é
 *  observável é a causa — altura fixa contra `flex: 1` + `minHeight: 0` —, e é
 *  ela que volta se alguém desfizer.
 *
 *  E O QUE ESTES TESTES NÃO COBREM, dito porque é melhor escrito que
 *  subentendido: que a barra apareça de fato, na janela de verdade. Isso é
 *  conferência no navegador. O que eles garantem é que o mecanismo que a põe lá
 *  continue existindo.
 */

import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ConferirImportacao } from '@/paginas/importacao/ConferirImportacao';
import type { ColunaDaImportacao, Importacao, LinhaDaImportacao } from '@/api/cliente';

/** Colunas o bastante para a grade transbordar na horizontal — é o caso real: a
 *  planilha completa tem 74. */
const COLUNAS: ColunaDaImportacao[] = Array.from({ length: 40 }, (_, indice) => ({
  nome: `Coluna ${indice + 1}`,
  tipo: 'texto',
}));

const LINHAS: LinhaDaImportacao[] = Array.from({ length: 6 }, (_, indice) => ({
  id: indice + 2,
  aba: 'Agendas',
  linha_origem: indice + 2,
  decisao: 'pendente',
  interacao_id: null,
  dados_brutos: Object.fromEntries(COLUNAS.map(({ nome }) => [nome, `valor ${indice}`])),
  herdado: {},
  corrigido: {},
  proposta: null,
  divergencias: [],
}));

const IMPORTACAO: Importacao = {
  id: 'imp-barras',
  arquivo_nome: 'as-duas-barras.xlsx',
  situacao: 'aguardando_conferencia',
  criado_em: '2026-10-11T10:00:00',
  confirmado_em: null,
  colunas: COLUNAS,
  grupos: [],
  a_criar: [],
  pendencias: 0,
  decisoes_pendentes: 0,
  linhas: LINHAS,
};

vi.mock('@/api/cliente', () => ({
  obterImportacao: vi.fn(async () => IMPORTACAO),
  confirmarImportacao: vi.fn(),
  cancelarImportacao: vi.fn(),
  corrigirLinhaDaImportacao: vi.fn(),
  excluirLinhaDaImportacao: vi.fn(),
  resolverDivergencia: vi.fn(),
}));

//: O MOCK POR REFERÊNCIA, para um teste poder devolver outra importação. `vi.mock`
//: é hoisted, então a importação abaixo recebe o dublê, não o módulo real.
import { obterImportacao } from '@/api/cliente';

const mockado = vi.mocked(obterImportacao);

/** O container que rola a grade: o que tem a tabela dentro. */
function areaDaGrade(): HTMLElement {
  const tabela = document.querySelector('table');
  const area = tabela?.parentElement;
  if (!area) throw new Error('a grade não montou');
  return area as HTMLElement;
}

async function abrir() {
  render(<ConferirImportacao id="imp-barras" aoFechar={() => {}} />);
  await waitFor(() => expect(screen.getByText('as-duas-barras.xlsx')).toBeTruthy());
}

describe('as duas barras da conferência', () => {
  it('a grade recebe o que sobra, e não uma altura fixa', async () => {
    await abrir();
    const area = areaDaGrade();

    // O QUE A PESSOA SENTE: com altura fixa, a borda de baixo da grade cai fora
    // da tela e a barra horizontal vai com ela. `flex: 1` a amarra ao fim do
    // diálogo, qualquer que seja a altura da janela.
    // `"1 1 0%"` E NÃO `"1"`: o jsdom expande a propriedade abreviada. O que
    // importa é que ela CRESCE (`flex-grow: 1`) e que não há mais altura fixa.
    expect(area.style.flexGrow).toBe('1');
    expect(area.style.maxHeight).toBe('');
  });

  it('e `minHeight: 0`, sem o qual o limite não valeria', async () => {
    await abrir();

    // UM ITEM DE FLEX NÃO ENCOLHE abaixo do próprio conteúdo sem isto: a grade de
    // 40 colunas esticaria o diálogo e a barra voltaria para fora da tela, pelo
    // mesmo caminho. É a metade silenciosa da correção — some sem nada quebrar.
    expect(areaDaGrade().style.minHeight).toBe('0px');
  });

  it('o corpo do diálogo para de rolar, e quem rola é a grade', async () => {
    await abrir();

    // SE OS DOIS ROLAREM, a rolagem do corpo volta a empurrar a borda de baixo da
    // grade para fora da tela — o defeito original. O corpo do `Modal` leva
    // `rolagem-interna` por padrão; aqui ele não pode levar.
    const corpo = areaDaGrade().closest('[role="dialog"] > div > div');
    expect(corpo).toBeTruthy();
    expect(corpo?.classList.contains('rolagem-interna')).toBe(false);
    expect((corpo as HTMLElement).style.overflow).toBe('hidden');
  });

  it('a área rolável é alcançável por teclado, com nome', async () => {
    await abrir();
    const area = areaDaGrade();

    // REGRA 2.1.1 DO WCAG (`scrollable-region-focusable`): com o conteúdo rolando
    // dentro de um `div`, quem navega por teclado não chega nele — a área tem
    // barra e não responde às setas. É o mesmo tratamento que o PR #77 deu às
    // outras áreas de rolagem interna, e que faltava nesta.
    expect(area.getAttribute('tabindex')).toBe('0');
    expect(area.getAttribute('role')).toBe('group');
    expect(area.getAttribute('aria-label')).toBeTruthy();
  });

  it('a lista de pendências tem limite, para não esmagar a grade', async () => {
    // COM DIVERGÊNCIAS DE VERDADE, senão a lista não existe na tela e o teste
    // passaria com o conserto desfeito.
    const comAvisos: Importacao = {
      ...IMPORTACAO,
      id: 'imp-avisos',
      linhas: LINHAS.map((linha, indice) => ({
        ...linha,
        divergencias: [
          {
            campo: 'instituicao_id',
            valor: `Órgão ${indice}`,
            mensagem: `Falta a Data da linha ${indice}.`,
            //: TRAVA, porque a lista de mensagens mostra SÓ o que trava
            //: (`if (!divergencia.trava) continue`). Com aviso não travante ela
            //: não existe na tela, e o teste mediria o nada.
            trava: true,
            coluna: 'Instituição',
            acao: null,
            alvo: null,
            sugestoes: [],
          },
        ],
      })),
    };
    mockado.mockResolvedValue(comAvisos);

    render(<ConferirImportacao id="imp-avisos" aoFechar={() => {}} />);
    await waitFor(() => expect(screen.getAllByText(/Falta a Data/).length).toBeGreaterThan(0));

    // SEM LIMITE ELA PASSA A SER O PROBLEMA: seis mensagens distintas já empurram
    // a grade para baixo, e com trinta não sobra tabela nenhuma — um defeito de
    // rolagem trocado por outro.
    const lista = document.querySelector('ul.rolagem-interna') as HTMLElement | null;
    expect(lista).toBeTruthy();
    expect(lista?.style.maxHeight).toBeTruthy();
    // E ELA NÃO CRESCE À CUSTA DA GRADE: `flexShrink: 0` a mantém no tamanho
    // dela, e o limite acima é quem a impede de passar disso.
    expect(lista?.style.flexShrink).toBe('0');
  });
});
