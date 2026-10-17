/** Normalização de texto para BUSCA.
 *
 *  Morava em `paginas/score/consulta/dados/seletores.ts`, e `dominio/buscaDoRadar.ts`
 *  a importava de lá — o domínio chamando função de dentro de uma pasta de
 *  tela. Era o único import de VALOR que o domínio fazia para fora dele, e não
 *  havia motivo: tirar acento de um texto não sabe nada sobre a Consulta da
 *  Lente. Mudou em 17/10/2026.
 *
 *  ───────────────────────────────────────────────────────────────────────────
 *  POR QUE EXISTEM QUATRO NORMALIZAÇÕES NO FRONT, E POR QUE ISTO NÃO AS UNIFICA
 *
 *  Quem procurar `normalize('NFD')` acha quatro lugares, e a leitura óbvia —
 *  "três cópias esquecidas" — está errada. **Três delas têm motivo, e unificá-las
 *  quebraria o motivo.** Conferido em 17/10/2026:
 *
 *  1. ESTA (`normalizarBusca`) — minúsculas, sem acento, espaços colapsados,
 *     sem espaço nas pontas. É para CASAR TERMO DIGITADO contra texto exibido.
 *
 *  2. `completar.normalizar` — NÃO colapsa espaço interno, e isso é de
 *     propósito: ela espelha a normalização que o BACKEND usa para deduplicar
 *     nome de cadastro ("Radames" encontrar "Radamés"). Mudá-la para parecer
 *     com esta faria o front e o servidor discordarem sobre o que é o mesmo
 *     nome, e a fila de duplicados passaria a divergir da tela.
 *
 *  3. `buscaDoRadar.realcarTrecho` — normaliza LETRA A LETRA, porque precisa do
 *     mapa de volta: a marcação do trecho buscado volta para as letras
 *     ORIGINAIS (com acento e caixa). Uma função de string inteira não serve —
 *     perde-se a correspondência de índice.
 *
 *  4. `nomeDoArquivo` — é slug de arquivo: também troca tudo que não é letra ou
 *     dígito por `-` e corta as pontas. Saída diferente, propósito diferente.
 *
 *  O que elas têm em comum é uma linha de `NFD`. Isso não é duplicação de
 *  regra; é a biblioteca padrão aparecendo quatro vezes.
 */

/** Minúsculas, sem acento, espaços colapsados e sem espaço nas pontas. */
export function normalizarBusca(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}
