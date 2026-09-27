// @vitest-environment jsdom

/** O teto do arquivo é 500 agendas por 58 colunas: 29 mil células.
 *
 *  POR QUE MEDIR ANTES DE OTIMIZAR: "vai ficar lento" é palpite, e otimizar por
 *  palpite acrescenta complexidade que ninguém pediu. Este teste mede o caso do teto e
 *  falha se ele passar de um limite que já seria ruim para quem usa.
 *
 *  O QUE A MEDIÇÃO ACHOU: montar as 29 mil células de uma vez levava ~12 SEGUNDOS
 *  aqui. E `jsdom` é otimista — ele não faz layout nem pintura —, então na tela de
 *  verdade seria pior. A grade passou a montar POR BLOCOS: a primeira tela vem
 *  imediata e o resto entra conforme a pessoa rola.
 *
 *  A ASSERÇÃO É SOBRE A CAUSA, NÃO SOBRE O TEMPO. Eu escrevi primeiro um limite de
 *  milissegundos, e ele passou sozinho e falhou com a suíte inteira em paralelo — tempo
 *  de parede depende da máquina e de quem mais está rodando, e um teste instável é pior
 *  que teste nenhum: ele treina quem o vê vermelho a rodar de novo em vez de olhar.
 *
 *  O QUE É DETERMINÍSTICO é o número de linhas montadas. Se alguém tirar a montagem por
 *  blocos, este teste fica vermelho na hora — que é exatamente o que se quer dele.
 */

import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ConferirImportacao } from '@/paginas/importacao/ConferirImportacao';
import type { ColunaDaImportacao, Importacao, LinhaDaImportacao } from '@/api/cliente';

const TETO_DE_AGENDAS = 500;
const COLUNAS_DO_COMPLETO = 58;

/** Quantas linhas a primeira tela pode montar. O bloco é de 80; o teto folgado aqui
 *  deixa passar um ajuste do tamanho do bloco sem deixar passar "montou tudo". */
const TETO_DA_PRIMEIRA_TELA = 120;

const COLUNAS: ColunaDaImportacao[] = Array.from(
  { length: COLUNAS_DO_COMPLETO },
  (_, indice) => ({ nome: `Coluna ${indice + 1}`, tipo: indice % 7 === 0 ? 'prosa' : 'texto' }),
);

const LINHAS: LinhaDaImportacao[] = Array.from({ length: TETO_DE_AGENDAS }, (_, indice) => ({
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
  id: 'imp-teto',
  arquivo_nome: 'no-teto.xlsx',
  situacao: 'aguardando_conferencia',
  criado_em: '2026-09-27T10:00:00',
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

/** ESTE ARQUIVO É DELIBERADAMENTE PESADO: ele monta o caso do teto. Rodando junto com
 *  os outros quarenta, ele passa dos 5 segundos que o vitest dá por padrão — e o teto
 *  padrão existe para pegar teste PENDURADO, que é outra coisa. Tempo próprio aqui é
 *  dizer "este demora de propósito", em vez de afrouxar o limite de todo mundo. */
const PACIENCIA = { timeout: 30_000 };

describe('a grade no teto do arquivo', () => {
  it('mostra a primeira tela sem montar as 29 mil células', PACIENCIA, async () => {
    render(<ConferirImportacao id="imp-teto" aoFechar={() => {}} />);
    await waitFor(() => expect(screen.getByText('no-teto.xlsx')).toBeTruthy());

    const linhas = document.querySelectorAll('tbody tr[data-linha]');
    // Linhas de verdade, e não a tela vazia: o teste tem de falhar se a grade parar
    // de montar, não só se ela montar demais.
    expect(linhas.length).toBeGreaterThan(0);
    expect(linhas.length).toBeLessThanOrEqual(TETO_DA_PRIMEIRA_TELA);
  });

  it('diz quantas das 500 já estão à vista, para ninguém achar que faltou linha', PACIENCIA, async () => {
    /** É A CONTRAPARTIDA HONESTA de montar por blocos: sem este aviso, quem subiu 500
     *  agendas e vê 80 linhas conclui que o arquivo perdeu 420. */
    render(<ConferirImportacao id="imp-teto" aoFechar={() => {}} />);

    await waitFor(() => expect(screen.getByText(/de 500 linhas/)).toBeTruthy());
  });

  it('a contagem do cabeçalho é de TODAS as agendas, não das que estão à vista', PACIENCIA, async () => {
    render(<ConferirImportacao id="imp-teto" aoFechar={() => {}} />);

    await waitFor(() => expect(screen.getByText(/^500 agendas/)).toBeTruthy());
  });
});
