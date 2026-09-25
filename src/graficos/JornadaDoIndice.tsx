/** A jornada do índice: curva por cima das faixas, fita de meses, um cartão.
 *
 *  NENHUMA CONTA MORA AQUI. Domínio do eixo, faixas recortadas, caminho da
 *  curva e posição de cada rótulo saem de `dominio/jornadaDoIndice`, testado
 *  linha a linha. Este arquivo desenha.
 *
 *  ERAM DEZ COLUNAS DE TEXTO, todas abertas ao mesmo tempo, acima do gráfico.
 *  Dez nomes de mês, dez variações, até trinta linhas de fato e tema, cada uma
 *  quebrando em três ou quatro pedaços dentro de 90px. Tudo legítimo, tudo
 *  visível, e por isso mesmo ilegível: a informação de um mês só se achava
 *  varrendo o bloco inteiro, e o gráfico — que é o assunto da seção — ficava
 *  comprimido embaixo de uma parede de letra miúda.
 *
 *  A INFORMAÇÃO NÃO ENCOLHEU, ela passou a ser pedida. O que fica sempre
 *  visível é a FITA: um filete de 3px por mês, na cor do que aquele mês viveu —
 *  o único sinal que se lê de relance e que valia estar sempre aberto, porque
 *  comparar doze meses de uma vez é justamente o que uma cor deixa fazer e um
 *  parágrafo não. O resto vive em UM cartão, que mostra o mês sob o mouse.
 *
 *  UM CARTÃO EM VEZ DE DEZ, e três vezes mais largo, é o que reorganiza: o nome
 *  do mês e a variação cabem na mesma linha, e cada fato cabe numa linha só com
 *  os pontos que custou alinhados à direita. A mesma informação, legível.
 *
 *  ELE SEGUE O MÊS, e é isso que dispensa qualquer legenda de ligação: o cartão
 *  desliza até ficar embaixo do mês apontado, com um bico apontando para ele.
 *  Perto das bordas ele encosta e para — o bico continua no mês certo, porque
 *  quando o cartão encosta o mês já está dentro dele.
 *
 *  SEM MOUSE ELE MOSTRA O MÊS ESCOLHIDO, e não desaparece. Um cartão que só
 *  existe sob o cursor não existe no telefone, não existe para quem navega por
 *  teclado, e faz a legenda abaixo subir e descer a cada passada do mouse.
 *
 *  FITA E GRÁFICO COMPARTILHAM AS MARGENS LATERAIS, e é isso que os alinha:
 *  a grade tem uma coluna de largura igual por mês, e o ponto do mês i cai em
 *  (i + 0,5)/n da largura — o centro exato da coluna i. Margens diferentes
 *  fariam o terceiro filete apontar para o segundo ponto, e o leitor atribuiria
 *  o fato ao mês errado. As três medidas vêm da mesma variável, em `index.css`.
 *  É também por isso que a fita não tem `gap`: o vão deslocaria os centros, e o
 *  respiro entre filetes vem de recuo POR DENTRO de cada célula.
 *
 *  O DESTAQUE É COMPARTILHADO entre o filete, o ponto e o cartão do mesmo mês.
 *  Passar o mouse em qualquer um dos dois primeiros acende os três e baixa uma
 *  guia até o eixo.
 *
 *  A TRANSIÇÃO É CURTA E EXISTE PARA MOSTRAR O QUE MUDOU, não para enfeitar:
 *  trocar de mês sem ela troca o ponto grande de lugar sem que o olho perceba.
 *  `prefers-reduced-motion` já desliga tudo isto no `index.css`, para quem pede.
 *
 *  O SVG DESENHA SÓ O QUE TOLERA SER ESTICADO — as faixas de fundo e os dois
 *  traços de curva, que têm `non-scaling-stroke`. Ponto, rótulo, marca de eixo
 *  e nome de faixa são HTML posicionado por porcentagem: com
 *  `preserveAspectRatio="none"`, um `<circle>` vira elipse assim que a largura
 *  do cartão deixa de ser proporcional ao viewBox — e era o que acontecia em
 *  toda tela que não fosse a do desenho.
 */

import { useState } from 'react';

import { VB, jornadaDoIndice } from '@/dominio/jornadaDoIndice';
import type {
  ColunaDoMes,
  FaixaDeFundo,
  LinhaDoMes,
  PontoDaJornada,
} from '@/dominio/jornadaDoIndice';
import { COR_DO_EFEITO } from '@/dominio/score';
import { mesCurto } from '@/dominio/dossie';
import type { PontoDaSerie } from '@/dominio/score';

export function JornadaDoIndice({
  serie,
  mes,
  comparada,
  nomeDaComparada = '',
  aoEscolherMes,
}: {
  serie: PontoDaSerie[];
  mes: string;
  comparada: string | null;
  nomeDaComparada?: string;
  aoEscolherMes: (mes: string) => void;
}) {
  const jornada = jornadaDoIndice(serie, mes, comparada, nomeDaComparada);
  const [destacado, definirDestacado] = useState<string | null>(null);

  //: SOLTAR SÓ APAGA SE AINDA FOR O MESMO MÊS.
  //:
  //: Entre dois meses vizinhos o navegador dispara a saída de um ANTES da
  //: entrada do outro. Com um `null` no meio, o cartão volta ao mês escolhido e
  //: adianta de novo — um piscar a cada mês percorrido, e a fita tem doze.
  const soltar = (qual: string) =>
    definirDestacado((atual) => (atual === qual ? null : atual));
  if (!jornada.pontos.length) {
    return (
      <p style={{ fontSize: 13, color: 'var(--cinza-2)', margin: 0 }}>
        Sem série ainda — o índice nasce quando o primeiro mês é ingerido.
      </p>
    );
  }

  //: O MÊS SOB O MOUSE, OU O ESCOLHIDO. O apontado manda enquanto durar: é
  //: prévia, e sai sozinha. O escolhido é o que fica — e é o que sobra em quem
  //: não tem mouse nenhum.
  const escolhida =
    jornada.colunas.find((coluna) => coluna.selecionada) ?? jornada.colunas.at(-1);
  const emFoco = jornada.colunas.find((coluna) => coluna.mes === destacado) ?? escolhida;

  //: A MESMA PORCENTAGEM DO PONTO, e não uma conta nova: o centro da célula i da
  //: fita é o centro do ponto i, porque as duas grades têm as mesmas margens.
  //: Recalcular aqui seria uma segunda verdade, que envelhece sozinha.
  const xDoFoco =
    jornada.pontos.find((ponto) => ponto.mes === emFoco?.mes)?.esquerda ?? 50;

  return (
    <div
      className="jornada"
      style={{ ['--jornada-meses' as string]: String(jornada.colunas.length) }}
    >
      <div className="jornada__margens jornada__grafico">
        <svg
          viewBox={`0 0 ${VB.largura} ${VB.altura}`}
          preserveAspectRatio="none"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          role="img"
          aria-label={jornada.resumo}
        >
          {jornada.faixas.map((faixa) => (
            <rect
              key={faixa.rotulo}
              x={0}
              y={faixa.y}
              width={VB.largura}
              height={faixa.altura}
              fill={faixa.fundo}
            />
          ))}

          {jornada.curvaDaLente ? (
            <path
              // A FORMA NÃO INTERPOLA entre uma lente e outra — dois caminhos
              // com o mesmo número de pontos ainda são duas curvas diferentes,
              // e animar de uma para a outra desenharia valores que não
              // existiram. O que aparece e some é a curva inteira.
              d={jornada.curvaDaLente}
              fill="none"
              stroke="var(--cinza-2)"
              strokeWidth={2}
              strokeDasharray="6 6"
              vectorEffect="non-scaling-stroke"
              style={{ animation: 'jornada-entra 220ms ease' }}
            />
          ) : null}

          {/* O HALO dá à curva um contorno claro contra as faixas: sem ele o
              traço azul sobre a faixa Estável quase desaparece. */}
          <path
            d={jornada.curva}
            fill="none"
            stroke="var(--branco)"
            strokeOpacity={0.6}
            strokeWidth={10}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={jornada.curva}
            fill="none"
            stroke="var(--azul-mar)"
            strokeWidth={3}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {/* A GUIA liga o ponto ao mês lá embaixo. É o gesto que um gráfico de
            linha precisa e que nenhum rótulo substitui: com a curva subindo, o
            olho perde a vertical entre o valor e a data. */}
        {jornada.pontos.map((ponto) => (
          <span
            key={`guia-${ponto.mes}`}
            aria-hidden
            style={{
              position: 'absolute',
              left: `${ponto.esquerda}%`,
              top: 0,
              bottom: 0,
              width: 0,
              borderLeft: '1px dashed var(--cinza-2)',
              opacity: destacado === ponto.mes ? 0.6 : 0,
              transition: 'opacity 140ms ease',
              pointerEvents: 'none',
            }}
          />
        ))}

        {jornada.pontosDaLente.map((ponto) => (
          <span
            key={`${ponto.cx}-${ponto.cy}`}
            aria-hidden
            style={{
              position: 'absolute',
              left: `${(ponto.cx / VB.largura) * 100}%`,
              top: `${(ponto.cy / VB.altura) * 100}%`,
              transform: 'translate(-50%, -50%)',
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'var(--branco)',
              border: '2px solid var(--cinza-2)',
              pointerEvents: 'none',
            }}
          />
        ))}

        {jornada.pontos.map((ponto) => (
          <Ponto
            key={ponto.mes}
            ponto={ponto}
            destacado={destacado === ponto.mes}
            aoDestacar={definirDestacado}
            aoSoltar={soltar}
            aoEscolher={aoEscolherMes}
          />
        ))}

        {jornada.marcas.map((marca) => (
          <span
            key={marca.valor}
            className="tabular"
            style={{
              position: 'absolute',
              right: 'calc(100% + 8px)',
              top: `${marca.topo}%`,
              transform: 'translateY(-50%)',
              fontSize: 11,
              color: 'var(--cinza-2)',
              pointerEvents: 'none',
            }}
          >
            {marca.valor}
          </span>
        ))}

        {/* FORA DO GRÁFICO, à direita: dentro, o nome da faixa colide com o
            primeiro e o último ponto, que ficam a 1/(2n) da borda. */}
        {jornada.faixas.map((faixa) => (
          <span
            key={faixa.rotulo}
            className="kicker jornada__nome-da-faixa"
            style={{
              position: 'absolute',
              left: 'calc(100% + 10px)',
              top: `${faixa.centro}%`,
              transform: 'translateY(-50%)',
              whiteSpace: 'nowrap',
              color: faixa.cor,
              pointerEvents: 'none',
            }}
          >
            {faixa.rotulo}
          </span>
        ))}

        {jornada.fimDaLente ? (
          <span
            className="tabular jornada__fim-da-lente"
            style={{
              position: 'absolute',
              left: `${jornada.fimDaLente.esquerda}%`,
              top: `${jornada.fimDaLente.topo}%`,
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--cinza-3)',
              whiteSpace: 'nowrap',
              background: 'var(--branco)',
              padding: '2px 6px',
              borderRadius: 5,
              border: '1px solid var(--borda)',
              pointerEvents: 'none',
            }}
          >
            {jornada.fimDaLente.texto}
          </span>
        ) : null}
      </div>

      {/* A FITA: um mês por célula, alinhada ao gráfico. O filete é o sinal que
          fica sempre aberto; o texto do mês vive no cartão abaixo. Cada célula
          é um controle de largura inteira — alvo generoso para apontar e para
          tocar, ao contrário do ponto de 16px na curva. */}
      <div className="jornada__margens jornada__meses" style={{ marginTop: 8 }}>
        {jornada.colunas.map((coluna) => (
          <MesNaFita
            key={coluna.mes}
            coluna={coluna}
            destacado={destacado === coluna.mes}
            aoDestacar={definirDestacado}
            aoSoltar={soltar}
            aoEscolher={aoEscolherMes}
          />
        ))}
      </div>

      {/* O CARTÃO, embaixo da fita e alinhado ao mês em foco. Embaixo, e não em
          cima: aqui a altura dele muda de um mês para outro sem mover nada do
          que está acima — pôr o cartão sobre o gráfico faria a curva pular a
          cada passada do mouse. */}
      {emFoco ? (
        <div
          className="jornada__margens jornada__detalhe"
          style={{
            ['--jornada-x' as string]: `${xDoFoco}%`,
            ['--jornada-filete' as string]: emFoco.filete,
          }}
        >
          <span className="jornada__bico" aria-hidden />
          <DetalheDoMes coluna={emFoco} aoDestacar={definirDestacado} aoSoltar={soltar} />
        </div>
      ) : null}

      <div className="jornada__faixas-abaixo" style={{ gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
        {jornada.faixas.map((faixa) => (
          <FaixaNaLegenda key={faixa.rotulo} faixa={faixa} />
        ))}
      </div>
    </div>
  );
}

/** Um mês na fita: o filete com a cor do que ele viveu, e o nome embaixo.
 *
 *  É UM CONTROLE, e não um rótulo. A célula inteira aponta e seleciona, e tem a
 *  largura de um mês do gráfico: antes o único alvo era o ponto de 16px na
 *  curva, e em dez meses num cartão estreito acertá-lo era pontaria.
 *
 *  O FILETE É O QUE FICA ABERTO desta coluna toda. É a cor do fato que pesou no
 *  mês — vermelho pressionou, turquesa sustentou, cinza misto, borda nenhum —, e
 *  é o único traço que se compara doze vezes de relance. O resto vai ao cartão.
 */
function MesNaFita({
  coluna,
  destacado,
  aoDestacar,
  aoSoltar,
  aoEscolher,
}: {
  coluna: ColunaDoMes;
  destacado: boolean;
  aoDestacar: (mes: string) => void;
  aoSoltar: (mes: string) => void;
  aoEscolher: (mes: string) => void;
}) {
  const aceso = coluna.selecionada || destacado;
  return (
    <button
      type="button"
      onClick={() => aoEscolher(coluna.mes)}
      onMouseEnter={() => aoDestacar(coluna.mes)}
      onMouseLeave={() => aoSoltar(coluna.mes)}
      onFocus={() => aoDestacar(coluna.mes)}
      onBlur={() => aoSoltar(coluna.mes)}
      // O NOME ACESSÍVEL DIZ O MÊS E O QUE ELE FEZ: "jun/26" sozinho obriga
      // quem ouve a abrir o mês para descobrir se vale abrir.
      aria-label={`${coluna.nome}, ${coluna.variacao}`}
      aria-current={coluna.selecionada ? 'true' : undefined}
      className="jornada__mes"
      style={{
        background: aceso ? 'var(--bg-trilho)' : 'transparent',
        color: aceso ? 'var(--azul-mar)' : 'var(--cinza-2)',
        fontWeight: coluna.selecionada ? 700 : 500,
      }}
    >
      {/* O RECUO É POR DENTRO, e não `gap` na grade: o vão entre células
          deslocaria o centro de cada uma, e o filete do mês i deixaria de cair
          sobre o ponto do mês i. */}
      <span
        aria-hidden
        className="jornada__filete"
        style={{ background: coluna.filete }}
      />
      <span className="jornada__mes-longo">{mesCurto(coluna.mes)}</span>
      <span className="jornada__mes-curto">{mesCurto(coluna.mes).slice(0, 3)}</span>
    </button>
  );
}

/** O cartão do mês em foco: o que aconteceu, quanto o índice andou, por onde.
 *
 *  ELE SE MANTÉM ABERTO QUANDO O MOUSE ENTRA NELE. Sem isto, sair da fita para
 *  ler o cartão o apaga — e o cartão troca de conteúdo exatamente no gesto de
 *  quem quis lê-lo.
 *
 *  NÃO É UM CONTROLE, de propósito. Clicar nele para escolher o mês seria um
 *  atalho de meio pixel — a célula da fita logo acima faz isso —, e sairia caro:
 *  um botão anuncia como nome tudo o que tem dentro, e este tem o mês, a
 *  variação, três fatos e o rodapé. Quem ouve a tela receberia um botão só, de
 *  duzentos caracteres, e mais uma parada de tabulação repetindo o que a fita já
 *  disse. Aqui o texto é texto, e quem comanda é a fita. */
function DetalheDoMes({
  coluna,
  aoDestacar,
  aoSoltar,
}: {
  coluna: ColunaDoMes;
  aoDestacar: (mes: string) => void;
  aoSoltar: (mes: string) => void;
}) {
  return (
    <div
      className="jornada__cartao"
      onMouseEnter={() => aoDestacar(coluna.mes)}
      onMouseLeave={() => aoSoltar(coluna.mes)}
      style={{ borderTop: `3px solid ${coluna.filete}` }}
    >
      {/* NA MESMA LINHA, agora que há largura: nas colunas de 90px o nome do mês
          e a variação não caibam lado a lado, e a variação ia para baixo. */}
      <span
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <span className="kicker" style={{ color: 'var(--azul-mar)' }}>
          {coluna.nome}
        </span>
        <span
          className="tabular"
          style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}
        >
          {coluna.variacao}
        </span>
      </span>

      {/* SEM LINHA, SEM TEXTO. Um mês sem comentário nem tema não ganha uma
          frase dizendo que não tem — foi decisão de quem cuida do produto, e
          continua valendo com um cartão: "sem fato registrado" não é fato. */}
      {coluna.linhas.length ? (
        <span style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {coluna.linhas.map((linha) => (
            <LinhaDoDetalhe key={`${linha.origem}-${linha.texto}`} linha={linha} />
          ))}
        </span>
      ) : null}

      {/* O RODAPÉ é o que a conta sabe e ninguém escreveu: por qual lente o mês
          se moveu mais, e quanto dele não se explica por tema. Separado por um
          fio, porque é de outra natureza do que está acima. */}
      {coluna.movimento || coluna.semTema ? (
        <span
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '2px 10px',
            paddingTop: 7,
            borderTop: '1px solid var(--borda)',
            fontSize: 11,
            color: 'var(--cinza-2)',
          }}
        >
          {coluna.movimento ? <span>{coluna.movimento}</span> : null}
          {coluna.semTema ? (
            <span title="Menções que moveram o índice sem tema classificado, ou lente estimada">
              {coluna.semTema}
            </span>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}

/** Uma linha do cartão: o que alguém escreveu, ou o que a base derivou.
 *
 *  A PROCEDÊNCIA É MARCADA, e não decorada. O ponto cheio é fato cadastrado —
 *  alguém decidiu que aquilo merecia registro; o contorno vazado é tema
 *  derivado, com os pontos que ele custou ou rendeu ao lado. Sem a distinção,
 *  o cartão misturaria o que a companhia afirma com o que a conta calculou. */
function LinhaDoDetalhe({ linha }: { linha: LinhaDoMes }) {
  const cor = COR_DO_EFEITO[linha.efeito] ?? 'var(--cinza-2)';
  return (
    <span style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
      <span
        aria-hidden
        style={{
          width: 6,
          height: 6,
          marginTop: 4,
          flexShrink: 0,
          borderRadius: '50%',
          background: linha.origem === 'cadastro' ? cor : 'transparent',
          border: linha.origem === 'cadastro' ? 'none' : `1.5px solid ${cor}`,
        }}
      />
      <span style={{ fontSize: 11.5, lineHeight: 1.45, color: 'var(--cinza-3)', flex: 1 }}>
        {linha.texto}
      </span>
      {linha.evidencia ? (
        <span
          className="tabular"
          style={{ fontSize: 11, fontWeight: 700, color: cor, whiteSpace: 'nowrap' }}
        >
          {linha.evidencia}
        </span>
      ) : null}
    </span>
  );
}

/** O ponto do mês e o rótulo dele — um controle só.
 *
 *  EM HTML, E NÃO `<circle>`: o SVG é esticado para as faixas encherem a
 *  largura, e nesse esticamento um círculo vira elipse. Aqui ele é redondo em
 *  qualquer tela, e ainda ganha de graça o foco do navegador. */
function Ponto({
  ponto,
  destacado,
  aoDestacar,
  aoSoltar,
  aoEscolher,
}: {
  ponto: PontoDaJornada;
  destacado: boolean;
  aoDestacar: (mes: string) => void;
  aoSoltar: (mes: string) => void;
  aoEscolher: (mes: string) => void;
}) {
  const raio = ponto.selecionado ? 22 : destacado ? 20 : 16;
  return (
    <button
      type="button"
      onClick={() => aoEscolher(ponto.mes)}
      onMouseEnter={() => aoDestacar(ponto.mes)}
      onMouseLeave={() => aoSoltar(ponto.mes)}
      onFocus={() => aoDestacar(ponto.mes)}
      onBlur={() => aoSoltar(ponto.mes)}
      aria-label={ponto.descricao}
      aria-current={ponto.selecionado ? 'true' : undefined}
      style={{
        position: 'absolute',
        left: `${ponto.esquerda}%`,
        top: `${ponto.topo}%`,
        transform: 'translate(-50%, -50%)',
        width: raio,
        height: raio,
        borderRadius: '50%',
        // OCO QUANDO O MÊS É PARCIAL. Ele foi medido por menos de quatro
        // lentes: o número é legítimo pela fórmula e não se compara com os
        // outros, e um ponto cheio o afirmaria com a mesma força.
        background: ponto.parcial ? 'var(--branco)' : ponto.cor,
        border: ponto.parcial
          ? `2.5px dashed ${ponto.cor}`
          : `2.5px solid ${ponto.selecionado ? 'var(--cinza-4)' : 'var(--branco)'}`,
        // O ANEL SÓ APARECE NO DESTAQUE, e some junto: um contorno permanente
        // em dez pontos vira poluição, e o mês escolhido deixa de se distinguir
        // dos outros.
        boxShadow: destacado ? '0 0 0 4px rgba(0, 39, 189, 0.16)' : 'none',
        padding: 0,
        cursor: 'pointer',
        transition: 'width 140ms ease, height 140ms ease, box-shadow 140ms ease',
      }}
    >
      <span
        className={`jornada__rotulo jornada__rotulo--${ponto.acima ? 'acima' : 'abaixo'}`}
      >
        <span className="tabular jornada__nota" style={{ color: ponto.corDoTexto }}>
          {ponto.isr}
        </span>
        {ponto.tag ? (
          <span className="kicker" style={{ color: ponto.corDaTag }}>
            {ponto.tag}
          </span>
        ) : null}
        {/* POR QUANTAS LENTES O MÊS FOI MEDIDO, quando foram poucas — e junto,
            na mesma linha, o aviso de que o valor saiu do eixo.

            NA MESMA LINHA DE PROPÓSITO: a etiqueta do ponto já pode ter o
            número e a tag do fato, e `ALTURA_DO_ROTULO` reserva espaço no
            viewBox para ela caber acima ou abaixo da curva. Uma quarta linha
            estouraria essa reserva justamente nos meses em que ela é mais
            necessária.

            O AVISO DE ESCALA SOZINHO CONTINUA POSSÍVEL: um mês completo pode
            sair do eixo quando a lente comparada estica o domínio. */}
        {ponto.cobertura || ponto.foraDaEscala ? (
          <span className="kicker jornada__cobertura" style={{ color: 'var(--cinza-2)' }}>
            {ponto.cobertura || 'fora da escala'}
          </span>
        ) : null}
      </span>
    </button>
  );
}

function FaixaNaLegenda({ faixa }: { faixa: FaixaDeFundo }) {
  return (
    <span
      style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5 }}
    >
      <span
        style={{
          width: 12,
          height: 12,
          borderRadius: 3,
          background: faixa.fundo,
          border: '1px solid var(--borda)',
        }}
      />
      <span style={{ color: faixa.cor, fontWeight: 700 }}>{faixa.rotulo}</span>
    </span>
  );
}
