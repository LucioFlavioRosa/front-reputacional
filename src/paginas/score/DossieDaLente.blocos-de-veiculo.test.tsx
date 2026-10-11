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

vi.mock('@/api/cliente', () => ({
  obterDossieDaLente: (...argumentos: unknown[]) => obterDossieDaLente(...argumentos),
  obterOpcoesDeFiltroDaLente: vi.fn(() => Promise.resolve(null)),
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
    evolucao: bloco({ tipo: 'barras_empilhadas', titulo: 'Evolução' }),
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

/** Monta a tela E ABRE A SÍNTESE EXECUTIVA.
 *
 *  OS GRÁFICOS DA LENTE NASCEM DENTRO DE UMA SEÇÃO FECHADA ("Síntese
 *  executiva" — `BlocoExpansivel`), e isso é de propósito: a tela abre com a
 *  Jornada e os atalhos, e quem quer os gráficos pede. Um teste que afirmasse
 *  os blocos sem abrir estaria afirmando o estado fechado, e passaria para
 *  SEMPRE — mesmo com a regra invertida, porque nada aparece de qualquer jeito.
 */
async function montarEAbrir(lente: string) {
  const resultado = montar(lente);
  const abrir = await screen.findByRole('button', { name: /Síntese executiva/ });
  await userEvent.click(abrir);
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

  it('e os blocos que valem em TODA lente continuam valendo', () => {
    //: A contraprova da regra: se alguém trocasse a condição por algo que
    //: esconde demais, estes dois cairiam junto e o teste acima não veria.
    expect(OS_BLOCOS).not.toContain('Drivers e riscos');
    expect(OS_BLOCOS).not.toContain('Temas mais falados');
  });
});
