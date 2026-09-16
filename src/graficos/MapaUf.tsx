import { useMemo, useRef, useState, useEffect } from 'react';
import { geoMercator, geoPath } from 'd3-geo';
import { scaleSqrt } from 'd3-scale';
import type { Feature, Geometry } from 'geojson';
import brasil from '@/graficos/brasil.geo.json';
import type { PontoNoMapa } from '@/dominio/derivacoes';
import { rotuloDeAbrangencia } from '@/dominio/frentes';

/** Capitais em lat/lon reais. */
const CAPITAIS: Record<string, [number, number]> = {
  AC: [-9.97, -67.81], AL: [-9.67, -35.73], AP: [0.03, -51.07], AM: [-3.12, -60.02],
  BA: [-12.97, -38.50], CE: [-3.73, -38.53], DF: [-15.78, -47.93], ES: [-20.32, -40.34],
  GO: [-16.68, -49.25], MA: [-2.53, -44.30], MT: [-15.60, -56.10], MS: [-20.44, -54.65],
  MG: [-19.92, -43.94], PA: [-1.46, -48.49], PB: [-7.12, -34.86], PR: [-25.43, -49.27],
  PE: [-8.05, -34.88], PI: [-5.09, -42.80], RJ: [-22.91, -43.17], RN: [-5.79, -35.21],
  RS: [-30.03, -51.23], RO: [-8.76, -63.90], RR: [2.82, -60.67], SC: [-27.59, -48.55],
  SP: [-23.55, -46.63], SE: [-10.95, -37.07], TO: [-10.18, -48.33],
};

export function MapaUf({
  pontos,
  selecionada,
  aoClicarUf,
  acento = '#0027BD',
  totalOnline = 0,
  corDoOnline = 'var(--roxo-acai)',
}: {
  pontos: PontoNoMapa[];
  selecionada?: string;
  aoClicarUf?: (uf: string) => void;
  acento?: string;
  /** Interações com modalidade "online" — não têm uma capital para marcar
   *  (a pessoa podia estar em qualquer UF, a reunião foi por chamada), então
   *  entram como uma bolha à parte, num canto fora do contorno do Brasil,
   *  tracejada e numa cor diferente das bolhas de estado. */
  totalOnline?: number;
  corDoOnline?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(420);
  const [hoverUf, setHoverUf] = useState<string | null>(null);

  useEffect(function acompanharLarguraDoContainer() {
    const alvo = container.current;
    if (!alvo) return;
    const observador = new ResizeObserver(([entrada]) => {
      const nova = Math.round(entrada.contentRect.width);
      if (nova > 0) setLargura(nova);
    });
    observador.observe(alvo);
    return () => observador.disconnect();
  }, []);

  const altura = Math.round(largura * 0.92);

  const { contorno, projecao } = useMemo(() => {
    const feature = brasil as Feature<Geometry>;
    const projecao = geoMercator().fitExtent(
      [
        [10, 10],
        [largura - 10, altura - 10],
      ],
      feature,
    );
    return { contorno: geoPath(projecao)(feature) ?? '', projecao };
  }, [largura, altura]);

  const comCapital = pontos.filter((p) => CAPITAIS[p.uf] && p.total > 0);
  const totalNacional = pontos.reduce((acc, p) => acc + p.total, 0) || 1;
  // O DOMÍNIO DA ESCALA INCLUI O ONLINE, para a bolha de fora ficar do
  // mesmo tamanho relativo que uma bolha de estado com o mesmo volume —
  // nunca maior que a maior bolha do mapa, mesmo quando online é o total
  // mais alto do recorte.
  const maximo = Math.max(1, ...comCapital.map((p) => p.total), totalOnline);
  const raioMaximo = Math.min(28, Math.max(12, largura * 0.058));
  const raio = scaleSqrt().domain([0, maximo]).range([7, raioMaximo]);

  const pontoHoverOuSelecionado = comCapital.find(
    (p) => p.uf === (hoverUf || selecionada),
  );

  return (
    <div ref={container} style={{ width: '100%', position: 'relative' }}>
      {/* Grade de coordenadas tática / mapa analítico */}
      <svg
        width="100%"
        viewBox={`0 0 ${largura} ${altura}`}
        style={{ display: 'block', overflow: 'visible' }}
        role="img"
        aria-label="Distribuição geográfica das interações por unidade da federação"
      >
        <defs>
          <pattern id="grid-mapa" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M 24 0 L 0 0 0 24" fill="none" stroke="var(--borda)" strokeWidth="0.5" strokeDasharray="2 2" />
          </pattern>
        </defs>

        {/* Fundo de malha espacial / retículo */}
        <rect width={largura} height={altura} fill="url(#grid-mapa)" opacity={0.6} rx={4} />

        {/* Contorno do Brasil com preenchimento limpo e linha estruturada */}
        <path
          d={contorno}
          fill="var(--bg-app)"
          stroke="var(--azul-mar)"
          strokeOpacity={0.4}
          strokeWidth={1.2}
        />

        {/* Círculos / Bolhas de dados */}
        {[...comCapital]
          .sort((a, b) => b.total - a.total)
          .map((ponto) => {
            const [lat, lon] = CAPITAIS[ponto.uf];
            const posicao = projecao([lon, lat]);
            if (!posicao) return null;

            const ativa = selecionada === ponto.uf;
            const emHover = hoverUf === ponto.uf;
            const r = raio(ponto.total);

            return (
              <g
                key={ponto.uf}
                transform={`translate(${posicao[0]},${posicao[1]})`}
                onClick={() => aoClicarUf?.(ponto.uf)}
                onMouseEnter={() => setHoverUf(ponto.uf)}
                onMouseLeave={() => setHoverUf(null)}
                style={{ cursor: aoClicarUf ? 'pointer' : undefined }}
              >
                {aoClicarUf && r < 14 ? (
                  <circle r={14} fill="transparent" />
                ) : null}

                {/* Anel de foco / pulso em hover ou seleção */}
                {(ativa || emHover) ? (
                  <circle
                    r={r + 4}
                    fill="none"
                    stroke={acento}
                    strokeWidth={ativa ? 2 : 1}
                    strokeDasharray={emHover && !ativa ? "3 3" : undefined}
                    opacity={0.8}
                  />
                ) : null}

                {/* Círculo da bolha */}
                <circle
                  r={r}
                  fill={ativa ? acento : emHover ? 'var(--azul-mar)' : acento}
                  fillOpacity={ativa ? 0.85 : emHover ? 0.6 : 0.25}
                  stroke={acento}
                  strokeWidth={ativa ? 2.5 : 1.5}
                />

                {/* Rótulo da UF e total */}
                {r >= 12 ? (
                  <text
                    textAnchor="middle"
                    dy="0.35em"
                    fontSize={r >= 18 ? 11 : 9.5}
                    fontWeight={700}
                    fill={ativa ? 'var(--branco)' : 'var(--cinza-4)'}
                    className="tabular"
                  >
                    {ponto.total}
                  </text>
                ) : null}
              </g>
            );
          })}

        {/* Bolha do Online, fora do contorno — canto inferior direito, mar
            aberto na altura de SP/RJ: o ponto mais a leste do país (o bico
            do Nordeste) fica bem mais ao norte, então esta faixa do canvas
            nunca cruza a costa, em qualquer proporção de tela. Tracejada e
            noutra cor: para não parecer "mais um estado". */}
        {totalOnline > 0 ? (
          <g transform={`translate(${largura * 0.92},${altura * 0.64})`}>
            <circle
              r={raio(totalOnline)}
              fill={corDoOnline}
              fillOpacity={0.22}
              stroke={corDoOnline}
              strokeWidth={1.5}
              strokeDasharray="3 3"
            />
            {raio(totalOnline) >= 12 ? (
              <text
                textAnchor="middle"
                dy="0.35em"
                fontSize={raio(totalOnline) >= 18 ? 11 : 9.5}
                fontWeight={700}
                fill="var(--cinza-4)"
                className="tabular"
              >
                {totalOnline}
              </text>
            ) : null}
            <text
              textAnchor="middle"
              y={raio(totalOnline) + 13}
              fontSize={10}
              fontWeight={700}
              fill={corDoOnline}
            >
              Online
            </text>
          </g>
        ) : null}
      </svg>

      {/* Badge analítica do estado selecionado ou em hover */}
      {pontoHoverOuSelecionado ? (
        <div
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            background: 'var(--branco)',
            border: '1px solid var(--borda)',
            borderRadius: 'var(--r-chip)',
            padding: '6px 10px',
            boxShadow: '0 2px 8px rgba(17,23,60,0.08)',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            pointerEvents: 'none',
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 2,
              background: acento,
              display: 'inline-block',
            }}
          />
          <div>
            <strong style={{ color: 'var(--azul-mar)' }}>
              {rotuloDeAbrangencia(pontoHoverOuSelecionado.uf)}
            </strong>
            <span style={{ color: 'var(--cinza-2)', marginLeft: 6 }} className="tabular">
              {pontoHoverOuSelecionado.total} agendas ({Math.round((pontoHoverOuSelecionado.total / totalNacional) * 100)}%)
            </span>
          </div>
        </div>
      ) : null}

      {/* Legenda de escala com barra e valores */}
      {maximo > 1 ? (
        <div
          style={{
            marginTop: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 11,
            color: 'var(--cinza-2)',
            paddingTop: 8,
            borderTop: '1px solid var(--borda)',
          }}
        >
          <span>Escala por volume de interações</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {[1, Math.round(maximo / 2), maximo].map((valor) => {
              const r = raio(valor);
              return (
                <span
                  key={valor}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    color: 'var(--cinza-3)',
                  }}
                >
                  <svg width={r * 2 + 2} height={r * 2 + 2} style={{ display: 'block', flexShrink: 0 }}>
                    <circle
                      cx={r + 1}
                      cy={r + 1}
                      r={r}
                      fill={acento}
                      fillOpacity={0.25}
                      stroke={acento}
                      strokeWidth={1.2}
                    />
                  </svg>
                  <span className="tabular">{valor}</span>
                </span>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
