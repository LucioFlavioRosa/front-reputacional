/**  OS CADASTROS QUE NASCERAM DE PLANILHA E ESPERAM CONFERÊNCIA.
 *
 *  PEDIDO DO DONO DO PRODUTO (11/10/2026), cobrado duas vezes:
 *
 *    "Quando subirmos uma base que tenha algum ponto de conferência de cadastro,
 *    pode subir sem problemas. Porém, dentro de cada uma das 3 abas de Cadastro
 *    compartilhado, uma aba específica para cadastros que precisam de serem
 *    revisados para serem consolidados na base de instituições, contatos, temas e
 *    representantes da Aegea. Assim o profissional consegue subir a planilha sem
 *    problemas e pode revisar depois, e inclusive pode ser trabalho de outra
 *    pessoa. Queremos dar padronização, mas com menor impacto."
 *
 *  "MENOR IMPACTO" É O QUE DESENHA ESTA TELA. Ela não pede nada: não há campo
 *  obrigatório, não há formulário, e nada aqui impede a planilha de subir — isso
 *  já aconteceu. O que ela faz é MOSTRAR o que entrou sem conferência e deixar
 *  dizer "este está certo". Padronização que trava a entrada do dado é
 *  padronização que faz a pessoa registrar em outro lugar.
 *
 *  A LISTA É UMA FILA, e não um relatório: cada "Está certo" tira uma linha, e a
 *  seção desaparece quando chega a zero — o mesmo desenho de `FilaDeDuplicados`,
 *  pela mesma razão.
 *
 *  O `contexto` AO LADO DO NOME é a linha mais importante da tela. O motivo mais
 *  frequente é "apareceu em 2 instituições na mesma planilha", que cria DOIS
 *  cadastros com o mesmo nome, de propósito. Sem a instituição ao lado, a fila
 *  mostraria "Artur Santa" duas vezes, com o mesmo motivo, e quem revisa não
 *  teria como saber qual é o do Banco XP e qual é o da XP Asset.
 *
 *  E O LOTE EXISTE PORQUE OS NÚMEROS SÃO REAIS. Subir a planilha de Relações com
 *  Investidores deixou 499 pendências nesta aba: 178 INSTITUIÇÕES, todas como
 *  "Entidade", e 321 contatos. A resposta para quase todas as instituições é a
 *  MESMA categoria, e cento e setenta e oito idas à lista de cadastro para
 *  digitar a mesma coisa não é revisão: é a pessoa desistindo na décima, com a
 *  base meio classificada, que é pior do que não classificada porque ninguém
 *  sabe onde parou.
 *
 *  OS DOIS NÚMEROS IMPORTAM, e por isso estão os dois aqui: 499 é o que a tela
 *  DESENHA, e é o que o teto de renderização e a busca resolvem; 178 é o que o
 *  LOTE alcança, porque só instituição tem categoria de público.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  consolidarCadastro,
  enquadrarEmLote,
  filaDeRevisao,
  type AbaDeRevisao,
  type CadastroPendente,
  type EnquadramentoRecusado,
} from '@/api/cliente';
import {
  Botao,
  Campo,
  Carregando,
  Cartao,
  FaixaDeErro,
  Secao,
  estiloDeEntrada,
} from '@/componentes/basicos';
import { catalogoMudou } from '@/dominio/sincronizacao';
import { FichaDoPendente } from '@/paginas/cadastroCompartilhado/FichaDoPendente';
import { usePainel } from '@/estado/painel';

/** Qual das três abas de Cadastro compartilhado está pedindo a sua fila. */
export type AbaDoCadastro = 'instituicoes' | 'assuntos' | 'porta_vozes';

//: O rótulo de cada tabela, para a linha dizer de que cadastro ela é.
//:
//: SÓ A ABA `instituicoes` MOSTRA ISSO, e por isso o rótulo existe: ela junta
//: DUAS tabelas — a instituição e a pessoa que fala por ela. Nas outras duas a
//: aba já diz o que é, e repetir "Tema" em cada linha seria ruído.
const ROTULO_DA_TABELA: Record<string, string> = {
  instituicao: 'Instituição',
  interlocutor: 'Contato',
  tema: 'Tema',
  pessoa_aegea: 'Representante',
};

const MOTIVO_GENERICO =
  'Entrou por planilha e ninguém conferiu o enquadramento ainda.';

//: QUANTAS LINHAS A TELA DESENHA DE UMA VEZ.
//:
//: O TETO É DE RENDERIZAÇÃO, e não de seleção: "Selecionar todas" pega tudo o
//: que a busca encontrou, inclusive o que não está desenhado. É a divisão certa —
//: desenhar 499 linhas é problema de tela, enquadrar as 178 instituições é a
//: operação que a pessoa veio fazer.
//:
//: 30 porque é o que cabe numa rolagem curta. Sem teto, a fila real desenha 499
//: blocos a cada recarga, e a recarga acontece a cada escrita de catálogo.
const LIMITE_NA_TELA = 30;

//: O MESMO TETO DO SERVIDOR (`MAXIMO_DO_LOTE`), repetido aqui para a tela avisar
//: ANTES de mandar — um 422 depois de selecionar 600 linhas é trabalho perdido.
const MAXIMO_DO_LOTE = 500;

function quantos(n: number): string {
  return n === 1 ? '1 cadastro' : `${n} cadastros`;
}

function chaveDe(pendente: CadastroPendente): string {
  return `${pendente.tipo}:${pendente.id}`;
}

/** Casa a busca contra tudo o que a linha mostra.
 *
 *  NOME, CONTEXTO E MOTIVO, e não só o nome: com 499 linhas na aba, as buscas
 *  úteis são
 *  "XP" (que casa a instituição E os contatos dela, pelo contexto) e "duas
 *  instituições" (que casa pelo motivo e junta os quatro casos do dia). Buscar só
 *  no nome deixaria a segunda impossível.
 *
 *  SEM ACENTO E SEM CAIXA, porque quem digita "itau" espera achar "Itaú" — e a
 *  fila é cheia de nome acentuado. `normalize('NFD')` separa o acento da letra e
 *  a classe `\p{Diacritic}` o remove.
 */
function casa(pendente: CadastroPendente, busca: string): boolean {
  if (!busca) return true;
  const achatar = (texto: string) =>
    texto
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase();
  const alvo = achatar(
    `${pendente.nome} ${pendente.contexto ?? ''} ${pendente.motivo ?? ''}`,
  );
  //: TODAS AS PALAVRAS, em qualquer ordem: "xp asset" acha "Artur Santa · XP
  //: Asset" mesmo o nome vindo antes do contexto.
  return achatar(busca)
    .split(/\s+/)
    .filter(Boolean)
    .every((parte) => alvo.includes(parte));
}

export function FilaDeRevisao({ aba }: { aba: AbaDoCadastro }) {
  const { catalogo } = usePainel();
  const [fila, definirFila] = useState<AbaDeRevisao | null>(null);
  const [erro, definirErro] = useState('');
  const [emCurso, definirEmCurso] = useState('');
  const [busca, definirBusca] = useState('');
  //: AS CHAVES SELECIONADAS, e não os objetos: a fila é relida a cada escrita de
  //: catálogo, e guardar o objeto deixaria a seleção apontando para linhas de uma
  //: carga anterior.
  const [escolhidas, definirEscolhidas] = useState<Set<string>>(new Set());
  const [categoria, definirCategoria] = useState('');
  const [subcategoria, definirSubcategoria] = useState('');
  const [recusadas, definirRecusadas] = useState<EnquadramentoRecusado[]>([]);
  const [feito, definirFeito] = useState('');
  //: O QUE OUTRA PESSOA JÁ TINHA CONSOLIDADO, para a tela dizer isso em vez de
  //: piscar uma confirmação que não era dela. Ver `consolidarCadastro`.
  const [deOutraPessoa, definirDeOutraPessoa] = useState<string[]>([]);
  //: A LINHA ABERTA NO MODAL, pela chave — não pelo objeto.
  //:
  //: A fila é relida a cada escrita de catálogo, e guardar o objeto deixaria o
  //: diálogo mostrando a ficha de uma carga anterior. Guardando a chave, a
  //: linha é reencontrada na carga de agora; se ela já não existe, o modal diz
  //: isso em vez de editar um fantasma.
  const [aberta, definirAberta] = useState<string | null>(null);

  //: QUAL CARGA É A ATUAL.
  //:
  //: ACHADO DE REVISÃO COM SEVERIDADE MÉDIA, e o mais fino dos quatro: o
  //: conserto de reler ao mudar o cadastro TORNOU ESTA CORRIDA MAIS PROVÁVEL.
  //: A carga A começa; alguém corrige um cadastro na lista abaixo; o barramento
  //: dispara a carga B; B volta com o dado novo; A volta depois, com o dado
  //: velho, e sobrescreve.
  //:
  //: O RESULTADO É A MESMA UI VELHA QUE O CONSERTO EXISTIA PARA MATAR — e numa
  //: rede lenta, que é onde ela mais dói. Só a carga mais recente escreve
  //: estado; as atrasadas são descartadas em silêncio, porque não há nada a
  //: dizer sobre uma resposta que já não interessa.
  const atual = useRef(0);

  const carregar = useCallback(() => {
    const minhaVez = ++atual.current;
    filaDeRevisao()
      .then((abas) => {
        if (minhaVez !== atual.current) return;
        const minha = abas.find((a) => a.id === aba) ?? {
          id: aba,
          rotulo: '',
          pendentes: [],
        };
        definirFila(minha);
        //: A SELEÇÃO É PODADA, e não limpa: quem enquadrou 40 de 178 e vê a fila
        //: recarregar não quer começar de novo, mas uma chave que já não está na
        //: fila é uma linha que outra pessoa resolveu — mantê-la selecionada
        //: mandaria o servidor recusá-la depois.
        const vivas = new Set(minha.pendentes.map(chaveDe));
        definirEscolhidas((antes) => {
          const podadas = new Set([...antes].filter((c) => vivas.has(c)));
          return podadas.size === antes.size ? antes : podadas;
        });
        //: A FILA VAZIOU: nada mais a fazer, e o aviso de quem veio antes já
        //: cumpriu o papel dele. Sem isto, a seção ficaria na tela como
        //: "Esperando conferência (0)" com um aviso permanente até alguém
        //: trocar de aba — achado de revisão.
        if (minha.pendentes.length === 0) definirDeOutraPessoa([]);
        definirErro('');
      })
      .catch((falha: Error) => {
        if (minhaVez !== atual.current) return;
        //: A FILA É ACESSÓRIA: ela não pode derrubar o cadastro inteiro. O erro
        //: aparece no lugar dela e o resto da tela segue funcionando. É também o
        //: que mantém a aba utilizável para quem não tem permissão de
        //: administrar cadastros, e recebe 403 aqui.
        definirFila({ id: aba, rotulo: '', pendentes: [] });
        definirErro(falha.message);
      });
  }, [aba]);

  useEffect(carregar, [carregar]);

  //: E RELÊ QUANDO O CADASTRO MUDA, que é o conserto de um achado de revisão com
  //: severidade MÉDIA — e o defeito era no fluxo que a PRÓPRIA TELA manda seguir.
  //:
  //: O botão diz "se ele estiver errado, corrija na lista abaixo primeiro". Essa
  //: correção vai por `/api/instituicoes` (ou `/interlocutores`, `/temas`,
  //: `/pessoas-aegea`), que são rotas de catálogo — então ela recarregava o
  //: catálogo e NÃO esta fila. A linha aqui em cima continuava mostrando o nome
  //: velho, o contexto velho, e oferecendo "Está certo" sobre uma versão que não
  //: existe mais. Pior no caso de REMOVER: a linha ficava na tela e o botão iria
  //: dar 404.
  //:
  //: E O BARRAMENTO JÁ EXISTIA para exatamente isto: "a garantia mora na rota, e
  //: não em cada tela", diz `sincronizacao.ts`. Esta fila só não o escutava.
  useEffect(() => catalogoMudou.assinar(carregar), [carregar]);

  const encontradas = useMemo(
    () => (fila?.pendentes ?? []).filter((p) => casa(p, busca)),
    [fila, busca],
  );
  //: SÓ INSTITUIÇÃO ENTRA NO LOTE. O enquadramento grava categoria de público, e
  //: `interlocutor`, `tema` e `pessoa_aegea` não têm esse campo — oferecer a
  //: seleção neles seria oferecer o que o servidor vai recusar.
  const enquadraveis = useMemo(
    () => encontradas.filter((p) => p.tipo === 'instituicao'),
    [encontradas],
  );

  //: O CATÁLOGO PODE SER NULO enquanto a primeira carga do painel não voltou, e
  //: a fila não espera por ela: a fila tem rota própria e carrega sozinha. Sem as
  //: categorias o lote não aparece — e é o certo, porque sem elas não há o que
  //: escolher —, mas a lista, a busca e o "Está certo" funcionam.
  const categoriasPublico = catalogo?.dicionarios.categorias_publico ?? [];

  const subcategorias = useMemo(() => {
    const id = Number(categoria);
    return (catalogo?.dicionarios.subcategorias_publico ?? [])
      .filter((s) => s.categoria_publico_id === id)
      .sort((a, b) => a.ordem - b.ordem);
  }, [catalogo, categoria]);

  function alternar(pendente: CadastroPendente) {
    definirEscolhidas((antes) => {
      const proximas = new Set(antes);
      const chave = chaveDe(pendente);
      if (proximas.has(chave)) proximas.delete(chave);
      else proximas.add(chave);
      return proximas;
    });
  }

  async function consolidar(pendente: CadastroPendente) {
    definirEmCurso(chaveDe(pendente));
    definirErro('');
    try {
      const { ja_estava_consolidado } = await consolidarCadastro(
        pendente.tipo,
        pendente.id,
      );
      if (ja_estava_consolidado) {
        definirDeOutraPessoa((antes) => [...antes, pendente.nome]);
      }
      //: RECARREGA A FILA INTEIRA, e não remove a linha na mão: outra pessoa
      //: pode ter consolidado três enquanto esta tela estava aberta, e tirar só
      //: a que foi clicada deixaria as outras duas na tela, clicáveis.
      carregar();
    } catch (falha) {
      definirErro((falha as Error).message);
    } finally {
      definirEmCurso('');
    }
  }

  async function enquadrar() {
    const ids = enquadraveis
      .filter((p) => escolhidas.has(chaveDe(p)))
      .map((p) => p.id);
    definirEmCurso('lote');
    definirErro('');
    definirRecusadas([]);
    definirFeito('');
    try {
      const resultado = await enquadrarEmLote({
        ids,
        categoria_publico_id: Number(categoria),
        subcategoria_publico_id: subcategoria ? Number(subcategoria) : null,
      });
      definirRecusadas(resultado.recusadas);
      definirFeito(
        `${quantos(resultado.enquadradas)} enquadrado${
          resultado.enquadradas === 1 ? '' : 's'
        } e tirado${resultado.enquadradas === 1 ? '' : 's'} da fila.`,
      );
      //: A ROTA DO ENQUADRAMENTO ESTÁ EM `ROTAS_DO_CATALOGO`, então o barramento
      //: recarrega o catálogo E esta fila sozinho — o tipo da instituição mudou, e
      //: com ele a frente de toda agenda dela. Não há `carregar()` aqui por isso.
    } catch (falha) {
      definirErro((falha as Error).message);
    } finally {
      definirEmCurso('');
    }
  }

  if (fila === null) {
    return (
      <Secao titulo="Esperando conferência">
        <Cartao>
          <Carregando rotulo="Procurando cadastros que entraram por planilha…" />
        </Cartao>
      </Secao>
    );
  }

  //: FILA VAZIA NÃO OCUPA TELA, como em `FilaDeDuplicados`: não há nada a fazer,
  //: e um cartão dizendo "nada pendente" seria uma linha a mais para ler em
  //: toda abertura do cadastro.
  if (fila.pendentes.length === 0 && !erro) return null;

  //: O LOTE ESTÁ DISPONÍVEL? Uma condição só, usada no painel E na caixa de
  //: seleção de cada linha.
  //:
  //: ACHADO DE REVISÃO: elas estavam separadas, e sem catálogo (ou sem
  //: categorias) o painel desaparecia e as CAIXAS FICAVAM — um controle órfão.
  //: Dava para marcar linhas "para enquadrar" e não havia ação nenhuma a tomar.
  //: Oferecer uma escolha que não leva a lugar é pior do que não oferecer: quem
  //: marca 40 linhas e depois procura o botão conclui que a tela está quebrada.
  const podeEnquadrar = enquadraveis.length > 0 && categoriasPublico.length > 0;
  //: A LINHA ABERTA NA CARGA DE AGORA, e não a que foi clicada: a fila pode ter
  //: sido relida desde então. `undefined` quando ela saiu da fila — o modal
  //: trata isso dizendo que o cadastro não está mais lá.
  const abertaAgora = aberta
    ? (fila.pendentes.find((p) => chaveDe(p) === aberta) ?? null)
    : null;
  const selecionadas = enquadraveis.filter((p) => escolhidas.has(chaveDe(p)));
  const acima = selecionadas.length > MAXIMO_DO_LOTE;
  const naTela = encontradas.slice(0, LIMITE_NA_TELA);

  return (
    <Secao
      titulo={`Esperando conferência (${fila.pendentes.length})`}
      ajuda={
        'Cadastros que entraram por planilha e ninguém conferiu ainda. Eles já ' +
        'estão em uso — a agenda e a menção apontam para eles —, só falta ' +
        'alguém confirmar o enquadramento. CLIQUE NO NOME para abrir a ficha e ' +
        'corrigir qualquer campo; "Está certo" tira da fila sem mexer em nada.'
      }
    >
      <Cartao>
        {erro ? <FaixaDeErro mensagem={erro} /> : null}

        <div style={{ marginBottom: 12 }}>
          <Campo
            rotulo="Buscar na fila"
            dica="Casa o nome, a instituição ao lado e o motivo."
          >
            <input
              style={estiloDeEntrada}
              value={busca}
              onChange={(e) => definirBusca(e.target.value)}
              placeholder="Parte do nome, da instituição ou do motivo"
            />
          </Campo>
          {busca ? (
            <p
              role="status"
              style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--cinza-2)' }}
            >
              {`${encontradas.length} de ${fila.pendentes.length} na busca.`}
            </p>
          ) : null}
        </div>

        {/* O LOTE, e só na aba de instituições: é lá que a categoria de público
            existe. Ver `enquadraveis`. */}
        {podeEnquadrar ? (
          <div
            style={{
              borderTop: '1px solid var(--cinza-0)',
              paddingTop: 12,
              marginBottom: 4,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: 10,
                flexWrap: 'wrap',
              }}
            >
              <Campo
                rotulo="Enquadrar as selecionadas como"
                ajuda={
                  'A categoria de público decide o TIPO da instituição, e o tipo ' +
                  'é o que diz de que frente é cada agenda dela. Enquadrar um ' +
                  'lote reclassifica as agendas de todas as instituições dele.'
                }
              >
                <select
                  style={estiloDeEntrada}
                  value={categoria}
                  onChange={(e) => {
                    definirCategoria(e.target.value);
                    //: A SUBCATEGORIA É DEPENDENTE: trocar a categoria sem
                    //: limpá-la mandaria um par que o servidor recusa — e
                    //: recusaria o lote inteiro, antes de gravar nada.
                    definirSubcategoria('');
                  }}
                >
                  <option value="">Escolha a categoria de público</option>
                  {categoriasPublico.map((opcao) => (
                    <option key={opcao.id} value={opcao.id}>
                      {opcao.nome}
                    </option>
                  ))}
                </select>
              </Campo>

              {subcategorias.length > 0 ? (
                <Campo rotulo="Subcategoria (opcional)">
                  <select
                    style={estiloDeEntrada}
                    value={subcategoria}
                    onChange={(e) => definirSubcategoria(e.target.value)}
                  >
                    <option value="">Sem subcategoria</option>
                    {subcategorias.map((opcao) => (
                      <option key={opcao.id} value={opcao.id}>
                        {opcao.nome}
                      </option>
                    ))}
                  </select>
                </Campo>
              ) : null}

              <Botao
                variante="primario"
                desabilitado={
                  !categoria || selecionadas.length === 0 || acima || emCurso === 'lote'
                }
                aoClicar={() => void enquadrar()}
                rotuloAcessivel={`Enquadrar ${selecionadas.length} instituições selecionadas`}
                titulo={
                  'Grava a categoria nas selecionadas, deriva o tipo de cada uma ' +
                  'e tira todas da fila. O que colidir de nome é recusado com o ' +
                  'motivo, e o resto passa.'
                }
              >
                {emCurso === 'lote'
                  ? 'Enquadrando…'
                  : `Enquadrar ${selecionadas.length}`}
              </Botao>

              <Botao
                aoClicar={() =>
                  definirEscolhidas(
                    selecionadas.length === enquadraveis.length
                      ? new Set()
                      : new Set(enquadraveis.map(chaveDe)),
                  )
                }
                rotuloAcessivel={
                  selecionadas.length === enquadraveis.length
                    ? 'Limpar a seleção'
                    : `Selecionar as ${enquadraveis.length} instituições da busca`
                }
              >
                {selecionadas.length === enquadraveis.length
                  ? 'Limpar seleção'
                  : `Selecionar todas (${enquadraveis.length})`}
              </Botao>
            </div>

            {acima ? (
              <FaixaDeErro
                mensagem={
                  `Um lote aceita até ${MAXIMO_DO_LOTE} instituições, e há ` +
                  `${selecionadas.length} selecionadas. Use a busca para dividir.`
                }
              />
            ) : null}

            {feito ? (
              <p
                role="status"
                style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--cinza-2)' }}
              >
                {feito}
              </p>
            ) : null}

            {/* AS RECUSADAS, uma a uma e com o motivo. O lote não é
                tudo-ou-nada de propósito: com 178 linhas, uma colisão faria tudo
                falhar e ninguém saberia qual. */}
            {recusadas.length > 0 ? (
              <div style={{ marginTop: 8 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 700 }}>
                  {`${quantos(recusadas.length)} não ${
                    recusadas.length === 1 ? 'pôde' : 'puderam'
                  } ser enquadrado${recusadas.length === 1 ? '' : 's'}:`}
                </p>
                <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                  {recusadas.map((r) => (
                    <li
                      key={r.id}
                      style={{ fontSize: 12, color: 'var(--cinza-2)' }}
                    >
                      <strong>{r.nome}</strong>
                      {` — ${r.motivo}`}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        {deOutraPessoa.length > 0 ? (
          <p
            role="status"
            style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--cinza-2)' }}
          >
            {`Outra pessoa já havia conferido ${quantos(deOutraPessoa.length)}: ` +
              `${deOutraPessoa.join(', ')}.`}
          </p>
        ) : null}

        {encontradas.length === 0 ? (
          <p style={{ margin: '12px 0 0', fontSize: 13, color: 'var(--cinza-2)' }}>
            Nenhum cadastro da fila casa com esta busca.
          </p>
        ) : null}

        {/* A FICHA DO REGISTRO CLICADO.
            Pedido do dono do produto: "clicar em um registro específico e abrir
            um modal para poder editar todos os campos daquele registro". A
            `key` força o diálogo a remontar ao trocar de linha — sem ela, o
            rascunho da anterior ficaria no formulário da seguinte. */}
        {abertaAgora ? (
          <FichaDoPendente
            key={chaveDe(abertaAgora)}
            pendente={abertaAgora}
            aoFechar={() => {
              definirAberta(null);
              //: RELÊ AO FECHAR, inclusive quando a pessoa só cancelou: outra
              //: pessoa pode ter mexido na fila enquanto o diálogo estava
              //: aberto. Salvar já recarrega pelo barramento do catálogo; isto
              //: cobre o cancelar e o "sumiu".
              carregar();
            }}
          />
        ) : null}

        {naTela.map((pendente) => {
          const chave = chaveDe(pendente);
          const ocupado = emCurso === chave;
          const daInstituicao = pendente.tipo === 'instituicao';
          return (
            <div
              key={chave}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 12,
                flexWrap: 'wrap',
                padding: '12px 0',
                borderTop: '1px solid var(--cinza-0)',
              }}
            >
              {daInstituicao && podeEnquadrar ? (
                <input
                  type="checkbox"
                  checked={escolhidas.has(chave)}
                  onChange={() => alternar(pendente)}
                  aria-label={`Selecionar ${pendente.nome} para enquadrar`}
                  style={{ marginTop: 4 }}
                />
              ) : null}

              <div style={{ flex: 1, minWidth: 220 }}>
                {/* O NOME É O BOTÃO que abre a ficha.
                    Não um ícone de lápis ao lado: o nome é o que a pessoa já
                    está lendo quando decide que aquela linha precisa de atenção,
                    e é o alvo maior da linha. `<button>` de verdade, e não um
                    `<div onClick>`, para chegar por teclado e ser anunciado como
                    botão. */}
                <button
                  type="button"
                  onClick={() => definirAberta(chave)}
                  //: NOME ACESSÍVEL PRÓPRIO, e não só o texto do nome.
                  //:
                  //: A LINHA TEM DOIS BOTÕES e os dois falam do mesmo cadastro:
                  //: este e o "Está certo". Com o nome da pessoa como único
                  //: rótulo, quem ouve a tela recebe "Artur Santa, botão" e
                  //: "Confirmar que o cadastro de Artur Santa está certo,
                  //: botão" — o primeiro não diz o que faz.
                  //:
                  //: E FOI ISSO QUE TRÊS TESTES APONTARAM: eles buscavam o botão
                  //: por `/Artur Santa/`, que passou a casar os DOIS. A colisão
                  //: no teste era a colisão que um leitor de tela teria.
                  aria-label={`Abrir a ficha de ${pendente.nome} para editar`}
                  title="Abrir a ficha deste cadastro para editar todos os campos"
                  style={{
                    border: 'none',
                    background: 'transparent',
                    padding: 0,
                    margin: 0,
                    font: 'inherit',
                    fontSize: 14,
                    fontWeight: 700,
                    color: 'var(--azul-mar)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    textDecorationStyle: 'dotted',
                    textUnderlineOffset: 3,
                  }}
                >
                  {pendente.nome}
                </button>
                {/* A MESMA GRAMÁTICA DA LINHA DO CADASTRO: "Contato · Banco XP ·
                    Diretor", na ordem em que se lê o ator. */}
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--cinza-2)' }}>
                  {aba === 'instituicoes'
                    ? `${ROTULO_DA_TABELA[pendente.tipo] ?? pendente.tipo}${
                        pendente.contexto ? ` · ${pendente.contexto}` : ''
                      }`
                    : (pendente.contexto ?? '')}
                </p>
                <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--cinza-3)' }}>
                  {pendente.motivo ?? MOTIVO_GENERICO}
                </p>
              </div>

              <Botao
                variante="primario"
                desabilitado={ocupado}
                aoClicar={() => void consolidar(pendente)}
                rotuloAcessivel={`Confirmar que o cadastro de ${pendente.nome} está certo`}
                titulo={
                  'Tira este cadastro da fila. Não muda nada no registro — se ' +
                  'ele estiver errado, corrija na lista abaixo primeiro.'
                }
              >
                Está certo
              </Botao>
            </div>
          );
        })}

        {/* O TETO É DE RENDERIZAÇÃO, e a linha abaixo é o que impede ele de
            mentir: sem ela, a pessoa veria 30 linhas e concluiria que a fila tem
            30. A busca é o caminho para alcançar o resto, e o texto diz isso. */}
        {encontradas.length > naTela.length ? (
          <p
            style={{
              margin: '12px 0 0',
              paddingTop: 12,
              borderTop: '1px solid var(--cinza-0)',
              fontSize: 12,
              color: 'var(--cinza-2)',
            }}
          >
            {`Mostrando ${naTela.length} de ${encontradas.length}. Use a busca ` +
              'para chegar aos outros — "Selecionar todas" pega os ' +
              `${enquadraveis.length} da busca, inclusive os que não estão na tela.`}
          </p>
        ) : null}
      </Cartao>
    </Secao>
  );
}
