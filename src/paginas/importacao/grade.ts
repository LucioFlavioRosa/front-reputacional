/** A cor de cada célula da grade de conferência.
 *
 *  O PEDIDO DO DONO DO PRODUTO: "as colunas e linhas devem ter um destaque de cor
 *  quando está faltando informação". A cor é o que faz 500 linhas por 22 colunas
 *  serem conferíveis — sem ela, a pessoa lê onze mil células procurando o que
 *  falta, e é aí que ela para de conferir e passa a clicar em confirmar.
 *
 *  FORA DO COMPONENTE porque são decisões, não marcação: qual cor vence quando há
 *  duas divergências na mesma célula, e o que fazer com a divergência que não
 *  aponta coluna. Dentro do JSX isso só se testaria montando a tela inteira.
 */

import type { LinhaDaImportacao } from '@/api/cliente';

/** As duas severidades que a grade mostra, e `null` para a célula sem nada.
 *
 *  SÃO AS MESMAS DUAS DO SERVIDOR (`trava`), e não uma escala inventada aqui: a
 *  tela que inventa severidade própria passa a discordar do botão de confirmar. */
export type Cor = 'trava' | 'aviso' | null;

/** As divergências desta linha que apontam para uma coluna. */
function apontadas(linha: LinhaDaImportacao) {
  // A DIVERGÊNCIA SEM COLUNA é da LINHA inteira — uma duplicata de agenda, por
  // exemplo. Pintar uma célula arbitrária mandaria a pessoa consertar uma coluna
  // que não tem nada de errado.
  return linha.divergencias.filter((divergencia) => divergencia.coluna);
}

/** A cor de uma célula: vermelho se trava, amarelo se avisa, nada se está limpa. */
export function corDaCelula(linha: LinhaDaImportacao, coluna: string): Cor {
  const daColuna = apontadas(linha).filter((divergencia) => divergencia.coluna === coluna);
  if (daColuna.length === 0) return null;
  // O VERMELHO VENCE O AMARELO na mesma célula: a que impede confirmar é a que a
  // pessoa precisa ver, e mostrar o aviso esconderia a que importa.
  return daColuna.some((divergencia) => divergencia.trava) ? 'trava' : 'aviso';
}

/** Se a linha inteira deve se destacar.
 *
 *  O PEDIDO FALA DE LINHAS E DE COLUNAS, e com 22 colunas a célula vermelha pode
 *  estar fora da tela: o destaque na linha é o que faz a pessoa rolar até ela.
 *
 *  OLHA TODAS AS DIVERGÊNCIAS, e não só as que apontam coluna — foi um achado da
 *  revisão. "Esta linha está presa?" é pergunta sobre a LINHA, e a resposta é
 *  `trava`; em qual célula pintar é outra pergunta, e essa sim depende da coluna.
 *
 *  O ESTRAGO DE CONFUNDIR AS DUAS: uma importação criada antes de as divergências
 *  ganharem `coluna` está no banco sem essa chave, e a conferência dela continua
 *  aberta. Com o filtro inicial mostrando só as linhas com pendência, a linha
 *  DESAPARECIA da grade enquanto o cabeçalho anunciava a pendência — e a pessoa não
 *  tinha onde mexer. O servidor agora deriva a coluna que falta, e isto aqui é a
 *  segunda rede: vale para qualquer divergência que seja da linha e não da célula. */
export function linhaTemPendencia(linha: LinhaDaImportacao): boolean {
  return linha.divergencias.some((divergencia) => divergencia.trava);
}

/** Quantas células travam e quantas avisam, no arquivo todo.
 *
 *  É o que o cabeçalho da grade diz antes de a pessoa rolar: "3 células a
 *  preencher" responde "tenho tempo de conferir isto agora?". */
export function resumoDeCores(linhas: LinhaDaImportacao[]): { trava: number; aviso: number } {
  let trava = 0;
  let aviso = 0;
  for (const linha of linhas) {
    for (const divergencia of apontadas(linha)) {
      if (divergencia.trava) trava += 1;
      else aviso += 1;
    }
  }
  return { trava, aviso };
}
