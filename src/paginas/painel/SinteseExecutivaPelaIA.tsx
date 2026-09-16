/** A síntese executiva escrita por um agente — hoje, um agente de mentirinha.
 *
 *  NASCE ILUSTRATIVO. O texto abaixo é montado no front, com os mesmos dados
 *  que o resto do Painel já deriva (ver `dominio/sinteseIA.ts`) — não existe
 *  chamada a nenhum modelo. É o desenho da caixa, do fluxo de abrir/fechar e
 *  do feedback que já vale a pena fixar agora; o CONTEÚDO troca de fonte
 *  (front → agente no backend) sem trocar a caixa em volta dele.
 *
 *  A COR É A ÚNICA DIFERENÇA visual de propósito entre esta caixa e a de
 *  "Filtros" (`PainelDeFiltros`): mesma alça de abrir/fechar, mesma seta que
 *  gira 180°, mesma borda — mas em turquesa, e não no azul-mar dos filtros,
 *  porque esta caixa fala de INSIGHT, não de recorte.
 *
 *  O BOTÃO BOM/RUIM já pede o "porquê" em texto — não é telemetria muda. É
 *  este texto, e não o clique isolado, que vira exemplo de treino quando o
 *  agente entrar de verdade: um "ruim" sem explicação não ensina nada.
 */

import { useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Botao, estiloDeEntrada } from '@/componentes/basicos';
import type { Catalogo } from '@/dominio/derivacoes';
import { numero } from '@/dominio/formato';
import {
  deslocarMes,
  gerarSinteseExecutivaIA,
  mesesDisponiveis,
  rotuloDoMesComAno,
} from '@/dominio/sinteseIA';
import type { JanelaDaSinteseIA } from '@/dominio/sinteseIA';
import type { Interacao } from '@/dominio/tipos';

function Num({ children }: { children: ReactNode }) {
  return (
    <strong className="tabular" style={{ color: 'var(--cinza-4)' }}>
      {children}
    </strong>
  );
}

//: QUATRO MODOS, e não só a janela pronta: o rótulo de cada pílula precisa
//: sobreviver a `interacoes` mudando (o recorte global sendo filtrado de
//: novo) sem resetar sozinho — "trimestre" continua sendo "o trimestre mais
//: recente", não uma janela travada no que era mais recente há um clique.
//: Só o mês ESCOLHIDO A DEDO (`personalizado`) precisa guardar a chave em
//: si, porque não há como recalculá-la a partir de "o mais recente".
type ModoDePeriodo = 'atual' | 'passado' | 'trimestre' | 'personalizado';

export function SinteseExecutivaPelaIA({
  interacoes,
  catalogo,
}: {
  interacoes: Interacao[];
  catalogo: Catalogo;
}) {
  const [aberto, definirAberto] = useState(true);
  const [modo, definirModo] = useState<ModoDePeriodo>('atual');
  const [mesEscolhido, definirMesEscolhido] = useState('');

  const meses = useMemo(() => mesesDisponiveis(interacoes), [interacoes]);
  const maisRecente = meses[0];

  const janela: JanelaDaSinteseIA | undefined = useMemo(() => {
    if (!maisRecente) return undefined;
    if (modo === 'passado') return { referencia: deslocarMes(maisRecente, -1), tamanho: 1 };
    if (modo === 'trimestre') return { referencia: maisRecente, tamanho: 3 };
    if (modo === 'personalizado' && mesEscolhido) return { referencia: mesEscolhido, tamanho: 1 };
    return { referencia: maisRecente, tamanho: 1 };
  }, [modo, mesEscolhido, maisRecente]);

  const sintese = useMemo(
    () => gerarSinteseExecutivaIA(interacoes, catalogo, janela),
    [interacoes, catalogo, janela],
  );

  if (!sintese) return null;

  const {
    temHistorico,
    mesAtual,
    mesAnterior,
    totalAtual,
    variacaoTotal,
    tier1Atual,
    tier1Anterior,
    topInstituicoes,
    pctTopInstituicoes,
    areaDestaque,
    areaEmQueda,
    temaDestaque,
    scoreClimaAtual,
    scoreClimaAnterior,
    areaAlerta,
    instituicoesTier1Inativas,
    semTemaClassificado,
  } = sintese;

  const nomesDosTop3 =
    topInstituicoes.length > 1
      ? `${topInstituicoes.slice(0, -1).map((i) => i.nome).join(', ')} e ${topInstituicoes[topInstituicoes.length - 1].nome}`
      : topInstituicoes[0]?.nome;

  return (
    <div
      className="sem-impressao"
      style={{
        border: '1px solid var(--turquesa-rio)',
        borderRadius: 'var(--r-card-int)',
        background: 'color-mix(in srgb, var(--turquesa-rio) 4%, var(--branco))',
      }}
    >
      <button
        type="button"
        onClick={() => definirAberto((v) => !v)}
        aria-expanded={aberto}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '13px 16px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        {/* MESMO DEGRADÊ azul-mar → turquesa-rio do cabeçalho da tela
            (`Layout.tsx`) — e não uma cor nova, para o título soar como a
            MESMA marca, só que em texto em vez de fundo. A seta continua
            sólida em turquesa, sem degradê: um SVG com `stroke` não tem
            `background-clip` para recortar. */}
        <span
          style={{
            fontSize: 15,
            fontWeight: 800,
            backgroundImage: 'linear-gradient(120deg, var(--azul-mar) 0%, var(--turquesa-rio) 100%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Síntese Executiva pela IA
        </span>
        <SetaTurquesa aberto={aberto} />
      </button>

      {aberto ? (
        <div
          style={{
            padding: '4px 18px 20px',
            borderTop: '1px solid color-mix(in srgb, var(--turquesa-rio) 25%, var(--branco))',
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
          }}
        >
          <SeletorDePeriodo
            modo={modo}
            definirModo={definirModo}
            meses={meses}
            mesEscolhido={mesEscolhido}
            definirMesEscolhido={definirMesEscolhido}
          />

          <Bloco titulo="O que aconteceu">
            <p style={ESTILO_DO_PARAGRAFO}>
              <Num>{mesAtual}</Num> fechou com <Num>{numero(totalAtual)}</Num> interações registradas
              {temHistorico ? (
                <>
                  , <Num>{variacaoTotal}</Num> em relação a {mesAnterior}
                </>
              ) : null}
              . {tier1Atual > 0 ? (
                <>
                  O crescimento está concentrado em Tier 1, que{' '}
                  {temHistorico ? (
                    <>
                      passou de <Num>{numero(tier1Anterior)}</Num> para <Num>{numero(tier1Atual)}</Num>{' '}
                      interações
                    </>
                  ) : (
                    <>
                      soma <Num>{numero(tier1Atual)}</Num> interações neste recorte
                    </>
                  )}
                  .{' '}
                </>
              ) : null}
              {topInstituicoes.length ? (
                <>
                  <Num>{pctTopInstituicoes}%</Num> desse volume vem de {nomesDosTop3}.{' '}
                </>
              ) : null}
              {areaDestaque ? (
                <>
                  Por área, <strong>{areaDestaque.nome}</strong> responde por{' '}
                  <Num>{areaDestaque.pct}%</Num> do mês
                  {areaEmQueda ? (
                    <>
                      , enquanto <strong>{areaEmQueda.nome}</strong> recuou de{' '}
                      <Num>{areaEmQueda.pctAnterior}%</Num> para <Num>{areaEmQueda.pctAtual}%</Num>
                    </>
                  ) : null}
                  .{' '}
                </>
              ) : null}
              {temaDestaque ? (
                <>
                  <strong>{temaDestaque.nome}</strong> aparece em{' '}
                  <Num>{temaDestaque.pctAtual}%</Num> das interações do mês
                  {temHistorico ? (
                    <>
                      {' '}
                      ({temaDestaque.pctAtual >= temaDestaque.pctAnterior ? '+' : ''}
                      <Num>{temaDestaque.pctAtual - temaDestaque.pctAnterior}p.p.</Num> frente a{' '}
                      {mesAnterior})
                    </>
                  ) : null}
                  .{' '}
                </>
              ) : null}
              O clima médio ficou em <Num>{scoreClimaAtual}</Num> pontos
              {temHistorico ? (
                <>
                  , frente a <Num>{scoreClimaAnterior}</Num> em {mesAnterior}
                </>
              ) : null}
              .
            </p>
          </Bloco>

          <Bloco titulo="Alertas">
            <p style={ESTILO_DO_PARAGRAFO}>
              {areaAlerta ? (
                <>
                  A área <strong>{areaAlerta.nome}</strong> acumula o pior placar de clima do recorte:{' '}
                  <Num>{areaAlerta.score}</Num> pontos, sobre <Num>{numero(areaAlerta.total)}</Num>{' '}
                  interações com clima registrado.{' '}
                </>
              ) : (
                'Nenhuma área com clima negativo sustentado neste recorte. '
              )}
              {instituicoesTier1Inativas.length ? (
                <>
                  <Num>{numero(instituicoesTier1Inativas.length)}</Num>{' '}
                  {instituicoesTier1Inativas.length === 1 ? 'instituição' : 'instituições'} Tier 1{' '}
                  {instituicoesTier1Inativas.length === 1 ? 'está' : 'estão'} sem interação registrada há
                  mais de <Num>90 dias</Num>.{' '}
                </>
              ) : (
                'Nenhuma instituição Tier 1 está inativa há mais de 90 dias. '
              )}
              {semTemaClassificado.total > 0 ? (
                <>
                  <Num>{semTemaClassificado.pct}%</Num> das interações de {mesAtual} entraram sem tema
                  classificado, o que limita a leitura por assunto.
                </>
              ) : (
                `Todas as interações de ${mesAtual} têm tema classificado.`
              )}
            </p>
          </Bloco>

          <Bloco titulo="Próximos passos">
            <ul style={{ ...ESTILO_DO_PARAGRAFO, margin: 0, paddingLeft: 18 }}>
              {areaAlerta ? (
                <li>
                  Acompanhar de perto a área <strong>{areaAlerta.nome}</strong>, cujo placar de clima está
                  em <Num>{areaAlerta.score}</Num> pontos.
                </li>
              ) : null}
              {instituicoesTier1Inativas.length ? (
                <li>
                  Retomar contato com {instituicoesTier1Inativas.length === 1 ? 'a' : 'as'}{' '}
                  <Num>{numero(instituicoesTier1Inativas.length)}</Num>{' '}
                  {instituicoesTier1Inativas.length === 1 ? 'instituição' : 'instituições'} Tier 1 sem
                  interação há mais de 90 dias.
                </li>
              ) : null}
              {semTemaClassificado.total > 0 ? (
                <li>
                  Completar a classificação de tema dos <Num>{numero(semTemaClassificado.total)}</Num>{' '}
                  registros de {mesAtual} sem assunto definido.
                </li>
              ) : null}
              {!areaAlerta && !instituicoesTier1Inativas.length && !semTemaClassificado.total ? (
                <li>Nenhuma ação crítica identificada — manter o acompanhamento de rotina.</li>
              ) : null}
            </ul>
          </Bloco>

          <FeedbackDoInsight />
        </div>
      ) : null}
    </div>
  );
}

const ESTILO_DO_PARAGRAFO: CSSProperties = {
  fontSize: 13.5,
  lineHeight: 1.6,
  color: 'var(--cinza-3)',
  margin: 0,
};

function Bloco({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div>
      <div className="kicker" style={{ color: 'var(--turquesa-rio)', marginBottom: 8 }}>
        {titulo}
      </div>
      {children}
    </div>
  );
}

/** Qual janela esta caixa analisa — INDEPENDENTE do filtro de período do
 *  resto do Painel (ver o comentário no topo de `dominio/sinteseIA.ts`).
 *  Três pílulas para os casos de sempre, e um select por baixo para o caso
 *  pontual ("quero ver o fechamento de agosto"): escolher um mês ali troca
 *  o modo para `personalizado` sozinho, sem precisar de um botão à parte
 *  para "confirmar" a escolha. */
function SeletorDePeriodo({
  modo,
  definirModo,
  meses,
  mesEscolhido,
  definirMesEscolhido,
}: {
  modo: ModoDePeriodo;
  definirModo: (modo: ModoDePeriodo) => void;
  meses: string[];
  mesEscolhido: string;
  definirMesEscolhido: (mes: string) => void;
}) {
  const PILULAS: { modo: ModoDePeriodo; rotulo: string }[] = [
    { modo: 'atual', rotulo: 'Mês atual' },
    { modo: 'passado', rotulo: 'Mês passado' },
    { modo: 'trimestre', rotulo: 'Trimestre' },
  ];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      {PILULAS.map((pilula) => {
        const ativa = modo === pilula.modo;
        return (
          <button
            key={pilula.modo}
            type="button"
            onClick={() => definirModo(pilula.modo)}
            aria-pressed={ativa}
            style={{
              height: 26,
              padding: '0 11px',
              borderRadius: 'var(--r-chip)',
              border: `1px solid ${ativa ? 'var(--turquesa-rio)' : 'var(--borda-input)'}`,
              background: ativa ? 'var(--turquesa-rio)' : 'var(--branco)',
              color: ativa ? 'var(--branco)' : 'var(--cinza-3)',
              fontSize: 11.5,
              fontWeight: ativa ? 700 : 500,
              cursor: 'pointer',
            }}
          >
            {pilula.rotulo}
          </button>
        );
      })}

      {meses.length > 1 ? (
        <select
          value={modo === 'personalizado' ? mesEscolhido : ''}
          onChange={(evento) => {
            definirMesEscolhido(evento.target.value);
            definirModo('personalizado');
          }}
          aria-label="Escolher um mês específico para analisar"
          style={{
            height: 26,
            padding: '0 8px',
            borderRadius: 'var(--r-chip)',
            border: `1px solid ${modo === 'personalizado' ? 'var(--turquesa-rio)' : 'var(--borda-input)'}`,
            background: 'var(--branco)',
            color: modo === 'personalizado' ? 'var(--cinza-4)' : 'var(--cinza-2)',
            fontSize: 11.5,
            fontWeight: modo === 'personalizado' ? 700 : 500,
            cursor: 'pointer',
          }}
        >
          <option value="" disabled>
            Ou escolha um mês…
          </option>
          {meses.map((mes) => (
            <option key={mes} value={mes}>
              {rotuloDoMesComAno(mes)}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}

/** Mesma seta de `PainelDeFiltros` (círculo + chevron que gira 180°), em
 *  turquesa — a única diferença de propósito entre as duas caixas. */
function SetaTurquesa({ aberto }: { aberto: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 28,
        height: 28,
        borderRadius: '50%',
        background: 'color-mix(in srgb, var(--turquesa-rio) 16%, var(--branco))',
        flexShrink: 0,
        transform: aberto ? 'rotate(180deg)' : 'none',
        transition: 'transform .18s',
      }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path
          d="M3.2 6 8 10.4 12.8 6"
          stroke="var(--turquesa-rio)"
          strokeWidth="2.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

/** Bom/Ruim, com o "porquê" sempre em texto — ver o comentário no topo do
 *  arquivo. NADA disto viaja para lugar nenhum ainda: `enviado` só troca o
 *  próprio bloco por um agradecimento. Quando o agente existir no backend,
 *  o `aoClicar` do botão "Enviar" troca de um `console.log` por um POST —
 *  a caixa em volta não muda. */
function FeedbackDoInsight() {
  const [avaliacao, definirAvaliacao] = useState<'bom' | 'ruim' | null>(null);
  const [comentario, definirComentario] = useState('');
  const [enviado, definirEnviado] = useState(false);

  if (enviado) {
    return (
      <p style={{ fontSize: 12, color: 'var(--cinza-2)', margin: 0 }}>
        Obrigado! Isso ajuda a treinar o agente.
      </p>
    );
  }

  return (
    <div
      style={{
        paddingTop: 14,
        borderTop: '1px solid color-mix(in srgb, var(--turquesa-rio) 20%, var(--branco))',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: 'var(--cinza-2)' }}>Essa síntese foi útil?</span>
        <BotaoDeAvaliacao
          rotulo="Bom"
          cor="var(--turquesa-rio)"
          ativo={avaliacao === 'bom'}
          aoClicar={() => definirAvaliacao('bom')}
        />
        <BotaoDeAvaliacao
          rotulo="Ruim"
          cor="var(--vermelho-pitanga)"
          ativo={avaliacao === 'ruim'}
          aoClicar={() => definirAvaliacao('ruim')}
        />
      </div>

      {avaliacao ? (
        <div style={{ marginTop: 10 }}>
          <label
            htmlFor="comentario-da-sintese-ia"
            style={{ fontSize: 12, color: 'var(--cinza-2)', display: 'block', marginBottom: 6 }}
          >
            Por que essa síntese foi {avaliacao === 'bom' ? 'boa' : 'ruim'}?
          </label>
          <textarea
            id="comentario-da-sintese-ia"
            value={comentario}
            onChange={(evento) => definirComentario(evento.target.value)}
            rows={3}
            placeholder="Conte o que fez a resposta ser boa ou ruim — isso é o que treina o agente."
            style={{ ...estiloDeEntrada, height: 'auto', padding: '8px 11px', resize: 'vertical' }}
          />
          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
            <Botao
              variante="primario"
              desabilitado={!comentario.trim()}
              aoClicar={() => {
                // SÓ UM LOG, DE PROPÓSITO — não existe onde gravar isto ainda.
                // Quando o agente entrar no backend, esta chamada troca por
                // um POST com o mesmo par (avaliação, comentário); a caixa
                // em volta (Bom/Ruim → texto → confirmação) não muda.
                console.info('[síntese executiva pela IA] feedback:', { avaliacao, comentario });
                definirEnviado(true);
              }}
            >
              Enviar
            </Botao>
            <Botao
              variante="fantasma"
              aoClicar={() => {
                definirAvaliacao(null);
                definirComentario('');
              }}
            >
              Cancelar
            </Botao>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function BotaoDeAvaliacao({
  rotulo,
  cor,
  ativo,
  aoClicar,
}: {
  rotulo: string;
  cor: string;
  ativo: boolean;
  aoClicar: () => void;
}) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      aria-pressed={ativo}
      style={{
        height: 27,
        padding: '0 13px',
        borderRadius: 'var(--r-chip)',
        border: `1px solid ${ativo ? cor : 'var(--borda-input)'}`,
        background: ativo ? cor : 'var(--branco)',
        color: ativo ? 'var(--branco)' : 'var(--cinza-3)',
        fontSize: 12,
        fontWeight: ativo ? 700 : 500,
        cursor: 'pointer',
      }}
    >
      {rotulo}
    </button>
  );
}
