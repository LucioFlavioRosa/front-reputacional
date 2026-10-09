/** Quais veículos a lente Mercado considera.
 *
 *  POR QUE ESTA SEÇÃO EXISTE. A lente Mercado se separava por
 *  `Público-alvo = Investidores`, uma coluna que o fornecedor preenche. Medido
 *  contra o export de 08–09/2026: isso captura 80 linhas onde a lista de
 *  veículos que a Aegea mantém captura 323 — e os dois critérios discordam em
 *  267 das 335 linhas envolvidas. O critério da coluna perde Valor Econômico
 *  (49 menções), InfoMoney (25), Expert XP (20) e Times Brasil (15), que
 *  entrariam só na Imprensa.
 *
 *  O CRITÉRIO É O CADASTRO, e esta tela é como a lista se mantém. A `0066`
 *  semeou os 81 da planilha da Aegea; daqui em diante um veículo entra ou sai
 *  por aqui, sem SQL.
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

import { definirVeiculosDeInvestidores } from '@/api/cliente';
import {
  Botao,
  Cartao,
  FaixaDeErro,
  Secao,
  estiloDeEntrada,
} from '@/componentes/basicos';
import { Paginacao } from '@/componentes/Paginacao';
import { numero } from '@/dominio/formato';
import { usePainel } from '@/estado/painel';

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

export function VeiculosDeInvestidores() {
  const { catalogo } = usePainel();
  const [busca, definirBusca] = useState('');
  const [pagina, definirPagina] = useState(1);
  const [soOsDaLista, definirSoOsDaLista] = useState(true);
  //: O QUE A PESSOA MUDOU NESTA SESSÃO, por id. Fora daqui, vale o catálogo.
  //: Guardar só a DIFERENÇA — e não a lista inteira em estado — é o que faz a
  //: tela continuar certa quando o catálogo recarregar por outra ação.
  const [mudados, definirMudados] = useState<Map<string, boolean>>(new Map());
  const [salvando, definirSalvando] = useState(false);
  const [erro, definirErro] = useState<string | null>(null);
  const [resultado, definirResultado] = useState<string | null>(null);

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

  const comEstado = useMemo(() => {
    const veiculos = [...(catalogo?.instituicoes.values() ?? [])]
      .filter((i) => i.tipo === 'veiculo')
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    return veiculos.map((instituicao) => {
      const mudado = mudados.get(instituicao.id);
      const naLista =
        idDaSubcategoria !== null &&
        instituicao.subcategoria_publico_id === idDaSubcategoria;
      return {
        instituicao,
        marcado: mudado === undefined ? naLista : mudado,
        //: JÁ TEM OUTRA CLASSIFICAÇÃO? A tela avisa em vez de deixar marcar: o
        //: servidor não sobrescreve subcategoria que alguém escolheu, e sem o
        //: aviso a pessoa marcaria, salvaria e acharia que funcionou.
        comOutra:
          instituicao.subcategoria_publico_id != null &&
          instituicao.subcategoria_publico_id !== idDaSubcategoria,
      };
    });
  }, [catalogo, mudados, idDaSubcategoria]);

  const daLista = comEstado.filter((v) => v.marcado);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return comEstado
      .filter((v) => !soOsDaLista || v.marcado)
      .filter((v) => !termo || v.instituicao.nome.toLowerCase().includes(termo));
  }, [comEstado, busca, soOsDaLista]);

  //: TROCAR O RECORTE VOLTA À PÁGINA 1 — ajuste durante a renderização, o
  //: mesmo padrão do Cadastro de Instituições: sem isto, mudar o filtro na
  //: última página deixaria a tela numa página que não existe mais.
  const recorte = `${busca}|${soOsDaLista}`;
  const [recorteAnterior, definirRecorteAnterior] = useState(recorte);
  if (recorte !== recorteAnterior) {
    definirRecorteAnterior(recorte);
    definirPagina(1);
  }

  const totalDePaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalDePaginas);
  const daPagina = filtrados.slice(
    (paginaAtual - 1) * POR_PAGINA,
    paginaAtual * POR_PAGINA,
  );

  function alternar(id: string, marcadoAgora: boolean) {
    definirMudados((atual) => {
      const proximo = new Map(atual);
      proximo.set(id, !marcadoAgora);
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
        daLista.map((v) => v.instituicao.id),
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
      titulo={`Veículos de investidores (${numero(daLista.length)})`}
      subtitulo="É esta lista que define a lente Mercado: as menções destes veículos contam nela, além de contarem na Imprensa. O critério é a subcategoria de público do cadastro — quem entra aqui fica como imprensa econômica."
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
            placeholder="Buscar um veículo…"
            aria-label="Buscar um veículo"
            onChange={(evento) => definirBusca(evento.target.value)}
          />
          {/* O PADRÃO MOSTRA SÓ A LISTA, porque são 81 contra 2.670 veículos:
              abrir em "todos" faria a pessoa procurar os dela entre 54
              páginas. Para ACRESCENTAR, ela desmarca a caixa e busca o nome. */}
          <label
            style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12 }}
          >
            <input
              type="checkbox"
              checked={soOsDaLista}
              onChange={(evento) => definirSoOsDaLista(evento.target.checked)}
            />
            Mostrar só os da lista
          </label>
          <span style={{ fontSize: 12, color: 'var(--cinza-2)' }}>
            {numero(comEstado.length)} veículos cadastrados
          </span>
        </div>

        {daPagina.length === 0 ? (
          <p style={{ fontSize: 13, margin: 0 }}>
            {soOsDaLista
              ? 'Nenhum veículo na lista ainda. Desmarque "mostrar só os da lista" para procurar e acrescentar.'
              : 'Nenhum veículo com esse nome.'}
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
            {daPagina.map(({ instituicao, marcado, comOutra }) => (
              <li
                key={instituicao.id}
                style={{ borderTop: '1px solid var(--borda)' }}
              >
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
                    disabled={comOutra && !marcado}
                    aria-label={`${instituicao.nome} conta na lente Mercado`}
                    onChange={() => alternar(instituicao.id, marcado)}
                  />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
                    {instituicao.nome}
                  </span>
                  {comOutra && !marcado ? (
                    <span style={{ fontSize: 11, color: 'var(--atencao-fg)' }}>
                      já classificado em outra subcategoria
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
                </label>
              </li>
            ))}
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
            //: O QUE MUDOU E AINDA NÃO FOI GRAVADO. Sem isto, a pessoa marca,
            //: troca de aba e perde a edição sem saber que havia uma.
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
            {salvando ? 'Salvando…' : `Salvar a lista (${numero(daLista.length)})`}
          </Botao>
        </div>
      </Cartao>
    </Secao>
  );
}
