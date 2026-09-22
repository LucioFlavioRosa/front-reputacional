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

describe('ler e escrever o caminho', () => {
  const casos: [string, Rota][] = [
    ['/', { destino: 'inicio' }],
    ['/situacao', { destino: 'situacao' }],
    ['/painel', { destino: 'painel' }],
    ['/base', { destino: 'base' }],
    ['/relatorios', { destino: 'relatorios' }],
    ['/preparar', { destino: 'preparar' }],
    ['/admin', { destino: 'admin', aba: undefined }],
    ['/admin/porta-vozes', { destino: 'admin', aba: 'porta-vozes' }],
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
  });
});
