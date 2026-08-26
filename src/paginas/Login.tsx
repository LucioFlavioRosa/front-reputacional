/** Login — duas portas: o SSO da Microsoft e e-mail com senha.
 *
 *  O SSO ESTÁ DESLIGADO nesta versão, e desligado de propósito. O botão
 *  aparece, diz que aparece, e não sai daqui: `SSO_LIGADO` é a única chave, e
 *  ligá-la devolve o fluxo OIDC inteiro, que continua implementado no backend
 *  (`/api/auth/login` → `/api/auth/callback`).
 *
 *  Mostrar o botão apagado, em vez de escondê-lo, é decisão: quem é da Aegea
 *  chega esperando entrar com a conta corporativa, e uma tela que só oferece
 *  senha faria a pessoa achar que abriu o sistema errado. O botão diz "vem aí".
 *
 *  A ENTRADA POR SENHA existe para quem não está no Entra ID — agência,
 *  consultor, alguém de investida ainda não integrada. Manda e-mail e senha
 *  para `/api/auth/senha`, que responde 204 com o mesmo cookie de sessão que o
 *  SSO emitiria. Daqui para a frente o resto da aplicação não sabe por qual
 *  porta a pessoa entrou.
 *
 *  A decisão entre "seguir para o painel" e "sair para o SSO" mora em
 *  `entrada.ts`, fora do componente, porque é lá que ela pode ser testada.
 */

import { useState } from 'react';
import { OndaDoHero } from '@/componentes/Onda';
import { entrarPorSenha } from '@/api/cliente';
import { entrarNoPainel } from '@/dominio/entrada';

/** O SSO volta trocando isto para `true`. Nada mais precisa mudar aqui. */
const SSO_LIGADO = false;

/** Os três módulos da plataforma, na ordem em que a capa os apresenta. */
const MODULOS = [
  { nome: 'CRM dos Stakeholders', estado: 'Disponível' },
  { nome: 'Síntese Executiva', estado: 'Em construção' },
  { nome: 'Score Executivo', estado: 'Em construção' },
];

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
  const [email, definirEmail] = useState('');
  const [senha, definirSenha] = useState('');
  const [enviando, definirEnviando] = useState(false);
  const [falha, definirFalha] = useState<string | null>(null);

  const ocupado = enviando || (carregando && !erro);

  async function submeter(evento: React.FormEvent) {
    evento.preventDefault();
    definirFalha(null);
    definirEnviando(true);
    try {
      await entrarPorSenha(email.trim(), senha);
      // A sessão está no cookie. `aoEntrar` confirma e o App troca de tela — o
      // mesmo caminho do retorno do SSO, e não um segundo fluxo paralelo.
      await entrarNoPainel(aoEntrar, (url) => {
        window.location.href = url;
      });
    } catch (erroDoServidor) {
      definirFalha(
        erroDoServidor instanceof Error
          ? erroDoServidor.message
          : 'Não foi possível entrar. Tente de novo.',
      );
    } finally {
      definirEnviando(false);
    }
  }

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
          <h2 style={{ fontSize: 24, marginTop: 8 }}>Painel Reputacional</h2>
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

          {/* O SSO primeiro: é o caminho da maioria, e a ordem na tela é a
              ordem da expectativa de quem chega. */}
          <button
            type="button"
            disabled={!SSO_LIGADO}
            onClick={() =>
              entrarNoPainel(aoEntrar, (url) => {
                window.location.href = url;
              })
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
              cursor: SSO_LIGADO ? 'pointer' : 'not-allowed',
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

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              margin: '22px 0',
              color: 'var(--cinza-2)',
              fontSize: 11,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            <span style={{ flex: 1, height: 1, background: 'var(--borda)' }} />
            ou
            <span style={{ flex: 1, height: 1, background: 'var(--borda)' }} />
          </div>

          <form onSubmit={submeter} style={{ display: 'grid', gap: 14 }}>
            <label style={{ display: 'block' }}>
              <span style={rotulo}>E-mail</span>
              <input
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(evento) => definirEmail(evento.target.value)}
                placeholder="voce@empresa.com.br"
                style={entrada}
              />
            </label>

            <label style={{ display: 'block' }}>
              <span style={rotulo}>Senha</span>
              <input
                type="password"
                required
                // `current-password` e não `new-password`: é o que faz o
                // gerenciador de senhas oferecer a que já existe, em vez de
                // propor uma nova a cada visita.
                autoComplete="current-password"
                value={senha}
                onChange={(evento) => definirSenha(evento.target.value)}
                style={entrada}
              />
            </label>

            {/* A falha da senha e a falha de sessão aparecem no MESMO lugar:
                para quem está olhando, as duas são "não entrei". */}
            {falha || erro ? (
              <div
                role="alert"
                style={{
                  padding: '10px 12px',
                  borderRadius: 'var(--r-card-int)',
                  background: 'var(--erro-bg)',
                  color: 'var(--erro-fg)',
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                {falha ?? erro}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={ocupado}
              style={{
                height: 46,
                borderRadius: 'var(--r-btn)',
                border: 'none',
                background: ocupado ? 'var(--cinza-2)' : 'var(--azul-mar)',
                color: 'var(--branco)',
                fontSize: 14,
                fontWeight: 700,
                cursor: ocupado ? 'progress' : 'pointer',
              }}
            >
              {ocupado ? 'Entrando…' : 'Entrar'}
            </button>
          </form>

          <p
            style={{
              fontSize: 12,
              // Mesmo motivo do aviso do SSO: `--cinza-2` reprova a WCAG aqui.
              color: 'var(--cinza-3)',
              marginTop: 20,
              lineHeight: 1.6,
            }}
          >
            Esqueceu a senha? Peça à coordenação do painel — não há redefinição
            automática.
          </p>
        </div>
      </main>
    </div>
  );
}

const rotulo: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--cinza-3)',
  marginBottom: 6,
};

const entrada: React.CSSProperties = {
  width: '100%',
  height: 44,
  padding: '0 13px',
  borderRadius: 'var(--r-btn)',
  border: '1px solid var(--borda-input)',
  background: 'var(--branco)',
  fontSize: 14,
  fontFamily: 'inherit',
};

/** Os quatro quadrados da Microsoft, em cinza quando o SSO está desligado.
 *
 *  Desenhado aqui, e não importado: são quatro retângulos, e trazer uma
 *  biblioteca de ícones para isto custaria mais bytes do que o resto da tela.
 */
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
