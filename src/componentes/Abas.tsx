/** A régua de abas — só ela, sem os painéis.
 *
 *  SÓ A RÉGUA porque o que cada tela faz com o conteúdo escondido difere, e a
 *  diferença é deliberada: a administração MONTA E DESMONTA (a lista de
 *  pessoas precisa ser recarregada a cada volta), e o cadastro de agenda
 *  esconde com `display: none` (um upload em curso na outra aba morreria se o
 *  componente saísse do ar). Um componente que decidisse isso por elas
 *  quebraria uma das duas.
 *
 *  O TECLADO É O MOTIVO DE ISTO EXISTIR. Só a aba ativa é tabulável e as setas
 *  trocam de aba — é o que faz o leitor de tela anunciar "aba 1 de 2" em vez
 *  de dois botões sem relação entre si. É a parte que se escreve errado quando
 *  cada tela escreve a sua.
 */

export interface Aba<T extends string> {
  id: T;
  rotulo: string;
}

export function Abas<T extends string>({
  abas,
  ativa,
  aoTrocar,
  rotulo,
  prefixo = 'aba',
}: {
  abas: readonly Aba<T>[];
  ativa: T;
  aoTrocar: (id: T) => void;
  /** O que este grupo de abas divide, para quem ouve a tela. */
  rotulo: string;
  /** Distingue duas réguas na mesma página; entra nos `id` do DOM. */
  prefixo?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={rotulo}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        borderBottom: '1px solid var(--borda)',
      }}
    >
      {abas.map((opcao) => {
        const selecionada = opcao.id === ativa;
        return (
          <button
            key={opcao.id}
            type="button"
            role="tab"
            id={`${prefixo}-${opcao.id}`}
            aria-selected={selecionada}
            aria-controls={`painel-${opcao.id}`}
            tabIndex={selecionada ? 0 : -1}
            onKeyDown={(evento) => {
              if (evento.key !== 'ArrowRight' && evento.key !== 'ArrowLeft') return;
              const passo = evento.key === 'ArrowRight' ? 1 : -1;
              const indice = abas.findIndex((a) => a.id === ativa);
              const proxima = abas[(indice + passo + abas.length) % abas.length];
              aoTrocar(proxima.id);
              document.getElementById(`${prefixo}-${proxima.id}`)?.focus();
            }}
            onClick={() => aoTrocar(opcao.id)}
            style={{
              border: 'none',
              background: 'transparent',
              padding: '12px 18px',
              fontSize: 14,
              fontWeight: selecionada ? 700 : 500,
              color: selecionada ? 'var(--azul-mar)' : 'var(--cinza-3)',
              borderBottom: `2px solid ${selecionada ? 'var(--azul-mar)' : 'transparent'}`,
              marginBottom: -1,
              cursor: 'pointer',
            }}
          >
            {opcao.rotulo}
          </button>
        );
      })}
    </div>
  );
}
