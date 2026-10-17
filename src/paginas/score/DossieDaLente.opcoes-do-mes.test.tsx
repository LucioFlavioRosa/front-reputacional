// @vitest-environment jsdom

/** As opções do refinamento são do MÊS QUE O PAINEL MOSTRA.
 *
 *  O DEFEITO QUE ISTO PRENDE: `DossieDaLente` busca as opções de filtro para o
 *  mês DA TELA, e o painel de aprofundamento pode estar num mês ANTERIOR — é o
 *  que acontece ao clicar numa coluna da Evolução. As opções iam para lá do
 *  mesmo jeito, então o refinamento oferecia os valores de setembro dentro do
 *  painel de agosto: escolher uma concessionária que só existe em setembro
 *  devolvia "nenhum item", e as que existem só em agosto não apareciam.
 *
 *  Achado da revisão do Codex em 16/10/2026. Eu o havia DESCARTADO por ler a
 *  versão do arquivo anterior ao merge do #102, onde a prop ainda não existia.
 *
 *  A GUARDA É NA FIAÇÃO, que é onde o defeito estava: o `RecorteDaLente` é
 *  trocado por um espião que registra as props. Afirmar sobre os controles
 *  desenhados exigiria o recorte resolvido e mediria o `FaixaDoRecorte`, que já
 *  esconde dimensão sem valores — a pergunta aqui é outra: o que a tela ENTREGA
 *  ao painel.
 *
 *  A fixture é copiada da suíte de blocos de veículo de propósito: lá o
 *  `RecorteDaLente` é o de verdade (os testes dependem da promessa pendente),
 *  e `vi.mock` vale para o arquivo inteiro.
 */

import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Bloco, Dossie, Ficha } from '@/dominio/dossie';

const obterDossieDaLente = vi.fn();

const OPCOES = { unidade: ['Águas do Rio'], veiculo: ['Folha'] };

vi.mock('@/api/cliente', () => ({
  obterDossieDaLente: (...argumentos: unknown[]) => obterDossieDaLente(...argumentos),
  obterRecorteDaLente: vi.fn(() => new Promise(() => {})),
  obterOpcoesDeFiltroDaLente: vi.fn(() => Promise.resolve(OPCOES)),
  //: O CARD N1 › N2 › N3 E O MAPA têm teste próprio; aqui ficam carregando.
  obterExploradorDaLente: vi.fn(() => new Promise(() => {})),
}));

vi.mock('@/paginas/score/PainelDaJornada', () => ({
  PainelDaJornada: ({ titulo }: { titulo: string }) => <p>{titulo}</p>,
}));
vi.mock('@/paginas/score/consulta/ConsultaEmProfundidade', () => ({
  ConsultaEmProfundidade: () => <p>raiz do drill</p>,
}));

//: O ESPIÃO: registra com que `mes` e que `opcoes` o painel foi montado.
const montagens: { mes: string; opcoes: unknown }[] = [];
vi.mock('@/paginas/score/RecorteDaLente', () => ({
  RecorteDaLente: ({ mes, opcoes }: { mes: string; opcoes: unknown }) => {
    montagens.push({ mes, opcoes });
    return <p>painel de {mes}</p>;
  },
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
      legenda: ['Propositivo', 'Neutro', 'Reativo'],
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
      dados: [{ quando: '12/09', veiculo: 'Valor Econômico', sentimento: 'Propositivo' }],
    }),
    fatos: [],
    paineis: [],
    onde_esta_a_causa: [],
    sinais: [],
  };
}

/** Monta a tela e espera a Síntese Executiva com o dossiê.
 *
 *  A SÍNTESE DEIXOU DE SER UM BLOCO QUE SE ABRE (por pedido, como no CRM): é
 *  um título e os gráficos sempre à mostra. Espera-se o título e a Evolução, e
 *  não um prazo.
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

beforeEach(() => {
  window.history.replaceState(null, '', '/score/lentes');
});

afterEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, '', '/');
});

describe('as opções do refinamento e o mês do painel', () => {
  it('o painel de um mês ANTERIOR não recebe as opções do mês da tela', async () => {
    montagens.length = 0;
    obterDossieDaLente.mockResolvedValue(dossieCom('mercado'));
    const { container } = await montarEAbrir('mercado');

    await screen.findByText('Evolução');
    const colunas = container.querySelectorAll('[role="button"][aria-pressed]');
    expect(colunas.length).toBe(2);

    //: A PRIMEIRA COLUNA É 2026-08 e a tela está em 2026-09 (ver `montar`).
    await userEvent.click(colunas[0] as HTMLElement);

    const doMesAnterior = montagens.find((m) => m.mes === '2026-08');
    expect(doMesAnterior, 'o painel não abriu no mês da coluna').toBeTruthy();
    expect(doMesAnterior?.opcoes).toBeNull();
  });

  it('e o painel do MESMO mês da tela recebe', async () => {
    //: O CONTRAPESO, e é ele que impede a correção de ser "nunca manda opções":
    //: no caminho comum — abrir o painel do mês que está na tela — o
    //: refinamento tem de continuar existindo.
    montagens.length = 0;
    obterDossieDaLente.mockResolvedValue(dossieCom('mercado'));
    const { container } = await montarEAbrir('mercado');

    await screen.findByText('Evolução');
    const colunas = container.querySelectorAll('[role="button"][aria-pressed]');
    await userEvent.click(colunas[1] as HTMLElement);

    const doMesDaTela = montagens.find((m) => m.mes === '2026-09');
    expect(doMesDaTela, 'o painel não abriu no mês da tela').toBeTruthy();
    expect(doMesDaTela?.opcoes).toEqual(OPCOES);
  });
});
