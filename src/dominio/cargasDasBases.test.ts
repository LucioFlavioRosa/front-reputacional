import { describe, expect, it } from 'vitest';
import type { CargaDaBase } from './cargasDasBases';
import {
  agruparPorLote,
  basesSemRegistro,
  quantoTempo,
  rotuloDeQuem,
} from './cargasDasBases';

function carga(ajustes: Partial<CargaDaBase> = {}): CargaDaBase {
  return {
    base: 'score',
    fonte: 'Clipei',
    arquivo: 'clipping.xlsx',
    quem: 'Alguém',
    quem_enviou_o_arquivo: false,
    origem: 'api:planilha',
    linhas: 10,
    meses: ['2026-08-01'],
    quando: '2026-08-10T12:00:00Z',
    lote_id: 'lote-1',
    ...ajustes,
  };
}

describe('agruparPorLote', () => {
  it('junta as fontes irmãs do mesmo arquivo numa carga só', () => {
    const grupos = agruparPorLote([
      carga({ fonte: 'Clipei Imprensa', linhas: 25000 }),
      carga({ fonte: 'Clipei Mercado', linhas: 320 }),
    ]);

    expect(grupos).toHaveLength(1);
    expect(grupos[0].fontes).toEqual(['Clipei Imprensa', 'Clipei Mercado']);
  });

  it('SOMA as linhas do lote, porque é quanto o arquivo trouxe ao todo', () => {
    const grupos = agruparPorLote([
      carga({ linhas: 25000 }),
      carga({ fonte: 'Outra', linhas: 320 }),
    ]);

    expect(grupos[0].linhas).toBe(25320);
  });

  it('une os meses sem repetir, porque uma irmã pode recortar um mês para zero', () => {
    const grupos = agruparPorLote([
      carga({ meses: ['2026-07-01', '2026-08-01'] }),
      carga({ fonte: 'Outra', meses: ['2026-08-01', '2026-09-01'] }),
    ]);

    expect(grupos[0].meses).toEqual(['2026-07-01', '2026-08-01', '2026-09-01']);
  });

  it('NÃO junta lotes diferentes, mesmo na mesma base', () => {
    const grupos = agruparPorLote([
      carga({ lote_id: 'lote-1' }),
      carga({ lote_id: 'lote-2' }),
    ]);

    expect(grupos).toHaveLength(2);
  });

  it('NÃO junta por lote nulo: agendas não têm lote e não têm relação', () => {
    const grupos = agruparPorLote([
      carga({ base: 'agendas', fonte: null, lote_id: null, arquivo: 'uma.xlsx' }),
      carga({ base: 'agendas', fonte: null, lote_id: null, arquivo: 'outra.xlsx' }),
    ]);

    expect(grupos).toHaveLength(2);
    expect(grupos.map((g) => g.arquivo)).toEqual(['uma.xlsx', 'outra.xlsx']);
  });

  it('a carga de zero linha sobrevive ao agrupamento', () => {
    //: O caso que a trilha existe para registrar não pode sumir na tela.
    const grupos = agruparPorLote([carga({ linhas: 0 })]);

    expect(grupos).toHaveLength(1);
    expect(grupos[0].linhas).toBe(0);
  });

  it('dá chave distinta a cada grupo sem lote, para a lista não colidir', () => {
    const grupos = agruparPorLote([
      carga({ lote_id: null }),
      carga({ lote_id: null }),
    ]);

    expect(new Set(grupos.map((g) => g.chave)).size).toBe(2);
  });
});

describe('basesSemRegistro', () => {
  it('nomeia as bases que nunca apareceram na trilha', () => {
    expect(basesSemRegistro([carga({ base: 'score' })])).toEqual([
      'bonds',
      'subtemas',
      'agendas',
    ]);
  });

  it('não acusa nada quando as quatro já carregaram', () => {
    const cargas = (['score', 'bonds', 'subtemas', 'agendas'] as const).map((base) =>
      carga({ base }),
    );

    expect(basesSemRegistro(cargas)).toEqual([]);
  });

  it('com a lista vazia, as quatro estão sem registro', () => {
    //: É o estado do dia da implantação, e a tela tem de dizê-lo em vez de
    //: parecer que não há nada a mostrar.
    expect(basesSemRegistro([])).toHaveLength(4);
  });
});

describe('quantoTempo', () => {
  const agora = new Date('2026-08-20T12:00:00Z');

  it.each([
    ['2026-08-20T09:00:00Z', 'hoje'],
    ['2026-08-19T09:00:00Z', 'ontem'],
    ['2026-08-15T12:00:00Z', 'há 5 dias'],
    ['2026-07-01T12:00:00Z', 'há 1 mês'],
    ['2026-02-20T12:00:00Z', 'há 6 meses'],
    ['2025-02-20T12:00:00Z', 'há 1 ano'],
  ])('%s → %s', (quando, esperado) => {
    expect(quantoTempo(quando, agora)).toBe(esperado);
  });

  it('data no futuro não vira "há -3 dias"', () => {
    //: Relógio do servidor adiantado é possível, e um número negativo na tela
    //: pareceria defeito do painel.
    expect(quantoTempo('2026-08-25T12:00:00Z', agora)).toBe('há instantes');
  });

  it('data ilegível devolve travessão em vez de "Invalid Date"', () => {
    expect(quantoTempo('nada disso', agora)).toBe('—');
  });
});

describe('rotuloDeQuem', () => {
  it('diz o nome quando a trilha tem o nome', () => {
    expect(
      rotuloDeQuem({ quem: 'Maria', quem_enviou_o_arquivo: false, origem: 'api:planilha' }),
    ).toBe('Maria');
  });

  it('marca quem apenas ENVIOU o arquivo, para não afirmar que confirmou', () => {
    expect(
      rotuloDeQuem({ quem: 'Maria', quem_enviou_o_arquivo: true, origem: 'api:agendas' }),
    ).toBe('Maria (enviou o arquivo)');
  });

  it('sem nome, diz que foi fora da tela E qual origem — não "desconhecido"', () => {
    //: Nulo com origem preenchida é informação: carga por comando de linha.
    //: "Desconhecido" jogaria fora justamente o que se sabe.
    expect(
      rotuloDeQuem({ quem: null, quem_enviou_o_arquivo: false, origem: 'carga_do_pacote' }),
    ).toBe('fora da tela (carga_do_pacote)');
  });

  it('sem nome e sem origem, não inventa parênteses vazios', () => {
    expect(rotuloDeQuem({ quem: null, quem_enviou_o_arquivo: false, origem: null })).toBe(
      'fora da tela',
    );
  });
});
