/** Casca do aplicativo: marca, navegação, ações e a barra do recorte.
 *
 *  A CAPA (`inicio`) NÃO TEM CABEÇALHO — nem abas, nem marca, nem ações. Ela é
 *  a imagem com "O relacionamento institucional medido", e o caminho para
 *  dentro é o cartão "CRM dos Stakeholders". O cabeçalho inteiro aparece nas
 *  demais telas, e é nelas que a marca serve de volta para a capa.
 *
 *  Regras de navegação que o handoff fixa:
 *   - a nav é o único caminho para cada view;
 *   - ações (novo registro, gerar relatório) são botões do header;
 *   - a marca volta para o Início;
 *   - clicar em "Painel" zera todos os filtros; as outras abas preservam.
 */

import type { ReactNode } from 'react';
import { MenuDoUsuario } from '@/componentes/MenuDoUsuario';
import type { Eu } from '@/dominio/tipos';
import { usePainel } from '@/estado/painel';
import { resumirRecorte } from '@/dominio/resumo-do-recorte';
import { Botao } from '@/componentes/basicos';
import { numero } from '@/dominio/formato';

export type View =
  | 'inicio'
  | 'painel'
  | 'frentes'
  | 'status'
  | 'resultado'
  | 'portavozes'
  | 'interlocutores'
  | 'base'
  | 'cadastro'
  | 'acessos';

const NAVEGACAO: { view: View; rotulo: string }[] = [
  { view: 'inicio', rotulo: 'Início' },
  { view: 'painel', rotulo: 'Painel' },
  { view: 'frentes', rotulo: 'Frentes' },
  { view: 'status', rotulo: 'Status' },
  { view: 'resultado', rotulo: 'Resultado' },
  { view: 'portavozes', rotulo: 'Porta-vozes' },
  { view: 'interlocutores', rotulo: 'Interlocutores' },
  { view: 'base', rotulo: 'Base' },
];

/**
 * A aba de acessos fica fora da navegação principal.
 *
 * Não por segredo — o backend recusa quem não administra acessos —, mas porque
 * é uma tela de administração, usada raramente, por poucas pessoas. Misturá-la
 * com as abas de análise faria todo mundo passar por ela todo dia sem motivo.
 * Quem administra chega por `administra_acessos` no menu do usuário.
 */
export const NAVEGACAO_ADMINISTRATIVA: { view: View; rotulo: string }[] = [
  { view: 'acessos', rotulo: 'Acessos' },
];

export function Layout({
  view,
  irPara,
  aoGerarRelatorio,
  eu,
  podeCriar,
  administraAcessos = false,
  children,
}: {
  view: View;
  irPara: (view: View) => void;
  /**
   * Mostra a entrada de administração de acessos.
   *
   * Não é controle de acesso: o backend responde 403 para quem não pode, e a
   * tela chamaria a API do mesmo jeito se alguém forçasse a navegação. O que se
   * ganha é não mostrar a todo mundo uma porta que só alguns abrem.
   */
  /** Quem está logado. O menu da conta mostra papel, módulos e permissões. */
  eu: Eu | null;
  /** Se o papel permite registrar interações. Esconde a porta do cadastro.
   *
   *  OBRIGATÓRIA, sem valor padrão. Um padrão `false` seria fail-closed e
   *  esconderia um esquecimento: quem montasse o Layout sem passar a prop veria
   *  o botão sumir para todo mundo, sem nada acusar. Sem padrão, o TypeScript
   *  cobra na compilação — que é onde se quer descobrir.
   */
  podeCriar: boolean;
  administraAcessos?: boolean;
  aoGerarRelatorio: () => void;
  children: ReactNode;
}) {
  const { recorte, catalogo, filtrosAtivos, abrirDrawer, limparRecorte, total, atualizando } =
    usePainel();

  //: A capa não renderiza cabeçalho. Ver o comentário sobre o `<header>`.
  //
  //  É `view === 'inicio'`, e não um estado próprio de "já entrou no CRM":
  //  estado separado poderia discordar da tela em que se está — cabeçalho
  //  visível na capa, ou capa sem saída — e nada os obrigaria a concordar.
  //  Aqui a pergunta "estou na capa?" tem uma resposta só.
  const naCapa = view === 'inicio';

  const navegar = (destino: View) => {
    // Painel é o ponto de partida limpo: entrar nele descarta o recorte.
    if (destino === 'painel') limparRecorte();
    irPara(destino);
  };

  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* NA CAPA NÃO HÁ CABEÇALHO NENHUM — nem as abas, nem a marca.
          A página abre na imagem com "O relacionamento institucional medido", e
          o único caminho para dentro é o cartão "CRM dos Stakeholders".

          O cabeçalho volta inteiro em qualquer outra tela, e é lá que a marca
          serve para alguma coisa: ela é o caminho de volta para a capa. */}
      {naCapa ? null : (
      <header
        className="sem-impressao"
        style={{
          background: 'var(--branco)',
          borderBottom: '1px solid var(--borda)',
          position: 'sticky',
          top: 0,
          zIndex: 30,
        }}
      >
        <div
          className="cabecalho__linha"
          style={{
            maxWidth: 1440,
            margin: '0 auto',
            padding: '0 32px',
            height: 62,
            display: 'flex',
            alignItems: 'center',
            gap: 24,
          }}
        >
          <button
            type="button"
            onClick={() => irPara('inicio')}
            title="Voltar ao início"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
            }}
          >
            <span
              aria-hidden
              style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                background: 'var(--turquesa-rio)',
                display: 'block',
              }}
            />
            <span style={{ textAlign: 'left', lineHeight: 1.2 }}>
              <span
                style={{
                  display: 'block',
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  color: 'var(--cinza-2)',
                }}
              >
                AEGEA
              </span>
              <span style={{ display: 'block', fontSize: 14, fontWeight: 700 }}>
                Painel Reputacional
              </span>
            </span>
          </button>

          <nav className="cabecalho__nav" style={{ display: 'flex', gap: 2, flex: 1, overflowX: 'auto' }}>
            {[
              ...NAVEGACAO,
              // A entrada administrativa entra no fim, e só para quem
              // administra: é tela usada raramente, por poucas pessoas.
              // Misturá-la com as abas de análise faria todo mundo passar por
              // ela todo dia sem motivo.
              ...(administraAcessos ? NAVEGACAO_ADMINISTRATIVA : []),
            ].map((item) => {
              const ativo = view === item.view;
              return (
                <button
                  key={item.view}
                  type="button"
                  onClick={() => navegar(item.view)}
                  aria-current={ativo ? 'page' : undefined}
                  style={{
                    padding: '7px 12px',
                    borderRadius: 'var(--r-btn)',
                    border: 'none',
                    background: ativo ? 'var(--bg-trilho)' : 'transparent',
                    color: ativo ? 'var(--azul-mar)' : 'var(--cinza-3)',
                    fontSize: 13,
                    fontWeight: ativo ? 700 : 400,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.rotulo}
                </button>
              );
            })}
          </nav>

          <div
            className="cabecalho__acoes"
            style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}
          >
            <Botao aoClicar={aoGerarRelatorio}>Gerar relatório</Botao>

            {/* CRIAR É UMA FORMA DE EDITAR, e quem só lê não deve nem ver a
                porta. Antes o botão aparecia para todo mundo: a pessoa abria o
                formulário, preenchia os campos, e só descobria no salvar — com
                um 403 correto do backend e o trabalho perdido.

                Isto é conveniência de tela, não controle: quem forçar a
                navegação leva 403 do mesmo jeito, e a própria tela de cadastro
                também recusa. São duas camadas porque esconder o botão nunca
                foi proteção. */}
            {podeCriar ? (
              <Botao
                variante="primario"
                aoClicar={() => irPara('cadastro')}
                estilo={{ height: 36 }}
              >
                Novo registro
              </Botao>
            ) : null}

            {/* Por último, e à direita de tudo: é onde a barra de todo sistema
                põe a conta, e contrariar isso faria a pessoa procurar. */}
            <MenuDoUsuario eu={eu} />
          </div>
        </div>

        {/* `view !== 'inicio'` saiu daqui, e não por estilo: com o
            cabeçalho inteiro fora da capa, o TypeScript passou a provar que
            `view` nunca é `'inicio'` neste ponto, e acusou a comparação
            impossível. Uma condição que não pode ser falsa é uma regra que
            parece existir e não existe. */}
        {view !== 'cadastro' ? (
          <div
            className="cabecalho__recorte"
            style={{
              maxWidth: 1440,
              margin: '0 auto',
              padding: '0 32px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <Botao aoClicar={abrirDrawer} estilo={{ height: 32 }}>
              Filtros
              {filtrosAtivos > 0 ? (
                <span
                  className="tabular"
                  style={{
                    marginLeft: 7,
                    padding: '1px 6px',
                    borderRadius: 20,
                    background: 'var(--azul-mar)',
                    color: 'var(--branco)',
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {filtrosAtivos}
                </span>
              ) : null}
            </Botao>

            <span
              className="cabecalho__resumo"
              style={{
                fontSize: 12,
                color: 'var(--cinza-2)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                minWidth: 0,
              }}
            >
              {resumirRecorte(recorte, catalogo)}
            </span>

            <span
              className="tabular"
              style={{
                marginLeft: 'auto',
                fontSize: 12,
                color: 'var(--cinza-3)',
                flexShrink: 0,
              }}
            >
              {atualizando ? 'atualizando…' : `${numero(total)} ${total === 1 ? 'registro' : 'registros'}`}
            </span>

            {filtrosAtivos > 0 ? (
              <Botao variante="fantasma" aoClicar={limparRecorte} estilo={{ height: 32 }}>
                Limpar
              </Botao>
            ) : null}
          </div>
        ) : null}
      </header>
      )}

      {/* Durante o refetch o conteúdo anterior fica em tela, apenas mais
          apagado: sem salto de altura e sem piscar a cada filtro. */}
      <main
        className={naCapa ? 'area-principal area-principal--capa' : 'area-principal'}
        style={{
          flex: 1,
          maxWidth: 1440,
          width: '100%',
          margin: '0 auto',
        // O recuo do TOPO na capa é zerado por `.area-principal--capa` no
        // `index.css`, e não aqui. Tem de ser lá porque a regra de celular
        // usa `!important`, que vence estilo inline: feito daqui, o ajuste
        // funcionava no desktop e silenciosamente não no telefone.
        padding: '28px 32px 64px',
          opacity: atualizando ? 0.55 : 1,
          transition: 'opacity .12s',
        }}
      >
        {children}
      </main>
    </div>
  );
}
