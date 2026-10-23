// @vitest-environment jsdom

/** QUEM DESENHA OS BLOCOS DE VEÍCULO: a rosca de volume por tier, o par
 *  top/termômetro por veículo, e a lista de últimas matérias.
 *
 *  POR QUE ESTE ARQUIVO EXISTE: a regra era `dossie.codigo === 'imprensa'`,
 *  escrita em dois lugares da tela, e não tinha teste nenhum. O dono do produto
 *  pediu o modelo da Imprensa replicado no Mercado, e a reversão de uma regra
 *  sem teste é a que volta calada — basta alguém "simplificar" a condição.
 *
 *  E A REGRA VIVE EM DOIS REPOSITÓRIOS, que é o que a torna fácil de quebrar
 *  pela metade: o back decide se CALCULA (`LENTES_COM_VEICULO_E_TIER`, em
 *  `app/api/lentes.py`) e a tela decide se DESENHA A MOLDURA
 *  (`LENTES_COM_BLOCOS_DE_VEICULO`, aqui). Mexer num lado só dá tela com card
 *  vazio, ou servidor calculando para ninguém — nenhum dos dois quebra nada
 *  visivelmente, e é por isso que precisa de teste.
 *
 *  A MEDIDA QUE TROUXE O MERCADO está na declaração da constante: zero dos 10
 *  maiores veículos do Mercado estão no top 10 da Imprensa, e o tier quase se
 *  inverte (46,2% Tier 1 contra 10,7%).
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Bloco, Dossie, Ficha } from '@/dominio/dossie';

const obterDossieDaLente = vi.fn();
//: A ROTA DO APROFUNDAMENTO fica pendente de propósito: o teste quer provar que
//: o clique a CHAMA com o mês certo, não o que o painel desenha depois.
//: Os parâmetros declarados como resto, e não omitidos: sem eles o `tsc`
//: recusa o spread no `vi.mock` abaixo ("a spread argument must either have a
//: tuple type or be passed to a rest parameter") — e os testes passariam com o
//: tipo quebrado.
const obterRecorteDaLente = vi.fn((..._argumentos: unknown[]) => new Promise(() => {}));

vi.mock('@/api/cliente', () => ({
  obterDossieDaLente: (...argumentos: unknown[]) => obterDossieDaLente(...argumentos),
  obterRecorteDaLente: (...argumentos: unknown[]) => obterRecorteDaLente(...argumentos),
  obterOpcoesDeFiltroDaLente: vi.fn(() => Promise.resolve(null)),
  //: O CARD N1 › N2 › N3 E O MAPA têm teste próprio; aqui ficam carregando.
  obterExploradorDaLente: vi.fn(() => new Promise(() => {})),
}));

//: A Jornada e o drill saem do caminho: não são o assunto, e a Jornada busca
//: série própria.
vi.mock('@/paginas/score/PainelDaJornada', () => ({
  PainelDaJornada: ({ titulo }: { titulo: string }) => <p>{titulo}</p>,
}));
vi.mock('@/paginas/score/consulta/ConsultaEmProfundidade', () => ({
  ConsultaEmProfundidade: () => <p>raiz do drill</p>,
}));

import { DossieDaLente } from '@/paginas/score/DossieDaLente';

const FICHA: Ficha = {
  origem: 'planilha',
  fonte: 'Clipei',
  colunas: [],
  lacunas: [],
  exemplo: false,
  conceitos: [],
};

function bloco(parcial: Partial<Bloco>): Bloco {
  return {
    tipo: 'tabela',
    subtipo: null,
    titulo: 'Bloco',
    conclusao: null,
    dados: [],
    legenda: [],
    cores: [],
    colunas: [],
    recorta: null,
    coluna_do_link: null,
    ficha: FICHA,
    ...parcial,
  };
}

/** Um dossiê com os quatro blocos PREENCHIDOS, como o servidor passou a mandar
 *  para o Mercado. Com eles vazios o teste não distinguiria "a tela não desenha
 *  a moldura" de "o servidor não mandou dado" — e é a moldura que se testa aqui.
 */
function dossieCom(codigo: string): Dossie {
  return {
    codigo,
    nome: codigo === 'mercado' ? 'Mercado' : 'Imprensa',
    stakeholder: 'Investidores',
    mes: '2026-09',
    nota: 70,
    ns: 0.4,
    delta: 1,
    delta_versus: 'mes_anterior',
    recorte_filtrado: false,
    peso: 30,
    estimado: false,
    ausencia: null,
    fontes: ['clipei_investidores'],
    formula: '',
    kpis: [],
    ficha_do_destaque: FICHA,
    manchete: null,
    evolucao: bloco({
      tipo: 'barras_empilhadas',
      titulo: 'Evolução das matérias',
      //: A SÉRIE MEDIDA DO MERCADO, e com dado de verdade porque é dela que
      //: sai a COLUNA CLICÁVEL — sem linha não há coluna, e sem coluna o teste
      //: do clique não teria o que procurar.
      dados: [
        { mes: '2026-08', positivo: 144, neutro: 61, negativo: 11, sem_base: false },
        { mes: '2026-09', positivo: 63, neutro: 35, negativo: 13, sem_base: false },
      ],
      legenda: ['Positivo', 'Neutro', 'Negativo'],
    }),
    sinais_da_evolucao: [],
    volume_por_tier: bloco({
      tipo: 'rosca',
      titulo: 'Volume por tier',
      dados: [{ chave: 'muito_relevante', rotulo: 'Tier 1', total: 57 }],
    }),
    top_veiculos: bloco({
      tipo: 'barras_horizontais',
      titulo: 'Top veículos',
      //: O veículo nº 1 do Mercado na base real, e o 95º da Imprensa.
      dados: [{ rotulo: 'Valor Econômico', valor: 12 }],
    }),
    clima_por_veiculos: bloco({
      tipo: 'divergente_por_item',
      titulo: 'Termômetro por veículos',
      dados: [{ chave: 'Valor Econômico', rotulo: 'Valor Econômico', total: 12, score: 72 }],
    }),
    drivers_e_riscos: bloco({ tipo: 'barras_100', titulo: 'Drivers e riscos' }),
    temas_mais_falados: bloco({ tipo: 'barras_100', titulo: 'Temas mais falados' }),
    materias_recentes: bloco({
      titulo: 'Últimas matérias',
      subtipo: 'materias',
      dados: [{ quando: '12/09', veiculo: 'Valor Econômico', sentimento: 'Positivo' }],
    }),
    fatos: [],
    paineis: [],
    onde_esta_a_causa: [],
    sinais: [],
  };
}

/** Monta a tela e espera a Síntese Executiva.
 *
 *  A SÍNTESE DEIXOU DE SER UM BLOCO QUE SE ABRE (por pedido, como no CRM): é
 *  um título e os gráficos sempre à mostra. ESPERAR O TÍTULO E O DOSSIÊ, e não
 *  um prazo: afirmar ausência antes de a seção pintar passaria sempre.
 */
async function montarEAbrir(lente: string) {
  const resultado = montar(lente);
  await screen.findByRole('heading', { name: 'Síntese Executiva' });
  await screen.findAllByText('Evolução');
  return resultado;
}

function montar(lente: string) {
  return render(
    <DossieDaLente
      mes="2026-09"
      lente={lente}
      aoTrocarLente={vi.fn()}
      serie={[]}
      aoTrocarMes={vi.fn()}
      filtro={{}}
      definirFiltro={vi.fn()}
    />,
  );
}

/** OS TÍTULOS QUE A PESSOA LÊ, e não os que o servidor manda.
 *
 *  Os cartões têm título próprio, escrito no componente: a rosca e o top vêm
 *  num cartão só, chamado "% Matérias por tier e Top veículos", e o termômetro
 *  escreve "Veículos" com V maiúsculo. Afirmar o título do servidor ("Volume
 *  por tier", "Top veículos") seria afirmar texto que não aparece em tela — o
 *  teste passaria ou falharia por motivo nenhum.
 */
const OS_BLOCOS = [
  '% Matérias por tier e Top veículos',
  'Termômetro por Veículos',
  'Últimas matérias',
];

beforeEach(() => {
  window.history.replaceState(null, '', '/score/lentes');
});

afterEach(() => {
  vi.clearAllMocks();
  obterRecorteDaLente.mockImplementation(() => new Promise(() => {}));
  window.history.replaceState(null, '', '/');
});

describe('os blocos de veículo do dossiê', () => {
  it.each(['imprensa', 'mercado'])('são desenhados na lente %s', async (lente) => {
    obterDossieDaLente.mockResolvedValue(dossieCom(lente));
    await montarEAbrir(lente);
    for (const titulo of OS_BLOCOS) {
      //: `getAllByText`, e não `getByText`: "Últimas matérias" aparece duas
      //: vezes — o título do bloco amplo e o do bloco dentro dele —, e o
      //: singular reprovaria por ambiguidade em vez de por ausência.
      await waitFor(() => expect(screen.getAllByText(titulo).length).toBeGreaterThan(0));
    }
  });

  it.each(['sociedade', 'clientes', 'institucional'])(
    'NÃO são desenhados na lente %s, nem a moldura',
    async (lente) => {
      //: O servidor manda vazio para estas, mas aqui o dossiê vem PREENCHIDO de
      //: propósito: se a tela desenhasse pelo conteúdo em vez da regra, o teste
      //: passaria por acidente quando o servidor acertasse — e falharia em
      //: produção no dia em que ele mandasse qualquer coisa.
      obterDossieDaLente.mockResolvedValue(dossieCom(lente));
      await montarEAbrir(lente);

      //: ESPERA UM BLOCO QUE VALE EM TODA LENTE, e não um prazo: afirmar
      //: ausência antes de a seção pintar passaria sempre.
      //:
      //: `getAllByText` porque "Drivers e riscos" aparece duas vezes — o título
      //: do bloco e o do gráfico dentro dele.
      await waitFor(() =>
        expect(screen.getAllByText('Drivers e riscos').length).toBeGreaterThan(0),
      );
      for (const titulo of OS_BLOCOS) {
        expect(screen.queryAllByText(titulo)).toEqual([]);
      }
    },
  );

  it('a Evolução do MERCADO é o mesmo gráfico de barras da Imprensa', async () => {
    //: ELA ERA O EVENTOGRAMA, por uma premissa falsa: acreditava-se que a lente
    //: não tinha série mensal medida. Tem — 216 menções em agosto e 111 em
    //: setembro, e a Imprensa cobre exatamente os mesmos dois meses.
    //:
    //: O QUE ESTE TESTE PRENDE é a coluna clicável, que é a função do gráfico
    //: que a linha do tempo não tinha: clicar na barra abre o mês. Sem ela, a
    //: Evolução do Mercado seria só um desenho parecido.
    obterDossieDaLente.mockResolvedValue(dossieCom('mercado'));
    const { container } = await montarEAbrir('mercado');

    await waitFor(() => expect(screen.getAllByText('Evolução').length).toBeGreaterThan(0));

    //: A COLUNA CLICÁVEL SE RECONHECE PELO `aria-pressed`, e não pelo rótulo do
    //: mês: o atributo só é posto quando `aoClicarMes` chega ao gráfico
    //: (`BarrasEmpilhadas.tsx`), então a presença dele É a prova de que a função
    //: está ligada. O rótulo depende do formatador e o despejo do
    //: testing-library o trunca, o que fazia o teste falhar por motivo errado.
    const colunas = container.querySelectorAll('[role="button"][aria-pressed]');
    expect(colunas.length).toBe(2);

    //: E CLICAR TEM DE ABRIR O MÊS CLICADO, que é a função inteira — a marcação
    //: sozinha provaria só que o atributo está lá.
    //:
    //: A PROVA É A CHAMADA DA ROTA DO APROFUNDAMENTO com o mês: foi assim que
    //: descobri que o clique já funcionava (o teste quebrou porque
    //: `obterRecorteDaLente` não estava no mock). Afirmar texto do painel
    //: dependeria do que ele desenha enquanto carrega.
    await userEvent.click(colunas[1] as HTMLElement);
    await waitFor(() => expect(obterRecorteDaLente).toHaveBeenCalled());
    expect(obterRecorteDaLente.mock.calls[0]).toContain('2026-09');
  });

  it.each(['imprensa', 'mercado'])(
    'a %s não desenha Drivers e riscos nem Temas mais falados — o Explorador tomou o lugar',
    async (lente) => {
      //: O MERCADO ENTROU AQUI em 20/10/2026, por pedido de paridade visual com
      //: a Imprensa — mesmo motivo, mesma regra (ver `LENTES_SEM_DRIVERS` e
      //: `LENTES_COM_EXPLORADOR` em `DossieDaLente.tsx`).
      obterDossieDaLente.mockResolvedValue(dossieCom(lente));
      await montarEAbrir(lente);
      await waitFor(() => expect(screen.getAllByText('Últimas matérias').length).toBeGreaterThan(0));
      expect(screen.queryAllByText('Drivers e riscos')).toEqual([]);
      expect(screen.queryAllByText('Temas mais falados')).toEqual([]);
      expect(screen.getByText('Atributos, temas estratégicos e subtemas')).toBeTruthy();
    },
  );

  it('e os blocos que valem em TODA lente continuam valendo', () => {
    //: A contraprova da regra: se alguém trocasse a condição por algo que
    //: esconde demais, estes dois cairiam junto e o teste acima não veria.
    expect(OS_BLOCOS).not.toContain('Drivers e riscos');
    expect(OS_BLOCOS).not.toContain('Temas mais falados');
  });

  it('o Top veículos e o Termômetro abrem em 5 e um botão só revela todos', async () => {
    //: PEDIDO (21/10/2026, revisto em 23/10/2026): as duas listas abriam
    //: sempre com os 10 veículos que o servidor manda, e a tela ficava
    //: comprida demais para quem só quer o resumo. A primeira resposta foi um
    //: contador de setinhas (▲▼) que subia e descia de UM EM UM, e é essa
    //: que cai aqui: revelar o 10º custava cinco cliques, e o rótulo
    //: "Mostrando 5 de 10" não dizia que havia um segundo clique adiante.
    //: Agora é UM botão que alterna tudo de uma vez, com o número no próprio
    //: rótulo, e o degradê no rodapé da lista é quem diz "tem mais embaixo".
    const dossie = dossieCom('imprensa');
    const rotulos = Array.from({ length: 7 }, (_, indice) => `Veículo ${indice + 1}`);
    dossie.top_veiculos = {
      ...dossie.top_veiculos,
      dados: rotulos.map((rotulo) => ({ rotulo, positivo: 1, neutro: 0, negativo: 0 })),
    };
    dossie.clima_por_veiculos = {
      ...dossie.clima_por_veiculos,
      dados: rotulos.map((rotulo, indice) => ({
        chave: rotulo,
        rotulo,
        total: 1,
        score: 50 - indice,
      })),
    };
    obterDossieDaLente.mockResolvedValue(dossie);
    await montarEAbrir('imprensa');

    //: OS DOIS CARTÕES, scoped pela classe `cartao` — "Veículo 5" aparece nos
    //: dois ao mesmo tempo (Top e Termômetro), então uma busca sem escopo
    //: acharia dois e reprovaria por ambiguidade em vez de pela contagem.
    await waitFor(() => expect(screen.getByText('Top 5 veículos')).toBeInTheDocument());
    const topo = screen.getByText('% Matérias por tier e Top veículos').closest('.cartao') as HTMLElement;
    const termometro = screen.getByText('Termômetro por Veículos').closest('.cartao') as HTMLElement;

    //: NO PONTO DE PARTIDA: cinco veículos, e o botão DIZ QUANTOS HÁ — o
    //: número no rótulo é o que faltava no "Mostrando 5 de 10", que não
    //: avisava que existia uma segunda tela.
    expect(within(topo).getByText('Veículo 5')).toBeInTheDocument();
    expect(within(topo).queryByText('Veículo 6')).toBeNull();
    expect(within(topo).getByRole('button', { name: 'Ver todos os 7 veículos' })).toBeInTheDocument();
    expect(within(termometro).getByText('Veículo 5')).toBeInTheDocument();
    expect(within(termometro).queryByText('Veículo 6')).toBeNull();

    //: O BOTÃO APONTA PARA A LISTA QUE ELE ABRE (`aria-controls`), e o alvo
    //: tem de ser o container das LINHAS — não o cartão inteiro. Sem isto o
    //: leitor de tela anuncia "expandido" sem dizer o que foi expandido.
    const botaoDoTopo = within(topo).getByRole('button', { name: 'Ver todos os 7 veículos' });
    const alvo = botaoDoTopo.getAttribute('aria-controls');
    expect(alvo).toBeTruthy();
    const listaDoTopo = document.getElementById(alvo as string);
    expect(listaDoTopo).not.toBeNull();
    expect(within(listaDoTopo as HTMLElement).getByText('Veículo 5')).toBeInTheDocument();

    //: FORA DO PNG **E** DA IMPRESSÃO, que são duas regras diferentes: o
    //: `BaixarPng` filtra por `sem-png`, e o `@media print` do `index.css`
    //: esconde por `sem-impressao`. Ter só a primeira deixava o botão sair no
    //: papel — achado da revisão do Codex (23/10/2026).
    const blocoDoBotao = botaoDoTopo.closest('.sem-png');
    expect(blocoDoBotao).not.toBeNull();
    expect(blocoDoBotao).toHaveClass('sem-impressao');

    //: UM CLIQUE SÓ TRAZ O RESTO TODO — o 7º inclusive, que antes custava
    //: dois cliques depois do 6º.
    await userEvent.click(within(topo).getByRole('button', { name: 'Ver todos os 7 veículos' }));
    expect(within(topo).getByText('Top 7 veículos')).toBeInTheDocument();
    expect(within(topo).getByText('Veículo 6')).toBeInTheDocument();
    expect(within(topo).getByText('Veículo 7')).toBeInTheDocument();

    //: O TERMÔMETRO AINDA NÃO ABRIU: confirma que os dois painéis não
    //: compartilham o mesmo estado.
    expect(within(termometro).queryByText('Veículo 6')).toBeNull();

    await userEvent.click(within(termometro).getByRole('button', { name: 'Ver todos os 7 veículos' }));
    expect(within(termometro).getByText('Veículo 7')).toBeInTheDocument();

    //: E O MESMO BOTÃO FECHA, voltando ao ponto de partida de uma vez — não
    //: existe mais um caminho de volta de dois cliques por veículo.
    await userEvent.click(within(topo).getByRole('button', { name: 'Recolher' }));
    expect(within(topo).getByText('Top 5 veículos')).toBeInTheDocument();
    expect(within(topo).queryByText('Veículo 6')).toBeNull();
    expect(within(topo).getByRole('button', { name: 'Ver todos os 7 veículos' })).toBeInTheDocument();

    //: O TERMÔMETRO SEGUE ABERTO depois de o vizinho fechar.
    expect(within(termometro).getByText('Veículo 7')).toBeInTheDocument();
  });

  it('e sem segunda tela para revelar não existe botão nenhum', async () => {
    //: COM 5 OU MENOS VEÍCULOS NO MÊS não há o que abrir, e um botão "Ver
    //: todos os 4" que não muda nada é pior que nenhum botão. Era a mesma
    //: guarda do contador antigo (`teto <= inicial`), e ela continua.
    const dossie = dossieCom('imprensa');
    const rotulos = Array.from({ length: 4 }, (_, indice) => `Veículo ${indice + 1}`);
    dossie.top_veiculos = {
      ...dossie.top_veiculos,
      dados: rotulos.map((rotulo) => ({ rotulo, positivo: 1, neutro: 0, negativo: 0 })),
    };
    dossie.clima_por_veiculos = {
      ...dossie.clima_por_veiculos,
      dados: rotulos.map((rotulo, indice) => ({ chave: rotulo, rotulo, total: 1, score: 50 - indice })),
    };
    obterDossieDaLente.mockResolvedValue(dossie);
    await montarEAbrir('imprensa');

    await waitFor(() => expect(screen.getByText('Top 4 veículos')).toBeInTheDocument());
    const topo = screen.getByText('% Matérias por tier e Top veículos').closest('.cartao') as HTMLElement;
    const termometro = screen.getByText('Termômetro por Veículos').closest('.cartao') as HTMLElement;
    expect(within(topo).queryByRole('button', { name: /Ver todos/ })).toBeNull();
    expect(within(termometro).queryByRole('button', { name: /Ver todos/ })).toBeNull();
  });

  it('e o ranking de Tier 1 abre pelo mesmo botão', async () => {
    //: O BLOCO DO TIER 1 NÃO TINHA TESTE NENHUM — achado da revisão do Codex
    //: (23/10/2026). Ele é o único dos três onde o controle é ligado por um
    //: OBJETO inteiro (`veiculosDoTier1`, erguido no topo do componente porque
    //: o quadro vive dentro de um `.map()`), e não por props soltas: era a
    //: ligação mais fácil de errar em silêncio, porque nenhum teste passava
    //: por este caminho.
    const dossie = dossieCom('imprensa');
    const rotulos = Array.from({ length: 7 }, (_, indice) => `Tier1 ${indice + 1}`);
    //: O TÍTULO É A CHAVE: a tela acha este painel por igualdade exata com
    //: 'Tier do veículo × sentimento' (com o × de multiplicação, não um "x"),
    //: e é essa string que liga o ranking ao quadro.
    dossie.paineis = [bloco({ tipo: 'barras_100', titulo: 'Tier do veículo × sentimento' })];
    dossie.veiculos_tier1 = bloco({
      tipo: 'barras_horizontais',
      titulo: 'Veículos Tier 1',
      dados: rotulos.map((rotulo) => ({ rotulo, positivo: 1, neutro: 0, negativo: 0 })),
    });
    obterDossieDaLente.mockResolvedValue(dossie);
    await montarEAbrir('imprensa');

    await waitFor(() => expect(screen.getByText(/Top 5 veículos Tier 1/)).toBeInTheDocument());
    const cartao = screen.getByText(/Top 5 veículos Tier 1/).closest('.cartao') as HTMLElement;
    expect(within(cartao).getByText('Tier1 5')).toBeInTheDocument();
    expect(within(cartao).queryByText('Tier1 6')).toBeNull();

    await userEvent.click(within(cartao).getByRole('button', { name: 'Ver todos os 7 veículos' }));
    expect(within(cartao).getByText(/Top 7 veículos Tier 1/)).toBeInTheDocument();
    expect(within(cartao).getByText('Tier1 7')).toBeInTheDocument();

    await userEvent.click(within(cartao).getByRole('button', { name: 'Recolher' }));
    expect(within(cartao).getByText(/Top 5 veículos Tier 1/)).toBeInTheDocument();
    expect(within(cartao).queryByText('Tier1 6')).toBeNull();
  });
});
