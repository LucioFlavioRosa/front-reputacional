import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test as testeBase } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { simularApi } from './apiSimulada.ts';
import type { ApiSimulada } from './apiSimulada.ts';
import { AVISO_ILUSTRATIVO, consultaReal } from './fixtures/consulta.ts';

// -------------------------------------------------------------------------
// CONSULTA EM PROFUNDIDADE · ponta a ponta
//
// O ROTEIRO DA PARTE G DA SPEC, adaptado pelas decisões de
// `docs/consulta-profundidade/DECISOES.md`: o drill mora no bloco "Drill
// down" da aba Lentes (A1), sem cartão da nota (D1: nenhum "42" de nota), só
// na Imprensa (4 níveis) e no Mercado (Nível 1) (D2: os passos 13 a 15 viram
// "o bloco não aparece" nas outras lentes), a busca é a do cabeçalho (D3) e
// o estado vai no hash `#consulta&…` (A3).
//
// UMA CAPTURA POR PASSO em `docs/consulta-profundidade/qa/NN-descricao.png`,
// gravada só se o passo passou (ver `gravar`). Em cada captura também se
// confere que a página não rola na horizontal.
//
// QUALQUER `console.error`, `pageerror` ou aviso do React reprova, como pede a
// Parte G: um aviso de chave (`key`) passa despercebido na tela e só aparece
// no console. O mesmo vale para chamada sem resposta gravada.
// -------------------------------------------------------------------------

const CAPTURAS = join(import.meta.dirname, '..', 'docs', 'consulta-profundidade', 'qa');

//: Avisos do React que chegam como `console.warn` (os de desenvolvimento do
//: React 19 vêm quase todos por `console.error`, já coberto acima).
const AVISO_DO_REACT = /react|warning:|\bkey\b/i;

//: MENOS É U+2212 em todo texto de tela (E.2); o teste escreve o mesmo.
const MENOS = '−';

//: Os títulos que o roteiro confere, literais do JSON da consulta.
const TITULO_DOS_PILARES_DA_IMPRENSA =
  'Eficiência Operacional e Governança tiram 10,5 pontos; o que sustenta devolve só 3,1';
const TITULO_DOS_PILARES_DO_MERCADO =
  'Crescimento e Solidez Financeira sustenta o Mercado; Governança é o único freio relevante';

//: Um "42" ou "48" SOLTO (D1): a nota ilustrativa da Imprensa e a de julho.
//: Não casa com "142", "4,2" nem "1.428".
const NOTA_42 = /(?<![\d,.])42(?![\d,.])/;
const NOTA_48 = /(?<![\d,.])48(?![\d,.])/;

interface Vigias {
  /** Respostas simuladas; `naoGravadas` lista o que o front pediu sem resposta. */
  api: ApiSimulada;
  /** Erros de console, `pageerror` e avisos do React. */
  problemas: string[];
}

// AS DUAS VIGIAS SÃO CONFERIDAS TAMBÉM NO CAMINHO DE FALHA, na desmontagem do
// fixture: se faltar uma resposta inicial (`/api/eu`, por exemplo), a tela nem
// abre e o teste cai num tempo esgotado de localizador que não cita a rota. A
// desmontagem anexa a lista ao relatório e reprova com ela, ao lado do erro
// original.
//
// `entregar`, e não `use`, no 2º parâmetro do fixture (é posicional): o lint
// trata `use` como o hook do React e acusa `rules-of-hooks`.
const test = testeBase.extend<Vigias>({
  problemas: async ({ page }, entregar, testInfo) => {
    const problemas: string[] = [];
    page.on('console', (mensagem) => {
      const tipo = mensagem.type();
      if (tipo === 'error') problemas.push(`console.error: ${mensagem.text()}`);
      if (tipo === 'warning' && AVISO_DO_REACT.test(mensagem.text())) {
        problemas.push(`console.warn: ${mensagem.text()}`);
      }
    });
    page.on('pageerror', (erro) => problemas.push(`pageerror: ${erro.message}`));

    await entregar(problemas);

    if (problemas.length > 0) {
      await testInfo.attach('console', { body: problemas.join('\n'), contentType: 'text/plain' });
    }
    expect(problemas, 'console limpo').toEqual([]);
  },

  api: async ({ page, baseURL }, entregar, testInfo) => {
    const api = await simularApi(page, new URL(baseURL!).origin);

    await entregar(api);

    if (api.naoGravadas.length > 0) {
      await testInfo.attach('chamadas sem resposta gravada', {
        body: api.naoGravadas.join('\n'),
        contentType: 'text/plain',
      });
    }
    expect(api.naoGravadas, 'chamadas sem resposta gravada em e2e/fixtures').toEqual([]);
  },
});

// ---------------------------------------------------------------------------
// Apoio
// ---------------------------------------------------------------------------

/** Abre uma rota com a DATA FIXA: o mês da tela vem de `mes_sugerido`
 *  (fixture), mas qualquer texto relativo a "hoje" mudaria a captura de um
 *  dia para o outro. */
async function abrir(page: Page, caminho: string): Promise<void> {
  await page.clock.setFixedTime(new Date('2026-09-15T12:00:00-03:00'));
  await page.goto(caminho);
}

/** A página não rola na horizontal (Parte G, em todo passo), e nenhum bloco
 *  do drill com `overflow-x` rola por dentro: a tabela de pilares tem
 *  `min-width` e um transbordo dela aparece só como barra no próprio cartão,
 *  não na página. */
async function semRolagemHorizontal(page: Page): Promise<void> {
  const { largura, janela } = await page.evaluate(() => ({
    largura: document.documentElement.scrollWidth,
    janela: document.documentElement.clientWidth,
  }));
  expect(largura, `rolagem horizontal: scrollWidth ${largura} > clientWidth ${janela}`).toBeLessThanOrEqual(
    janela,
  );
  const transbordos = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('[data-consulta-profundidade] *')]
      .filter((el) => ['auto', 'scroll'].includes(getComputedStyle(el).overflowX))
      .filter((el) => el.scrollWidth > el.clientWidth)
      .map((el) => `${el.tagName} ${el.scrollWidth} > ${el.clientWidth}`),
  );
  expect(transbordos, 'bloco do drill rolando na horizontal').toEqual([]);
}

/** A pessoa VÊ o nível que escolheu (A5, A6): o título está dentro da
 *  janela, abaixo do cabeçalho fixo, e tem o foco. */
async function conferirTituloNaJanela(titulo: Locator, descricao: string): Promise<void> {
  await expect(titulo).toBeFocused();
  const { topo, base, cabecalho, janela } = await titulo.evaluate((el) => {
    const caixa = el.getBoundingClientRect();
    return {
      topo: caixa.top,
      base: caixa.bottom,
      cabecalho:
        Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--altura-cabecalho')) || 0,
      janela: window.innerHeight,
    };
  });
  expect(topo, `${descricao}: título abaixo do cabeçalho fixo (${cabecalho}px)`).toBeGreaterThanOrEqual(cabecalho);
  expect(base, `${descricao}: título dentro da janela (${janela}px)`).toBeLessThanOrEqual(janela);
}

/** Tira a captura PARA A MEMÓRIA, sem gravar (ver `gravar`), depois de
 *  conferir a rolagem horizontal.
 *
 *  CAPTURA DA PÁGINA INTEIRA A PARTIR DO TOPO: com a página rolada, o cabeçalho
 *  fixo sai desenhado no meio da imagem. AS FONTES CARREGADAS ANTES: sem isso
 *  a imagem pode sair com a fonte reserva. COM UM MODAL ABERTO, só a janela
 *  (`paginaInteira: false`): o fundo escuro do modal é fixo e, na página
 *  inteira, cobriria só a primeira altura de janela. */
async function fotografar(page: Page, { paginaInteira = true } = {}): Promise<Buffer> {
  // A REDE PARADA ANTES DE CONFERIR: uma chamada sem resposta gravada que saísse
  // depois da conferência passaria.
  await page.waitForLoadState('networkidle');
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await semRolagemHorizontal(page);
  // SÓ A PÁGINA INTEIRA VOLTA AO TOPO: na captura da janela (modal aberto),
  // rolar ao topo mostraria o modal sobre a Jornada, longe da lista de onde
  // ele abriu.
  if (paginaInteira) await page.evaluate(() => window.scrollTo(0, 0));
  return page.screenshot({ fullPage: paginaInteira });
}

/** Grava a captura em `docs/consulta-profundidade/qa/<nome>.png`.
 *
 *  A EVIDÊNCIA SÓ É GRAVADA DEPOIS DAS CONFERÊNCIAS: as vigias são conferidas
 *  e só então o arquivo versionado é sobrescrito. Uma execução que reprova
 *  não troca a captura boa por uma tela quebrada. */
function gravar(nome: string, imagem: Buffer, { api, problemas }: Vigias): void {
  expect(api.naoGravadas, 'chamadas sem resposta gravada em e2e/fixtures').toEqual([]);
  expect(problemas, 'console limpo').toEqual([]);

  mkdirSync(CAPTURAS, { recursive: true });
  writeFileSync(join(CAPTURAS, `${nome}.png`), imagem);
}

/** Fotografa e grava: o passo inteiro já foi conferido antes de chamar. */
async function capturar(page: Page, nome: string, vigias: Vigias): Promise<void> {
  gravar(nome, await fotografar(page), vigias);
}

/** O conteúdo do drill (a raiz `ConsultaEmProfundidade`). */
function drillDe(page: Page): Locator {
  return page.locator('[data-consulta-profundidade]');
}

function botaoDoDrill(page: Page): Locator {
  return page.getByRole('button', { name: /^Drill down/ });
}

function abaDaLente(page: Page, nome: string): Locator {
  return page.getByRole('tablist', { name: 'Lente do Score' }).getByRole('tab', { name: nome });
}

function trilhaDe(page: Page): Locator {
  return page.getByRole('navigation', { name: 'Trilha da consulta' });
}

/** Linha navegável da tabela de impacto (é um link com `data-linha`). Os
 *  nomes de pilar também são links no cartão "O que mudou" (A16), por isso a
 *  busca é pela linha, e não pelo papel. */
function linhaDaTabela(page: Page, nome: string): Locator {
  return drillDe(page).locator('a[data-linha="navegavel"]', { hasText: nome });
}

/** Linhas da lista de matérias do Nível 4. */
function linhasDaLista(page: Page): Locator {
  return drillDe(page).locator('[role="row"][data-item]');
}

function busca(page: Page): Locator {
  return page.getByRole('combobox', { name: 'Buscar uma lente, veículo, rede, tema ou concessionária' });
}

/** O h2 do nível, que leva o nome do nó (ou o título da tabela no Nível 1). */
function tituloDoNivel(page: Page, nome: string): Locator {
  return drillDe(page).getByRole('heading', { level: 2, name: nome, exact: true });
}

async function conferirNivel(page: Page, nivel: 1 | 2 | 3 | 4): Promise<void> {
  await expect(drillDe(page).getByText(`Nível ${nivel} de 4`)).toBeVisible();
}

/** Nível 1 da Imprensa (passo 1): tabela de pilares, os dois grupos com as
 *  somas, o selo e NENHUM número de nota (D1). */
async function conferirNivel1DaImprensa(page: Page): Promise<void> {
  const drill = drillDe(page);
  await conferirNivel(page, 1);
  await expect(tituloDoNivel(page, TITULO_DOS_PILARES_DA_IMPRENSA)).toBeVisible();
  // O grupo é o cabeçalho (h4) mais a soma ao lado, no mesmo pai.
  await expect(drill.getByRole('heading', { level: 4, name: 'O que pressiona' }).locator('xpath=..')).toContainText(
    `${MENOS}11,1 pt`,
  );
  await expect(drill.getByRole('heading', { level: 4, name: 'O que sustenta' }).locator('xpath=..')).toContainText(
    '+3,1 pt',
  );
  await expect(drill.getByText('Dados ilustrativos').first()).toBeVisible();
  expect(await drill.innerText(), 'nenhum "42" de nota no drill (D1)').not.toMatch(NOTA_42);
  await expect(drill.getByText('= nota')).toHaveCount(0);
}

/** Nível 1 do Mercado (passo 13): cartões do JSON e tabela sem link nem seta. */
async function conferirNivel1DoMercado(page: Page): Promise<void> {
  const drill = drillDe(page);
  await expect(abaDaLente(page, 'Mercado')).toHaveAttribute('aria-selected', 'true');
  await conferirNivel(page, 1);
  await expect(tituloDoNivel(page, TITULO_DOS_PILARES_DO_MERCADO)).toBeVisible();
  await expect(drill.getByText('Temas financeiros', { exact: true })).toBeVisible();
  await expect(drill.getByText('Sinais do mercado no mês', { exact: true })).toBeVisible();
  await expect(drill.locator('[data-linha="fixa"]')).toHaveCount(7);
  await expect(drill.locator('a[data-linha]')).toHaveCount(0);
  await expect(drill.locator('[data-seta]')).toHaveCount(0);
}

/** Pressiona Tab até o foco chegar em `alvo`; reprova se não chegar. */
async function tabAte(page: Page, alvo: Locator, descricao: string, maximo = 250): Promise<void> {
  const alvoUnico = alvo.first();
  await expect(alvoUnico).toBeAttached();
  for (let i = 0; i < maximo; i += 1) {
    await page.keyboard.press('Tab');
    if (await alvoUnico.evaluate((el) => el === document.activeElement)) return;
  }
  throw new Error(`Tab não alcançou ${descricao} em ${maximo} toques`);
}

/** O elemento focado mostra o anel de foco (`:focus-visible` do `index.css`). */
async function conferirFocoVisivel(alvo: Locator, descricao: string): Promise<void> {
  const visivel = await alvo.first().evaluate((el) => {
    const estilo = getComputedStyle(el);
    return (
      el === document.activeElement &&
      el.matches(':focus-visible') &&
      estilo.outlineStyle !== 'none' &&
      Number.parseFloat(estilo.outlineWidth) > 0
    );
  });
  expect(visivel, `foco visível em ${descricao}`).toBe(true);
}

// ---------------------------------------------------------------------------
// Fumaça
// ---------------------------------------------------------------------------

test('fumaça: aba Lentes na Imprensa, bloco Drill down abre', async ({ page, api, problemas }) => {
  await abrir(page, '/score/lentes');

  await expect(abaDaLente(page, 'Imprensa')).toHaveAttribute('aria-selected', 'true');

  const drill = botaoDoDrill(page);
  await expect(drill).toHaveAttribute('aria-expanded', 'false');
  await drill.click();
  await expect(drill).toHaveAttribute('aria-expanded', 'true');

  await capturar(page, '00-fumaca', { api, problemas });
});

// ---------------------------------------------------------------------------
// Roteiro G · passos 1 a 12 (Imprensa, em sequência: cada passo parte do
// estado do anterior, como na demonstração)
// ---------------------------------------------------------------------------

test('roteiro G, passos 1 a 12: a descida da Imprensa, a história e a busca', async ({
  page,
  api,
  problemas,
}) => {
  test.setTimeout(180_000);
  const vigias = { api, problemas };
  const drill = drillDe(page);

  // 1 · abrir a aba Lentes e expandir o "Drill down": Nível 1 da Imprensa.
  await abrir(page, '/score/lentes');
  await expect(abaDaLente(page, 'Imprensa')).toHaveAttribute('aria-selected', 'true');
  await botaoDoDrill(page).click();
  await expect(botaoDoDrill(page)).toHaveAttribute('aria-expanded', 'true');
  await conferirNivel1DaImprensa(page);
  // ABRIR O BLOCO NÃO ESCREVE HASH (A20): só navegar no drill escreve.
  expect(new URL(page.url()).hash).toBe('');
  await capturar(page, '01-nivel1-imprensa', vigias);

  // 2 · cartões laterais: "O que mudou" sem o par de notas (D1) e a história.
  const oQueMudou = drill.locator('.cartao', { hasText: 'O que mudou desde julho' });
  await expect(oQueMudou).toBeVisible();
  const textoDoQueMudou = await oQueMudou.innerText();
  expect(textoDoQueMudou, 'sem "48" no cartão O que mudou (D1)').not.toMatch(NOTA_48);
  expect(textoDoQueMudou, 'sem "42" no cartão O que mudou (D1)').not.toMatch(NOTA_42);
  await expect(drill.getByText('Rompimento de adutora na Zona Norte do Rio', { exact: true })).toBeVisible();
  await capturar(page, '02-cartoes-laterais', vigias);

  // 3 · a linha de Eficiência desce ao Nível 2.
  await linhaDaTabela(page, 'Eficiência Operacional e Qualidade').click();
  await expect(page).toHaveURL(/#consulta&.*pilar=eficiencia-operacional/);
  await conferirNivel(page, 2);
  await expect(trilhaDe(page).getByRole('listitem')).toHaveCount(2);
  await expect(tituloDoNivel(page, 'Eficiência Operacional e Qualidade')).toBeFocused();
  await expect(linhaDaTabela(page, 'Abastecimento de água')).toContainText('Em destaque');
  await expect(drill.locator('p', { hasText: 'A conta fecha' })).toContainText(`${MENOS}7,4 pt`);
  await capturar(page, '03-nivel2-eficiencia', vigias);

  // 4 · Abastecimento de água desce ao Nível 3.
  await linhaDaTabela(page, 'Abastecimento de água').click();
  await expect(page).toHaveURL(/tema=abastecimento-agua/);
  await conferirNivel(page, 3);
  await expect(
    drill.getByRole('heading', { name: 'Rompimento de adutora responde por dois terços da perda do tema' }),
  ).toBeVisible();
  const verAsMaterias = drill.getByRole('button', { name: 'Ver as 96 matérias' });
  await expect(verAsMaterias).toBeVisible();
  await capturar(page, '04-nivel3-abastecimento', vigias);

  // 5 · "Ver as 96 matérias" abre o Nível 4 com a amostra inteira.
  await verAsMaterias.click();
  await expect(page).toHaveURL(/subtema=rompimento-adutora/);
  await conferirNivel(page, 4);
  await expect(tituloDoNivel(page, 'Rompimento de adutora')).toBeFocused();
  await expect(linhasDaLista(page)).toHaveCount(11);
  await expect(linhasDaLista(page).first()).toContainText('Rompimento de adutora deixa 14 bairros');
  await capturar(page, '05-nivel4-rompimento', vigias);

  // 6 · Negativas e depois Data: 9 linhas, a primeira é a de 19/08 (Zero Hora).
  await drill.getByRole('button', { name: 'Negativas 71' }).click();
  await drill.getByRole('button', { name: 'Data', exact: true }).click();
  await expect(page).toHaveURL(/sent=negativas/);
  await expect(page).toHaveURL(/ordem=data/);
  await expect(linhasDaLista(page)).toHaveCount(9);
  const primeira = linhasDaLista(page).first();
  await expect(primeira).toContainText('19/08');
  await expect(primeira).toContainText('Zero Hora');
  await capturar(page, '06-negativas-por-data', vigias);

  // 7 · "Abrir matéria" da primeira linha abre a prévia; Esc fecha e o foco
  // volta ao botão. A captura é da prévia aberta, gravada só depois de o
  // fechamento também passar.
  const abrirMateria = primeira.getByRole('button', { name: /Abrir matéria/ });
  await abrirMateria.click();
  const previa = page.getByRole('dialog', {
    name: /Rompimento em rede de Canoas deixa bairros sem água por 20 horas/,
  });
  await expect(previa).toBeVisible();
  await expect(previa).toContainText('O link para a fonte original entra com a integração do clipping.');
  const imagemDaPrevia = await fotografar(page, { paginaInteira: false });
  await page.keyboard.press('Escape');
  await expect(previa).toBeHidden();
  await expect(abrirMateria).toBeFocused();
  gravar('07-previa-da-materia', imagemDaPrevia, vigias);

  // 8 · "Imprensa" na trilha volta ao Nível 1.
  await trilhaDe(page).getByRole('link', { name: 'Imprensa', exact: true }).click();
  await conferirNivel1DaImprensa(page);
  expect(new URL(page.url()).hash).toBe('#consulta&lente=imprensa');
  await capturar(page, '08-trilha-volta-ao-nivel1', vigias);

  // 9 · voltar do navegador: Nível 4 com Negativas e Data preservados.
  await page.goBack();
  await conferirNivel(page, 4);
  await expect(drill.getByRole('button', { name: 'Negativas 71' })).toHaveAttribute('aria-pressed', 'true');
  await expect(drill.getByRole('button', { name: 'Data', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(linhasDaLista(page)).toHaveCount(9);
  await expect(linhasDaLista(page).first()).toContainText('Zero Hora');
  await capturar(page, '09-voltar-do-navegador', vigias);

  // 10 · "adutora" na busca do cabeçalho: o grupo do drill com o subtema.
  await busca(page).click();
  await busca(page).fill('adutora');
  const lista = page.getByRole('listbox');
  await expect(lista).toBeVisible();
  await expect(lista.getByText('Consulta em profundidade', { exact: true })).toBeVisible();
  const opcaoDoSubtema = page
    .getByRole('group', { name: 'Consulta em profundidade · Subtema' })
    .getByRole('option')
    .filter({ hasText: 'Rompimento de adutora' });
  await expect(opcaoDoSubtema).toHaveCount(1);
  await expect(opcaoDoSubtema).toContainText(`${MENOS}3,1 pt`);
  await capturar(page, '10-busca-adutora', vigias);

  // 11 · Enter abre o primeiro resultado: o Nível 4 de Rompimento de adutora,
  // com a lista limpa (a busca leva ao subtema, sem os filtros de antes).
  await busca(page).press('Enter');
  await expect(lista).toBeHidden();
  await expect(botaoDoDrill(page)).toHaveAttribute('aria-expanded', 'true');
  await conferirNivel(page, 4);
  await expect(tituloDoNivel(page, 'Rompimento de adutora')).toBeVisible();
  await conferirTituloNaJanela(tituloDoNivel(page, 'Rompimento de adutora'), 'passo 11');
  expect(new URL(page.url()).hash).toBe(
    '#consulta&lente=imprensa&pilar=eficiencia-operacional&tema=abastecimento-agua&subtema=rompimento-adutora',
  );
  await expect(drill.getByRole('button', { name: 'Todas 96' })).toHaveAttribute('aria-pressed', 'true');
  await expect(linhasDaLista(page)).toHaveCount(11);
  await capturar(page, '11-enter-abre-o-nivel4', vigias);

  // 12 · "fiscalizacao" (sem acento) e clique no subtema: 7 linhas.
  await busca(page).click();
  await busca(page).fill('fiscalizacao');
  await page
    .getByRole('group', { name: 'Consulta em profundidade · Subtema' })
    .getByRole('option')
    .filter({ hasText: 'Fiscalização regulatória' })
    .click();
  await expect(page).toHaveURL(/subtema=fiscalizacao-regulatoria/);
  await conferirNivel(page, 4);
  await expect(tituloDoNivel(page, 'Fiscalização regulatória')).toBeVisible();
  await conferirTituloNaJanela(tituloDoNivel(page, 'Fiscalização regulatória'), 'passo 12');
  await expect(linhasDaLista(page)).toHaveCount(7);
  await capturar(page, '12-busca-fiscalizacao', vigias);
});

// ---------------------------------------------------------------------------
// Roteiro G · passos 13 a 16 (adaptados pela D2)
// ---------------------------------------------------------------------------

test('roteiro G, passos 13 a 16: Mercado no Nível 1; nas outras lentes o bloco não aparece', async ({
  page,
  api,
  problemas,
}) => {
  test.setTimeout(120_000);
  const vigias = { api, problemas };
  const drill = drillDe(page);

  await abrir(page, '/score/lentes');
  await botaoDoDrill(page).click();
  await conferirNivel1DaImprensa(page);

  // 13 · aba Mercado: o drill continua aberto, no Nível 1 do Mercado.
  await abaDaLente(page, 'Mercado').click();
  await expect(botaoDoDrill(page)).toHaveAttribute('aria-expanded', 'true');
  await conferirNivel1DoMercado(page);
  await capturar(page, '13-mercado-nivel1', vigias);

  // 14 · Sociedade digital: sem bloco "Drill down" (D2).
  await abaDaLente(page, 'Sociedade digital').click();
  await expect(abaDaLente(page, 'Sociedade digital')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('button', { name: /^Síntese executiva/ })).toBeVisible();
  await expect(botaoDoDrill(page)).toHaveCount(0);
  await expect(drill).toHaveCount(0);
  await capturar(page, '14-sociedade-sem-drill', vigias);

  // 15 · Clientes e Institucional: idem.
  for (const [nome, arquivo] of [
    ['Clientes', '15a-clientes-sem-drill'],
    ['Institucional', '15b-institucional-sem-drill'],
  ] as const) {
    await abaDaLente(page, nome).click();
    await expect(abaDaLente(page, nome)).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('button', { name: /^Síntese executiva/ })).toBeVisible();
    await expect(botaoDoDrill(page)).toHaveCount(0);
    await expect(drill).toHaveCount(0);
    await capturar(page, arquivo, vigias);
  }

  // 16 · no Mercado, a linha de pilar não navega, não tem seta nem cursor de
  // mão.
  await abaDaLente(page, 'Mercado').click();
  await conferirNivel1DoMercado(page);
  const linha = drill.locator('[data-linha="fixa"]', { hasText: 'Governança' });
  await expect(linha).toHaveCount(1);
  const antes = page.url();
  const historiaAntes = await page.evaluate(() => history.length);
  await linha.click();
  expect(page.url()).toBe(antes);
  expect(await page.evaluate(() => history.length)).toBe(historiaAntes);
  await conferirNivel1DoMercado(page);
  expect(await linha.evaluate((el) => getComputedStyle(el).cursor)).toBe('default');
  await expect(linha.locator('[data-seta]')).toHaveCount(0);
  await capturar(page, '16-mercado-linha-sem-navegacao', vigias);
});

// ---------------------------------------------------------------------------
// Roteiro G · passos 17 a 19 (endereço direto)
// ---------------------------------------------------------------------------

const ENDERECO_DA_FISCALIZACAO =
  '#consulta&lente=imprensa&pilar=governanca&tema=contratos-regulacao&subtema=fiscalizacao-regulatoria';

test('roteiro G, passo 17: endereço direto do Nível 4 e recarregar reabrem a mesma tela', async ({
  page,
  api,
  problemas,
}) => {
  const vigias = { api, problemas };

  const conferir = async () => {
    await expect(botaoDoDrill(page)).toHaveAttribute('aria-expanded', 'true');
    await conferirNivel(page, 4);
    await expect(tituloDoNivel(page, 'Fiscalização regulatória')).toBeVisible();
    await expect(linhasDaLista(page)).toHaveCount(7);
    expect(new URL(page.url()).hash).toBe(ENDERECO_DA_FISCALIZACAO);
  };

  await abrir(page, `/score/lentes${ENDERECO_DA_FISCALIZACAO}`);
  await conferir();
  await page.reload();
  await conferir();
  await capturar(page, '17-endereco-direto-recarregado', vigias);
});

test('roteiro G, passo 18: endereço inválido cai no Nível 1, corrigido com replace', async ({
  page,
  api,
  problemas,
}) => {
  const vigias = { api, problemas };
  // O TAMANHO DA HISTÓRIA NO INÍCIO DO DOCUMENTO, antes de o React montar: a
  // correção roda logo na montagem, e medir depois já seria tarde.
  await page.addInitScript(() => {
    (window as unknown as { historiaNoInicio: number }).historiaNoInicio = history.length;
  });

  await abrir(page, '/score/lentes#consulta&lente=imprensa&pilar=xyz&tema=abc');
  await expect(botaoDoDrill(page)).toHaveAttribute('aria-expanded', 'true');
  await conferirNivel1DaImprensa(page);
  await expect.poll(() => new URL(page.url()).hash).toBe('#consulta&lente=imprensa');
  const { agora, noInicio } = await page.evaluate(() => ({
    agora: history.length,
    noInicio: (window as unknown as { historiaNoInicio: number }).historiaNoInicio,
  }));
  expect(agora, 'a correção usa replace: a história não cresce').toBe(noInicio);
  await capturar(page, '18-endereco-invalido-corrigido', vigias);
});

test('roteiro G, passo 19: Mercado com pilar no endereço fica no Nível 1', async ({ page, api, problemas }) => {
  const vigias = { api, problemas };

  await abrir(page, '/score/lentes#consulta&lente=mercado&pilar=governanca');
  await expect(botaoDoDrill(page)).toHaveAttribute('aria-expanded', 'true');
  await conferirNivel1DoMercado(page);
  await expect.poll(() => new URL(page.url()).hash).toBe('#consulta&lente=mercado');
  await capturar(page, '19-mercado-com-pilar-no-endereco', vigias);
});

// ---------------------------------------------------------------------------
// Dados reais (D5): o endpoint `/consulta` responde com `aviso` vazio e com os
// nós de fechamento ('sem-pilar', 'sem-tema', 'sem-subtema')
// ---------------------------------------------------------------------------

test('dados reais sem selo: o selo não aparece e a linha "Sem tema identificado" não tem seta', async ({
  page,
  api,
  problemas,
}) => {
  const vigias = { api, problemas };
  api.responder('/api/score/lentes/imprensa/consulta', consultaReal());
  const drill = drillDe(page);

  await abrir(page, '/score/lentes#consulta&lente=imprensa&pilar=eficiencia-operacional');
  await expect(botaoDoDrill(page)).toHaveAttribute('aria-expanded', 'true');
  await conferirNivel(page, 2);
  await expect(tituloDoNivel(page, 'Eficiência Operacional e Qualidade')).toBeVisible();

  // O mês e o corte continuam no topo; o selo some do topo e do indicador.
  await expect(drill.getByText('Agosto de 2026 · corte em 31/08/2026')).toBeVisible();
  await expect(drill.getByText(AVISO_ILUSTRATIVO)).toHaveCount(0);

  // A linha de fechamento entra na tabela, mas não abre nada.
  const fechamento = drill.locator('[data-linha]', { hasText: 'Sem tema identificado' });
  await expect(fechamento).toHaveCount(1);
  await expect(fechamento).toHaveAttribute('data-linha', 'fixa');
  await expect(fechamento).toHaveAttribute('title', 'Sem vínculo com a taxonomia de temas');
  await expect(fechamento.locator('[data-seta]')).toHaveCount(0);
  await expect(drill.locator('a[data-linha]', { hasText: 'Sem tema identificado' })).toHaveCount(0);
  // O endereço não foi corrigido: o pilar existe no mês.
  expect(new URL(page.url()).hash).toBe('#consulta&lente=imprensa&pilar=eficiencia-operacional');

  // A busca do cabeçalho: o grupo do drill sem o selo e sem o nó de fechamento.
  await busca(page).click();
  await busca(page).fill('adutora');
  const lista = page.getByRole('listbox');
  await expect(lista.getByText('Consulta em profundidade', { exact: true })).toBeVisible();
  await expect(lista.getByText(AVISO_ILUSTRATIVO)).toHaveCount(0);
  await busca(page).fill('identificado');
  await expect(lista.getByText('Sem tema identificado')).toHaveCount(0);
  await busca(page).press('Escape');

  await capturar(page, '21-dados-reais-sem-selo', vigias);
});

// ---------------------------------------------------------------------------
// Navegação: busca com o bloco fechado, voltar entre lentes, aba ativa
// ---------------------------------------------------------------------------

/** Registra cada `pushState`/`replaceState` da página em `window.registro`. */
async function registrarHistoria(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const registro: string[] = [];
    (window as unknown as { registro: string[] }).registro = registro;
    for (const nome of ['pushState', 'replaceState'] as const) {
      const original = history[nome].bind(history);
      history[nome] = (dado: unknown, titulo: string, url?: string | URL | null) => {
        registro.push(`${nome === 'pushState' ? 'push' : 'replace'} ${String(url)}`);
        original(dado, titulo, url);
      };
    }
  });
}

async function registroDaHistoria(page: Page): Promise<string[]> {
  return page.evaluate(() => [...(window as unknown as { registro: string[] }).registro]);
}

test('A6: a busca abre o bloco e mostra o nível escolhido, vindo da Visão geral ou do Mercado', async ({
  page,
  api,
  problemas,
}) => {
  test.setTimeout(120_000);
  const titulo = tituloDoNivel(page, 'Rompimento de adutora');

  // Da Visão geral.
  await abrir(page, '/score/geral');
  await busca(page).click();
  await busca(page).fill('adutora');
  await expect(page.getByRole('group', { name: 'Consulta em profundidade · Subtema' })).toBeVisible();
  await busca(page).press('Enter');
  await expect(botaoDoDrill(page)).toHaveAttribute('aria-expanded', 'true');
  await conferirNivel(page, 4);
  await conferirTituloNaJanela(titulo, 'da Visão geral');

  // Das Lentes com o bloco fechado, no Mercado.
  await abrir(page, '/score/lentes');
  await abaDaLente(page, 'Mercado').click();
  await expect(botaoDoDrill(page)).toHaveAttribute('aria-expanded', 'false');
  await busca(page).click();
  await busca(page).fill('adutora');
  await expect(page.getByRole('group', { name: 'Consulta em profundidade · Subtema' })).toBeVisible();
  await busca(page).press('Enter');
  await expect(abaDaLente(page, 'Imprensa')).toHaveAttribute('aria-selected', 'true');
  await conferirNivel(page, 4);
  await conferirTituloNaJanela(titulo, 'do Mercado com o bloco fechado');

  expect(api.naoGravadas).toEqual([]);
  expect(problemas).toEqual([]);
});

test('voltar do navegador depois de trocar de lente volta à lente e ao nível, sem regravar a história', async ({
  page,
  api,
  problemas,
}) => {
  test.setTimeout(120_000);
  await registrarHistoria(page);
  await abrir(page, '/score/lentes');
  await botaoDoDrill(page).click();
  await linhaDaTabela(page, 'Eficiência Operacional e Qualidade').click();
  await conferirNivel(page, 2);
  const enderecoDoNivel2 = new URL(page.url()).hash;
  await linhaDaTabela(page, 'Abastecimento de água').click();
  await conferirNivel(page, 3);

  // A ABA DA LENTE SUBSTITUI a entrada do Nível 3 (A4: replace), então
  // voltar leva à entrada anterior, a do Nível 2 da Imprensa.
  await abaDaLente(page, 'Mercado').click();
  await conferirNivel1DoMercado(page);
  expect(new URL(page.url()).hash).toBe('#consulta&lente=mercado');

  const antes = (await registroDaHistoria(page)).length;
  await page.goBack();
  await expect(abaDaLente(page, 'Imprensa')).toHaveAttribute('aria-selected', 'true');
  await conferirNivel(page, 2);
  expect(new URL(page.url()).hash).toBe(enderecoDoNivel2);
  expect((await registroDaHistoria(page)).slice(antes), 'voltar não regrava a história').toEqual([]);

  // E avançar devolve o Mercado.
  await page.goForward();
  await expect(abaDaLente(page, 'Mercado')).toHaveAttribute('aria-selected', 'true');
  expect(new URL(page.url()).hash).toBe('#consulta&lente=mercado');

  expect(api.naoGravadas).toEqual([]);
  expect(problemas).toEqual([]);
});

test('voltar do navegador com a página rolada deixa o título do nível à vista (A5)', async ({
  page,
  api,
  problemas,
}) => {
  test.setTimeout(120_000);
  await abrir(page, '/score/lentes');
  await botaoDoDrill(page).click();
  await linhaDaTabela(page, 'Eficiência Operacional e Qualidade').click();
  await linhaDaTabela(page, 'Abastecimento de água').click();
  await drillDe(page).getByRole('button', { name: 'Ver as 96 matérias' }).click();
  await conferirNivel(page, 4);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));

  await page.goBack();
  await conferirNivel(page, 3);
  await conferirTituloNaJanela(tituloDoNivel(page, 'Abastecimento de água'), 'voltar ao Nível 3');

  await page.goBack();
  await conferirNivel(page, 2);
  await conferirTituloNaJanela(tituloDoNivel(page, 'Eficiência Operacional e Qualidade'), 'voltar ao Nível 2');

  await page.goForward();
  await conferirNivel(page, 3);
  await conferirTituloNaJanela(tituloDoNivel(page, 'Abastecimento de água'), 'avançar ao Nível 3');

  expect(api.naoGravadas).toEqual([]);
  expect(problemas).toEqual([]);
});

test('clicar na aba ativa ou em "Lentes" no cabeçalho não tira o drill do nível', async ({
  page,
  api,
  problemas,
}) => {
  test.setTimeout(120_000);
  await abrir(page, `/score/lentes${ENDERECO_DA_FISCALIZACAO}`);
  await conferirNivel(page, 4);
  const historia = await page.evaluate(() => history.length);

  await abaDaLente(page, 'Imprensa').click();
  await conferirNivel(page, 4);
  expect(new URL(page.url()).hash).toBe(ENDERECO_DA_FISCALIZACAO);

  await page.getByRole('button', { name: 'Lentes', exact: true }).click();
  await conferirNivel(page, 4);
  expect(new URL(page.url()).hash).toBe(ENDERECO_DA_FISCALIZACAO);
  expect(await page.evaluate(() => history.length)).toBe(historia);

  expect(api.naoGravadas).toEqual([]);
  expect(problemas).toEqual([]);
});

// ---------------------------------------------------------------------------
// Roteiro G · passo 20 (só teclado, do passo 1 ao 5)
// ---------------------------------------------------------------------------

test('roteiro G, passo 20: do Nível 1 ao 4 só com o teclado, com foco visível', async ({
  page,
  api,
  problemas,
}) => {
  test.setTimeout(120_000);
  const vigias = { api, problemas };

  await abrir(page, '/score/lentes');
  await expect(abaDaLente(page, 'Imprensa')).toHaveAttribute('aria-selected', 'true');

  // O bloco: Tab até o cabeçalho "Drill down" e Enter.
  await tabAte(page, botaoDoDrill(page), 'o botão "Drill down"');
  await conferirFocoVisivel(botaoDoDrill(page), 'o botão "Drill down"');
  await page.keyboard.press('Enter');
  await expect(botaoDoDrill(page)).toHaveAttribute('aria-expanded', 'true');
  await conferirNivel1DaImprensa(page);

  // Nível 1 → 2: a linha de Eficiência.
  const eficiencia = linhaDaTabela(page, 'Eficiência Operacional e Qualidade');
  await tabAte(page, eficiencia, 'a linha de Eficiência Operacional e Qualidade');
  await conferirFocoVisivel(eficiencia, 'a linha de Eficiência Operacional e Qualidade');
  await page.keyboard.press('Enter');
  await conferirNivel(page, 2);
  await expect(tituloDoNivel(page, 'Eficiência Operacional e Qualidade')).toBeFocused();

  // Nível 2 → 3: a linha de Abastecimento de água.
  const abastecimento = linhaDaTabela(page, 'Abastecimento de água');
  await tabAte(page, abastecimento, 'a linha de Abastecimento de água');
  await conferirFocoVisivel(abastecimento, 'a linha de Abastecimento de água');
  await page.keyboard.press('Enter');
  await conferirNivel(page, 3);
  await expect(tituloDoNivel(page, 'Abastecimento de água')).toBeFocused();

  // Nível 3 → 4: o botão "Ver as 96 matérias" do cartão de recortes.
  const verAsMaterias = drillDe(page).getByRole('button', { name: 'Ver as 96 matérias' });
  await tabAte(page, verAsMaterias, 'o botão "Ver as 96 matérias"');
  await conferirFocoVisivel(verAsMaterias, 'o botão "Ver as 96 matérias"');
  await page.keyboard.press('Enter');
  await conferirNivel(page, 4);
  await expect(tituloDoNivel(page, 'Rompimento de adutora')).toBeFocused();
  await expect(linhasDaLista(page)).toHaveCount(11);

  // E a lista continua no teclado: o primeiro "Abrir matéria" é alcançável.
  const abrirMateria = linhasDaLista(page).first().getByRole('button', { name: /Abrir matéria/ });
  await tabAte(page, abrirMateria, 'o primeiro "Abrir matéria"');
  await conferirFocoVisivel(abrirMateria, 'o primeiro "Abrir matéria"');
  await capturar(page, '20-teclado-ate-o-nivel4', vigias);
});

// ---------------------------------------------------------------------------
// Outras resoluções: passos 1, 3, 5 e 13, só captura e rolagem horizontal
// ---------------------------------------------------------------------------

for (const { width, height } of [
  { width: 1280, height: 720 },
  { width: 1366, height: 768 },
  { width: 1920, height: 1080 },
]) {
  const sufixo = `${width}x${height}`;

  test.describe(`em ${sufixo}`, () => {
    test.use({ viewport: { width, height } });

    test(`passos 1, 3, 5 e 13 em ${sufixo}`, async ({ page, api, problemas }) => {
      test.setTimeout(120_000);
      const vigias = { api, problemas };

      await abrir(page, '/score/lentes');
      await botaoDoDrill(page).click();
      await conferirNivel(page, 1);
      await capturar(page, `01-nivel1-imprensa-${sufixo}`, vigias);

      await linhaDaTabela(page, 'Eficiência Operacional e Qualidade').click();
      await conferirNivel(page, 2);
      await capturar(page, `03-nivel2-eficiencia-${sufixo}`, vigias);

      await linhaDaTabela(page, 'Abastecimento de água').click();
      await conferirNivel(page, 3);
      await drillDe(page).getByRole('button', { name: 'Ver as 96 matérias' }).click();
      await conferirNivel(page, 4);
      await expect(linhasDaLista(page)).toHaveCount(11);
      await capturar(page, `05-nivel4-rompimento-${sufixo}`, vigias);

      await abaDaLente(page, 'Mercado').click();
      await conferirNivel(page, 1);
      await expect(drillDe(page).getByText('Temas financeiros', { exact: true })).toBeVisible();
      await capturar(page, `13-mercado-nivel1-${sufixo}`, vigias);
    });
  });
}
