// @vitest-environment jsdom

/** A fila do mesmo ator cadastrado duas vezes.
 *
 *  O homônimo exato a migration `0077` fundiu sozinha. O que chega a esta tela
 *  são os pares que só casam depois de tirar pontuação — `valoreconomico` ↔
 *  `Valor Econômico` —, e ali semelhança NÃO é identidade: `Diário SM` e
 *  `Diários M` casam assim, e `bmc.news` casa com dois veículos.
 *
 *  O QUE ESTES TESTES PROTEGEM:
 *
 *  * a fila VAZIA não ocupa tela: nada a fazer, nada a ler;
 *  * mas SÓ quando o vazio é verdade: desde a `0118` o pareamento é guardado, e
 *    uma fila que nunca foi pareada também vem vazia — aí a tela diz isso em vez
 *    de desaparecer afirmando "(0)";
 *  * cada lado mostra quantas menções carrega — é o número que diz qual é a
 *    linha com história, e é ela que sobrevive;
 *  * "Fundir" manda o perfil como quem SAI (a ordem dos argumentos é a regra
 *    de negócio inteira: trocada, apagaria o veículo curado);
 *  * "Não é o mesmo" grava a decisão — sem isso o par recusado voltaria
 *    idêntico para sempre, e a fila que não anda é a que ninguém olha;
 *  * depois de responder, a fila é relida: a linha respondida sai;
 *  * e a falha de carga NÃO derruba a tela do cadastro: a fila é acessória.
 */

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';

import type { EstadoDaFilaDeDuplicados } from '@/api/cliente';
import { catalogoMudou } from '@/dominio/sincronizacao';
import { FilaDeDuplicados } from '@/paginas/FilaDeDuplicados';

vi.mock('@/api/cliente', () => ({
  duplicadosDeCadastro: vi.fn(),
  //: O ESTADO DO PAREAMENTO, que a tela pede junto com a lista: é ele que diz se
  //: um vazio é "nenhum duplicado" ou "nunca pareada".
  estadoDaFilaDeDuplicados: vi.fn(),
  fundirCadastro: vi.fn(async () => ({ id: 'v1', nome: 'Valor Econômico' })),
  declararCadastroDistinto: vi.fn(async () => ({ guardado: true })),
}));

const {
  duplicadosDeCadastro,
  estadoDaFilaDeDuplicados,
  fundirCadastro,
  declararCadastroDistinto,
} = await import('@/api/cliente');

//: PAREADA AGORA E EM DIA — o estado em que a tela não tem ressalva nenhuma a
//: fazer, e portanto o padrão de todo teste que não é sobre o pareamento.
const PAREADA_E_EM_DIA = {
  calculado_em: new Date().toISOString(),
  desatualizado: false,
};

const UM_PAR = [
  {
    id: 'p1',
    nome: 'valoreconomico',
    tipo: 'perfil_rede',
    cargo: 'Imprensa',
    //: AS ORIGENS DOS DOIS LADOS, que é o que explica a duplicata: o handle
    //: chegou pelo social listening, o veículo pelo clipping.
    origens: ['sociedade'],
    mencoes: 11,
    candidatos: [
      {
        id: 'v1',
        nome: 'Valor Econômico',
        tipo: 'veiculo',
        mencoes: 88,
        origens: ['imprensa', 'mercado'],
      },
    ],
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(duplicadosDeCadastro).mockResolvedValue(UM_PAR);
  vi.mocked(estadoDaFilaDeDuplicados).mockResolvedValue(PAREADA_E_EM_DIA);
  vi.mocked(fundirCadastro).mockResolvedValue({ id: 'v1', nome: 'Valor Econômico' });
  vi.mocked(declararCadastroDistinto).mockResolvedValue({ guardado: true });
});

it('a fila VAZIA E PAREADA nao ocupa tela', async () => {
  //: PAREADA E EM DIA, que é a única combinação em que o vazio é uma resposta:
  //: o pareamento rodou, o cadastro não mudou depois, e não há par nenhum. Aí
  //: não há nada a fazer nem a ler, e a seção desaparece.
  vi.mocked(duplicadosDeCadastro).mockResolvedValue([]);

  const { container } = render(<FilaDeDuplicados />);

  await waitFor(() => expect(duplicadosDeCadastro).toHaveBeenCalled());
  await waitFor(() => expect(container.textContent).toBe(''));
});

it('a fila que NUNCA foi pareada nao desaparece calada, nem diz zero', async () => {
  /** O DEFEITO QUE ISTO PRENDE, e é o preço do conserto do 504. Desde a `0118` o
   *  pareamento é GUARDADO em vez de refeito a cada abertura — comparar o
   *  cadastro par a par custava 102,7 s medidos em 11.000 cadastros, contra os
   *  ~240 s em que o ingress corta.
   *
   *  A TABELA NASCE VAZIA. Aplicada a migration sem rodar o comando de recálculo,
   *  a rota devolve `[]` com toda honestidade — e a tela, que sumia no vazio,
   *  sumiria num cadastro cheio de duplicatas sem dizer nada. É a MESMA família
   *  do defeito que a trilha das cargas existe para fechar: zero indistinguível
   *  de "nunca mediu".
   *
   *  E O TÍTULO NÃO PODE DIZER "(0)": zero par guardado não é zero duplicado. */
  vi.mocked(duplicadosDeCadastro).mockResolvedValue([]);
  vi.mocked(estadoDaFilaDeDuplicados).mockResolvedValue({
    calculado_em: null,
    desatualizado: true,
  });

  render(<FilaDeDuplicados />);

  expect(await screen.findByText(/ainda não foi pareada/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: /Possíveis duplicados \(0\)/ })).toBeNull();
  expect(screen.getByRole('button', { name: /Possíveis duplicados/ })).toBeTruthy();
  //: NADA PARA BUSCAR: o campo de busca num vazio é convite a digitar onde não
  //: há o que achar.
  expect(screen.queryByPlaceholderText('Parte do nome')).toBeNull();
});

it('a fila PAREADA E VELHA avisa, mesmo com par na tela', async () => {
  /** A RESSALVA NÃO É SÓ DO VAZIO. O recálculo não está em todo escritor: a
   *  subida de planilha que cria cadastro o dispara, cadastrar pela tela não.
   *  Quem acabou de cadastrar o mesmo veículo duas vezes e abre a fila veria uma
   *  lista que não tem o par dele — e concluiria que o painel não achou.
   *
   *  O BACK COMPARA UMA IMPRESSÃO do cadastro ativo com a do pareamento, então
   *  escritor novo entra na conta sozinho, sem gancho que o próximo esqueça.
   *
   *  E O NÚMERO FICA: há um par real para decidir, e `(1)` é verdade sobre ele. */
  vi.mocked(estadoDaFilaDeDuplicados).mockResolvedValue({
    calculado_em: new Date().toISOString(),
    desatualizado: true,
  });

  render(<FilaDeDuplicados />);

  expect(await screen.findByText(/O cadastro mudou depois do último pareamento/))
    .toBeTruthy();
  //: "hoje", e não a data: a pergunta é "está velho?".
  expect(screen.getByText(/\(hoje\)/)).toBeTruthy();
  expect(screen.getByRole('button', { name: /Possíveis duplicados \(1\)/ })).toBeTruthy();
  expect(screen.getByText('valoreconomico')).toBeTruthy();
});

it('o cadastro que muda com a tela ABERTA atualiza o aviso, e SO o aviso', async () => {
  /** ACHADO DA REVISÃO DO CODEX, e procedente. `CadastroDeInstituicoes` desenha o
   *  formulário de cadastro e esta fila na MESMA página: criar um veículo ali
   *  deixava o aviso velho até a próxima montagem — justamente o caso que
   *  `desatualizado` existe para pegar.
   *
   *  SÓ O ESTADO, E NUNCA A LISTA: reler a lista ressuscitaria o par que esta
   *  pessoa acabou de decidir, que é o motivo de a releitura por decisão ter
   *  saído desta tela.
   *
   *  PELO BARRAMENTO, e não por um `fundirCadastro` dublado: é o cliente da API
   *  que avisa `catalogoMudou` em toda escrita de catálogo, e com ele dublado
   *  nenhum aviso sai. Avisar à mão é o que exercita o ouvinte. */
  render(<FilaDeDuplicados />);
  await screen.findByText('valoreconomico');
  expect(estadoDaFilaDeDuplicados).toHaveBeenCalledTimes(1);

  vi.mocked(estadoDaFilaDeDuplicados).mockResolvedValue({
    calculado_em: new Date().toISOString(),
    desatualizado: true,
  });
  act(() => catalogoMudou.avisar());

  expect(await screen.findByText(/O cadastro mudou depois do último pareamento/))
    .toBeTruthy();
  expect(estadoDaFilaDeDuplicados).toHaveBeenCalledTimes(2);
  //: A LISTA NÃO FOI RELIDA, e o par decidido não voltaria se tivesse sido.
  expect(duplicadosDeCadastro).toHaveBeenCalledTimes(1);
});

it('a leitura ANTIGA do estado que volta depois NAO sobrescreve a nova', async () => {
  /** A GUARDA DE ORDEM, que esta tela já teve e perdeu quando a releitura por
   *  decisão saiu. Ela voltou com a assinatura do catálogo, e sem teste era
   *  código que eu afirmava funcionar sem prova.
   *
   *  O CENÁRIO É O REAL, e não hipótese: a leitura da ABERTURA é a que mais
   *  demora (vai à rede junto com a lista), e uma mudança de catálogo logo depois
   *  dispara a segunda. Se a primeira voltar por último, a tela volta a dizer "em
   *  dia" sobre um cadastro que acabou de mudar — o aviso desaparece sozinho. */
  let responderAPrimeira!: (estado: EstadoDaFilaDeDuplicados) => void;
  vi.mocked(estadoDaFilaDeDuplicados).mockReturnValueOnce(
    new Promise((resolver) => {
      responderAPrimeira = resolver;
    }),
  );
  //: A SEGUNDA (a do barramento) responde na hora, e diz que o cadastro mudou.
  vi.mocked(estadoDaFilaDeDuplicados).mockResolvedValue({
    calculado_em: new Date().toISOString(),
    desatualizado: true,
  });

  render(<FilaDeDuplicados />);
  act(() => catalogoMudou.avisar());
  await waitFor(() => expect(estadoDaFilaDeDuplicados).toHaveBeenCalledTimes(2));

  //: E SÓ AGORA a da abertura volta, dizendo "em dia" — a resposta velha.
  await act(async () => {
    responderAPrimeira({ calculado_em: new Date().toISOString(), desatualizado: false });
  });

  expect(await screen.findByText(/O cadastro mudou depois do último pareamento/))
    .toBeTruthy();
});

it('decidir o ULTIMO par com busca digitada nao deixa frase orfa', async () => {
  //: `busca` É ESTADO DA TELA e sobrevive às decisões que esvaziam a fila. Com a
  //: seção passando a APARECER sem par nenhum (por causa do aviso), decidir o
  //: último par com algo digitado deixava um "Nenhum par com «valor»" sob o
  //: aviso — citando um termo cujo campo já não está na tela.
  vi.mocked(estadoDaFilaDeDuplicados).mockResolvedValue({
    calculado_em: new Date().toISOString(),
    desatualizado: true,
  });

  render(<FilaDeDuplicados />);
  await screen.findByText('valoreconomico');

  await userEvent.type(screen.getByPlaceholderText('Parte do nome'), 'valor');
  await userEvent.click(
    screen.getByRole('button', { name: 'valoreconomico não é Valor Econômico' }),
  );

  await waitFor(() => expect(screen.queryByText('valoreconomico')).toBeNull());
  expect(screen.queryByText(/Nenhum par com/)).toBeNull();
  //: E O AVISO CONTINUA: é a única coisa que a seção ainda tem a dizer.
  expect(screen.getByText(/O cadastro mudou depois do último pareamento/)).toBeTruthy();
});

it('o estado que FALHA nao derruba a fila, e nao passa por "em dia"', async () => {
  //: A FILA É O QUE IMPORTA: par para decidir vale mais que a ressalva sobre ele,
  //: então a falha do estado não pode levar a lista embora.
  //:
  //: MAS O SILÊNCIO DELE NÃO VIRA AFIRMAÇÃO: tratar "não respondeu" como "em dia"
  //: seria a tela afirmando o que ninguém conferiu.
  vi.mocked(estadoDaFilaDeDuplicados).mockRejectedValue(new Error('500'));

  render(<FilaDeDuplicados />);

  expect(await screen.findByText('valoreconomico')).toBeTruthy();
  expect(screen.getByText(/Não foi possível conferir quando esta fila foi pareada/))
    .toBeTruthy();
  //: E A FALHA DO ESTADO NÃO É UM ERRO DA TELA: ela não aparece como faixa de
  //: erro, porque a tela continua servindo para o que a pessoa veio fazer.
  expect(screen.queryByText(/500/)).toBeNull();
});


it('mostra os dois lados com as mencoes de cada um', async () => {
  render(<FilaDeDuplicados />);

  expect(await screen.findByText('valoreconomico')).toBeTruthy();
  expect(screen.getByText(/Perfil de rede · Imprensa · 11 menções/)).toBeTruthy();
  expect(screen.getByText('Valor Econômico')).toBeTruthy();
  //: 88 CONTRA 11 é o que diz qual é a linha com história.
  expect(screen.getByText(/Veículo de imprensa · 88 menções/)).toBeTruthy();
});

it('Fundir manda o PERFIL como quem sai', async () => {
  render(<FilaDeDuplicados />);
  const botao = await screen.findByRole('button', {
    name: 'Manter Valor Econômico e apagar valoreconomico',
  });

  await userEvent.click(botao);

  //: A ORDEM É A REGRA DE NEGÓCIO INTEIRA: trocada, o pedido apagaria o
  //: veículo curado dentro do handle do fornecedor. O servidor também recusa,
  //: mas a tela não deve nem pedir.
  //: E O TERCEIRO ARGUMENTO É `false`: este é o caminho PROPOSTO pelo servidor,
  //: e não a escolha contrária. Mandar `true` aqui desligaria a guarda que
  //: protege a linha curada em TODO clique — inclusive no que ninguém escolheu.
  await waitFor(() => expect(fundirCadastro).toHaveBeenCalledWith('p1', 'v1', false));
});

it('o OUTRO botao escolhe o cadastro CONTRARIO a proposta', async () => {
  /** O PEDIDO DO DONO DO PRODUTO: "não basta termos uma opção de dizer se são ou
   *  não o mesmo, além de mostrar quais podem se juntar temos que dizer qual é o
   *  real para ser considerado na unificação".
   *
   *  A TELA TINHA UM BOTÃO SÓ, e a direção vinha do servidor: sobrevive a linha
   *  com história. A proposta está certa quase sempre — e continua sendo a
   *  sugestão —, mas só quem conhece o ator sabe quando o cadastro certo é o
   *  outro.
   *
   *  TRÊS COISAS NUMA CHAMADA, e cada uma erraria sozinha: quem SAI é o
   *  candidato (`v1`), quem FICA é o perfil (`p1`), e o `true` diz ao servidor
   *  que a escolha é de propósito — sem ele a resposta é 422, porque é essa
   *  guarda que protege o clique errado. */
  render(<FilaDeDuplicados />);
  const botao = await screen.findByRole('button', {
    name: 'Manter valoreconomico e apagar Valor Econômico',
  });

  await userEvent.click(botao);

  await waitFor(() => expect(fundirCadastro).toHaveBeenCalledWith('v1', 'p1', true));
});

it('a linha diz DE ONDE vem cada lado', async () => {
  //: A EVIDÊNCIA DA DUPLICATA: "pode vir do crm, pode vir de mídias sociais,
  //: pode vir de mercado, pode ter várias fontes distintas, mas a instituição é
  //: a mesma". Dois nomes parecidos e duas contagens não dizem POR QUE existem
  //: dois cadastros; as origens dizem.
  //:
  //: E `sociedade` APARECE COMO "redes sociais": código de lente é vocabulário
  //: de dentro, e quem lê a fila pensa em rede social.
  render(<FilaDeDuplicados />);
  await screen.findByText('valoreconomico');

  expect(screen.getByText(/Perfil de rede · Imprensa · 11 menções · vem de redes sociais/))
    .toBeTruthy();
  expect(screen.getByText(/88 menções · vem de imprensa e mercado/)).toBeTruthy();
});

it('a BUSCA acha o par pelos DOIS lados, e nao so pela ancora', async () => {
  /** O PEDIDO: "deve uma barra de busca para facilitar buscar de instituições
   *  chave". Com 209 pares, chegar ao Valor Econômico pela paginação é folhear
   *  vinte páginas.
   *
   *  PELOS DOIS LADOS, e é o ponto do teste: a pergunta está ancorada no handle
   *  `valoreconomico`, e quem procura digita "Econômico" — o nome do veículo, que
   *  está no OUTRO lado do par. Uma busca que olhasse só a âncora não acharia
   *  nada, e a tela diria que a instituição-chave não tem duplicata. */
  vi.mocked(duplicadosDeCadastro).mockResolvedValue([
    ...UM_PAR,
    {
      id: 'p9',
      nome: 'gazeta_de_piracicaba',
      tipo: 'perfil_rede',
      cargo: null,
      origens: [],
      mencoes: 1,
      candidatos: [
        { id: 'v9', nome: 'Gazeta de Piracicaba', tipo: 'veiculo', mencoes: 7, origens: [] },
      ],
    },
  ]);
  render(<FilaDeDuplicados />);
  await screen.findByText('valoreconomico');

  await userEvent.type(screen.getByLabelText('Buscar'), 'Econômico');

  //: O par do Valor fica — achado pelo nome do CANDIDATO.
  expect(screen.getByText('valoreconomico')).toBeTruthy();
  //: E o outro sai da lista.
  expect(screen.queryByText('gazeta_de_piracicaba')).toBeNull();
  //: O TOTAL DA FILA CONTINUA NO TÍTULO: a busca filtra a lista, não resolve
  //: trabalho. Um título que caísse para (1) diria que só há um par a decidir.
  expect(screen.getByRole('button', { name: /Possíveis duplicados \(2\)/ })).toBeTruthy();
});

it('a BUSCA que nao acha nada DIZ isso', async () => {
  //: Sem esta linha o cartão fica com a barra de busca e um vazio embaixo, e
  //: quem digitou não sabe se errou o nome ou se não há par nenhum com ele.
  render(<FilaDeDuplicados />);
  await screen.findByText('valoreconomico');

  await userEvent.type(screen.getByLabelText('Buscar'), 'infomoney');

  expect(screen.getByText(/Nenhum par com «infomoney»/)).toBeTruthy();
});

it('Nao e o mesmo GRAVA a decisao, e nao funde', async () => {
  render(<FilaDeDuplicados />);
  const botao = await screen.findByRole('button', {
    name: 'valoreconomico não é Valor Econômico',
  });

  await userEvent.click(botao);

  await waitFor(() => expect(declararCadastroDistinto).toHaveBeenCalledWith('p1', 'v1'));
  expect(fundirCadastro).not.toHaveBeenCalled();
});

it('depois de responder, a fila NAO e relida', async () => {
  //: ESTE TESTE INVERTEU, e a inversão é o pedido do dono do produto: "realmente
  //: tem que fazer a busca sempre? não basta fazer uma vez quando expandi a tela
  //: e depois só atualizar a lista?".
  //:
  //: NÃO PRECISA. O efeito de cada decisão é local e determinado, então a lista
  //: nova sai de `semOCadastro`/`semOPar` e o servidor devolveria a mesma coisa.
  //: O que fechou a questão na época foi o CUSTO — 7,4 s por decisão, com 209
  //: pares a decidir, recalculando ~3.962 cadastros par a par com `difflib` —, e
  //: a `0118` tirou esse custo da rota. O que dispensa a releitura hoje é o
  //: RESULTADO, e é isto que este teste prende.
  //:
  //: A VERSÃO ANTERIOR DESTE TESTE exigia a segunda chamada. Ela estava certa
  //: para o desenho de ontem e virou o oposto do que se quer: cada chamada aqui é
  //: trabalho que ninguém pediu.
  render(<FilaDeDuplicados />);
  const botao = await screen.findByRole('button', {
    name: 'valoreconomico não é Valor Econômico',
  });
  expect(duplicadosDeCadastro).toHaveBeenCalledTimes(1);

  await userEvent.click(botao);

  await waitFor(() => expect(declararCadastroDistinto).toHaveBeenCalled());
  //: A LINHA SAIU (medido em "a linha SAI NA HORA") e a busca NÃO rodou de novo.
  expect(duplicadosDeCadastro).toHaveBeenCalledTimes(1);
});

it('a falha de carga NAO derruba a tela, e nao rende duas faixas', async () => {
  vi.mocked(duplicadosDeCadastro).mockRejectedValue(new Error('403 sem permissão'));

  render(<FilaDeDuplicados />);

  //: A fila é acessória: o cadastro inteiro não pode cair com ela.
  expect(await screen.findByText(/403 sem permissão/)).toBeTruthy();
  //: E O ERRO DA LISTA JÁ EXPLICA O VAZIO: somar a ressalva do pareamento seria
  //: uma segunda faixa sobre a mesma falha, que não acrescenta nada a quem
  //: acabou de ler "403 sem permissão".
  expect(screen.queryByText(/pareamento|pareada/)).toBeNull();
});

it('o tipo de quem vai sair vem do SERVIDOR, e nao fixo em perfil de rede', async () => {
  //: O DEFEITO QUE ISTO PRENDE. A linha escrevia `ROTULO_DO_TIPO.perfil_rede`
  //: fixo — verdade enquanto a fila só perguntava sobre perfis de rede. Deixou
  //: de ser em 11/10/2026, quando a fila passou a olhar qualquer tipo: dos 4
  //: pares que restam na base real, TODOS são instituições feitas à mão no CRM,
  //: e apareciam rotuladas "Perfil de rede".
  //:
  //: E O ROTULO ERRADO AQUI É CARO: quem lê a linha está decidindo se APAGA um
  //: dos dois cadastros. "Perfil de rede" sugere um registro automático de
  //: fornecedor, descartável; "Órgão público" é uma linha que alguém curou.
  vi.mocked(duplicadosDeCadastro).mockResolvedValue([
    {
      id: 'o1',
      nome: 'Prefeitura de Campinas',
      tipo: 'orgao',
      cargo: null,
      origens: [],
      mencoes: 2,
      candidatos: [
        {
          id: 'o2',
          nome: 'Prefeitura Municipal de Campinas',
          tipo: 'orgao',
          mencoes: 9,
          origens: [],
        },
      ],
    },
  ]);

  render(<FilaDeDuplicados />);

  expect(await screen.findByText('Prefeitura de Campinas')).toBeTruthy();
  expect(screen.getByText(/Órgão público · 2 menções/)).toBeTruthy();
  expect(screen.queryByText(/Perfil de rede/)).toBeNull();
});

it('a fila de duplicados PAGINA em 10', async () => {
  //: PEDIDO DO DONO DO PRODUTO: 10 por página nos três blocos.
  //:
  //: ESTA FILA NÃO PAGINAVA, e com 210 pares medidos na base real ela desenhava
  //: os 210 de uma vez — cada um com o seu bloco de candidatos e dois botões.
  vi.mocked(duplicadosDeCadastro).mockResolvedValue(
    Array.from({ length: 12 }, (_, n) => ({
      id: `p${n}`,
      nome: `perfil${String(n).padStart(2, '0')}`,
      tipo: 'perfil_rede',
      cargo: null,
      origens: [],
      mencoes: 2,
      candidatos: [
        { id: `v${n}`, nome: `Veiculo ${n}`, tipo: 'veiculo', mencoes: 9, origens: [] },
      ],
    })),
  );

  render(<FilaDeDuplicados />);
  expect(await screen.findByText('perfil00')).toBeTruthy();

  expect(screen.getByText('perfil09')).toBeTruthy();
  expect(screen.queryByText('perfil10')).toBeNull();
  expect(screen.getByText(/Página 1 de 2 — 12 pares a decidir/)).toBeTruthy();

  await userEvent.click(screen.getByRole('button', { name: /Última/ }));
  expect(screen.getByText('perfil11')).toBeTruthy();
  expect(screen.queryByText('perfil00')).toBeNull();
});

it('o TOTAL fica no titulo, e e ele que diz se o trabalho anda', async () => {
  //: A fila encurta a cada decisão. Com a contagem só no rodapé da página, a
  //: pessoa veria "10 de 10" para sempre enquanto resolve os 210.
  vi.mocked(duplicadosDeCadastro).mockResolvedValue(
    Array.from({ length: 12 }, (_, n) => ({
      id: `p${n}`,
      nome: `perfil${n}`,
      tipo: 'perfil_rede',
      cargo: null,
      origens: [],
      mencoes: 2,
      candidatos: [
        { id: `v${n}`, nome: `V ${n}`, tipo: 'veiculo', mencoes: 9, origens: [] },
      ],
    })),
  );

  render(<FilaDeDuplicados />);
  await screen.findByText('perfil0');

  expect(screen.getByRole('button', { name: /Possíveis duplicados \(12\)/ })).toBeTruthy();
});

it('a linha SAI NA HORA, sem esperar a releitura', async () => {
  //: O DEFEITO QUE ISTO PRENDE, relatado pelo dono do produto (12/10/2026): "ao
  //: clicar em fundir ou não é o mesmo, demora a atualizar, parece que nada foi
  //: feito".
  //:
  //: MEDIDO: `GET /api/instituicoes/duplicados` levava 7,4 s na base real — a
  //: fila era recalculada comparando ~3.962 cadastros par a par com `difflib`. A
  //: tela pagava isso A CADA decisão, e durante os 7,4 s a linha ficava ali, com
  //: os botões reativados, idêntica ao que era antes do clique. (A rota ficou
  //: barata com a `0118`, e a tela segue não relendo — por outra razão: o efeito
  //: de cada resposta é local e determinado.)
  //:
  //: POR QUE O TESTE ANTIGO NÃO PEGAVA: ele devolvia `[]` num mock que resolve no
  //: mesmo tick, então provava "a linha sai depois da releitura" — que é verdade
  //: e não é a pergunta. Aqui a releitura NUNCA resolve, que é o que mede o que a
  //: pessoa vê enquanto o servidor recalcula.
  render(<FilaDeDuplicados />);
  const botao = await screen.findByRole('button', {
    name: 'valoreconomico não é Valor Econômico',
  });

  vi.mocked(duplicadosDeCadastro).mockReturnValue(new Promise(() => {}));

  await userEvent.click(botao);

  await waitFor(() => expect(screen.queryByText('valoreconomico')).toBeNull());
});

it('a CONTAGEM do titulo cai na hora, junto com a linha', async () => {
  //: O NÚMERO É O QUE DIZ SE O TRABALHO ESTÁ ANDANDO — está no título por isso.
  //: Um título que continua "(2)" depois de uma decisão desmente a tela.
  vi.mocked(duplicadosDeCadastro).mockResolvedValue([
    ...UM_PAR,
    {
      id: 'p2',
      nome: 'outro handle',
      tipo: 'perfil_rede',
      cargo: null,
      origens: [],
      mencoes: 1,
      candidatos: [
        { id: 'v2', nome: 'Outro Veículo', tipo: 'veiculo', mencoes: 40, origens: [] },
      ],
    },
  ]);

  render(<FilaDeDuplicados />);
  const botao = await screen.findByRole('button', {
    name: 'valoreconomico não é Valor Econômico',
  });
  expect(screen.getByRole('button', { name: /Possíveis duplicados \(2\)/ })).toBeTruthy();

  vi.mocked(duplicadosDeCadastro).mockReturnValue(new Promise(() => {}));
  await userEvent.click(botao);

  await waitFor(() =>
    expect(screen.getByRole('button', { name: /Possíveis duplicados \(1\)/ })).toBeTruthy(),
  );
});

it('FUNDIR tira TODAS as perguntas sobre o cadastro que saiu', async () => {
  //: FUNDIR NÃO TIRA UM PAR, TIRA UM CADASTRO. O perfil fundido deixa de existir,
  //: então toda pergunta que o menciona — como quem sai OU como candidato — morre
  //: com ele. Sem isto, a tela ofereceria fundir de novo algo que já não está no
  //: banco, e o segundo clique viria 404.
  //:
  //: MEDIDO NA BASE REAL: `bmc.news` casa com DOIS veículos, então pergunta
  //: repetida sobre o mesmo cadastro não é hipótese.
  vi.mocked(duplicadosDeCadastro).mockResolvedValue([
    {
      id: 'p1',
      nome: 'bmc.news',
      tipo: 'perfil_rede',
      cargo: null,
      origens: [],
      mencoes: 3,
      candidatos: [
        { id: 'v1', nome: 'BMC News', tipo: 'veiculo', mencoes: 50, origens: [] },
        { id: 'v9', nome: 'BMC Notícias', tipo: 'veiculo', mencoes: 20, origens: [] },
      ],
    },
    {
      id: 'p3',
      nome: 'bmcnews',
      tipo: 'perfil_rede',
      cargo: null,
      origens: [],
      mencoes: 1,
      //: O MESMO `v1` aparece aqui como candidato. Fundir `bmc.news` em `v1` NÃO
      //: apaga `v1` — ele é o sobrevivente —, então esta pergunta FICA.
      candidatos: [
        { id: 'v1', nome: 'BMC News', tipo: 'veiculo', mencoes: 50, origens: [] },
      ],
    },
  ]);

  render(<FilaDeDuplicados />);
  const botao = await screen.findByRole('button', {
    name: 'Manter BMC News e apagar bmc.news',
  });

  vi.mocked(duplicadosDeCadastro).mockReturnValue(new Promise(() => {}));
  await userEvent.click(botao);

  //: QUEM SAIU: `bmc.news`, e com ele a segunda pergunta dele (sobre `v9`).
  await waitFor(() => expect(screen.queryByText('bmc.news')).toBeNull());
  expect(screen.queryByText('BMC Notícias')).toBeNull();
  //: QUEM FICOU: o sobrevivente continua sendo candidato de outra pergunta.
  expect(screen.getByText('bmcnews')).toBeTruthy();
});

it('a mesma PERGUNTA nao aceita duas decisoes em voo', async () => {
  //: ACHADO MÉDIA DE REVISÃO. A trava era do PAR, então uma pergunta com dois
  //: candidatos deixava o segundo botão clicável durante a primeira decisão —
  //: e, numa fusão, o segundo pedido fala de um cadastro que está saindo.
  vi.mocked(duplicadosDeCadastro).mockResolvedValue([
    {
      id: 'p1',
      nome: 'bmc.news',
      tipo: 'perfil_rede',
      cargo: null,
      origens: [],
      mencoes: 3,
      candidatos: [
        { id: 'v1', nome: 'BMC News', tipo: 'veiculo', mencoes: 50, origens: [] },
        { id: 'v9', nome: 'BMC Notícias', tipo: 'veiculo', mencoes: 20, origens: [] },
      ],
    },
  ]);
  //: A fusão fica EM VOO: é durante ela que o segundo botão tem de estar travado.
  vi.mocked(fundirCadastro).mockReturnValue(new Promise(() => {}));

  render(<FilaDeDuplicados />);
  const primeiro = await screen.findByRole('button', {
    name: 'Manter BMC News e apagar bmc.news',
  });

  await userEvent.click(primeiro);

  await waitFor(() =>
    expect(
      screen
        .getByRole('button', { name: 'Manter BMC Notícias e apagar bmc.news' })
        .hasAttribute('disabled'),
    ).toBe(true),
  );
  expect(
    screen.getByRole('button', { name: 'bmc.news não é BMC Notícias' }).hasAttribute('disabled'),
  ).toBe(true);
});

it('FUNDIR passa as mencoes ao sobrevivente, onde ele aparecer', async () => {
  //: O NÚMERO É LOAD-BEARING NESTA TELA: "é ele que diz qual é a linha com
  //: história, e é sempre a linha com história que sobrevive". Sem releitura,
  //: quem tem de passar as menções é o efeito local — e deixá-las velhas numa
  //: outra pergunta sobre o MESMO sobrevivente faria a decisão seguinte ser
  //: tomada com o número errado. A fusão não tem volta.
  vi.mocked(duplicadosDeCadastro).mockResolvedValue([
    {
      id: 'p1',
      nome: 'bmc.news',
      tipo: 'perfil_rede',
      cargo: null,
      origens: [],
      mencoes: 3,
      candidatos: [
        { id: 'v1', nome: 'BMC News', tipo: 'veiculo', mencoes: 50, origens: [] },
      ],
    },
    {
      id: 'p3',
      nome: 'bmcnews',
      tipo: 'perfil_rede',
      cargo: null,
      origens: [],
      mencoes: 1,
      //: O MESMO sobrevivente, em outra pergunta.
      candidatos: [
        { id: 'v1', nome: 'BMC News', tipo: 'veiculo', mencoes: 50, origens: [] },
      ],
    },
  ]);

  render(<FilaDeDuplicados />);
  const botao = await screen.findByRole('button', {
    name: 'Manter BMC News e apagar bmc.news',
  });

  await userEvent.click(botao);

  //: 50 + as 3 de quem saiu.
  await waitFor(() =>
    expect(screen.getByText(/Veículo de imprensa · 53 menções/)).toBeTruthy(),
  );
  expect(screen.queryByText(/50 menções/)).toBeNull();
});

it('AS ORIGENS tambem passam ao sobrevivente', async () => {
  /** ACHADO MÉDIA DE REVISÃO, e é a mesma família do número de menções velho: a
   *  tela somava a contagem e deixava as ORIGENS antigas. Fundir um cadastro que
   *  "vem de imprensa" dentro de um que "vem de CRM" deixava a linha dizendo só
   *  CRM — com a contagem dos dois. Uma afirmação falsa até a próxima recarga, e
   *  justamente sobre o dado que explica a duplicata. */
  vi.mocked(duplicadosDeCadastro).mockResolvedValue([
    {
      id: 'p1',
      nome: 'bmc.news',
      tipo: 'perfil_rede',
      cargo: null,
      origens: ['sociedade'],
      mencoes: 3,
      candidatos: [
        { id: 'v1', nome: 'BMC News', tipo: 'veiculo', mencoes: 50, origens: ['crm'] },
      ],
    },
    {
      id: 'p3',
      nome: 'bmcnews',
      tipo: 'perfil_rede',
      cargo: null,
      origens: [],
      mencoes: 1,
      //: O MESMO sobrevivente, em outra pergunta — é lá que a linha dele
      //: continua desenhada depois da fusão.
      candidatos: [
        { id: 'v1', nome: 'BMC News', tipo: 'veiculo', mencoes: 50, origens: ['crm'] },
      ],
    },
  ]);

  render(<FilaDeDuplicados />);
  await userEvent.click(
    await screen.findByRole('button', { name: 'Manter BMC News e apagar bmc.news' }),
  );

  //: AS DUAS ORIGENS, em ordem, e com a contagem somada na mesma linha.
  await waitFor(() =>
    expect(
      screen.getByText(/53 menções · vem de CRM e redes sociais/),
    ).toBeTruthy(),
  );
});
