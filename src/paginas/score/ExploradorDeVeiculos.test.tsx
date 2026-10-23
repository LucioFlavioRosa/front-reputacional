// @vitest-environment jsdom

/** O bloco de três painéis que se filtram pela dimensão de veículo.
 *
 *  O QUE ESTE ARQUIVO PRENDE é o que os três cartões de antes NÃO faziam, e que
 *  é a razão de ser do molde: a seleção é local (o dossiê não se move), o clique
 *  não vai ao servidor, e o painel do próprio eixo continua inteiro.
 *
 *  A CONTA TEM TESTE PRÓPRIO (`dominio/exploradorDeVeiculos.test.ts`), incluindo
 *  a regra dos dois eixos. Aqui se prova a TELA: os três painéis desenhados, os
 *  chips, o Limpar, o botão de revelar e as duas guardas que só a tela tem — a
 *  resposta atrasada e o caminho de erro.
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ExploradorDeVeiculos as Dados } from '@/api/cliente';
import { ExploradorDeVeiculos } from '@/paginas/score/ExploradorDeVeiculos';

const obterExploradorDeVeiculos = vi.fn();

vi.mock('@/api/cliente', () => ({
  obterExploradorDeVeiculos: (...argumentos: unknown[]) =>
    obterExploradorDeVeiculos(...argumentos),
}));

/** `quantos` veículos, todos no Tier 1, com volume decrescente — o veículo 1 é
 *  o maior, para a ordenação do painel ser previsível. */
function dados(quantos: number): Dados {
  return {
    lente: 'imprensa',
    mes: '2026-09',
    denominador: 100,
    grupos: Array.from({ length: quantos }, (_, indice) => ({
      tier: 'muito_relevante',
      veiculo: `Veículo ${indice + 1}`,
      positivo: quantos - indice,
      neutro: 0,
      negativo: 0,
      peso_positivo: quantos - indice,
      peso_neutro: 0,
      peso_negativo: 0,
    })),
  };
}

function montar(mes = '2026-09') {
  return render(<ExploradorDeVeiculos codigo="imprensa" mes={mes} filtro={{}} />);
}

/** A COLUNA, e não o cartão: as três vivem num cartão só, e "Veículo 5"
 *  aparece nas DUAS colunas de veículo ao mesmo tempo (Top e Termômetro) —
 *  escopar pelo cartão reprovaria por ambiguidade em vez de pela contagem.
 *
 *  O `role="group"` com o nome do cabeçalho existe para o leitor de tela
 *  distinguir as colunas; aqui ele serve de endereço. */
function colunaDe(titulo: string): HTMLElement {
  return screen.getByRole('group', { name: titulo });
}

describe('o Explorador de veículos', () => {
  beforeEach(() => {
    obterExploradorDeVeiculos.mockReset();
  });

  it('desenha os três painéis', async () => {
    obterExploradorDeVeiculos.mockResolvedValue(dados(3));
    montar();
    await waitFor(() =>
      expect(screen.getByText('Tier do veículo × sentimento')).toBeInTheDocument(),
    );
    expect(screen.getByText('Top veículos')).toBeInTheDocument();
    expect(screen.getByText('Termômetro por Veículos')).toBeInTheDocument();
  });

  it('um pedido só por mês e recorte — o clique não vai ao servidor', async () => {
    obterExploradorDeVeiculos.mockResolvedValue(dados(3));
    montar();
    await waitFor(() => expect(screen.getByText('Tier 1')).toBeInTheDocument());
    expect(obterExploradorDeVeiculos).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByText('Tier 1'));

    //: É A PROPRIEDADE CENTRAL DO MOLDE: o cruzamento é soma no navegador, e
    //: nada no dossiê se move porque nada foi pedido de novo.
    expect(obterExploradorDeVeiculos).toHaveBeenCalledTimes(1);
  });

  it('o chip aparece ao escolher, com o RÓTULO do tier, e o Limpar zera', async () => {
    obterExploradorDeVeiculos.mockResolvedValue(dados(3));
    montar();
    await waitFor(() => expect(screen.getByText('Tier 1')).toBeInTheDocument());

    await userEvent.click(screen.getByText('Tier 1'));

    //: O CHIP MOSTRA "Tier 1", e não `muito_relevante`: a seleção guarda a
    //: chave, e quem lê a tela viu o rótulo.
    expect(screen.getByText('Filtrando por')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Tirar o filtro Tier: Tier 1' }),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Limpar' }));
    expect(screen.queryByText('Filtrando por')).toBeNull();
  });

  it('a seleção não sobrevive à troca do filtro da TELA', async () => {
    //: ACHADO DA REVISÃO DO CODEX (23/10/2026): a seleção é local, mas o
    //: recorte vem de fora. Escolher "Tier 1" e trocar o filtro da tela
    //: deixava o chip dizendo "Tier 1" sobre um recorte que podia não ter
    //: Tier 1 nenhum — e as colunas de veículo vazias por filtrar por algo
    //: que não existe mais, com um chip mentindo em cima.
    obterExploradorDeVeiculos.mockResolvedValue(dados(3));
    const { rerender } = render(
      <ExploradorDeVeiculos codigo="imprensa" mes="2026-09" filtro={{}} />,
    );
    await waitFor(() => expect(screen.getByText('Tier 1')).toBeInTheDocument());
    await userEvent.click(screen.getByText('Tier 1'));
    expect(screen.getByText('Filtrando por')).toBeInTheDocument();

    //: O FILTRO DA TELA MUDA (outro recorte, outro pedido).
    rerender(
      <ExploradorDeVeiculos codigo="imprensa" mes="2026-09" filtro={{ sentimento: 'neg' }} />,
    );

    await waitFor(() => expect(screen.queryByText('Filtrando por')).toBeNull());
  });

  it('a seleção dos DOIS eixos ao mesmo tempo mantém as duas colunas inteiras', async () => {
    //: O CODEX APONTOU QUE FALTAVA este caso: tier e veículo escolhidos
    //: juntos. A coluna de tier mostra os tiers DAQUELE veículo, e as de
    //: veículo mostram os veículos DAQUELE tier — cada eixo imune ao próprio
    //: filtro, que é a razão de ser do molde.
    obterExploradorDeVeiculos.mockResolvedValue(dados(3));
    montar();
    await waitFor(() => expect(screen.getByText('Tier 1')).toBeInTheDocument());

    await userEvent.click(screen.getByText('Tier 1'));
    const topo = colunaDe('Top veículos');
    await userEvent.click(within(topo).getByText('Veículo 1'));

    //: OS DOIS CHIPS, e os dois eixos continuam navegáveis.
    expect(screen.getByRole('button', { name: 'Tirar o filtro Tier: Tier 1' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Tirar o filtro Veículo: Veículo 1' }),
    ).toBeInTheDocument();
    //: A COLUNA DE VEÍCULO CONTINUA INTEIRA: os três seguem clicáveis, senão
    //: trocar de veículo exigiria desfazer o clique antes.
    expect(within(topo).getByText('Veículo 2')).toBeInTheDocument();
    expect(within(topo).getByText('Veículo 3')).toBeInTheDocument();
    //: E A DE TIER TAMBÉM: as três barras de tier seguem desenhadas.
    const tier = colunaDe('Tier do veículo × sentimento');
    expect(within(tier).getByText('Tier 1')).toBeInTheDocument();
    expect(within(tier).getByText('Tier 2')).toBeInTheDocument();
  });

  it('abre em 5 veículos, e o botão diz quantos há de verdade', async () => {
    //: O N É O TOTAL DO RECORTE, e não o teto de 10 dos blocos antigos: o
    //: servidor passou a mandar o mês agrupado inteiro.
    obterExploradorDeVeiculos.mockResolvedValue(dados(13));
    montar();
    await waitFor(() => expect(screen.getByText('Top veículos')).toBeInTheDocument());

    const topo = colunaDe('Top veículos');
    expect(within(topo).getByText('Veículo 5')).toBeInTheDocument();
    expect(within(topo).queryByText('Veículo 6')).toBeNull();

    await userEvent.click(
      within(topo).getByRole('button', { name: 'Ver todos os 13 veículos' }),
    );
    expect(within(topo).getByText('Veículo 13')).toBeInTheDocument();

    //: E O TERMÔMETRO NÃO ABRIU JUNTO: cada painel tem a lista dele.
    const termometro = colunaDe('Termômetro por Veículos');
    expect(within(termometro).queryByText('Veículo 6')).toBeNull();
  });

  it('as duas colunas de veículo rolam por DENTRO, não pela página', async () => {
    //: PEDIDO (23/10/2026), e era uma assimetria de verdade: a
    //: `ColunasEmpilhadas` do Top veículos tem rolagem interna própria
    //: (`.rolagem-interna`, com teto de altura), e a `BarraDivergentePorItem`
    //: do Termômetro NÃO TEM NENHUMA. Expandir o Termômetro crescia o cartão e
    //: fazia a PÁGINA rolar, enquanto o vizinho rolava por dentro — dois
    //: comportamentos para o mesmo gesto, lado a lado.
    //:
    //: O TETO DE ALTURA É O QUE MANTÉM AS TRÊS COLUNAS ALINHADAS: sem ele, a
    //: coluna aberta empurra o rodapé do cartão e desalinha as outras duas.
    obterExploradorDeVeiculos.mockResolvedValue(dados(13));
    montar();
    await waitFor(() => expect(screen.getByText('Top veículos')).toBeInTheDocument());

    for (const nome of ['Top veículos', 'Termômetro por Veículos']) {
      const rolante = colunaDe(nome).querySelector('.rolagem-interna') as HTMLElement | null;
      expect(rolante, `${nome} está sem rolagem própria`).not.toBeNull();
      expect(rolante?.style.maxHeight, `${nome} está sem teto de altura`).toBe('360px');
    }
  });

  it('com 5 veículos ou menos não existe botão de revelar', async () => {
    obterExploradorDeVeiculos.mockResolvedValue(dados(4));
    montar();
    await waitFor(() => expect(screen.getByText('Top veículos')).toBeInTheDocument());

    const topo = colunaDe('Top veículos');
    expect(within(topo).queryByRole('button', { name: /Ver todos/ })).toBeNull();
  });

  it('a falha vira recado na tela, e não tela vazia', async () => {
    obterExploradorDeVeiculos.mockRejectedValue(new Error('Não foi possível ler os veículos.'));
    montar();
    await waitFor(() =>
      expect(screen.getByText('Não foi possível ler os veículos.')).toBeInTheDocument(),
    );
  });

  it('a resposta atrasada de um recorte não pousa sobre o atual', async () => {
    //: A GUARDA É A CHAVE DO PEDIDO (`codigo|mes|filtro`): sem ela, trocar de
    //: mês duas vezes rápido deixaria a tela mostrando o mês errado.
    let liberar: ((dado: Dados) => void) | undefined;
    obterExploradorDeVeiculos.mockImplementationOnce(
      () => new Promise<Dados>((resolve) => (liberar = resolve)),
    );
    const { rerender } = montar('2026-09');
    obterExploradorDeVeiculos.mockResolvedValue(dados(2));
    rerender(<ExploradorDeVeiculos codigo="imprensa" mes="2026-10" filtro={{}} />);
    //: O ESCOPO É O CARTÃO, porque "Veículo 2" aparece nos DOIS painéis de
    //: veículo ao mesmo tempo — uma busca sem escopo reprova por ambiguidade
    //: em vez de pela contagem.
    await waitFor(() => expect(screen.getByText('Top veículos')).toBeInTheDocument());
    const topo = colunaDe('Top veículos');
    await waitFor(() => expect(within(topo).getByText('Veículo 2')).toBeInTheDocument());

    //: A resposta do mês velho chega DEPOIS, com sete veículos.
    liberar?.(dados(7));
    await waitFor(() => expect(within(topo).getByText('Veículo 2')).toBeInTheDocument());
    //: Continua o recorte novo (2 veículos), e não o velho (7).
    expect(within(topo).queryByText('Veículo 3')).toBeNull();
  });
});
