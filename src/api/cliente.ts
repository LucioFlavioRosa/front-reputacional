/** O cliente da API â€” barril de reexportaÃ§Ã£o.
 *
 *  ERA UM ARQUIVO DE 2.481 LINHAS E 90 FUNÃ‡Ã•ES, com toda chamada de API do
 *  produto. Em 17/10/2026 trÃªs entregas sem relaÃ§Ã£o entre si â€” a subida em
 *  partes, o limiar de 1,2 MB e a remoÃ§Ã£o da senha â€” editaram este mesmo
 *  arquivo no mesmo dia. Era o ponto onde duas pessoas em paralelo colidiam
 *  primeiro.
 *
 *  AGORA ELE SÃ“ REEXPORTA, e por isso a divisÃ£o nÃ£o custou nada a quem chama:
 *  os 66 arquivos que importam de `@/api/cliente` continuam importando daqui.
 *  Quem for escrever cÃ³digo novo pode importar direto do domÃ­nio.
 *
 *  `nucleo.ts` Ã© o transporte (requisiÃ§Ã£o, erro, cache) e nÃ£o conhece domÃ­nio
 *  nenhum â€” Ã© o Ãºnico que todos os outros importam.
 */

export * from './nucleo';
export * from './acesso';
export * from './crm';
export * from './score';
export * from './mercado';
export * from './importacao';
