/** Cadastro — o formulário único da agenda, na ordem em que ela acontece:
 *  o que é, em que pé está e o que se espera, quem participa, o que se leva e
 *  o que se traz, e só então o relato.
 *
 *  Os campos extras por frente NÃO estão mais na tela. Eles continuam no
 *  registro e são reenviados como vieram, para que salvar pela tela não apague
 *  o que a planilha trouxe. Por isso a frente aqui classifica a agenda; ela
 *  não faz mais blocos aparecerem e sumirem.
 */

import { useEffect, useId, useRef, useState } from 'react';
import {
  criarInteracao,
  editarInteracao,
  listarInteracoes,
  obterInteracao,
  subirArquivoDeMaterial,
  urlDoArquivo,
} from '@/api/cliente';
import { usePainel } from '@/estado/painel';
import {
  Botao,
  Campo,
  Carregando,
  Cartao,
  Chip,
  ChipDeFrente,
  FaixaDeErro,
  Secao,
  estiloDeEntrada,
} from '@/componentes/basicos';
import {
  TIPO_DE_INSTITUICAO,
  extensaoAoTrocarDeFrente,
  instituicoesDaFrente,
  interlocutoresDaInstituicao,
} from '@/dominio/frentes';
import { hojeLocal, tituloDaAgenda } from '@/dominio/formato';
import { nomesDosTemas } from '@/dominio/derivacoes';
import { FRENTES } from '@/dominio/tipos';
import type { ArquivoDoMaterial, Frente, Interacao } from '@/dominio/tipos';

// As 27 UFs saíram daqui: vêm de `catalogo.dicionarios.ufs`, montado a
// partir do domínio `abrangencia` do Postgres — o mesmo que recusa uma UF
// inválida na escrita. O formulário passa a oferecer exatamente o que o
// banco aceita, nem mais nem menos.

/* O MAPA DE BLOCO POR FRENTE SAIU JUNTO com a seção que ele governava.
   Ele existia para escolher qual conjunto de campos condicionais mostrar; sem
   a seção, não resta escolha a fazer. `form.extensao` continua no estado e
   viaja nos dois sentidos — o dado não depende deste mapa. */

interface Formulario {
  frente: Frente;
  data_interacao: string;
  instituicao_id: string;
  interlocutor_id: string;
  unidade_negocio_id: string;
  esfera_id: string;
  uf: string;
  //: `presencial`, `online` ou `hibrida`. '' = nao informado, como nos demais.
  modalidade: string;
  //: Endereco, sala, ou o link da chamada. Texto livre.
  local: string;
  tier: string;
  status: string;
  clima: string;
  resultado: string;
  iniciativa: string;
  relato: string;
  encaminhamentos: string;
  pendencias: string;
  observacoes: string;
  temas: number[];
  aegea: ParticipanteAegeaNoForm[];
  extensao: Record<string, string>;

  // -- o ciclo da agenda ---------------------------------------------------
  //
  // O formulario deixou de descrever um fato consumado e passou a acompanhar
  // uma agenda: pedida, planejada, confirmada ou declinada, realizada, e
  // desdobrada em outra. Os campos abaixo sao a metade PREVISTA — e e a
  // distancia entre ela e o relato que mede se o que se promete acontece.
  expectativa: string;
  clima_esperado: string;
  declinado_por: string;
  motivo_declinio: string;
  origens: string[];
  //: Tres estados, e nao dois: '' e NAO INFORMADO, e some da tela como tal.
  //: Um `boolean` faria toda agenda antiga afirmar "nao preve desdobramento",
  //: que e uma decisao que ninguem tomou.
  preve_desdobramento: '' | 'sim' | 'nao';
  outraParte: ParticipanteNoForm[];
  materiais: MaterialNoForm[];
}

/** Alguem da Aegea nesta agenda.
 *
 *  Era `string[]`, so os ids dos porta-vozes. O backend guarda PAPEL e
 *  PRESENCA desde o comeco (`ParticipacaoAegea`), e a tela descartava os dois:
 *  mandava toda participacao como `porta_voz` sem presenca. Ninguem perdeu
 *  nada ainda — as 72 participacoes do banco sao todas assim — mas abrir os
 *  campos na tela sem consertar a ida-e-volta faria o recurso apagar a si
 *  mesmo no salvamento seguinte.
 */
interface ParticipanteAegeaNoForm {
  pessoa_aegea_id: string;
  //: 'porta_voz' fala pela companhia e conta no painel de exposicao; 'equipe'
  //: esteve na sala e nao conta. Sao papeis diferentes, nao graus.
  papel: string;
  //: '' = nao informado. Ver `PRESENCAS` — as mesmas dos dois lados.
  presenca: string;
}

/** Alguem da outra parte nesta agenda. */
interface ParticipanteNoForm {
  interlocutor_id: string;
  //: '' = nao informado. Ver `PRESENCAS`.
  presenca: string;
  principal: boolean;
}

/** Um documento da agenda. */
interface MaterialNoForm {
  //: Volta no PATCH para o backend NAO recriar o material — e o que preserva
  //: a identidade entre salvamentos. Material novo nao tem.
  id?: string;
  momento: string;
  titulo: string;
  url: string;
  observacao: string;
  //: O arquivo JA SUBIDO. O upload acontece antes de salvar a agenda, entao
  //: quando esta linha chega ao `PATCH` o byte ja esta no blob e so falta
  //: amarrar os dois.
  arquivo_id: string | null;
  //: Nome, tipo e tamanho, para a tela mostrar sem outra ida ao servidor.
  arquivo: ArquivoDoMaterial | null;
}

/** As tres presencas, com o rotulo que a pessoa le.
 *
 *  `ausente` e a mais valiosa das tres: uma reuniao em que o decisor nao
 *  apareceu nao e a reuniao que foi pedida, ainda que conste como realizada.
 */
const PRESENCAS: { valor: string; rotulo: string }[] = [
  { valor: '', rotulo: 'Nao informado' },
  { valor: 'previsto', rotulo: 'Previsto' },
  { valor: 'presente', rotulo: 'Compareceu' },
  { valor: 'ausente', rotulo: 'Faltou' },
];

/** Os dois papeis de quem representa a Aegea.
 *
 *  So `porta_voz` conta no painel de exposicao (`interacao.py:326`). Marcar
 *  alguem como `equipe` nao e rebaixa-lo: e dizer que ele esteve na sala sem
 *  falar pela companhia, que e informacao diferente e igualmente util.
 */
const PAPEIS: { valor: string; rotulo: string }[] = [
  { valor: 'porta_voz', rotulo: 'Porta-voz' },
  { valor: 'equipe', rotulo: 'Equipe' },
];

/** Os momentos do material, agora separados por SECAO da tela.
 *
 *  Eram uma lista so, com um seletor de momento em cada linha — e o seletor
 *  era a unica coisa dizendo se aquele documento veio antes ou depois da
 *  reuniao. Preencher a agenda em dois instantes diferentes obrigava a rolar
 *  ate a mesma lista e escolher o momento certo, sem nada por perto para
 *  lembrar qual era.
 *
 *  Sao os MESMOS tres valores do banco: a divisao e de tela, e nao inventa
 *  vocabulario nenhum.
 */
const MOMENTOS_DE_PREPARACAO: { valor: string; rotulo: string }[] = [
  { valor: 'apoio', rotulo: 'Apoio' },
];

const MOMENTOS_POS_REUNIAO: { valor: string; rotulo: string }[] = [
  { valor: 'obtido', rotulo: 'Obtido na reuniao' },
  { valor: 'produzido', rotulo: 'Produzido na reuniao' },
];


/** Os materiais de um conjunto de momentos, PRESERVANDO a ordem original.
 *
 *  Cada secao edita a sua fatia, e o salvamento remonta a lista inteira. Sem
 *  isto, salvar pela secao de preparacao mandaria uma lista sem os materiais
 *  pos-reuniao — e o repositorio, que remonta tudo, os apagaria.
 */
function materiaisDe(
  materiais: MaterialNoForm[],
  momentos: { valor: string }[],
): MaterialNoForm[] {
  const conjunto = new Set(momentos.map((m) => m.valor));
  return materiais.filter((m) => conjunto.has(m.momento));
}

const VAZIO: Formulario = {
  frente: 'imprensa',
  data_interacao: hojeLocal(),
  instituicao_id: '',
  interlocutor_id: '',
  unidade_negocio_id: '',
  esfera_id: '',
  uf: '',
  modalidade: '',
  local: '',
  tier: '',
  //: SOLICITADO, e nao vazio nem `agendado`. Uma agenda recem-criada foi
  //: PEDIDA; dizer "agendado" afirmaria que existe data marcada com a outra
  //: parte, coisa que ninguem confirmou — e a distancia entre pedir e conseguir
  //: marcar e metade do que este painel existe para medir.
  status: 'solicitado',
  clima: '',
  resultado: '',
  iniciativa: '',
  relato: '',
  encaminhamentos: '',
  pendencias: '',
  observacoes: '',
  temas: [],
  aegea: [],
  extensao: {},
  expectativa: '',
  clima_esperado: '',
  declinado_por: '',
  motivo_declinio: '',
  origens: [],
  preve_desdobramento: '',
  outraParte: [],
  materiais: [],
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
    listarInteracoes({}, { tamanho: 200, ordenacao: 'data_desc' })
      .then((pagina) => vivo && definirAgendas(pagina.itens ?? []))
      .catch(() => {
        // Silencioso de propósito: sem a lista, o campo de origem fica vazio e
        // o resto do formulário continua utilizável. Derrubar o cadastro
        // inteiro porque uma conveniência falhou seria pior.
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

  //: O campo muda de nome no Legislativo, e a mensagem da lista de
  //: participantes fala DELE. Duas escritas do mesmo rotulo divergiriam — e ja
  //: divergiam: a lista dizia "Escolha o veiculo / orgao" numa tela em que o
  //: campo se chama "Proposicao".
  const rotuloDaInstituicao =
    form.frente === 'legislativo' ? 'Proposição' : 'Veículo / órgão';

  const alterar = <C extends keyof Formulario>(campo: C, valor: Formulario[C]) => {
    definirForm((atual) => ({ ...atual, [campo]: valor }));
    definirSucesso(false);
  };

  // Trocar de frente guarda o que a NOVA frente também carrega, e só isso.
  //
  // Zerar tudo era perda de dado silenciosa: Governo, Parceiros e Eventos
  // compartilham a mesma extensão no backend, então `natureza_orgao` e
  // `cargo_interlocutor` sobreviveriam à troca — e, desde que a seção desses
  // campos saiu da tela, ninguém veria sumir nem conseguiria redigitar.
  //
  // Guardar tudo do mesmo grupo também estaria errado, na outra direção:
  // `nome_evento` só faz sentido em Eventos, e sair para Governo o deixaria no
  // registro, invisível — a ficha não o mostra fora de Eventos.
  const trocarFrente = (frente: Frente) => {
    definirForm((atual) => ({
      ...atual,
      frente,
      extensao: extensaoAoTrocarDeFrente(atual.extensao, frente),
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
        ).map((p) => p.id),
      ),
    );
    if (impedimento) {
      definirErro(impedimento);
      definirSucesso(false);
      return;
    }

    definirEnviando(true);
    definirErro(null);
    // O sucesso ANTERIOR sai junto. Sem isto, clicar salvar de novo depois de
    // um salvamento bem-sucedido rolava a tela até a faixa velha antes de a
    // requisição nova terminar — confirmação de um gesto que ainda não deu.
    definirSucesso(false);
    try {
      if (id) {
        // `PATCH` com o corpo INTEIRO, e não só o que mudou.
        //
        // O formulário carregou tudo e a pessoa editou o que quis; mandar o
        // conjunto é o que garante que remover um material ou desmarcar o
        // principal chegue como remoção. Mandar só a diferença exigiria a tela
        // saber o que veio do servidor, e ela passaria a ter duas verdades.
        await editarInteracao(id, montarCorpo(form, true));
      } else {
        await criarInteracao(montarCorpo(form));
        definirForm({ ...VAZIO, frente: form.frente });
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

  if (carregando) return <Carregando rotulo="Carregando o registro…" />;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        {/* O TITULO ACOMPANHA A ACAO. Dizia "Novo registro" tambem na
            edicao: a pessoa abria uma agenda para alterar e a tela afirmava
            que ela estava criando outra. E o nome bate com o botao da ficha
            que trouxe ate aqui — uma acao mantem o mesmo nome ao longo do
            caminho, senao a pessoa nao sabe se chegou onde queria. */}
        <h1 style={{ fontSize: 26 }}>{id ? 'Editar agenda' : 'Nova agenda'}</h1>
        <p style={{ fontSize: 13, color: 'var(--cinza-2)', marginTop: 4 }}>
          Escolha a frente antes de preencher a identificação — ela define como a agenda é classificada.
        </p>
      </div>

      {/* O DESFECHO DO SALVAR PRECISA ALCANÇAR QUEM APERTOU O BOTÃO.
          Estas faixas moram no topo e o botão fica depois de sete seções: quem
          rolava até o fim, clicava em salvar e caía numa validação não via
          nada acontecer. `role="alert"` já anunciava para leitor de tela; para
          quem enxerga, o aviso estava fora da tela. Por isso o foco vai até
          ele — que também é o começo do caminho de volta pelo teclado. */}
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
              : 'Agenda salva. O formulário está pronto para a próxima.'}
          </div>
        ) : null}
      </div>

      <Secao titulo="Tipo de registro">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          {FRENTES.map((frente) => (
            <ChipDeFrente
              key={frente}
              frente={frente}
              ativo={form.frente === frente}
              aoClicar={() => trocarFrente(frente)}
            />
          ))}
        </div>
      </Secao>

      <Secao titulo="Identificação">
        <div className="grade grade--2" style={{ gap: 16 }}>
          <Campo rotulo="Data da interação" obrigatorio>
            <input
              type="date"
              style={estiloDeEntrada}
              value={form.data_interacao}
              onChange={(evento) => alterar('data_interacao', evento.target.value)}
            />
          </Campo>

          <Campo rotulo={rotuloDaInstituicao} obrigatorio>
            <select
              style={estiloDeEntrada}
              value={form.instituicao_id}
              onChange={(evento) => alterar('instituicao_id', evento.target.value)}
            >
              <option value="">Selecione…</option>
              {/* SO AS DO TIPO QUE ESTA FRENTE CONVERSA. Uma agenda de imprensa
                  fala com veiculo, uma de legislativo com proposicao — e a
                  lista inteira obrigava a achar o certo entre 56.

                  A ja gravada entra sempre, mesmo fora do tipo: DUAS agendas de
                  imprensa apontam para `entidade`, medido no banco. Sem a
                  ressalva, o campo delas abriria em branco ao editar, e campo
                  obrigatorio vazio num registro que existe se le como dado
                  corrompido — nao como filtro fazendo efeito. */}
              {instituicoesDaFrente(
                [...catalogo.instituicoes.values()],
                form.frente,
                form.instituicao_id,
              ).map((instituicao) => (
                <option key={instituicao.id} value={instituicao.id}>
                  {instituicao.nome}
                  {instituicao.tipo !== TIPO_DE_INSTITUICAO[form.frente]
                    ? ' (de outra frente)'
                    : ''}
                </option>
              ))}
            </select>
          </Campo>

          {/* O CAMPO "INTERLOCUTOR" SAIU DAQUI.
              Ele mostrava UMA pessoa, e a agenda tem várias. Agora todas moram
              em "Quem participa", e quem representa a outra parte é a marcada
              como principal — que é exatamente o contrato do backend: a lista
              manda, a coluna é projeção dela.
              Mantê-lo aqui deixaria duas telas para o mesmo fato, capazes de
              discordar entre si. */}

          <Campo rotulo="UF da agenda" obrigatorio dica="O mapa do painel depende deste campo.">
            <select
              style={estiloDeEntrada}
              value={form.uf}
              onChange={(evento) => alterar('uf', evento.target.value)}
            >
              <option value="">Selecione…</option>
              {catalogo?.dicionarios.ufs.map((abrangencia) => (
                <option key={abrangencia.codigo} value={abrangencia.codigo}>
                  {abrangencia.nome}
                </option>
              ))}
            </select>
          </Campo>

          <Campo rotulo="Unidade de negócio">
            <select
              style={estiloDeEntrada}
              value={form.unidade_negocio_id}
              onChange={(evento) => alterar('unidade_negocio_id', evento.target.value)}
            >
              <option value="">Holding / corporativo</option>
              {catalogo.dicionarios.unidades_negocio.map((unidade) => (
                <option key={unidade.id} value={unidade.id}>
                  {unidade.nome}
                </option>
              ))}
            </select>
          </Campo>

          <Campo rotulo="Esfera">
            <select
              style={estiloDeEntrada}
              value={form.esfera_id}
              onChange={(evento) => alterar('esfera_id', evento.target.value)}
            >
              <option value="">Não informada</option>
              {catalogo.dicionarios.esferas.map((esfera) => (
                <option key={esfera.id} value={esfera.id}>
                  {esfera.nome}
                </option>
              ))}
            </select>
          </Campo>
        </div>

        <div style={{ marginTop: 16 }}>
          {/* O ASSUNTO NA IDENTIFICACAO, EM UM CAMPO SO.
              A pauta esteve aqui junto por uma passada, como "o assunto em
              palavras" ao lado do "assunto classificado". Duas caixas pedindo
              a mesma coisa em precisões diferentes, no mesmo lugar, convidam a
              escrever duas versões do assunto — e a base passa a ter registros
              cujo título e cujos temas discordam. A pauta voltou para
              "Conteúdo".

              "Temas", e nao "Assuntos": a ficha, o painel de frentes e o
              relatório chamam assim. Um nome só aqui dividiria o vocabulário —
              a pessoa marcaria "assunto" e procuraria por "tema". */}
          <Campo rotulo="Temas" dica="O mesmo assunto, classificado — é assim que o painel soma.">
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
                    aoClicar={() =>
                      alterar(
                        'temas',
                        ativo
                          ? form.temas.filter((id) => id !== tema.id)
                          : [...form.temas, tema.id],
                      )
                    }
                  />
                );
              })}
            </div>
          </Campo>
        </div>
      </Secao>

      {/* ONDE A AGENDA ACONTECE.
          Entre a identificacao e a expectativa porque e nessa ordem que se
          sabe: com quem e quando primeiro, onde em seguida, o que se espera
          por ultimo.

          A MODALIDADE E CAMPO PROPRIO, e nao deducao do endereco. Ela se agrega
          — "quantas foram presenciais neste trimestre?" — e o endereco nao;
          ler "Teams" e concluir online funcionaria ate alguem escrever "sala
          4". */}
      <Secao titulo="Onde acontece">
        <Cartao>
          <div className="grade grade--3" style={{ gap: 16 }}>
            <Campo rotulo="Modalidade">
              <select
                style={estiloDeEntrada}
                value={form.modalidade}
                onChange={(evento) => alterar('modalidade', evento.target.value)}
              >
                {/* "Nao informado" e o padrao. As 60 agendas da planilha nao
                    responderam isto, e supor presencial inventaria historia. */}
                <option value="">Não informado</option>
                <option value="presencial">Presencial</option>
                <option value="online">Online</option>
                {/* HIBRIDA EXISTE PORQUE ACONTECE: parte da mesa na sala e
                    parte na chamada. Forcar a escolha entre os dois faria a
                    base afirmar algo falso. */}
                <option value="hibrida">Híbrida</option>
              </select>
            </Campo>

            <div style={{ gridColumn: 'span 2' }}>
              <Campo
                rotulo="Local"
                dica={
                  form.modalidade === 'online'
                    ? 'O link da chamada, ou a plataforma.'
                    : 'Endereço e sala. Numa híbrida, vale o endereço de quem está presencialmente.'
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
          Vem logo depois da identificação porque é nesta ordem que se pensa
          uma agenda: quem pediu, em que pé está, o quanto importa, e o que se
          espera dela. O que houve fica em "Desfecho da agenda"; o relato, em
          "Conteúdo" — ambos depois de "Quem participa" e "Materiais", que são
          o que se resolve entre marcar e realizar.

          Três comentários se acumularam aqui, de reorganizações sucessivas, e
          dois falavam de campos que já tinham saído desta seção. Comentário
          que descreve uma tela anterior é pior que comentário nenhum. */}
      <Secao titulo="Situação e expectativa">
        <Cartao>
          <p style={{ fontSize: 13, color: 'var(--cinza-2)', margin: '0 0 16px' }}>
            O que se sabe antes da agenda acontecer: quem pediu, em que pé
            está, e o que se espera dela. Como ela terminou fica em "Desfecho
            da agenda".
          </p>

          <div className="grade grade--3" style={{ gap: 16 }}>
            <Campo rotulo="Iniciativa">
              <select
                style={estiloDeEntrada}
                value={form.iniciativa}
                onChange={(evento) => alterar('iniciativa', evento.target.value)}
              >
                <option value="">Não informada</option>
                {catalogo.dicionarios.iniciativas.map((iniciativa) => (
                  <option key={iniciativa.codigo} value={iniciativa.codigo}>
                    {iniciativa.nome}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo rotulo="Status" obrigatorio>
              <select
                style={estiloDeEntrada}
                value={form.status}
                onChange={(evento) => alterar('status', evento.target.value)}
              >
                <option value="">Selecione…</option>
                {catalogo.dicionarios.status.map((status) => (
                  <option key={status.codigo} value={status.codigo}>
                    {status.nome}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo rotulo="Relevância">
              <select
                style={estiloDeEntrada}
                value={form.tier}
                onChange={(evento) => alterar('tier', evento.target.value)}
              >
                <option value="">Não classificada</option>
                {/* Do banco, e não escrito aqui — pelo mesmo motivo do filtro.
                    Um nível que o painel oferece para FILTRAR e não oferece
                    para CLASSIFICAR seria um filtro que nunca acha nada. */}
                {catalogo?.dicionarios.relevancias.map((nivel) => (
                  <option key={nivel.id} value={nivel.id}>
                    {nivel.nome}
                  </option>
                ))}
              </select>
            </Campo>
          </div>

          {/* SÓ O QUE SE SABE ANTES DA AGENDA ACONTECER.
              Clima esperado é previsão; de onde a agenda veio é fato dado. O
              clima REAL, o resultado e o desdobramento saíram daqui para
              "Desfecho da agenda" — quem abre o formulário para marcar uma
              reunião não tem como responder nenhum dos três.

              O par esperado × real, que motivou juntá-los aqui, continua
              inteiro na ficha, onde ele é LIDO. É lá que a comparação serve
              para alguma coisa; aqui ela só pedia um dado que ainda não
              existe. */}
          <div className="grade grade--2" style={{ gap: 16 }}>
            <CampoDeDicionario
              rotulo="Clima esperado"
              itens={catalogo.dicionarios.climas}
              valor={form.clima_esperado}
              aoMudar={(v) => alterar('clima_esperado', v)}
            />

            {/* DE QUAIS AGENDAS ESTA DECORRE — plural, e nao uma so.
                Era um `select` de uma origem, e com um pai so o caso "a agencia
                e a bancada levaram juntas a esta reuniao" perdia uma das duas.
                E esse caso e o que o grafo existe para mostrar. */}
            <Campo
              rotulo="Veio de outras agendas?"
              dica="Encadear as conversas é o que transforma reuniões soltas em agenda com histórico. Dá para escolher mais de uma."
            >
              <select
                style={estiloDeEntrada}
                value=""
                onChange={(evento) => {
                  const escolhida = evento.target.value;
                  // Volta a "Acrescentar…" para dar para escolher a proxima
                  // sem passar por outro campo.
                  evento.target.value = '';
                  if (escolhida && !form.origens.includes(escolhida)) {
                    alterar('origens', [...form.origens, escolhida]);
                  }
                }}
              >
                <option value="">Acrescentar uma origem…</option>
                {agendas
                  // A propria agenda fora da lista: o banco tem um `check` que
                  // barra, mas oferecer a opcao e recusar depois e convite para
                  // um erro que a tela podia ter evitado. O ciclo LONGO
                  // (A→B→A) e barrado no repositorio, que sobe o grafo inteiro
                  // — coisa que a tela nao tem como saber.
                  .filter((agenda) => agenda.id !== id)
                  .filter((agenda) => !form.origens.includes(agenda.id))
                  .map((agenda) => (
                    <option key={agenda.id} value={agenda.id}>
                      {agenda.data_interacao} ·{' '}
                      {tituloDaAgenda(agenda, (ids) =>
                        nomesDosTemas(catalogo, ids),
                      ).slice(0, 60)}
                    </option>
                  ))}
              </select>

              {form.origens.length === 0 ? (
                <p style={{ fontSize: 12, color: 'var(--cinza-2)', marginTop: 6 }}>
                  Nenhuma. Esta agenda começa uma conversa.
                </p>
              ) : (
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
                        rotulo={
                          agenda
                            ? `${agenda.data_interacao} · ${tituloDaAgenda(agenda, (ids) => nomesDosTemas(catalogo, ids)).slice(0, 40)} ✕`
                            : 'Agenda anterior (fora das mais recentes) ✕'
                        }
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
            </Campo>
          </div>

          {/* A EXPECTATIVA FECHA A SEÇÃO porque ela depende de tudo que veio
              antes: quem pediu, em que pé está, o quanto importa, que clima se
              projeta, de onde a agenda veio. Escrever o que se espera antes de
              responder essas coisas é escrever no vazio. */}
          <Campo rotulo="Expectativa">
            <textarea
              style={{ ...estiloDeEntrada, minHeight: 74, resize: 'vertical' }}
              value={form.expectativa}
              onChange={(evento) => alterar('expectativa', evento.target.value)}
              placeholder="O que precisa sair desta reunião para ela ter valido a pena."
            />
          </Campo>
        </Cartao>
      </Secao>

      {/* OS DOIS LADOS DA MESA, UM AO LADO DO OUTRO.
          Os porta-vozes viviam no fim da tela, numa seção "Porta-vozes e
          temas", longe das pessoas da outra parte. Mas a pergunta é uma só —
          quem senta nesta reunião — e respondê-la em dois lugares distantes
          fazia a metade Aegea ser esquecida com frequência.

          O MESMO GESTO NOS DOIS LADOS. A Aegea entrava por chips e a outra
          parte por linhas — duas gramáticas para a mesma pergunta. Pior: a
          metade que usava chips não tinha onde registrar presença, e o backend
          guardava esse campo desde sempre. Quem representou a Aegea e faltou à
          reunião era um fato que o banco aceitava e a tela não deixava contar.

          O que difere é só a coluna do meio, porque as duas coisas são
          diferentes: aqui o PAPEL (fala pela companhia ou acompanha), lá qual
          pessoa REPRESENTA a instituição. Por isso continuam dois componentes,
          e não um com bandeirinha. */}
      <Secao titulo="Quem participa">
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
              Quem fala pela companhia conta no painel de exposição; quem
              acompanha, não.
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
              Marque quem representa a instituição e, depois da reunião, quem
              compareceu — inclusive quem faltou.
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
              )}
              aoMudar={(outraParte) => alterar('outraParte', outraParte)}
            />
          </Cartao>
        </div>
      </Secao>

      {/* MATERIAIS --------------------------------------------------------- */}
      {/* DUAS SECOES, e nao uma com seletor de momento.
          O momento e a unica coisa que distinguia "o que levo" de "o que
          trouxe", e ele era um `select` no meio da linha. Quem preenche a
          agenda faz as duas coisas em dias diferentes: separadas, cada
          instante tem o seu lugar, e a lista de preparacao nao cresce com o
          que so vai existir depois da reuniao. */}
      <Secao titulo="Materiais de preparação">
        <Cartao>
          <p style={{ fontSize: 13, color: 'var(--cinza-2)', margin: '0 0 16px' }}>
            O que se leva para a reunião. Suba o arquivo, ou informe o link se
            ele já mora no SharePoint.
          </p>
          <ListaDeMateriais
            materiais={materiaisDe(form.materiais, MOMENTOS_DE_PREPARACAO)}
            momentos={MOMENTOS_DE_PREPARACAO}
            interacaoId={id}
            aoFalhar={definirErro}
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

      {/* A SECAO "CAMPOS DE <FRENTE>" SAIU DA TELA — e so da tela.
          Pedido do dono do produto. Eram cinco blocos condicionais: formato,
          data de publicacao, link da materia e mensagens-chave na imprensa;
          casa, tramitacao, prioridade e ementa no legislativo; e assim por
          diante.

          O DADO CONTINUA. `form.extensao` segue no estado, `paraFormulario` o
          carrega do servidor e `montarCorpo` o devolve — sem isso, editar um
          registro de imprensa apagaria o formato e o link que ja estavam
          gravados, porque na edicao campo ausente vira `null`.

          A ficha e os relatorios continuam exibindo tudo. O que mudou e que
          esses campos deixaram de ser preenchiveis por aqui. */}

      <Secao titulo="Conteúdo">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {(
            [
              ['relato', 'Relato'],
              ['encaminhamentos', 'Repercussão e encaminhamentos'],
              ['pendencias', 'Pendências'],
              ['observacoes', 'Observações'],
            ] as const
          ).map(([campo, rotulo]) => (
            <Campo key={campo} rotulo={rotulo}>
              <textarea
                style={{ ...estiloDeEntrada, height: 62, padding: 11, resize: 'vertical' }}
                value={form[campo]}
                onChange={(evento) => alterar(campo, evento.target.value)}
              />
            </Campo>
          ))}
          {/* "POSICIONAMENTO DA COMPANHIA" E "REGISTRO / DOCUMENTACAO" SAIRAM.
              O registro apontava para um link solto, e materiais agora tem
              secao propria, com upload e momento — o campo virou a terceira
              forma de guardar documento, sem dizer se e de antes ou de depois.
              Os dois continuam no banco: o que ja foi preenchido segue la, e a
              ficha continua mostrando. */}
        </div>
      </Secao>

      {/* O DESFECHO — o que só existe DEPOIS da agenda acontecer.
          Estes três campos estavam em "Situação e expectativa", junto do que
          se sabe antes. Quem abre o formulário para marcar uma reunião não tem
          como responder nenhum deles, e o formulário pedia mesmo assim.

          Fica logo depois de "Conteúdo" de propósito: o relato acabou de ser
          escrito ali, e estes campos são a classificação daquele mesmo texto.
          Separá-los faria voltar a rolar a tela para dizer duas vezes como a
          reunião foi. */}
      <Secao titulo="Desfecho da agenda">
        <Cartao>
          <p style={{ fontSize: 13, color: 'var(--cinza-2)', margin: '0 0 16px' }}>
            Depois da reunião. O clima aqui é o que de fato houve — a ficha o
            mostra ao lado do que se esperava.
          </p>
          <div className="grade grade--3" style={{ gap: 16 }}>
            <Campo rotulo="Clima">
              <select
                style={estiloDeEntrada}
                value={form.clima}
                onChange={(evento) => alterar('clima', evento.target.value)}
              >
                <option value="">Não informado</option>
                {catalogo.dicionarios.climas.map((clima) => (
                  <option key={clima.codigo} value={clima.codigo}>
                    {clima.nome}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo rotulo="Resultado">
              <select
                style={estiloDeEntrada}
                value={form.resultado}
                onChange={(evento) => alterar('resultado', evento.target.value)}
              >
                <option value="">Sem definição</option>
                {catalogo.dicionarios.resultados.map((resultado) => (
                  <option key={resultado.codigo} value={resultado.codigo}>
                    {resultado.nome}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo rotulo="Desdobra em outra agenda?">
              <select
                style={estiloDeEntrada}
                value={form.preve_desdobramento}
                onChange={(evento) =>
                  alterar(
                    'preve_desdobramento',
                    evento.target.value as Formulario['preve_desdobramento'],
                  )
                }
              >
                {/* "Não informado" é o padrão, e não "não". A diferença entre
                    não saber e saber que não é o que esta plataforma existe
                    para reduzir. */}
                <option value="">Não informado</option>
                <option value="sim">Sim, prevê continuidade</option>
                <option value="nao">Não</option>
              </select>
            </Campo>
          </div>
        </Cartao>
      </Secao>

      <Secao titulo="Materiais pós-reunião">
        <Cartao>
          <p style={{ fontSize: 13, color: 'var(--cinza-2)', margin: '0 0 16px' }}>
            O que saiu da reunião. <strong>Obtido</strong> é o que a outra parte
            entregou; <strong>produzido</strong> é o que a Aegea escreveu depois.
          </p>
          <ListaDeMateriais
            materiais={materiaisDe(form.materiais, MOMENTOS_POS_REUNIAO)}
            momentos={MOMENTOS_POS_REUNIAO}
            interacaoId={id}
            aoFalhar={definirErro}
            aoMudar={(atualizar) =>
              definirForm((atual) => ({
                ...atual,
                materiais: [
                  ...materiaisDe(atual.materiais, MOMENTOS_DE_PREPARACAO),
                  ...atualizar(materiaisDe(atual.materiais, MOMENTOS_POS_REUNIAO)),
                ],
              }))
            }
          />
        </Cartao>
      </Secao>

      {/* DECLINIO — so quando ha o que declinar -----------------------------
          A secao inteira aparece com o status `declinado`. Mostra-la sempre
          convidaria a preencher o motivo de uma recusa que nao houve, e a base
          passaria a ter motivos de declinio em agendas realizadas. */}
      {form.status === 'declinado' && (
        <Secao titulo="Sobre o declínio">
          <Cartao>
            <p style={{ fontSize: 13, color: 'var(--cinza-2)', margin: '0 0 16px' }}>
              De qual lado veio a recusa muda a leitura, então o motivo sozinho
              não basta.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 14 }}>
              <Campo rotulo="Quem declinou">
                <select
                  style={estiloDeEntrada}
                  value={form.declinado_por}
                  onChange={(e) => alterar('declinado_por', e.target.value)}
                >
                  <option value="">Não informado</option>
                  <option value="aegea">A Aegea</option>
                  <option value="outra_parte">A outra parte</option>
                </select>
              </Campo>
              <CampoDeTexto
                rotulo="Motivo"
                valor={form.motivo_declinio}
                aoMudar={(v) => alterar('motivo_declinio', v)}
                dica="O backend recusa motivo sem lado: sozinho, ele não diz de onde veio a recusa."
              />
            </div>
          </Cartao>
        </Secao>
      )}

      <Cartao estilo={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        {/* NA EDICAO, ESVAZIAR NAO E UMA ACAO QUE ALGUEM QUEIRA.
            O botao chamava `VAZIO` sempre: numa agenda existente, ele apagava
            a tela inteira, e salvar em seguida levaria o apagamento ao
            registro — agora que campo vazio significa `null`, e nao "nao
            mexi". Editando, o gesto util e VOLTAR ao que estava. */}
        <Botao
          // Sem alvo carregado não há o que desfazer, e cair no `VAZIO` seria
          // justamente o apagamento que este botão deixou de fazer.
          desabilitado={Boolean(id) && !carregado}
          aoClicar={() =>
            definirForm(id ? (carregado ?? VAZIO) : { ...VAZIO, frente: form.frente })
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
            // Exigia tambem `pauta` e `status`, que moram em secoes sobre o que
            // ainda nao aconteceu — para criar uma agenda era preciso descer a
            // tela inteira. Quem pede uma agenda de manha sabe com quem e
            // quando; nao sabe ainda o que vai sair dela.
            //
            // O resto vira EDICAO de um registro que ja existe — e e so depois
            // de existir que da para anexar arquivo, porque a pasta e dele.
            !form.data_interacao ||
            !form.instituicao_id ||
            !form.uf
          }
        >
          {enviando ? 'Salvando…' : id ? 'Salvar alterações' : 'Salvar agenda'}
        </Botao>
      </Cartao>
    </div>
  );
}

function CampoDeTexto({
  rotulo,
  valor,
  aoMudar,
  tipo = 'text',
  dica,
}: {
  rotulo: string;
  valor: string | undefined;
  aoMudar: (valor: string) => void;
  tipo?: string;
  dica?: string;
}) {
  return (
    <Campo rotulo={rotulo} dica={dica}>
      <input
        type={tipo}
        style={estiloDeEntrada}
        value={valor ?? ''}
        onChange={(evento) => aoMudar(evento.target.value)}
      />
    </Campo>
  );
}

function CampoDeDicionario({
  rotulo,
  itens,
  valor,
  aoMudar,
}: {
  rotulo: string;
  itens: { codigo: string; nome: string }[];
  valor: string | undefined;
  aoMudar: (valor: string) => void;
}) {
  return (
    <Campo rotulo={rotulo}>
      <select
        style={estiloDeEntrada}
        value={valor ?? ''}
        onChange={(evento) => aoMudar(evento.target.value)}
      >
        <option value="">Não informado</option>
        {itens.map((item) => (
          <option key={item.codigo} value={item.codigo}>
            {item.nome}
          </option>
        ))}
      </select>
    </Campo>
  );
}

/** Converte o formulário no corpo que a API espera: campo vazio vira ausência,
 *  não string vazia — o backend distingue "não informado" de "limpo". */
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
): string | null {
  // UM MATERIAL PRECISA DE TÍTULO E DE UM DESTINO — arquivo OU link.
  //
  // A regra dizia "título e link", e "guardar arquivo no painel ainda não
  // existe". Isso deixou de ser verdade quando o upload entrou, e a tela passou
  // a IMPEDIR o salvamento de todo material com arquivo: título preenchido,
  // link vazio, e a comparação acusava "pela metade". O recurso novo era
  // bloqueado pela validação do recurso antigo.
  const semDestino = form.materiais.findIndex(
    (m) => Boolean(m.titulo.trim()) && !m.url.trim() && !m.arquivo_id,
  );
  if (semDestino >= 0) {
    return (
      `O material ${semDestino + 1} não leva a lugar nenhum: ` +
      'suba um arquivo ou informe um link.'
    );
  }

  const semTitulo = form.materiais.findIndex(
    (m) => !m.titulo.trim() && (Boolean(m.url.trim()) || Boolean(m.arquivo_id)),
  );
  if (semTitulo >= 0) {
    return `Dê um título ao material ${semTitulo + 1}, ou remova a linha.`;
  }

  const semPessoa = form.outraParte.findIndex((p) => !p.interlocutor_id);
  if (semPessoa >= 0) {
    return `Escolha a pessoa da linha ${semPessoa + 1} em "Pela outra parte", ou remova a linha.`;
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
    return (
      `A pessoa da linha ${forasteiro + 1} em "Pela outra parte" não pertence ` +
      'à instituição escolhida. Remova a linha, ou volte a instituição anterior.'
    );
  }

  // A MESMA GUARDA DO OUTRO LADO DA MESA.
  //
  // Ela existia só para a outra parte. Do lado da Aegea, `montarCorpo` filtra
  // a linha sem pessoa escolhida — e filtrar em silêncio é pior que recusar:
  // a tela diria "Alterações salvas" e a linha que a pessoa acabou de
  // acrescentar teria sumido do registro, sem erro e sem pista.
  const semPessoaAegea = form.aegea.findIndex((p) => !p.pessoa_aegea_id);
  if (semPessoaAegea >= 0) {
    return `Escolha a pessoa da linha ${semPessoaAegea + 1} em "Pela Aegea", ou remova a linha.`;
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
      return (
        `A pessoa da linha ${indice + 1} em "Pela Aegea" já está na lista com ` +
        'o mesmo papel. Mude o papel de uma delas, ou remova a linha.'
      );
    }
    vistos.add(chave);
  }

  return null;
}


function montarCorpo(form: Formulario, paraEdicao = false) {
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

  return {
    frente: form.frente,
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

    // -- o ciclo -------------------------------------------------------------
    expectativa: opcional(form.expectativa),
    clima_esperado: opcional(form.clima_esperado),
    // SÓ COM STATUS `declinado`. A seção some da tela quando o status muda,
    // mas o que foi digitado continua no estado — e ia junto no corpo. Uma
    // agenda REALIZADA saía gravada com "declinada pela outra parte", dado que
    // ninguém vê na tela e que nenhum relatório espera encontrar.
    //
    // Não limpo o estado ao trocar o status de propósito: quem marcou
    // `declinado` por engano e volta atrás perderia o motivo escrito. O texto
    // fica na tela e só não é enviado.
    // Fora do status `declinado` os dois vão a `null` na edição: se a pessoa
    // corrigiu o status de "declinado" para "realizado", a recusa que ficou
    // gravada antes precisa SAIR do registro.
    declinado_por: ehDeclinada ? opcional(form.declinado_por) : vazio,
    motivo_declinio: ehDeclinada ? opcional(form.motivo_declinio) : vazio,
    // A LISTA INTEIRA, sempre — inclusive vazia. Aqui `[]` significa
    // "nenhuma origem", e não "não mexi": o formulário SEMPRE sabe quais são,
    // porque as carrega ao abrir. Omitir deixaria o backend preservar o que
    // estava, e desmarcar todas nunca surtiria efeito.
    origens: form.origens,
    // '' vira `undefined` e NAO `false`: nao informado nao e uma resposta.
    preve_desdobramento:
      form.preve_desdobramento === '' ? vazio : form.preve_desdobramento === 'sim',

    // O PRINCIPAL VAI NA LISTA, e a coluna e projecao dela — e o contrato que
    // o backend passou a exigir depois de sete rodadas de revisao. Mandar so
    // `interlocutor_id` continua funcionando, mas a tela edita a lista.
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
 *  O backend guarda todos na mesma tabela justamente porque a versão anterior
 *  deixava o principal sem lugar para ter presença — e era ele a pessoa mais
 *  importante da reunião.
 *
 *  A marca de principal é um `radio`, e não um `checkbox`: só um representa a
 *  outra parte, e o rádio diz isso pela forma. Com caixas de seleção alguém
 *  marcaria duas e só descobriria no erro do servidor.
 */
/** Quem da Aegea senta nesta agenda.
 *
 *  Espelha `ListaDeParticipantes` de propósito: acrescentar alguém é o mesmo
 *  gesto dos dois lados da mesa. Antes, a Aegea entrava por chips e a outra
 *  parte por linhas — duas gramáticas para a mesma pergunta, e a metade que
 *  usava chips não tinha onde registrar presença.
 *
 *  A coluna do meio é o que difere: aqui é o PAPEL (fala pela companhia ou
 *  acompanha), lá é qual pessoa REPRESENTA a instituição. Não são a mesma
 *  ideia, e por isso os dois lados não viraram um componente só.
 */
function ListaDaAegea({
  participantes,
  pessoas,
  aoMudar,
}: {
  participantes: ParticipanteAegeaNoForm[];
  pessoas: { id: string; nome: string; eh_porta_voz: boolean }[];
  aoMudar: (lista: ParticipanteAegeaNoForm[]) => void;
}) {
  const trocar = (indice: number, mudanca: Partial<ParticipanteAegeaNoForm>) =>
    aoMudar(participantes.map((p, i) => (i === indice ? { ...p, ...mudanca } : p)));

  return (
    <>
      {participantes.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--cinza-3)', margin: '0 0 12px' }}>
          Ninguém da Aegea ainda. Acrescente quem representa a companhia nesta
          agenda.
        </p>
      )}

      {participantes.map((participante, indice) => (
        <div key={indice} className="linha-participante">
          {/* Rótulo visível só na primeira linha, `aria-label` em todas: sem
              ele a árvore de acessibilidade lê "caixa de combinação" seis
              vezes sem dizer de quê. Mesma razão da outra lista. */}
          <Campo rotulo={indice === 0 ? 'Pessoa' : ''}>
            <select
              aria-label={`Pessoa da Aegea ${indice + 1}`}
              style={estiloDeEntrada}
              value={participante.pessoa_aegea_id}
              onChange={(evento) => {
                // O PAPEL SEGUE QUEM FOI ESCOLHIDO. `eh_porta_voz` já diz quem
                // fala pela companhia; deixar o padrão em 'porta_voz' para
                // todo mundo faria alguém da equipe entrar contando no painel
                // de exposição sem ninguém ter decidido isso. Continua
                // editável — é um padrão, não uma trava.
                const pessoa = pessoas.find((p) => p.id === evento.target.value);
                trocar(indice, {
                  pessoa_aegea_id: evento.target.value,
                  papel: pessoa?.eh_porta_voz ? 'porta_voz' : 'equipe',
                });
              }}
            >
              <option value="">Selecione…</option>
              {pessoas.map((pessoa) => (
                <option key={pessoa.id} value={pessoa.id}>
                  {pessoa.nome}
                </option>
              ))}
            </select>
          </Campo>

          <div style={{ paddingBottom: 4 }}>
            <Botao
              variante="secundario"
              aoClicar={() => aoMudar(participantes.filter((_, i) => i !== indice))}
              rotuloAcessivel={`Remover a pessoa da Aegea ${indice + 1}`}
            >
              Remover
            </Botao>
          </div>

          <div className="linha-participante__miudos">
            <Campo rotulo={indice === 0 ? 'Papel' : ''}>
              <select
                aria-label={`Papel da pessoa da Aegea ${indice + 1}`}
                style={estiloDeEntrada}
                value={participante.papel}
                onChange={(evento) => trocar(indice, { papel: evento.target.value })}
              >
                {PAPEIS.map((op) => (
                  <option key={op.valor} value={op.valor}>
                    {op.rotulo}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo rotulo={indice === 0 ? 'Presença' : ''}>
              <select
                aria-label={`Presença da pessoa da Aegea ${indice + 1}`}
                style={estiloDeEntrada}
                value={participante.presenca}
                onChange={(evento) => trocar(indice, { presenca: evento.target.value })}
              >
                {PRESENCAS.map((op) => (
                  <option key={op.valor} value={op.valor}>
                    {op.rotulo}
                  </option>
                ))}
              </select>
            </Campo>
          </div>
        </div>
      ))}

      <Botao
        aoClicar={() =>
          aoMudar([
            ...participantes,
            { pessoa_aegea_id: '', papel: 'porta_voz', presenca: '' },
          ])
        }
      >
        Acrescentar pessoa
      </Botao>
    </>
  );
}

function ListaDeParticipantes({
  participantes,
  interlocutores,
  rotuloEsperado,
  aoMudar,
}: {
  participantes: ParticipanteNoForm[];
  interlocutores: { id: string; nome: string }[];
  //: Como o campo de instituicao se chama NESTA frente. Vem de fora para a
  //: mensagem nao contradizer o rotulo — no Legislativo ele e "Proposicao".
  rotuloEsperado: string;
  aoMudar: (lista: ParticipanteNoForm[]) => void;
}) {
  // `name` ÚNICO POR INSTÂNCIA. Fixo, duas listas na mesma página
  // compartilhariam o grupo de rádio e marcar o principal numa desmarcaria o
  // da outra. Hoje só existe uma lista; a Ficha vai reusar este componente.
  const grupo = useId();

  const trocar = (indice: number, mudanca: Partial<ParticipanteNoForm>) =>
    aoMudar(participantes.map((p, i) => (i === indice ? { ...p, ...mudanca } : p)));

  const marcarPrincipal = (indice: number) =>
    // Desmarca os outros no mesmo gesto. Deixar isso para o servidor faria a
    // tela mostrar dois principais até o próximo salvamento.
    aoMudar(participantes.map((p, i) => ({ ...p, principal: i === indice })));

  return (
    <>
      {participantes.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--cinza-3)', margin: '0 0 12px' }}>
          {interlocutores.length === 0
            ? `Escolha o ${rotuloEsperado} em "Identificação" primeiro — é ele que diz quem pode representar a outra parte.`
            : 'Ninguém da outra parte ainda. Acrescente quem vai à reunião — e, depois dela, marque quem foi.'}
        </p>
      )}

      {participantes.map((participante, indice) => (
        <div key={indice} className="linha-participante">
          {/* O RÓTULO VISÍVEL só na primeira linha — repeti-lo em todas
              viraria ruído numa lista de seis pessoas. Mas `Campo` é um
              `<label>`, e rótulo vazio deixa o controle SEM NOME ACESSÍVEL:
              quem usa leitor de tela ouviria "caixa de combinação" seis vezes,
              sem saber do quê. O `aria-label` dá o nome em todas as linhas. */}
          <Campo rotulo={indice === 0 ? 'Pessoa' : ''}>
            <select
              aria-label={`Pessoa ${indice + 1}`}
              style={estiloDeEntrada}
              value={participante.interlocutor_id}
              onChange={(evento) =>
                trocar(indice, { interlocutor_id: evento.target.value })
              }
            >
              <option value="">Selecione…</option>
              {interlocutores.map((pessoa) => (
                <option key={pessoa.id} value={pessoa.id}>
                  {pessoa.nome}
                </option>
              ))}
            </select>
          </Campo>

          <div style={{ paddingBottom: 4 }}>
            <Botao
              variante="secundario"
              aoClicar={() => aoMudar(participantes.filter((_, i) => i !== indice))}
              rotuloAcessivel={`Remover a pessoa ${indice + 1}`}
            >
              Remover
            </Botao>
          </div>

          <div className="linha-participante__miudos">
            <Campo rotulo={indice === 0 ? 'Presença' : ''}>
              <select
                aria-label={`Presença da pessoa ${indice + 1}`}
                style={estiloDeEntrada}
                value={participante.presenca}
                onChange={(evento) => trocar(indice, { presenca: evento.target.value })}
              >
                {PRESENCAS.map((op) => (
                  <option key={op.valor} value={op.valor}>
                    {op.rotulo}
                  </option>
                ))}
              </select>
            </Campo>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 13,
                paddingBottom: 9,
                whiteSpace: 'nowrap',
              }}
            >
              <input
                type="radio"
                name={grupo}
                // O TEXTO VISÍVEL "Principal" se repete em toda linha, e sozinho
                // ele é o nome acessível de TODOS os rádios: a árvore de
                // acessibilidade lia `radio "Principal"` seis vezes, sem dizer de
                // quem. O `aria-label` traz a linha junto.
                aria-label={`Pessoa ${indice + 1} representa a outra parte`}
                checked={participante.principal}
                onChange={() => marcarPrincipal(indice)}
              />
              Principal
            </label>
          </div>
        </div>
      ))}

      <Botao
        aoClicar={() =>
          aoMudar([
            ...participantes,
            { interlocutor_id: '', presenca: '', principal: false },
          ])
        }
      >
        Acrescentar pessoa
      </Botao>
    </>
  );
}

/** Os materiais da agenda: apoio antes, obtido e produzido depois.
 *
 *  O `id` viaja escondido em cada linha e volta no salvamento. Sem ele o
 *  backend recria o material e troca a identidade — e a tela perde a
 *  referência do que estava editando.
 */
/** Legivel por gente, e nao em bytes. */
function tamanhoLegivel(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/** Os documentos de um MOMENTO da agenda.
 *
 *  Uma instância por seção: preparação (`apoio`) e pós-reunião (`obtido`,
 *  `produzido`). `momentos` diz quais valores esta lista governa — com um só,
 *  o seletor de momento some, porque não há escolha a fazer.
 *
 *  O UPLOAD EXIGE QUE A AGENDA JÁ EXISTA. O arquivo mora na pasta dela, e numa
 *  agenda nova ainda não há pasta. Em vez de fingir que dá, a tela diz o que
 *  falta — e o campo de link continua servindo, que é o caminho de sempre.
 */
function ListaDeMateriais({
  materiais,
  momentos,
  interacaoId,
  aoMudar,
  aoFalhar,
}: {
  materiais: MaterialNoForm[];
  momentos: { valor: string; rotulo: string }[];
  /** `undefined` numa agenda ainda não salva. */
  interacaoId?: string;
  /** Recebe uma FUNÇÃO, e não a lista pronta.
   *
   *  O upload é assíncrono: quando ele volta, a lista que a closure capturou
   *  já pode estar velha — quem digitou o título enquanto o arquivo subia
   *  perderia o que escreveu, porque a volta reescrevia tudo a partir do
   *  retrato antigo. Com função, a atualização se aplica ao que existe AGORA.
   */
  aoMudar: (atualizar: (atual: MaterialNoForm[]) => MaterialNoForm[]) => void;
  aoFalhar: (mensagem: string) => void;
}) {
  //: Qual linha está subindo. Índice, e não booleano: subir dois arquivos ao
  //: mesmo tempo mostraria "enviando" nas duas linhas.
  const [subindo, definirSubindo] = useState<number | null>(null);

  const trocar = (indice: number, mudanca: Partial<MaterialNoForm>) =>
    aoMudar((atual) => atual.map((m, i) => (i === indice ? { ...m, ...mudanca } : m)));

  const subir = async (indice: number, arquivo: File) => {
    if (!interacaoId) return;
    definirSubindo(indice);
    try {
      const salvo = await subirArquivoDeMaterial(
        interacaoId,
        materiais[indice].momento,
        arquivo,
      );
      // O TÍTULO VAZIO GANHA O NOME DO ARQUIVO. Quem sobe "Nota técnica
      // ANA.pdf" já disse como o material se chama; pedir para digitar de novo
      // é trabalho que a tela podia ter poupado. Título preenchido fica.
      // `atual`, e não `materiais`: entre o clique e a volta do upload a
      // pessoa pode ter digitado o título, e a lista capturada pela closure
      // não sabe disso. Reescrevê-la apagaria o que ela escreveu.
      aoMudar((atual) =>
        atual.map((m, i) =>
          i === indice
            ? {
                ...m,
                arquivo_id: salvo.id,
                arquivo: salvo,
                titulo: m.titulo.trim() || salvo.nome,
              }
            : m,
        ),
      );
    } catch (falha) {
      // A mensagem do servidor diz o que houve — tipo recusado, tamanho acima
      // do limite — e é ela que a pessoa precisa ler, não "falha no upload".
      aoFalhar((falha as Error).message);
    } finally {
      definirSubindo(null);
    }
  };

  return (
    <>
      {materiais.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--cinza-3)', margin: '0 0 12px' }}>
          Nenhum material ainda.
        </p>
      )}

      {materiais.map((material, indice) => (
        <div
          key={material.id ?? indice}
          style={{
            marginBottom: 14,
            paddingBottom: 14,
            borderBottom: '1px solid var(--borda)',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: momentos.length > 1 ? '1fr 2fr auto' : '1fr auto',
              gap: 10,
              alignItems: 'end',
            }}
          >
            {momentos.length > 1 && (
              <Campo rotulo={indice === 0 ? 'Momento' : ''}>
                <select
                  aria-label={`Momento do material ${indice + 1}`}
                  style={estiloDeEntrada}
                  value={material.momento}
                  onChange={(evento) => trocar(indice, { momento: evento.target.value })}
                >
                  {momentos.map((op) => (
                    <option key={op.valor} value={op.valor}>
                      {op.rotulo}
                    </option>
                  ))}
                </select>
              </Campo>
            )}

            <Campo rotulo={indice === 0 ? 'Título' : ''}>
              <input
                aria-label={`Título do material ${indice + 1}`}
                style={estiloDeEntrada}
                value={material.titulo}
                onChange={(evento) => trocar(indice, { titulo: evento.target.value })}
                placeholder="Nota técnica do reajuste"
              />
            </Campo>

            <div style={{ paddingBottom: 4 }}>
              <Botao
                variante="secundario"
                aoClicar={() => aoMudar((atual) => atual.filter((_, i) => i !== indice))}
                rotuloAcessivel={`Remover o material ${indice + 1}`}
              >
                Remover
              </Botao>
            </div>
          </div>

          {/* O ARQUIVO, QUANDO HÁ UM. Substitui o campo de link: um material
              aponta para UM lugar, e oferecer os dois ao mesmo tempo convida a
              preencher os dois e deixar a dúvida sobre qual vale. */}
          {material.arquivo ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginTop: 10,
                padding: '8px 11px',
                background: 'var(--bg-trilho)',
                borderRadius: 'var(--r-card-int)',
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  flex: 1,
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {material.arquivo.nome}
              </span>
              <span
                style={{ fontSize: 12, color: 'var(--cinza-3)', whiteSpace: 'nowrap' }}
              >
                {tamanhoLegivel(material.arquivo.tamanho)}
              </span>
              {/* Baixar só faz sentido para o que JÁ FOI SALVO: o arquivo
                  recém-subido ainda não tem material amarrado a ele, e a rota
                  de download confere justamente esse vínculo. */}
              {interacaoId && material.id ? (
                <a
                  href={urlDoArquivo(interacaoId, material.arquivo.id)}
                  style={{ fontSize: 12, color: 'var(--azul-mar)' }}
                >
                  Baixar
                </a>
              ) : null}
              <Botao
                variante="fantasma"
                rotuloAcessivel={`Tirar o arquivo do material ${indice + 1}`}
                // TIRA A LIGAÇÃO, e o byte some no salvamento seguinte — não
                // agora. Apagar na hora destruiria o arquivo de quem clicou
                // sem querer e fechou a tela sem salvar; ligado ao salvamento,
                // "Desfazer alterações" ainda traz o anexo de volta.
                aoClicar={() => trocar(indice, { arquivo_id: null, arquivo: null })}
              >
                Trocar
              </Botao>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr',
                gap: 10,
                marginTop: 10,
              }}
            >
              <Campo
                rotulo="Arquivo"
                dica={
                  interacaoId
                    ? 'PDF, Word, Excel, PowerPoint, imagem ou texto. Até 25 MB.'
                    : 'Salve a agenda primeiro — o arquivo é guardado na pasta dela.'
                }
              >
                <input
                  type="file"
                  aria-label={`Arquivo do material ${indice + 1}`}
                  disabled={!interacaoId || subindo !== null}
                  style={{ ...estiloDeEntrada, paddingTop: 7, height: 'auto' }}
                  onChange={(evento) => {
                    const escolhido = evento.target.files?.[0];
                    // O `value` é limpo para que escolher O MESMO arquivo
                    // depois de um erro dispare `change` de novo. Sem isso, a
                    // segunda tentativa não acontece e a tela parece travada.
                    evento.target.value = '';
                    if (escolhido) void subir(indice, escolhido);
                  }}
                />
              </Campo>

              <Campo rotulo="Ou link">
                <input
                  aria-label={`Link do material ${indice + 1}`}
                  style={estiloDeEntrada}
                  value={material.url}
                  onChange={(evento) => trocar(indice, { url: evento.target.value })}
                  placeholder="https://sharepoint/…"
                />
              </Campo>
            </div>
          )}

          {subindo === indice && (
            <p style={{ fontSize: 12, color: 'var(--cinza-3)', margin: '8px 0 0' }}>
              Enviando o arquivo…
            </p>
          )}

          <div style={{ marginTop: 10 }}>
            <Campo rotulo="Observação">
              <input
                aria-label={`Observação do material ${indice + 1}`}
                style={estiloDeEntrada}
                value={material.observacao}
                onChange={(evento) => trocar(indice, { observacao: evento.target.value })}
                placeholder="Assinada pelas duas partes"
              />
            </Campo>
          </div>
        </div>
      ))}

      <Botao
        aoClicar={() =>
          aoMudar((atual) => [
            ...atual,
            {
              momento: momentos[0].valor,
              titulo: '',
              url: '',
              observacao: '',
              arquivo_id: null,
              arquivo: null,
            },
          ])
        }
      >
        Acrescentar material
      </Botao>
    </>
  );
}

/** Traduz o que o servidor devolve para o estado do formulário.
 *
 *  O caminho de volta de `montarCorpo`, e precisa ser fiel a ele: um campo que
 *  saia daqui vazio some do registro no primeiro salvamento, sem erro nenhum.
 *  É a mesma classe de perda silenciosa que a revisão pegou três vezes no
 *  backend — o dado existe, e a camada do meio o descarta.
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
    frente: interacao.frente,
    data_interacao: interacao.data_interacao,
    instituicao_id: texto(interacao.instituicao_id),
    interlocutor_id: texto(interacao.interlocutor_id),
    unidade_negocio_id: texto(interacao.unidade_negocio_id),
    esfera_id: texto(interacao.esfera_id),
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
    // SEM FILTRAR POR PAPEL. A versao anterior so trazia de volta os
    // `porta_voz`, e `montarCorpo` remandava a lista inteira: salvar um
    // registro que tivesse alguem como `equipe` o APAGARIA, sem aviso. Hoje
    // nao ha nenhum assim no banco (72 participacoes, todas porta_voz), mas a
    // tela passa a criar — seria um defeito nascendo junto com o recurso.
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
      momento: m.momento,
      titulo: m.titulo,
      url: texto(m.url),
      observacao: texto(m.observacao),
    })),
  };
}
