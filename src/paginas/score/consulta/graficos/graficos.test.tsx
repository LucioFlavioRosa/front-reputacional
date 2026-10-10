// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DADOS } from '../dados/dados';
import { escalaDeImpacto } from '../dados/seletores';
import { BarraImpacto } from './BarraImpacto';
import { BarraSentimento } from './BarraSentimento';
import { BarraVolume } from './BarraVolume';
import { GraficoColunasImpacto } from './GraficoColunasImpacto';
import { GraficoDiario, LegendaDoGraficoDiario } from './GraficoDiario';
import { ListaConcentracao } from './ListaConcentracao';

const imprensa = DADOS.lentes.find((l) => l.id === 'imprensa')!;
const eficiencia = imprensa.pilares.find((p) => p.id === 'eficiencia-operacional')!;
const { evolucao, concentracao } = eficiencia.nivel2!.destaque;
const subtemas = imprensa.pilares.flatMap((p) => p.filhos ?? []).flatMap((t) => t.filhos ?? []);
const adutora = subtemas.find((s) => s.id === 'rompimento-adutora')!;
const fiscalizacao = subtemas.find((s) => s.id === 'fiscalizacao-regulatoria')!;

function el(raiz: ParentNode, seletor: string): HTMLElement | SVGElement {
  const achado = raiz.querySelector<HTMLElement | SVGElement>(seletor);
  if (!achado) throw new Error(`não achei ${seletor}`);
  return achado;
}

const num = (e: Element, atributo: string) => Number(e.getAttribute(atributo));

describe('BarraSentimento (F.2)', () => {
  it('descreve os três percentuais e põe os segmentos na ordem pos, neu, neg', () => {
    render(<BarraSentimento sentimento={{ pos: 14, neu: 36, neg: 50 }} />);
    const barra = screen.getByRole('img', { name: '14% positivas, 36% neutras, 50% negativas' });
    const segmentos = [...barra.querySelectorAll<HTMLElement>('[data-segmento]')];
    expect(segmentos.map((s) => s.dataset.segmento)).toEqual(['positivo', 'neutro', 'negativo']);
    expect(segmentos.map((s) => s.style.width)).toEqual(['14%', '36%', '50%']);
    expect(barra.style.height).toBe('10px');
  });

  it('escreve "14% pos · 50% neg · saldo −36" com o sinal U+2212', () => {
    const { container } = render(<BarraSentimento sentimento={{ pos: 14, neu: 36, neg: 50 }} />);
    expect(container).toHaveTextContent('14% pos · 50% neg · saldo −36');
  });

  it('não desenha segmento de 0%', () => {
    const { container } = render(<BarraSentimento sentimento={{ pos: 0, neu: 40, neg: 60 }} />);
    expect(container.querySelector('[data-segmento="positivo"]')).toBeNull();
    expect(container).toHaveTextContent('0% pos · 60% neg · saldo −60');
  });
});

describe('BarraVolume (F.3)', () => {
  it('preenche volume ÷ maior volume entre os irmãos', () => {
    const { container } = render(<BarraVolume volume={107} maximo={214} />);
    expect(screen.getByRole('img', { name: 'Volume 107, 50% do maior' })).toBeInTheDocument();
    expect((el(container, '[data-preenchimento]') as HTMLElement).style.width).toBe('50%');
  });

  it('máximo zero não preenche nada', () => {
    const { container } = render(<BarraVolume volume={0} maximo={0} rotulo="Sem volume" />);
    expect(screen.getByRole('img', { name: 'Sem volume' })).toBeInTheDocument();
    expect((el(container, '[data-preenchimento]') as HTMLElement).style.width).toBe('0%');
  });

  it('decorativa: sai da árvore acessível (o número está escrito ao lado)', () => {
    const { container } = render(<BarraVolume volume={34} maximo={38} decorativa />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    expect((el(container, '[data-preenchimento]') as HTMLElement).style.width).not.toBe('');
  });
});

describe('BarraImpacto (F.4)', () => {
  it('negativo: barra na metade esquerda, largura |valor| ÷ escala, valor formatado', () => {
    const { container } = render(<BarraImpacto valor={-2.3} escala={4.6} />);
    expect(screen.getByRole('img', { name: 'Impacto na nota: −2,3 pt' })).toBeInTheDocument();
    const barra = el(el(container, '[data-metade="negativa"]'), '[data-barra="negativa"]') as HTMLElement;
    expect(barra.style.width).toBe('50%');
    expect(barra.style.height).toBe('14px');
    expect(el(container, '[data-metade="positiva"]').children).toHaveLength(0);
    expect(container).toHaveTextContent('−2,3 pt');
  });

  it('positivo: barra na metade direita', () => {
    const { container } = render(<BarraImpacto valor={0.4} escala={4} />);
    const barra = el(el(container, '[data-metade="positiva"]'), '[data-barra="positiva"]') as HTMLElement;
    expect(barra.style.width).toBe('10%');
    expect(container).toHaveTextContent('+0,4 pt');
  });

  it('escala única: larguras proporcionais entre as linhas, e a maior não passa de 100%', () => {
    const valores = [-4.6, -1.5, 0.4];
    const escala = escalaDeImpacto(valores);
    const { container } = render(
      <>
        {valores.map((v) => (
          <BarraImpacto key={v} valor={v} escala={escala} />
        ))}
      </>,
    );
    const larguras = [...container.querySelectorAll<HTMLElement>('[data-barra]')].map((b) =>
      parseFloat(b.style.width),
    );
    expect(larguras[0]).toBeCloseTo((4.6 / escala) * 100, 6);
    expect(larguras[0]).toBeLessThan(100);
    expect(larguras[0] / larguras[1]).toBeCloseTo(4.6 / 1.5, 6);
    expect(larguras[0] / larguras[2]).toBeCloseTo(4.6 / 0.4, 6);
  });

  it('valor acima da escala fica em 100%', () => {
    const { container } = render(<BarraImpacto valor={-9} escala={3} />);
    expect((el(container, '[data-barra]') as HTMLElement).style.width).toBe('100%');
  });

  it('zero: nenhuma barra, só o eixo e "0,0 pt"', () => {
    const { container } = render(<BarraImpacto valor={0} escala={4} />);
    expect(container.querySelector('[data-barra]')).toBeNull();
    expect((el(container, '[data-metade="negativa"]') as HTMLElement).style.borderRight).toContain('1px solid');
    expect(screen.getByRole('img', { name: 'Impacto na nota: 0,0 pt' })).toHaveTextContent('0,0 pt');
  });

  it('valor que arredonda para zero (−0,04): nenhuma barra, como o "0,0 pt" cinza escrito', () => {
    const { container } = render(<BarraImpacto valor={-0.04} escala={3.22} compacta />);
    expect(container.querySelector('[data-barra]')).toBeNull();
    const grade = screen.getByRole('img', { name: 'Impacto na nota: 0,0 pt' });
    expect(within(grade).getByText('0,0 pt').style.color).toBe('var(--cinza-3)');
  });

  it('rotulo substitui o nome acessível padrão', () => {
    render(<BarraImpacto valor={-2.8} escala={3.22} compacta rotulo="Governança: −2,8 pt" />);
    expect(screen.getByRole('img', { name: 'Governança: −2,8 pt' })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /Impacto na nota/ })).toBeNull();
  });

  it('compacta: barra de 10px, valor 13px e coluna de 62px', () => {
    const { container } = render(<BarraImpacto valor={-1} escala={2} compacta />);
    const grade = screen.getByRole('img');
    expect(grade.style.gridTemplateColumns).toBe('1fr 1fr 62px');
    expect((el(container, '[data-barra]') as HTMLElement).style.height).toBe('10px');
    expect(within(grade).getByText('−1,0 pt').style.fontSize).toBe('13px');
  });

  it('padrão: coluna de valor de 72px e valor 15px', () => {
    render(<BarraImpacto valor={-1} escala={2} />);
    const grade = screen.getByRole('img');
    expect(grade.style.gridTemplateColumns).toBe('1fr 1fr 72px');
    expect(within(grade).getByText('−1,0 pt').style.fontSize).toBe('15px');
  });
});

describe('GraficoColunasImpacto (F.5)', () => {
  it('SVG 600×270 com nome acessível que lista mês, impacto e volume', () => {
    render(<GraficoColunasImpacto meses={evolucao.meses} impactos={evolucao.impactos} volumes={evolucao.volumes} />);
    const svg = screen.getByRole('img');
    expect(svg.getAttribute('viewBox')).toBe('0 0 600 270');
    expect(svg.getAttribute('width')).toBe('100%');
    expect(svg.getAttribute('aria-label')).toContain('mar/26 · −1,2 pt · 88 matérias');
    expect(svg.getAttribute('aria-label')).toContain('ago/26 · −4,6 pt · 214 matérias');
  });

  it('colunas negativas descem da linha de base; o mês atual em vermelho cheio, os anteriores em claro', () => {
    const { container } = render(
      <GraficoColunasImpacto meses={evolucao.meses} impactos={evolucao.impactos} volumes={evolucao.volumes} />,
    );
    const colunas = [...container.querySelectorAll<SVGRectElement>('[data-coluna]')];
    expect(colunas).toHaveLength(6);
    expect(colunas.every((c) => c.dataset.coluna === 'negativa')).toBe(true);
    const base = el(container, 'line');
    const y0 = num(base, 'y1');
    expect(colunas.every((c) => num(c, 'y') === y0)).toBe(true);
    expect(num(colunas[5], 'height')).toBeGreaterThan(num(colunas[3], 'height'));
    expect(colunas[0].getAttribute('style')).toMatch(/#FFB8BA|rgb\(255, 184, 186\)/i);
    expect(colunas[5].getAttribute('style')).toContain('var(--vermelho-pitanga)');
    expect(num(colunas[0], 'width')).toBe(46);
    expect(num(colunas[0], 'x')).toBe(80 - 23);
    expect(num(colunas[5], 'x')).toBe(80 + 5 * 88 - 23);
    expect(base.getAttribute('stroke')).toBe('#8C91A4');
    expect([num(base, 'x1'), num(base, 'x2')]).toEqual([30, 570]);
  });

  it('a coluna mais negativa ocupa a área até o domínio × 1,15 (y de 40 a 220)', () => {
    const { container } = render(
      <GraficoColunasImpacto meses={evolucao.meses} impactos={evolucao.impactos} volumes={evolucao.volumes} />,
    );
    const pior = [...container.querySelectorAll('[data-coluna]')][5];
    // Domínio [−4,6 × 1,15 ; 0]: y(0) = 40 e y(−4,6) = 40 + 180 ÷ 1,15.
    expect(num(pior, 'y')).toBeCloseTo(40, 6);
    expect(num(pior, 'height')).toBeCloseTo(180 / 1.15, 6);
  });

  it('valores sem "pt", volumes e meses escritos', () => {
    const { container } = render(
      <GraficoColunasImpacto meses={evolucao.meses} impactos={evolucao.impactos} volumes={evolucao.volumes} />,
    );
    const textos = [...container.querySelectorAll('text')].map((t) => t.textContent);
    expect(textos).toEqual(expect.arrayContaining(['matérias', '0', '88', '214', '−1,2', '−4,6', 'mar/26', 'ago/26']));
    const atual = [...container.querySelectorAll('[data-valor]')][5];
    expect(atual.getAttribute('font-size')).toBe('14');
  });

  it('dica por coluna em <title>', () => {
    const { container } = render(
      <GraficoColunasImpacto meses={evolucao.meses} impactos={evolucao.impactos} volumes={evolucao.volumes} />,
    );
    const dicas = [...container.querySelectorAll('[data-dica] title')].map((t) => t.textContent);
    expect(dicas).toHaveLength(6);
    expect(dicas[5]).toBe('ago/26 · −4,6 pt · 214 matérias');
  });

  it('colunas positivas sobem até a linha de base, em turquesa (atual) e turquesa claro', () => {
    const { container } = render(
      <GraficoColunasImpacto meses={['jul/26', 'ago/26']} impactos={[0.5, 0.8]} volumes={[10, 12]} />,
    );
    const colunas = [...container.querySelectorAll<SVGRectElement>('[data-coluna]')];
    const y0 = num(el(container, 'line'), 'y1');
    expect(colunas.every((c) => c.dataset.coluna === 'positiva')).toBe(true);
    expect(colunas.every((c) => Math.abs(num(c, 'y') + num(c, 'height') - y0) < 1e-9)).toBe(true);
    expect(colunas[0].getAttribute('style')).toMatch(/#A2F1E8|rgb\(162, 241, 232\)/i);
    expect(colunas[1].getAttribute('style')).toContain('var(--turquesa-rio)');
  });

  it('misto: linha de base no meio; zero não desenha coluna', () => {
    const { container } = render(
      <GraficoColunasImpacto meses={['jun/26', 'jul/26', 'ago/26']} impactos={[-1, 0, 1]} volumes={[1, 2, 3]} />,
    );
    const colunas = [...container.querySelectorAll('[data-coluna]')];
    expect(colunas.map((c) => c.getAttribute('data-coluna'))).toEqual(['negativa', 'positiva']);
    expect(num(el(container, 'line'), 'y1')).toBeCloseTo(130, 6);
  });
});

describe('ListaConcentracao (F.6)', () => {
  it('nome, barra sobre o volume do tema, "131 · 61%" e impacto com 1 casa sem "pt"', () => {
    render(<ListaConcentracao linhas={concentracao.concessionarias} volumeTotal={214} rotulo="Concessionária" />);
    const lista = screen.getByRole('list', { name: 'Concessionária' });
    const linhas = within(lista).getAllByRole('listitem');
    expect(linhas).toHaveLength(concentracao.concessionarias.length);
    expect(linhas[0]).toHaveTextContent('Águas do Rio');
    expect(linhas[0]).toHaveTextContent('131 · 61%');
    expect(linhas[0]).toHaveTextContent('−3,4');
    expect(linhas[0]).not.toHaveTextContent('pt');
    const barra = within(linhas[0]).getByRole('img', { name: 'Águas do Rio: 131 · 61%' });
    expect(parseFloat((el(barra, '[data-preenchimento]') as HTMLElement).style.width)).toBeCloseTo(
      (131 / 214) * 100,
      6,
    );
    expect(linhas[0].style.gridTemplateColumns).toBe('minmax(0,1.3fr) minmax(0,1.6fr) 80px 64px');
  });
});

describe('GraficoDiario (F.7)', () => {
  const porDia = adutora.nivel4!.porDia;
  const largura = 608 / 31;

  it('SVG 640×150 com resumo em português', () => {
    render(<GraficoDiario porDia={porDia} />);
    const svg = screen.getByRole('img');
    expect(svg.getAttribute('viewBox')).toBe('0 0 640 150');
    expect(svg.getAttribute('width')).toBe('100%');
    expect(svg.getAttribute('aria-label')).toBe(
      'Matérias por dia. Destaque: 12 a 18/08 · 69 matérias. Pico: 13/08 · 16 matérias, 13 negativas.',
    );
  });

  it('faixa de destaque do dia 12 ao 18, y de 4 a 120, com a soma calculada', () => {
    const { container } = render(<GraficoDiario porDia={porDia} />);
    const faixa = el(container, '[data-faixa]');
    expect(num(faixa, 'x')).toBeCloseTo(20 + 11 * largura, 6);
    expect(num(faixa, 'width')).toBeCloseTo(7 * largura, 6);
    expect([num(faixa, 'y'), num(faixa, 'height')]).toEqual([4, 116]);
    expect(faixa.getAttribute('fill')).toBe('#F1F4FD');
    expect(el(container, '[data-frase]').textContent).toBe('12 a 18/08 · 69 matérias');
  });

  it('outro subtema, outro intervalo: a frase acompanha os dados', () => {
    const outro = fiscalizacao.nivel4!.porDia;
    const { inicio, fim } = outro.destaque;
    const soma = outro.total.slice(inicio - 1, fim).reduce((s, n) => s + n, 0);
    const { container } = render(<GraficoDiario porDia={outro} />);
    expect(el(container, '[data-frase]').textContent).toBe(`${inicio} a ${fim}/08 · ${soma} matérias`);
  });

  it('o mês vem de fora, não é fixo', () => {
    const { container } = render(<GraficoDiario porDia={porDia} mes="09" />);
    expect(el(container, '[data-frase]').textContent).toBe('12 a 18/09 · 69 matérias');
    expect(el(container, '[data-dica="14"] title').textContent).toBe('14/09 · 12 matérias, 10 negativas');
  });

  it('barras empilhadas: negativas embaixo, demais em cima, na escala ceil(maior × 1,1)', () => {
    const { container } = render(<GraficoDiario porDia={porDia} />);
    const unidade = 100 / Math.ceil(16 * 1.1);
    const dia13 = el(container, '[data-dia="13"]');
    const neg = el(dia13, '[data-parte="negativas"]');
    const demais = el(dia13, '[data-parte="demais"]');
    expect(num(neg, 'height')).toBeCloseTo(13 * unidade, 6);
    expect(num(neg, 'y') + num(neg, 'height')).toBeCloseTo(120, 6);
    expect(num(demais, 'height')).toBeCloseTo(3 * unidade, 6);
    expect(num(demais, 'y') + num(demais, 'height')).toBeCloseTo(num(neg, 'y'), 6);
    expect(num(neg, 'width')).toBeCloseTo(largura * 0.68, 6);
    expect(num(neg, 'x')).toBeCloseTo(20 + 12 * largura + largura * 0.16, 6);
    expect(neg.getAttribute('style')).toContain('var(--vermelho-pitanga)');
    expect(demais.getAttribute('fill')).toBe('#B0B9C8');
    // Dia sem matéria não desenha barra.
    expect(el(container, '[data-dia="1"]').children).toHaveLength(0);
  });

  it('marcas 1, 5, 10, 15, 20, 25 e 31 em y 138, e linha de base #8C91A4', () => {
    const { container } = render(<GraficoDiario porDia={porDia} />);
    const marcas = [...container.querySelectorAll('[data-marca]')];
    expect(marcas.map((m) => m.textContent)).toEqual(['1', '5', '10', '15', '20', '25', '31']);
    expect(marcas.every((m) => m.getAttribute('y') === '138')).toBe(true);
    const base = el(container, 'line');
    expect(base.getAttribute('stroke')).toBe('#8C91A4');
    expect([num(base, 'x1'), num(base, 'x2'), num(base, 'y1')]).toEqual([20, 628, 120]);
  });

  it('dica por dia: "14/08 · 12 matérias, 10 negativas"', () => {
    const { container } = render(<GraficoDiario porDia={porDia} />);
    expect(container.querySelectorAll('[data-dica] title')).toHaveLength(31);
    expect(el(container, '[data-dica="14"] title').textContent).toBe('14/08 · 12 matérias, 10 negativas');
  });

  it('legenda com Negativas e Demais', () => {
    render(<LegendaDoGraficoDiario />);
    expect(screen.getByText('Negativas')).toBeInTheDocument();
    expect(screen.getByText('Demais')).toBeInTheDocument();
  });
});
