/** A cadeia de UMA agenda: o que levou até ela, e o que saiu dela.
 *
 *  POR QUE ISTO É UM MODAL, E NÃO UMA ABA
 *  --------------------------------------
 *  Foi uma aba, por um dia. Como destino de navegação obrigava a escolher QUAL
 *  cadeia ver antes de poder olhar — e a pergunta real nunca é "quais cadeias
 *  existem", é "de onde veio ESTA reunião para a qual vou". Essa pergunta nasce
 *  na Base, olhando a linha da agenda, e é lá que ela é feita agora.
 *
 *  POR QUE EM CAMADAS, E NÃO POR FORÇA: ver `@/dominio/grafo`.
 *
 *  UM MODAL DE CADA VEZ. Clicar num nó move o FOCO dentro deste mesmo desenho,
 *  em vez de empilhar a ficha por cima: quem está lendo uma cadeia quer andar
 *  por ela, e um modal sobre modal esconde justamente o que se veio ver. A
 *  ficha completa continua a um clique, pelo rodapé.
 */

import { useMemo, useState } from 'react';
import { usePainel } from '@/estado/painel';
import { Botao, Carregando, ChipDeFrente, Modal, Vazio } from '@/componentes/basicos';
import { CORES_DE_FRENTE, ROTULOS_DE_FRENTE, rotuloDeAbrangencia } from '@/dominio/frentes';
import { cadeias, derivadasForaDaJanela, montarGrafo, temCadeia } from '@/dominio/grafo';
import type { NoDoGrafo } from '@/dominio/grafo';
import { dataCompleta, tituloDaAgenda } from '@/dominio/formato';
import {
  nomeDaInstituicao,
  nomeDaPessoa,
  nomeDoInterlocutor,
  nomesDosTemas,
  rotuloDeCodigo,
} from '@/dominio/derivacoes';
import type { Catalogo } from '@/dominio/derivacoes';
import type { Interacao } from '@/dominio/tipos';

//: Geometria do desenho. Em constantes porque o layout as usa em quatro
//: lugares, e três números soltos que precisam concordar acabam discordando.
const LARGURA = 218;
const ALTURA = 72;
const VAO_X = 84;
const VAO_Y = 24;
const MARGEM = 26;
//: Quantos cartões cabem numa coluna antes de a camada quebrar em subcolunas.
//: Cinco vezes (72 + 24) menos o vão final cabe na altura de rolagem do modal
//: — acima disso, ver o leque inteiro exigiria rolar.
const MAX_POR_COLUNA = 5;

export function CadeiaDaAgenda({
  id,
  aoFechar,
  aoAbrirFicha,
}: {
  id: string;
  aoFechar: () => void;
  /** Ausente quando não há para onde levar — e aí o rodapé não oferece. */
  aoAbrirFicha?: (id: string) => void;
}) {
  const { interacoes, catalogo, carregando } = usePainel();
  //: O nó em foco. Começa na agenda de onde se clicou e anda com o clique —
  //: é o que faz da cadeia algo navegável, e não um retrato.
  const [emFoco, definirEmFoco] = useState(id);

  const grafo = useMemo(() => montarGrafo(interacoes ?? []), [interacoes]);
  const grupos = useMemo(() => cadeias(grafo), [grafo]);

  const daCadeia = useMemo(
    () => new Set(grupos.find((grupo) => grupo.includes(id)) ?? []),
    [grupos, id],
  );

  const nos = grafo.nos.filter((no) => daCadeia.has(no.id));
  const arestas = grafo.arestas.filter((a) => daCadeia.has(a.de) && daCadeia.has(a.para));

  const foco = nos.find((no) => no.id === emFoco) ?? nos.find((no) => no.id === id);
  const origem = interacoes?.find((i) => i.id === id);

  const titulo = (no: NoDoGrafo) =>
    catalogo ? tituloDaAgenda(no.interacao, (ids) => nomesDosTemas(catalogo, ids)) : '—';

  //: Reindexa a ordem DENTRO desta cadeia. Sem isto, uma cadeia cujos nós
  //: ficaram nas posições 4 e 7 da camada apareceria com um vão enorme no
  //: meio — o espaço de nós que este desenho não está mostrando.
  const posicao = new Map<string, { x: number; y: number }>();
  const porCamada = new Map<number, NoDoGrafo[]>();
  for (const no of nos) {
    porCamada.set(no.profundidade, [...(porCamada.get(no.profundidade) ?? []), no]);
  }
  const camadas = [...porCamada.keys()].sort((a, b) => a - b);

  //: QUANTAS SUBCOLUNAS cada camada ocupa, e quantas linhas ela tem.
  //:
  //: Uma camada larga — o Fato Relevante que gerou onze pedidos de imprensa no
  //: mesmo dia — viraria uma coluna de onze cartões, 1084px de altura, que só
  //: se lê rolando duas telas e meia. Rolar para ver um LEQUE é o pior caso:
  //: a forma inteira é a informação, e ela nunca aparece junta.
  //:
  //: Quebrada em subcolunas de cinco, a mesma camada cabe na altura do modal.
  //: A profundidade continua sendo o eixo horizontal: as subcolunas pertencem
  //: à MESMA camada e ficam lado a lado dentro dela.
  const forma = camadas.map((camada) => {
    const quantos = (porCamada.get(camada) ?? []).length;
    const subcolunas = Math.max(1, Math.ceil(quantos / MAX_POR_COLUNA));
    return { camada, subcolunas, linhas: Math.ceil(quantos / subcolunas) || 1 };
  });
  const maisAlta = Math.max(1, ...forma.map((f) => f.linhas));

  let x = MARGEM;
  for (const { camada, subcolunas, linhas } of forma) {
    const daCamada = [...(porCamada.get(camada) ?? [])].sort((a, b) => a.ordem - b.ordem);
    // CENTRALIZADA na vertical: uma coluna com um nó só alinhada ao topo faria
    // a seta subir, e subir num grafo de causalidade se lê como "voltou".
    const recuo = ((maisAlta - linhas) * (ALTURA + VAO_Y)) / 2;
    daCamada.forEach((no, indice) => {
      posicao.set(no.id, {
        x: x + Math.floor(indice / linhas) * (LARGURA + VAO_X),
        y: MARGEM + recuo + (indice % linhas) * (ALTURA + VAO_Y),
      });
    });
    x += subcolunas * (LARGURA + VAO_X);
  }

  const largura = x - VAO_X + MARGEM;
  const altura = MARGEM * 2 + maisAlta * (ALTURA + VAO_Y) - VAO_Y;

  const incompletos = nos.filter(
    (no) => no.origensForaDaJanela > 0 || derivadasForaDaJanela(no, arestas) > 0,
  ).length;

  return (
    <Modal
      titulo="Como chegamos aqui"
      subtitulo={
        nos.length > 1
          ? `${nos.length} interações encadeadas · clique num nó para ler os detalhes dele`
          : 'A cadeia desta interação'
      }
      aoFechar={aoFechar}
      // 1240, e nao 1180: o leque de onze — tres subcolunas mais a raiz —
      // desenha 1176px, e com 1180 a area util do modal fica em 1132. Faltam
      // 44px, e a ultima coluna de um leque que se quebra em subcolunas
      // justamente para caber sairia para a rolagem horizontal.
      largura={1240}
      rodape={
        foco && aoAbrirFicha ? (
          <Botao
            variante="primario"
            aoClicar={() => {
              aoFechar();
              aoAbrirFicha(foco.id);
            }}
          >
            Abrir a ficha completa
          </Botao>
        ) : undefined
      }
    >
      {carregando || !catalogo ? (
        <Carregando rotulo="Montando a cadeia…" />
      ) : nos.length === 0 ? (
        <Vazio
          mensagem={
            origem && temCadeia(origem)
              ? 'A cadeia desta interação está fora do recorte carregado.'
              : 'Esta interação não decorre de nenhuma outra, e nenhuma decorre dela.'
          }
          dica={
            origem && temCadeia(origem)
              ? 'Amplie o período ou limpe os filtros para ver a cadeia.'
              : undefined
          }
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {incompletos > 0 ? (
            <p
              style={{
                fontSize: 12,
                color: 'var(--atencao-fg)',
                background: 'var(--atencao-bg)',
                padding: '9px 12px',
                borderRadius: 'var(--r-card-int)',
                margin: 0,
              }}
            >
              {/* O DESENHO ESTÁ INCOMPLETO, e dizer isso importa mais do que
                  parecer completo. Sem o aviso, um nó cuja origem ficou fora do
                  recorte aparece como início de conversa — e quem se prepara
                  para a reunião leria menos do que existe, sem nada indicando
                  que falta. O ⋯ ao lado do nó diz QUAL, e de que lado. */}
              {incompletos === 1
                ? 'Uma interação desta cadeia tem ligações fora do recorte — o ⋯ marca de que lado.'
                : `${incompletos} interações deste desenho têm ligações fora do recorte atual — o ⋯ marca de que lado a história continua.`}{' '}
              Amplie o período para ver a cadeia inteira.
            </p>
          ) : null}

          <div className="rolagem-interna" style={{ maxHeight: 460 }}>
            <svg
              width={largura}
              height={altura}
              role="img"
              aria-label={`Cadeia com ${nos.length} interações encadeadas`}
              style={{ display: 'block' }}
            >
              <defs>
                <marker
                  id="seta-da-cadeia"
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--cinza-2)" />
                </marker>
              </defs>

              {/* AS ARESTAS PRIMEIRO, para passarem por baixo dos nós. */}
              {arestas.map(({ de, para }) => {
                const p1 = posicao.get(de);
                const p2 = posicao.get(para);
                if (!p1 || !p2) return null;
                const x1 = p1.x + LARGURA;
                const y1 = p1.y + ALTURA / 2;
                const x2 = p2.x;
                const y2 = p2.y + ALTURA / 2;
                // Curva de Bézier com controles horizontais: a seta sai do nó
                // pela direita e entra no seguinte pela esquerda, sempre. Reta
                // ligando centros cruzaria os cartões, e duas arestas paralelas
                // virariam uma linha grossa só.
                const meio = (x2 - x1) / 2;
                const noCaminhoDoFoco = de === foco?.id || para === foco?.id;
                return (
                  <path
                    key={`${de}->${para}`}
                    d={`M ${x1} ${y1} C ${x1 + meio} ${y1}, ${x2 - meio} ${y2}, ${x2} ${y2}`}
                    fill="none"
                    stroke={noCaminhoDoFoco ? 'var(--azul-mar)' : 'var(--cinza-2)'}
                    strokeWidth={noCaminhoDoFoco ? 2 : 1.5}
                    markerEnd="url(#seta-da-cadeia)"
                  />
                );
              })}

              {nos.map((no) => {
                const p = posicao.get(no.id);
                if (!p) return null;
                const cor = CORES_DE_FRENTE[no.interacao.frente];
                const rotulo = titulo(no);
                const emDestaque = no.id === foco?.id;
                const daLinha = no.id === id;
                const adiante = derivadasForaDaJanela(no, arestas);
                return (
                  <g
                    key={no.id}
                    transform={`translate(${p.x}, ${p.y})`}
                    onClick={() => definirEmFoco(no.id)}
                    onKeyDown={(evento) => {
                      if (evento.key === 'Enter' || evento.key === ' ') {
                        evento.preventDefault();
                        definirEmFoco(no.id);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    // O NÓ É ALCANÇÁVEL POR TECLADO. Um grafo que só responde ao
                    // mouse esconde de quem navega por tabulação exatamente a
                    // informação que a tela existe para dar.
                    aria-label={
                      `${rotulo}. ${dataCompleta(no.interacao.data_interacao)}.` +
                      (daLinha ? ' É a interação de onde você veio.' : '') +
                      (no.origensForaDaJanela > 0
                        ? ' Decorre de interação fora do recorte atual.'
                        : '') +
                      (adiante > 0 ? ' Tem desdobramento fora do recorte atual.' : '') +
                      ' Ver os detalhes.'
                    }
                    style={{ cursor: 'pointer' }}
                  >
                    <rect
                      width={LARGURA}
                      height={ALTURA}
                      rx={12}
                      fill={emDestaque ? 'var(--bg-hover)' : 'var(--branco)'}
                      stroke={emDestaque ? 'var(--azul-mar)' : 'var(--borda)'}
                      strokeWidth={emDestaque ? 2 : 1}
                    />
                    {/* A faixa da frente: a cor diz de que tipo de conversa se
                        trata, e é o que mostra a cadeia ATRAVESSANDO frentes —
                        imprensa levanta, governo responde, legislativo trata,
                        banco financia. */}
                    <rect width={6} height={ALTURA} rx={3} fill={cor} />
                    <text x={18} y={23} style={{ fontSize: 11, fill: 'var(--cinza-2)' }}>
                      {dataCompleta(no.interacao.data_interacao)}
                    </text>
                    <text
                      x={18}
                      y={43}
                      style={{
                        fontSize: 13,
                        fill: 'var(--cinza-4)',
                        fontWeight: daLinha ? 700 : 400,
                      }}
                    >
                      {rotulo.slice(0, 24)}
                      {rotulo.length > 24 ? '…' : ''}
                    </text>
                    <text x={18} y={61} style={{ fontSize: 11, fill: 'var(--cinza-3)' }}>
                      {nomeDaInstituicao(catalogo, no.interacao.instituicao_id).slice(0, 28)}
                    </text>
                    <text
                      x={LARGURA - 12}
                      y={23}
                      textAnchor="end"
                      style={{ fontSize: 10, fill: cor, fontWeight: 700 }}
                    >
                      {ROTULOS_DE_FRENTE[no.interacao.frente]}
                    </text>
                    {/* A MARCA VAI NO NÓ, e não só no aviso do topo: saber QUE
                        existe um nó incompleto não diz QUAL. A reticência é a
                        seta que existiria se o outro lado estivesse carregado —
                        à esquerda quando falta origem, à direita quando falta
                        desdobramento. */}
                    {no.origensForaDaJanela > 0 ? (
                      <text
                        x={-14}
                        y={ALTURA / 2 + 4}
                        textAnchor="middle"
                        style={{ fontSize: 15, fill: 'var(--atencao-fg)' }}
                      >
                        ⋯
                      </text>
                    ) : null}
                    {adiante > 0 ? (
                      <text
                        x={LARGURA + 14}
                        y={ALTURA / 2 + 4}
                        textAnchor="middle"
                        style={{ fontSize: 15, fill: 'var(--atencao-fg)' }}
                      >
                        ⋯
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </svg>
          </div>

          {foco ? (
            <div
              style={{
                borderTop: '1px solid var(--borda)',
                paddingTop: 14,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <ChipDeFrente frente={foco.interacao.frente} />
                <strong style={{ fontSize: 15 }}>{titulo(foco)}</strong>
              </div>
              <div style={{ fontSize: 13, color: 'var(--cinza-3)' }}>
                {[
                  dataCompleta(foco.interacao.data_interacao),
                  nomeDaInstituicao(catalogo, foco.interacao.instituicao_id),
                  nomeDoInterlocutor(catalogo, foco.interacao.interlocutor_id),
                  rotuloDeAbrangencia(foco.interacao.uf),
                  rotuloDeCodigo(catalogo, 'status', foco.interacao.status),
                ]
                  .filter((parte) => parte && parte !== '—')
                  .join(' · ')}
              </div>
              <div style={{ fontSize: 12, color: 'var(--cinza-2)' }}>
                {descreverLigacoes(
                  arestas.filter((a) => a.para === foco.id).length,
                  arestas.filter((a) => a.de === foco.id).length,
                )}
              </div>
              <OQueAconteceu interacao={foco.interacao} catalogo={catalogo} />
            </div>
          ) : null}
        </div>
      )}
    </Modal>
  );
}

/** O conteúdo da agenda em foco, dentro do próprio desenho.
 *
 *  POR QUE ISTO ESTÁ AQUI, E NÃO SÓ NA FICHA
 *  -----------------------------------------
 *  A cadeia responde "o que levou a quê". Só que a resposta não está nas
 *  setas: está em `encaminhamentos` — é a frase "Abcon manterá o diálogo com o
 *  parlamentar" que explica por que existe a reunião seguinte. Um desenho com
 *  data, instituição e nada mais mostra QUE houve encadeamento e esconde POR
 *  QUÊ, que é a única coisa que quem vai à próxima reunião precisa levar.
 *
 *  Só os campos preenchidos aparecem. Rótulo sem valor ocuparia a altura toda
 *  do painel dizendo "não informado" — e a ficha completa, no rodapé, é onde
 *  se vai quando se quer a lista inteira, inclusive o que falta.
 */
function OQueAconteceu({
  interacao,
  catalogo,
}: {
  interacao: Interacao;
  catalogo: Catalogo;
}) {
  const pelaAegea = (interacao.participacoes ?? [])
    .map((p) => nomeDaPessoa(catalogo, p.pessoa_aegea_id))
    .filter((nome) => nome && nome !== '—');
  const pelaOutraParte = (interacao.outra_parte ?? [])
    .map((p) => nomeDoInterlocutor(catalogo, p.interlocutor_id))
    .filter((nome) => nome && nome !== '—');
  const materiais = interacao.materiais ?? [];

  const blocos: { rotulo: string; texto: string }[] = [
    { rotulo: 'Expectativa', texto: interacao.expectativa ?? '' },
    { rotulo: 'Relato', texto: interacao.relato ?? '' },
    // EM DESTAQUE, e não em ordem alfabética: é daqui que sai a próxima
    // agenda, e é a razão de a cadeia existir.
    { rotulo: 'Encaminhamentos', texto: interacao.encaminhamentos ?? '' },
    { rotulo: 'Posicionamento da companhia', texto: interacao.posicionamento ?? '' },
    { rotulo: 'Pendências', texto: interacao.pendencias ?? '' },
  ].filter((bloco) => bloco.texto.trim());

  if (!blocos.length && !pelaAegea.length && !pelaOutraParte.length && !materiais.length) {
    return (
      <p style={{ fontSize: 12, color: 'var(--cinza-2)', margin: 0 }}>
        Esta interação ainda não tem relato. Abra a ficha completa para preencher.
      </p>
    );
  }

  return (
    <div
      className="rolagem-interna"
      style={{ maxHeight: 190, display: 'flex', flexDirection: 'column', gap: 10 }}
    >
      {blocos.map((bloco) => (
        <div key={bloco.rotulo}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              color: 'var(--cinza-2)',
              marginBottom: 2,
            }}
          >
            {bloco.rotulo}
          </div>
          <p
            style={{
              fontSize: 13,
              color: 'var(--cinza-4)',
              margin: 0,
              lineHeight: 1.45,
              fontWeight: bloco.rotulo === 'Encaminhamentos' ? 500 : 400,
            }}
          >
            {bloco.texto}
          </p>
        </div>
      ))}

      {pelaAegea.length || pelaOutraParte.length ? (
        <div style={{ fontSize: 12, color: 'var(--cinza-3)' }}>
          {pelaAegea.length ? (
            <div>
              <strong style={{ color: 'var(--cinza-2)' }}>Pela Aegea:</strong>{' '}
              {pelaAegea.join(', ')}
            </div>
          ) : null}
          {pelaOutraParte.length ? (
            <div>
              <strong style={{ color: 'var(--cinza-2)' }}>Pela outra parte:</strong>{' '}
              {pelaOutraParte.join(', ')}
            </div>
          ) : null}
        </div>
      ) : null}

      {materiais.length ? (
        <div style={{ fontSize: 12, color: 'var(--cinza-3)' }}>
          <strong style={{ color: 'var(--cinza-2)' }}>
            {materiais.length === 1 ? 'Material:' : 'Materiais:'}
          </strong>{' '}
          {materiais.map((m) => m.titulo).join(' · ')}
        </div>
      ) : null}
    </div>
  );
}

/** "Decorre de 2 agendas · Levou a 1" — em palavras, e não em números soltos.
 *
 *  Dois números sem rótulo ao lado de um grafo se leem como coordenadas.
 */
function descreverLigacoes(vemDe: number, levouA: number): string {
  const partes: string[] = [];
  if (vemDe > 0) partes.push(`Decorre de ${vemDe} ${vemDe === 1 ? 'interação' : 'interações'}`);
  if (levouA > 0) partes.push(`Levou a ${levouA} ${levouA === 1 ? 'interação' : 'interações'}`);
  return partes.length ? partes.join(' · ') : 'Começo e fim desta parte da conversa';
}
