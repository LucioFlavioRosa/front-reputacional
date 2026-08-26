/** Status — resolutividade e a fila de pendências. */

import { useMemo } from 'react';
import { usePainel } from '@/estado/painel';
import { BarraDeComposicao } from '@/graficos/Ranking';
import {
  Barra,
  Cartao,
  Carregando,
  Chip,
  ChipDeFrente,
  FaixaDeErro,
  Secao,
  Selo,
  Vazio,
} from '@/componentes/basicos';
import { dataCompleta, numero, percentual, truncar } from '@/dominio/formato';
import {
  CORES_DE_FRENTE,
  CORES_DE_GRUPO,
  CORES_DE_RISCO,
  ROTULOS_DE_GRUPO,
  ROTULOS_DE_RISCO,
} from '@/dominio/frentes';
import { alternar } from '@/dominio/recorte';
import type { Frente, GrupoDeStatus } from '@/dominio/tipos';
import {
  filaDePendencias,
  nomeDaInstituicao,
  resolutividade,
  rotuloDeCodigo,
} from '@/dominio/derivacoes';

export function Status({ aoAbrirFicha }: { aoAbrirFicha: (id: string) => void }) {
  const { interacoes, catalogo, carregando, erro, recorte, definirRecorte } = usePainel();

  const derivado = useMemo(() => {
    if (!catalogo) return null;
    return {
      resolucao: resolutividade(interacoes, catalogo),
      fila: filaDePendencias(interacoes, catalogo),
    };
  }, [interacoes, catalogo]);

  if (erro) return <FaixaDeErro mensagem={erro} />;
  if (carregando || !derivado || !catalogo) return <Carregando />;
  if (!interacoes.length) return <Vazio mensagem="Nenhum registro no recorte" />;

  const { resolucao, fila } = derivado;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Cartao estilo={{ padding: 26 }}>
        <div className="kicker">Taxa de resolutividade</div>
        <div
          className="tabular"
          style={{ fontSize: 44, fontWeight: 700, letterSpacing: '-0.03em', marginTop: 4 }}
        >
          {percentual(resolucao.taxa * 100, 100, 0)}
        </div>
        <p style={{ fontSize: 13, color: 'var(--cinza-3)', marginTop: 6, maxWidth: '68ch' }}>
          Registros resolvidos sobre o total, <strong>descontados os declinados</strong> — recusar
          uma demanda não é deixá-la pendente, e contá-la como não resolvida distorceria o
          indicador.
        </p>
      </Cartao>

      <div className="grade grade--3" style={{ gap: 14 }}>
        {resolucao.grupos.map((grupo) => (
          <Cartao key={grupo.grupo}>
            <div className="kicker">{ROTULOS_DE_GRUPO[grupo.grupo]}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, margin: '6px 0 10px' }}>
              <span
                className="tabular"
                style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.03em' }}
              >
                {numero(grupo.total)}
              </span>
              <span className="tabular" style={{ fontSize: 13, color: 'var(--cinza-2)' }}>
                {percentual(grupo.total, interacoes.length)}
              </span>
            </div>
            <Barra
              valor={grupo.total}
              maximo={interacoes.length}
              cor={CORES_DE_GRUPO[grupo.grupo]}
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
              {grupo.statusQueCompoem.map((status) => (
                <Chip
                  key={status.codigo}
                  rotulo={`${status.nome} ${status.total}`}
                  ativo={recorte.status === status.codigo}
                  aoClicar={() => definirRecorte(alternar(recorte, 'status', status.codigo))}
                />
              ))}
            </div>
          </Cartao>
        ))}
      </div>

      <Secao titulo="Resolutividade por frente">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {resolucao.porFrente.map((linha) => (
            <div key={linha.frente}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 6,
                  fontSize: 13,
                }}
              >
                <ChipDeFrente
                  frente={linha.frente}
                  ativo={recorte.frente === linha.frente}
                  aoClicar={() =>
                    definirRecorte(alternar(recorte, 'frente', linha.frente as Frente))
                  }
                />
                <span style={{ color: 'var(--cinza-2)' }}>
                  {numero(linha.resolvidos)} de {numero(linha.denominador)}
                  {linha.denominador < linha.total
                    ? ` · ${numero(linha.total - linha.denominador)} declinados fora da conta`
                    : ''}
                </span>
                <span className="tabular" style={{ marginLeft: 'auto', fontWeight: 700 }}>
                  {percentual(linha.resolvidos, linha.denominador)}
                </span>
              </div>
              <Barra
                valor={linha.resolvidos}
                maximo={linha.denominador}
                cor={CORES_DE_FRENTE[linha.frente]}
                altura={12}
              />
            </div>
          ))}
        </div>
      </Secao>

      <Secao
        titulo={`Fila de pendências — ${numero(fila.length)} em aberto`}
        acao={
          <div style={{ display: 'flex', gap: 6 }}>
            {(['resolvido', 'aberto', 'declinado'] as GrupoDeStatus[]).map((grupo) => (
              <Chip
                key={grupo}
                rotulo={ROTULOS_DE_GRUPO[grupo]}
                ativo={recorte.grupo === grupo}
                aoClicar={() => definirRecorte(alternar(recorte, 'grupo', grupo))}
              />
            ))}
          </div>
        }
      >
        {!fila.length ? (
          <Vazio mensagem="Nada em aberto no recorte" dica="Toda demanda foi resolvida ou declinada." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {fila.slice(0, 20).map(({ interacao, dias, risco }) => (
              <div
                key={interacao.id}
                onClick={() => aoAbrirFicha(interacao.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(evento) => {
                  if (evento.key === 'Enter') aoAbrirFicha(interacao.id);
                }}
                style={{
                  display: 'flex',
                  gap: 16,
                  padding: 14,
                  border: '1px solid var(--borda)',
                  borderRadius: 'var(--r-card-int)',
                  cursor: 'pointer',
                }}
                onMouseEnter={(evento) => {
                  evento.currentTarget.style.background = 'var(--bg-hover)';
                }}
                onMouseLeave={(evento) => {
                  evento.currentTarget.style.background = '';
                }}
              >
                <div style={{ width: 78, flexShrink: 0, textAlign: 'center' }}>
                  <div
                    className="tabular"
                    style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em' }}
                  >
                    {dias < 0 ? '—' : dias}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--cinza-2)' }}>
                    {dias < 0 ? 'agendada' : dias === 1 ? 'dia parado' : 'dias parados'}
                  </div>
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}
                  >
                    <ChipDeFrente frente={interacao.frente} />
                    <span style={{ fontSize: 14, fontWeight: 700 }}>
                      {nomeDaInstituicao(catalogo, interacao.instituicao_id)}
                    </span>
                    <Selo
                      rotulo={ROTULOS_DE_RISCO[risco]}
                      fundo={CORES_DE_RISCO[risco].fundo}
                      texto={CORES_DE_RISCO[risco].texto}
                    />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--cinza-2)', margin: '4px 0 6px' }}>
                    {dataCompleta(interacao.data_interacao)} ·{' '}
                    {rotuloDeCodigo(catalogo, 'status', interacao.status)}
                    {interacao.tier ? ` · Tier ${interacao.tier}` : ''}
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--cinza-3)', lineHeight: 1.55 }}>
                    {truncar(interacao.pendencias || interacao.pauta, 220)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Secao>

      <Secao titulo="Composição do recorte">
        <BarraDeComposicao
          segmentos={resolucao.grupos.map((grupo) => ({
            chave: grupo.grupo,
            rotulo: ROTULOS_DE_GRUPO[grupo.grupo],
            total: grupo.total,
            cor: CORES_DE_GRUPO[grupo.grupo],
          }))}
          altura={16}
          aoClicar={(chave) =>
            definirRecorte(alternar(recorte, 'grupo', chave as GrupoDeStatus))
          }
        />
      </Secao>
    </div>
  );
}
