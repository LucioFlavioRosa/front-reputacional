/** O cadastro que o CRM, o Score e o futuro Painel de Inteligência de Mercado
 *  leem igualmente — fora do portal do CRM de propósito.
 *
 *  NASCEU EM 30/09/2026, puxando três abas de dentro de `PortalDoAdmin`:
 *  Instituições e Contatos, Temas e Representantes Aegea. As três são dado
 *  mestre, não cadastro de agenda — ficar dentro do portal do CRM fazia
 *  parecer dono delas, que não é. Cartão próprio na Início, endereço próprio
 *  (`/compartilhado`) — ver `Inicio.tsx` e `App.tsx`.
 *
 *  MESMO PADRÃO DE `PortalDoAdmin`: abas, e não entradas de menu, porque quem
 *  cadastra uma faz as outras, e a navegação principal (CRM ou Score) não é
 *  dona de nenhuma das três.
 *
 *  A aba não é a barreira. Quem decide é o backend: os cadastros exigem
 *  `administra_dicionarios` e a rota responde 403 a quem não tem. Esconder é
 *  conveniência de tela.
 */

import { useState } from 'react';
import { CadastroDeAssuntos } from '@/paginas/CadastroDeAssuntos';
import { CadastroDeInstituicoes } from '@/paginas/CadastroDeInstituicoes';
import { CadastroDePortaVozes } from '@/paginas/CadastroDePortaVozes';

type Aba = 'instituicoes' | 'assuntos' | 'porta_vozes';

//: A ORDEM SEGUE A DEPENDÊNCIA, e não o tamanho da tela.
//:
//: Assunto vem antes de porta-voz porque o segundo APONTA para o primeiro: o
//: porta-voz é autorizado por assunto. Cadastrar na ordem inversa obriga a
//: voltar — abrir Porta-vozes, descobrir que o assunto não existe, sair,
//: criar, voltar.
const ABAS: { id: Aba; rotulo: string }[] = [
  { id: 'instituicoes', rotulo: 'Instituições e Contatos' },
  { id: 'assuntos', rotulo: 'Temas' },
  { id: 'porta_vozes', rotulo: 'Representantes Aegea' },
];

export function PortalDoCadastroCompartilhado() {
  const [aba, definirAba] = useState<Aba>('instituicoes');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 26 }}>Cadastro compartilhado</h1>
        <p style={{ fontSize: 13, color: 'var(--cinza-2)', marginTop: 4 }}>
          Com quem a Aegea se relaciona, os temas que o painel consegue somar e
          quem fala pela Aegea — uma base só, lida pelo CRM e pelo Score.
        </p>
      </div>

      {/* `role="tablist"` e as setas do teclado NÃO são enfeite: sem eles, um
          grupo de botões é lido como botões soltos, e quem navega por teclado
          não descobre que existe uma segunda aba sem tabular por ela. */}
      <div
        role="tablist"
        aria-label="Seções do cadastro compartilhado"
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
        {aba === 'instituicoes' ? <CadastroDeInstituicoes /> : null}
        {aba === 'assuntos' ? <CadastroDeAssuntos /> : null}
        {aba === 'porta_vozes' ? <CadastroDePortaVozes /> : null}
      </div>
    </div>
  );
}
