/** O endereço como estado da aplicação.
 *
 *  O QUE ISTO GARANTE
 *  ------------------
 *    - Toda leitura tem link. "Olha esta cadeia antes da reunião de quinta" é
 *      um endereço que se manda, e não uma captura de tela que envelhece no
 *      e-mail.
 *    - O botão de voltar anda dentro da aplicação, e leva o recorte junto.
 *    - `LimiteDeErro` lê o endereço para saber em que tela o erro aconteceu, e
 *      o endereço está escrito — então o relatório aponta a tela certa.
 *
 *  DUAS METADES, DOIS DONOS
 *  ------------------------
 *  O CAMINHO diz qual tela está aberta e é escrito pela navegação; a CONSULTA
 *  diz qual recorte está aplicado e é escrita pelo provedor do painel. Cada um
 *  mexe só na sua metade, e por isso não brigam pela mesma URL.
 *
 *  Tudo aqui é função pura sobre strings — o que permite testar endereço sem
 *  montar tela e sem tocar em `window`.
 */

import type { Recorte } from '@/dominio/recorte';
import type { AtalhoDePeriodo } from '@/dominio/recorte';
import type { GrupoDeStatus } from '@/dominio/tipos';

/** As telas que têm endereço próprio. */
export type Destino =
  | 'inicio'
  | 'painel'
  | 'base'
  | 'relatorios'
  | 'preparar'
  | 'sinais'
  | 'mercado'
  | 'score'
  | 'cadastro'
  | 'admin'
  | 'compartilhado'
  | 'taxonomia'
  | 'config-score'
  | 'importacao'
  | 'plataforma';

export interface Rota {
  destino: Destino;
  /** A agenda que o endereço aponta, quando aponta uma. */
  agenda?: string;
  /** O que abre POR CIMA da tela de baixo. */
  sobre?: 'ficha' | 'cadeia' | 'editar' | 'nova';
  /** A aba da administração. */
  aba?: string;
  /** A importação que a conferência está mostrando. */
  importacao?: string;
}

/** O caminho vira rota.
 *
 *  Endereço desconhecido cai no início, e não numa tela de erro: um link
 *  antigo ou torto deve levar a algum lugar utilizável.
 */
export function lerCaminho(caminho: string): Rota {
  const partes = caminho.split('/').filter(Boolean);

  if (partes.length === 0) return { destino: 'inicio' };

  const [primeira, segunda, terceira] = partes;

  if (primeira === 'painel') return { destino: 'painel' };
  if (primeira === 'base') return { destino: 'base' };
  if (primeira === 'relatorios') return { destino: 'relatorios' };
  if (primeira === 'preparar') return { destino: 'preparar' };
  if (primeira === 'sinais') return { destino: 'sinais' };
  //: AS ABAS DO MERCADO GANHAM ENDEREÇO, pela mesma razão das do Score: uma
  //: barra cujos itens não são links não se compartilha, não volta no histórico
  //: e não recarrega onde estava. `bonds` é o padrão e NÃO vai na URL — ver
  //: `caminhoDe` abaixo, mesmo tratamento que `geral` recebe no Score.
  //: `?? 'bonds'`, E NÃO `partes[1]` CRU — eu escrevi "mesmo tratamento que
  //: `geral` recebe no Score" e fiz o contrário, com o comentário de nove
  //: linhas que descreve este defeito logo abaixo: `caminhoDe` omite "bonds"
  //: do caminho, então sem o default aqui a volta perde a informação,
  //: `rota.aba` virava `undefined`, e a barra de cima (que compara
  //: `item.aba === abaAtiva` em `Layout.tsx`) nunca marcava "Bonds e
  //: reputação" como aba ativa — só "Importação", que tem segmento na URL.
  if (primeira === 'mercado') return { destino: 'mercado', aba: partes[1] ?? 'bonds' };
  // AS TELAS DO SCORE GANHAM ENDEREÇO, e não é detalhe: elas passaram a ser a
  // barra de cima daquela divisão, e uma barra cujos itens não são links não
  // se compartilha, não volta no histórico e não recarrega onde estava.
  // `?? 'geral'`, E NÃO `segunda` CRU: `caminhoDe` já omite "geral" do
  // caminho (é a aba padrão), então sem o default aqui a volta perde a
  // informação — `rota.aba` virava `undefined`, e a barra de cima (que
  // compara `item.aba === abaAtiva` em `Layout.tsx`) nunca marcava "Visão
  // geral" como a aba ativa, nem entrando direto pela navegação principal
  // nem clicando nela — só as outras abas, que têm segmento próprio na URL.
  if (primeira === 'score') return { destino: 'score', aba: segunda ?? 'geral' };
  if (primeira === 'admin') return { destino: 'admin', aba: segunda };
  // FORA DO PORTAL DO ADMIN DE PROPÓSITO: é o cadastro que ganhou cartão
  // próprio na Início (Instituições e Contatos, Temas, Representantes
  // Aegea), então precisa de endereço próprio também — ver `Inicio.tsx`.
  if (primeira === 'compartilhado') return { destino: 'compartilhado' };
  // FORA DO SCORE DE PROPÓSITO (20/10/2026): a Árvore da taxonomia é só
  // leitura e não exige nenhum portal — ver o comentário em `Inicio.tsx`. Já
  // teve endereço dentro do Score (`/score/metodologia?secao=arvore`); quem
  // guardou aquele link cai no Início, que é o mesmo tratamento de qualquer
  // caminho que não existe mais.
  if (primeira === 'taxonomia') return { destino: 'taxonomia' };
  // CONFIGURAÇÃO MORA JUNTO DO QUE ELA CONFIGURA. A do Score é uma tela, e não
  // uma aba dentro do Score: quem ajusta a régua não está lendo o índice, está
  // mexendo na ferramenta que o produz.
  if (primeira === 'score-config') return { destino: 'config-score', aba: segunda };
  if (primeira === 'plataforma') return { destino: 'plataforma', aba: segunda };
  // A CONFERÊNCIA GANHA ENDEREÇO PRÓPRIO, com o id dentro. 54 agendas não se
  // conferem numa sentada, e sem endereço fechar a aba custaria subir o arquivo
  // de novo — que é justamente o que a tabela da migration 0008 existe para
  // evitar. Com endereço, a pessoa volta de onde parou, e pode mandar o link a
  // quem for decidir uma pendência que não é dela.
  if (primeira === 'importacao') return { destino: 'importacao', importacao: segunda };

  if (primeira === 'agenda') {
    if (!segunda) return { destino: 'base' };
    if (segunda === 'nova') return { destino: 'cadastro', sobre: 'nova' };
    // A ficha e a cadeia abrem SOBRE a Base: aberto a frio, o endereço precisa
    // de uma tela embaixo, e a Base é a que contém aquele registro.
    if (terceira === 'cadeia') {
      return { destino: 'base', agenda: segunda, sobre: 'cadeia' };
    }
    if (terceira === 'editar') {
      return { destino: 'cadastro', agenda: segunda, sobre: 'editar' };
    }
    return { destino: 'base', agenda: segunda, sobre: 'ficha' };
  }

  return { destino: 'inicio' };
}

/** A rota vira caminho. O inverso exato de `lerCaminho`. */
export function caminhoDe(rota: Rota): string {
  switch (rota.destino) {
    case 'inicio':
      return '/';
    case 'painel':
      return '/painel';
    case 'relatorios':
      return '/relatorios';
    case 'preparar':
      return '/preparar';
    case 'sinais':
      return '/sinais';
    case 'mercado':
      return rota.aba && rota.aba !== 'bonds' ? `/mercado/${rota.aba}` : '/mercado';
    case 'score':
      return rota.aba && rota.aba !== 'geral' ? `/score/${rota.aba}` : '/score';
    case 'admin':
      return rota.aba ? `/admin/${rota.aba}` : '/admin';
    case 'compartilhado':
      return '/compartilhado';
    case 'taxonomia':
      return '/taxonomia';
    case 'config-score':
      return rota.aba ? `/score-config/${rota.aba}` : '/score-config';
    case 'plataforma':
      return rota.aba ? `/plataforma/${rota.aba}` : '/plataforma';
    case 'importacao':
      return rota.importacao ? `/importacao/${rota.importacao}` : '/importacao';
    case 'cadastro':
      return rota.agenda ? `/agenda/${rota.agenda}/editar` : '/agenda/nova';
    case 'base':
      if (rota.agenda && rota.sobre === 'cadeia') {
        return `/agenda/${rota.agenda}/cadeia`;
      }
      if (rota.agenda) return `/agenda/${rota.agenda}`;
      return '/base';
  }
}

/* ------------------------------------------------------- o recorte na URL */

//: Os campos do Recorte que viajam como texto simples. `tags` e `tier` saem
//: daqui porque um é lista e o outro é número — ver abaixo.
const CAMPOS_DE_TEXTO = [
  'periodoPassado', 'periodoFuturo', 'de', 'ate', 'frente', 'unidade', 'uf', 'esfera',
  'clima', 'climaEsperado', 'resultado', 'status', 'grupo', 'entidade', 'subtipo',
  'alegacao',
  'portaVoz', 'pessoa', 'q',
] as const;

/** A consulta vira Recorte.
 *
 *  Parâmetro que a tela não conhece é IGNORADO, e não recusado: um link com
 *  um filtro de uma versão futura ainda deve abrir o painel.
 */
export function lerRecorte(consulta: string): Recorte {
  const p = new URLSearchParams(consulta);
  const recorte: Record<string, unknown> = {};

  for (const campo of CAMPOS_DE_TEXTO) {
    const valor = p.get(campo);
    if (valor) recorte[campo] = valor;
  }

  const tier = p.get('tier');
  if (tier && Number.isFinite(Number(tier))) recorte.tier = Number(tier);

  // O DESTAQUE É BOOLEANO, e por isso não cabe em `CAMPOS_DE_TEXTO`: lá o
  // valor entra cru, e `destaque: "false"` seria uma STRING no Recorte — que
  // `paraParametros` mandaria de volta como `destaque=false` por acaso, e
  // todo `=== false` do caminho trataria como verdadeiro.
  //
  // SÓ 'true' E 'false' VALEM. Qualquer outra coisa é descartada, como em
  // `tier` não-numérico: um link estragado abre a Base inteira, e não uma
  // tela com filtro que ninguém pediu.
  const destaque = p.get('destaque');
  if (destaque === 'true' || destaque === 'false') recorte.destaque = destaque === 'true';

  // Repetido (`tags=a&tags=b`), e não separado por vírgula: um nome de tema
  // pode ter vírgula, e partir nela quebraria o nome em dois.
  const tags = p.getAll('tags').filter(Boolean);
  if (tags.length) recorte.tags = tags;

  return recorte as Recorte;
}

/** O Recorte vira consulta, na ordem dos campos — para o mesmo recorte
 *  produzir sempre o mesmo endereço, e dois links iguais se reconhecerem. */
export function consultaDe(recorte: Recorte): string {
  const p = new URLSearchParams();

  for (const campo of CAMPOS_DE_TEXTO) {
    const valor = recorte[campo as keyof Recorte];
    if (typeof valor === 'string' && valor) p.set(campo, valor);
  }
  if (recorte.tier) p.set('tier', String(recorte.tier));
  // `!= null` E NÃO TRUTHINESS: com `if (recorte.destaque)` o filtro "Sem
  // destaque" sairia da URL, e recarregar a página devolveria a base inteira.
  if (recorte.destaque != null) p.set('destaque', String(recorte.destaque));
  for (const tag of recorte.tags ?? []) p.append('tags', tag);

  const texto = p.toString();
  return texto ? `?${texto}` : '';
}

/** O nome da tela, para a telemetria.
 *
 *  DO CAMINHO, e não do hash: o hash não é escrito por ninguém nesta
 *  aplicação, e leria a mesma tela para todo erro.
 */
export function nomeDaTela(rota: Rota): string {
  if (rota.sobre) return `${rota.destino}:${rota.sobre}`;
  if (rota.destino === 'admin' && rota.aba) return `admin:${rota.aba}`;
  //: O MERCADO PASSOU A TER DUAS TELAS, e sem isto as duas chegavam à
  //: telemetria como `mercado`: ler o gráfico e subir a planilha da semana
  //: ficavam indistinguíveis justamente na medida que diria se alguém usa a
  //: importação. O Score não precisa da linha porque já vem por `admin`/`sobre`
  //: ou com aba na URL.
  if (rota.destino === 'mercado' && rota.aba) return `mercado:${rota.aba}`;
  return rota.destino;
}

export type { AtalhoDePeriodo, GrupoDeStatus };
