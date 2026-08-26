/** Login — entrada pelo SSO da Microsoft.
 *
 *  O botão MANDA o navegador para `/api/auth/login`, que começa o fluxo OIDC
 *  (authorization code + PKCE) e volta em `/api/auth/callback` com a sessão
 *  pronta. Sair daqui é sair da aplicação: o redirecionamento é do navegador,
 *  não uma chamada de API.
 *
 *  A decisão entre "seguir para o painel" e "sair para o SSO" mora em
 *  `entrada.ts`, fora do componente, porque é lá que ela pode ser testada — ver
 *  `entrada.test.ts`.
 *
 *  Nunca existe cadastro local de senha: o papel vem da tabela `papel`, depois
 *  da autenticação.
 */

import { useState } from 'react';
import { OndaDoHero } from '@/componentes/Onda';
import { entrarNoPainel } from '@/dominio/entrada';

const PERFIS = [
  { rotulo: 'Analista', descricao: 'cadastra e edita os próprios registros', cor: '#0027BD' },
  { rotulo: 'Coordenação', descricao: 'edita tudo e administra os dicionários', cor: '#17E3CB' },
  { rotulo: 'Diretoria', descricao: 'somente leitura das análises', cor: '#8C91A4' },
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
  const [redirecionando, definirRedirecionando] = useState(false);
  const ocupado = (redirecionando || carregando) && !erro;

  // A decisão mora em `entrada.ts`, e o componente só liga os fios: uma função
  // que confirma a sessão, outra que sai da aplicação. Foi assim que ela virou
  // testável — ver `entrada.test.ts`, que cobre justamente o caso que quebrava.
  const entrar = () => {
    definirRedirecionando(true);
    return entrarNoPainel(aoEntrar, (url) => {
      window.location.href = url;
    });
  };

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
          backgroundImage:
            // Véu de rodapé. O gradiente da marca termina quase transparente,
            // e ali a água é clara: os números ficavam em 2,49:1 de contraste,
            // abaixo do mínimo de 3:1 até para texto grande. Este véu escurece
            // só o terço inferior, onde o texto está, sem mexer na identidade.
            'linear-gradient(to top, rgba(0,25,120,0.66) 0%, rgba(0,25,120,0.22) 24%, rgba(0,25,120,0) 44%), ' +
            'linear-gradient(155deg, rgba(0,39,189,0.72) 0%, rgba(0,39,189,0.44) 52%, rgba(23,227,203,0.14) 100%), ' +
            'url(/imagens/hero-agua.png)',
          backgroundSize: 'cover, cover, auto 140%',
          backgroundPosition: 'center, center, center bottom',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span
            aria-hidden
            style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--turquesa-rio)' }}
          />
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
            }}
          >
            Aegea · Reputação
          </span>
        </div>

        <div>
          <h1
            className="entrada__titulo"
            style={{
              fontSize: 40,
              fontWeight: 700,
              letterSpacing: '-0.03em',
              lineHeight: 1.12,
              textShadow: '0 2px 18px rgba(0,25,120,0.4)',
              maxWidth: '17ch',
            }}
          >
            O relacionamento institucional em{' '}
            <span className="destaque" style={{ color: 'var(--turquesa-rio)' }}>
              um lugar
            </span>
          </h1>
          <p style={{ fontSize: 15, color: '#EAEEFC', marginTop: 14, maxWidth: '48ch' }}>
            Imprensa, governo, parceiros, eventos, investidores, legislativo e demandas internas —
            registrados uma vez, lidos por todo mundo.
          </p>
        </div>

        <div className="entrada__numeros" style={{ display: 'flex', gap: 40 }}>
          {[
            ['7', 'frentes'],
            ['11', 'fontes'],
            ['28', 'unidades'],
          ].map(([numero, rotulo]) => (
            <div key={rotulo}>
              <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.03em' }}>
                {numero}
              </div>
              <div style={{ fontSize: 12, color: '#C9D2F5' }}>{rotulo}</div>
            </div>
          ))}
        </div>
        <OndaDoHero corDeBaixo="var(--branco)" />
      </aside>

      <main
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--branco)',
          padding: 32,
        }}
      >
        <div style={{ width: '100%', maxWidth: 392 }}>
          <h2 style={{ fontSize: 22 }}>Entrar</h2>
          <p style={{ fontSize: 13, color: 'var(--cinza-2)', marginTop: 6, marginBottom: 24 }}>
            O acesso usa a conta corporativa. Não há senha cadastrada neste sistema.
          </p>

          {erro && (
            <p
              role="alert"
              style={{
                margin: '0 0 12px',
                padding: '10px 12px',
                borderRadius: 8,
                background: 'var(--erro-bg)',
                color: 'var(--erro-fg)',
                fontSize: 13,
              }}
            >
              {erro}
            </p>
          )}

          <button
            type="button"
            onClick={entrar}
            disabled={ocupado}
            style={{
              width: '100%',
              height: 50,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 11,
              border: `1px solid ${ocupado ? 'var(--azul-mar)' : 'var(--borda-input)'}`,
              borderRadius: 10,
              background: 'var(--branco)',
              fontSize: 14,
              fontWeight: 500,
              cursor: ocupado ? 'wait' : 'pointer',
            }}
          >
            {ocupado ? (
              <>
                <Girando />
                Redirecionando para a Microsoft…
              </>
            ) : (
              <>
                <LogoMicrosoft />
                Entrar com a conta Microsoft Aegea
              </>
            )}
          </button>

          <p style={{ fontSize: 12, color: 'var(--cinza-2)', marginTop: 12, lineHeight: 1.55 }}>
            Entra pelo Microsoft Entra ID do tenant <strong>aegea.com.br</strong>, com MFA quando
            exigido pela política da companhia.
          </p>

          <div style={{ marginTop: 30 }}>
            <div className="kicker" style={{ marginBottom: 10 }}>
              Perfis de acesso
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {PERFIS.map((perfil) => (
                <div key={perfil.rotulo} style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
                  <span
                    aria-hidden
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: perfil.cor,
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: 13 }}>
                    <strong>{perfil.rotulo}</strong>{' '}
                    <span style={{ color: 'var(--cinza-2)' }}>— {perfil.descricao}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <p style={{ fontSize: 11, color: 'var(--texto-placeholder)', marginTop: 28, lineHeight: 1.6 }}>
            Ao entrar você concorda com os Termos de Uso e a Política de Privacidade. Cada acesso é
            registrado para auditoria.
          </p>
        </div>
      </main>
    </div>
  );
}

function LogoMicrosoft() {
  const quadrantes = ['#F25022', '#7FBA00', '#00A4EF', '#FFB900'];
  return (
    <span
      aria-hidden
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 2,
        width: 18,
        height: 18,
        flexShrink: 0,
      }}
    >
      {quadrantes.map((cor) => (
        <span key={cor} style={{ background: cor }} />
      ))}
    </span>
  );
}

function Girando() {
  return (
    <>
      <style>{`@keyframes girar { to { transform: rotate(360deg) } }`}</style>
      <span
        aria-hidden
        style={{
          width: 15,
          height: 15,
          borderRadius: '50%',
          border: '2px solid var(--borda-input)',
          borderTopColor: 'var(--azul-mar)',
          animation: 'girar .7s linear infinite',
          flexShrink: 0,
        }}
      />
    </>
  );
}
