/** A Base dos KPIs: onde as planilhas que chegam dos fornecedores entram.
 *
 *  POR QUE ELA EXISTE. O upload morava dentro da Calibração, num botão
 *  "Importar planilha" por fonte — e a Calibração é a RÉGUA do índice, não a
 *  porta de entrada do dado. O próprio arquivo dela conta que já teve dois
 *  donos uma vez. Aqui o dado entra; lá se decide quanto ele pesa.
 *
 *  QUATRO FONTES, UM FLUXO. Os formatos dos fornecedores são diferentes — a
 *  Clipei chama o assunto de `Subcategoria`, a Bites de `Categoria`, a Approach
 *  de `Tags (tema)` —, mas o RECEBIMENTO é um só: o seletor escolhe a fonte, e
 *  a diferença mora em `score_fonte.mapeamento_colunas`, que é cadastro.
 *
 *  CONFERIR ANTES DE GRAVAR, e é o que torna a criação de cadastro segura. Uma
 *  planilha da Clipei traz 2.648 veículos distintos e o cadastro começou com
 *  39: a primeira subida nasce com ~2.600 veículos novos. A importação de
 *  agendas tem escrito no próprio código por que isso precisa de conferência:
 *  "importação de planilha sem conferência humana cria duplicata de instituição
 *  em massa, e desfazer isso depois é pior que digitar de novo".
 *
 *  TODOS MARCADOS, E DÁ PARA DESMARCAR — pedido do dono do produto. O caso
 *  normal é querer todos; desmarcar é a exceção, e a exceção não pode custar
 *  2.600 cliques.
 *
 *  PAGINADO PORQUE 2.631 CAIXAS DE SELEÇÃO TRAVAM O NAVEGADOR. A grade de
 *  agendas já passou por isso e foi resolvida com montagem por blocos; aqui a
 *  lista é simples e a paginação basta — com busca por nome, para achar um
 *  veículo específico sem percorrer 53 páginas.
 */

import { useEffect, useMemo, useState } from 'react';

import {
  conferirPlanilhaDoScore,
  importarPlanilhaDoScore,
  listarFontesDoScore,
} from '@/api/cliente';
import type { ConferenciaDaPlanilhaDoScore, VeiculoNovo } from '@/api/cliente';
import type { FonteDoScore, ImportacaoDoScore } from '@/dominio/score';
import {
  Botao,
  CampoDeArquivo,
  Cartao,
  FaixaDeErro,
  Secao,
  estiloDeEntrada,
} from '@/componentes/basicos';
import { Paginacao } from '@/componentes/Paginacao';
import { numero } from '@/dominio/formato';
import { ROTULO_DO_AVISO, ROTULO_DO_DESCARTE } from '@/dominio/score';

/** Quantos veículos por página.
 *
 *  CINQUENTA, e não 10 como nas listas de cadastro: aqui a pessoa está
 *  conferindo em lote, não procurando um registro. Com 2.631 veículos, 50 por
 *  página dão 53 páginas — e quem quer um específico usa a busca.
 */
const POR_PAGINA = 50;

/** O rótulo de cada fonte no seletor, com o que ela alimenta.
 *
 *  O CÓDIGO DA FONTE NÃO DIZ NADA a quem sobe a planilha: `approach_cm` é o
 *  Community Management, e quem recebe o anexo por e-mail conhece "Approach" e
 *  "a aba CM". O nome vem do servidor; esta tabela acrescenta de qual ARQUIVO
 *  cada uma lê, que é o que a pessoa tem na mão.
 */
const ARQUIVO_DA_FONTE: Record<string, string> = {
  clipei: 'o export da Clipei',
  clipei_investidores: 'o export da Clipei (recortado)',
  bites: 'o export da Bites',
  approach_sl: 'o export da Approach, aba SL',
  approach_cm: 'o export da Approach, aba CM',
};

/** O resumo de uma fonte, como a tela o lê — de uma conferência ou de uma
 *  subida. O MESMO MOLDE para as duas, porque a conferência promete o que a
 *  subida faz. */
function LinhaDoResumo({ resumo }: { resumo: ImportacaoDoScore }) {
  //: `Object.entries` COM TIPO EXPLÍCITO: sem ele o valor sai como `unknown` e
  //: a comparação não compila. É o preço de `Record<string, number>` vindo da
  //: API — o servidor devolve um mapa de motivo -> contagem, e os motivos são
  //: abertos de propósito (um descarte novo não precisa de mudança no front).
  const descartes: [string, number][] = Object.entries(resumo.descartes ?? {});
  const avisos: [string, number][] = Object.entries(resumo.avisos ?? {});
  const comDescarte = descartes.filter(([, q]) => q > 0);
  const comAviso = avisos.filter(([, q]) => q > 0);
  return (
    <li style={{ padding: '10px 0', borderTop: '1px solid var(--borda)' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 13 }}>{resumo.nome}</strong>
        <span style={{ fontSize: 12, color: 'var(--cinza-2)' }}>
          {numero(resumo.ingeridas)} de {numero(resumo.linhas)} linhas
          {resumo.meses.length ? ` · ${resumo.meses.join(', ')}` : null}
        </span>
        {/* O "ANTES" DEIXA VISÍVEL UM MÊS QUE ENCOLHEU: a subida SUBSTITUI o
            mês, e um export baixado antes do fechamento troca 300 menções por
            80 sem avisar. */}
        {resumo.antes > resumo.ingeridas ? (
          <span style={{ fontSize: 12, color: 'var(--atencao-fg)' }}>
            este mês tinha {numero(resumo.antes)} — vai encolher
          </span>
        ) : null}
      </div>
      {comDescarte.length ? (
        <div style={{ fontSize: 12, color: 'var(--cinza-2)', marginTop: 2 }}>
          fora:{' '}
          {comDescarte
            .map(([motivo, q]) => `${numero(q)} ${ROTULO_DO_DESCARTE[motivo] ?? motivo}`)
            .join(' · ')}
        </div>
      ) : null}
      {comAviso.length ? (
        <div style={{ fontSize: 12, color: 'var(--atencao-fg)', marginTop: 2 }}>
          {comAviso
            .map(([motivo, q]) => `${numero(q)} ${ROTULO_DO_AVISO[motivo] ?? motivo}`)
            .join(' · ')}
        </div>
      ) : null}
    </li>
  );
}

export function BaseDoScore() {
  const [fontes, definirFontes] = useState<FonteDoScore[] | null>(null);
  const [codigo, definirCodigo] = useState('');
  const [arquivo, definirArquivo] = useState<File | null>(null);
  const [conferencia, definirConferencia] = useState<ConferenciaDaPlanilhaDoScore | null>(
    null,
  );
  const [aplicado, definirAplicado] = useState<ImportacaoDoScore[] | null>(null);
  const [desmarcados, definirDesmarcados] = useState<Set<string>>(new Set());
  const [busca, definirBusca] = useState('');
  const [pagina, definirPagina] = useState(1);
  const [ocupado, definirOcupado] = useState(false);
  const [erro, definirErro] = useState<string | null>(null);

  //: A BUSCA DAS FONTES NUM EFEITO, e não no corpo do render: no corpo ela
  //: dispararia a cada repintura — uma por tecla digitada na busca de veículo.
  useEffect(function carregarAsFontes() {
    void listarFontesDoScore(new Date().toISOString().slice(0, 7))
      .then((lidas) => {
        // SÓ AS QUE LEEM PLANILHA: a fonte `crm` é interna (o dado já está
        // neste banco), e oferecê-la num seletor de upload seria oferecer um
        // caminho que o servidor recusa.
        const externas = lidas.filter((f) => !f.interna);
        definirFontes(externas);
        definirCodigo((atual) => atual || externas[0]?.codigo || '');
      })
      .catch((falha) =>
        definirErro(
          falha instanceof Error ? falha.message : 'Não consegui listar as fontes.',
        ),
      );
  }, []);

  //: `?? []` CRIA UM ARRAY NOVO A CADA RENDER, e o `useMemo` abaixo
  //: dependeria de uma referencia sempre diferente — filtrando 2.631 nomes
  //: a cada tecla digitada. Memoizar na conferencia resolve na origem.
  const novos = useMemo(() => conferencia?.veiculos_novos ?? [], [conferencia]);
  //: O FILTRO ACIMA DE QUALQUER `return`: um `useMemo` depois de uma saída
  //: antecipada muda a ordem dos hooks entre renders, que é erro de React e
  //: não questão de estilo.
  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return termo ? novos.filter((v) => v.nome.toLowerCase().includes(termo)) : novos;
  }, [novos, busca]);

  if (fontes === null) {
    return erro ? <FaixaDeErro mensagem={erro} /> : <Cartao>Carregando as fontes…</Cartao>;
  }
  const totalDePaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const daPagina = filtrados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);
  const marcados = novos.filter((v) => !desmarcados.has(v.nome));

  function limpar() {
    definirConferencia(null);
    definirAplicado(null);
    definirDesmarcados(new Set());
    definirBusca('');
    definirPagina(1);
    definirErro(null);
  }

  async function conferir(escolhido: File) {
    definirArquivo(escolhido);
    limpar();
    definirOcupado(true);
    try {
      definirConferencia(await conferirPlanilhaDoScore(codigo, escolhido));
    } catch (falha) {
      definirErro(falha instanceof Error ? falha.message : 'Não consegui ler a planilha.');
    } finally {
      definirOcupado(false);
    }
  }

  async function aplicar() {
    if (!arquivo) return;
    definirOcupado(true);
    definirErro(null);
    try {
      definirAplicado(
        await importarPlanilhaDoScore(
          codigo,
          arquivo,
          marcados.map((v) => v.nome),
        ),
      );
      definirConferencia(null);
    } catch (falha) {
      // A CONFERÊNCIA MORRE JUNTO: a recusa pede um arquivo novo, e deixar a
      // lista velha com o botão ativo convidaria a repetir o que foi recusado.
      definirConferencia(null);
      definirErro(falha instanceof Error ? falha.message : 'Não consegui aplicar.');
    } finally {
      definirOcupado(false);
    }
  }

  function alternar(nome: string) {
    definirDesmarcados((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(nome)) proximo.delete(nome);
      else proximo.add(nome);
      return proximo;
    });
  }

  const fonte = fontes.find((f) => f.codigo === codigo);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {erro ? <FaixaDeErro mensagem={erro} /> : null}

      <Secao
        titulo="Subir a planilha do fornecedor"
        subtitulo="Subir SUBSTITUI os meses que a planilha traz — o mês que ela não traz fica intacto. Conferir não grava nada."
      >
        <Cartao>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(220px, 1fr) minmax(240px, 1.2fr)',
              gap: 14,
              alignItems: 'end',
            }}
          >
            <label style={{ display: 'grid', gap: 5 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>1. De qual fonte</span>
              <select
                style={estiloDeEntrada}
                value={codigo}
                disabled={ocupado}
                onChange={(evento) => {
                  definirCodigo(evento.target.value);
                  limpar();
                  definirArquivo(null);
                }}
              >
                {fontes.map((f) => (
                  <option key={f.codigo} value={f.codigo}>
                    {f.nome}
                  </option>
                ))}
              </select>
              {fonte ? (
                <span style={{ fontSize: 11, color: 'var(--cinza-2)' }}>
                  Lê {ARQUIVO_DA_FONTE[fonte.codigo] ?? 'o export deste fornecedor'}.
                  {/* UM ARQUIVO ALIMENTA MAIS DE UMA FONTE, e a pessoa precisa
                      saber antes: subir pela Clipei também atualiza o Mercado. */}
                </span>
              ) : null}
            </label>

            <div style={{ display: 'grid', gap: 5 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>2. A planilha</span>
              <CampoDeArquivo
                valor={arquivo}
                aceitar=".xlsx"
                desabilitado={ocupado || !codigo}
                ariaLabel="Planilha do fornecedor"
                rotuloDoBotao="Escolher a planilha"
                textoVazio="Nenhuma planilha escolhida"
                aoEscolher={(escolhido) => {
                  if (escolhido) void conferir(escolhido);
                  else definirArquivo(null);
                }}
              />
              <span style={{ fontSize: 11, color: 'var(--cinza-2)' }}>
                Escolher já mostra o que mudaria. Nada é gravado neste passo.
              </span>
            </div>
          </div>

          {ocupado && !conferencia ? (
            <p style={{ fontSize: 12, color: 'var(--cinza-2)', margin: '12px 0 0' }}>
              Lendo a planilha…
            </p>
          ) : null}

          {aplicado ? (
            <div
              role="status"
              style={{
                marginTop: 14,
                padding: '12px 14px',
                borderRadius: 'var(--r-card-int)',
                background: 'var(--ok-bg)',
                color: 'var(--ok-fg)',
                fontSize: 13,
              }}
            >
              Pronto.{' '}
              {/* O NÚMERO DE VEÍCULOS VEM DE UMA LINHA SÓ, e não da soma: ele é
                  da SUBIDA, e vem repetido em cada fonte irmã com o mesmo
                  valor. Somar diria o dobro do que nasceu. */}
              {aplicado[0]?.veiculos_criados
                ? `${numero(aplicado[0].veiculos_criados)} veículos cadastrados. `
                : null}
              {aplicado
                .map((r) => `${r.nome}: ${numero(r.ingeridas)} menções`)
                .join(' · ')}
              .
            </div>
          ) : null}
        </Cartao>
      </Secao>

      {conferencia ? (
        <>
          <Secao titulo="O que vai entrar">
            <Cartao>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {conferencia.previsao.map((resumo) => (
                  <LinhaDoResumo key={resumo.fonte} resumo={resumo} />
                ))}
              </ul>
            </Cartao>
          </Secao>

          <Secao
            titulo={`Veículos novos (${numero(marcados.length)} de ${numero(novos.length)} marcados)`}
            subtitulo={
              novos.length
                ? 'Eles não estão no Cadastro compartilhado e serão criados como Imprensa, com a praça e o alcance que o fornecedor informou. A lógica editorial (econômica, geral, regional) fica para você definir no cadastro — é dela que a lente de Mercado depende.'
                : 'Todos os veículos desta planilha já estão no Cadastro compartilhado.'
            }
          >
            <Cartao>
              {novos.length === 0 ? (
                <p style={{ fontSize: 13, margin: 0 }}>
                  Nada a cadastrar: o cadastro já reconhece os{' '}
                  {numero(conferencia.veiculos_reconhecidos)} veículos da planilha.
                </p>
              ) : (
                <>
                  <div
                    style={{
                      display: 'flex',
                      gap: 10,
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      marginBottom: 12,
                    }}
                  >
                    <input
                      style={{ ...estiloDeEntrada, maxWidth: 280 }}
                      value={busca}
                      placeholder="Buscar um veículo…"
                      aria-label="Buscar um veículo na lista"
                      onChange={(evento) => {
                        definirBusca(evento.target.value);
                        definirPagina(1);
                      }}
                    />
                    {/* MARCAR E DESMARCAR TODOS, porque desmarcar 2.600 um a um
                        não é uma opção — e o caso de quem quer só alguns é
                        "desmarcar todos, buscar, marcar os três". */}
                    <Botao
                      aoClicar={() => definirDesmarcados(new Set())}
                      desabilitado={ocupado || desmarcados.size === 0}
                    >
                      Marcar todos
                    </Botao>
                    <Botao
                      aoClicar={() => definirDesmarcados(new Set(novos.map((v) => v.nome)))}
                      desabilitado={ocupado || desmarcados.size === novos.length}
                    >
                      Desmarcar todos
                    </Botao>
                    <span style={{ fontSize: 12, color: 'var(--cinza-2)' }}>
                      {numero(conferencia.veiculos_reconhecidos)} já cadastrados
                    </span>
                  </div>

                  <ul
                    style={{
                      listStyle: 'none',
                      margin: 0,
                      padding: 0,
                      border: '1px solid var(--borda)',
                      borderRadius: 'var(--r-card-int)',
                      background: 'var(--branco)',
                    }}
                  >
                    {daPagina.map((veiculo) => (
                      <LinhaDoVeiculo
                        key={veiculo.nome}
                        veiculo={veiculo}
                        marcado={!desmarcados.has(veiculo.nome)}
                        aoAlternar={() => alternar(veiculo.nome)}
                      />
                    ))}
                  </ul>

                  {filtrados.length === 0 ? (
                    <p style={{ fontSize: 13, margin: '10px 0 0' }}>
                      Nenhum veículo novo com esse nome.
                    </p>
                  ) : null}

                  {totalDePaginas > 1 ? (
                    <div style={{ marginTop: 12 }}>
                      <Paginacao
                        pagina={pagina}
                        totalDePaginas={totalDePaginas}
                        aoMudarPagina={definirPagina}
                      />
                    </div>
                  ) : null}
                </>
              )}

              <div
                style={{
                  display: 'flex',
                  gap: 10,
                  justifyContent: 'flex-end',
                  marginTop: 16,
                }}
              >
                <Botao variante="fantasma" aoClicar={limpar} desabilitado={ocupado}>
                  Cancelar
                </Botao>
                <Botao variante="primario" aoClicar={aplicar} desabilitado={ocupado}>
                  {/* O RÓTULO DIZ AS DUAS COISAS QUE VÃO ACONTECER: as menções
                      entram e os veículos nascem. Um "Confirmar" sozinho
                      esconderia a criação de 2.631 cadastros atrás de uma
                      palavra. */}
                  {marcados.length
                    ? `Subir e cadastrar ${numero(marcados.length)} veículos`
                    : 'Subir sem cadastrar veículo'}
                </Botao>
              </div>
            </Cartao>
          </Secao>
        </>
      ) : null}
    </div>
  );
}

function LinhaDoVeiculo({
  veiculo,
  marcado,
  aoAlternar,
}: {
  veiculo: VeiculoNovo;
  marcado: boolean;
  aoAlternar: () => void;
}) {
  return (
    <li style={{ borderTop: '1px solid var(--borda)' }}>
      <label
        style={{
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          padding: '8px 12px',
          cursor: 'pointer',
        }}
      >
        <input
          type="checkbox"
          checked={marcado}
          onChange={aoAlternar}
          // O NOME NO RÓTULO ACESSÍVEL, porque "marcar" repetido 50 vezes na
          // mesma página não distingue o que se está marcando.
          aria-label={`Cadastrar ${veiculo.nome}`}
        />
        <span style={{ flex: 1, minWidth: 0, fontSize: 13 }}>{veiculo.nome}</span>
        <span
          style={{
            fontSize: 11,
            color: 'var(--cinza-2)',
            whiteSpace: 'nowrap',
          }}
        >
          {[veiculo.uf, veiculo.esfera].filter(Boolean).join(' · ') || 'sem praça'}
        </span>
        <span
          style={{
            fontSize: 11,
            color: 'var(--cinza-3)',
            fontVariantNumeric: 'tabular-nums',
            minWidth: 70,
            textAlign: 'right',
          }}
        >
          {numero(veiculo.mencoes)} menç.
        </span>
      </label>
    </li>
  );
}
