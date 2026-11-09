// @vitest-environment jsdom

/** O PRÉ-CADASTRO: dar o nível antes do primeiro login.
 *
 *  O DEFEITO QUE ISTO CONSERTA: a pessoa só passava a existir depois de ser
 *  RECUSADA. Entrava pelo SSO, nascia sem papel, o servidor barrava, e só então
 *  aparecia nesta lista para alguém liberar. Numa estreia com diretores e
 *  C-levels, isso é um lote de "seu acesso ainda não foi liberado" antes de
 *  qualquer um poder agir.
 *
 *  NADA É ENVIADO, e isto está no teste porque o nome óbvio para a função
 *  ("convite") faria esperar o contrário: não há e-mail, link nem notificação.
 *  Grava-se nome, e-mail e nível; quem avisa a pessoa é quem a cadastra no
 *  Entra ID.
 *
 *  O PRIMEIRO TESTE DE COMPONENTE DESTA TELA. Ela tem 61 KB e até aqui só a
 *  lógica pura (`dominio/perfis`, `dominio/concessao`) era coberta. Este arquivo
 *  cobre só o pré-cadastro — não é a cobertura que a tela merece, e é a que a
 *  mudança precisa.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';

import type { Acesso, PapelDisponivel } from '@/dominio/tipos';
import { GerenciamentoDePerfis } from '@/paginas/GerenciamentoDePerfis';

vi.mock('@/api/cliente', () => ({
  listarAcessos: vi.fn(),
  listarPapeis: vi.fn(),
  preCadastrarAcesso: vi.fn(),
  concederAcesso: vi.fn(),
  definirSituacaoDeAcesso: vi.fn(),
  historicoDeAcesso: vi.fn(async () => []),
}));

const { listarAcessos, listarPapeis, preCadastrarAcesso } =
  await import('@/api/cliente');

const PAPEL: PapelDisponivel = {
  codigo: 'crm_leitura',
  nome: 'CRM — leitura',
  administra_acessos: false,
  administra_dicionarios: false,
  ve_campos_sensiveis: false,
  ve_diretorio: true,
  pode_criar: false,
  pode_editar_proprio: false,
  pode_editar_tudo: false,
  pode_exportar: false,
  acessa_crm: true,
  acessa_inteligencia_de_mercado: false,
  acessa_score: false,
};

function pessoa(extra: Partial<Acesso>): Acesso {
  return {
    id: 'id-1',
    nome: 'Ana Com Conta',
    email: 'ana@aegea.com.br',
    ativo: true,
    papel: 'crm_leitura',
    acesso_irrestrito: true,
    sensivel: false,
    externo: false,
    expira_em: null,
    frentes: [],
    unidades: [],
    concedido_por: 'Coordenação',
    concedido_em: '2026-11-01T10:00:00-03:00',
    aguardando_primeiro_acesso: false,
    ...extra,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listarPapeis).mockResolvedValue([PAPEL]);
  vi.mocked(listarAcessos).mockResolvedValue([pessoa({})]);
  vi.mocked(preCadastrarAcesso).mockResolvedValue({ id: 'id-novo' });
});

it('a lista marca NUNCA ENTROU em quem foi pre-cadastrado, e so nele', async () => {
  /** A marca é a mitigação da conta fantasma, não enfeite.
   *
   *  Um pré-cadastro com o e-mail digitado errado nunca casa com ninguém e fica
   *  na lista para sempre, com nível, parecendo gente com acesso. Sem esta marca
   *  ninguém sabe que aquela pessoa não entrou uma única vez. É o estado que a
   *  `0096` do back tinha fechado, e que a `0119` reabre de propósito.
   */
  vi.mocked(listarAcessos).mockResolvedValue([
    pessoa({}),
    pessoa({
      id: 'id-2',
      nome: 'Bruno Pre Cadastrado',
      email: 'bruno@aegea.com.br',
      aguardando_primeiro_acesso: true,
    }),
  ]);

  render(<GerenciamentoDePerfis euId="eu" />);

  expect(await screen.findByText(/Bruno Pre Cadastrado/)).toBeTruthy();
  expect(screen.getByText(/nunca entrou/)).toBeTruthy();
  //: UMA SÓ: quem já tem conta não carrega a marca.
  expect(screen.getAllByText(/nunca entrou/)).toHaveLength(1);
});

it('o formulario grava NOME e E-MAIL e NENHUM nivel', async () => {
  /** SEM NÍVEL AQUI, de propósito: o nível se dá no painel da direita, que é o
   *  editor de alcance que esta tela sempre teve. Pedi-lo no formulário exigiria
   *  uma segunda cópia das regras de frente, unidade, prazo e sensível — e cópia
   *  de formulário é onde mora o campo que divergiu.
   */
  render(<GerenciamentoDePerfis euId="eu" />);

  await userEvent.click(
    await screen.findByRole('button', { name: 'Pré-cadastrar pessoa' }),
  );
  await userEvent.type(
    screen.getByLabelText('Nome da pessoa a pré-cadastrar'),
    'Carla Diretora',
  );
  await userEvent.type(
    screen.getByLabelText('E-mail da pessoa a pré-cadastrar'),
    'carla@aegea.com.br',
  );
  await userEvent.click(screen.getByRole('button', { name: 'Pré-cadastrar' }));

  await waitFor(() => expect(preCadastrarAcesso).toHaveBeenCalledTimes(1));
  const [email, nome, concessao] = vi.mocked(preCadastrarAcesso).mock.calls[0];
  expect(email).toBe('carla@aegea.com.br');
  expect(nome).toBe('Carla Diretora');
  expect(concessao.papel).toBeNull();
  //: NULO É VERDADE: a linha nasce nesta requisição, então não há versão
  //: anterior que alguém possa sobrescrever sem perceber.
  expect(concessao.versao_vista).toBeNull();
});

it('o formulario RECUSA nome ou e-mail em branco antes de chamar o servidor', async () => {
  //: A guarda é da tela, e o servidor tem a dele. Esta existe para o erro não
  //: custar uma ida à rede nem aparecer como falha do servidor.
  render(<GerenciamentoDePerfis euId="eu" />);

  await userEvent.click(
    await screen.findByRole('button', { name: 'Pré-cadastrar pessoa' }),
  );
  await userEvent.click(screen.getByRole('button', { name: 'Pré-cadastrar' }));

  expect(await screen.findByText('Preencha nome e e-mail.')).toBeTruthy();
  expect(preCadastrarAcesso).not.toHaveBeenCalled();
});

it('a RECUSA DO SERVIDOR aparece com o texto dele', async () => {
  /** As duas recusas possíveis dizem o que fazer, e são diferentes: "já tem
   *  conta" manda editar na lista; "já tem pré-cadastro" diz que só falta o
   *  primeiro login. Reescrevê-las aqui seria uma segunda versão a divergir.
   */
  vi.mocked(preCadastrarAcesso).mockRejectedValue(
    new Error('Esta pessoa já tem conta no painel. Edite o acesso dela na lista.'),
  );

  render(<GerenciamentoDePerfis euId="eu" />);

  await userEvent.click(
    await screen.findByRole('button', { name: 'Pré-cadastrar pessoa' }),
  );
  await userEvent.type(
    screen.getByLabelText('Nome da pessoa a pré-cadastrar'),
    'Ana Com Conta',
  );
  await userEvent.type(
    screen.getByLabelText('E-mail da pessoa a pré-cadastrar'),
    'ana@aegea.com.br',
  );
  await userEvent.click(screen.getByRole('button', { name: 'Pré-cadastrar' }));

  expect(await screen.findByText(/já tem conta no painel/)).toBeTruthy();
});

it('a tela diz que o e-mail precisa ser o do Entra, e que nada e enviado', async () => {
  /** As duas frases são o conserto de mal-entendidos previsíveis: o único jeito
   *  de errar isto sem aviso é digitar um e-mail diferente do que será cadastrado
   *  no Entra, e o nome "pré-cadastro" não diz por si que ninguém é notificado.
   */
  render(<GerenciamentoDePerfis euId="eu" />);

  await userEvent.click(
    await screen.findByRole('button', { name: 'Pré-cadastrar pessoa' }),
  );

  expect(screen.getByText(/mesmo e-mail que será cadastrado no Entra/)).toBeTruthy();
  expect(screen.getByText(/Nada é enviado à pessoa/)).toBeTruthy();
});
