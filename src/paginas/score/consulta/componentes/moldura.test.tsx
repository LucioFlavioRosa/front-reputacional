// @vitest-environment jsdom
import { createRef } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DADOS } from '../dados/fixtures/ilustrativo';
import { resolverCaminho } from '../dados/seletores';
import { CabecalhoDoDrill } from './CabecalhoDoDrill';
import { IndicadorDeNivel } from './IndicadorDeNivel';
import { LimiteDoBloco } from './LimiteDoBloco';
import { ResumoDoNivel } from './ResumoDoNivel';
import { Trilha } from './Trilha';

vi.mock('@/observabilidade/telemetria', () => ({ registrarErro: vi.fn() }));
const { registrarErro } = await import('@/observabilidade/telemetria');

const NIVEL_4 = {
  ativo: true,
  lente: 'imprensa',
  pilar: 'eficiencia-operacional',
  tema: 'abastecimento-agua',
  subtema: 'rompimento-adutora',
};

describe('CabecalhoDoDrill (A11)', () => {
  it('mostra o mês e a data de corte da consulta e o selo da fonte ilustrativa', () => {
    render(<CabecalhoDoDrill meta={DADOS.meta} />);
    expect(screen.getByText('Agosto de 2026 · corte em 31/08/2026')).toBeInTheDocument();
    expect(screen.getByText('Dados ilustrativos')).toBeInTheDocument();
  });

  it('com os dados reais (aviso vazio) a linha fica e o selo some (D5)', () => {
    render(<CabecalhoDoDrill meta={{ ...DADOS.meta, aviso: '' }} />);
    expect(screen.getByText('Agosto de 2026 · corte em 31/08/2026')).toBeInTheDocument();
    expect(screen.queryByText('Dados ilustrativos')).toBeNull();
  });
});

describe('Trilha (E.3.4)', () => {
  it('no Nível 4: lente, pilar e tema como links e o subtema atual com aria-current', () => {
    const caminho = resolverCaminho(DADOS, 'imprensa', NIVEL_4);
    render(<Trilha caminho={caminho} aoIr={() => {}} />);
    const nav = screen.getByRole('navigation', { name: 'Trilha da consulta' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((l) => l.getAttribute('href'))).toEqual([
      '#consulta&lente=imprensa',
      '#consulta&lente=imprensa&pilar=eficiencia-operacional',
      '#consulta&lente=imprensa&pilar=eficiencia-operacional&tema=abastecimento-agua',
    ]);
    const atual = nav.querySelector('[aria-current="page"]')!;
    expect(atual.tagName).toBe('SPAN');
    expect(atual.textContent).toBe('Rompimento de adutora−3,1 pt');
    expect(atual.getAttribute('style')).toContain('var(--azul-mar)');
    expect(within(nav).getAllByRole('listitem')).toHaveLength(4);
    // Hover #111799 (E.1) pela classe: a cor não pode estar inline.
    for (const l of links) {
      expect(l).toHaveClass('consulta-link');
      expect(l.style.color).toBe('');
    }
  });

  it('a lente não tem chip de nota (D1); os demais têm o impacto colorido', () => {
    const caminho = resolverCaminho(DADOS, 'imprensa', NIVEL_4);
    render(<Trilha caminho={caminho} aoIr={() => {}} />);
    const lente = screen.getByRole('link', { name: 'Imprensa' });
    expect(lente.querySelector('[data-chip]')).toBeNull();
    expect(lente.textContent).toBe('Imprensa');
    expect(screen.queryByText('42')).toBeNull();
    const chip = within(screen.getByRole('link', { name: /Eficiência Operacional/ })).getByText('−7,4 pt');
    expect(chip.getAttribute('style')).toContain('var(--erro-bg)');
    expect(chip.getAttribute('style')).toContain('var(--erro-fg)');
  });

  it('chip positivo em verde', () => {
    const caminho = resolverCaminho(DADOS, 'imprensa', { ativo: true, lente: 'imprensa', pilar: 'crescimento-solidez' });
    render(<Trilha caminho={caminho} aoIr={() => {}} />);
    const chip = screen.getByText('+1,2 pt');
    expect(chip.getAttribute('style')).toContain('var(--ok-bg)');
    expect(chip.getAttribute('style')).toContain('var(--ok-fg)');
  });

  it('clique simples chama aoIr com o endereço do nível; Ctrl+clique fica com o navegador', async () => {
    const aoIr = vi.fn();
    const caminho = resolverCaminho(DADOS, 'imprensa', NIVEL_4);
    render(<Trilha caminho={caminho} aoIr={aoIr} />);
    await userEvent.click(screen.getByRole('link', { name: /Eficiência Operacional/ }));
    expect(aoIr).toHaveBeenCalledWith({ ativo: true, lente: 'imprensa', pilar: 'eficiencia-operacional' });

    aoIr.mockClear();
    const naoPrevenido = fireEvent.click(screen.getByRole('link', { name: 'Imprensa' }), { ctrlKey: true });
    expect(naoPrevenido).toBe(true);
    expect(aoIr).not.toHaveBeenCalled();
  });

  it('no Nível 1: só a lente, atual, sem link', () => {
    const caminho = resolverCaminho(DADOS, 'mercado', { ativo: false });
    render(<Trilha caminho={caminho} aoIr={() => {}} />);
    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(screen.getByText('Mercado')).toHaveAttribute('aria-current', 'page');
  });
});

describe('IndicadorDeNivel (E.3.4)', () => {
  it('texto "Nível N de 4 · <nome>", cinco segmentos de 22×4px e o selo', () => {
    const { container } = render(<IndicadorDeNivel nivel={3} aviso={DADOS.meta.aviso} />);
    expect(container.textContent).toContain('Nível 3 de 4 · Subtemas');
    const segmentos = [...container.querySelectorAll<HTMLElement>('[data-segmento]')];
    expect(segmentos).toHaveLength(5);
    expect(segmentos.every((s) => s.style.width === '22px' && s.style.height === '4px')).toBe(true);
    expect(segmentos.map((s) => s.dataset.segmento)).toEqual(['cheio', 'cheio', 'cheio', 'cheio', 'vazio']);
    expect(segmentos[4].getAttribute('style')).toContain('var(--borda-input)');
    expect(segmentos[0].closest('[aria-hidden="true"]')).not.toBeNull();
    expect(screen.getByText('Dados ilustrativos')).toBeInTheDocument();
  });

  it('no Nível 4 a barra fica cheia; no Nível 1 há dois segmentos cheios', () => {
    const { container, rerender } = render(<IndicadorDeNivel nivel={4} aviso={DADOS.meta.aviso} />);
    const cheios = () => container.querySelectorAll('[data-segmento="cheio"]').length;
    expect(cheios()).toBe(5);
    expect(container.textContent).toContain('Nível 4 de 4 · Matérias');
    rerender(<IndicadorDeNivel nivel={1} aviso="" />);
    expect(cheios()).toBe(2);
    expect(container.textContent).toContain('Nível 1 de 4 · Lente e pilares');
    // Dados reais (aviso vazio, D5): o selo some do indicador.
    expect(screen.queryByText('Dados ilustrativos')).toBeNull();
  });
});

describe('ResumoDoNivel (E.5.2, E.6.2, E.7.2)', () => {
  const eficiencia = DADOS.lentes[0].pilares.find((p) => p.id === 'eficiencia-operacional')!;
  const voltar = { ativo: true, lente: 'imprensa' };

  it('kicker, h2 focável com ref, link de volta com href e métricas', async () => {
    const ref = createRef<HTMLHeadingElement>();
    const aoVoltar = vi.fn();
    const { container } = render(
      <ResumoDoNivel
        kicker="Pilar · Imprensa"
        titulo={eficiencia.nome}
        refDoTitulo={ref}
        rotuloDoVoltar="Voltar aos pilares"
        enderecoDoVoltar={voltar}
        aoVoltar={aoVoltar}
        metricas={[
          { rotulo: 'Matérias', valor: '512' },
          { rotulo: 'Impacto', valor: '−7,4 pt', cor: 'var(--erro-fg)' },
        ]}
        leitura={eficiencia.nivel2!.leitura}
      />,
    );
    expect(container.querySelector('.cartao')).not.toBeNull();
    const titulo = screen.getByRole('heading', { level: 2, name: eficiencia.nome });
    expect(titulo).toHaveAttribute('tabindex', '-1');
    expect(ref.current).toBe(titulo);
    expect(titulo.getAttribute('style')).toContain('var(--cor-dos-titulos, var(--azul-mar))');

    const link = screen.getByRole('link', { name: 'Voltar aos pilares' });
    expect(link).toHaveAttribute('href', '#consulta&lente=imprensa');
    expect(link).toHaveClass('consulta-link');
    expect(link.style.color).toBe('');
    await userEvent.click(link);
    expect(aoVoltar).toHaveBeenCalledTimes(1);

    expect(screen.getByText('Matérias')).toBeInTheDocument();
    expect(screen.getByText('−7,4 pt').getAttribute('style')).toContain('var(--erro-fg)');
    expect(screen.getByText('Leitura do nível').getAttribute('style')).toContain('var(--azul-mar)');
    const leitura = screen.getByText(eficiencia.nivel2!.leitura);
    expect(leitura.style.fontSize).toBe('16px');
    expect(screen.getByRole('button', { name: `Baixar "${eficiencia.nome}" em PNG` })).toBeInTheDocument();
  });

  it('com lateral, mostra o conteúdo lateral', () => {
    render(
      <ResumoDoNivel
        kicker="Subtema · Abastecimento de água"
        titulo="Rompimento de adutora"
        rotuloDoVoltar="Voltar aos subtemas"
        enderecoDoVoltar={voltar}
        aoVoltar={() => {}}
        metricas={[{ rotulo: 'Matérias', valor: '96' }]}
        lateral={<div>gráfico diário</div>}
        leitura="L"
      />,
    );
    expect(screen.getByText('gráfico diário')).toBeInTheDocument();
    expect(screen.getByText('96')).toBeInTheDocument();
  });
});

describe('LimiteDoBloco (A7)', () => {
  const erroDoConsole = vi.spyOn(console, 'error').mockImplementation(() => {});
  afterEach(() => erroDoConsole.mockClear());

  function Quebra({ quebrar }: { quebrar: boolean }) {
    if (quebrar) throw new Error('falhou');
    return <p>bloco de pé</p>;
  }

  it('mostra o filho quando nada quebra', () => {
    render(
      <LimiteDoBloco>
        <Quebra quebrar={false} />
      </LimiteDoBloco>,
    );
    expect(screen.getByText('bloco de pé')).toBeInTheDocument();
  });

  it('ao lançar, mostra o cartão de fallback, registra o erro e mantém o resto da página', () => {
    const { container } = render(
      <div>
        <p>vizinho</p>
        <LimiteDoBloco nome="Tabela de impacto">
          <Quebra quebrar />
        </LimiteDoBloco>
      </div>,
    );
    const aviso = screen.getByRole('alert');
    expect(aviso).toHaveTextContent('Não foi possível exibir este bloco.');
    expect(aviso.closest('.cartao')).not.toBeNull();
    expect(screen.getByText('vizinho')).toBeInTheDocument();
    expect(container.textContent).not.toContain('bloco de pé');
    expect(registrarErro).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'falhou' }),
      expect.objectContaining({ origem: 'render', bloco: 'Tabela de impacto' }),
    );
  });

  it('tenta de novo quando a chave de reinício muda', () => {
    const { rerender } = render(
      <LimiteDoBloco chaveDeReinicio="a">
        <Quebra quebrar />
      </LimiteDoBloco>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    rerender(
      <LimiteDoBloco chaveDeReinicio="b">
        <Quebra quebrar={false} />
      </LimiteDoBloco>,
    );
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('bloco de pé')).toBeInTheDocument();
  });
});
