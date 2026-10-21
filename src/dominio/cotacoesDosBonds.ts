/** As contas da aba Bonds e reputação que não dependem de tela.
 *
 *  O PEDIDO (21/10/2026, para a apresentação ao CFO): cards de cotação acima do
 *  gráfico, eixos que se ajustam ao período escolhido com marcações redondas,
 *  e os DOIS EIXOS Y AJUSTÁVEIS À MÃO, "estilo think-cell": a escala nasce
 *  automática e a pessoa aproxima, afasta ou desloca cada eixo sem mexer no
 *  outro, com um botão para voltar ao automático.
 *
 *  TUDO AQUI É FUNÇÃO PURA, e é de propósito: é a aritmética que erra sem nada
 *  parecer quebrado (uma variação contra o pregão errado, um passo de 2,37 no
 *  eixo), e testá-la direto é mais exato que caçá-la pela tela.
 */

export interface PontoDoBond {
  /** `YYYY-MM-DD`. */
  data: string;
  valor: number;
}

/* -- os cards de cotação --------------------------------------------------- */

export interface ResumoDoBond {
  ultimo: PontoDoBond;
  /** Último fechamento menos o do último pregão da semana anterior. */
  semanal: number | null;
  /** Último fechamento menos o do último pregão do mês anterior. */
  mensal: number | null;
  baseSemanal: PontoDoBond | null;
  baseMensal: PontoDoBond | null;
}

const UM_DIA = 24 * 60 * 60 * 1000;

function emMs(iso: string): number {
  return Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
}

function comoIso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** A segunda-feira da semana de `iso` (semana de segunda a domingo, UTC). */
export function segundaDaSemana(iso: string): string {
  const ms = emMs(iso);
  //: getUTCDay: domingo = 0. Domingo volta seis dias; os outros, dia − 1.
  const dia = new Date(ms).getUTCDay();
  return comoIso(ms - ((dia + 6) % 7) * UM_DIA);
}

/** O último ponto ANTES de `limite` (exclusivo), numa lista já ordenada. */
function ultimoAntesDe(ordenados: PontoDoBond[], limite: string): PontoDoBond | null {
  let achado: PontoDoBond | null = null;
  for (const ponto of ordenados) {
    if (ponto.data.slice(0, 10) < limite) achado = ponto;
    else break;
  }
  return achado;
}

/** O resumo de um bond para o card: último fechamento e as duas variações.
 *
 *  A BASE É O ÚLTIMO PREGÃO QUE EXISTIU, e não um dia do calendário. É isso que
 *  resolve os três casos que a regra tem de aguentar:
 *
 *    * SEMANA COM FERIADO: sexta sem pregão, a base da semana é a quinta;
 *    * SEMANA ATUAL INCOMPLETA: o último fechamento é de quarta, e a base
 *      continua sendo o último pregão da semana ANTERIOR, não "sete dias atrás";
 *    * MÊS SEM PREGÃO NO ÚLTIMO DIA ÚTIL: a base é o último pregão que houve
 *      antes do dia 1º do mês corrente, seja ele qual for.
 *
 *  Sem base (o papel começou a negociar nesta semana ou neste mês), a variação
 *  é `null`, e o card diz "sem base" em vez de inventar zero. */
export function resumoDoBond(pontos: PontoDoBond[]): ResumoDoBond | null {
  const ordenados = pontos
    .filter((p) => /^\d{4}-\d{2}-\d{2}/.test(p.data) && Number.isFinite(p.valor))
    .sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
  const ultimo = ordenados.at(-1);
  if (!ultimo) return null;
  const baseSemanal = ultimoAntesDe(ordenados, segundaDaSemana(ultimo.data));
  const baseMensal = ultimoAntesDe(ordenados, `${ultimo.data.slice(0, 7)}-01`);
  return {
    ultimo,
    semanal: baseSemanal ? ultimo.valor - baseSemanal.valor : null,
    mensal: baseMensal ? ultimo.valor - baseMensal.valor : null,
    baseSemanal,
    baseMensal,
  };
}

/** Uma variação em pontos, com sinal e vírgula: `+0,4`, `−1,3`, `0,0`. */
export function variacaoEmPontos(valor: number): string {
  const arredondado = Math.round(valor * 10) / 10;
  const texto = Math.abs(arredondado).toFixed(1).replace('.', ',');
  if (arredondado > 0) return `+${texto}`;
  if (arredondado < 0) return `−${texto}`;
  return texto;
}

/** A cor da variação: verde quando é BOM para a Aegea, vermelho quando é
 *  ruim, cinza no zero ARREDONDADO (um +0,04 que aparece como "0,0" não pode
 *  vir colorido).
 *
 *  NO YIELD É AO CONTRÁRIO, por decisão do dono do produto (21/10/2026): o
 *  yield é o custo da dívida da companhia, então subir é ruim e cair é bom. No
 *  preço, subir é bom. */
export function corDaVariacao(valor: number, subirEBom = true): string {
  const arredondado = Math.round(valor * 10) / 10;
  if (arredondado === 0) return '#44495C';
  return arredondado > 0 === subirEBom ? '#0A6B60' : '#B32328';
}

/** A descrição Bloomberg do bond ("AEGEBZ 6 3/4 05/20/29") em português:
 *  "Cupom 6,75% · vence em 20/05/2029". `null` quando não dá para ler. */
export function descricaoLegivelDoBond(descricao: string | null): string | null {
  if (!descricao) return null;
  const casado = descricao
    .trim()
    .match(/^\S+\s+(\d+)?\s*(\d+\/\d+|[¼½¾⅛⅜⅝⅞])?\s+(\d{2})\/(\d{2})\/(\d{2,4})$/);
  if (!casado) return null;
  const [, inteiro, fracao, mes, dia, ano] = casado;
  const UNICODE: Record<string, number> = { '¼': 0.25, '½': 0.5, '¾': 0.75, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875 };
  let parte = 0;
  if (fracao) {
    if (fracao in UNICODE) parte = UNICODE[fracao];
    else {
      const [n, d] = fracao.split('/').map(Number);
      parte = d ? n / d : 0;
    }
  }
  const cupom = Number(inteiro ?? 0) + parte;
  const texto = String(Math.round(cupom * 1000) / 1000).replace('.', ',');
  const anoCompleto = ano.length === 2 ? `20${ano}` : ano;
  return `Cupom ${texto}% · vence em ${dia}/${mes}/${anoCompleto}`;
}

/* -- o período ------------------------------------------------------------- */

export const ATALHOS_DO_PERIODO = [
  { codigo: '1M', rotulo: '1M', meses: 1 },
  { codigo: '3M', rotulo: '3M', meses: 3 },
  { codigo: '6M', rotulo: '6M', meses: 6 },
  { codigo: '12M', rotulo: '12M', meses: 12 },
  { codigo: 'ano', rotulo: 'Ano atual', meses: null },
  { codigo: 'tudo', rotulo: 'Tudo', meses: null },
] as const;

export type AtalhoDoPeriodo = (typeof ATALHOS_DO_PERIODO)[number]['codigo'];

/** O primeiro dia do período, contado A PARTIR DO ÚLTIMO DADO, e não de hoje.
 *
 *  A BASE DE COTAÇÕES CHEGA COM ATRASO (a planilha é semanal): contado de hoje,
 *  "1M" mostraria dois pregões e um gráfico quase vazio. Contado do último
 *  fechamento, "1M" é sempre um mês de dado. `null` = desde o começo. */
export function inicioDoPeriodo(codigo: AtalhoDoPeriodo, ultimaData: string): string | null {
  if (codigo === 'tudo') return null;
  const [ano, mes, dia] = ultimaData.slice(0, 10).split('-').map(Number);
  if (codigo === 'ano') return `${ano}-01-01`;
  const atalho = ATALHOS_DO_PERIODO.find((a) => a.codigo === codigo);
  const meses = atalho?.meses ?? 0;
  //: DIA PRESO AO FIM DO MÊS: 31/03 menos um mês é 28 (ou 29) de fevereiro, e
  //: não 03/03 — que é o que `Date.UTC(ano, 1, 31)` daria por transbordo.
  const alvo = new Date(Date.UTC(ano, mes - 1 - meses, 1));
  const ultimoDoMesAlvo = new Date(
    Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0),
  ).getUTCDate();
  alvo.setUTCDate(Math.min(dia, ultimoDoMesAlvo));
  return comoIso(alvo.getTime());
}

/* -- as escalas dos eixos -------------------------------------------------- */

export interface Faixa {
  minimo: number;
  maximo: number;
}

export interface Escala extends Faixa {
  passo: number;
  marcas: number[];
}

const PASSOS_REDONDOS = [1, 2, 2.5, 5, 10];

/** O passo redondo (1; 2; 2,5; 5 ou 10 × potência de 10) para ~`divisoes`
 *  intervalos numa amplitude. */
export function passoRedondo(amplitude: number, divisoes = 5): number {
  if (!(amplitude > 0)) return 1;
  const bruto = amplitude / divisoes;
  const potencia = Math.pow(10, Math.floor(Math.log10(bruto)));
  const fator = PASSOS_REDONDOS.find((c) => c * potencia >= bruto - 1e-12) ?? 10;
  return fator * potencia;
}

/** As marcas de um passo dentro da faixa, sem o erro de ponto flutuante
 *  (`0.1 + 0.2`) virar marca `90.30000000004`. */
export function marcasDaFaixa(faixa: Faixa, passo: number): number[] {
  const marcas: number[] = [];
  const primeira = Math.ceil(faixa.minimo / passo - 1e-9) * passo;
  for (let v = primeira; v <= faixa.maximo + passo * 1e-9; v += passo) {
    marcas.push(Math.round(v * 1e6) / 1e6);
    if (marcas.length > 50) break;
  }
  return marcas;
}

/** A escala AUTOMÁTICA do preço (ou yield): só com os valores visíveis, folga
 *  de 8% e as pontas puxadas para a marca redonda mais próxima por fora. */
export function escalaAutomatica(valores: number[], folga = 0.08): Escala | null {
  const bons = valores.filter(Number.isFinite);
  if (!bons.length) return null;
  let minimo = Math.min(...bons);
  let maximo = Math.max(...bons);
  //: UM VALOR SÓ (ou linha reta) não tem amplitude: abre meio ponto para cada
  //: lado, senão o eixo dividiria por zero.
  if (maximo - minimo < 1e-9) {
    minimo -= 0.5;
    maximo += 0.5;
  }
  const sobra = (maximo - minimo) * folga;
  minimo -= sobra;
  maximo += sobra;
  //: O PASSO QUE MENOS SOBRA: entre os redondos que dão de 4 a 7 intervalos,
  //: o que deixa a faixa arredondada mais justa nos dados. Com um passo só,
  //: 73 a 101 virava 70 a 110, um quarto do gráfico em branco em cima.
  const candidatos = [4, 5, 6, 7].map((divisoes) => {
    const passo = passoRedondo(maximo - minimo, divisoes);
    const faixa = {
      minimo: Math.floor(minimo / passo + 1e-9) * passo,
      maximo: Math.ceil(maximo / passo - 1e-9) * passo,
    };
    return { faixa, passo, intervalos: (faixa.maximo - faixa.minimo) / passo };
  });
  const melhor = candidatos
    .filter((c) => c.intervalos >= 4 && c.intervalos <= 8)
    .sort((a, b) => a.faixa.maximo - a.faixa.minimo - (b.faixa.maximo - b.faixa.minimo))[0] ??
    candidatos[1];
  return { ...melhor.faixa, passo: melhor.passo, marcas: marcasDaFaixa(melhor.faixa, melhor.passo) };
}

/** A escala AUTOMÁTICA do score: múltiplos de 10, sem passar de 0 a 100. */
export function escalaDoScore(valores: number[]): Escala {
  const bons = valores.filter(Number.isFinite);
  let minimo = bons.length ? Math.floor((Math.min(...bons) - 5) / 10) * 10 : 0;
  let maximo = bons.length ? Math.ceil((Math.max(...bons) + 5) / 10) * 10 : 100;
  minimo = Math.max(0, minimo);
  maximo = Math.min(100, maximo);
  //: AMPLITUDE MÍNIMA DE 20: com o score parado em 62 o eixo iria de 50 a 70,
  //: não de 60 a 70 — uma variação de 1 ponto não pode ocupar meio gráfico.
  if (maximo - minimo < 20) {
    if (maximo + 10 <= 100) maximo += 10;
    if (maximo - minimo < 20) minimo = Math.max(0, minimo - 10);
  }
  const passo = maximo - minimo > 50 ? 20 : 10;
  const faixa = { minimo, maximo };
  return { ...faixa, passo, marcas: marcasDaFaixa(faixa, passo) };
}

/** A escala de uma faixa ESCOLHIDA À MÃO (zoom): a faixa fica exata — o zoom é
 *  contínuo — e só as marcas são redondas. */
export function escalaDaFaixa(faixa: Faixa): Escala {
  const passo = passoRedondo(faixa.maximo - faixa.minimo);
  return { ...faixa, passo, marcas: marcasDaFaixa(faixa, passo) };
}

/** Aproxima (`fator < 1`) ou afasta (`fator > 1`) a faixa em torno de `centro`
 *  (o meio, quando omitido). */
export function aproximar(faixa: Faixa, fator: number, centro?: number): Faixa {
  const meio = centro ?? (faixa.minimo + faixa.maximo) / 2;
  return {
    minimo: meio - (meio - faixa.minimo) * fator,
    maximo: meio + (faixa.maximo - meio) * fator,
  };
}

/** Desloca a faixa inteira em `delta` unidades do eixo. */
export function deslocar(faixa: Faixa, delta: number): Faixa {
  return { minimo: faixa.minimo + delta, maximo: faixa.maximo + delta };
}

/** Prende a faixa dentro de [piso, teto] sem mudar a amplitude (quando cabe). */
export function prender(faixa: Faixa, piso: number, teto: number): Faixa {
  const amplitude = Math.min(faixa.maximo - faixa.minimo, teto - piso);
  let minimo = faixa.minimo;
  if (minimo < piso) minimo = piso;
  if (minimo + amplitude > teto) minimo = teto - amplitude;
  return { minimo, maximo: minimo + amplitude };
}

/** Número de marca no formato pt-BR, com as casas que o passo pede. */
export function rotuloDaMarca(valor: number, passo: number): string {
  //: AS CASAS SÃO AS DO PASSO: 2,5 pede uma, 0,25 pede duas, 5 não pede nenhuma.
  const casas = Number.isInteger(passo) ? 0 : Number.isInteger(passo * 10) ? 1 : 2;
  return valor.toFixed(casas).replace('.', ',').replace('-', '−');
}

/* -- o eixo do tempo ------------------------------------------------------- */

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export interface RotuloDoTempo {
  ms: number;
  texto: string;
  /** `YYYY-MM-DD` do rótulo: o dia, ou o dia 1 do mês. */
  iso: string;
  /** O rótulo é um mês inteiro (e não um dia). */
  mensal: boolean;
}

/** Os rótulos do eixo X: DIA ("06/08") até dois meses de período, MÊS
 *  ("mai/26") acima disso, no máximo ~`maximo` rótulos. */
export function rotulosDoTempo(inicio: number, fim: number, maximo = 8): RotuloDoTempo[] {
  if (!(fim > inicio)) return [];
  const dias = (fim - inicio) / UM_DIA;
  const rotulos: RotuloDoTempo[] = [];
  if (dias <= 62) {
    const passo = [1, 2, 3, 5, 7, 10, 14].find((p) => dias / p <= maximo) ?? 14;
    for (let ms = inicio; ms <= fim + 1; ms += passo * UM_DIA) {
      const iso = comoIso(ms);
      rotulos.push({ ms, iso, texto: `${iso.slice(8, 10)}/${iso.slice(5, 7)}`, mensal: false });
    }
    return rotulos;
  }
  const meses = dias / 30.4;
  const passo = [1, 2, 3, 6, 12].find((p) => meses / p <= maximo) ?? 12;
  const comeco = new Date(inicio);
  //: O PRIMEIRO RÓTULO É O PRIMEIRO DIA 1 DENTRO DO PERÍODO: um rótulo de mês
  //: antes da borda esquerda ficaria fora do gráfico.
  let ano = comeco.getUTCFullYear();
  let mes = comeco.getUTCMonth() + (comeco.getUTCDate() > 1 ? 1 : 0);
  for (;;) {
    ano += Math.floor(mes / 12);
    mes %= 12;
    const ms = Date.UTC(ano, mes, 1);
    //: O RÓTULO NA BORDA FINAL SAI: o dia 1º que fecha o último degrau do score
    //: ficaria colado na régua da direita, sem mês nenhum depois dele.
    if (ms >= fim) break;
    if (mes % passo === 0 || passo === 1) {
      rotulos.push({
        ms,
        iso: comoIso(ms),
        texto: `${MESES[mes]}/${String(ano).slice(2)}`,
        mensal: true,
      });
    }
    mes += 1;
  }
  return rotulos;
}

/** A data do hover por extenso curto: "qui, 06/08/2026". */
export function dataPorExtensoCurto(iso: string): string {
  const dia = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][new Date(emMs(iso)).getUTCDay()];
  return `${dia}, ${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

/* -- as etiquetas da borda direita ------------------------------------------ */

/** Afasta as etiquetas que ficariam umas sobre as outras, mantendo a ordem
 *  vertical e dentro de [topo, base]. Recebe e devolve a coordenada Y (px). */
export function espalharEtiquetas(
  ys: number[],
  distancia: number,
  topo: number,
  base: number,
): number[] {
  const ordem = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y);
  for (let k = 0; k < ordem.length; k++) {
    const minimo = k === 0 ? topo : ordem[k - 1].y + distancia;
    ordem[k].y = Math.max(ordem[k].y, minimo);
  }
  //: SE ESTOUROU EMBAIXO, empurra de volta para cima, de baixo para cima.
  for (let k = ordem.length - 1; k >= 0; k--) {
    const maximo = k === ordem.length - 1 ? base : ordem[k + 1].y - distancia;
    ordem[k].y = Math.min(ordem[k].y, maximo);
  }
  const saida = new Array<number>(ys.length);
  for (const { y, i } of ordem) saida[i] = y;
  return saida;
}

/* -- a janela do navegador e a dos temas ------------------------------------ */

/** Dias corridos entre duas datas `YYYY-MM-DD`, contando as duas pontas. */
export function diasNaJanela(de: string, ate: string): number {
  return Math.round((emMs(ate) - emMs(de)) / UM_DIA) + 1;
}

/** O texto do intervalo ao lado do navegador: "mai/26 a set/26 · 6 meses", ou
 *  "21/08 a 21/09 · 32 dias" até dois meses. */
export function rotuloDaJanela(de: string, ate: string): string {
  const dias = diasNaJanela(de, ate);
  if (dias <= 62) {
    return `${de.slice(8, 10)}/${de.slice(5, 7)} a ${ate.slice(8, 10)}/${ate.slice(5, 7)} · ${dias} dias`;
  }
  const mes = (iso: string) => `${MESES[Number(iso.slice(5, 7)) - 1]}/${iso.slice(2, 4)}`;
  const meses = Math.max(1, Math.round(dias / 30.44));
  return `${mes(de)} a ${mes(ate)} · ${meses} ${meses === 1 ? 'mês' : 'meses'}`;
}

/** Uma data `YYYY-MM-DD` mais (ou menos) `dias`. */
export function somarDias(iso: string, dias: number): string {
  return comoIso(emMs(iso) + dias * UM_DIA);
}

/* -- a janela do navegador do período --------------------------------------- */

export interface JanelaDoPeriodo {
  /** `YYYY-MM-DD`. */
  de: string;
  ate: string;
}

/** A janela não fica menor que isto: abaixo de uma semana não há linha a ler. */
export const DIAS_MINIMOS_DA_JANELA = 5;

/** Prende a janela dentro do eixo, com o tamanho mínimo. */
export function prenderJanela(
  janela: JanelaDoPeriodo,
  inicio: string,
  fim: string,
): JanelaDoPeriodo {
  let de = janela.de < inicio ? inicio : janela.de;
  let ate = janela.ate > fim ? fim : janela.ate;
  if (diasNaJanela(de, ate) < DIAS_MINIMOS_DA_JANELA) {
    ate = somarDias(de, DIAS_MINIMOS_DA_JANELA - 1);
    if (ate > fim) {
      ate = fim;
      de = somarDias(fim, -(DIAS_MINIMOS_DA_JANELA - 1));
      if (de < inicio) de = inicio;
    }
  }
  return { de, ate };
}

/** Move a janela inteira `dias` para um lado, sem mudar o tamanho. */
export function moverJanelaEmDias(
  janela: JanelaDoPeriodo,
  dias: number,
  inicio: string,
  fim: string,
): JanelaDoPeriodo {
  const tamanho = diasNaJanela(janela.de, janela.ate) - 1;
  let de = somarDias(janela.de, dias);
  if (de < inicio) de = inicio;
  let ate = somarDias(de, tamanho);
  if (ate > fim) {
    ate = fim;
    de = somarDias(fim, -tamanho);
    if (de < inicio) de = inicio;
  }
  return { de, ate };
}

