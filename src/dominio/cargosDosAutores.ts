/** A conta do "Tracking dos cargos dos autores" da Sociedade digital.
 *
 *  O SERVIDOR MANDA O MÊS EM GRUPOS `(cargo, autor)` com contagem e peso por
 *  sentimento (`/cargos-dos-autores`), e tudo o mais é soma aqui — o mesmo
 *  contrato do Explorador de veículos (`exploradorDeVeiculos.ts`): o clique num
 *  cargo abre a lista de autores sem voltar ao servidor.
 *
 *  O CARTÃO ABRE NO TOP 5 POR VOLUME, e quem quiser acompanha outro cargo pelo
 *  seletor — o mesmo gesto do "Termômetro por público" do CRM
 *  (`categoriaPublicoExtras` em `Painel.tsx`): "mostre também este cargo", e
 *  não um filtro. O extra entra DEPOIS do topo, sem tirar ninguém de lá.
 *
 *  A MENÇÃO SEM CARGO FICA FORA DO GRÁFICO, por pedido (03/11/2026): ~78% das
 *  linhas da Bites vêm sem a coluna `Cargo`, e uma barra "Sem cargo" seria
 *  sempre a primeira do topo, empurrando um cargo de verdade para fora. Ela
 *  continua contada — `mencoesSemCargo` vira a nota de rodapé do cartão.
 */

import type { GrupoDeCargo } from '@/api/cliente';
import { normalizarBusca } from '@/dominio/texto';

/** Quantos cargos o cartão mostra antes de alguém acrescentar outro. */
export const CARGOS_NO_TOPO = 5;

export interface Somas {
  positivo: number;
  neutro: number;
  negativo: number;
  /** Menções no recorte. */
  total: number;
  /** O termômetro: (positivas − negativas) ÷ total × 100, de −100 a 100 — a
   *  mesma conta do "Termômetro por Veículos" e do CRM. */
  nss: number;
  /** Pontos que este item tira ou põe na nota da lente no mês:
   *  50 × (Σ peso positivo − Σ peso negativo) ÷ denominador. PONDERADO pela
   *  régua vigente (que pode pesar o cargo ou o engajamento), ao contrário do
   *  `nss`. */
  impacto: number;
}

export interface CargoNoTracking extends Somas {
  cargo: string;
}

export interface AutorDoCargo extends Somas {
  autor: string;
}

interface Acumulado {
  pos: number;
  neu: number;
  neg: number;
  wPos: number;
  wNeg: number;
}

function acumular(alvo: Acumulado | undefined, grupo: GrupoDeCargo): Acumulado {
  const atual = alvo ?? { pos: 0, neu: 0, neg: 0, wPos: 0, wNeg: 0 };
  atual.pos += grupo.positivo;
  atual.neu += grupo.neutro;
  atual.neg += grupo.negativo;
  atual.wPos += grupo.peso_positivo;
  atual.wNeg += grupo.peso_negativo;
  return atual;
}

function somas(s: Acumulado, denominador: number): Somas {
  const total = s.pos + s.neu + s.neg;
  return {
    positivo: s.pos,
    neutro: s.neu,
    negativo: s.neg,
    total,
    nss: total ? Math.round(((s.pos - s.neg) / total) * 100) : 0,
    impacto: denominador ? (50 * (s.wPos - s.wNeg)) / denominador : 0,
  };
}

/** Todos os cargos do recorte, do maior volume para o menor. */
export function cargosDoRecorte(grupos: GrupoDeCargo[], denominador: number): CargoNoTracking[] {
  const porCargo = new Map<string, Acumulado>();
  for (const grupo of grupos) {
    if (!grupo.cargo) continue;
    porCargo.set(grupo.cargo, acumular(porCargo.get(grupo.cargo), grupo));
  }
  return [...porCargo.entries()]
    .map(([cargo, s]) => ({ cargo, ...somas(s, denominador) }))
    .sort((a, b) => b.total - a.total || a.cargo.localeCompare(b.cargo, 'pt-BR'));
}

/** As menções do recorte que vieram sem cargo — a nota de rodapé. */
export function mencoesSemCargo(grupos: GrupoDeCargo[]): number {
  return grupos
    .filter((grupo) => !grupo.cargo)
    .reduce((soma, grupo) => soma + grupo.positivo + grupo.neutro + grupo.negativo, 0);
}

/** Os cargos que o cartão desenha: o Top 5 por volume e, depois deles, os que
 *  alguém acrescentou, na ordem em que foram acrescentados.
 *
 *  O EXTRA QUE JÁ ESTÁ NO TOPO NÃO REPETE, e o que sumiu do recorte (trocou o
 *  mês, a UF) some da tela em vez de virar uma barra zerada. */
export function cargosNaTela(cargos: CargoNoTracking[], extras: string[]): CargoNoTracking[] {
  const topo = cargos.slice(0, CARGOS_NO_TOPO);
  const acrescentados = extras
    .filter((cargo) => !topo.some((item) => item.cargo === cargo))
    .map((cargo) => cargos.find((item) => item.cargo === cargo))
    .filter((item): item is CargoNoTracking => Boolean(item));
  return [...topo, ...acrescentados];
}

/** Os cargos que o seletor "+ Acompanhar outro cargo" oferece: os do recorte
 *  que ainda não estão na tela. */
export function cargosParaAcompanhar(
  cargos: CargoNoTracking[],
  naTela: CargoNoTracking[],
): CargoNoTracking[] {
  return cargos.filter((item) => !naTela.some((visivel) => visivel.cargo === item.cargo));
}

/** Os autores de um cargo, do maior impacto na nota para o menor.
 *
 *  "MAIOR IMPACTO" É EM MÓDULO: quem tira 3 pontos pesa mais na leitura que
 *  quem põe 1, e o sinal continua na tela. Empate (o mesmo impacto) cai no
 *  volume, e depois no nome — determinístico, para a lista não pular.
 *
 *  O GRUPO SEM AUTOR FICA FORA: não há autor para mostrar nem post para abrir. */
export function autoresDoCargo(
  grupos: GrupoDeCargo[],
  cargo: string,
  denominador: number,
): AutorDoCargo[] {
  const porAutor = new Map<string, Acumulado>();
  for (const grupo of grupos) {
    if (grupo.cargo !== cargo || !grupo.autor) continue;
    porAutor.set(grupo.autor, acumular(porAutor.get(grupo.autor), grupo));
  }
  return [...porAutor.entries()]
    .map(([autor, s]) => ({ autor, ...somas(s, denominador) }))
    .sort(
      (a, b) =>
        Math.abs(b.impacto) - Math.abs(a.impacto) ||
        b.total - a.total ||
        a.autor.localeCompare(b.autor, 'pt-BR'),
    );
}

/** A busca do popup: um pedaço do nome, sem acento e sem caixa.
 *
 *  O AUTOR É QUASE SEMPRE UM NOME ("Iriel Sachet", "Portal Alvoradense"), e às
 *  vezes um perfil com "@" — por isso o "@" de quem digita é opcional. */
export function buscarAutores(autores: AutorDoCargo[], termo: string): AutorDoCargo[] {
  const procurado = normalizarBusca(termo).replace(/^@/, '');
  if (!procurado) return autores;
  return autores.filter((item) => normalizarBusca(item.autor).includes(procurado));
}
