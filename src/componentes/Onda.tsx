/** A faixa ondulada dupla que fecha o hero.
 *
 *  É o elemento orgânico do guia visual da Aegea — a assinatura da marca, e a
 *  razão de o hero terminar em água em vez de num corte reto. Duas ondas
 *  defasadas dão profundidade sem precisar de animação.
 *
 *  Desenhada em SVG com `preserveAspectRatio="none"`: estica na largura que
 *  receber sem deformar a altura, então serve tanto no hero largo do Início
 *  quanto na coluna estreita do login.
 */

export function OndaDoHero({
  corDeBaixo = 'var(--bg-app)',
  corDeCima = 'rgba(255, 255, 255, 0.35)',
}: {
  /** A cor para onde o hero desemboca — normalmente o fundo da página. */
  corDeBaixo?: string;
  /** A crista adiantada, um véu claro sobre a onda de baixo. */
  corDeCima?: string;
}) {
  return (
    <svg
      className="onda-do-hero"
      viewBox="0 0 1440 46"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M0 26 C 180 6, 300 42, 480 28 C 660 14, 780 40, 960 30 C 1140 20, 1290 38, 1440 24 L1440 46 L0 46 Z"
        fill={corDeCima}
      />
      <path
        d="M0 34 C 200 18, 320 46, 520 36 C 720 26, 840 48, 1040 38 C 1220 29, 1320 44, 1440 34 L1440 46 L0 46 Z"
        fill={corDeBaixo}
      />
    </svg>
  );
}
