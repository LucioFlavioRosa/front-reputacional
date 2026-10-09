/** Quais veículos a lente Mercado considera.
 *
 *  POR QUE ESTA ABA EXISTE. A lente Mercado se separava por
 *  `Público-alvo = Investidores`, uma coluna que o fornecedor preenche. Medido
 *  contra o export de 08–09/2026: isso captura 80 linhas onde a lista de
 *  veículos que a Aegea mantém captura 323 — e os dois critérios discordam em
 *  267 das 335 linhas envolvidas. O critério da coluna perde Valor Econômico
 *  (49 menções), InfoMoney (25), Expert XP (20) e Times Brasil (15), que
 *  entrariam só na Imprensa.
 *
 *  O CRITÉRIO É O CADASTRO, e esta aba é como a lista se mantém. A `0066`
 *  semeou os 81 da planilha da Aegea; daqui em diante um veículo entra ou sai
 *  por aqui, sem SQL.
 *
 *  A ABA MOSTRA SÓ OS DE MERCADO. Ela é sobre o mercado financeiro, e não
 *  sobre os 2.670 veículos do cadastro: quem chega aqui quer ver e ajustar
 *  esta lista. Acrescentar é um gesto à parte — o botão "Acrescentar veículo",
 *  que procura no cadastro compartilhado e cadastra o que ainda não existe.
 *
 *  A LISTA SAI DO CATÁLOGO que o app já carregou — as instituições vêm
 *  inteiras no boot, e outras telas dependem disso. Então não há rota de
 *  leitura nova: o que define um veículo de mercado é a subcategoria de
 *  público dele, e o catálogo já a traz.
 *
 *  A GRAVAÇÃO É DECLARATIVA — "estes são os veículos de mercado" —, e não um
 *  alternador por item. `editarInstituicao` exige o cadastro inteiro, e
 *  reenviar nome, tipo, UF e tier para mudar um campo apagaria o que a tela
 *  esquecesse. Além disso é assim que a pessoa pensa: ela tem uma lista
 *  mantida numa planilha e quer que o sistema a reflita.
 */

import { useMemo, useState } from 'react';

import { criarInstituicao, definirVeiculosDeInvestidores } from '@/api/cliente';
import {
  Botao,
  Campo,
  Cartao,
  FaixaDeErro,
  Modal,
  Secao,
  estiloDeEntrada,
} from '@/componentes/basicos';
import { Paginacao } from '@/componentes/Paginacao';
import { numero } from '@/dominio/formato';
import { usePainel } from '@/estado/painel';
import type { Instituicao } from '@/dominio/tipos';

/** A categoria e a subcategoria de público que definem a lente Mercado.
 *
 *  PELO NOME, como no servidor: ids são do banco de cada ambiente, e um número
 *  escrito aqui apontaria para outra subcategoria na base do cliente.
 *
 *  E PELO PAR, não pelo nome da subcategoria sozinho: `subcategoria_publico`
 *  repete nome entre categorias de propósito, então a chave real é
 *  (categoria, subcategoria) — o mesmo par que a rota do servidor exige.
 */
const CATEGORIA_DA_IMPRENSA = 'Imprensa';
const SUBCATEGORIA_DO_MERCADO = 'Econômica e de negócios';

/** Quantos por página. Cinquenta, como a lista de veículos novos da Base: aqui
 *  se confere em lote, não se procura um registro. */
const POR_PAGINA = 50;

/** Quantos resultados a busca do "acrescentar" mostra de uma vez.
 *
 *  SÃO 2.670 VEÍCULOS no cadastro, e quem procura um sabe o nome dele. Mostrar
 *  tudo faria a pessoa rolar; mostrar poucos e DIZER quantos ficaram de fora é
 *  o que a faz digitar mais uma letra em vez de desistir. */
const RESULTADOS_DA_BUSCA = 15;

export function VeiculosDeInvestidores() {
  const { catalogo } = usePainel();
  const [busca, definirBusca] = useState('');
  const [pagina, definirPagina] = useState(1);
  //: O QUE A PESSOA MUDOU NESTA SESSÃO, por id: `true` entra na lista, `false`
  //: sai. Fora daqui, vale o catálogo — guardar só a DIFERENÇA é o que faz a
  //: tela continuar certa quando o catálogo recarregar por outra ação.
  const [mudados, definirMudados] = useState<Map<string, boolean>>(new Map());
  const [salvando, definirSalvando] = useState(false);
  const [erro, definirErro] = useState<string | null>(null);
  const [resultado, definirResultado] = useState<string | null>(null);
  const [acrescentando, definirAcrescentando] = useState(false);

  const idDaSubcategoria = useMemo(() => {
    const dicionarios = catalogo?.dicionarios;
    if (!dicionarios) return null;
    const imprensa = dicionarios.categorias_publico.find(
      (c) => c.nome === CATEGORIA_DA_IMPRENSA,
    );
    if (!imprensa) return null;
    const achada = dicionarios.subcategorias_publico.find(
      (s) =>
        s.categoria_publico_id === imprensa.id && s.nome === SUBCATEGORIA_DO_MERCADO,
    );
    return achada?.id ?? null;
  }, [catalogo]);

  const idDaImprensa = useMemo(
    () =>
      catalogo?.dicionarios.categorias_publico.find(
        (c) => c.nome === CATEGORIA_DA_IMPRENSA,
      )?.id ?? null,
    [catalogo],
  );

  const veiculos = useMemo(
    () =>
      [...(catalogo?.instituicoes.values() ?? [])]
        .filter((i) => i.tipo === 'veiculo')
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [catalogo],
  );

  /** Está na lista de mercado? O que a pessoa mudou vence o catálogo. */
  const naLista = useMemo(() => {
    return (instituicao: Instituicao) => {
      const mudado = mudados.get(instituicao.id);
      if (mudado !== undefined) return mudado;
      return (
        idDaSubcategoria !== null &&
        instituicao.subcategoria_publico_id === idDaSubcategoria
      );
    };
  }, [mudados, idDaSubcategoria]);

  //: A LISTA, e só ela — mais o que a pessoa acabou de tirar, que fica em tela
  //: riscado até salvar. Quem sai e desaparece na hora não dá chance de
  //: desfazer, e tirar o veículo errado de 81 é fácil.
  const daLente = useMemo(
    () => veiculos.filter((v) => naLista(v) || mudados.get(v.id) === false),
    [veiculos, naLista, mudados],
  );

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return termo ? daLente.filter((v) => v.nome.toLowerCase().includes(termo)) : daLente;
  }, [daLente, busca]);

  //: NOVA BUSCA VOLTA À PÁGINA 1 — ajuste durante a renderização, o mesmo
  //: padrão do Cadastro de Instituições: sem isto, filtrar na última página
  //: deixaria a tela numa página que não existe mais.
  const [buscaAnterior, definirBuscaAnterior] = useState(busca);
  if (busca !== buscaAnterior) {
    definirBuscaAnterior(busca);
    definirPagina(1);
  }

  const totalDePaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalDePaginas);
  const daPagina = filtrados.slice(
    (paginaAtual - 1) * POR_PAGINA,
    paginaAtual * POR_PAGINA,
  );
  const quantosNaLista = veiculos.filter((v) => naLista(v)).length;

  function marcar(id: string, entra: boolean) {
    definirMudados((atual) => {
      const proximo = new Map(atual);
      proximo.set(id, entra);
      return proximo;
    });
    definirResultado(null);
  }

  async function salvar() {
    definirSalvando(true);
    definirErro(null);
    definirResultado(null);
    try {
      const saida = await definirVeiculosDeInvestidores(
        veiculos.filter((v) => naLista(v)).map((v) => v.id),
      );
      //: LIMPA A DIFERENÇA: o que foi gravado agora vem do catálogo, que o
      //: cliente da API já mandou recarregar (a rota está em
      //: `ROTAS_DO_CATALOGO`). Manter a diferença faria a tela mostrar o mesmo
      //: estado por dois caminhos, e discordar de si mesma se um falhasse.
      definirMudados(new Map());
      definirResultado(
        saida.marcados || saida.desmarcados
          ? `${numero(saida.marcados)} entraram, ${numero(saida.desmarcados)} saíram.`
          : 'Nada mudou — a lista já estava assim.',
      );
    } catch (falha) {
      definirErro(
        falha instanceof Error ? falha.message : 'Não consegui salvar a lista.',
      );
    } finally {
      definirSalvando(false);
    }
  }

  if (!catalogo) return <Cartao>Carregando o cadastro…</Cartao>;

  if (idDaSubcategoria === null) {
    return (
      <Secao titulo="Veículos de investidores">
        <Cartao>
          <FaixaDeErro
            mensagem={`A subcategoria "${SUBCATEGORIA_DO_MERCADO}" da ${CATEGORIA_DA_IMPRENSA} não está cadastrada. Sem ela a lente Mercado não tem como se separar.`}
          />
        </Cartao>
      </Secao>
    );
  }

  const pendentes = mudados.size > 0;

  return (
    <Secao
      titulo={`Veículos de investidores (${numero(quantosNaLista)})`}
      subtitulo="É esta lista que define a lente Mercado: as menções destes veículos contam nela, além de contarem na Imprensa. O critério é a subcategoria de público do cadastro — quem entra aqui fica como imprensa econômica."
      acao={
        <Botao variante="secundario" aoClicar={() => definirAcrescentando(true)}>
          Acrescentar veículo
        </Botao>
      }
    >
      <Cartao>
        {erro ? <FaixaDeErro mensagem={erro} /> : null}

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
            placeholder="Buscar nesta lista…"
            aria-label="Buscar nesta lista"
            onChange={(evento) => definirBusca(evento.target.value)}
          />
          <span style={{ fontSize: 12, color: 'var(--cinza-2)' }}>
            {busca.trim()
              ? `${numero(filtrados.length)} de ${numero(daLente.length)}`
              : `${numero(quantosNaLista)} na lente Mercado`}
          </span>
        </div>

        {daPagina.length === 0 ? (
          <p style={{ fontSize: 13, margin: 0 }}>
            {busca.trim()
              ? 'Nenhum veículo desta lista com esse nome.'
              : 'Nenhum veículo na lista ainda. Use "Acrescentar veículo".'}
          </p>
        ) : (
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
            {daPagina.map((instituicao) => {
              const sai = mudados.get(instituicao.id) === false;
              const entra = mudados.get(instituicao.id) === true;
              return (
                <li
                  key={instituicao.id}
                  style={{
                    borderTop: '1px solid var(--borda)',
                    display: 'flex',
                    gap: 10,
                    alignItems: 'center',
                    padding: '8px 12px',
                  }}
                >
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: 13,
                      textDecoration: sai ? 'line-through' : undefined,
                      color: sai ? 'var(--cinza-3)' : undefined,
                    }}
                  >
                    {instituicao.nome}
                  </span>
                  {sai || entra ? (
                    <span style={{ fontSize: 11, color: 'var(--atencao-fg)' }}>
                      {sai ? 'sai ao salvar' : 'entra ao salvar'}
                    </span>
                  ) : null}
                  <span
                    style={{
                      fontSize: 11,
                      color: 'var(--cinza-3)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {instituicao.uf ?? '—'}
                  </span>
                  <Botao
                    variante="fantasma"
                    aoClicar={() => marcar(instituicao.id, sai)}
                    desabilitado={salvando}
                  >
                    {sai ? 'Desfazer' : 'Remover'}
                  </Botao>
                </li>
              );
            })}
          </ul>
        )}

        <Paginacao
          pagina={paginaAtual}
          totalDePaginas={totalDePaginas}
          aoMudarPagina={definirPagina}
        />

        <div
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            justifyContent: 'flex-end',
            marginTop: 16,
            flexWrap: 'wrap',
          }}
        >
          {resultado ? (
            <span role="status" style={{ fontSize: 12, color: 'var(--ok-fg)' }}>
              {resultado}
            </span>
          ) : null}
          {pendentes ? (
            //: O QUE MUDOU E AINDA NÃO FOI GRAVADO. Sem isto, a pessoa mexe na
            //: lista, troca de aba e perde a edição sem saber que havia uma.
            <span style={{ fontSize: 12, color: 'var(--atencao-fg)' }}>
              {numero(mudados.size)}{' '}
              {mudados.size === 1 ? 'alteração' : 'alterações'} sem salvar
            </span>
          ) : null}
          <Botao
            variante="fantasma"
            aoClicar={() => {
              definirMudados(new Map());
              definirResultado(null);
            }}
            desabilitado={salvando || !pendentes}
          >
            Descartar
          </Botao>
          <Botao
            variante="primario"
            aoClicar={salvar}
            desabilitado={salvando || !pendentes}
          >
            {salvando ? 'Salvando…' : `Salvar a lista (${numero(quantosNaLista)})`}
          </Botao>
        </div>
      </Cartao>

      {acrescentando ? (
        <AcrescentarVeiculo
          veiculos={veiculos}
          naLista={naLista}
          idDaImprensa={idDaImprensa}
          idDaSubcategoria={idDaSubcategoria}
          ufs={catalogo.dicionarios.ufs}
          aoAcrescentar={(id) => marcar(id, true)}
          aoFechar={() => definirAcrescentando(false)}
        />
      ) : null}
    </Secao>
  );
}

/** Acrescentar um veículo à lente Mercado: o que já está no cadastro, e o que
 *  ainda não está.
 *
 *  DUAS PORTAS NA MESMA JANELA porque quem acrescenta não sabe de antemão em
 *  qual caso está: dos 81 da planilha, 9 existiam no cadastro antes da primeira
 *  carga da Clipei e 72 nasceram dela. Perguntar "já existe?" primeiro é pedir
 *  que a pessoa saiba o que o sistema sabe.
 *
 *  BUSCA PELO NOME, sem acento e sem caixa: quem procura "estadao" tem de achar
 *  "Estadão". É o mesmo casamento que o servidor faz para não duplicar
 *  cadastro.
 */
function AcrescentarVeiculo({
  veiculos,
  naLista,
  idDaImprensa,
  idDaSubcategoria,
  ufs,
  aoAcrescentar,
  aoFechar,
}: {
  /** O cadastro inteiro de veículos. A janela filtra o que está FORA da
   *  lista — e mantém em tela o que acabou de entrar por ela. */
  veiculos: Instituicao[];
  naLista: (instituicao: Instituicao) => boolean;
  /** A categoria de público do veículo novo. `null` se a Imprensa não está
   *  cadastrada — aí o cadastro nasce sem categoria, e não deixa de nascer. */
  idDaImprensa: number | null;
  idDaSubcategoria: number;
  ufs: { codigo: string; nome: string }[];
  aoAcrescentar: (id: string) => void;
  aoFechar: () => void;
}) {
  const [busca, definirBusca] = useState('');
  const [uf, definirUf] = useState('');
  const [criando, definirCriando] = useState(false);
  const [erro, definirErro] = useState<string | null>(null);
  //: O QUE ACABOU DE SER CADASTRADO, pelo nome. Sem isto o clique em
  //: "Cadastrar" só limpava o campo: a pessoa não tinha como saber se o
  //: veículo nasceu, e menos ainda que o cadastro NÃO traz menção nenhuma com
  //: ele — a menção vem da planilha. Foi exatamente essa a dúvida de quem
  //: usou a tela ("adicionei um veículo e a base não foi atualizada").
  const [cadastrado, definirCadastrado] = useState<string | null>(null);
  //: QUEM ENTROU NESTA JANELA, para a linha dizer "acrescentado" em vez de
  //: sumir. Sem isto, acrescentar dois seguidos parece não ter funcionado.
  const [acrescentados, definirAcrescentados] = useState<Set<string>>(new Set());

  const termo = busca.trim();
  const achados = useMemo(() => {
    const procurado = semAcento(termo);
    if (!procurado) return [];
    return veiculos.filter(
      (v) =>
        semAcento(v.nome).includes(procurado) &&
        //: FORA DA LISTA, ou acrescentado POR ESTA JANELA: quem acabou de
        //: entrar continua em tela dizendo "acrescentado". Sumir no clique faz
        //: parecer que não funcionou, e a pessoa clica no vizinho.
        (!naLista(v) || acrescentados.has(v.id)),
    );
  }, [veiculos, naLista, acrescentados, termo]);

  //: O NOME EXATO JÁ EXISTE NO CADASTRO? Então não se cadastra de novo: o
  //: índice único é `(nome_normalizado, tipo)`, e o servidor recusaria. A
  //: janela oferece acrescentar o que achou.
  const jaExiste = achados.some((v) => semAcento(v.nome) === semAcento(termo));

  async function cadastrar() {
    definirCriando(true);
    definirErro(null);
    try {
      //: NASCE JÁ NA LISTA (com a subcategoria do mercado), e não como
      //: cadastro solto a ser marcado depois: foi isso que a pessoa pediu ao
      //: cadastrar um veículo AQUI. Por isso este é o único gesto da aba que
      //: grava na hora — criar cadastro é escrita própria, e o catálogo
      //: recarrega sozinho (`ROTAS_DO_CATALOGO`).
      await criarInstituicao({
        nome: termo,
        tipo: 'veiculo',
        uf: uf || null,
        categoria_publico_id: idDaImprensa,
        subcategoria_publico_id: idDaSubcategoria,
      });
      definirCadastrado(termo);
      definirBusca('');
      definirUf('');
    } catch (falha) {
      definirErro(
        falha instanceof Error ? falha.message : 'Não consegui cadastrar o veículo.',
      );
    } finally {
      definirCriando(false);
    }
  }

  return (
    <Modal
      titulo="Acrescentar veículo à lente Mercado"
      subtitulo="Procure no cadastro compartilhado. Se o veículo ainda não existir, cadastre-o aqui — ele nasce como imprensa econômica."
      aoFechar={aoFechar}
      largura={620}
      rodape={
        /* FECHAR NÃO É A AÇÃO PRINCIPAL, e era: um "Concluir" primário no
           rodapé é o botão mais visível da janela, e ele DESCARTA o que a
           pessoa digitou. Quem preencheu nome e abrangência clicou nele —
           e o veículo nunca foi cadastrado, sem erro nenhum em tela. Agora o
           único botão em destaque é o que cadastra. */
        <Botao variante="fantasma" aoClicar={aoFechar}>
          Fechar
        </Botao>
      }
    >
      {erro ? <FaixaDeErro mensagem={erro} /> : null}

      <Campo rotulo="Nome do veículo">
        <input
          style={estiloDeEntrada}
          value={busca}
          autoFocus
          placeholder="Valor Econômico, InfoMoney…"
          aria-label="Nome do veículo"
          onChange={(evento) => {
            definirBusca(evento.target.value);
            definirCadastrado(null);
          }}
          onKeyDown={(evento) => {
            //: ENTER CADASTRA quando é isso que há para fazer. Digitar o nome
            //: e teclar Enter é o gesto de quem está cadastrando, e sem isto o
            //: Enter não fazia nada — a janela ficava parada parecendo travada.
            if (evento.key !== 'Enter') return;
            evento.preventDefault();
            if (termo && !jaExiste && !criando) void cadastrar();
          }}
        />
      </Campo>

      {cadastrado ? (
        <p
          role="status"
          style={{ fontSize: 12, color: 'var(--ok-fg)', margin: '10px 0 0' }}
        >
          {/* AS DUAS COISAS, porque só a primeira engana: o veículo entra na
              lista, e a lista decide o que CONTA na lente — mas a menção em si
              vem da planilha do fornecedor. Um veículo cadastrado hoje começa
              a aparecer quando uma planilha da Clipei o mencionar. */}
          {cadastrado} entrou na lista. O cadastro não traz menção: ele passa a
          contar quando uma planilha da Clipei o mencionar.
        </p>
      ) : null}

      {termo ? (
        <>
          {achados.length ? (
            <ul
              style={{
                listStyle: 'none',
                margin: '10px 0 0',
                padding: 0,
                border: '1px solid var(--borda)',
                borderRadius: 'var(--r-card-int)',
                background: 'var(--branco)',
                maxHeight: 280,
                overflowY: 'auto',
              }}
            >
              {achados.slice(0, RESULTADOS_DA_BUSCA).map((v) => (
                <li
                  key={v.id}
                  style={{
                    borderTop: '1px solid var(--borda)',
                    display: 'flex',
                    gap: 10,
                    alignItems: 'center',
                    padding: '7px 12px',
                  }}
                >
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13 }}>{v.nome}</span>
                  <span style={{ fontSize: 11, color: 'var(--cinza-3)' }}>
                    {v.uf ?? '—'}
                  </span>
                  {acrescentados.has(v.id) ? (
                    <span style={{ fontSize: 11, color: 'var(--ok-fg)' }}>
                      acrescentado
                    </span>
                  ) : (
                    <Botao
                      variante="secundario"
                      aoClicar={() => {
                        aoAcrescentar(v.id);
                        definirAcrescentados((atual) => new Set(atual).add(v.id));
                      }}
                    >
                      Acrescentar
                    </Botao>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ fontSize: 13, margin: '10px 0 0' }}>
              Nenhum veículo com esse nome fora da lista.
            </p>
          )}

          {achados.length > RESULTADOS_DA_BUSCA ? (
            <p style={{ fontSize: 12, color: 'var(--cinza-2)', margin: '8px 0 0' }}>
              {numero(achados.length - RESULTADOS_DA_BUSCA)} outros também casam —
              digite mais do nome.
            </p>
          ) : null}

          {jaExiste ? null : (
            <div
              style={{
                marginTop: 16,
                paddingTop: 14,
                borderTop: '1px solid var(--borda)',
                display: 'grid',
                gap: 10,
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 600 }}>
                Não está no cadastro? Cadastre agora
              </span>
              <Campo
                rotulo="Abrangência"
                dica="UF, NA (nacional) ou IN (internacional). Pode ficar sem."
              >
                <select
                  style={estiloDeEntrada}
                  value={uf}
                  aria-label="Abrangência"
                  onChange={(evento) => definirUf(evento.target.value)}
                >
                  <option value="">Não informada</option>
                  {ufs.map((opcao) => (
                    <option key={opcao.codigo} value={opcao.codigo}>
                      {opcao.nome}
                    </option>
                  ))}
                </select>
              </Campo>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Botao variante="primario" aoClicar={cadastrar} desabilitado={criando}>
                  {criando ? 'Cadastrando…' : `Cadastrar "${termo}" como veículo`}
                </Botao>
              </div>
            </div>
          )}
        </>
      ) : (
        <p style={{ fontSize: 13, margin: '10px 0 0', color: 'var(--cinza-2)' }}>
          Digite o nome para procurar no cadastro.
        </p>
      )}
    </Modal>
  );
}

/** Sem acento e sem caixa — é como se procura nome de veículo.
 *
 *  `NFD` + corte das marcas: "Estadão" e "estadao" têm de casar, e quem digita
 *  no campo de busca não acentua. */
function semAcento(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}
