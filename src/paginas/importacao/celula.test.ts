/** O que uma célula oferece para ser consertada, e quantas linhas isso resolve.
 *
 *  O BLOCO DE DECISÕES AGRUPADAS SAIU DA TELA, por pedido do dono do produto: três
 *  blocos gastavam espaço, e o modal tem de ser a planilha. Mas a propriedade que o
 *  bloco carregava não podia sair com ele — "este órgão não existe" em doze linhas é
 *  UM clique, não doze, e é isso que faz a conferência escalar com 54 agendas.
 *
 *  A DECISÃO DESCEU PARA A CÉLULA, que é o lugar onde ela é verdade: a célula
 *  vermelha diz o que fazer e quantas linhas o mesmo conserto cobre.
 */

import { describe, expect, it } from 'vitest';

import { decisaoDaCelula } from '@/paginas/importacao/celula';
import type { Grupo } from '@/paginas/importacao/grupos';
import type { LinhaDaImportacao } from '@/api/cliente';

function grupo(parcial: Partial<Grupo> = {}): Grupo {
  return {
    campo: 'instituicao_id',
    valor: 'Prefeitura de Campinas',
    linhas: [3, 7, 12],
    trava: true,
    sugestoes: [{ nome: 'Prefeitura Municipal de Campinas', alvo: 'inst-1' }],
    pode_criar: true,
    ...parcial,
  };
}

function linha(parcial: Partial<LinhaDaImportacao> = {}): LinhaDaImportacao {
  return {
    id: 1,
    aba: 'Agendas',
    linha_origem: 3,
    decisao: 'pendente',
    interacao_id: null,
    dados_brutos: { 'Instituição': 'Prefeitura de Campinas', Data: null },
    herdado: {},
    corrigido: {},
    proposta: null,
    divergencias: [
      {
        campo: 'instituicao_id',
        valor: 'Prefeitura de Campinas',
        mensagem: "Instituição: 'Prefeitura de Campinas' não existe no cadastro.",
        trava: true,
        coluna: 'Instituição',
        sugestoes: [],
        acao: null,
        alvo: null,
      },
    ],
    ...parcial,
  };
}

describe('decisaoDaCelula', () => {
  it('traz o grupo daquele valor, e quantas linhas ele resolve', () => {
    const decisao = decisaoDaCelula(linha(), 'Instituição', [grupo()]);

    expect(decisao?.grupo.valor).toBe('Prefeitura de Campinas');
    // A CONTA É O QUE JUSTIFICA O CLIQUE: sem ela a pessoa não sabe se está
    // consertando uma linha ou doze.
    expect(decisao?.outrasLinhas).toBe(2);
  });

  it('não oferece nada numa célula sem divergência', () => {
    expect(decisaoDaCelula(linha(), 'Data', [grupo()])).toBe(null);
  });

  it('não oferece nada quando nenhum grupo casa com o valor da célula', () => {
    // O grupo é de outro campo: oferecer o conserto dele aqui apontaria a pessoa
    // para a decisão errada.
    const deOutroCampo = grupo({ campo: 'clima', valor: 'eufórico' });
    expect(decisaoDaCelula(linha(), 'Instituição', [deOutroCampo])).toBe(null);
  });

  it('diz zero outras linhas quando o valor só aparece nesta', () => {
    const soNesta = grupo({ linhas: [3] });
    expect(decisaoDaCelula(linha(), 'Instituição', [soNesta])?.outrasLinhas).toBe(0);
  });

  it('casa o grupo pelo CAMPO e pelo VALOR, não só pela coluna', () => {
    // Duas colunas podem alimentar o mesmo campo (Área 1 e Área 2, Tema 1 a 3):
    // casar só pela coluna ofereceria a decisão de `Tema 1` dentro de `Tema 3`.
    const daLinha = linha({
      dados_brutos: { 'Instituição': 'Outro Órgão' },
    });
    expect(decisaoDaCelula(daLinha, 'Instituição', [grupo()])).toBe(null);
  });
});
