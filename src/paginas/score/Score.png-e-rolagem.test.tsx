// @vitest-environment jsdom

/** O botão PNG e as duas barras de rolagem.
 *
 *  AS DUAS REGRAS QUE ESTE ARQUIVO PRENDE vêm do dono do produto, e as duas são
 *  do tipo que ninguém nota quando quebra:
 *
 *  1. O "PNG" APARECE ONDE TEM GRÁFICO. Antes era uma lista fixa de telas
 *     ("Visão geral e Lentes"), e duas abas com gráfico — Drivers e riscos, e o
 *     Risk Tracking — ficaram de fora porque nasceram depois da lista. O
 *     critério passou a ser o conteúdo.
 *
 *  2. AS DUAS BARRAS DE ROLAGEM FICAM NA TELA. Uma tabela larga com
 *     `overflow-x: auto` e sem limite de altura cresce com o conteúdo, e a barra
 *     horizontal dela vai para o fim do documento: para arrastá-la, a pessoa
 *     tinha de rolar a página toda para baixo, e aí perdia de vista as linhas
 *     que queria ler. Relatado pelo dono do produto depois de usar a tela.
 *
 *  POR QUE TESTAR A CLASSE, E NÃO O PIXEL: `jsdom` não calcula layout —
 *  `getBoundingClientRect` devolve zero e `overflow` não produz barra nenhuma.
 *  O que se pode provar aqui é o CONTRATO: o container tem a classe que carrega
 *  a regra, e o cabeçalho tem a que o mantém visível.
 *
 *  E O QUE ESTE ARQUIVO NÃO COBRE, dito porque é melhor escrito que
 *  subentendido: a REGRA em si (`max-height: 72vh` e `position: sticky`) mora em
 *  `index.css`, e nenhum teste a lê. Tentei: `?raw` sobre CSS volta vazio
 *  (o vitest descarta folhas de estilo por padrão) e `node:fs` não compila
 *  (o `tsconfig.app.json` não declara os tipos de node). Ligar `css: true` na
 *  configuração cobraria o custo em toda a suíte por causa de uma asserção.
 *
 *  Então apagar a regra do CSS deixando as classes nos componentes passaria por
 *  aqui. É a mesma exposição que `.rolagem-interna` já tem neste projeto, e o
 *  que resta contra isso é a revisão visual no navegador.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RelatorioDeIncidentes } from '@/paginas/score/RelatorioDeIncidentes';
import type { PaginaDeIncidentes } from '@/dominio/riscos';

//: POR `?raw` DO VITE, e não por `node:fs`: o `tsconfig.app.json` declara
//: `types: ["vite/client"]` e não `node`, então `node:fs` não compila e o
//: `tsc -b --force` do CI quebraria. O `?raw` entrega o arquivo como string e é
//: tipado pelo próprio Vite.
//:
//: E SÓ FUNCIONA PARA `.tsx`: `?raw` sobre CSS volta string VAZIA, porque o
//: vitest descarta folhas de estilo por padrão. Ver o fim deste arquivo.
import FONTE_DO_SCORE from '@/paginas/Score.tsx?raw';

const PAGINA: PaginaDeIncidentes = {
  itens: [
    {
      tipo: 'mencao',
      id: 'm1',
      data: '2026-09-04',
      quem: 'Jornal do Risco',
      incidente: 'Falta de água no bairro',
      link: null,
      fonte: 'clipei',
      fonte_nome: 'Clipei',
      lente: 'imprensa',
      lente_nome: 'Imprensa',
      tema: 'Desabastecimento',
      tier: 'relevante',
      engajamento: null,
      severidade: 'alto',
      recorrencia: 2,
      riscos: [{ codigo: 'R1', nome: 'Entrega de água' }],
    },
  ],
  total: 1,
  pagina: 1,
  tamanho: 50,
};

describe('as duas barras de rolagem', () => {
  it('a tabela larga rola POR DENTRO, com as duas barras na tela', () => {
    render(
      <RelatorioDeIncidentes
        pagina={PAGINA}
        aoMudarPagina={() => {}}
        aoAprofundarNoTema={() => {}}
      />,
    );

    const tabela = screen.getByRole('table', { name: 'Lista de incidentes' });
    const rolagem = tabela.parentElement;
    expect(rolagem?.className).toContain('rolagem-das-duas-barras');
  });

  it('a área rolável é ALCANÇÁVEL POR TECLADO, e tem nome', () => {
    //: ACHADO DE REVISÃO, e é regressão que a própria correção da barra
    //: introduziu: antes a PÁGINA rolava, e página se rola com as setas e o
    //: Page Down sem precisar de foco. Com o conteúdo rolando dentro de um
    //: `div`, quem navega por teclado não chega nele — a área tem barra e não
    //: responde. Regra 2.1.1 do WCAG (`scrollable-region-focusable`, no axe).
    render(
      <RelatorioDeIncidentes
        pagina={PAGINA}
        aoMudarPagina={() => {}}
        aoAprofundarNoTema={() => {}}
      />,
    );

    //: `group` E NÃO `region`: `region` cria LANDMARK, e o engenheiro tem teste
    //: proibindo landmark na Consulta — landmark demais polui a navegação de
    //: quem ouve a tela. A regra do axe pede FOCO, não landmark, e `group`
    //: legitima o `aria-label` sem virar landmark.
    const area = screen.getByRole('group', { name: /Lista de incidentes/ });
    expect(area.className).toContain('rolagem-das-duas-barras');
    expect(area.getAttribute('tabindex')).toBe('0');
  });

  it('e o CABEÇALHO fica, porque rolar sem o nome das colunas é pior', () => {
    render(
      <RelatorioDeIncidentes
        pagina={PAGINA}
        aoMudarPagina={() => {}}
        aoAprofundarNoTema={() => {}}
      />,
    );

    const cabecalho = screen.getByRole('columnheader', { name: 'Data' }).parentElement;
    expect(cabecalho?.className).toContain('cabecalho-que-fica');
  });

});

describe('o botão PNG aparece onde tem gráfico', () => {
  //: A FONTE DA VERDADE É O PRÓPRIO `Score.tsx`: a lista de abas com gráfico e
  //: o `return` próprio da aba de risco. Ler o arquivo é o que deixa este teste
  //: cair quando alguém acrescenta uma aba com gráfico e esquece de incluí-la —
  //: que é exatamente o que aconteceu com Drivers e com o Risk Tracking, as
  //: duas nascidas depois da regra antiga ("Visão geral e Lentes").
  const FONTE = FONTE_DO_SCORE;

  it('as três abas com gráfico estão na lista, e nenhuma sem', () => {
    const lista = FONTE.match(/const ABAS_COM_GRAFICO = \[([^\]]*)\]/)?.[1] ?? '';
    const abas = [...lista.matchAll(/'([^']+)'/g)].map((achado) => achado[1]);

    expect(abas).toContain('geral');
    expect(abas).toContain('lentes');
    //: DRIVERS DESENHA `BarraDivergentePorItem` e `Ranking`. Ela ficava de fora
    //: da lista antiga, por nome.
    expect(abas).toContain('drivers');

    //: E AS SEM GRÁFICO CONTINUAM DE FORA: texto, tabela e formulário não têm
    //: cartão que se leve para uma apresentação.
    expect(abas).not.toContain('metodologia');
    expect(abas).not.toContain('base-de-dados');
    expect(abas).not.toContain('base');
  });

  it('a aba de RISCO entrega o PNG pelo seu próprio provider', () => {
    //: Ela tem `return` antes do provider principal, porque não usa o ISR — e
    //: por isso precisa levar o contexto consigo. Sem isso ela cai no padrão
    //: (desligado) e fica sem o botão, com dois gráficos na tela.
    const trecho = FONTE.slice(
      FONTE.indexOf("if (aba === 'riscos')"),
      FONTE.indexOf("if (erro && !indice)"),
    );
    expect(trecho).toContain('ContextoDoPng.Provider');
    expect(trecho).toContain('<RastreioDeRisco />');
  });

  it('e o provider principal usa a LISTA, não uma condição solta', () => {
    //: `aba === 'geral' || aba === 'lentes'` era a condição antiga, e o defeito
    //: dela é não ter nome: ninguém que acrescenta uma aba a encontra.
    expect(FONTE).toContain('ABAS_COM_GRAFICO.includes(aba)');
    expect(FONTE).not.toMatch(/value=\{aba === 'geral' \|\| aba === 'lentes'\}/);
  });
});
