/** O botão que revela o resto do ranking de veículos.
 *
 *  SAIU DE DENTRO DE `DossieDaLente.tsx` (23/10/2026) porque dois arquivos
 *  passaram a usá-lo. O estado de quantos aparecem mora em
 *  `listaDeVeiculos.ts` — separado porque hook não é componente, e o lint
 *  (`only-export-components`) cobra o arquivo que mistura os dois.
 */
/** O botão que abre o resto do ranking, e o degradê que diz que há resto.
 *
 *  O DEGRADÊ INVADE O RODAPÉ DA LISTA (`top` negativo) e dissolve no fundo
 *  do cartão: é ele que faz a lista parecer CORTADA em vez de terminada.
 *  Invade 10px, que é o `padding` de baixo da última linha da
 *  `ColunasEmpilhadas` — nunca a barra nem o número. Esconder dado para
 *  sugerir que há mais seria pagar o recado com o que a pessoa veio ler.
 *
 *  O ESPAÇO ACIMA DO BOTÃO É `paddingTop` DAQUI, e não `marginTop` do filho:
 *  `position: relative` NÃO cria um contexto de formatação de bloco, então a
 *  margem do primeiro filho em fluxo COLAPSAVA através deste wrapper e
 *  empurrava o wrapper inteiro 12px para baixo. O degradê, que se posiciona
 *  pela caixa deste elemento, começava 2px DEPOIS do fim da lista em vez de
 *  10px antes — não invadia nada, e o `pointerEvents: 'none'` guardava uma
 *  sobreposição que não existia. Achado da revisão do Codex (23/10/2026).
 *
 *  `pointerEvents: 'none'` NO DEGRADÊ, porque a linha que ele desbota é
 *  CLICÁVEL (clicar num veículo filtra os outros painéis). Sem isso, a faixa
 *  roubaria o clique da linha que ela só deveria desbotar.
 *
 *  ABERTA, NÃO EXISTE DEGRADÊ: não há nada para sugerir, e desbotar o fim de
 *  uma lista completa diria que ainda falta algo.
 *
 *  `sem-png sem-impressao` NO CONJUNTO, que são DUAS regras diferentes: o
 *  `BaixarPng` filtra por `sem-png`, e o `@media print` do `index.css` (:379)
 *  esconde por `sem-impressao`. Botão e degradê são da tela, não do dado — o
 *  contador antigo não tinha nenhuma das duas, e saía escrito "Mostrando 5 de
 *  10" dentro da imagem exportada E no papel. */
export function RevelarVeiculos({
  teto,
  podeAbrir,
  aberta,
  aoAlternar,
  controla,
  centralizado = false,
}: {
  teto: number;
  podeAbrir: boolean;
  aberta: boolean;
  aoAlternar: () => void;
  /** O `id` do container das linhas que este botão abre e fecha. */
  controla: string;
  /** O Termômetro por Veículos ocupa a largura inteira do cartão — a barra
   *  de cada veículo vai de ponta a ponta — e um botão encostado à esquerda
   *  ficava perdido no canto, sem relação visual com a lista acima. O Top
   *  veículos, ao lado, já nasce numa coluna estreita: ali encostado à
   *  esquerda já lê como "embaixo da lista". */
  centralizado?: boolean;
}) {
  if (!podeAbrir) return null;
  return (
    <div className="sem-png sem-impressao" style={{ position: 'relative', paddingTop: 12 }}>
      {aberta ? null : (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: -10,
            height: 30,
            background: 'linear-gradient(to bottom, transparent, var(--branco) 80%)',
            pointerEvents: 'none',
          }}
        />
      )}
      <div
        style={{
          //: ACIMA DO DEGRADÊ, não atrás: o botão vem depois dele no DOM e
          //: ganha contexto próprio, senão o degradê o lavaria junto com a
          //: lista — e o convite ficaria mais apagado que o que ele convida
          //: a abrir.
          position: 'relative',
          display: 'flex',
          justifyContent: centralizado ? 'center' : 'flex-start',
        }}
      >
        <button
          type="button"
          onClick={aoAlternar}
          aria-expanded={aberta}
          aria-controls={controla}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            border: '1px solid var(--borda)',
            borderRadius: 999,
            //: TRANSLÚCIDO, por pedido: o botão deixa ver a lista dissolvendo
            //: atrás dele, em vez de tapá-la com uma barra opaca.
            background: 'rgba(255, 255, 255, 0.72)',
            backdropFilter: 'blur(4px)',
            color: 'var(--azul-mar)',
            fontSize: 12.5,
            fontWeight: 700,
            cursor: 'pointer',
            lineHeight: 1.2,
          }}
        >
          {aberta ? 'Recolher' : `Ver todos os ${teto} veículos`}
          <span aria-hidden style={{ fontSize: 9, lineHeight: 1 }}>
            {aberta ? '▲' : '▼'}
          </span>
        </button>
      </div>
    </div>
  );
}
