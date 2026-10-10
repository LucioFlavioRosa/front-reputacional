// @vitest-environment jsdom
import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DADOS } from '../dados/fixtures/ilustrativo';
import type { Item } from '../dados/tipos';
import type { EnderecoDoDrill } from '../endereco';
import { ListaDeMaterias } from './ListaDeMaterias';

//: Estes cartões vivem na aba Lentes, onde o botão "PNG" está ligado
//: (`ContextoDoPng`); soltos num teste, o padrão é desligado.
vi.mock('@/componentes/contextoDoPng', async () => {
  const { createContext } = await import('react');
  return { ContextoDoPng: createContext(true) };
});

const imprensa = DADOS.lentes.find((l) => l.id === 'imprensa')!;
const subtemas = imprensa.pilares.flatMap((p) => p.filhos ?? []).flatMap((t) => t.filhos ?? []);
const adutora = subtemas.find((s) => s.id === 'rompimento-adutora')!;

const BASE: EnderecoDoDrill = {
  ativo: true,
  lente: 'imprensa',
  pilar: 'eficiencia-operacional',
  tema: 'abastecimento-agua',
  subtema: 'rompimento-adutora',
};

function montar(extra: Partial<EnderecoDoDrill> = {}) {
  const aoMudar = vi.fn();
  const aoAbrirItem = vi.fn();
  const utils = render(
    <ListaDeMaterias
      subtema={adutora}
      unidade={imprensa.unidade}
      fonte="Clipei"
      dataCorte={DADOS.meta.dataCorte}
      endereco={{ ...BASE, ...extra }}
      aoMudar={aoMudar}
      aoAbrirItem={aoAbrirItem}
    />,
  );
  return { ...utils, aoMudar, aoAbrirItem };
}

/** Faz o papel do nível: aplica o parcial ao endereço (o `replace` do hash). */
function ComEndereco({ inicial = {} }: { inicial?: Partial<EnderecoDoDrill> }) {
  const [endereco, setEndereco] = useState<EnderecoDoDrill>({ ...BASE, ...inicial });
  return (
    <ListaDeMaterias
      subtema={adutora}
      unidade={imprensa.unidade}
      fonte="Clipei"
      dataCorte={DADOS.meta.dataCorte}
      endereco={endereco}
      aoMudar={(parcial) => setEndereco((atual) => ({ ...atual, ...parcial }))}
      aoAbrirItem={() => {}}
    />
  );
}

/** Linhas de dados (sem a do cabeçalho). */
function linhas(): HTMLElement[] {
  return screen.getAllByRole('row').filter((r) => within(r).queryAllByRole('cell').length > 0);
}

function celulas(linha: HTMLElement): string[] {
  return within(linha)
    .getAllByRole('cell')
    .map((c) => c.textContent ?? '');
}

const scrollIntoView = vi.fn();
beforeEach(() => {
  Element.prototype.scrollIntoView = scrollIntoView;
});
afterEach(() => {
  scrollIntoView.mockReset();
  delete (Element.prototype as Partial<Element>).scrollIntoView;
});

describe('ListaDeMaterias (F.9)', () => {
  it('é um cartão com o título e o subtítulo do nivel4 e o botão PNG', () => {
    const { container } = montar();
    expect(screen.getByRole('heading', { level: 3, name: adutora.nivel4!.tituloLista })).toBeInTheDocument();
    expect(screen.getByText(adutora.nivel4!.subtituloLista)).toBeInTheDocument();
    expect(container.querySelector('.cartao')).not.toBeNull();
    expect(screen.getByRole('button', { name: `Baixar "${adutora.nivel4!.tituloLista}" em PNG` })).toBeInTheDocument();
  });

  it('mostra as 11 matérias da amostra, a primeira por maior impacto', () => {
    montar();
    const ls = linhas();
    expect(ls).toHaveLength(11);
    const [data, veiculo, materia, conc, impacto] = celulas(ls[0]);
    expect(data).toBe('12/08');
    expect(veiculo).toBe('O GloboRenata Moura');
    expect(materia).toContain('Rompimento de adutora deixa 14 bairros da Zona Norte sem água por três dias');
    expect(materia).toContain('Negativo');
    expect(materia).toContain('Tier 1');
    expect(conc).toBe('Águas do RioRJ');
    expect(impacto).toBe('−0,12');
  });

  it('impacto com 2 casas, sinal U+2212 e cor do sinal', () => {
    montar();
    const impactos = linhas().map((l) => within(l).getAllByRole('cell')[4]);
    const positivo = impactos.find((c) => c.textContent === '+0,12')!;
    const negativo = impactos.find((c) => c.textContent === '−0,06')!;
    const zero = impactos.find((c) => c.textContent === '0,00')!;
    expect(positivo.getAttribute('style')).toContain('var(--ok-fg)');
    expect(negativo.getAttribute('style')).toContain('var(--erro-fg)');
    expect(zero.getAttribute('style')).toContain('var(--cinza-3)');
  });

  it('usa a grade literal da F.9 dentro de uma rolagem horizontal com 1000px mínimos', () => {
    montar();
    const tabela = screen.getByRole('table');
    expect(tabela.style.minWidth).toBe('1000px');
    //: PELA CLASSE, e não pelo estilo inline: a regra da rolagem saiu do
    //: `style` e foi para `.rolagem-das-duas-barras` (em `index.css`), que
    //: acrescenta o limite de altura — sem ele a barra horizontal ficava no fim
    //: do documento, e para arrastá-la a pessoa tinha de rolar a página toda.
    expect(tabela.parentElement!.className).toContain('rolagem-das-duas-barras');
    const linha = linhas()[0];
    expect(linha.style.gridTemplateColumns).toBe('62px minmax(0,1.25fr) minmax(0,3.2fr) minmax(0,1fr) 76px 156px');
    expect(linha.style.gap).toBe('16px');
  });

  it('abas de sentimento com os números do subtema inteiro e aria-pressed', () => {
    montar();
    const grupo = screen.getByRole('group', { name: 'Sentimento' });
    const botoes = within(grupo).getAllByRole('button');
    expect(botoes.map((b) => b.textContent)).toEqual(['Todas 96', 'Negativas 71', 'Neutras 17', 'Positivas 8']);
    expect(botoes[0]).toHaveAttribute('aria-pressed', 'true');
    expect(botoes[1]).toHaveAttribute('aria-pressed', 'false');
    expect(botoes[0].style.height).toBe('40px');
    expect(botoes[0].getAttribute('style')).toContain('background: var(--azul-mar)');
    expect(botoes[1].getAttribute('style')).toContain('var(--borda-input)');
    const ordem = screen.getByRole('group', { name: 'Ordenar por' });
    expect(within(ordem).getByRole('button', { name: 'Maior impacto' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(ordem).getByRole('button', { name: 'Data' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('os controles escrevem no endereço, com o padrão virando chave ausente', async () => {
    const usuario = userEvent.setup();
    const { aoMudar } = montar({ sent: 'negativas', ordem: 'data' });
    await usuario.click(screen.getByRole('button', { name: 'Positivas 8' }));
    expect(aoMudar).toHaveBeenLastCalledWith({ sent: 'positivas' });
    await usuario.click(screen.getByRole('button', { name: 'Todas 96' }));
    expect(aoMudar).toHaveBeenLastCalledWith({ sent: undefined });
    await usuario.click(screen.getByRole('button', { name: 'Maior impacto' }));
    expect(aoMudar).toHaveBeenLastCalledWith({ ordem: undefined });
    await usuario.selectOptions(screen.getByRole('combobox', { name: 'Tier' }), 'Tier 2');
    expect(aoMudar).toHaveBeenLastCalledWith({ tier: 'Tier 2' });
    await usuario.selectOptions(screen.getByRole('combobox', { name: 'Concessionária' }), 'Corsan');
    expect(aoMudar).toHaveBeenLastCalledWith({ conc: 'Corsan' });
    await usuario.selectOptions(screen.getByRole('combobox', { name: 'UF' }), 'RS');
    expect(aoMudar).toHaveBeenLastCalledWith({ uf: 'RS' });
  });

  it('filtros só com as opções da amostra e padrão "Tier: Todos", "Concessionária: Todas", "UF: Todas" (E.3)', () => {
    montar();
    const opcoes = (nome: string) =>
      within(screen.getByRole('combobox', { name: nome }))
        .getAllByRole('option')
        .map((o) => o.textContent);
    expect(opcoes('Tier')).toEqual(['Todos', 'Tier 1', 'Tier 2']);
    expect(opcoes('Concessionária')).toEqual(['Todas', 'Águas do Rio', 'Corsan']);
    expect(opcoes('UF')).toEqual(['Todas', 'RJ', 'RS']);
    expect(screen.getByRole('combobox', { name: 'Tier' })).toHaveValue('');
    // Rótulo visível no formato "rótulo: valor"; os dois-pontos ficam fora do nome.
    for (const nome of ['Tier', 'Concessionária', 'UF']) {
      const rotulo = screen.getByRole('combobox', { name: nome }).closest('label')!;
      expect(rotulo.textContent?.startsWith(`${nome}:`)).toBe(true);
    }
  });

  it('com sent=negativas e ordem=data: 9 linhas e a primeira é 19/08 Zero Hora (roteiro G passo 6)', () => {
    montar({ sent: 'negativas', ordem: 'data' });
    const ls = linhas();
    expect(ls).toHaveLength(9);
    const [data, veiculo] = celulas(ls[0]);
    expect(data).toBe('19/08');
    expect(veiculo).toContain('Zero Hora');
  });

  it('o roteiro G passo 6 pelos cliques, sem estado próprio na lista', async () => {
    const usuario = userEvent.setup();
    render(<ComEndereco />);
    await usuario.click(screen.getByRole('button', { name: 'Negativas 71' }));
    await usuario.click(screen.getByRole('button', { name: 'Data' }));
    expect(screen.getByRole('button', { name: 'Negativas 71' })).toHaveAttribute('aria-pressed', 'true');
    expect(linhas()).toHaveLength(9);
    expect(celulas(linhas()[0])[0]).toBe('19/08');
  });

  it('tier, concessionária e UF combinam com E lógico', () => {
    const { unmount } = montar({ tier: 'Tier 2', conc: 'Águas do Rio', uf: 'RJ' });
    expect(linhas().map((l) => celulas(l)[1])).toEqual(['ExtraJúlia Barcellos', 'O DiaRedação']);
    unmount();
    montar({ tier: 'Tier 2', conc: 'Corsan', uf: 'RS', sent: 'negativas' });
    expect(linhas()).toHaveLength(1);
    expect(celulas(linhas()[0])[1]).toContain('Zero Hora');
    expect(screen.getByRole('combobox', { name: 'Concessionária' })).toHaveValue('Corsan');
  });

  it('vazio após filtros: mensagem e "Limpar filtros" remove sent, tier, conc e uf', async () => {
    const usuario = userEvent.setup();
    const { aoMudar } = montar({ tier: 'Tier 1', conc: 'Corsan', sent: 'positivas', ordem: 'data' });
    expect(linhas()).toHaveLength(0);
    expect(screen.getByText('Nenhuma matéria da amostra com esses filtros.')).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    expect(aoMudar).toHaveBeenCalledWith({ sent: undefined, tier: undefined, conc: undefined, uf: undefined });
    expect(screen.getByText('Mostrando 0 de 11 matérias da amostra · 96 no subtema')).toBeInTheDocument();
  });

  it('o rodapé é uma região de status: o resultado do filtro chega ao leitor de tela (WCAG 4.1.3)', async () => {
    const usuario = userEvent.setup();
    render(<ComEndereco />);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Amostra de 11 matérias de um total de 96 no subtema');
    await usuario.selectOptions(screen.getByRole('combobox', { name: 'Tier' }), 'Tier 2');
    expect(screen.getByRole('status')).toHaveTextContent('Mostrando 3 de 11 matérias da amostra · 96 no subtema');
  });

  it('segmentados: o botão com foco sobe acima dos vizinhos (anel de foco inteiro)', () => {
    montar();
    const botoes = within(screen.getByRole('group', { name: 'Sentimento' })).getAllByRole('button');
    // A ordem de empilhamento mora no CSS (`:focus-visible`), não no inline.
    for (const b of botoes) {
      expect(b).toHaveClass('consulta-segmento');
      expect(b.style.zIndex).toBe('');
    }
  });

  it('não mostra a mensagem de vazio quando há linhas', () => {
    montar();
    expect(screen.queryByText('Nenhuma matéria da amostra com esses filtros.')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Limpar filtros' })).toBeNull();
  });

  it('a linha do item do endereço tem fundo #E6EAFB e é rolada até o centro', () => {
    montar({ item: 'rom-10' });
    const destacada = linhas().find((l) => l.getAttribute('data-item') === 'rom-10')!;
    expect(destacada.style.background).toBe('rgb(230, 234, 251)');
    expect(destacada).toHaveAttribute('aria-current', 'true');
    expect(linhas().filter((l) => l.style.background !== '')).toHaveLength(1);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center' });
    expect(scrollIntoView.mock.contexts[0]).toBe(destacada);
  });

  it('na linha destacada, o selo Tier 1 vai em branco para não sumir no fundo de destaque', () => {
    montar({ item: 'rom-03' });
    const fundoDoTier = (linha: HTMLElement) =>
      within(linha).getByText('Tier 1').closest<HTMLElement>('[style*="background"]')!.style.background;
    const destacada = linhas().find((l) => l.getAttribute('data-item') === 'rom-03')!;
    const outra = linhas().find((l) => l.getAttribute('data-item') === 'rom-01')!;
    expect(fundoDoTier(destacada)).toBe('var(--branco)');
    expect(fundoDoTier(outra)).toBe('rgb(230, 234, 251)');
  });

  it('sem item no endereço, nada é destacado nem rolado', () => {
    montar();
    expect(linhas().filter((l) => l.style.background !== '')).toHaveLength(0);
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('rodapé sem filtro: amostra, total, fonte e corte', () => {
    montar({ ordem: 'data' });
    expect(
      screen.getByText('Amostra de 11 matérias de um total de 96 no subtema · fonte Clipei, corte em 31/08/2026'),
    ).toBeInTheDocument();
  });

  it('dados reais (D5): jornalista vazio mostra só o veículo; sem data de corte, o rodapé fica só com a fonte', () => {
    const semAutor = { ...adutora, nivel4: { ...adutora.nivel4!, itens: adutora.nivel4!.itens.map((i) => ({ ...i, jornalista: '' })) } };
    render(
      <ListaDeMaterias
        subtema={semAutor}
        unidade="matérias"
        fonte="Clipei"
        dataCorte=""
        endereco={BASE}
        aoMudar={() => {}}
        aoAbrirItem={() => {}}
      />,
    );
    const celulaDoVeiculo = within(linhas()[0]).getAllByRole('cell')[1];
    expect(celulaDoVeiculo.children).toHaveLength(1);
    expect(celulaDoVeiculo.textContent).toBe(semAutor.nivel4.itens.find((i) => i.id === celulaDoVeiculo.closest('[data-item]')!.getAttribute('data-item'))!.veiculo);
    expect(screen.getByText('Amostra de 11 matérias de um total de 96 no subtema · fonte Clipei')).toBeInTheDocument();
  });

  it('rodapé com filtro ativo', () => {
    montar({ tier: 'Tier 2' });
    expect(screen.getByText('Mostrando 3 de 11 matérias da amostra · 96 no subtema')).toBeInTheDocument();
  });

  it('sem "Carregar mais" nem "Exportar"', () => {
    montar();
    expect(screen.queryByText(/Carregar mais/)).toBeNull();
    expect(screen.queryByText(/Exportar/)).toBeNull();
  });

  it('"Abrir matéria ↗" chama aoAbrirItem com o item e o próprio botão', async () => {
    const usuario = userEvent.setup();
    const { aoAbrirItem } = montar({ sent: 'negativas', ordem: 'data' });
    // O nome acessível é "Abrir matéria", como nos cartões laterais: a seta é aria-hidden.
    const botao = within(linhas()[0]).getByRole('button', { name: 'Abrir matéria' });
    expect(botao).toHaveTextContent('Abrir matéria ↗');
    expect(botao).toHaveClass('sem-png', 'sem-impressao', 'consulta-botao-contornado');
    expect(botao).toHaveAccessibleDescription('Rompimento em rede de Canoas deixa bairros sem água por 20 horas');
    await usuario.click(botao);
    expect(aoAbrirItem).toHaveBeenCalledTimes(1);
    const [item, alvo] = aoAbrirItem.mock.calls[0] as [Item, HTMLElement];
    expect(item.id).toBe('rom-10');
    expect(alvo).toBe(botao);
  });

  it('subtema sem nivel4 não desenha nada', () => {
    const { nivel4: _, ...semNivel4 } = adutora;
    const { container } = render(
      <ListaDeMaterias
        subtema={semNivel4}
        unidade="matérias"
        fonte="Clipei"
        dataCorte=""
        endereco={BASE}
        aoMudar={() => {}}
        aoAbrirItem={() => {}}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
