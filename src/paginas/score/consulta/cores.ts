/** Cores da Consulta em profundidade que NÃO TÊM TOKEN em `src/index.css`.
 *
 *  POR QUE UM ARQUIVO SÓ PARA ISTO: a spec (E.1 e Parte F) usa alguns tons
 *  que a plataforma não tinha, e cor solta dentro de componente é o que faz
 *  dois gráficos vizinhos saírem com cinzas quase iguais. Aqui cada valor tem
 *  nome e motivo; os componentes só importam o nome.
 *
 *  QUANDO HÁ TOKEN, O TOKEN VENCE: o turquesa e o vermelho de gráfico, os
 *  selos de sentimento e o selo de perfil já existem como variáveis CSS, e
 *  entram por elas (`var(--…)`), para acompanhar qualquer ajuste de marca.
 *  Por isso, dentro de SVG, estas cores vão em `style={{ fill }}` e não no
 *  atributo `fill`: atributo de apresentação não resolve `var()` em todos os
 *  navegadores.
 */

import type { Sentimento } from './dados/tipos';

/** Eixo zero das barras divergentes e linhas de base dos gráficos (E.1, F.4,
 *  F.5, F.7). */
export const COR_EIXO = '#8C91A4';

/** Neutro de gráfico: segmento neutro da barra de sentimento e a parte
 *  "demais" do gráfico diário (E.1, F.7). */
export const COR_NEUTRO_GRAFICO = '#B0B9C8';

/** Fundo de destaque: linha em destaque da tabela de impacto e a faixa de
 *  dias do gráfico diário (E.4.2, F.7). */
export const COR_FUNDO_DESTAQUE = '#F1F4FD';

/** Linha destacada pelo endereço (`item`) na lista de matérias (F.9); também
 *  o fundo do selo "Tier 1", como no mockup. */
export const COR_LINHA_DESTACADA = '#E6EAFB';

/** Colunas dos meses anteriores no gráfico mês a mês (F.5): versões claras
 *  do vermelho e do turquesa, para o mês atual se destacar. */
export const COR_COLUNA_ANTERIOR_NEGATIVA = '#FFB8BA';
export const COR_COLUNA_ANTERIOR_POSITIVA = '#A2F1E8';

/** Sentimento em gráficos (E.1). Nunca como cor de texto sobre branco: o
 *  contraste não alcança AA (checklist da Parte H). */
export const COR_POSITIVO_GRAFICO = 'var(--turquesa-rio)';
export const COR_NEGATIVO_GRAFICO = 'var(--vermelho-pitanga)';

export const COR_DE_SENTIMENTO_NO_GRAFICO: Record<Sentimento, string> = {
  positivo: COR_POSITIVO_GRAFICO,
  neutro: COR_NEUTRO_GRAFICO,
  negativo: COR_NEGATIVO_GRAFICO,
};

export interface CoresDeSelo {
  texto: string;
  fundo: string;
}

/** Selo neutro (E.1): texto `#44495C` sobre `#EEF1F8`. Também é o do
 *  "Dados ilustrativos" e o dos tiers 2 e 3. */
export const SELO_NEUTRO: CoresDeSelo = { texto: 'var(--cinza-3)', fundo: 'var(--bg-trilho)' };

/** Selos de sentimento, texto sobre fundo (E.1). */
export const SELO_DE_SENTIMENTO: Record<Sentimento, CoresDeSelo> = {
  positivo: { texto: 'var(--ok-fg)', fundo: 'var(--ok-bg)' },
  neutro: SELO_NEUTRO,
  negativo: { texto: 'var(--erro-fg)', fundo: 'var(--erro-bg)' },
};

/** Selo "Tier 1" em azul claro, como no mockup (p. 3 e 5); os demais tiers
 *  usam o selo neutro. */
export const SELO_DE_TIER_1: CoresDeSelo = { texto: 'var(--azul-mar)', fundo: COR_LINHA_DESTACADA };

/** Selo do perfil de quem fala, no post da Sociedade digital (E.8):
 *  `#8A4E00` sobre `#FFF1DC`, que são os tokens de atenção. */
export const SELO_DE_PERFIL: CoresDeSelo = { texto: 'var(--atencao-fg)', fundo: 'var(--atencao-bg)' };

/** Painel flutuante da busca (E.9). */
export const SOMBRA_DO_PAINEL_FLUTUANTE = '0 14px 34px rgba(17, 23, 153, 0.18)';

/** Hover de cartão clicável (E.1); cartão comum não tem sombra extra. */
export const SOMBRA_DO_CARTAO_CLICAVEL = '0 6px 18px rgba(17, 23, 153, 0.08)';

/** Fundo do modal de prévia (decisão A8). */
export const FUNDO_DO_MODAL = 'rgba(25, 27, 35, 0.55)';
