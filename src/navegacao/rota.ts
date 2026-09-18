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
import type { Frente, GrupoDeStatus } from '@/dominio/tipos';

/** As telas que têm endereço próprio. */
export type Destino =
  | 'inicio'
  | 'situacao'
  | 'painel'
  | 'explorar'
  | 'base'
  | 'relatorios'
  | 'cadastro'
  | 'admin';

/** Por qual eixo a tela Explorar está agrupando. */
export type Eixo =
  | 'frente'
  | 'situacao'
  | 'desfecho'
  | 'porta-voz'
  | 'interlocutor'
  | 'assunto'
  | 'uf';

export const EIXOS: { eixo: Eixo; rotulo: string }[] = [
  { eixo: 'frente', rotulo: 'Frente' },
  { eixo: 'situacao', rotulo: 'Situação' },
  { eixo: 'desfecho', rotulo: 'Desfecho' },
  { eixo: 'porta-voz', rotulo: 'Porta-voz' },
  { eixo: 'interlocutor', rotulo: 'Interlocutor' },
  { eixo: 'assunto', rotulo: 'Tema' },
  { eixo: 'uf', rotulo: 'UF' },
];

const EIXOS_VALIDOS = new Set<string>(EIXOS.map((e) => e.eixo));

export interface Rota {
  destino: Destino;
  /** A agenda que o endereço aponta, quando aponta uma. */
  agenda?: string;
  /** O que abre POR CIMA da tela de baixo. */
  sobre?: 'ficha' | 'cadeia' | 'editar' | 'nova';
  /** A aba da administração. */
  aba?: string;
  /** O eixo de agrupamento, só em Explorar. */
  eixo?: Eixo;
}

export const ROTA_INICIAL: Rota = { destino: 'inicio' };

/** O caminho vira rota.
 *
 *  Endereço desconhecido cai no início, e não numa tela de erro: um link
 *  antigo ou torto deve levar a algum lugar utilizável.
 */
export function lerCaminho(caminho: string): Rota {
  const partes = caminho.split('/').filter(Boolean);

  if (partes.length === 0) return { destino: 'inicio' };

  const [primeira, segunda, terceira] = partes;

  if (primeira === 'situacao') return { destino: 'situacao' };
  if (primeira === 'painel') return { destino: 'painel' };
  if (primeira === 'base') return { destino: 'base' };
  if (primeira === 'relatorios') return { destino: 'relatorios' };
  if (primeira === 'admin') return { destino: 'admin', aba: segunda };

  if (primeira === 'explorar') return { destino: 'explorar' };

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
    case 'situacao':
      return '/situacao';
    case 'painel':
      return '/painel';
    case 'explorar':
      return '/explorar';
    case 'relatorios':
      return '/relatorios';
    case 'admin':
      return rota.aba ? `/admin/${rota.aba}` : '/admin';
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

/** O eixo pedido na consulta, ou o padrão. */
export function lerEixo(consulta: string): Eixo {
  const pedido = new URLSearchParams(consulta).get('ver');
  return pedido && EIXOS_VALIDOS.has(pedido) ? (pedido as Eixo) : 'frente';
}

/* ------------------------------------------------------- o recorte na URL */

//: Os campos do Recorte que viajam como texto simples. `tags` e `tier` saem
//: daqui porque um é lista e o outro é número — ver abaixo.
const CAMPOS_DE_TEXTO = [
  'periodoPassado', 'periodoFuturo', 'de', 'ate', 'frente', 'unidade', 'uf', 'esfera',
  'clima', 'resultado', 'status', 'grupo', 'entidade', 'subtipo',
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

  const tags = p.get('tags');
  if (tags) recorte.tags = tags.split(',').filter(Boolean);

  return recorte as Recorte;
}

/** O Recorte vira consulta, na ordem dos campos — para o mesmo recorte
 *  produzir sempre o mesmo endereço, e dois links iguais se reconhecerem. */
export function consultaDe(recorte: Recorte, eixo?: Eixo): string {
  const p = new URLSearchParams();

  for (const campo of CAMPOS_DE_TEXTO) {
    const valor = recorte[campo as keyof Recorte];
    if (typeof valor === 'string' && valor) p.set(campo, valor);
  }
  if (recorte.tier) p.set('tier', String(recorte.tier));
  if (recorte.tags?.length) p.set('tags', recorte.tags.join(','));
  if (eixo && eixo !== 'frente') p.set('ver', eixo);

  const texto = p.toString();
  return texto ? `?${texto}` : '';
}

/** O endereço inteiro, para copiar e mandar a alguém. */
export function enderecoDe(rota: Rota, recorte: Recorte, eixo?: Eixo): string {
  return caminhoDe(rota) + consultaDe(recorte, eixo);
}

/** O nome da tela, para a telemetria.
 *
 *  DO CAMINHO, e não do hash: o hash não é escrito por ninguém nesta
 *  aplicação, e leria a mesma tela para todo erro.
 */
export function nomeDaTela(rota: Rota): string {
  if (rota.sobre) return `${rota.destino}:${rota.sobre}`;
  if (rota.destino === 'admin' && rota.aba) return `admin:${rota.aba}`;
  return rota.destino;
}

/** Frente e grupo chegam da URL como texto livre. Validar aqui evita que um
 *  link torto vire um filtro que o backend recusa com 422. */
export function frenteValida(valor: string | undefined, validas: readonly string[]): Frente | undefined {
  return valor && validas.includes(valor) ? (valor as Frente) : undefined;
}

export type { AtalhoDePeriodo, GrupoDeStatus };
