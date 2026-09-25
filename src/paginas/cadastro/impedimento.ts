/** O que impede uma agenda de ser enviada, e por quê — em português.
 *
 *  SEIS REGRAS QUE PROTEGEM O TRABALHO DE QUEM PREENCHE, e que viviam dentro de
 *  `Cadastro.tsx` sem serem exportadas: não havia como escrever um teste para
 *  nenhuma delas. A mais sutil é a que distingue o participante que JÁ VINHA do
 *  servidor daquele acrescentado agora — legado é fato consumado, e trancar a
 *  edição por causa dele seria punir quem não errou nada.
 *
 *  ELAS EXISTEM PARA O QUE O SERVIDOR NÃO TEM COMO RECUSAR DE FORMA ÚTIL.
 *  Material sem destino seria descartado em silêncio antes de sair da tela, e a
 *  pessoa veria "registro salvo" com um material a menos.
 */

import { MOMENTOS_DE_PREPARACAO, MOMENTOS_POS_REUNIAO, materiaisDe } from '@/paginas/cadastro/formulario';
import type { Etapa, Formulario } from '@/paginas/cadastro/formulario';

export function ondeEstaOMaterial(
  form: Formulario,
  indice: number,
): { posicao: number; etapa: Etapa } {
  const material = form.materiais[indice];
  const depois = MOMENTOS_POS_REUNIAO.some((m) => m.valor === material?.momento);
  const daAba = depois
    ? materiaisDe(form.materiais, MOMENTOS_POS_REUNIAO)
    : materiaisDe(form.materiais, MOMENTOS_DE_PREPARACAO);
  return {
    posicao: daAba.findIndex((m) => m === material) + 1,
    etapa: depois ? 'depois' : 'antes',
  };
}

/** O que impede este formulário de ser enviado, em português.
 *
 *  Existe para o que o SERVIDOR não tem como recusar de forma útil: material
 *  sem link seria descartado em silêncio antes de sair da tela, e a pessoa
 *  veria "registro salvo" com um material a menos.
 *
 *  Devolve `null` quando está tudo certo.
 */
export function impedimentoNoFormulario(
  form: Formulario,
  //: Quem a agenda JA TINHA quando abriu. E o que separa o legado do erro
  //: novo: uma pessoa que veio do servidor em instituicao diferente e um fato
  //: consumado — bloquear a edicao dessa agenda por causa dela seria trancar
  //: o registro sem que ninguem tenha feito nada errado agora.
  carregado: Formulario | null,
  //: Quem pode representar a instituicao ESCOLHIDA agora.
  podemRepresentar: ReadonlySet<string>,
): { mensagem: string; etapa: Etapa } | null {
  // UM MATERIAL PRECISA DE TÍTULO E DE UM DESTINO — arquivo OU link.
  //
  // DESTINO É ARQUIVO **OU** LINK, e não link sempre. Exigir o link bloquearia
  // todo material que veio por upload — título preenchido, link vazio — e a
  // mensagem acusaria "pela metade" um material que está inteiro.
  const semDestino = form.materiais.findIndex(
    (m) => Boolean(m.titulo.trim()) && !m.url.trim() && !m.arquivo_id,
  );
  if (semDestino >= 0) {
    const onde = ondeEstaOMaterial(form, semDestino);
    return {
      mensagem:
        `O material ${onde.posicao} não leva a lugar nenhum: ` +
        'suba um arquivo ou informe um link.',
      etapa: onde.etapa,
    };
  }

  const semTitulo = form.materiais.findIndex(
    (m) => !m.titulo.trim() && (Boolean(m.url.trim()) || Boolean(m.arquivo_id)),
  );
  if (semTitulo >= 0) {
    const onde = ondeEstaOMaterial(form, semTitulo);
    return {
      mensagem: `Dê um título ao material ${onde.posicao}, ou remova a linha.`,
      etapa: onde.etapa,
    };
  }

  const semPessoa = form.outraParte.findIndex((p) => !p.interlocutor_id);
  if (semPessoa >= 0) {
    return {
      mensagem: `Escolha a pessoa da linha ${semPessoa + 1} em "Pela outra parte", ou remova a linha.`,
      etapa: 'antes',
    };
  }

  // TROCAR A INSTITUICAO NAO PODE DEIXAR GENTE DA ANTERIOR PARA TRAS.
  //
  // A lista de participantes so oferece quem pertence a instituicao escolhida,
  // mas quem JA ESTAVA na lista continua nela — e essa excecao existe para o
  // legado. Sem esta guarda, ela virava porta para criar divergencia NOVA:
  // escolher um orgao, acrescentar alguem dele, trocar o orgao e salvar.
  //
  // Quem veio do servidor e poupado; quem foi acrescentado agora, nao. A
  // diferenca esta em `carregado`, e nao no agregado pronto — no registro
  // salvo as duas situacoes sao identicas.
  const jaVinha = new Set(
    (carregado?.outraParte ?? []).map((p) => p.interlocutor_id),
  );
  const forasteiro = form.outraParte.findIndex(
    (p) =>
      p.interlocutor_id &&
      !podemRepresentar.has(p.interlocutor_id) &&
      !jaVinha.has(p.interlocutor_id),
  );
  if (forasteiro >= 0) {
    return {
      mensagem:
        `A pessoa da linha ${forasteiro + 1} em "Pela outra parte" não pertence ` +
        'à instituição escolhida. Remova a linha, ou volte a instituição anterior.',
      etapa: 'antes',
    };
  }

  // A MESMA GUARDA DO OUTRO LADO DA MESA.
  //
  // Ela existia só para a outra parte. Do lado da Aegea, `montarCorpo` filtra
  // a linha sem pessoa escolhida — e filtrar em silêncio é pior que recusar:
  // a tela diria "Alterações salvas" e a linha que a pessoa acabou de
  // acrescentar teria sumido do registro, sem erro e sem pista.
  const semPessoaAegea = form.aegea.findIndex((p) => !p.pessoa_aegea_id);
  if (semPessoaAegea >= 0) {
    return {
      mensagem: `Escolha a pessoa da linha ${semPessoaAegea + 1} em "Pela Aegea", ou remova a linha.`,
      etapa: 'antes',
    };
  }

  // O DOMÍNIO RECUSA A MESMA PESSOA NO MESMO PAPEL, e sem isto a tela deixava
  // montar o estado e só descobria no 422 do servidor — mensagem de servidor
  // para um erro que a tela via se formar.
  //
  // A pessoa DUAS VEZES EM PAPÉIS DIFERENTES continua permitida, e é o
  // backend que decide isso: `(pessoa, papel)` é a chave. Barrar aqui o que lá
  // é válido seria a tela inventando uma regra própria.
  const vistos = new Set<string>();
  for (const [indice, p] of form.aegea.entries()) {
    const chave = `${p.pessoa_aegea_id}|${p.papel}`;
    if (vistos.has(chave)) {
      return {
        mensagem:
          `A pessoa da linha ${indice + 1} em "Pela Aegea" já está na lista com ` +
          'o mesmo papel. Mude o papel de uma delas, ou remova a linha.',
        etapa: 'antes',
      };
    }
    vistos.add(chave);
  }

  return null;
}
