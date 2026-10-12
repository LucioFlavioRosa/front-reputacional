// @vitest-environment jsdom

/** A ficha de um registro da fila: clicar numa linha e editar todos os campos.
 *
 *  PEDIDO DO DONO DO PRODUTO: "posso fazer uma ação em massa como está feita
 *  hoje, mas gostaria de poder clicar em um registro específico e abrir um modal
 *  para poder editar todos os campos daquele registro em específico".
 *
 *  O QUE ESTES TESTES PROTEGEM:
 *
 *  * a ficha abre com os VALORES GRAVADOS, e não vazia — um formulário que
 *    abre em branco não é edição, é recadastro;
 *  * "Salvar" grava e DEIXA na fila; "Salvar e dar como conferido" grava e
 *    tira — são os dois botões que o dono do produto pediu;
 *  * a ORDEM é gravar e só então consolidar: o inverso perderia a correção;
 *  * a recusa do servidor NÃO fecha o diálogo, porque é ela que a pessoa
 *    precisa ler;
 *  * cada tipo abre a sua ficha, e o tema é BUSCADO porque o catálogo não traz
 *    os riscos dele;
 *  * e o registro que saiu da base diz isso, em vez de editar um fantasma.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';

import { FichaDoPendente } from '@/paginas/cadastroCompartilhado/FichaDoPendente';

vi.mock('@/api/cliente', () => ({
  editarInstituicao: vi.fn(async () => ({})),
  editarInterlocutor: vi.fn(async () => ({})),
  editarPessoaAegea: vi.fn(async () => ({})),
  editarTema: vi.fn(async () => ({})),
  consolidarCadastro: vi.fn(async () => ({ ja_estava_consolidado: false })),
  listarTemas: vi.fn(async () => []),
  mudarContatoDeCasa: vi.fn(),
}));

const A_INSTITUICAO = {
  id: 'inst-1',
  nome: 'XP Asset',
  tipo: 'entidade',
  nome_completo: null,
  esfera_id: null,
  uf: 'SP',
  tier: null,
  categoria_publico_id: null,
  subcategoria_publico_id: null,
  cargo: null,
  interlocutor_id: null,
  ativo: true,
};

const O_CONTATO = {
  id: 'pes-1',
  nome: 'Artur Santa',
  instituicao_id: 'inst-1',
  cargo: 'Diretor de RI',
  area: null,
  email: null,
  redes_sociais: ['https://x.com/artur'],
  tipo: 'investidor',
  ativo: true,
};

let catalogoAtual: unknown = null;
vi.mock('@/estado/painel', () => ({
  usePainel: () => ({ catalogo: catalogoAtual }),
}));

const {
  editarInstituicao,
  editarInterlocutor,
  editarTema,
  consolidarCadastro,
  listarTemas,
  mudarContatoDeCasa,
} = await import('@/api/cliente');

function catalogoCom(extras: Record<string, unknown> = {}) {
  return {
    instituicoes: new Map([
      [A_INSTITUICAO.id, A_INSTITUICAO],
      //: A SEGUNDA CASA, para a mudança ter destino. E uma TERCEIRA, desativada,
      //: que não deve ser oferecida.
      ['inst-2', { ...A_INSTITUICAO, id: 'inst-2', nome: 'Leto Capital' }],
      [
        'inst-3',
        { ...A_INSTITUICAO, id: 'inst-3', nome: 'Casa Fechada', ativo: false },
      ],
    ]),
    interlocutores: new Map([[O_CONTATO.id, O_CONTATO]]),
    pessoas: new Map(),
    dicionarios: {
      ufs: [{ codigo: 'SP', nome: 'São Paulo' }],
      relevancias: [{ id: 1, nome: 'Tier 1' }],
      esferas: [{ id: 3, nome: 'Estadual' }],
      categorias_publico: [
        { id: 7, codigo: 'mercado_financeiro', nome: 'Mercado financeiro', ordem: 1 },
      ],
      subcategorias_publico: [
        { id: 71, categoria_publico_id: 7, nome: 'Gestoras', ordem: 1 },
      ],
      areas_pessoa: [{ id: 4, nome: 'Comunicação' }],
      temas: [],
      temas_inativos: [],
      blocos_tema: [],
      macro_temas: [],
      risk_clusters: [],
      riscos: [],
    },
    ...extras,
  };
}

const PENDENTE_INSTITUICAO = {
  id: 'inst-1',
  tipo: 'instituicao',
  nome: 'XP Asset',
  motivo: 'Entrou pela planilha sem categoria de público.',
  contexto: 'Entidade · SP',
  criado_em: '2026-10-11T12:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  catalogoAtual = catalogoCom();
  vi.mocked(mudarContatoDeCasa).mockResolvedValue({
    id: 'pes-1',
    nome: 'Artur Santa',
    de: 'XP Asset',
    para: 'Leto Capital',
    agendas_que_ficam: 7,
  });
});

it('a ficha abre com os VALORES GRAVADOS', async () => {
  //: UM FORMULÁRIO QUE ABRE EM BRANCO não é edição, é recadastro: a pessoa
  //: clicou para CORRIGIR um campo, e teria de redigitar os outros oito. É
  //: também o caminho mais curto para apagar dado sem querer, porque o PUT da
  //: instituição substitui a ficha inteira.
  render(<FichaDoPendente pendente={PENDENTE_INSTITUICAO} aoFechar={vi.fn()} />);

  expect(await screen.findByDisplayValue('XP Asset')).toBeTruthy();
  //: O TIPO E A PRAÇA GRAVADOS, nos `<select>`.
  expect(screen.getByLabelText(/Tipo/)).toHaveValue('entidade');
  expect(screen.getByLabelText(/Praça/)).toHaveValue('SP');
  //: E O MOTIVO DA FILA no subtítulo: é por isso que a pessoa está aqui.
  expect(screen.getByText(/sem categoria de público/)).toBeTruthy();
});

it('Salvar grava e DEIXA na fila', async () => {
  //: OS DOIS BOTÕES SÃO ESCOLHA DO DONO DO PRODUTO. Editar não é afirmar que
  //: está certo — foi o princípio de toda a fila —, e este botão é o caso em que
  //: outra pessoa ainda precisa conferir.
  const aoFechar = vi.fn();
  render(<FichaDoPendente pendente={PENDENTE_INSTITUICAO} aoFechar={aoFechar} />);
  await screen.findByDisplayValue('XP Asset');

  await userEvent.selectOptions(screen.getByLabelText(/Categoria de público/), '7');
  await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

  await waitFor(() => expect(editarInstituicao).toHaveBeenCalled());
  expect(vi.mocked(editarInstituicao).mock.calls[0][1]).toMatchObject({
    nome: 'XP Asset',
    categoria_publico_id: 7,
    //: A FICHA INTEIRA VAI, inclusive o que não foi tocado: o PUT substitui.
    uf: 'SP',
    ativo: true,
  });
  //: E NÃO CONSOLIDA.
  expect(consolidarCadastro).not.toHaveBeenCalled();
  await waitFor(() => expect(aoFechar).toHaveBeenCalled());
});

it('Salvar e dar como conferido grava e DEPOIS consolida', async () => {
  //: A ORDEM IMPORTA, e é a razão de `gravar` existir como função separada.
  //:
  //: Se a consolidação viesse primeiro e a gravação falhasse, a correção
  //: estaria perdida E o registro fora da fila — invisível. Nesta ordem o pior
  //: caso é "salvou e continuou na fila", que se resolve com um clique em "Está
  //: certo".
  render(<FichaDoPendente pendente={PENDENTE_INSTITUICAO} aoFechar={vi.fn()} />);
  await screen.findByDisplayValue('XP Asset');

  await userEvent.click(
    screen.getByRole('button', { name: /Salvar e dar como conferido/ }),
  );

  await waitFor(() => expect(consolidarCadastro).toHaveBeenCalledWith('instituicao', 'inst-1'));
  const salvouEm = vi.mocked(editarInstituicao).mock.invocationCallOrder[0];
  const consolidouEm = vi.mocked(consolidarCadastro).mock.invocationCallOrder[0];
  expect(salvouEm).toBeLessThan(consolidouEm);
});

it('a RECUSA do servidor nao fecha o dialogo', async () => {
  //: É A RECUSA QUE A PESSOA PRECISA LER. "Já existe outra instituição chamada
  //: X deste mesmo tipo" é informação acionável, e fechar o diálogo a jogaria
  //: fora junto com o que ela digitou.
  vi.mocked(editarInstituicao).mockRejectedValue(
    new Error('Já existe outra instituição chamada XP Asset deste mesmo tipo.'),
  );
  const aoFechar = vi.fn();
  render(<FichaDoPendente pendente={PENDENTE_INSTITUICAO} aoFechar={aoFechar} />);
  await screen.findByDisplayValue('XP Asset');

  await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

  expect(await screen.findByText(/Já existe outra instituição/)).toBeTruthy();
  expect(aoFechar).not.toHaveBeenCalled();
  //: E O QUE FOI DIGITADO CONTINUA LÁ.
  expect(screen.getByDisplayValue('XP Asset')).toBeTruthy();
});

it('o cargo e o "de quem e" aparecem SO em perfil de rede', async () => {
  //: O BANCO TEM CHECK DOS DOIS — eles só existem em `tipo = 'perfil_rede'`, e
  //: oferecê-los nos outros tipos seria oferecer o que será recusado. É o mesmo
  //: CHECK que fez o lote recusar perfil de rede.
  render(<FichaDoPendente pendente={PENDENTE_INSTITUICAO} aoFechar={vi.fn()} />);
  await screen.findByDisplayValue('XP Asset');

  expect(screen.queryByLabelText(/De quem é este perfil/)).toBeNull();

  await userEvent.selectOptions(screen.getByLabelText(/Tipo/), 'perfil_rede');
  expect(screen.getByLabelText(/De quem é este perfil/)).toBeTruthy();
});

it('a ficha do CONTATO salva sem perder nada, e a casa nao e campo', async () => {
  //: A PREMISSA DESTE TESTE MUDOU, e vale registrar: ele dizia "a ficha não
  //: troca a instituição" e afirmava que não havia caminho nenhum. O dono do
  //: produto pediu o caminho — "siga com mover contato" —, e ele existe agora
  //: como GESTO À PARTE, com confirmação (ver o teste logo abaixo).
  //:
  //: O QUE CONTINUA VERDADE, e é o que este teste guarda: a casa não é um CAMPO
  //: do formulário. "Mesmo nome em instituições diferentes são pessoas
  //: diferentes", diz a `0002`, e salvar a ficha manda a instituição que já
  //: estava lá — quem abriu para corrigir um e-mail não leva o contato de casa.
  render(
    <FichaDoPendente
      pendente={{ ...PENDENTE_INSTITUICAO, id: 'pes-1', tipo: 'interlocutor', nome: 'Artur Santa' }}
      aoFechar={vi.fn()}
    />,
  );

  expect(await screen.findByDisplayValue('Artur Santa')).toBeTruthy();
  //: O CARGO SE EDITA.
  expect(screen.getByDisplayValue('Diretor de RI')).toBeTruthy();
  //: A CASA APARECE COMO LEITURA no corpo da ficha...
  expect(screen.getByText(/Fala por: XP Asset/)).toBeTruthy();
  //: ...e NÃO como campo do formulário: não há `<input>`/`<select>` de
  //: instituição entre os campos que "Salvar" manda.
  expect(screen.queryByLabelText(/^Instituição$/)).toBeNull();

  await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
  await waitFor(() => expect(editarInterlocutor).toHaveBeenCalled());
  expect(vi.mocked(editarInterlocutor).mock.calls[0][1]).toMatchObject({
    instituicao_id: 'inst-1',
    //: E AS REDES SOCIAIS VÃO JUNTO, mesmo sem aparecer na linha da fila.
    redes_sociais: ['https://x.com/artur'],
  });
});

it('o TEMA e buscado, porque o catalogo nao traz os riscos dele', async () => {
  //: `dicionarios.temas` não traz `riscos` — é uma RELAÇÃO, não coluna. Sem
  //: buscar, salvar a ficha mandaria `riscos: []` e apagaria a ligação com a
  //: matriz corporativa: a armadilha desta tabela, pela quarta vez.
  vi.mocked(listarTemas).mockResolvedValue([
    {
      id: 44,
      nome: 'Qualidade da água',
      nivel: 'sensivel',
      ativo: true,
      e_risco: true,
      macro_tema_id: null,
      camada_lso: 'legitimidade',
      riscos: [3, 7],
    },
  ]);

  render(
    <FichaDoPendente
      pendente={{ ...PENDENTE_INSTITUICAO, id: '44', tipo: 'tema', nome: 'Qualidade da água' }}
      aoFechar={vi.fn()}
    />,
  );

  expect(await screen.findByDisplayValue('Qualidade da água')).toBeTruthy();
  expect(listarTemas).toHaveBeenCalled();

  await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
  await waitFor(() => expect(editarTema).toHaveBeenCalled());
  //: OS RISCOS SOBREVIVEM.
  expect(vi.mocked(editarTema).mock.calls[0][1]).toMatchObject({ riscos: [3, 7] });
});

it('o registro que SAIU da base diz isso, em vez de editar um fantasma', async () => {
  //: A FILA PODE ESTAR VELHA: outra pessoa removeu o cadastro enquanto esta
  //: tela estava aberta. Um formulário vazio aqui seria pior que um aviso —
  //: salvar criaria confusão, e o 404 chegaria sem contexto.
  render(
    <FichaDoPendente
      pendente={{ ...PENDENTE_INSTITUICAO, id: 'nao-existe' }}
      aoFechar={vi.fn()}
    />,
  );

  expect(await screen.findByText(/não está mais na base/)).toBeTruthy();
});

it('sem catalogo, a ficha ESPERA em vez de estourar', async () => {
  //: A FILA CARREGA POR ROTA PRÓPRIA e não espera a carga do painel, então
  //: "catálogo nulo com a fila cheia" é o estado dos primeiros instantes de toda
  //: abertura da tela — e dá para clicar numa linha nesse intervalo.
  catalogoAtual = null;
  render(<FichaDoPendente pendente={PENDENTE_INSTITUICAO} aoFechar={vi.fn()} />);

  expect(await screen.findByText(/Buscando a ficha deste cadastro/)).toBeTruthy();
});

it('sair de perfil de rede LIMPA o cargo e a pessoa', async () => {
  //: ACHADO DE REVISÃO COM SEVERIDADE MÉDIA, e o defeito era meu por ignorar o
  //: que a tela principal já fazia: os dois campos DESAPARECEM quando o tipo
  //: muda, mas continuavam no rascunho e iam no PUT.
  //:
  //: O banco tem CHECK de que eles só existem em `perfil_rede`, então salvar
  //: era recusado por causa de um campo que a pessoa não conseguia mais ver — o
  //: pior tipo de recusa, porque ela não tem o que corrigir.
  catalogoAtual = catalogoCom({
    instituicoes: new Map([
      [
        'perf-1',
        {
          ...A_INSTITUICAO,
          id: 'perf-1',
          nome: 'stelafariasrs',
          tipo: 'perfil_rede',
          cargo: 'Deputado estadual',
          interlocutor_id: 'pes-1',
        },
      ],
    ]),
  });

  render(
    <FichaDoPendente
      pendente={{ ...PENDENTE_INSTITUICAO, id: 'perf-1', nome: 'stelafariasrs' }}
      aoFechar={vi.fn()}
    />,
  );
  await screen.findByDisplayValue('stelafariasrs');
  //: ELES ESTÃO LÁ enquanto é perfil de rede.
  expect(screen.getByDisplayValue('Deputado estadual')).toBeTruthy();

  await userEvent.selectOptions(screen.getByLabelText(/Tipo/), 'orgao');
  //: SUMIRAM DA TELA...
  expect(screen.queryByDisplayValue('Deputado estadual')).toBeNull();

  await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
  await waitFor(() => expect(editarInstituicao).toHaveBeenCalled());
  //: ...E SUMIRAM DO PUT. Antes iam, e o banco recusava.
  expect(vi.mocked(editarInstituicao).mock.calls[0][1]).toMatchObject({
    tipo: 'orgao',
    cargo: null,
    interlocutor_id: null,
  });
});

it('a recarga do catalogo NAO apaga o que esta sendo digitado no tema', async () => {
  //: ACHADO DE REVISÃO COM SEVERIDADE MÉDIA: `macros` saía de `catalogo`, e
  //: QUALQUER escrita em rota de catálogo troca aquele objeto — o efeito rodava
  //: de novo, buscava os temas de novo, e REESCREVIA o rascunho com os valores
  //: do servidor, apagando o que a pessoa digitou.
  //:
  //: E O MODAL TEM GATILHO PRÓPRIO PARA ISSO: salvar aqui avisa o catálogo.
  vi.mocked(listarTemas).mockResolvedValue([
    {
      id: 44,
      nome: 'Qualidade da água',
      nivel: 'gerais',
      ativo: true,
      e_risco: false,
      macro_tema_id: null,
      camada_lso: null,
      riscos: [],
    },
  ]);
  const pendente = {
    ...PENDENTE_INSTITUICAO,
    id: '44',
    tipo: 'tema',
    nome: 'Qualidade da água',
  };
  const { rerender } = render(
    <FichaDoPendente pendente={pendente} aoFechar={vi.fn()} />,
  );
  const campo = await screen.findByDisplayValue('Qualidade da água');

  await userEvent.clear(campo);
  await userEvent.type(campo, 'Qualidade da água tratada');
  expect(screen.getByDisplayValue('Qualidade da água tratada')).toBeTruthy();

  //: O CATÁLOGO RECARREGA: objeto novo, mesmo conteúdo.
  catalogoAtual = catalogoCom();
  rerender(<FichaDoPendente pendente={pendente} aoFechar={vi.fn()} />);

  //: O QUE FOI DIGITADO FICA.
  await waitFor(() =>
    expect(screen.getByDisplayValue('Qualidade da água tratada')).toBeTruthy(),
  );
});

it('a MUDANCA DE CASA e um gesto a parte, nao um campo', async () => {
  //: "Mesmo nome em instituições diferentes são pessoas diferentes", diz a
  //: `0002`: a instituição é parte da IDENTIDADE do contato neste modelo. Num
  //: `<select>` ao lado do cargo ela teria o mesmo peso de corrigir um e-mail.
  //:
  //: E SALVAR A FICHA NÃO A INCLUI: quem abriu para corrigir um e-mail não pode
  //: levar o contato de instituição sem ter pedido.
  render(
    <FichaDoPendente
      pendente={{ ...PENDENTE_INSTITUICAO, id: 'pes-1', tipo: 'interlocutor', nome: 'Artur Santa' }}
      aoFechar={vi.fn()}
    />,
  );
  await screen.findByDisplayValue('Artur Santa');

  await userEvent.selectOptions(screen.getByLabelText(/Mudar de casa/), 'inst-2');
  //: A CONFIRMAÇÃO APARECE DEPOIS DE ESCOLHER, e diz o que vai acontecer com o
  //: histórico — é a razão de a mudança ter três passos.
  expect(screen.getByText(/mover não reescreve o histórico/)).toBeTruthy();

  //: SALVAR A FICHA NÃO MOVE.
  await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
  await waitFor(() => expect(editarInterlocutor).toHaveBeenCalled());
  expect(mudarContatoDeCasa).not.toHaveBeenCalled();
  expect(vi.mocked(editarInterlocutor).mock.calls[0][1]).toMatchObject({
    instituicao_id: 'inst-1',
  });
});

it('Mover conta quantas AGENDAS ficam na casa antiga', async () => {
  //: É A FRASE QUE DISTINGUE AS DUAS LEITURAS: com zero agendas, a provável é
  //: "errei a instituição no cadastro"; com sete, é "mudou de casa". E o
  //: histórico não muda — `interacao.instituicao_id` é coluna própria da agenda.
  render(
    <FichaDoPendente
      pendente={{ ...PENDENTE_INSTITUICAO, id: 'pes-1', tipo: 'interlocutor', nome: 'Artur Santa' }}
      aoFechar={vi.fn()}
    />,
  );
  await screen.findByDisplayValue('Artur Santa');

  await userEvent.selectOptions(screen.getByLabelText(/Mudar de casa/), 'inst-2');
  await userEvent.click(screen.getByRole('button', { name: 'Mover' }));

  expect(mudarContatoDeCasa).toHaveBeenCalledWith('pes-1', 'inst-2');
  expect(
    await screen.findByText(/7 agendas continuam registradas em XP Asset/),
  ).toBeTruthy();
});

it('a casa DESATIVADA nao e oferecida', async () => {
  //: O servidor recusa mover para casa desativada, porque a listagem de
  //: contatos aplica os dois níveis e a pessoa ficaria invisível. Oferecer aqui
  //: seria oferecer o que será recusado.
  render(
    <FichaDoPendente
      pendente={{ ...PENDENTE_INSTITUICAO, id: 'pes-1', tipo: 'interlocutor', nome: 'Artur Santa' }}
      aoFechar={vi.fn()}
    />,
  );
  await screen.findByDisplayValue('Artur Santa');

  const seletor = screen.getByLabelText(/Mudar de casa/);
  expect(seletor.textContent).toContain('Leto Capital');
  expect(seletor.textContent).not.toContain('Casa Fechada');
});

it('a RECUSA da mudanca aparece, e o contato nao se move', async () => {
  //: A recusa do servidor é informativa: "já existe um contato chamado X em
  //: Leto Capital — se for a mesma pessoa, a resposta é fundir os dois em
  //: 'Possíveis duplicados', e não mover um para cima do outro".
  vi.mocked(mudarContatoDeCasa).mockRejectedValue(
    new Error(
      "Já existe um contato chamado 'Artur Santa' em 'Leto Capital' — a " +
        "resposta é fundir os dois em 'Possíveis duplicados'.",
    ),
  );
  render(
    <FichaDoPendente
      pendente={{ ...PENDENTE_INSTITUICAO, id: 'pes-1', tipo: 'interlocutor', nome: 'Artur Santa' }}
      aoFechar={vi.fn()}
    />,
  );
  await screen.findByDisplayValue('Artur Santa');

  await userEvent.selectOptions(screen.getByLabelText(/Mudar de casa/), 'inst-2');
  await userEvent.click(screen.getByRole('button', { name: 'Mover' }));

  expect(await screen.findByText(/Possíveis duplicados/)).toBeTruthy();
  //: E O SELETOR CONTINUA LÁ, com a escolha: a pessoa pode ir resolver e voltar.
  expect(screen.getByLabelText(/Mudar de casa/)).toHaveValue('inst-2');
});
