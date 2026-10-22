/** Dois cards da Síntese executiva que se filtram juntos:
 *
 *  - "N1 › N2 › N3": três gráficos de barras deitadas, lado a lado — N1
 *    Atributo Reputacional, N2 Temas estratégicos, N3 Subtemas —, do maior para
 *    o menor, com o sentimento dentro da barra e o impacto na nota na ponta;
 *  - "Termômetro por UF": o mapa do Brasil do CRM, com a cor da bolha no
 *    termômetro (NSS) da UF e o tamanho no score dela.
 *
 *  CLICAR NUM ITEM FILTRA OS OUTROS GRÁFICOS E O MAPA (por pedido), e clicar de
 *  novo desfaz. O gráfico do próprio item continua inteiro, com ele em
 *  destaque. A conta mora em `dominio/explorador`; o servidor manda o mês em
 *  grupos uma vez só, e o clique é soma no navegador.
 *
 *  O FILTRO DA TELA (Concessionária, Tier, Sentimento) VALE AQUI: ele vai no
 *  pedido, como em todo o dossiê.
 */

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { scaleLinear } from 'd3-scale';

import type { ExploradorDaLente as Dados, FiltroDaLente } from '@/api/cliente';
import { obterExploradorDaLente } from '@/api/cliente';
import { Carregando, ComFaixaDoTopo, Secao } from '@/componentes/basicos';
import {
  CORES_DO_SENTIMENTO,
  barrasDoNivel,
  textoDoImpacto,
  ufsDoExplorador,
} from '@/dominio/explorador';
import type { Nivel, Selecao } from '@/dominio/explorador';
import { numero } from '@/dominio/formato';
import { CORES_DE_CLIMA, rotuloDeAbrangencia } from '@/dominio/frentes';
import { ColunasEmpilhadas } from '@/graficos/ColunasEmpilhadas';
import { MapaUf } from '@/graficos/MapaUf';


//: OS NOMES EM USO NO PRODUTO, por pedido — os mesmos da Base de dados e dos
//: filtros: Atributo (N1), Tema estratégico (N2), Subtema (N3).
const NOMES: Record<Nivel, string> = {
  n1: 'Atributo (N1)',
  n2: 'Tema estratégico (N2)',
  n3: 'Subtema (N3)',
};

const COLUNAS_DO_RANKING = 'minmax(0, 1fr) 96px 56px';

//: O NOME DO ESTADO, para o ranking se ler sem conhecer as siglas.
const NOME_DA_UF: Record<string, string> = {
  AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceará',
  DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão',
  MT: 'Mato Grosso', MS: 'Mato Grosso do Sul', MG: 'Minas Gerais', PA: 'Pará',
  PB: 'Paraíba', PR: 'Paraná', PE: 'Pernambuco', PI: 'Piauí', RJ: 'Rio de Janeiro',
  RN: 'Rio Grande do Norte', RS: 'Rio Grande do Sul', RO: 'Rondônia', RR: 'Roraima',
  SC: 'Santa Catarina', SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins',
};

//: O TERMÔMETRO EM COR, divergente: vermelho no −100, cinza no zero, turquesa
//: no +100 — sem matiz no meio, para o neutro não parecer bom nem ruim.
const corDoNss = scaleLinear<string>()
  .domain([-100, 0, 100])
  .range([CORES_DE_CLIMA.tenso, CORES_DE_CLIMA.neutro, CORES_DE_CLIMA.propositivo])
  .clamp(true);

export function ExploradorDaLente({
  codigo,
  mes,
  filtro,
}: {
  codigo: string;
  mes: string;
  filtro: FiltroDaLente;
}) {
  //: OS DADOS COM A CHAVE DO PEDIDO de que são: a tela usa só os que batem
  //: com o mês e o filtro atuais, sem zerar nada dentro do efeito.
  const chave = `${codigo}|${mes}|${JSON.stringify(filtro)}`;
  const [carregados, definirCarregados] = useState<{
    chave: string;
    dados: Dados | null;
    erro?: string;
  } | null>(null);
  const [selecao, definirSelecao] = useState<Selecao>({});

  useEffect(() => {
    let ativo = true;
    obterExploradorDaLente(codigo, mes, filtro)
      .then((dados) => ativo && definirCarregados({ chave, dados }))
      .catch((falha) =>
        ativo &&
        definirCarregados({
          chave,
          dados: null,
          erro: falha instanceof Error ? falha.message : 'Não foi possível ler.',
        }),
      );
    return () => {
      ativo = false;
    };
  }, [codigo, mes, filtro, chave]);

  const atuais = carregados?.chave === chave ? carregados : null;
  const alternar = (nivel: Nivel, valor: string) =>
    definirSelecao((atual) => ({ ...atual, [nivel]: atual[nivel] === valor ? undefined : valor }));
  const escolhidos = (Object.keys(NOMES) as Nivel[]).filter((nivel) => selecao[nivel]);

  const filtrando = escolhidos.length ? (
    <div
      style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 14 }}
    >
      <span className="kicker">Filtrando por</span>
      {escolhidos.map((nivel) => (
        <button
          key={nivel}
          type="button"
          className="chip"
          onClick={() => alternar(nivel, selecao[nivel] as string)}
          aria-label={`Tirar o filtro ${NOMES[nivel]}: ${selecao[nivel]}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '3px 10px',
            border: '1px solid var(--cor-da-lente, var(--azul-mar))',
            borderRadius: 'var(--r-chip)',
            background: 'var(--branco)',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          <span style={{ color: 'var(--cinza-2)' }}>{NOMES[nivel].split(' ')[0]}</span>
          <strong>{selecao[nivel]}</strong>
          <span aria-hidden>×</span>
        </button>
      ))}
      <button
        type="button"
        onClick={() => definirSelecao({})}
        style={{
          border: 'none',
          background: 'transparent',
          color: 'var(--cinza-3)',
          fontSize: 12,
          textDecoration: 'underline',
          cursor: 'pointer',
        }}
      >
        Limpar
      </button>
    </div>
  ) : null;

  return (
    <>
      <ComFaixaDoTopo>
        <Secao
          titulo="Atributos, temas estratégicos e subtemas"
          subtitulo="Matérias por sentimento, da maior para a menor, com o impacto na nota da lente (pontos). Clique num item para filtrar os outros gráficos e o mapa."
        >
          {!atuais ? <Carregando /> : null}
          {atuais?.erro ? (
            <p style={{ color: 'var(--erro-fg)', fontSize: 13 }}>{atuais.erro}</p>
          ) : null}
          {atuais?.dados ? (
            <>
              <Legenda />
              {filtrando}
              <div className="grade grade--3" style={{ gap: 20 }}>
                {(Object.keys(NOMES) as Nivel[]).map((nivel) => {
                  const barras = barrasDoNivel(
                    atuais.dados!.grupos,
                    nivel,
                    selecao,
                    atuais.dados!.denominador,
                  );
                  return (
                    <div key={nivel} style={{ minWidth: 0 }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'baseline',
                          gap: 8,
                          paddingBottom: 8,
                          marginBottom: 8,
                          borderBottom: '1px solid var(--borda)',
                        }}
                      >
                        <h3 style={{ margin: 0, fontSize: 14, color: 'var(--cor-dos-titulos, var(--azul-mar))' }}>
                          {NOMES[nivel]}
                        </h3>
                        <span style={{ fontSize: 11.5, color: 'var(--cinza-2)' }}>
                          {barras.length} {barras.length === 1 ? 'item' : 'itens'}
                        </span>
                      </div>
                      <ColunasEmpilhadas
                        semLegenda
                        rotuloEmCima
                        espessura={8}
                        alturaMaxima={360}
                        cores={CORES_DO_SENTIMENTO}
                        vazio="Nada classificado neste nível no recorte."
                        ativo={selecao[nivel]}
                        aoClicar={(valor) => alternar(nivel, valor)}
                        itens={barras.map((barra) => ({
                          ...barra,
                          detalhe: `${textoDoImpacto(barra.impacto)} pts`,
                        }))}
                      />
                    </div>
                  );
                })}
              </div>
            </>
          ) : null}
        </Secao>
      </ComFaixaDoTopo>

      <ComFaixaDoTopo>
        <Secao
          titulo="Termômetro por UF"
          subtitulo="A cor da bola é o termômetro (NSS) das matérias de cada estado; o tamanho é o score da UF, de 0 a 100. Segue o filtro de N1, N2 e N3 acima."
        >
          {!atuais ? <Carregando /> : null}
          {atuais?.dados ? <MapaDoTermometro dados={atuais.dados} selecao={selecao} filtrando={filtrando} /> : null}
        </Secao>
      </ComFaixaDoTopo>
    </>
  );
}

function Legenda() {
  return (
    <div
      style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 11.5, color: 'var(--cinza-3)', marginBottom: 12 }}
    >
      {[
        ['Positivo', CORES_DO_SENTIMENTO[0]],
        ['Neutro', CORES_DO_SENTIMENTO[1]],
        ['Negativo', CORES_DO_SENTIMENTO[2]],
      ].map(([rotulo, cor]) => (
        <span key={rotulo} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span aria-hidden style={{ width: 10, height: 10, borderRadius: 2, background: cor }} />
          {rotulo}
        </span>
      ))}
      <span style={{ marginLeft: 'auto', color: 'var(--cinza-2)' }}>
        Na ponta: matérias · impacto na nota
      </span>
    </div>
  );
}

function MapaDoTermometro({
  dados,
  selecao,
  filtrando,
}: {
  dados: Dados;
  selecao: Selecao;
  filtrando: ReactNode;
}) {
  const ufs = ufsDoExplorador(dados.grupos, selecao);
  const daUf = new Map(ufs.map((uf) => [uf.uf, uf]));
  //: A LISTA DA UF COM MAIS MATÉRIAS PARA A COM MENOS, por pedido; no empate, a
  //: de score maior primeiro.
  const ufsPorVolume = [...ufs].sort(
    (a, b) => b.total - a.total || b.score - a.score || a.uf.localeCompare(b.uf),
  );
  const maisMaterias = Math.max(1, ...ufs.map((uf) => uf.total));
  if (!ufs.length) {
    return (
      <>
        {filtrando}
        <p style={{ fontSize: 13, color: 'var(--cinza-2)', margin: 0 }}>
          Nenhuma matéria com estado do veículo neste recorte.
        </p>
      </>
    );
  }
  return (
    <>
      {filtrando}
      <div className="grade grade--2" style={{ gap: 24, alignItems: 'start' }}>
        <MapaUf
          //: SCORE ZERO TAMBÉM É BOLHA: o mapa esconde total zero (no CRM é
          //: "sem agenda"), e aqui zero é uma nota — a pior. Meio ponto dá a
          //: menor bolha, e o rótulo mostra o score de verdade.
          pontos={ufs.map((uf) => ({ uf: uf.uf, total: Math.max(uf.score, 0.5) }))}
          rotuloDaUf={(ponto) => String(daUf.get(ponto.uf)?.score ?? '')}
          corDaUf={(uf) => corDoNss(daUf.get(uf)?.nss ?? 0)}
          detalheDaUf={(ponto) => {
            const uf = daUf.get(ponto.uf);
            return uf
              ? `score ${uf.score} · termômetro ${uf.nss > 0 ? '+' : ''}${uf.nss} · ${numero(uf.total)} ${uf.total === 1 ? 'matéria' : 'matérias'}`
              : '';
          }}
          legendaDaEscala="Tamanho da bola: score da UF"
          rotuloAcessivel="Termômetro e score das matérias por unidade da federação"
        />
        <div>
          {/* O RANKING AO LADO DO MAPA, maior e da UF com MAIS matérias para a
              com menos (por pedido): o nome do estado, a barra do volume, o
              termômetro e o score — cada coluna com cabeçalho, para a lista se
              ler sem o mapa. */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: COLUNAS_DO_RANKING,
              gap: 14,
              alignItems: 'end',
              paddingBottom: 8,
              borderBottom: '1px solid var(--azul-mar)',
            }}
          >
            <span className="kicker">UF · matérias</span>
            <span className="kicker" style={{ textAlign: 'center' }}>
              Termômetro
            </span>
            <span className="kicker" style={{ textAlign: 'right' }}>
              Score
            </span>
          </div>
          <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {ufsPorVolume.map((uf) => (
              <li
                key={uf.uf}
                style={{
                  display: 'grid',
                  gridTemplateColumns: COLUNAS_DO_RANKING,
                  alignItems: 'center',
                  gap: 14,
                  padding: '11px 0',
                  borderBottom: '1px solid var(--borda)',
                }}
              >
                <span style={{ display: 'grid', gap: 6, minWidth: 0 }}>
                  <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: 15.5, color: 'var(--cinza-4)' }}>
                      {NOME_DA_UF[uf.uf] ?? rotuloDeAbrangencia(uf.uf)}
                    </strong>
                    <span style={{ fontSize: 13, color: 'var(--cinza-2)' }}>
                      {uf.uf} · {numero(uf.total)} {uf.total === 1 ? 'matéria' : 'matérias'}
                    </span>
                  </span>
                  <span
                    aria-hidden
                    style={{
                      display: 'block',
                      height: 6,
                      width: `${(uf.total / maisMaterias) * 100}%`,
                      minWidth: 4,
                      borderRadius: 3,
                      background: 'var(--cor-da-lente, var(--azul-mar))',
                      opacity: 0.55,
                    }}
                  />
                </span>
                <span
                  className="tabular"
                  title="Termômetro (NSS): (positivas − negativas) ÷ total"
                  style={{
                    justifySelf: 'center',
                    padding: '3px 12px',
                    borderRadius: 'var(--r-chip)',
                    background: corDoNss(uf.nss),
                    color: 'var(--cinza-4)',
                    fontSize: 14,
                    fontWeight: 700,
                  }}
                >
                  {uf.nss > 0 ? '+' : ''}
                  {uf.nss}
                </span>
                <span
                  className="tabular"
                  style={{ fontWeight: 800, fontSize: 22, textAlign: 'right', color: 'var(--cinza-4)' }}
                >
                  {uf.score}
                </span>
              </li>
            ))}
          </ol>
          <div
            aria-hidden
            style={{ marginTop: 16, display: 'grid', gap: 4, fontSize: 11, color: 'var(--cinza-2)' }}
          >
            <span>Termômetro (NSS)</span>
            <span
              style={{
                height: 8,
                borderRadius: 4,
                background: `linear-gradient(90deg, ${CORES_DE_CLIMA.tenso}, ${CORES_DE_CLIMA.neutro}, ${CORES_DE_CLIMA.propositivo})`,
              }}
            />
            <span style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>−100</span>
              <span>0</span>
              <span>+100</span>
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
