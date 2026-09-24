/** Cadastro — o formulário único da agenda, na ordem em que ela acontece:
 *  o que é, em que pé está e o que se espera, quem participa, o que se leva e
 *  o que se traz, e só então o relato.
 *
 *  Os campos extras por frente NÃO estão mais na tela. Eles continuam no
 *  registro e são reenviados como vieram, para que salvar pela tela não apague
 *  o que a planilha trouxe.
 *
 *  A FRENTE TAMBÉM NÃO SE ESCOLHE MAIS AQUI. Quem se escolhe é o Formato da
 *  interação (seção 1) e a Instituição (seção 3); a frente sai daí sozinha —
 *  ver `frenteDerivada`, em `dominio/frentes.ts`, espelho da mesma regra que
 *  o backend aplica ao salvar (`app/casos_de_uso/derivar_frente.py`). A tela
 *  mostra o resultado como leitura, ao lado do campo "Público", mas quem
 *  decide de fato é sempre o backend: o corpo enviado não leva mais `frente`.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  criarInteracao,
  editarInteracao,
  listarInteracoes,
  obterInteracao,
} from '@/api/cliente';
import { usePainel } from '@/estado/painel';
import {
  Botao,
  Campo,
  Carregando,
  Cartao,
  Chip,
  FaixaDeErro,
  Secao,
  estiloDeEntrada,
} from '@/componentes/basicos';
import {
  extensaoAoTrocarDeFrente,
  frenteDerivada,
  interlocutoresDaInstituicao,
} from '@/dominio/frentes';
import { dataCompleta, tituloDaAgenda } from '@/dominio/formato';
import { nomesDosTemas } from '@/dominio/derivacoes';
import { jaAconteceu } from '@/dominio/derivacoes';
import { Abas } from '@/componentes/Abas';
import { EscolherAgendas } from '@/componentes/EscolherAgendas';
import { urlDaVersao } from '@/api/cliente';
import type { Interacao, Referencia } from '@/dominio/tipos';
import {
  ABAS_DA_ETAPA,
  COLUNA_DA_ETAPA,
  MOMENTOS_DE_PREPARACAO,
  MOMENTOS_POS_REUNIAO,
  SITUACOES_OFERECIDAS,
  VAZIO,
  materiaisDe,
} from '@/paginas/cadastro/formulario';
import type { Etapa, Formulario } from '@/paginas/cadastro/formulario';
import { CampoDeDicionario, CampoDeTexto } from '@/paginas/cadastro/campos';
import { CODIGO_DA_CONSULTA } from '@/dominio/sinais';
import { CamposDaConsulta } from '@/paginas/cadastro/CamposDaConsulta';
import { CamposDaFrente } from '@/paginas/cadastro/CamposDaFrente';
import { CampoQueCompleta } from '@/componentes/CampoQueCompleta';
import { ListaDeMateriais } from '@/paginas/cadastro/ListaDeMateriais';
import { DepoisDaReuniao } from '@/paginas/cadastro/DepoisDaReuniao';
import { ListaDaAegea, ListaDeParticipantes } from '@/paginas/cadastro/participantes';

//: TÍTULO MAIOR NESTA TELA, de propósito — "Antes"/"Depois" são as únicas
//: onde alguém passa vários minutos preenchendo, e não só lendo; o padrão de
//: `Secao` (21px) continua valendo no resto do produto.
const ESTILO_DO_TITULO_DO_CADASTRO: CSSProperties = { fontSize: 24 };

//: O CHIP DE SEMPRE, só maior — "Tipo de registro" e "Área(s)" são escolhas
//: feitas uma vez por agenda, então merecem um alvo de clique maior que o
//: chip de 24px usado nos filtros da Base.
const ESTILO_DO_CHIP_MAIOR: CSSProperties = {
  height: 32,
  padding: '0 13px',
  fontSize: 12,
};

export function Cadastro({
  aoSalvar,
  id,
}: {
  aoSalvar: () => void;
  /** Quando vem, o formulário EDITA em vez de criar.
   *
   *  UM formulário para as duas coisas, e não dois. A agenda tem trinta e
   *  poucos campos, quatro blocos condicionais por frente e duas listas; em
   *  duas telas, elas divergiriam — um campo novo entraria numa e não na
   *  outra, e ninguém notaria até alguém perder o que digitou.
   */
  id?: string;
}) {
  const { catalogo, recarregar } = usePainel();
  const [form, definirForm] = useState<Formulario>(VAZIO);
  const [carregando, definirCarregando] = useState(Boolean(id));
  //: As agendas que podem ter dado origem a esta. Carregadas uma vez.
  const [agendas, definirAgendas] = useState<Interacao[]>([]);
  //: Por que a lista de origens não veio. Nulo = veio.
  const [falhaDasOrigens, definirFalhaDasOrigens] = useState<string | null>(null);
  //: O seletor de origens está aberto?
  const [escolhendoOrigens, definirEscolhendoOrigens] = useState(false);
  const [etapa, definirEtapa] = useState<Etapa>('antes');

  //: A biblioteca inteira, carregada uma vez. E pequena — dezenas de linhas —
  //: e consultada a cada assunto marcado; buscar por assunto no servidor seria
  //: uma ida por clique, num gesto que a pessoa repete cinco vezes seguidas.
  // DO CATÁLOGO, e não de uma busca ao montar: é o que faz uma referência
  // cadastrada na Administração aparecer aqui sem F5. SÓ AS ATIVAS — a lista
  // traz as desativadas para a Administração poder reativá-las, e trazer uma
  // delas para uma agenda nova seria pôr em circulação o que alguém tirou.
  const referencias = useMemo<Referencia[]>(
    () => (catalogo?.referencias ?? []).filter((r) => r.ativo),
    [catalogo],
  );
  //: As referencias que a pessoa REMOVEU a mao nesta sessao.
  //:
  //: Sem isto, remover uma linha da biblioteca e mexer em qualquer outro
  //: assunto a traria de volta — a tela desfazendo, sozinha, o que a pessoa
  //: acabou de fazer. E o tipo de "ajuda" que faz desistir do formulario.
  const [dispensadas, definirDispensadas] = useState<Set<string>>(new Set());
  //: O formulário como veio do servidor. É o alvo de "Desfazer alterações".
  const [carregado, definirCarregado] = useState<Formulario | null>(null);
  const [enviando, definirEnviando] = useState(false);
  const [erro, definirErro] = useState<string | null>(null);
  const [sucesso, definirSucesso] = useState(false);
  //: A faixa de erro/sucesso, para levar o foco até ela depois de salvar.
  const aviso = useRef<HTMLDivElement>(null);
  //: Conta as tentativas de salvar, e só isso. Sem ela, apertar salvar duas
  //: vezes com o MESMO impedimento não mexeria a tela na segunda — a mensagem
  //: seria idêntica, o efeito não rodaria, e voltaria o "cliquei e não
  //: aconteceu nada" que este aviso existe para acabar.
  const [tentativa, definirTentativa] = useState(0);

  /** As agendas que podem ser origem DESTA: as que JÁ ACONTECERAM.
   *
   *  Uma agenda não decorre de uma reunião que ainda não houve. Um pedido
   *  aceito e não realizado não produziu desdobramento nenhum — oferecê-lo
   *  como origem deixaria montar uma cadeia com um elo que não existe.
   *
   *  "Já aconteceu" vem do RELATO, e não da situação: com três situações —
   *  Solicitado, Aceito, Negado — nenhuma delas diz se a reunião houve. Ver
   *  `jaAconteceu`.
   *
   *  Também ficam de fora: ela mesma — o banco barra o laço, mas oferecer a
   *  opção e recusar depois é convite para um erro que a tela podia ter
   *  evitado — e as POSTERIORES à data desta.
   *
   *  O ciclo LONGO (A→B→A) continua sendo barrado no repositório, que sobe o
   *  grafo inteiro — coisa que a tela não tem como saber.
   */
  const candidatasAOrigem = useMemo(() => {
    const quando = form.data_interacao;
    return agendas
      .filter((agenda) => agenda.id !== id)
      .filter((agenda) => !quando || agenda.data_interacao <= quando)
      .filter(jaAconteceu);
  }, [agendas, form.data_interacao, id]);

  // ANTES DO `return` CONDICIONAL, e nao depois.
  //
  // Hook chamado abaixo de um `return` só roda em alguns renders, e o React
  // passa a casar o estado errado entre eles — o `oxlint` acusa
  // `rules-of-hooks`. Eu tinha posto junto de `enviar`, que fica depois do
  // `if (!catalogo)`.
  useEffect(function carregarAgendasParaOrigem() {
    let vivo = true;
    // A lista serve só para escolher a agenda de origem, então não precisa ser
    // completa nem recente: `limite` alto e uma consulta só. Buscar sob demanda
    // exigiria um campo de busca, e o volume aqui não justifica.
    // Recorte VAZIO: a origem pode ser qualquer agenda, de qualquer frente —
    // um desdobramento cruza fronteiras por natureza (a conversa com o orgao
    // nasce da materia na imprensa). `tamanho` e o maximo que o backend aceita.
    // `-data_interacao`, e NÃO `data_desc`: a API só entende o nome do campo
    // com `-` na frente para descendente, e responde 422 a qualquer outra
    // forma. Errar aqui esvazia a lista de origens para todo mundo, e o campo
    // "Veio de outras agendas?" fica só com o placeholder.
    listarInteracoes({}, { tamanho: 200, ordenacao: '-data_interacao' })
      .then((pagina) => vivo && definirAgendas(pagina.itens ?? []))
      .catch((falha: Error) => {
        // A FALHA NÃO É SILENCIOSA. O resto do formulário continua
        // utilizável, mas quem procurar a lista precisa saber por que ela não
        // veio.
        if (vivo) definirFalhaDasOrigens(falha.message);
      });
    return () => {
      vivo = false;
    };
  }, []);

  // Leva o desfecho do salvar até quem apertou o botão. Só depois da renderização
  // da faixa — antes dela existir no DOM não há para onde ir.
  useEffect(
    function mostrarODesfecho() {
      // SÓ DESFECHO DE SALVAR. O erro de CARREGAMENTO da edição também chega
      // em `erro`, e ali não há gesto de ninguém para responder — a tela já
      // abre mostrando a falha, no topo, com a página no topo. Hoje ele não
      // rolava por acidente de ordem (`carregando` ainda true, `ref` nulo);
      // depender disso é depender de coincidência.
      if (tentativa === 0) return;
      if (!erro && !sucesso) return;
      const alvo = aviso.current;
      if (!alvo) return;
      // Quem pediu menos movimento recebe o salto direto, não a rolagem.
      const suave = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      alvo.scrollIntoView({ behavior: suave ? 'smooth' : 'auto', block: 'center' });
      // Só o erro rouba o foco: ele interrompe a tarefa e a pessoa precisa
      // voltar para corrigir. O sucesso não interrompe nada.
      if (erro) alvo.focus({ preventScroll: true });
    },
    [erro, sucesso, tentativa],
  );

  useEffect(
    function carregarParaEditar() {
      // O alvo de "Desfazer alterações" pertence a UMA agenda. Sem zerar aqui,
      // ao trocar de /cadastro/A para /cadastro/B ele continuava sendo o A
      // durante o carregamento — e desfazer teria trazido o conteúdo de A para
      // dentro do registro B. Zerar também ao sair para "Nova agenda" evita que
      // o estado de uma edição sobreviva à criação seguinte.
      definirCarregado(null);
      if (!id) return;
      let vivo = true;
      definirCarregando(true);
      obterInteracao(id)
        .then((interacao) => {
          if (!vivo) return;
          const carregado = paraFormulario(interacao);
          definirForm(carregado);
          definirCarregado(carregado);
        })
        .catch((falha: Error) => vivo && definirErro(falha.message))
        .finally(() => vivo && definirCarregando(false));
      return () => {
        vivo = false;
      };
    },
    [id],
  );

  if (!catalogo) return <Carregando />;

  //: A INSTITUIÇÃO ESCOLHIDA, e o que dela se deriva — sem instituição, nada
  //: disso existe ainda. `frenteDerivada` é a MESMA regra do backend
  //: (`derivar_frente`), espelhada aqui só para a tela se orientar antes de
  //: salvar; quem decide de fato, ao gravar, é sempre o servidor.
  const instituicaoSelecionada = form.instituicao_id
    ? catalogo.instituicoes.get(form.instituicao_id)
    : undefined;
  const formatoSelecionado = form.formato_interacao_id
    ? catalogo.dicionarios.formatos_interacao.find(
        (formato) => String(formato.id) === form.formato_interacao_id,
      )
    : undefined;
  const frenteAtual = frenteDerivada(instituicaoSelecionada, formatoSelecionado?.codigo);
  //: O bloco da consulta aparece (e viaja) pelo TIPO escolhido, e nunca pela
  //: frente: uma consulta de banco é `bancos_credores`, a mesma frente de uma
  //: reunião com banco.
  const ehConsulta = formatoSelecionado?.codigo === CODIGO_DA_CONSULTA;
  const categoriaPublicoDaInstituicao = instituicaoSelecionada?.categoria_publico_id
    ? catalogo.dicionarios.categorias_publico.find(
        (categoria) => categoria.id === instituicaoSelecionada.categoria_publico_id,
      )
    : undefined;
  //: A SUBCATEGORIA SÓ EXISTE PARA QUEM TEM SUBDIVISÃO DE VERDADE — nula
  //: sempre que a categoria for `sem_quebra` (ver `0036_categoria_de_
  //: publico.sql`). Mesma leitura, mesmo lugar: o campo "Público" mostra as
  //: duas juntas quando a subcategoria existir.
  const subcategoriaPublicoDaInstituicao = instituicaoSelecionada?.subcategoria_publico_id
    ? catalogo.dicionarios.subcategorias_publico.find(
        (subcategoria) => subcategoria.id === instituicaoSelecionada.subcategoria_publico_id,
      )
    : undefined;

  //: O campo muda de nome no Legislativo, e a mensagem da lista de
  //: participantes fala DELE. Duas escritas do mesmo rotulo divergiriam — e ja
  //: divergiram: a lista pedia um nome e o campo mostrava outro. Uma escrita
  //: so, aqui, e as duas telas mudam juntas quando a palavra muda.
  //:
  //: ANTES DE ESCOLHER, o rótulo fica genérico — não há como saber ainda se é
  //: uma proposição ou uma instituição comum, e a maioria dos casos é a
  //: segunda.
  const rotuloDaInstituicao =
    instituicaoSelecionada?.tipo === 'proposicao' ? 'Proposição' : 'Instituição';

  /** A relevância NÃO SE DIGITA AQUI: ela é da instituição.
   *
   *  Perguntada aqui, ela se repetiria a cada reunião com a mesma instituição,
   *  respondida conforme o dia — e a mesma instituição terminaria classificada
   *  de formas diferentes em agendas diferentes.
   *
   *  A resposta mora num lugar só, o cadastro da instituição, e esta tela a
   *  MOSTRA. Quem discorda muda lá, e a mudança vale para todas.
   *
   *  É gravada em `interacao.tier`: as métricas, os filtros e a
   *  exportação leem dali, e fazer cada uma delas cruzar com a instituição
   *  seria pagar um `join` para não guardar um número.
   */
  const tierDaInstituicao = instituicaoSelecionada?.tier ?? null;

  const alterar = <C extends keyof Formulario>(campo: C, valor: Formulario[C]) => {
    definirForm((atual) => ({ ...atual, [campo]: valor }));
    definirSucesso(false);
  };

  /** Trocar a data tira as origens que ficaram posteriores.
   *
   *  O seletor só oferece agendas anteriores, mas a escolha é feita ANTES de a
   *  data mudar. Quem marcasse uma origem de agosto e depois corrigisse a data
   *  desta agenda para julho salvaria uma cadeia que anda para trás — e o banco
   *  não barra isso; quem barra é a leitura de quem monta o grafo.
   *
   *  AQUI, e não num efeito que observa a data: a poda é consequência direta
   *  deste gesto, e escrevê-la no gesto evita uma segunda renderização para
   *  corrigir o que a primeira acabou de gravar.
   *
   *  Some sozinha, e sem aviso: a ficha ao lado do campo desaparece, que é o
   *  sinal. Um alerta aqui pediria uma decisão sobre algo que a pessoa acabou
   *  de tornar impossível.
   */
  const trocarData = (quando: string) => {
    const posteriores = new Set(
      quando ? agendas.filter((a) => a.data_interacao > quando).map((a) => a.id) : [],
    );
    definirForm((atual) => ({
      ...atual,
      data_interacao: quando,
      origens: atual.origens.filter((o) => !posteriores.has(o)),
    }));
    definirSucesso(false);
  };

  /** Marcar um assunto traz as referencias dele; desmarcar leva de volta.
   *
   *  E O PONTO DA BIBLIOTECA. O acervo existia e o porta-voz
   *  entrava na reuniao sem ele — ou com a versao de marco. Aqui o material
   *  certo aparece pelo gesto que a pessoa ja fazia: escolher o assunto.
   *
   *  AQUI, E NAO NUM EFEITO que observa `form.temas`: a mudanca nos materiais
   *  e consequencia direta deste clique, e escreve-la no gesto evita uma
   *  segunda renderizacao para corrigir o que a primeira acabou de gravar.
   *
   *  O QUE A PESSOA ESCREVEU NAO E TOCADO: so saem as linhas com
   *  `referencia_id` cujo assunto deixou de estar marcado. Uma referencia que
   *  serve a dois assuntos marcados fica enquanto qualquer um deles ficar.
   */
  const alternarAssunto = (temaId: number) => {
    const marcado = form.temas.includes(temaId);
    const temas = marcado
      ? form.temas.filter((id) => id !== temaId)
      : [...form.temas, temaId];

    const doAssunto = new Set(
      referencias.filter((r) => temas.some((t) => r.temas.includes(t))).map((r) => r.id),
    );

    definirForm((atual) => {
      const preservados = atual.materiais.filter(
        (m) => !m.referencia_id || doAssunto.has(m.referencia_id),
      );
      const jaEstao = new Set(
        preservados.map((m) => m.referencia_id).filter(Boolean) as string[],
      );

      const novas = referencias
        .filter(
          (r) => doAssunto.has(r.id) && !jaEstao.has(r.id) && !dispensadas.has(r.id),
        )
        .map((r) => ({
          momento: 'apoio',
          titulo: r.titulo,
          // O LINK DA VERSAO ATUAL, e nao "da referencia".
          //
          // Uma versao nova depois desta agenda NAO muda este endereco, e e o
          // certo: o material registra o que circulou naquela reuniao. Quem
          // quiser a versao de hoje abre a biblioteca.
          url: r.versao ? urlDaVersao(r.id, r.versao.id) : '',
          // O RESUMO VEM JUNTO. E o que a biblioteca guarda para quem esta
          // decidindo se abre o arquivo, e chegar vazio aqui obrigaria a
          // pessoa a abrir a Administracao para ler o que ja estava escrito.
          observacao: r.resumo ?? '',
          arquivo_id: null,
          arquivo: null,
          referencia_id: r.id,
          // OS ASSUNTOS DA REFERENCIA, e nao os da agenda: e a biblioteca que
          // sabe do que aquele documento trata, e ela pode cobrir assunto que
          // esta reuniao nao trata.
          temas: [...r.temas],
        }));

      return { ...atual, temas, materiais: [...preservados, ...novas] };
    });
    definirSucesso(false);
  };

  /** Quais áreas internas participaram da agenda — sem os efeitos colaterais
   *  de `alternarAssunto` (que também busca material da biblioteca): área não
   *  liga a nenhum acervo, é só o vínculo. */
  const alternarArea = (areaId: number) => {
    definirForm((atual) => ({
      ...atual,
      areas: atual.areas.includes(areaId)
        ? atual.areas.filter((id) => id !== areaId)
        : [...atual.areas, areaId],
    }));
    definirSucesso(false);
  };

  // Trocar de instituição ou de formato pode trocar a frente DERIVADA —
  // Governo por Parceiros, por exemplo. Quando isso acontece, a extensão
  // guarda só o que a NOVA frente também carrega, e não some tudo:
  //
  // Zerar tudo seria perda de dado silenciosa: Governo, Parceiros e Eventos
  // compartilham a mesma extensão no backend, então `cargo_interlocutor`
  // sobrevive à troca.
  //
  // Guardar tudo do mesmo grupo também estaria errado, na outra direção:
  // `nome_evento` só faz sentido em Eventos, e sair para Governo o deixaria no
  // registro, invisível — a ficha não o mostra fora de Eventos.
  //
  // SÓ POda QUANDO A FRENTE REALMENTE MUDA (e é conhecida): trocar de
  // instituição para outra do MESMO tipo — ou digitar sem ainda ter
  // escolhido nada — não tem por que mexer no que já estava.
  const escolherInstituicao = (instituicaoId: string) => {
    const novaInstituicao = instituicaoId
      ? catalogo.instituicoes.get(instituicaoId)
      : undefined;
    const novaFrente = frenteDerivada(novaInstituicao, formatoSelecionado?.codigo);
    definirForm((atual) => ({
      ...atual,
      instituicao_id: instituicaoId,
      extensao:
        novaFrente && novaFrente !== frenteAtual
          ? extensaoAoTrocarDeFrente(atual.extensao, novaFrente)
          : atual.extensao,
    }));
    definirSucesso(false);
  };

  const escolherFormato = (formatoId: string) => {
    const novoFormato = formatoId
      ? catalogo.dicionarios.formatos_interacao.find((f) => String(f.id) === formatoId)
      : undefined;
    const novaFrente = frenteDerivada(instituicaoSelecionada, novoFormato?.codigo);
    definirForm((atual) => ({
      ...atual,
      formato_interacao_id: formatoId,
      extensao:
        novaFrente && novaFrente !== frenteAtual
          ? extensaoAoTrocarDeFrente(atual.extensao, novaFrente)
          : atual.extensao,
    }));
    definirSucesso(false);
  };

  const enviar = async () => {
    definirTentativa((n) => n + 1);
    // O QUE O SERVIDOR NÃO TEM COMO RECUSAR DE FORMA ÚTIL.
    //
    // Material pela metade seria descartado antes de sair da tela, e a pessoa
    // veria "registro salvo" com um material a menos — sem erro, sem pista.
    const impedimento = impedimentoNoFormulario(
      form,
      carregado,
      new Set(
        interlocutoresDaInstituicao(
          [...catalogo.interlocutores.values()],
          form.instituicao_id,
          [],
          instituicaoSelecionada?.ativo ?? true,
        ).map((p) => p.id),
      ),
    );
    if (impedimento) {
      definirErro(impedimento.mensagem);
      definirSucesso(false);
      // LEVA ATÉ O CAMPO. Sem isto, um material sem título na aba "Depois"
      // produzia um erro no topo e nenhuma linha à vista para corrigir — a
      // pessoa leria a mensagem olhando para a aba errada.
      definirEtapa(impedimento.etapa);
      return;
    }

    definirEnviando(true);
    definirErro(null);
    // O sucesso ANTERIOR sai junto. Sem isto, clicar salvar de novo depois de
    // um salvamento bem-sucedido rolava a tela até a faixa velha antes de a
    // requisição nova terminar — confirmação de um gesto que ainda não deu.
    definirSucesso(false);
    // A RELEVÂNCIA VEM DA INSTITUIÇÃO, e não do formulário. `form.tier` ainda
    // existe porque a edição o carrega do registro; o que vale na gravação é o
    // do cadastro, senão editar uma agenda antiga regravaria a classificação
    // que a tela nem mostra mais.
    const comATierDaInstituicao = {
      ...form,
      tier: tierDaInstituicao ? String(tierDaInstituicao) : '',
    };
    try {
      if (id) {
        // `PATCH` com o corpo INTEIRO, e não só o que mudou.
        //
        // O formulário carregou tudo e a pessoa editou o que quis; mandar o
        // conjunto é o que garante que remover um material ou desmarcar o
        // principal chegue como remoção. Mandar só a diferença exigiria a tela
        // saber o que veio do servidor, e ela passaria a ter duas verdades.
        await editarInteracao(id, montarCorpo(comATierDaInstituicao, true, ehConsulta));
      } else {
        await criarInteracao(montarCorpo(comATierDaInstituicao, false, ehConsulta));
        definirForm(VAZIO);
      }
      definirSucesso(true);
      recarregar();
      aoSalvar();
    } catch (falha) {
      definirErro((falha as Error).message);
    } finally {
      definirEnviando(false);
    }
  };

  if (carregando) return <Carregando rotulo="Carregando a interação…" />;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        {/* O TITULO ACOMPANHA A ACAO. Dizia "Novo registro" tambem na
            edicao: a pessoa abria uma interacao para alterar e a tela afirmava
            que ela estava criando outra. E o nome bate com o botao da ficha
            que trouxe ate aqui — uma acao mantem o mesmo nome ao longo do
            caminho, senao a pessoa nao sabe se chegou onde queria. */}
        <h1 style={{ fontSize: 26 }}>{id ? 'Editar interação' : 'Cadastrar nova Interação'}</h1>
        <p style={{ fontSize: 13, color: 'var(--cinza-2)', marginTop: 4 }}>
          {/* CADA ABA TEM O SEU CONSELHO. "Escolha o formato" é a primeira
              coisa a fazer na aba de antes e não quer dizer nada na de
              depois, onde a interação já foi identificada faz tempo. */}
          {etapa === 'antes'
            ? 'Escolha o formato da interação antes de preencher o resto.'
            : 'O que ficou da reunião. Nada aqui é obrigatório para salvar.'}
        </p>
        {/* O PORQUÊ DO CADASTRO, uma vez só, no topo — e não repetido em cada
            seção. Quem preenche precisa saber que o valor do registro está na
            padronização: o mesmo campo, preenchido do mesmo jeito, em toda
            interação, é o que permite somar e comparar depois. */}
        {!id ? (
          <p style={{ fontSize: 12, color: 'var(--cinza-2)', marginTop: 6, maxWidth: 640 }}>
            Este cadastro padroniza como cada interação com stakeholders é
            registrada, para que o painel some e compare agendas de frentes e
            áreas diferentes da mesma forma.
          </p>
        ) : null}
      </div>

      {/* O DESFECHO DO SALVAR PRECISA ALCANÇAR QUEM APERTOU O BOTÃO.
          Estas faixas moram no topo e o botão fica depois de sete seções: quem
          rola até o fim, clica em salvar e cai numa validação não veria nada
          acontecer. `role="alert"` anuncia para leitor de tela; para quem
          enxerga, o aviso fica fora da tela. Por isso o foco vai até ele — que
          também é o começo do caminho de volta pelo teclado. */}
      {/* Sem `outline: none`. O foco chega aqui por programa, e o anel é
          exatamente o que mostra a quem usa teclado onde ele parou — apagá-lo
          devolveria, para essa pessoa, o mesmo "não aconteceu nada". */}
      <div ref={aviso} tabIndex={-1} style={{ borderRadius: 'var(--r-card-int)' }}>
        {erro ? <FaixaDeErro mensagem={erro} /> : null}
        {sucesso ? (
          <div
            style={{
              background: 'var(--ok-bg)',
              color: 'var(--ok-fg)',
              padding: '11px 14px',
              borderRadius: 'var(--r-card-int)',
              fontSize: 13,
            }}
          >
            {id
              ? 'Alterações salvas.'
              : 'Interação salva. O formulário está pronto para a próxima.'}
          </div>
        ) : null}
      </div>

      <Abas
        abas={ABAS_DA_ETAPA}
        ativa={etapa}
        aoTrocar={definirEtapa}
        rotulo="Etapas do registro da interação"
        prefixo="etapa"
      />

      <div
        role="tabpanel"
        id="painel-antes"
        aria-labelledby="etapa-antes"
        style={COLUNA_DA_ETAPA(etapa === 'antes')}
      >
      {/* A FRENTE SAIU DAQUI — quem se escolhe agora é o Formato, e só ele.
          A frente é DERIVADA da instituição (seção 3) e deste formato; a
          tela mostra o resultado como leitura, junto do campo "Público", em
          vez de perguntar de novo o que a instituição já responde. */}
      <Secao
        titulo="1. Tipo de interação"
        ajuda="Escolha o tipo antes de preencher o resto. Ele muda o formulário: uma consulta recebida abre um bloco próprio mais abaixo, e alguns campos adicionais dependem dele."
        estiloDoTitulo={ESTILO_DO_TITULO_DO_CADASTRO}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {catalogo.dicionarios.formatos_interacao.map((formato) => {
            const valor = String(formato.id);
            const ativo = form.formato_interacao_id === valor;
            return (
              <Chip
                key={formato.id}
                rotulo={formato.nome}
                ativo={ativo}
                fundo={ativo ? 'var(--turquesa-rio)' : 'var(--bg-trilho)'}
                texto={ativo ? 'var(--sobre-turquesa)' : 'var(--cinza-3)'}
                aoClicar={() => escolherFormato(ativo ? '' : valor)}
                estilo={ESTILO_DO_CHIP_MAIOR}
              />
            );
          })}
        </div>
      </Secao>

      <Secao titulo="2. Área(s)" estiloDoTitulo={ESTILO_DO_TITULO_DO_CADASTRO}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {catalogo.dicionarios.areas_pessoa.map((area) => {
            const ativo = form.areas.includes(area.id);
            return (
              <Chip
                key={area.id}
                rotulo={area.nome}
                ativo={ativo}
                fundo={ativo ? 'var(--turquesa-rio)' : 'var(--bg-trilho)'}
                texto={ativo ? 'var(--sobre-turquesa)' : 'var(--cinza-3)'}
                aoClicar={() => alternarArea(area.id)}
                estilo={ESTILO_DO_CHIP_MAIOR}
              />
            );
          })}
        </div>
      </Secao>

      <Secao titulo="3. Identificação" estiloDoTitulo={ESTILO_DO_TITULO_DO_CADASTRO}>
        <div className="grade grade--2" style={{ gap: 16 }}>
          <Campo rotulo="Data da interação" obrigatorio>
            <input
              type="date"
              style={estiloDeEntrada}
              value={form.data_interacao}
              onChange={(evento) => trocarData(evento.target.value)}
            />
          </Campo>

          {/* TODAS AS INSTITUIÇÕES CADASTRÁVEIS, sem filtro por frente — a
              frente não é mais escolhida antes, e sim DERIVADA de qual
              instituição esta é (ver `frenteDerivada`). A busca por nome
              resolve encontrar a certa entre todas. */}
          <CampoQueCompleta
            rotulo={rotuloDaInstituicao}
            obrigatorio
            valor={form.instituicao_id}
            aoEscolher={escolherInstituicao}
            opcoes={[...catalogo.instituicoes.values()]
              // SÓ AS ATIVAS — mais a que esta agenda já aponta, se estiver
              // desativada: editar uma agenda antiga não pode perder a
              // instituição dela do seletor.
              .filter((instituicao) => instituicao.ativo || instituicao.id === form.instituicao_id)
              .map((instituicao) => ({
              valor: instituicao.id,
              rotulo: instituicao.nome,
              // O NOME POR EXTENSO ENTRA NA BUSCA. Quem digita "agencia
              // nacional" precisa achar "ANA", e o rotulo sozinho nao casaria.
              detalhe: instituicao.nome_completo ?? undefined,
            }))}
          />

          {/* O PÚBLICO É LEITURA, e só existe depois de escolher a
              instituição — é dado direto dela, informativo, e nunca gravado
              na interação (ver `Instituicao.categoria_publico_id`). A frente
              não aparece mais aqui: continua sendo calculada por baixo (a
              tela não manda mais esse campo — quem decide é o backend, com
              `frenteDerivada`/`derivar_frente`), só deixou de ser mostrada
              nas telas. */}
          <Campo rotulo="Público" dica="Vem da classificação da instituição.">
            <div
              style={{
                ...estiloDeEntrada,
                display: 'flex',
                alignItems: 'center',
                background: 'var(--bg-trilho)',
                color: categoriaPublicoDaInstituicao ? 'var(--cinza-4)' : 'var(--cinza-2)',
              }}
            >
              {categoriaPublicoDaInstituicao
                ? subcategoriaPublicoDaInstituicao
                  ? `${categoriaPublicoDaInstituicao.nome} — ${subcategoriaPublicoDaInstituicao.nome}`
                  : categoriaPublicoDaInstituicao.nome
                : instituicaoSelecionada
                  ? 'Não classificada'
                  : '—'}
            </div>
          </Campo>

          {/* O CAMPO "INTERLOCUTOR" SAIU DAQUI.
              Ele mostrava UMA pessoa, e a agenda tem várias. Agora todas moram
              em "Quem participa", e quem representa a outra parte é a marcada
              como principal — que é exatamente o contrato do backend: a lista
              manda, a coluna é projeção dela.
              Mantê-lo aqui deixaria duas telas para o mesmo fato, capazes de
              discordar entre si. */}

          <CampoQueCompleta
            rotulo="UF da interação"
            obrigatorio
            dica="UF, NA (nacional) ou IN (internacional)."
            valor={form.uf}
            aoEscolher={(v) => alterar('uf', v)}
            opcoes={(catalogo?.dicionarios.ufs ?? []).map((a) => ({
              valor: a.codigo,
              rotulo: a.nome,
              // A SIGLA ENTRA NA BUSCA: quem digita "SP" nao quer procurar
              // "São Paulo" numa lista de 28.
              detalhe: a.codigo,
            }))}
          />

          <CampoQueCompleta
            rotulo="Unidade de negócio"
            ajuda="A operação da Aegea envolvida nesta agenda. Se for um assunto da holding, sem unidade específica, deixe em Holding / corporativo."
            vazio="Holding / corporativo"
            valor={form.unidade_negocio_id}
            aoEscolher={(v) => alterar('unidade_negocio_id', v)}
            opcoes={catalogo.dicionarios.unidades_negocio.map((u) => ({
              valor: String(u.id),
              rotulo: u.nome,
            }))}
          />

        </div>

        <div style={{ marginTop: 16 }}>
          {/* O TEMA NA IDENTIFICACAO, EM UM CAMPO SO.
              A PAUTA NÃO FICA AQUI, e sim em "Conteúdo": duas caixas pedindo
              a mesma coisa em precisões diferentes, lado a lado, convidam a
              escrever duas versões do tema — e a base passa a ter registros
              cujo título e cujos temas discordam.

              "TEMAS", e não "Assuntos" nem "Tags": a Administração usa esse
              nome desde que a aba de cadastro foi renomeada, e a leitura
              vale para toda a plataforma — um campo, um nome. */}
          <Campo
            rotulo="Temas"
            ajuda="Escolha um dos temas disponíveis que mais se encaixa com a interação. Se nenhum estiver de acordo, você pode criar um novo na Administração, na aba Temas."
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
              {catalogo.dicionarios.temas.map((tema) => {
                const ativo = form.temas.includes(tema.id);
                return (
                  <Chip
                    key={tema.id}
                    rotulo={tema.nome}
                    ativo={ativo}
                    fundo={ativo ? 'var(--turquesa-rio)' : 'var(--bg-trilho)'}
                    texto={ativo ? 'var(--sobre-turquesa)' : 'var(--cinza-3)'}
                    aoClicar={() => alternarAssunto(tema.id)}
                  />
                );
              })}
            </div>
          </Campo>
        </div>
      </Secao>

      {/* QUEM PARTICIPA, LOGO APÓS IDENTIFICAR A INSTITUIÇÃO — por pedido:
          depois de saber com quem se fala, faz mais sentido dizer quem senta
          na mesa do que onde a mesa fica. "Onde" e "Situação e expectativa"
          vêm depois, na mesma ordem de antes entre si.

          OS DOIS LADOS DA MESA, UM AO LADO DO OUTRO.
          A pergunta é uma só — quem senta nesta reunião — e responder cada
          metade num canto distante da tela faz a metade Aegea ser esquecida.

          O MESMO GESTO NOS DOIS LADOS: linha a linha, com presença nos dois.
          Gramáticas diferentes para a mesma pergunta deixariam um dos lados
          sem onde registrar quem faltou à reunião.

          O que difere é só a coluna do meio, porque as duas coisas são
          diferentes: aqui o PAPEL (fala pela companhia ou acompanha), lá qual
          pessoa REPRESENTA a instituição. Por isso são dois componentes, e não
          um com bandeirinha. */}
      <Secao titulo="4. Quem participou ou irá participar?" estiloDoTitulo={ESTILO_DO_TITULO_DO_CADASTRO}>
        {/* DOIS CARTÕES, e não dois blocos dentro de um. A borda entre eles é
            o que diz que são partes distintas da mesma mesa: num cartão só, as
            duas listas leriam como uma lista longa com dois títulos, e é
            exatamente a distinção que importa aqui. */}
        <div className="grade grade--mesa" style={{ gap: 16 }}>
          <Cartao>
            <p style={{ fontSize: 13, fontWeight: 700, margin: '0 0 4px' }}>
              Pela Aegea
            </p>
            <p style={{ fontSize: 12, color: 'var(--cinza-2)', margin: '0 0 14px' }}>
              Porta-voz conta no painel de exposição; equipe, não.
            </p>
            <ListaDaAegea
              participantes={form.aegea}
              pessoas={[...catalogo.pessoas.values()]}
              aoMudar={(aegea) => alterar('aegea', aegea)}
            />
          </Cartao>

          <Cartao>
            <p style={{ fontSize: 13, fontWeight: 700, margin: '0 0 4px' }}>
              Pela outra parte
            </p>
            <p style={{ fontSize: 12, color: 'var(--cinza-2)', margin: '0 0 14px' }}>
              Quem representa a instituição. Depois da reunião, marque quem
              compareceu.
            </p>
            {/* QUEM PODE REPRESENTAR ESTA INSTITUICAO, e nao as 55 pessoas da
                base. Escolher a instituicao ja disse com quem se conversa;
                oferecer o resto convida a registrar alguem do orgao errado, e
                esse erro nao tem como ser percebido depois — o nome fica la,
                plausivel.

                Sem instituicao escolhida a lista fica vazia de proposito: e a
                ordem em que se preenche. */}
            <ListaDeParticipantes
              participantes={form.outraParte}
              rotuloEsperado={rotuloDaInstituicao.toLowerCase()}
              interlocutores={interlocutoresDaInstituicao(
                [...catalogo.interlocutores.values()],
                form.instituicao_id,
                form.outraParte.map((p) => p.interlocutor_id),
                instituicaoSelecionada?.ativo ?? true,
              )}
              aoMudar={(outraParte) => alterar('outraParte', outraParte)}
            />
          </Cartao>
        </div>
      </Secao>

      {/* ONDE A AGENDA ACONTECE.
          Depois de "Quem participou": já se sabe com quem se fala e quem
          senta na mesa, falta dizer onde ela fica.

          A MODALIDADE E CAMPO PROPRIO, e nao deducao do endereco. Ela se agrega
          — "quantas foram presenciais neste trimestre?" — e o endereco nao;
          ler "Teams" e concluir online funcionaria ate alguem escrever "sala
          4". */}
      <Secao titulo="5. Onde será ou foi realizada?" estiloDoTitulo={ESTILO_DO_TITULO_DO_CADASTRO}>
        <Cartao>
          <div className="grade grade--3" style={{ gap: 16 }}>
            {/* "Nao informado" e o padrao. As 60 agendas da planilha nao
                responderam isto, e supor presencial inventaria historia.

                HIBRIDA EXISTE PORQUE ACONTECE: parte da mesa na sala e parte
                na chamada. Forcar a escolha entre os dois faria a base
                afirmar algo falso. */}
            <CampoQueCompleta
              rotulo="Modalidade"
              valor={form.modalidade}
              aoEscolher={(v) => alterar('modalidade', v)}
              opcoes={[
                { valor: 'presencial', rotulo: 'Presencial' },
                { valor: 'online', rotulo: 'Online' },
                { valor: 'hibrida', rotulo: 'Híbrida' },
              ]}
            />

            <div style={{ gridColumn: 'span 2' }}>
              <Campo
                rotulo="Local"
                dica={
                  form.modalidade === 'online'
                    ? 'O link da chamada, ou a plataforma.'
                    : 'Endereço e sala. Na híbrida, onde fica quem vai presencialmente.'
                }
              >
                <input
                  style={estiloDeEntrada}
                  value={form.local}
                  onChange={(evento) => alterar('local', evento.target.value)}
                  placeholder={
                    form.modalidade === 'online'
                      ? 'Teams'
                      : 'Ministério das Cidades, bloco A, 5º andar'
                  }
                />
              </Campo>
            </div>
          </div>
        </Cartao>
      </Secao>

      {/* O QUE SE SABE ANTES DE A AGENDA ACONTECER.
          Vem depois de "Quem participou" e "Onde": já se sabe com quem se
          fala, quem senta na mesa e onde ela fica — falta dizer em que pé
          está o convite, o quanto importa e o que se espera dele. O que
          houve fica em "Desfecho da interação"; o relato, em "Conteúdo" —
          ambos depois de "Materiais", que é o que se resolve entre marcar e
          realizar.

          Três comentários se acumularam aqui, de reorganizações sucessivas, e
          dois falavam de campos que já tinham saído desta seção. Comentário
          que descreve uma tela anterior é pior que comentário nenhum. */}
      <Secao titulo="6. Situação e expectativa" estiloDoTitulo={ESTILO_DO_TITULO_DO_CADASTRO}>
        <Cartao>

          <div className="grade grade--3" style={{ gap: 16 }}>
            <CampoQueCompleta
              rotulo="Iniciativa"
              ajuda="Quem pediu esta agenda: a Aegea ou a outra parte."
              vazio="Não informada"
              valor={form.iniciativa}
              aoEscolher={(v) => alterar('iniciativa', v)}
              opcoes={catalogo.dicionarios.iniciativas.map((i) => ({
                valor: i.codigo,
                rotulo: i.nome,
              }))}
            />

{/* TRÊS OPÇÕES, E SÓ TRÊS.
                Aqui só há três coisas a saber: o pedido foi feito, foi aceito,
                ou foi negado. O que a agenda VIROU depois é outra pergunta, e
                mora em "Desfecho da interação"; misturar as duas leituras no
                mesmo campo devolveria uma lista de onze opções.

                O status GRAVADO entra na lista mesmo fora das três. Sem isso,
                abrir uma agenda "Realizada" mostraria o campo em branco, e
                salvar qualquer outro campo trocaria a situação dela em
                silêncio — o mesmo defeito que a pauta já teve aqui. */}
            <CampoQueCompleta
              rotulo="Situação"
              ajuda="Aqui só há três estados: Solicitado (o pedido foi feito), Aceito ou Negado. O que aconteceu na reunião se registra na aba Depois."
              obrigatorio
              valor={form.status}
              aoEscolher={(v) => alterar('status', v)}
              opcoes={catalogo.dicionarios.status
                .filter(
                  (status) =>
                    SITUACOES_OFERECIDAS.includes(status.codigo) ||
                    status.codigo === form.status,
                )
                .map((status) => ({
                  valor: status.codigo,
                  rotulo: status.nome,
                  detalhe: SITUACOES_OFERECIDAS.includes(status.codigo)
                    ? undefined
                    : 'situação anterior',
                }))}
            />

            {/* A JUSTIFICATIVA FICA JUNTO DE QUEM A EXIGE.
                O motivo da recusa morava numa seção própria, três blocos
                abaixo: quem marcava "negado" no alto da tela tinha de descer
                para explicar, e a maioria não descia — 4 motivos em 23
                recusas. Aqui ele aparece no lugar onde a decisão foi tomada.

                Campos DIFERENTES para os dois casos, e não um só: "por que foi
                negado" e "em que termos foi aceito" são fatos distintos, e um
                campo compartilhado faria trocar de situação sobrescrever o
                texto do outro caso. */}
            {form.status === 'confirmada' ? (
              <CampoDeTexto
                rotulo="Nota sobre o aceite"
                valor={form.nota_situacao}
                aoMudar={(v) => alterar('nota_situacao', v)}
                dica="Em que termos. Ex.: “só para março”, “com o diretor”."
              />
            ) : null}

            {form.status === 'declinado' ? (
              <>
                <CampoQueCompleta
                  rotulo="Quem negou"
                  valor={form.declinado_por}
                  aoEscolher={(v) => alterar('declinado_por', v)}
                  opcoes={[
                    { valor: 'aegea', rotulo: 'A Aegea' },
                    { valor: 'outra_parte', rotulo: 'A outra parte' },
                  ]}
                />
                <CampoDeTexto
                  rotulo="Por que foi negado"
                  valor={form.motivo_declinio}
                  aoMudar={(v) => alterar('motivo_declinio', v)}
                />
              </>
            ) : null}

            <Campo
              rotulo="Relevância"
              ajuda="O quanto esta instituição importa para a Aegea. Não se escolhe aqui: é definida no cadastro da instituição e vale igual para todas as interações com ela. Para mudar, altere o cadastro dela."
              dica={
                form.instituicao_id
                  ? 'Vem do cadastro da instituição.'
                  : `Aparece depois de escolher ${rotuloDaInstituicao.toLowerCase()}.`
              }
            >
              {/* UM TEXTO, e não um campo desabilitado. Campo cinza convida a
                  clicar e não responde — a pessoa tenta, nada acontece, e ela
                  não descobre por quê. Isto aqui se parece com o que é: um
                  dado que a tela mostra. */}
              <div
                style={{
                  ...estiloDeEntrada,
                  display: 'flex',
                  alignItems: 'center',
                  background: 'var(--bg-trilho)',
                  color: tierDaInstituicao ? 'var(--cinza-4)' : 'var(--cinza-2)',
                }}
              >
                {tierDaInstituicao
                  ? (catalogo?.dicionarios.relevancias.find(
                      (nivel) => nivel.id === tierDaInstituicao,
                    )?.nome ?? `Tier ${tierDaInstituicao}`)
                  : form.instituicao_id
                    ? 'Não classificada'
                    : '—'}
              </div>
            </Campo>
          </div>

          {/* SÓ O QUE SE SABE ANTES DA AGENDA ACONTECER.
              Clima esperado é previsão; de onde a agenda veio é fato dado. O
              clima REAL, o resultado e o desdobramento saíram daqui para
              "Desfecho da interação" — quem abre o formulário para marcar uma
              reunião não tem como responder nenhum dos três.

              O par esperado × real, que motivou juntá-los aqui, continua
              inteiro na ficha, onde ele é LIDO. É lá que a comparação serve
              para alguma coisa; aqui ela só pedia um dado que ainda não
              existe. */}
          <div className="grade grade--2" style={{ gap: 16, marginTop: 16 }}>
            <CampoDeDicionario
              rotulo="Clima esperado"
              ajuda="Como você acha que a conversa vai ser, antes de ela acontecer. O clima real é registrado depois, na aba Depois."
              itens={catalogo.dicionarios.climas}
              valor={form.clima_esperado}
              aoMudar={(v) => alterar('clima_esperado', v)}
            />

            {/* DE QUAIS AGENDAS ESTA DECORRE — plural, e nao uma so.
                Com um pai so, o caso "a agencia e a bancada levaram juntas a
                esta reuniao" perderia uma das duas — e e esse caso que o grafo
                existe para mostrar. */}
            <Campo
              rotulo="Veio de outras interações?"
              ajuda="Use quando esta agenda é desdobramento de outra. Só aparecem interações que já aconteceram e que não são posteriores à data desta."
              dica="Dá para escolher mais de uma."
            >
              {/* O QUE JÁ ESTÁ ESCOLHIDO VEM PRIMEIRO, e depois como escolher
                  mais: o campo se lê de cima para baixo.
                  VAZIO NÃO DIZ NADA, de propósito: sem isto, o botão descia
                  uma linha só para "Clima esperado", ao lado, não ter — os
                  dois campos ficavam desalinhados na grade de duas colunas.
                  A pergunta do rótulo ("Veio de outras interações?") mais o
                  botão "Escolher na base…" já dizem que nada foi escolhido
                  ainda; a frase à parte só repetia isso, e num lugar que
                  empurrava o botão pra fora do alinhamento com a coluna ao
                  lado. */}
              {form.origens.length === 0 ? null : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {form.origens.map((origemId) => {
                    const agenda = agendas.find((a) => a.id === origemId);
                    return (
                      <Chip
                        key={origemId}
                        // A JA GRAVADA APARECE MESMO FORA DAS 200 carregadas.
                        // Sem isto, uma origem mais antiga que a janela sumiria
                        // do chip — e salvar a APAGARIA em silencio, sem
                        // ninguem ter pedido.
                        // A MESMA DATA DA LISTA, e sem o ✕ à mão: `ativo` já
                        // desenha o seu.
                        rotulo={
                          agenda
                            ? `${dataCompleta(agenda.data_interacao)} · ${tituloDaAgenda(agenda, (ids) => nomesDosTemas(catalogo, ids)).slice(0, 40)}`
                            : 'Interação anterior (fora das mais recentes)'
                        }
                        titulo="Remover esta origem"
                        ativo
                        fundo="var(--bg-trilho)"
                        texto="var(--cinza-3)"
                        aoClicar={() =>
                          alterar(
                            'origens',
                            form.origens.filter((o) => o !== origemId),
                          )
                        }
                      />
                    );
                  })}
                </div>
              )}

              {falhaDasOrigens ? (
                <p style={{ fontSize: 12, color: 'var(--erro-fg)' }}>
                  Não foi possível carregar as interações anteriores.
                </p>
              ) : (
                <Botao
                  aoClicar={() => definirEscolhendoOrigens(true)}
                  desabilitado={!candidatasAOrigem.length}
                >
                  {form.origens.length ? 'Trocar as origens…' : 'Escolher na base…'}
                </Botao>
              )}
            </Campo>
          </div>

          {/* A EXPECTATIVA FECHA A SEÇÃO porque ela depende de tudo que veio
              antes: quem pediu, em que pé está, o quanto importa, que clima se
              projeta, de onde a agenda veio. Escrever o que se espera antes de
              responder essas coisas é escrever no vazio. */}
          <div style={{ marginTop: 16 }}>
          <Campo rotulo="Expectativa">
            <textarea
              style={{ ...estiloDeEntrada, minHeight: 74, resize: 'vertical' }}
              value={form.expectativa}
              onChange={(evento) => alterar('expectativa', evento.target.value)}
              placeholder="O que precisa sair desta reunião para ela ter valido a pena."
            />
          </Campo>
          </div>
        </Cartao>
      </Secao>

      {/* MATERIAIS --------------------------------------------------------- */}
      {/* DUAS SECOES, e nao uma com seletor de momento.
          Quem preenche a agenda faz as duas coisas em dias diferentes: o que
          se leva se junta antes, o que se traz chega depois. Separadas, cada
          instante tem o seu lugar, e a lista de preparacao nao cresce com o
          que so vai existir depois da reuniao. */}
      <Secao titulo="7. Materiais de preparação" estiloDoTitulo={ESTILO_DO_TITULO_DO_CADASTRO}>
        <Cartao>
          <p style={{ fontSize: 13, color: 'var(--cinza-2)', margin: '0 0 16px' }}>
            Suba o arquivo, ou informe o link se ele já mora em outro lugar.
          </p>
          <ListaDeMateriais
            materiais={materiaisDe(form.materiais, MOMENTOS_DE_PREPARACAO)}
            momentos={MOMENTOS_DE_PREPARACAO}
            interacaoId={id}
            aoFalhar={definirErro}
            temasDaAgenda={form.temas}
            assuntos={catalogo.dicionarios.temas}
            aoDispensar={(referenciaId) =>
              definirDispensadas((atual) => new Set(atual).add(referenciaId))
            }
            aoMudar={(atualizar) =>
              definirForm((atual) => ({
                ...atual,
                materiais: [
                  ...atualizar(materiaisDe(atual.materiais, MOMENTOS_DE_PREPARACAO)),
                  ...materiaisDe(atual.materiais, MOMENTOS_POS_REUNIAO),
                ],
              }))
            }
          />
        </Cartao>
      </Secao>

      {/* OS CAMPOS ESPECÍFICOS DA FRENTE. Só existem depois que a frente é
          conhecida — e ela é derivada da instituição e do formato, então a
          seção aparece quando esses dois já foram escolhidos. `form.extensao`
          é o mesmo estado que `paraFormulario` carrega e `montarCorpo`
          devolve; ao trocar de frente, `extensaoAoTrocarDeFrente` descarta o
          que não se aplica mais. */}
      {/* O BLOCO DA CONSULTA vem antes dos detalhes da frente porque é o tipo
          que a pessoa acabou de escolher lá em cima — e porque, numa consulta,
          é aqui que está o conteúdo: o que perguntaram e o que a pergunta deu
          como fato. */}
      {ehConsulta ? (
        <Secao titulo="8. A consulta recebida" estiloDoTitulo={ESTILO_DO_TITULO_DO_CADASTRO}>
          <Cartao>
            <CamposDaConsulta
              canalId={form.canal_id}
              remetente={form.remetente}
              teor={form.teor}
              motivo={form.motivo}
              prazoResposta={form.prazo_resposta}
              respondidaEm={form.respondida_em}
              alegacoesMarcadas={form.alegacoes}
              alegacoes={catalogo.alegacoes}
              dicionarios={catalogo.dicionarios}
              aoMudar={(campo, valor) => alterar(campo as keyof Formulario, valor)}
              aoMarcarAlegacoes={(ids) => alterar('alegacoes', ids)}
              aoCadastrarAlegacao={() => recarregar()}
            />
          </Cartao>
        </Secao>
      ) : null}

      {frenteAtual ? (
        <Secao
          titulo={ehConsulta ? '9. Detalhes adicionais' : '8. Detalhes adicionais'}
          estiloDoTitulo={ESTILO_DO_TITULO_DO_CADASTRO}
        >
          <Cartao>
            <CamposDaFrente
              frente={frenteAtual}
              extensao={form.extensao}
              dicionarios={catalogo.dicionarios}
              aoMudar={(campo, valor) =>
                alterar('extensao', { ...form.extensao, [campo]: valor })
              }
            />
          </Cartao>
        </Secao>
      ) : null}

      </div>

      <div
        role="tabpanel"
        id="painel-depois"
        aria-labelledby="etapa-depois"
        style={COLUNA_DA_ETAPA(etapa === 'depois')}
      >
        <DepoisDaReuniao
          form={form}
          alterar={alterar}
          definirForm={definirForm}
          catalogo={catalogo}
          id={id}
          aoFalhar={definirErro}
        />
      </div>

      {/* O RODAPÉ FICA FORA DAS DUAS. Salvar salva o registro inteiro, venha de
          qual aba vier: esconder o botão numa delas faria parecer que cada aba
          guarda a sua metade. */}
      <Cartao estilo={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        {/* NA EDICAO, ESVAZIAR NAO E UMA ACAO QUE ALGUEM QUEIRA.
            Cair no `VAZIO` numa agenda existente apagaria a tela inteira, e
            salvar em seguida levaria o apagamento ao registro: campo vazio
            significa `null`, e nao "nao mexi". Editando, o gesto util e VOLTAR
            ao que estava. */}
        <Botao
          // Sem alvo carregado não há o que desfazer, e cair no `VAZIO` seria
          // justamente o apagamento que este botão existe para evitar.
          desabilitado={Boolean(id) && !carregado}
          aoClicar={() =>
            definirForm(id ? (carregado ?? VAZIO) : VAZIO)
          }
        >
          {id ? 'Desfazer alterações' : 'Limpar'}
        </Botao>
        <Botao
          variante="primario"
          aoClicar={enviar}
          desabilitado={
            enviando ||
            // SO O QUE IDENTIFICA A AGENDA.
            //
            // Nem `pauta` nem `status`: eles moram em secoes sobre o que ainda
            // nao aconteceu, e exigi-los obrigaria a descer a tela inteira so
            // para criar a agenda. Quem pede uma agenda de manha sabe com quem
            // e quando; nao sabe ainda o que vai sair dela.
            //
            // O resto vira EDICAO de um registro que ja existe — e e so depois
            // de existir que da para anexar arquivo, porque a pasta e dele.
            !form.data_interacao ||
            !form.instituicao_id ||
            !form.uf
          }
        >
          {enviando ? 'Salvando…' : id ? 'Salvar alterações' : 'Salvar interação'}
        </Botao>
      </Cartao>

      {/* O SELETOR DE ORIGENS. Fica fora da seção porque é um modal: montado
          dentro dela, herdaria o recorte de layout e brigaria com a rolagem. */}
      {escolhendoOrigens ? (
        <EscolherAgendas
          candidatas={candidatasAOrigem}
          escolhidas={form.origens}
          catalogo={catalogo}
          aoFechar={() => definirEscolhendoOrigens(false)}
          aoConfirmar={(ids) => {
            alterar('origens', ids);
            definirEscolhendoOrigens(false);
          }}
        />
      ) : null}
    </div>
  );
}

function ondeEstaOMaterial(
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
function impedimentoNoFormulario(
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


/** Converte o formulário no corpo que a API espera: campo vazio vira ausência,
 *  não string vazia — o backend distingue "não informado" de "limpo". */
function montarCorpo(form: Formulario, paraEdicao = false, ehConsulta = false) {
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
    esfera_id: numeroOpcional(form.esfera_id),
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

/** Os participantes da outra parte, com presença e um principal.
 *
 *  UMA LISTA, e não um campo de interlocutor mais uma lista de "demais".
 *  Todos moram na mesma tabela do backend, e é isso que dá ao principal — a
 *  pessoa mais importante da reunião — um lugar para ter presença.
 *
 *  A marca de principal é um `radio`, e não um `checkbox`: só um representa a
 *  outra parte, e o rádio diz isso pela forma. Com caixas de seleção alguém
 *  marcaria duas e só descobriria no erro do servidor.
 */
/** Quem da Aegea senta nesta agenda.
 *
 *  Espelha `ListaDeParticipantes` de propósito: acrescentar alguém é o mesmo
 *  gesto dos dois lados da mesa, e os dois lados registram presença. Duas
 *  gramáticas para a mesma pergunta deixariam uma das metades sem isso.
 *
 *  A coluna do meio é o que difere: aqui é o PAPEL (fala pela companhia ou
 *  acompanha), lá é qual pessoa REPRESENTA a instituição. Não são a mesma
 *  ideia, e por isso os dois lados não viraram um componente só.
 */
function paraFormulario(interacao: Interacao): Formulario {
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
