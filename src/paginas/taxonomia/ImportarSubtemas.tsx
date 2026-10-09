/** Revisar a taxonomia de subtemas por planilha.
 *
 *  O MODAL **É** A CONFERÊNCIA, e a conferência responde UMA pergunta: destas
 *  149 linhas, quais mudam? Na manutenção mensal a resposta é "três", e o valor
 *  inteiro desta tela é não obrigar ninguém a ler as outras 146. Por isso a
 *  lista mostra só o que muda, e as linhas iguais aparecem como um número.
 *
 *  TRÊS PASSOS, UM MODAL. Baixar a taxonomia, subir a editada, aplicar. Não há
 *  botão de cancelar a importação porque não há nada a cancelar: entre conferir
 *  e confirmar nada foi gravado, então fechar o modal já é o cancelamento. É a
 *  diferença desenhada contra a importação de agendas, onde o rascunho vive no
 *  banco por dias e cancelar é uma rota.
 *
 *  O MODELO NASCE PREENCHIDO. O trabalho não é cadastrar 149 subtemas, é mexer
 *  em três — e um modelo vazio obrigaria a redigitar 146 linhas certas, cada
 *  redigitação sendo uma chance de errar num subtema que estava bom.
 *
 *  LINHA RECUSADA NÃO PRENDE AS OUTRAS, e o botão diz isso em voz alta. Recusar
 *  o arquivo inteiro por uma célula errada faria uma revisão de taxonomia parar
 *  por um código de risco digitado errado, com as outras 148 linhas certas
 *  presas atrás dele. O preço é a pessoa poder aplicar achando que aplicou
 *  tudo, e o rótulo do botão é onde esse preço se paga: ele nomeia quantas
 *  ficam de fora.
 */

import { useState } from 'react';

import {
  baixarModeloDeSubtemas,
  conferirPlanilhaDeSubtemas,
  confirmarPlanilhaDeSubtemas,
} from '@/api/cliente';
import type {
  ConferenciaDeSubtemas,
  ConfirmacaoDeSubtemas,
  DecisaoDeSubtema,
  EstadoDoSubtema,
  PropostaDeSubtema,
} from '@/api/cliente';
import { Botao, CampoDeArquivo, FaixaDeErro, Modal, Selo } from '@/componentes/basicos';
import type { MacroTema, Risco } from '@/dominio/tipos';

/** O rótulo de cada camada de LSO, igual ao do formulário desta mesma tela.
 *
 *  REPETIDO DE PROPÓSITO? Não: `CadastroDeAssuntos` tem a sua lista com a opção
 *  "— sem classificação —" no topo, que é de `<select>` e não serve para LER um
 *  valor. Aqui o mapa é código → rótulo, e o vazio tem texto próprio.
 */
const ROTULO_DO_LSO: Record<string, string> = {
  legitimidade: 'Legitimidade',
  credibilidade: 'Credibilidade',
  confianca: 'Confiança',
  nao_se_aplica: 'Não se aplica',
};

/** Como cada decisão se apresenta: o selo, e o que ela significa em uma frase.
 *
 *  AS CORES SÃO AS SEMÂNTICAS DA CASA (`--ok-*`, `--atencao-*`, `--erro-*`) e
 *  não as da paleta de marca: aqui elas dizem "entra", "muda" e "não dá", e um
 *  turquesa bonito nesse lugar faria a pessoa decidir pela cor que gosta.
 */
const APRESENTACAO: Record<
  DecisaoDeSubtema,
  { rotulo: string; fundo: string; texto: string; frase: string }
> = {
  novo: {
    rotulo: 'Novo',
    fundo: 'var(--ok-bg)',
    texto: 'var(--ok-fg)',
    frase: 'não existe no cadastro e vai ser criado',
  },
  altera: {
    rotulo: 'Muda',
    fundo: 'var(--atencao-bg)',
    texto: 'var(--atencao-fg)',
    frase: 'existe, e a planilha diz outra coisa',
  },
  recusada: {
    rotulo: 'Não dá',
    fundo: 'var(--erro-bg)',
    texto: 'var(--erro-fg)',
    frase: 'a linha não pode ser aplicada como está',
  },
  igual: {
    rotulo: 'Igual',
    fundo: 'var(--bg-trilho)',
    texto: 'var(--cinza-2)',
    frase: 'a planilha diz o mesmo que o cadastro',
  },
};

/** A ordem em que as decisões aparecem, e é a ordem de QUEM PRECISA DE AÇÃO.
 *
 *  Recusada primeiro porque é a única que exige voltar à planilha; depois o que
 *  muda, que é o que a pessoa confere; depois o que nasce. `igual` não entra na
 *  lista — ele é o número no cabeçalho.
 */
const ORDEM: DecisaoDeSubtema[] = ['recusada', 'altera', 'novo'];

/** Os campos de um subtema, em texto, para comparar antes e depois.
 *
 *  O SERVIDOR MANDA IDS porque é o que o banco guarda. Resolver aqui, com o
 *  catálogo que a tela já tem em mão, evita o servidor repetir o dicionário
 *  inteiro em 149 linhas — e evita a tela mostrar "macro_tema_id: 29", que não
 *  diz nada a ninguém.
 */
function emTexto(
  estado: EstadoDoSubtema | null,
  macros: MacroTema[],
  riscos: Risco[],
): Record<string, string> {
  if (!estado) return {};
  const macro = macros.find((m) => m.id === estado.macro_tema_id);
  const codigos = estado.riscos
    .map((id) => riscos.find((r) => r.id === id)?.codigo ?? `#${id}`)
    .sort();
  return {
    'Tema estratégico': macro?.nome ?? '— não reconciliado —',
    LSO: estado.camada_lso ? (ROTULO_DO_LSO[estado.camada_lso] ?? estado.camada_lso) : '—',
    'Tema de risco': estado.e_risco === null ? '—' : estado.e_risco ? 'Sim' : 'Não',
    Riscos: codigos.length ? codigos.join(', ') : '—',
  };
}

/** O antes e o depois, SÓ nos campos que diferem.
 *
 *  Mostrar os quatro campos sempre faria a pessoa procurar a diferença — e a
 *  tela existe justamente para ela não procurar nada.
 */
function Diferencas({
  proposta,
  macros,
  riscos,
}: {
  proposta: PropostaDeSubtema;
  macros: MacroTema[];
  riscos: Risco[];
}) {
  const antes = emTexto(proposta.antes, macros, riscos);
  const depois = emTexto(proposta.depois, macros, riscos);
  const mudaram = Object.keys(depois).filter((campo) => antes[campo] !== depois[campo]);

  if (!mudaram.length) return null;

  return (
    <dl
      style={{
        margin: '6px 0 0',
        display: 'grid',
        gridTemplateColumns: 'auto 1fr',
        gap: '2px 10px',
        fontSize: 12,
      }}
    >
      {mudaram.map((campo) => (
        <div key={campo} style={{ display: 'contents' }}>
          <dt style={{ color: 'var(--cinza-2)' }}>{campo}</dt>
          <dd style={{ margin: 0 }}>
            {/* O RISCADO CARREGA O "ANTES" SOZINHO? Não — `text-decoration` não
                chega a leitor de tela. Daí o `aria-label` na linha inteira, que
                diz a mudança em palavras. */}
            <span aria-label={`${campo}: de ${antes[campo]} para ${depois[campo]}`}>
              <span style={{ textDecoration: 'line-through', color: 'var(--cinza-3)' }}>
                {antes[campo] ?? '—'}
              </span>
              <span aria-hidden="true" style={{ margin: '0 6px', color: 'var(--cinza-3)' }}>
                →
              </span>
              <strong>{depois[campo]}</strong>
            </span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Uma linha da conferência. */
function LinhaDaConferencia({
  proposta,
  macros,
  riscos,
}: {
  proposta: PropostaDeSubtema;
  macros: MacroTema[];
  riscos: Risco[];
}) {
  const como = APRESENTACAO[proposta.decisao];
  return (
    <li
      style={{
        display: 'flex',
        gap: 10,
        padding: '10px 12px',
        borderTop: '1px solid var(--borda)',
        alignItems: 'flex-start',
      }}
    >
      {/* O NÚMERO DA LINHA É O ENDEREÇO NA PLANILHA, e por isso vem primeiro e
          em largura fixa: é com ele que a pessoa acha a célula para consertar.
          Sem ele, "o subtema X está errado" manda procurar entre 149 linhas. */}
      <span
        style={{
          minWidth: 44,
          fontSize: 11,
          color: 'var(--cinza-3)',
          fontVariantNumeric: 'tabular-nums',
          paddingTop: 2,
        }}
      >
        L{proposta.linha}
      </span>
      <span style={{ minWidth: 62, paddingTop: 1 }}>
        <Selo rotulo={como.rotulo} fundo={como.fundo} texto={como.texto} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13 }}>{proposta.nome || '(sem nome)'}</div>

        {proposta.decisao === 'altera' ? (
          <Diferencas proposta={proposta} macros={macros} riscos={riscos} />
        ) : null}

        {proposta.decisao === 'novo' ? (
          <div style={{ fontSize: 12, color: 'var(--cinza-2)', marginTop: 4 }}>
            {Object.entries(emTexto(proposta.depois, macros, riscos))
              .map(([campo, valor]) => `${campo}: ${valor}`)
              .join(' · ')}
          </div>
        ) : null}

        {/* AS DIVERGÊNCIAS SÃO FRASES, e por isso parágrafos e não `<li>`.
            Uma lista aninhada dentro do `<li>` da linha é HTML válido, mas faz
            `getByRole('listitem')` encontrar dois elementos onde há uma linha —
            e, mais importante, faz o leitor de tela anunciar "lista de 1 item"
            antes de cada motivo. São sentenças explicando a recusa, não um
            inventário. */}
        {proposta.divergencias.map((d, indice) => (
          <p
            key={`${d.coluna}-${indice}`}
            style={{ fontSize: 12, color: 'var(--erro-fg)', margin: '4px 0 0' }}
          >
            {/* A COLUNA E O VALOR DIGITADO, antes do motivo: "a linha 37 está
                errada" manda procurar; "linha 37, coluna Pilar, valor
                'Governanca'" manda consertar. */}
            <strong>{d.coluna}</strong>
            {d.valor ? <> · {`"${d.valor}"`}</> : null} — {d.motivo}
          </p>
        ))}
      </div>
    </li>
  );
}

/** O cabeçalho de números da conferência. */
function Totais({ totais }: { totais: ConferenciaDeSubtemas['totais'] }) {
  const ordem: DecisaoDeSubtema[] = ['altera', 'novo', 'recusada', 'igual'];
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
      {ordem.map((decisao) => {
        const quantas = totais[decisao] ?? 0;
        const como = APRESENTACAO[decisao];
        return (
          <span
            key={decisao}
            title={como.frase}
            style={{
              display: 'inline-flex',
              alignItems: 'baseline',
              gap: 6,
              padding: '5px 10px',
              borderRadius: 'var(--r-chip)',
              background: quantas ? como.fundo : 'var(--bg-trilho)',
              color: quantas ? como.texto : 'var(--cinza-3)',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <strong style={{ fontSize: 15, fontVariantNumeric: 'tabular-nums' }}>
              {quantas}
            </strong>
            {como.rotulo}
          </span>
        );
      })}
    </div>
  );
}

export function ImportarSubtemas({
  macros,
  riscos,
  aoAplicar,
}: {
  macros: MacroTema[];
  riscos: Risco[];
  /** Chamado depois de aplicar, para a tela recarregar a lista de assuntos. */
  aoAplicar: () => void;
}) {
  const [aberto, definirAberto] = useState(false);
  const [arquivo, definirArquivo] = useState<File | null>(null);
  const [conferencia, definirConferencia] = useState<ConferenciaDeSubtemas | null>(null);
  const [aplicado, definirAplicado] = useState<ConfirmacaoDeSubtemas | null>(null);
  const [ocupado, definirOcupado] = useState(false);
  const [erro, definirErro] = useState<string | null>(null);

  function fechar() {
    definirAberto(false);
    definirArquivo(null);
    definirConferencia(null);
    definirAplicado(null);
    definirErro(null);
  }

  async function baixar() {
    definirOcupado(true);
    definirErro(null);
    try {
      const planilha = await baixarModeloDeSubtemas();
      // Link temporário e não `window.open`: a rota exige cookie de sessão, e
      // abrir numa aba nova perderia o cabeçalho no dia em que ela deixar de
      // ser um GET simples. Mesmo caminho do modelo de agendas.
      const endereco = URL.createObjectURL(planilha);
      const link = document.createElement('a');
      link.href = endereco;
      link.download = 'taxonomia-de-subtemas.xlsx';
      link.click();
      URL.revokeObjectURL(endereco);
    } catch (falha) {
      definirErro(falha instanceof Error ? falha.message : 'Não consegui baixar a planilha.');
    } finally {
      definirOcupado(false);
    }
  }

  async function conferir(escolhido: File) {
    definirArquivo(escolhido);
    definirConferencia(null);
    definirAplicado(null);
    definirOcupado(true);
    definirErro(null);
    try {
      definirConferencia(await conferirPlanilhaDeSubtemas(escolhido));
    } catch (falha) {
      definirErro(falha instanceof Error ? falha.message : 'Não consegui ler a planilha.');
    } finally {
      definirOcupado(false);
    }
  }

  async function aplicar() {
    if (!arquivo || !conferencia) return;
    definirOcupado(true);
    definirErro(null);
    try {
      // O ARQUIVO VAI DE NOVO, com a impressão: o servidor relê e reconfere
      // contra o banco daquele instante, e recusa se mudou. É o que impede
      // aplicar uma mudança diferente da que foi aprovada.
      definirAplicado(await confirmarPlanilhaDeSubtemas(arquivo, conferencia.impressao));
      definirConferencia(null);
      aoAplicar();
    } catch (falha) {
      // A CONFERÊNCIA MORRE JUNTO com o erro de impressão, de propósito: a
      // recusa diz "confira de novo", e deixar a lista velha na tela com o
      // botão ativo convidaria a tentar outra vez o que acabou de ser recusado.
      definirConferencia(null);
      definirErro(
        falha instanceof Error ? falha.message : 'Não consegui aplicar as mudanças.',
      );
    } finally {
      definirOcupado(false);
    }
  }

  const paraAplicar = conferencia
    ? (conferencia.totais.novo ?? 0) + (conferencia.totais.altera ?? 0)
    : 0;
  const recusadas = conferencia?.totais.recusada ?? 0;
  const aMostrar = (conferencia?.propostas ?? [])
    .filter((p) => p.decisao !== 'igual')
    .sort(
      (a, b) =>
        ORDEM.indexOf(a.decisao) - ORDEM.indexOf(b.decisao) || a.linha - b.linha,
    );

  return (
    <>
      <Botao aoClicar={() => definirAberto(true)}>Revisar por planilha</Botao>

      {aberto ? (
        <Modal
          titulo="Revisar a taxonomia por planilha"
          subtitulo="Baixe a taxonomia de hoje, edite as linhas que mudaram e suba de volta. Nada é gravado até você aplicar."
          aoFechar={fechar}
          largura={880}
          rodape={
            conferencia ? (
              <div
                style={{
                  display: 'flex',
                  gap: 10,
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ fontSize: 12, color: 'var(--cinza-2)' }}>
                  {conferencia.totais.igual} linha
                  {conferencia.totais.igual === 1 ? '' : 's'} sem mudança
                </span>
                <span style={{ display: 'flex', gap: 10 }}>
                  <Botao variante="fantasma" aoClicar={fechar} desabilitado={ocupado}>
                    Fechar sem aplicar
                  </Botao>
                  <Botao
                    variante="primario"
                    aoClicar={aplicar}
                    desabilitado={ocupado || paraAplicar === 0}
                  >
                    {paraAplicar === 0
                      ? 'Nada a aplicar'
                      : /* O RÓTULO NOMEIA O QUE FICA DE FORA. A pessoa pode
                           aplicar com linhas recusadas — uma célula errada não
                           pode prender 148 linhas certas —, e o preço disso é
                           ela achar que aplicou tudo. É aqui que se paga. */
                        `Aplicar ${paraAplicar} mudança${paraAplicar === 1 ? '' : 's'}` +
                        (recusadas
                          ? ` (${recusadas} fica${recusadas === 1 ? '' : 'm'} de fora)`
                          : '')}
                  </Botao>
                </span>
              </div>
            ) : undefined
          }
        >
          <div style={{ display: 'grid', gap: 14 }}>
            {erro ? <FaixaDeErro mensagem={erro} /> : null}

            {/* OS DOIS PASSOS FICAM VISÍVEIS SEMPRE, e não escondidos depois da
                conferência: a correção normal é mexer na planilha e subir de
                novo, e esconder o campo de arquivo faria a pessoa fechar e
                reabrir o modal para isso. */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(200px, 1fr) minmax(220px, 1.2fr)',
                gap: 12,
                alignItems: 'end',
              }}
            >
              <div style={{ display: 'grid', gap: 5 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>1. Baixe a taxonomia</span>
                <span style={{ fontSize: 11, color: 'var(--cinza-2)' }}>
                  Vem preenchida com os subtemas de hoje e com as listas do cadastro.
                </span>
                <Botao aoClicar={baixar} desabilitado={ocupado}>
                  Baixar a planilha
                </Botao>
              </div>
              <div style={{ display: 'grid', gap: 5 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>2. Suba a editada</span>
                <span style={{ fontSize: 11, color: 'var(--cinza-2)' }}>
                  Subir só mostra o que mudaria. Nada é gravado neste passo.
                </span>
                <CampoDeArquivo
                  valor={arquivo}
                  aceitar=".xlsx"
                  desabilitado={ocupado}
                  ariaLabel="Planilha de subtemas preenchida"
                  rotuloDoBotao="Escolher a planilha"
                  textoVazio="Nenhuma planilha escolhida"
                  aoEscolher={(escolhido) => {
                    if (escolhido) void conferir(escolhido);
                    else definirArquivo(null);
                  }}
                />
              </div>
            </div>

            {aplicado ? (
              <div
                role="status"
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--r-card-int)',
                  background: 'var(--ok-bg)',
                  color: 'var(--ok-fg)',
                  fontSize: 13,
                }}
              >
                Pronto: {aplicado.criados} criado{aplicado.criados === 1 ? '' : 's'},{' '}
                {aplicado.alterados} alterado{aplicado.alterados === 1 ? '' : 's'},{' '}
                {aplicado.iguais} sem mudança
                {aplicado.recusadas
                  ? `, ${aplicado.recusadas} recusada${aplicado.recusadas === 1 ? '' : 's'} que ficaram de fora`
                  : ''}
                .
              </div>
            ) : null}

            {ocupado && !conferencia ? (
              <span style={{ fontSize: 12, color: 'var(--cinza-2)' }}>Lendo a planilha…</span>
            ) : null}

            {conferencia ? (
              <div>
                <Totais totais={conferencia.totais} />
                {aMostrar.length ? (
                  <>
                    <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--cinza-2)' }}>
                      Só o que muda aparece aqui. As linhas iguais ficam no número acima.
                    </p>
                    <ul
                      style={{
                        listStyle: 'none',
                        margin: '8px 0 0',
                        padding: 0,
                        border: '1px solid var(--borda)',
                        borderRadius: 'var(--r-card-int)',
                        maxHeight: 340,
                        overflowY: 'auto',
                        background: 'var(--branco)',
                      }}
                    >
                      {aMostrar.map((proposta) => (
                        <LinhaDaConferencia
                          key={`${proposta.linha}-${proposta.nome}`}
                          proposta={proposta}
                          macros={macros}
                          riscos={riscos}
                        />
                      ))}
                    </ul>
                  </>
                ) : (
                  <p style={{ margin: '10px 0 0', fontSize: 13 }}>
                    A planilha diz exatamente o que o cadastro já tem. Nada a aplicar.
                  </p>
                )}
              </div>
            ) : null}
          </div>
        </Modal>
      ) : null}
    </>
  );
}
