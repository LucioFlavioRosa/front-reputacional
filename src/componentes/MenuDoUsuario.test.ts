/** As iniciais do avatar.
 *
 *  Duas letras num círculo de 36px é tudo o que identifica a conta na barra.
 *  Se elas colidirem entre pessoas da mesma equipe, o ícone deixa de informar
 *  qualquer coisa — e é por isso que a regra não é "as duas primeiras".
 */

import { describe, expect, it } from 'vitest';
import { iniciais } from '@/dominio/formato';

describe('iniciais', () => {
  it('usa o primeiro nome e o ÚLTIMO sobrenome', () => {
    // Não o do meio: numa equipe há vários "Silva" e poucos "Costa".
    expect(iniciais('Maria Silva Costa')).toBe('MC');
  });

  it('nome e sobrenome simples', () => {
    expect(iniciais('Ana Prado')).toBe('AP');
  });

  it('nome único vira as duas primeiras letras', () => {
    expect(iniciais('Madonna')).toBe('MA');
  });

  it('aguenta espaço sobrando', () => {
    // O nome vem do Entra ID ou de um `insert` à mão; nem sempre está limpo.
    expect(iniciais('  João   Neves  ')).toBe('JN');
  });

  it('nome vazio não quebra o avatar', () => {
    // Preferível a uma letra indefinida no círculo, ou a um erro de render na
    // barra — que derrubaria a navegação inteira.
    expect(iniciais('')).toBe('?');
    expect(iniciais('   ')).toBe('?');
  });

  it('devolve sempre em maiúsculas', () => {
    expect(iniciais('ana prado')).toBe('AP');
  });
});
