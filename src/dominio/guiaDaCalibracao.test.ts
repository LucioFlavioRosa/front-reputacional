/** O guia da Calibração — a parte que impede um campo mudo de entrar.
 *
 *  O QUE ESTES TESTES PROTEGEM não é o texto, que muda quando alguém escreve
 *  melhor: é a GARANTIA DE QUE EXISTE texto. Um parâmetro novo sem verbete
 *  desenha um "?" que não abre nada, ou pior, um campo sem "?" nenhum no meio
 *  de sete que têm — e é justamente o campo novo que ninguém entende.
 */

import { describe, expect, it } from 'vitest';

import {
  GUIA_DA_CALIBRACAO,
  GUIA_DOS_LIMITES,
  verbeteDe,
} from '@/dominio/guiaDaCalibracao';

/** Os oito cortes que o servidor manda, na ordem em que a tela os desenha.
 *
 *  ESCRITOS AQUI DE PROPÓSITO: se o back acrescentar um limite, este teste
 *  falha e alguém precisa escrever o verbete antes de o campo aparecer. */
const LIMITES_DO_SERVIDOR = [
  'pico_desvios',
  'pico_razao_minima',
  'virada_pontos',
  'deslocamento_pp',
  'tendencia_meses',
  'concentracao_razao',
  'concentracao_top3',
  'max_sinais',
];

const PARAMETROS_DA_REGUA = [
  'regua_tier',
  'regua_engajamento',
  'pesos',
  'fontes',
  'radial_por_peso',
];

describe('o guia cobre a tela inteira', () => {
  it.each(LIMITES_DO_SERVIDOR)('o limite %s tem verbete', (chave) => {
    expect(verbeteDe(chave)).not.toBeNull();
  });

  it.each(PARAMETROS_DA_REGUA)('o parâmetro %s tem verbete', (chave) => {
    expect(verbeteDe(chave)).not.toBeNull();
  });

  it('não sobra verbete para campo que não existe', () => {
    // Um verbete órfão é texto que ninguém lê, e que passa a mentir quando o
    // campo correspondente muda de regra sem ninguém notar.
    expect(Object.keys(GUIA_DOS_LIMITES).sort()).toEqual([...LIMITES_DO_SERVIDOR].sort());
    expect(Object.keys(GUIA_DA_CALIBRACAO).sort()).toEqual([...PARAMETROS_DA_REGUA].sort());
  });

  it('uma chave desconhecida não desenha "?" nenhum', () => {
    expect(verbeteDe('inventado')).toBeNull();
  });
});

describe('cada verbete responde às duas perguntas', () => {
  const todos = Object.entries({ ...GUIA_DA_CALIBRACAO, ...GUIA_DOS_LIMITES });

  it.each(todos)('%s diz o que é E o que muda no resultado', (_chave, verbete) => {
    expect(verbete.titulo.trim()).not.toBe('');
    expect(verbete.oQueE.trim().length).toBeGreaterThan(40);
    // A SEGUNDA É A QUE ESTA TELA EXIGE. Um campo de calibração explicado só
    // pelo que ele é informa o que a pessoa já via no rótulo, e esconde
    // justamente o que ela precisa para decidir se mexe.
    expect(verbete.comoAfeta.trim().length).toBeGreaterThan(40);
  });

  it.each(todos)('%s termina as frases', (_chave, verbete) => {
    for (const texto of [verbete.oQueE, verbete.comoAfeta, verbete.exemplo, verbete.aviso]) {
      if (texto) expect(texto.trim().endsWith('.')).toBe(true);
    }
  });
});
