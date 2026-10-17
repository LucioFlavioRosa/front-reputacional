/** Login — uma porta: o SSO da Microsoft.
 *
 *  ERAM DUAS ATÉ A MIGRATION 0096. A outra era e-mail com senha, e existia
 *  para quem não está no Entra ID — agência, consultor, alguém de investida
 *  ainda não integrada. Ela saiu inteira: a coluna `usuario.senha_hash`, a rota
 *  `POST /api/auth/senha` e este formulário.
 *
 *  QUEM NÃO ESTÁ NO ENTRA ID agora não entra. É a consequência da decisão, e
 *  está dita na tela: o acesso passa a ser concedido pela coordenação, que
 *  precisa pôr a pessoa no diretório antes.
 *
 *  `SSO_LIGADO` CONTINUA, e não é resquício: ele desenha o botão apagado com
 *  um aviso em vez de escondê-lo. Com uma porta só, desligá-lo deixa a tela sem
 *  nenhuma entrada — o que é a verdade daquele estado, e é melhor dizê-la do
 *  que mostrar um botão que não leva a lugar nenhum sem explicação.
 *
 *  A decisão entre "seguir para o painel" e "sair para o SSO" mora em
 *  `entrada.ts`, fora do componente, porque é lá que ela pode ser testada.
 */

import { OndaDoHero } from '@/componentes/Onda';
import { entrarNoPainel } from '@/dominio/entrada';

/** O SSO volta trocando isto para `true`. Nada mais precisa mudar aqui. */
const SSO_LIGADO = true;

/** Os três módulos da plataforma, na ordem em que a capa os apresenta. */
const MODULOS = [
  { nome: 'CRM dos Stakeholders', estado: 'Disponível' },
  { nome: 'KPIs Reputacionais', estado: 'Disponível' },
  { nome: 'Painel de Inteligência de Mercado', estado: 'Em construção' },
];

/** A rota que a pessoa estava tentando abrir, para o SSO devolvê-la ali.
 *
 *  O `App` pinta esta tela sem mexer na URL quando não há sessão (`if
 *  (!autenticado) return <Login …>`), então o endereço do navegador AINDA é o
 *  que ela pediu. Quem recebeu um link do dossiê de outubro e caiu no login
 *  voltava para a home e tinha de procurar a tela de novo — achado de revisão
 *  de 08/10/2026, de carona na correção que trocou o destino padrão de
 *  `/painel` para `/`.
 *
 *  RELATIVO, e é condição: o backend recusa destino absoluto (`_destino_seguro`
 *  em `app/api/acesso.py`), porque aceitá-lo seria redirecionamento aberto.
 *  `pathname` + `search` nunca traz origem, então a recusa não é alcançada.
 */
function destinoAtual(): string {
  return window.location.pathname + window.location.search;
}

export function Login({
  aoEntrar,
  carregando = false,
  erro = null,
}: {
  /**
   * Tenta confirmar a sessão. `true` se já havia uma.
   *
   * O retorno existe porque este componente precisa DECIDIR entre duas coisas
   * bem diferentes: seguir para o painel, ou mandar o navegador embora para o
   * SSO. Sem ele, o modo de desenvolvimento entraria e seria redirecionado na
   * sequência, perdendo a tela que acabou de abrir.
   */
  aoEntrar: () => Promise<boolean>;
  carregando?: boolean;
  /** Falha ao confirmar a sessão. Aparece aqui, e não na tela seguinte. */
  erro?: string | null;
}) {
  //: OCUPADO ENQUANTO O APP CONFERE a sessão, e não quando há erro: com erro
  //: na tela a pessoa precisa poder tentar de novo. Era a mesma regra do
  //: `ocupado` do formulário que saiu.
  const ativando = carregando && !erro;

  return (
    <div className="entrada">
      <aside
        className="entrada__arte"
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          color: 'var(--branco)',
          // O véu escuro NÃO é enfeite: a água é clara, e sobre ela o texto
          // branco ficava abaixo do mínimo de contraste da WCAG. O gradiente da
          // marca por cima resolve as duas coisas — legibilidade e identidade.
          backgroundImage:
            'linear-gradient(160deg, rgba(0,39,189,0.90) 0%, rgba(0,39,189,0.58) 46%, rgba(0,49,44,0.68) 100%), url(/imagens/entrada-agua.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div>
          <div
            className="kicker"
            style={{ color: 'var(--turquesa-sombra)', letterSpacing: '0.12em' }}
          >
            Aegea · Reputação
          </div>
          <h1
            className="entrada__titulo"
            style={{
              fontSize: 40,
              lineHeight: 1.08,
              marginTop: 14,
              maxWidth: '16ch',
              textShadow: '0 2px 18px rgba(0,25,120,0.45)',
              // O h1 global agora nasce azul-mar — aqui ele está DENTRO do
              // hero azul, então precisa reafirmar o branco por conta própria.
              color: 'var(--branco)',
            }}
          >
            O relacionamento institucional{' '}
            <span className="destaque" style={{ color: 'var(--turquesa-rio)' }}>
              medido
            </span>
          </h1>
        </div>

        <div className="entrada__numeros" style={{ display: 'grid', gap: 10, maxWidth: 380 }}>
          {MODULOS.map((modulo) => (
            <div
              key={modulo.nome}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                padding: '11px 14px',
                borderRadius: 'var(--r-card-int)',
                background: 'rgba(255,255,255,0.10)',
                border: '1px solid rgba(255,255,255,0.16)',
                fontSize: 13,
              }}
            >
              <span style={{ fontWeight: 700 }}>{modulo.nome}</span>
              <span style={{ fontSize: 11, opacity: 0.82, whiteSpace: 'nowrap' }}>
                {modulo.estado}
              </span>
            </div>
          ))}
        </div>

        <OndaDoHero />
      </aside>

      <main
        className="entrada__forma"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          // O recuo encolhe no celular por `index.css`, e não aqui: 32px de
          // cada lado são 16% de uma tela de 390px, e o formulário ficava
          // espremido contra as bordas.
          padding: '44px 32px',
          background: 'var(--bg-app)',
        }}
      >
        <div style={{ width: '100%', maxWidth: 360 }}>
          <div className="kicker" style={{ color: 'var(--cinza-2)' }}>
            Entrar
          </div>
          <h2 style={{ fontSize: 24, marginTop: 8 }}>CRM dos Stakeholders</h2>
          <p
            style={{
              fontSize: 13,
              color: 'var(--cinza-3)',
              marginTop: 8,
              lineHeight: 1.6,
            }}
          >
            Use a conta corporativa da Aegea. Se você é de fora e recebeu um
            acesso, entre com e-mail e senha.
          </p>

          {/* ACIMA DO BOTÃO, e não abaixo: é aqui que a recusa do `/auth/callback`
              chega, e quem volta do SSO olha para o topo do cartão. Eram dois
              caminhos de entrada até a 0096, e a caixa já ficava acima dos dois
              pelo mesmo motivo. */}
          {erro ? (
            <div
              role="alert"
              style={{
                marginTop: 18,
                padding: '10px 12px',
                borderRadius: 'var(--r-card-int)',
                background: 'var(--erro-bg)',
                color: 'var(--erro-fg)',
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              {erro}
            </div>
          ) : null}

          {/* O ÚNICO CAMINHO DE ENTRADA desde a 0096. `carregando` o desabilita
              junto com `SSO_LIGADO`: enquanto o App ainda confere se já havia
              sessão, clicar aqui dispararia um segundo fluxo por cima do
              primeiro. Antes isso era coberto pelo `ocupado` do formulário. */}
          <button
            type="button"
            disabled={!SSO_LIGADO || ativando}
            onClick={() =>
              entrarNoPainel(
                aoEntrar,
                (url) => {
                  window.location.href = url;
                },
                destinoAtual(),
              )
            }
            style={{
              width: '100%',
              marginTop: 22,
              height: 46,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              borderRadius: 'var(--r-btn)',
              border: '1px solid var(--borda-input)',
              background: 'var(--branco)',
              color: SSO_LIGADO ? 'var(--cinza-4)' : 'var(--texto-placeholder)',
              fontSize: 14,
              fontWeight: 700,
              cursor: SSO_LIGADO && !ativando ? 'pointer' : 'not-allowed',
            }}
          >
            <LogotipoDaMicrosoft apagado={!SSO_LIGADO} />
            Entrar com a conta Aegea
          </button>

          {SSO_LIGADO ? null : (
            <p
              style={{
                fontSize: 12,
                // `--cinza-3`, e NÃO `--cinza-2`: sobre `--bg-app` o cinza-2 dá
                // 2,90:1, abaixo do mínimo de 4,5 da WCAG para texto normal.
                // O cinza-3 dá 8,26 e continua lendo como texto secundário.
                color: 'var(--cinza-3)',
                marginTop: 8,
                lineHeight: 1.5,
              }}
            >
              O acesso pelo SSO da Microsoft ainda não está liberado. Use e-mail e
              senha por enquanto.
            </p>
          )}

          <p
            style={{
              fontSize: 12,
              // `--cinza-3`, e NÃO `--cinza-2`: o cinza-2 sobre `--bg-app` dá
              // 2,90:1 e reprova a WCAG. Mesmo motivo do aviso do SSO.
              color: 'var(--cinza-3)',
              marginTop: 20,
              lineHeight: 1.6,
            }}
          >
            Não consegue entrar? Peça à coordenação do painel — o acesso é
            concedido por lá.
          </p>
        </div>
      </main>
    </div>
  );
}

function LogotipoDaMicrosoft({ apagado }: { apagado: boolean }) {
  const cores = apagado
    ? ['#C7CBD9', '#C7CBD9', '#C7CBD9', '#C7CBD9']
    : ['#F25022', '#7FBA00', '#00A4EF', '#FFB900'];
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden focusable="false">
      <rect x="0" y="0" width="7" height="7" fill={cores[0]} />
      <rect x="9" y="0" width="7" height="7" fill={cores[1]} />
      <rect x="0" y="9" width="7" height="7" fill={cores[2]} />
      <rect x="9" y="9" width="7" height="7" fill={cores[3]} />
    </svg>
  );
}