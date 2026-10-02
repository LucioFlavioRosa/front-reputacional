/** O recorte da aba Lentes: tier, veículo, atributo e tema.
 *
 *  MESMA FAIXA, MESMO GATILHO, MESMA LISTA DE PÍLULAS do Painel (CRM) — a
 *  `FaixaDeFiltros` (degradê azul-mar → turquesa) e o `CampoSuspenso` (botão
 *  fechado que abre um painel de pílulas), os dois REAPROVEITADOS direto, e
 *  não reconstruídos: quem já aprendeu a filtrar numa tela filtra igual na
 *  outra. Uma versão anterior deste arquivo abria uma busca por texto em vez
 *  de pílulas, achando que veículo/atributo/tema teriam opções demais para
 *  pílula — mas `GrupoDeCampo` já resolve isso sozinho (mostra as 10
 *  primeiras com um "+N, expandir"), o mesmo mecanismo que o filtro de Tema
 *  do Painel já usa para uma lista bem maior que a nossa.
 *
 *  FICA ACIMA DA FAIXA GRADIENTE do destaque (a de `ComFaixaDoTopo`), e não
 *  dentro dela: é um recorte de TELA, não parte do que o destaque mostra —
 *  mexe no que entra na conta de todos os blocos abaixo (nota, KPIs,
 *  evolução, os dois painéis), e por isso pede uma posição que avise antes
 *  de a pessoa chegar na nota.
 *
 *  OS QUATRO SÃO INDEPENDENTES e DE ESCOLHA ÚNICA (não é multisseleção, ao
 *  contrário de "Filtro Áreas" do Painel): escolher um veículo não implica
 *  tier nenhum, e clicar numa pílula já escolhida a desmarca — mesmo padrão
 *  de `definirOuAlternar` em `PainelDeFiltros.tsx`.
 */

import type { FiltroDaLente, OpcoesDeFiltroDaLente } from '@/api/cliente';
import { CampoSuspenso } from '@/componentes/CampoSuspenso';
import type { CampoDeFiltro } from '@/componentes/PainelDeFiltros';
import { FaixaDeFiltros } from '@/componentes/FaixaDeFiltros';

const ROTULO_DO_TIER: Record<string, string> = {
  muito_relevante: 'Tier 1',
  relevante: 'Tier 2',
  menos_relevante: 'Tier 3',
};

function comoItens(valores: string[], rotulos?: Record<string, string>) {
  return valores.map((valor) => ({ valor, rotulo: rotulos?.[valor] ?? valor }));
}

/** Escolhe de novo o que já estava ativo para DESMARCAR — mesma regra de
 *  `definirOuAlternar` do Painel: sem isso, cada campo só ganharia valor,
 *  nunca voltaria para "Todos" clicando na própria pílula marcada. */
function campoDeEscolhaUnica(
  chave: string,
  rotulo: string,
  itens: { valor: string; rotulo: string }[],
  valorAtual: string | undefined,
  aoEscolher: (valor: string | undefined) => void,
): CampoDeFiltro {
  return {
    chave,
    rotulo,
    itens,
    valorAtual,
    aoEscolher: (valor) => aoEscolher(valorAtual === valor ? undefined : valor),
  };
}

function filtroAtivo(filtro: FiltroDaLente): boolean {
  return Boolean(filtro.tier || filtro.veiculo || filtro.atributo || filtro.tema);
}

export function BarraDeFiltroDaLente({
  filtro,
  definirFiltro,
  opcoes,
}: {
  filtro: FiltroDaLente;
  definirFiltro: (filtro: FiltroDaLente) => void;
  opcoes: OpcoesDeFiltroDaLente | null;
}) {
  return (
    <FaixaDeFiltros>
      <CampoSuspenso
        campo={campoDeEscolhaUnica(
          'tier',
          'Tier',
          comoItens(opcoes?.tiers ?? [], ROTULO_DO_TIER),
          filtro.tier,
          (tier) => definirFiltro({ ...filtro, tier }),
        )}
        aoLimpar={filtro.tier ? () => definirFiltro({ ...filtro, tier: undefined }) : undefined}
      />
      <CampoSuspenso
        campo={campoDeEscolhaUnica(
          'veiculo',
          'Veículo',
          comoItens(opcoes?.veiculos ?? []),
          filtro.veiculo,
          (veiculo) => definirFiltro({ ...filtro, veiculo }),
        )}
        aoLimpar={
          filtro.veiculo ? () => definirFiltro({ ...filtro, veiculo: undefined }) : undefined
        }
      />
      <CampoSuspenso
        campo={campoDeEscolhaUnica(
          'atributo',
          'Atributo',
          comoItens(opcoes?.atributos ?? []),
          filtro.atributo,
          (atributo) => definirFiltro({ ...filtro, atributo }),
        )}
        aoLimpar={
          filtro.atributo ? () => definirFiltro({ ...filtro, atributo: undefined }) : undefined
        }
      />
      <CampoSuspenso
        campo={campoDeEscolhaUnica(
          'tema',
          'Tema',
          comoItens(opcoes?.temas ?? []),
          filtro.tema,
          (tema) => definirFiltro({ ...filtro, tema }),
        )}
        aoLimpar={filtro.tema ? () => definirFiltro({ ...filtro, tema: undefined }) : undefined}
      />
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
  );
}
