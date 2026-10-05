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

/** ATIVO É QUALQUER CAMPO PREENCHIDO, perguntado ao próprio objeto.
 *
 *  Era uma lista escrita à mão com os quatro campos de então, e é exatamente o
 *  tipo de lista que esquece o campo acrescentado depois: o recorte ficaria ativo
 *  e o botão de limpar não apareceria, deixando a pessoa presa num recorte que
 *  ela não sabe como desfazer. */
function filtroAtivo(filtro: FiltroDaLente): boolean {
  return Object.values(filtro).some(Boolean);
}

/** As dimensões da barra, na ordem em que aparecem.
 *
 *  UMA LINHA POR DIMENSÃO, e a barra as percorre: eram quatro blocos de JSX
 *  quase idênticos, e com as oito do padrão Aegea seriam oito — cento e sessenta
 *  linhas onde a única diferença entre elas é o nome do campo.
 *
 *  A ORDEM É A DO PACOTE para a lente que tem tudo: o que explica o assunto
 *  primeiro (tema, subtema), depois onde (UF), depois quem falou (perfil, autor),
 *  e por fim as de clipping (tier, veículo, atributo). Campo sem opção no mês não
 *  é desenhado, então cada lente mostra só as dela sem precisar saber de nenhuma
 *  regra por lente. */
const DIMENSOES: {
  chave: keyof FiltroDaLente;
  rotulo: string;
  de: keyof OpcoesDeFiltroDaLente;
  rotulos?: Record<string, string>;
}[] = [
  { chave: 'tema', rotulo: 'Tema', de: 'temas' },
  { chave: 'subtema', rotulo: 'Subtema', de: 'subtemas' },
  { chave: 'uf', rotulo: 'UF', de: 'ufs' },
  { chave: 'perfil_autor', rotulo: 'Perfil do autor', de: 'perfis' },
  { chave: 'autor', rotulo: 'Autor', de: 'autores' },
  { chave: 'tier', rotulo: 'Tier', de: 'tiers', rotulos: ROTULO_DO_TIER },
  { chave: 'veiculo', rotulo: 'Veículo', de: 'veiculos' },
  { chave: 'atributo', rotulo: 'Atributo', de: 'atributos' },
];

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
      {DIMENSOES.map(({ chave, rotulo, de, rotulos }) => {
        const valores = opcoes?.[de] ?? [];
        //: CAMPO VAZIO É PIOR QUE CAMPO AUSENTE: um seletor que abre sem opção
        //: nenhuma faz a pessoa concluir que o dado sumiu, quando a verdade é
        //: que aquela fonte nunca mandou o campo.
        if (!valores.length) return null;
        const valorAtual = filtro[chave];
        return (
          <CampoSuspenso
            key={chave}
            campo={campoDeEscolhaUnica(
              chave,
              rotulo,
              comoItens(valores, rotulos),
              valorAtual,
              (valor) => definirFiltro({ ...filtro, [chave]: valor }),
            )}
            aoLimpar={
              valorAtual
                ? () => definirFiltro({ ...filtro, [chave]: undefined })
                : undefined
            }
          />
        );
      })}
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
