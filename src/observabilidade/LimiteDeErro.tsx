/** Limite de erro do React.
 *
 *  Sem isto, uma exceção durante o render desmonta a árvore inteira e o
 *  usuário fica com **tela branca** — sem mensagem, sem requisição, sem nada
 *  no log do backend. É a falha mais difícil de descobrir em produção, porque
 *  ninguém abre chamado dizendo "a tela ficou branca às 14h32".
 *
 *  Aqui ela vira duas coisas: uma exceção registrada com o componente que
 *  quebrou, e uma tela que diz o que aconteceu e oferece uma saída.
 */

import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { registrarErro } from '@/observabilidade/telemetria';

interface Estado {
  erro: Error | null;
}

export class LimiteDeErro extends Component<{ children: ReactNode }, Estado> {
  state: Estado = { erro: null };

  static getDerivedStateFromError(erro: Error): Estado {
    return { erro };
  }

  componentDidCatch(erro: Error, info: ErrorInfo) {
    registrarErro(erro, {
      origem: 'render',
      // Diz em qual componente quebrou — é o que transforma "TypeError:
      // undefined" em algo localizável no código.
      pilhaDeComponentes: info.componentStack ?? '',
      view: window.location.hash || 'painel',
    });
  }

  render() {
    if (!this.state.erro) return this.props.children;

    return (
      <div
        role="alert"
        style={{
          maxWidth: 560,
          margin: '80px auto',
          padding: 32,
          background: 'var(--branco)',
          border: '1px solid var(--borda)',
          borderRadius: 'var(--r-card)',
        }}
      >
        <div className="kicker" style={{ color: 'var(--erro-fg)' }}>
          Erro na aplicação
        </div>
        <h1 style={{ fontSize: 22, marginTop: 8 }}>Esta tela não conseguiu carregar</h1>
        <p style={{ fontSize: 14, color: 'var(--cinza-3)', marginTop: 10, lineHeight: 1.6 }}>
          A falha foi registrada com o horário e o ponto exato do código. Recarregar
          costuma resolver; se voltar a acontecer na mesma tela, avise a equipe —
          o registro já está lá.
        </p>

        <details style={{ marginTop: 16 }}>
          <summary style={{ fontSize: 13, color: 'var(--cinza-2)', cursor: 'pointer' }}>
            Detalhe técnico
          </summary>
          <pre
            style={{
              marginTop: 10,
              padding: 12,
              background: 'var(--bg-app)',
              borderRadius: 'var(--r-card-int)',
              fontSize: 12,
              overflowX: 'auto',
              color: 'var(--cinza-3)',
            }}
          >
            {this.state.erro.message}
          </pre>
        </details>

        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            marginTop: 20,
            height: 40,
            padding: '0 18px',
            border: 'none',
            borderRadius: 'var(--r-btn)',
            background: 'var(--azul-mar)',
            color: 'var(--branco)',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Recarregar
        </button>
      </div>
    );
  }
}
