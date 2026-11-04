import { describe, expect, it } from 'vitest';
import type { CargaDaBase, ResumoDaBase } from './cargasDasBases';
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
  function resumo(cargas: Partial<Record<string, number>>): ResumoDaBase[] {
    return ['score', 'bonds', 'subtemas', 'agendas'].map((base) => ({
      base,
      cargas: cargas[base] ?? 0,
      ultima_em: cargas[base] ? '2026-08-10T12:00:00Z' : null,
    }));
  }

  it('nomeia as bases com zero carga', () => {
    expect(basesSemRegistro(resumo({ score: 4 }))).toEqual([
      'bonds',
      'subtemas',
      'agendas',
    ]);
  });

  it('não acusa nada quando as quatro já carregaram', () => {
    expect(
      basesSemRegistro(resumo({ score: 1, bonds: 1, subtemas: 1, agendas: 1 })),
    ).toEqual([]);
  });

  it('com tudo em zero, as quatro estão sem registro', () => {
    //: É o estado do dia da implantação, e a tela tem de dizê-lo em vez de
    //: parecer que não há nada a mostrar.
    expect(basesSemRegistro(resumo({}))).toHaveLength(4);
  });

  it('CONTA DO RESUMO e não da lista: base antiga fora do teto não é "sem registro"', () => {
    //: O defeito que isto cobre: a listagem tem teto de 200, e uma base com
    //: cargas só antigas sai dela. Inferir dali que nunca carregou era uma
    //: afirmação falsa na tela. O resumo é agregado e não tem teto.
    expect(basesSemRegistro(resumo({ bonds: 1 }))).not.toContain('bonds');
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

  it('data no futuro NÃO afirma passado', () => {
    //: Relógio de servidor adiantado é possível. "Há instantes" afirmaria que já
    //: aconteceu; quem vê isto tem problema de infraestrutura, não de carga.
    expect(quantoTempo('2026-08-25T12:00:00Z', agora)).toBe('com data futura');
  });

  it('conta por DATA e não por blocos de 24 h', () => {
    //: Uma carga de ontem às 23h está a duas horas de distância e diria "hoje"
    //: se a conta fosse por bloco — a única coisa que não pode ser lida errado
    //: nesta tela.
    const umaHoraDaManha = new Date(2026, 7, 20, 1, 0, 0);
    const ontemAsOnze = new Date(2026, 7, 19, 23, 0, 0);

    expect(quantoTempo(ontemAsOnze.toISOString(), umaHoraDaManha)).toBe('ontem');
  });

  it('data ilegível devolve travessão em vez de "Invalid Date"', () => {
    expect(quantoTempo('nada disso', agora)).toBe('—');
  });
});

describe('rotuloDeQuem', () => {
  it('diz o nome, sem detalhe, quando a trilha tem o nome', () => {
    expect(
      rotuloDeQuem({ quem: 'Maria', quem_enviou_o_arquivo: false, origem: 'api:planilha' }),
    ).toEqual({ rotulo: 'Maria' });
  });

  it('marca quem apenas ENVIOU o arquivo, para não afirmar que confirmou', () => {
    const quem = rotuloDeQuem({
      quem: 'Maria',
      quem_enviou_o_arquivo: true,
      origem: 'api:agendas',
    });

    expect(quem.rotulo).toBe('Maria');
    expect(quem.detalhe).toContain('enviou o arquivo');
  });

  it('sem nome, o RÓTULO não tem jargão e a origem fica no detalhe', () => {
    //: `carga_do_pacote` é nome de código, não rótulo operacional: o jargão sai
    //: da coluna e vai para o detalhe, onde serve a quem investiga.
    const quem = rotuloDeQuem({
      quem: null,
      quem_enviou_o_arquivo: false,
      origem: 'carga_do_pacote',
    });

    expect(quem.rotulo).toBe('rotina automática');
    expect(quem.rotulo).not.toContain('carga_do_pacote');
    expect(quem.detalhe).toBe('origem: carga_do_pacote');
  });

  it('sem nome e sem origem, não inventa detalhe vazio', () => {
    expect(
      rotuloDeQuem({ quem: null, quem_enviou_o_arquivo: false, origem: null }),
    ).toEqual({ rotulo: 'rotina automática', detalhe: undefined });
  });
});
