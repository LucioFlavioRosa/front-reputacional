/** Situação — o que precisa de você.
 *
 *  A ÚNICA TELA QUE ALGUÉM PRECISA ABRIR TODO DIA.
 *
 *  O painel respondia "quanto houve". Não respondia "o que precisa de mim" — e
 *  é essa a pergunta de quem chega de manhã. Aqui a leitura é por EXCEÇÃO: a
 *  frase do recorte no topo, e abaixo só o que fugiu do padrão.
 *
 *  Cada linha abre a lista das agendas que a compõem, e cada agenda leva à
 *  ficha por endereço próprio — o que torna a fila algo que se manda a alguém,
 *  e não algo que se lê e se anota fora do sistema.
 *
 *  QUANDO NÃO HÁ NADA, A TELA DIZ ISSO. Uma fila que nunca fica vazia deixa de
 *  ser fila.
 */

import { useMemo, useState } from 'react';
import { usePainel } from '@/estado/painel';
import { Carregando, Cartao, FaixaDeErro, Secao } from '@/componentes/basicos';
import { numero } from '@/dominio/formato';
import { agendasApontadas, excecoes } from '@/dominio/excecoes';
import type { Excecao } from '@/dominio/excecoes';
import { lerRecorteEmPalavras } from '@/dominio/leitura';
import { RaioXDaExcecao } from '@/componentes/RaioXDaExcecao';
import type { Catalogo } from '@/dominio/derivacoes';

export function Situacao({ aoAbrirAgenda }: { aoAbrirAgenda: (id: string) => void }) {
  const { interacoes, catalogo, carregando, erro } = usePainel();
  const [aberta, definirAberta] = useState<string | null>(null);

  const fila = useMemo(
    () => (catalogo ? excecoes(interacoes, catalogo) : []),
    [interacoes, catalogo],
  );
  const leitura = useMemo(
    () => (catalogo ? lerRecorteEmPalavras(interacoes, catalogo, fila) : null),
    [interacoes, catalogo, fila],
  );

  if (erro) return <FaixaDeErro mensagem={erro} />;
  if (carregando || !catalogo || !leitura) return <Carregando />;

  const apontadas = agendasApontadas(fila);
  //: DOIS GRUPOS. Uma fila única apontava 56% da base — o que precisa de
  //: decisão hoje sumia no meio do registro por preencher.
  const paraDecidir = fila.filter((e) => e.natureza === 'decisao');
  const paraCompletar = fila.filter((e) => e.natureza === 'registro');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 26 }}>Situação</h1>
        <p style={{ fontSize: 15, color: 'var(--cinza-3)', marginTop: 6, maxWidth: '62ch' }}>
          {leitura.situacao}
        </p>
      </div>

      {/* A COMPLICAÇÃO ANTES DA FILA. É a leitura que dá sentido às linhas de
          baixo — sem ela, a fila é uma lista de tarefas sem contexto. */}
      {leitura.complicacoes.length ? (
        <Cartao>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em',
                        textTransform: 'uppercase', color: 'var(--cinza-2)' }}>
            O que fugiu do padrão
          </div>
          <ul style={{ margin: '10px 0 0', paddingLeft: 18, display: 'flex',
                       flexDirection: 'column', gap: 6 }}>
            {leitura.complicacoes.map((frase) => (
              <li key={frase} style={{ fontSize: 14, color: 'var(--cinza-4)' }}>
                {frase}
              </li>
            ))}
          </ul>
        </Cartao>
      ) : null}

      {!fila.length ? (
        <Secao titulo="Nada a apontar" nivelDoTitulo={1} estilo={{ padding: 0 }}>
          <div style={{ padding: 24 }}>
            <p style={{ fontSize: 14, color: 'var(--cinza-3)', margin: 0 }}>
              Nada a decidir neste recorte.
            </p>
          </div>
        </Secao>
      ) : (
        <>
          <Grupo
            titulo="Precisam de decisão"
            explica="Marcar, declinar, cobrar ou abrir a frente."
            excecoes={paraDecidir}
            aberta={aberta}
            definirAberta={definirAberta}
            catalogo={catalogo}
            aoAbrirAgenda={aoAbrirAgenda}
          />
          <Grupo
            titulo="Registro incompleto"
            explica="A agenda aconteceu e o registro ficou pela metade."
            excecoes={paraCompletar}
            aberta={aberta}
            definirAberta={definirAberta}
            catalogo={catalogo}
            aoAbrirAgenda={aoAbrirAgenda}
          />
        </>
      )}

      {/* A SOMA DAS LINHAS PASSA DO TOTAL, e dizer isso evita que quem soma
          desconfie do número certo: uma agenda Tier 1 sem material e sem
          porta-voz aparece em duas linhas. */}
      {fila.length > 1 ? (
        <p style={{ fontSize: 12, color: 'var(--cinza-2)', margin: 0 }}>
          A mesma agenda pode aparecer em mais de uma linha. {numero(apontadas)}{' '}
          {apontadas === 1 ? 'agenda distinta' : 'agendas distintas'} no total.
        </p>
      ) : null}
    </div>
  );
}

/** Um grupo da fila. Some inteiro quando não tem nada — um bloco vazio com
 *  título ensina a ignorar o título. */
function Grupo({
  titulo,
  explica,
  excecoes: lista,
  aberta,
  definirAberta,
  catalogo,
  aoAbrirAgenda,
}: {
  titulo: string;
  explica: string;
  excecoes: Excecao[];
  aberta: string | null;
  definirAberta: (chave: string | null) => void;
  catalogo: Catalogo;
  aoAbrirAgenda: (id: string) => void;
}) {
  if (!lista.length) return null;

  const quantas = agendasApontadas(lista);

  return (
    <Secao
      titulo={`${titulo} — ${numero(quantas)} ${quantas === 1 ? 'agenda' : 'agendas'}`}
      estilo={{ padding: 0 }}
    >
      <p
        style={{
          fontSize: 12.5,
          color: 'var(--cinza-2)',
          margin: 0,
          padding: '0 20px 12px',
        }}
      >
        {explica}
      </p>
      <div>
        {lista.map((excecao) => (
          <Linha
            key={excecao.chave}
            excecao={excecao}
            aberta={aberta === excecao.chave}
            aoAlternar={() =>
              definirAberta(aberta === excecao.chave ? null : excecao.chave)
            }
            catalogo={catalogo}
            aoAbrirAgenda={aoAbrirAgenda}
          />
        ))}
      </div>
    </Secao>
  );
}

function Linha({
  excecao,
  aberta,
  aoAlternar,
  catalogo,
  aoAbrirAgenda,
}: {
  excecao: Excecao;
  aberta: boolean;
  aoAlternar: () => void;
  catalogo: Catalogo;
  aoAbrirAgenda: (id: string) => void;
}) {
  const quantos = excecao.agendas.length || (excecao.itens?.length ?? 0);

  return (
    <div style={{ borderBottom: '1px solid var(--borda)' }}>
      <button
        type="button"
        onClick={aoAlternar}
        aria-expanded={aberta}
        style={{
          display: 'grid',
          gridTemplateColumns: '58px 1fr 24px',
          gap: 16,
          alignItems: 'baseline',
          width: '100%',
          padding: '16px 20px',
          background: aberta ? 'var(--bg-hover)' : 'transparent',
          border: 'none',
          textAlign: 'left',
          cursor: 'pointer',
          font: 'inherit',
        }}
      >
        <span
          className="tabular"
          style={{
            fontSize: 21,
            fontWeight: 700,
            color: 'var(--atencao-fg)',
            textAlign: 'right',
          }}
        >
          {numero(quantos)}
        </span>
        <span>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--cinza-4)' }}>
            {excecao.titulo}
          </span>
          <span
            style={{
              display: 'block',
              fontSize: 13,
              color: 'var(--cinza-2)',
              marginTop: 3,
              maxWidth: '68ch',
            }}
          >
            {excecao.porque}
          </span>
        </span>
        <span aria-hidden style={{ color: 'var(--cinza-2)', fontSize: 13 }}>
          {aberta ? '▲' : '▼'}
        </span>
      </button>

      {aberta ? (
        <div style={{ padding: '0 20px 16px 74px' }}>
          {excecao.itens ? (
            <p style={{ fontSize: 14, color: 'var(--cinza-3)', margin: 0 }}>
              {excecao.itens.join(' · ')}
            </p>
          ) : (
            <RaioXDaExcecao
              agendas={excecao.agendas}
              catalogo={catalogo}
              aoAbrirAgenda={aoAbrirAgenda}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}
