/** As configurações do CRM — o que as telas de agenda usam para existir.
 *
 *  ACESSOS SAIU DAQUI em 24/09/2026, e a saída é a razão de este comentário
 *  mudar. Quem entra na plataforma não é assunto do CRM: é da plataforma
 *  inteira, vale igualmente para o Score, e misturá-lo com os cadastros de
 *  agenda fazia a mesma tela responder a duas perguntas de donos diferentes.
 *  Agora mora em `PortalDaPlataforma`, no botão próprio.
 *
 *  INSTITUIÇÕES E CONTATOS, TEMAS E REPRESENTANTES AEGEA SAÍRAM DAQUI em
 *  30/09/2026, pela mesma razão: não são cadastro do CRM, são dado mestre que
 *  o CRM, o Score e o futuro Painel de Inteligência de Mercado leem
 *  igualmente — ficar só aqui dentro fazia parecer dono do CRM, que não é.
 *  Moraram juntos em `PortalDoCadastroCompartilhado`, com cartão próprio na
 *  Início — ver `Inicio.tsx` e `App.tsx`. Os componentes (`CadastroDeAssuntos`,
 *  `CadastroDePortaVozes`) continuam os mesmos, só mudaram de casa.
 *
 *  DICIONÁRIOS ESTÁ ESCONDIDO (a pedido do Jones, 30/09/2026), e não saiu:
 *  diferente dos três acima, não ganhou casa nova — só parou de aparecer
 *  aqui por enquanto. O componente, a aba e a rota continuam no código.
 *
 *  CONSULTAS E ALEGAÇÕES TAMBÉM ESTÁ ESCONDIDA (a pedido do Jones,
 *  10/11/2026), pela mesma razão e do mesmo jeito: só parou de aparecer como
 *  aba. O componente (`Alegacoes`), o tipo `Aba` e a rota continuam no
 *  código — só saiu de `ABAS`.
 *
 *  Por isso só Posicionamento aparece hoje — a biblioteca de referências.
 *
 *  Juntas num portal porque quem faz uma faz as outras, e porque a navegação do
 *  painel é sobre o CRM — quatro entradas lá teriam a mesma cara das telas de
 *  agenda, e não são.
 *
 *  A aba não é a barreira. Quem decide é o backend: os cadastros exigem
 *  `administra_dicionarios` e a rota responde 403 a quem não tem. Esconder é
 *  conveniência de tela.
 */

import { useState } from 'react';
import { Alegacoes } from '@/paginas/Alegacoes';
import { Dicionarios } from '@/paginas/Dicionarios';
import { Biblioteca } from '@/paginas/Biblioteca';

//: 'dicionarios' E 'alegacoes' CONTINUAM AQUI, sem entrada em `ABAS` — ver o
//: comentário acima sobre por que estão escondidas, e não removidas.
type Aba = 'biblioteca' | 'alegacoes' | 'dicionarios';

const ABAS: { id: Aba; rotulo: string }[] = [{ id: 'biblioteca', rotulo: 'Posicionamento' }];

export function PortalDoAdmin() {
  const [aba, definirAba] = useState<Aba>('biblioteca');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 26 }}>Administração</h1>
        <p style={{ fontSize: 13, color: 'var(--cinza-2)', marginTop: 4 }}>
          Configurações do CRM — a biblioteca de posicionamento.
        </p>
      </div>

      {/* `role="tablist"` e as setas do teclado NÃO são enfeite: sem eles, um
          grupo de botões é lido como botões soltos, e quem navega por teclado
          não descobre que existe uma segunda aba sem tabular por ela. */}
      <div
        role="tablist"
        aria-label="Seções da administração"
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
              aria-controls={`painel-${opcao.id}`}
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

      <div
        role="tabpanel"
        id={`painel-${aba}`}
        aria-labelledby={`aba-${aba}`}
        tabIndex={-1}
      >
        {/* MONTADA E DESMONTADA, e não escondida com `display: none`. Cada
            tela carrega a sua lista ao montar; mantida viva atrás da outra
            aba, ela mostraria dados de quando foi aberta. */}
        {aba === 'biblioteca' ? <Biblioteca /> : null}
        {aba === 'alegacoes' ? <Alegacoes /> : null}
        {aba === 'dicionarios' ? <Dicionarios /> : null}
      </div>
    </div>
  );
}
