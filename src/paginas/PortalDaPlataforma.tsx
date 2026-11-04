/** As configurações da plataforma inteira — o que não é de área nenhuma.
 *
 *  QUEM ENTRA NA PLATAFORMA NÃO É ASSUNTO DO CRM NEM DO SCORE. Acessos vale
 *  igualmente para os dois, e morava até 24/09/2026 dentro do portal de
 *  cadastros do CRM — ao lado de Temas e Instituições, que são vocabulário de
 *  agenda. A mesma tela respondia a duas perguntas de donos diferentes, e
 *  quem procurava "onde libero uma pessoa" tinha de saber que a resposta
 *  estava num menu chamado Administração, junto de coisas que não tinham nada
 *  a ver.
 *
 *  O PORTAL GANHOU COMPANHIA, e com ela a barra de abas e o título de seção que
 *  o comentário anterior deixava reservados: "Atualização das bases" responde
 *  quando cada base foi carregada e por quem. É da mesma natureza que acessos —
 *  atravessa o CRM e o Score, e quem pergunta é quem administra a plataforma.
 *
 *  A ORDEM É A DA FREQUÊNCIA, não a da importância: liberar gente é tarefa
 *  semanal, conferir se uma base está velha é eventual.
 *
 *  A aba não é a barreira: o backend exige `administra_acessos` nas duas e
 *  responde 403 a quem não tem. Esconder é conveniência de tela.
 */

import { useState } from 'react';
import { AtualizacaoDasBases } from '@/paginas/AtualizacaoDasBases';
import { GerenciamentoDePerfis } from '@/paginas/GerenciamentoDePerfis';

type Aba = 'perfis' | 'cargas';

const ABAS: { id: Aba; rotulo: string }[] = [
  { id: 'perfis', rotulo: 'Gerenciamento de perfis' },
  { id: 'cargas', rotulo: 'Atualização das bases' },
];

const ID_DO_PAINEL = 'painel-da-plataforma';

/** `Acessos` saiu daqui, e a tela nova a substitui inteira.
 *
 *  A antiga mostrava o acesso como ele é GUARDADO — um `select` com onze papéis
 *  de nome técnico, mais caixas para irrestrito, externo, frentes e unidades.
 *  A nova mostra as três camadas que quem libera uma pessoa de fato usa, e
 *  ABSORVEU prazo, externo e escopo num quarto bloco: deixá-los sem tela os
 *  devolveria ao `UPDATE` manual no banco, que é o que a tela antiga existia
 *  para evitar.
 */
export function PortalDaPlataforma({
  euId,
  mercadoLancado = false,
}: {
  euId: string | null;
  mercadoLancado?: boolean;
}) {
  const [aba, definirAba] = useState<Aba>('perfis');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 26 }}>Plataforma</h1>
        <p style={{ fontSize: 13, color: 'var(--cinza-2)', marginTop: 4 }}>
          O que vale para o painel inteiro — quem entra, e quando cada base foi
          carregada.
        </p>
      </div>

      {/* `role="tablist"` e as setas do teclado NÃO são enfeite: sem eles, um
          grupo de botões é lido como botões soltos, e quem navega por teclado
          não descobre que existe uma segunda aba sem tabular por ela. É o mesmo
          padrão do `PortalDoAdmin`. */}
      <div
        role="tablist"
        aria-label="Seções da plataforma"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          borderBottom: '1px solid var(--borda)',
        }}
      >
        {ABAS.map((opcao) => {
          const ativa = opcao.id === aba;
          return (
            <button
              key={opcao.id}
              role="tab"
              id={`aba-${opcao.id}`}
              aria-selected={ativa}
              // UM ID SÓ DE PAINEL, e não um por aba: só o painel ATIVO é
              // montado, então `aria-controls={`painel-${opcao.id}`}` na aba
              // inativa aponta para elemento que não existe no DOM — e um
              // `aria-controls` quebrado é pior que nenhum, porque o leitor de
              // tela anuncia uma relação e não acha o alvo. Aqui o painel tem
              // id fixo e todas as abas apontam para ele, que é o que a relação
              // de fato é: um painel cujo conteúdo troca.
              aria-controls={ID_DO_PAINEL}
              // Só a aba ATIVA é tabulável; as setas mudam de aba. É o padrão
              // que o leitor de tela anuncia como "aba 1 de 2", em vez de dois
              // botões sem relação entre si.
              tabIndex={ativa ? 0 : -1}
              onKeyDown={(evento) => {
                if (evento.key !== 'ArrowRight' && evento.key !== 'ArrowLeft') return;
                const passo = evento.key === 'ArrowRight' ? 1 : -1;
                const indice = ABAS.findIndex((a) => a.id === aba);
                const proxima = ABAS[(indice + passo + ABAS.length) % ABAS.length];
                definirAba(proxima.id);
                document.getElementById(`aba-${proxima.id}`)?.focus();
              }}
              onClick={() => definirAba(opcao.id)}
              style={{
                border: 'none',
                background: 'transparent',
                padding: '10px 14px',
                fontSize: 14,
                fontWeight: ativa ? 700 : 500,
                color: ativa ? 'var(--azul-mar)' : 'var(--cinza-3)',
                borderBottom: `2px solid ${ativa ? 'var(--azul-mar)' : 'transparent'}`,
                marginBottom: -1,
                cursor: 'pointer',
              }}
            >
              {opcao.rotulo}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={ID_DO_PAINEL} aria-labelledby={`aba-${aba}`} tabIndex={-1}>
        {/* MONTADA E DESMONTADA, e não escondida com `display: none`. Cada tela
            carrega a sua lista ao montar; mantida viva atrás da outra aba, a
            trilha mostraria as cargas de quando a aba foi aberta — e esta aba
            existe justamente para dizer o que é recente. */}
        {aba === 'perfis' ? (
          <GerenciamentoDePerfis euId={euId} mercadoLancado={mercadoLancado} />
        ) : null}
        {aba === 'cargas' ? <AtualizacaoDasBases /> : null}
      </div>
    </div>
  );
}
