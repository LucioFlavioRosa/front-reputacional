/** O agrupamento por eixo, medido.
 *
 *  Estes números aparecem na tela como "Imprensa 106". Um erro aqui não
 *  quebra nada — só mente, e ninguém percebe.
 */

import { describe, expect, it } from 'vitest';
import { agrupar, jaAconteceu, panorama } from '@/dominio/agregacao';
import { montarCatalogo } from '@/dominio/derivacoes';
import type { Catalogo } from '@/dominio/derivacoes';
import type { Dicionarios, Interacao, PessoaAegea } from '@/dominio/tipos';

// Frente e porta-voz não leem dicionário nenhum — o catálogo só precisa das
// pessoas, para o nome do porta-voz.
const DICIONARIOS = {} as unknown as Dicionarios;

const PESSOAS: PessoaAegea[] = [
  { id: 'p1', nome: 'Letícia', cargo: null, email: null, eh_porta_voz: true, area_id: null, ativo: true, temas: [] },
  { id: 'p2', nome: 'Joseane', cargo: null, email: null, eh_porta_voz: true, area_id: null, ativo: true, temas: [] },
];

const CATALOGO: Catalogo = montarCatalogo(DICIONARIOS, [], [], PESSOAS);

let contador = 0;
function agenda(ajustes: Partial<Interacao> = {}): Interacao {
  contador += 1;
  return {
    id: `i${contador}`,
    frente: 'imprensa',
    data_interacao: '2026-03-10',
    instituicao_id: 'x',
    interlocutor_id: null,
    unidade_negocio_id: null,
    esfera_id: null,
    uf: 'SP',
    modalidade: null,
    local: null,
    tier: 2,
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
    participacoes: [],
    expectativa: null,
    clima_esperado: null,
    declinado_por: null,
    motivo_declinio: null,
    nota_situacao: null,
    preve_desdobramento: null,
    outra_parte: [],
    materiais: [],
    origens: [],
    derivadas: 0,
    fonte: 'cadastro_manual',
    visivel: true,
    criado_por: null,
    criado_em: null,
    atualizado_em: null,
    ...ajustes,
  } as Interacao;
}

describe('um eixo por vez, as mesmas medidas', () => {
  it('conta volume, Tier 1, em aberto e avanço juntos', () => {
    // As quatro medidas na mesma linha são o que substitui quatro telas.
    const grupos = agrupar(
      [
        // SEM RELATO e o que conta como "em aberto": a situacao tem
        // tres valores e nenhum deles diz se a reuniao houve.
        agenda({ tier: 1, relato: null }),
        agenda({ resultado: 'avancou', relato: 'Houve.' }),
        agenda({ resultado: 'recuou', clima: 'tenso', relato: 'Houve.' }),
      ],
      'frente',
      CATALOGO,
    );

    expect(grupos).toHaveLength(1);
    expect(grupos[0]).toMatchObject({
      rotulo: 'Imprensa',
      total: 3,
      tier1: 1,
      emAberto: 1,
      tenso: 1,
      avancou: 1,
      comDesfecho: 2,
    });
  });

  it('ordena do maior para o menor', () => {
    const grupos = agrupar(
      [agenda({ frente: 'governo' }), agenda(), agenda()],
      'frente',
      CATALOGO,
    );

    expect(grupos.map((g) => g.rotulo)).toEqual(['Imprensa', 'Entidades']);
  });
});

describe('porta-voz: uma agenda entra em vários grupos', () => {
  it('conta a agenda de dois porta-vozes nos dois', () => {
    // A soma dos grupos passa do total do recorte, e isso é correto: a
    // pergunta é quanto CADA UM apareceu. A tela precisa avisar.
    const grupos = agrupar(
      [
        agenda({
          participacoes: [
            { pessoa_aegea_id: 'p1', papel: 'porta_voz', presenca: null },
            { pessoa_aegea_id: 'p2', papel: 'porta_voz', presenca: null },
          ],
        }),
      ],
      'porta-voz',
      CATALOGO,
    );

    expect(grupos).toHaveLength(2);
    expect(grupos.reduce((s, g) => s + g.total, 0)).toBe(2);
  });
});

describe('a ausência também é um grupo', () => {
  it('agenda sem porta-voz vira o grupo que a fila de exceções cobra', () => {
    const grupos = agrupar([agenda({ participacoes: [] })], 'porta-voz', CATALOGO);

    expect(grupos[0].rotulo).toBe('Sem porta-voz definido');
  });
});

describe('o panorama do recorte', () => {
  it('soma o mesmo que os grupos', () => {
    // Se o total do topo divergir da soma da tabela logo abaixo, quem lê
    // deixa de confiar nos dois.
    const lista = [agenda({ tier: 1 }), agenda({ frente: 'governo' })];

    expect(panorama(lista, CATALOGO)).toMatchObject({ total: 2, tier1: 1 });
  });
});

describe('já aconteceu', () => {
  it('exige aceite E relato', () => {
    // Uma das duas sozinha não basta: aceito sem relato é reunião marcada que
    // ninguém contou; relato sem aceite é registro inconsistente.
    expect(jaAconteceu(agenda({ status: 'confirmada', relato: 'Houve.' }))).toBe(true);
    expect(jaAconteceu(agenda({ status: 'confirmada', relato: null }))).toBe(false);
    expect(jaAconteceu(agenda({ status: 'solicitado', relato: 'Houve.' }))).toBe(false);
  });

  it('a negada fica de fora mesmo com relato', () => {
    // O texto de uma recusa conta a recusa. Recusa não é reunião, e oferecê-la
    // como origem montaria uma cadeia a partir de algo que não aconteceu.
    expect(jaAconteceu(agenda({ status: 'declinado', relato: 'Recusamos.' }))).toBe(false);
  });
});
