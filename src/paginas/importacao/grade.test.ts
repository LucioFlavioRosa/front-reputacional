/** A cor de cada célula da grade, e o que a grade mostra.
 *
 *  O PEDIDO: "as colunas e linhas devem ter um destaque de cor quando está
 *  faltando informação". A cor é a única coisa que faz 500 linhas por 37 colunas
 *  serem conferíveis: sem ela a pessoa lê 11.000 células procurando o que falta.
 */

import { describe, expect, it } from 'vitest';

import { corDaCelula, linhaTemPendencia, resumoDeCores } from '@/paginas/importacao/grade';
import type { LinhaDaImportacao } from '@/api/cliente';

function linha(divergencias: LinhaDaImportacao['divergencias'] = []): LinhaDaImportacao {
  return {
    id: 1,
    aba: 'Agendas',
    linha_origem: 3,
    decisao: 'pendente',
    interacao_id: null,
    dados_brutos: { Data: null, 'Instituição': 'ABDIB' },
    herdado: {},
    corrigido: {},
    proposta: null,
    divergencias,
    ...{},
  };
}

function divergencia(parcial: Partial<LinhaDaImportacao['divergencias'][0]> = {}) {
  return {
    campo: 'data_interacao',
    valor: '',
    mensagem: 'Falta Data.',
    trava: true,
    coluna: 'Data',
    sugestoes: [],
    acao: null,
    alvo: null,
    ...parcial,
  };
}

describe('corDaCelula', () => {
  it('pinta de vermelho a célula que TRAVA a confirmação', () => {
    expect(corDaCelula(linha([divergencia()]), 'Data')).toBe('trava');
  });

  it('pinta de amarelo a célula que só avisa', () => {
    expect(corDaCelula(linha([divergencia({ trava: false })]), 'Data')).toBe('aviso');
  });

  it('não pinta a célula sem divergência', () => {
    expect(corDaCelula(linha([divergencia()]), 'Instituição')).toBe(null);
  });

  it('o vermelho vence o amarelo na mesma célula', () => {
    // Duas divergências na mesma coluna: a que impede confirmar é a que a pessoa
    // precisa ver. Mostrar o amarelo esconderia a que importa.
    const duas = [divergencia({ trava: false }), divergencia({ trava: true })];
    expect(corDaCelula(linha(duas), 'Data')).toBe('trava');
  });

  it('a divergência sem coluna não pinta célula nenhuma', () => {
    // Uma duplicata de agenda é da LINHA inteira. Pintar uma célula arbitrária
    // mandaria a pessoa consertar uma coluna que não tem nada de errado.
    expect(corDaCelula(linha([divergencia({ coluna: '' })]), 'Data')).toBe(null);
  });
});

describe('linhaTemPendencia', () => {
  it('a linha inteira se destaca quando alguma célula trava', () => {
    // O PEDIDO FALA DE LINHAS E DE COLUNAS: com 37 colunas, a célula vermelha pode
    // estar fora da tela. O destaque na linha é o que faz a pessoa rolar até ela.
    expect(linhaTemPendencia(linha([divergencia()]))).toBe(true);
  });

  it('não se destaca por aviso brando', () => {
    expect(linhaTemPendencia(linha([divergencia({ trava: false })]))).toBe(false);
  });
});

describe('resumoDeCores', () => {
  it('conta as células que travam e as que avisam', () => {
    // É o que o cabeçalho da grade diz antes de a pessoa rolar: "3 células a
    // preencher" responde "tenho tempo de conferir agora?".
    const linhas = [
      linha([divergencia()]),
      linha([divergencia(), divergencia({ coluna: 'UF' })]),
      linha([divergencia({ trava: false })]),
    ];

    expect(resumoDeCores(linhas)).toEqual({ trava: 3, aviso: 1 });
  });

  it('não conta a divergência que não aponta coluna', () => {
    expect(resumoDeCores([linha([divergencia({ coluna: '' })])])).toEqual({
      trava: 0,
      aviso: 0,
    });
  });
});

describe('linhaTemPendencia, quando a divergência não aponta coluna', () => {
  it('a linha AINDA se destaca — achado Médio da revisão', () => {
    /** O cenário: uma importação criada ANTES de as divergências ganharem
     *  `coluna` fica no banco com o JSONB sem essa chave. A conferência dela
     *  continua aberta, e a API devolve o que está gravado.
     *
     *  O efeito era grave e silencioso: o cabeçalho dizia "1 célula a preencher",
     *  os grupos mostravam a decisão — e a LINHA não aparecia na grade, porque o
     *  filtro inicial mostra só as que têm pendência e `linhaTemPendencia` só
     *  olhava as divergências com coluna. A pessoa via a pendência anunciada e
     *  não tinha onde mexer.
     *
     *  "ESTA LINHA ESTÁ PRESA?" é pergunta sobre a LINHA, e a resposta é `trava`.
     *  Saber em qual célula pintar é outra pergunta — essa sim depende da coluna. */
    expect(linhaTemPendencia(linha([divergencia({ coluna: '' })]))).toBe(true);
  });

  it('e o aviso brando sem coluna continua não destacando', () => {
    // A duplicata de agenda é o caso real disto: é da linha inteira, e só avisa.
    expect(linhaTemPendencia(linha([divergencia({ coluna: '', trava: false })]))).toBe(false);
  });
});
