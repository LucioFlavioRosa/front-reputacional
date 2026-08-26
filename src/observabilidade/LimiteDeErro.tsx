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
import { Modal } from '@/componentes/basicos';
import { registrarErro } from '@/observabilidade/telemetria';

interface Estado {
  erro: Error | null;
}

interface Props {
  /** Uma saída além de "Recarregar", para telas onde recarregar não resolve.
   *
   *  A capa é o caso: ela NÃO tem cabeçalho, então uma exceção ali deixa a
   *  pessoa sem navegação e sem o cartão de entrada — e recarregar traz de
   *  volta a mesma tela quebrada. Fica-se preso num laço.
   *
   *  Nas telas internas isso não acontece, porque o cabeçalho fica FORA do
   *  limite e a navegação sobrevive à falha. É o que este limite promete, e
   *  a capa era o único lugar onde a promessa não se cumpria.
   */
  saida?: { rotulo: string; aoAcionar: () => void };

  children: ReactNode;
  /** Presente quando o limite envolve algo que abre POR CIMA do painel.
   *
   *  Muda a saída oferecida, e a diferença importa: dentro de um modal, o card
   *  de página inteira apareceria sem nenhum jeito de fechar, e "Recarregar"
   *  — que derruba o painel inteiro para desfazer a abertura de uma ficha —
   *  seria uma resposta grande demais para o problema.
   */
  aoFechar?: () => void;
}

export class LimiteDeErro extends Component<Props, Estado> {
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

    const { aoFechar } = this.props;

    // Sobre o painel, a moldura é a MESMA dos outros modais — mesma sobreposição,
    // mesmo botão de fechar, mesma tecla Esc. Um erro não é hora de a interface
    // mudar de vocabulário com quem já está confuso.
    if (aoFechar) {
      return (
        <Modal titulo="Esta janela não conseguiu carregar" aoFechar={aoFechar} largura={560}>
          <p style={{ fontSize: 14, color: 'var(--cinza-3)', lineHeight: 1.6 }}>
            A falha foi registrada com o horário e o ponto exato do código. Feche e
            tente de novo; se voltar a acontecer no mesmo registro, avise a equipe —
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
        </Modal>
      );
    }

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

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
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

          {/* A saída vem DEPOIS de "Recarregar", e em estilo secundário:
              recarregar resolve a falha passageira, que é a maioria. Esta é
              para quando não resolve — e é a única que existe quando a tela
              quebrada é justamente a que não tem navegação. */}
          {this.props.saida ? (
            <button
              type="button"
              onClick={this.props.saida.aoAcionar}
              style={{
                  height: 40,
                  padding: '0 18px',
                  border: '1px solid var(--borda-input)',
                  borderRadius: 'var(--r-btn)',
                  background: 'var(--branco)',
                  color: 'var(--cinza-3)',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
              }}
            >
              {this.props.saida.rotulo}
            </button>
          ) : null}
        </div>
      </div>
    );
  }
}
