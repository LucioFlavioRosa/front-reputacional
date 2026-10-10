/** Limite de erro do tamanho de um bloco do drill (D.3, decisão A7).
 *
 *  O `LimiteDeErro` de `src/observabilidade` só tem fallback de página
 *  inteira ou de modal. Aqui, se um gráfico ou uma tabela quebrar, aparece no
 *  lugar um cartão com o texto da spec, "Não foi possível exibir este bloco.",
 *  e o restante da página continua de pé.
 *
 *  O ERRO É REGISTRADO na telemetria, com o nome do bloco, para não virar um
 *  buraco silencioso na tela.
 *
 *  `chaveDeReinicio` DESFAZ O ERRO QUANDO A TELA MUDA: sem ela, um bloco que
 *  quebrou no Nível 2 continuaria mostrando o aviso no Nível 3, mesmo com
 *  outros dados. Quem monta passa, por exemplo, o endereço do nível.
 *
 *  O CARTÃO DE AVISO NÃO TEM BOTÃO PNG: não é um cartão de conteúdo, e uma
 *  imagem do aviso não serve a ninguém.
 */

import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

import { Cartao } from '@/componentes/basicos';
import { registrarErro } from '@/observabilidade/telemetria';

interface Props {
  children: ReactNode;
  /** Nome do bloco no registro do erro ("Tabela de impacto", "Recortes"...). */
  nome?: string;
  /** Quando muda, o limite tenta exibir o bloco de novo. */
  chaveDeReinicio?: string;
}

interface Estado {
  erro: Error | null;
  chave?: string;
}

export class LimiteDoBloco extends Component<Props, Estado> {
  state: Estado = { erro: null, chave: this.props.chaveDeReinicio };

  static getDerivedStateFromError(erro: Error): Partial<Estado> {
    return { erro };
  }

  static getDerivedStateFromProps(props: Props, estado: Estado): Partial<Estado> | null {
    if (props.chaveDeReinicio === estado.chave) return null;
    return { erro: null, chave: props.chaveDeReinicio };
  }

  componentDidCatch(erro: Error, info: ErrorInfo) {
    registrarErro(erro, {
      origem: 'render',
      bloco: this.props.nome ?? 'Consulta em profundidade',
      pilhaDeComponentes: info.componentStack ?? '',
      view: window.location.pathname || '/',
    });
  }

  render() {
    if (!this.state.erro) return this.props.children;
    return (
      <Cartao>
        <p role="alert" style={{ margin: 0, fontSize: 14, color: 'var(--cinza-3)' }}>
          Não foi possível exibir este bloco.
        </p>
      </Cartao>
    );
  }
}
