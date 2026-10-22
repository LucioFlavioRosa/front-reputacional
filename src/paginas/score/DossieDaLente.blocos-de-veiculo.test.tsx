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

  it('o Top veículos e o Termômetro abrem em 5 e o contador sobe e desce de um em um', async () => {
    //: PEDIDO (21/10/2026, revisto no mesmo dia): as duas listas abriam
    //: sempre com os 10 veículos que o servidor manda, e a tela ficava
    //: comprida demais para quem só quer o resumo. Agora abrem em 5, e um
    //: contador com setinhas sobe até o teto que o servidor mandou e desce
    //: de volta — sem nunca passar de 5 para menos, nem existir "recolher
    //: tudo de uma vez" (a primeira versão tinha um reset direto; o pedido
    //: real era subir E descer de um em um).
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

    //: NO PONTO DE PARTIDA, a seta de baixo já nasce desabilitada — não existe
    //: "menos que 5".
    expect(within(topo).getByText('Veículo 5')).toBeInTheDocument();
    expect(within(topo).queryByText('Veículo 6')).toBeNull();
    expect(within(topo).getByRole('button', { name: 'Mostrar um veículo a menos' })).toBeDisabled();
    expect(within(termometro).getByText('Veículo 5')).toBeInTheDocument();
    expect(within(termometro).queryByText('Veículo 6')).toBeNull();

    //: OS DOIS CONTADORES, um por painel — cada um controla a própria
    //: contagem, sem travar os dois juntos.
    await userEvent.click(within(topo).getByRole('button', { name: 'Mostrar mais um veículo' }));
    expect(within(topo).getByText('Top 6 veículos')).toBeInTheDocument();
    expect(within(topo).getByText('Veículo 6')).toBeInTheDocument();
    expect(within(topo).getByRole('button', { name: 'Mostrar um veículo a menos' })).toBeEnabled();

    //: O TERMÔMETRO AINDA NÃO EXPANDIU: confirma que os dois painéis não
    //: compartilham a mesma contagem.
    expect(within(termometro).queryByText('Veículo 6')).toBeNull();

    await userEvent.click(within(termometro).getByRole('button', { name: 'Mostrar mais um veículo' }));
    expect(within(termometro).getByText('Veículo 6')).toBeInTheDocument();

    //: CHEGOU NO TOTAL QUE O SERVIDOR MANDOU (7, abaixo do teto de 10): a
    //: seta de subir desabilita, e não trava pedindo um 8º que não existe.
    await userEvent.click(within(topo).getByRole('button', { name: 'Mostrar mais um veículo' }));
    expect(within(topo).getByText('Veículo 7')).toBeInTheDocument();
    expect(within(topo).getByRole('button', { name: 'Mostrar mais um veículo' })).toBeDisabled();

    //: E A SETA DE DESCER TIRA UM DE CADA VEZ, não um reset direto para 5 —
    //: dois cliques tiram dois, não os sete inteiros de uma vez.
    await userEvent.click(within(topo).getByRole('button', { name: 'Mostrar um veículo a menos' }));
    expect(within(topo).getByText('Top 6 veículos')).toBeInTheDocument();
    expect(within(topo).getByText('Veículo 6')).toBeInTheDocument();
    expect(within(topo).queryByText('Veículo 7')).toBeNull();

    await userEvent.click(within(topo).getByRole('button', { name: 'Mostrar um veículo a menos' }));
    expect(within(topo).getByText('Top 5 veículos')).toBeInTheDocument();
    expect(within(topo).queryByText('Veículo 6')).toBeNull();
    expect(within(topo).getByRole('button', { name: 'Mostrar um veículo a menos' })).toBeDisabled();
  });
});
