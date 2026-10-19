/** Quando o catálogo muda, quem depende dele fica sabendo.
 *
 *  O CATÁLOGO alimenta o resto da plataforma: os temas, as instituições, os
 *  interlocutores, as pessoas da Aegea e as referências da biblioteca são as
 *  opções de todo formulário, todo filtro e toda ficha. Um cadastro feito na
 *  Administração que não chega a essas telas é um cadastro que parece não ter
 *  acontecido — e a pessoa cadastra de novo.
 *
 *  A GARANTIA MORA NA ROTA, e não em cada tela. Pedir a cada tela de cadastro
 *  que lembre de recarregar depois de salvar é convenção, e convenção falha
 *  em silêncio: basta uma tela nova. Aqui a regra é uma só — escrita
 *  bem-sucedida numa rota de catálogo avisa — e vale para função de escrita
 *  que ainda não existe.
 *
 *  E A GARANTIA ATRAVESSA ABAS. O aviso é memória deste bundle — só a aba que
 *  escreveu o ouviria. Uma agenda aberta numa aba enquanto a Administração
 *  cadastra noutra é o uso mais comum de quem cadastra, e é por isso que o
 *  sincronizador repassa cada aviso por um `BroadcastChannel`, e trata o que
 *  chega de outra aba como aviso próprio.
 *
 *  Sem React e sem `fetch`: é o que permite testar a regra e o aviso sem
 *  montar tela nenhuma. O canal entra por parâmetro, pelo mesmo motivo.
 */

/** As rotas cujas escritas mudam o catálogo. Prefixo de CAMINHO, com barra ou
 *  fim de string depois: `/api/temas` casa `/api/temas` e `/api/temas/3`, e não
 *  casa uma hipotética `/api/temas-arquivados`. */
export const ROTAS_DO_CATALOGO = [
  '/api/temas',
  // Os dicionários: quem acrescenta uma esfera ou desativa um formato na
  // Administração precisa vê-lo (ou não) no filtro e no formulário sem F5.
  '/api/dicionarios',
  '/api/instituicoes',
  '/api/interlocutores',
  '/api/pessoas-aegea',
  '/api/referencias',
  '/api/alegacoes',
  // A CONFIRMAÇÃO DA PLANILHA DE SUBTEMAS, e é o MESMO defeito da confirmação
  // da importação de agendas, numa segunda rota — achado de revisão com
  // severidade ALTA.
  //
  // Ela "aplica o que foi conferido", diz o próprio comentário do cliente: cria
  // e altera TEMAS. Sem este aviso, quem sobe a planilha de subtemas vê a aba
  // Temas, todo filtro por tema e todo formulário que oferece tema seguirem os
  // de antes até um F5.
  //
  // CAMINHO EXATO, e não o prefixo `/api/taxonomia`: a irmã dela,
  // `/api/taxonomia/subtemas/conferencia`, NÃO grava nada — "NADA É GRAVADO",
  // diz o cliente — e um prefixo faria cada conferência recarregar o catálogo
  // inteiro para não mudar coisa nenhuma. O casamento da lista é por igualdade
  // ou por `rota + '/'`, então este caminho pega só a confirmação.
  '/api/taxonomia/subtemas/confirmacao',
  // UMA ROTA DA FILA DE REVISÃO, e SÓ ela: enquadrar um lote grava a categoria
  // de público e DERIVA O TIPO da instituição — e o tipo é o que
  // `derivar_frente` usa para dizer de que frente é cada agenda dela. Um lote de
  // 499 reclassifica as agendas de todas, e sem esta linha a Base e os filtros
  // mostrariam a classificação antiga até um F5.
  //
  // E A IRMÃ DELA NÃO ESTÁ AQUI, de propósito:
  // `/api/revisao-de-cadastros/{tipo}/{id}/consolidacao` não muda nada que o
  // catálogo sirva — `pendente_de_revisao` e `motivo_da_revisao` estão em
  // `COLUNAS_DE_CONTROLE` e nunca saem em `/api/dicionarios`. O casamento é por
  // prefixo COM fronteira, então o caminho abaixo pega só o enquadramento.
  '/api/revisao-de-cadastros/instituicoes/enquadramento',
  // UMA ROTA DO SCORE NA LISTA DO CATÁLOGO, e não é engano: definir quais
  // veículos a lente Mercado considera escreve em `instituicao` — a mesma
  // tabela que o Cadastro compartilhado edita. A regra aqui é "a escrita muda
  // o catálogo?", e não "o endereço começa com o nome de um cadastro". Sem
  // esta linha, marcar um veículo na aba Base não chegaria ao Cadastro
  // compartilhado nem aos filtros até um F5.
  '/api/score/veiculos-de-investidores',
] as const;

/** As rotas cujas escritas criam ou alteram AGENDAS.
 *
 *  SEPARADAS DAS DO CATÁLOGO de propósito, e é o mesmo motivo de o estado do painel
 *  ter duas versões: um barramento só faria cada tema cadastrado rebuscar a base
 *  inteira, e cada agenda salva rebuscar todos os dicionários.
 *
 *  A CONFIRMAÇÃO DA IMPORTAÇÃO É O CASO DIFÍCIL, e está aqui porque é o único passo
 *  daquele fluxo que cria agenda — o upload propõe, a conferência decide, e só a
 *  confirmação grava. Ela não é um prefixo: o id fica no MEIO do endereço. */
const METODOS_QUE_LEEM = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Prefixos de caminho cujas escritas mudam as agendas. */
export const ROTAS_DE_AGENDAS = ['/api/interacoes'] as const;

/** É a confirmação de uma importação de agendas?
 *
 *  NÃO É UM PREFIXO, e por isso tem função própria: o id fica no MEIO do
 *  endereço (`/api/importacoes/<uuid>/confirmacao`).
 *
 *  E ELA RESPONDE AOS DOIS BARRAMENTOS, que é o conserto de um defeito: a
 *  confirmação é o único passo daquele fluxo que GRAVA, e grava as duas coisas
 *  — as agendas E os cadastros que elas precisavam. Medido com a planilha real
 *  de RI: 304 agendas e 502 cadastros numa confirmação. */
const CONFIRMACAO_DE_IMPORTACAO = /^\/api\/importacoes\/[^/]+\/confirmacao$/;

function eAConfirmacaoDeImportacao(caminho: string): boolean {
  //: A REGEX, E NÃO `startsWith` + `endsWith`.
  //:
  //: ACHADO DE REVISÃO: o par de testes de borda aceitava
  //: `/api/importacoes/abc/outra-coisa/confirmacao` — qualquer profundidade
  //: entre o id e a palavra. Não há subrota dessas hoje, e é justamente por
  //: isso que vale apertar agora: o aviso falso que isso daria amanhã
  //: recarregaria o catálogo inteiro por uma rota que ninguém examinou.
  //:
  //: E A ASSERÇÃO DO TESTE JÁ USAVA ESTA REGEX. Implementação mais larga que o
  //: teste é uma diferença que ninguém vê até ela importar.
  return CONFIRMACAO_DE_IMPORTACAO.test(caminho);
}

/** Esta requisição, se der certo, muda alguma agenda? */
export function escreveAgendas(metodo: string, caminho: string): boolean {
  if (METODOS_QUE_LEEM.has(metodo.toUpperCase())) return false;
  const soOCaminho = caminho.split('?')[0];
  if (eAConfirmacaoDeImportacao(soOCaminho)) return true;
  return ROTAS_DE_AGENDAS.some(
    (rota) => soOCaminho === rota || soOCaminho.startsWith(`${rota}/`),
  );
}

/** Esta requisição, se der certo, muda o catálogo? */
export function escreveNoCatalogo(metodo: string, caminho: string): boolean {
  if (METODOS_QUE_LEEM.has(metodo.toUpperCase())) return false;
  const soOCaminho = caminho.split('?')[0];
  //: A CONFIRMAÇÃO DA IMPORTAÇÃO MUDA O CATÁLOGO TAMBÉM, e ela estava só na
  //: lista das agendas.
  //:
  //: O DEFEITO QUE ISTO CONSERTA: a confirmação cria instituição, contato, tema
  //: e pessoa da Aegea — medido com a planilha real de RI, 304 agendas e 502
  //: CADASTROS numa chamada. Sem este aviso, nada disso chegava ao catálogo: a
  //: lista do Cadastro compartilhado, as opções de todo filtro e de todo
  //: formulário seguiam as de antes até alguém apertar F5. E a agenda recém
  //: criada aponta para uma instituição que o catálogo não conhece, que é a
  //: mesma classe de problema dos `temas_inativos` — dois lados discordando
  //: sobre o mesmo dado.
  //:
  //: E A REGRA DESTE MÓDULO JÁ DIZIA QUE ERA AQUI: "a regra aqui é 'a escrita
  //: muda o catálogo?', e não 'o endereço começa com o nome de um cadastro'" —
  //: escrito para justificar a rota do Score na lista, e vale igual para esta.
  if (eAConfirmacaoDeImportacao(soOCaminho)) return true;
  return ROTAS_DO_CATALOGO.some(
    (rota) => soOCaminho === rota || soOCaminho.startsWith(`${rota}/`),
  );
}

type Ouvinte = () => void;

/** O que este módulo usa de um `BroadcastChannel` — e o que um dublê precisa
 *  oferecer. */
export interface CanalEntreAbas {
  postMessage(mensagem: unknown): void;
  onmessage: ((evento: MessageEvent) => void) | null;
}

/** A única mensagem que atravessa o canal. */
export const MENSAGEM_DO_CATALOGO = 'catalogo-mudou';

/** Um aviso de "o catálogo mudou", para quem quiser escutar — nesta aba e,
 *  havendo canal, nas outras. */
export class Sincronizador {
  private readonly ouvintes = new Set<Ouvinte>();
  private readonly canal: CanalEntreAbas | null;
  private readonly mensagem: string;

  /** O que roda ANTES dos ouvintes, em TODO aviso de TODO sincronizador.
   *
   *  POR QUE ESTÁTICO E POR QUE ANTES. O cliente da API guarda o que já buscou
   *  (ver `limparCacheDaApi`), e um aviso que chega de OUTRA ABA faz esta
   *  recarregar — mas a recarga passa pelo mesmo cliente, que devolveria o valor
   *  guardado. Resultado, achado ALTA de revisão: a outra aba salva, esta
   *  "recarrega" e lê dado velho por até o prazo inteiro.
   *
   *  Assinar como ouvinte comum não resolveria: `espalhar` chama na ordem de
   *  inscrição, e o ouvinte da tela pode vir antes — ele leria o guardado antes
   *  de alguém o esquecer. Esquecer ANTES de espalhar é o que torna a ordem
   *  irrelevante.
   *
   *  Estático porque são três sincronizadores (catálogo, agendas, score) e o
   *  cliente precisa cobrir os três com uma inscrição só. */
  private static readonly antesDosOuvintes = new Set<Ouvinte>();

  /** Registra um gesto para rodar antes dos ouvintes de qualquer aviso. */
  static antesDeEspalhar(gesto: Ouvinte): () => void {
    Sincronizador.antesDosOuvintes.add(gesto);
    return () => {
      Sincronizador.antesDosOuvintes.delete(gesto);
    };
  }

  constructor(canal: CanalEntreAbas | null = null, mensagem: string = MENSAGEM_DO_CATALOGO) {
    this.canal = canal;
    this.mensagem = mensagem;
    if (canal) {
      // O que vem de outra aba é aviso, e não é repassado: repassar faria as
      // abas trocarem o mesmo aviso para sempre.
      canal.onmessage = (evento) => {
        if (evento.data === this.mensagem) this.espalhar();
      };
    }
  }

  /** Assina. Devolve o gesto que cancela — pensado para o `useEffect`. */
  assinar(ouvinte: Ouvinte): () => void {
    this.ouvintes.add(ouvinte);
    return () => {
      this.ouvintes.delete(ouvinte);
    };
  }

  /** Mudou aqui: avisa esta aba e as outras. */
  avisar(): void {
    this.espalhar();
    this.canal?.postMessage(this.mensagem);
  }

  private espalhar(): void {
    for (const gesto of Sincronizador.antesDosOuvintes) gesto();
    for (const ouvinte of this.ouvintes) ouvinte();
  }
}

/** O canal do navegador, quando existe. Fora dele (testes, SSR) não há outra
 *  aba para avisar. */
function canalDoNavegador(nome: string): CanalEntreAbas | null {
  if (typeof window === 'undefined' || typeof window.BroadcastChannel !== 'function') return null;
  return new window.BroadcastChannel(`painel-reputacional:${nome}`);
}

/** O único sincronizador da aplicação: o cliente da API avisa aqui, e o
 *  estado do painel escuta aqui. */
export const catalogoMudou = new Sincronizador(canalDoNavegador('catalogo'));

/** A mensagem do canal das agendas. */
export const MENSAGEM_DAS_AGENDAS = 'agendas-mudaram';

/** Alguma agenda foi criada ou alterada — nesta aba ou em outra.
 *
 *  ATRAVESSA AS ABAS como o do catálogo: quem confirma uma importação numa aba e
 *  tem a Base aberta em outra vê as 54 agendas aparecerem lá também. Sem isto a
 *  segunda aba mostra a lista de antes até um F5 — e ela não tem como saber que
 *  está velha. */
export const agendasMudaram = new Sincronizador(
  canalDoNavegador('agendas'),
  MENSAGEM_DAS_AGENDAS,
);

/** As rotas cujas escritas mudam os NÚMEROS DO SCORE: a planilha do mês, a
 *  calibração (régua de tier, pesos), os veículos do Mercado, os fatos.
 *
 *  O PREFIXO INTEIRO, e não rota por rota: quem lê o Score (hoje, o cache da
 *  Consulta em profundidade) não sabe qual escrita mexe em qual número, e
 *  rebuscar uma árvore a mais custa muito menos que mostrar a árvore velha
 *  ao lado de uma Jornada já atualizada. */
export const ROTAS_DO_SCORE = ['/api/score'] as const;

/** Esta requisição, se der certo, muda algum número do Score? */
export function escreveNoScore(metodo: string, caminho: string): boolean {
  if (METODOS_QUE_LEEM.has(metodo.toUpperCase())) return false;
  const soOCaminho = caminho.split('?')[0];
  return ROTAS_DO_SCORE.some(
    (rota) => soOCaminho === rota || soOCaminho.startsWith(`${rota}/`),
  );
}

/** A mensagem do canal do Score. */
export const MENSAGEM_DO_SCORE = 'score-mudou';

/** Os dados do Score mudaram (planilha, calibração…) — nesta aba ou em outra.
 *
 *  O CACHE DA CONSULTA EM PROFUNDIDADE escuta aqui: sem o aviso, subir a
 *  planilha do mês na aba Base deixava o drill mostrando a árvore antiga a
 *  sessão inteira, enquanto a Jornada logo acima já mostrava a nota nova. */
export const scoreMudou = new Sincronizador(canalDoNavegador('score'), MENSAGEM_DO_SCORE);


/** As rotas cujas escritas mudam os NÚMEROS DO PAINEL DE MERCADO: hoje, a
 *  subida da planilha de cotação de bonds.
 *
 *  BARRAMENTO PRÓPRIO, e não o do Score — ainda que a tela de mercado leia o
 *  índice do Score. Um barramento só faria toda subida de planilha de
 *  fornecedor rebuscar a série de bonds, e toda subida de bonds rebuscar a
 *  árvore da Consulta em profundidade. É a mesma razão pela qual catálogo e
 *  agendas são dois: "cadastrar um tema não precisa rebuscar a base, e
 *  confirmar uma importação não precisa rebuscar os dicionários".
 *
 *  O ÍNDICE MUDAR NÃO AVISA AQUI, e é uma lacuna conhecida: subir a planilha do
 *  Score muda a linha do eixo direito do gráfico de bonds, e quem estiver com a
 *  tela de mercado aberta só vê isso ao voltar nela. O caminho honesto seria a
 *  tela de mercado assinar os DOIS barramentos; fica registrado em vez de
 *  resolvido porque as duas telas não se usam ao mesmo tempo hoje, e assinar
 *  dois sem necessidade é o defeito que `nucleo.ts` já descreve em
 *  `useConsultaDaLente` (dispara duas buscas e descarta a primeira). */
export const ROTAS_DO_MERCADO = ['/api/mercado'] as const;

/** Os POSTs sob `/api/mercado` que NÃO gravam nada.
 *
 *  A CONFERÊNCIA É UM POST QUE SÓ LÊ: ela recebe a planilha, conta o que
 *  entraria e devolve a conta — nenhum número do painel muda. Classificá-la
 *  como escrita só por ser POST fazia a tela do gráfico rebuscar DUAS VEZES por
 *  subida: uma na conferência, à toa, e outra na gravação.
 *
 *  A EXCEÇÃO É A LISTA CURTA, e o padrão continua "avisa": uma rota de escrita
 *  nova no painel chega avisando sem ninguém lembrar de cadastrá-la aqui. Só o
 *  que comprovadamente não grava entra nesta lista — o erro de esquecer é uma
 *  busca a mais, e o de incluir é a tela mentir sobre o dado. */
const ROTAS_DO_MERCADO_QUE_SO_LEEM = ['/api/mercado/bonds/conferencia'] as const;

/** Esta requisição, se der certo, muda algum número do Painel de Mercado? */
export function escreveNoMercado(metodo: string, caminho: string): boolean {
  if (METODOS_QUE_LEEM.has(metodo.toUpperCase())) return false;
  const soOCaminho = caminho.split('?')[0];
  if (ROTAS_DO_MERCADO_QUE_SO_LEEM.some((rota) => soOCaminho === rota)) return false;
  return ROTAS_DO_MERCADO.some(
    (rota) => soOCaminho === rota || soOCaminho.startsWith(`${rota}/`),
  );
}

/** A mensagem do canal do Mercado. */
export const MENSAGEM_DO_MERCADO = 'mercado-mudou';

/** Os dados do Painel de Mercado mudaram — nesta aba ou em outra.
 *
 *  A TELA DO GRÁFICO ESCUTA AQUI. Sem o aviso, subir a planilha na aba
 *  Importação e voltar para a aba do gráfico mostraria a série de antes até
 *  alguém dar F5 — exatamente o defeito que o Score teve e que o
 *  `Sincronizador` existe para não repetir.
 *
 *  ATRAVESSA ABAS DO NAVEGADOR de graça, porque roda sobre `BroadcastChannel`. */
export const mercadoMudou = new Sincronizador(
  canalDoNavegador('mercado'),
  MENSAGEM_DO_MERCADO,
);