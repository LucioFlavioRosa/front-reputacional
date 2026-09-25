/** O formulário vira corpo de requisição, e o registro vira formulário.
 *
 *  AS DUAS METADES DE UM CAMINHO SÓ, e por isso no mesmo arquivo: `montarCorpo`
 *  é a ida, `paraFormulario` é a volta, e elas precisam ser fiéis uma à outra.
 *  Um campo que a tela mostra e o corpo não envia se perde em silêncio — o
 *  comentário sobre `referencia_id`, abaixo, registra que isso já aconteceu
 *  TRÊS VEZES, e conclui que "a lição não pega sozinha".
 *
 *  Não pega mesmo. O que pega é `corpo.test.ts`, que percorre os campos um a um
 *  e confere que o que entra volta — e que só se tornou possível quando estas
 *  duas funções saíram de dentro de `Cadastro.tsx`, onde não eram exportadas e
 *  nenhum teste as alcançava.
 *
 *  A REGRA QUE GOVERNA A IDA: vazio vira `null` na EDIÇÃO e `undefined` na
 *  criação, e a diferença decide se dá para APAGAR um campo. Campo ausente o
 *  backend lê como "preserve"; `null` ele lê como "apague". Uma tela que não
 *  edita um campo não deve ter opinião sobre ele — foi assim que a `pauta` e,
 *  depois, a `esfera_id` quase foram destruídas ao salvar.
 */

import type { Interacao } from '@/dominio/tipos';
import { novoUid } from '@/paginas/cadastro/formulario';
import type { Formulario } from '@/paginas/cadastro/formulario';

/** Converte o formulário no corpo que a API espera: campo vazio vira ausência,
 *  não string vazia — o backend distingue "não informado" de "limpo". */
export function montarCorpo(form: Formulario, paraEdicao = false, ehConsulta = false) {
  // VAZIO VIRA `null` NA EDIÇÃO, e `undefined` na criação. A diferença decide
  // se dá para APAGAR um campo.
  //
  // O `PATCH` do backend usa `exclude_unset`: campo ausente significa
  // "preserve", e só `null` limpa. Como `JSON.stringify` remove as chaves
  // `undefined`, apagar a expectativa na tela devolvia 200 e não apagava nada
  // — o texto voltava no próximo carregamento, e a pessoa concluía que o
  // sistema tinha ignorado o gesto.
  //
  // Na CRIAÇÃO `undefined` continua certo: não há o que preservar, e omitir
  // deixa o corpo menor.
  const vazio = paraEdicao ? null : undefined;
  const opcional = (valor: string) => (valor.trim() ? valor.trim() : vazio);
  const ehDeclinada = form.status === 'declinado';
  //: O bloco de consulta é escolhido pelo TIPO de interação, e o tipo é
  //: `formato_interacao_id`. O código vem por parâmetro porque `montarCorpo`
  //: é função pura — quem sabe o id do dicionário é a tela.
  const numeroOpcional = (valor: string) => (valor ? Number(valor) : vazio);

  const extensao: Record<string, unknown> = {};
  for (const [campo, valor] of Object.entries(form.extensao)) {
    if (!valor) continue;
    if (campo === 'mensagens_chave') {
      extensao[campo] = valor
        .split(';')
        .map((parte) => parte.trim())
        .filter(Boolean);
    } else if (campo === 'prazo_dias') {
      extensao[campo] = Number(valor);
    } else {
      extensao[campo] = valor;
    }
  }

  // `frente` NÃO VIAJA MAIS. O backend deriva sozinho, tanto na criação
  // quanto na edição, da instituição e do formato — ver `derivar_frente` e
  // o espelho `frenteDerivada` em `dominio/frentes.ts`. Mandar a frente
  // calculada aqui de novo seria uma segunda fonte de verdade para o mesmo
  // fato, e as duas podendo divergir é exatamente o problema que a derivação
  // única no servidor existe para fechar.
  return {
    data_interacao: form.data_interacao,
    instituicao_id: form.instituicao_id,
    uf: form.uf,
    modalidade: opcional(form.modalidade),
    local: opcional(form.local),
    status: form.status,
    // A PAUTA NAO VIAJA MAIS, e a ausencia e o ponto.
    //
    // O campo saiu da tela, e eu tinha escrito `pauta: vazio` seguindo a regra
    // dos demais campos — que na EDICAO vale `null`, e `null` no PATCH quer
    // dizer APAGUE. Salvar qualquer campo de uma das 60 agendas vindas da
    // planilha teria destruido a pauta dela, que e a unica descricao em
    // palavras que esses registros tem.
    //
    // Campo AUSENTE o backend le como "preserve" (`exclude_unset`). Uma tela
    // que nao edita um campo nao deve ter opiniao sobre ele.
    // `interlocutor_id` NÃO É ENVIADO: o backend o deriva de quem está marcado
    // como principal na lista. Mandar os dois abriria a porta para eles
    // discordarem, e é isso que o servidor recusa com 422.
    unidade_negocio_id: numeroOpcional(form.unidade_negocio_id),
    // `esfera_id` NAO VIAJA MAIS, e e o MESMO defeito da `pauta` descrito quatro
    // linhas acima — uma linha adiante no mesmo objeto.
    //
    // O campo saiu da tela e continuou aqui como `numeroOpcional(form.esfera_id)`,
    // que numa EDICAO vale `null`, e `null` no PATCH quer dizer APAGUE. Com o
    // servidor agora derivando a esfera da instituicao ao criar, toda edicao de
    // agenda mandaria `null` e limparia o valor que a criacao acabara de
    // derivar: o campo voltaria a ficar vazio, agora por outro caminho.
    //
    // Quem decide a esfera e `casos_de_uso/derivar_esfera.py`, a partir de
    // `Instituicao.esfera_id`. Uma tela que nao edita um campo nao deve ter
    // opiniao sobre ele.
    formato_interacao_id: numeroOpcional(form.formato_interacao_id),
    tier: numeroOpcional(form.tier),
    clima: opcional(form.clima),
    resultado: opcional(form.resultado),
    iniciativa: opcional(form.iniciativa),
    relato: opcional(form.relato),
    encaminhamentos: opcional(form.encaminhamentos),
    pendencias: opcional(form.pendencias),
    observacoes: opcional(form.observacoes),
    // `posicionamento` E `registro_url` NAO VIAJAM MAIS.
    //
    // Sairam da tela, e a tela nao deve ter opiniao sobre campo que nao edita.
    // Hoje eles nao se perderiam — o formulario reenviava o valor carregado —
    // mas e a mesma forma do defeito da pauta, que so nao custou caro porque
    // foi pego a tempo: bastava alguem limpar o estado para o valor virar
    // `null` no PATCH.
    //
    // Ausente, o backend preserva. Os dois continuam no banco e na ficha.
    temas: form.temas,
    areas: form.areas,
    // LINHA INCOMPLETA NAO VIAJA — mas quem AVISA e
    // `impedimentoNoFormulario`, e nao este filtro.
    //
    // Sozinho, ele descartava a linha em silencio: a tela dizia "Alteracoes
    // salvas" e a linha recem-acrescentada sumia do registro. O filtro fica
    // como ultima barreira, para uma linha vazia nunca virar
    // `pessoa_aegea_id: ''` num 422 do servidor.
    participacoes: form.aegea
      .filter((p) => p.pessoa_aegea_id)
      .map((p) => ({
        pessoa_aegea_id: p.pessoa_aegea_id,
        papel: p.papel,
        //: '' e NAO INFORMADO, e vira `null` — nunca 'previsto'. A diferenca
        //: entre nao saber e saber e o que esta plataforma existe para reduzir.
        presenca: p.presenca || null,
      })),
    // EXTENSÃO VAZIA NÃO É EXTENSÃO AUSENTE, e a diferença apaga linha.
    //
    // `extensao` acima é remontada só com os valores preenchidos, então um
    // registro cuja extensão existe mas está toda vazia produzia `{}` — e na
    // edição `{}` virava `null`, que o backend lê como "apague a linha".
    // Salvar sem mudar NADA removia a extensão de 19 registros institucionais
    // e 9 de investidores, que estão nesse estado hoje.
    //
    // O que distingue os dois casos é o FORMULÁRIO, não o resultado: se
    // `form.extensao` tem chaves, o registro tem extensão — ainda que vazia —
    // e mandar `{}` a preserva. `null` fica só para quem nunca teve nenhuma.
    extensao: Object.keys(extensao).length
      ? extensao
      : Object.keys(form.extensao).length
        ? {}
        : vazio,

    // O BLOCO DA CONSULTA SÓ VIAJA NO TIPO CERTO — e viaja como `null`
    // quando o tipo deixou de ser esse, para o servidor largar o bloco. Sem
    // o `null` explícito, um prazo de resposta sobraria numa reunião.
    consulta: ehConsulta
      ? {
          canal_id: numeroOpcional(form.canal_id),
          remetente: opcional(form.remetente),
          teor: opcional(form.teor),
          motivo: opcional(form.motivo),
          prazo_resposta: opcional(form.prazo_resposta),
          respondida_em: opcional(form.respondida_em),
        }
      : null,
    // A LISTA INTEIRA, sempre, como `origens`: o formulário sabe quais são, e
    // omitir faria desmarcar todas nunca surtir efeito.
    alegacoes: ehConsulta ? form.alegacoes : [],

    // -- o ciclo -------------------------------------------------------------
    expectativa: opcional(form.expectativa),
    clima_esperado: opcional(form.clima_esperado),
    // SÓ COM STATUS `declinado`. A seção some da tela quando o status muda,
    // mas o que foi digitado continua no estado — e ia junto no corpo. Uma
    // agenda REALIZADA saía gravada com "declinada pela outra parte", dado que
    // ninguém vê na tela e que nenhuma leitura espera encontrar.
    //
    // Não limpo o estado ao trocar o status de propósito: quem marcou
    // `declinado` por engano e volta atrás perderia o motivo escrito. O texto
    // fica na tela e só não é enviado.
    // Fora do status `declinado` os dois vão a `null` na edição: se a pessoa
    // corrigiu o status de "declinado" para "realizado", a recusa que ficou
    // gravada antes precisa SAIR do registro.
    declinado_por: ehDeclinada ? opcional(form.declinado_por) : vazio,
    motivo_declinio: ehDeclinada ? opcional(form.motivo_declinio) : vazio,
    // A MESMA REGRA PARA A NOTA DO ACEITE: fora de "Aceito" ela vai a `null`.
    // Quem corrigiu a situação de "aceito" para "negado" não quer que a
    // condição do aceite continue gravada — ela deixou de ser verdade.
    nota_situacao:
      form.status === 'confirmada' ? opcional(form.nota_situacao) : vazio,
    // A LISTA INTEIRA, sempre — inclusive vazia. Aqui `[]` significa
    // "nenhuma origem", e não "não mexi": o formulário SEMPRE sabe quais são,
    // porque as carrega ao abrir. Omitir deixaria o backend preservar o que
    // estava, e desmarcar todas nunca surtiria efeito.
    origens: form.origens,
    // '' vira `undefined` e NAO `false`: nao informado nao e uma resposta.
    preve_desdobramento:
      form.preve_desdobramento === '' ? vazio : form.preve_desdobramento === 'sim',

    // O PRINCIPAL VAI NA LISTA, e a coluna `interlocutor_id` e projecao dela.
    // O backend aceita receber so a coluna, mas a tela edita a lista.
    outra_parte: form.outraParte
      .filter((p) => p.interlocutor_id)
      .map((p) => ({
        interlocutor_id: p.interlocutor_id,
        presenca: p.presenca || undefined,
        principal: p.principal,
      })),

    // Sem `filter`: o que impede material pela metade agora é
    // `impedimentoNoFormulario`, ANTES do envio. Filtrar aqui fazia a linha
    // sumir depois de um salvamento bem-sucedido — a pessoa preenchia, via
    // "registro salvo", e o material não estava lá.
    materiais: form.materiais
      // O ARQUIVO CONTA COMO CONTEÚDO DA LINHA. Sem ele nesta condição, um
      // material que só tem arquivo — título ainda em branco, link vazio —
      // seria descartado aqui em silêncio, e o byte já subido ficaria órfão no
      // blob sem nada que o alcançasse.
      .filter((m) => m.titulo.trim() || m.url.trim() || m.arquivo_id)
      .map((m) => ({
        // `id` so quando existe: material novo nao tem, e mandar `undefined`
        // e o que faz o backend criar em vez de procurar.
        ...(m.id ? { id: m.id } : {}),
        arquivo_id: m.arquivo_id,
        // DE ONDE A LINHA VEIO. Sem isto, a agenda salva o título e o link e
        // perde o vínculo com a biblioteca: ao reabrir, a tela não sabe mais
        // quais linhas ela mesma trouxe, e desmarcar o assunto não tem o que
        // devolver. É a terceira vez que um campo declarado na tela e não
        // enviado no corpo se perde em silêncio — a lição não pega sozinha.
        referencia_id: m.referencia_id,
        temas: m.temas,
        momento: m.momento,
        titulo: m.titulo.trim(),
        url: m.url.trim(),
        observacao: opcional(m.observacao),
      })),
  };
}

export function paraFormulario(interacao: Interacao): Formulario {
  const texto = (valor: unknown) => (valor == null ? '' : String(valor));

  const extensao: Record<string, string> = {};
  for (const [campo, valor] of Object.entries(interacao.extensao ?? {})) {
    // `mensagens_chave` viaja como lista e é editada como texto com ponto e
    // vírgula — a mesma convenção que `montarCorpo` desfaz na ida.
    extensao[campo] = Array.isArray(valor) ? valor.join('; ') : texto(valor);
  }

  return {
    data_interacao: interacao.data_interacao,
    instituicao_id: texto(interacao.instituicao_id),
    interlocutor_id: texto(interacao.interlocutor_id),
    unidade_negocio_id: texto(interacao.unidade_negocio_id),
    esfera_id: texto(interacao.esfera_id),
    formato_interacao_id: texto(interacao.formato_interacao_id),
    uf: texto(interacao.uf),
    modalidade: texto(interacao.modalidade),
    local: texto(interacao.local),
    tier: texto(interacao.tier),
    status: texto(interacao.status),
    clima: texto(interacao.clima),
    resultado: texto(interacao.resultado),
    iniciativa: texto(interacao.iniciativa),
    relato: texto(interacao.relato),
    encaminhamentos: texto(interacao.encaminhamentos),
    pendencias: texto(interacao.pendencias),
    observacoes: texto(interacao.observacoes),
    temas: interacao.temas ?? [],
    areas: interacao.areas ?? [],
    canal_id: texto(interacao.consulta?.canal_id),
    remetente: texto(interacao.consulta?.remetente),
    teor: texto(interacao.consulta?.teor),
    motivo: texto(interacao.consulta?.motivo),
    prazo_resposta: texto(interacao.consulta?.prazo_resposta),
    respondida_em: texto(interacao.consulta?.respondida_em),
    alegacoes: interacao.alegacoes ?? [],
    // SEM FILTRAR POR PAPEL. Trazer de volta so os `porta_voz` apagaria, sem
    // aviso, quem estivesse gravado como `equipe`: `montarCorpo` remanda a
    // lista inteira, e o que nao voltou do servidor nao vai de volta para ele.
    aegea: (interacao.participacoes ?? []).map((p) => ({
      pessoa_aegea_id: p.pessoa_aegea_id,
      papel: p.papel,
      presenca: p.presenca ?? '',
    })),
    extensao,

    expectativa: texto(interacao.expectativa),
    clima_esperado: texto(interacao.clima_esperado),
    declinado_por: texto(interacao.declinado_por),
    motivo_declinio: texto(interacao.motivo_declinio),
    nota_situacao: texto(interacao.nota_situacao),
    origens: interacao.origens ?? [],
    // Três estados na volta também: `null` do servidor é NÃO INFORMADO, e vira
    // `''` — não `'nao'`. Traduzir nulo para "não" aqui faria toda agenda
    // antiga passar a afirmar uma decisão que ninguém tomou, no primeiro
    // salvamento de qualquer campo.
    preve_desdobramento:
      interacao.preve_desdobramento == null
        ? ''
        : interacao.preve_desdobramento
          ? 'sim'
          : 'nao',
    outraParte: (interacao.outra_parte ?? []).map((p) => ({
      interlocutor_id: p.interlocutor_id,
      presenca: texto(p.presenca),
      principal: Boolean(p.principal),
    })),
    materiais: (interacao.materiais ?? []).map((m) => ({
      // NOME NOVO A CADA ABERTURA, e tudo bem: o `uid` identifica a linha
      // DENTRO desta sessão de edição, que é onde o upload precisa achá-la.
      // Quem preserva a identidade entre salvamentos é o `id`, logo abaixo.
      uid: novoUid(),
      // `null` do servidor vira `undefined`: no formulário, "sem id" significa
      // material NOVO, e é a ausência da chave que faz o backend criar em vez
      // de procurar. Guardar `null` mandaria `"id": null` no corpo.
      id: m.id ?? undefined,
      arquivo_id: m.arquivo?.id ?? null,
      arquivo: m.arquivo ?? null,
      // DE VOLTA DO SERVIDOR. Sem isto, reabrir a agenda perderia quais linhas
      // vieram da biblioteca, e desmarcar um assunto não saberia o que devolver.
      referencia_id: m.referencia_id ?? null,
      temas: m.temas ?? [],
      momento: m.momento,
      titulo: m.titulo,
      url: texto(m.url),
      observacao: texto(m.observacao),
    })),
  };
}

