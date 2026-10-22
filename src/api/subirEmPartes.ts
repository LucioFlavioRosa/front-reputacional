/** Subir um arquivo grande em pedaços — o mecanismo, sem a tela que sobe.
 *
 *  POR QUE ELE EXISTE. O ingress do Container Apps encerra a requisição por
 *  volta de 240 s, e isso NÃO é configurável. Medido no navegador em
 *  16/10/2026, pela telemetria do próprio painel, com a banda de subida
 *  variando de ~18 KB/s a ~350 KB/s na mesma máquina e na mesma hora:
 *
 *      1,42 MB  ->    4,1 s  -> 200
 *     10,53 MB  ->  212,4 s  -> 403   (o ingress desistindo)
 *
 *  POR QUE ELE É UM MÓDULO, e isto é de 22/10/2026: o laço, a repetição da
 *  parte que falhou, o progresso e a regra do "aqui não dá, mande de uma vez"
 *  moravam dentro de `api/score.ts`. A Importação de bonds manda o export
 *  INTEIRO numa requisição — e duas vezes, porque confere e depois importa —
 *  sem nada disso. O arquivo de teste já se chamava `subirEmPartes.test.ts`,
 *  esperando o módulo que não existia.
 *
 *  O QUE NÃO ESTÁ AQUI: as rotas, os nomes dos campos e o tipo da resposta.
 *  Cada tela entrega quatro funções pequenas e fica com o vocabulário dela. */

/** O limiar acima do qual vale fatiar.
 *
 *  1,2 MB, E NÃO 4: o 403 medido foi num arquivo de 10,53 MB, mas a telemetria
 *  mostra 73,2 s para 1,33 MB na mesma hora — ou seja, a 18 KB/s um arquivo de
 *  3 MB já não cabe nos 240 s. O limiar tem de ficar abaixo do menor arquivo
 *  que pode falhar, não abaixo do maior que falhou.
 *
 *  O QUE ISSO CUSTA: o mês da Clipei (1,3 a 2,1 MB) passa a subir em partes —
 *  abertura, duas ou três partes, conferência. Medido no ambiente, cada parte
 *  custa ~0,5 s, então são ~2 s a mais no caso bom para não ter 4 minutos e um
 *  403 no caso ruim.
 *
 *  `Math.round` PORQUE 1,2 MiB NÃO É INTEIRO: 1,2 × 1024 × 1024 = 1.258.291,2,
 *  e um limiar fracionário compara certo mas não serve de tamanho de arquivo —
 *  o teste da borda exata criaria um `File` de 1.258.291,2 bytes. */
export const TAMANHO_PARA_SUBIR_EM_PARTES = Math.round(1.2 * 1024 * 1024);

/** O que o servidor responde ao abrir uma subida. */
export interface Abertura {
  /** NULO SIGNIFICA "AQUI NÃO DÁ, MANDE DE UMA VEZ" — ambiente sem
   *  armazenamento não tem onde montar as partes.
   *
   *  CADA TELA LÊ O CAMPO DELA e devolve isto: o Score chama `planilha_id`, os
   *  bonds chamam `subida_id`. Normalizar aqui é o que permite ao laço não
   *  saber de nenhum dos dois. */
  id: string | null;
  /** VEM DO SERVIDOR, e não daqui: é ele que conhece o teto do ingress e a
   *  margem que escolheu. Um número nosso divergiria do dele na primeira
   *  mudança, e a divergência só apareceria como parte recusada. */
  tamanho_da_parte: number;
}

/** As quatro operações que uma tela precisa entregar para subir em partes. */
export interface CaminhoDaSubida<T> {
  abrir: (arquivo: File) => Promise<Abertura>;
  parte: (id: string, indice: number, pedaco: Blob) => Promise<void>;
  fechar: (id: string, partes: number) => Promise<T>;
  /** O caminho de sempre, para arquivo pequeno e para ambiente sem
   *  armazenamento. Devolve o MESMO tipo — a tela não distingue os dois. */
  deUmaVez: (arquivo: File) => Promise<T>;
}

/** Quantas vezes uma parte é tentada antes de desistir. */
const TENTATIVAS_POR_PARTE = 3;

/** Repete a parte que falhou por motivo TRANSITÓRIO.
 *
 *  POR QUE EXISTE: o servidor fez o `PUT` idempotente por índice justamente
 *  para permitir repetir — e a primeira versão deste cliente abortava na
 *  primeira falha, desperdiçando a garantia. Numa rede ruim, que é o caso de
 *  uso inteiro, uma parte falha e a pessoa recomeçava o arquivo de dez
 *  megabytes. Achado da revisão do Codex em 16/10/2026.
 *
 *  ESPERA CRESCENTE COM RUÍDO: 400 ms, 800 ms, e o ruído evita que dez partes
 *  que falharam juntas voltem todas no mesmo instante. Sem o teto de três, uma
 *  rede caída viraria laço infinito com a tela dizendo que está subindo. */
async function comTentativas<T>(fazer: () => Promise<T>): Promise<T> {
  for (let tentativa = 1; ; tentativa += 1) {
    try {
      return await fazer();
    } catch (falha) {
      if (tentativa >= TENTATIVAS_POR_PARTE || !valeTentarDeNovo(falha)) throw falha;
      const espera = 400 * 2 ** (tentativa - 1) * (1 + Math.random() * 0.3);
      await new Promise((pronto) => setTimeout(pronto, espera));
    }
  }
}

/** A falha é do tipo que pode dar certo na próxima?
 *
 *  SÓ O QUE PODE DAR CERTO NA SEGUNDA: falha de rede, 408, 429 e 5xx. Um 4xx
 *  determinístico — parte fora de faixa, tamanho errado, subida que não é sua —
 *  dá o mesmo resultado três vezes, e repetir só atrasa a mensagem que a pessoa
 *  precisa ler. */
function valeTentarDeNovo(falha: unknown): boolean {
  // SEM `status` É FALHA DE REDE: o `fetch` rejeita antes de haver resposta, e
  // é o caso mais comum numa conexão instável — o que este caminho existe para
  // atender.
  const status = (falha as { status?: number } | null)?.status;
  if (status === undefined) return true;
  return status === 408 || status === 429 || status >= 500;
}

/** Sobe o arquivo em pedaços e devolve o que o fechamento devolver.
 *
 *  `aoProgresso` NÃO É ENFEITE. Onze requisições levam minutos, e uma tela
 *  parada por minutos se lê como travada: foi exatamente assim que este defeito
 *  apareceu para quem usava ("está demorando", sem erro nenhum). Quem chama
 *  precisa poder dizer em que parte está. */
export async function subirEmPartes<T>(
  arquivo: File,
  caminho: CaminhoDaSubida<T>,
  aoProgresso?: (enviadas: number, total: number) => void,
): Promise<T> {
  const { id, tamanho_da_parte } = await caminho.abrir(arquivo);

  // SEM ARMAZENAMENTO, O CAMINHO DE SEMPRE. O servidor diz isso com `id` nulo,
  // e aqui é o único lugar que precisa saber: a tela recebe a mesma resposta
  // nos dois casos.
  //
  // E NÃO SE DETECTA POR ERRO: o envelope do back é `{detalhe, referencia}` e
  // não traz código, então capturar um 422 confundiria esta causa com as outras
  // recusas da mesma rota — e cairia no caminho de uma vez só justamente nos
  // casos em que ele também vai falhar, depois de subir o arquivo inteiro.
  if (id === null) return caminho.deUmaVez(arquivo);

  const total = Math.ceil(arquivo.size / tamanho_da_parte);
  aoProgresso?.(0, total);

  // UMA POR VEZ, e não em paralelo. O servidor aceita qualquer ordem — o teste
  // dele cobra isso —, mas em paralelo as partes disputam a MESMA banda que
  // acabou de se mostrar o gargalo, e o progresso deixaria de significar
  // "quanto subiu". Sequencial é mais lento em rede boa e mais legível em rede
  // ruim, que é onde este caminho é usado.
  for (let indice = 0; indice < total; indice += 1) {
    const inicio = indice * tamanho_da_parte;
    const pedaco = arquivo.slice(inicio, inicio + tamanho_da_parte);
    await comTentativas(() => caminho.parte(id, indice, pedaco));
    aoProgresso?.(indice + 1, total);
  }

  return caminho.fechar(id, total);
}
