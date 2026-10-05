/** O eixo que se move em vez de saltar.
 *
 *  O EIXO DA JORNADA É ADAPTATIVO, logo ele muda: quando um mês novo entra na
 *  base, e quando se escolhe uma lente para comparar — a nota dela entra na conta
 *  do domínio junto com o índice. Até aqui a mudança era um corte seco, e um
 *  corte de régua lê-se como mudança de DADO: a curva inteira aparece noutra
 *  altura, e quem estava olhando um degrau de quinze pontos não sabe se o degrau
 *  mudou ou se a régua mudou debaixo dele.
 *
 *  A CONTA MORA AQUI, e não no componente, pela mesma razão que o resto da
 *  jornada: interpolação com amortecimento é aritmética, e aritmética dentro de
 *  JSX é aritmética que ninguém revisa.
 */

/** O intervalo do eixo Y — as duas pontas que a jornada desenha entre. */
export interface Dominio {
  piso: number;
  teto: number;
}

/** Quanto tempo a transição leva, em milissegundos.
 *
 *  TREZENTOS E CINQUENTA é o meio de uma faixa estreita. Acima de meio segundo a
 *  transição deixa de ser ajuda e passa a ser espera — quem clicou numa lente
 *  fica olhando o eixo se mexer antes de poder ler o gráfico. Abaixo de 200ms
 *  ela não é percebida como movimento, e volta a ser o corte que existe para
 *  evitar. */
export const DURACAO_DA_TRANSICAO = 350;

/** A curva do tempo da transição: devagar nas pontas, rápida no meio.
 *
 *  SAI E CHEGA PARADA, e é isso que faz o movimento parecer natural: uma
 *  interpolação linear chega ao fim na mesma velocidade com que saiu, e o olho lê
 *  essa parada brusca como um corte — justamente o que queríamos tirar.
 *
 *  É A CÚBICA SIMÉTRICA (`easeInOutCubic`), e não uma mola: mola tem repique, e
 *  um eixo que passa do valor e volta afirma, por um quadro, uma escala que não
 *  existe. Num gráfico de índice isso é pior que o salto. */
export function suavidade(t: number): number {
  const passo = Math.min(Math.max(t, 0), 1);
  return passo < 0.5 ? 4 * passo ** 3 : 1 - (-2 * passo + 2) ** 3 / 2;
}

/** O domínio no meio do caminho entre dois, com `t` de 0 a 1.
 *
 *  AS DUAS PONTAS ANDAM JUNTAS, cada uma para o seu destino. Interpolar só uma
 *  delas — ou interpolar a amplitude e o centro separadamente — deixa o piso
 *  passar o teto em algum quadro do meio, e aí o eixo se inverte e a curva
 *  aparece de cabeça para baixo. Com as duas interpoladas em paralelo, um
 *  domínio válido em cada ponta garante um domínio válido em todo o caminho. */
export function entre(de: Dominio, para: Dominio, t: number): Dominio {
  const andou = Math.min(Math.max(t, 0), 1);
  return {
    piso: de.piso + (para.piso - de.piso) * andou,
    teto: de.teto + (para.teto - de.teto) * andou,
  };
}
