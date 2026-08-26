/** Frentes — a visão executiva de uma frente por vez.
 *
 *  O hero traz uma frase de leitura gerada dos próprios dados, e os "pontos de
 *  atenção" são regras aplicadas sobre o recorte — nada é texto fixo.
 */

import { useMemo } from 'react';
import { usePainel } from '@/estado/painel';
import { BarrasEmpilhadas } from '@/graficos/BarrasEmpilhadas';
import { Ranking } from '@/graficos/Ranking';
import {
  Cartao,
  Carregando,
  ChipDeFrente,
  FaixaDeErro,
  Secao,
  Vazio,
} from '@/componentes/basicos';
import {
  dataCompleta,
  numero,
  percentual,
  plural,
  rotuloDoMes,
  truncar,
  variacao,
} from '@/dominio/formato';
import { CORES_DE_FRENTE, ROTULOS_DE_FRENTE } from '@/dominio/frentes';
import { FRENTES } from '@/dominio/tipos';
import type { Frente } from '@/dominio/tipos';
import {
  completarMeses,
  grupoDoStatus,
  nomeDaInstituicao,
  ranking,
  serieMensal,
  temasMaisRecorrentes,
} from '@/dominio/derivacoes';

export function Frentes({
  frente,
  aoTrocarFrente,
  aoAbrirFicha,
}: {
  frente: Frente;
  aoTrocarFrente: (frente: Frente) => void;
  aoAbrirFicha: (id: string) => void;
}) {
  const { interacoes, catalogo, carregando, erro } = usePainel();

  const derivado = useMemo(() => {
    if (!catalogo) return null;

    const daFrente = interacoes.filter((i) => i.frente === frente);
    const cor = CORES_DE_FRENTE[frente];

    const serie = completarMeses(
      serieMensal(daFrente, [{ chave: frente, rotulo: ROTULOS_DE_FRENTE[frente], cor }], () => [
        frente,
      ]),
    );

    const ultimo = serie[serie.length - 1];
    const penultimo = serie[serie.length - 2];

    const veiculos = ranking(daFrente, catalogo, 'entidade', 8);
    const temas = temasMaisRecorrentes(daFrente, catalogo, 8);

    return {
      registros: daFrente,
      serie,
      ultimo,
      penultimo,
      cor,
      tier1: daFrente.filter((i) => i.tier === 1).length,
      emAberto: daFrente.filter((i) => grupoDoStatus(catalogo, i.status) === 'aberto').length,
      tensos: daFrente.filter((i) => i.clima === 'tenso').length,
      veiculos,
      temas,
      interlocutores: ranking(daFrente, catalogo, 'pessoa', 6),
      portaVozes: ranking(daFrente, catalogo, 'portaVoz', 6),
      recentes: [...daFrente]
        .sort((a, b) => b.data_interacao.localeCompare(a.data_interacao))
        .slice(0, 8),
    };
  }, [interacoes, catalogo, frente]);

  if (erro) return <FaixaDeErro mensagem={erro} />;
  if (carregando || !derivado || !catalogo) return <Carregando />;

  const { registros, ultimo, penultimo } = derivado;

  const frase = registros.length
    ? `No período filtrado ${plural(registros.length, 'há', 'são')} ${numero(registros.length)} ${plural(registros.length, 'registro', 'registros')}` +
      (derivado.veiculos[0]
        ? `, com ${derivado.veiculos[0].rotulo} como entidade mais frequente (${derivado.veiculos[0].total})`
        : '') +
      (derivado.temas[0] ? ` e tema dominante ${derivado.temas[0].rotulo}` : '') +
      '.'
    : 'Nenhum registro desta frente no recorte atual.';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {FRENTES.map((opcao) => (
          <ChipDeFrente
            key={opcao}
            frente={opcao}
            ativo={opcao === frente}
            aoClicar={() => aoTrocarFrente(opcao)}
          />
        ))}
      </div>

      <div
        style={{
          background: 'var(--azul-mar)',
          color: 'var(--branco)',
          borderRadius: 'var(--r-destaque)',
          padding: 28,
          display: 'flex',
          gap: 28,
          alignItems: 'center',
        }}
      >
        <div>
          <div
            className="kicker"
            style={{ color: 'var(--turquesa-sombra)' }}
          >
            {ROTULOS_DE_FRENTE[frente]}
          </div>
          <div
            className="tabular"
            style={{ fontSize: 64, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.05 }}
          >
            {numero(registros.length)}
          </div>
        </div>
        <p style={{ fontSize: 15, lineHeight: 1.6, maxWidth: '58ch', color: '#EAEEFC' }}>{frase}</p>
      </div>

      {!registros.length ? (
        <Vazio
          mensagem="Sem registros desta frente"
          dica="Troque de frente acima ou ajuste os filtros."
        />
      ) : (
        <>
          <div className="grade grade--4" style={{ gap: 14 }}>
            <MiniKpi rotulo="Tier 1" valor={numero(derivado.tier1)} />
            <MiniKpi rotulo="Em aberto" valor={numero(derivado.emAberto)} />
            <MiniKpi rotulo="Clima tenso" valor={numero(derivado.tensos)} />
            <MiniKpi
              rotulo="Mês vs. anterior"
              valor={
                ultimo && penultimo ? variacao(ultimo.total, penultimo.total) : '—'
              }
            />
          </div>

          <Secao titulo={`Curva mensal — ${ROTULOS_DE_FRENTE[frente]}`}>
            <BarrasEmpilhadas colunas={derivado.serie} altura={140} />
          </Secao>

          <PontosDeAtencao
            emAberto={derivado.emAberto}
            tensos={derivado.tensos}
            tier1={derivado.tier1}
            total={registros.length}
            ultimoMes={ultimo}
            mesAnterior={penultimo}
          />

          <div className="grade grade--3" style={{ gap: 16 }}>
            <Secao titulo="Interlocutores">
              <Ranking itens={derivado.interlocutores} cor={derivado.cor} />
            </Secao>
            <Secao titulo="Porta-vozes">
              <Ranking
                itens={derivado.portaVozes}
                cor="var(--turquesa-rio)"
                vazio="Nenhum porta-voz registrado nesta frente."
              />
            </Secao>
            <Secao titulo="Temas">
              <Ranking itens={derivado.temas} vazio="Sem temas classificados." />
            </Secao>
          </div>

          <Secao titulo="Registros mais recentes">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {derivado.recentes.map((interacao) => (
                <button
                  key={interacao.id}
                  type="button"
                  onClick={() => aoAbrirFicha(interacao.id)}
                  style={{
                    display: 'flex',
                    gap: 14,
                    alignItems: 'baseline',
                    textAlign: 'left',
                    background: 'none',
                    border: 'none',
                    borderBottom: '1px solid var(--borda)',
                    padding: '10px 6px',
                    cursor: 'pointer',
                    width: '100%',
                  }}
                >
                  <span
                    className="tabular"
                    style={{ fontSize: 12, color: 'var(--cinza-2)', width: 74, flexShrink: 0 }}
                  >
                    {dataCompleta(interacao.data_interacao)}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, width: 190, flexShrink: 0 }}>
                    {truncar(nomeDaInstituicao(catalogo, interacao.instituicao_id), 28)}
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--cinza-3)', flex: 1 }}>
                    {truncar(interacao.pauta, 90)}
                  </span>
                </button>
              ))}
            </div>
          </Secao>
        </>
      )}
    </div>
  );
}

function MiniKpi({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <Cartao estilo={{ padding: 16 }}>
      <div className="kicker">{rotulo}</div>
      <div
        className="tabular"
        style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em', marginTop: 4 }}
      >
        {valor}
      </div>
    </Cartao>
  );
}

/** Regras aplicadas sobre os dados — com concordância correta, porque o texto
 *  vira relatório impresso e "1 registros" salta aos olhos. */
function PontosDeAtencao({
  emAberto,
  tensos,
  tier1,
  total,
  ultimoMes,
  mesAnterior,
}: {
  emAberto: number;
  tensos: number;
  tier1: number;
  total: number;
  ultimoMes?: { mes: string; total: number };
  mesAnterior?: { mes: string; total: number };
}) {
  const pontos: string[] = [];

  if (emAberto > 0) {
    pontos.push(
      `${numero(emAberto)} ${plural(emAberto, 'registro segue', 'registros seguem')} em aberto.`,
    );
  }
  if (tensos > 0) {
    pontos.push(
      `${numero(tensos)} ${plural(tensos, 'interação teve', 'interações tiveram')} clima tenso — ${percentual(tensos, total)} da frente.`,
    );
  }
  if (tier1 / Math.max(total, 1) > 0.4) {
    pontos.push(
      `Concentração alta em Tier 1: ${percentual(tier1, total)} dos registros da frente.`,
    );
  }
  if (ultimoMes && mesAnterior && mesAnterior.total > 0) {
    const delta = ultimoMes.total - mesAnterior.total;
    if (Math.abs(delta) >= 3) {
      pontos.push(
        `${rotuloDoMes(ultimoMes.mes)} ficou ${variacao(ultimoMes.total, mesAnterior.total)} em relação a ${rotuloDoMes(mesAnterior.mes)}.`,
      );
    }
  }

  if (!pontos.length) {
    pontos.push('Nada fora do padrão neste recorte.');
  }

  return (
    <div
      style={{
        background: 'var(--cinza-4)',
        color: 'var(--branco)',
        borderRadius: 'var(--r-card)',
        padding: 22,
      }}
    >
      <div className="kicker" style={{ color: 'var(--turquesa-sombra)' }}>
        Pontos de atenção
      </div>
      <ul style={{ margin: '12px 0 0', paddingLeft: 18, display: 'grid', gap: 7 }}>
        {pontos.map((ponto) => (
          <li key={ponto} style={{ fontSize: 13, lineHeight: 1.6, color: '#D5DAEA' }}>
            {ponto}
          </li>
        ))}
      </ul>
    </div>
  );
}
