// @vitest-environment jsdom

/** A conferência abre mostrando a planilha inteira.
 *
 *  O PEDIDO: "quando subir já pode mostrar os dados da planilha, não preciso eu pedir
 *  para mostrar como é hoje; só traga em destaque com cor diferente quando um campo
 *  precisar de atenção".
 *
 *  ERA O CONTRÁRIO: a grade abria filtrada nas linhas com pendência, e ver o que foi
 *  subido exigia um clique. Quem acabou de subir 54 agendas quer ver as 54 — a
 *  primeira pergunta dela é "chegou tudo?", e essa pergunta uma lista filtrada não
 *  responde. A cor é o que aponta o que precisa de atenção, e ela funciona melhor
 *  quando há o resto para contrastar.
 */

import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ConferirImportacao } from '@/paginas/importacao/ConferirImportacao';
import type { Importacao, LinhaDaImportacao } from '@/api/cliente';

function linha(numero: number, parcial: Partial<LinhaDaImportacao> = {}): LinhaDaImportacao {
  return {
    id: numero,
    aba: 'Agendas',
    linha_origem: numero,
    decisao: 'pendente',
    interacao_id: null,
    dados_brutos: { Data: '25/09/2026', 'Instituição': `Órgão ${numero}` },
    herdado: {},
    corrigido: {},
    proposta: null,
    divergencias: [],
    ...parcial,
  };
}

const IMPORTACAO: Importacao = {
  id: 'imp-1',
  arquivo_nome: 'agendas-do-evento.xlsx',
  situacao: 'aguardando_conferencia',
  criado_em: '2026-09-27T10:00:00',
  confirmado_em: null,
  colunas: [
    { nome: 'Data', tipo: 'data' },
    { nome: 'Instituição', tipo: 'lista' },
  ],
  grupos: [],
  a_criar: [],
  pendencias: 1,
  decisoes_pendentes: 1,
  linhas: [
    linha(2),
    linha(3, {
      dados_brutos: { Data: null, 'Instituição': 'Órgão 3' },
      divergencias: [
        {
          campo: 'data_interacao',
          valor: '',
          mensagem: 'Falta Data, que toda agenda precisa ter.',
          trava: true,
          coluna: 'Data',
          sugestoes: [],
          acao: null,
          alvo: null,
        },
      ],
    }),
    linha(4),
  ],
};

vi.mock('@/api/cliente', () => ({
  obterImportacao: vi.fn(async () => IMPORTACAO),
  confirmarImportacao: vi.fn(),
  cancelarImportacao: vi.fn(),
  corrigirLinhaDaImportacao: vi.fn(),
  excluirLinhaDaImportacao: vi.fn(),
  resolverDivergencia: vi.fn(),
}));

describe('ConferirImportacao', () => {
  it('abre mostrando TODAS as linhas, e não só as que precisam de atenção', async () => {
    render(<ConferirImportacao id="imp-1" aoFechar={() => {}} />);

    // As três linhas do arquivo, sendo que só a 3 tem pendência.
    await waitFor(() => expect(screen.getByText('Órgão 2')).toBeTruthy());
    expect(screen.getByText('Órgão 3')).toBeTruthy();
    expect(screen.getByText('Órgão 4')).toBeTruthy();
  });

  it('oferece o filtro como opção, sem já estar filtrada', async () => {
    render(<ConferirImportacao id="imp-1" aoFechar={() => {}} />);

    // O RÓTULO DIZ O QUE O CLIQUE FAZ, e no estado inicial ele OFERECE o filtro —
    // se dissesse "Ver todas as linhas" estaria anunciando que algo está escondido.
    await waitFor(() => expect(screen.getByText('Só as que precisam de você')).toBeTruthy());
  });

  it('diz quantas células precisam de atenção', async () => {
    render(<ConferirImportacao id="imp-1" aoFechar={() => {}} />);

    await waitFor(() => expect(screen.getByText(/1 célula a preencher/)).toBeTruthy());
  });
});

describe('o que a grade sinaliza sem depender de cor', () => {
  /** ACHADO DA REVISÃO DE UI/UX, severidade alta: "não transmita informação por cor
   *  sozinha — use ícone ou texto além da cor".
   *
   *  A grade pintava a célula de vermelho ou amarelo e mais nada. Quem não distingue
   *  as duas cores — 8% dos homens — via uma tabela uniforme com 500 linhas e nenhuma
   *  pista de onde mexer. E a mensagem morava só no `title`, que é hover: quem usa
   *  teclado ou toque não alcança. */

  it('marca a célula que trava com um sinal que não é cor', async () => {
    render(<ConferirImportacao id="imp-1" aoFechar={() => {}} />);

    // O marcador tem NOME, para quem ouve a tela e para quem não vê a cor.
    await waitFor(() => expect(screen.getByLabelText('Precisa de atenção')).toBeTruthy());
  });

  it('diz o que falta em TEXTO, fora do hover', async () => {
    render(<ConferirImportacao id="imp-1" aoFechar={() => {}} />);

    // A mensagem do servidor, visível sem passar o mouse em nada.
    await waitFor(() =>
      expect(screen.getByText(/Falta Data, que toda agenda precisa ter/)).toBeTruthy(),
    );
  });

  it('não repete a mesma mensagem uma vez por linha', async () => {
    /** COM 500 LINHAS, "Falta Data" repetido 500 vezes é uma parede de texto que
     *  ninguém lê — e era justamente a crítica de espaço desperdiçado. Uma vez, com
     *  a conta de quantas linhas. */
    render(<ConferirImportacao id="imp-1" aoFechar={() => {}} />);

    await waitFor(() => expect(screen.getByText(/Falta Data/)).toBeTruthy());
    expect(screen.getAllByText(/Falta Data/)).toHaveLength(1);
  });
});
