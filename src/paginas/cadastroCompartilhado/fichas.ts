/** A FICHA DE CADA CADASTRO COMPARTILHADO: do registro para o formulário, e do
 *  formulário para o corpo do PUT.
 *
 *  POR QUE ESTE MÓDULO EXISTE, e os comentários que vieram com o código são o
 *  argumento. `entradaDaInstituicao` dizia, dentro de `CadastroDeInstituicoes`:
 *
 *    "SEM ESTES DOIS, O PUT OS APAGAVA. A edição manda a ficha INTEIRA, e o
 *     backend substitui o que recebe: `cargo` e `interlocutor_id` omitidos
 *     viravam nulo, então corrigir o nome de um perfil perdia o cargo e a pessoa
 *     sem ninguém notar."
 *
 *  e `RascunhoDaInstituicao` dizia:
 *
 *    "ESCRITO UMA VEZ. A forma estava em três lugares — o estado, a prop da
 *     linha e a assinatura do callback — e ao acrescentar `tier` os três
 *     divergiram na mesma hora."
 *
 *  A ABA DE REVISÃO PASSOU A EDITAR OS MESMOS CADASTROS, num modal, e uma
 *  segunda cópia dessas funções reintroduziria exatamente o defeito que esses
 *  dois comentários registram ter consertado. Então elas saíram da página e
 *  viraram módulo: uma ficha, um lugar que diz quais são os campos dela.
 *
 *  E A EXTRAÇÃO JÁ PAGOU NA MUDANÇA: o corpo do PUT de interlocutor estava
 *  escrito à mão em DOIS lugares de `CadastroDeInstituicoes`, com os oito campos
 *  cada — "Salvar" e "Desligar". Agora é um.
 *
 *  SEM JSX AQUI. É mapeamento, e é o que permite testá-lo sem montar tela.
 */

import type {
  InstituicaoEntrada,
  InterlocutorEntrada,
} from '@/api/cliente';
import type { Catalogo } from '@/dominio/derivacoes';
import type {
  Instituicao,
  Interlocutor,
  SubcategoriaPublicoDoDicionario,
} from '@/dominio/tipos';

/** As subcategorias de UMA categoria, na ordem — `subcategorias_publico` vem
 *  do dicionário inteiro, de todas as categorias juntas (ver
 *  `Dicionarios.subcategorias_publico`), então quem monta o `<select>`
 *  dependente sempre filtra por `categoria_publico_id` primeiro. */
export function subcategoriasDe(
  catalogo: Catalogo,
  categoriaPublicoId: string,
): SubcategoriaPublicoDoDicionario[] {
  const id = Number(categoriaPublicoId);
  return catalogo.dicionarios.subcategorias_publico
    .filter((s) => s.categoria_publico_id === id)
    .sort((a, b) => a.ordem - b.ordem);
}

/** O que a edição de uma instituição mexe.
 *
 *  `tier` é string porque vem de um `<select>`, e vira número só na hora de
 *  enviar: guardar número aqui obrigaria a representar "nada escolhido" como
 *  0 ou NaN, que são valores e não ausências.
 */
export interface RascunhoDaInstituicao {
  nome: string;
  nome_completo: string;
  tipo: string;
  uf: string;
  esfera: string;
  tier: string;
  categoria_publico_id: string;
  subcategoria_publico_id: string;
  /** O cargo do perfil de rede — "Deputado estadual". Só aparece no
   *  formulário quando o tipo é `perfil_rede`, e é editável porque o
   *  fornecedor erra: `stelafariasrs` veio sem cargo e com UF TO, sendo a
   *  mesma deputada do RS. */
  cargo: string;
  /** A PESSOA DE QUEM ESTE PERFIL É — id de interlocutor, ou vazio.
   *
   *  É o que faz os TRÊS perfis da mesma deputada (`Stela Farias` com 121
   *  menções, `Stela Farias RS` com 3 e `stelafariasrs` com 27) virarem uma
   *  pessoa. Nenhuma normalização funde esses nomes: são diferentes de
   *  verdade, e só alguém que conhece o ator sabe que são a mesma. */
  pessoa: string;
}

export const INSTITUICAO_VAZIA: RascunhoDaInstituicao = {
  nome: '',
  nome_completo: '',
  tipo: '',
  uf: '',
  esfera: '',
  //: SEM PADRÃO, e é por isso que é string vazia e não 3.
  //:
  //: Um padrão aqui viraria o valor da maioria: quem cadastra com pressa
  //: aceita o que já está na tela, e a base inteira acaba num tier só — o
  //: campo passa a existir sem significar nada. Vazio obriga a escolher,
  //: enquanto quem cadastra ainda sabe por que aquela instituição importa.
  tier: '',
  //: MESMO RACIOCÍNIO DO TIER: sem padrão, para obrigar a escolha. Ao
  //: contrário do tier, aqui o backend aceita nulo mesmo em instituição nova
  //: — as ~99 que já existiam ficam sem categoria até o backfill, e o mesmo
  //: formulário serve para corrigi-las.
  categoria_publico_id: '',
  //: SÓ FAZ SENTIDO junto de uma categoria com `padrao_de_quebra !==
  //: 'sem_quebra'` — o campo de subcategoria só aparece nesse caso.
  subcategoria_publico_id: '',
  //: SÓ DE PERFIL DE REDE, e o backend recusa nos outros tipos.
  cargo: '',
  pessoa: '',
};

/** A ficha como a tela a mostra: é o rascunho de partida da edição, e também
 *  o de quem só quer inverter `ativo` sem abrir a edição. */
export function rascunhoDaInstituicao(
  instituicao: Instituicao,
): RascunhoDaInstituicao {
  return {
    nome: instituicao.nome,
    nome_completo: instituicao.nome_completo ?? '',
    tipo: instituicao.tipo,
    uf: instituicao.uf ?? '',
    esfera: instituicao.esfera_id ? String(instituicao.esfera_id) : '',
    tier: instituicao.tier ? String(instituicao.tier) : '',
    categoria_publico_id: instituicao.categoria_publico_id
      ? String(instituicao.categoria_publico_id)
      : '',
    subcategoria_publico_id: instituicao.subcategoria_publico_id
      ? String(instituicao.subcategoria_publico_id)
      : '',
    cargo: instituicao.cargo ?? '',
    pessoa: instituicao.interlocutor_id ?? '',
  };
}

/** O corpo do PUT, a partir do rascunho. ESCRITO UMA VEZ: Salvar,
 *  Desativar/Reativar e o modal da fila de revisão passam por aqui, e é por
 *  isso que `ativo` — que o PUT substitui junto com o resto da ficha — não pode
 *  ser esquecido em nenhum.
 *
 *  VAZIO VIRA `null`, e não 0: as instituições anteriores às colunas de tier
 *  e de categoria não têm valor, e corrigir o nome de uma delas não pode
 *  obrigar a classificá-la primeiro. */
export function entradaDaInstituicao(
  rascunho: RascunhoDaInstituicao,
  ativo: boolean,
): InstituicaoEntrada {
  return {
    nome: rascunho.nome,
    nome_completo: rascunho.nome_completo || null,
    tipo: rascunho.tipo,
    uf: rascunho.uf || null,
    esfera_id: rascunho.esfera ? Number(rascunho.esfera) : null,
    tier: rascunho.tier ? Number(rascunho.tier) : null,
    categoria_publico_id: rascunho.categoria_publico_id
      ? Number(rascunho.categoria_publico_id)
      : null,
    subcategoria_publico_id: rascunho.subcategoria_publico_id
      ? Number(rascunho.subcategoria_publico_id)
      : null,
    //: SEM ESTES DOIS, O PUT OS APAGAVA. A edição manda a ficha INTEIRA, e o
    //: backend substitui o que recebe: `cargo` e `interlocutor_id` omitidos
    //: viravam nulo, então corrigir o nome de um perfil perdia o cargo e a
    //: pessoa sem ninguém notar. É a mesma razão pela qual `ativo` está aqui.
    cargo: rascunho.cargo || null,
    interlocutor_id: rascunho.pessoa || null,
    ativo,
  };
}

//: O RASCUNHO DE UM CONTATO, nos lugares que o editam (o formulário do topo, o
//: "Acrescentar pessoa" por instituição, a edição inline e o modal da fila de
//: revisão) — um tipo só, para uma rede nova não exigir achar os quatro lugares
//: à mão de novo.
export interface RascunhoDoInterlocutor {
  nome: string;
  email: string;
  cargo: string;
  area: string;
  //: LISTA LIVRE, e não uma caixa por rede: a pessoa acrescenta quantos
  //: links quiser, de qualquer rede, um de cada vez.
  redes_sociais: string[];
}

export const INTERLOCUTOR_VAZIO: RascunhoDoInterlocutor = {
  nome: '',
  email: '',
  cargo: '',
  area: '',
  redes_sociais: [],
};

export function rascunhoDoInterlocutor(
  pessoa: Interlocutor,
): RascunhoDoInterlocutor {
  return {
    nome: pessoa.nome,
    email: pessoa.email ?? '',
    cargo: pessoa.cargo ?? '',
    area: pessoa.area ?? '',
    //: CÓPIA, e não a referência do cadastro.
    //:
    //: ACHADO DE REVISÃO, e é sobre o que vem: a tela de hoje atualiza arrays de
    //: forma imutável, então não há defeito agora. Mas este módulo nasceu para
    //: ser reusado pelo MODAL da fila, e um formulário que faça
    //: `rascunho.redes_sociais.push(...)` mexeria no objeto do catálogo — a
    //: lista apareceria mudada em toda tela antes de alguém salvar, e voltaria
    //: ao normal no próximo F5. Defeito desses custa meio dia para ser
    //: acreditado.
    redes_sociais: [...pessoa.redes_sociais],
  };
}

/** O corpo do PUT de um contato.
 *
 *  ESTAVA ESCRITO À MÃO EM DOIS LUGARES de `CadastroDeInstituicoes` — "Salvar"
 *  e "Desligar" —, com os oito campos em cada. O PUT de interlocutor substitui a
 *  ficha inteira, como o de instituição, então um campo esquecido num dos dois
 *  apaga o valor: é a mesma armadilha que `cargo` e `interlocutor_id` já caíram.
 *
 *  OS TRÊS QUE NÃO SE EDITAM NO FORMULÁRIO vêm por fora, de propósito:
 *  `instituicao_id` é de quem a pessoa fala (muda pela tela da instituição, não
 *  por este campo), `tipo` é derivado, e `ativo` é um botão próprio. Pedi-los
 *  explicitamente é o que impede que alguém os esqueça e os veja virar nulo. */
export function entradaDoInterlocutor(
  rascunho: RascunhoDoInterlocutor,
  de: { instituicao_id: string | null; tipo: string | null; ativo: boolean },
): InterlocutorEntrada {
  return {
    nome: rascunho.nome,
    instituicao_id: de.instituicao_id,
    email: rascunho.email || null,
    cargo: rascunho.cargo || null,
    area: rascunho.area || null,
    //: CÓPIA TAMBÉM NA SAÍDA, pela mesma razão: o corpo do PUT não deve
    //: compartilhar array com o rascunho que a tela continua editando.
    redes_sociais: [...rascunho.redes_sociais],
    tipo: de.tipo,
    ativo: de.ativo,
  };
}
