/** A barra de cima mostra a divisão em que se está — e só ela.
 *
 *  O QUE ESTE ARQUIVO TRAVA é a regra que mais erra em silêncio: uma entrada
 *  no lugar errado não quebra nada, não aparece em teste de lógica e não dá
 *  erro no build — só confunde todo dia. Quem abria o Score levava no topo
 *  quatro entradas de CRM que não tinham nada a ver com o que estava lendo.
 */

import { describe, expect, it } from 'vitest';

import { NAVEGACAO_ADMINISTRATIVA, areaDe } from '@/navegacao/areas';

const rotulos = (view: Parameters<typeof areaDe>[0]) =>
  areaDe(view).map((item) => item.rotulo);

describe('a divisão do CRM', () => {
  it.each(['painel', 'base', 'preparar', 'relatorios'] as const)(
    '%s mostra as telas do CRM',
    (view) => {
      expect(rotulos(view)).toEqual([
        'Painel',
        'Base',
        'Preparar agenda',
        'Relatórios Executivos',
      ]);
    },
  );

  it('NÃO mostra nenhuma tela do Score', () => {
    expect(rotulos('painel')).not.toContain('Lentes');
  });

  it('as três telas de agenda levam à MESMA configuração', () => {
    // São a mesma área: três engrenagens apontando para telas diferentes
    // seriam três cadastros de CRM, e só existe um.
    const configuram = areaDe('painel')
      .filter((item) => item.configura)
      .map((item) => item.configura);
    expect(new Set(configuram)).toEqual(new Set(['admin']));
  });

  it('Relatórios não tem engrenagem', () => {
    // Uma engrenagem que abre tela vazia ensina a ignorar engrenagens.
    const relatorios = areaDe('painel').find((i) => i.rotulo === 'Relatórios Executivos');
    expect(relatorios?.configura).toBeUndefined();
  });
});

describe('a divisão do Score', () => {
  it('mostra as telas do Score, e nenhuma do CRM', () => {
    expect(rotulos('score')).toEqual([
      'Visão geral',
      'Lentes',
      'Drivers e riscos',
      'Metodologia',
    ]);
  });

  it('continua sendo a barra do Score dentro da configuração dele', () => {
    // Quem ajusta a régua do Score não saiu do Score.
    expect(rotulos('config-score')).toEqual(rotulos('score'));
  });

  it('as telas dividem a rota e se distinguem pela aba', () => {
    // Sem a aba, os quatro itens acenderiam juntos: apontam para a mesma
    // `view`.
    const itens = areaDe('score');
    expect(itens.every((item) => item.view === 'score')).toBe(true);
    expect(itens.map((item) => item.aba)).toEqual([
      'geral',
      'lentes',
      'drivers',
      'metodologia',
    ]);
  });
});

describe('a plataforma', () => {
  it('não empresta a barra de divisão nenhuma', () => {
    expect(areaDe('plataforma')).toEqual([]);
  });

  it('Acessos não mora no CRM nem no Score', () => {
    // Quem entra na plataforma vale igual para as duas divisões.
    expect(rotulos('painel')).not.toContain('Plataforma');
    expect(rotulos('score')).not.toContain('Plataforma');
    expect(NAVEGACAO_ADMINISTRATIVA.map((i) => i.view)).toEqual(['plataforma']);
  });
});
