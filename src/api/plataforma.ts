/** As configurações da plataforma inteira — o que não é de área nenhuma.
 *
 *  Hoje só a trilha das cargas. O Gerenciamento de perfis continua em
 *  `acesso.ts`, porque as rotas dele são de acesso e não da plataforma.
 */

import type { CargaDaBase, ResumoDaBase } from '@/dominio/cargasDasBases';
import { requisitar } from './nucleo';

/**
 * Quando cada base foi carregada, e por quem.
 *
 * SEM PARÂMETRO DE BASE aqui de propósito: a aba filtra em memória. São no
 * máximo 200 eventos, o filtro é instantâneo, e pedir ao servidor a cada clique
 * trocaria uma lista já em mão por uma ida à rede — e o `base` da rota existe
 * para quem quiser consultar uma base só, não para a aba piscar.
 *
 * A ROTA EXIGE `administra_acessos`, a mesma permissão do Gerenciamento de
 * perfis. Quem não tem leva 403, e a aba nem aparece — mas esconder é
 * conveniência de tela; quem decide é o backend.
 */
export async function obterCargasDasBases(): Promise<CargaDaBase[]> {
  return requisitar<CargaDaBase[]>('/api/plataforma/cargas');
}

/**
 * Quantas cargas cada base já teve, e quando foi a última.
 *
 * SEPARADA DA LISTAGEM de propósito, e isto é conserto de um defeito: a
 * listagem tem teto de 200, e inferir "esta base nunca carregou" de "não veio
 * nos 200" é falso quando outra base tem 200 eventos mais recentes. Este
 * endpoint é agregado e não tem teto — é ele que autoriza a tela a dizer
 * "sem registro".
 */
export async function obterResumoDasBases(): Promise<ResumoDaBase[]> {
  return requisitar<ResumoDaBase[]>('/api/plataforma/cargas/resumo');
}
