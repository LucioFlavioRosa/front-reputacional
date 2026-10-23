/** A lista de veículos que abre em 5: quantos aparecem, e se há o que abrir.
 *
 *  SAIU DE DENTRO DE `DossieDaLente.tsx` (23/10/2026) porque dois arquivos
 *  passaram a usá-la: o Explorador de veículos, que é quem a desenha agora, e
 *  o dossiê, enquanto ainda tiver um ranking próprio. O corpo não mudou na
 *  mudança de lugar — só o teto, ver abaixo.
 */

import { useId, useState } from 'react';

/** O número de veículos que a lista mostra antes de alguém abrir — PEDIDO
 *  (21/10/2026, revisto em 23/10/2026). A tela abre em 5, e UM botão revela de
 *  uma vez todos os do recorte; o mesmo botão recolhe de volta.
 *
 *  A VERSÃO ANTERIOR ERA UM CONTADOR DE SETINHAS (▲▼), de um em um, e caiu por
 *  dois motivos: revelar o último custava cinco cliques — e recolher, outros
 *  cinco —, e o rótulo "Mostrando 5 de 10" só RELATAVA a primeira tela, sem
 *  convidar para a segunda. Agora o número vive no rótulo do botão ("Ver todos
 *  os 10 veículos"), que é o convite, e o degradê no rodapé da lista é o que
 *  diz "isto está cortado, não terminado".
 *
 *  E NÃO EXISTE MAIS TETO DE 10 (23/10/2026): o 10 era o corte que o SERVIDOR
 *  fazia nos blocos antigos do dossiê. A rota do Explorador de veículos manda
 *  o mês agrupado inteiro, então o teto é o que o recorte tem — e o botão diz o
 *  número de verdade em vez de um 10 que não era o total de nada. */
const QUANTIDADE_INICIAL_DE_VEICULOS = 5;

export function useListaDeVeiculos(total: number) {
  const teto = total;
  const inicial = Math.min(QUANTIDADE_INICIAL_DE_VEICULOS, teto);
  const [aberta, definirAberta] = useState(false);
  //: O ID DA LISTA QUE O BOTÃO CONTROLA, para o `aria-controls` — nasce aqui,
  //: e não no botão, porque quem desenha a lista é quem tem de pôr o id nela:
  //: `aria-expanded` sozinho anuncia "expandido" sem dizer o que foi
  //: expandido (achado da revisão do Codex, 23/10/2026).
  const idDaLista = useId();
  //: COM 5 OU MENOS VEÍCULOS NO RECORTE não existe segunda tela para revelar:
  //: `podeAbrir` é falso e o botão não nasce. `aberta` segue ignorada nesse
  //: caso em vez de ser zerada, porque estreitar o recorte não deve fazer quem
  //: abriu a lista perder o que abriu.
  //
  //: E A QUANTIDADE É DERIVADA DE `teto`, nunca guardada — era isto que o
  //: contador antigo tinha de corrigir com um `Math.min` a cada render: um
  //: recorte com 6 veículos depois de um com 10 deixava o número velho no
  //: estado.
  const podeAbrir = teto > inicial;
  const abertaDeFato = aberta && podeAbrir;
  return {
    quantidade: abertaDeFato ? teto : inicial,
    teto,
    podeAbrir,
    aberta: abertaDeFato,
    alternar: () => definirAberta((valor) => !valor),
    idDaLista,
  };
}
