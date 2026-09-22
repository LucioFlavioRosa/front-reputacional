/** Sinais de mercado — o que está circulando antes de virar efeito.
 *
 *  A PERGUNTA DESTA TELA. Investidores, bancos e plataformas de rating mandam
 *  questionários cuja pergunta já dá algo como fato ("como a companhia trata a
 *  possibilidade de o Banco X não renegociar a dívida?"). Uma pergunta dessas
 *  é diligência. A MESMA pergunta chegando de quatro instituições que não se
 *  falam, em duas semanas, é um movimento — e ele precede o efeito (juros,
 *  spread, rating) em semanas. Esta tela mostra a diferença entre as duas.
 *
 *  CONVERGÊNCIA NÃO É PROVA DE COMBINAÇÃO, e a tela não diz que é. Ela conta
 *  quantas instituições distintas trouxeram cada alegação e em quanto tempo;
 *  a conclusão é de quem lê. Ver `dominio/sinais.ts` e o ADR 0003 do back.
 *
 *  DE ONDE VÊM OS DADOS. As consultas são as `interacoes` do contexto — o
 *  recorte já aplicado pelo servidor —, filtradas pelo bloco `consulta`, que
 *  só o tipo "Consulta recebida" tem. Isso é ESCOPO DA TELA, e não um filtro
 *  do recorte: o recorte continua sendo o que a pessoa escolheu, e vale aqui
 *  como vale no Painel. As alegações vêm do catálogo, com as inativas —
 *  quem oferece escolha filtra.
 */

import { useMemo } from 'react';
import { usePainel } from '@/estado/painel';
import { Botao, Carregando, Cartao, Chip, FaixaDeErro, Secao, Vazio } from '@/componentes/basicos';
import { CampoSuspenso } from '@/componentes/CampoSuspenso';
import { FaixaDeFiltros } from '@/componentes/FaixaDeFiltros';
import {
  campoDeAreaPorCategoria,
  campoDeCategoriaPublico,
  campoDeTema,
} from '@/componentes/PainelDeFiltros';
import { Legenda } from '@/graficos/BarrasEmpilhadas';
import { Ranking } from '@/graficos/Ranking';
import { Rosca } from '@/graficos/Rosca';
import { dataCompleta } from '@/dominio/formato';
import {
  alternar,
  limparAreas,
  limparCategoriaPublico,
  limparTags,
} from '@/dominio/recorte';
import type { Recorte } from '@/dominio/recorte';
import { nomeDaInstituicao, nomesDosTemas, rotuloDeCodigo } from '@/dominio/derivacoes';
import type { Catalogo } from '@/dominio/derivacoes';
import {
  DIAS_DA_JANELA,
  INSTITUICOES_PARA_CONVERGIR,
  alegacoesEmCirculacao,
  consultasDe,
  consultasVencidas,
  porApuracao,
  quemPergunta,
  semPosicionamento,
} from '@/dominio/sinais';
import type { AlegacaoEmCirculacao } from '@/dominio/sinais';
import type { Interacao } from '@/dominio/tipos';

/** Quantas consultas a lista mostra antes de cortar. */
const QUANTAS_CONSULTAS = 10;

export function SinaisDeMercado({ aoAbrirAgenda }: { aoAbrirAgenda: (id: string) => void }) {
  const { catalogo, recorte, definirRecorte, interacoes, carregando, atualizando, erro } =
    usePainel();

  const consultas = useMemo(() => consultasDe(interacoes), [interacoes]);
  const emCirculacao = useMemo(
    () => alegacoesEmCirculacao(consultas, catalogo?.alegacoes ?? []),
    [consultas, catalogo],
  );

  if (!catalogo) return <Carregando rotulo="Carregando o catálogo…" />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <Secao
        titulo="Sinais de mercado"
        subtitulo="O que perguntaram sem que a companhia tivesse comunicado. A mesma premissa vinda de instituições diferentes, em poucos dias, é um movimento em curso."
        nivelDoTitulo={1}
      >
        {/* A MESMA FAIXA DAS OUTRAS TELAS. Tema, Área e Público valem aqui
            como valem no Painel — o recorte é um só. Tipo de Interação NÃO
            entra: esta tela já é sobre um tipo, e oferecer o filtro faria
            parecer que dá para ver reunião aqui. */}
        <FaixaDeFiltros>
          <CampoSuspenso
            campo={campoDeTema(recorte, definirRecorte, catalogo)}
            aoLimpar={() => definirRecorte(limparTags(recorte))}
          />
          <CampoSuspenso
            campo={campoDeAreaPorCategoria(recorte, definirRecorte, catalogo)}
            aoLimpar={() => definirRecorte(limparAreas(recorte))}
          />
          <CampoSuspenso
            campo={campoDeCategoriaPublico(recorte, definirRecorte, catalogo)}
            aoLimpar={() => definirRecorte(limparCategoriaPublico(recorte))}
          />
        </FaixaDeFiltros>
      </Secao>

      {erro ? <FaixaDeErro mensagem={erro} /> : null}

      {carregando ? (
        <Carregando rotulo="Reunindo as consultas recebidas…" />
      ) : consultas.length === 0 ? (
        <Vazio
          mensagem="Nenhuma consulta recebida neste recorte"
          dica='Registre o questionário como uma interação do tipo "Consulta recebida" — o que ela dá como fato vira uma alegação.'
        />
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 24,
            opacity: atualizando ? 0.6 : 1,
          }}
        >
          <BlocoDoQueCircula
            emCirculacao={emCirculacao}
            catalogo={catalogo}
            recorte={recorte}
            definirRecorte={definirRecorte}
          />
          <BlocoDeQuemPergunta
            consultas={consultas}
            emCirculacao={emCirculacao}
            catalogo={catalogo}
            recorte={recorte}
            definirRecorte={definirRecorte}
          />
          <BlocoDaFila emCirculacao={emCirculacao} consultas={consultas} catalogo={catalogo} />
          <BlocoDeConsultas
            consultas={consultas}
            catalogo={catalogo}
            aoAbrirAgenda={aoAbrirAgenda}
          />
        </div>
      )}
    </div>
  );
}

/* -- bloco 1: o que está circulando ------------------------------------------ */

//: CLICAR NUMA ALEGAÇÃO FILTRA A TELA INTEIRA — o mesmo gesto do Painel e da
//: Preparar agenda. O filtro é do recorte (`alegacao`) e quem aplica é o
//: servidor, então a lista de consultas, os rankings e a fila respondem juntos.
function BlocoDoQueCircula({
  emCirculacao,
  catalogo,
  recorte,
  definirRecorte,
}: {
  emCirculacao: AlegacaoEmCirculacao[];
  catalogo: Catalogo;
  recorte: Recorte;
  definirRecorte: (recorte: Recorte) => void;
}) {
  return (
    <Secao
      titulo="O que está circulando"
      subtitulo={`Ordenado por quantas instituições distintas trouxeram cada premissa. ${INSTITUICOES_PARA_CONVERGIR} ou mais em até ${DIAS_DA_JANELA} dias ficam em destaque — é padrão a olhar, não prova de combinação.`}
    >
      <Cartao>
        {emCirculacao.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--cinza-2)', margin: 0 }}>
            As consultas deste recorte não trouxeram nenhuma alegação registrada.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {emCirculacao.map((item) => {
              const ativo = recorte.alegacao === item.alegacao.id;
              return (
                <li
                  key={item.alegacao.id}
                  style={{
                    padding: '10px 12px',
                    borderTop: '1px solid var(--borda)',
                    background: ativo ? 'var(--bg-hover)' : undefined,
                    borderLeft: item.convergente
                      ? '3px solid var(--atencao-fg)'
                      : '3px solid transparent',
                    cursor: 'pointer',
                  }}
                  onClick={() => definirRecorte(alternar(recorte, 'alegacao', item.alegacao.id))}
                >
                  <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>
                      {item.alegacao.texto}
                    </span>
                    <Chip
                      rotulo={rotuloDeCodigo(
                        catalogo,
                        'apuracoes',
                        codigoDaApuracao(catalogo, item.alegacao.apuracao_id),
                      )}
                      fundo={corDaApuracao(catalogo, item.alegacao.apuracao_id)}
                      texto="var(--cinza-4)"
                    />
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--cinza-2)', margin: '4px 0 0' }}>
                    <strong style={{ color: 'var(--cinza-4)' }}>
                      {item.instituicoes}{' '}
                      {item.instituicoes === 1 ? 'instituição' : 'instituições'}
                    </strong>
                    {' · '}
                    {item.consultas.length}{' '}
                    {item.consultas.length === 1 ? 'consulta' : 'consultas'}
                    {' · '}
                    {item.primeira === item.ultima
                      ? dataCompleta(item.ultima)
                      : `${dataCompleta(item.primeira)} a ${dataCompleta(item.ultima)}`}
                    {item.alegacao.temas.length
                      ? ` · ${nomesDosTemas(catalogo, item.alegacao.temas).join(', ')}`
                      : ''}
                    {item.alegacao.referencia_id ? '' : ' · sem posicionamento publicado'}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </Cartao>
    </Secao>
  );
}

/** O código da apuração, para o rótulo sair do dicionário e não de uma lista
 *  fixa aqui. */
function codigoDaApuracao(catalogo: Catalogo, id: number): string {
  return catalogo.dicionarios.apuracoes.find((a) => a.id === id)?.codigo ?? '';
}

function corDaApuracao(catalogo: Catalogo, id: number): string {
  const cor = catalogo.dicionarios.apuracoes.find((a) => a.id === id)?.cor_hex;
  // A cor do dicionário é do TEXTO, não do fundo: usada cheia atrás do rótulo,
  // o contraste cai abaixo do mínimo. `color-mix` a dilui como faz a Barra.
  return cor ? `color-mix(in srgb, ${cor} 22%, white)` : 'var(--bg-trilho)';
}

/* -- bloco 2: quem está perguntando ------------------------------------------ */

function BlocoDeQuemPergunta({
  consultas,
  emCirculacao,
  catalogo,
  recorte,
  definirRecorte,
}: {
  consultas: Interacao[];
  emCirculacao: AlegacaoEmCirculacao[];
  catalogo: Catalogo;
  recorte: Recorte;
  definirRecorte: (recorte: Recorte) => void;
}) {
  const instituicoes = quemPergunta(consultas, (id) => nomeDaInstituicao(catalogo, id));
  const apuracoes = porApuracao(emCirculacao, catalogo.dicionarios.apuracoes);

  return (
    <Secao
      titulo="Quem está perguntando, e em que pé está a apuração"
      subtitulo="Um banco insistindo é uma relação a cuidar; o mercado inteiro perguntando é outra conversa."
    >
      <div className="grade grade--2" style={{ gap: 16, alignItems: 'start' }}>
        <Cartao>
          <p className="kicker" style={{ marginBottom: 10 }}>
            Instituições que mais consultaram
          </p>
          <Ranking
            itens={instituicoes}
            ativo={recorte.entidade}
            aoClicar={(chave) => definirRecorte(alternar(recorte, 'entidade', chave))}
            vazio="Nenhuma consulta no recorte."
          />
        </Cartao>

        <Cartao>
          <p className="kicker" style={{ marginBottom: 10 }}>
            Apuração das alegações
          </p>
          <Rosca itens={apuracoes} vazio="Nenhuma alegação no recorte." />
          <Legenda itens={apuracoes} centralizada />
        </Cartao>
      </div>
    </Secao>
  );
}

/* -- bloco 3: o que precisa de resposta -------------------------------------- */

//: O ÚNICO BLOCO ACIONÁVEL. Duas dívidas diferentes de propósito juntas: a
//: consulta cujo prazo venceu sem resposta e a alegação que circula sem
//: posicionamento publicado. Separá-las em dois blocos faria a segunda ser
//: lida como estatística, e ela é trabalho.
function BlocoDaFila({
  emCirculacao,
  consultas,
  catalogo,
}: {
  emCirculacao: AlegacaoEmCirculacao[];
  consultas: Interacao[];
  catalogo: Catalogo;
}) {
  const hoje = new Date().toISOString().slice(0, 10);
  const vencidas = consultasVencidas(consultas, hoje);
  const semResposta = semPosicionamento(emCirculacao);

  if (!vencidas.length && !semResposta.length) return null;

  return (
    <Secao
      titulo="O que precisa de resposta"
      subtitulo="Prazo vencido sem resposta, e premissa em circulação sem posicionamento publicado."
    >
      <div className="grade grade--2" style={{ gap: 16, alignItems: 'start' }}>
        {vencidas.length ? (
          <Cartao>
            <p className="kicker" style={{ marginBottom: 10 }}>
              Consultas com prazo vencido ({vencidas.length})
            </p>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {vencidas.map((consulta) => (
                <li
                  key={consulta.id}
                  style={{ padding: '8px 0', borderTop: '1px solid var(--borda)', fontSize: 13 }}
                >
                  {nomeDaInstituicao(catalogo, consulta.instituicao_id)}
                  <span style={{ color: 'var(--erro-fg)' }}>
                    {' · venceu em '}
                    {dataCompleta(consulta.consulta?.prazo_resposta ?? '')}
                  </span>
                </li>
              ))}
            </ul>
          </Cartao>
        ) : null}

        {semResposta.length ? (
          <Cartao>
            <p className="kicker" style={{ marginBottom: 10 }}>
              Alegações sem posicionamento ({semResposta.length})
            </p>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {semResposta.map((item) => (
                <li
                  key={item.alegacao.id}
                  style={{ padding: '8px 0', borderTop: '1px solid var(--borda)', fontSize: 13 }}
                >
                  {item.alegacao.texto}
                  <span style={{ color: 'var(--cinza-2)' }}>
                    {' · '}
                    {item.instituicoes}{' '}
                    {item.instituicoes === 1 ? 'instituição' : 'instituições'}
                  </span>
                </li>
              ))}
            </ul>
          </Cartao>
        ) : null}
      </div>
    </Secao>
  );
}

/* -- bloco 4: as consultas ---------------------------------------------------- */

function BlocoDeConsultas({
  consultas,
  catalogo,
  aoAbrirAgenda,
}: {
  consultas: Interacao[];
  catalogo: Catalogo;
  aoAbrirAgenda: (id: string) => void;
}) {
  const recentes = [...consultas]
    .sort((a, b) => b.data_interacao.localeCompare(a.data_interacao))
    .slice(0, QUANTAS_CONSULTAS);

  return (
    <Secao
      titulo="Consultas recebidas"
      subtitulo={`As ${Math.min(consultas.length, QUANTAS_CONSULTAS)} mais recentes de ${consultas.length} no recorte.`}
    >
      <Cartao>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {recentes.map((consulta) => (
            <li key={consulta.id} style={{ padding: '10px 0', borderTop: '1px solid var(--borda)' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>
                  {nomeDaInstituicao(catalogo, consulta.instituicao_id)}
                </span>
                <span style={{ fontSize: 11, color: 'var(--cinza-2)', whiteSpace: 'nowrap' }}>
                  {dataCompleta(consulta.data_interacao)}
                  {consulta.consulta?.canal_id
                    ? ` · ${rotuloDeCodigo(
                        catalogo,
                        'canais_consulta',
                        catalogo.dicionarios.canais_consulta.find(
                          (c) => c.id === consulta.consulta?.canal_id,
                        )?.codigo ?? '',
                      )}`
                    : ''}
                </span>
                <Botao variante="fantasma" aoClicar={() => aoAbrirAgenda(consulta.id)}>
                  Abrir
                </Botao>
              </div>
              {consulta.consulta?.remetente ? (
                <p style={{ fontSize: 12, color: 'var(--cinza-3)', margin: '2px 0 0' }}>
                  {consulta.consulta.remetente}
                </p>
              ) : null}
              {consulta.consulta?.teor ? (
                <p style={{ fontSize: 12, color: 'var(--cinza-2)', margin: '4px 0 0' }}>
                  {consulta.consulta.teor}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </Cartao>
    </Secao>
  );
}
