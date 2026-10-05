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
      coluna_do_link: null,
      ficha: FICHA,
    },
  ],
  itens_do_recorte: {
    tipo: 'tabela',
    subtipo: null,
    titulo: 'Menções',
    conclusao: null,
    dados: [
      {
        texto: 'Falta de água no bairro',
        quando: '2026-06-10',
        link: 'https://exemplo.com/post/1',
      },
    ],
    legenda: [],
    cores: [],
    colunas: [
      { chave: 'texto', titulo: 'Menção', alinhamento: 'esquerda' },
      { chave: 'quando', titulo: 'Quando', alinhamento: 'esquerda' },
    ],
    recorta: null,
    //: A TABELA DE MENÇÕES LEVA À FONTE: o servidor diz qual coluna é o
    //: endereço da linha, e a coluna não é desenhada.
    coluna_do_link: 'link',
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

  it('NOMEIA O MÊS, porque ele pode não ser o da tela', async () => {
    /** DESDE QUE A BARRA DA EVOLUÇÃO ABRE ESTE PAINEL, o mês dele pode ser outro:
     *  clicar em abril com a tela em junho mostrava números sem nada dizendo de
     *  que mês eram. O mês está no título quando não há dimensão, e na raiz da
     *  trilha sempre. */
    abrir({ ...DO_RIO, mes: '2026-04', trilha: [] }, { mes: '2026-04', filtro: {} });

    expect(await screen.findByRole('heading', { name: /abr\/26/ })).toBeTruthy();
  });

  it('a raiz da trilha nomeia o mês mesmo com dimensão escolhida', async () => {
    abrir(DO_RIO);

    expect(await screen.findByText(/Lente · jun\/26/)).toBeTruthy();
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

  it('clicar na LINHA da menção abre a página da fonte, em outra aba', async () => {
    /** PEDIDO DO DONO DO PRODUTO: "não precisa ter o link no modal, mas se
     *  clicar gostaria de acessar a página". Uma coluna "Link" com "Abrir ↗"
     *  repetido trinta vezes é ruído, e rouba largura do texto — que é o que se
     *  lê.
     *
     *  EM OUTRA ABA porque a tela de trás é o aprofundamento que a pessoa estava
     *  lendo: trocá-la pela página do fornecedor perderia o caminho inteiro. */
    const espiao = vi.spyOn(window, 'open').mockReturnValue(null);
    abrir(DO_RIO);
    const dentro = await screen.findByText('Falta de água no bairro');

    await userEvent.click(dentro.closest('tr')!);

    expect(window.open).toHaveBeenCalledWith(
      'https://exemplo.com/post/1',
      '_blank',
      'noopener,noreferrer',
    );
    espiao.mockRestore();
  });

  it('o texto da menção é um LINK de verdade, para teclado e leitor de tela', async () => {
    /** O CLIQUE NA LINHA É CONVENIÊNCIA; o link é o caminho acessível. Um `tr`
     *  com `role="button"` quebraria a semântica da tabela — mesmo achado que
     *  tirou o `role` do `li` nas barras. */
    abrir(DO_RIO);

    const link = await screen.findByRole('link', { name: /Falta de água no bairro/ });
    expect(link.getAttribute('href')).toBe('https://exemplo.com/post/1');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link.getAttribute('target')).toBe('_blank');
  });

  it('a coluna de LINK não é desenhada — o endereço é o destino da linha', async () => {
    abrir(DO_RIO);
    await screen.findByText('Falta de água no bairro');

    expect(screen.queryByText('Abrir ↗')).toBeNull();
    expect(screen.queryByRole('columnheader', { name: 'Link' })).toBeNull();
  });

  it('o link NÃO PULA de coluna quando uma linha vem sem texto', async () => {
    /** FURO MEU, CORRIGIDO ANTES DE IR: eu havia escrito "a primeira célula com
     *  texto", POR LINHA — e numa linha sem o texto da menção o link cairia na
     *  coluna de data. A mesma tabela teria o link em lugares diferentes
     *  dependendo do que o fornecedor preencheu, e uma tabela assim não se
     *  aprende. A coluna é decisão da TABELA: a primeira. */
    abrir({
      ...DO_RIO,
      itens_do_recorte: {
        ...DO_RIO.itens_do_recorte,
        dados: [
          { texto: null, quando: '2026-06-09', link: 'https://exemplo.com/post/2' },
          { texto: 'Com texto', quando: '2026-06-10', link: 'https://exemplo.com/post/3' },
        ],
      },
    });
    await screen.findByText('Com texto');

    //: Um link só, no texto da segunda linha: a primeira não tem o que linkar, e
    //: a data dela NÃO virou link.
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0].textContent).toBe('Com texto');
    expect(screen.queryByRole('link', { name: '2026-06-09' })).toBeNull();
  });

  it('SELECIONAR texto na linha não abre a página', async () => {
    /** A tabela de menções é feita de texto que se copia, e um arrasto para
     *  selecionar termina em `click`. Sem a guarda, copiar meia frase abria a
     *  página do fornecedor no meio do gesto. */
    const espiao = vi.spyOn(window, 'open').mockReturnValue(null);
    vi.spyOn(window, 'getSelection').mockReturnValue({
      toString: () => 'Falta de água',
    } as unknown as Selection);
    abrir(DO_RIO);
    const dentro = await screen.findByText('Falta de água no bairro');

    await userEvent.click(dentro.closest('tr')!);

    expect(window.open).not.toHaveBeenCalled();
    espiao.mockRestore();
    vi.mocked(window.getSelection).mockRestore();
  });

  it('endereço que não é http NAO vira destino', async () => {
    /** O ENDEREÇO VEM DO ARQUIVO QUE O FORNECEDOR ENTREGOU: um `javascript:`
     *  numa célula viraria código executando na sessão de quem clicou. */
    const aberto = vi.spyOn(window, 'open').mockReturnValue(null);
    abrir({
      ...DO_RIO,
      itens_do_recorte: {
        ...DO_RIO.itens_do_recorte,
        dados: [{ texto: 'Menção suspeita', quando: '2026-06-10', link: 'javascript:alert(1)' }],
      },
    });
    const dentro = await screen.findByText('Menção suspeita');

    await userEvent.click(dentro.closest('tr')!);

    expect(window.open).not.toHaveBeenCalled();
    expect(screen.queryByRole('link', { name: /Menção suspeita/ })).toBeNull();
    aberto.mockRestore();
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
