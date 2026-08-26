/** Resultado — o desfecho das interações, com denominador explícito. */

import { useMemo } from 'react';
import { usePainel } from '@/estado/painel';
import { BarraDeComposicao } from '@/graficos/Ranking';
import {
  Barra,
  Cartao,
  Carregando,
  ChipDeFrente,
  FaixaDeErro,
  Kpi,
  Secao,
  Vazio,
} from '@/componentes/basicos';
import { numero, percentual } from '@/dominio/formato';
import { CORES_DE_FRENTE } from '@/dominio/frentes';
import { alternar } from '@/dominio/recorte';
import type { Frente } from '@/dominio/tipos';
import { resultados as calcularResultados } from '@/dominio/derivacoes';

export function Resultado() {
  const { interacoes, catalogo, carregando, erro, recorte, definirRecorte } = usePainel();

  const derivado = useMemo(
    () => (catalogo ? calcularResultados(interacoes, catalogo) : null),
    [interacoes, catalogo],
  );

  if (erro) return <FaixaDeErro mensagem={erro} />;
  if (carregando || !derivado) return <Carregando />;
  if (!interacoes.length) return <Vazio mensagem="Nenhum registro no recorte" />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Cartao estilo={{ padding: 26 }}>
        <div className="kicker">Taxa de avanço</div>
        <div
          className="tabular"
          style={{ fontSize: 44, fontWeight: 700, letterSpacing: '-0.03em', marginTop: 4 }}
        >
          {percentual(derivado.taxaDeAvanco * 100, 100, 0)}
        </div>
        <p style={{ fontSize: 13, color: 'var(--cinza-3)', marginTop: 6 }}>
          Sobre <strong>{numero(derivado.denominador)}</strong>{' '}
          {derivado.denominador === 1 ? 'registro' : 'registros'} com desfecho informado — os{' '}
          {numero(derivado.semResultado)} sem resultado ficam fora do denominador.
        </p>
      </Cartao>

      <Secao titulo="Desfecho das interações">
        <BarraDeComposicao
          segmentos={derivado.itens.map((item) => ({
            chave: item.chave,
            rotulo: item.rotulo,
            total: item.total,
            cor: item.cor ?? 'var(--cinza-2)',
          }))}
          altura={16}
          aoClicar={(chave) => definirRecorte(alternar(recorte, 'resultado', chave))}
        />

        <div
          className="grade grade--4" style={{ gap: 14, marginTop: 18 }}
        >
          {derivado.itens.map((item) => (
            <Cartao
              key={item.chave}
              aoClicar={() => definirRecorte(alternar(recorte, 'resultado', item.chave))}
              destaque={recorte.resultado === item.chave}
              estilo={{ padding: 16 }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--cinza-2)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                <span
                  aria-hidden
                  style={{ width: 9, height: 9, borderRadius: 2, background: item.cor }}
                />
                {item.rotulo}
              </div>
              <div
                className="tabular"
                style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', marginTop: 6 }}
              >
                {numero(item.total)}
              </div>
              <div className="tabular" style={{ fontSize: 12, color: 'var(--cinza-2)' }}>
                {percentual(item.total, interacoes.length)} do recorte
              </div>
            </Cartao>
          ))}
        </div>
      </Secao>

      <Secao titulo="Taxa de avanço por frente">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {derivado.porFrente.map((linha) => (
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
                  {numero(linha.avancou)} de {numero(linha.denominador)} avançaram
                  {linha.denominador < linha.total
                    ? ` · ${numero(linha.total - linha.denominador)} sem desfecho informado`
                    : ''}
                </span>
                <span className="tabular" style={{ marginLeft: 'auto', fontWeight: 700 }}>
                  {percentual(linha.avancou, linha.denominador)}
                </span>
              </div>
              <Barra
                valor={linha.avancou}
                maximo={linha.denominador}
                cor={CORES_DE_FRENTE[linha.frente]}
                altura={12}
              />
            </div>
          ))}
        </div>
      </Secao>

      <div className="grade grade--2" style={{ gap: 14 }}>
        <Kpi
          rotulo="Retrocederam"
          valor={numero(derivado.recuaram)}
          dica={`${percentual(derivado.recuaram, interacoes.length)} da base`}
          cor="var(--vermelho-pitanga)"
          aoClicar={() => definirRecorte(alternar(recorte, 'resultado', 'recuou'))}
        />
        <Kpi
          rotulo="Sem resultado informado"
          valor={numero(derivado.semResultado)}
          dica={`${percentual(derivado.semResultado, interacoes.length)} da base`}
          cor="var(--res-sem-definicao)"
          aoClicar={() => definirRecorte(alternar(recorte, 'resultado', 'sem_definicao'))}
        />
      </div>
    </div>
  );
}
