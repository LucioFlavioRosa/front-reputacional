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

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { MenuDoUsuario } from '@/componentes/MenuDoUsuario';
import type { Eu } from '@/dominio/tipos';
import { usePainel } from '@/estado/painel';
import { Botao } from '@/componentes/basicos';
import { BarraDeRecorte } from '@/componentes/BarraDeRecorte';
import { PainelDeFiltros } from '@/componentes/PainelDeFiltros';
import type { Destino } from '@/navegacao/rota';

//: CADA DESTINO RESPONDE UMA PERGUNTA.
//:
//: O criterio nao e "por qual eixo voce quer olhar", e sim "o que voce veio
//: fazer". Frente, situacao, resultado, porta-voz e interlocutor sao eixos da
//: MESMA tabela, e cada um e um filtro do recorte — nao um destino. (A tela
//: "Explorar", que os punha num seletor, saiu em 22/09/2026: o Painel ja
//: responde a mesma pergunta clicando no grafico.)
//:
//: O PAINEL E O PRIMEIRO. Ele responde "como estamos" — a pergunta que a
//: lideranca faz ao abrir, e a que da contexto para todas as outras: o
//: recorte se olha de uma vez, e todo clique nele filtra a propria tela.
//:
//: A CADEIA NAO E UM DESTINO: como aba, obrigaria a escolher QUAL cadeia antes
//: de poder olhar. Mora na linha da Base, que e onde a pergunta nasce.
//: A "SITUAÇÃO" (fila de exceções + leitura em palavras) e a "EXPLORAR"
//: (eixos num seletor) SAÍRAM em 22/09/2026: o Painel responde as duas
//: perguntas com um clique no gráfico. `/situacao` e `/explorar` caem na capa.
//:
//: "RELATÓRIOS EXECUTIVOS" RESPONDE "O QUE ACONTECEU, PRONTO PARA REPASSAR" —
//: o registro em si, em texto corrido, para quem vai copiar e colar num
//: e-mail ou apresentação. Diferente do Painel (números, gráficos) e da Base
//: (tabela para filtrar/exportar): aqui não tem filtro próprio nenhum, só a
//: escolha de semana ou mês. Ver `paginas/RelatoriosExecutivos.tsx`.
//: "SINAIS DE MERCADO" SAIU DA NAVEGAÇÃO em 24/09/2026, por pedido — a aba
//: vai passar por uma melhoria antes de voltar a aparecer. A `view` continua
//: registrada em `navegacao/rota.ts`, a página em `SinaisDeMercado.tsx` e o
//: backend intacto: quem já tinha o link (`/sinais`) ainda abre a tela, só
//: não há mais porta de entrada pelo menu.
//: CADA ÁREA LEVA A PRÓPRIA CONFIGURAÇÃO, na engrenagem ao lado do nome.
//:
//: Antes havia um botão "Administração" que juntava três naturezas: quem entra
//: na plataforma (Acessos), os cadastros que o CRM usa (Temas, Instituições,
//: Representantes) e os dicionários. E a régua do Score ficava noutro lugar
//: ainda, como aba de dentro dele. Quem procurava "onde mudo isto" tinha de
//: saber de antemão em qual dos dois lugares a resposta estava.
//:
//: Painel, Base e Preparar agenda apontam para a MESMA configuração porque são
//: a mesma área — o CRM. Relatórios não tem engrenagem: não há o que ajustar
//: nele, e uma engrenagem que abre uma tela vazia ensina a ignorar engrenagens.
interface ItemDoMenu {
  view: Destino;
  rotulo: string;
  /** A tela de configuração desta área, quando há uma. */
  configura?: Destino;
}

const NAVEGACAO: ItemDoMenu[] = [
  { view: 'painel', rotulo: 'Painel', configura: 'admin' },
  { view: 'base', rotulo: 'Base', configura: 'admin' },
  { view: 'preparar', rotulo: 'Preparar agenda', configura: 'admin' },
  { view: 'relatorios', rotulo: 'Relatórios Executivos' },
  { view: 'score', rotulo: 'Score Executivo', configura: 'config-score' },
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
export const NAVEGACAO_ADMINISTRATIVA: ItemDoMenu[] = [
  { view: 'plataforma', rotulo: 'Plataforma' },
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

  //: O RECORTE SOBREVIVE A TROCA DE TELA, e de propósito.
  //:
  //: Os destinos respondem perguntas diferentes sobre O MESMO recorte: limpar
  //: ao navegar seria perder o contexto no meio da leitura. Quem quer limpar
  //: tem o botão na barra.
  const navegar = irPara;

  //: PUBLICA A ALTURA REAL DO CABEÇALHO em `--altura-cabecalho`, para quem
  //: precisa colar algo embaixo dele num `position: sticky` próprio (a faixa
  //: fixa de filtros do Painel) — sem acoplar aquele componente à estrutura
  //: deste. Mede de novo a cada mudança de tamanho: a `BarraDeRecorte` quebra
  //: linha conforme o número de fichas do recorte, então a altura não é uma
  //: constante.
  const refDoCabecalho = useRef<HTMLElement>(null);
  useEffect(function publicarAlturaDoCabecalho() {
    const elemento = refDoCabecalho.current;
    if (!elemento) return;
    const observador = new ResizeObserver(([entrada]) => {
      const altura = entrada?.borderBoxSize?.[0]?.blockSize ?? entrada?.contentRect.height;
      if (altura) {
        document.documentElement.style.setProperty('--altura-cabecalho', `${Math.round(altura)}px`);
      }
    });
    observador.observe(elemento);
    return () => observador.disconnect();
  }, [naCapa]);

  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* NA CAPA NÃO HÁ CABEÇALHO NENHUM — nem as abas, nem a marca.
          A página abre na imagem com "O relacionamento institucional medido", e
          o único caminho para dentro é o cartão "CRM dos Stakeholders".

          O cabeçalho volta inteiro em qualquer outra tela, e é lá que a marca
          serve para alguma coisa: ela é o caminho de volta para a capa. */}
      {naCapa ? null : (
      <header
        ref={refDoCabecalho}
        className="sem-impressao"
        style={{
          // A FAIXA DE GRANDE ÁREA que o guia da marca pede: gradiente
          // azul-mar → azul-mar-sombra, com um brilho de turquesa-rio no
          // canto — a MESMA dupla que o hero do login usa, só que aqui é
          // permanente, em toda tela, em vez de aparecer só na entrada.
          // Sólida, e não translúcida: ela não precisa deixar nada passar por
          // baixo, porque agora ELA é a cor, não uma janela para o fundo.
          background:
            'radial-gradient(120% 220% at 100% 0%, rgba(23,227,203,0.32) 0%, transparent 48%),' +
            'linear-gradient(120deg, var(--azul-mar) 0%, var(--azul-mar-sombra) 100%)',
          boxShadow: '0 1px 0 rgba(255,255,255,0.14) inset, 0 4px 16px rgba(0,25,120,0.16)',
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
            {/* O ARQUIVO É AZUL-MAR sólido (a mesma cor do fundo do cabeçalho):
                sem o filtro ele desapareceria contra o próprio gradiente. O
                filtro converte o traço para branco preservando a
                transparência — mesma leitura do texto branco ao lado. */}
            <img
              src="/imagens/logo-aegea.png"
              alt="Aegea"
              style={{ height: 40, width: 'auto', filter: 'brightness(0) invert(1)' }}
            />
            <span style={{ textAlign: 'left', lineHeight: 1.2 }}>
              <span style={{ display: 'block', fontSize: 23, fontWeight: 700, color: 'var(--branco)' }}>
                CRM dos Stakeholders
              </span>
            </span>
          </button>

          {/* QUEBRA LINHA, e não rolagem — a rolagem horizontal escondia
              "Administração" sem nenhuma pista visual de que havia mais
              itens: a aba ficava cortada na borda (ex.: "Adn"), parecendo
              truncada, sem barra de rolagem visível para avisar. Quebrar
              linha garante que toda aba continua sempre visível; a altura do
              cabeçalho já se ajusta sozinha (`publicarAlturaDoCabecalho`,
              acima), o mesmo mecanismo que já existe para a `BarraDeRecorte`
              quebrar linha conforme o número de fichas do recorte. */}
          <nav className="cabecalho__nav" style={{ display: 'flex', flexWrap: 'wrap', gap: 2, flex: 1 }}>
            {[
              ...NAVEGACAO,
              // A entrada administrativa entra no fim, e só para quem
              // administra: é tela usada raramente, por poucas pessoas.
              // Misturá-la com as abas de análise faria todo mundo passar por
              // ela todo dia sem motivo.
              ...(administraAcessos ? NAVEGACAO_ADMINISTRATIVA : []),
            ].map((item) => {
              const { configura } = item;
              const ativo = view === item.view || view === configura;
              return (
                <span key={item.view} style={{ display: 'inline-flex', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => navegar(item.view)}
                  aria-current={ativo ? 'page' : undefined}
                  style={{
                    padding: '7px 12px',
                    borderRadius: 'var(--r-btn)',
                    border: 'none',
                    // INVERTIDO contra o fundo escuro: a aba ativa agora é a
                    // pastilha CLARA (era `--bg-trilho` sobre header branco) —
                    // a mesma lógica de contraste, só que os dois extremos
                    // trocaram de lugar.
                    background: ativo ? 'var(--branco)' : 'transparent',
                    color: ativo ? 'var(--azul-mar)' : 'rgba(255,255,255,0.78)',
                    fontSize: 15,
                    fontWeight: ativo ? 700 : 400,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.rotulo}
                </button>
                {/* A ENGRENAGEM ENTRA NA ORDEM DE TABULAÇÃO como controle
                    próprio, logo depois da área que ela configura: quem navega
                    por teclado encontra "ajustar isto" onde esperaria, e não
                    no fim do menu. */}
                {configura ? (
                  <button
                    type="button"
                    onClick={() => navegar(configura)}
                    aria-label={`Configurações de ${item.rotulo}`}
                    title={`Configurações de ${item.rotulo}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 26,
                      height: 26,
                      marginLeft: -4,
                      borderRadius: 'var(--r-btn)',
                      border: 'none',
                      background:
                        view === configura ? 'var(--branco)' : 'transparent',
                      color:
                        view === configura
                          ? 'var(--azul-mar)'
                          : 'rgba(255,255,255,0.6)',
                      fontSize: 14,
                      lineHeight: 1,
                      cursor: 'pointer',
                    }}
                  >
                    ⚙
                  </button>
                ) : null}
                </span>
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
                // INVERTIDO: o azul do botão primário sumiria contra o azul
                // do cabeçalho — os dois eram quase a mesma cor. Branco com
                // texto azul-mar é o mesmo contraste do botão de sempre, só
                // que virado do avesso para o fundo também estar virado.
                estilo={{ height: 36, background: 'var(--branco)', color: 'var(--azul-mar)' }}
              >
                Nova interação
              </Botao>
            ) : null}

            {/* Por último, e à direita de tudo: é onde a barra de todo sistema
                põe a conta, e contrariar isso faria a pessoa procurar. */}
            <MenuDoUsuario eu={eu} />
          </div>
        </div>

        {/* SEM `view !== 'inicio'` AQUI: fora da capa o cabeçalho é
            inteiro, e o TypeScript prova que `view` nunca é `'inicio'` neste
            ponto. Uma condição que não pode ser falsa é uma regra que parece
            existir e não existe. */}
        {/* O RECORTE SAIU DA GAVETA. Ver `BarraDeRecorte`. */}
        {/* O SCORE NÃO TEM RECORTE, e é a única tela de análise assim. Ele é
            mensal e da organização inteira: um "ISR filtrado por imprensa"
            teria peso de lente sem significado. Oferecer a barra ali seria
            pior que inútil — quem mexesse nela veria o número não mudar e
            concluiria que a tela está quebrada. O que o Score escolhe é o MÊS,
            e isso mora no cabeçalho da própria página. */}
        {view !== 'cadastro' && view !== 'score' ? (
          <div
            className="cabecalho__recorte"
            style={{ maxWidth: 1440, margin: '0 auto', padding: '0 32px 12px' }}
          >
            <BarraDeRecorte />
          </div>
        ) : null}
      </header>
      )}

      {/* FORA do `<header>` `position: sticky` de propósito: abrir esta
          seção muda de altura a cada clique, e um painel que expande DENTRO
          de um elemento fixo no topo infla o cabeçalho inteiro — empurrando
          ou cobrindo a tela abaixo dele. Aqui, no fluxo normal da página, ele
          só empurra o `<main>` para baixo, como qualquer bloco de conteúdo. */}
      {/* FORA da Administração também: a tela lista contas e permissões, não
          agendas — o Recorte não tem nada ali para filtrar. */}
      {!naCapa && view !== 'cadastro' && view !== 'admin' && view !== 'score' ? (
        // `width: '100%'` NÃO É REDUNDANTE com `maxWidth`: isto é filho direto
        // do `<div>` `flexDirection: column` do topo, e margem `auto` num
        // item flex SEM largura explícita suprime o `stretch` — o bloco
        // encolhe para o tamanho do conteúdo (aqui, só o botão "Filtros") e
        // fica centralizado sozinho no meio da tela, em vez de ocupar a
        // largura da coluna. Com `width: 100%`, ele estica primeiro e só
        // depois o `maxWidth` limita — o mesmo par que `<main>` já usa.
        <div style={{ width: '100%', maxWidth: 1440, margin: '0 auto', padding: '12px 32px 0' }}>
          <PainelDeFiltros view={view} />
        </div>
      ) : null}

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

      {/* RODAPÉ DISCRETO — "no plano de fundo", não uma barra de marca: texto
          pequeno e claro, só o bastante para quem procurar achar, sem
          competir com nada da tela acima. */}
      <footer
        className="sem-impressao"
        style={{
          textAlign: 'center',
          padding: '14px 32px',
          fontSize: 11,
          color: 'var(--texto-placeholder)',
        }}
      >
        Powered by Peers
      </footer>
    </div>
  );
}
