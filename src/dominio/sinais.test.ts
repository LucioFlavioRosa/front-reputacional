/** A leitura de convergência, medida.
 *
 *  É o número que a aba usa para dizer que algo está circulando. Um erro aqui
 *  não quebra tela nenhuma — só afirma um movimento de mercado que não houve,
 *  ou esconde um que houve.
 */

import { describe, expect, it } from 'vitest';
import type { Alegacao, Interacao } from '@/dominio/tipos';
import {
  alegacoesEmCirculacao,
  consultasDe,
  consultasVencidas,
  porApuracao,
  quemPergunta,
  semPosicionamento,
} from '@/dominio/sinais';

let contador = 0;
function consulta(ajustes: Partial<Interacao> = {}): Interacao {
  contador += 1;
  return {
    id: `c${contador}`,
    frente: 'bancos_credores',
    data_interacao: '2026-05-07',
    instituicao_id: 'banco-1',
    modalidade: null,
    local: null,
    interlocutor_id: null,
    unidade_negocio_id: null,
    esfera_id: null,
    formato_interacao_id: 8,
    uf: 'SP',
    tier: 1,
    status: 'confirmada',
    clima: null,
    resultado: null,
    iniciativa: null,
    pauta: null,
    posicionamento: null,
    relato: null,
    encaminhamentos: null,
    pendencias: null,
    observacoes: null,
    registro_url: null,
    extensao: null,
    temas: [],
    areas: [],
    participacoes: [],
    consulta: {
      canal_id: 1,
      remetente: 'analista@banco.com',
      teor: null,
      motivo: null,
      prazo_resposta: null,
      respondida_em: null,
    },
    alegacoes: [],
    fonte: 'cadastro_manual',
    visivel: true,
    criado_por: null,
    criado_em: null,
    atualizado_em: null,
    expectativa: null,
    clima_esperado: null,
    declinado_por: null,
    motivo_declinio: null,
    nota_situacao: null,
    origens: [],
    derivadas: 0,
    preve_desdobramento: null,
    outra_parte: [],
    materiais: [],
    ...ajustes,
  };
}

function alegacao(ajustes: Partial<Alegacao> = {}): Alegacao {
  return {
    id: 'a1',
    texto: 'O Banco X não renegociaria a dívida',
    temas: [],
    apuracao_id: 1,
    referencia_id: null,
    nota: null,
    ativo: true,
    criado_em: null,
    consultas: 0,
    ...ajustes,
  };
}

const APURACOES = [
  { id: 1, codigo: 'em_apuracao', nome: 'Em apuração', cor_hex: '#FE952B' },
  { id: 2, codigo: 'sem_fundamento', nome: 'Sem fundamento', cor_hex: '#17E3CB' },
];

describe('consultasDe', () => {
  it('o bloco `consulta` é o marcador — não o id do tipo', () => {
    // Depender do id do dicionário faria a tela precisar conhecer um código
    // que o catálogo existe para esconder.
    const reuniao = consulta({ consulta: null, formato_interacao_id: 7 });
    expect(consultasDe([consulta(), reuniao])).toHaveLength(1);
  });
});

describe('alegacoesEmCirculacao', () => {
  it('conta INSTITUIÇÕES distintas, não e-mails', () => {
    // Duas consultas do mesmo banco são insistência; a leitura é quantos
    // perguntaram.
    const item = alegacoesEmCirculacao(
      [
        consulta({ instituicao_id: 'banco-1', alegacoes: ['a1'] }),
        consulta({ instituicao_id: 'banco-1', alegacoes: ['a1'] }),
        consulta({ instituicao_id: 'fundo-2', alegacoes: ['a1'] }),
      ],
      [alegacao()],
    )[0];

    expect(item.consultas).toHaveLength(3);
    expect(item.instituicoes).toBe(2);
  });

  it('três instituições distintas em até quinze dias é convergência', () => {
    const [item] = alegacoesEmCirculacao(
      [
        consulta({ instituicao_id: 'b1', data_interacao: '2026-05-01', alegacoes: ['a1'] }),
        consulta({ instituicao_id: 'b2', data_interacao: '2026-05-08', alegacoes: ['a1'] }),
        consulta({ instituicao_id: 'b3', data_interacao: '2026-05-14', alegacoes: ['a1'] }),
      ],
      [alegacao()],
    );

    expect(item.convergente).toBe(true);
    expect(item.primeira).toBe('2026-05-01');
    expect(item.ultima).toBe('2026-05-14');
  });

  it('as mesmas três espalhadas por meses NÃO são convergência', () => {
    // A pergunta é se está circulando AGORA. Três bancos em seis meses é a
    // dúvida de sempre, não um movimento.
    const [item] = alegacoesEmCirculacao(
      [
        consulta({ instituicao_id: 'b1', data_interacao: '2026-01-10', alegacoes: ['a1'] }),
        consulta({ instituicao_id: 'b2', data_interacao: '2026-03-10', alegacoes: ['a1'] }),
        consulta({ instituicao_id: 'b3', data_interacao: '2026-06-10', alegacoes: ['a1'] }),
      ],
      [alegacao()],
    );

    expect(item.instituicoes).toBe(3);
    expect(item.convergente).toBe(false);
    expect(item.janela).toBeNull();
  });

  it('uma pergunta tardia NÃO apaga o agrupamento que houve', () => {
    // JANELA DESLIZANTE. Com primeira × última aparição, a quarta consulta em
    // novembro esticaria o intervalo e o agrupamento de maio — que é o sinal —
    // sumiria da tela sem nada ter acontecido.
    const [item] = alegacoesEmCirculacao(
      [
        consulta({ instituicao_id: 'b1', data_interacao: '2026-05-01', alegacoes: ['a1'] }),
        consulta({ instituicao_id: 'b2', data_interacao: '2026-05-03', alegacoes: ['a1'] }),
        consulta({ instituicao_id: 'b3', data_interacao: '2026-05-04', alegacoes: ['a1'] }),
        consulta({ instituicao_id: 'b4', data_interacao: '2026-11-20', alegacoes: ['a1'] }),
      ],
      [alegacao()],
    );

    expect(item.convergente).toBe(true);
    expect(item.janela).toEqual({ de: '2026-05-01', ate: '2026-05-04' });
  });

  it('entre dois agrupamentos, a janela mostrada é a mais recente', () => {
    // "Está circulando agora" e "circulou em maio" são leituras diferentes.
    const [item] = alegacoesEmCirculacao(
      [
        consulta({ instituicao_id: 'b1', data_interacao: '2026-05-01', alegacoes: ['a1'] }),
        consulta({ instituicao_id: 'b2', data_interacao: '2026-05-02', alegacoes: ['a1'] }),
        consulta({ instituicao_id: 'b3', data_interacao: '2026-05-03', alegacoes: ['a1'] }),
        consulta({ instituicao_id: 'b1', data_interacao: '2026-09-01', alegacoes: ['a1'] }),
        consulta({ instituicao_id: 'b2', data_interacao: '2026-09-02', alegacoes: ['a1'] }),
        consulta({ instituicao_id: 'b4', data_interacao: '2026-09-03', alegacoes: ['a1'] }),
      ],
      [alegacao()],
    );

    expect(item.janela).toEqual({ de: '2026-09-01', ate: '2026-09-03' });
  });

  it('a mesma instituição repetindo na janela não converge sozinha', () => {
    // Insistência de um banco não é o mercado perguntando.
    const [item] = alegacoesEmCirculacao(
      [
        consulta({ instituicao_id: 'b1', data_interacao: '2026-05-01', alegacoes: ['a1'] }),
        consulta({ instituicao_id: 'b1', data_interacao: '2026-05-02', alegacoes: ['a1'] }),
        consulta({ instituicao_id: 'b1', data_interacao: '2026-05-03', alegacoes: ['a1'] }),
        consulta({ instituicao_id: 'b2', data_interacao: '2026-05-04', alegacoes: ['a1'] }),
      ],
      [alegacao()],
    );

    expect(item.consultas).toHaveLength(4);
    expect(item.convergente).toBe(false);
  });

  it('duas instituições no mesmo dia ainda não bastam', () => {
    const [item] = alegacoesEmCirculacao(
      [
        consulta({ instituicao_id: 'b1', alegacoes: ['a1'] }),
        consulta({ instituicao_id: 'b2', alegacoes: ['a1'] }),
      ],
      [alegacao()],
    );
    expect(item.convergente).toBe(false);
  });

  it('a alegação sem consulta no recorte não entra na lista', () => {
    // A lista é a leitura DESTE período, e não o cadastro inteiro.
    const lista = alegacoesEmCirculacao(
      [consulta({ alegacoes: ['a1'] })],
      [alegacao(), alegacao({ id: 'a2', texto: 'Outra coisa qualquer' })],
    );
    expect(lista.map((i) => i.alegacao.id)).toEqual(['a1']);
  });

  it('ordena pela mais espalhada e, no empate, pela mais recente', () => {
    const lista = alegacoesEmCirculacao(
      [
        consulta({ instituicao_id: 'b1', data_interacao: '2026-05-01', alegacoes: ['a1'] }),
        consulta({ instituicao_id: 'b2', data_interacao: '2026-05-02', alegacoes: ['a2'] }),
        consulta({ instituicao_id: 'b3', data_interacao: '2026-05-03', alegacoes: ['a2'] }),
      ],
      [alegacao(), alegacao({ id: 'a2', texto: 'Outra premissa em circulação' })],
    );
    expect(lista.map((i) => i.alegacao.id)).toEqual(['a2', 'a1']);
  });
});

describe('consultasVencidas', () => {
  it('só o prazo vencido e sem resposta', () => {
    const vencida = consulta({
      consulta: {
        canal_id: 1, remetente: null, teor: null, motivo: null,
        prazo_resposta: '2026-05-01', respondida_em: null,
      },
    });
    const respondida = consulta({
      consulta: {
        canal_id: 1, remetente: null, teor: null, motivo: null,
        prazo_resposta: '2026-05-01', respondida_em: '2026-04-30',
      },
    });
    const noPrazo = consulta({
      consulta: {
        canal_id: 1, remetente: null, teor: null, motivo: null,
        prazo_resposta: '2026-12-01', respondida_em: null,
      },
    });
    const semPrazo = consulta();

    const fila = consultasVencidas(
      [vencida, respondida, noPrazo, semPrazo],
      '2026-06-01',
    );
    expect(fila.map((c) => c.id)).toEqual([vencida.id]);
  });
});

describe('semPosicionamento', () => {
  it('circula e ninguém respondeu — é a dívida da área', () => {
    const emCirculacao = alegacoesEmCirculacao(
      [
        consulta({ alegacoes: ['a1'] }),
        consulta({ alegacoes: ['a2'] }),
      ],
      [alegacao(), alegacao({ id: 'a2', texto: 'Já respondida', referencia_id: 'r1' })],
    );
    expect(semPosicionamento(emCirculacao).map((i) => i.alegacao.id)).toEqual(['a1']);
  });
});

describe('quemPergunta', () => {
  it('conta consultas por instituição, da maior para a menor', () => {
    const itens = quemPergunta(
      [
        consulta({ instituicao_id: 'b1' }),
        consulta({ instituicao_id: 'b1' }),
        consulta({ instituicao_id: 'b2' }),
      ],
      (id) => id.toUpperCase(),
    );
    expect(itens).toEqual([
      { chave: 'b1', rotulo: 'B1', total: 2 },
      { chave: 'b2', rotulo: 'B2', total: 1 },
    ]);
  });
});

describe('porApuracao', () => {
  it('um segmento por valor do dicionário, mesmo com zero', () => {
    const emCirculacao = alegacoesEmCirculacao(
      [consulta({ alegacoes: ['a1'] })],
      [alegacao({ apuracao_id: 1 })],
    );
    expect(porApuracao(emCirculacao, APURACOES)).toEqual([
      { chave: 'em_apuracao', rotulo: 'Em apuração', total: 1, cor: '#FE952B' },
      { chave: 'sem_fundamento', rotulo: 'Sem fundamento', total: 0, cor: '#17E3CB' },
    ]);
  });
});
