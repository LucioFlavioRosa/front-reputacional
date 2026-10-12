/** A ficha vai e volta sem perder campo — e é isso que o módulo existe para
 *  garantir.
 *
 *  O DEFEITO QUE ESTES TESTES PRENDEM já aconteceu duas vezes neste código, e os
 *  dois estão documentados em comentário:
 *
 *    "SEM ESTES DOIS, O PUT OS APAGAVA. A edição manda a ficha INTEIRA, e o
 *     backend substitui o que recebe: `cargo` e `interlocutor_id` omitidos
 *     viravam nulo, então corrigir o nome de um perfil perdia o cargo e a pessoa
 *     sem ninguém notar."
 *
 *    "ESCRITO UMA VEZ. A forma estava em três lugares e ao acrescentar `tier` os
 *     três divergiram na mesma hora."
 *
 *  A PROPRIEDADE É A IDA E VOLTA: pegar um cadastro gravado, virar rascunho, e
 *  voltar a corpo de PUT tem de devolver os MESMOS valores. Um campo que falte
 *  no caminho não quebra nada — ele apaga o dado, em silêncio, de quem só queria
 *  corrigir o nome.
 *
 *  POR ISSO O TESTE COMPARA CAMPO A CAMPO E NÃO CONTA CHAVES: contar diria
 *  "mudou", e o que importa é QUAL mudou. E `toEqual` com o objeto inteiro
 *  falharia por ordem de chave sem dizer nada útil.
 */

import { describe, expect, it } from 'vitest';

import type { TemaCadastrado } from '@/api/cliente';
import type {
  Instituicao,
  Interlocutor,
  MacroTema,
  PessoaAegea,
} from '@/dominio/tipos';
import {
  entradaDaInstituicao,
  entradaDaPessoaAegea,
  entradaDoInterlocutor,
  entradaDoTema,
  rascunhoDaInstituicao,
  rascunhoDaPessoaAegea,
  rascunhoDoInterlocutor,
  rascunhoDoTema,
} from '@/paginas/cadastroCompartilhado/fichas';

//: UM PERFIL DE REDE COMPLETO, de propósito: é o tipo que tem TODOS os campos
//: preenchidos, inclusive os dois que já foram apagados por omissão (`cargo` e
//: `interlocutor_id`). Um `veiculo` passaria no teste com os dois nulos.
const O_PERFIL: Instituicao = {
  id: 'inst-1',
  nome: 'stelafariasrs',
  tipo: 'perfil_rede',
  nome_completo: 'Stela Farias — perfil no X',
  esfera_id: 3,
  uf: 'RS',
  tier: 2,
  categoria_publico_id: 4,
  subcategoria_publico_id: 41,
  cargo: 'Deputado estadual',
  interlocutor_id: 'pessoa-stela',
  ativo: true,
};

describe('a ficha da instituição', () => {
  it('vai e volta sem perder NENHUM campo', () => {
    const corpo = entradaDaInstituicao(
      rascunhoDaInstituicao(O_PERFIL),
      O_PERFIL.ativo,
    );

    expect(corpo.nome).toBe(O_PERFIL.nome);
    expect(corpo.tipo).toBe(O_PERFIL.tipo);
    expect(corpo.nome_completo).toBe(O_PERFIL.nome_completo);
    expect(corpo.esfera_id).toBe(O_PERFIL.esfera_id);
    expect(corpo.uf).toBe(O_PERFIL.uf);
    expect(corpo.tier).toBe(O_PERFIL.tier);
    expect(corpo.categoria_publico_id).toBe(O_PERFIL.categoria_publico_id);
    expect(corpo.subcategoria_publico_id).toBe(O_PERFIL.subcategoria_publico_id);
    //: OS DOIS QUE JÁ FORAM APAGADOS POR OMISSÃO.
    expect(corpo.cargo).toBe(O_PERFIL.cargo);
    expect(corpo.interlocutor_id).toBe(O_PERFIL.interlocutor_id);
    expect(corpo.ativo).toBe(true);
  });

  it('o VAZIO vira null, e não 0', () => {
    //: As instituições anteriores às colunas de tier e de categoria não têm
    //: valor, e corrigir o nome de uma delas não pode obrigar a classificá-la
    //: primeiro. `Number('')` é 0, que é um tier VÁLIDO — por isso a conversão
    //: é condicional e não direta.
    const semNada: Instituicao = {
      ...O_PERFIL,
      tipo: 'veiculo',
      nome_completo: null,
      esfera_id: null,
      uf: null,
      tier: null,
      categoria_publico_id: null,
      subcategoria_publico_id: null,
      cargo: null,
      interlocutor_id: null,
    };

    const corpo = entradaDaInstituicao(rascunhoDaInstituicao(semNada), true);

    expect(corpo.nome_completo).toBeNull();
    expect(corpo.esfera_id).toBeNull();
    expect(corpo.uf).toBeNull();
    expect(corpo.tier).toBeNull();
    expect(corpo.categoria_publico_id).toBeNull();
    expect(corpo.subcategoria_publico_id).toBeNull();
    expect(corpo.cargo).toBeNull();
    expect(corpo.interlocutor_id).toBeNull();
  });

  it('`ativo` vem de FORA do rascunho', () => {
    //: Desativar não abre a edição: o botão manda a ficha de quem já está
    //: gravado com o `ativo` invertido. Se `ativo` viesse do rascunho, o
    //: desativar precisaria de um rascunho — e seria um quarto lugar montando a
    //: ficha à mão.
    expect(entradaDaInstituicao(rascunhoDaInstituicao(O_PERFIL), false).ativo).toBe(
      false,
    );
  });
});

const A_PESSOA: Interlocutor = {
  id: 'pessoa-1',
  nome: 'Artur Santa',
  instituicao_id: 'inst-xp',
  cargo: 'Diretor de RI',
  area: 'Relações com Investidores',
  email: 'artur@exemplo.com',
  redes_sociais: ['https://x.com/artur', '@artur'],
  tipo: 'investidor',
  ativo: true,
};

describe('a ficha do contato', () => {
  it('vai e volta sem perder NENHUM campo', () => {
    const corpo = entradaDoInterlocutor(rascunhoDoInterlocutor(A_PESSOA), {
      instituicao_id: A_PESSOA.instituicao_id,
      tipo: A_PESSOA.tipo,
      ativo: A_PESSOA.ativo,
    });

    expect(corpo.nome).toBe(A_PESSOA.nome);
    expect(corpo.email).toBe(A_PESSOA.email);
    expect(corpo.cargo).toBe(A_PESSOA.cargo);
    expect(corpo.area).toBe(A_PESSOA.area);
    expect(corpo.redes_sociais).toEqual(A_PESSOA.redes_sociais);
    //: OS TRÊS QUE VÊM POR FORA, e é por isso que eles são exigidos: o PUT
    //: substitui a ficha inteira, então esquecer um apaga o valor. Este payload
    //: estava escrito à mão em DOIS lugares, com os oito campos cada.
    expect(corpo.instituicao_id).toBe(A_PESSOA.instituicao_id);
    expect(corpo.tipo).toBe(A_PESSOA.tipo);
    expect(corpo.ativo).toBe(true);
  });

  it('as redes sociais sobrevivem a uma edição de nome', () => {
    //: O CASO CONCRETO: a pessoa abre o contato para corrigir o nome e salva.
    //: Com `redes_sociais` fora do payload, o PUT as apagaria — e ninguém
    //: notaria, porque a lista não aparece na linha da tabela.
    const rascunho = { ...rascunhoDoInterlocutor(A_PESSOA), nome: 'Artur Santa Jr.' };
    const corpo = entradaDoInterlocutor(rascunho, {
      instituicao_id: A_PESSOA.instituicao_id,
      tipo: A_PESSOA.tipo,
      ativo: true,
    });

    expect(corpo.nome).toBe('Artur Santa Jr.');
    expect(corpo.redes_sociais).toEqual(A_PESSOA.redes_sociais);
  });
});

describe('o rascunho NAO compartilha array com o cadastro', () => {
  it('mexer na lista do rascunho nao mexe na do cadastro', () => {
    //: ACHADO DE REVISAO, e e sobre o que vem: a tela de hoje atualiza arrays de
    //: forma imutavel, entao nao havia defeito. Mas este modulo nasceu para ser
    //: reusado pelo MODAL da fila, e um formulario que faca
    //: ascunho.redes_sociais.push(...)\ mexeria no objeto do CATALOGO — a
    //: lista apareceria mudada em toda tela antes de alguem salvar, e voltaria ao
    //: normal no proximo F5. Defeito desses custa meio dia para ser acreditado.
    const rascunho = rascunhoDoInterlocutor(A_PESSOA);
    rascunho.redes_sociais.push('https://instagram.com/intruso');

    expect(A_PESSOA.redes_sociais).toEqual([
      'https://x.com/artur',
      '@artur',
    ]);
  });

  it('o corpo do PUT nao compartilha array com o rascunho', () => {
    const rascunho = rascunhoDoInterlocutor(A_PESSOA);
    const corpo = entradaDoInterlocutor(rascunho, {
      instituicao_id: 'inst-xp',
      tipo: 'investidor',
      ativo: true,
    });

    rascunho.redes_sociais.push('@depois-de-montar-o-corpo');

    expect(corpo.redes_sociais).toHaveLength(2);
  });
});


//: OS MACRO TEMAS, para a ficha derivar o PILAR. Ver `rascunhoDoTema`: o pilar
//: não vem do back, só `macro_tema_id` é guardado em `tema`.
const MACROS: MacroTema[] = [
  { id: 9, bloco_tema_id: 2, codigo: 'integridade', nome: 'Integridade', ordem: 1 },
  { id: 10, bloco_tema_id: 3, codigo: 'tarifa', nome: 'Tarifa', ordem: 2 },
];

//: UM TEMA COM TODOS OS EIXOS PREENCHIDOS, de propósito: é o único caso que
//: prova a ida e volta de `riscos`, `camada_lso` e `macro_tema_id` ao mesmo
//: tempo. Um tema recém-criado por planilha tem os três vazios e passaria sem
//: afirmar nada.
const O_TEMA: TemaCadastrado = {
  id: 44,
  nome: 'Qualidade da água',
  nivel: 'sensivel',
  ativo: true,
  e_risco: true,
  macro_tema_id: 9,
  camada_lso: 'legitimidade',
  //: `area_dona_id` NÃO ESTÁ AQUI, e o `tsc` foi quem me disse:
  //: TemaCadastrado nao o traz, entao a tela nao o edita — e
  //: entradaDoTema nao o manda. O back preserva o campo por
  //: model_fields_set, que e exatamente o caso que aquele mecanismo
  //: existe para cobrir.
  riscos: [3, 7],
};

describe('a ficha do tema', () => {
  it('vai e volta sem perder NENHUM campo', () => {
    const corpo = entradaDoTema(rascunhoDoTema(O_TEMA, MACROS), O_TEMA.ativo);

    expect(corpo.nome).toBe(O_TEMA.nome);
    expect(corpo.nivel).toBe(O_TEMA.nivel);
    expect(corpo.e_risco).toBe(O_TEMA.e_risco);
    expect(corpo.macro_tema_id).toBe(O_TEMA.macro_tema_id);
    expect(corpo.camada_lso).toBe(O_TEMA.camada_lso);
    //: OS RISCOS, que são o campo que mais dói perder: eles ligam o tema à
    //: matriz corporativa, e a ligação não é derivável de nada.
    expect(corpo.riscos).toEqual(O_TEMA.riscos);
    expect(corpo.ativo).toBe(true);
  });

  it('o PILAR é derivado do tema estratégico', () => {
    //: O PILAR NÃO VEM DO BACK — só `macro_tema_id` é guardado em `tema`. Sem
    //: esta derivação o seletor em cascata abriria vazio e, pior, trocar
    //: qualquer coisa no formulário mandaria `macro_tema_id` embora: o seletor
    //: desmarca o tema estratégico quando o pilar muda.
    expect(rascunhoDoTema(O_TEMA, MACROS).bloco_tema_id).toBe(2);
    //: E NÃO VAI NO PUT: é estado do seletor, não coluna.
    expect('bloco_tema_id' in entradaDoTema(rascunhoDoTema(O_TEMA, MACROS), true)).toBe(
      false,
    );
  });

  it('o tema sem hierarquia não inventa pilar', () => {
    const solto: TemaCadastrado = {
      ...O_TEMA,
      macro_tema_id: null,
      camada_lso: null,
      e_risco: null,
      riscos: [],
    };
    const rascunho = rascunhoDoTema(solto, MACROS);

    expect(rascunho.bloco_tema_id).toBeNull();
    //: `e_risco` NULO VIRA FALSO no rascunho, porque o campo é uma caixa — e
    //: volta como `false`, não como nulo. É uma afirmação da tela: quem abriu o
    //: formulário e salvou disse "não é tema de risco".
    expect(rascunho.e_risco).toBe(false);
    expect(entradaDoTema(rascunho, true).camada_lso).toBeNull();
  });
});

const A_PESSOA_AEGEA: PessoaAegea = {
  id: 'aegea-1',
  nome: 'Radamés Casseb',
  cargo: 'Diretor de Comunicação',
  email: 'radames@exemplo.com',
  eh_porta_voz: true,
  area_id: 4,
  ativo: true,
  temas: [44, 51, 60],
};

describe('a ficha da pessoa da Aegea', () => {
  it('vai e volta sem perder NENHUM campo', () => {
    const corpo = entradaDaPessoaAegea(
      rascunhoDaPessoaAegea(A_PESSOA_AEGEA),
      A_PESSOA_AEGEA.ativo,
    );

    expect(corpo.nome).toBe(A_PESSOA_AEGEA.nome);
    expect(corpo.cargo).toBe(A_PESSOA_AEGEA.cargo);
    expect(corpo.email).toBe(A_PESSOA_AEGEA.email);
    expect(corpo.eh_porta_voz).toBe(A_PESSOA_AEGEA.eh_porta_voz);
    expect(corpo.area_id).toBe(A_PESSOA_AEGEA.area_id);
    //: A LISTA DE TEMAS, e é a terceira vez que este campo aparece como
    //: armadilha neste código: "o PUT substitui a lista inteira, e mandar []
    //: num simples desligar apagaria tudo o que a pessoa podia falar".
    expect(corpo.temas).toEqual(A_PESSOA_AEGEA.temas);
    expect(corpo.ativo).toBe(true);
  });

  it('os temas sobrevivem a um DESLIGAR', () => {
    //: O CASO CONCRETO, e o botão onde a armadilha morava até agora: desligar
    //: manda a ficha de quem já está gravado com o `ativo` invertido, e os temas
    //: têm de ir junto.
    const corpo = entradaDaPessoaAegea(
      rascunhoDaPessoaAegea(A_PESSOA_AEGEA),
      !A_PESSOA_AEGEA.ativo,
    );

    expect(corpo.ativo).toBe(false);
    expect(corpo.temas).toEqual([44, 51, 60]);
  });

  it('o rascunho NAO compartilha a lista de temas', () => {
    const rascunho = rascunhoDaPessoaAegea(A_PESSOA_AEGEA);
    rascunho.temas.push(999);

    expect(A_PESSOA_AEGEA.temas).toEqual([44, 51, 60]);
  });
});
