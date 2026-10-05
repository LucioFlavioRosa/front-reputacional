// @vitest-environment jsdom

/** O modal de aprofundamento — o nível 3 do pacote.
 *
 *  POR QUE ELE EXISTE, nas palavras do dono do produto: "ao clicar em um dado
 *  temos que abrir um modal com o deep diving, e não como é feito hoje". Antes o
 *  clique aplicava o recorte na tela inteira; o modal põe o pedaço AO LADO do
 *  mês, com a trilha de volta.
 *
 *  O QUE ESTE ARQUIVO TRAVA é o que o painel promete: a trilha que permite
 *  subir, o impacto em pontos, o empilhamento de dentro (clicar desce sem sair),
 *  e a ausência dita em palavras quando o recorte não encontra nada.
 */

import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RecorteDaLente } from '@/paginas/score/RecorteDaLente';
import type { RecorteDaLente as Recorte } from '@/api/cliente';

vi.mock('@/api/cliente', async (original) => ({
  ...(await original<typeof import('@/api/cliente')>()),
  obterRecorteDaLente: vi.fn(),
}));

const { obterRecorteDaLente } = await import('@/api/cliente');

const FICHA = {
  origem: 'planilha' as const,
  fonte: 'Bites',
  colunas: [],
  lacunas: [],
  exemplo: false,
  conceitos: [],
};

const DO_RIO: Recorte = {
  lente: 'sociedade',
  mes: '2026-06',
  trilha: [{ chave: 'uf', dimensao: 'UF', valor: 'RJ' }],
  nota: 33,
  impacto: -2.1,
  composicao: { positivo: 1, neutro: 0, negativo: 3 },
  itens: 4,
  itens_no_mes: 6,
  frase: 'Este recorte tira 2,1 pontos da nota de Sociedade digital, com 4 de 6 itens do mês e 75% de negativas.',
  ausencia: null,
  historico: [
    { mes: '2026-05', impacto: 0, itens: 0, sem_base: true },
    { mes: '2026-06', impacto: -2.1, itens: 4, sem_base: false },
  ],
  dentro: [
    {
      tipo: 'barras_100',
      subtipo: null,
      titulo: 'Perfil de quem fala',
      conclusao: null,
      dados: [
        { rotulo: 'Cidadão', positivo: 1, neutro: 0, negativo: 2 },
        { rotulo: 'Figura pública', positivo: 0, neutro: 0, negativo: 1 },
      ],
      legenda: ['Positivo', 'Neutro', 'Negativo'],
      cores: [],
      colunas: [],
      recorta: 'perfil_autor',
      ficha: FICHA,
    },
  ],
  itens_do_recorte: {
    tipo: 'tabela',
    subtipo: null,
    titulo: 'Menções',
    conclusao: null,
    dados: [{ texto: 'Falta de água no bairro', quando: '2026-06-10' }],
    legenda: [],
    cores: [],
    colunas: [
      { chave: 'texto', titulo: 'Menção', alinhamento: 'esquerda' },
      { chave: 'quando', titulo: 'Quando', alinhamento: 'esquerda' },
    ],
    recorta: null,
    ficha: FICHA,
  },
};

function abrir(recorte: Recorte, props: Partial<Parameters<typeof RecorteDaLente>[0]> = {}) {
  vi.mocked(obterRecorteDaLente).mockResolvedValue(recorte);
  return render(
    <RecorteDaLente
      codigo="sociedade"
      mes="2026-06"
      filtro={{ uf: 'RJ' }}
      aoFechar={vi.fn()}
      aoDescer={vi.fn()}
      aoSubir={vi.fn()}
      {...props}
    />,
  );
}

describe('RecorteDaLente', () => {
  beforeEach(() => vi.clearAllMocks());

  it('abre com o valor no título e o caminho na trilha', async () => {
    abrir(DO_RIO);

    expect(await screen.findByRole('heading', { name: 'RJ' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /UF: RJ/ })).toBeTruthy();
  });

  it('mostra o IMPACTO em pontos e a frase que o explica', async () => {
    /** O IMPACTO É A REGRA CENTRAL DO PACOTE, e não a nota do recorte: a nota
     *  responde "como seria o mês se fosse só isto", o impacto responde "quanto
     *  isto pesa no mês que existe". São perguntas diferentes, e é a segunda que
     *  faz os pedaços somarem o todo. */
    const { container } = abrir(DO_RIO);

    expect(await screen.findByText(/pontos na nota da lente/)).toBeTruthy();
    //: PELA ÂNCORA, e não pelo texto: o mesmo −2,1 aparece na célula deste mês
    //: no histórico, e procurar pelo texto acha os dois.
    expect(container.querySelector('[data-impacto-do-recorte]')?.textContent).toBe('-2,1');
    expect(screen.getByText(/4 de 6 itens do mês/)).toBeTruthy();
  });

  it('o histórico marca o mês SEM BASE em vez de mostrar zero', async () => {
    /** Zero se lê como "o mês foi neutro", quando o que houve foi não haver
     *  menção nenhuma — é a mesma distinção que a evolução da lente faz. */
    abrir(DO_RIO);

    expect(await screen.findByText('sem base')).toBeTruthy();
    expect(screen.getByText('4 itens')).toBeTruthy();
  });

  it('clicar DENTRO do recorte desce um nível sem sair do painel', async () => {
    /** É O EMPILHAMENTO: "o Rio, entre cidadãos" tem de ser uma pergunta
     *  possível, e ela se faz aqui — não voltando à tela para procurar o perfil
     *  num campo suspenso. */
    const aoDescer = vi.fn();
    abrir(DO_RIO, { aoDescer });

    await userEvent.click(await screen.findByText('Cidadão'));

    expect(aoDescer).toHaveBeenCalledWith('perfil_autor', 'Cidadão');
  });

  it('clicar num degrau da trilha SOBE aquele degrau', async () => {
    const aoSubir = vi.fn();
    abrir(DO_RIO, { aoSubir });

    await userEvent.click(await screen.findByRole('button', { name: /UF: RJ/ }));

    expect(aoSubir).toHaveBeenCalledWith('uf');
  });

  it('o recorte sem item nenhum DIZ isso, e não mostra cinco seções vazias', async () => {
    abrir({
      ...DO_RIO,
      itens: 0,
      impacto: 0,
      composicao: { positivo: 0, neutro: 0, negativo: 0 },
      ausencia: 'Nenhuma menção classificada neste recorte.',
      dentro: [],
    });

    expect(await screen.findByText('Nenhuma menção classificada neste recorte.')).toBeTruthy();
    expect(screen.queryByText('Dentro deste recorte')).toBeNull();
  });

  it('sem item NESTE mês, mostra o histórico — que é onde ele mais importa', async () => {
    /** ACHADO DE REVISÃO (alta). O painel "Concessionárias com maior
     *  repercussão" agrega a janela inteira de meses, então uma concessionária
     *  visível na barra pode ter zero menções no mês aberto. Antes o clique
     *  aplicava o recorte na tela e a pessoa caía num mês vazio sem explicação;
     *  agora o painel diz "nenhum item neste mês" E mostra em que meses houve —
     *  que é a resposta para "por que esta barra existe, então". */
    abrir({
      ...DO_RIO,
      itens: 0,
      impacto: 0,
      composicao: { positivo: 0, neutro: 0, negativo: 0 },
      ausencia: 'Nenhum item deste recorte neste mês.',
      dentro: [],
      historico: [
        { mes: '2026-04', impacto: -4.2, itens: 31, sem_base: false },
        { mes: '2026-06', impacto: 0, itens: 0, sem_base: true },
      ],
    });

    expect(await screen.findByText('Nenhum item deste recorte neste mês.')).toBeTruthy();
    expect(screen.getByText('Este recorte, mês a mês')).toBeTruthy();
    expect(screen.getByText('31 itens')).toBeTruthy();
  });

  it('pede o recorte com o caminho inteiro, e não só o último degrau', async () => {
    /** SENÃO O NÚMERO DO MODAL DISCORDA DO PAINEL: aprofundar num perfil de
     *  dentro de "UF: RJ" é "este perfil, no Rio". Mandar só o perfil mediria o
     *  país. */
    abrir(DO_RIO, { filtro: { uf: 'RJ', perfil_autor: 'Cidadão' } });

    await waitFor(() =>
      expect(obterRecorteDaLente).toHaveBeenCalledWith('sociedade', '2026-06', {
        uf: 'RJ',
        perfil_autor: 'Cidadão',
      }),
    );
  });
});
