/** O portal de quem administra a plataforma.
 *
 *  Quatro responsabilidades, e por isso quatro abas — não quatro entradas no
 *  menu:
 *
 *    Acessos            quem entra na plataforma, e até quando
 *    Instituições       com quem se conversa, e quem fala por elas
 *    Porta-vozes        quem fala pela Aegea, e sobre o quê
 *    Assuntos           o vocabulário que o painel consegue somar
 *
 *  As três últimas se encadeiam: o assunto define o que um porta-voz pode
 *  falar, e a instituição define quem pode representar a outra parte. Separadas
 *  em telas distintas, essa cadeia ficaria invisível.
 *
 *  Juntas num portal porque quem faz uma faz as outras, e porque a navegação do
 *  painel é sobre o CRM — quatro entradas lá teriam a mesma cara das telas de
 *  agenda, e não são.
 *
 *  A aba não é a barreira. Quem decide é o backend: os cadastros exigem
 *  `administra_dicionarios`, os acessos exigem `administra_acessos`, e as duas
 *  rotas respondem 403 a quem não tem. Esconder é conveniência de tela.
 */

import { useState } from 'react';
import { Acessos } from '@/paginas/Acessos';
import { CadastroDeAssuntos } from '@/paginas/CadastroDeAssuntos';
import { Biblioteca } from '@/paginas/Biblioteca';
import { CadastroDeInstituicoes } from '@/paginas/CadastroDeInstituicoes';
import { CadastroDePortaVozes } from '@/paginas/CadastroDePortaVozes';

type Aba = 'acessos' | 'assuntos' | 'biblioteca' | 'cadastros' | 'porta_vozes';

//: A ORDEM SEGUE A DEPENDÊNCIA, e não o tamanho da tela.
//:
//: Assunto vem antes de instituição e de porta-voz porque os dois APONTAM para
//: ele: o porta-voz é autorizado por assunto, e a agenda é somada por assunto.
//: Cadastrar na ordem inversa obriga a voltar — abrir Porta-vozes, descobrir
//: que o assunto não existe, sair, criar, voltar.
const ABAS: { id: Aba; rotulo: string; descricao: string }[] = [
  {
    id: 'acessos',
    rotulo: 'Acessos',
    descricao: 'Quem entra na plataforma e até quando.',
  },
  {
    id: 'assuntos',
    rotulo: 'Assuntos',
    descricao: 'O que o painel consegue somar — e o que cada porta-voz pode falar.',
  },
  {
    id: 'biblioteca',
    rotulo: 'Biblioteca',
    descricao:
      'O acervo oficial, por assunto — o que o porta-voz leva para a reunião.',
  },
  {
    id: 'cadastros',
    rotulo: 'Instituições',
    descricao: 'Com quem a Aegea conversa, e quem fala por cada instituição.',
  },
  {
    id: 'porta_vozes',
    rotulo: 'Porta-vozes',
    descricao: 'Quem fala pela Aegea, e sobre quais assuntos.',
  },
];

export function PortalDoAdmin({ euId }: { euId: string | null }) {
  const [aba, definirAba] = useState<Aba>('acessos');
  const atual = ABAS.find((a) => a.id === aba) ?? ABAS[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 26 }}>Administração</h1>
        <p style={{ fontSize: 13, color: 'var(--cinza-2)', marginTop: 4 }}>
          {atual.descricao}
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
          gap: 6,
          borderBottom: '1px solid var(--borda)',
          // Quatro abas nao cabem em telefone: rolam em vez de quebrar em duas
          // linhas, que faria a segunda parecer outro grupo.
          overflowX: 'auto',
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
        {/* MONTADA E DESMONTADA, e não escondida com `display: none`. A tela de
            acessos carrega a lista de pessoas ao montar; mantida viva atrás da
            outra aba, ela mostraria dados de quando foi aberta. */}
        {aba === 'acessos' ? <Acessos euId={euId} /> : null}
        {aba === 'biblioteca' ? <Biblioteca /> : null}
        {aba === 'cadastros' ? <CadastroDeInstituicoes /> : null}
        {aba === 'porta_vozes' ? <CadastroDePortaVozes /> : null}
        {aba === 'assuntos' ? <CadastroDeAssuntos /> : null}
      </div>
    </div>
  );
}
