/** O portal de quem administra a plataforma.
 *
 *  Seis responsabilidades, e por isso seis abas — não seis entradas no menu:
 *
 *    Acessos            quem entra na plataforma, e até quando
 *    Temas              o vocabulário que o painel consegue somar
 *    Posicionamento     a biblioteca de referências
 *    Instituições       com quem se conversa, e quem fala por elas
 *    Representantes Aegea  quem fala pela Aegea, e sobre o quê
 *    Dicionários        todo o resto do vocabulário — o que se edita e o
 *                       que é estrutura do modelo, com o motivo
 *
 *  Temas, Instituições e Representantes se encadeiam: o tema define o que um
 *  porta-voz pode falar, e a instituição define quem pode representar a outra
 *  parte. Separadas em telas distintas, essa cadeia ficaria invisível. A regra
 *  da plataforma — tudo que se mostra tem onde ser cadastrado — é o que
 *  fecha com a aba Dicionários.
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
import { Alegacoes } from '@/paginas/Alegacoes';
import { Dicionarios } from '@/paginas/Dicionarios';
import { Biblioteca } from '@/paginas/Biblioteca';
import { CadastroDeInstituicoes } from '@/paginas/CadastroDeInstituicoes';
import { CadastroDePortaVozes } from '@/paginas/CadastroDePortaVozes';

type Aba =
  | 'acessos'
  | 'assuntos'
  | 'biblioteca'
  | 'cadastros'
  | 'porta_vozes'
  | 'alegacoes'
  | 'dicionarios';

//: A ORDEM SEGUE A DEPENDÊNCIA, e não o tamanho da tela.
//:
//: Assunto vem antes de instituição e de porta-voz porque os dois APONTAM para
//: ele: o porta-voz é autorizado por assunto, e a agenda é somada por assunto.
//: Cadastrar na ordem inversa obriga a voltar — abrir Porta-vozes, descobrir
//: que o assunto não existe, sair, criar, voltar.
const ABAS: { id: Aba; rotulo: string }[] = [
  { id: 'acessos', rotulo: 'Acessos' },
  { id: 'assuntos', rotulo: 'Temas' },
  { id: 'biblioteca', rotulo: 'Posicionamento' },
  { id: 'cadastros', rotulo: 'Instituições' },
  { id: 'porta_vozes', rotulo: 'Representantes Aegea' },
  //: Depois de Posicionamento, e é a ordem da dependência de novo: apurar uma
  //: alegação é amarrá-la ao posicionamento que responde, e ele precisa
  //: existir antes.
  { id: 'alegacoes', rotulo: 'Consultas e alegações' },
  //: Por último: é o vocabulário que os outros usam, e quem chega aqui
  //: costuma vir de um filtro ou formulário que não tinha a opção.
  { id: 'dicionarios', rotulo: 'Dicionários' },
];

export function PortalDoAdmin({ euId }: { euId: string | null }) {
  const [aba, definirAba] = useState<Aba>('acessos');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 26 }}>Administração</h1>
        <p style={{ fontSize: 13, color: 'var(--cinza-2)', marginTop: 4 }}>
          Central de cadastro das informações utilizadas no painel — quem acessa,
          quem fala pela Aegea e pela outra parte, os temas e o acervo por trás
          de cada interação.
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
        {/* MONTADA E DESMONTADA, e não escondida com `display: none`. A tela de
            acessos carrega a lista de pessoas ao montar; mantida viva atrás da
            outra aba, ela mostraria dados de quando foi aberta. */}
        {aba === 'acessos' ? <Acessos euId={euId} /> : null}
        {aba === 'biblioteca' ? <Biblioteca /> : null}
        {aba === 'cadastros' ? <CadastroDeInstituicoes /> : null}
        {aba === 'porta_vozes' ? <CadastroDePortaVozes /> : null}
        {aba === 'assuntos' ? <CadastroDeAssuntos /> : null}
        {aba === 'alegacoes' ? <Alegacoes /> : null}
        {aba === 'dicionarios' ? <Dicionarios /> : null}
      </div>
    </div>
  );
}
