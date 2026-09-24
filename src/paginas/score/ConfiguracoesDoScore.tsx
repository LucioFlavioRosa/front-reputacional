/** As configurações do Score — a régua, e o que explica o mês.
 *
 *  ERA UMA ABA DENTRO DO SCORE, e a mudança não é de arrumação. Quem abre a
 *  Calibração não está LENDO o índice: está mexendo na ferramenta que o
 *  produz, e são gestos de naturezas diferentes. Como aba, ela ficava ao lado
 *  de "Visão geral" e "Lentes" — telas de leitura —, e a régua da companhia
 *  aparecia como se fosse mais uma forma de olhar o número.
 *
 *  AGORA É A ENGRENAGEM DO SCORE, no menu, junto da área que ela configura. O
 *  mesmo gesto que abre os cadastros do CRM pelo Painel abre a régua pelo
 *  Score: quem procura "onde mudo isto" procura no mesmo lugar, sempre.
 *
 *  DUAS ABAS, E ELAS SE COMPLEMENTAM: a régua decide como o número é feito; o
 *  comentário do especialista decide o que se diz sobre ele. As duas são o que
 *  a companhia escolhe, e nenhuma se deriva de dado.
 */

import { useEffect, useState } from 'react';

import { obterOpcoesDoScore, obterScore } from '@/api/cliente';
import { Abas } from '@/componentes/Abas';
import { Carregando, FaixaDeErro, Secao } from '@/componentes/basicos';
import { CalibracaoDoScore } from '@/paginas/Score';
import { ComentarioDoEspecialista } from '@/paginas/score/ComentarioDoEspecialista';
import type { IndiceDoScore, OpcoesDoScore } from '@/dominio/score';

const ABAS = [
  { id: 'regua' as const, rotulo: 'Régua do índice' },
  { id: 'comentario' as const, rotulo: 'Comentário do especialista' },
];

export function ConfiguracoesDoScore() {
  const [aba, definirAba] = useState<'regua' | 'comentario'>('regua');
  const [opcoes, definirOpcoes] = useState<OpcoesDoScore | null>(null);
  const [indice, definirIndice] = useState<IndiceDoScore | null>(null);
  const [mes, definirMes] = useState<string | null>(null);
  const [erro, definirErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    obterOpcoesDoScore()
      .then((carregadas) => {
        if (!ativo) return;
        definirOpcoes(carregadas);
        definirMes(
          carregadas.mes_sugerido ?? carregadas.meses[carregadas.meses.length - 1] ?? null,
        );
      })
      .catch((falha: unknown) => {
        if (ativo) {
          definirErro(falha instanceof Error ? falha.message : 'Não foi possível carregar.');
        }
      });
    return () => {
      ativo = false;
    };
  }, []);

  //: O ÍNDICE ENTRA PORQUE A RÉGUA MEXE NELE. A Calibração mostra o efeito do
  //: ajuste — pesos efetivos, fontes com dado — e precisa do mês em vigor para
  //: isso; sem ele, a tela ajustaria no escuro.
  const recarregar = () => {
    if (!mes) return Promise.resolve();
    return obterScore(mes)
      .then((carregado) => {
        definirIndice(carregado);
        definirErro(null);
      })
      .catch((falha: unknown) =>
        definirErro(falha instanceof Error ? falha.message : 'Não foi possível carregar.'),
      );
  };

  useEffect(() => {
    void recarregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mes]);

  if (erro && !indice) return <FaixaDeErro mensagem={erro} />;
  if (!opcoes || !mes || !indice) return <Carregando rotulo="Carregando a régua…" />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Secao
        titulo="Configurações do Score"
        subtitulo="A régua com que a companhia lê o próprio mês, e o que se diz sobre ele. Mudar aqui muda o número que todo mundo vê."
        nivelDoTitulo={1}
      >
        <Abas
          abas={ABAS}
          ativa={aba}
          aoTrocar={definirAba}
          rotulo="O que configurar no Score"
          prefixo="score-config"
        />
      </Secao>

      {erro ? <FaixaDeErro mensagem={erro} /> : null}

      {aba === 'regua' ? (
        <CalibracaoDoScore
          mes={mes}
          opcoes={opcoes}
          calibracao={indice.calibracao}
          aoMudar={recarregar}
        />
      ) : (
        <ComentarioDoEspecialista mes={mes} />
      )}
    </div>
  );
}
