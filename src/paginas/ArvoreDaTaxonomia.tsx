/** A Árvore da taxonomia (Metodologia): como os subtemas se organizam por
 *  atributo reputacional e por risco corporativo — para os colaboradores
 *  entenderem a organização. Só leitura.
 *
 *  TUDO VEM DO CADASTRO DE TEMAS (`/api/taxonomia/arvore`): nomes, ordem,
 *  contagens, títulos, numeração, cores e legendas. Esta tela não conhece
 *  nenhum nome da taxonomia; a conta mora em `dominio/arvoreDaTaxonomia`.
 *
 *  ATUALIZA SEM DEPLOY: gravar no Cadastro de Temas esquece o guardado da API
 *  e avisa as telas abertas (`catalogoMudou`), e esta recarrega.
 *
 *  VISÃO, COR, FILTROS, BUSCA E SUBTEMA ESCOLHIDO FICAM NA URL.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';

import { obterArvoreDaTaxonomia } from '@/api/cliente';
import type {
  ArvoreDaTaxonomia as Arvore,
  DimensaoDeCorDaArvore,
  SubtemaDaArvore,
  ValorDeCorDaArvore,
} from '@/api/score';
import { Carregando, FaixaDeErro } from '@/componentes/basicos';
import {
  composicao,
  escreverEstado,
  indexar,
  lerEstado,
  passa,
  riscoDo,
  totais,
  valorDeCor,
} from '@/dominio/arvoreDaTaxonomia';
import type {
  ColunaDaArvore,
  EstadoDaArvore,
  GrupoDaArvore,
  IndiceDaArvore,
  VisaoDaArvore,
} from '@/dominio/arvoreDaTaxonomia';
import { catalogoMudou } from '@/dominio/sincronizacao';
import './arvore.css';

/* -- cor ----------------------------------------------------------------------- */

const HACHURA = (cor: string) =>
  `repeating-linear-gradient(45deg, ${cor} 0 3px, #8C91A4 3px 5px)`;

/** O preenchimento cheio de um valor (pilha, filtro, etiqueta). */
function fundo(valor: ValorDeCorDaArvore): string {
  return valor.hachurado ? HACHURA(valor.cor) : valor.cor;
}

/** O item do subtema: fundo claro do valor e a borda na cor cheia. */
function estiloDoItem(valor: ValorDeCorDaArvore): CSSProperties {
  return valor.hachurado
    ? {
        background: `repeating-linear-gradient(45deg, #fff 0 6px, ${valor.cor} 6px 8px)`,
        borderLeftColor: '#8C91A4',
      }
    : { background: `${valor.cor}33`, borderLeftColor: valor.cor };
}

/** O texto sobre um fundo cheio: branco no escuro, Azul Mar no claro. */
function textoSobre(cor: string): string {
  const hex = cor.replace('#', '');
  if (hex.length !== 6) return '#0027BD';
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b < 140 ? '#fff' : '#0027BD';
}

function Pilha({ partes }: { partes: { valor: ValorDeCorDaArvore; quantos: number }[] }) {
  const total = partes.reduce((soma, parte) => soma + parte.quantos, 0) || 1;
  return (
    <>
      {partes.map(({ valor, quantos }) => (
        <i
          key={valor.codigo}
          title={`${valor.nome}: ${quantos}`}
          style={{ width: `${(quantos / total) * 100}%`, background: fundo(valor) }}
        />
      ))}
    </>
  );
}

/* -- a página --------------------------------------------------------------------- */

export function ArvoreDaTaxonomia() {
  const [arvore, definirArvore] = useState<Arvore | null>(null);
  const [erro, definirErro] = useState<string | null>(null);
  const [estado, definirEstado] = useState<EstadoDaArvore>(() => lerEstado(window.location.search));
  const [abertos, definirAbertos] = useState<Record<VisaoDaArvore, Set<string>>>(() => ({
    atributo: new Set(),
    risco: new Set(),
  }));
  const pulsar = useRef<number | null>(null);
  //: O POPUP ABRE AO ESCOLHER UM SUBTEMA e fecha ao ir para a outra árvore, para
  //: não cobrir o subtema que acabou de ser destacado lá; ele segue marcado.
  const [fichaAberta, definirFichaAberta] = useState(() => estado.subtema != null);

  const carregar = useCallback(() => {
    obterArvoreDaTaxonomia()
      .then((dados) => {
        definirArvore(dados);
        definirErro(null);
      })
      .catch((falha) => definirErro(falha instanceof Error ? falha.message : 'Não foi possível ler.'));
  }, []);
  //: TRÊS GATILHOS DE RELEITURA, e é o que mantém a árvore igual ao cadastro:
  //:  - ao abrir a página (a leitura nunca vem guardada — ver a API);
  //:  - quando alguém grava no Cadastro de Temas NESTE navegador, em qualquer
  //:    aba (`catalogoMudou`: aba Temas, planilha de subtemas, dicionários);
  //:  - quando a pessoa VOLTA PARA ESTA ABA — pega o que outra pessoa mudou em
  //:    outra máquina enquanto a página ficou aberta.
  useEffect(() => {
    carregar();
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') carregar();
    };
    document.addEventListener('visibilitychange', aoVoltar);
    const desassinar = catalogoMudou.assinar(carregar);
    return () => {
      document.removeEventListener('visibilitychange', aoVoltar);
      desassinar();
    };
  }, [carregar]);

  //: O ESTADO NA URL, sem apagar o que não é da árvore (`replaceState`: mexer
  //: na árvore não é navegar).
  useEffect(() => {
    const consulta = escreverEstado(window.location.search, estado);
    const destino = `${window.location.pathname}${consulta}${window.location.hash}`;
    if (destino !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
      window.history.replaceState(window.history.state, '', destino);
    }
  }, [estado]);

  const indice = useMemo(() => (arvore ? indexar(arvore) : null), [arvore]);

  //: DEPOIS DE IR À OUTRA ÁRVORE: rola até o subtema e o faz pulsar.
  useEffect(() => {
    const id = pulsar.current;
    if (id == null) return;
    pulsar.current = null;
    const item = document.querySelector<HTMLElement>(`.arv-sub-item[data-subtema="${id}"]`);
    if (!item) return;
    item.scrollIntoView({ behavior: 'smooth', block: 'center' });
    item.classList.add('arv-pulso');
  });

  if (erro && !arvore) return <FaixaDeErro mensagem={erro} />;
  if (!indice || !arvore) return <Carregando />;

  const dimensao = arvore.cores.find((d) => d.chave === estado.cor) ?? arvore.cores[0];
  //: A DIMENSÃO DO RISCO pinta a barra e a etiqueta de cada risco, qualquer que
  //: seja a cor escolhida para o subtema.
  const dimensaoDoRisco = arvore.cores.find((d) => d.alvo === 'risco');
  const filtro = new Set(estado.filtro);
  const ativo = Boolean(estado.busca.trim()) || filtro.size > 0;
  const passaNaTela = (subtema: SubtemaDaArvore) =>
    dimensao ? passa(indice, dimensao, subtema, estado.busca, filtro) : true;
  const mudar = (parcial: Partial<EstadoDaArvore>) => definirEstado((atual) => ({ ...atual, ...parcial }));
  const colunas = estado.visao === 'atributo' ? indice.colunasPorAtributo : indice.colunasPorRisco;
  const emDestaque = arvore.subtemas.filter(passaNaTela).length;

  const alternarGrupo = (chave: string) =>
    definirAbertos((atual) => {
      const novo = new Set(atual[estado.visao]);
      if (novo.has(chave)) novo.delete(chave);
      else novo.add(chave);
      return { ...atual, [estado.visao]: novo };
    });
  const abrirTodos = (lista: GrupoDaArvore[], abrir: boolean) =>
    definirAbertos((atual) => {
      const novo = new Set(atual[estado.visao]);
      for (const grupo of lista) {
        if (abrir) novo.add(grupo.chave);
        else novo.delete(grupo.chave);
      }
      return { ...atual, [estado.visao]: novo };
    });

  const irPara = (visao: VisaoDaArvore) => {
    const escolhido = arvore.subtemas.find((s) => s.id === estado.subtema);
    if (escolhido) {
      const chave =
        visao === 'atributo'
          ? `t${escolhido.tema_id}`
          : riscoDo(indice, escolhido)
            ? `r${escolhido.risco_id}`
            : 'sem';
      definirAbertos((atual) => ({ ...atual, [visao]: new Set(atual[visao]).add(chave) }));
      pulsar.current = escolhido.id;
    }
    definirFichaAberta(false);
    mudar({ visao });
  };

  const contagem = dimensao ? composicao(indice, dimensao, arvore.subtemas) : [];
  const numeros = totais(indice, estado.visao);

  return (
    <div className="arv">
      {/* TÍTULO CURTO, por pedido: os números já estão na faixa-resumo logo abaixo. */}
      <header>
        <h2>{estado.visao === 'atributo' ? 'Taxonomia de temas' : 'Taxonomia de riscos'}</h2>
      </header>

      <div className="arv-nav">
        <div className="arv-abas" role="tablist" aria-label="Visão da árvore">
          {(
            [
              ['atributo', 'Por atributo reputacional', 'Pilar, tema e subtema'],
              ['risco', 'Por risco corporativo', 'Cluster, risco e subtema'],
            ] as const
          ).map(([visao, rotulo, dica]) => (
            <button
              key={visao}
              type="button"
              role="tab"
              aria-selected={estado.visao === visao}
              onClick={() => (estado.subtema != null ? irPara(visao) : mudar({ visao }))}
            >
              {rotulo}
              <small>{dica}</small>
            </button>
          ))}
        </div>
        <label className="arv-busca">
          <svg viewBox="0 0 24 24" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-4-4" />
          </svg>
          <input
            type="search"
            value={estado.busca}
            onChange={(evento) => mudar({ busca: evento.target.value })}
            placeholder="Buscar subtema, tema ou risco"
            aria-label="Buscar subtema, tema ou risco"
          />
        </label>
      </div>

      <div className="arv-resumo">
        <div className="arv-numeros">
          {numeros.map((numero) => (
            <div key={numero.rotulo}>
              <b>{numero.valor}</b>
              <span>{numero.rotulo}</span>
            </div>
          ))}
        </div>
        {dimensao ? (
          <div>
            <div className="arv-dist-rotulo">
              {dimensao.titulo}
              <span>
                {ativo
                  ? `${emDestaque} de ${arvore.subtemas.length} subtemas em destaque`
                  : 'Clique para filtrar'}
              </span>
            </div>
            <div className="arv-pilha">
              <Pilha partes={contagem} />
            </div>
            <div className="arv-filtros">
              {contagem.map(({ valor, quantos }) => (
                <button
                  key={valor.codigo}
                  type="button"
                  className={`arv-filtro${filtro.size && !filtro.has(valor.codigo) ? ' arv-apagado' : ''}`}
                  aria-pressed={filtro.has(valor.codigo)}
                  onClick={() =>
                    mudar({
                      filtro: filtro.has(valor.codigo)
                        ? estado.filtro.filter((c) => c !== valor.codigo)
                        : [...estado.filtro, valor.codigo],
                    })
                  }
                >
                  <i style={{ background: fundo(valor) }} />
                  {valor.nome}
                  <b>{quantos}</b>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div />
        )}
        <div className="arv-controles">
          <div className="arv-seg" role="group" aria-label="Cor do subtema">
            <span>Cor do subtema</span>
            {arvore.cores.map((opcao) => (
              <button
                key={opcao.chave}
                type="button"
                aria-pressed={opcao.chave === dimensao?.chave}
                onClick={() => mudar({ cor: opcao.chave === arvore.cores[0].chave ? '' : opcao.chave, filtro: [] })}
              >
                {opcao.nome}
              </button>
            ))}
          </div>
          <div className="arv-links">
            <button type="button" className="arv-link" onClick={() => abrirTodos(colunas.flatMap((c) => c.grupos), true)}>
              Expandir tudo
            </button>
            <button type="button" className="arv-link" onClick={() => abrirTodos(colunas.flatMap((c) => c.grupos), false)}>
              Recolher tudo
            </button>
          </div>
        </div>
      </div>

      <div className="arv-grade">
        {colunas.map((coluna) => (
              <Cartao
                key={coluna.chave}
                coluna={coluna}
                visao={estado.visao}
                indice={indice}
                dimensao={dimensao}
                dimensaoDoRisco={dimensaoDoRisco}
                abertos={abertos[estado.visao]}
                ativo={ativo}
                passaNaTela={passaNaTela}
                busca={Boolean(estado.busca.trim())}
                escolhido={estado.subtema}
                aoAlternar={alternarGrupo}
                aoAlternarTodos={(abrir) => abrirTodos(coluna.grupos, abrir)}
                aoEscolher={(id) => {
                  definirFichaAberta(true);
                  mudar({ subtema: id });
                }}
              />
        ))}
      </div>

      <div className="arv-rodape">
        <p>
          {dimensao?.explicacao}{' '}
          {estado.visao === 'risco'
            ? 'O código ao lado do subtema indica pilar e tema de origem. Só o risco primário entra na contagem.'
            : 'A barra ao lado de cada tema mostra a composição dos seus subtemas.'}{' '}
          Clique em um subtema para abrir a ficha e ir até ele na outra árvore.
        </p>
        <p>
          Fonte: Cadastro de Temas, lido a cada abertura desta página. Severidade e cluster vêm sempre
          do risco primário.
        </p>
      </div>

      {estado.subtema != null && fichaAberta ? (
        <Ficha
          indice={indice}
          visao={estado.visao}
          subtemaId={estado.subtema}
          cores={arvore.cores}
          aoFechar={() => {
            definirFichaAberta(false);
            mudar({ subtema: null });
          }}
          aoIrPara={irPara}
        />
      ) : null}
    </div>
  );
}

/* -- um cartão (pilar ou cluster) ------------------------------------------------- */

function Cartao({
  coluna,
  visao,
  indice,
  dimensao,
  dimensaoDoRisco,
  abertos,
  ativo,
  passaNaTela,
  busca,
  escolhido,
  aoAlternar,
  aoAlternarTodos,
  aoEscolher,
}: {
  coluna: ColunaDaArvore;
  visao: VisaoDaArvore;
  indice: IndiceDaArvore;
  dimensao: DimensaoDeCorDaArvore | undefined;
  dimensaoDoRisco: DimensaoDeCorDaArvore | undefined;
  abertos: Set<string>;
  ativo: boolean;
  passaNaTela: (subtema: SubtemaDaArvore) => boolean;
  busca: boolean;
  escolhido: number | null;
  aoAlternar: (chave: string) => void;
  aoAlternarTodos: (abrir: boolean) => void;
  aoEscolher: (id: number) => void;
}) {
  const todos = coluna.grupos.flatMap((grupo) => grupo.subtemas);
  const comItens = coluna.grupos.filter((grupo) => grupo.subtemas.length);
  const tudoAberto = comItens.length > 0 && comItens.every((grupo) => abertos.has(grupo.chave));
  const resumo =
    visao === 'atributo'
      ? `${coluna.grupos.length} ${coluna.grupos.length === 1 ? 'tema' : 'temas'}`
      : coluna.semEnquadramento
        ? 'sem risco'
        : `${coluna.grupos.length} ${coluna.grupos.length === 1 ? 'risco' : 'riscos'}`;

  return (
    <section className="arv-cartao">
      <button
        type="button"
        className={`arv-cab${coluna.semEnquadramento ? ' arv-cab--sem' : ''}`}
        title="Abrir ou fechar todos"
        onClick={() => aoAlternarTodos(!tudoAberto)}
      >
        <span className="arv-cab-titulo">
          <b title={coluna.nome}>{coluna.nome}</b>
          <small>
            {resumo} · {todos.length} {todos.length === 1 ? 'subtema' : 'subtemas'}
          </small>
        </span>
        <span className="arv-pilha" style={{ display: 'flex' }}>
          {dimensao && todos.length ? <Pilha partes={composicao(indice, dimensao, todos)} /> : null}
        </span>
      </button>
      {coluna.grupos.map((grupo) => {
        const vazio = grupo.subtemas.length === 0;
        const visiveis = grupo.subtemas.filter(passaNaTela);
        const aberto = !vazio && (ativo ? visiveis.length > 0 : abertos.has(grupo.chave));
        const apagado = ativo && visiveis.length === 0;
        const daLinha = grupo.risco && dimensaoDoRisco ? valorDoRisco(dimensaoDoRisco, grupo) : null;
        return (
          <div key={grupo.chave} className="arv-grupo">
            {visao === 'atributo' ? (
              <button
                type="button"
                className={`arv-linha${apagado ? ' arv-apagada' : ''}`}
                aria-expanded={aberto}
                onClick={() => aoAlternar(grupo.chave)}
              >
                <span className="arv-num">{grupo.numero}</span>
                <span>{grupo.nome}</span>
                <span className="arv-conta">{grupo.subtemas.length}</span>
                <span className="arv-mini">
                  {dimensao ? <Pilha partes={composicao(indice, dimensao, grupo.subtemas)} /> : null}
                </span>
                <span className="arv-seta" aria-hidden>
                  ▶
                </span>
              </button>
            ) : (
              <button
                type="button"
                className={`arv-linha arv-linha--risco${vazio ? ' arv-lacuna' : ''}${apagado ? ' arv-apagada' : ''}`}
                aria-expanded={aberto}
                title={vazio ? 'Nenhum subtema tem este risco como primário' : undefined}
                onClick={() => (vazio ? undefined : aoAlternar(grupo.chave))}
              >
                <span className="arv-barra" style={{ background: daLinha ? fundo(daLinha) : '#C4C8D6' }} />
                <span>{grupo.nome}</span>
                <span className="arv-conta">{grupo.subtemas.length}</span>
                <span
                  className="arv-sev"
                  style={
                    vazio || !daLinha
                      ? undefined
                      : { background: fundo(daLinha), color: textoSobre(daLinha.cor) }
                  }
                >
                  {vazio ? 'lacuna' : (daLinha?.nome ?? '')}
                </span>
                <span className="arv-seta" aria-hidden>
                  {vazio ? '' : '▶'}
                </span>
              </button>
            )}
            {aberto ? (
              <div className="arv-itens">
                {(ativo ? visiveis : grupo.subtemas).map((subtema) => {
                  const valor = dimensao ? valorDeCor(indice, dimensao, subtema) : null;
                  return (
                    <button
                      key={subtema.id}
                      type="button"
                      data-subtema={subtema.id}
                      className={`arv-sub-item${busca ? ' arv-achado' : ''}`}
                      aria-current={escolhido === subtema.id}
                      style={valor ? estiloDoItem(valor) : undefined}
                      onClick={() => aoEscolher(subtema.id)}
                    >
                      {visao === 'risco' ? (
                        <span className="arv-cod">{indice.numeroDoTema.get(subtema.tema_id)}</span>
                      ) : null}
                      <span>{subtema.nome}</span>
                      <span className="arv-ficha-seta">ficha ›</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}

function valorDoRisco(dimensao: DimensaoDeCorDaArvore, grupo: GrupoDaArvore): ValorDeCorDaArvore {
  const codigo = grupo.risco?.[dimensao.campo];
  return dimensao.valores.find((valor) => valor.codigo === codigo) ?? dimensao.vazio;
}

/* -- a ficha lateral ------------------------------------------------------------- */

function Ficha({
  indice,
  visao,
  subtemaId,
  cores,
  aoFechar,
  aoIrPara,
}: {
  indice: IndiceDaArvore;
  visao: VisaoDaArvore;
  subtemaId: number;
  cores: DimensaoDeCorDaArvore[];
  aoFechar: () => void;
  aoIrPara: (visao: VisaoDaArvore) => void;
}) {
  const subtema = indice.arvore.subtemas.find((s) => s.id === subtemaId);
  useEffect(() => {
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') aoFechar();
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [aoFechar]);
  if (!subtema) return null;

  const tema = indice.temaPorId.get(subtema.tema_id);
  const pilar = tema ? indice.pilarPorId.get(tema.pilar_id) : undefined;
  const risco = riscoDo(indice, subtema);
  const cluster = risco ? indice.clusterPorId.get(risco.cluster_id) : undefined;
  const numero = indice.numeroDoTema.get(subtema.tema_id) ?? '';
  const etiquetas = (alvo: string) =>
    cores
      .filter((dimensao) => dimensao.alvo === alvo)
      .map((dimensao) => {
        const valor = valorDeCor(indice, dimensao, subtema);
        return (
          <FragmentoKV key={dimensao.chave} rotulo={dimensao.nome}>
            <span className="arv-etiqueta" style={{ background: fundo(valor), color: textoSobre(valor.cor) }}>
              {valor.nome}
            </span>
          </FragmentoKV>
        );
      });

  return (
    <div
      className="arv-fundo"
      onClick={(evento) => {
        if (evento.target === evento.currentTarget) aoFechar();
      }}
    >
    <aside
      className="arv-ficha"
      role="dialog"
      aria-modal="true"
      aria-label={`Ficha do subtema ${subtema.nome}`}
    >
      <div className="arv-ficha-cab">
        <div>
          <small>Ficha do subtema · {numero}</small>
          <b>{subtema.nome}</b>
        </div>
        <button type="button" onClick={aoFechar} aria-label="Fechar a ficha">
          ×
        </button>
      </div>
      <div className="arv-ficha-corpo">
        <div className={`arv-no${visao === 'atributo' ? ' arv-no--aqui' : ''}`}>
          <h4>
            Atributo reputacional {visao === 'atributo' ? <span>você está aqui</span> : null}
          </h4>
          <dl className="arv-kv">
            <FragmentoKV rotulo="Pilar">{pilar?.nome}</FragmentoKV>
            <FragmentoKV rotulo="Tema">
              {numero} {tema?.nome}
            </FragmentoKV>
            {etiquetas('subtema')}
          </dl>
          {visao !== 'atributo' ? (
            <button type="button" className="arv-ir" onClick={() => aoIrPara('atributo')}>
              Ir para a árvore de atributos ›
            </button>
          ) : null}
        </div>
        <div className="arv-elo">
          <i />o mesmo subtema conecta as duas árvores
        </div>
        <div className={`arv-no${visao === 'risco' ? ' arv-no--aqui' : ''}`}>
          <h4>Risco corporativo {visao === 'risco' ? <span>você está aqui</span> : null}</h4>
          <dl className="arv-kv">
            {risco ? (
              <>
                <FragmentoKV rotulo="Cluster">{cluster?.nome}</FragmentoKV>
                <FragmentoKV rotulo="Primário">{risco.nome}</FragmentoKV>
                {etiquetas('risco')}
              </>
            ) : (
              <FragmentoKV rotulo="Risco">Sem enquadramento</FragmentoKV>
            )}
          </dl>
          {visao !== 'risco' ? (
            <button type="button" className="arv-ir" onClick={() => aoIrPara('risco')}>
              {risco ? 'Ir para o mapa de risco ›' : 'Ver os subtemas sem risco ›'}
            </button>
          ) : null}
        </div>
        {/* "EXPLORAR", por pedido: as matérias deste subtema na Base de dados,
            lente Imprensa, já filtradas. */}
        <button
          type="button"
          className="arv-explorar"
          onClick={() => explorarNaBase(subtema.nome)}
        >
          Explorar
          <small>Ver as matérias deste subtema na Base de dados · Imprensa</small>
        </button>
      </div>
    </aside>
    </div>
  );
}

/** Abre a Base de dados (lente Imprensa) filtrada pelo subtema. Navega como o
 *  resto do app: `pushState` e o aviso de `popstate`, que é o que o roteador
 *  escuta — o botão de voltar do navegador traz de volta para a árvore. */
function explorarNaBase(nomeDoSubtema: string) {
  const consulta = new URLSearchParams({ lente: 'imprensa', tema_n3: nomeDoSubtema });
  window.history.pushState(null, '', `/score/base-de-dados?${consulta.toString()}`);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo({ top: 0 });
}

function FragmentoKV({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <>
      <dt>{rotulo}</dt>
      <dd>{children}</dd>
    </>
  );
}
