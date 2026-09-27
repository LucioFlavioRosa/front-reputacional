/** O que a tabela de linhas mostra, e onde ela deixa completar.
 *
 *  O DEFEITO QUE ISTO CORRIGE: a tabela mostrava linha, aba, situação, herdado e
 *  "o que falta" — e nada do CONTEÚDO da linha. Diante de "linha 3 · falta a
 *  Data" a pessoa não sabia nem de que agenda se tratava, e não tinha onde
 *  digitar a data.
 */

import { describe, expect, it } from 'vitest';

import { celulasEditaveis } from '@/paginas/importacao/linhas';
import type { LinhaDaImportacao } from '@/api/cliente';

function linha(parcial: Partial<LinhaDaImportacao> = {}): LinhaDaImportacao {
  return {
    id: 1,
    aba: 'Agendas',
    linha_origem: 3,
    decisao: 'pendente',
    interacao_id: null,
    dados_brutos: {},
    herdado: {},
    corrigido: {},
    proposta: null,
    divergencias: [],
    ...parcial,
  };
}

function divergencia(parcial: Partial<LinhaDaImportacao['divergencias'][0]> = {}) {
  return {
    campo: 'data_interacao',
    valor: '',
    mensagem: 'Falta Data, que toda agenda precisa ter.',
    trava: true,
    coluna: 'Data',
    sugestoes: [],
    acao: null,
    alvo: null,
    ...parcial,
  };
}

describe('celulasEditaveis', () => {
  it('oferece a coluna que a divergência aponta', () => {
    expect(celulasEditaveis(linha({ divergencias: [divergencia()] }))).toEqual(['Data']);
  });

  it('não oferece nada quando a divergência não é de uma coluna', () => {
    // Uma duplicata de agenda é da LINHA inteira: não há célula a preencher, e
    // oferecer uma caixa de texto ali convidaria a pessoa a "consertar" o que não
    // é erro de célula.
    expect(
      celulasEditaveis(linha({ divergencias: [divergencia({ coluna: '', trava: false })] })),
    ).toEqual([]);
  });

  it('não repete a coluna quando duas divergências apontam a mesma', () => {
    const duas = [divergencia(), divergencia({ campo: 'outro', mensagem: 'outra coisa' })];
    expect(celulasEditaveis(linha({ divergencias: duas }))).toEqual(['Data']);
  });

  it('só oferece o que TRAVA', () => {
    // O aviso brando não precisa de conserto: oferecer um campo transformaria
    // todo aviso em tarefa, que é o oposto do que a severidade branda quer dizer.
    expect(
      celulasEditaveis(linha({ divergencias: [divergencia({ trava: false })] })),
    ).toEqual([]);
  });
});
