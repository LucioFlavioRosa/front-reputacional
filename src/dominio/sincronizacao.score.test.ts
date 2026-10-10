/** Os números do Score mudaram: quem escreve avisa, e o cache da Consulta em
 *  profundidade envelhece.
 *
 *  O DEFEITO QUE ISTO CORRIGE: subir a planilha do mês na aba Base, ou mudar a
 *  calibração, deixava o drill da aba Lentes com a árvore antiga a sessão
 *  inteira, enquanto a Jornada logo acima já mostrava a nota nova.
 */

import { describe, expect, it } from 'vitest';

import { escreveNoScore } from '@/dominio/sincronizacao';

describe('escreveNoScore', () => {
  it('subir a planilha, gravar e restaurar a calibração mudam o Score', () => {
    expect(escreveNoScore('POST', '/api/score/fontes/clipei/planilha')).toBe(true);
    expect(escreveNoScore('PUT', '/api/score/calibracao')).toBe(true);
    expect(escreveNoScore('DELETE', '/api/score/calibracao')).toBe(true);
  });

  it('ler o Score não muda nada, e o prefixo não casa rota vizinha', () => {
    expect(escreveNoScore('GET', '/api/score/lentes/imprensa/consulta?mes=2026-08')).toBe(false);
    expect(escreveNoScore('POST', '/api/scores-arquivados')).toBe(false);
    expect(escreveNoScore('POST', '/api/interacoes')).toBe(false);
  });
});
