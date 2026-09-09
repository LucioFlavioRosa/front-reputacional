/** Casca do aplicativo: marca, navegação, ações e a barra do recorte.
 *
 *  A CAPA (`inicio`) NÃO TEM CABEÇALHO — nem abas, nem marca, nem ações. Ela é
 *  a imagem com "O relacionamento institucional medido", e o caminho para
 *  dentro é o cartão "CRM dos Stakeholders". O cabeçalho inteiro aparece nas
 *  demais telas, e é nelas que a marca serve de volta para a capa.
 *
 *  Regras de navegação que o handoff fixa:
 *   - a nav é o único caminho para cada view;
 *   - ações (novo registro) são botões do header;
 *   - a marca volta para o Início;
 *   - clicar em "Painel" zera todos os filtros; as outras abas preservam.
 */

import type { ReactNode } from 'react';
import { MenuDoUsuario } from '@/componentes/MenuDoUsuario';
import type { Eu } from '@/dominio/tipos';
import { usePainel } from '@/estado/painel';
import { Botao } from '@/componentes/basicos';
import { BarraDeRecorte } from '@/componentes/BarraDeRecorte';
import type { Destino } from '@/navegacao/rota';

//: CINCO DESTINOS, E NAO OITO.
//:
//: Eram oito, e cinco deliam a MESMA tabela com um pivo diferente — Painel,
//: Frentes, Status, Resultado, Porta-vozes, Interlocutores. Nenhuma respondia
//: nada de ponta a ponta: para saber se a agenda de imprensa Tier 1 de agosto
//: acabou bem, era preciso passar por tres, e a memoria de quem lia virava
//: parte da interface.
//:
//: O criterio mudou: sai "por qual eixo voce quer olhar" e entra "o que voce
//: veio fazer". As cinco viraram o seletor de eixo de Explorar.
//:
//: O PAINEL VOLTOU, e a primeira versao desta reorganizacao errou ao tira-lo.
//: Os quatro destinos respondiam "o que precisa de mim", "quero aprofundar",
//: "quero o registro" e "quero contar a historia" — e nenhum respondia "com o
//: que este recorte se parece". Panorama e aprofundamento sao perguntas
//: diferentes: o primeiro se olha de uma vez, sem escolher eixo nenhum, e e
//: onde moram o mapa e as series no tempo que Explorar nao repoe.
//:
//: O PAINEL E O PRIMEIRO. Ele responde "como estamos" — a pergunta que a
//: lideranca faz ao abrir, e a que da contexto para todas as outras. A
//: Situacao vem logo depois, e responde "o que precisa de mim hoje": e a tela
//: de quem opera, e ela se le melhor depois de saber o tamanho do todo.
//:
//: A CADEIA nao esta aqui pelo mesmo motivo: ela foi uma aba por um dia, e
//: como destino obrigava a escolher QUAL cadeia antes de poder olhar. Mora na
//: linha da Base, que e onde a pergunta nasce.
const NAVEGACAO: { view: Destino; rotulo: string }[] = [
  { view: 'painel', rotulo: 'Painel' },
  { view: 'situacao', rotulo: 'Situação' },
  { view: 'explorar', rotulo: 'Explorar' },
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
//: "Administração", e não "Acessos": a entrada leva a um portal com QUATRO
//: abas — quem entra na plataforma, com quem a companhia conversa, quem fala
//: por ela, e sobre o quê. O rótulo antigo prometia um quarto do que há atrás
//: dele.
//:
//: A `view` continua `acessos` de propósito: é o que o histórico do navegador
//: guarda, e trocá-la quebraria os links que alguém já tenha.
export const NAVEGACAO_ADMINISTRATIVA: { view: Destino; rotulo: string }[] = [
  { view: 'admin', rotulo: 'Administração' },
];

export function Layout({
  view,
  irPara,
  eu,
  podeCriar,
  administraAcessos = false,
  children,
}: {
  view: Destino;
  irPara: (view: Destino) => void;
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
  children: ReactNode;
}) {
  //: So o esmaecimento durante o refetch — o resto do recorte mora na
  //: `BarraDeRecorte`.
  const { atualizando } = usePainel();

  //: A capa não renderiza cabeçalho. Ver o comentário sobre o `<header>`.
  //
  //  É `view === 'inicio'`, e não um estado próprio de "já entrou no CRM":
  //  estado separado poderia discordar da tela em que se está — cabeçalho
  //  visível na capa, ou capa sem saída — e nada os obrigaria a concordar.
  //  Aqui a pergunta "estou na capa?" tem uma resposta só.
  const naCapa = view === 'inicio';

  //: O RECORTE SOBREVIVE A TROCA DE TELA, e agora de propósito.
  //:
  //: Antes, entrar no Painel limpava o recorte — o que fazia sentido quando
  //: ele era "o ponto de partida". Com quatro destinos que respondem perguntas
  //: diferentes sobre O MESMO recorte, limpar ao navegar seria perder o
  //: contexto no meio da leitura. Quem quer limpar tem o botão na barra.
  const navegar = irPara;

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
        {/* O RECORTE SAIU DA GAVETA. Ver `BarraDeRecorte`. */}
        {view !== 'cadastro' ? (
          <div
            className="cabecalho__recorte"
            style={{ maxWidth: 1440, margin: '0 auto', padding: '0 32px 12px' }}
          >
            <BarraDeRecorte />
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
