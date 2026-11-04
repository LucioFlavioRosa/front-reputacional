// @vitest-environment jsdom

/** Quando cada base foi carregada, e por quem.
 *
 *  O QUE ESTES TESTES PROTEGEM:
 *
 *  * a base que NUNCA carregou é avisada. A rota devolve eventos, não status:
 *    uma base sem carga simplesmente não vem, e ficar calada esconderia
 *    justamente o caso em que alguém precisa agir;
 *  * as fontes irmãs do mesmo arquivo aparecem como UMA carga — a subida da
 *    Clipei alimenta Imprensa e Mercado, e listar duas sugeriria que o arquivo
 *    subiu duas vezes;
 *  * a carga de ZERO linha aparece, porque é o caso que a trilha existe para
 *    registrar: o recorte que não achou veículo apaga o mês e não insere nada;
 *  * carga sem autor é dita como "fora da tela", não como desconhecida;
 *  * nas agendas antigas o verbo troca para "enviou o arquivo", porque ali o
 *    nome é de quem subiu e a hora é de quem confirmou;
 *  * e a falha de leitura é dita, não engolida.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';

import { AtualizacaoDasBases } from '@/paginas/AtualizacaoDasBases';

vi.mock('@/api/cliente', () => ({
  obterCargasDasBases: vi.fn(),
}));

const { obterCargasDasBases } = await import('@/api/cliente');

function carga(ajustes: Record<string, unknown> = {}) {
  return {
    base: 'score',
    fonte: 'Clipei Imprensa',
    arquivo: 'clipping.xlsx',
    quem: 'Maria Souza',
    quem_enviou_o_arquivo: false,
    origem: 'api:planilha',
    linhas: 25000,
    meses: ['2026-08-01'],
    quando: new Date().toISOString(),
    lote_id: 'lote-1',
    ...ajustes,
  };
}

beforeEach(() => {
  vi.mocked(obterCargasDasBases).mockReset();
});

it('avisa quais bases nunca receberam carga', async () => {
  vi.mocked(obterCargasDasBases).mockResolvedValue([carga()] as never);

  render(<AtualizacaoDasBases />);

  const aviso = await screen.findByText(/Sem registro de carga/i);
  expect(aviso.textContent).toContain('Cotações dos bonds');
  expect(aviso.textContent).toContain('Taxonomia de subtemas');
  expect(aviso.textContent).toContain('Agendas do CRM');
  //: E NÃO menciona a que carregou.
  expect(aviso.textContent).not.toContain('Menções');
});

it('não avisa nada quando as quatro bases já carregaram', async () => {
  vi.mocked(obterCargasDasBases).mockResolvedValue([
    carga({ base: 'score' }),
    carga({ base: 'bonds', fonte: null, lote_id: 'l2' }),
    carga({ base: 'subtemas', fonte: null, lote_id: 'l3' }),
    carga({ base: 'agendas', fonte: null, lote_id: null }),
  ] as never);

  render(<AtualizacaoDasBases />);

  //: PELAS LINHAS DA TABELA e não pelo nome da base: o nome aparece também no
  //: botão de filtro, e a consulta por texto acharia os dois.
  await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(5)); // cabeçalho + 4
  expect(screen.queryByText(/Sem registro de carga/i)).toBeNull();
});

it('mostra as fontes irmãs do mesmo arquivo como UMA carga', async () => {
  vi.mocked(obterCargasDasBases).mockResolvedValue([
    carga({ fonte: 'Clipei Imprensa', linhas: 25000 }),
    carga({ fonte: 'Clipei Mercado', linhas: 320 }),
  ] as never);

  render(<AtualizacaoDasBases />);

  await screen.findByText(/Clipei Imprensa · Clipei Mercado/);
  //: UMA linha de dado na tabela, e a soma das duas.
  expect(screen.getAllByRole('row')).toHaveLength(2); // cabeçalho + 1
  expect(screen.getByText('25.320')).toBeTruthy();
});

it('mostra a carga de ZERO linha em vez de esconder', async () => {
  vi.mocked(obterCargasDasBases).mockResolvedValue([
    carga({ linhas: 0, arquivo: 'recorte-vazio.xlsx' }),
  ] as never);

  render(<AtualizacaoDasBases />);

  await screen.findByText('recorte-vazio.xlsx');
  expect(screen.getByText('0')).toBeTruthy();
});

it('diz "fora da tela" com a origem quando não há autor', async () => {
  vi.mocked(obterCargasDasBases).mockResolvedValue([
    carga({ quem: null, origem: 'carga_do_pacote' }),
  ] as never);

  render(<AtualizacaoDasBases />);

  await screen.findByText('fora da tela (carga_do_pacote)');
});

it('troca o verbo na agenda antiga, que só sabe quem enviou', async () => {
  vi.mocked(obterCargasDasBases).mockResolvedValue([
    carga({
      base: 'agendas',
      fonte: null,
      lote_id: null,
      quem: 'João Lima',
      quem_enviou_o_arquivo: true,
      meses: [],
    }),
  ] as never);

  render(<AtualizacaoDasBases />);

  await screen.findByText('João Lima (enviou o arquivo)');
});

it('filtra por base sem ir à rede de novo', async () => {
  vi.mocked(obterCargasDasBases).mockResolvedValue([
    carga({ base: 'score', arquivo: 'clipping.xlsx' }),
    carga({ base: 'bonds', fonte: null, lote_id: 'l2', arquivo: 'bdh.xlsx', meses: [] }),
  ] as never);

  render(<AtualizacaoDasBases />);
  await screen.findByText('clipping.xlsx');

  await userEvent.click(screen.getByRole('button', { name: 'Cotações dos bonds' }));

  await waitFor(() => expect(screen.queryByText('clipping.xlsx')).toBeNull());
  expect(screen.getByText('bdh.xlsx')).toBeTruthy();
  //: UMA chamada só: o filtro é em memória.
  expect(vi.mocked(obterCargasDasBases)).toHaveBeenCalledTimes(1);
});

it('diz que a leitura falhou em vez de ficar carregando para sempre', async () => {
  vi.mocked(obterCargasDasBases).mockRejectedValue(new Error('403 sem permissão'));

  render(<AtualizacaoDasBases />);

  const alerta = await screen.findByRole('alert');
  expect(alerta.textContent).toContain('403 sem permissão');
});
