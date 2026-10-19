/** O CRM dos Stakeholders: agendas, cadastro, biblioteca, sinais.
 *
 *  Saiu de `cliente.ts` em 17/10/2026, quando ele tinha 90 funÃ§Ãµes e 2.481
 *  linhas e trÃªs entregas sem relaÃ§Ã£o entre si disputavam o mesmo arquivo.
 *  `cliente.ts` continua existindo como barril de reexportaÃ§Ã£o: nenhum dos
 *  66 arquivos que o importam precisou mudar.
 */

import type { Alegacao, ArquivoDoMaterial } from '@/dominio/tipos';
import type { Recorte } from '@/dominio/recorte';
import { paraParametros } from '@/dominio/recorte';
import type { Dicionarios, DocumentoDaReuniao, Exportacao, Instituicao, Interacao, Interlocutor, PaginaDeInteracoes, PessoaAegea, Referencia, ReferenciaEdicao, VersaoDaReferencia } from '@/dominio/tipos';
import { BASE, requisitar } from './nucleo';

export interface OpcoesDeListagem {
  pagina?: number;
  tamanho?: number;
  ordenacao?: string;
}

export function listarInteracoes(
  recorte: Recorte,
  opcoes: OpcoesDeListagem = {},
): Promise<PaginaDeInteracoes> {
  const parametros = paraParametros(recorte);
  if (opcoes.pagina) parametros.set('pagina', String(opcoes.pagina));
  if (opcoes.tamanho) parametros.set('tamanho', String(opcoes.tamanho));
  if (opcoes.ordenacao) parametros.set('ordenacao', opcoes.ordenacao);
  return requisitar<PaginaDeInteracoes>(`/api/interacoes?${parametros}`);
}

/** Tamanho máximo aceito por página no backend. */
const TAMANHO_MAXIMO = 200;

/** Limite de segurança: acima disso, derivar no navegador deixa de fazer
 *  sentido e as agregações precisam ir para o backend. */
export const TETO_DE_DERIVACAO = 5000;

/** Quantas páginas restantes pedir de cada vez, e não todas de uma vez.
 *
 *  CADA PÁGINA CUSTA MAIS DE UMA CONSULTA NO BACKEND — a principal, mais uma
 *  por relacionamento carregado à parte (temas, áreas, participações…). Um
 *  recorte de 25 páginas em paralelo somava dezenas de consultas simultâneas
 *  no banco, de uma vez só, a cada troca de filtro. Em lotes pequenos, nunca
 *  há mais que `TAMANHO_DO_LOTE` páginas deste recorte em voo ao mesmo tempo. */
export const TAMANHO_DO_LOTE = 5;

export interface RecorteCompleto {
  itens: Interacao[];
  total: number;
  truncado: boolean;
  filtrosAtivos: number;
}

/** Busca o recorte inteiro: a primeira página diz quantas há, e as outras
 *  vêm em LOTES de `TAMANHO_DO_LOTE`, um lote de cada vez.
 *
 *  As telas de análise derivam os agregados do conjunto completo, então
 *  precisam dele inteiro — não da primeira página. Um lote por vez, e não
 *  todas de uma vez, é o meio-termo entre "uma página atrás da outra" (soma
 *  as latências) e "todas em paralelo" (multiplica a carga no backend pelo
 *  número de páginas). O RESULTADO FINAL não muda — mesmos itens, mesma
 *  ordem —, só o RITMO das requisições. */
export async function listarRecorteCompleto(recorte: Recorte): Promise<RecorteCompleto> {
  const primeira = await listarInteracoes(recorte, { pagina: 1, tamanho: TAMANHO_MAXIMO });

  const paginasNecessarias = Math.min(
    primeira.paginas,
    Math.ceil(TETO_DE_DERIVACAO / TAMANHO_MAXIMO),
  );

  const restantes: PaginaDeInteracoes[] = [];
  for (let inicio = 2; inicio <= paginasNecessarias; inicio += TAMANHO_DO_LOTE) {
    const fim = Math.min(inicio + TAMANHO_DO_LOTE - 1, paginasNecessarias);
    const lote = await Promise.all(
      Array.from({ length: fim - inicio + 1 }, (_, i) =>
        listarInteracoes(recorte, { pagina: inicio + i, tamanho: TAMANHO_MAXIMO }),
      ),
    );
    restantes.push(...lote);
  }

  const itens = [primeira, ...restantes].flatMap((pagina) => pagina.itens);

  return {
    itens,
    total: primeira.total,
    truncado: itens.length < primeira.total,
    filtrosAtivos: primeira.filtros_ativos,
  };
}

/**
 * Registra que a Base foi exportada.
 *
 * O recorte vai na QUERY STRING, e não no corpo: é a mesma dependência que a
 * listagem usa, e mandar os filtros no corpo abriria a porta para o registro
 * dizer um recorte e o servidor contar outro.
 *
 * O CSV leva TUDO que o recorte alcança — é o caminho mais curto para tirar
 * dados daqui, e ficava sem evento nenhum: um botão, um arquivo, e nada no log.
 *
 * Trilha, não barreira: um cliente modificado baixa a listagem e monta o
 * arquivo sem chamar isto. Serve para responsabilização entre pessoas da casa
 * e como insumo de alerta.
 */
export function registrarExportacao(recorte: Recorte): Promise<Exportacao> {
  const parametros = paraParametros(recorte).toString();
  return requisitar<Exportacao>(`/api/exportacoes?${parametros}`, { method: 'POST' });
}

export function obterInteracao(id: string): Promise<Interacao> {
  return requisitar<Interacao>(`/api/interacoes/${id}`);
}

export function criarInteracao(dados: unknown): Promise<Interacao> {
  return requisitar<Interacao>('/api/interacoes', {
    method: 'POST',
    body: JSON.stringify(dados),
  });
}

export function editarInteracao(id: string, alteracoes: unknown): Promise<Interacao> {
  return requisitar<Interacao>(`/api/interacoes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(alteracoes),
  });
}

/** Sobe o arquivo de um material e devolve o `arquivo_id` a citar no salvamento.
 *
 *  ANTES DO MATERIAL EXISTIR, de propósito: quem preenche acrescenta a linha,
 *  escolhe o arquivo e só depois salva a agenda. Nesse instante o material
 *  ainda não tem `id` no servidor.
 *
 *  Mas a AGENDA precisa existir — o arquivo mora na pasta dela. Numa agenda
 *  nova, a tela pede para salvar primeiro.
 */
export function subirArquivoDeMaterial(
  interacaoId: string,
  momento: string,
  arquivo: File,
): Promise<ArquivoDoMaterial> {
  const corpo = new FormData();
  corpo.append('momento', momento);
  corpo.append('arquivo', arquivo);
  return requisitar<ArquivoDoMaterial>(
    `/api/interacoes/${interacaoId}/materiais/arquivo`,
    { method: 'POST', body: corpo },
  );
}

/** O endereço de download. Passa pela API, e não direto pelo blob.
 *
 *  Um link direto continuaria valendo depois de a pessoa perder o acesso —
 *  e material de agenda com governo e investidores é o conteúdo mais
 *  sensível deste painel.
 */
export function urlDoArquivo(interacaoId: string, arquivoId: string): string {
  return `${BASE}/api/interacoes/${interacaoId}/materiais/arquivo/${arquivoId}`;
}

export function arquivarInteracao(id: string): Promise<void> {
  return requisitar<void>(`/api/interacoes/${id}`, { method: 'DELETE' });
}

/* -- dicionários ---------------------------------------------------------- */

export function obterDicionarios(): Promise<Dicionarios> {
  return requisitar<Dicionarios>('/api/dicionarios');
}

/* -- stakeholders --------------------------------------------------------- */

/** COM AS DESATIVADAS. Sem elas o catálogo não resolveria o nome de uma
 *  instituição que já esteve numa agenda, e a Administração não teria como
 *  reativá-la — o mesmo motivo pelo qual temas e referências vêm inteiros.
 *  Quem oferece escolha filtra por `ativo` (formulário de agenda, cadastro
 *  de pessoa); quem só mostra, mostra. */
export function listarInstituicoes(): Promise<Instituicao[]> {
  return requisitar<Instituicao[]>('/api/instituicoes?incluir_inativos=1');
}

/** COM AS DESLIGADAS, pelo mesmo motivo de `listarInstituicoes`: sem elas o
 *  Reativar da Administração não tem em quem clicar. Quem oferece escolha
 *  filtra — `interlocutoresDaInstituicao` só devolve quem está disponível. */
export function listarInterlocutores(): Promise<Interlocutor[]> {
  return requisitar<Interlocutor[]>('/api/interlocutores?incluir_inativos=1');
}

export function listarPessoasAegea(): Promise<PessoaAegea[]> {
  return requisitar<PessoaAegea[]>('/api/pessoas-aegea');
}

/* -- cadastros de stakeholders -------------------------------------------- */
//
// Escrever aqui exige `administra_dicionarios`, e não `escrita`. Quem cadastra
// agenda LÊ estes nomes o tempo todo e não deve reescrevê-los: renomear uma
// instituição muda o que aparece em toda agenda que aponta para ela.

export interface InstituicaoEntrada {
  nome: string;
  /** O nome por extenso. `nome` é a forma curta, que é como se fala. */
  nome_completo?: string | null;
  /** `veiculo`, `orgao`, `entidade`, `investidor`, `proposicao`, `area_interna`,
   *  `credor`. É o que liga a instituição a uma frente. Opcional: sem ele, o
   *  back deriva da categoria de público (a tela de cadastro não pergunta
   *  mais); na edição, ausente, o gravado fica. */
  tipo?: string;
  esfera_id?: number | null;
  uf?: string | null;
  /** A relevância da INSTITUIÇÃO — Tier 1 a 4. Não confundir com o tier da
   *  agenda: a Folha é Tier 1 sempre, e uma nota de rodapé com a Folha pode
   *  ser Tier 3. `null` nas cadastradas antes de a coluna existir. */
  tier?: number | null;
  /** A taxonomia de públicos (10 categorias) e sua subdivisão. `null` nas
   *  cadastradas antes de a coluna existir — ver `0036_categoria_de_publico.sql`. */
  categoria_publico_id?: number | null;
  subcategoria_publico_id?: number | null;
  /** O cargo do perfil de rede, pelo rótulo — "Deputado estadual". Só em
   *  `tipo === 'perfil_rede'`; o backend recusa nos outros. */
  cargo?: string | null;
  /** A pessoa do CRM de quem este perfil é. Só em perfil de rede.
   *
   *  VAI SEMPRE NA EDIÇÃO, mesmo nula: o PUT substitui a ficha inteira, e
   *  omitir apagaria o vínculo de quem corrigisse só o nome do perfil. */
  interlocutor_id?: string | null;
  ativo?: boolean;
}

export interface InterlocutorEntrada {
  nome: string;
  /** DE QUEM esta pessoa fala. É o que a faz aparecer — ou não — em
   *  "Pela outra parte". */
  instituicao_id?: string | null;
  cargo?: string | null;
  /** A área do contato DENTRO da instituição dele (ex.: "Research") — texto
   *  livre, não o dicionário `area_pessoa` (a área da Aegea). */
  area?: string | null;
  /** Como se chega na pessoa para marcar a agenda. */
  email?: string | null;
  /** Links/handles de redes sociais, texto livre, zero ou mais — não
   *  identifica a rede nem valida formato. */
  redes_sociais?: string[];
  tipo?: string | null;
  ativo?: boolean;
}

export function criarInstituicao(entrada: InstituicaoEntrada): Promise<Instituicao> {
  return requisitar<Instituicao>('/api/instituicoes', {
    method: 'POST',
    body: JSON.stringify(entrada),
  });
}

export function editarInstituicao(
  id: string,
  entrada: InstituicaoEntrada,
): Promise<Instituicao> {
  return requisitar<Instituicao>(`/api/instituicoes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(entrada),
  });
}

export function criarInterlocutor(
  entrada: InterlocutorEntrada,
): Promise<Interlocutor> {
  return requisitar<Interlocutor>('/api/interlocutores', {
    method: 'POST',
    body: JSON.stringify(entrada),
  });
}

export function editarInterlocutor(
  id: string,
  entrada: InterlocutorEntrada,
): Promise<Interlocutor> {
  return requisitar<Interlocutor>(`/api/interlocutores/${id}`, {
    method: 'PUT',
    body: JSON.stringify(entrada),
  });
}

/** Apaga a pessoa. O servidor recusa quem já esteve numa agenda.
 *
 *  Apagar e desligar são coisas diferentes, e a diferença é o histórico: quem
 *  entrou por engano é lixo, e quem participou de uma reunião é um fato. A
 *  recusa vem com a contagem de agendas e o gesto certo na mensagem.
 */
export function removerInterlocutor(id: string): Promise<void> {
  return requisitar<void>(`/api/interlocutores/${id}`, { method: 'DELETE' });
}

/** Um cadastro que PODE ser o mesmo ator do perfil. `mencoes` é o número que
 *  diz qual dos dois é a linha com história — e, por isso, qual sobrevive. */
export interface CandidatoDeFusao {
  id: string;
  nome: string;
  tipo: string;
  mencoes: number;
  /** DE ONDE VÊM OS REGISTROS deste lado: códigos de lente (`imprensa`,
   *  `mercado`, `sociedade`, `clientes`, `institucional`) e `crm`.
   *
   *  É A EVIDÊNCIA DA DUPLICATA, e o pedido do dono do produto: "o Valor
   *  Econômico pode vir do crm, pode vir de mídias sociais, pode vir de mercado,
   *  pode ter várias fontes distintas, mas a instituição é a mesma". Dois nomes
   *  parecidos e duas contagens não dizem POR QUE existem dois cadastros; as
   *  origens dizem. */
  origens: string[];
}

export interface CadastroDuplicado {
  id: string;
  nome: string;
  /** O TIPO DE QUEM VAI SAIR.
   *
   *  A tela escrevia `ROTULO_DO_TIPO.perfil_rede` fixo, e era verdade enquanto a
   *  fila só perguntava sobre perfis de rede. Deixou de ser em 11/10/2026: a
   *  fila passou a olhar qualquer tipo, e 4 dos pares que ela pergunta são
   *  instituições do CRM — mostradas como "Perfil de rede" a quem ia decidir se
   *  apaga uma delas. */
  tipo: string;
  cargo: string | null;
  mencoes: number;
  candidatos: CandidatoDeFusao[];
  /** Ver `CandidatoDeFusao.origens`. */
  origens: string[];
}

/** Os perfis de rede que se parecem com outro cadastro já existente.
 *
 *  POR QUE EXISTE: o fornecedor de redes manda o handle (`valoreconomico`) e o
 *  clipping manda o nome (`Valor Econômico`). O homônimo exato a migration
 *  `0076` já fundiu sozinha; estes só casam depois de tirar pontuação, e ali
 *  semelhança não é identidade — `Diário SM` e `Diários M` casam assim. Quem
 *  conhece o ator decide, e o que decidir fica guardado.
 */
export function duplicadosDeCadastro(): Promise<CadastroDuplicado[]> {
  return requisitar<CadastroDuplicado[]>('/api/instituicoes/duplicados');
}

/** Funde um cadastro no outro: quem vem no primeiro argumento SAI, com as
 *  menções indo para quem fica.
 *
 *  ERA "quem sai é sempre o perfil de rede", e deixou de ser em 11/10/2026:
 *  qualquer tipo pode sair, porque qualquer tipo entra na fila. A assimetria
 *  que protegia a linha curada continua, mas pela ORDEM DA FILA — o servidor
 *  ancora a pergunta em quem deve sair — e não por um `if` de tipo.
 *
 *  O SOBREVIVENTE HERDA os campos que estiverem vazios nele e preenchidos em
 *  quem sai; se os dois tiverem valores diferentes no mesmo campo, o servidor
 *  recusa (422) listando quais. Não tem volta.
 *
 *  `contraAProposta` É A ESCOLHA DE QUEM CONHECE O ATOR, e é o pedido do dono do
 *  produto: "além de mostrar quais podem se juntar temos que dizer qual é o real
 *  para ser considerado na unificação". Sem ela, o servidor recusa a direção
 *  inversa com 422 — o que protege o clique errado; com ela, a escolha vale.
 *
 *  O QUE A ESCOLHA CONTRÁRIA CUSTA: o cadastro que fica mantém o NOME dele.
 *  `nome` e `tipo` não são herdados, porque trocá-los faria a fusão virar
 *  renomeação — então escolher o handle como o real deixa o cadastro chamado
 *  `valoreconomico`, com as menções do Valor Econômico dentro. */
export function fundirCadastro(
  queSaiId: string,
  sobreviventeId: string,
  contraAProposta = false,
): Promise<{ id: string; nome: string }> {
  return requisitar<{ id: string; nome: string }>(
    `/api/instituicoes/${queSaiId}/fundir`,
    {
      method: 'POST',
      body: JSON.stringify({
        sobrevivente_id: sobreviventeId,
        contra_a_proposta: contraAProposta,
      }),
    },
  );
}

/** "São atores diferentes" — tira o par da fila, para sempre.
 *
 *  FORA DE `/api/instituicoes/`: esta decisão não muda cadastro nenhum, e as
 *  rotas de catálogo disparam a recarga do catálogo inteiro por prefixo. */
export function declararCadastroDistinto(
  id: string,
  outroId: string,
  motivo?: string,
): Promise<{ guardado: boolean }> {
  return requisitar<{ guardado: boolean }>('/api/atores-distintos', {
    method: 'POST',
    body: JSON.stringify({ um_id: id, outro_id: outroId, motivo: motivo ?? null }),
  });
}

/** O que a mudança de casa de um contato devolve. */
export interface MudancaDeCasa {
  id: string;
  nome: string;
  /** A casa de onde saiu; nulo em quem não tinha nenhuma. */
  de: string | null;
  para: string;
  /** QUANTAS AGENDAS FICAM NA CASA ANTIGA.
   *
   *  É a frase que distingue as duas leituras: com zero, a provável é "errei a
   *  instituição no cadastro"; com trinta, é "mudou de casa". O histórico não se
   *  mexe — `interacao.instituicao_id` é coluna própria da agenda.
   *
   *  SÓ AS DA CASA ANTIGA, e isto foi um achado de revisão: a primeira versão
   *  contava todas as agendas do contato, inclusive as de uma terceira
   *  instituição, e inflava a frase da confirmação. */
  agendas_que_ficam: number;
  /** SE O CONTATO SAIU DA FILA DE REVISÃO com esta mudança.
   *
   *  Mover É a resposta à pergunta que a fila fazia — "confirme se são a mesma
   *  pessoa, se ela mudou de casa, ou se são homônimas" —, então ela se encerra
   *  aqui. `false` quando o contato não estava na fila: a tela não deve anunciar
   *  o que não houve. */
  consolidou: boolean;
}

/** Passa um contato para outra instituição.
 *
 *  ENDEREÇO PRÓPRIO, e não `editarInterlocutor` com outra `instituicao_id`.
 *  Aquele caminho existe e funciona — é por ele que a tela de cadastro grava a
 *  ficha —, e é exatamente por isso que este também existe: ali a instituição
 *  vai no meio de oito campos, com o mesmo peso de corrigir um e-mail.
 *
 *  A `0002` cria `unique (nome_normalizado, instituicao_id)` com o comentário
 *  "mesmo nome em instituições diferentes são pessoas diferentes": a instituição
 *  não é um atributo do contato, é parte da IDENTIDADE dele neste modelo.
 *  Trocá-la é afirmar que a pessoa é a mesma de outro lugar.
 *
 *  O SERVIDOR RECUSA (422) quando já existe alguém com aquele nome no destino —
 *  e a mensagem aponta para 'Possíveis duplicados', porque aí a resposta é
 *  fundir, não mover um para cima do outro. */
export function mudarContatoDeCasa(
  id: string,
  instituicaoId: string,
): Promise<MudancaDeCasa> {
  return requisitar<MudancaDeCasa>(
    `/api/interlocutores/${id}/mudanca-de-casa`,
    { method: 'POST', body: JSON.stringify({ instituicao_id: instituicaoId }) },
  );
}

/** Um cadastro que nasceu de planilha e ninguém consolidou ainda. */
export interface CadastroPendente {
  /** TEXTO, e não número: `tema` tem chave inteira e os outros três têm UUID.
   *  Quem consolida devolve o mesmo texto que recebeu. */
  id: string;
  /** O nome da tabela — `instituicao` | `interlocutor` | `tema` |
   *  `pessoa_aegea`. É o que a rota de consolidação recebe de volta. */
  tipo: string;
  nome: string;
  /** POR QUE ESTE REGISTRO ESPERA REVISÃO. Nulo é "nasceu de planilha", sem
   *  mais nada a dizer — o caso comum. */
  motivo: string | null;
  /** O QUE DISTINGUE ESTE DE UM REGISTRO DE NOME PARECIDO.
   *
   *  O motivo mais frequente é "apareceu em 2 instituições na mesma planilha",
   *  que cria DOIS cadastros com o mesmo nome, de propósito. Sem isto, a aba
   *  mostraria "Artur Santa" duas vezes com o mesmo motivo. */
  contexto: string | null;
  criado_em: string;
}

/** Uma das três abas de Cadastro compartilhado, com a sua fila. */
export interface AbaDeRevisao {
  /** `instituicoes` | `assuntos` | `porta_vozes` — os mesmos ids de
   *  `PortalDoCadastroCompartilhado`. */
  id: string;
  rotulo: string;
  pendentes: CadastroPendente[];
}

/** O que cada aba de Cadastro compartilhado tem para revisar.
 *
 *  PEDIDO DO DONO DO PRODUTO: "o profissional consegue subir a planilha sem
 *  problemas e pode revisar depois, e inclusive pode ser trabalho de outra
 *  pessoa. Queremos dar padronização, mas com menor impacto."
 *
 *  AS TRÊS SEMPRE, inclusive as vazias — ver `AbaSaida` no back. */
export function filaDeRevisao(): Promise<AbaDeRevisao[]> {
  return requisitar<AbaDeRevisao[]>('/api/revisao-de-cadastros');
}

/** "Conferi este cadastro, está certo" — e ele sai da fila.
 *
 *  NÃO EDITA O CADASTRO, só a marca. Se o registro estiver errado, o caminho é
 *  a lista de cadastro ao lado, que já sabe validar.
 *
 *  FORA DE `ROTAS_DO_CATALOGO` de propósito: consolidar não muda nada que o
 *  catálogo sirva — `pendente_de_revisao` e `motivo_da_revisao` estão em
 *  `COLUNAS_DE_CONTROLE` e nunca saem em `/api/dicionarios`. Uma recarga do
 *  catálogo inteiro aqui seria trabalho para não mudar nada na tela.
 *
 *  `ja_estava_consolidado` É O CASO NORMAL, e não um erro: a fila é trabalho de
 *  equipe pelo próprio pedido, então duas pessoas na mesma aba acontece. */
export function consolidarCadastro(
  tipo: string,
  id: string,
): Promise<{ pendente: CadastroPendente; ja_estava_consolidado: boolean }> {
  return requisitar<{ pendente: CadastroPendente; ja_estava_consolidado: boolean }>(
    `/api/revisao-de-cadastros/${tipo}/${encodeURIComponent(id)}/consolidacao`,
    { method: 'POST' },
  );
}

/** Uma instituição do lote que não pôde ser enquadrada, e por quê. */
export interface EnquadramentoRecusado {
  id: string;
  nome: string;
  motivo: string;
}

export interface EnquadramentoFeito {
  enquadradas: number;
  consolidadas: number;
  /** O tipo que a categoria escolhida implica, para a tela dizer o que
   *  aconteceu: "47 enquadradas como Órgão". */
  tipo: string;
  recusadas: EnquadramentoRecusado[];
}

/** Dá a mesma categoria de público a várias instituições da fila de revisão.
 *
 *  POR QUE EXISTE, e o número é o argumento: a planilha real de RI criou 178
 *  instituições sem categoria, todas como "Entidade", e a resposta para quase
 *  todas é a mesma. A consolidação uma a uma faria a pessoa digitar a mesma
 *  coisa 178 vezes — e desistir na décima, com a base meio classificada, que é
 *  pior do que não classificada porque ninguém sabe onde parou.
 *
 *  (As 499 pendências da aba juntam instituições e CONTATOS; só as 178
 *  instituições entram no lote, porque só elas têm categoria de público.)
 *
 *  O TIPO SAI DA CATEGORIA: enquadrar reclassifica as agendas de cada
 *  instituição do lote, porque é do tipo que a frente da agenda deriva. É por
 *  isso que este caminho está em `ROTAS_DO_CATALOGO` e o da consolidação não.
 *
 *  NÃO É TUDO-OU-NADA: com 178 linhas, uma colisão de nome faria o lote inteiro
 *  falhar e ninguém saberia qual das 178. O servidor enquadra as que dão e
 *  devolve `recusadas` com o motivo de cada uma.
 *
 *  SÓ ALCANÇA O QUE ESTÁ PENDENTE. Um lote capaz de reescrever o tipo de
 *  qualquer instituição deixaria um clique aqui varrer a curadoria de 3.785
 *  cadastros feitos à mão. */
export function enquadrarEmLote(entrada: {
  ids: string[];
  categoria_publico_id: number;
  subcategoria_publico_id?: number | null;
  consolidar?: boolean;
}): Promise<EnquadramentoFeito> {
  return requisitar<EnquadramentoFeito>(
    '/api/revisao-de-cadastros/instituicoes/enquadramento',
    { method: 'POST', body: JSON.stringify(entrada) },
  );
}

/** Apaga a instituição que entrou por engano — e as pessoas dela junto. O
 *  servidor recusa (422, contando as agendas) a que já esteve numa reunião:
 *  para essa o caminho é Desativar (`editarInstituicao` com `ativo: false`). */
export function removerInstituicao(id: string): Promise<void> {
  return requisitar<void>(`/api/instituicoes/${id}`, { method: 'DELETE' });
}

export interface PessoaAegeaEntrada {
  nome: string;
  cargo?: string | null;
  email?: string | null;
  eh_porta_voz?: boolean;
  area_id?: number | null;
  ativo?: boolean;
  /** Sobre o que esta pessoa pode falar. A lista inteira substitui a anterior. */
  temas?: number[];
}

export function criarPessoaAegea(
  entrada: PessoaAegeaEntrada,
): Promise<PessoaAegea> {
  return requisitar<PessoaAegea>('/api/pessoas-aegea', {
    method: 'POST',
    body: JSON.stringify(entrada),
  });
}

export function editarPessoaAegea(
  id: string,
  entrada: PessoaAegeaEntrada,
): Promise<PessoaAegea> {
  return requisitar<PessoaAegea>(`/api/pessoas-aegea/${id}`, {
    method: 'PUT',
    body: JSON.stringify(entrada),
  });
}

/** Os assuntos de UMA pessoa.
 *
 *  Rota separada de propósito: a listagem de pessoas alimenta o formulário de
 *  agenda, que não usa os temas, e carregá-los ali seria uma consulta por
 *  pessoa em toda abertura de tela.
 */
export function temasDoPortaVoz(id: string): Promise<number[]> {
  return requisitar<number[]>(`/api/pessoas-aegea/${id}/temas`);
}

export interface TemaCadastrado {
  id: number;
  nome: string;
  /** `sensivel` (exige alinhamento antes de falar), `estrategico` (agenda
   *  da companhia) ou `gerais` (o que aparece sem ter sido planejado). */
  nivel: string;
  ativo: boolean;
  /** Classificação binária Risco/Outros da taxonomia v3. `null` em quem não
   *  foi reconciliado com a taxonomia v4. */
  e_risco: boolean | null;
  /** O tema estratégico (nível 2) da taxonomia v4. `null` em quem não foi
   *  reconciliado com ela. Ver `dicionarios.macro_temas` para a lista e o
   *  pilar (nível 1) de cada um. */
  macro_tema_id: number | null;
  /** `legitimidade` | `credibilidade` | `confianca` | `nao_se_aplica`. */
  camada_lso: string | null;
  /** Os ids dos riscos da matriz corporativa (`dicionarios.riscos`) que este
   *  tema toca. Pode ser mais de um. Ver `migrations/0059`. */
  riscos: number[];
}

export interface TemaEntrada {
  nome: string;
  nivel?: string;
  ativo?: boolean;
  e_risco?: boolean | null;
  macro_tema_id?: number | null;
  camada_lso?: string | null;
  riscos?: number[];
}

/** A lista COMPLETA, inclusive os inativos.
 *
 *  `/api/dicionarios` devolve só os ativos, porque alimenta filtro e
 *  formulário. Quem administra precisa ver o que desativou — senão o assunto
 *  some da tela e reaparece como "já existe" na próxima tentativa de criar.
 */
/* -- dicionários ---------------------------------------------------------- */
//
// A Administração dos vocabulários. `GET /api/dicionarios` (o catálogo) traz
// só os ativos; aqui vem tudo, com a fronteira que o back define: os ABERTOS
// (vocabulário da coordenação) se editam, os FECHADOS (estrutura do modelo)
// vêm com o motivo. Ver `app/api/dicionarios.py`.

export interface ItemAdministravel {
  id: number;
  codigo?: string | null;
  nome: string;
  ordem?: number;
  ativo: boolean;
}

export interface DicionarioAdministravel {
  nome: string;
  rotulo: string;
  editavel: boolean;
  motivo: string | null;
  itens: ItemAdministravel[];
}

export interface ItemDeDicionarioEntrada {
  nome: string;
  ativo?: boolean;
}

export function listarDicionariosParaAdministracao(): Promise<DicionarioAdministravel[]> {
  return requisitar<DicionarioAdministravel[]>('/api/dicionarios/administracao');
}

export function acrescentarNoDicionario(
  dicionario: string,
  entrada: ItemDeDicionarioEntrada,
): Promise<ItemAdministravel> {
  return requisitar<ItemAdministravel>(`/api/dicionarios/${dicionario}`, {
    method: 'POST',
    body: JSON.stringify(entrada),
  });
}

/** Renomeia, desativa ou reativa. O `codigo` não muda: é ele que as agendas
 *  guardam — renomear é mudar o rótulo, não a identidade. */
export function editarNoDicionario(
  dicionario: string,
  id: number,
  entrada: ItemDeDicionarioEntrada,
): Promise<ItemAdministravel> {
  return requisitar<ItemAdministravel>(`/api/dicionarios/${dicionario}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(entrada),
  });
}

/* ------------------------------------------------------------- alegações */

/** O QUE ESTÁ CIRCULANDO — só as ativas, e sem a nota de apuração.
 *
 *  É o que o catálogo carrega para todo mundo: a lista que o formulário
 *  oferece e que a aba de Sinais usa para resolver o texto de cada premissa.
 *  O servidor decide o que sai pelo papel de quem pede. */
export function listarAlegacoes(): Promise<Alegacao[]> {
  return requisitar<Alegacao[]>('/api/alegacoes');
}

/** A LISTA INTEIRA, inclusive as fora de circulação e com a nota de apuração.
 *
 *  Só para a Administração, e o servidor recusa a quem não administra
 *  cadastros: sem as inativas, a alegação desativada some da tela e volta
 *  como "já está cadastrada" na tentativa seguinte — o índice único é sobre o
 *  texto normalizado, e não sobre o que a pessoa vê. */
export function listarAlegacoesParaAdministracao(): Promise<Alegacao[]> {
  return requisitar<Alegacao[]>('/api/alegacoes?incluir_inativas=1');
}

export interface AlegacaoEntrada {
  texto: string;
  temas: number[];
  apuracao_id?: number | null;
  referencia_id?: string | null;
  nota?: string | null;
  ativo?: boolean;
}

/** Quem REGISTRA a consulta cadastra a alegação que ela trouxe — a alegação
 *  nasce do registro, e não da administração. */
export function criarAlegacao(entrada: AlegacaoEntrada): Promise<Alegacao> {
  return requisitar<Alegacao>('/api/alegacoes', {
    method: 'POST',
    body: JSON.stringify(entrada),
  });
}

/** Apurar é da área: muda o status, amarra o posicionamento que responde,
 *  tira de circulação. */
export function editarAlegacao(id: string, entrada: AlegacaoEntrada): Promise<Alegacao> {
  return requisitar<Alegacao>(`/api/alegacoes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(entrada),
  });
}

/* ---------------------------------------------------------------- score */

export function listarTemas(): Promise<TemaCadastrado[]> {
  return requisitar<TemaCadastrado[]>('/api/temas');
}

export function criarTema(entrada: TemaEntrada): Promise<TemaCadastrado> {
  return requisitar<TemaCadastrado>('/api/temas', {
    method: 'POST',
    body: JSON.stringify(entrada),
  });
}

export function editarTema(
  id: number,
  entrada: TemaEntrada,
): Promise<TemaCadastrado> {
  return requisitar<TemaCadastrado>(`/api/temas/${id}`, {
    method: 'PUT',
    body: JSON.stringify(entrada),
  });
}

/* ------------------------------------------------ a biblioteca de referências */

/**
 * O acervo oficial, por assunto — com a versão mais recente de cada referência.
 *
 * Traz ATIVAS E INATIVAS, ao contrário do catálogo que alimenta o formulário:
 * sem as inativas, a referência desativada some da tela de administração e
 * reaparece como "já existe" na próxima tentativa de cadastrar o mesmo título.
 */
export function listarReferencias(): Promise<Referencia[]> {
  return requisitar<Referencia[]>('/api/referencias');
}

/**
 * Cadastra a referência COM a primeira versão, numa requisição só.
 *
 * Multipart, e não JSON: tem arquivo. Mas ele é OPCIONAL agora — a versão
 * pode viver só do Conteúdo, que por sua vez é obrigatório.
 */
export function criarReferencia(
  metadados: {
    titulo: string;
    tipo: string;
    tema_principal_id: number;
    /** Os demais assuntos. O principal entra sozinho. */
    temas: number[];
    resumo: string;
    conteudo: string;
    atualizado_em: string;
    nota?: string | null;
  },
  arquivo: File | null,
): Promise<Referencia> {
  const corpo = new FormData();
  corpo.append('titulo', metadados.titulo);
  corpo.append('tipo', metadados.tipo);
  corpo.append('tema_principal_id', String(metadados.tema_principal_id));
  corpo.append('atualizado_em', metadados.atualizado_em);
  // Lista vira texto separado por vírgula: multipart não carrega array, e um
  // campo repetido complicaria o cliente mais do que resolve.
  corpo.append('temas', metadados.temas.join(','));
  corpo.append('resumo', metadados.resumo);
  corpo.append('conteudo', metadados.conteudo);
  if (metadados.nota) corpo.append('nota', metadados.nota);
  if (arquivo) corpo.append('arquivo', arquivo);
  return requisitar<Referencia>('/api/referencias', { method: 'POST', body: corpo });
}

/** Só os metadados. Arquivo novo é VERSÃO nova, e entra pela outra rota. */
export function editarReferencia(
  id: string,
  entrada: ReferenciaEdicao,
): Promise<Referencia> {
  return requisitar<Referencia>(`/api/referencias/${id}`, {
    method: 'PUT',
    body: JSON.stringify(entrada),
  });
}

/**
 * Acrescenta uma versão. A anterior CONTINUA — é o histórico.
 *
 * É ele que responde "qual Q&A a gente levou naquela reunião de março", e é
 * por isso que subir a versão de agosto não apaga a de março. O arquivo é
 * opcional, igual na criação; o conteúdo, obrigatório.
 */
export function subirVersaoDaReferencia(
  id: string,
  arquivo: File | null,
  conteudo: string,
  atualizado_em: string,
  nota?: string,
): Promise<Referencia> {
  const corpo = new FormData();
  corpo.append('atualizado_em', atualizado_em);
  corpo.append('conteudo', conteudo);
  if (nota) corpo.append('nota', nota);
  if (arquivo) corpo.append('arquivo', arquivo);
  return requisitar<Referencia>(`/api/referencias/${id}/versoes`, {
    method: 'POST',
    body: corpo,
  });
}

export function listarVersoesDaReferencia(id: string): Promise<VersaoDaReferencia[]> {
  return requisitar<VersaoDaReferencia[]>(`/api/referencias/${id}/versoes`);
}

/** O endereço de download de uma versão. Passa pela API, e não pelo blob.
 *
 *  Um link direto continuaria valendo depois de a pessoa perder o acesso — e o
 *  acervo diz o que a companhia fala publicamente.
 */
export function urlDaVersao(referenciaId: string, versaoId: string): string {
  return `${BASE}/api/referencias/${referenciaId}/versoes/${versaoId}/arquivo`;
}

/**
 * Os documentos com ARQUIVO das agendas alcançadas pelo recorte.
 *
 * O recorte vai junto porque esta lista mora dentro da Base, e o cabeçalho da
 * Base diz o recorte em vigor: uma aba que ignorasse os filtros mostraria
 * documentos de agendas que a tela ao lado não lista.
 */
export function listarDocumentosDaReuniao(recorte: Recorte): Promise<DocumentoDaReuniao[]> {
  const parametros = paraParametros(recorte).toString();
  return requisitar<DocumentoDaReuniao[]>(`/api/materiais?${parametros}`);
}

// -- importação de agendas por planilha ---------------------------------------
