/** A ida e a volta entre o formulário e a API, campo por campo.
 *
 *  ESTE ARQUIVO EXISTE POR CAUSA DE UMA CONTA QUE O PRÓPRIO CÓDIGO REGISTRA.
 *  Dentro de `corpo.ts` há um comentário que diz, sobre um campo que se perdeu
 *  no corpo: "é a terceira vez que um campo declarado na tela e não enviado no
 *  corpo se perde em silêncio — a lição não pega sozinha".
 *
 *  Não pega mesmo. Depois dessa terceira houve uma quarta: o campo "Esfera"
 *  saiu do formulário, continuou viajando como `null` na edição, e quatro telas
 *  passaram a ler um campo que ninguém preenchia. O que faltava não era
 *  atenção — era um teste, e ele só se tornou possível quando `montarCorpo` e
 *  `paraFormulario` saíram de dentro de `Cadastro.tsx`, onde não eram
 *  exportadas e nenhum teste as alcançava.
 *
 *  O GUARDA DE VERDADE É O COMPILADOR. `DESTINO` classifica TODO campo de
 *  `Interacao`, e o tipo `Record<keyof Interacao, …>` faz o `tsc` recusar o
 *  arquivo quando um campo novo aparece sem destino declarado. Quem acrescenta
 *  um campo é obrigado a decidir, ali, se ele vai e volta, se deliberadamente
 *  não viaja, ou se é do servidor — em vez de descobrir meses depois que ele
 *  nunca chegou.
 */

import { describe, expect, it } from 'vitest';

import type { Interacao } from '@/dominio/tipos';
import { montarCorpo, paraFormulario } from '@/paginas/cadastro/corpo';

/** O que acontece com cada campo de `Interacao` no caminho de ida. */
type Destino =
  /** A tela edita: o corpo leva, e o valor tem de sobreviver à volta. */
  | 'ida-e-volta'
  /** A tela NÃO edita: o corpo omite de propósito, e o motivo está no código.
   *  Campo ausente o backend lê como "preserve"; `null` ele lê como "apague". */
  | 'nao-viaja'
  /** Quem preenche é o servidor. A tela lê e nunca manda. */
  | 'do-servidor'
  /** Só viaja no ESTADO que o torna possível: uma agenda confirmada não tem
   *  motivo de declínio, e uma que não é consulta recebida não tem consulta.
   *  Fora do estado, o corpo manda `null` — que na edição é o que LIMPA o
   *  campo, e é justamente o certo: ao passar de declinada para confirmada, o
   *  motivo do declínio tem de sair do registro. */
  | 'condicional';

const DESTINO: Record<keyof Interacao, Destino> = {
  data_interacao: 'ida-e-volta',
  instituicao_id: 'ida-e-volta',
  unidade_negocio_id: 'ida-e-volta',
  formato_interacao_id: 'ida-e-volta',
  uf: 'ida-e-volta',
  modalidade: 'ida-e-volta',
  local: 'ida-e-volta',
  tier: 'ida-e-volta',
  status: 'ida-e-volta',
  clima: 'ida-e-volta',
  resultado: 'ida-e-volta',
  iniciativa: 'ida-e-volta',
  relato: 'ida-e-volta',
  encaminhamentos: 'ida-e-volta',
  pendencias: 'ida-e-volta',
  observacoes: 'ida-e-volta',
  extensao: 'ida-e-volta',
  temas: 'ida-e-volta',
  areas: 'ida-e-volta',
  participacoes: 'ida-e-volta',
  consulta: 'condicional',
  alegacoes: 'condicional',
  expectativa: 'ida-e-volta',
  clima_esperado: 'ida-e-volta',
  declinado_por: 'condicional',
  motivo_declinio: 'condicional',
  nota_situacao: 'condicional',
  origens: 'ida-e-volta',
  preve_desdobramento: 'ida-e-volta',
  outra_parte: 'ida-e-volta',
  materiais: 'ida-e-volta',

  //: A tela não edita — e cada um destes tem o motivo escrito em `corpo.ts`.
  //: `pauta` quase destruiu a descrição das 60 agendas vindas da planilha;
  //: `esfera_id` é derivada da instituição pelo servidor; `interlocutor_id` é
  //: projetado de quem está marcado como principal na lista; `frente` é
  //: derivada do tipo da instituição.
  pauta: 'nao-viaja',
  posicionamento: 'nao-viaja',
  registro_url: 'nao-viaja',
  esfera_id: 'nao-viaja',
  interlocutor_id: 'nao-viaja',
  frente: 'nao-viaja',

  id: 'do-servidor',
  derivadas: 'do-servidor',
  fonte: 'do-servidor',
  visivel: 'do-servidor',
  criado_por: 'do-servidor',
  criado_em: 'do-servidor',
  atualizado_em: 'do-servidor',
};

/** Uma agenda com todo campo QUE ESTE ESTADO PERMITE preenchido.
 *
 *  E não "todo campo", que era o que esta linha dizia antes e não era verdade:
 *  uma agenda confirmada não tem motivo de declínio, e uma que não é consulta
 *  recebida não tem bloco de consulta. Esses são os `condicional` do `DESTINO`,
 *  e têm testes próprios com o estado que os torna possíveis.
 *
 *  O que NÃO pode ficar vazio aqui é um campo `ida-e-volta`: ele passaria pelo
 *  teste sem ser exercitado, que é precisamente como um campo se perde sem
 *  ninguém ver. */
const COMPLETA: Interacao = {
  id: 'i-1',
  frente: 'imprensa',
  data_interacao: '2026-05-07',
  instituicao_id: 'inst-1',
  interlocutor_id: 'pessoa-1',
  unidade_negocio_id: 3,
  esfera_id: 4,
  formato_interacao_id: 2,
  uf: 'SP',
  modalidade: 'presencial',
  local: 'Sede, sala 3',
  tier: 1,
  status: 'confirmada',
  clima: 'propositivo',
  resultado: 'avancou',
  iniciativa: 'aegea',
  pauta: 'Reajuste tarifário',
  posicionamento: 'Nota da diretoria',
  relato: 'A conversa correu bem',
  encaminhamentos: 'Enviar a nota técnica',
  pendencias: 'Confirmar a data seguinte',
  observacoes: 'Sala trocada na véspera',
  registro_url: 'https://intranet/registro/1',
  extensao: { formato: 'entrevista' },
  temas: [7, 9],
  areas: [2],
  participacoes: [
    { pessoa_aegea_id: 'aegea-1', papel: 'porta_voz', presenca: 'presente' },
  ],
  consulta: null,
  alegacoes: ['a-1'],
  expectativa: 'Destravar o pleito',
  clima_esperado: 'neutro',
  declinado_por: null,
  motivo_declinio: null,
  nota_situacao: 'Aceita com ressalva de pauta',
  origens: ['i-0'],
  derivadas: 0,
  preve_desdobramento: true,
  outra_parte: [
    { interlocutor_id: 'pessoa-9', presenca: 'presente', principal: true },
  ],
  materiais: [
    {
      id: 'mat-1',
      momento: 'apoio',
      titulo: 'Nota técnica',
      url: 'https://acervo/nota',
      observacao: 'Versão de maio',
      arquivo: { id: 'arq-1', nome: 'nota.pdf', tipo_conteudo: 'application/pdf', tamanho: 1024 },
      referencia_id: 'ref-1',
      temas: [7],
    },
  ],
  fonte: 'cadastro_manual',
  visivel: true,
  criado_por: 'u-1',
  criado_em: '2026-05-01T10:00:00Z',
  atualizado_em: '2026-05-02T10:00:00Z',
};

/** Os campos que devem sobreviver, lidos da classificação — e não de uma
 *  segunda lista escrita à mão, que é como as duas divergem. */
const IDA_E_VOLTA = (Object.keys(DESTINO) as (keyof Interacao)[]).filter(
  (campo) => DESTINO[campo] === 'ida-e-volta',
);

const NAO_VIAJA = (Object.keys(DESTINO) as (keyof Interacao)[]).filter(
  (campo) => DESTINO[campo] === 'nao-viaja',
);

/** O corpo que `COMPLETA` tem de produzir, campo a campo.
 *
 *  UMA COMPARAÇÃO, E NÃO TRINTA E UMA ASSERÇÕES À MÃO. A primeira versão deste
 *  arquivo só checava presença e não-nulidade de cada campo — o que deixaria
 *  passar um valor TROCADO com o do vizinho, truncado, ou convertido errado.
 *  Um `unidade_negocio_id` que chegasse como `"3"` em vez de `3` passava, e o
 *  backend o recusaria com 422 na cara de quem salvou.
 *
 *  Os valores são deliberadamente DISTINTOS entre si: com dois campos valendo a
 *  mesma coisa, trocá-los um pelo outro não falharia. */
const ESPERADO: Record<string, unknown> = {
  data_interacao: '2026-05-07',
  instituicao_id: 'inst-1',
  unidade_negocio_id: 3,
  formato_interacao_id: 2,
  uf: 'SP',
  modalidade: 'presencial',
  local: 'Sede, sala 3',
  tier: 1,
  status: 'confirmada',
  clima: 'propositivo',
  resultado: 'avancou',
  iniciativa: 'aegea',
  relato: 'A conversa correu bem',
  encaminhamentos: 'Enviar a nota técnica',
  pendencias: 'Confirmar a data seguinte',
  observacoes: 'Sala trocada na véspera',
  temas: [7, 9],
  areas: [2],
  expectativa: 'Destravar o pleito',
  clima_esperado: 'neutro',
  origens: ['i-0'],
  preve_desdobramento: true,
};

describe('a ida e a volta', () => {
  it('cada campo chega ao corpo com o VALOR que tinha', () => {
    // EDIÇÃO (`paraEdicao = true`) porque é o caminho perigoso: ali o vazio
    // vira `null`, e `null` quer dizer APAGUE. Na criação um campo perdido
    // apenas não chega; na edição ele destrói o que estava gravado.
    const corpo = montarCorpo(paraFormulario(COMPLETA), true) as Record<string, unknown>;

    expect(corpo).toMatchObject(ESPERADO);
  });

  it.each(IDA_E_VOLTA)('%s não some do corpo', (campo) => {
    // A rede embaixo do `ESPERADO`: ele lista os campos escalares, e esta
    // varredura cobre TODOS os `ida-e-volta` — inclusive os de estrutura
    // (participações, materiais, outra parte, extensão), que têm asserções
    // próprias mais abaixo. Um campo novo classificado como ida-e-volta cai
    // nesta rede mesmo que ninguém o acrescente ao `ESPERADO`.
    const corpo = montarCorpo(paraFormulario(COMPLETA), true) as Record<string, unknown>;

    expect(corpo, `${campo} sumiu do corpo`).toHaveProperty(campo);
    expect(corpo[campo], `${campo} chegou vazio ao corpo`).not.toBeNull();
    expect(corpo[campo], `${campo} chegou indefinido ao corpo`).toBeDefined();
  });

  it('o `ESPERADO` cobre todo campo escalar de ida e volta', () => {
    // SEM ISTO, O `toMatchObject` ENCOLHE EM SILÊNCIO: alguém acrescenta um
    // campo ao `DESTINO`, não o acrescenta ao `ESPERADO`, e a comparação de
    // valor deixa de cobri-lo sem nada ficar vermelho.
    const deEstrutura = new Set([
      'extensao', 'participacoes', 'outra_parte', 'materiais', 'consulta',
    ]);
    const escalares = IDA_E_VOLTA.filter((campo) => !deEstrutura.has(campo));

    expect(escalares.filter((campo) => !(campo in ESPERADO))).toEqual([]);
  });

  it.each(NAO_VIAJA)('%s NÃO viaja — a tela não opina sobre ele', (campo) => {
    // A ASSERÇÃO É A AUSÊNCIA DA CHAVE, e não `null`. São coisas diferentes
    // para o backend: ausente é "preserve", `null` é "apague". Foi mandando
    // `null` num campo que a tela deixou de editar que a `pauta` quase foi
    // destruída, e que a `esfera_id` foi.
    const corpo = montarCorpo(paraFormulario(COMPLETA), true) as Record<string, unknown>;

    expect(corpo, `${campo} voltou a viajar no corpo`).not.toHaveProperty(campo);
  });
});

describe('os valores, e não só as chaves', () => {
  it('o que era texto volta igual', () => {
    const corpo = montarCorpo(paraFormulario(COMPLETA), true) as Record<string, unknown>;

    expect(corpo.uf).toBe('SP');
    expect(corpo.local).toBe('Sede, sala 3');
    expect(corpo.relato).toBe('A conversa correu bem');
    expect(corpo.nota_situacao).toBe('Aceita com ressalva de pauta');
  });

  it('o que era número volta número, e não texto', () => {
    // O formulário guarda tudo como string; a volta tem de reconverter. Um
    // número que chegasse como `"3"` seria recusado pelo backend com 422.
    const corpo = montarCorpo(paraFormulario(COMPLETA), true) as Record<string, unknown>;

    expect(corpo.unidade_negocio_id).toBe(3);
    expect(corpo.formato_interacao_id).toBe(2);
    expect(corpo.tier).toBe(1);
  });

  it('as listas voltam com o mesmo conteúdo', () => {
    const corpo = montarCorpo(paraFormulario(COMPLETA), true) as Record<string, unknown>;

    expect(corpo.temas).toEqual([7, 9]);
    expect(corpo.areas).toEqual([2]);
    expect(corpo.origens).toEqual(['i-0']);
  });

  it('o material mantém o vínculo com a biblioteca', () => {
    // O terceiro incidente registrado no código: `referencia_id` era declarado
    // na tela e não ia no corpo. Ao reabrir, a agenda não sabia mais quais
    // linhas ela mesma trouxe, e desmarcar o assunto não tinha o que devolver.
    const corpo = montarCorpo(paraFormulario(COMPLETA), true) as Record<string, unknown>;
    const materiais = corpo.materiais as Record<string, unknown>[];

    expect(materiais).toHaveLength(1);
    expect(materiais[0].referencia_id).toBe('ref-1');
    expect(materiais[0].id).toBe('mat-1');
    expect(materiais[0].titulo).toBe('Nota técnica');
  });

  it('o `uid` da tela não vaza para o servidor', () => {
    // Ele é identidade de interface, criada a cada abertura do formulário.
    const corpo = montarCorpo(paraFormulario(COMPLETA), true) as Record<string, unknown>;
    const materiais = corpo.materiais as Record<string, unknown>[];

    expect(materiais[0]).not.toHaveProperty('uid');
  });
});

describe('a diferença entre criar e editar', () => {
  it('na CRIAÇÃO o campo vazio fica ausente, e não nulo', () => {
    // Ausente o backend lê como "não informado"; `null` como "apague". Na
    // criação não há o que apagar, e mandar `null` seria afirmar uma decisão
    // que ninguém tomou.
    const vazia = { ...COMPLETA, local: null, relato: null };
    const corpo = montarCorpo(paraFormulario(vazia), false) as Record<string, unknown>;

    expect(corpo.local).toBeUndefined();
    expect(corpo.relato).toBeUndefined();
  });

  it('na EDIÇÃO o campo esvaziado vira `null`, que é o que apaga', () => {
    const vazia = { ...COMPLETA, local: null, relato: null };
    const corpo = montarCorpo(paraFormulario(vazia), true) as Record<string, unknown>;

    expect(corpo.local).toBeNull();
    expect(corpo.relato).toBeNull();
  });
});

describe('os campos que só valem no estado certo', () => {
  it('a agenda declinada leva o motivo; a confirmada o limpa', () => {
    // O `null` aqui não é descuido, é a regra: ao passar de declinada para
    // confirmada, o motivo do declínio TEM de sair do registro, senão ele fica
    // afirmando uma recusa que não existe mais.
    const declinada = {
      ...COMPLETA,
      status: 'declinado',
      declinado_por: 'outra_parte',
      motivo_declinio: 'Agenda do ministro',
    };

    const corpoDeclinada = montarCorpo(paraFormulario(declinada), true) as Record<
      string,
      unknown
    >;
    expect(corpoDeclinada.declinado_por).toBe('outra_parte');
    expect(corpoDeclinada.motivo_declinio).toBe('Agenda do ministro');

    const corpoConfirmada = montarCorpo(paraFormulario(COMPLETA), true) as Record<
      string,
      unknown
    >;
    expect(corpoConfirmada.declinado_por).toBeNull();
    expect(corpoConfirmada.motivo_declinio).toBeNull();
  });

  it('as alegações só viajam na consulta recebida', () => {
    // ACHADO PELO PRÓPRIO TESTE, ao passar a comparar valor em vez de só
    // presença — e é a mesma classe do `nota_situacao`: eu havia classificado
    // como "ida e volta" um campo que o código trata como condicional.
    // `montarCorpo` manda `[]` fora da consulta, porque uma agenda que não é
    // consulta não tem o que alegar.
    const foraDaConsulta = montarCorpo(paraFormulario(COMPLETA), true, false) as Record<
      string,
      unknown
    >;
    expect(foraDaConsulta.alegacoes).toEqual([]);

    const comAlegacao = { ...COMPLETA, alegacoes: ['a-1'] };
    const naConsulta = montarCorpo(paraFormulario(comAlegacao), true, true) as Record<
      string,
      unknown
    >;
    expect(naConsulta.alegacoes).toEqual(['a-1']);
  });

  it('a nota da situação só vale na agenda confirmada', () => {
    // EU TINHA CLASSIFICADO ESTE COMO "ida e volta", e ele é condicional. O
    // teste passava por acidente: `COMPLETA` está com status `confirmada`, que
    // é justamente o estado em que o campo viaja. Com qualquer outro status ele
    // vai a `null` — e isso é a regra, não descuido: quem corrigiu a situação de
    // "aceito" para "negado" não quer a condição do aceite ainda gravada.
    const confirmada = montarCorpo(paraFormulario(COMPLETA), true) as Record<
      string,
      unknown
    >;
    expect(confirmada.nota_situacao).toBe('Aceita com ressalva de pauta');

    const realizada = montarCorpo(
      paraFormulario({ ...COMPLETA, status: 'realizado' }),
      true,
    ) as Record<string, unknown>;
    expect(realizada.nota_situacao).toBeNull();
  });

  it('o bloco da consulta só viaja quando o tipo é consulta recebida', () => {
    const corpo = montarCorpo(paraFormulario(COMPLETA), true, false) as Record<
      string,
      unknown
    >;

    expect(corpo.consulta).toBeNull();
  });
});
