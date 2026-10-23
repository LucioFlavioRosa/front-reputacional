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

import { render, screen, waitFor } from '@testing-library/react';
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
//: PENDENTE POR PADRÃO (o bloco tem teste próprio), mas IÇADA para fora da
//: fábrica do `vi.mock` para um teste poder resolvê-la: é com o bloco
//: desenhado que se vê se o painel de tier aparece duas vezes.
const obterExploradorDeVeiculos = vi.fn((..._argumentos: unknown[]) => new Promise(() => {}));

vi.mock('@/api/cliente', () => ({
  obterDossieDaLente: (...argumentos: unknown[]) => obterDossieDaLente(...argumentos),
  obterRecorteDaLente: (...argumentos: unknown[]) => obterRecorteDaLente(...argumentos),
  obterOpcoesDeFiltroDaLente: vi.fn(() => Promise.resolve(null)),
  //: O CARD N1 › N2 › N3 E O MAPA têm teste próprio; aqui ficam carregando.
  obterExploradorDaLente: vi.fn(() => new Promise(() => {})),
  //: O EXPLORADOR DE VEÍCULOS também tem teste próprio
  //: (`ExploradorDeVeiculos.test.tsx`). O TÍTULO DO CARTÃO aparece mesmo
  //: pendente — ele é moldura —, e é por isso que `OS_BLOCOS` abaixo pode
  //: afirmá-lo.
  obterExploradorDeVeiculos: (...argumentos: unknown[]) =>
    obterExploradorDeVeiculos(...argumentos),
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
 *  Os painéis têm título próprio, escrito no componente. Afirmar o título do
 *  servidor ("Volume por tier", "Top veículos" como `bloco.titulo`) seria
 *  afirmar texto que não aparece em tela — o teste passaria ou falharia por
 *  motivo nenhum.
 *
 *  A LISTA MUDOU EM 23/10/2026 com o Explorador de veículos: antes eram dois
 *  cartões ("% Matérias por tier e Top veículos" e o termômetro), agora é UM
 *  cartão de três colunas. O que o teste prende não mudou — que a moldura é
 *  desenhada para Imprensa e Mercado, e só para elas.
 *
 *  E É O TÍTULO DO CARTÃO QUE ENTRA AQUI, não o das três colunas: o cartão
 *  desenha o título antes da resposta chegar (é moldura), e os nomes das
 *  colunas só existem COM dado. Como a rota fica pendente neste arquivo — o
 *  bloco tem teste próprio —, afirmar o nome das colunas aqui seria afirmar
 *  texto que esta montagem nunca produz.
 */
const OS_BLOCOS = ['Tier do veículo, top veículos e termômetro', 'Últimas matérias'];

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

  it('os três cartões de veículo deram lugar ao Explorador de veículos', async () => {
    //: OS TRÊS CARTÕES SAÍRAM (23/10/2026): a dimensão de veículo virou um
    //: bloco de três painéis que se filtram entre si NO NAVEGADOR, e os
    //: cartões independentes que respondiam ao filtro da TELA não existem
    //: mais — cada clique deles ia ao servidor e movia o dossiê inteiro.
    //:
    //: O QUE MORREU COM ELES, e tinha teste aqui: o contador de setinhas, o
    //: botão de revelar e a sublista "Top veículos Tier 1". Os dois primeiros
    //: foram para `ExploradorDeVeiculos.test.tsx`, que é onde vivem agora; a
    //: sublista deixou de existir, e guarda de regressão para código removido
    //: é ruído.
    obterDossieDaLente.mockResolvedValue(dossieCom('imprensa'));
    await montarEAbrir('imprensa');

    await waitFor(() => expect(screen.getAllByText('Últimas matérias').length).toBeGreaterThan(0));
    expect(screen.queryByText('% Matérias por tier e Top veículos')).toBeNull();
    expect(screen.queryAllByText(/veículos Tier 1/)).toEqual([]);
  });

  it('e a leitura de tier não aparece DUAS vezes', async () => {
    //: ACHADO DA REVISÃO DO CODEX (23/10/2026), que nenhum teste pegava: o
    //: servidor manda o painel "Tier do veículo × sentimento" em
    //: `dossie.paineis`, e a tela o desenhava num cartão próprio. Com o
    //: Explorador de veículos, cuja PRIMEIRA COLUNA é essa mesma leitura, a
    //: pessoa passou a ver tier duas vezes na mesma tela.
    //:
    //: O FIXTURE ESCONDIA ISSO com `paineis: []` — em produção aquela lista
    //: traz o painel. Por isso este teste o põe lá E resolve a rota do bloco:
    //: com o bloco pendente, a coluna não desenha e o defeito não aparece.
    const dossie = dossieCom('imprensa');
    dossie.paineis = [bloco({ tipo: 'barras_100', titulo: 'Tier do veículo × sentimento' })];
    obterDossieDaLente.mockResolvedValue(dossie);
    obterExploradorDeVeiculos.mockResolvedValue({
      lente: 'imprensa',
      mes: '2026-09',
      denominador: 10,
      grupos: [
        {
          tier: 'muito_relevante',
          veiculo: 'Folha',
          positivo: 1,
          neutro: 0,
          negativo: 0,
          peso_positivo: 1,
          peso_neutro: 0,
          peso_negativo: 0,
        },
      ],
    } as never);
    await montarEAbrir('imprensa');

    //: ESPERA A COLUNA DO BLOCO PINTAR, e não um prazo: afirmar a contagem
    //: antes de o bloco desenhar passaria sempre.
    await waitFor(() =>
      expect(screen.getAllByText('Tier do veículo × sentimento').length).toBeGreaterThan(0),
    );
    expect(screen.getAllByText('Tier do veículo × sentimento')).toHaveLength(1);
  });
});
