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
import { Abas } from '@/componentes/Abas';
import type { Aba } from '@/componentes/Abas';
import { Paginacao } from '@/componentes/Paginacao';
import { VeiculosDeInvestidores } from '@/paginas/score/VeiculosDeInvestidores';
import { numero } from '@/dominio/formato';
import { ROTULO_DO_AVISO, ROTULO_DO_DESCARTE } from '@/dominio/score';

/** Quantos veículos por página.
 *
 *  CINQUENTA, e não 10 como nas listas de cadastro: aqui a pessoa está
 *  conferindo em lote, não procurando um registro. Com 2.631 veículos, 50 por
 *  página dão 53 páginas — e quem quer um específico usa a busca.
 */
const POR_PAGINA = 50;

/** O SELETOR OFERECE ARQUIVOS, E NÃO FONTES.
 *
 *  `score_fonte` é a alimentação de uma LENTE, não um fornecedor: o export da
 *  Clipei alimenta `clipei` (Imprensa, peso 30) E `clipei_investidores`
 *  (Mercado, peso 20) — o mesmo arquivo, contado em duas lentes com pesos
 *  diferentes. Oferecer as duas num seletor de upload oferecia uma escolha que
 *  não existe: ninguém tem "a planilha da Clipei de investidores" na mão, e
 *  quem escolhesse a segunda subiria o arquivo inteiro achando que subia um
 *  recorte. O servidor já ingere em todas as fontes irmãs de uma vez.
 *
 *  O ARQUIVO VEM DO SERVIDOR, em `FonteDoScore.arquivo` — é a chave `arquivo`
 *  do `mapeamento_colunas` de cada fonte. Esta tabela só lhe dá o nome que a
 *  pessoa usa ao falar do anexo que recebeu.
 */
const NOME_DO_ARQUIVO: Record<string, string> = {
  clipei: 'Clipei',
  bites: 'Bites',
  approach: 'Approach',
};

/** O nome de cada lente, para dizer o que a subida vai mexer.
 *
 *  AQUI, E NÃO DO SERVIDOR: a lista de fontes manda o CÓDIGO da lente, e os
 *  nomes moram em `/api/score/opcoes` — que esta tela não busca. Buscar as
 *  opções inteiras para escrever três palavras num aviso seria uma requisição
 *  a mais em cada abertura da Base.
 */
const NOME_DA_LENTE: Record<string, string> = {
  imprensa: 'Imprensa',
  mercado: 'Mercado',
  sociedade: 'Sociedade digital',
  clientes: 'Clientes',
  institucional: 'Institucional',
};

/** Um arquivo de fornecedor, com as fontes que ele alimenta. */
interface ArquivoDeFornecedor {
  /** O código da fonte por onde a subida é feita. Qualquer irmã serviria — o
   *  servidor ingere o arquivo em todas as fontes do mesmo arquivo —, e é a
   *  PRIMEIRA que o servidor manda, para a tela não escolher por conta. */
  codigo: string;
  rotulo: string;
  /** Os nomes das lentes que este arquivo alimenta, na ordem do servidor. */
  lentes: string[];
}

/** Agrupa as fontes pelo arquivo que cada uma lê.
 *
 *  A FONTE SEM `arquivo` FICA SOZINHA, com o próprio nome: é o que acontece
 *  numa fonte nova cujo mapeamento ainda não traz a chave, e esconder o upload
 *  dela seria pior do que mostrá-la separada.
 */
function porArquivo(fontes: FonteDoScore[]): ArquivoDeFornecedor[] {
  const agrupadas: ArquivoDeFornecedor[] = [];
  const indice = new Map<string, ArquivoDeFornecedor>();
  for (const fonte of fontes) {
    //: A LENTE SEM NOME NÃO ENTRA NA FRASE. Uma lente nova no servidor chega
    //: aqui como código, e "Alimenta a lente undefined" seria pior do que não
    //: dizer nada — o seletor continua funcionando sem o aviso.
    const nomeDaLente = NOME_DA_LENTE[fonte.lente] ?? '';
    const chave = fonte.arquivo ?? `fonte:${fonte.codigo}`;
    const existente = indice.get(chave);
    if (existente) {
      if (nomeDaLente && !existente.lentes.includes(nomeDaLente)) {
        existente.lentes.push(nomeDaLente);
      }
      continue;
    }
    const grupo: ArquivoDeFornecedor = {
      codigo: fonte.codigo,
      rotulo: fonte.arquivo ? (NOME_DO_ARQUIVO[fonte.arquivo] ?? fonte.arquivo) : fonte.nome,
      lentes: nomeDaLente ? [nomeDaLente] : [],
    };
    indice.set(chave, grupo);
    agrupadas.push(grupo);
  }
  return agrupadas;
}

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

/** As duas coisas que se faz na Base.
 *
 *  DUAS ABAS, e não uma seção embaixo da outra: subir uma planilha é um gesto
 *  de todo mês, e manter a lista de veículos de investidores é raro e de outra
 *  natureza — é curadoria de cadastro. Empilhadas, a lista de 81 nomes ficaria
 *  entre quem sobe a planilha e o resultado da conferência.
 */
type IdDaSubaba = 'planilha' | 'investidores';

const ABAS_DA_BASE: readonly Aba<IdDaSubaba>[] = [
  { id: 'planilha', rotulo: 'Subir planilha' },
  { id: 'investidores', rotulo: 'Veículos de investidores' },
];

/** O que a planilha diz de ASSUNTO, e o que o cadastro reconhece.
 *
 *  POR QUE ISTO APARECE NA CONFERÊNCIA. O dossiê recorta por Pilar (N1), Tema
 *  estratégico (N2) e Subtema (N3) pelo vínculo da menção com o tema do
 *  cadastro — e quem decide o vínculo é o nome que vem na planilha. Menção sem
 *  vínculo não entra em recorte nenhum: subir um arquivo cujo assunto não casa
 *  é subir dado que nenhum filtro alcança, e descobrir isso depois significa
 *  olhar um gráfico vazio sem saber por quê.
 *
 *  SÓ APARECE QUANDO HÁ O QUE DIZER. Fonte que não manda assunto nenhum não
 *  ganha uma seção vazia na tela.
 */
function SecaoDosAssuntos({
  conferencia,
}: {
  conferencia: ConferenciaDaPlanilhaDoScore;
}) {
  const comTema = conferencia.mencoes_com_tema ?? 0;
  const semAssunto = conferencia.mencoes_sem_assunto ?? 0;
  const naoReconhecidos = conferencia.assuntos_nao_reconhecidos ?? [];
  if (!comTema && !semAssunto && naoReconhecidos.length === 0) return null;

  const total = conferencia.previsao[0]?.linhas ?? 0;
  return (
    <Secao
      titulo="Assuntos"
      subtitulo="O assunto da planilha é casado com o cadastro de temas pelo nome. É o vínculo que faz o dossiê filtrar por Pilar, Tema estratégico e Subtema — e dele saem também os riscos, sem a planilha informar nada além do subtema."
    >
      <Cartao>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 13 }}>
          <span>
            <strong>{numero(comTema)}</strong> acham o assunto no cadastro
            {total ? ` de ${numero(total)} linhas` : ''}
          </span>
          {semAssunto ? (
            <span style={{ color: 'var(--cinza-2)' }}>
              {numero(semAssunto)} vêm sem assunto
            </span>
          ) : null}
        </div>

        {naoReconhecidos.length ? (
          <>
            <p style={{ fontSize: 12, color: 'var(--atencao-fg)', margin: '12px 0 8px' }}>
              {/* OS DOIS CONSERTOS SÃO EM LUGARES DIFERENTES, e por isso a
                  linha diz qual é qual: nome errado se arruma na planilha com
                  o fornecedor; tema desativado se arruma no cadastro — ou é a
                  planilha que está usando a taxonomia antiga. */}
              Estes nomes o cadastro não reconhece. As menções deles entram, mas
              ficam fora de qualquer recorte por tema.
            </p>
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
              {naoReconhecidos.map((assunto) => (
                <li
                  key={assunto.nome}
                  style={{
                    borderTop: '1px solid var(--borda)',
                    display: 'flex',
                    gap: 10,
                    alignItems: 'center',
                    padding: '7px 12px',
                    fontSize: 13,
                  }}
                >
                  <span style={{ flex: 1, minWidth: 0 }}>{assunto.nome}</span>
                  {assunto.desativado ? (
                    <span style={{ fontSize: 11, color: 'var(--atencao-fg)' }}>
                      existe no cadastro, mas está desativado
                    </span>
                  ) : null}
                  <span
                    style={{
                      fontSize: 11,
                      color: 'var(--cinza-3)',
                      fontVariantNumeric: 'tabular-nums',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {numero(assunto.mencoes)} menç.
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </Cartao>
    </Secao>
  );
}

export function BaseDoScore() {
  const [subaba, definirSubaba] = useState<IdDaSubaba>('planilha');
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

  //: O PAINEL DA PLANILHA NUMA FUNÇÃO, e não direto no `return`: a régua de
  //: abas tem de aparecer enquanto as fontes carregam — senão a aba dos
  //: veículos de investidores, que não depende delas, ficaria inacessível
  //: atrás de um "Carregando as fontes…".
  function painelDaPlanilha() {
    if (fontes === null) {
      return erro ? (
        <FaixaDeErro mensagem={erro} />
      ) : (
        <Cartao>Carregando as fontes…</Cartao>
      );
    }
    //: DENTRO DA FUNÇÃO, depois da guarda: o agrupamento só existe quando as
    //: fontes chegaram, e lá fora `fontes` ainda pode ser `null`.
    const arquivos = porArquivo(fontes);
    const arquivoEscolhido = arquivos.find((a) => a.codigo === codigo);
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
                <span style={{ fontSize: 12, fontWeight: 600 }}>1. De qual fornecedor</span>
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
                  {arquivos.map((a) => (
                    <option key={a.codigo} value={a.codigo}>
                      {a.rotulo}
                    </option>
                  ))}
                </select>
                {arquivoEscolhido?.lentes.length ? (
                  <span style={{ fontSize: 11, color: 'var(--cinza-2)' }}>
                    {/* QUAIS LENTES ESTE ARQUIVO ALIMENTA, dito antes de subir:
                        o export da Clipei atualiza Imprensa E Mercado, e quem
                        sobe precisa saber que mexeu nos dois. */}
                    {arquivoEscolhido.lentes.length > 1
                      ? `Alimenta as lentes ${arquivoEscolhido.lentes.join(' e ')}.`
                      : `Alimenta a lente ${arquivoEscolhido.lentes[0]}.`}
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

            <SecaoDosAssuntos conferencia={conferencia} />

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Abas
        abas={ABAS_DA_BASE}
        ativa={subaba}
        aoTrocar={definirSubaba}
        rotulo="O que fazer na Base"
        prefixo="base"
      />
      {/* MONTA E DESMONTA, como a Administração: a lista de veículos lê o
          catálogo a cada volta, e o painel da planilha guarda a conferência
          em estado — que é justamente o que se quer descartar ao sair dele. */}
      <div
        role="tabpanel"
        id={`painel-${subaba}`}
        aria-labelledby={`base-${subaba}`}
        tabIndex={-1}
      >
        {subaba === 'investidores' ? <VeiculosDeInvestidores /> : painelDaPlanilha()}
      </div>
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
          {/* O CARGO PRIMEIRO, quando vem: é o que decide o público do
              perfil no cadastro, e é a informação que faz alguém reconhecer
              "Iriel Sachet — Vereador" sem sair da tela para procurar. */}
          {[veiculo.cargo, veiculo.uf, veiculo.esfera].filter(Boolean).join(' · ') ||
            'sem praça'}
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
