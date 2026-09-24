/** A geometria do gráfico radial das lentes — o desenho, sem desenhar nada.
 *
 *  DUAS INFORMAÇÕES NUM GRÁFICO SÓ, e é isso que nenhuma rosca pronta faz: a
 *  LARGURA da fatia é o peso da lente no índice, e o COMPRIMENTO é a nota
 *  dela. Uma lente de peso 30 com nota 70 ocupa quase um terço do círculo e
 *  chega longe; uma de peso 15 com nota 37 é estreita e curta. O leitor vê,
 *  sem ler número nenhum, de onde o índice vem e o que o puxa para baixo.
 *
 *  POR QUE A CONTA MORA AQUI, E NÃO NO COMPONENTE. Ângulo, raio, cor, âncora
 *  de rótulo e redistribuição de fatia são regras — e regra se confere num
 *  teste, não num print. O componente recebe caminhos SVG prontos e só os
 *  pinta.
 *
 *  O NÚMERO NÃO É RECALCULADO AQUI. Nota, peso efetivo e faixa chegam do
 *  servidor; este arquivo só decide onde cada um fica na tela.
 */

import { corDaFaixa, corDeAreaDaFaixa, rotuloDaFaixa } from '@/dominio/score';
import type { LenteDoScore } from '@/dominio/score';

/** O sistema de coordenadas do SVG, igual ao do protótipo.
 *
 *  O `viewBox` é MAIOR QUE O CÍRCULO de propósito: os rótulos das lentes ficam
 *  a `RMAX + 30` do centro, e sem a folga eles sairiam cortados nas bordas —
 *  que é o defeito que a §6 manda evitar. */
export const CENTRO = { x: 230, y: 230 } as const;
export const R0 = 74;
export const RMAX = 190;
export const VIEW_BOX = { x: -60, y: -20, largura: 580, altura: 500 } as const;

/** O recuo angular de cada lado da fatia, em radianos (~1°). */
const VAO = 0.018;

/** Quanto do círculo cabe a uma lente fora do cálculo.
 *
 *  FIXO, E PEQUENO. Ela não tem nota para desenhar, mas sumir com a fatia
 *  faria o círculo mentir sobre quantas lentes existem — e quem visse quatro
 *  fatias acharia que a companhia tem quatro famílias de stakeholder. */
const FATIA_FORA = 0.06;

/** Os limites das faixas, onde o gráfico desenha os anéis tracejados. */
export const ANEIS = [40, 55, 70, 85] as const;

/** Só estes dois ganham número escrito.
 *
 *  Os quatro anéis rotulados empilhavam texto no eixo vertical e o gráfico
 *  ficava apertado; 40 e 70 são os limites que a leitura usa — a fronteira do
 *  crítico e a do sólido. */
const ANEIS_COM_ROTULO: readonly number[] = [40, 70];

export type Ancora = 'centro' | 'inicio' | 'fim';

export interface PontoNaTela {
  /** Percentual da largura do container, pronto para `left`. */
  esquerda: number;
  /** Percentual da altura do container, pronto para `top`. */
  topo: number;
}

export interface SetorDaLente {
  codigo: string;
  nome: string;
  stakeholder: string;
  /** O caminho do fundo, até 100 — é o que mostra quanto falta. */
  fundo: string;
  /** O caminho da fatia medida. Vazio quando a lente ficou de fora. */
  fatia: string;
  /** A cor de preenchimento da fatia. */
  cor: string;
  /** A cor legível para a nota escrita ao lado — não é a mesma. */
  corDoTexto: string;
  /** Onde o rótulo externo fica, e para que lado ele se alinha. */
  rotulo: PontoNaTela;
  ancora: Ancora;
  /** A nota escrita, ou "fora". */
  notaEscrita: string;
  ativa: boolean;
  /** O que o leitor de tela anuncia — a §7 pede a nota por escrito, e não a
   *  cor, porque cor não se lê em voz alta. */
  descricao: string;
}

export interface AnelDeReferencia {
  valor: number;
  raio: number;
  /** Nulo quando o anel é desenhado sem número. */
  rotulo: PontoNaTela | null;
}

export interface Radial {
  setores: SetorDaLente[];
  aneis: AnelDeReferencia[];
  centro: PontoNaTela;
  /** A frase que explica o desenho — muda com `porPeso`. */
  legenda: string;
}

/** Onde um ponto do SVG cai no container, em porcentagem.
 *
 *  É O QUE PERMITE O TEXTO FICAR FORA DO SVG. Rótulo dentro de `<text>` some
 *  quando o framework interpola o valor, e foi exatamente o que aconteceu na
 *  primeira versão do protótipo: o gráfico aparecia e os números, não. Em
 *  overlay HTML o texto é texto — selecionável, com a fonte do produto, e
 *  ninguém precisa descobrir por que ele sumiu. */
export function naTela(x: number, y: number): PontoNaTela {
  return {
    esquerda: ((x - VIEW_BOX.x) / VIEW_BOX.largura) * 100,
    topo: ((y - VIEW_BOX.y) / VIEW_BOX.altura) * 100,
  };
}

/** O raio de uma nota de 0 a 100. Fora da escala, encosta no limite. */
export function raioDa(nota: number): number {
  const dentro = Math.max(0, Math.min(100, nota));
  return R0 + (RMAX - R0) * (dentro / 100);
}

function ponto(raio: number, angulo: number): [number, number] {
  return [CENTRO.x + raio * Math.cos(angulo), CENTRO.y + raio * Math.sin(angulo)];
}

/** O caminho de um setor de anel: dois arcos e duas retas. */
export function arco(raioInterno: number, raioExterno: number, de: number, ate: number): string {
  const grande = ate - de > Math.PI ? 1 : 0;
  const [x0, y0] = ponto(raioInterno, de);
  const [x1, y1] = ponto(raioExterno, de);
  const [x2, y2] = ponto(raioExterno, ate);
  const [x3, y3] = ponto(raioInterno, ate);
  const n = (valor: number) => valor.toFixed(1);
  return (
    `M${n(x0)} ${n(y0)}L${n(x1)} ${n(y1)}` +
    `A${raioExterno} ${raioExterno} 0 ${grande} 1 ${n(x2)} ${n(y2)}` +
    `L${n(x3)} ${n(y3)}` +
    `A${raioInterno} ${raioInterno} 0 ${grande} 0 ${n(x0)} ${n(y0)}Z`
  );
}

/** Para que lado o rótulo se alinha, pelo ângulo em que ele caiu.
 *
 *  PERTO DA VERTICAL ELE CENTRALIZA, e nos lados ele se encosta: um rótulo
 *  centralizado às 3h invadiria o gráfico com metade do texto. */
export function ancoraDe(angulo: number): Ancora {
  const cosseno = Math.cos(angulo);
  if (Math.abs(cosseno) < 0.25) return 'centro';
  return cosseno > 0 ? 'inicio' : 'fim';
}

/** Quanto do círculo cabe a cada lente.
 *
 *  AS QUE FICARAM DE FORA LEVAM UMA FATIA FIXA, e as medidas dividem o que
 *  sobra — proporcionalmente ao peso efetivo, que já é o peso redistribuído
 *  pelo servidor. Sem descontar as fatias fixas, a soma passaria de 100% e a
 *  última fatia cobriria a primeira.
 */
export function fracoesDe(
  lentes: LenteDoScore[],
  porPeso: boolean,
): Map<string, number> {
  const ativas = lentes.filter((lente) => lente.score !== null);
  const sobra = 1 - FATIA_FORA * (lentes.length - ativas.length);
  const pesoTotal = ativas.reduce((soma, lente) => soma + lente.peso_efetivo, 0);

  return new Map(
    lentes.map((lente) => {
      // COM TODAS FORA, O CÍRCULO SE DIVIDE INTEIRO. A fatia fixa existe para
      // uma lente ausente não sumir do meio das outras; sem "outras", cinco
      // fatias de 6% desenhariam um terço de círculo e o resto vazio — que se
      // lê como gráfico quebrado, e não como "nada foi medido".
      if (!ativas.length) return [lente.codigo, 1 / lentes.length];
      if (lente.score === null) return [lente.codigo, FATIA_FORA];
      // SEM PESO NENHUM CAI NAS FATIAS IGUAIS, e não em divisão por zero: uma
      // calibração que zera todos os pesos é improvável, mas um gráfico que
      // some é pior do que um gráfico sem ponderação.
      if (!porPeso || !pesoTotal) return [lente.codigo, sobra / ativas.length];
      return [lente.codigo, (lente.peso_efetivo / pesoTotal) * sobra];
    }),
  );
}

/** O gráfico inteiro, pronto para desenhar.
 *
 *  A ORDEM DAS LENTES É A DO SERVIDOR, e não a da nota: é a ordem da
 *  especificação (Imprensa → Mercado → Sociedade → Clientes → Institucional), e
 *  ela não pode mudar de mês para mês. Um gráfico que reordena as fatias quando
 *  uma lente melhora impede a comparação entre dois meses — que é a única coisa
 *  que alguém faz com ele.
 */
export function radialDasLentes(lentes: LenteDoScore[], porPeso = true): Radial {
  const fracoes = fracoesDe(lentes, porPeso);
  let angulo = -Math.PI / 2;

  const setores = lentes.map((lente): SetorDaLente => {
    const largura = (fracoes.get(lente.codigo) ?? 0) * Math.PI * 2;
    const de = angulo + VAO;
    const ate = angulo + largura - VAO;
    const meio = angulo + largura / 2;
    angulo += largura;

    const [x, y] = ponto(RMAX + 30, meio);
    const ativa = lente.score !== null;
    return {
      codigo: lente.codigo,
      nome: lente.nome,
      stakeholder: lente.stakeholder,
      fundo: arco(R0, RMAX, de, ate),
      fatia: ativa ? arco(R0, raioDa(lente.score ?? 0), de, ate) : '',
      cor: corDeAreaDaFaixa(lente.score),
      corDoTexto: corDaFaixa(lente.score),
      rotulo: naTela(x, y),
      ancora: ancoraDe(meio),
      notaEscrita: ativa ? String(lente.score) : 'fora',
      ativa,
      descricao: ativa
        ? `${lente.nome}: nota ${lente.score}, faixa ${rotuloDaFaixa(lente.score)}, ` +
          `peso ${lente.peso_efetivo}%`
        : `${lente.nome}: fora do cálculo`,
    };
  });

  return {
    setores,
    aneis: ANEIS.map((valor) => {
      const raio = raioDa(valor);
      return {
        valor,
        raio,
        // NA VERTICAL DAS 12h: é o único raio que não cruza fatia nenhuma,
        // porque é onde o círculo começa e o vão separa a última da primeira.
        rotulo: ANEIS_COM_ROTULO.includes(valor)
          ? naTela(CENTRO.x, CENTRO.y - raio)
          : null,
      };
    }),
    centro: naTela(CENTRO.x, CENTRO.y),
    legenda: porPeso
      ? 'largura de cada fatia = peso da lente · comprimento = nota · anéis tracejados = limites das faixas'
      : 'fatias iguais · comprimento = nota · anéis tracejados = limites das faixas',
  };
}
