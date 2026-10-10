/** A Jornada inteira — cartões da janela, "Comparar com" (opcional), gráfico,
 *  mini linha do tempo e legenda —, num bloco só, usado em dois lugares:
 *
 *  - na VISÃO GERAL, sobre o ISR, com o "Comparar com" das lentes;
 *  - no topo de cada LENTE, sobre a nota daquela lente, sem "Comparar com"
 *    (dentro da lente só se vê a jornada dela mesma).
 *
 *  UM COMPONENTE, E NÃO DUAS CÓPIAS: a janela, os cartões, o pico e o vale têm
 *  de se comportar igual nas duas telas, e duas cópias divergiriam no primeiro
 *  ajuste.
 *
 *  O CABEÇALHO DIZ EM QUE PÉ O NÚMERO ESTÁ (`fraseDaJanela`): o valor atual
 *  contra a média da janela, o pico e o vale, e a variação no período — e muda
 *  com a janela, junto dos cartões.
 */

import { useState } from 'react';

import { Cartao, Chip, ComFaixaDoTopo, Secao } from '@/componentes/basicos';
import { CartoesDaJanela } from '@/graficos/CartoesDaJanela';
import { JornadaDoIndice } from '@/graficos/JornadaDoIndice';
import { SeletorDeJanela } from '@/graficos/SeletorDeJanela';
import {
  CODIGO_DO_INDICE,
  ajustar,
  fraseDaJanela,
  janelaDoAtalho,
  kpisDaJanela,
  mesesMedidos,
  serieDaJanela,
} from '@/dominio/janelaDaJornada';
import type { Janela } from '@/dominio/janelaDaJornada';
import { fraseDosParciais, jornadaDoIndice } from '@/dominio/jornadaDoIndice';
import { corDaLente } from '@/dominio/score';
import type { PontoDaSerie } from '@/dominio/score';

//: PICO VERDE E VALE VERMELHO — nos tons escuros de "ok" e "erro", que seguem
//: legíveis como traço fino e como rótulo sobre as faixas de fundo.
const COR_DO_PICO = 'var(--ok-fg)';
const COR_DO_VALE = 'var(--erro-fg)';

//: O TEXTO DO CHIP CHEIO, sobre a cor da lente: escuro nas cores claras
//: (turquesa, laranja), branco nas escuras — legível nas cinco.
const TEXTO_SOBRE_A_LENTE: Record<string, string> = {
  imprensa: 'var(--sobre-turquesa)',
  sociedade: 'var(--cinza-4)',
};

export function PainelDaJornada({
  titulo,
  sujeito,
  serie,
  mes,
  aoEscolherMes,
  aoAprofundarNoMes,
  lentesParaComparar,
  comIndiceGeral = false,
  dica,
}: {
  titulo: string;
  /** Quem a frase do cabeçalho descreve: "O índice", "A lente Imprensa". */
  sujeito: string;
  /** A série no formato do índice (`isr` é o número desenhado). */
  serie: PontoDaSerie[];
  mes: string;
  aoEscolherMes: (mes: string) => void;
  aoAprofundarNoMes?: (mes: string) => void;
  /** Presente, aparece o "Comparar com" com estas lentes. Ausente, não. */
  lentesParaComparar?: { codigo: string; nome: string }[];
  /** Desenha sempre o índice geral, pontilhado, para comparar — na Jornada de
   *  uma lente. A série precisa vir de `serieDaLente`, que o carrega. */
  comIndiceGeral?: boolean;
  /** A linha que ensina o gesto, no fim da legenda. */
  dica: string;
}) {
  //: VÁRIAS LENTES DE UMA VEZ: cada clique acrescenta a linha de uma lente, e
  //: ela fica até sair pelo ×. Estado de leitura — não muda número nenhum.
  const [comparadas, definirComparadas] = useState<string[]>([]);
  const alternarComparada = (codigo: string) =>
    definirComparadas((atuais) =>
      atuais.includes(codigo) ? atuais.filter((c) => c !== codigo) : [...atuais, codigo],
    );
  const nomesDasLentes: Record<string, string> = {
    ...Object.fromEntries((lentesParaComparar ?? []).map((lente) => [lente.codigo, lente.nome])),
    [CODIGO_DO_INDICE]: 'Índice geral',
  };
  //: AS CURVAS DE COMPARAÇÃO: o índice geral primeiro, quando pedido, e as
  //: lentes que a pessoa escolheu.
  const curvas = comIndiceGeral ? [CODIGO_DO_INDICE, ...comparadas] : comparadas;

  //: A JANELA, escolhida na mini linha do tempo. Nula = os últimos 6 meses.
  const [janelaEscolhida, definirJanela] = useState<Janela | null>(null);
  const [mostrarPico, definirMostrarPico] = useState(true);
  const [mostrarVale, definirMostrarVale] = useState(true);
  const meses = mesesMedidos(serie);
  //: `ajustar` A CADA RENDER: a série pode crescer ou encolher, e uma janela
  //: guardada com índices de outra série sairia da borda.
  const janela = janelaEscolhida
    ? ajustar(janelaEscolhida, meses.length)
    : janelaDoAtalho('6m', meses);
  const serieRecortada = serieDaJanela(serie, janela);
  const kpis = kpisDaJanela(serieRecortada);
  const jornada = jornadaDoIndice(serieRecortada, mes, curvas, nomesDasLentes);
  //: A CONTAGEM DE PARCIAIS VEM DA JORNADA, e não de uma releitura da série com
  //: o `4` escrito à mão: dois lugares decidindo o que é "parcial" é um a mais.
  const mesesParciais = jornada.pontos.filter((ponto) => ponto.parcial).length;

  return (
    <ComFaixaDoTopo>
      <Secao titulo={titulo}>
        <Cartao>
          {/* A LEITURA, EM FONTE DE TEXTO, por pedido: é a frase que se lê
              antes dos números — em que pé o índice está —, e não um subtítulo
              que descreve a tela. Muda com a janela, junto dos cartões. */}
          <p
            aria-live="polite"
            style={{
              margin: '0 0 16px',
              fontSize: 15,
              lineHeight: 1.5,
              color: 'var(--cinza-4)',
            }}
          >
            <ComNumerosEmNegrito texto={fraseDaJanela(kpis, sujeito)} />
          </p>
          <CartoesDaJanela kpis={kpis} />

          {/* "COMPARAR COM" CENTRALIZADO SOBRE O GRÁFICO, por pedido. Só na
              Visão geral: dentro da lente não há outra lente a comparar. */}
          {lentesParaComparar ? (
            <div
              style={{
                display: 'flex',
                gap: 6,
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 18,
              }}
            >
              <span className="kicker">Comparar com</span>
              <Chip
                rotulo="Só o índice"
                ativo={comparadas.length === 0}
                aoClicar={() => definirComparadas([])}
              />
              {/* CADA CHIP NA COR DA LENTE, a mesma da curva e do radar: com a
                  borda antes de escolher e cheio depois, com o × para tirar. */}
              {lentesParaComparar.map((lente) => {
                const ativa = comparadas.includes(lente.codigo);
                const cor = corDaLente(lente.codigo);
                return (
                  <Chip
                    key={lente.codigo}
                    rotulo={lente.nome}
                    ativo={ativa}
                    fundo={ativa ? cor : 'var(--branco)'}
                    texto={ativa ? (TEXTO_SOBRE_A_LENTE[lente.codigo] ?? 'var(--branco)') : 'var(--cinza-3)'}
                    titulo={ativa ? `Tirar a linha de ${lente.nome}` : `Mostrar a linha de ${lente.nome}`}
                    estilo={{ border: `1.5px solid ${cor}` }}
                    aoClicar={() => alternarComparada(lente.codigo)}
                  />
                );
              })}
            </div>
          ) : null}

          <div style={{ marginTop: lentesParaComparar ? 12 : 18 }}>
            <JornadaDoIndice
              semDetalheDoMes
              serie={serieRecortada}
              mes={mes}
              comparada={curvas}
              nomeDaComparada={nomesDasLentes}
              aoEscolherMes={aoEscolherMes}
              aoAprofundarNoMes={aoAprofundarNoMes}
              // MAIS ALTO QUE O PADRÃO (260px): com os cartões em cima e o
              // cartão do mês fora, o gráfico ganhou o espaço.
              altura={330}
              linhasDeReferencia={[
                ...(mostrarPico && kpis.pico
                  ? [{ chave: 'pico', valor: kpis.pico.valor, rotulo: `Pico ${kpis.pico.valor}`, cor: COR_DO_PICO }]
                  : []),
                ...(mostrarVale && kpis.vale
                  ? [{ chave: 'vale', valor: kpis.vale.valor, rotulo: `Vale ${kpis.vale.valor}`, cor: COR_DO_VALE, abaixo: true }]
                  : []),
              ]}
            />
            <SeletorDeJanela
              //: O TRILHO PEDE `{ mes, valor }`, e aqui o valor é o ISR: o
              //: controle serve a qualquer série mensal, e o Risk Tracking usa
              //: o mesmo com o índice de exposição.
              meses={meses.map((ponto) => ({ mes: ponto.mes, valor: ponto.isr }))}
              janela={janela}
              aoMudar={definirJanela}
            />
          </div>

          <div
            style={{
              display: 'flex',
              gap: 14,
              flexWrap: 'wrap',
              alignItems: 'center',
              marginTop: 16,
              fontSize: 11.5,
              color: 'var(--cinza-2)',
            }}
          >
            {/* AS LINHAS DE PICO E VALE SE LIGAM E DESLIGAM AQUI, na legenda.
                Cada uma some quando não há mês da janela medido por 4 lentes. */}
            {kpis.pico ? (
              <BotaoDaLinha
                rotulo={`Pico da janela (${kpis.pico.valor})`}
                cor={COR_DO_PICO}
                ligada={mostrarPico}
                aoAlternar={() => definirMostrarPico((atual) => !atual)}
              />
            ) : null}
            {kpis.vale ? (
              <BotaoDaLinha
                rotulo={`Vale da janela (${kpis.vale.valor})`}
                cor={COR_DO_VALE}
                ligada={mostrarVale}
                aoAlternar={() => definirMostrarVale((atual) => !atual)}
              />
            ) : null}
            {comIndiceGeral ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span
                  aria-hidden
                  style={{ width: 18, height: 0, borderTop: '2px dotted var(--cinza-3)' }}
                />
                Índice geral
              </span>
            ) : null}
            {mesesParciais ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span
                  style={{ width: 11, height: 11, borderRadius: '50%', border: '2px dashed var(--cinza-2)' }}
                />
                {fraseDosParciais(mesesParciais)}
              </span>
            ) : null}
            <span>{dica}</span>
          </div>
        </Cartao>
      </Secao>
    </ComFaixaDoTopo>
  );
}

/** A frase com os números em negrito, por pedido — são eles que se procuram
 *  ao ler. OS ANOS FICAM FORA ("abril de 2026"): quatro dígitos depois de "de"
 *  são data, e em negrito a frase ficaria pesada sem dizer nada a mais. */
function ComNumerosEmNegrito({ texto }: { texto: string }) {
  const pedacos = texto.split(/([−-]?\d+(?:,\d+)?)/);
  return (
    <>
      {pedacos.map((pedaco, i) => {
        const ehNumero = i % 2 === 1;
        const ehAno = ehNumero && /^\d{4}$/.test(pedaco) && /de $/.test(pedacos[i - 1] ?? '');
        return ehNumero && !ehAno ? <strong key={i}>{pedaco}</strong> : <span key={i}>{pedaco}</span>;
      })}
    </>
  );
}

/** Um item da legenda que liga e desliga uma linha de referência. */
function BotaoDaLinha({
  rotulo,
  cor,
  ligada,
  aoAlternar,
}: {
  rotulo: string;
  cor: string;
  ligada: boolean;
  aoAlternar: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={ligada}
      onClick={aoAlternar}
      title={ligada ? 'Esconder a linha' : 'Mostrar a linha'}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        padding: '2px 8px',
        border: '1px solid var(--borda)',
        borderRadius: 'var(--r-chip)',
        background: ligada ? 'var(--branco)' : 'var(--bg-trilho)',
        color: ligada ? 'var(--cinza-3)' : 'var(--cinza-2)',
        fontSize: 11.5,
        cursor: 'pointer',
        textDecoration: ligada ? 'none' : 'line-through',
      }}
    >
      <span aria-hidden style={{ width: 16, height: 0, borderTop: `1.5px dashed ${cor}` }} />
      {rotulo}
    </button>
  );
}
