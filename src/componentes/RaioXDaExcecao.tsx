/** O que se vê ao abrir uma linha da Situação.
 *
 *  NÃO É UMA LISTA. Abrir "Solicitadas há mais de 30 dias" e receber quarenta
 *  linhas de data, frente e título é receber algo verdadeiro e inútil para
 *  decidir: saber se o problema está concentrado em imprensa ou espalhado, ou
 *  se são pedidos do mês passado ou do ano passado, exigiria ler as quarenta e
 *  contar de cabeça.
 *
 *  O RAIO-X RESPONDE ANTES DE ABRIR: onde está concentrado, e quando. Dois
 *  recortes, porque são as duas perguntas que mudam o que se faz — uma fila
 *  espalhada por seis frentes é um problema de processo; noventa por cento em
 *  imprensa é uma conversa com uma pessoa.
 *
 *  O TEMPO É O MESMO GRÁFICO DO PAINEL: barras empilhadas por mês, nas cores
 *  das frentes. Foram faixas de idade ("de 30 a 60 dias") por uma versão, e
 *  faixa perde a forma da coisa — três números não mostram que a fila veio de
 *  dois meses ruins, nem que ela vem crescendo. A série mensal mostra, e é uma
 *  leitura que a pessoa já treinou no Painel.
 *
 *  E LEVA ÀS AGENDAS. Clicar numa barra abre as agendas daquela fatia, e só
 *  elas; clicar de novo fecha. A lista completa continua a um clique, para
 *  quem quer varrer. O gráfico é o caminho, não o destino.
 */

import { useMemo, useState } from 'react';

import { ChipDeFrente } from '@/componentes/basicos';
import { BarrasEmpilhadas } from '@/graficos/BarrasEmpilhadas';
import { Ranking } from '@/graficos/Ranking';
import type { Catalogo, ItemContado } from '@/dominio/derivacoes';
import {
  completarMeses,
  nomeDaInstituicao,
  nomesDosTemas,
  serieMensal,
} from '@/dominio/derivacoes';
import { CORES_DE_FRENTE, ROTULOS_DE_FRENTE } from '@/dominio/frentes';
import {
  chaveDoMes,
  dataCompleta,
  numero,
  rotuloDoMes,
  tituloDaAgenda,
} from '@/dominio/formato';
import { FRENTES } from '@/dominio/tipos';
import type { Frente, Interacao } from '@/dominio/tipos';

//: As categorias da pilha: as mesmas frentes, na mesma ordem e nas mesmas
//: cores do Painel. Repetir a paleta é o que deixa os dois gráficos legíveis
//: como se fossem um só.
const CATEGORIAS = FRENTES.map((frente) => ({
  chave: frente,
  rotulo: ROTULOS_DE_FRENTE[frente],
  cor: CORES_DE_FRENTE[frente],
}));

/** Conta por chave e já devolve o item pronto para o gráfico — rótulo e cor
 *  incluídos.
 *
 *  NÃO SE CHAMA `contar`, e havia um motivo para tomar cuidado: `derivacoes.ts`
 *  tem uma função com esse nome e outro contrato — devolve um `Map` de
 *  contagens, sem rótulo nem cor. Duas funções com o mesmo nome e assinaturas
 *  diferentes fazem quem procura uma achar a outra.
 */
function contadosParaGrafico(
  agendas: Interacao[],
  chaveDe: (agenda: Interacao) => string,
  rotuloDe: (chave: string) => string,
  corDe?: (chave: string) => string,
): ItemContado[] {
  const totais = new Map<string, number>();
  for (const agenda of agendas) {
    const chave = chaveDe(agenda);
    totais.set(chave, (totais.get(chave) ?? 0) + 1);
  }
  return [...totais].map(([chave, total]) => ({
    chave,
    rotulo: rotuloDe(chave),
    total,
    cor: corDe?.(chave),
  }));
}

interface Fatia {
  eixo: 'frente' | 'mes' | 'todas';
  chave: string;
}

//: A fatia que não corta nada. Existe para que "ver todas" e "ver uma frente"
//: sejam o mesmo estado, e não um `boolean` extra a manter em acordo com ele.
const TODAS: Fatia = { eixo: 'todas', chave: 'todas' };

export function RaioXDaExcecao({
  agendas,
  catalogo,
  aoAbrirAgenda,
}: {
  agendas: Interacao[];
  catalogo: Catalogo;
  aoAbrirAgenda: (id: string) => void;
}) {
  const [fatia, definirFatia] = useState<Fatia | null>(null);

  const porFrente = useMemo(
    () =>
      contadosParaGrafico(
        agendas,
        (agenda) => agenda.frente,
        (chave) => ROTULOS_DE_FRENTE[chave as Frente] ?? chave,
        (chave) => CORES_DE_FRENTE[chave as Frente],
      ).sort((a, b) => b.total - a.total),
    [agendas],
  );

  const porMes = useMemo(
    () => completarMeses(serieMensal(agendas, CATEGORIAS, (agenda) => [agenda.frente])),
    [agendas],
  );

  const escolhidas = useMemo(() => {
    if (!fatia) return [];
    if (fatia.eixo === 'todas') return agendas;
    return agendas.filter((agenda) =>
      fatia.eixo === 'frente'
        ? agenda.frente === fatia.chave
        : chaveDoMes(agenda.data_interacao) === fatia.chave,
    );
  }, [agendas, fatia]);

  const alternar = (eixo: Fatia['eixo'], chave: string) =>
    definirFatia((atual) =>
      atual && atual.eixo === eixo && atual.chave === chave ? null : { eixo, chave },
    );

  const rotuloDaFatia = !fatia
    ? ''
    : fatia.eixo === 'todas'
      ? ''
      : fatia.eixo === 'mes'
        ? rotuloDoMes(fatia.chave)
        : (porFrente.find((i) => i.chave === fatia.chave)?.rotulo ?? '');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div
        style={{
          display: 'grid',
          // A série precisa de mais largura que o ranking: com nove meses em
          // 240px as colunas ficam finas demais para comparar alturas.
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 28,
        }}
      >
        <Quadro titulo="Onde está">
          <Ranking
            itens={porFrente}
            ativo={fatia?.eixo === 'frente' ? fatia.chave : undefined}
            aoClicar={(chave) => alternar('frente', chave)}
          />
        </Quadro>
        <Quadro titulo="Ao longo dos meses">
          <BarrasEmpilhadas
            colunas={porMes}
            altura={132}
            mesAtivo={fatia?.eixo === 'mes' ? fatia.chave : undefined}
            aoClicarMes={(mes) => alternar('mes', mes)}
          />
        </Quadro>
      </div>

      {fatia ? (
        <ListaDeAgendas
          agendas={escolhidas}
          catalogo={catalogo}
          aoAbrirAgenda={aoAbrirAgenda}
          // "Imprensa · 14 interações" serve às duas fatias. "14 em imprensa"
          // servia à frente e emperrava no tempo: "5 em de 30 a 60 dias".
          cabecalho={`${rotuloDaFatia || 'Todas'} · ${numero(escolhidas.length)} ${
            escolhidas.length === 1 ? 'interação' : 'interações'
          }`}
          aoLimpar={() => definirFatia(null)}
        />
      ) : (
        <p style={{ fontSize: 13, color: 'var(--cinza-2)', margin: 0 }}>
          Clique numa barra para ver as interações, ou{' '}
          <button
            type="button"
            onClick={() => definirFatia(TODAS)}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              font: 'inherit',
              color: 'var(--cinza-3)',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            veja todas as {numero(agendas.length)}
          </button>
          .
        </p>
      )}
    </div>
  );
}

function Quadro({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <h4
        style={{
          margin: '0 0 12px',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--cinza-2)',
        }}
      >
        {titulo}
      </h4>
      {children}
    </div>
  );
}

function ListaDeAgendas({
  agendas,
  catalogo,
  aoAbrirAgenda,
  cabecalho,
  aoLimpar,
}: {
  agendas: Interacao[];
  catalogo: Catalogo;
  aoAbrirAgenda: (id: string) => void;
  cabecalho: string;
  aoLimpar: () => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--cinza-4)' }}>
          {cabecalho}
        </span>
        <button
          type="button"
          onClick={aoLimpar}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            font: 'inherit',
            fontSize: 13,
            color: 'var(--cinza-2)',
            cursor: 'pointer',
            textDecoration: 'underline',
          }}
        >
          Limpar
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {agendas.map((agenda) => (
          <button
            key={agenda.id}
            type="button"
            onClick={() => aoAbrirAgenda(agenda.id)}
            style={{
              display: 'grid',
              gridTemplateColumns: '96px 92px 1fr',
              gap: 12,
              alignItems: 'baseline',
              padding: '7px 8px',
              background: 'transparent',
              border: 'none',
              borderRadius: 'var(--r-btn)',
              textAlign: 'left',
              cursor: 'pointer',
              font: 'inherit',
              fontSize: 13,
              color: 'var(--cinza-3)',
            }}
            onMouseEnter={(evento) => {
              evento.currentTarget.style.background = 'var(--bg-trilho)';
            }}
            onMouseLeave={(evento) => {
              evento.currentTarget.style.background = 'transparent';
            }}
          >
            <span className="tabular" style={{ whiteSpace: 'nowrap' }}>
              {dataCompleta(agenda.data_interacao)}
            </span>
            <ChipDeFrente frente={agenda.frente} />
            <span>
              {tituloDaAgenda(agenda, (ids) => nomesDosTemas(catalogo, ids))}
              <span style={{ color: 'var(--cinza-2)' }}>
                {' · '}
                {nomeDaInstituicao(catalogo, agenda.instituicao_id)}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
