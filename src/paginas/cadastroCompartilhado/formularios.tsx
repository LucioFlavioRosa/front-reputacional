/** OS FORMULÁRIOS QUE MAIS DE UMA TELA DO CADASTRO COMPARTILHADO USA.
 *
 *  POR QUE ELES SAÍRAM DAS PÁGINAS. Eles já eram reusados DENTRO de cada
 *  página — o seletor em cascata serve o formulário de criar e o de editar, e o
 *  comentário dele diz "uma única vez, reaproveitado nos dois". O modal da fila
 *  de revisão é o terceiro lugar, e aí exportá-los da página deixaria de ser um
 *  detalhe: `CadastroDePortaVozes` e `CadastroDeAssuntos` importam
 *  `FilaDeRevisao`, então o modal importando de volta fecharia um CICLO —
 *  página -> fila -> modal -> página.
 *
 *  Achado de revisão, e o argumento é melhor que o meu: eu havia me apoiado no
 *  precedente de `CampoDeRedesSociais`, exportado de dentro de
 *  `CadastroDeInstituicoes`. Precedente local não vale contra ciclo.
 *
 *  AS TRÊS CONSTANTES DE EXIBIÇÃO VIERAM JUNTO porque os seletores dependem
 *  delas — e as páginas as importam de volta, porque também as usam fora destes
 *  componentes. Vocabulário de tela compartilhado por quem o desenha.
 */

import type { ReactNode } from 'react';

import {
  Botao,
  Campo,
  Selo,
  estiloDeEntrada,
} from '@/componentes/basicos';
import { SeletorDeTemas } from '@/componentes/SeletorDeTemas';
import { TIPO_DE_INSTITUICAO } from '@/dominio/frentes';
import type {
  BlocoTema,
  MacroTema,
  Risco,
  RiskCluster,
  Tema,
} from '@/dominio/tipos';
import type {
  RascunhoDaPessoaAegea,
  RascunhoDoTema,
} from '@/paginas/cadastroCompartilhado/fichas';

/** Legitimidade / Credibilidade / Confiança / Não se aplica — a dimensão da
 *  taxonomia v4 que diz QUE TIPO de reputação o tema afeta: o direito de
 *  operar, o cumprir o que promete, ou a relação de longo prazo. Ver
 *  `migrations/0053`/`0058`. */
export const LSO = [
  { valor: '', rotulo: '— sem classificação —' },
  { valor: 'legitimidade', rotulo: 'Legitimidade' },
  { valor: 'credibilidade', rotulo: 'Credibilidade' },
  { valor: 'confianca', rotulo: 'Confiança' },
  { valor: 'nao_se_aplica', rotulo: 'Não se aplica' },
];

//: Rótulo de cada severidade — a matriz da Aegea já vem com "Critico" sem
//: acento (ver migration 0059); o acento é só de exibição.
export const SEVERIDADE_ROTULO: Record<string, string> = {
  critico: 'Crítico',
  alto: 'Alto',
  moderado: 'Moderado',
};

//: SELO EM VEZ DE TEXTO ENTRE PARÊNTESES: a severidade é o dado mais
//: importante pra quem está classificando um risco, e texto pequeno dentro
//: de um `<details>` fechado passava batido. Semáforo, com as cores da
//: marca: vermelho = crítico, laranja = alto, amarelo = moderado.
export const SEVERIDADE_SELO: Record<string, { fundo: string; texto: string }> = {
  critico: { fundo: 'var(--vermelho-pitanga)', texto: 'var(--branco)' },
  alto: { fundo: 'var(--laranja-baia)', texto: 'var(--sobre-turquesa)' },
  moderado: { fundo: 'var(--amarelo-pequi)', texto: 'var(--sobre-turquesa)' },
};

/** Os três níveis, do mais restrito ao mais aberto.
 *
 *  O SENSÍVEL É O QUE A ÁREA USA PARA DECIDIR QUEM FALA. Sem ele, "reajuste
 *  tarifário" e "patrocínio de corrida" moram na mesma gaveta.
 *
 *  A ORDEM É A DO CUIDADO, e não a alfabética: quem abre a lista lê primeiro o
 *  que exige mais, e o que exige menos fica por último — que é também o padrão
 *  de quem cadastra sem pensar no campo.
 *
 *  `gerais` se chamava `livre` até a migração 0022, no rótulo e no código.
 */

//: O VOCABULÁRIO DOS TIPOS DE INSTITUIÇÃO, e ele estava em DOIS lugares —
//: `CadastroDeInstituicoes` e `FilaDeDuplicados`, com a mesma tabela escrita
//: duas vezes. O modal da fila seria o terceiro, e é o que trouxe os dois para
//: cá.

//: O código que o banco grava (`orgao`, `area_interna`...) não é o que se lê
//: numa tela. Escrito à mão, e não derivado: são seis valores fixos, do
//: mesmo jeito que o dicionário de UF já tem código E nome escritos à parte.
export const ROTULO_DO_TIPO_DE_INSTITUICAO: Record<string, string> = {
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
export function tiposCadastraveis(): { tipo: string; rotulo: string }[] {
  const tipos = new Set([...Object.values(TIPO_DE_INSTITUICAO), ...TIPOS_SEM_FRENTE]);
  return [...tipos].map((tipo) => ({
    tipo,
    rotulo: ROTULO_DO_TIPO_DE_INSTITUICAO[tipo] ?? tipo,
  }));
}


/** Pilar (N1) → Tema estratégico (N2) → LSO, em cascata.
 *
 *  UMA ÚNICA VEZ, reaproveitado no formulário de criar e no de editar — a
 *  lógica de filtrar os 41 temas estratégicos pelo pilar escolhido não vale a
 *  pena duplicar.
 */
export function SeletorDeHierarquia({
  blocos,
  macros,
  rascunho,
  aoMudar,
}: {
  blocos: BlocoTema[];
  macros: MacroTema[];
  rascunho: RascunhoDoTema;
  aoMudar: (novo: RascunhoDoTema) => void;
}) {
  const macrosDoPilar = macros.filter((m) => m.bloco_tema_id === rascunho.bloco_tema_id);
  return (
    <>
      <Campo rotulo="Pilar (N1)" obrigatorio>
        <select
          style={estiloDeEntrada}
          value={rascunho.bloco_tema_id ?? ''}
          onChange={(e) =>
            aoMudar({
              ...rascunho,
              bloco_tema_id: e.target.value ? Number(e.target.value) : null,
              // TROCAR O PILAR DESMARCA O TEMA ESTRATÉGICO: um tema
              // estratégico de outro pilar ficaria selecionado sem aparecer
              // mais na lista — o `<select>` mostraria o id errado como se
              // fosse o primeiro da lista nova, calado.
              macro_tema_id: null,
            })
          }
        >
          <option value="">— selecione —</option>
          {blocos.map((b) => (
            <option key={b.id} value={b.id}>
              {b.nome}
            </option>
          ))}
        </select>
      </Campo>
      <Campo rotulo="Tema estratégico (N2)" obrigatorio>
        <select
          style={estiloDeEntrada}
          value={rascunho.macro_tema_id ?? ''}
          disabled={rascunho.bloco_tema_id === null}
          onChange={(e) =>
            aoMudar({
              ...rascunho,
              macro_tema_id: e.target.value ? Number(e.target.value) : null,
            })
          }
        >
          <option value="">— selecione —</option>
          {macrosDoPilar.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nome}
            </option>
          ))}
        </select>
      </Campo>
      {/* NÃO É OBRIGATÓRIO, e a razão está na fonte: a taxonomia v4 deixa 47 dos
          104 subtemas SEM LSO. Marcá-lo com asterisco e exigi-lo travaria 45%
          das classificações válidas, e afirmaria uma camada que a Aegea não
          atribuiu. Pilar e Tema estratégico ficam obrigatórios porque a
          planilha os preenche em 104 de 104, sem uma exceção. */}
      <Campo
        rotulo="LSO"
        dica="A taxonomia não define LSO para 47 dos 104 subtemas; deixar vazio é resposta."
      >
        <select
          style={estiloDeEntrada}
          value={rascunho.camada_lso}
          onChange={(e) => aoMudar({ ...rascunho, camada_lso: e.target.value })}
        >
          {LSO.map((l) => (
            <option key={l.valor} value={l.valor}>
              {l.rotulo}
            </option>
          ))}
        </select>
      </Campo>
    </>
  );
}

/** Quais riscos da matriz corporativa este tema toca — zero, um ou vários.
 *
 *  AGRUPADO POR CLUSTER, e recolhível: 32 riscos numa lista só, sempre
 *  aberta, seria maior que o resto do formulário inteiro. `<details>` nativo,
 *  sem estado próprio — o navegador já lembra o que a pessoa abriu.
 */
export function SeletorDeRiscos({
  clusters,
  riscos,
  selecionados,
  aoMudar,
}: {
  clusters: RiskCluster[];
  riscos: Risco[];
  selecionados: number[];
  aoMudar: (novos: number[]) => void;
}) {
  const alternar = (riscoId: number) => {
    aoMudar(
      selecionados.includes(riscoId)
        ? selecionados.filter((id) => id !== riscoId)
        : [...selecionados, riscoId],
    );
  };
  // NÃO É OBRIGATÓRIO: 4 dos 104 subtemas vêm da planilha com "Sem
  // enquadramento" — a Aegea olhou e decidiu que não há risco a rastrear ali.
  // Nenhum risco marcado é resposta, não falta de dado.
  return (
    <Campo
      rotulo="Risco(s) associado(s)"
      dica="Nenhum marcado é resposta: a planilha deixa 4 subtemas sem enquadramento."
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {clusters.map((cluster) => {
          const riscosDoCluster = riscos.filter((r) => r.risk_cluster_id === cluster.id);
          // ABRE SOZINHO QUANDO JÁ TEM ALGO MARCADO: ao editar um tema que
          // já tem risco associado, esconder o cluster escondia a própria
          // resposta de "o que está marcado" atrás de um clique.
          const temSelecionado = riscosDoCluster.some((r) => selecionados.includes(r.id));
          return (
            <details key={cluster.id} open={temSelecionado}>
              <summary style={{ cursor: 'pointer', fontSize: 13, padding: '4px 0' }}>
                {cluster.nome}
              </summary>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 16 }}>
                {riscosDoCluster.map((risco) => (
                  <label
                    key={risco.id}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}
                  >
                    <input
                      type="checkbox"
                      // NOME EXPLÍCITO, e é conserto de acessibilidade: `Campo`
                      // envolve o conteúdo todo num `<label>`, então o PRIMEIRO
                      // checkbox da lista herdava aquele rótulo — e o leitor de
                      // tela anunciava a seção inteira ("Risco(s)
                      // associado(s)Riscos ESGExternalidadesCrítico…") no lugar
                      // do nome do risco. Os demais já pegavam o `<label>`
                      // interno, então o defeito aparecia só no primeiro, o que
                      // é pior: parecia funcionar.
                      aria-label={risco.nome}
                      checked={selecionados.includes(risco.id)}
                      onChange={() => alternar(risco.id)}
                    />
                    <span>{risco.nome}</span>
                    <Selo
                      rotulo={SEVERIDADE_ROTULO[risco.severidade] ?? risco.severidade}
                      fundo={SEVERIDADE_SELO[risco.severidade]?.fundo ?? 'var(--bg-trilho)'}
                      texto={SEVERIDADE_SELO[risco.severidade]?.texto ?? 'var(--cinza-3)'}
                    />
                  </label>
                ))}
              </div>
            </details>
          );
        })}
      </div>
    </Campo>
  );
}

/** Porta-voz ou equipe — a escolha por trás de `eh_porta_voz`, dita como
 *  pergunta em vez de caixa marcada. Duas pílulas, e não um `<select>`: são só
 *  duas opções, sempre as mesmas, e qual está ativa precisa estar visível sem
 *  abrir nada — o mesmo raciocínio do seletor de granularidade do Painel. */
export function SeletorDePapel({
  ehPortaVoz,
  aoEscolher,
}: {
  ehPortaVoz: boolean;
  aoEscolher: (ehPortaVoz: boolean) => void;
}) {
  const opcoes: { valor: boolean; rotulo: string }[] = [
    { valor: true, rotulo: 'Porta-voz' },
    { valor: false, rotulo: 'Equipe' },
  ];
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {opcoes.map((opcao) => {
        const ativo = ehPortaVoz === opcao.valor;
        return (
          <button
            key={String(opcao.valor)}
            type="button"
            onClick={() => aoEscolher(opcao.valor)}
            aria-pressed={ativo}
            style={{
              flex: 1,
              height: 38,
              borderRadius: 'var(--r-btn)',
              border: ativo ? '1px solid var(--azul-mar)' : '1px solid var(--borda-input)',
              background: ativo ? 'var(--azul-mar)' : 'var(--branco)',
              color: ativo ? 'var(--branco)' : 'var(--cinza-3)',
              fontSize: 13,
              fontWeight: ativo ? 700 : 500,
              cursor: 'pointer',
            }}
          >
            {opcao.rotulo}
          </button>
        );
      })}
    </div>
  );
}

export function EdicaoDaPessoa({
  rascunho,
  assuntos,
  assuntosInativos,
  areas,
  salvando,
  aoRascunhar,
  aoAlternarTema,
  aoEscolherPapel,
  aoCancelar,
  aoSalvar,
  acoes,
}: {
  rascunho: RascunhoDaPessoaAegea;
  assuntos: Tema[];
  assuntosInativos: Tema[];
  areas: { id: number; nome: string }[];
  salvando: boolean;
  aoRascunhar: (r: RascunhoDaPessoaAegea) => void;
  aoAlternarTema: (id: number) => void;
  aoEscolherPapel: (ehPortaVoz: boolean) => void;
  aoCancelar: () => void;
  aoSalvar: () => void;
  /** No lugar dos botões de Salvar/Cancelar — ver o comentário deles. */
  acoes?: ReactNode;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="grade grade--3" style={{ gap: 12 }}>
        <Campo rotulo="Nome">
          <input
            style={estiloDeEntrada}
            value={rascunho.nome}
            onChange={(e) => aoRascunhar({ ...rascunho, nome: e.target.value })}
          />
        </Campo>
        <Campo rotulo="E-mail">
          <input
            type="email"
            style={estiloDeEntrada}
            value={rascunho.email}
            onChange={(e) => aoRascunhar({ ...rascunho, email: e.target.value })}
          />
        </Campo>
        <Campo rotulo="Cargo">
          <input
            style={estiloDeEntrada}
            value={rascunho.cargo}
            onChange={(e) => aoRascunhar({ ...rascunho, cargo: e.target.value })}
          />
        </Campo>
      </div>

      <div className="grade grade--3" style={{ gap: 12 }}>
        <Campo rotulo="Tipo">
          <SeletorDePapel ehPortaVoz={rascunho.eh_porta_voz} aoEscolher={aoEscolherPapel} />
        </Campo>
        <Campo rotulo="Área">
          <select
            style={estiloDeEntrada}
            value={rascunho.area_id ?? ''}
            onChange={(e) =>
              aoRascunhar({
                ...rascunho,
                area_id: e.target.value ? Number(e.target.value) : null,
              })
            }
          >
            <option value="">Sem área definida</option>
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.nome}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      <div style={{ opacity: rascunho.eh_porta_voz ? 1 : 0.5 }}>
        <Campo
          rotulo="Sobre o que pode falar"
          dica={
            rascunho.eh_porta_voz
              ? undefined
              : 'Só quem é porta-voz tem temas autorizados.'
          }
        >
          {rascunho.eh_porta_voz ? (
            <SeletorDeTemas
              temas={assuntos}
              temasInativos={assuntosInativos}
              selecionados={rascunho.temas}
              aoAlternar={aoAlternarTema}
            />
          ) : null}
        </Campo>
      </div>

      {/* AS AÇÕES VÊM DE FORA QUANDO QUEM MONTA AS TEM EM OUTRO LUGAR.
          O modal da fila de revisão põe os botões no RODAPÉ do diálogo — onde
          eles ficam visíveis mesmo com o formulário rolado — e oferece DOIS:
          "Salvar" e "Salvar e dar como conferido". Sem esta saída, o modal
          mostraria três botões, dois deles dizendo a mesma coisa. */}
      {acoes ?? (
        <div style={{ display: 'flex', gap: 8 }}>
          <Botao variante="primario" desabilitado={salvando} aoClicar={aoSalvar}>
            Salvar
          </Botao>
          <Botao estilo={{ height: 40 }} aoClicar={aoCancelar}>
            Cancelar
          </Botao>
        </div>
      )}
    </div>
  );
}
