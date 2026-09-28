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

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ConferirImportacao } from '@/paginas/importacao/ConferirImportacao';
import { obterImportacao } from '@/api/cliente';
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
    //: COMO O SERVIDOR GUARDA: em ISO. A grade tem de mostrá-la em português.
    linha(5, { dados_brutos: { Data: '2026-09-30', 'Instituição': 'Órgão 5' } }),
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

  it('a célula que precisa de atenção, em edição, tem SÓ o campo — o sinal sai', async () => {
    /** O DEFEITO QUE O DONO DO PRODUTO ACHOU USANDO: ele subiu uma agenda sem data e
     *  sem UF, clicou em editar, e não conseguiu editar justamente esses dois campos.
     *
     *  A CAUSA ERA MECÂNICA, e só aparece com layout: o sinal `!` fica no mesmo fluxo
     *  do campo, a célula é `nowrap` com `overflow: hidden`, e o campo tem
     *  `width: 100%`. Nas colunas estreitas — a UF tem 64px, a Data 108px — o sinal
     *  empurra o campo, e o que sobra dele é CORTADO pela célula. Ele ficava com uma
     *  lasca de campo, ou com nenhuma.
     *
     *  O TESTE OLHA A CAUSA e não o pixel, porque jsdom não faz layout: em edição, a
     *  célula marcada não desenha o sinal. A cor de fundo continua dizendo que ali há
     *  um problema, e o campo ganha a célula inteira. */
    const aoFechar = vi.fn();
    render(<ConferirImportacao id="imp-1" aoConfirmar={vi.fn()} aoFechar={aoFechar} />);
    await waitFor(() => expect(screen.getByText('Órgão 3')).toBeTruthy());

    const linhaComFalta = document.querySelector('tr[data-linha="3"]') as HTMLElement;
    fireEvent.click(within(linhaComFalta).getByRole('button', { name: 'Editar' }));

    const campos = within(linhaComFalta).getAllByRole('textbox');
    expect(campos).toHaveLength(2);
    expect(within(linhaComFalta).queryByLabelText('Precisa de atenção')).toBeNull();
  });

  it('o campo da coluna vazia abre pronto para receber a data', async () => {
    /** A OUTRA METADE DO MESMO RELATO: a célula está vazia porque a planilha não tinha
     *  o valor, e é exatamente essa que ela precisa preencher. O campo tem de existir,
     *  estar vazio, e dizer o formato — sem ele a pessoa digita 09/30/2026. */
    render(<ConferirImportacao id="imp-1" aoConfirmar={vi.fn()} aoFechar={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('Órgão 3')).toBeTruthy());

    const linhaComFalta = document.querySelector('tr[data-linha="3"]') as HTMLElement;
    fireEvent.click(within(linhaComFalta).getByRole('button', { name: 'Editar' }));

    const daData = within(linhaComFalta).getByPlaceholderText('dd/mm/aaaa');
    expect((daData as HTMLInputElement).value).toBe('');
  });

  it('a tabela DECLARA a largura somada das colunas — senão o navegador encolhe todas', async () => {
    /** A CAUSA RAIZ DO RELATO "não consigo ler a data nem a UF enquanto edito", e ela
     *  não estava nas larguras: estava na tabela.
     *
     *  COM `table-layout: fixed` E SEM `width`, a tabela assume a largura do container
     *  — 1200px do modal — e REDUZ PROPORCIONALMENTE as colunas para caber. Cinquenta e
     *  nove colunas somando onze mil pixels dentro de 1200 significa cada coluna com um
     *  vigésimo do que pedi: a Data de 120px vira 13px. As larguras por tipo existiam e
     *  não valiam nada, e aumentá-las não mudava nada — era sempre o mesmo vigésimo.
     *
     *  DECLARANDO A LARGURA, a tabela passa a transbordar o container e a rolagem
     *  horizontal — que já existe — mostra as colunas no tamanho que elas pediram. */
    render(<ConferirImportacao id="imp-1" aoConfirmar={vi.fn()} aoFechar={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('Órgão 2')).toBeTruthy());

    const tabela = document.querySelector('table') as HTMLTableElement;
    const somaDasColunas = [...document.querySelectorAll('colgroup col')].reduce(
      (soma, coluna) => soma + Number.parseInt((coluna as HTMLElement).style.width, 10),
      0,
    );

    expect(somaDasColunas).toBeGreaterThan(0);
    expect(Number.parseInt(tabela.style.width, 10)).toBeGreaterThanOrEqual(somaDasColunas);
  });

  it('a data se digita só com números — a tela põe as barras', async () => {
    /** O PEDIDO: "não gostaria de ficar digitando `/` na data; se eu digitar apenas os
     *  números a formatação viria automaticamente". São 54 datas num dia de evento. */
    render(<ConferirImportacao id="imp-1" aoConfirmar={vi.fn()} aoFechar={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('Órgão 3')).toBeTruthy());

    const linhaComFalta = document.querySelector('tr[data-linha="3"]') as HTMLElement;
    fireEvent.click(within(linhaComFalta).getByRole('button', { name: 'Editar' }));
    const daData = within(linhaComFalta).getByPlaceholderText('dd/mm/aaaa');

    //: TECLA POR TECLA, e não o valor inteiro de uma vez: foi assim que o defeito do ano
    //: passou por mim. O campo mostra `30/09` quando o quinto dígito chega, e é o texto
    //: JÁ FORMATADO que volta para a máscara — quem testa com o valor pronto testa um
    //: caminho que a pessoa nunca percorre.
    for (const tecla of '30092026') {
      fireEvent.change(daData, {
        target: { value: (daData as HTMLInputElement).value + tecla },
      });
    }

    expect((daData as HTMLInputElement).value).toBe('30/09/2026');
  });

  it('a grade mostra a data em português, e não como o servidor a guarda', async () => {
    /** Três formatos para a mesma data na mesma tela — a coluna da planilha pede
     *  `dd/mm/aaaa`, o campo de edição oferece `dd/mm/aaaa`, e a grade mostrava
     *  `2026-09-30`. Quem confere 54 linhas não deveria traduzir nenhuma. */
    render(<ConferirImportacao id="imp-1" aoConfirmar={vi.fn()} aoFechar={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('Órgão 5')).toBeTruthy());

    const linhaComIso = document.querySelector('tr[data-linha="5"]') as HTMLElement;

    expect(within(linhaComIso).getByText('30/09/2026')).toBeTruthy();
    expect(within(linhaComIso).queryByText('2026-09-30')).toBeNull();
  });

  it('o campo em edição diz que o valor está inválido, e não só pela cor', async () => {
    /** ACHADO DA REVISÃO, severidade média. Eu tirei o sinal `!` da célula em edição —
     *  ele empurrava o campo para fora das colunas estreitas —, e com isso o estado da
     *  célula passou a ser transmitido SÓ pelo fundo colorido. Quem não distingue bem
     *  vermelho, ou navega por leitor de tela, perdeu a informação exatamente no momento
     *  em que está consertando aquela célula.
     *
     *  `aria-invalid` É O CANAL CERTO AQUI, e é melhor que o sinal: um campo de
     *  formulário inválido tem um jeito próprio de se anunciar, que o leitor de tela lê
     *  ao entrar nele. A borda mais grossa é a pista visual que não depende de cor. */
    render(<ConferirImportacao id="imp-1" aoConfirmar={vi.fn()} aoFechar={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('Órgão 3')).toBeTruthy());

    const linhaComFalta = document.querySelector('tr[data-linha="3"]') as HTMLElement;
    fireEvent.click(within(linhaComFalta).getByRole('button', { name: 'Editar' }));

    const daData = within(linhaComFalta).getByPlaceholderText('dd/mm/aaaa');
    expect(daData.getAttribute('aria-invalid')).toBe('true');
    //: A célula sem problema nenhum NÃO se anuncia inválida — senão o aviso perde o
    //: significado e a pessoa aprende a ignorá-lo.
    const daInstituicao = within(linhaComFalta)
      .getAllByRole('textbox')
      .find((campo) => campo !== daData) as HTMLElement;
    expect(daInstituicao.getAttribute('aria-invalid')).not.toBe('true');
  });

  it('os botões de decisão saem da célula enquanto ela está sendo editada', async () => {
    /** ACHADO DA REVISÃO, severidade média. A célula tem altura fixa e corta o que não
     *  cabe: com o campo de edição dentro, os botões de decisão ficavam recortados —
     *  visíveis pela metade, ou invisíveis e ainda alcançáveis pelo Tab.
     *
     *  SÃO DOIS CAMINHOS PARA A MESMA CORREÇÃO, e um de cada vez: ou ela escolhe um
     *  cadastro que já existe, ou ela digita o valor certo. Oferecer os dois na mesma
     *  célula apertada não dá escolha, dá confusão. */
    const comDecisao: Importacao = {
      ...IMPORTACAO,
      linhas: [
        linha(7, {
          dados_brutos: { Data: '25/09/2026', 'Instituição': 'Prefeitura de Campinas' },
          divergencias: [
            {
              campo: 'instituicao_id',
              valor: 'Prefeitura de Campinas',
              mensagem: "'Prefeitura de Campinas' não existe no cadastro.",
              trava: true,
              coluna: 'Instituição',
              sugestoes: [],
              acao: null,
              alvo: null,
            },
          ],
        }),
      ],
      grupos: [
        {
          campo: 'instituicao_id',
          valor: 'Prefeitura de Campinas',
          trava: true,
          linhas: [7],
          sugestoes: [{ nome: 'Prefeitura Municipal de Campinas', alvo: '1' }],
          pode_criar: false,
        },
      ],
    };
    vi.mocked(obterImportacao).mockResolvedValueOnce(comDecisao);
    render(<ConferirImportacao id="imp-1" aoConfirmar={vi.fn()} aoFechar={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('Prefeitura de Campinas')).toBeTruthy());

    const linhaDela = document.querySelector('tr[data-linha="7"]') as HTMLElement;
    //: Antes de editar, a decisão está lá — é ela que resolve doze linhas num clique.
    expect(
      within(linhaDela).getByRole('button', { name: 'É “Prefeitura Municipal de Campinas”' }),
    ).toBeTruthy();

    fireEvent.click(within(linhaDela).getByRole('button', { name: 'Editar' }));

    expect(
      within(linhaDela).queryByRole('button', { name: 'É “Prefeitura Municipal de Campinas”' }),
    ).toBeNull();
  });

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
