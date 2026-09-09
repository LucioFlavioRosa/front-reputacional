/** O layout do grafo, medido em vez de olhado.
 *
 *  Um grafo mal disposto parece certo numa captura de tela e mente sobre a
 *  ordem dos fatos. Estes testes fixam as decisões que só se percebem quando
 *  já é tarde: profundidade pelo MAIOR caminho, ordem estável, e o ciclo não
 *  travando a tela.
 */

import { describe, expect, it } from 'vitest';
import {
  cadeias,
  derivadasForaDaJanela,
  montarGrafo as montarComOServidor,
  temCadeia,
} from '@/dominio/grafo';
import type { Interacao } from '@/dominio/tipos';

let contador = 0;
function agenda(
  id: string,
  origens: string[] = [],
  data = '2026-01-01',
  derivadas = 0,
): Interacao {
  contador += 1;
  return {
    id,
    origens,
    // `montarGrafo` NÃO lê este campo: quem decorre de quem sai das `origens`
    // dos outros. Ele existe para a tela saber que há descendente FORA da
    // janela, e é por isso que `derivadasForaDaJanela` tem teste próprio.
    derivadas,
    data_interacao: data,
    frente: 'governo',
    instituicao_id: 'i1',
    interlocutor_id: null,
    unidade_negocio_id: null,
    esfera_id: null,
    uf: 'SP',
    modalidade: null,
    local: null,
    tier: null,
    stakeholder_id: null,
    status: 'realizado',
    clima: null,
    resultado: null,
    iniciativa: null,
    pauta: `Agenda ${id}`,
    posicionamento: null,
    relato: null,
    encaminhamentos: null,
    pendencias: null,
    observacoes: null,
    registro_url: null,
    extensao: null,
    temas: [],
    participacoes: [],
    expectativa: null,
    clima_esperado: null,
    declinado_por: null,
    motivo_declinio: null,
    nota_situacao: null,
    preve_desdobramento: null,
    outra_parte: [],
    materiais: [],
    fonte: 'cadastro_manual',
    visivel: true,
    criado_por: null,
    criado_em: null,
    atualizado_em: null,
  };
}

/** Monta o grafo com `derivadas` como o SERVIDOR o preencheria.
 *
 *  `montarGrafo` decide quem entra no desenho por `temCadeia`, que olha
 *  `origens` E `derivadas`. `derivadas` é contagem do servidor, não da janela:
 *  montar uma entrada de teste sem ela testaria um caso que a API nunca
 *  produz — e foi assim que onze testes passaram enquanto a tela mostrava
 *  "cadeia fora do recorte" para uma agenda marcada como encadeada.
 *
 *  O valor declarado em `agenda(...)` é o TOTAL do servidor, então ele vence
 *  quando for maior que o que a janela mostra — que é justamente o caso da
 *  descendente fora do recorte.
 */
function montarGrafo(agendas: Interacao[]) {
  return montarComOServidor(
    agendas.map((a) => ({
      ...a,
      derivadas: Math.max(
        a.derivadas,
        agendas.filter((outra) => (outra.origens ?? []).includes(a.id)).length,
      ),
    })),
  );
}

const profundidadeDe = (grafo: ReturnType<typeof montarGrafo>, id: string) =>
  grafo.nos.find((n) => n.id === id)?.profundidade;

describe('quem entra no grafo', () => {
  it('deixa de fora quem não tem linhagem nenhuma', () => {
    // As soltas são a MAIORIA em qualquer base real. Desenhá-las encheria a
    // tela de pontos sem seta, e a cadeia — que é o assunto — sumiria.
    const grafo = montarGrafo([agenda('a'), agenda('b', ['a']), agenda('solta')]);

    expect(grafo.nos.map((n) => n.id).sort()).toEqual(['a', 'b']);
    expect(grafo.soltas).toBe(1);
  });

  it('conta as soltas, em vez de escondê-las', () => {
    // Sem o número, o grafo pareceria representar tudo o que existe na base.
    const grafo = montarGrafo([agenda('x'), agenda('y'), agenda('z')]);

    expect(grafo.nos).toEqual([]);
    expect(grafo.soltas).toBe(3);
  });

  it('ignora origem que não está no conjunto carregado', () => {
    // A janela traz as 200 mais recentes; uma origem mais antiga fica fora.
    // Conta-la deslocaria o no para uma camada cuja origem ninguem ve, e o
    // desenho teria uma coluna vazia a esquerda.
    const grafo = montarGrafo([agenda('a', ['fora-da-janela']), agenda('b', ['a'])]);

    expect(profundidadeDe(grafo, 'a')).toBe(0);
  });
});

describe('a profundidade é o MAIOR caminho', () => {
  it('uma cadeia simples avança um nível por vez', () => {
    const grafo = montarGrafo([agenda('a'), agenda('b', ['a']), agenda('c', ['b'])]);

    expect(profundidadeDe(grafo, 'a')).toBe(0);
    expect(profundidadeDe(grafo, 'b')).toBe(1);
    expect(profundidadeDe(grafo, 'c')).toBe(2);
  });

  it('quem decorre da raiz E de uma neta fica DEPOIS da neta', () => {
    // O caso que o menor caminho erraria: por ele, `d` empataria com `b` na
    // camada 1 — e a seta vinda de `c` (camada 2) apontaria para TRÁS.
    const grafo = montarGrafo([
      agenda('a'),
      agenda('b', ['a']),
      agenda('c', ['b']),
      agenda('d', ['a', 'c']),
    ]);

    expect(profundidadeDe(grafo, 'd')).toBe(3);
  });

  it('a confluência espera a mais profunda das origens', () => {
    // Quatro preparatórias levam juntas a uma decisão: ela vem depois de
    // todas, e não depois da primeira que o código encontrar.
    const grafo = montarGrafo([
      agenda('p1'),
      agenda('p2'),
      agenda('meio', ['p1']),
      agenda('decisao', ['p2', 'meio']),
    ]);

    expect(profundidadeDe(grafo, 'decisao')).toBe(2);
  });
});

describe('o desenho não trava nem muda de forma', () => {
  it('um ciclo nos dados não trava a travessia', () => {
    // O servidor barra ciclo, e mesmo assim a tela se protege: um dado
    // inconsistente vindo por outro caminho — importação, escrita direta no
    // banco — travaria a aba inteira num laço, e a tela não tem como saber
    // que o dado está errado.
    const grafo = montarGrafo([agenda('a', ['b']), agenda('b', ['a'])]);

    expect(grafo.nos).toHaveLength(2);
  });

  it('a mesma entrada produz o mesmo layout', () => {
    // Estas telas são comparadas em captura de tela e em reunião. Um layout
    // que assenta diferente a cada carregamento inviabiliza isso.
    const entrada = [
      agenda('a', [], '2026-01-01'),
      agenda('b', [], '2026-01-02'),
      agenda('c', ['a', 'b'], '2026-02-01'),
      agenda('d', ['c'], '2026-03-01'),
    ];

    const primeiro = montarGrafo(entrada).nos.map((n) => `${n.id}:${n.ordem}`);
    const segundo = montarGrafo([...entrada].reverse()).nos.map(
      (n) => `${n.id}:${n.ordem}`,
    );

    expect(segundo.sort()).toEqual(primeiro.sort());
  });

  it('as raízes saem em ordem cronológica', () => {
    // A primeira camada é a única sem pais para orientá-la, e a cronologia é
    // a ordem que quem lê espera.
    const grafo = montarGrafo([
      agenda('tardia', [], '2026-06-01'),
      agenda('antiga', [], '2026-01-01'),
      agenda('filha', ['tardia', 'antiga'], '2026-07-01'),
    ]);

    const raizes = grafo.nos
      .filter((n) => n.profundidade === 0)
      .sort((a, b) => a.ordem - b.ordem)
      .map((n) => n.id);
    expect(raizes).toEqual(['antiga', 'tardia']);
  });
});

describe('as cadeias independentes', () => {
  it('separa conversas que não se tocam', () => {
    const grafo = montarGrafo([
      agenda('a1'),
      agenda('a2', ['a1']),
      agenda('b1'),
      agenda('b2', ['b1']),
    ]);

    const grupos = cadeias(grafo);
    expect(grupos).toHaveLength(2);
    expect(grupos.every((g) => g.length === 2)).toBe(true);
  });

  it('duas agendas que dividem uma origem são a MESMA história', () => {
    // Conexidade ignora a direção da seta: nenhuma das duas decorre da outra,
    // e as três pertencem à mesma conversa.
    const grafo = montarGrafo([agenda('raiz'), agenda('x', ['raiz']), agenda('y', ['raiz'])]);

    expect(cadeias(grafo)).toHaveLength(1);
  });

  it('a maior vem primeiro', () => {
    // É a que tem mais história, e a que alguém procura ao abrir a tela sem
    // saber o que quer ver.
    const grafo = montarGrafo([
      agenda('curta1'),
      agenda('curta2', ['curta1']),
      agenda('l1'),
      agenda('l2', ['l1']),
      agenda('l3', ['l2']),
      agenda('l4', ['l3']),
    ]);

    expect(cadeias(grafo)[0]).toHaveLength(4);
  });
});

describe('o desenho avisa quando está incompleto', () => {
  it('conta o nó cuja origem ficou fora do que a tela carregou', () => {
    // MEDIDO: numa janela de 50 registros desta base, dois nós caem nesse caso.
    // Sem o aviso, os dois apareceriam como início de conversa — e quem se
    // prepara para a reunião leria menos do que existe, sem nada indicando
    // que falta.
    const grafo = montarGrafo([
      agenda('meio', ['origem-fora-da-janela']),
      agenda('fim', ['meio']),
    ]);

    expect(grafo.comOrigemForaDaJanela).toBe(1);
    expect(grafo.nos.find((n) => n.id === 'meio')?.origensForaDaJanela).toBe(1);
  });

  it('não avisa quando a cadeia está inteira', () => {
    // A prova negativa: um aviso que aparece sempre não é aviso, é ruído — e
    // quem o vê todo dia para de ler.
    const grafo = montarGrafo([agenda('a'), agenda('b', ['a'])]);

    expect(grafo.comOrigemForaDaJanela).toBe(0);
    expect(grafo.nos.every((n) => n.origensForaDaJanela === 0)).toBe(true);
  });

  it('conta cada origem faltante, e não só o nó', () => {
    // Uma confluência pode ter uma origem dentro e outra fora: o nó existe no
    // desenho com UMA seta, e a segunda história não aparece.
    const grafo = montarGrafo([
      agenda('dentro'),
      agenda('junta', ['dentro', 'fora-1', 'fora-2']),
    ]);

    expect(grafo.nos.find((n) => n.id === 'junta')?.origensForaDaJanela).toBe(2);
  });
});

describe('a agenda faz parte de uma cadeia?', () => {
  it('conta as DUAS pontas', () => {
    // Uma agenda que só originou outras não decorre de nada — e mesmo assim é
    // o começo de uma história. Olhar só `origens` a deixaria sem marca na
    // Base, que é justamente a linha de onde alguém abriria a cadeia.
    expect(temCadeia({ origens: [], derivadas: 2 })).toBe(true);
    expect(temCadeia({ origens: ['a'], derivadas: 0 })).toBe(true);
    expect(temCadeia({ origens: [], derivadas: 0 })).toBe(false);
  });
});

describe('o que continua fora do desenho', () => {
  it('conta a descendente que o recorte não trouxe', () => {
    // O SERVIDOR diz que saíram duas; o desenho tem uma. A outra está fora do
    // recorte, e sem esta conta o nó pareceria o FIM da conversa — a mesma
    // mentira que `origensForaDaJanela` evita do lado do começo.
    const grafo = montarGrafo([agenda('a', [], '2026-01-01', 2), agenda('b', ['a'])]);
    const no = grafo.nos.find((n) => n.id === 'a');

    expect(no && derivadasForaDaJanela(no, grafo.arestas)).toBe(1);
  });

  it('não avisa quando o desenho já mostra todas', () => {
    // A prova negativa: um aviso que aparece sempre não é aviso, é ruído.
    const grafo = montarGrafo([agenda('a', [], '2026-01-01', 1), agenda('b', ['a'])]);
    const no = grafo.nos.find((n) => n.id === 'a');

    expect(no && derivadasForaDaJanela(no, grafo.arestas)).toBe(0);
  });

  it('nunca fica negativo', () => {
    // Se o servidor contar MENOS do que a tela desenha, o dado está
    // inconsistente. O certo é não avisar nada, e não avisar ao contrário.
    const grafo = montarGrafo([agenda('a', [], '2026-01-01', 0), agenda('b', ['a'])]);
    const no = grafo.nos.find((n) => n.id === 'a');

    expect(no && derivadasForaDaJanela(no, grafo.arestas)).toBe(0);
  });
});

describe('a agenda cuja família inteira ficou fora do recorte', () => {
  it('entra sozinha no desenho, em vez de sumir', () => {
    // MEDIDO na tela: a Base marcava a agenda como parte de uma cadeia — a
    // marca vem de `derivadas`, que é do servidor — e o modal aberto por essa
    // mesma marca respondia "a cadeia desta agenda está fora do recorte".
    // Duas telas dizendo coisas opostas sobre o mesmo registro.
    const grafo = montarComOServidor([
      { ...agenda('raiz-de-2025'), derivadas: 1 },
      agenda('sem-relacao'),
    ]);

    expect(grafo.nos.map((n) => n.id)).toEqual(['raiz-de-2025']);
    expect(grafo.soltas).toBe(1);
  });

  it('marca o lado por onde a história continua', () => {
    // Um nó só é mais honesto do que nenhum: o ⋯ à direita diz que existe
    // desdobramento, ainda que o recorte não o tenha trazido.
    const grafo = montarComOServidor([{ ...agenda('raiz'), derivadas: 2 }]);
    const no = grafo.nos[0];

    expect(no && derivadasForaDaJanela(no, grafo.arestas)).toBe(2);
    expect(no?.origensForaDaJanela).toBe(0);
  });

  it('quem não tem linhagem nenhuma continua fora', () => {
    // A prova negativa: se toda agenda entrasse, o desenho encheria de pontos
    // sem seta e a cadeia — que é o assunto — sumiria.
    const grafo = montarComOServidor([agenda('a'), agenda('b')]);

    expect(grafo.nos).toEqual([]);
    expect(grafo.soltas).toBe(2);
  });
});
