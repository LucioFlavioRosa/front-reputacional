/** Os filtros da aba Lentes: a faixa azul de filtros rápidos do CRM dos
 *  Stakeholders (`FaixaDeFiltros`), CONGELADA logo abaixo do cabeçalho ao rolar.
 *
 *  SEM "FILTRO AVANÇADO", por pedido: só os rápidos. As dimensões que eram do
 *  avançado (UF, autor, o tema do fornecedor) continuam alcançáveis pela busca
 *  inteligente do cabeçalho, que sugere os valores de todas elas.
 *
 *  MESMA FAIXA, MESMO GATILHO, MESMA LISTA DE PÍLULAS do Painel: `FaixaDeFiltros`
 *  e `CampoSuspenso` reaproveitados direto, e não reconstruídos — quem já
 *  aprendeu a filtrar numa tela filtra igual na outra.
 *
 *  QUAIS FILTROS, E ONDE, MUDAM POR LENTE (`FILTROS_DAS_LENTES`): Imprensa
 *  filtra por concessionária, tier e sentimento, Sociedade digital por rede e
 *  perfil de quem fala, Clientes por concessionária. A barra só percorre a
 *  tabela — inclusive a ordem fixa dos valores e a cor do sentimento escolhido.
 *
 *  ESCOLHA ÚNICA POR CAMPO, e os campos se somam (E): escolher um veículo não
 *  implica tier nenhum, e clicar numa pílula já escolhida a desmarca — é como o
 *  servidor recebe (`FiltroDaLente`, um valor por campo).
 *
 *  CAMPO SEM OPÇÃO NO MÊS NÃO É DESENHADO: um seletor que abre vazio faz a
 *  pessoa concluir que o dado sumiu, quando a fonte nunca mandou o campo.
 */

import type { FiltroDaLente, OpcoesDeFiltroDaLente } from '@/api/cliente';
import { CampoSuspenso } from '@/componentes/CampoSuspenso';
import type { CampoDeFiltro } from '@/componentes/PainelDeFiltros';
import { FaixaDeFiltros } from '@/componentes/FaixaDeFiltros';
import { FILTROS_DAS_LENTES, ordenarValores, rotuloDoValor } from '@/dominio/filtrosDasLentes';
import type { DimensaoDaLente } from '@/dominio/filtrosDasLentes';
import { mesCurto } from '@/dominio/dossie';
import { ATALHOS_DA_JANELA, atalhoDaJanela, janelaDoAtalho } from '@/dominio/janelaDaJornada';
import type { Janela, MesDaSerie } from '@/dominio/janelaDaJornada';

/** O PERÍODO DA JORNADA, como filtro rápido (por pedido): é o MESMO estado da
 *  janela do gráfico — escolher "12M" aqui move a régua da Jornada, e arrastar a
 *  régua muda o que este campo mostra. */
export interface PeriodoDaJornada {
  meses: MesDaSerie[];
  janela: Janela;
  /** `null` volta ao padrão da Jornada (últimos 6 meses). */
  aoMudar: (janela: Janela | null) => void;
  /** A janela é a padrão — não há o que limpar. */
  padrao: boolean;
}

const PERSONALIZADO = 'personalizado';
//: OS NOMES CURTOS DOS ATALHOS, para a lista caber na faixa; a descrição longa
//: ("Do primeiro mês do ano…") fica no botão da Jornada.
const ROTULO_DO_ATALHO: Record<string, string> = {
  '3m': 'Últimos 3 meses',
  '6m': 'Últimos 6 meses',
  '12m': 'Últimos 12 meses',
  ano: 'Ano atual',
  tudo: 'Todo o histórico',
};

function campoDoPeriodo(periodo: PeriodoDaJornada): CampoDeFiltro {
  const { meses, janela } = periodo;
  const atalho = atalhoDaJanela(janela, meses);
  //: A JANELA ARRASTADA À MÃO não é atalho nenhum: aparece como item próprio,
  //: com os meses dela, para o campo nunca mentir sobre o que a Jornada mostra.
  const personalizada =
    !atalho && meses[janela.inicio] && meses[janela.fim]
      ? [
          {
            valor: PERSONALIZADO,
            rotulo: `${mesCurto(meses[janela.inicio].mes)} – ${mesCurto(meses[janela.fim].mes)}`,
          },
        ]
      : [];
  return {
    chave: 'periodo',
    rotulo: 'Período',
    itens: [
      ...personalizada,
      ...ATALHOS_DA_JANELA.map((item) => ({
        valor: item.chave,
        rotulo: ROTULO_DO_ATALHO[item.chave] ?? item.descricao,
      })),
    ],
    valorAtual: atalho ?? PERSONALIZADO,
    mostrarEscolhido: true,
    aoEscolher: (valor) => {
      if (valor === PERSONALIZADO || valor === atalho) return;
      periodo.aoMudar(janelaDoAtalho(valor as (typeof ATALHOS_DA_JANELA)[number]['chave'], meses));
    },
  };
}

/** ATIVO É QUALQUER CAMPO PREENCHIDO, perguntado ao próprio objeto — uma lista
 *  escrita à mão esqueceria o campo acrescentado depois. */
function filtroAtivo(filtro: FiltroDaLente): boolean {
  return Object.values(filtro).some(Boolean);
}

/** Um campo de escolha única: escolher de novo o que já estava ativo DESMARCA. */
function campoDa(
  dimensao: DimensaoDaLente,
  valores: string[],
  filtro: FiltroDaLente,
  definirFiltro: (filtro: FiltroDaLente) => void,
): CampoDeFiltro {
  const valorAtual = filtro[dimensao.chave];
  return {
    chave: dimensao.chave,
    rotulo: dimensao.rotulo,
    itens: ordenarValores(dimensao, valores).map((valor) => ({ valor, rotulo: rotuloDoValor(dimensao, valor) })),
    valorAtual,
    destaque: valorAtual ? dimensao.destaques?.[valorAtual] : undefined,
    aoEscolher: (valor) =>
      definirFiltro({ ...filtro, [dimensao.chave]: valorAtual === valor ? undefined : valor }),
  };
}

export function BarraDeFiltroDaLente({
  lente,
  filtro,
  definirFiltro,
  opcoes,
  periodo,
}: {
  lente: string;
  filtro: FiltroDaLente;
  definirFiltro: (filtro: FiltroDaLente) => void;
  opcoes: OpcoesDeFiltroDaLente | null;
  /** Presente, o primeiro campo da faixa é o período da Jornada. */
  periodo?: PeriodoDaJornada;
}) {
  const config = FILTROS_DAS_LENTES[lente] ?? { rapidos: [], avancados: [] };
  const comPeriodo = Boolean(periodo && periodo.meses.length >= 2);

  const comValores = (lista: DimensaoDaLente[]) =>
    lista
      .map((dimensao) => ({ dimensao, valores: opcoes?.[dimensao.de] ?? [] }))
      .filter(({ valores }) => valores.length > 0);
  const rapidos = comValores(config.rapidos);

  return (
    //: `display: contents`, E É O QUE FAZ A FAIXA CONGELAR. Ela já é
    //: `position: sticky`, mas o sticky só gruda DENTRO do pai — e o pai era este
    //: <div>, do tamanho da própria faixa: não havia espaço nenhum para ela
    //: acompanhar a rolagem. Sem caixa própria, o pai passa a ser a coluna da
    //: aba inteira, e a faixa desce junto até o fim da lente.
    <div className="sem-impressao" style={{ display: 'contents' }}>
      {rapidos.length || comPeriodo ? (
        <FaixaDeFiltros colada={false} compacta>
          {periodo && comPeriodo ? (
            <CampoSuspenso
              campo={campoDoPeriodo(periodo)}
              aoLimpar={periodo.padrao ? undefined : () => periodo.aoMudar(null)}
            />
          ) : null}
          {rapidos.map(({ dimensao, valores }) => (
            <CampoSuspenso
              key={dimensao.chave}
              campo={campoDa(dimensao, valores, filtro, definirFiltro)}
              aoLimpar={
                filtro[dimensao.chave]
                  ? () => definirFiltro({ ...filtro, [dimensao.chave]: undefined })
                  : undefined
              }
            />
          ))}
          {filtroAtivo(filtro) ? (
            <button
              type="button"
              onClick={() => definirFiltro({})}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--branco)',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                padding: '0 4px',
                textDecoration: 'underline',
                flexShrink: 0,
              }}
            >
              Limpar recorte
            </button>
          ) : null}
        </FaixaDeFiltros>
      ) : null}
    </div>
  );
}
