/** A jornada de UMA lente — a nota dela, 0 a 100, mês a mês, no mesmo
 *  desenho da jornada do índice geral.
 *
 *  POR QUE UMA FUNÇÃO IRMÃ, E NÃO A MESMA. `jornadaDoIndice` (em
 *  `dominio/jornadaDoIndice.ts`) tem conceitos que só existem no ISR
 *  agregado: "mês parcial" (quantas das 5 lentes mediram), "maior
 *  movimento" (lente contra lente) e "sustentou/pressionou" (tema contra
 *  tema, cruzando todas as lentes). Dentro da página de UMA lente nenhum
 *  dos três faz sentido — não há "lentes faltando" quando já se escolheu
 *  uma, e comparar lente com lente dentro da própria lente é vazio. Forçar
 *  os dois casos na mesma função viraria um emaranhado de `if (lente)` no
 *  meio de uma conta que já é densa.
 *
 *  O QUE *É* REAPROVEITADO: o sistema de coordenadas (`VB`), as cinco
 *  faixas de fundo, a curva de Catmull-Rom (`curvaPor`) e o domínio
 *  adaptativo do eixo (`dominioDe`) — tudo importado de
 *  `jornadaDoIndice.ts`, para as duas jornadas nunca desenharem a mesma
 *  faixa com cores diferentes. O desenho (`graficos/JornadaDoIndice.tsx`)
 *  também é o mesmo: esta função só monta o objeto `Jornada` que ele já
 *  sabe desenhar.
 *
 *  FASE 2 (esta): a coluna do mês já diz "o que moveu a nota dentro da
 *  Imprensa" — o tema que mais sustentou e o que mais pressionou, lidos de
 *  `ponto.temas_das_lentes[lente]` (ver `app/dominio/tema_do_mes.py`,
 *  `temas_que_pesaram_na_lente`). SEM `movimento`: "maior movimento" compara
 *  lente com lente, e dentro de uma lente só não há com quem comparar — por
 *  isso ele continua sempre vazio. E SEM FATO CADASTRADO: `ScoreFato` não
 *  carrega lente nenhuma, e inventar uma afirmaria uma ligação que o cadastro
 *  não fez.
 */

import {
  FAIXAS_DE_FUNDO,
  VB,
  curvaPor,
  dominioDe,
  emPontos,
  escalaDoEixo,
  mesPorExtenso,
} from '@/dominio/jornadaDoIndice';
import type {
  ColunaDoMes,
  FaixaDeFundo,
  Jornada,
  LinhaDoMes,
  MarcaDoEixo,
  PontoDaJornada,
} from '@/dominio/jornadaDoIndice';
import { corDaFaixa, corDeAreaDaFaixa } from '@/dominio/score';
import type { PontoDaSerie, TemaDoMes } from '@/dominio/score';

const JORNADA_VAZIA: Jornada = {
  resumo: '',
  faixas: [],
  marcas: [],
  curva: '',
  pontos: [],
  colunas: [],
  curvaDaLente: '',
  pontosDaLente: [],
  fimDaLente: null,
  curvasDasLentes: [],
};

/** A frase que abre o bloco — mesmo texto de `resumoDa`, mas sobre a nota da
 *  lente, e não sobre o ISR. */
function resumoDaLente(medidos: { mes: string; nota: number }[], nomeDaLente: string): string {
  if (medidos.length < 2) return `Um mês só de ${nomeDaLente} — ainda não há jornada para ler.`;

  const notas = medidos.map((ponto) => ponto.nota);
  const diferenca = Math.abs(notas[notas.length - 1] - notas[0]);
  const sentido = notas[notas.length - 1] >= notas[0] ? 'acima' : 'abaixo';
  const pontos = diferenca === 1 ? 'ponto' : 'pontos';

  const minimo = Math.min(...notas);
  const maximo = Math.max(...notas);
  const doVale = medidos[notas.indexOf(minimo)];
  const doPico = medidos[notas.indexOf(maximo)];

  const abertura =
    `${nomeDaLente} fecha o período ${diferenca} ${pontos} ${sentido} de ` +
    `${mesPorExtenso(medidos[0].mes)}.`;
  const vale = `O vale foi ${mesPorExtenso(doVale.mes)} (${minimo})`;
  return doPico.mes === doVale.mes
    ? `${abertura} ${vale}.`
    : `${abertura} ${vale} e o pico, ${mesPorExtenso(doPico.mes)} (${maximo}).`;
}

/** Tudo o que a jornada de uma lente desenha, já posicionado — mesmo
 *  formato (`Jornada`) que `jornadaDoIndice` devolve, para
 *  `graficos/JornadaDoIndice.tsx` desenhar os dois sem saber a diferença. */
export function jornadaDaLente(
  serie: PontoDaSerie[],
  lente: string,
  nomeDaLente: string,
  mesSelecionado: string,
): Jornada {
  const medidos = serie
    .map((ponto) => ({
      mes: ponto.mes,
      nota: ponto.notas_das_lentes[lente],
      temas: ponto.temas_das_lentes[lente],
    }))
    .filter(
      (par): par is { mes: string; nota: number; temas: PontoDaSerie['temas_das_lentes'][string] } =>
        par.nota !== undefined,
    );
  const total = medidos.length;
  if (!total) return { ...JORNADA_VAZIA, resumo: resumoDaLente(medidos, nomeDaLente) };

  const notas = medidos.map((ponto) => ponto.nota);
  const { piso, teto } = dominioDe(notas);
  //: A MESMA ESCALA DA JORNADA DO ÍNDICE, e não uma cópia da conta: as duas telas
  //: são o mesmo gráfico, e foi por cada uma ter a sua conta de `y` que a folga no
  //: limite do índice entrou numa e não na outra.
  const { y } = escalaDoEixo(piso, teto);
  const x = (i: number) => ((i + 0.5) / total) * VB.largura;

  const faixas: FaixaDeFundo[] = FAIXAS_DE_FUNDO.filter(
    (faixa) => faixa.ate > piso && faixa.de < teto,
  ).map((faixa) => {
    const baixo = Math.max(faixa.de, piso);
    const alto = Math.min(faixa.ate, teto);
    return {
      rotulo: faixa.rotulo,
      y: y(alto),
      altura: y(baixo) - y(alto),
      fundo: faixa.fundo,
      cor: faixa.cor,
      centro: (((y(alto) + y(baixo)) / 2) / VB.altura) * 100,
    };
  });

  const marcas: MarcaDoEixo[] = [];
  for (let valor = Math.ceil(piso / 10) * 10; valor <= teto; valor += 10) {
    marcas.push({ valor, topo: (y(valor) / VB.altura) * 100 });
  }

  const pontos: PontoDaJornada[] = medidos.map((ponto, i) => {
    const nota = ponto.nota;
    return {
      mes: ponto.mes,
      esquerda: (x(i) / VB.largura) * 100,
      //: NO LUGAR DO VALOR, como na do índice: havia um corte aqui, e era ele
      //: que desenhava o ponto fantasma — uma bolinha encostada na borda dizendo
      //: uma altura que não era a do número ao lado dela.
      topo: (y(nota) / VB.altura) * 100,
      cx: x(i),
      cy: y(nota),
      isr: nota,
      cor: corDeAreaDaFaixa(nota),
      corDoTexto: corDaFaixa(nota),
      // SEM TAG, SEM COBERTURA: são do fato cadastrado e do "quantas lentes
      // mediram" — conceitos do ISR agregado, sem equivalente aqui na Fase 1.
      tag: '',
      corDaTag: 'transparent',
      //: O NÚMERO SEMPRE ACIMA DO PONTO, por pedido — a leitura fica numa linha
      //: só, e a folga do topo (`PAD_TOPO`) reserva o lugar dele no mês mais alto.
      acima: true,
      selecionado: ponto.mes === mesSelecionado,
      parcial: false,
      cobertura: '',
      descricao: `${mesPorExtenso(ponto.mes)}: ${nomeDaLente} ${nota}, faixa ${faixaDoValor(nota)}`,
    };
  });

  const colunas: ColunaDoMes[] = medidos.map((ponto, i) => ({
    mes: ponto.mes,
    nome: mesPorExtenso(ponto.mes),
    variacao:
      i === 0
        ? 'ponto de partida'
        : `${ponto.nota - notas[i - 1] > 0 ? '+' : '−'}${Math.abs(ponto.nota - notas[i - 1])} no mês`,
    linhas: linhasDaLente(ponto.temas),
    // SEM FATO CADASTRADO, SEM FILETE: o filete segue o primeiro fato
    // cadastrado em `jornadaDoIndice.ts`, e `ScoreFato` não tem lente — ver o
    // cabeçalho deste arquivo.
    filete: 'var(--borda)',
    // SEM "MAIOR MOVIMENTO": compara lente com lente, e aqui já se escolheu
    // uma.
    movimento: '',
    semTema: ponto.temas?.pontos_sem_tema ? `${emPontos(ponto.temas.pontos_sem_tema)} sem tema` : '',
    selecionada: ponto.mes === mesSelecionado,
  }));

  return {
    resumo: resumoDaLente(medidos, nomeDaLente),
    faixas,
    marcas,
    curva: curvaPor(notas.map((nota, i) => [x(i), y(nota)])),
    pontos,
    colunas,
    curvaDaLente: '',
    pontosDaLente: [],
    fimDaLente: null,
    curvasDasLentes: [],
  };
}

/** As linhas da coluna de um mês: só o que a BASE derivou, dentro da lente.
 *
 *  SEM FATO CADASTRADO — ver o cabeçalho do arquivo —, por isso esta lista
 *  nunca mistura `origem: 'cadastro'` como `linhasDoMes` faz em
 *  `jornadaDoIndice.ts`. */
function linhasDaLente(temas: PontoDaSerie['temas_das_lentes'][string] | undefined): LinhaDoMes[] {
  if (!temas) return [];
  return [temas.sustentou, temas.pressionou]
    .filter((tema): tema is TemaDoMes => tema !== null)
    .map((tema) => ({
      texto: tema.tema,
      efeito: tema.efeito,
      origem: 'base' as const,
      evidencia: emPontos(tema.pontos),
    }));
}

function faixaDoValor(valor: number): string {
  const faixa = [...FAIXAS_DE_FUNDO].reverse().find((f) => valor >= f.de);
  return faixa?.rotulo ?? FAIXAS_DE_FUNDO[0].rotulo;
}
