/** As seis regras que recusam o envio de uma agenda — uma por teste.
 *
 *  ELAS VIVIAM DENTRO DE `Cadastro.tsx` SEM SEREM EXPORTADAS, e portanto sem
 *  nenhuma forma de serem verificadas: 1.700 linhas de página, seis regras que
 *  decidem se o trabalho de alguém é aceito, e zero testes. Este arquivo é a
 *  metade que faltava da extração — a outra é `corpo.test.ts`.
 *
 *  O QUE ELAS PROTEGEM é o que o servidor não tem como recusar de forma útil.
 *  Um material sem destino seria descartado em silêncio antes de sair da tela,
 *  e a pessoa veria "registro salvo" com um material a menos.
 */

import { describe, expect, it } from 'vitest';

import { VAZIO, novoUid } from '@/paginas/cadastro/formulario';
import type { Formulario } from '@/paginas/cadastro/formulario';
import { impedimentoNoFormulario, ondeEstaOMaterial } from '@/paginas/cadastro/impedimento';

const material = (mudanca: Partial<Formulario['materiais'][number]> = {}) => ({
  uid: novoUid(),
  momento: 'apoio',
  titulo: '',
  url: '',
  observacao: '',
  arquivo_id: null,
  arquivo: null,
  referencia_id: null,
  temas: [],
  ...mudanca,
});

/** Sem impedimento nenhum — é o contrapeso de todo teste abaixo. */
const LIMPO: Formulario = { ...VAZIO };

const NINGUEM = new Set<string>();

describe('o formulário sem impedimento', () => {
  it('não inventa recusa', () => {
    expect(impedimentoNoFormulario(LIMPO, null, NINGUEM)).toBeNull();
  });
});

describe('1. o material precisa levar a algum lugar', () => {
  it('título sem arquivo e sem link é recusado', () => {
    const form = { ...LIMPO, materiais: [material({ titulo: 'Nota técnica' })] };

    const impedimento = impedimentoNoFormulario(form, null, NINGUEM);

    expect(impedimento?.mensagem).toContain('não leva a lugar nenhum');
  });

  it('título com ARQUIVO passa, mesmo sem link', () => {
    // DESTINO É ARQUIVO **OU** LINK. Exigir o link bloquearia todo material que
    // veio por upload — título preenchido, link vazio — e a mensagem acusaria
    // de "pela metade" um material que está inteiro.
    const form = {
      ...LIMPO,
      materiais: [material({ titulo: 'Nota técnica', arquivo_id: 'arq-1' })],
    };

    expect(impedimentoNoFormulario(form, null, NINGUEM)).toBeNull();
  });

  it('título com LINK passa', () => {
    const form = {
      ...LIMPO,
      materiais: [material({ titulo: 'Nota', url: 'https://acervo/nota' })],
    };

    expect(impedimentoNoFormulario(form, null, NINGUEM)).toBeNull();
  });
});

describe('2. o material precisa ter nome', () => {
  it('link sem título é recusado', () => {
    const form = { ...LIMPO, materiais: [material({ url: 'https://acervo/x' })] };

    const impedimento = impedimentoNoFormulario(form, null, NINGUEM);

    expect(impedimento?.mensagem).toContain('Dê um título');
  });

  it('a linha completamente vazia NÃO é recusada', () => {
    // Ela é a linha que a pessoa acabou de acrescentar e ainda não preencheu.
    // Recusá-la transformaria "acrescentar material" num erro imediato.
    const form = { ...LIMPO, materiais: [material()] };

    expect(impedimentoNoFormulario(form, null, NINGUEM)).toBeNull();
  });
});

describe('3. a linha da outra parte precisa de pessoa', () => {
  it('linha sem pessoa escolhida é recusada, com o número dela', () => {
    const form = {
      ...LIMPO,
      outraParte: [{ interlocutor_id: '', presenca: '', principal: true }],
    };

    const impedimento = impedimentoNoFormulario(form, null, NINGUEM);

    expect(impedimento?.mensagem).toContain('linha 1');
    expect(impedimento?.mensagem).toContain('Pela outra parte');
  });
});

describe('4. trocar a instituição não deixa gente da anterior para trás', () => {
  const forasteiro = {
    ...LIMPO,
    outraParte: [{ interlocutor_id: 'p-9', presenca: '', principal: true }],
  };

  it('quem foi ACRESCENTADO agora e não pertence à instituição é recusado', () => {
    const impedimento = impedimentoNoFormulario(forasteiro, null, NINGUEM);

    expect(impedimento?.mensagem).toContain('não pertence');
  });

  it('quem JÁ VINHA do servidor é poupado — é legado, não erro novo', () => {
    // A REGRA MAIS SUTIL DO FORMULÁRIO, e a que ninguém verificava. Uma pessoa
    // que veio do servidor numa instituição diferente é fato consumado;
    // trancar a edição daquela agenda por causa dela seria punir quem não errou
    // nada agora. A diferença está em `carregado`, e não no estado final — no
    // registro salvo as duas situações são idênticas.
    const carregado = { ...forasteiro };

    expect(impedimentoNoFormulario(forasteiro, carregado, NINGUEM)).toBeNull();
  });

  it('quem pode representar a instituição escolhida passa', () => {
    const podem = new Set(['p-9']);

    expect(impedimentoNoFormulario(forasteiro, null, podem)).toBeNull();
  });
});

describe('5. a mesma guarda do lado da Aegea', () => {
  it('linha sem pessoa é recusada em vez de filtrada em silêncio', () => {
    // `montarCorpo` descartaria a linha sem pessoa, e filtrar em silêncio é
    // pior que recusar: a tela diria "Alterações salvas" e a linha que a pessoa
    // acabou de acrescentar teria sumido do registro, sem erro e sem pista.
    const form = {
      ...LIMPO,
      aegea: [{ pessoa_aegea_id: '', papel: 'porta_voz', presenca: '' }],
    };

    const impedimento = impedimentoNoFormulario(form, null, NINGUEM);

    expect(impedimento?.mensagem).toContain('Pela Aegea');
  });
});

describe('6. a mesma pessoa no mesmo papel', () => {
  it('é recusada antes de virar 422 do servidor', () => {
    const form = {
      ...LIMPO,
      aegea: [
        { pessoa_aegea_id: 'a-1', papel: 'porta_voz', presenca: '' },
        { pessoa_aegea_id: 'a-1', papel: 'porta_voz', presenca: '' },
      ],
    };

    const impedimento = impedimentoNoFormulario(form, null, NINGUEM);

    expect(impedimento?.mensagem).toContain('já está na lista');
  });

  it('a mesma pessoa em papéis DIFERENTES continua permitida', () => {
    // O contrapeso, e ele importa: `(pessoa, papel)` é a chave no backend.
    // Barrar aqui o que lá é válido seria a tela inventando uma regra própria.
    const form = {
      ...LIMPO,
      aegea: [
        { pessoa_aegea_id: 'a-1', papel: 'porta_voz', presenca: '' },
        { pessoa_aegea_id: 'a-1', papel: 'acompanha', presenca: '' },
      ],
    };

    expect(impedimentoNoFormulario(form, null, NINGUEM)).toBeNull();
  });
});

describe('a mensagem aponta a aba certa', () => {
  it('material de preparação manda para "antes"', () => {
    const form = { ...LIMPO, materiais: [material({ titulo: 'Nota' })] };

    expect(impedimentoNoFormulario(form, null, NINGUEM)?.etapa).toBe('antes');
  });

  it('material pós-reunião manda para "depois"', () => {
    // Sem isto, a mensagem apontaria "material 1" e a pessoa abriria a aba
    // errada procurando uma linha que está na outra.
    const form = { ...LIMPO, materiais: [material({ momento: 'obtido', titulo: 'Ata' })] };

    const impedimento = impedimentoNoFormulario(form, null, NINGUEM);

    expect(impedimento?.etapa).toBe('depois');
  });
});

describe('ondeEstaOMaterial', () => {
  it('numera dentro da ABA, e não na lista inteira', () => {
    // A pessoa vê "material 1" e "material 2" em cada aba. Numerar pela lista
    // completa mandaria procurar o "material 3" numa aba que só tem dois.
    const form = {
      ...LIMPO,
      materiais: [
        material({ momento: 'apoio', titulo: 'A' }),
        material({ momento: 'obtido', titulo: 'B' }),
        material({ momento: 'produzido', titulo: 'C' }),
      ],
    };

    expect(ondeEstaOMaterial(form, 2)).toEqual({ posicao: 2, etapa: 'depois' });
    expect(ondeEstaOMaterial(form, 0)).toEqual({ posicao: 1, etapa: 'antes' });
  });
});
