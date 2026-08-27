/** Quais portais a capa oferece.
 *
 *  Esconder um portal é conveniência de tela, nunca controle: quem decide é o
 *  backend, que responde 403 a quem forçar a navegação. O que estes testes
 *  protegem é o convite — oferecer uma porta que não abre é pior do que não
 *  mostrá-la, porque nesse caso a frustração partiu de nós.
 */

import { describe, expect, it } from 'vitest';
import { portaisDe } from '@/dominio/tipos';
import type { PapelDeAcesso } from '@/dominio/tipos';

function papel(parcial: Partial<PapelDeAcesso>): PapelDeAcesso {
  return {
    codigo: 'crm_edicao',
    nome: 'CRM',
    pode_criar: false,
    pode_editar_proprio: false,
    pode_editar_tudo: false,
    administra_dicionarios: false,
    administra_acessos: false,
    ve_campos_sensiveis: false,
    ve_diretorio: false,
    pode_exportar: false,
    acessa_crm: false,
    acessa_sintese: false,
    acessa_score: false,
    ...parcial,
  };
}

describe('portaisDe', () => {
  it('sem papel não abre porta nenhuma', () => {
    // É o estado de quem entrou pelo SSO e ainda não foi liberado. A capa
    // precisa tratá-lo, e não quebrar tentando ler `papel.acessa_crm`.
    expect(portaisDe(null).size).toBe(0);
  });

  it('papel que não decidiu nada não abre porta nenhuma', () => {
    expect(portaisDe(papel({})).size).toBe(0);
  });

  it('a plataforma abre os três', () => {
    const todos = portaisDe(
      papel({ codigo: 'plataforma_edicao', acessa_crm: true, acessa_sintese: true, acessa_score: true }),
    );
    expect([...todos].sort()).toEqual(['crm', 'score', 'sintese']);
  });

  it('cada papel de portal abre só o seu', () => {
    expect([...portaisDe(papel({ acessa_crm: true }))]).toEqual(['crm']);
    expect([...portaisDe(papel({ acessa_sintese: true }))]).toEqual(['sintese']);
    expect([...portaisDe(papel({ acessa_score: true }))]).toEqual(['score']);
  });

  it('dois portais convivem sem precisar de um papel próprio', () => {
    // É o motivo de portal ser dimensão separada: "lê a Síntese e o Score" não
    // exige um papel novo, exige duas bandeiras.
    const dois = portaisDe(papel({ acessa_sintese: true, acessa_score: true }));
    expect([...dois].sort()).toEqual(['score', 'sintese']);
  });
});
