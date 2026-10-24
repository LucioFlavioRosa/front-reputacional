/** Dois cards da Síntese executiva que se filtram juntos:
 *
 *  - "N1 › N2 › N3": três gráficos de barras deitadas, lado a lado — N1
 *    Atributo Reputacional, N2 Temas estratégicos, N3 Subtemas —, do maior para
 *    o menor, com o sentimento dentro da barra e o impacto na nota na ponta;
 *  - "Termômetro por UF": o mapa do Brasil do CRM, com a cor da bolha no
 *    termômetro (NSS) da UF e o tamanho no score dela.
 *
 *  DOIS GESTOS, E CADA COLUNA TEM O SEU. Clicar num N1 ou num N2 FILTRA as
 *  outras colunas e o mapa (por pedido), e clicar de novo desfaz — o gráfico do
 *  próprio item continua inteiro, com ele em destaque. Clicar num N3 ou num
 *  ESTADO (a bolha ou a linha da lista) ABRE o modal das matérias daquele
 *  recorte: são as duas folhas, e não teriam o que filtrar. A conta mora em
 *  `dominio/explorador`; o servidor manda o mês em grupos uma vez só, e o
 *  clique é soma no navegador.
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
import type { BarraDoExplorador, Nivel, Selecao } from '@/dominio/explorador';
import { numero } from '@/dominio/formato';
import { CORES_DE_CLIMA, rotuloDeAbrangencia } from '@/dominio/frentes';
import { ColunasEmpilhadas } from '@/graficos/ColunasEmpilhadas';
import { useListaRevelavel } from '@/paginas/score/listaRevelavel';
import { RevelarItens } from '@/paginas/score/revelarItens';
import { MapaUf } from '@/graficos/MapaUf';


//: OS NOMES EM USO NO PRODUTO, por pedido — os mesmos da Base de dados e dos
//: filtros: Atributo (N1), Tema estratégico (N2), Subtema (N3).
const NOMES: Record<Nivel, string> = {
  n1: 'Atributo (N1)',
  n2: 'Tema estratégico (N2)',
  n3: 'Subtema (N3)',
};

//: A CHAVE QUE CADA NÍVEL RECORTA NO SERVIDOR, e não o nome do nível — o
//: aprofundamento do N3 manda isto no filtro.
//:
//: O N2 E O N3 SAEM DO CADASTRO, não da coluna da menção: `grupos_do_explorador`
//: agrupa por `MacroTema.nome` e `Tema.nome`, e é por `tema_n2`/`tema_n3` que
//: `condicoes_do_filtro` casa esses dois (por `macro_tema_id`/`tema_id`).
//: `tema` e `subtema` SERIAM AS COLUNAS ERRADAS: `tema` é o texto cru do
//: fornecedor e `subtema` é a dimensão da Sociedade digital. O N1 é o único que
//: vem da menção, e lá a chave é `atributo` mesmo.
const CHAVE_DO_NIVEL: Record<Nivel, keyof FiltroDaLente> = {
  n1: 'atributo',
  n2: 'tema_n2',
  n3: 'tema_n3',
};

//: O QUE CADA COLUNA LISTA, para o rótulo do revelador dizer "Ver todos os 41
//: temas" em vez de um "itens" que não diz nada.
const UNIDADE_DO_NIVEL: Record<Nivel, { singular: string; plural: string }> = {
  n1: { singular: 'atributo', plural: 'atributos' },
  n2: { singular: 'tema', plural: 'temas' },
  n3: { singular: 'subtema', plural: 'subtemas' },
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
  aoAprofundar,
}: {
  codigo: string;
  mes: string;
  filtro: FiltroDaLente;
  /** Abre o modal de aprofundamento no recorte `(chave, valor)` mais o que a
   *  seleção LOCAL acrescenta — o mesmo contrato do Explorador de veículos.
   *
   *  SÓ O N3 O CHAMA. As duas colunas de cima escolhem, como sempre: se as três
   *  abrissem, nada recortaria o N3 e a última coluna perderia o gatilho. */
  aoAprofundar: (chave: string, valor: string, extras?: Partial<FiltroDaLente>) => void;
}) {
  //: OS DADOS COM A CHAVE DO PEDIDO de que são: a tela usa só os que batem
  //: com o mês e o filtro atuais, sem zerar nada dentro do efeito.
  const chave = `${codigo}|${mes}|${JSON.stringify(filtro)}`;
  const [carregados, definirCarregados] = useState<{
    chave: string;
    dados: Dados | null;
    erro?: string;
  } | null>(null);
  //: A SELEÇÃO LEVA A CHAVE DO RECORTE, pelo mesmo motivo dos dados — achado
  //: da revisão do Codex no bloco de veículos (23/10/2026), e o molde tinha o
  //: mesmo defeito. Sem isto: escolher "Governança" aqui, trocar o filtro da
  //: TELA, e o chip continuava dizendo "Governança" sobre um recorte que pode
  //: não ter esse atributo — com as colunas filtradas por algo que sumiu.
  //:
  //: E COM O APROFUNDAMENTO É PIOR: a seleção velha viajaria em `extras` e o
  //: modal abriria num recorte que a tela não mostra mais.
  //:
  //: GUARDADA COM A CHAVE em vez de zerada num efeito: `definirSelecao({})`
  //: dentro de `useEffect` dispararia outra renderização (e o lint cobra isso,
  //: `set-state-in-effect`); comparar a chave na leitura não dispara nada.
  const [escolha, definirEscolha] = useState<{ chave: string; selecao: Selecao }>({
    chave,
    selecao: {},
  });
  const selecao = escolha.chave === chave ? escolha.selecao : {};

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
    definirEscolha(() => ({
      chave,
      selecao: { ...selecao, [nivel]: selecao[nivel] === valor ? undefined : valor },
    }));
  const limpar = () => definirEscolha({ chave, selecao: {} });
  const escolhidos = (Object.keys(NOMES) as Nivel[]).filter((nivel) => selecao[nivel]);

  //: O QUE A SELEÇÃO LOCAL ACRESCENTA AO RECORTE DO MODAL. A barra do N3 conta
  //: a INTERSEÇÃO com o que está escolhido nas colunas de cima — mandar só o
  //: subtema abriria o modal num recorte mais largo que a barra clicada. É o
  //: mesmo defeito que o tier teve no bloco de veículos, e a mesma correção.
  const recorteLocal = (): Partial<FiltroDaLente> => {
    const extras: Partial<FiltroDaLente> = {};
    if (selecao.n1) extras.atributo = selecao.n1;
    if (selecao.n2) extras.tema_n2 = selecao.n2;
    return extras;
  };

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
        onClick={limpar}
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
          //: O SUBTÍTULO DIZ O GESTO DE CADA COLUNA, e não um "clique num item"
          //: só — achado da revisão do Codex (24/10/2026). Desde que o N3
          //: passou a abrir o aprofundamento, a frase antiga prometia que
          //: qualquer item filtrava o mapa, e esta é a única explicação que a
          //: pessoa tem do que o clique faz antes de clicar.
          subtitulo="Matérias por sentimento, da maior para a menor, com o impacto na nota da lente (pontos). Clique num atributo ou tema para filtrar as outras colunas e o mapa; o subtema abre o detalhe das matérias."
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
                {(Object.keys(NOMES) as Nivel[]).map((nivel) => (
                  <ColunaDoNivel
                    key={nivel}
                    nivel={nivel}
                    barras={barrasDoNivel(
                      atuais.dados!.grupos,
                      nivel,
                      selecao,
                      atuais.dados!.denominador,
                    )}
                    ativo={selecao[nivel]}
                    //: CADA COLUNA TEM UM GESTO, como no bloco de veículos: as
                    //: duas de cima ESCOLHEM, a última ABRE o modal daquele
                    //: subtema — com o recorte local junto.
                    aoClicar={
                      nivel === 'n3'
                        ? (valor) => aoAprofundar(CHAVE_DO_NIVEL.n3, valor, recorteLocal())
                        : (valor) => alternar(nivel, valor)
                    }
                  />
                ))}
              </div>
            </>
          ) : null}
        </Secao>
      </ComFaixaDoTopo>

      <ComFaixaDoTopo>
        <Secao
          titulo="Termômetro por UF"
          //: "N1 E N2", E NÃO MAIS "N1, N2 E N3" — o N3 deixou de filtrar
          //: quando passou a abrir o modal, e o mapa não o recebe mais.
          subtitulo="A cor da bola é o termômetro (NSS) das matérias de cada estado; o tamanho é o score da UF, de 0 a 100. Segue o filtro de N1 e N2 acima; clicar num estado — na bolha ou na lista — abre o detalhe das matérias."
        >
          {!atuais ? <Carregando /> : null}
          {atuais?.dados ? (
            <MapaDoTermometro
              dados={atuais.dados}
              selecao={selecao}
              filtrando={filtrando}
              //: `uf` É A CHAVE DO SERVIDOR, e o valor é a SIGLA que a lista
              //: mostra. A coluna `mencao.uf` guarda o NOME ("Santa Catarina",
              //: desde 09/10/2026) e é `grupos_do_explorador` que deriva a
              //: sigla — então o recorte do back casa as DUAS formas, e é por
              //: isso que mandar daqui o que a tela mostra conta o mesmo que a
              //: linha clicada (ver `condicoes_do_filtro`).
              //:
              //: E O RECORTE LOCAL VIAJA JUNTO, como no N3: a lista ao lado do
              //: mapa é somada DENTRO das escolhas de N1/N2, então o modal tem
              //: de contar a mesma fatia.
              aoAprofundarNaUf={(uf) => aoAprofundar('uf', uf, recorteLocal())}
            />
          ) : null}
        </Secao>
      </ComFaixaDoTopo>
    </>
  );
}

/** Uma coluna do explorador: o cabeçalho, as barras e o revelador.
 *
 *  COMPONENTE, E NÃO UM TRECHO DENTRO DO `.map` — cada coluna tem o SEU estado
 *  de aberta/fechada, e hook não pode nascer dentro de um laço. É o mesmo
 *  desenho do `Coluna` do Explorador de veículos, pelo mesmo motivo: revelar o
 *  N2 não pode abrir o N1 junto.
 */
function ColunaDoNivel({
  nivel,
  barras,
  ativo,
  aoClicar,
}: {
  nivel: Nivel;
  barras: BarraDoExplorador[];
  ativo?: string;
  aoClicar: (valor: string) => void;
}) {
  const lista = useListaRevelavel(barras.length);
  return (
    <div style={{ minWidth: 0 }}>
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
        {/* O TOTAL DO RECORTE, e não quantos estão à vista: é o mesmo número
            que o botão promete abrir, e dizer "5 itens" com sete no recorte
            faria o cabeçalho desmentir o botão logo abaixo. */}
        <span style={{ fontSize: 11.5, color: 'var(--cinza-2)' }}>
          {barras.length} {barras.length === 1 ? 'item' : 'itens'}
        </span>
      </div>
      <div id={lista.idDaLista}>
        <ColunasEmpilhadas
          semLegenda
          rotuloEmCima
          espessura={8}
          alturaMaxima={360}
          cores={CORES_DO_SENTIMENTO}
          vazio="Nada classificado neste nível no recorte."
          ativo={ativo}
          aoClicar={aoClicar}
          itens={barras.slice(0, lista.quantidade).map((barra) => ({
            ...barra,
            detalhe: `${textoDoImpacto(barra.impacto)} pts`,
          }))}
        />
      </div>
      <RevelarItens
        teto={lista.teto}
        podeAbrir={lista.podeAbrir}
        aberta={lista.aberta}
        aoAlternar={lista.alternar}
        controla={lista.idDaLista}
        unidade={UNIDADE_DO_NIVEL[nivel]}
      />
    </div>
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
  aoAprofundarNaUf,
}: {
  dados: Dados;
  selecao: Selecao;
  filtrando: ReactNode;
  /** Abre o modal das matérias daquele estado — a bolha do mapa e a linha da
   *  lista chamam o MESMO gesto, porque são o mesmo dado visto de dois jeitos. */
  aoAprofundarNaUf: (uf: string) => void;
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
          //: A BOLHA ABRE O MESMO MODAL DA LINHA, por pedido. O `MapaUf` já
          //: tinha o gesto (é assim que o CRM recorta por UF) e aqui ele estava
          //: ocioso: quem clicava na bolha não recebia nada.
          aoClicarUf={aoAprofundarNaUf}
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
          {/* ROLAGEM PRÓPRIA, por pedido (22/10/2026): com todas as UFs do
              recorte, a lista passava do mapa em altura — o cartão ficava
              com uma coluna bem mais alta que a outra, e o layout parecia
              quebrado. A ALTURA É A DO MAPA, aproximadamente, para as duas
              colunas da `grade--2` acabarem juntas; o cabeçalho (UF ·
              matérias / Termômetro / Score) fica FORA da rolagem, sempre
              visível enquanto a lista passa por baixo dele. */}
          <ol
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              maxHeight: 480,
              overflowY: 'auto',
            }}
          >
            {ufsPorVolume.map((uf) => (
              <li key={uf.uf} style={{ borderBottom: '1px solid var(--borda)' }}>
                {/* A LINHA INTEIRA É O BOTÃO, e não um link no nome do estado:
                    o alvo é a linha que a pessoa está lendo, com 44px de
                    altura, e o número ao lado dela entra no mesmo clique.
                    `aria-label` NOMEIA O GESTO, porque o conteúdo da linha são
                    quatro dados soltos — um leitor de tela anunciaria "Santa
                    Catarina SC 123 matérias +18 71" sem dizer o que o clique
                    faz. */}
              <button
                type="button"
                onClick={() => aoAprofundarNaUf(uf.uf)}
                aria-label={`Abrir as ${numero(uf.total)} ${uf.total === 1 ? 'matéria' : 'matérias'} de ${NOME_DA_UF[uf.uf] ?? rotuloDeAbrangencia(uf.uf)}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: COLUNAS_DO_RANKING,
                  alignItems: 'center',
                  gap: 14,
                  padding: '11px 0',
                  width: '100%',
                  border: 'none',
                  background: 'transparent',
                  textAlign: 'left',
                  font: 'inherit',
                  color: 'inherit',
                  cursor: 'pointer',
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
                </button>
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
