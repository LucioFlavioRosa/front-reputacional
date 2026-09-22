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
] as const;

const METODOS_QUE_LEEM = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Esta requisição, se der certo, muda o catálogo? */
export function escreveNoCatalogo(metodo: string, caminho: string): boolean {
  if (METODOS_QUE_LEEM.has(metodo.toUpperCase())) return false;
  const soOCaminho = caminho.split('?')[0];
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

  constructor(canal: CanalEntreAbas | null = null) {
    this.canal = canal;
    if (canal) {
      // O que vem de outra aba é aviso, e não é repassado: repassar faria as
      // abas trocarem o mesmo aviso para sempre.
      canal.onmessage = (evento) => {
        if (evento.data === MENSAGEM_DO_CATALOGO) this.espalhar();
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

  /** O catálogo mudou aqui: avisa esta aba e as outras. */
  avisar(): void {
    this.espalhar();
    this.canal?.postMessage(MENSAGEM_DO_CATALOGO);
  }

  private espalhar(): void {
    for (const ouvinte of this.ouvintes) ouvinte();
  }
}

/** O canal do navegador, quando existe. Fora dele (testes, SSR) não há outra
 *  aba para avisar. */
function canalDoNavegador(): CanalEntreAbas | null {
  if (typeof window === 'undefined' || typeof window.BroadcastChannel !== 'function') return null;
  return new window.BroadcastChannel('painel-reputacional:catalogo');
}

/** O único sincronizador da aplicação: o cliente da API avisa aqui, e o
 *  estado do painel escuta aqui. */
export const catalogoMudou = new Sincronizador(canalDoNavegador());
