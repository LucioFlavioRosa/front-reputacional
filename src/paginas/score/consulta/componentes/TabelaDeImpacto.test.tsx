// @vitest-environment jsdom
import { createRef } from 'react';
import type { ReactNode } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DADOS } from '../dados/dados';
import { agruparPorImpacto, pilarNavegavel, temaNavegavel } from '../dados/seletores';
import type { Pilar, Tema } from '../dados/tipos';
import type { EnderecoDoDrill } from '../endereco';
import { RodapeDaConta, TabelaDeImpacto } from './TabelaDeImpacto';

const imprensa = DADOS.lentes.find((l) => l.id === 'imprensa')!;
const mercado = DADOS.lentes.find((l) => l.id === 'mercado')!;
const eficiencia = imprensa.pilares.find((p) => p.id === 'eficiencia-operacional')!;
const temas = eficiencia.filhos!;

function enderecoDoTema(t: Tema): EnderecoDoDrill {
  return { ativo: true, lente: 'imprensa', pilar: eficiencia.id, tema: t.id };
}

function tabelaDeTemas(aoAbrir = vi.fn(), rodape?: ReactNode) {
  return render(
    <TabelaDeImpacto
      titulo={eficiencia.nivel2!.tituloTabela}
      subtitulo={eficiencia.nivel2!.subtituloTabela}
      rotuloColuna="Tema estratégico"
      unidade={imprensa.unidade}
      nos={temas}
      destaqueId={eficiencia.nivel2!.destaque.temaId}
      navegavel={temaNavegavel}
      enderecoDe={enderecoDoTema}
      aoAbrir={aoAbrir}
      rodape={rodape}
    />,
  );
}

/** O bloco do grupo (cabeçalho + lista). A lista é rotulada pelo nome do
 *  grupo, e o bloco não é um landmark. */
function grupo(nome: string): HTMLElement {
  return screen.getByRole('list', { name: nome }).parentElement!;
}

function nomesDasLinhas(regiao: HTMLElement): string[] {
  return within(regiao)
    .getAllByRole('listitem')
    .map((li) => li.querySelector('[id$="-nome"]')!.textContent!);
}

function larguraDaBarra(linha: HTMLElement): number {
  const barra = linha.querySelector<HTMLElement>('[data-barra]');
  if (!barra) throw new Error('linha sem barra de impacto');
  return parseFloat(barra.style.width);
}

describe('TabelaDeImpacto (E.4.2)', () => {
  it('é um cartão com título, subtítulo, botão PNG e cabeçalho de colunas', () => {
    const { container } = tabelaDeTemas();
    expect(screen.getByRole('heading', { level: 3, name: eficiencia.nivel2!.tituloTabela })).toBeInTheDocument();
    expect(screen.getByText(eficiencia.nivel2!.subtituloTabela)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `Baixar "${eficiencia.nivel2!.tituloTabela}" em PNG` })).toBeInTheDocument();
    for (const rotulo of ['Tema estratégico', 'Volume', 'Sentimento', 'Impacto na nota', 'pontos']) {
      expect(screen.getByText(rotulo)).toBeInTheDocument();
    }
    const grades = [...container.querySelectorAll<HTMLElement>('[data-linha], [aria-hidden="true"].kicker')];
    expect(grades.length).toBe(temas.length + 1);
    for (const g of grades) {
      expect(g.style.gridTemplateColumns).toBe('minmax(0,2.3fr) minmax(0,1.25fr) minmax(0,1.8fr) minmax(0,2.1fr) 36px');
    }
    const rolagem = container.querySelector<HTMLElement>('[style*="overflow-x"]')!;
    expect((rolagem.firstElementChild as HTMLElement).style.minWidth).toBe('820px');
  });

  it('agrupa em "O que pressiona" e "O que sustenta", na ordem de agruparPorImpacto, com as somas', () => {
    tabelaDeTemas();
    const esperado = agruparPorImpacto(temas);
    const pressiona = grupo('O que pressiona');
    const sustenta = grupo('O que sustenta');
    expect(nomesDasLinhas(pressiona)).toEqual(esperado.pressiona.map((t) => t.nome));
    expect(nomesDasLinhas(sustenta)).toEqual(['Qualidade da água']);
    expect(pressiona.querySelector('[data-soma]')).toHaveTextContent('−7,8 pt');
    expect(sustenta.querySelector('[data-soma]')).toHaveTextContent('+0,4 pt');
    expect(within(pressiona).getByText('O que pressiona').getAttribute('style')).toContain('var(--erro-fg)');
    expect(within(sustenta).getByText('O que sustenta').getAttribute('style')).toContain('var(--ok-fg)');
  });

  it('grupo sem linhas não aparece', () => {
    const negativos = temas.filter((t) => t.impacto < 0);
    render(
      <TabelaDeImpacto
        titulo="T"
        subtitulo="S"
        rotuloColuna="Tema estratégico"
        unidade="matérias"
        nos={negativos}
        navegavel={() => false}
        enderecoDe={enderecoDoTema}
        aoAbrir={() => {}}
      />,
    );
    expect(grupo('O que pressiona')).toBeInTheDocument();
    expect(screen.queryByText('O que sustenta')).toBeNull();
  });

  it('coluna Volume: número, participação entre irmãos e a unidade em linha própria', () => {
    tabelaDeTemas();
    const linha = screen.getByRole('link');
    expect(within(linha).getByText('214')).toBeInTheDocument();
    expect(within(linha).getByText('· 42%')).toBeInTheDocument();
    const unidade = within(linha).getByText('matérias');
    expect(unidade.style.fontSize).toBe('12px');
    // A BARRA DE VOLUME É DECORATIVA: o número está escrito ao lado, e o
    // percentual dela (sobre o maior irmão) não bate com o escrito (sobre a soma).
    expect(within(linha).queryByRole('img', { name: /Volume/ })).toBeNull();
    expect(linha.querySelector('[data-preenchimento]')!.parentElement).toHaveAttribute('aria-hidden', 'true');
    expect(within(linha).getByText('−48')).toBeInTheDocument();
  });

  it('os grupos não criam landmarks "região"', () => {
    tabelaDeTemas();
    expect(screen.queryAllByRole('region')).toHaveLength(0);
    expect(grupo('O que pressiona')).toBeInTheDocument();
    expect(grupo('O que sustenta')).toBeInTheDocument();
  });

  it('título do nível (A5): h2 focável por script, com ref e id, repassado ao cartão', () => {
    const ref = createRef<HTMLHeadingElement>();
    render(
      <TabelaDeImpacto<Pilar>
        titulo={imprensa.tabelaPilares.titulo}
        subtitulo={imprensa.tabelaPilares.subtitulo}
        rotuloColuna="Pilar"
        unidade={imprensa.unidade}
        nos={imprensa.pilares}
        navegavel={(p) => pilarNavegavel(imprensa, p)}
        enderecoDe={(p) => ({ ativo: true, lente: 'imprensa', pilar: p.id })}
        aoAbrir={() => {}}
        nivelDoTitulo="h2"
        refDoTitulo={ref}
        focavel
        idDoTitulo="titulo-n1"
      />,
    );
    const titulo = screen.getByRole('heading', { level: 2, name: imprensa.tabelaPilares.titulo });
    expect(titulo).toHaveAttribute('tabindex', '-1');
    expect(titulo).toHaveAttribute('id', 'titulo-n1');
    expect(ref.current).toBe(titulo);
  });

  it('usa UMA escala para todas as barras: −7,4 desenha barra maior que −3,1', () => {
    const { container } = render(
      <TabelaDeImpacto<Pilar>
        titulo={imprensa.tabelaPilares.titulo}
        subtitulo={imprensa.tabelaPilares.subtitulo}
        rotuloColuna="Pilar"
        unidade={imprensa.unidade}
        nos={imprensa.pilares}
        navegavel={(p) => pilarNavegavel(imprensa, p)}
        enderecoDe={(p) => ({ ativo: true, lente: 'imprensa', pilar: p.id })}
        aoAbrir={() => {}}
      />,
    );
    const linhas = [...container.querySelectorAll<HTMLElement>('[data-linha]')];
    const linhaDe = (nome: string) => linhas.find((l) => l.textContent!.includes(nome))!;
    const eficienciaLargura = larguraDaBarra(linhaDe('Eficiência Operacional e Qualidade'));
    const governancaLargura = larguraDaBarra(linhaDe('Governança'));
    expect(eficienciaLargura).toBeGreaterThan(governancaLargura);
    // escala = 7,4 × 1,05; a maior barra não ocupa a metade inteira.
    expect(eficienciaLargura).toBeCloseTo(100 / 1.05, 1);
    expect(governancaLargura).toBeCloseTo((3.1 / (7.4 * 1.05)) * 100, 1);
  });

  it('linha navegável: um único link com href do hash, nome claro e seta; clique chama aoAbrir', async () => {
    const aoAbrir = vi.fn();
    tabelaDeTemas(aoAbrir);
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    const link = screen.getByRole('link', { name: 'Abastecimento de água Em destaque' });
    expect(link).toHaveAttribute('href', '#consulta&lente=imprensa&pilar=eficiencia-operacional&tema=abastecimento-agua');
    expect(link.style.display).toBe('grid');
    expect(link.querySelector('[data-seta]')).not.toBeNull();
    // OS NÚMEROS ENTRAM COMO DESCRIÇÃO, e não no nome do link.
    expect(link).toHaveAccessibleDescription(/214 · 42% matérias .*saldo −48 .*−4,6 pt/);

    await userEvent.click(link);
    expect(aoAbrir).toHaveBeenCalledWith(temas.find((t) => t.id === 'abastecimento-agua'));
  });

  it('clique com Ctrl deixa o navegador abrir em nova aba (não chama aoAbrir)', () => {
    const aoAbrir = vi.fn();
    tabelaDeTemas(aoAbrir);
    const link = screen.getByRole('link');
    const naoPrevenido = fireEvent.click(link, { ctrlKey: true });
    expect(naoPrevenido).toBe(true);
    expect(aoAbrir).not.toHaveBeenCalled();
  });

  it('linha em destaque: fundo #F1F4FD, nome azul e selo "Em destaque"', () => {
    tabelaDeTemas();
    const link = screen.getByRole('link');
    expect(link.style.background).toMatch(/#F1F4FD|rgb\(241, 244, 253\)/i);
    expect(within(link).getByText('Em destaque')).toBeInTheDocument();
    expect(within(link).getByText('Abastecimento de água').getAttribute('style')).toContain('var(--azul-mar)');
    expect(screen.getAllByText('Em destaque')).toHaveLength(1);
  });

  it('linha não navegável: div sem seta, sem cursor de mão, com title', () => {
    const { container } = tabelaDeTemas();
    const fixas = [...container.querySelectorAll<HTMLElement>('[data-linha="fixa"]')];
    expect(fixas).toHaveLength(temas.length - 1);
    for (const linha of fixas) {
      expect(linha.tagName).toBe('DIV');
      expect(linha).toHaveAttribute('title', 'Detalhamento disponível com a carga completa de dados');
      expect(linha.querySelector('[data-seta]')).toBeNull();
      expect(linha.style.cursor).toBe('default');
      expect(linha.closest('a')).toBeNull();
    }
    const esgoto = within(fixas.find((l) => l.textContent!.includes('Esgoto'))!).getByText('Esgoto');
    expect(esgoto.getAttribute('style')).toContain('var(--cinza-4)');
  });

  it('lente sem drill (Mercado): nenhuma linha vira link', () => {
    render(
      <TabelaDeImpacto<Pilar>
        titulo={mercado.tabelaPilares.titulo}
        subtitulo={mercado.tabelaPilares.subtitulo}
        rotuloColuna="Pilar"
        unidade={mercado.unidade}
        nos={mercado.pilares}
        navegavel={(p) => pilarNavegavel(mercado, p)}
        enderecoDe={(p) => ({ ativo: true, lente: 'mercado', pilar: p.id })}
        aoAbrir={() => {}}
      />,
    );
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  it('hover: fundo de hover e nome azul na linha navegável que não é destaque', () => {
    render(
      <TabelaDeImpacto<Pilar>
        titulo="T"
        subtitulo="S"
        rotuloColuna="Pilar"
        unidade="matérias"
        nos={imprensa.pilares}
        navegavel={(p) => pilarNavegavel(imprensa, p)}
        enderecoDe={(p) => ({ ativo: true, lente: 'imprensa', pilar: p.id })}
        aoAbrir={() => {}}
      />,
    );
    const link = screen.getByRole('link', { name: 'Governança' });
    const nome = within(link).getByText('Governança');
    expect(nome.getAttribute('style')).toContain('var(--cinza-4)');
    fireEvent.mouseEnter(link);
    expect(link.getAttribute('style')).toContain('var(--bg-hover)');
    expect(nome.getAttribute('style')).toContain('var(--azul-mar)');
    fireEvent.mouseLeave(link);
    expect(nome.getAttribute('style')).toContain('var(--cinza-4)');
  });

  it('mostra o rodapé "A conta fecha" montado pelo nível', () => {
    const g = agruparPorImpacto(temas);
    tabelaDeTemas(
      vi.fn(),
      <RodapeDaConta
        pressiona={g.somaPressiona}
        sustenta={g.somaSustenta}
        rotuloFinal="impacto do pilar"
        valorFinal={eficiencia.impacto}
      />,
    );
    const rodape = screen.getByText('A conta fecha').closest('p')!;
    expect(rodape.textContent).toBe('A conta fechapressiona −7,8·sustenta +0,4·= impacto do pilar −7,4 pt');
    expect(within(rodape).getByText('−7,8').getAttribute('style')).toContain('var(--erro-fg)');
    expect(within(rodape).getByText('+0,4').getAttribute('style')).toContain('var(--ok-fg)');
    expect(within(rodape).getByText('−7,4 pt').getAttribute('style')).toContain('var(--erro-fg)');
    expect(within(rodape).getByText(/^pressiona/).getAttribute('style')).toContain('var(--erro-fg)');
    expect(within(rodape).getByText(/^sustenta/).getAttribute('style')).toContain('var(--ok-fg)');
  });

  it('"A conta fecha" sem nada que pressione: o termo fica, mas cinza (não aponta grupo ausente)', () => {
    render(<RodapeDaConta pressiona={0} sustenta={0.7} rotuloFinal="impacto do pilar" valorFinal={0.7} />);
    const rodape = screen.getByText('A conta fecha').closest('p')!;
    expect(rodape.textContent).toBe('A conta fechapressiona 0,0·sustenta +0,7·= impacto do pilar +0,7 pt');
    expect(within(rodape).getByText(/^pressiona/).getAttribute('style')).toContain('var(--cinza-3)');
    expect(within(rodape).getByText('0,0').getAttribute('style')).toContain('var(--cinza-3)');
    expect(within(rodape).getByText(/^sustenta/).getAttribute('style')).toContain('var(--ok-fg)');
  });
});
