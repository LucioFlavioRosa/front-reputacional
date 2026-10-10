// @vitest-environment jsdom
import { createRef } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DADOS } from '../dados/dados';
import { resolverCaminho } from '../dados/seletores';
import type { No } from '../dados/tipos';
import {
  alturaFixaAcima,
  enderecoDoNivel,
  enderecoDoSubtema,
  metricaDeImpacto,
  metricaVsMesAnterior,
} from './apoioDosNiveis';
import { NivelPilar } from './NivelPilar';
import { NivelSubtema } from './NivelSubtema';
import { NivelTema } from './NivelTema';

vi.mock('@/observabilidade/telemetria', () => ({ registrarErro: vi.fn() }));

const IMPRENSA = DADOS.lentes.find((l) => l.id === 'imprensa')!;
const EFICIENCIA = IMPRENSA.pilares.find((p) => p.id === 'eficiencia-operacional')!;
const ABASTECIMENTO = EFICIENCIA.filhos!.find((t) => t.id === 'abastecimento-agua')!;
const ADUTORA = ABASTECIMENTO.filhos!.find((s) => s.id === 'rompimento-adutora')!;

/** Pares rótulo → valor das métricas do resumo (`<dl>`). */
function metricas(): Record<string, string> {
  const dl = document.querySelector('dl')!;
  const pares: Record<string, string> = {};
  dl.querySelectorAll('dt').forEach((dt) => {
    pares[dt.textContent ?? ''] = dt.nextElementSibling?.textContent ?? '';
  });
  return pares;
}

function corDaMetrica(rotulo: string): string {
  const dt = [...document.querySelectorAll('dt')].find((d) => d.textContent === rotulo)!;
  return (dt.nextElementSibling as HTMLElement).style.color;
}

afterEach(() => {
  document.documentElement.style.removeProperty('--altura-cabecalho');
});

describe('apoioDosNiveis', () => {
  it('enderecoDoNivel ignora os filtros da lista', () => {
    const caminho = resolverCaminho(DADOS, 'imprensa', {
      ativo: true,
      lente: 'imprensa',
      pilar: 'eficiencia-operacional',
      tema: 'abastecimento-agua',
      subtema: 'rompimento-adutora',
      sent: 'negativas',
      item: ADUTORA.nivel4!.itens[0].id,
    });
    expect(enderecoDoNivel(caminho)).toEqual(enderecoDoSubtema(IMPRENSA, EFICIENCIA, ABASTECIMENTO, ADUTORA));
  });

  it('"vs. julho" só existe com o mês anterior, e é a diferença formatada com U+2212', () => {
    expect(metricaVsMesAnterior(EFICIENCIA, 'julho')).toEqual([
      { rotulo: 'vs. julho', valor: '−2,8 pt', cor: 'var(--erro-fg)' },
    ]);
    const semAnterior: No = { ...EFICIENCIA, impactoMesAnterior: undefined };
    expect(metricaVsMesAnterior(semAnterior, 'julho')).toEqual([]);
  });

  it('impacto que arredonda para zero fica cinza', () => {
    expect(metricaDeImpacto({ ...EFICIENCIA, impacto: -0.04 })).toEqual({
      rotulo: 'Impacto',
      valor: '0,0 pt',
      cor: 'var(--cinza-3)',
    });
  });

  it('alturaFixaAcima soma o cabeçalho e só a faixa fixa que vem antes do bloco', () => {
    document.documentElement.style.setProperty('--altura-cabecalho', '100px');
    const antes = document.createElement('div');
    antes.setAttribute('style', 'position: sticky; top: var(--altura-cabecalho)');
    antes.getBoundingClientRect = () => ({ height: 50 }) as DOMRect;
    const bloco = document.createElement('div');
    const depois = document.createElement('div');
    depois.setAttribute('style', 'position: sticky; top: var(--altura-cabecalho)');
    depois.getBoundingClientRect = () => ({ height: 300 }) as DOMRect;
    document.body.append(antes, bloco, depois);
    try {
      expect(alturaFixaAcima(bloco)).toBe(150);
      antes.remove();
      expect(alturaFixaAcima(bloco)).toBe(100);
    } finally {
      bloco.remove();
      depois.remove();
    }
  });
});

describe('NivelPilar (E.5)', () => {
  it('resumo com as métricas da spec, tabela com destaque e rodapé, e os dois cartões do tema', async () => {
    const aoIr = vi.fn();
    const ref = createRef<HTMLHeadingElement>();
    render(<NivelPilar lente={IMPRENSA} pilar={EFICIENCIA} refDoTitulo={ref} chaveDeReinicio="x" aoIr={aoIr} />);

    expect(screen.getByText('Pilar · Imprensa')).toBeInTheDocument();
    expect(ref.current).toBe(screen.getByRole('heading', { level: 2, name: EFICIENCIA.nome }));
    expect(metricas()).toEqual({
      Matérias: '512',
      'Peso na lente': '40%',
      Saldo: '−36',
      Impacto: '−7,4 pt',
      'vs. julho': '−2,8 pt',
    });
    expect(corDaMetrica('Saldo')).toBe('var(--erro-fg)');
    expect(screen.getByText(EFICIENCIA.nivel2!.leitura)).toBeInTheDocument();

    const concentracao = screen.getByText('Onde se concentra · Abastecimento de água em agosto').closest('.cartao')!;
    expect(within(concentracao as HTMLElement).getByRole('list', { name: 'Concessionária' })).toBeInTheDocument();
    expect(within(concentracao as HTMLElement).getByRole('list', { name: 'UF' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Impacto na nota mês a mês/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('link', { name: 'Voltar aos pilares' }));
    expect(aoIr).toHaveBeenCalledWith({ ativo: true, lente: 'imprensa' });
  });
});

describe('NivelTema (E.6)', () => {
  it('resumo com Negativas em vermelho e vs. julho; tabela de subtemas; recortes descem ao Nível 4', async () => {
    const aoIr = vi.fn();
    render(
      <NivelTema
        lente={IMPRENSA}
        pilar={EFICIENCIA}
        tema={ABASTECIMENTO}
        refDoTitulo={createRef()}
        chaveDeReinicio="x"
        aoIr={aoIr}
      />,
    );
    expect(screen.getByText('Tema estratégico · Eficiência Operacional e Qualidade')).toBeInTheDocument();
    expect(metricas()).toEqual({ Matérias: '214', Negativas: '60%', Impacto: '−4,6 pt', 'vs. julho': '−1,9 pt' });
    expect(corDaMetrica('Negativas')).toBe('var(--erro-fg)');
    const tabela = screen.getByRole('heading', { name: ABASTECIMENTO.nivel3!.tituloTabela }).closest('.cartao')!;
    expect(within(tabela as HTMLElement).getByText('A conta fecha').closest('p')!.textContent).toContain(
      '= impacto do tema −4,6 pt',
    );
    // Só Rompimento de adutora tem matérias: é a única linha navegável.
    expect(within(tabela as HTMLElement).getAllByRole('link')).toHaveLength(1);

    await userEvent.click(screen.getByRole('button', { name: 'Ver as 96 matérias' }));
    expect(aoIr).toHaveBeenCalledWith(enderecoDoSubtema(IMPRENSA, EFICIENCIA, ABASTECIMENTO, ADUTORA));
  });
});

describe('NivelSubtema (E.7)', () => {
  it('resumo com métricas do subtema inteiro e o gráfico diário; a lista escreve por aoMudarLista', async () => {
    const aoMudarLista = vi.fn();
    render(
      <NivelSubtema
        lente={IMPRENSA}
        pilar={EFICIENCIA}
        tema={ABASTECIMENTO}
        subtema={ADUTORA}
        endereco={enderecoDoSubtema(IMPRENSA, EFICIENCIA, ABASTECIMENTO, ADUTORA)}
        refDoTitulo={createRef()}
        chaveDeReinicio="x"
        aoIr={vi.fn()}
        aoAbrirItem={vi.fn()}
        aoMudarLista={aoMudarLista}
      />,
    );
    expect(screen.getByText('Subtema · Abastecimento de água')).toBeInTheDocument();
    expect(metricas()).toEqual({ Matérias: '96', Negativas: '71', 'Tier 1': '34', Impacto: '−3,1 pt' });
    expect(corDaMetrica('Negativas')).toBe('var(--erro-fg)');
    expect(screen.getByText('Matérias por dia em agosto')).toBeInTheDocument();
    expect(screen.getByText('Demais')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Matérias por dia/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voltar aos subtemas' })).toHaveAttribute(
      'href',
      '#consulta&lente=imprensa&pilar=eficiencia-operacional&tema=abastecimento-agua',
    );

    await userEvent.click(screen.getByRole('button', { name: 'Positivas 8' }));
    expect(aoMudarLista).toHaveBeenCalledWith({ sent: 'positivas' });
  });
});
