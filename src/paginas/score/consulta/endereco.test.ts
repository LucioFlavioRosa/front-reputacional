import { describe, expect, it } from 'vitest';

import { escreverEndereco, lerEndereco } from './endereco';
import type { EnderecoDoDrill } from './endereco';

describe('lerEndereco', () => {
  it('hash vazio ou de outro dono não é do drill', () => {
    expect(lerEndereco('')).toEqual({ ativo: false });
    expect(lerEndereco('#')).toEqual({ ativo: false });
    expect(lerEndereco('#topo')).toEqual({ ativo: false });
    expect(lerEndereco('#consultas&pilar=x')).toEqual({ ativo: false });
    expect(lerEndereco('#pilar=x&consulta')).toEqual({ ativo: false });
  });

  it('só o marcador ativa o drill no Nível 1', () => {
    expect(lerEndereco('#consulta')).toEqual({ ativo: true });
    expect(lerEndereco('consulta')).toEqual({ ativo: true });
  });

  it('lê todas as chaves', () => {
    expect(
      lerEndereco(
        '#consulta&lente=imprensa&pilar=eficiencia-operacional&tema=abastecimento-agua&subtema=rompimento-adutora' +
          '&sent=negativas&ordem=data&tier=Tier%201&conc=%C3%81guas%20do%20Rio&uf=RJ&item=rom-01',
      ),
    ).toEqual({
      ativo: true,
      lente: 'imprensa',
      pilar: 'eficiencia-operacional',
      tema: 'abastecimento-agua',
      subtema: 'rompimento-adutora',
      sent: 'negativas',
      ordem: 'data',
      tier: 'Tier 1',
      conc: 'Águas do Rio',
      uf: 'RJ',
      item: 'rom-01',
    });
  });

  it('descarta chave desconhecida, valor vazio, par sem "=" e valor fora da lista', () => {
    expect(lerEndereco('#consulta&foo=1&pilar=&tema&sent=algumas&ordem=alfabetica&uf=SP')).toEqual({
      ativo: true,
      uf: 'SP',
    });
  });

  it('não quebra com codificação malformada', () => {
    expect(lerEndereco('#consulta&conc=%E0%A4%A&uf=RJ')).toEqual({ ativo: true, uf: 'RJ' });
  });

  it('chave repetida vale a primeira', () => {
    expect(lerEndereco('#consulta&pilar=a&pilar=b')).toEqual({ ativo: true, pilar: 'a' });
  });
});

describe('escreverEndereco', () => {
  it('inativo vira string vazia', () => {
    expect(escreverEndereco({ ativo: false, pilar: 'x' })).toBe('');
  });

  it('só o marcador quando não há chaves', () => {
    expect(escreverEndereco({ ativo: true })).toBe('#consulta');
  });

  it('ordem fixa de chaves, independente da ordem do objeto', () => {
    const e: EnderecoDoDrill = {
      item: 'rom-01',
      uf: 'RJ',
      subtema: 's',
      ativo: true,
      tier: 'Tier 2',
      tema: 't',
      ordem: 'data',
      pilar: 'p',
      sent: 'positivas',
      lente: 'imprensa',
      conc: 'Corsan',
    };
    expect(escreverEndereco(e)).toBe(
      '#consulta&lente=imprensa&pilar=p&tema=t&subtema=s&sent=positivas&ordem=data&tier=Tier%202&conc=Corsan&uf=RJ&item=rom-01',
    );
  });

  it('omite vazios e padrões (sent=todas, ordem=impacto)', () => {
    expect(
      escreverEndereco({ ativo: true, lente: 'imprensa', pilar: '', sent: 'todas', ordem: 'impacto', tier: '  ' }),
    ).toBe('#consulta&lente=imprensa');
  });
});

describe('ida e volta', () => {
  const casos: EnderecoDoDrill[] = [
    { ativo: true },
    { ativo: true, lente: 'mercado' },
    { ativo: true, lente: 'imprensa', pilar: 'governanca', tema: 'contratos-regulacao' },
    { ativo: true, lente: 'imprensa', tier: 'Tier 1', conc: 'Águas do Rio', uf: 'RJ' },
    { ativo: true, conc: 'Concessionária & cia = 100% São João', sent: 'neutras', ordem: 'data' },
  ];

  it.each(casos)('%o', (e) => {
    expect(lerEndereco(escreverEndereco(e))).toEqual(e);
  });

  it('padrões somem na ida e não voltam', () => {
    expect(lerEndereco(escreverEndereco({ ativo: true, sent: 'todas', ordem: 'impacto' }))).toEqual({ ativo: true });
  });

  it('o hash escrito é estável (escrever ∘ ler ∘ escrever = escrever)', () => {
    const hash = escreverEndereco({ ativo: true, lente: 'imprensa', tier: 'Tier 1', conc: 'Águas do Rio' });
    expect(escreverEndereco(lerEndereco(hash))).toBe(hash);
    expect(hash).not.toContain(' ');
  });
});
