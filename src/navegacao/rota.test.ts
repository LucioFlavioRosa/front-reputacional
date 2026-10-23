/** O endereço, medido nos dois sentidos.
 *
 *  Um roteador que lê e escreve de formas que não se batem produz o pior
 *  defeito possível: o link que a pessoa copia abre outra tela.
 */

import { describe, expect, it } from 'vitest';
import {
  caminhoDe,
  consultaDe,
  lerCaminho,
  lerRecorte,
  nomeDaTela,
} from '@/navegacao/rota';
import type { Rota } from '@/navegacao/rota';
import type { Recorte } from '@/dominio/recorte';

describe('ler e escrever o caminho', () => {
  const casos: [string, Rota][] = [
    ['/', { destino: 'inicio' }],
    ['/painel', { destino: 'painel' }],
    ['/base', { destino: 'base' }],
    ['/relatorios', { destino: 'relatorios' }],
  ['/score', { destino: 'score', aba: 'geral' }],
    //: O MERCADO ENTRA NA TABELA, e faltar aqui foi o que deixou passar o
    //: defeito: `/mercado` lia `aba: undefined`, a barra de cima compara
    //: `item.aba === abaAtiva` e a aba "Bonds X Score Reputacional Mercado" nunca acendia.
    //: Mesmo par que `/score` ↔ `geral` já protege.
    ['/mercado', { destino: 'mercado', aba: 'bonds' }],
    ['/mercado/importacao', { destino: 'mercado', aba: 'importacao' }],
    ['/preparar', { destino: 'preparar' }],
    ['/admin', { destino: 'admin', aba: undefined }],
    ['/admin/porta-vozes', { destino: 'admin', aba: 'porta-vozes' }],
    ['/compartilhado', { destino: 'compartilhado' }],
    ['/taxonomia', { destino: 'taxonomia' }],
    ['/agenda/nova', { destino: 'cadastro', sobre: 'nova' }],
    ['/agenda/abc/editar', { destino: 'cadastro', agenda: 'abc', sobre: 'editar' }],
    ['/agenda/abc', { destino: 'base', agenda: 'abc', sobre: 'ficha' }],
    ['/agenda/abc/cadeia', { destino: 'base', agenda: 'abc', sobre: 'cadeia' }],
  ];

  for (const [caminho, rota] of casos) {
    it(`lê ${caminho}`, () => {
      expect(lerCaminho(caminho)).toEqual(rota);
    });
  }

  it('o que se escreve é o que se lê', () => {
    // A prova de ida e volta. Sem ela, um link copiado da tela pode abrir
    // outra — e ninguém descobre até alguém reclamar.
    for (const [caminho, rota] of casos) {
      expect(caminhoDe(rota)).toBe(caminho === '/admin' ? '/admin' : caminho);
      expect(lerCaminho(caminhoDe(rota))).toEqual(rota);
    }
  });

  it('endereço desconhecido cai no início, e não em erro', () => {
    // Link antigo, link torto, link de uma versão que não existe mais: leva a
    // algum lugar utilizável em vez de a uma tela morta.
    expect(lerCaminho('/painel-antigo')).toEqual({ destino: 'inicio' });
    expect(lerCaminho('/frentes/imprensa')).toEqual({ destino: 'inicio' });
  });

  it('as telas que saíram (Situação, Explorar) caem na capa', () => {
    // Link salvo de antes de 22/09/2026: abre a capa em vez de uma tela morta;
    // a consulta é lida pelo recorte, que não depende do caminho.
    expect(lerCaminho('/situacao')).toEqual({ destino: 'inicio' });
    expect(lerCaminho('/explorar')).toEqual({ destino: 'inicio' });
  });

  it('o endereço ANTIGO da Árvore da taxonomia leva à Árvore', () => {
    // A Árvore morou dentro da Metodologia do Score, numa aba escolhida pela
    // URL e feita LINKÁVEL de propósito ("para o link da Árvore abrir direto
    // nela", dizia o código de lá). Quando ela ganhou endereço próprio, aquele
    // link passou a abrir a Metodologia do índice — tela errada, calada, porque
    // `/score/metodologia` continua sendo caminho VÁLIDO. Achado de revisão.
    expect(lerCaminho('/score/metodologia', '?secao=arvore')).toEqual({
      destino: 'taxonomia',
    });
    // E A METODOLOGIA SEM A CONSULTA CONTINUA SENDO A METODOLOGIA: o desvio é
    // do link da árvore, não da tela.
    expect(lerCaminho('/score/metodologia')).toEqual({ destino: 'score', aba: 'metodologia' });
    expect(lerCaminho('/score/metodologia', '?mes=2026-09')).toEqual({
      destino: 'score',
      aba: 'metodologia',
    });
  });

  it('a ficha e a cadeia abrem sobre a Base', () => {
    // Aberto a frio, o endereço de uma agenda precisa de uma tela embaixo do
    // modal — senão o fundo é branco e fechar não leva a lugar nenhum.
    expect(lerCaminho('/agenda/x').destino).toBe('base');
    expect(lerCaminho('/agenda/x/cadeia').destino).toBe('base');
  });
});

describe('o recorte na consulta', () => {
  it('vai e volta inteiro', () => {
    const recorte = {
      periodoPassado: 'ultimos-360' as const,
      frente: 'imprensa' as const,
      tier: 1,
      clima: 'tenso',
      climaEsperado: 'neutro',
      tags: ['3', '7'],
      q: 'copasa',
    };

    expect(lerRecorte(consultaDe(recorte))).toEqual(recorte);
  });

  it('um tema com vírgula no nome vai e volta inteiro', () => {
    // `tags` é repetido no endereço, não separado por vírgula: o nome é o
    // valor, e "Saneamento, drenagem" é UM tema.
    const recorte = { tags: ['Saneamento, drenagem', 'Tarifa'] };
    expect(lerRecorte(consultaDe(recorte))).toEqual(recorte);
  });

  it('o mesmo recorte produz sempre o mesmo endereço', () => {
    // Campos em ordem fixa: dois links do mesmo recorte precisam ser iguais
    // como texto, senão o navegador os trata como páginas diferentes.
    const a = consultaDe({ frente: 'governo', tier: 2, q: 'ana' });
    const b = consultaDe({ q: 'ana', tier: 2, frente: 'governo' });

    expect(a).toBe(b);
  });

  it('recorte vazio não deixa ponto de interrogação solto', () => {
    expect(consultaDe({})).toBe('');
  });

  it('ignora parâmetro que a tela não conhece', () => {
    // Um link de uma versão futura, com um filtro que ainda não existe aqui,
    // ainda deve abrir o painel — só sem aquele filtro.
    expect(lerRecorte('?frente=imprensa&filtro_do_futuro=1')).toEqual({
      frente: 'imprensa',
    });
  });

  it('descarta tier que não é número', () => {
    expect(lerRecorte('?tier=muito')).toEqual({});
  });
});

describe('o nome da tela para a telemetria', () => {
  it('distingue o que está aberto por cima', () => {
    // Pelo hash, TODO erro seria reportado como se fosse no Painel, porque o nome
    // vinha de `window.location.hash` — que nada escrevia.
    expect(nomeDaTela({ destino: 'base' })).toBe('base');
    expect(nomeDaTela({ destino: 'base', agenda: 'x', sobre: 'cadeia' })).toBe(
      'base:cadeia',
    );
    expect(nomeDaTela({ destino: 'admin', aba: 'assuntos' })).toBe('admin:assuntos');
    //: AS DUAS TELAS DO MERCADO SE DISTINGUEM: ler o gráfico e subir a planilha
    //: da semana chegavam as duas como `mercado`, e é essa diferença que diz se
    //: alguém usa a importação.
    expect(nomeDaTela({ destino: 'mercado', aba: 'bonds' })).toBe('mercado:bonds');
    expect(nomeDaTela({ destino: 'mercado', aba: 'importacao' })).toBe(
      'mercado:importacao',
    );
  });
});

/** O FILTRO TEM DE SOBREVIVER À URL, e este bloco existe porque ele não
 *  sobrevivia: `destaque` ficou fora de `CAMPOS_DE_TEXTO` e o `replaceState` o
 *  apagava do endereço. A pessoa clicava, a lista recortava, e recarregar ou
 *  voltar no navegador devolvia a base inteira. Achado de revisão.
 *
 *  O teste "vai e volta inteiro" que já existia passava porque o recorte dele
 *  não tinha o campo — por isso a guarda derivada, no fim deste bloco. */
describe('o destaque na URL', () => {
  it('vai e volta nos DOIS sentidos', () => {
    expect(lerRecorte(consultaDe({ destaque: true }))).toEqual({ destaque: true });
    expect(lerRecorte(consultaDe({ destaque: false }))).toEqual({ destaque: false });
  });

  it('`false` não desaparece do endereço', () => {
    // Com `if (recorte.destaque)` na escrita, esta string sairia vazia.
    expect(consultaDe({ destaque: false })).toBe('?destaque=false');
  });

  it('volta como booleano, e não como a string "false"', () => {
    // `CAMPOS_DE_TEXTO` entregaria `"false"`, que é truthy: todo `=== false`
    // do caminho passaria a tratar "sem destaque" como "de destaque".
    expect(lerRecorte('?destaque=false').destaque).toBe(false);
    expect(lerRecorte('?destaque=true').destaque).toBe(true);
  });

  it('descarta valor que não é true nem false', () => {
    // Mesma regra de `tier` não-numérico: link estragado abre sem filtro, e
    // não com um filtro que ninguém pediu.
    expect(lerRecorte('?destaque=talvez')).toEqual({});
    expect(lerRecorte('?destaque=')).toEqual({});
    expect(lerRecorte('?destaque=1')).toEqual({});
  });
});

/** TODO CAMPO DO RECORTE OU VIAJA NA URL, OU ESTÁ NESTA LISTA COM O MOTIVO.
 *
 *  `Required<Recorte>` é o guarda de verdade: campo novo quebra a COMPILAÇÃO
 *  deste arquivo até alguém pôr um valor aqui, e aí o teste cobra a decisão.
 *  Era isto que faltava — a lista de campos da URL é escrita à mão, e nada
 *  perguntava se ela tinha acompanhado o Recorte. */
const UM_DE_CADA: Required<Recorte> = {
  periodoPassado: 'ultimos-30',
  periodoFuturo: 'proximos-30',
  de: '2026-01-01',
  ate: '2026-12-31',
  frente: 'governo',
  unidade: 'Aegea',
  uf: 'SP',
  esfera: 'federal',
  tier: 2,
  clima: 'tenso',
  climaEsperado: 'neutro',
  resultado: 'avancou',
  status: 'confirmada',
  grupo: 'aberto',
  entidade: 'Prefeitura',
  subtipo: 'fundo',
  portaVoz: 'p-1',
  pessoa: 'u-1',
  alegacao: 'a-1',
  tags: ['Tarifa'],
  destaque: true,
  q: 'ana',
  areas: [1],
  categoriaPublico: [2],
  formatoInteracao: [3],
  temasN2: [4],
  temasN1: [5],
};

//: OS CAMPOS QUE NÃO VIAJAM, com o motivo. Não é absolvição: é dívida escrita.
const FORA_DA_URL: Partial<Record<keyof Recorte, string>> = {
  //: As cinco listas de ids. NUNCA viajaram, e a razão não está escrita em
  //: lugar nenhum do repositório — o leitor da URL só sabe ler `tags` como
  //: parâmetro repetido. Consequência real: um link do Painel com área ou
  //: tema estratégico escolhido abre sem eles. Entra aqui como dívida
  //: conhecida, e não como decisão; `destaque` entrou nesta mesma vala e
  //: saiu dela.
  areas: 'lista de ids; o leitor da URL só trata `tags` (dívida anterior)',
  categoriaPublico: 'lista de ids (dívida anterior)',
  formatoInteracao: 'lista de ids (dívida anterior)',
  temasN2: 'lista de ids (dívida anterior)',
  temasN1: 'lista de ids (dívida anterior)',
};

describe('o recorte inteiro na URL', () => {
  it('todo campo ou viaja, ou tem motivo escrito para não viajar', () => {
    const naoViajam = (Object.keys(UM_DE_CADA) as (keyof Recorte)[]).filter((campo) => {
      const sozinho = { [campo]: UM_DE_CADA[campo] } as Recorte;
      return lerRecorte(consultaDe(sozinho))[campo] === undefined;
    });

    const semMotivo = naoViajam.filter((campo) => !(campo in FORA_DA_URL));
    expect(semMotivo, `campo do Recorte perdido na URL sem motivo escrito`).toEqual([]);
  });

  it('a lista de dívidas não envelhece sozinha', () => {
    // Campo que PASSOU a viajar sai da lista; senão ela viraria uma coleção
    // de desculpas para problemas já resolvidos.
    const aindaPerdidos = (Object.keys(FORA_DA_URL) as (keyof Recorte)[]).filter((campo) => {
      const sozinho = { [campo]: UM_DE_CADA[campo] } as Recorte;
      return lerRecorte(consultaDe(sozinho))[campo] === undefined;
    });

    expect(aindaPerdidos.sort()).toEqual((Object.keys(FORA_DA_URL) as string[]).sort());
  });
});
