/** A ponte entre o endereço do navegador e o React.
 *
 *  DUAS METADES, DOIS DONOS. Este hook escreve só o CAMINHO; o recorte escreve
 *  só a CONSULTA (ver `estado/painel.tsx`). Cada um preserva a metade do
 *  outro ao escrever, e por isso não brigam pela mesma URL.
 *
 *  `pushState` para trocar de tela — é o que faz o botão de voltar voltar uma
 *  tela em vez de sair do sistema. `replaceState` para trocar o eixo de
 *  Explorar: escolher outro agrupamento é ajuste da mesma leitura, e empilhar
 *  uma entrada de histórico por clique faria o voltar percorrer sete cliques
 *  antes de sair da tela.
 */

import { useCallback, useEffect, useState } from 'react';
import { caminhoDe, lerCaminho, lerEixo } from '@/navegacao/rota';
import type { Eixo, Rota } from '@/navegacao/rota';

interface Lugar {
  caminho: string;
  consulta: string;
}

function daJanela(): Lugar {
  return {
    caminho: window.location.pathname,
    consulta: window.location.search,
  };
}

// `use...`, e nao `usar...`, apesar de todo o resto do codigo ser em
// portugues. Nao e concessao de estilo: o prefixo `use` e como o React
// IDENTIFICA um hook. A regra `react-hooks/rules-of-hooks` — que este projeto
// marca como `error` — e o React Compiler reconhecem hook pelo nome. Chamado
// de `usarNavegacao`, este aqui nao seria tratado como hook por nenhum dos
// dois: o lint pararia de conferir as regras, e uma chamada dentro de `if`
// passaria batida.
export function useNavegacao() {
  const [lugar, definirLugar] = useState<Lugar>(daJanela);

  useEffect(function ouvirOBotaoDeVoltar() {
    const aoVoltar = () => definirLugar(daJanela());
    window.addEventListener('popstate', aoVoltar);
    return () => window.removeEventListener('popstate', aoVoltar);
  }, []);

  const irPara = useCallback((rota: Rota, opcoes?: { substituir?: boolean }) => {
    const caminho = caminhoDe(rota);
    // A CONSULTA VIAJA JUNTO: trocar de tela não pode perder o recorte. Sem
    // isto, quem abre uma ficha e volta perde o filtro.
    const consulta = window.location.search;
    const destino = caminho + consulta;

    if (opcoes?.substituir) window.history.replaceState(null, '', destino);
    else window.history.pushState(null, '', destino);

    definirLugar({ caminho, consulta });
  }, []);

  const trocarEixo = useCallback((eixo: Eixo) => {
    const p = new URLSearchParams(window.location.search);
    if (eixo === 'frente') p.delete('ver');
    else p.set('ver', eixo);

    const consulta = p.toString() ? `?${p.toString()}` : '';
    window.history.replaceState(null, '', window.location.pathname + consulta);
    definirLugar({ caminho: window.location.pathname, consulta });
  }, []);

  /** Avisa que a consulta mudou por fora — quem a escreve é o recorte. */
  const sincronizarConsulta = useCallback(() => {
    definirLugar((atual) =>
      atual.consulta === window.location.search
        ? atual
        : { ...atual, consulta: window.location.search },
    );
  }, []);

  return {
    rota: lerCaminho(lugar.caminho),
    eixo: lerEixo(lugar.consulta),
    endereco: lugar.caminho + lugar.consulta,
    irPara,
    trocarEixo,
    sincronizarConsulta,
  };
}
