/** Cadastro de instituições e de quem fala por elas.
 *
 *  POR QUE ESTA TELA EXISTE
 *  ------------------------
 *  Duas decisões do formulário de agenda dependem destes cadastros: a frente
 *  escolhida filtra as instituições pelo TIPO, e a instituição escolhida filtra
 *  quem pode representar a outra parte. Sem um lugar para cadastrar, as duas
 *  listas teriam só o que a planilha trouxe — e uma agenda com um órgão novo
 *  não teria como ser registrada.
 *
 *  O TIPO NÃO É DETALHE. É ele que decide em qual frente a instituição aparece:
 *  `veiculo` só em Imprensa, `proposicao` só em Legislativo. O cadastro não o
 *  pergunta: ele nasce da categoria de público (`TIPO_DA_CATEGORIA_DE_PUBLICO`,
 *  no back), que a tela já obriga. A EDIÇÃO ainda o mostra, ao lado da frente
 *  em que ele faz a instituição surgir, porque duas coisas a taxonomia não
 *  distingue — banco credor de investidor, e área interna de qualquer público —
 *  e é lá que se corrige.
 *
 *  A tela NÃO é a barreira: quem decide é o backend, que responde 403 a quem
 *  não administra os cadastros. Esconder o que não se pode usar é conveniência.
 */

import { useMemo, useState } from 'react';
import {
  criarInstituicao,
  criarInterlocutor,
  editarInstituicao,
  editarInterlocutor,
  removerInstituicao,
  removerInterlocutor,
} from '@/api/cliente';
import type { InstituicaoEntrada } from '@/api/cliente';
import {
  Botao,
  Campo,
  Cartao,
  Chip,
  FaixaDeErro,
  Secao,
  Vazio,
  estiloDeEntrada,
} from '@/componentes/basicos';
import { FilaDeDuplicados } from '@/paginas/FilaDeDuplicados';
import { Abas } from '@/componentes/Abas';
import type { Aba } from '@/componentes/Abas';
import { CampoQueCompleta } from '@/componentes/CampoQueCompleta';
import { Paginacao } from '@/componentes/Paginacao';
import { numero } from '@/dominio/formato';
import { usePainel } from '@/estado/painel';
import { TIPO_DE_INSTITUICAO } from '@/dominio/frentes';
import type {
  CategoriaPublicoDoDicionario,
  Instituicao,
  Interlocutor,
  SubcategoriaPublicoDoDicionario,
} from '@/dominio/tipos';
import type { Catalogo } from '@/dominio/derivacoes';

/** O que este gesto de cadastro cria.
 *
 *  Dois caminhos, nomeados aqui em cima: a instituição sozinha, e a pessoa
 *  avulsa (o mesmo "Acrescentar pessoa" que existe dentro de cada linha da
 *  lista, só que como primeira opção, sem exigir abrir a instituição certa
 *  lá embaixo antes). Cadastrar os dois de uma vez já foi um terceiro modo
 *  e saiu: quem representa a instituição se cadastra em "Contatos" depois
 *  que ela existe — um gesto por decisão.
 */
const MODOS_DE_CADASTRO: readonly Aba<'instituicao' | 'pessoa'>[] = [
  { id: 'instituicao', rotulo: 'Instituição' },
  { id: 'pessoa', rotulo: 'Contatos' },
];

const PESSOA_AVULSA_VAZIA = {
  instituicao_id: '', nome: '', email: '', cargo: '', area: '', redes_sociais: [] as string[],
};

//: O código que o banco grava (`orgao`, `area_interna`...) não é o que se lê
//: numa tela. Escrito à mão, e não derivado: são seis valores fixos, do
//: mesmo jeito que o dicionário de UF já tem código E nome escritos à parte.
const ROTULO_DO_TIPO: Record<string, string> = {
  orgao: 'Órgão',
  veiculo: 'Veículo',
  entidade: 'Entidade',
  investidor: 'Investidor',
  proposicao: 'Proposição',
  area_interna: 'Área interna',
  credor: 'Banco/credor',
  perfil_rede: 'Perfil de rede',
};

/** Tipos que existem no cadastro e NÃO são frente do CRM.
 *
 *  `TIPO_DE_INSTITUICAO` mapeia FRENTE → tipo: uma agenda de imprensa fala com
 *  veículo, uma de legislativo com proposição. `perfil_rede` não está lá porque
 *  não existe agenda com um perfil de Instagram — ele nasce da ingestão do
 *  social listening, onde "quem falou" é um perfil (`deolhoemesteio`, "Stela
 *  Farias") e não um veículo de imprensa.
 *
 *  MAS ELE APARECE NESTA TELA, e por isso precisa estar aqui. Sem isto, o
 *  `<select>` de Tipo não tinha a opção: abrir um perfil para editar mostrava
 *  "Órgão" — a primeira opção da lista — para um registro que é perfil de
 *  rede, e um clique no campo trocaria o tipo de verdade. O filtro, do mesmo
 *  jeito, exibia o código cru `perfil_rede`.
 */
const TIPOS_SEM_FRENTE = ['perfil_rede'];

/** Os tipos de instituição que se pode cadastrar.
 *
 *  Derivado de `TIPO_DE_INSTITUICAO`, e não escrito à mão: uma lista própria
 *  divergiria do mapa, e a tela ofereceria um tipo que o backend não aceita.
 */
function tiposCadastraveis(): { tipo: string; rotulo: string }[] {
  const tipos = new Set([...Object.values(TIPO_DE_INSTITUICAO), ...TIPOS_SEM_FRENTE]);
  return [...tipos].map((tipo) => ({
    tipo,
    rotulo: ROTULO_DO_TIPO[tipo] ?? tipo,
  }));
}

const TIPOS = tiposCadastraveis();

/** As subcategorias de UMA categoria, na ordem — `subcategorias_publico` vem
 *  do dicionário inteiro, de todas as categorias juntas (ver
 *  `Dicionarios.subcategorias_publico`), então quem monta o `<select>`
 *  dependente sempre filtra por `categoria_publico_id` primeiro. */
function subcategoriasDe(
  catalogo: Catalogo,
  categoriaPublicoId: string,
): SubcategoriaPublicoDoDicionario[] {
  const id = Number(categoriaPublicoId);
  return catalogo.dicionarios.subcategorias_publico
    .filter((s) => s.categoria_publico_id === id)
    .sort((a, b) => a.ordem - b.ordem);
}

const VAZIA = {
  nome: '',
  nome_completo: '',
  uf: '',
  esfera: '',
  //: SEM PADRAO, e e por isso que e string vazia e nao 3.
  //:
  //: Um padrao aqui viraria o valor da maioria: quem cadastra com pressa
  //: aceita o que ja esta na tela, e a base inteira acaba num tier so — o
  //: campo passa a existir sem significar nada. Vazio obriga a escolher,
  //: enquanto quem cadastra ainda sabe por que aquela instituicao importa.
  tier: '',
  //: MESMO RACIOCINIO DO TIER: sem padrao, para obrigar a escolha. Ao
  //: contrario do tier, aqui o backend aceita nulo mesmo em instituicao nova
  //: — as ~99 que ja existiam ficam sem categoria ate o backfill, e o mesmo
  //: formulario serve para corrigi-las. `obrigatorio` na tela é só para
  //: instituição CRIADA daqui pra frente não nascer sem classificação.
  categoria_publico_id: '',
  //: SÓ FAZ SENTIDO junto de uma categoria com `padrao_de_quebra !==
  //: 'sem_quebra'` — o campo de subcategoria só aparece nesse caso.
  subcategoria_publico_id: '',
  //: SÓ DE PERFIL DE REDE, e o backend recusa nos outros tipos.
  cargo: '',
  pessoa: '',
};
const SEM_PESSOA = {
  nome: '', email: '', cargo: '', area: '', redes_sociais: [] as string[],
};

/** A ficha como a tela a mostra: é o rascunho de partida da edição, e também
 *  o de quem só quer inverter `ativo` sem abrir a edição. */
function rascunhoDe(instituicao: Instituicao): RascunhoDaInstituicao {
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

/** O corpo do PUT, a partir do rascunho. ESCRITO UMA VEZ: Salvar e
 *  Desativar/Reativar passam por aqui, e é por isso que `ativo` — que o PUT
 *  substitui junto com o resto da ficha — não pode ser esquecido em nenhum.
 *
 *  VAZIO VIRA `null`, e não 0: as instituições anteriores às colunas de tier
 *  e de categoria não têm valor, e corrigir o nome de uma delas não pode
 *  obrigar a classificá-la primeiro. */
function entradaDaEdicao(rascunho: RascunhoDaInstituicao, ativo: boolean): InstituicaoEntrada {
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

/** O que a edição de uma instituição mexe.
 *
 *  ESCRITO UMA VEZ. A forma estava em três lugares — o estado, a prop da linha
 *  e a assinatura do callback — e ao acrescentar `tier` os três divergiram na
 *  mesma hora, com o compilador apontando dois deles.
 *
 *  `tier` é string porque vem de um `<select>`, e vira número só na hora de
 *  enviar: guardar número aqui obrigaria a representar "nada escolhido" como
 *  0 ou NaN, que são valores e não ausências.
 */
interface RascunhoDaInstituicao {
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

//: O RASCUNHO DE UM CONTATO, nos três lugares que o editam (o formulário do
//: topo, o "Acrescentar pessoa" por instituição, e a edição inline) — um tipo
//: só, para uma rede nova não exigir achar os três lugares à mão de novo.
interface RascunhoDePessoa {
  nome: string;
  email: string;
  cargo: string;
  area: string;
  //: LISTA LIVRE, e não uma caixa por rede: a pessoa acrescenta quantos
  //: links quiser, de qualquer rede, um de cada vez.
  redes_sociais: string[];
}

/** O campo de redes sociais: digita um link ou handle, "Adicionar" (ou
 *  Enter) acrescenta na lista, cada um vira um chip removível. Não identifica
 *  a rede nem valida formato — é só uma lista de texto.
 *
 *  O TEXTO SENDO DIGITADO FICA AQUI DENTRO, e não no rascunho do contato: é
 *  estado transitório do widget, não um valor do cadastro — o rascunho só
 *  guarda o que já foi acrescentado. Isso também é o que permite reusar este
 *  componente nos três formulários sem um terceiro `useState` na página de
 *  fora para cada um. */
export function CampoDeRedesSociais({
  valores,
  aoMudar,
}: {
  valores: string[];
  aoMudar: (novos: string[]) => void;
}) {
  const [digitando, definirDigitando] = useState('');

  const acrescentar = () => {
    const valor = digitando.trim();
    if (!valor) return;
    aoMudar([...valores, valor]);
    definirDigitando('');
  };

  return (
    <Campo rotulo="Redes sociais">
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          style={estiloDeEntrada}
          value={digitando}
          onChange={(e) => definirDigitando(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              acrescentar();
            }
          }}
          //: E AO SAIR DO CAMPO. Sem isto, quem digitava `@fulano` e clicava
          //: direto em "Cadastrar" salvava o contato SEM a rede: o texto era
          //: estado do widget e só entrava na lista pelo "Adicionar" ou pelo
          //: Enter. Achado de revisão de 08/10/2026. O clique no botão de fora
          //: tira o foco daqui antes de disparar, então o chip entra primeiro —
          //: e `CampoDeRedesSociais.test.tsx` existe para provar essa ordem, que
          //: é fina demais para ficar só no comentário.
          onBlur={acrescentar}
          placeholder="Link ou @usuário"
        />
        <Botao
          estilo={{ height: 40, flex: 'none' }}
          desabilitado={!digitando.trim()}
          aoClicar={acrescentar}
        >
          Adicionar
        </Botao>
      </div>
      {valores.length ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {valores.map((valor, indice) => (
            <Chip
              key={`${valor}-${indice}`}
              rotulo={valor}
              ativo
              titulo="Remover"
              aoClicar={() => aoMudar(valores.filter((_, i) => i !== indice))}
            />
          ))}
        </div>
      ) : null}
    </Campo>
  );
}

export function CadastroDeInstituicoes() {
  const { catalogo } = usePainel();
  const [erro, definirErro] = useState<string | null>(null);
  //: O que acabou de dar certo. Sem isto, salvar é SILENCIOSO: o formulário
  //: limpa e nada diz que a gravação foi feita — e quem não confia cadastra
  //: duas vezes.
  const [feito, definirFeito] = useState<string | null>(null);
  //: Qual pessoa está com a remoção pendente de confirmação. Duas etapas na
  //: própria linha, e não um modal: o modal tira o contexto de QUAL linha, que
  //: é a informação que importa quando há dez pessoas na lista.
  const [aRemover, definirARemover] = useState<string | null>(null);
  //: A mesma coisa, para a INSTITUIÇÃO: qual linha de "Cadastrados" está
  //: com "Excluir de vez?" aberto. Um id só — pedir a exclusão de uma fecha a
  //: pergunta da outra.
  const [aExcluir, definirAExcluir] = useState<string | null>(null);
  const [salvando, definirSalvando] = useState(false);
  const [busca, definirBusca] = useState('');

  //: Qual instituição está aberta para edição, e qual está com a lista de
  //: pessoas expandida. Duas coisas diferentes: dá para ver quem representa uma
  //: instituição sem entrar no modo de edição dela.
  const [emEdicao, definirEmEdicao] = useState<string | null>(null);
  const [aberta, definirAberta] = useState<string | null>(null);
  //: Qual das duas formas o gesto de cadastro do topo está fazendo agora.
  const [modo, definirModo] = useState<'instituicao' | 'pessoa'>('instituicao');
  const [nova, definirNova] = useState(VAZIA);
  //: O rascunho do modo "Só a pessoa" — vive separado de `nova` porque os
  //: dois modos podem ser preenchidos e abandonados de forma independente:
  //: trocar de aba não deveria apagar o que já foi digitado no outro modo.
  const [pessoaAvulsa, definirPessoaAvulsa] = useState(PESSOA_AVULSA_VAZIA);
  //: O rascunho da EDICAO nao carrega pessoa: editar a instituicao nao e o
  //: lugar de acrescentar gente — para isso existe "Quem representa".
  const [rascunho, definirRascunho] = useState<RascunhoDaInstituicao>({
    nome: '',
    nome_completo: '',
    tipo: 'orgao',
    uf: '',
    esfera: '',
    tier: '',
    categoria_publico_id: '',
    subcategoria_publico_id: '',
    cargo: '',
    pessoa: '',
  });
  const [pessoaNova, definirPessoaNova] = useState(SEM_PESSOA);
  //: Qual PESSOA esta aberta para edicao, e o rascunho dela. Separado do
  //: rascunho da instituicao: dá para editar uma pessoa sem entrar no modo de
  //: edicao da instituicao que a abriga.
  const [pessoaEmEdicao, definirPessoaEmEdicao] = useState<string | null>(null);
  const [rascunhoDaPessoa, definirRascunhoDaPessoa] = useState(SEM_PESSOA);

  //: O FILTRO POR TIPO, e por que ele passou a ser necessário.
  //:
  //: A lista era só nome e busca por texto. Funcionava com 99 instituições; a
  //: importação da Clipei cadastrou 2.631 VEÍCULOS de uma vez, e aí "ver as
  //: instituições cadastradas" virou percorrer 273 páginas ordenadas por nome,
  //: com os veículos espalhados entre órgãos e entidades.
  //:
  //: Quem acabou de autorizar a criação quer ver O QUE CRIOU, e o tipo é
  //: exatamente esse corte — cada linha já o mostra, só não dava para filtrar.
  const [tipoEscolhido, definirTipoEscolhido] = useState('');

  const instituicoes = useMemo(() => {
    const todas = [...(catalogo?.instituicoes.values() ?? [])];
    const termo = busca.trim().toLowerCase();
    return todas
      .filter((i) => !termo || i.nome.toLowerCase().includes(termo))
      .filter((i) => !tipoEscolhido || i.tipo === tipoEscolhido)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [catalogo, busca, tipoEscolhido]);

  //: QUANTAS DE CADA TIPO EXISTEM, para o seletor dizer o tamanho de cada corte
  //: antes de a pessoa escolher. "Veículo (2.670)" responde a pergunta dela sem
  //: precisar filtrar para descobrir.
  const quantasPorTipo = useMemo(() => {
    const conta = new Map<string, number>();
    for (const i of catalogo?.instituicoes.values() ?? []) {
      conta.set(i.tipo, (conta.get(i.tipo) ?? 0) + 1);
    }
    return [...conta.entries()].sort((a, b) => b[1] - a[1]);
  }, [catalogo]);

  //: QUANTAS EXISTEM, e não quantas a página mostra.
  //:
  //: A lista mostra 10 por página e o título dizia só "Cadastrados". Com 2.730
  //: instituições — a importação da Clipei cadastrou 2.631 veículos de uma vez
  //: — isso são 273 páginas, e quem acabou de autorizar a criação abriu a tela,
  //: viu dez nomes e concluiu que os outros não tinham entrado. Estavam todos
  //: lá; a tela não dizia.
  //:
  //: O TOTAL VEM DO CATÁLOGO, não da lista filtrada: durante uma busca, "12 de
  //: 2.730" responde as duas perguntas que a pessoa tem — quantas casaram e
  //: quantas existem. Só o filtrado faria o número despencar e parecer perda.
  const totalCadastrado = catalogo?.instituicoes.size ?? 0;

  //: PAGINAÇÃO DA LISTA "CADASTRADOS" — client-side, de propósito: a lista
  //: inteira já vem do catálogo carregado uma vez no boot do app (usado por
  //: outras telas também), então não há por que paginar no servidor. Só
  //: corta o que a tela MOSTRA.
  const POR_PAGINA = 10;
  const [pagina, definirPagina] = useState(1);
  // NOVA BUSCA VOLTA PRA PÁGINA 1 — ajuste durante a renderização, mesmo
  // padrão de `CampoDePeriodo` (`PainelDeFiltros.tsx`): sem isto, filtrar por
  // um nome raro podia deixar a tela numa página que não existe mais para
  // aquele resultado.
  //: O TIPO ENTRA NA MESMA REGRA DA BUSCA: trocar o corte na página 200 deixaria
  //: a tela numa página que não existe mais para o resultado novo.
  const [recorteAnterior, definirRecorteAnterior] = useState(busca + '|' + tipoEscolhido);
  if (busca + '|' + tipoEscolhido !== recorteAnterior) {
    definirRecorteAnterior(busca + '|' + tipoEscolhido);
    definirPagina(1);
  }
  const totalDePaginas = Math.max(1, Math.ceil(instituicoes.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalDePaginas);
  const instituicoesDaPagina = instituicoes.slice(
    (paginaAtual - 1) * POR_PAGINA,
    paginaAtual * POR_PAGINA,
  );

  //: Todas, sem o filtro de busca da lista "Cadastrados" — o rótulo de opção
  //: leva o nome completo na busca pelo mesmo motivo do formulário de agenda:
  //: quem digita "agencia nacional" precisa achar "ANA".
  const opcoesDeInstituicao = useMemo(
    () =>
      [...(catalogo?.instituicoes.values() ?? [])]
        .filter((instituicao) => instituicao.ativo)
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
        .map((instituicao) => ({
          valor: instituicao.id,
          rotulo: instituicao.nome,
          detalhe: instituicao.nome_completo ?? undefined,
        })),
    [catalogo],
  );

  //: TODAS, desligadas inclusive — é aqui que se reativa. O formulário de
  //: agenda é quem filtra (`interlocutoresDaInstituicao`).
  const pessoasDe = (instituicaoId: string): Interlocutor[] =>
    [...(catalogo?.interlocutores.values() ?? [])]
      .filter((p) => p.instituicao_id === instituicaoId)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  //: TODAS AS PESSOAS DO CRM, para o seletor "de quem e este perfil".
  //:
  //: A LISTA INTEIRA, e nao as da instituicao: a deputada Stela Farias e
  //: interlocutora da Assembleia, e o perfil de Instagram dela e outro
  //: registro — e so por isso dizer "este perfil e dela" nao a move de
  //: instituicao. E o que faz os tres perfis dela virarem uma pessoa.
  const pessoasDoCrm = [...(catalogo?.interlocutores.values() ?? [])].sort((a, b) =>
    a.nome.localeCompare(b.nome, 'pt-BR'),
  );

  /** Toda escrita passa por aqui.
   *
   *  O catálogo — que alimenta o formulário de agenda, os filtros e a ficha —
   *  recarrega sozinho: o cliente da API avisa a cada escrita bem-sucedida
   *  numa rota de catálogo, e o estado do painel escuta. Ver
   *  `dominio/sincronizacao.ts`. Esta tela não precisa lembrar de nada.
   */
  const executar = async (
    acao: () => Promise<unknown>,
    aoTerminar: () => void,
    aviso = 'Salvo.',
  ) => {
    definirSalvando(true);
    definirErro(null);
    definirFeito(null);
    try {
      await acao();
      aoTerminar();
      definirFeito(aviso);
    } catch (falha) {
      definirErro((falha as Error).message);
    } finally {
      definirSalvando(false);
    }
  };

  if (!catalogo) return null;

  //: A SUBCATEGORIA SÓ APARECE quando a categoria escolhida tem
  //: `padrao_de_quebra !== 'sem_quebra'` — Poder Judiciário, Entidades
  //: Setoriais e Parceiros e Cadeia de Valor não têm subdivisão nenhuma.
  //: (O rascunho de EDIÇÃO tem o mesmo cálculo dentro de `LinhaDeInstituicao`,
  //: que é onde ele é usado — este aqui serve só o formulário "nova".)
  const categoriaDaNova = catalogo.dicionarios.categorias_publico.find(
    (c) => c.id === Number(nova.categoria_publico_id),
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {erro ? <FaixaDeErro mensagem={erro} /> : null}
      {feito ? (
        <div
          style={{
            background: 'var(--ok-bg)',
            color: 'var(--ok-fg)',
            padding: '11px 14px',
            borderRadius: 'var(--r-card-int)',
            fontSize: 13,
          }}
        >
          {feito}
        </div>
      ) : null}

      <Secao titulo="Cadastrar">
        <Cartao>
          <div style={{ marginBottom: 18 }}>
            <Abas
              abas={MODOS_DE_CADASTRO}
              ativa={modo}
              aoTrocar={definirModo}
              rotulo="O que cadastrar"
              prefixo="cadastro-tipo"
            />
          </div>

          {modo === 'pessoa' ? (
            <p style={{ fontSize: 13, color: 'var(--cinza-2)', margin: '0 0 16px' }}>
              A instituição já está cadastrada — aqui você escolhe qual, e
              cadastra só a pessoa nova que passou a representá-la.
            </p>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--cinza-2)', margin: '0 0 16px' }}>
              A categoria de público é o que faz esta instituição aparecer nas
              interações certas — Poder Executivo em Governo, Imprensa em
              Imprensa, e assim por diante.
            </p>
          )}

          {modo === 'pessoa' ? null : (
          <div className="grade grade--3" style={{ gap: 16 }}>
            <Campo
              rotulo="Nome curto"
              obrigatorio
              dica="Como se fala: ANA, ABCON, CNI."
            >
              <input
                style={estiloDeEntrada}
                value={nova.nome}
                onChange={(e) => definirNova({ ...nova, nome: e.target.value })}
                placeholder="ANA"
              />
            </Campo>

            <Campo rotulo="Nome completo">
              <input
                style={estiloDeEntrada}
                value={nova.nome_completo}
                onChange={(e) =>
                  definirNova({ ...nova, nome_completo: e.target.value })
                }
                placeholder="Agência Nacional de Águas e Saneamento Básico"
              />
            </Campo>

            <Campo rotulo="Abrangência" dica="UF, NA (nacional) ou IN (internacional).">
              <select
                style={estiloDeEntrada}
                value={nova.uf}
                onChange={(e) => definirNova({ ...nova, uf: e.target.value })}
              >
                <option value="">Não informada</option>
                {catalogo.dicionarios.ufs.map((uf) => (
                  <option key={uf.codigo} value={uf.codigo}>
                    {uf.nome}
                  </option>
                ))}
              </select>
            </Campo>

            {/* A RELEVÂNCIA É DA INSTITUIÇÃO, e não do encontro.
                A agenda tem o seu próprio tier, e são coisas diferentes: a
                Folha é Tier 1 sempre, e uma nota de rodapé com a Folha pode
                ser Tier 3. Sem este campo, a pergunta se refaz a cada reunião
                — e é respondida diferente. */}
            <Campo
              rotulo="Relevância"
              obrigatorio
              dica="O quanto esta instituição importa em geral — cada agenda pode ter uma relevância diferente da dela."
            >
              <select
                style={estiloDeEntrada}
                value={nova.tier}
                onChange={(e) => definirNova({ ...nova, tier: e.target.value })}
              >
                <option value="">Selecione…</option>
                {catalogo.dicionarios.relevancias.map((nivel) => (
                  <option key={nivel.id} value={nivel.id}>
                    {nivel.nome}
                  </option>
                ))}
              </select>
            </Campo>

            {/* A CATEGORIA DE PÚBLICO é atributo da instituição, igual à
                relevância acima — não da agenda. Ver
                0036_categoria_de_publico.sql. Obrigatória aqui: o backend
                aceita nulo (para não travar a edição das ~99 instituições que
                existiam antes desta coluna), mas instituição CRIADA daqui pra
                frente não deveria nascer sem classificação. */}
            <Campo
              rotulo="Categoria de público"
              obrigatorio
              dica="A nova taxonomia de públicos — de que tipo de ator esta instituição é."
            >
              <select
                style={estiloDeEntrada}
                value={nova.categoria_publico_id}
                onChange={(e) =>
                  definirNova({
                    ...nova,
                    categoria_publico_id: e.target.value,
                    // TROCAR A CATEGORIA LIMPA A SUBCATEGORIA: uma escolhida
                    // antes pode não pertencer mais à categoria nova.
                    subcategoria_publico_id: '',
                  })
                }
              >
                <option value="">Selecione…</option>
                {catalogo.dicionarios.categorias_publico.map((categoria) => (
                  <option key={categoria.id} value={categoria.id}>
                    {categoria.nome}
                  </option>
                ))}
              </select>
            </Campo>

            {categoriaDaNova && categoriaDaNova.padrao_de_quebra !== 'sem_quebra' ? (
              <Campo rotulo="Esfera" obrigatorio>
                <select
                  style={estiloDeEntrada}
                  value={nova.subcategoria_publico_id}
                  onChange={(e) =>
                    definirNova({ ...nova, subcategoria_publico_id: e.target.value })
                  }
                >
                  <option value="">Selecione…</option>
                  {subcategoriasDe(catalogo, nova.categoria_publico_id).map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.nome}
                    </option>
                  ))}
                </select>
              </Campo>
            ) : null}
          </div>
          )}

          {/* MODO "SÓ A PESSOA": a mesma escrita que já existia dentro de cada
              linha de "Cadastrados" (`criarInterlocutor` com `instituicao_id`
              de uma instituição JÁ existente) — só que aqui em cima, como
              primeira opção, em vez de exigir abrir a instituição certa lá
              embaixo primeiro. */}
          {modo === 'pessoa' ? (
            <div className="grade grade--3" style={{ gap: 16 }}>
              <CampoQueCompleta
                rotulo="Instituição"
                obrigatorio
                valor={pessoaAvulsa.instituicao_id}
                aoEscolher={(v) =>
                  definirPessoaAvulsa({ ...pessoaAvulsa, instituicao_id: v })
                }
                opcoes={opcoesDeInstituicao}
                placeholder="Digite para buscar…"
              />
              <Campo rotulo="Nome" obrigatorio>
                <input
                  style={estiloDeEntrada}
                  value={pessoaAvulsa.nome}
                  onChange={(e) =>
                    definirPessoaAvulsa({ ...pessoaAvulsa, nome: e.target.value })
                  }
                  placeholder="Maria Souza"
                />
              </Campo>
              <Campo rotulo="Cargo">
                <input
                  style={estiloDeEntrada}
                  value={pessoaAvulsa.cargo}
                  onChange={(e) =>
                    definirPessoaAvulsa({ ...pessoaAvulsa, cargo: e.target.value })
                  }
                  placeholder="Diretora de Regulação"
                />
              </Campo>
              {/* A ÁREA DELA NA INSTITUIÇÃO — texto livre, não o dicionário
                  de área da Aegea. Ver `InterlocutorEntrada.area`. */}
              <Campo rotulo="Área">
                <input
                  style={estiloDeEntrada}
                  value={pessoaAvulsa.area}
                  onChange={(e) =>
                    definirPessoaAvulsa({ ...pessoaAvulsa, area: e.target.value })
                  }
                  placeholder="Research"
                />
              </Campo>
              <Campo rotulo="E-mail">
                <input
                  type="email"
                  style={estiloDeEntrada}
                  value={pessoaAvulsa.email}
                  onChange={(e) =>
                    definirPessoaAvulsa({ ...pessoaAvulsa, email: e.target.value })
                  }
                  placeholder="maria.souza@ana.gov.br"
                />
              </Campo>
              {/* 2 COLUNAS, NÃO A LINHA INTEIRA — pra não ficar maior que
                  as caixas de cima; termina alinhado com o fim do E-mail. */}
              <div style={{ gridColumn: 'span 2' }}>
                <CampoDeRedesSociais
                  valores={pessoaAvulsa.redes_sociais}
                  aoMudar={(novos) =>
                    definirPessoaAvulsa({ ...pessoaAvulsa, redes_sociais: novos })
                  }
                />
              </div>
            </div>
          ) : null}

          <div style={{ marginTop: 14 }}>
            <Botao
              variante="primario"
              desabilitado={
                salvando ||
                (modo === 'pessoa'
                  ? !pessoaAvulsa.instituicao_id || !pessoaAvulsa.nome.trim()
                  : !nova.nome.trim() ||
                    !nova.tier ||
                    // INSTITUIÇÃO NOVA NÃO NASCE SEM CATEGORIA — diferente da
                    // edição, que aceita nulo para não travar a correção das
                    // ~99 que existiam antes desta coluna (ver backfill).
                    !nova.categoria_publico_id ||
                    (categoriaDaNova?.padrao_de_quebra !== 'sem_quebra' &&
                      !nova.subcategoria_publico_id))
              }
              aoClicar={() =>
                modo === 'pessoa'
                  ? void executar(
                      () =>
                        criarInterlocutor({
                          nome: pessoaAvulsa.nome,
                          instituicao_id: pessoaAvulsa.instituicao_id,
                          email: pessoaAvulsa.email || null,
                          cargo: pessoaAvulsa.cargo || null,
                          area: pessoaAvulsa.area || null,
                          redes_sociais: pessoaAvulsa.redes_sociais,
                        }),
                      () => definirPessoaAvulsa(PESSOA_AVULSA_VAZIA),
                      `${pessoaAvulsa.nome} cadastrada.`,
                    )
                  : void executar(
                      () =>
                        criarInstituicao({
                          nome: nova.nome,
                          nome_completo: nova.nome_completo || null,
                          // SEM `tipo`, de propósito: o back o deriva da
                          // categoria de público, obrigatória logo abaixo.
                          uf: nova.uf || null,
                          esfera_id: nova.esfera ? Number(nova.esfera) : null,
                          tier: Number(nova.tier),
                          categoria_publico_id: nova.categoria_publico_id
                            ? Number(nova.categoria_publico_id)
                            : null,
                          subcategoria_publico_id: nova.subcategoria_publico_id
                            ? Number(nova.subcategoria_publico_id)
                            : null,
                        }),
                      () => definirNova(VAZIA),
                    )
              }
            >
              {salvando ? 'Salvando…' : 'Cadastrar'}
            </Botao>
          </div>
        </Cartao>
      </Secao>

      {/* A FILA DO MESMO ATOR CADASTRADO DUAS VEZES, acima da lista porque é
          trabalho a fazer, e não consulta. Ela não aparece quando está vazia. */}
      <FilaDeDuplicados />

      <Secao
        titulo={
          instituicoes.length !== totalCadastrado
            ? `Cadastrados (${numero(instituicoes.length)} de ${numero(totalCadastrado)})`
            : `Cadastrados (${numero(totalCadastrado)})`
        }
      >
        <Cartao>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(200px, 2fr) minmax(180px, 1fr)',
              gap: 12,
            }}
          >
            <Campo rotulo="Buscar">
              <input
                style={estiloDeEntrada}
                value={busca}
                onChange={(e) => definirBusca(e.target.value)}
                placeholder="Parte do nome"
              />
            </Campo>
            <Campo rotulo="Tipo">
              <select
                style={estiloDeEntrada}
                value={tipoEscolhido}
                onChange={(e) => definirTipoEscolhido(e.target.value)}
              >
                <option value="">Todos os tipos</option>
                {quantasPorTipo.map(([tipo, quantas]) => (
                  <option key={tipo} value={tipo}>
                    {`${ROTULO_DO_TIPO[tipo] ?? tipo} (${numero(quantas)})`}
                  </option>
                ))}
              </select>
            </Campo>
          </div>

          {instituicoes.length === 0 ? (
            <div style={{ marginTop: 14 }}>
              <Vazio
                mensagem={
                  tipoEscolhido
                    ? `Nenhuma instituição desse tipo${busca.trim() ? ' com esse nome' : ''}.`
                    : 'Nenhuma instituição com esse nome.'
                }
              />
            </div>
          ) : null}

          {instituicoesDaPagina.map((instituicao) => (
            <LinhaDeInstituicao
              key={instituicao.id}
              instituicao={instituicao}
              pessoas={pessoasDe(instituicao.id)}
              ufs={catalogo.dicionarios.ufs}
              relevancias={catalogo.dicionarios.relevancias}
              categoriasPublico={catalogo.dicionarios.categorias_publico}
              subcategoriasPublico={catalogo.dicionarios.subcategorias_publico}
              pessoasDoCrm={pessoasDoCrm}
              emEdicao={emEdicao === instituicao.id}
              aberta={aberta === instituicao.id}
              salvando={salvando}
              rascunho={rascunho}
              pessoaNova={pessoaNova}
              aoRascunhar={definirRascunho}
              aoRascunharPessoa={definirPessoaNova}
              aoAbrir={() =>
                definirAberta(aberta === instituicao.id ? null : instituicao.id)
              }
              aoEditar={() => {
                definirEmEdicao(instituicao.id);
                definirRascunho(rascunhoDe(instituicao));
              }}
              aoCancelar={() => definirEmEdicao(null)}
              aoSalvar={() =>
                void executar(
                  () =>
                    editarInstituicao(
                      instituicao.id,
                      entradaDaEdicao(rascunho, instituicao.ativo),
                    ),
                  () => definirEmEdicao(null),
                )
              }
              aoAlternarAtiva={() =>
                void executar(
                  // A FICHA COMO ESTÁ, só com `ativo` invertido — pelo mesmo
                  // montador do Salvar, para os dois PUTs nunca divergirem.
                  () =>
                    editarInstituicao(
                      instituicao.id,
                      entradaDaEdicao(rascunhoDe(instituicao), !instituicao.ativo),
                    ),
                  () => undefined,
                  `${instituicao.nome} ${instituicao.ativo ? 'desativada' : 'reativada'}.`,
                )
              }
              aoAcrescentarPessoa={() =>
                void executar(
                  () =>
                    criarInterlocutor({
                      nome: pessoaNova.nome,
                      instituicao_id: instituicao.id,
                      email: pessoaNova.email || null,
                      cargo: pessoaNova.cargo || null,
                      area: pessoaNova.area || null,
                      redes_sociais: pessoaNova.redes_sociais,
                    }),
                  () => definirPessoaNova(SEM_PESSOA),
                )
              }
              pessoaEmEdicao={pessoaEmEdicao}
              rascunhoDaPessoa={rascunhoDaPessoa}
              aoRascunharEdicaoDaPessoa={definirRascunhoDaPessoa}
              aoEditarPessoa={(pessoa) => {
                definirPessoaEmEdicao(pessoa.id);
                definirRascunhoDaPessoa({
                  nome: pessoa.nome,
                  email: pessoa.email ?? '',
                  cargo: pessoa.cargo ?? '',
                  area: pessoa.area ?? '',
                  redes_sociais: pessoa.redes_sociais,
                });
              }}
              aoCancelarPessoa={() => definirPessoaEmEdicao(null)}
              aoSalvarPessoa={(pessoa) =>
                void executar(
                  () =>
                    editarInterlocutor(pessoa.id, {
                      nome: rascunhoDaPessoa.nome,
                      instituicao_id: pessoa.instituicao_id,
                      email: rascunhoDaPessoa.email || null,
                      cargo: rascunhoDaPessoa.cargo || null,
                      area: rascunhoDaPessoa.area || null,
                      redes_sociais: rascunhoDaPessoa.redes_sociais,
                      tipo: pessoa.tipo,
                      ativo: pessoa.ativo,
                    }),
                  () => definirPessoaEmEdicao(null),
                )
              }
              aExcluir={aExcluir === instituicao.id}
              // A RECUSA APARECE NA LINHA. A faixa do topo continua existindo,
              // mas quem confirmou uma exclusão no fim de uma lista de cem
              // não a vê — e clica de novo, e de novo, achando que nada
              // aconteceu. O erro só é da linha enquanto a pergunta dela
              // estiver aberta; Cancelar a fecha e limpa.
              erroDaExclusao={aExcluir === instituicao.id ? erro : null}
              aoPedirExclusao={() => {
                definirErro(null);
                definirAExcluir(instituicao.id);
              }}
              aoDesistirDaExclusao={() => {
                definirErro(null);
                definirAExcluir(null);
              }}
              aoExcluir={() =>
                void executar(
                  // Confirmação em duas etapas, como na pessoa: o servidor
                  // recusa a que já esteve numa agenda, mas a que não esteve
                  // some na hora, com as pessoas dela, sem desfazer.
                  () => removerInstituicao(instituicao.id),
                  () => {
                    definirAExcluir(null);
                    if (aberta === instituicao.id) definirAberta(null);
                    if (emEdicao === instituicao.id) definirEmEdicao(null);
                  },
                  `${instituicao.nome} foi excluída.`,
                )
              }
              aRemover={aRemover}
              // A MESMA REGRA DA EXCLUSÃO DA INSTITUIÇÃO: a recusa do servidor
              // aparece na linha da pessoa, não só na faixa do topo.
              erroDaRemocao={aRemover ? erro : null}
              aoPedirRemocao={(pessoa) => {
                definirErro(null);
                definirARemover(pessoa.id);
              }}
              aoDesistirDaRemocao={() => {
                definirErro(null);
                definirARemover(null);
              }}
              aoRemoverPessoa={(pessoa) =>
                void executar(
                  // A CONFIRMACAO E DA TELA, e nao do servidor.
                  //
                  // O servidor recusa apagar quem ja esteve numa agenda — mas
                  // quem NAO esteve some para sempre, na hora, sem desfazer. Eu
                  // tinha dispensado a confirmacao com o argumento que vale
                  // para os materiais, onde nada vai ao banco antes de salvar;
                  // aqui a remocao e imediata e definitiva, e o argumento nao
                  // se aplica.
                  () => removerInterlocutor(pessoa.id),
                  () => {
                    definirARemover(null);
                    definirPessoaEmEdicao(null);
                  },
                  `${pessoa.nome} foi excluída.`,
                )
              }
              aoDesligarPessoa={(pessoa) =>
                void executar(
                  () =>
                    editarInterlocutor(pessoa.id, {
                      nome: pessoa.nome,
                      instituicao_id: pessoa.instituicao_id,
                      email: pessoa.email,
                      cargo: pessoa.cargo,
                      area: pessoa.area,
                      redes_sociais: pessoa.redes_sociais,
                      tipo: pessoa.tipo,
                      ativo: !pessoa.ativo,
                    }),
                  () => undefined,
                )
              }
            />
          ))}

          <Paginacao
            pagina={paginaAtual}
            totalDePaginas={totalDePaginas}
            aoMudarPagina={definirPagina}
          />
        </Cartao>
      </Secao>
    </div>
  );
}

function LinhaDeInstituicao({
  instituicao,
  pessoas,
  ufs,
  relevancias,
  categoriasPublico,
  subcategoriasPublico,
  pessoasDoCrm,
  emEdicao,
  aberta,
  salvando,
  rascunho,
  pessoaNova,
  aoRascunhar,
  aoRascunharPessoa,
  aoAbrir,
  aoEditar,
  aoCancelar,
  aoSalvar,
  aoAcrescentarPessoa,
  pessoaEmEdicao,
  rascunhoDaPessoa,
  aoRascunharEdicaoDaPessoa,
  aoEditarPessoa,
  aoCancelarPessoa,
  aoSalvarPessoa,
  aoAlternarAtiva,
  aExcluir,
  erroDaExclusao,
  aoPedirExclusao,
  aoDesistirDaExclusao,
  aoExcluir,
  aRemover,
  erroDaRemocao,
  aoPedirRemocao,
  aoDesistirDaRemocao,
  aoRemoverPessoa,
  aoDesligarPessoa,
}: {
  instituicao: Instituicao;
  pessoas: Interlocutor[];
  ufs: { codigo: string; nome: string }[];
  relevancias: { id: number; nome: string }[];
  categoriasPublico: CategoriaPublicoDoDicionario[];
  subcategoriasPublico: SubcategoriaPublicoDoDicionario[];
  /** As pessoas do CRM, para o seletor "de quem é este perfil". */
  pessoasDoCrm: Interlocutor[];
  emEdicao: boolean;
  aberta: boolean;
  salvando: boolean;
  rascunho: RascunhoDaInstituicao;
  pessoaNova: RascunhoDePessoa;
  aoRascunhar: (r: RascunhoDaInstituicao) => void;
  aoRascunharPessoa: (p: RascunhoDePessoa) => void;
  aoAbrir: () => void;
  aoEditar: () => void;
  aoCancelar: () => void;
  aoSalvar: () => void;
  aoAcrescentarPessoa: () => void;
  pessoaEmEdicao: string | null;
  rascunhoDaPessoa: RascunhoDePessoa;
  aoRascunharEdicaoDaPessoa: (p: RascunhoDePessoa) => void;
  aoEditarPessoa: (pessoa: Interlocutor) => void;
  aoCancelarPessoa: () => void;
  aoSalvarPessoa: (pessoa: Interlocutor) => void;
  aoAlternarAtiva: () => void;
  aExcluir: boolean;
  erroDaExclusao: string | null;
  aoPedirExclusao: () => void;
  aoDesistirDaExclusao: () => void;
  aoExcluir: () => void;
  aRemover: string | null;
  erroDaRemocao: string | null;
  aoPedirRemocao: (pessoa: Interlocutor) => void;
  aoDesistirDaRemocao: () => void;
  aoRemoverPessoa: (pessoa: Interlocutor) => void;
  aoDesligarPessoa: (pessoa: Interlocutor) => void;
}) {
  const rotuloDoTipo = ROTULO_DO_TIPO[instituicao.tipo] ?? instituicao.tipo;
  const categoriaDoRascunho = categoriasPublico.find(
    (c) => c.id === Number(rascunho.categoria_publico_id),
  );

  return (
    <div
      style={{
        marginTop: 14,
        paddingTop: 14,
        borderTop: '1px solid var(--borda)',
      }}
    >
      {emEdicao ? (
        <div className="grade grade--3" style={{ gap: 16 }}>
          <Campo rotulo="Nome curto">
            <input
              style={estiloDeEntrada}
              value={rascunho.nome}
              onChange={(e) => aoRascunhar({ ...rascunho, nome: e.target.value })}
            />
          </Campo>
          <Campo rotulo="Nome completo">
            <input
              style={estiloDeEntrada}
              value={rascunho.nome_completo}
              onChange={(e) =>
                aoRascunhar({ ...rascunho, nome_completo: e.target.value })
              }
            />
          </Campo>
          <Campo rotulo="Tipo">
            <select
              style={estiloDeEntrada}
              value={rascunho.tipo}
              onChange={(e) =>
                aoRascunhar({
                  ...rascunho,
                  tipo: e.target.value,
                  //: TROCAR O TIPO LIMPA OS CAMPOS DE PERFIL. Sem isto, mudar
                  //: de "Perfil de rede" para "Veículo" escondia Cargo e
                  //: Pessoa da tela mas CONTINUAVA mandando os valores — e o
                  //: back recusava com "só perfil de rede tem cargo", um erro
                  //: sobre um campo que a pessoa não vê mais. Achado de
                  //: revisão.
                  ...(e.target.value === 'perfil_rede' ? {} : { cargo: '', pessoa: '' }),
                })
              }
            >
              {TIPOS.map(({ tipo, rotulo }) => (
                <option key={tipo} value={tipo}>
                  {rotulo}
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Relevância">
            <select
              style={estiloDeEntrada}
              value={rascunho.tier}
              onChange={(e) => aoRascunhar({ ...rascunho, tier: e.target.value })}
            >
              {/* SEM ASTERISCO AQUI, e com asterisco no cadastro. As
                  instituições anteriores à coluna não têm tier, e exigi-lo na
                  edição trancaria a correção de um nome atrás de uma
                  classificação que ninguém pediu naquele momento. */}
              <option value="">Não informada</option>
              {relevancias.map((nivel) => (
                <option key={nivel.id} value={nivel.id}>
                  {nivel.nome}
                </option>
              ))}
            </select>
          </Campo>
          {/* SÓ EM PERFIL DE REDE: um jornal não tem cargo nem "é de"
              alguém, e o backend recusa os dois nos outros tipos. */}
          {rascunho.tipo === 'perfil_rede' ? (
            <>
              <Campo
                rotulo="Cargo"
                dica="Como o fornecedor informou — e corrigível, porque ele erra."
              >
                <input
                  style={estiloDeEntrada}
                  value={rascunho.cargo}
                  placeholder="Deputado estadual"
                  onChange={(e) => aoRascunhar({ ...rascunho, cargo: e.target.value })}
                />
              </Campo>
              <Campo
                rotulo="Pessoa"
                dica="De quem é este perfil. É o que junta os vários perfis de uma mesma pessoa, e liga o que ela postou ao que ela fez nas agendas."
              >
                <select
                  style={estiloDeEntrada}
                  value={rascunho.pessoa}
                  onChange={(e) => aoRascunhar({ ...rascunho, pessoa: e.target.value })}
                >
                  <option value="">Ninguém ainda</option>
                  {pessoasDoCrm.map((pessoa) => (
                    <option key={pessoa.id} value={pessoa.id}>
                      {pessoa.cargo ? `${pessoa.nome} — ${pessoa.cargo}` : pessoa.nome}
                    </option>
                  ))}
                </select>
              </Campo>
            </>
          ) : null}

          <Campo rotulo="Abrangência">
            <select
              style={estiloDeEntrada}
              value={rascunho.uf}
              onChange={(e) => aoRascunhar({ ...rascunho, uf: e.target.value })}
            >
              <option value="">Não informada</option>
              {ufs.map((uf) => (
                <option key={uf.codigo} value={uf.codigo}>
                  {uf.nome}
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Categoria de público">
            <select
              style={estiloDeEntrada}
              value={rascunho.categoria_publico_id}
              onChange={(e) =>
                aoRascunhar({
                  ...rascunho,
                  categoria_publico_id: e.target.value,
                  subcategoria_publico_id: '',
                })
              }
            >
              {/* SEM ASTERISCO, mesmo motivo da Relevância: as ~99
                  instituições anteriores a esta coluna não têm categoria, e
                  exigi-la aqui trancaria a correção de um nome atrás de uma
                  classificação que é trabalho do backfill, não deste campo. */}
              <option value="">Não informada</option>
              {categoriasPublico.map((categoria) => (
                <option key={categoria.id} value={categoria.id}>
                  {categoria.nome}
                </option>
              ))}
            </select>
          </Campo>
          {categoriaDoRascunho && categoriaDoRascunho.padrao_de_quebra !== 'sem_quebra' ? (
            <Campo rotulo="Esfera">
              <select
                style={estiloDeEntrada}
                value={rascunho.subcategoria_publico_id}
                onChange={(e) =>
                  aoRascunhar({ ...rascunho, subcategoria_publico_id: e.target.value })
                }
              >
                <option value="">Não informada</option>
                {subcategoriasPublico
                  .filter((s) => s.categoria_publico_id === categoriaDoRascunho.id)
                  .sort((a, b) => a.ordem - b.ordem)
                  .map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.nome}
                    </option>
                  ))}
              </select>
            </Campo>
          ) : null}
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: instituicao.ativo ? undefined : 'var(--cinza-2)',
                textDecoration: instituicao.ativo ? 'none' : 'line-through',
              }}
            >
              {instituicao.nome}
              {instituicao.nome_completo ? (
                <span style={{ fontWeight: 400, color: 'var(--cinza-3)' }}>
                  {' · '}
                  {instituicao.nome_completo}
                </span>
              ) : null}
            </p>
            <p style={{ fontSize: 12, color: 'var(--cinza-2)' }}>
              {instituicao.ativo
                ? null
                : 'desativada — ela e as pessoas dela saem do cadastro de agenda; o histórico e os filtros continuam · '}
              {rotuloDoTipo}
              {/* O CARGO ANTES DA PRAÇA: "Perfil de rede · Deputado estadual ·
                  RS" responde quem é o ator. Antes a linha mostrava o tipo e a
                  UF, e o cargo não aparecia em lugar nenhum — o dono do
                  produto viu a deputada Stela Farias como "Poder
                  Legislativo". */}
              {instituicao.cargo ? ` · ${instituicao.cargo}` : ''}
              {instituicao.uf ? ` · ${instituicao.uf}` : ''} ·{' '}
              {pessoas.length === 0
                ? 'ninguém cadastrado'
                : `${pessoas.length} ${pessoas.length === 1 ? 'pessoa' : 'pessoas'}`}
            </p>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {emEdicao ? (
          <>
            <Botao variante="primario" desabilitado={salvando} aoClicar={aoSalvar}>
              Salvar
            </Botao>
            {/* MESMA ALTURA do Salvar (40px) — sem o `estilo`, "Cancelar"
                herda os 36px do `secundario` padrão, e os dois lado a lado
                ficavam com tamanhos diferentes por pedido. */}
            <Botao estilo={{ height: 40 }} aoClicar={aoCancelar}>
              Cancelar
            </Botao>
          </>
        ) : (
          <>
            <Botao aoClicar={aoEditar}>Editar</Botao>
            <Botao variante="fantasma" aoClicar={aoAbrir}>
              {aberta ? 'Fechar' : 'Quem representa'}
            </Botao>
            {/* DESATIVAR É O CAMINHO PARA QUEM TEM HISTÓRICO: sai do formulário
                de agenda e do cadastro de pessoa, fica nas agendas que já
                existem e nesta lista. Excluir, logo ao lado, é para quem
                entrou por engano — e o servidor recusa se houver agenda. */}
            <Botao
              variante="fantasma"
              desabilitado={salvando}
              aoClicar={aoAlternarAtiva}
              rotuloAcessivel={`${instituicao.ativo ? 'Desativar' : 'Reativar'} ${instituicao.nome}`}
            >
              {instituicao.ativo ? 'Desativar' : 'Reativar'}
            </Botao>
            {/* DUAS ETAPAS NA PRÓPRIA LINHA, como na remoção de pessoa: um
                modal tiraria o contexto de QUAL instituição está saindo. O
                servidor recusa a que já esteve numa agenda — a mensagem dele
                aparece aqui na linha, com a contagem, e aponta Desativar. */}
            {aExcluir && erroDaExclusao ? (
              <>
                <span
                  role="alert"
                  style={{ fontSize: 12, color: 'var(--erro-fg)', alignSelf: 'center', maxWidth: 560 }}
                >
                  {erroDaExclusao}
                </span>
                <Botao variante="fantasma" aoClicar={aoDesistirDaExclusao}>
                  Entendi
                </Botao>
              </>
            ) : aExcluir ? (
              <>
                <span style={{ fontSize: 12, color: 'var(--erro-fg)', alignSelf: 'center' }}>
                  Excluir de vez, com as pessoas dela?
                </span>
                <Botao
                  variante="fantasma"
                  desabilitado={salvando}
                  aoClicar={aoExcluir}
                  rotuloAcessivel={`Confirmar a exclusão de ${instituicao.nome}`}
                  estilo={{ color: 'var(--erro-fg)', fontWeight: 700 }}
                >
                  Sim, excluir
                </Botao>
                <Botao variante="fantasma" aoClicar={aoDesistirDaExclusao}>
                  Cancelar
                </Botao>
              </>
            ) : (
              <Botao
                variante="fantasma"
                desabilitado={salvando}
                aoClicar={aoPedirExclusao}
                rotuloAcessivel={`Excluir ${instituicao.nome}`}
                estilo={{ color: 'var(--erro-fg)' }}
              >
                Excluir
              </Botao>
            )}
          </>
        )}
      </div>

      {aberta && !emEdicao ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            background: 'var(--bg-trilho)',
            borderRadius: 'var(--r-card-int)',
          }}
        >
          {/* QUEM APARECE EM "PELA OUTRA PARTE" desta instituição. É a razão de
              a lista existir: o formulário de agenda só oferece estas pessoas
              depois que a instituição é escolhida. */}
          {pessoas.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--cinza-3)', margin: '0 0 12px' }}>
              Ninguém cadastrado. Enquanto não houver, nenhuma agenda desta
              instituição consegue registrar quem participou pela outra parte.
            </p>
          ) : (
            pessoas.map((pessoa) =>
              pessoaEmEdicao === pessoa.id ? (
                <div
                  key={pessoa.id}
                  className="grade grade--3"
                  style={{ gap: 10, padding: '8px 0', alignItems: 'end' }}
                >
                  <Campo rotulo="Nome">
                    <input
                      style={estiloDeEntrada}
                      value={rascunhoDaPessoa.nome}
                      onChange={(e) =>
                        aoRascunharEdicaoDaPessoa({
                          ...rascunhoDaPessoa,
                          nome: e.target.value,
                        })
                      }
                    />
                  </Campo>
                  <Campo rotulo="E-mail">
                    <input
                      type="email"
                      style={estiloDeEntrada}
                      value={rascunhoDaPessoa.email}
                      onChange={(e) =>
                        aoRascunharEdicaoDaPessoa({
                          ...rascunhoDaPessoa,
                          email: e.target.value,
                        })
                      }
                    />
                  </Campo>
                  <Campo rotulo="Cargo">
                    <input
                      style={estiloDeEntrada}
                      value={rascunhoDaPessoa.cargo}
                      onChange={(e) =>
                        aoRascunharEdicaoDaPessoa({
                          ...rascunhoDaPessoa,
                          cargo: e.target.value,
                        })
                      }
                    />
                  </Campo>
                  <Campo rotulo="Área">
                    <input
                      style={estiloDeEntrada}
                      value={rascunhoDaPessoa.area}
                      onChange={(e) =>
                        aoRascunharEdicaoDaPessoa({
                          ...rascunhoDaPessoa,
                          area: e.target.value,
                        })
                      }
                    />
                  </Campo>
                  <div style={{ gridColumn: 'span 2' }}>
                    <CampoDeRedesSociais
                      valores={rascunhoDaPessoa.redes_sociais}
                      aoMudar={(novos) =>
                        aoRascunharEdicaoDaPessoa({ ...rascunhoDaPessoa, redes_sociais: novos })
                      }
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 8, gridColumn: '1 / -1' }}>
                    <Botao
                      variante="primario"
                      desabilitado={salvando}
                      aoClicar={() => aoSalvarPessoa(pessoa)}
                    >
                      Salvar
                    </Botao>
                    <Botao estilo={{ height: 40 }} aoClicar={aoCancelarPessoa}>
                      Cancelar
                    </Botao>
                  </div>
                </div>
              ) : (
                <div
                  key={pessoa.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 10,
                    padding: '5px 0',
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      flex: 1,
                      minWidth: 0,
                      color: pessoa.ativo ? 'var(--cinza-4)' : 'var(--cinza-2)',
                      textDecoration: pessoa.ativo ? 'none' : 'line-through',
                    }}
                  >
                    {pessoa.nome}
                    {pessoa.cargo ? ` · ${pessoa.cargo}` : ''}
                    {pessoa.area ? ` · ${pessoa.area}` : ''}
                    {/* O E-MAIL E O MOTIVO DE A PESSOA ESTAR AQUI: marcar
                        agenda comeca por escrever para alguem. Como link, para
                        nao exigir copiar e colar. */}
                    {pessoa.email ? (
                      <>
                        {' · '}
                        <a
                          href={`mailto:${pessoa.email}`}
                          style={{ color: 'var(--azul-mar)' }}
                        >
                          {pessoa.email}
                        </a>
                      </>
                    ) : (
                      <span style={{ color: 'var(--cinza-2)' }}> · sem e-mail</span>
                    )}
                    {/* AS REDES SOCIAIS, se tiver alguma — não viram <a>,
                        porque um handle como "@mariasouza" não é um
                        endereço clicável. */}
                    {pessoa.redes_sociais.map((valor, indice) => (
                      <span key={`${valor}-${indice}`} style={{ color: 'var(--cinza-2)' }}>
                        {' · '}
                        {valor}
                      </span>
                    ))}
                  </span>

                  <Botao
                    variante="fantasma"
                    desabilitado={salvando}
                    aoClicar={() => aoEditarPessoa(pessoa)}
                    rotuloAcessivel={`Editar ${pessoa.nome}`}
                  >
                    Editar
                  </Botao>

                  {/* DESLIGAR E REMOVER SAO GESTOS DIFERENTES, e a diferenca e
                      o historico. Desativar tira das listas e mantem o nome nas
                      agendas em que a pessoa esteve; excluir so vale para quem
                      entrou por engano — e o servidor recusa o resto, dizendo
                      quantas agendas dependem dela. */}
                  <Botao
                    variante="fantasma"
                    desabilitado={salvando}
                    aoClicar={() => aoDesligarPessoa(pessoa)}
                    rotuloAcessivel={`${pessoa.ativo ? 'Desativar' : 'Reativar'} ${pessoa.nome}`}
                  >
                    {pessoa.ativo ? 'Desativar' : 'Reativar'}
                  </Botao>

                  {/* DUAS ETAPAS NA PROPRIA LINHA. Um modal tiraria o
                      contexto de QUAL pessoa esta sendo removida, que e a
                      informacao que importa numa lista de dez. */}
                  {aRemover === pessoa.id && erroDaRemocao ? (
                    <>
                      <span
                        role="alert"
                        style={{ fontSize: 12, color: 'var(--erro-fg)', maxWidth: 520 }}
                      >
                        {erroDaRemocao}
                      </span>
                      <Botao variante="fantasma" aoClicar={aoDesistirDaRemocao}>
                        Entendi
                      </Botao>
                    </>
                  ) : aRemover === pessoa.id ? (
                    <>
                      <span style={{ fontSize: 12, color: 'var(--erro-fg)' }}>
                        Excluir de vez?
                      </span>
                      <Botao
                        variante="fantasma"
                        desabilitado={salvando}
                        aoClicar={() => aoRemoverPessoa(pessoa)}
                        rotuloAcessivel={`Confirmar a exclusão de ${pessoa.nome}`}
                        estilo={{ color: 'var(--erro-fg)', fontWeight: 700 }}
                      >
                        Sim, excluir
                      </Botao>
                      <Botao variante="fantasma" aoClicar={aoDesistirDaRemocao}>
                        Cancelar
                      </Botao>
                    </>
                  ) : (
                    <Botao
                      variante="fantasma"
                      desabilitado={salvando}
                      aoClicar={() => aoPedirRemocao(pessoa)}
                      rotuloAcessivel={`Excluir ${pessoa.nome}`}
                      estilo={{ color: 'var(--erro-fg)' }}
                    >
                      Excluir
                    </Botao>
                  )}
                </div>
              ),
            )
          )}

          <div
            className="grade grade--3"
            style={{ gap: 10, marginTop: 12, alignItems: 'end' }}
          >
            <Campo rotulo="Nome">
              <input
                style={estiloDeEntrada}
                value={pessoaNova.nome}
                onChange={(e) =>
                  aoRascunharPessoa({ ...pessoaNova, nome: e.target.value })
                }
                placeholder="Maria Souza"
              />
            </Campo>
            <Campo rotulo="E-mail">
              <input
                type="email"
                style={estiloDeEntrada}
                value={pessoaNova.email}
                onChange={(e) =>
                  aoRascunharPessoa({ ...pessoaNova, email: e.target.value })
                }
                placeholder="maria.souza@ana.gov.br"
              />
            </Campo>
            <Campo rotulo="Cargo">
              <input
                style={estiloDeEntrada}
                value={pessoaNova.cargo}
                onChange={(e) =>
                  aoRascunharPessoa({ ...pessoaNova, cargo: e.target.value })
                }
                placeholder="Secretária de Saneamento"
              />
            </Campo>
            <Campo rotulo="Área">
              <input
                style={estiloDeEntrada}
                value={pessoaNova.area}
                onChange={(e) =>
                  aoRascunharPessoa({ ...pessoaNova, area: e.target.value })
                }
                placeholder="Research"
              />
            </Campo>
            <div style={{ gridColumn: 'span 2' }}>
              <CampoDeRedesSociais
                valores={pessoaNova.redes_sociais}
                aoMudar={(novos) => aoRascunharPessoa({ ...pessoaNova, redes_sociais: novos })}
              />
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <Botao
              desabilitado={salvando || !pessoaNova.nome.trim()}
              aoClicar={aoAcrescentarPessoa}
            >
              Acrescentar pessoa
            </Botao>
          </div>
        </div>
      ) : null}
    </div>
  );
}
