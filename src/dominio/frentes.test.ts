import { describe, expect, it } from 'vitest';
import {
  CAMPOS_DE_EXTENSAO,
  extensaoAoTrocarDeFrente,
  frenteDerivada,
  interlocutoresDaInstituicao,
} from '@/dominio/frentes';
import type { Frente } from '@/dominio/tipos';

describe('o que sobra da extensão ao trocar de frente', () => {
  // A tela zerava a extensão em toda troca. Governo, Parceiros e Eventos
  // compartilham a mesma extensão no backend, então isso apagava dado que
  // sobreviveria — e, desde que a seção desses campos saiu da tela, apagava
  // sem ninguém ver e sem como redigitar.

  it('guarda os campos que a nova frente também carrega', () => {
    expect(
      extensaoAoTrocarDeFrente(
        { cargo_interlocutor: 'Secretário', natureza_orgao: 'executivo' },
        'parceiros',
      ),
      // `natureza_orgao` está aposentada (categoria de público da instituição
      // a substitui) e não sobrevive: a tela não a pede nem a mostra.
    ).toEqual({ cargo_interlocutor: 'Secretário' });
  });

  it('descarta o nome do evento ao sair de Eventos', () => {
    // O outro extremo do mesmo erro: guardar tudo do grupo deixaria
    // `nome_evento` num registro de Governo, onde a ficha não o mostra.
    expect(
      extensaoAoTrocarDeFrente(
        { cargo_interlocutor: 'Secretário', nome_evento: 'Fórum Mundial da Água' },
        'governo',
      ),
    ).toEqual({ cargo_interlocutor: 'Secretário' });
  });

  it('esvazia quando nenhum campo é comum às duas frentes', () => {
    expect(
      extensaoAoTrocarDeFrente({ casa: 'senado_federal' }, 'interna'),
    ).toEqual({});
  });

  it('guarda o formato, que Imprensa e Investidores dividem', () => {
    // Frentes de classes DIFERENTES no backend, com um campo em comum: prova
    // que a regra é por campo, e não por classe de extensão.
    expect(
      extensaoAoTrocarDeFrente(
        { formato: 'entrevista', link_materia: 'https://exemplo' },
        'investidores',
      ),
    ).toEqual({ formato: 'entrevista' });
  });

  it('cada lista é um subconjunto do que o backend aceita para a frente', () => {
    // Se alguém acrescentar aqui um campo que a extensão daquela frente não
    // tem, o campo é DESCARTADO em silêncio na conversão do servidor — ele só
    // recusa o que está fora da união inteira. Quem digitou não vê erro; o
    // dado simplesmente não chega. Por isso a lista é conferida aqui.
    const DO_BACKEND: Record<Frente, string[]> = {
      imprensa: [
        'formato',
        'data_atendida',
        'data_publicacao',
        'link_materia',
        'mensagens_chave',
      ],
      governo: ['natureza_orgao', 'cargo_interlocutor', 'nome_evento'],
      parceiros: ['natureza_orgao', 'cargo_interlocutor', 'nome_evento'],
      eventos: ['natureza_orgao', 'cargo_interlocutor', 'nome_evento'],
      legislativo: ['casa', 'tramitacao', 'prioridade', 'ementa'],
      investidores: ['tipo_investidor', 'formato'],
      bancos_credores: ['natureza_orgao', 'cargo_interlocutor', 'nome_evento'],
      interna: [
        'natureza',
        'cumprimento',
        'complexidade',
        'prazo_dias',
        'data_retorno',
      ],
    };
    for (const [frente, campos] of Object.entries(CAMPOS_DE_EXTENSAO)) {
      for (const { campo } of campos) {
        expect(DO_BACKEND[frente as Frente]).toContain(campo);
      }
    }
  });
});

describe('a frente que a instituição e o formato derivam, sem perguntar', () => {
  // ESPELHA `test_derivar_frente.py` do backend — mesma regra, mesmos casos,
  // dos dois lados. Se um lado mudar sem o outro, os dois conjuntos de teste
  // divergem, e é isso que os mantém honestos entre si.

  it('sem instituição escolhida, não há o que derivar', () => {
    expect(frenteDerivada(undefined, undefined)).toBeNull();
  });

  it.each([
    ['area_interna', 'interna'],
    ['veiculo', 'imprensa'],
    ['orgao', 'governo'],
    ['investidor', 'investidores'],
    ['proposicao', 'legislativo'],
    ['credor', 'bancos_credores'],
  ] as const)('tipo "%s" decide sozinho: %s', (tipo, frenteEsperada) => {
    expect(frenteDerivada({ tipo }, undefined)).toBe(frenteEsperada);
    // O FORMATO NÃO MUDA NADA aqui — só "entidade" é ambíguo.
    expect(frenteDerivada({ tipo }, 'evento')).toBe(frenteEsperada);
  });

  it('entidade com formato Evento vira Eventos', () => {
    expect(frenteDerivada({ tipo: 'entidade' }, 'evento')).toBe('eventos');
  });

  it('entidade com qualquer outro formato, ou nenhum, vira Parceiros', () => {
    expect(frenteDerivada({ tipo: 'entidade' }, 'reuniao')).toBe('parceiros');
    expect(frenteDerivada({ tipo: 'entidade' }, undefined)).toBe('parceiros');
  });
});

describe('quem pode representar a instituição escolhida', () => {
  const pessoas = [
    { id: 'a', instituicao_id: 'i1' },
    { id: 'b', instituicao_id: 'i1' },
    { id: 'c', instituicao_id: 'i2' },
    { id: 'd', instituicao_id: null },
  ];

  it('só as da instituição escolhida', () => {
    expect(
      interlocutoresDaInstituicao(pessoas, 'i1', [], true).map((p) => p.id),
    ).toEqual(['a', 'b']);
  });

  it('sem instituição escolhida, não oferece ninguém', () => {
    // Vazia de propósito: é a ordem em que se preenche. Uma lista de 55 nomes
    // sem relação com nada seria pior que nenhuma.
    expect(interlocutoresDaInstituicao(pessoas, '', [], true).map((p) => p.id)).toEqual([]);
  });

  it('quem já está na agenda continua na lista', () => {
    // Uma agenda antiga pode ter pessoa de outra instituição. O campo abrindo
    // em branco pareceria dado perdido.
    expect(
      interlocutoresDaInstituicao(pessoas, 'i1', ['c'], true).map((p) => p.id),
    ).toEqual(['a', 'b', 'c']);
    expect(
      interlocutoresDaInstituicao(pessoas, '', ['c'], true).map((p) => p.id),
    ).toEqual(['c']);
  });

  it('não oferece quem foi desligado, mas mantém quem já está na agenda', () => {
    const comDesligadas = [
      { id: 'a', instituicao_id: 'i1', ativo: true },
      { id: 'b', instituicao_id: 'i1', ativo: false },
      { id: 'c', instituicao_id: 'i1', ativo: false },
    ];
    expect(
      interlocutoresDaInstituicao(comDesligadas, 'i1', ['c'], true).map((p) => p.id),
    ).toEqual(['a', 'c']);
  });

  it('instituição desativada: mantém quem já está na agenda e não oferece mais ninguém', () => {
    // Uma agenda antiga aponta para uma instituição que fechou depois. As
    // pessoas dela continuam ATIVAS no cadastro (desativar a instituição não
    // reescreve cada uma), mas disponível = pessoa ativa E instituição ativa.
    const ativas = [
      { id: 'a', instituicao_id: 'i1', ativo: true },
      { id: 'b', instituicao_id: 'i1', ativo: true },
    ];
    expect(
      interlocutoresDaInstituicao(ativas, 'i1', ['b'], false).map((p) => p.id),
    ).toEqual(['b']);
    expect(interlocutoresDaInstituicao(ativas, 'i1', [], false)).toEqual([]);
  });
});
