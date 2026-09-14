/** Mapa do Brasil com uma bolha por UF, posicionada na capital.
 *
 *  A geometria é real — Natural Earth, extraída do world-atlas e servida do
 *  próprio projeto (`brasil.geo.json`, 8 KB). O handoff é explícito: nunca
 *  desenhar o contorno do Brasil à mão, e nunca depender de CDN público.
 *
 *  A área da bolha é proporcional ao volume (escala de raiz quadrada), porque
 *  é a área que o olho compara, não o raio.
 */

import { useMemo, useRef, useState, useEffect } from 'react';
import { geoMercator, geoPath } from 'd3-geo';
import { scaleSqrt } from 'd3-scale';
import type { Feature, Geometry } from 'geojson';
import brasil from '@/graficos/brasil.geo.json';
import type { PontoNoMapa } from '@/dominio/derivacoes';

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
}: {
  pontos: PontoNoMapa[];
  selecionada?: string;
  aoClicarUf?: (uf: string) => void;
  acento?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(420);

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
        [8, 8],
        [largura - 8, altura - 8],
      ],
      feature,
    );
    return { contorno: geoPath(projecao)(feature) ?? '', projecao };
  }, [largura, altura]);

  // 'NA' e 'IN' não têm capital: aparecem no ranking ao lado, não no mapa.
  const comCapital = pontos.filter((p) => CAPITAIS[p.uf] && p.total > 0);
  const maximo = Math.max(1, ...comCapital.map((p) => p.total));
  const raioMaximo = Math.min(26, Math.max(10, largura * 0.055));
  // O PISO importa tanto quanto o teto. Com `range([0, ...])`, uma UF com uma
  // única interação encolhia para ~4px de raio — abaixo dos 8px mínimos que a
  // própria marca exige para continuar sendo um alvo, visível e clicável, e
  // não um pixel perdido no mapa.
  const raio = scaleSqrt().domain([0, maximo]).range([6, raioMaximo]);

  return (
    <div ref={container} style={{ width: '100%' }}>
      <svg
        width="100%"
        viewBox={`0 0 ${largura} ${altura}`}
        style={{ display: 'block', overflow: 'visible' }}
        role="img"
        aria-label="Distribuição geográfica das interações por unidade da federação"
      >
        {/* `--bg-trilho` sobre cartão branco é quase o mesmo tom — o contorno
            sumia. Um lavado do PRÓPRIO acento (a cor das bolhas), não um cinza
            qualquer: o mapa lê como o "chão" das marcas, e acompanha `acento`
            se algum dia outra tela passar uma cor diferente. */}
        <path d={contorno} fill={acento} fillOpacity={0.07} stroke={acento} strokeOpacity={0.32} strokeWidth={1} />

        {/* Maiores primeiro para que as menores fiquem por cima e clicáveis. */}
        {[...comCapital]
          .sort((a, b) => b.total - a.total)
          .map((ponto) => {
            const [lat, lon] = CAPITAIS[ponto.uf];
            const posicao = projecao([lon, lat]);
            if (!posicao) return null;

            const ativa = selecionada === ponto.uf;
            const r = raio(ponto.total);

            return (
              <g
                key={ponto.uf}
                transform={`translate(${posicao[0]},${posicao[1]})`}
                onClick={() => aoClicarUf?.(ponto.uf)}
                style={{ cursor: aoClicarUf ? 'pointer' : undefined }}
              >
                <title>
                  {ponto.uf}: {ponto.total}{' '}
                  {ponto.total === 1 ? 'interação' : 'interações'}
                  {aoClicarUf ? ' — clique para filtrar o painel' : ''}
                </title>
                {aoClicarUf && r < 12 ? (
                  // Alvo de clique maior que a marca visível: um raio de 6px
                  // desenha um alvo de 12px, abaixo do mínimo de ~24px que um
                  // toque em tela pequena precisa. Invisível, só amplia a área
                  // que responde — o círculo pintado continua do tamanho certo.
                  <circle r={12} fill="transparent" />
                ) : null}
                <circle
                  r={r}
                  fill={acento}
                  fillOpacity={ativa ? 0.55 : 0.22}
                  stroke={acento}
                  strokeWidth={ativa ? 3 : 1.5}
                />
                {r >= 13 ? (
                  // Texto não veste a cor da série: o rótulo dentro da marca
                  // usa tinta escura, porque o preenchimento é um lavado de
                  // 22% e não sustenta contraste com a própria cor por cima.
                  <text
                    textAnchor="middle"
                    dy="0.35em"
                    fontSize={11}
                    fontWeight={700}
                    fill="var(--cinza-4)"
                  >
                    {ponto.total}
                  </text>
                ) : null}
              </g>
            );
          })}
      </svg>

      {/* A legenda de escala que faltava: sem ela, o tamanho da bolha só
          significa algo enquanto o mouse está em cima lendo o `title`. Duas
          referências — a menor e a maior UF do recorte — bastam para o olho
          calibrar todas as outras por interpolação. Some sozinha quando o
          recorte não tem variação para calibrar (uma UF só, ou todas iguais).

          O RÓTULO PRECISA DIZER A RELAÇÃO, não só nomear a unidade: "Interações"
          sozinho ao lado de duas bolhas não conta que o TAMANHO é o que varia —
          lia como duas UFs soltas, não como uma régua. E cada bolha agora leva
          a palavra "interação(ões)" junto do número, então nenhuma delas
          depende de ler o rótulo do grupo pra fazer sentido sozinha. */}
      {maximo > 1 ? (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--cinza-2)', marginBottom: 6 }}>
            O tamanho da bolha mostra o número de interações
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            {[1, maximo].map((valor) => {
              const r = raio(valor);
              return (
                <span
                  key={valor}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 11,
                    color: 'var(--cinza-2)',
                  }}
                >
                  <svg
                    width={raioMaximo * 2}
                    height={raioMaximo * 2}
                    style={{ display: 'block', flexShrink: 0 }}
                    aria-hidden
                  >
                    <circle
                      cx={raioMaximo}
                      cy={raioMaximo}
                      r={r}
                      fill={acento}
                      fillOpacity={0.22}
                      stroke={acento}
                      strokeWidth={1.5}
                    />
                  </svg>
                  {valor} {valor === 1 ? 'interação' : 'interações'}
                </span>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
