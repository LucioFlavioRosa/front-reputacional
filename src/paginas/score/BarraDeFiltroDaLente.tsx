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

/** O MÊS DA SÍNTESE, como primeiro filtro rápido (pedido de 21/10/2026): no
 *  lugar de "Últimos 3 meses", a escolha do mês que a pessoa quer ver. É o
 *  MESMO mês da tela — escolher aqui é o mesmo que clicar no mês da Jornada. */
export interface MesDaSintese {
  /** Os meses medidos, `YYYY-MM-DD`. */
  meses: string[];
  mes: string;
  aoEscolher: (mes: string) => void;
}

function campoDoMes(mesDaSintese: MesDaSintese): CampoDeFiltro {
  //: DO MAIS RECENTE PARA O MAIS ANTIGO: é o mês de agora que se procura.
  const meses = [...new Set(mesDaSintese.meses)].sort().reverse();
  return {
    chave: 'mes',
    rotulo: 'Mês',
    itens: meses.map((mes) => ({ valor: mes, rotulo: mesCurto(mes) })),
    valorAtual: mesDaSintese.mes,
    mostrarEscolhido: true,
    aoEscolher: (valor) => {
      if (valor !== mesDaSintese.mes) mesDaSintese.aoEscolher(valor);
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
  mesDaSintese,
}: {
  lente: string;
  filtro: FiltroDaLente;
  definirFiltro: (filtro: FiltroDaLente) => void;
  opcoes: OpcoesDeFiltroDaLente | null;
  /** Presente, o primeiro campo da faixa é o mês da Síntese. */
  mesDaSintese?: MesDaSintese;
}) {
  const config = FILTROS_DAS_LENTES[lente] ?? { rapidos: [], avancados: [] };
  const comMes = Boolean(mesDaSintese && mesDaSintese.meses.length > 0);

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
      {rapidos.length || comMes ? (
        <FaixaDeFiltros colada={false} compacta>
          {mesDaSintese && comMes ? <CampoSuspenso campo={campoDoMes(mesDaSintese)} /> : null}
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
