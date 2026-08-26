/** Painel — a visão consolidada do recorte. */

import { useMemo } from 'react';
import { usePainel } from '@/estado/painel';
import { BarrasEmpilhadas, Legenda } from '@/graficos/BarrasEmpilhadas';
import { MapaUf } from '@/graficos/MapaUf';
import { Ranking } from '@/graficos/Ranking';
import { Carregando, FaixaDeErro, Kpi, Secao, Vazio } from '@/componentes/basicos';
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
  serieMensal,
  temasMaisRecorrentes,
} from '@/dominio/derivacoes';

export function Painel({ aoAbrirFrente }: { aoAbrirFrente: (frente: Frente) => void }) {
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
      geo: distribuicaoPorUf(interacoes),
      veiculos: ranking(interacoes, catalogo, 'entidade'),
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="grade grade--3" style={{ gap: 14 }}>
        <Kpi
          rotulo="Agendas institucionais"
          valor={numero(kpis.institucionais)}
          dica="Governo e parceiros"
          aoClicar={() => aoAbrirFrente('governo')}
        />
        <Kpi
          rotulo="Demandas de imprensa"
          valor={numero(kpis.imprensa.total)}
          dica={`${percentual(kpis.imprensa.atendidas, kpis.imprensa.total)} de aproveitamento`}
          aoClicar={() => aoAbrirFrente('imprensa')}
        />
        <Kpi
          rotulo="Eventos e participações"
          valor={numero(kpis.eventos)}
          dica="Presença institucional"
          aoClicar={() => aoAbrirFrente('eventos')}
        />
        <Kpi
          rotulo="Agendas de investidores"
          valor={numero(kpis.investidores.total)}
          dica={`${kpis.investidores.internacionais} internacionais`}
          aoClicar={() => aoAbrirFrente('investidores')}
        />
        <Kpi
          rotulo="Proposições legislativas"
          valor={numero(kpis.legislativo)}
          dica="Acompanhamento"
          aoClicar={() => aoAbrirFrente('legislativo')}
        />
        <Kpi
          rotulo="Tier 1"
          valor={numero(kpis.tier1.total)}
          dica={`${percentual(kpis.tier1.total, interacoes.length)} da amostra`}
          cor="var(--azul-mar)"
          aoClicar={() => definirRecorte(alternar(recorte, 'tier', 1))}
        />
      </div>

      <Secao titulo="Volumetria mensal por frente">
        <BarrasEmpilhadas
          colunas={derivado.volumetria}
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

        <Secao titulo="Temas no tempo">
          <BarrasEmpilhadas colunas={derivado.porTema} altura={140} />
          <Legenda
            itens={derivado.temas}
            ativo={recorte.tags?.[0]}
            aoClicar={(chave) => definirRecorte(alternarTag(recorte, chave))}
          />
          <p style={{ fontSize: 11, color: 'var(--cinza-2)', marginTop: 10 }}>
            A unidade é a ocorrência de tag: uma interação com três temas conta nas três pilhas.
          </p>
        </Secao>
      </div>

      <Secao titulo="Distribuição geográfica">
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

      <div className="grade grade--3" style={{ gap: 16 }}>
        <Secao titulo="Veículos e órgãos">
          <Ranking
            itens={derivado.veiculos}
            ativo={recorte.entidade}
            aoClicar={(nome) => definirRecorte(alternar(recorte, 'entidade', nome))}
          />
        </Secao>

        <Secao titulo="Esfera e abrangência">
          <Ranking itens={derivado.esferas} cor="var(--turquesa-rio)" />
        </Secao>

        <Secao titulo="Unidades de negócio">
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
