/** Painel — a visão consolidada do recorte. */

import { useMemo } from 'react';
import { usePainel } from '@/estado/painel';
import { BarraDivergente } from '@/graficos/BarraDivergente';
import { BarrasEmpilhadas, Legenda } from '@/graficos/BarrasEmpilhadas';
import { MapaUf } from '@/graficos/MapaUf';
import { Ranking } from '@/graficos/Ranking';
import { Carregando, FaixaDeErro, Kpi, KpiHero, Secao, Vazio } from '@/componentes/basicos';
import { numero, percentual } from '@/dominio/formato';
import {
  CORES_DE_FRENTE,
  ROTULOS_DE_FRENTE,
  rotuloDeAbrangencia,
} from '@/dominio/frentes';
import { alternar, alternarTag } from '@/dominio/recorte';
import { FRENTES } from '@/dominio/tipos';
import type { Frente } from '@/dominio/tipos';
import {
  completarMeses,
  distribuicaoPorUf,
  kpis as calcularKpis,
  nomesDosTemas,
  ranking,
  scorePorTema,
  serieMensal,
  temasMaisRecorrentes,
} from '@/dominio/derivacoes';

export function Painel({
  aoAbrirFrente,
  aoAbrirAgenda,
}: {
  aoAbrirFrente: (frente: Frente) => void;
  /** Abre a Ficha de uma agenda específica — usado pela lista que se abre ao
   *  clicar num tema na barra divergente. */
  aoAbrirAgenda: (id: string) => void;
}) {
  const { interacoes, recorte, definirRecorte, catalogo, carregando, erro } = usePainel();

  const derivado = useMemo(() => {
    if (!catalogo) return null;

    const categoriasDeFrente = FRENTES.map((frente) => ({
      chave: frente,
      rotulo: ROTULOS_DE_FRENTE[frente],
      cor: CORES_DE_FRENTE[frente],
    }));

    const categoriasDeClima = catalogo.dicionarios.climas.map((clima) => ({
      chave: clima.codigo,
      rotulo: clima.nome,
      cor: clima.cor_hex,
    }));

    const temas = temasMaisRecorrentes(interacoes, catalogo, 5);

    return {
      kpis: calcularKpis(interacoes, catalogo),
      categoriasDeFrente,
      categoriasDeClima,
      temas,
      volumetria: completarMeses(
        serieMensal(interacoes, categoriasDeFrente, (i) => [i.frente]),
      ),
      clima: completarMeses(
        serieMensal(interacoes, categoriasDeClima, (i) => (i.clima ? [i.clima] : [])),
      ),
      porTema: completarMeses(
        serieMensal(interacoes, temas, (i) =>
          nomesDosTemas(catalogo, i.temas).filter((nome) =>
            temas.some((tema) => tema.chave === nome),
          ),
        ),
      ),
      scorePorTema: scorePorTema(interacoes, catalogo),
      geo: distribuicaoPorUf(interacoes),
      instituicoes: ranking(interacoes, catalogo, 'entidade'),
      esferas: ranking(interacoes, catalogo, 'esfera'),
      unidades: ranking(interacoes, catalogo, 'unidade'),
    };
  }, [interacoes, catalogo]);

  if (erro) return <FaixaDeErro mensagem={erro} />;
  if (carregando || !derivado) return <Carregando rotulo="Carregando o recorte…" />;
  if (!interacoes.length) {
    return (
      <Vazio
        mensagem="Nenhum registro no recorte"
        dica="Ajuste os filtros ou cadastre a primeira interação."
      />
    );
  }

  const { kpis } = derivado;

  return (
    // 20px entre blocos principais, em vez do 16 que dividia espaço com o gap
    // interno das grades: um único degrau de respiro separa "isto é uma nova
    // pergunta" (entre cartões) de "isto é o mesmo cartão" (dentro dele).
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* UM herói, cinco quietos — de propósito.
          Imprensa é a frente mais lida como "reputação" no dia a dia, e é a
          única com uma meta de qualidade (aproveitamento) e não só volume: as
          duas coisas juntas a tornam a manchete natural da tela. Um segundo
          card do mesmo tamanho disputaria a mesma atenção e anularia a
          hierarquia que o destaque existe para criar.

          Os secundários usam a cor REAL da frente (`CORES_DE_FRENTE`) — a
          mesma da legenda de "Volumetria mensal por frente" logo abaixo — em
          vez de uma cor default sem relação com o número. "Institucionais"
          soma governo + parceiros e por isso não leva a cor de nenhum dos
          dois sozinho: dois pontos dizem que é uma soma. "Tier 1" é sinal de
          qualidade, não uma frente, e por isso fica no azul-mar da marca em
          vez de competir pela paleta das frentes. */}
      <div className="grade--kpis-painel">
        <KpiHero
          rotulo="Demandas de imprensa"
          valor={numero(kpis.imprensa.total)}
          selo="Frente · Imprensa"
          progresso={{
            fracao: kpis.imprensa.taxa,
            rotulo: `${percentual(kpis.imprensa.atendidas, kpis.imprensa.total)} de aproveitamento`,
          }}
          aoClicar={() => aoAbrirFrente('imprensa')}
        />
        <Kpi
          rotulo="Eventos e participações"
          valor={numero(kpis.eventos)}
          dica="Presença institucional"
          cor={CORES_DE_FRENTE.eventos}
          aoClicar={() => aoAbrirFrente('eventos')}
        />
        <Kpi
          rotulo="Agendas de investidores"
          valor={numero(kpis.investidores.total)}
          dica={`${kpis.investidores.internacionais} internacionais`}
          cor={CORES_DE_FRENTE.investidores}
          aoClicar={() => aoAbrirFrente('investidores')}
        />
        <Kpi
          rotulo="Proposições legislativas"
          valor={numero(kpis.legislativo)}
          dica="Acompanhamento"
          cor={CORES_DE_FRENTE.legislativo}
          aoClicar={() => aoAbrirFrente('legislativo')}
        />
        <Kpi
          rotulo="Agendas institucionais"
          valor={numero(kpis.institucionais)}
          dica="Governo e parceiros"
          coresCompostas={[CORES_DE_FRENTE.governo, CORES_DE_FRENTE.parceiros]}
          aoClicar={() => aoAbrirFrente('governo')}
        />
        <Kpi
          rotulo="Relevância Tier 1"
          valor={numero(kpis.tier1.total)}
          dica={`${percentual(kpis.tier1.total, interacoes.length)} da amostra`}
          cor="var(--azul-mar)"
          aoClicar={() => definirRecorte(alternar(recorte, 'tier', 1))}
        />
      </div>

      <Secao titulo="Volumetria mensal por frente">
        {/* Mais alta que o padrão: é a única das três com até sete frentes
            empilhadas ao mesmo tempo, e cada segmento precisa de espaço para
            não virar uma linha fina demais para o olho separar. */}
        <BarrasEmpilhadas
          colunas={derivado.volumetria}
          altura={220}
          aoClicarSegmento={(chave) =>
            definirRecorte(alternar(recorte, 'frente', chave as Frente))
          }
          detalheDoMes={(coluna) => {
            const registrosDoMes = interacoes.filter((i) => i.data_interacao.startsWith(coluna.mes));
            const tier1 = registrosDoMes.filter((i) => i.tier === 1).length;
            const temas = catalogo ? temasMaisRecorrentes(registrosDoMes, catalogo, 1) : [];
            return [
              { rotulo: 'Tier 1', valor: String(tier1) },
              { rotulo: 'Tema principal', valor: temas[0]?.rotulo ?? '—' },
            ];
          }}
        />
        <Legenda
          itens={derivado.categoriasDeFrente}
          ativo={recorte.frente}
          aoClicar={(chave) => definirRecorte(alternar(recorte, 'frente', chave as Frente))}
        />
      </Secao>

      <div className="grade grade--2" style={{ gap: 16 }}>
        <Secao titulo="Clima da interação no tempo">
          <BarrasEmpilhadas colunas={derivado.clima} altura={140} />
          <Legenda
            itens={derivado.categoriasDeClima}
            ativo={recorte.clima}
            aoClicar={(chave) => definirRecorte(alternar(recorte, 'clima', chave))}
          />
        </Secao>

        <Secao titulo="Assuntos no tempo">
          <BarrasEmpilhadas colunas={derivado.porTema} altura={140} />
          <Legenda
            itens={derivado.temas}
            ativo={recorte.tags?.[0]}
            aoClicar={(chave) => definirRecorte(alternarTag(recorte, chave))}
          />
          <p style={{ fontSize: 11, color: 'var(--cinza-2)', marginTop: 10 }}>
            Uma agenda com três assuntos conta nos três.
          </p>
        </Secao>
      </div>

      {/* O SUBTÍTULO PRECISA DIZER QUE É UM RECORTE quando for — sem isto, a
          pessoa lê "Barra divergente por tema" e assume que são TODOS os
          temas, quando na verdade só os mais discutidos entram (ver
          `scorePorTema`). `totalDeTemas > itens.length` é a própria pergunta
          "ficou alguém de fora?" respondida pelo dado, não por uma contagem
          feita à parte que pudesse divergir dela. */}
      <Secao titulo="Barra divergente por tema" estilo={{ borderTop: '3px solid var(--azul-mar)' }}>
        <p style={{ fontSize: 12, color: 'var(--cinza-2)', margin: '-10px 0 16px' }}>
          {derivado.scorePorTema.totalDeTemas > derivado.scorePorTema.itens.length
            ? `Os ${derivado.scorePorTema.itens.length} temas mais discutidos, de ${derivado.scorePorTema.totalDeTemas} com clima registrado neste recorte — do pior para o melhor.`
            : `Os ${derivado.scorePorTema.itens.length} temas com clima registrado neste recorte — do pior para o melhor.`}
        </p>
        <BarraDivergente itens={derivado.scorePorTema.itens} aoAbrirAgenda={aoAbrirAgenda} />
      </Secao>

      {/* O LAVADO DE FUNDO SAIU. Fazia sentido quando esta era a única seção
          sem cor por perto — hoje a cor da marca mora no cabeçalho, e um
          cartão com fundo diferente dos vizinhos (Tier 1, os gráficos,
          Instituições/Esfera/Unidades logo abaixo) lia como inconsistência,
          não como destaque. Uma borda de topo — a mesma ideia dos KPIs
          coloridos lá em cima — dá identidade sem quebrar o branco que todo
          cartão da tela agora compartilha. */}
      <Secao
        titulo="Distribuição geográfica"
        estilo={{ borderTop: '3px solid var(--azul-mar)' }}
      >
        <div className="grade grade--mapa" style={{ gap: 24 }}>
          <MapaUf
            pontos={derivado.geo}
            selecionada={recorte.uf}
            aoClicarUf={(uf) => definirRecorte(alternar(recorte, 'uf', uf))}
          />
          <div>
            <div className="kicker" style={{ marginBottom: 12 }}>
              Ranking por UF
            </div>
            <Ranking
              itens={derivado.geo.map((ponto) => ({
                chave: ponto.uf,
                rotulo: rotuloDeAbrangencia(ponto.uf),
                total: ponto.total,
              }))}
              ativo={recorte.uf}
              aoClicar={(uf) => definirRecorte(alternar(recorte, 'uf', uf))}
            />
          </div>
        </div>
      </Secao>

      {/* Uma borda de 4px na cor de cada ranking — não um fundo inteiro, que
          brigaria com o azul do mapa logo acima — dá a cada coluna uma
          identidade que combina com a cor das próprias barras dentro dela. */}
      <div className="grade grade--3" style={{ gap: 16 }}>
        <Secao titulo="Instituições" estilo={{ borderLeft: '4px solid var(--azul-mar)' }}>
          <Ranking
            itens={derivado.instituicoes}
            ativo={recorte.entidade}
            aoClicar={(nome) => definirRecorte(alternar(recorte, 'entidade', nome))}
          />
        </Secao>

        <Secao titulo="Esfera e abrangência" estilo={{ borderLeft: '4px solid var(--turquesa-rio)' }}>
          <Ranking itens={derivado.esferas} cor="var(--turquesa-rio)" />
        </Secao>

        <Secao titulo="Unidades de negócio" estilo={{ borderLeft: '4px solid var(--roxo-acai)' }}>
          <Ranking
            itens={derivado.unidades}
            ativo={recorte.unidade}
            aoClicar={(nome) => definirRecorte(alternar(recorte, 'unidade', nome))}
            cor="var(--roxo-acai)"
          />
        </Secao>
      </div>
    </div>
  );
}
