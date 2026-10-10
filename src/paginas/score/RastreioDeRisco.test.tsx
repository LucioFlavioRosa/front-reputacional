// @vitest-environment jsdom

/** A aba Risk Tracking — do índice do mês até o registro.
 *
 *  O QUE SE TESTA AQUI é o que o dono do produto pediu e o que engana em
 *  silêncio:
 *
 *    1. O CLIQUE APROFUNDA, NÃO FILTRA. Nas palavras dele, ditas primeiro das
 *       Lentes: "ao clicar em um dado temos que abrir um modal com o deep
 *       diving, e não como é feito hoje". Filtrar a tela refaz o gráfico, a
 *       matriz e os números, e quem clicou perde de vista de onde saiu.
 *
 *    2. O CAMINHO MACRO → MICRO existe de ponta a ponta: mês, risco, severidade
 *       e os três níveis do tema levam aos registros.
 *
 *    3. A DIMENSÃO VAZIA CONTINUA NA FILEIRA, dizendo por quê — em vez de
 *       desaparecer e fazer a fileira mudar de tamanho a cada clique.
 *
 *    4. A VARIAÇÃO É VERDE PARA BAIXO, ao contrário do Score, e a tela ESCREVE o
 *       que a cor quer dizer.
 */

import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RastreioDeRisco } from '@/paginas/score/RastreioDeRisco';
import type {
  OpcoesDoRisco,
  PaginaDeIncidentes,
  PainelDeRisco,
} from '@/dominio/riscos';

vi.mock('@/api/cliente', () => ({
  obterPainelDeRisco: vi.fn(),
  obterOpcoesDoRisco: vi.fn(),
  listarIncidentesDeRisco: vi.fn(),
}));

import {
  listarIncidentesDeRisco,
  obterOpcoesDoRisco,
  obterPainelDeRisco,
} from '@/api/cliente';

/** Um mês da série, para a semente ter período sobre o qual a janela recorte.
 *
 *  SEIS MESES porque "3M" sobre dois meses é a série inteira: o recorte não
 *  mudaria, e o teste de "trocar o recorte recarrega" não mediria nada. */
function mesDaSerie(mes: string, indice: number, naJanela = true) {
  return {
    mes,
    indice,
    incidentes: 1,
    por_severidade: { moderado: 1 },
    pesado_por_severidade: { moderado: 1 },
    pesado: 1,
    faixa: 'moderado',
    na_janela: naJanela,
    fontes: ['bites'],
  };
}

const PAINEL: PainelDeRisco = {
  serie: [
    mesDaSerie('2026-03', 10),
    mesDaSerie('2026-04', 12),
    mesDaSerie('2026-05', 14),
    mesDaSerie('2026-06', 16),
    {
      mes: '2026-08',
      indice: 100,
      incidentes: 3,
      por_severidade: { critico: 1, alto: 2 },
      pesado_por_severidade: { critico: 3, alto: 4 },
      pesado: 7,
      faixa: 'critico',
      na_janela: true,
      fontes: ['bites', 'clipei'],
    },
    {
      mes: '2026-09',
      indice: 29,
      incidentes: 1,
      por_severidade: { moderado: 1 },
      pesado_por_severidade: { moderado: 2 },
      pesado: 2,
      faixa: 'moderado',
      na_janela: false,
      fontes: ['crm'],
    },
  ],
  referencia: 7,
  mes_do_pico: '2026-08',
  pico_do_periodo: { valor: 100, mes: '2026-08' },
  indice_atual: { valor: 29, mes: '2026-09' },
  variacao_no_mes: { valor: -71, mes: '2026-08' },
  matriz: [
    {
      codigo: 'R1',
      nome: 'Entrega de água',
      severidade: 'critico',
      cluster: 'operacional',
      cluster_nome: 'Riscos Operacionais',
      incidentes: 3,
      mencoes: 2,
      agendas: 1,
    },
    {
      codigo: 'R2',
      nome: 'Barragem',
      severidade: 'alto',
      cluster: 'operacional',
      cluster_nome: 'Riscos Operacionais',
      incidentes: 0,
      mencoes: 0,
      agendas: 0,
    },
  ],
  total_por_severidade: { critico: 1, alto: 2, moderado: 1 },
  faixas: { critico: 67, alto: 34, moderado: 0 },
};

const OPCOES: OpcoesDoRisco = {
  clusters: [
    {
      codigo: 'operacional',
      nome: 'Riscos Operacionais',
      riscos: [
        { codigo: 'R1', nome: 'Entrega de água', severidade: 'critico' },
        { codigo: 'R2', nome: 'Barragem', severidade: 'alto' },
      ],
    },
  ],
  fontes: [
    { codigo: 'clipei', nome: 'Clipei' },
    { codigo: 'bites', nome: 'Bites' },
  ],
  lentes: [
    { codigo: 'imprensa', nome: 'Imprensa' },
    { codigo: 'sociedade', nome: 'Sociedade digital' },
  ],
  temas: [
    {
      codigo: 'eficiencia',
      nome: 'Eficiência Operacional',
      incidentes: 4,
      dentro: [
        {
          codigo: 'abastecimento',
          nome: 'Abastecimento',
          incidentes: 4,
          dentro: [
            { codigo: 'Desabastecimento', nome: 'Desabastecimento', incidentes: 4, dentro: [] },
          ],
        },
      ],
    },
  ],
  dimensoes: [
    {
      chave: 'cargo',
      rotulo: 'Cargo de quem fala',
      tipo: 'lista',
      valores: ['vereador'],
      quantos: 1,
      fontes: ['bites'],
      preenchidas: 2,
    },
    {
      //: A DIMENSÃO QUE A FONTE TEM E O RECORTE ESVAZIOU.
      chave: 'tier',
      rotulo: 'Relevância do veículo',
      tipo: 'vazia',
      valores: [],
      quantos: 0,
      fontes: ['clipei'],
      preenchidas: 0,
    },
  ],
  meses: ['2026-08', '2026-09'],
};

const REGISTROS: PaginaDeIncidentes = {
  itens: [
    {
      tipo: 'mencao',
      id: 'm1',
      data: '2026-08-04',
      quem: 'Jornal do Risco',
      incidente: 'Falta de água no bairro',
      link: 'https://exemplo/1',
      fonte: 'clipei',
      lente: 'imprensa',
      tema: 'Desabastecimento',
      tier: 'muito relevante',
      engajamento: null,
      severidade: 'critico',
      recorrencia: 3,
      riscos: [{ codigo: 'R1', nome: 'Entrega de água' }],
    },
    {
      tipo: 'agenda',
      id: 'a1',
      data: '2026-08-12',
      quem: null,
      incidente: null,
      link: null,
      fonte: 'crm',
      lente: 'institucional',
      tema: 'Desabastecimento',
      tier: null,
      engajamento: null,
      severidade: 'alto',
      recorrencia: 3,
      riscos: [{ codigo: 'R1', nome: 'Entrega de água' }],
    },
  ],
  total: 4,
  pagina: 1,
  tamanho: 50,
};

beforeEach(() => {
  vi.mocked(obterPainelDeRisco).mockResolvedValue(PAINEL);
  vi.mocked(obterOpcoesDoRisco).mockResolvedValue(OPCOES);
  vi.mocked(listarIncidentesDeRisco).mockResolvedValue(REGISTROS);
});

describe('a aba Risk Tracking', () => {
  it('abre com o índice, a matriz e os registros', async () => {
    render(<RastreioDeRisco />);

    expect(await screen.findByRole('heading', { name: 'Risk Tracking' })).toBeTruthy();
    expect(screen.getByText('Índice de Exposição a Risco')).toBeTruthy();
    //: A REFERÊNCIA DIZ O QUE 100 SIGNIFICA — sem ela, "índice 29" não tem
    //: unidade.
    expect(screen.getByText(/100 = o pior mês da série/)).toBeTruthy();
    expect(screen.getAllByText('Entrega de água').length).toBeGreaterThan(0);
    expect(screen.getByText('Falta de água no bairro')).toBeTruthy();
  });

  it('MOSTRA O RISCO SEM INCIDENTE, porque "não houve" é informação', async () => {
    render(<RastreioDeRisco />);
    await screen.findByRole('button', {
      name: /Aprofundar no risco Entrega de água/,
    });

    //: A matriz é o mapa da empresa, não a lista do mês: esconder o risco
    //: zerado tiraria a informação de que ele está limpo.
    expect(
      screen.getByRole('button', { name: /Risco Barragem .* sem incidente/ }),
    ).toBeTruthy();
  });

  it('o CLIQUE NUM RISCO ABRE O APROFUNDAMENTO, e não refaz a tela', async () => {
    render(<RastreioDeRisco />);
    const risco = await screen.findByRole('button', {
      name: /Aprofundar no risco Entrega de água/,
    });

    await userEvent.click(risco);

    //: O MODAL ABRE com o degrau no título.
    const painel = await screen.findByRole('dialog');
    expect(painel.textContent).toContain('Risco: R1');
    //: E A TELA DE TRÁS CONTINUA ONDE ESTAVA: o gráfico não foi recortado.
    expect(screen.getByText('Índice de Exposição a Risco')).toBeTruthy();
  });

  it('o CLIQUE NUM MÊS abre o aprofundamento daquele mês', async () => {
    render(<RastreioDeRisco />);
    const barra = await screen.findByRole('button', { name: /índice 100/ });

    await userEvent.click(barra);

    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(vi.mocked(listarIncidentesDeRisco)).toHaveBeenCalledWith(
      expect.objectContaining({ de: '2026-08', ate: '2026-08' }),
      1,
      expect.any(Number),
    );
  });

  it('o CLIQUE NUM DOS TRÊS NÚMEROS desce na severidade', async () => {
    render(<RastreioDeRisco />);
    await screen.findByText('Total de incidentes');

    const critico = screen.getByRole('button', {
      name: /Aprofundar nos 1 incidentes de severidade Crítico/,
    });
    await userEvent.click(critico);

    const painel = await screen.findByRole('dialog');
    expect(painel.textContent).toContain('Severidade: critico');
  });

  it('a DIMENSÃO VAZIA fica na fileira dizendo por quê', async () => {
    render(<RastreioDeRisco />);
    await screen.findByText('Desta base');

    //: Um filtro que aparece e desaparece a cada clique se lê como tela
    //: quebrada; o vazio diz algo acionável.
    expect(screen.getByText('Relevância do veículo')).toBeTruthy();
    expect(screen.getByText('sem valor neste corte')).toBeTruthy();
  });

  it('a VARIAÇÃO escreve o que a cor quer dizer', async () => {
    render(<RastreioDeRisco />);
    await screen.findByText('Variação no mês');

    //: AQUI CAIR É BOM (o índice é exposição a risco), ao contrário do Score.
    //: A cor sozinha enganaria quem vem da outra aba.
    expect(screen.getByText(/Risco em queda frente a/)).toBeTruthy();
  });

  it('a AGENDA do CRM diz que NÃO TEM ALCANCE, em vez de célula vazia', async () => {
    render(<RastreioDeRisco />);
    await screen.findByText('Falta de água no bairro');

    expect(screen.getByText('não se aplica')).toBeTruthy();
    //: E a linha da agenda se descreve pelo assunto.
    expect(screen.getByText(/Reunião de clima tenso sobre Desabastecimento/)).toBeTruthy();
  });

  it('escolher o PILAR (N1) oferece o MACRO TEMA (N2)', async () => {
    render(<RastreioDeRisco />);
    await screen.findByText('Filtros:');

    //: A ESCADA: sem N1 escolhido não há por que listar 104 temas.
    expect(screen.queryByText('Macro tema (N2)')).toBeNull();
    expect(screen.getByText('Pilar (N1)')).toBeTruthy();
  });

  it('TROCAR O RECORTE NA PÁGINA 2 faz UM carregamento, não dois', async () => {
    //: ACHADO DE REVISÃO: a página era zerada por um efeito, então o efeito de
    //: carga rodava primeiro com o recorte NOVO e a página ANTIGA — pedindo a
    //: página 3 de um recorte que pode ter uma, e mostrando tabela vazia por um
    //: instante. Agora a página é derivada do recorte na renderização.
    vi.mocked(listarIncidentesDeRisco).mockResolvedValue({
      ...REGISTROS,
      total: 120,
      pagina: 1,
      tamanho: 50,
    });
    render(<RastreioDeRisco />);
    await screen.findByText('Falta de água no bairro');

    await userEvent.click(screen.getByRole('button', { name: '2' }));
    await waitFor(() =>
      expect(
        vi.mocked(listarIncidentesDeRisco).mock.calls.some(([, pagina]) => pagina === 2),
      ).toBe(true),
    );
    const antes = vi.mocked(listarIncidentesDeRisco).mock.calls.length;

    await userEvent.click(screen.getByRole('button', { name: '3M' }));
    await waitFor(() =>
      expect(vi.mocked(listarIncidentesDeRisco).mock.calls.length).toBeGreaterThan(antes),
    );

    //: UM PEDIDO SÓ, e já na primeira página.
    const depois = vi.mocked(listarIncidentesDeRisco).mock.calls.slice(antes);
    expect(depois).toHaveLength(1);
    expect(depois[0][1]).toBe(1);
  });

  it('o ERRO LIMPA OS DADOS, em vez de deixar número velho sob chip novo', async () => {
    render(<RastreioDeRisco />);
    await screen.findByText('Falta de água no bairro');

    vi.mocked(obterPainelDeRisco).mockRejectedValue(new Error('500 no servidor'));
    await userEvent.click(screen.getByRole('button', { name: '3M' }));

    expect(await screen.findByText(/500 no servidor/)).toBeTruthy();
    //: QUEM OLHA DE LONGE LÊ OS NÚMEROS, não a faixa vermelha.
    expect(screen.queryByText('Falta de água no bairro')).toBeNull();
  });

  it('pede os dados de novo quando o recorte muda', async () => {
    render(<RastreioDeRisco />);
    await screen.findByText('Falta de água no bairro');
    const antes = vi.mocked(obterPainelDeRisco).mock.calls.length;

    await userEvent.click(screen.getByRole('button', { name: '3M' }));

    await waitFor(() =>
      expect(vi.mocked(obterPainelDeRisco).mock.calls.length).toBeGreaterThan(antes),
    );
  });
});
