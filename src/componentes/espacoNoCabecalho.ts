/** O espaço, dentro do cabeçalho azul, onde uma tela pode pôr a sua busca.
 *
 *  POR QUE UM ESPAÇO, e não a busca montada pelo próprio cabeçalho: no CRM a
 *  busca lê o recorte global (`usePainel`), e o cabeçalho a monta direto. No
 *  Score, o estado da busca (lente aberta, filtro da lente, aba) vive na tela
 *  do Score — o cabeçalho só reserva o lugar, e a tela entra nele por portal.
 */
export const ID_DA_BUSCA_NO_CABECALHO = 'busca-no-cabecalho';
