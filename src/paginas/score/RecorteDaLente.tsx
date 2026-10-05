/** O nível 3: o modal que abre quando alguém clica num dado.
 *
 *  POR QUE ELE EXISTE, nas palavras do dono do produto: "ao clicar em um dado
 *  temos que abrir um modal com o deep diving, e não como é feito hoje". Antes, o
 *  clique aplicava o recorte na TELA INTEIRA — a nota mudava, os painéis se
 *  refaziam, e quem clicou perdia de vista o mês de onde saiu. É recortar, não
 *  aprofundar. O modal põe o pedaço AO LADO do mês, com a trilha de volta.
 *
 *  CINCO PARTES, na ordem do pacote (FRONTEND §4):
 *
 *    1. a frase com o impacto em pontos
 *    2. a barra de composição do recorte
 *    3. o histórico: o mesmo recorte mês a mês
 *    4. "dentro deste recorte": as dimensões ainda não usadas — clicar EMPILHA
 *    5. os itens do recorte
 *
 *  E TUDO NUM PEDIDO SÓ. Cinco chamadas dariam cinco estados de carregamento
 *  dentro do mesmo painel, cada um aparecendo e sumindo na frente de quem só
 *  clicou numa barra.
 *
 *  O PACOTE PEDE GAVETA À DIREITA; isto é um modal centrado de 600px. A troca é
 *  deliberada: `Modal` já traz o foco que entra, fica e volta, o Escape, o
 *  clique fora e o nome para quem ouve a tela — máquinas que uma gaveta nova
 *  escreveria de novo, e provavelmente pior. A diferença é onde o painel
 *  aparece, não o que ele faz.
 */

import { useEffect, useState } from 'react';

import type { FiltroDaLente, RecorteDaLente as Recorte } from '@/api/cliente';
import { obterRecorteDaLente } from '@/api/cliente';
import { Abas } from '@/componentes/Abas';
import { Carregando, FaixaDeErro, Modal } from '@/componentes/basicos';
import { colunasDaTabela, comoNumero, comoTexto, mesCurto } from '@/dominio/dossie';
import { BarrasCemPorCento, TabelaDeLeitura } from '@/graficos/PecasDoDossie';

export function RecorteDaLente({
  codigo,
  mes,
  filtro,
  aoFechar,
  aoDescer,
  aoSubir,
}: {
  codigo: string;
  mes: string;
  /** O recorte aberto: o caminho inteiro, não só o último degrau. */
  filtro: FiltroDaLente;
  aoFechar: () => void;
  /** Empilha mais um degrau — descer um nível SEM sair do painel. */
  aoDescer: (chave: string, valor: string) => void;
  /** Remove um degrau da trilha. */
  aoSubir: (chave: string) => void;
}) {
  const [recorte, definirRecorte] = useState<Recorte | null>(null);
  const [erro, definirErro] = useState<string | null>(null);

  //: O FILTRO SERIALIZADO É A CHAVE DO EFEITO, e não o objeto: a tela monta um
  //: objeto novo a cada render, e um efeito que dependesse dele recarregaria em
  //: loop. Extraído para uma variável porque a lista de dependências só se
  //: verifica estática — a expressão inline passava sem checagem nenhuma.
  const caminho = JSON.stringify(filtro);

  useEffect(() => {
    let atual = true;
    definirRecorte(null);
    definirErro(null);
    obterRecorteDaLente(codigo, mes, JSON.parse(caminho) as FiltroDaLente)
      .then((vindo) => atual && definirRecorte(vindo))
      .catch((falha) => atual && definirErro(String(falha)));
    return () => {
      atual = false;
    };
  }, [codigo, mes, caminho]);

  const ultimo = recorte?.trilha.at(-1);

  return (
    <Modal
      titulo={ultimo ? ultimo.valor : 'O mês inteiro'}
      subtitulo={<Trilha recorte={recorte} aoSubir={aoSubir} />}
      aoFechar={aoFechar}
      largura={600}
    >
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 22 }}>
        {erro ? <FaixaDeErro mensagem={erro} /> : null}
        {!recorte && !erro ? <Carregando /> : null}
        {recorte ? <Conteudo recorte={recorte} aoDescer={aoDescer} /> : null}
      </div>
    </Modal>
  );
}

/** O caminho até aqui, no subtítulo do cabeçalho.
 *
 *  A TRILHA É O QUE IMPEDE O PAINEL DE SER UM BECO: sem ela, quem desceu dois
 *  níveis não sabe de onde veio nem o que remover para subir um. Cada degrau é
 *  um botão, e clicar remove AQUELE degrau — não todos os de baixo: a pessoa que
 *  quer ver "o Rio inteiro" de dentro de "Rio › cidadãos" está tirando o perfil,
 *  e não recomeçando. */
function Trilha({
  recorte,
  aoSubir,
}: {
  recorte: Recorte | null;
  aoSubir: (chave: string) => void;
}) {
  if (!recorte?.trilha.length) return <>Lente</>;

  return (
    <span>
      Lente
      {recorte.trilha.map((passo) => (
        <span key={passo.chave}>
          {' › '}
          <button
            type="button"
            onClick={() => aoSubir(passo.chave)}
            title={`Remover ${passo.dimensao}: ${passo.valor}`}
            style={{
              border: 'none',
              background: 'transparent',
              color: 'inherit',
              padding: 0,
              font: 'inherit',
              textDecoration: 'underline',
              cursor: 'pointer',
            }}
          >
            {passo.dimensao}: {passo.valor} ×
          </button>
        </span>
      ))}
    </span>
  );
}

function Conteudo({
  recorte,
  aoDescer,
}: {
  recorte: Recorte;
  aoDescer: (chave: string, valor: string) => void;
}) {
  // SEM ITEM NESTE MÊS, A AUSÊNCIA — MAIS O HISTÓRICO, que é justamente onde ele
  // mais importa. ACHADO DE REVISÃO (alta): o painel "Concessionárias com maior
  // repercussão" agrega a janela inteira de meses, então uma concessionária
  // visível na barra pode ter zero menções no mês aberto. Antes, o clique
  // aplicava o recorte na tela e a pessoa caía num mês vazio sem explicação;
  // agora o painel diz "nenhum item neste mês" E mostra em que meses houve —
  // que é a resposta certa para "por que esta barra existe então".
  //
  // AS OUTRAS TRÊS SEÇÕES SAEM: composição de nada, decomposição de nada e lista
  // vazia, uma embaixo da outra, se leem como tela quebrada.
  if (!recorte.itens) {
    return (
      <>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--cinza-3)' }}>
          {recorte.ausencia ?? recorte.frase}
        </p>
        {recorte.historico.some((celula) => celula.itens) ? (
          <Historico recorte={recorte} />
        ) : null}
      </>
    );
  }

  return (
    <>
      {/* 1. O IMPACTO, GRANDE: é o número que responde "quanto isto pesa", e o
             pacote o põe em destaque justamente porque a nota do recorte (a que
             a tela mostrava antes) responde outra pergunta — "como seria o mês
             se fosse só isto". */}
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <strong
            className="tabular"
            //: A ÂNCORA DO NÚMERO GRANDE, no mesmo hábito de `data-marca-do-eixo`
            //: na Jornada: o impacto do mês aparece duas vezes na tela — aqui em
            //: destaque e na célula deste mês no histórico —, e procurar pelo texto
            //: acha os dois.
            data-impacto-do-recorte
            style={{
              fontSize: 34,
              color: recorte.impacto < 0 ? 'var(--erro-fg)' : 'var(--ok-fg)',
            }}
          >
            {recorte.impacto > 0 ? '+' : ''}
            {recorte.impacto.toFixed(1).replace('.', ',')}
          </strong>
          <span style={{ fontSize: 12, color: 'var(--cinza-2)' }}>
            pontos na nota da lente
          </span>
        </div>
        <p style={{ margin: '8px 0 0', fontSize: 13, lineHeight: 1.6 }}>{recorte.frase}</p>
      </div>

      {/* 2. a composição do recorte */}
      <BarrasCemPorCento
        itens={[
          {
            rotulo: 'Neste recorte',
            positivo: recorte.composicao.positivo,
            neutro: recorte.composicao.neutro,
            negativo: recorte.composicao.negativo,
          },
        ]}
      />

      {/* 3. O HISTÓRICO responde "isto é de agora ou é sempre assim" — a
             pergunta que decide se o pedaço merece ação. */}
      <Historico recorte={recorte} />

      {/* 4. DENTRO DESTE RECORTE: clicar empilha mais um degrau. */}
      <DentroDoRecorte recorte={recorte} aoDescer={aoDescer} />

      {/* 5. os itens, que fecham a descida */}
      {recorte.itens_do_recorte.dados.length ? (
        <section>
          <h3 style={{ fontSize: 13, margin: '0 0 10px' }}>
            {recorte.itens_do_recorte.titulo}
          </h3>
          <TabelaDeLeitura
            colunas={colunasDaTabela(recorte.itens_do_recorte)}
            linhas={recorte.itens_do_recorte.dados}
          />
        </section>
      ) : null}
    </>
  );
}

function Historico({ recorte }: { recorte: Recorte }) {
  return (
    <section>
      <h3 style={{ fontSize: 13, margin: '0 0 10px' }}>Este recorte, mês a mês</h3>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {recorte.historico.map((celula) => (
          <div
            key={celula.mes}
            title={
              celula.sem_base
                ? 'sem menção desta lente neste mês'
                : `${celula.itens} itens · ${celula.impacto} pontos`
            }
            style={{
              flex: '1 1 56px',
              minWidth: 56,
              padding: '7px 8px',
              borderRadius: 'var(--r-card-int)',
              // SEM BASE EM CINZA, e não como zero: zero se lê como "o mês foi
              // neutro", quando o que houve foi não haver menção nenhuma.
              background: celula.sem_base ? 'var(--cinza-0)' : 'var(--bg-hover)',
              color: celula.sem_base ? 'var(--cinza-2)' : undefined,
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 10, color: 'var(--cinza-2)' }}>{mesCurto(celula.mes)}</div>
            <div className="tabular" style={{ fontSize: 13, fontWeight: 700 }}>
              {celula.sem_base ? '—' : celula.impacto.toFixed(1).replace('.', ',')}
            </div>
            <div style={{ fontSize: 10, color: 'var(--cinza-2)' }}>
              {celula.sem_base ? 'sem base' : `${celula.itens} itens`}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/** As sub-dimensões ainda não usadas, em abas — clicar numa linha desce um
 *  nível SEM sair do painel. É o empilhamento do pacote: "Rio › cidadãos" tem de
 *  ser uma pergunta possível, e ela se faz aqui, não voltando à tela. */
function DentroDoRecorte({
  recorte,
  aoDescer,
}: {
  recorte: Recorte;
  aoDescer: (chave: string, valor: string) => void;
}) {
  const [ativa, definirAtiva] = useState<string>(recorte.dentro[0]?.titulo ?? '');

  if (!recorte.dentro.length) return null;

  const bloco = recorte.dentro.find((candidata) => candidata.titulo === ativa) ?? recorte.dentro[0];

  return (
    <section>
      <h3 style={{ fontSize: 13, margin: '0 0 10px' }}>Dentro deste recorte</h3>
      <Abas
        abas={recorte.dentro.map((candidata) => ({
          id: candidata.titulo,
          rotulo: candidata.titulo,
        }))}
        ativa={bloco.titulo}
        aoTrocar={definirAtiva}
        rotulo="Sub-dimensão do recorte"
        prefixo="dentro"
      />
      <div
        role="tabpanel"
        id={`painel-${bloco.titulo}`}
        aria-labelledby={`dentro-${bloco.titulo}`}
        style={{ paddingTop: 14 }}
      >
        <BarrasCemPorCento
          itens={bloco.dados.map((linha) => ({
            rotulo: comoTexto(linha.rotulo),
            positivo: comoNumero(linha.positivo ?? 0),
            neutro: comoNumero(linha.neutro ?? 0),
            negativo: comoNumero(linha.negativo ?? 0),
          }))}
          legenda={bloco.legenda.length ? bloco.legenda : undefined}
          aoClicar={
            bloco.recorta ? (rotulo) => aoDescer(bloco.recorta as string, rotulo) : undefined
          }
        />
      </div>
    </section>
  );
}
