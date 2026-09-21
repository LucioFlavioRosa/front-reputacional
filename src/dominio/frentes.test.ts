/** Contraste dos chips, medido em vez de suposto.
 *
 *  Este arquivo existe por três reprovações reais. Eventos, laranja com texto
 *  branco, ficava em 2,20:1 — menos da metade do exigido. Interna em 3,13 e
 *  Investidores em 4,45, esta última reprovando por 0,05.
 *
 *  Nenhuma delas é visível numa revisão a olho, e é por isso que o teste
 *  existe: a próxima pessoa que "restaurar a cor original da marca" precisa
 *  descobrir na hora, e não meses depois pela boca de quem não conseguiu ler.
 */

import { describe, expect, it } from 'vitest';
import {
  CAMPOS_DE_EXTENSAO,
  CORES_DE_FRENTE,
  extensaoAoTrocarDeFrente,
  frenteDerivada,
  interlocutoresDaInstituicao,
  textoSobreFrente,
} from '@/dominio/frentes';
import type { Frente } from '@/dominio/tipos';

/** Luminância relativa, conforme a WCAG 2.1. */
function luminancia(hex: string): number {
  const canais = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lineares = canais.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * lineares[0] + 0.7152 * lineares[1] + 0.0722 * lineares[2];
}

/** Razão de contraste entre duas cores, de 1 (igual) a 21 (preto e branco). */
export function contraste(a: string, b: string): number {
  const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (escuro + 0.05);
}

/** O limiar que vale para o chip.
 *
 *  4,5:1 é o mínimo da WCAG AA para texto NORMAL. O chip é 11px em peso 700
 *  (`componentes/basicos.tsx`), e "texto grande" — que se contentaria com 3:1 —
 *  só começa em 18,66px negrito. Nenhum chip deste painel chega lá.
 */
const MINIMO_AA = 4.5;

describe('contraste do texto sobre a cor de cada frente', () => {
  const frentes = Object.keys(CORES_DE_FRENTE) as Frente[];

  it('cobre todas as frentes, para nenhuma nova escapar', () => {
    expect(frentes).toHaveLength(8);
  });

  it.each(frentes)('%s alcança AA', (frente) => {
    const razao = contraste(CORES_DE_FRENTE[frente], textoSobreFrente(frente));
    expect(razao, `${frente}: ${razao.toFixed(2)}:1, mínimo ${MINIMO_AA}`).toBeGreaterThanOrEqual(
      MINIMO_AA,
    );
  });

  it('a função de contraste está certa nos extremos conhecidos', () => {
    // Sem esta âncora, um erro na própria medição faria o teste acima aprovar
    // qualquer coisa — e um teste que não pode reprovar não protege nada.
    expect(contraste('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
    expect(contraste('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
  });

  it('Investidores é a folga mais estreita, e o número fica registrado', () => {
    // 4,52 contra o mínimo de 4,5 — passa por 0,02.
    //
    // O limiar do teste continua sendo 4,5, que é o da WCAG: exigir 4,6 aqui
    // faria a suíte afirmar um padrão que não existe. O que protege contra a
    // estreiteza é este número fixado: qualquer mexida na paleta que o desloque
    // aparece como diferença, e não como um verde que esconde 4,50.
    const razao = contraste(CORES_DE_FRENTE.investidores, textoSobreFrente('investidores'));
    expect(razao).toBeCloseTo(4.52, 2);
  });

  it('reprovaria a combinação que existia antes', () => {
    // Eventos com texto branco: o defeito real que motivou o arquivo.
    expect(contraste('#FE952B', '#FFFFFF')).toBeLessThan(MINIMO_AA);
  });
});

describe('o que sobra da extensão ao trocar de frente', () => {
  // A tela zerava a extensão em toda troca. Governo, Parceiros e Eventos
  // compartilham a mesma extensão no backend, então isso apagava dado que
  // sobreviveria — e, desde que a seção desses campos saiu da tela, apagava
  // sem ninguém ver e sem como redigitar.

  it('guarda os campos que a nova frente também carrega', () => {
    expect(
      extensaoAoTrocarDeFrente(
        { natureza_orgao: 'executivo', cargo_interlocutor: 'Secretário' },
        'parceiros',
      ),
    ).toEqual({ natureza_orgao: 'executivo', cargo_interlocutor: 'Secretário' });
  });

  it('descarta o nome do evento ao sair de Eventos', () => {
    // O outro extremo do mesmo erro: guardar tudo do grupo deixaria
    // `nome_evento` num registro de Governo, onde a ficha não o mostra.
    expect(
      extensaoAoTrocarDeFrente(
        {
          natureza_orgao: 'executivo',
          nome_evento: 'Fórum Mundial da Água',
        },
        'governo',
      ),
    ).toEqual({ natureza_orgao: 'executivo' });
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
