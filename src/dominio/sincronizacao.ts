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
 *  Sem React e sem `fetch`: é o que permite testar a regra e o aviso sem
 *  montar tela nenhuma.
 */

/** As rotas cujas escritas mudam o catálogo. Prefixo de CAMINHO, com barra ou
 *  fim de string depois: `/api/temas` casa `/api/temas` e `/api/temas/3`, e não
 *  casa uma hipotética `/api/temas-arquivados`. */
export const ROTAS_DO_CATALOGO = [
  '/api/temas',
  '/api/instituicoes',
  '/api/interlocutores',
  '/api/pessoas-aegea',
  '/api/referencias',
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

/** Um aviso de "o catálogo mudou", para quem quiser escutar. */
export class Sincronizador {
  private readonly ouvintes = new Set<Ouvinte>();

  /** Assina. Devolve o gesto que cancela — pensado para o `useEffect`. */
  assinar(ouvinte: Ouvinte): () => void {
    this.ouvintes.add(ouvinte);
    return () => {
      this.ouvintes.delete(ouvinte);
    };
  }

  avisar(): void {
    for (const ouvinte of this.ouvintes) ouvinte();
  }

  get quantosEscutam(): number {
    return this.ouvintes.size;
  }
}

/** O único sincronizador da aplicação: o cliente da API avisa aqui, e o
 *  estado do painel escuta aqui. */
export const catalogoMudou = new Sincronizador();
