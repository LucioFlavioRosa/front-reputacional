// @vitest-environment jsdom

/** A linha do relatório de incidentes leva ao registro.
 *
 *  PEDIDO DO DONO DO PRODUTO (12/10/2026): "não quero que o link seja mostrado,
 *  quero apenas clicar no registro e ser encaminhado".
 *
 *  O QUE MUDA. O título era um `<a>` azul sublinhado — o link APARECENDO como
 *  link, e o único ponto clicável de uma linha de oito colunas. Agora a linha
 *  inteira leva ao registro, e o título é texto comum.
 *
 *  O `<a>` CONTINUA EXISTINDO, e isso não contradiz o pedido: ele pediu que o
 *  link não fosse MOSTRADO, não que deixasse de existir. É ele que dá o caminho
 *  por teclado, o ctrl-clique para abrir em outra aba, o "copiar endereço" do
 *  menu do botão direito e o endereço na barra de status. Um `<div onClick>` não
 *  dá nenhum dos quatro.
 *
 *  O QUE ESTES TESTES PROTEGEM:
 *
 *  * clicar em QUALQUER célula da linha encaminha — é o pedido;
 *  * clicar no ASSUNTO não encaminha: ele é outro destino, e o degrau de descida
 *    do recorte não pode virar um salto para fora do painel;
 *  * o título não tem mais cara de link;
 *  * e a linha de AGENDA não finge ser clicável, porque ela não tem para onde ir:
 *    `link` é nulo nela por construção.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import type { IncidenteNaTabela, PaginaDeIncidentes } from '@/dominio/riscos';
import { RelatorioDeIncidentes } from '@/paginas/score/RelatorioDeIncidentes';

const MENCAO: IncidenteNaTabela = {
  tipo: 'mencao',
  id: 'm1',
  data: '2026-09-18',
  quem: 'Valor Econômico',
  incidente: 'Tarifa de água sobe em Manaus',
  link: 'https://valor.globo.com/materia-zz1',
  fonte: 'clipei',
  fonte_nome: 'Clipei',
  lente: 'imprensa',
  lente_nome: 'Imprensa',
  tema: 'Tarifa e reajuste',
  tier: 'muito_relevante',
  engajamento: null,
  severidade: 'alta',
  recorrencia: 3,
  riscos: [{ codigo: 'r1', nome: 'Tarifa' }],
};

const AGENDA: IncidenteNaTabela = {
  ...MENCAO,
  tipo: 'agenda',
  id: 'a1',
  quem: null,
  incidente: null,
  //: NULO POR CONSTRUÇÃO: não há URL externa de uma reunião. O tipo em
  //: `dominio/riscos` diz isso: "O título da matéria. Nulo na agenda."
  link: null,
  fonte: 'crm',
  fonte_nome: 'CRM dos Stakeholders',
  lente: 'institucional',
  lente_nome: 'Institucional',
  tier: null,
};

function pagina(itens: IncidenteNaTabela[]): PaginaDeIncidentes {
  return { itens, total: itens.length, pagina: 1, tamanho: 50 };
}

let abrir: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  abrir = vi.spyOn(window, 'open').mockReturnValue(null);
});

afterEach(() => {
  vi.restoreAllMocks();
});

it('clicar em QUALQUER celula da linha encaminha ao registro', async () => {
  //: O PEDIDO. A linha tem oito colunas; obrigar o clique a acertar o título é
  //: obrigar a pessoa a mirar.
  render(
    <RelatorioDeIncidentes
      pagina={pagina([MENCAO])}
      aoMudarPagina={() => {}}
      aoAprofundarNoTema={() => {}}
    />,
  );

  //: A célula da DATA — a mais longe do título, na outra ponta da linha.
  await userEvent.click(screen.getByText('18/09/2026'));

  expect(abrir).toHaveBeenCalledWith(
    'https://valor.globo.com/materia-zz1',
    '_blank',
    'noreferrer',
  );
});

it('clicar no ASSUNTO desce no assunto, e NAO encaminha', async () => {
  //: O ASSUNTO É OUTRO DESTINO — é o último degrau da descida dentro do painel.
  //: Sem parar a propagação, clicar nele abriria a matéria no veículo: o degrau
  //: de descida viraria um salto para fora.
  const desceu = vi.fn();
  render(
    <RelatorioDeIncidentes
      pagina={pagina([MENCAO])}
      aoMudarPagina={() => {}}
      aoAprofundarNoTema={desceu}
    />,
  );

  await userEvent.click(screen.getByRole('button', { name: 'Tarifa e reajuste' }));

  expect(desceu).toHaveBeenCalledWith('Tarifa e reajuste');
  expect(abrir).not.toHaveBeenCalled();
});

it('o titulo nao tem mais cara de link', async () => {
  //: "não quero que o link seja mostrado". Azul e sublinhado é o link se
  //: mostrando; o que diz que a linha é clicável passou a ser a linha inteira
  //: reagindo ao passar o mouse (`.linha-que-leva`, em `index.css`).
  render(
    <RelatorioDeIncidentes
      pagina={pagina([MENCAO])}
      aoMudarPagina={() => {}}
      aoAprofundarNoTema={() => {}}
    />,
  );

  const titulo = screen.getByRole('link', { name: /Tarifa de água sobe em Manaus/ });
  expect(titulo.style.color).toBe('inherit');
  expect(titulo.style.textDecoration).toBe('none');
});

it('o titulo CONTINUA sendo link de verdade, para teclado e ctrl-clique', async () => {
  //: NÃO MOSTRAR ≠ NÃO EXISTIR. O `<a>` é o que dá teclado, ctrl-clique, "copiar
  //: endereço do link" e o endereço na barra de status. Trocá-lo por um
  //: `<div onClick>` entregaria o pedido e tiraria as quatro coisas.
  render(
    <RelatorioDeIncidentes
      pagina={pagina([MENCAO])}
      aoMudarPagina={() => {}}
      aoAprofundarNoTema={() => {}}
    />,
  );

  const titulo = screen.getByRole('link', { name: /Tarifa de água sobe em Manaus/ });
  expect(titulo.getAttribute('href')).toBe('https://valor.globo.com/materia-zz1');
  expect(titulo.getAttribute('target')).toBe('_blank');
});

it('clicar no titulo encaminha UMA vez, e nao duas', async () => {
  //: A LINHA TEM `onClick` E O TÍTULO É UM `<a>`: sem parar a propagação no
  //: título, clicar nele dispararia os dois — a navegação do `<a>` e a da linha —
  //: e abriria DUAS abas da mesma matéria.
  render(
    <RelatorioDeIncidentes
      pagina={pagina([MENCAO])}
      aoMudarPagina={() => {}}
      aoAprofundarNoTema={() => {}}
    />,
  );

  await userEvent.click(
    screen.getByRole('link', { name: /Tarifa de água sobe em Manaus/ }),
  );

  //: O `<a>` navega sozinho no navegador; aqui o que se mede é que a linha NÃO
  //: abriu uma segunda aba por cima dele.
  expect(abrir).not.toHaveBeenCalled();
});

it('a linha de AGENDA nao finge ser clicavel', async () => {
  //: ELA NÃO TEM PARA ONDE IR: `link` é nulo na agenda por construção. Uma linha
  //: com cursor de mão que não leva a nada é pior que uma linha inerte — ela
  //: promete e não cumpre.
  render(
    <RelatorioDeIncidentes
      pagina={pagina([AGENDA])}
      aoMudarPagina={() => {}}
      aoAprofundarNoTema={() => {}}
    />,
  );

  await userEvent.click(screen.getByText('18/09/2026'));

  expect(abrir).not.toHaveBeenCalled();
  expect(screen.queryByRole('link')).toBeNull();
});
