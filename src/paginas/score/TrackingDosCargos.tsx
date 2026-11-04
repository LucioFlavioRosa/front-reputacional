/** "Tracking dos cargos dos autores" — o bloco da Sociedade digital que tomou o
 *  lugar de "Drivers e riscos" (03/11/2026, por pedido).
 *
 *  DUAS COLUNAS, UM EIXO (o cargo de quem fala, que a Bites manda na coluna
 *  `Cargo`): à esquerda o volume por sentimento com o impacto na nota; à
 *  direita o termômetro de −100 a +100. É o molde do Explorador de veículos —
 *  um pedido por mês e recorte, os grupos guardados, a soma no navegador — e é
 *  o "Termômetro por público" do CRM no gesto de acompanhar mais um item.
 *
 *  O CLIQUE NUM CARGO ABRE OS AUTORES DELE, nas duas colunas: o popup lista os
 *  autores do maior para o menor impacto, com busca, e cada autor se abre nos posts dele
 *  no recorte, com o link para a rede. A conta mora em
 *  `dominio/cargosDosAutores`.
 *
 *  O FILTRO DA TELA VALE AQUI, como em todo o dossiê: ele vai no pedido dos
 *  grupos e no dos posts — o popup conta o que a barra contou.
 */

import { useEffect, useState } from 'react';

import type { CargosDosAutores, FiltroDaLente, MencaoDaBase } from '@/api/cliente';
import { listarMencoesDaBase, obterCargosDosAutores } from '@/api/cliente';
import { Carregando, Chip, ComFaixaDoTopo, Modal, Secao } from '@/componentes/basicos';
import {
  autoresDoCargo,
  buscarAutores,
  cargosDoRecorte,
  cargosNaTela,
  cargosParaAcompanhar,
  mencoesSemCargo,
} from '@/dominio/cargosDosAutores';
import type { AutorDoCargo } from '@/dominio/cargosDosAutores';
import { rotuloDoMesComAno } from '@/dominio/calendarioMensal';
import { CORES_DO_SENTIMENTO, textoDoImpacto } from '@/dominio/explorador';
import { ROTULO_DO_SENTIMENTO } from '@/dominio/filtrosDasLentes';
import { dataCurta, numero, plural, urlSegura } from '@/dominio/formato';
import { GUIA_DO_BLOCO } from '@/dominio/guiaDoDossie';
import { BarraDivergentePorItem } from '@/graficos/BarraDivergentePorItem';
import { ColunasEmpilhadas } from '@/graficos/ColunasEmpilhadas';
import { Coluna } from '@/paginas/score/ExploradorDeVeiculos';

const TITULO = 'Tracking dos cargos dos autores';
const ALTURA_DA_LISTA = 360;
//: QUANTOS POSTS UM AUTOR ABRE: os de maior engajamento primeiro. Quem precisa de
//: todos tem a Base de dados, que pagina.
const POSTS_POR_AUTOR = 20;

export function TrackingDosCargos({
  codigo,
  mes,
  filtro,
}: {
  codigo: string;
  mes: string;
  filtro: FiltroDaLente;
}) {
  //: OS DADOS COM A CHAVE DO PEDIDO de que são — a resposta atrasada de um
  //: recorte não pousa sobre o seguinte. O mesmo de `ExploradorDeVeiculos`.
  const chave = `${codigo}|${mes}|${JSON.stringify(filtro)}`;
  const [carregados, definirCarregados] = useState<{
    chave: string;
    dados: CargosDosAutores | null;
    erro?: string;
  } | null>(null);
  //: SÓ DESTE CARTÃO, e não do filtro da tela: "acompanhe também este cargo"
  //: — a mesma ideia de `categoriaPublicoExtras` no Painel do CRM. Sobrevive a
  //: trocar o filtro; o cargo que some do recorte some da tela sozinho.
  const [extras, definirExtras] = useState<string[]>([]);
  const [cargoAberto, definirCargoAberto] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    obterCargosDosAutores(codigo, mes, filtro)
      .then((dados) => ativo && definirCarregados({ chave, dados }))
      .catch((falha) =>
        ativo &&
        definirCarregados({
          chave,
          dados: null,
          erro: falha instanceof Error ? falha.message : 'Não foi possível ler.',
        }),
      );
    return () => {
      ativo = false;
    };
  }, [codigo, mes, filtro, chave]);

  const atuais = carregados?.chave === chave ? carregados : null;
  const grupos = atuais?.dados?.grupos ?? [];
  const denominador = atuais?.dados?.denominador ?? 0;

  const cargos = cargosDoRecorte(grupos, denominador);
  const naTela = cargosNaTela(cargos, extras);
  const disponiveis = cargosParaAcompanhar(cargos, naTela);
  const semCargo = mencoesSemCargo(grupos);
  const totalDoRecorte = cargos.reduce((soma, item) => soma + item.total, 0) + semCargo;

  return (
    <ComFaixaDoTopo>
      <Secao
        titulo={TITULO}
        subtitulo="Menções por cargo de quem fala, com o sentimento e o impacto na nota da lente (pontos). Clique num cargo para ver os autores."
        ajuda={GUIA_DO_BLOCO[TITULO]}
      >
        {!atuais ? <Carregando /> : null}
        {atuais?.erro ? (
          <p style={{ color: 'var(--erro-fg)', fontSize: 13 }}>{atuais.erro}</p>
        ) : null}
        {atuais?.dados ? (
          <>
            {extras.length || disponiveis.length ? (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 6,
                  marginBottom: 14,
                }}
              >
                {extras
                  .filter((cargo) => naTela.some((item) => item.cargo === cargo))
                  .map((cargo) => (
                    <Chip
                      key={cargo}
                      rotulo={cargo}
                      ativo
                      fundo="var(--azul-mar)"
                      texto="var(--branco)"
                      titulo={`Deixar de acompanhar ${cargo}`}
                      aoClicar={() => definirExtras(extras.filter((c) => c !== cargo))}
                    />
                  ))}
                {disponiveis.length ? (
                  <select
                    aria-label="Acompanhar outro cargo"
                    value=""
                    onChange={(evento) => {
                      if (evento.target.value) definirExtras([...extras, evento.target.value]);
                    }}
                    style={{
                      height: 26,
                      padding: '0 8px',
                      border: '1px dashed var(--borda-input)',
                      borderRadius: 'var(--r-chip)',
                      background: 'transparent',
                      color: 'var(--cinza-2)',
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    <option value="">+ Acompanhar outro cargo…</option>
                    {disponiveis.map((item) => (
                      <option key={item.cargo} value={item.cargo}>
                        {item.cargo} ({item.total})
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>
            ) : null}

            <Legenda />

            <div className="grade grade--2" style={{ gap: 20 }}>
              <Coluna titulo="Volume por cargo × sentimento" quantos={naTela.length}>
                <ColunasEmpilhadas
                  semLegenda
                  rotuloEmCima
                  espessura={8}
                  alturaMaxima={ALTURA_DA_LISTA}
                  cores={CORES_DO_SENTIMENTO}
                  dica="Clique para ver os autores"
                  vazio="Nenhuma menção com cargo informado neste recorte."
                  ativo={cargoAberto ?? undefined}
                  aoClicar={definirCargoAberto}
                  itens={naTela.map((item) => ({
                    rotulo: item.cargo,
                    positivo: item.positivo,
                    neutro: item.neutro,
                    negativo: item.negativo,
                    detalhe: `${textoDoImpacto(item.impacto)} pts`,
                  }))}
                />
              </Coluna>

              <Coluna titulo="Termômetro por cargo" quantos={naTela.length}>
                <div
                  className="rolagem-interna"
                  style={{
                    maxHeight: ALTURA_DA_LISTA,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    paddingRight: 4,
                  }}
                >
                  <BarraDivergentePorItem
                    itens={naTela.map((item) => ({
                      chave: item.cargo,
                      rotulo: item.cargo,
                      total: item.total,
                      //: O SALDO de −100 a +100, e não a nota — ver o
                      //: comentário do mesmo campo em `ExploradorDeVeiculos`.
                      score: item.nss,
                    }))}
                    ativo={cargoAberto ?? undefined}
                    aoClicar={definirCargoAberto}
                    vazio="Nenhuma menção com cargo informado neste recorte."
                    unidade={{ singular: 'menção', plural: 'menções' }}
                    variante="termometro"
                  />
                </div>
              </Coluna>
            </div>

            {semCargo ? (
              <p style={{ margin: '14px 0 0', fontSize: 12, color: 'var(--cinza-2)' }}>
                {numero(semCargo)} de {numero(totalDoRecorte)}{' '}
                {plural(totalDoRecorte, 'menção', 'menções')} do recorte vieram sem cargo
                informado pela fonte e não entram neste gráfico.
              </p>
            ) : null}
          </>
        ) : null}
      </Secao>

      {cargoAberto && atuais?.dados ? (
        <AutoresDoCargo
          codigo={codigo}
          mes={mes}
          filtro={filtro}
          cargo={cargoAberto}
          veAutores={atuais.dados.ve_autores}
          autores={autoresDoCargo(grupos, cargoAberto, denominador)}
          aoFechar={() => definirCargoAberto(null)}
        />
      ) : null}
    </ComFaixaDoTopo>
  );
}

function Legenda() {
  return (
    <div
      style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 11.5, color: 'var(--cinza-3)', marginBottom: 12 }}
    >
      {[
        ['Positivo', CORES_DO_SENTIMENTO[0]],
        ['Neutro', CORES_DO_SENTIMENTO[1]],
        ['Negativo', CORES_DO_SENTIMENTO[2]],
      ].map(([rotulo, cor]) => (
        <span key={rotulo} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span aria-hidden style={{ width: 10, height: 10, borderRadius: 2, background: cor }} />
          {rotulo}
        </span>
      ))}
      <span style={{ marginLeft: 'auto', color: 'var(--cinza-2)' }}>
        Na ponta: menções · impacto na nota
      </span>
    </div>
  );
}

/** O popup de um cargo: os autores do maior para o menor impacto, com busca. */
function AutoresDoCargo({
  codigo,
  mes,
  filtro,
  cargo,
  veAutores,
  autores,
  aoFechar,
}: {
  codigo: string;
  mes: string;
  filtro: FiltroDaLente;
  cargo: string;
  veAutores: boolean;
  autores: AutorDoCargo[];
  aoFechar: () => void;
}) {
  const [termo, definirTermo] = useState('');
  const [aberto, definirAberto] = useState<string | null>(null);
  const achados = buscarAutores(autores, termo);

  return (
    <Modal
      titulo={`${cargo} · ${rotuloDoMesComAno(mes)}`}
      subtitulo={
        veAutores
          ? `${numero(autores.length)} ${plural(autores.length, 'autor', 'autores')}, do maior para o menor impacto na nota da lente`
          : undefined
      }
      aoFechar={aoFechar}
      largura={760}
    >
      {!veAutores ? (
        <p style={{ fontSize: 13, color: 'var(--cinza-3)' }}>
          A lista de autores desta lente é restrita a quem tem acesso ao diretório de contatos.
        </p>
      ) : (
        <>
          <input
            type="search"
            aria-label="Buscar autor"
            placeholder="Buscar autor…"
            value={termo}
            onChange={(evento) => definirTermo(evento.target.value)}
            style={{
              width: '100%',
              height: 34,
              padding: '0 10px',
              marginBottom: 12,
              border: '1px solid var(--borda-input)',
              borderRadius: 'var(--r-input, 6px)',
              fontSize: 13,
            }}
          />
          {!achados.length ? (
            <p style={{ fontSize: 13, color: 'var(--cinza-2)' }}>
              {autores.length ? 'Nenhum autor com esse nome neste cargo.' : 'Nenhum autor identificado neste cargo.'}
            </p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {achados.map((item) => (
                <li key={item.autor} style={{ borderBottom: '1px solid var(--borda)' }}>
                  <LinhaDoAutor
                    autor={item}
                    aberto={aberto === item.autor}
                    aoAlternar={() => definirAberto(aberto === item.autor ? null : item.autor)}
                  />
                  {aberto === item.autor ? (
                    <PostsDoAutor codigo={codigo} mes={mes} filtro={filtro} cargo={cargo} autor={item.autor} />
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Modal>
  );
}

function LinhaDoAutor({
  autor,
  aberto,
  aoAlternar,
}: {
  autor: AutorDoCargo;
  aberto: boolean;
  aoAlternar: () => void;
}) {
  const fatias: [number, string][] = [
    [autor.positivo, CORES_DO_SENTIMENTO[0]],
    [autor.neutro, CORES_DO_SENTIMENTO[1]],
    [autor.negativo, CORES_DO_SENTIMENTO[2]],
  ];
  return (
    <button
      type="button"
      onClick={aoAlternar}
      aria-expanded={aberto}
      style={{
        display: 'grid',
        gridTemplateColumns: '16px minmax(0, 1fr) 90px 120px 80px',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: '9px 4px',
        border: 'none',
        background: aberto ? 'var(--bg-trilho)' : 'transparent',
        textAlign: 'left',
        fontSize: 13,
        cursor: 'pointer',
      }}
    >
      <span aria-hidden style={{ color: 'var(--cinza-2)' }}>{aberto ? '▾' : '▸'}</span>
      <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {autor.autor}
      </strong>
      <span style={{ color: 'var(--cinza-3)' }}>
        {numero(autor.total)} {plural(autor.total, 'menção', 'menções')}
      </span>
      <span
        aria-label={`${autor.positivo} positivas, ${autor.neutro} neutras, ${autor.negativo} negativas`}
        style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: 'var(--bg-trilho)' }}
      >
        {fatias.map(([quantas, cor]) =>
          quantas ? <span key={cor} style={{ flex: quantas, background: cor }} /> : null,
        )}
      </span>
      <span
        style={{
          textAlign: 'right',
          fontWeight: 700,
          color: autor.impacto < 0 ? 'var(--erro-fg)' : autor.impacto > 0 ? 'var(--ok-fg)' : 'var(--cinza-3)',
        }}
      >
        {textoDoImpacto(autor.impacto)} pts
      </span>
    </button>
  );
}

/** Os posts de um autor no recorte — pela Base das Lentes, que já aplica a regra
 *  do diretório e aceita os mesmos filtros da tela. */
function PostsDoAutor({
  codigo,
  mes,
  filtro,
  cargo,
  autor,
}: {
  codigo: string;
  mes: string;
  filtro: FiltroDaLente;
  cargo: string;
  autor: string;
}) {
  const [estado, definirEstado] = useState<{ posts?: MencaoDaBase[]; total?: number; erro?: string }>({});

  useEffect(() => {
    let ativo = true;
    const [ano, numeroDoMes] = mes.split('-').map(Number);
    const ultimoDia = new Date(ano, numeroDoMes, 0).getDate();
    listarMencoesDaBase(codigo, {
      de: `${mes}-01`,
      ate: `${mes}-${String(ultimoDia).padStart(2, '0')}`,
      filtros: { ...filtro, perfil_autor: cargo, autor },
      tamanho: POSTS_POR_AUTOR,
      ordenacao: '-engajamento',
    })
      .then((pagina) => ativo && definirEstado({ posts: pagina.itens, total: pagina.total }))
      .catch((falha) =>
        ativo && definirEstado({ erro: falha instanceof Error ? falha.message : 'Não foi possível ler.' }),
      );
    return () => {
      ativo = false;
    };
  }, [codigo, mes, filtro, cargo, autor]);

  if (estado.erro) {
    return <p style={{ color: 'var(--erro-fg)', fontSize: 12, padding: '8px 30px' }}>{estado.erro}</p>;
  }
  if (!estado.posts) return <Carregando rotulo="Carregando posts…" />;

  return (
    <div style={{ padding: '4px 4px 12px 30px' }}>
      {estado.posts.map((post) => {
        const link = urlSegura(post.link);
        return (
          <div
            key={post.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '70px 64px minmax(0, 1fr) auto',
              gap: 10,
              alignItems: 'baseline',
              padding: '6px 0',
              fontSize: 12.5,
            }}
          >
            <span style={{ color: 'var(--cinza-2)' }}>{post.data ? dataCurta(post.data) : '—'}</span>
            <span style={{ fontWeight: 700, color: corDoSentimento(post.sentimento) }}>
              {post.sentimento ? (ROTULO_DO_SENTIMENTO[post.sentimento] ?? post.sentimento) : '—'}
            </span>
            <span
              title={post.titulo ?? undefined}
              style={{ color: 'var(--cinza-4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {post.titulo ?? <span style={{ color: 'var(--cinza-2)' }}>sem texto na fonte</span>}
            </span>
            {link ? (
              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 12, fontWeight: 700, color: 'var(--azul-mar)', whiteSpace: 'nowrap' }}
              >
                Ver post ↗
              </a>
            ) : (
              <span />
            )}
          </div>
        );
      })}
      {estado.total && estado.total > estado.posts.length ? (
        <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--cinza-2)' }}>
          Mostrando os {estado.posts.length} de maior engajamento, de {numero(estado.total)}. Os demais estão na Base de
          dados.
        </p>
      ) : null}
    </div>
  );
}

function corDoSentimento(sentimento: string | null): string {
  if (sentimento === 'pos') return CORES_DO_SENTIMENTO[0];
  if (sentimento === 'neg') return CORES_DO_SENTIMENTO[2];
  return 'var(--cinza-3)';
}
