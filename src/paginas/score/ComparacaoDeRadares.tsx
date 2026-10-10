/** "Comparação de períodos": dois radares lado a lado, logo abaixo do Radar
 *  Reputacional da Visão geral.
 *
 *  CADA LADO COM O SEU SELETOR DE MÊS, o mesmo do Radar Reputacional, por
 *  pedido. Por padrão, a direita é o mês escolhido lá em cima e a esquerda, o
 *  mês anterior a ele.
 *
 *  ESCONDIDA ATÉ ALGUÉM EXPANDIR, por pedido: é uma leitura de apoio, e o
 *  radar de cima continua sendo o que a pessoa vê primeiro. Fechada, nada é
 *  buscado — os dois meses só são pedidos ao servidor quando ela abre.
 *
 *  A NOTA DE CADA LADO É A OFICIAL DO MÊS (`obterScore`), e não uma conta da
 *  tela: os dois radares são o mesmo radar de cima, em outro mês.
 */

import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { obterScore } from "@/api/cliente";
import { BlocoExpansivel } from "@/componentes/BlocoExpansivel";
import { Carregando, Cartao, FaixaDeErro } from "@/componentes/basicos";
import { SeletorDeMes } from "@/componentes/SeletorDeMes";
import { RadialDasLentes } from "@/graficos/RadialDasLentes";
import { comoDelta, corDaFaixa, corDoDelta } from "@/dominio/score";
import type { IndiceDoScore } from "@/dominio/score";

/** O mês anterior que tem dado; sem ele, o próprio mês. */
function mesAnteriorDisponivel(meses: string[], mes: string): string {
  const posicao = meses.indexOf(mes);
  return posicao > 0 ? meses[posicao - 1] : mes;
}

export function ComparacaoDeRadares(props: {
  meses: string[];
  sugerido: string | null;
  mesAtual: string;
  aoAbrirLente: (codigo: string) => void;
}) {
  const [aberto, definirAberto] = useState(false);
  return (
    <BlocoExpansivel
      titulo="Comparação de períodos"
      descricao="Dois radares lado a lado, cada um com o seu mês. Por padrão, o mês escolhido acima e o anterior a ele."
      aberto={aberto}
      aoAlternar={() => definirAberto(!aberto)}
    >
      {/* OS DOIS VOLTAM AO PADRÃO QUANDO O MÊS DE CIMA MUDA (a chave), e o card
          continua aberto. */}
      <DoisRadares key={props.mesAtual} {...props} />
    </BlocoExpansivel>
  );
}

function DoisRadares({
  meses,
  sugerido,
  mesAtual,
  aoAbrirLente,
}: {
  /** Os meses com dado, em ordem crescente — os mesmos do seletor de cima. */
  meses: string[];
  sugerido: string | null;
  /** O mês escolhido no Radar Reputacional: o padrão da direita. */
  mesAtual: string;
  aoAbrirLente: (codigo: string) => void;
}) {
  const [esquerda, definirEsquerda] = useState(() =>
    mesAnteriorDisponivel(meses, mesAtual),
  );
  const [direita, definirDireita] = useState(mesAtual);
  const indiceDaEsquerda = useIndiceDoMes(esquerda);
  const indiceDaDireita = useIndiceDoMes(direita);

  return (
    <div className="grade grade--2" style={{ gap: 16 }}>
      <CartaoDoRadar
        rotulo="Período comparativo"
        estado={indiceDaEsquerda}
        aoAbrirLente={aoAbrirLente}
        seletor={
          <SeletorDeMes
            meses={meses}
            valor={esquerda}
            sugerido={sugerido}
            aoEscolher={definirEsquerda}
          />
        }
      />
      <CartaoDoRadar
        rotulo="Período atual"
        estado={indiceDaDireita}
        aoAbrirLente={aoAbrirLente}
        seletor={
          <SeletorDeMes
            meses={meses}
            valor={direita}
            sugerido={sugerido}
            aoEscolher={definirDireita}
          />
        }
        comparadoCom={indiceDaEsquerda.indice}
      />
    </div>
  );
}

interface EstadoDoIndice {
  indice: IndiceDoScore | null;
  erro: string | null;
}

/** O índice de um mês, buscado de novo a cada troca. A resposta de um mês
 *  antigo que chegue depois da do mês novo é descartada. */
function useIndiceDoMes(mes: string): EstadoDoIndice {
  const [estado, definirEstado] = useState<
    EstadoDoIndice & { mes: string | null }
  >({
    mes: null,
    indice: null,
    erro: null,
  });
  useEffect(() => {
    let ativo = true;
    obterScore(mes)
      .then((indice) => ativo && definirEstado({ mes, indice, erro: null }))
      .catch(
        (falha: unknown) =>
          ativo &&
          definirEstado({
            mes,
            indice: null,
            erro:
              falha instanceof Error
                ? falha.message
                : "Não foi possível carregar.",
          }),
      );
    return () => {
      ativo = false;
    };
  }, [mes]);
  //: ENQUANTO O MÊS NOVO NÃO CHEGA, nada — e não o radar do mês anterior com o
  //: rótulo do novo.
  return estado.mes === mes ? estado : { indice: null, erro: null };
}

function CartaoDoRadar({
  rotulo,
  estado,
  aoAbrirLente,
  seletor,
  comparadoCom,
}: {
  rotulo: string;
  estado: EstadoDoIndice;
  aoAbrirLente: (codigo: string) => void;
  seletor: ReactNode;
  /** Só no atual: o índice do comparativo, para a variação. */
  comparadoCom?: IndiceDoScore | null;
}) {
  const [destacada, definirDestacada] = useState<string | null>(null);
  const { indice, erro } = estado;
  const variacao =
    comparadoCom && indice && indice.isr !== null && comparadoCom.isr !== null
      ? indice.isr - comparadoCom.isr
      : null;

  return (
    <Cartao estilo={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <span className="kicker">{rotulo}</span>
        {seletor}
      </div>

      {erro ? <FaixaDeErro mensagem={erro} /> : null}
      {!indice && !erro ? <Carregando /> : null}
      {indice ? (
        <>
          <RadialDasLentes
            lentes={indice.lentes}
            isr={indice.isr}
            faixa={indice.faixa}
            corDoIsr={corDaFaixa(indice.isr)}
            porPeso={indice.calibracao.radial_por_peso}
            destacada={destacada}
            aoDestacar={definirDestacada}
            aoAbrir={aoAbrirLente}
          />
          {comparadoCom !== undefined ? (
            <p
              style={{
                margin: 0,
                textAlign: "center",
                fontSize: 12,
                color: "var(--cinza-2)",
              }}
            >
              <strong style={{ color: corDoDelta(variacao) }}>
                {comoDelta(variacao)}
              </strong>{" "}
              no índice vs. o período comparativo
            </p>
          ) : null}
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            {indice.lentes.map((lente) => {
              const antes =
                comparadoCom?.lentes.find((l) => l.codigo === lente.codigo)
                  ?.score ?? null;
              const delta =
                comparadoCom && lente.score !== null && antes !== null
                  ? lente.score - antes
                  : null;
              return (
                <li
                  key={lente.codigo}
                  onMouseEnter={() => definirDestacada(lente.codigo)}
                  onMouseLeave={() => definirDestacada(null)}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                    fontSize: 12.5,
                    padding: "4px 8px",
                    borderRadius: 6,
                    background:
                      destacada === lente.codigo
                        ? "var(--bg-trilho)"
                        : "transparent",
                  }}
                >
                  <span style={{ color: "var(--cinza-3)" }}>{lente.nome}</span>
                  <span
                    className="tabular"
                    style={{ display: "flex", gap: 10 }}
                  >
                    {comparadoCom !== undefined ? (
                      <span
                        style={{ color: corDoDelta(delta), fontWeight: 700 }}
                      >
                        {comoDelta(delta)}
                      </span>
                    ) : null}
                    <strong
                      style={{
                        color: corDaFaixa(lente.score),
                        minWidth: 22,
                        textAlign: "right",
                      }}
                    >
                      {lente.score ?? "—"}
                    </strong>
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
    </Cartao>
  );
}
