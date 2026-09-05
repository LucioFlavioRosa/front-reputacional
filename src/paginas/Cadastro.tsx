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
import { extensaoAoTrocarDeFrente } from '@/dominio/frentes';
import { hojeLocal } from '@/dominio/formato';
import { FRENTES } from '@/dominio/tipos';
import type { Frente, Interacao } from '@/dominio/tipos';

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
  tier: string;
  status: string;
  clima: string;
  resultado: string;
  iniciativa: string;
  pauta: string;
  posicionamento: string;
  relato: string;
  encaminhamentos: string;
  pendencias: string;
  observacoes: string;
  registro_url: string;
  temas: number[];
  portaVozes: string[];
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
  origem_interacao_id: string;
  //: Tres estados, e nao dois: '' e NAO INFORMADO, e some da tela como tal.
  //: Um `boolean` faria toda agenda antiga afirmar "nao preve desdobramento",
  //: que e uma decisao que ninguem tomou.
  preve_desdobramento: '' | 'sim' | 'nao';
  outraParte: ParticipanteNoForm[];
  materiais: MaterialNoForm[];
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

/** Os tres momentos do material. Apoio e antes; os outros dois, depois. */
const MOMENTOS: { valor: string; rotulo: string }[] = [
  { valor: 'apoio', rotulo: 'Apoio (antes da reuniao)' },
  { valor: 'obtido', rotulo: 'Obtido na reuniao' },
  { valor: 'produzido', rotulo: 'Produzido na reuniao' },
];

const VAZIO: Formulario = {
  frente: 'imprensa',
  data_interacao: hojeLocal(),
  instituicao_id: '',
  interlocutor_id: '',
  unidade_negocio_id: '',
  esfera_id: '',
  uf: '',
  tier: '',
  status: '',
  clima: '',
  resultado: '',
  iniciativa: '',
  pauta: '',
  posicionamento: '',
  relato: '',
  encaminhamentos: '',
  pendencias: '',
  observacoes: '',
  registro_url: '',
  temas: [],
  portaVozes: [],
  extensao: {},
  expectativa: '',
  clima_esperado: '',
  declinado_por: '',
  motivo_declinio: '',
  origem_interacao_id: '',
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
    const impedimento = impedimentoNoFormulario(form);
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

          <Campo rotulo={form.frente === 'legislativo' ? 'Proposição' : 'Veículo / órgão'} obrigatorio>
            <select
              style={estiloDeEntrada}
              value={form.instituicao_id}
              onChange={(evento) => alterar('instituicao_id', evento.target.value)}
            >
              <option value="">Selecione…</option>
              {[...catalogo.instituicoes.values()].map((instituicao) => (
                <option key={instituicao.id} value={instituicao.id}>
                  {instituicao.nome}
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

          <Campo rotulo="Abrangência" obrigatorio dica="O mapa do painel depende deste campo.">
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
      </Secao>

{/* O CICLO VEM LOGO DEPOIS DA IDENTIFICACAO, e nao no fim.
          Quem cadastra uma agenda pensa nela em ordem: quem e a outra parte,
          o que se espera, quem vai, o que se leva. Classificacao e conteudo
          sao o que se preenche DEPOIS da reuniao — deixa-los antes obrigava a
          rolar a tela inteira para registrar o que ainda nem aconteceu. */}
      {/* ANTES DA REUNIAO ------------------------------------------------
          Separada do "Conteudo" de proposito: o que se ESPERA e escrito antes,
          e o relato depois. Lado a lado numa secao so, a pessoa preencheria os
          dois no mesmo momento — e a comparacao entre o previsto e o que houve,
          que e a razao de existir destes campos, deixaria de significar algo. */}
      {/* A AGENDA: O QUE É, EM QUE PÉ ESTÁ, E O QUE SE ESPERA DELA.

          "Antes da reunião" e "Classificação" eram duas seções, e a divisão
          não correspondia a nada: `clima esperado` ficava numa e o clima REAL
          na outra, longe um do outro — justamente o par cuja comparação é a
          razão de os dois existirem. Quem cadastrava preenchia o mesmo assunto
          em dois lugares da tela.

          A ordem conta a história da agenda: quem pediu, em que pé está, o
          quanto importa, o que se espera, o que houve, e onde ela entra na
          cadeia de conversas. */}
      <Secao titulo="Situação e expectativa">
        <Cartao>
          <p style={{ fontSize: 13, color: 'var(--cinza-2)', margin: '0 0 16px' }}>
            Preencha a expectativa antes da reunião. Depois dela, o clima e o
            resultado ficam ao lado — a distância entre os dois é o que a base
            responde.
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

          <Campo rotulo="Expectativa">
            <textarea
              style={{ ...estiloDeEntrada, minHeight: 74, resize: 'vertical' }}
              value={form.expectativa}
              onChange={(evento) => alterar('expectativa', evento.target.value)}
              placeholder="O que precisa sair desta reunião para ela ter valido a pena."
            />
          </Campo>

          {/* O ESPERADO E O REAL LADO A LADO. Separados, ninguém compara — e a
              comparação é a medida de eficiência, não a contagem de reuniões. */}
          <div className="grade grade--3" style={{ gap: 16 }}>
            <CampoDeDicionario
              rotulo="Clima esperado"
              itens={catalogo.dicionarios.climas}
              valor={form.clima_esperado}
              aoMudar={(v) => alterar('clima_esperado', v)}
            />

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
          </div>

          {/* AS DUAS PONTAS DA MESMA RELAÇÃO, lado a lado: de onde a agenda
              veio, e se ela continua.

              Separadas — uma solta no meio da seção e a outra sozinha numa
              grade de três, com duas colunas vazias — não se liam como par. E
              a linhagem é justamente o que transforma reuniões soltas em
              agenda com histórico. */}
          <div className="grade grade--2" style={{ gap: 16 }}>
            <Campo
              rotulo="Veio de outra agenda?"
              dica="Encadear as conversas é o que transforma reuniões soltas em agenda com histórico."
            >
              <select
                style={estiloDeEntrada}
                value={form.origem_interacao_id}
                onChange={(evento) =>
                  alterar('origem_interacao_id', evento.target.value)
                }
              >
                <option value="">Não veio de outra</option>
                {/* A ORIGEM JÁ GRAVADA ENTRA SEMPRE, mesmo fora das 200.
                    Sem isto, uma origem mais antiga que a janela carregada
                    deixaria o campo em branco — e salvar a APAGARIA em
                    silêncio, sem ninguém ter pedido. O rótulo diz que ela veio
                    de fora da lista, para a ausência de contexto não parecer
                    dado corrompido.

                    A janela fixa de 200 é limitação conhecida: numa base
                    grande, escolher uma agenda antiga vai exigir busca. Isso é
                    uma tela a fazer; perder o que já está gravado, não. */}
                {form.origem_interacao_id &&
                !agendas.some((a) => a.id === form.origem_interacao_id) ? (
                  <option value={form.origem_interacao_id}>
                    Agenda anterior (fora das mais recentes)
                  </option>
                ) : null}
                {agendas
                  // A própria agenda fora da lista: o banco tem um `check` que
                  // barra, mas oferecer a opção e recusar depois é convite para
                  // um erro que a tela podia ter evitado. O ENCADEAMENTO longo
                  // (A→B→A) é barrado no repositório, que consegue subir a
                  // cadeia inteira — coisa que a tela não tem como saber.
                  .filter((agenda) => agenda.id !== id)
                  .map((agenda) => (
                    <option key={agenda.id} value={agenda.id}>
                      {agenda.data_interacao} · {agenda.pauta.slice(0, 60)}
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

      <Secao titulo="Quem participa">
        <Cartao>
          <p style={{ fontSize: 13, color: 'var(--cinza-2)', margin: '0 0 16px' }}>
            Marque quem representa a instituição e, depois da reunião, quem
            compareceu — inclusive quem faltou.
          </p>
          <ListaDeParticipantes
            participantes={form.outraParte}
            interlocutores={[...catalogo.interlocutores.values()]}
            aoMudar={(outraParte) => alterar('outraParte', outraParte)}
          />
        </Cartao>
      </Secao>

      {/* MATERIAIS --------------------------------------------------------- */}
      <Secao titulo="Materiais">
        <Cartao>
          <p style={{ fontSize: 13, color: 'var(--cinza-2)', margin: '0 0 16px' }}>
            Links para SharePoint ou Drive. <strong>Apoio</strong> é o que se
            leva; <strong>obtido</strong> e <strong>produzido</strong> saem de lá.
          </p>
          <ListaDeMateriais
            materiais={form.materiais}
            aoMudar={(materiais) => alterar('materiais', materiais)}
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
          <Campo rotulo="Pauta" obrigatorio dica="É o que identifica o registro na base.">
            <textarea
              style={{ ...estiloDeEntrada, height: 68, padding: 11, resize: 'vertical' }}
              value={form.pauta}
              onChange={(evento) => alterar('pauta', evento.target.value)}
            />
          </Campo>
          {(
            [
              ['posicionamento', 'Posicionamento da companhia'],
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
          <Campo rotulo="Registro / documentação">
            <input
              style={estiloDeEntrada}
              placeholder="Link do SharePoint, por exemplo"
              value={form.registro_url}
              onChange={(evento) => alterar('registro_url', evento.target.value)}
            />
          </Campo>
        </div>
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

      <Secao titulo="Porta-vozes e temas">
        <Campo
          rotulo="Porta-vozes"
          dica="Vários são permitidos: o registro conta para cada um no painel de exposição."
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
            {[...catalogo.pessoas.values()]
              .filter((pessoa) => pessoa.eh_porta_voz)
              .map((pessoa) => {
                const ativo = form.portaVozes.includes(pessoa.id);
                return (
                  <Chip
                    key={pessoa.id}
                    rotulo={pessoa.nome}
                    ativo={ativo}
                    fundo={ativo ? 'var(--azul-mar)' : 'var(--bg-trilho)'}
                    texto={ativo ? 'var(--branco)' : 'var(--cinza-3)'}
                    aoClicar={() =>
                      alterar(
                        'portaVozes',
                        ativo
                          ? form.portaVozes.filter((id) => id !== pessoa.id)
                          : [...form.portaVozes, pessoa.id],
                      )
                    }
                  />
                );
              })}
          </div>
        </Campo>

        <div style={{ marginTop: 18 }}>
          <Campo rotulo="Temas">
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
            !form.data_interacao ||
            !form.pauta.trim() ||
            !form.instituicao_id ||
            !form.uf ||
            !form.status
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
function impedimentoNoFormulario(form: Formulario): string | null {
  const incompleto = form.materiais.findIndex(
    (m) => Boolean(m.titulo.trim()) !== Boolean(m.url.trim()),
  );
  if (incompleto >= 0) {
    return (
      `O material ${incompleto + 1} está pela metade: título e link são ` +
      'necessários. Guardar arquivo no painel ainda não existe, então o link ' +
      'é o que leva ao documento.'
    );
  }

  const semPessoa = form.outraParte.findIndex((p) => !p.interlocutor_id);
  if (semPessoa >= 0) {
    return `Escolha a pessoa da linha ${semPessoa + 1} em "Quem participa", ou remova a linha.`;
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
    status: form.status,
    pauta: form.pauta.trim(),
    // `interlocutor_id` NÃO É ENVIADO: o backend o deriva de quem está marcado
    // como principal na lista. Mandar os dois abriria a porta para eles
    // discordarem, e é isso que o servidor recusa com 422.
    unidade_negocio_id: numeroOpcional(form.unidade_negocio_id),
    esfera_id: numeroOpcional(form.esfera_id),
    tier: numeroOpcional(form.tier),
    clima: opcional(form.clima),
    resultado: opcional(form.resultado),
    iniciativa: opcional(form.iniciativa),
    posicionamento: opcional(form.posicionamento),
    relato: opcional(form.relato),
    encaminhamentos: opcional(form.encaminhamentos),
    pendencias: opcional(form.pendencias),
    observacoes: opcional(form.observacoes),
    registro_url: opcional(form.registro_url),
    temas: form.temas,
    participacoes: form.portaVozes.map((id) => ({ pessoa_aegea_id: id, papel: 'porta_voz' })),
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
    origem_interacao_id: opcional(form.origem_interacao_id),
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
      .filter((m) => m.titulo.trim() || m.url.trim())
      .map((m) => ({
        // `id` so quando existe: material novo nao tem, e mandar `undefined`
        // e o que faz o backend criar em vez de procurar.
        ...(m.id ? { id: m.id } : {}),
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
function ListaDeParticipantes({
  participantes,
  interlocutores,
  aoMudar,
}: {
  participantes: ParticipanteNoForm[];
  interlocutores: { id: string; nome: string }[];
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
          Ninguém da outra parte ainda. Acrescente quem vai à reunião — e,
          depois dela, marque quem foi.
        </p>
      )}

      {participantes.map((participante, indice) => (
        <div
          key={indice}
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr auto auto',
            gap: 10,
            alignItems: 'end',
            marginBottom: 12,
            paddingBottom: 12,
            borderBottom: '1px solid var(--borda)',
          }}
        >
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

          <div style={{ paddingBottom: 4 }}>
            <Botao
              variante="secundario"
              aoClicar={() => aoMudar(participantes.filter((_, i) => i !== indice))}
              rotuloAcessivel={`Remover a pessoa ${indice + 1}`}
            >
              Remover
            </Botao>
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
function ListaDeMateriais({
  materiais,
  aoMudar,
}: {
  materiais: MaterialNoForm[];
  aoMudar: (lista: MaterialNoForm[]) => void;
}) {
  const trocar = (indice: number, mudanca: Partial<MaterialNoForm>) =>
    aoMudar(materiais.map((m, i) => (i === indice ? { ...m, ...mudanca } : m)));

  return (
    <>
      {materiais.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--cinza-3)', margin: '0 0 12px' }}>
          Nenhum material ainda. Comece pelo que você leva para a reunião.
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: 10, alignItems: 'end' }}>
            <Campo rotulo={indice === 0 ? 'Momento' : ''}>
              <select
                aria-label={`Momento do material ${indice + 1}`}
                style={estiloDeEntrada}
                value={material.momento}
                onChange={(evento) => trocar(indice, { momento: evento.target.value })}
              >
                {MOMENTOS.map((op) => (
                  <option key={op.valor} value={op.valor}>
                    {op.rotulo}
                  </option>
                ))}
              </select>
            </Campo>

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
                aoClicar={() => aoMudar(materiais.filter((_, i) => i !== indice))}
                rotuloAcessivel={`Remover o material ${indice + 1}`}
              >
                Remover
              </Botao>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
            <Campo rotulo="Link">
              <input
                aria-label={`Link do material ${indice + 1}`}
                style={estiloDeEntrada}
                value={material.url}
                onChange={(evento) => trocar(indice, { url: evento.target.value })}
                placeholder="https://sharepoint/… — guardar arquivo no painel ainda não existe"
              />
            </Campo>
            {/* A observação já viajava no corpo e voltava do servidor, e não
                tinha onde ser escrita: o campo existia e era inalcançável. */}
            <Campo rotulo="Observação">
              <input
                aria-label={`Observação do material ${indice + 1}`}
                style={estiloDeEntrada}
                value={material.observacao}
                onChange={(evento) =>
                  trocar(indice, { observacao: evento.target.value })
                }
                placeholder="Assinada pelas duas partes"
              />
            </Campo>
          </div>
        </div>
      ))}

      <Botao
        aoClicar={() =>
          aoMudar([
            ...materiais,
            { momento: 'apoio', titulo: '', url: '', observacao: '' },
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
    tier: texto(interacao.tier),
    status: texto(interacao.status),
    clima: texto(interacao.clima),
    resultado: texto(interacao.resultado),
    iniciativa: texto(interacao.iniciativa),
    pauta: texto(interacao.pauta),
    posicionamento: texto(interacao.posicionamento),
    relato: texto(interacao.relato),
    encaminhamentos: texto(interacao.encaminhamentos),
    pendencias: texto(interacao.pendencias),
    observacoes: texto(interacao.observacoes),
    registro_url: texto(interacao.registro_url),
    temas: interacao.temas ?? [],
    portaVozes: (interacao.participacoes ?? [])
      .filter((p) => p.papel === 'porta_voz')
      .map((p) => p.pessoa_aegea_id),
    extensao,

    expectativa: texto(interacao.expectativa),
    clima_esperado: texto(interacao.clima_esperado),
    declinado_por: texto(interacao.declinado_por),
    motivo_declinio: texto(interacao.motivo_declinio),
    origem_interacao_id: texto(interacao.origem_interacao_id),
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
      momento: m.momento,
      titulo: m.titulo,
      url: texto(m.url),
      observacao: texto(m.observacao),
    })),
  };
}
