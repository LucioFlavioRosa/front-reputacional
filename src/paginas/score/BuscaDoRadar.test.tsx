// @vitest-environment jsdom

/** A busca inteligente do Radar: sugestões de lentes e de filtros de lente. */

import { render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { OpcoesDeFiltroDaLente } from '@/api/cliente';
import { obterOpcoesDeFiltroDaLente } from '@/api/cliente';
import {
  agruparResultadosDoDrill,
  filtrarSugestoes,
  montarSugestoes,
  opcoesDaBusca,
  realcarTrecho,
} from '@/dominio/buscaDoRadar';
import { DADOS } from '@/paginas/score/consulta/dados/dados';
import { buscarNoDrill, montarIndiceDeBusca } from '@/paginas/score/consulta/dados/seletores';

const vazio: OpcoesDeFiltroDaLente = {
  tiers: [], veiculos: [], atributos: [], temas: [], perfis: [], ufs: [], subtemas: [], autores: [], empresas: [],
};
const OPCOES: Record<string, OpcoesDeFiltroDaLente> = {
  //: O TEMA DO FORNECEDOR CHEGA COMO PILAR (N1) — o servidor o põe em `temas_n1`.
  imprensa: { ...vazio, veiculos: ['Folha de S.Paulo', 'Valor'], tiers: ['muito_relevante'], temas_n1: ['Tarifa social'] },
  sociedade: { ...vazio, veiculos: ['Instagram'], temas_n1: ['Tarifa social'] },
  clientes: { ...vazio, empresas: ['Águas do Rio'] },
};

vi.mock('@/api/cliente', () => ({
  obterOpcoesDeFiltroDaLente: vi.fn((lente: string) => Promise.resolve(OPCOES[lente])),
}));

const LENTES = [
  { codigo: 'imprensa', nome: 'Imprensa', stakeholder: 'Formadores de opinião' },
  { codigo: 'mercado', nome: 'Mercado', stakeholder: 'Investidores e rating' },
  { codigo: 'sociedade', nome: 'Sociedade digital', stakeholder: 'Redes em mar aberto' },
  { codigo: 'clientes', nome: 'Clientes', stakeholder: 'Canais próprios' },
];

describe('sugestões do Radar', () => {
  const todas = montarSugestoes(LENTES, OPCOES);

  it('acha sem acento e diz de que lente é', () => {
    const [aguas] = filtrarSugestoes(todas, 'aguas');
    expect(aguas).toMatchObject({ rotulo: 'Águas do Rio', grupo: 'Concessionária', lente: 'clientes' });
  });

  it('o mesmo tema em duas lentes vira duas sugestões, como Pilar (N1)', () => {
    const tarifa = filtrarSugestoes(todas, 'tarifa');
    expect(tarifa.map((s) => s.lente).sort()).toEqual(['imprensa', 'sociedade']);
    expect(tarifa.every((s) => s.grupo === 'Pilar (N1)')).toBe(true);
  });

  it('a lente vem antes dos filtros, e acha pelo público', () => {
    expect(filtrarSugestoes(todas, 'investidores')[0]).toMatchObject({ grupo: 'Lente', lente: 'mercado' });
    expect(filtrarSugestoes(todas, 'Rede')[0].grupo).toBe('Lente'); // "Redes em mar aberto"
  });

  it('usa o nome da lente para a dimensão ("Rede" na Sociedade) e o rótulo do tier', () => {
    expect(filtrarSugestoes(todas, 'insta')[0]).toMatchObject({ grupo: 'Rede' });
    expect(filtrarSugestoes(todas, 'tier 1')[0]).toMatchObject({ grupo: 'Tier do veículo', rotulo: 'Tier 1' });
  });
});

describe('BuscaDoRadar', () => {
  beforeEach(() => vi.clearAllMocks());

  it('digitar e escolher devolve a lente e o filtro', async () => {
    const { BuscaDoRadar } = await import('@/paginas/score/BuscaDoRadar');
    const aoEscolher = vi.fn();
    render(
      <BuscaDoRadar mes="2026-06" lentes={LENTES} lenteAberta="imprensa" filtro={{}} aoEscolher={aoEscolher} aoMudarFiltro={vi.fn()} />,
    );
    const campo = screen.getByRole('combobox');
    await userEvent.click(campo);
    await userEvent.type(campo, 'folha');
    await waitFor(() => expect(screen.getByRole('option', { name: /Folha de S.Paulo/ })).toBeTruthy());
    await userEvent.keyboard('{Enter}');
    expect(aoEscolher).toHaveBeenCalledWith(
      expect.objectContaining({ lente: 'imprensa', filtro: { chave: 'veiculo', valor: 'Folha de S.Paulo' } }),
    );
  });

  it('mostra o filtro ativo como chip e o "Limpar" zera', async () => {
    const { BuscaDoRadar } = await import('@/paginas/score/BuscaDoRadar');
    const aoMudarFiltro = vi.fn();
    render(
      <BuscaDoRadar
        mes="2026-06"
        lentes={LENTES}
        lenteAberta="imprensa"
        filtro={{ veiculo: 'Valor' }}
        aoEscolher={vi.fn()}
        aoMudarFiltro={aoMudarFiltro}
      />,
    );
    expect(screen.getByText(/Imprensa · Veículo: Valor/)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Limpar' }));
    expect(aoMudarFiltro).toHaveBeenCalledWith({});
  });
});

describe('BuscaDoRadar no cabeçalho', () => {
  it('entra no espaço que o cabeçalho reserva, como a busca do CRM', async () => {
    const { BuscaDoRadar } = await import('@/paginas/score/BuscaDoRadar');
    const espaco = document.createElement('div');
    espaco.id = 'busca-no-cabecalho';
    document.body.appendChild(espaco);
    render(
      <BuscaDoRadar mes="2026-06" lentes={LENTES} lenteAberta="imprensa" filtro={{}} aoEscolher={vi.fn()} aoMudarFiltro={vi.fn()} />,
    );
    expect(espaco.querySelector('input[role="combobox"]')).toBeTruthy();
    espaco.remove();
  });
});

describe('grupo "Consulta em profundidade" (D3, A15, E.9)', () => {
  beforeEach(() => vi.clearAllMocks());

  const montarBusca = async (aoEscolherNoDrill = vi.fn(), aoEscolher = vi.fn()) => {
    const { BuscaDoRadar } = await import('@/paginas/score/BuscaDoRadar');
    render(
      <BuscaDoRadar
        mes="2026-06"
        lentes={LENTES}
        lenteAberta="imprensa"
        filtro={{}}
        aoEscolher={aoEscolher}
        aoMudarFiltro={vi.fn()}
        aoEscolherNoDrill={aoEscolherNoDrill}
      />,
    );
    const campo = screen.getByRole('combobox');
    await userEvent.click(campo);
    // As opções reais chegam pela rede (simulada): espera, para o teste não
    // depender da ordem entre a rede e a digitação.
    await waitFor(() => expect(vi.mocked(obterOpcoesDeFiltroDaLente)).toHaveBeenCalled());
    return { campo, aoEscolherNoDrill, aoEscolher };
  };

  it('"adutora": cabeçalho do grupo, selo, kicker do tipo, impacto e caminho; Enter leva ao subtema', async () => {
    const { campo, aoEscolherNoDrill } = await montarBusca();
    await userEvent.type(campo, 'adutora');

    expect(screen.getByText('Consulta em profundidade')).toBeTruthy();
    expect(screen.getByText(DADOS.meta.aviso)).toBeTruthy();
    const grupo = screen.getByRole('group', { name: 'Consulta em profundidade · Subtema' });
    const opcao = within(grupo).getByRole('option', { name: /Rompimento de adutora/ });
    expect(opcao.textContent).toContain('−3,1 pt');
    expect(opcao.textContent).toContain('Imprensa › Eficiência Operacional e Qualidade › Abastecimento de água');
    // O trecho buscado vai em destaque.
    expect(within(opcao).getByText('adutora').tagName).toBe('STRONG');

    await userEvent.keyboard('{Enter}');
    expect(aoEscolherNoDrill).toHaveBeenCalledWith(
      expect.objectContaining({ ativo: true, lente: 'imprensa', subtema: expect.any(String) }),
    );
    // A lista fecha e o campo esvazia.
    expect(screen.queryByRole('listbox')).toBeNull();
    expect((campo as HTMLInputElement).value).toBe('');
  });

  it('as setas atravessam os dois grupos: sugestão real primeiro, depois o drill', async () => {
    const { campo, aoEscolherNoDrill, aoEscolher } = await montarBusca();
    await userEvent.type(campo, 'agua');
    await waitFor(() => expect(screen.getByRole('option', { name: /Águas do Rio/ })).toBeTruthy());

    const opcoes = screen.getAllByRole('option');
    expect(opcoes[0].textContent).toContain('Águas do Rio');
    expect(opcoes[0].getAttribute('aria-selected')).toBe('true');
    expect(opcoes.slice(1).some((o) => /Abastecimento de água/.test(o.textContent ?? ''))).toBe(true);

    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getAllByRole('option')[1].getAttribute('aria-selected')).toBe('true');
    expect(campo.getAttribute('aria-activedescendant')).toBe(screen.getAllByRole('option')[1].id);
    // Seta para cima a partir da primeira dá a volta até a última.
    await userEvent.keyboard('{ArrowUp}{ArrowUp}');
    const todas = screen.getAllByRole('option');
    expect(todas[todas.length - 1].getAttribute('aria-selected')).toBe('true');

    await userEvent.keyboard('{Enter}');
    expect(aoEscolher).not.toHaveBeenCalled();
    expect(aoEscolherNoDrill).toHaveBeenCalledTimes(1);
  });

  it('matéria com o impacto em 2 casas, como na lista do Nível 4 e na prévia (E.2, F.9)', async () => {
    const { campo } = await montarBusca();
    await userEvent.type(campo, 'Canoas');
    const materias = screen.getByRole('group', { name: 'Consulta em profundidade · Matéria' });
    const opcao = within(materias).getByRole('option', {
      name: /Rompimento em rede de Canoas deixa bairros sem água por 20 horas/,
    });
    expect(opcao.textContent).toContain('−0,06 pt');
    expect(opcao.textContent).not.toContain('−0,1 pt');
  });

  it('Esc fecha a lista', async () => {
    const { campo } = await montarBusca();
    await userEvent.type(campo, 'adutora');
    expect(screen.getByRole('listbox')).toBeTruthy();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('clique numa opção do drill também abre', async () => {
    const { campo, aoEscolherNoDrill } = await montarBusca();
    await userEvent.type(campo, 'fiscalizacao');
    const subtemas = screen.getByRole('group', { name: 'Consulta em profundidade · Subtema' });
    await userEvent.click(within(subtemas).getByRole('option', { name: /Fiscalização regulatória/ }));
    expect(aoEscolherNoDrill).toHaveBeenCalledWith(
      expect.objectContaining({ subtema: 'fiscalizacao-regulatoria' }),
    );
  });

  it.each(['adutora', 'agua', 'O Globo', 'fiscalizacao', 'Corsan', 'rating'])(
    'o termo %s acha resultados no drill',
    async (termo) => {
      const { campo } = await montarBusca();
      await userEvent.type(campo, termo);
      expect(screen.getAllByRole('group').length).toBeGreaterThan(0);
    },
  );

  it('com 1 caractere o grupo não aparece', async () => {
    const { campo } = await montarBusca();
    await userEvent.type(campo, 'a');
    expect(screen.queryByText('Consulta em profundidade')).toBeNull();
  });

  it('sem resultado em nenhum dos dois grupos, a mensagem da E.9', async () => {
    const { campo } = await montarBusca();
    await userEvent.type(campo, 'zzqx');
    await waitFor(() =>
      expect(
        screen.getByText('Nenhum resultado para "zzqx". Tente um tema, um subtema ou um veículo.'),
      ).toBeTruthy(),
    );
  });

  it('sem o callback do drill, o grupo não aparece (sugestões reais intactas)', async () => {
    const { BuscaDoRadar } = await import('@/paginas/score/BuscaDoRadar');
    render(
      <BuscaDoRadar mes="2026-06" lentes={LENTES} lenteAberta="imprensa" filtro={{}} aoEscolher={vi.fn()} aoMudarFiltro={vi.fn()} />,
    );
    const campo = screen.getByRole('combobox');
    await userEvent.click(campo);
    await userEvent.type(campo, 'adutora');
    expect(screen.queryByText('Consulta em profundidade')).toBeNull();
  });
});

describe('apoios do grupo do drill', () => {
  it('realcarTrecho marca sem acento e devolve as letras originais', () => {
    expect(realcarTrecho('Abastecimento de água', 'agua')).toEqual([
      { texto: 'Abastecimento de ', realce: false },
      { texto: 'água', realce: true },
    ]);
    expect(realcarTrecho('Rompimento de adutora', 'ADUTORA')).toEqual([
      { texto: 'Rompimento de ', realce: false },
      { texto: 'adutora', realce: true },
    ]);
  });

  it('realcarTrecho prefere o termo inteiro e não marca letra solta', () => {
    // "o globo" achou a matéria pelo veículo: o título não ganha "o" marcados.
    expect(realcarTrecho('Rompimento de adutora', 'O Globo')).toEqual([
      { texto: 'Rompimento de adutora', realce: false },
    ]);
    expect(
      realcarTrecho('Tarifa social da água', 'agua tarifa')
        .filter((t) => t.realce)
        .map((t) => t.texto),
    ).toEqual(['Tarifa', 'água']);
  });

  it('agruparResultadosDoDrill e opcoesDaBusca mantêm a ordem e os índices', () => {
    const doDrill = buscarNoDrill(montarIndiceDeBusca(DADOS), 'agua');
    const grupos = agruparResultadosDoDrill(doDrill);
    expect(grupos.flatMap((g) => g.resultados)).toEqual(doDrill);
    grupos.forEach((g) => expect(doDrill[g.inicio]).toBe(g.resultados[0]));
    const reais = filtrarSugestoes(montarSugestoes(LENTES, OPCOES), 'agua');
    const opcoes = opcoesDaBusca(reais, doDrill);
    expect(opcoes).toHaveLength(reais.length + doDrill.length);
    expect(opcoes[0].origem).toBe('radar');
    expect(opcoes[opcoes.length - 1].origem).toBe('drill');
  });
});
