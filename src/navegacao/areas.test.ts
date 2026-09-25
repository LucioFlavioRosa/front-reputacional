/** A barra de cima mostra a divisão em que se está — e só ela.
 *
 *  O QUE ESTE ARQUIVO TRAVA é a regra que mais erra em silêncio: uma entrada
 *  no lugar errado não quebra nada, não aparece em teste de lógica e não dá
 *  erro no build — só confunde todo dia. Quem abria o Score levava no topo
 *  quatro entradas de CRM que não tinham nada a ver com o que estava lendo.
 */

import { describe, expect, it } from 'vitest';

import { areaDe, configuracaoDe } from '@/navegacao/areas';

const rotulos = (view: Parameters<typeof areaDe>[0]) =>
  areaDe(view).map((item) => item.rotulo);

describe('a divisão do CRM', () => {
  it.each(['painel', 'base', 'preparar', 'relatorios'] as const)(
    '%s mostra as telas do CRM',
    (view) => {
      expect(rotulos(view)).toEqual([
        'Painel',
        'Base',
        'Preparação de agenda',
        'Relatórios Executivos',
      ]);
    },
  );

  it('NÃO mostra nenhuma tela do Score', () => {
    expect(rotulos('painel')).not.toContain('Lentes');
  });

  it.each(['painel', 'base', 'preparar', 'relatorios'] as const)(
    'de %s, a engrenagem leva ao cadastro do CRM',
    (view) => {
      // É UMA POR DIVISÃO, e não uma por tela: Painel, Base e Preparar agenda
      // são a mesma área, e três engrenagens para o mesmo cadastro ensinam que
      // há três cadastros.
      expect(configuracaoDe(view)).toBe('admin');
    },
  );

  it('nenhum item da barra carrega configuração própria', () => {
    // A engrenagem é da divisão. Se voltar a ser do item, o Score perde a dele
    // de novo — foi exatamente assim que a régua do índice ficou sem porta.
    expect(areaDe('painel').every((item) => !('configura' in item))).toBe(true);
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

  it('a engrenagem leva à régua do índice, e não ao cadastro do CRM', () => {
    // O QUE ESTE TESTE TRAVA: as quatro telas do Score entraram na barra sem
    // herdar a engrenagem da aba antiga, e a régua do índice — com o cadastro
    // de comentários do especialista, que mora na mesma tela — ficou sem porta
    // de entrada. Nada acusava: compila, renderiza, e a tela simplesmente não
    // tem como ser aberta.
    expect(configuracaoDe('score')).toBe('config-score');
    expect(configuracaoDe('config-score')).toBe('config-score');
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

  it('não aparece na barra de divisão nenhuma', () => {
    // Quem entra na plataforma vale igual para as duas divisões, então a
    // entrada não é de nenhuma: ela mora no menu da conta. Na barra ela era um
    // quinto item de natureza diferente dos outros quatro, e trocava de vizinho
    // a cada troca de divisão.
    expect(rotulos('painel')).not.toContain('Plataforma');
    expect(rotulos('score')).not.toContain('Plataforma');
  });

  it('não se configura a si mesma', () => {
    // Quem entra, e com que papel, JÁ É a tela de configuração — uma
    // engrenagem ali abriria a própria tela.
    expect(configuracaoDe('plataforma')).toBeNull();
  });
});
