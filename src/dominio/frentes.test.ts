/** Contraste dos chips, medido em vez de suposto.
 *
 *  Este arquivo existe por três reprovações reais. Eventos, laranja com texto
 *  branco, ficava em 2,20:1 — menos da metade do exigido. Interna em 3,13 e
 *  Investidores em 4,45, esta última reprovando por 0,05.
 *
 *  Nenhuma delas era visível numa revisão a olho, e é por isso que o teste
 *  existe: a próxima pessoa que "restaurar a cor original da marca" precisa
 *  descobrir na hora, e não meses depois pela boca de quem não conseguiu ler.
 */

import { describe, expect, it } from 'vitest';
import { CORES_DE_FRENTE, textoSobreFrente } from '@/dominio/frentes';
import type { Frente } from '@/dominio/tipos';

/** Luminância relativa, conforme a WCAG 2.1. */
function luminancia(hex: string): number {
  const canais = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lineares = canais.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * lineares[0] + 0.7152 * lineares[1] + 0.0722 * lineares[2];
}

/** Razão de contraste entre duas cores, de 1 (igual) a 21 (preto e branco). */
export function contraste(a: string, b: string): number {
  const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (escuro + 0.05);
}

/** O limiar que vale para o chip.
 *
 *  4,5:1 é o mínimo da WCAG AA para texto NORMAL. O chip é 11px em peso 700
 *  (`componentes/basicos.tsx`), e "texto grande" — que se contentaria com 3:1 —
 *  só começa em 18,66px negrito. Nenhum chip deste painel chega lá.
 */
const MINIMO_AA = 4.5;

describe('contraste do texto sobre a cor de cada frente', () => {
  const frentes = Object.keys(CORES_DE_FRENTE) as Frente[];

  it('cobre todas as frentes, para nenhuma nova escapar', () => {
    expect(frentes).toHaveLength(7);
  });

  it.each(frentes)('%s alcança AA', (frente) => {
    const razao = contraste(CORES_DE_FRENTE[frente], textoSobreFrente(frente));
    expect(razao, `${frente}: ${razao.toFixed(2)}:1, mínimo ${MINIMO_AA}`).toBeGreaterThanOrEqual(
      MINIMO_AA,
    );
  });

  it('a função de contraste está certa nos extremos conhecidos', () => {
    // Sem esta âncora, um erro na própria medição faria o teste acima aprovar
    // qualquer coisa — e um teste que não pode reprovar não protege nada.
    expect(contraste('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
    expect(contraste('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
  });

  it('Investidores é a folga mais estreita, e o número fica registrado', () => {
    // 4,52 contra o mínimo de 4,5 — passa por 0,02.
    //
    // O limiar do teste continua sendo 4,5, que é o da WCAG: exigir 4,6 aqui
    // faria a suíte afirmar um padrão que não existe. O que protege contra a
    // estreiteza é este número fixado: qualquer mexida na paleta que o desloque
    // aparece como diferença, e não como um verde que esconde 4,50.
    const razao = contraste(CORES_DE_FRENTE.investidores, textoSobreFrente('investidores'));
    expect(razao).toBeCloseTo(4.52, 2);
  });

  it('reprovaria a combinação que existia antes', () => {
    // Eventos com texto branco: o defeito real que motivou o arquivo.
    expect(contraste('#FE952B', '#FFFFFF')).toBeLessThan(MINIMO_AA);
  });
});
