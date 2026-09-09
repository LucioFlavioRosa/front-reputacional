import { describe, expect, it } from 'vitest';

import { escolhaAoFechar, filtrar, normalizar } from './completar';

const OPCOES = [
  { valor: 'a', rotulo: 'Bloomberg', detalhe: 'Imprensa internacional' },
  { valor: 'b', rotulo: '9Fin', detalhe: 'Imprensa internacional' },
  { valor: 'c', rotulo: 'Agência Nacional de Águas', detalhe: 'ANA' },
];

describe('normalizar', () => {
  it('tira acento e caixa', () => {
    expect(normalizar('Águas')).toBe('aguas');
  });
});

describe('filtrar', () => {
  it('casa no meio da palavra, sem acento', () => {
    expect(filtrar(OPCOES, 'aguas').map((o) => o.valor)).toEqual(['c']);
  });

  it('casa pelo detalhe, que é onde mora a sigla', () => {
    expect(filtrar(OPCOES, 'ana').map((o) => o.valor)).toEqual(['c']);
  });

  it('busca vazia devolve tudo', () => {
    expect(filtrar(OPCOES, '   ')).toHaveLength(3);
  });
});

describe('escolhaAoFechar', () => {
  // A REGRESSÃO: a tela mostrava "Bloomberg" e o POST levava o id da 9Fin,
  // porque digitar não mexia no valor do formulário e fechar só apagava o
  // texto. Fechar sobre um texto que aponta para UMA opção agora grava.
  it('grava quando o texto digitado aponta para uma só opção', () => {
    expect(escolhaAoFechar(OPCOES, 'bloomberg')?.valor).toBe('a');
  });

  it('não escolhe por conta própria quando há duas candidatas', () => {
    expect(escolhaAoFechar(OPCOES, 'imprensa')).toBeNull();
  });

  it('não escolhe quando nada casa — o texto é descartado', () => {
    expect(escolhaAoFechar(OPCOES, 'zzz')).toBeNull();
  });

  it('texto em branco não muda o que já estava escolhido', () => {
    expect(escolhaAoFechar(OPCOES, '  ')).toBeNull();
  });

  it('a opção vazia do topo não conta como candidata', () => {
    const comVazio = [{ valor: '', rotulo: 'Não informado' }, ...OPCOES];
    expect(escolhaAoFechar(comVazio, 'bloomberg')?.valor).toBe('a');
  });
});
