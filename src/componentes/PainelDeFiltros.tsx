/** A seção de filtros: um bloco "Filtros Rápidos" sempre à vista, e um botão
 *  "Filtros Avançados" que expande o resto — um campo por linha, com todos os
 *  valores já em pílulas clicáveis. Sem menu escondido: escolher é UM clique,
 *  não dois.
 *
 *  Referência trazida pelo usuário: uma tela de controle de projeto onde
 *  cada campo (Aplicação, Fase, Status...) aparece como rótulo + pílulas
 *  sempre visíveis, que ligam/desligam no próprio clique. Esta seção segue a
 *  mesma lógica para os campos do Recorte.
 *
 *  Clicar numa pílula já marcada REMOVE o filtro — a mesma regra de
 *  `alternar()` usada em toda a tela (chip de frente, bolha do mapa, item de
 *  ranking). "Temas" e "Área(s)" são exceção: aceitam vários ao mesmo tempo.
 *
 *  A DIVISÃO RÁPIDOS/AVANÇADOS é curatorial, e não um cálculo (ex.: "os 5 mais
 *  usados"): Frente, Período, Relevância e Temas são os que quem pediu esta
 *  tela disse abrir toda vez; o resto — Esfera, Clima, Desfecho, Situação,
 *  Unidade, Instituição, Tipo de investidor, UF — é consultado com menos
 *  frequência e fica atrás do clique em "Filtros avançados".
 *
 *  "ÁREA(S)" NÃO MORA EM NENHUM DOS DOIS GRUPOS NO PAINEL: lá ela é um bloco
 *  fixo e sempre visível, logo abaixo da barra "Síntese Executiva" (ver
 *  `campoDeAreaPorCategoria`/`GrupoDeCampo`, reaproveitados por `Painel.tsx`).
 *  Em Explorar/Base — as outras telas que montam este componente — não existe
 *  essa barra para ancorar um bloco fixo, então lá ela continua acessível,
 *  só que dentro de "Filtros avançados" em vez de "Filtros rápidos".
 *
 *  LISTAS GRANDES (Instituição, Temas, UF) começam recolhidas em
 *  `LIMITE_PADRAO` itens, com uma pílula "+N" para abrir o resto. Sem isso, um
 *  cadastro com trinta assuntos empurraria os campos seguintes para fora da
 *  tela assim que a seção abrisse.
 *
 *  NÃO INCLUI "Busca livre": esse campo é texto digitado, não uma lista de
 *  valores — por isso mora fixo em `BarraDeRecorte`, e nunca aqui.
 */

import { useState } from 'react';
import type { CSSProperties } from 'react';
import { usePainel } from '@/estado/painel';
import {
  alternarCategoriaDeArea,
  alternarCategoriaPublico,
  alternarFormatoInteracao,
  ATALHOS_DE_PERIODO,
} from '@/dominio/recorte';
import type { AtalhoDoFuturo, AtalhoDoPassado, Recorte } from '@/dominio/recorte';
import { categoriasDeArea, idsPorCategoriaDeArea } from '@/dominio/derivacoes';
import type { Catalogo } from '@/dominio/derivacoes';
import type { Frente, GrupoDeStatus } from '@/dominio/tipos';
import type { Destino } from '@/navegacao/rota';

const LIMITE_PADRAO = 10;

interface ItemDeValor {
  valor: string;
  rotulo: string;
}

export interface CampoDeFiltro {
  chave: string;
  rotulo: string;
  itens: ItemDeValor[];
  valorAtual?: string;
  multiplo?: boolean;
  selecionados?: string[];
  aoEscolher: (valor: string) => void;
}

/** O campo "Área(s)" por CATEGORIA (`CATEGORIAS_DE_AREA`), não por área
 *  individual — mesma ideia de `alternarCategoriaDeArea` usada no clique da
 *  rosca de "Interações por áreas": marcar "RI & Oper. Financeiras" liga/
 *  desliga as duas áreas reais daquela categoria juntas.
 *
 *  EXPORTADA (e não uma das entradas fixas de `CAMPOS_RAPIDOS`/
 *  `CAMPOS_AVANCADOS`) porque tem DOIS pontos de montagem: aqui, dentro de
 *  "Filtros avançados" (Explorar/Base); e em `Painel.tsx`, como bloco fixo
 *  sempre visível abaixo da barra "Síntese Executiva" — ver o comentário no
 *  topo do arquivo. */
export function campoDeAreaPorCategoria(
  recorte: Recorte,
  definirRecorte: (recorte: Recorte) => void,
  catalogo: Catalogo | null | undefined,
): CampoDeFiltro {
  const idsPorCategoria = catalogo ? idsPorCategoriaDeArea(catalogo) : new Map<string, Set<number>>();
  const categorias = catalogo ? categoriasDeArea(catalogo) : [];
  const atuais = new Set(recorte.areas ?? []);

  return {
    chave: 'areas',
    rotulo: 'Filtro Áreas',
    multiplo: true,
    // Categoria sem nenhum id ativo (as duas áreas dela desativadas) não
    // aparece como pílula — ela nunca teria efeito nenhum no recorte.
    itens: categorias.filter((c) => (idsPorCategoria.get(c.rotulo)?.size ?? 0) > 0).map(
      (c) => ({ valor: c.rotulo, rotulo: c.rotulo }),
    ),
    // Marcada quando TODAS as áreas da categoria já estão no recorte — não
    // "pelo menos uma", senão um clique que liga as duas pareceria já
    // marcado com só uma ligada por fora.
    selecionados: categorias.filter((c) => {
      const ids = idsPorCategoria.get(c.rotulo);
      return !!ids?.size && [...ids].every((id) => atuais.has(id));
    }).map((c) => c.rotulo),
    aoEscolher: (valor: string) =>
      definirRecorte(alternarCategoriaDeArea(recorte, idsPorCategoria.get(valor) ?? [])),
  };
}

/** O campo "Categoria de público" (`catalogo.dicionarios.categorias_publico`),
 *  como bloco fixo do Painel — mesma ideia de `campoDeAreaPorCategoria`, só
 *  que sem a indireção de categoria-de-categoria: aqui cada item já É uma
 *  categoria da taxonomia, sem grupo por baixo para resolver. */
export function campoDeCategoriaPublico(
  recorte: Recorte,
  definirRecorte: (recorte: Recorte) => void,
  catalogo: Catalogo | null | undefined,
): CampoDeFiltro {
  const atuais = new Set(recorte.categoriaPublico ?? []);
  return {
    chave: 'categoriaPublico',
    rotulo: 'Filtro Tipo de Público',
    multiplo: true,
    itens: (catalogo?.dicionarios.categorias_publico ?? []).map((c) => ({
      valor: String(c.id),
      rotulo: c.nome,
    })),
    selecionados: (catalogo?.dicionarios.categorias_publico ?? [])
      .filter((c) => atuais.has(c.id))
      .map((c) => String(c.id)),
    aoEscolher: (valor: string) =>
      definirRecorte(alternarCategoriaPublico(recorte, Number(valor))),
  };
}

/** O campo "Formato da interação" (`catalogo.dicionarios.formatos_interacao`
 *  — Mídia, Agenda de mercado, Agenda pública, Manifestação formal, Evento,
 *  Visita, Reunião), como bloco fixo do Painel — mesma ideia de
 *  `campoDeCategoriaPublico`: multisseleção com OR, sem indireção de grupo.
 *
 *  NÃO É `frente` (Imprensa/Entidades/Parceiros...): "formato" responde "que
 *  tipo de encontro foi esse", `frente` responde "quem é a contraparte" — as
 *  duas colunas são ortogonais, ver `0038_formato_interacao.sql`. */
export function campoDeFormatoInteracao(
  recorte: Recorte,
  definirRecorte: (recorte: Recorte) => void,
  catalogo: Catalogo | null | undefined,
): CampoDeFiltro {
  const atuais = new Set(recorte.formatoInteracao ?? []);
  return {
    chave: 'formatoInteracao',
    rotulo: 'Filtro Tipo de Interação',
    multiplo: true,
    itens: (catalogo?.dicionarios.formatos_interacao ?? []).map((f) => ({
      valor: String(f.id),
      rotulo: f.nome,
    })),
    selecionados: (catalogo?.dicionarios.formatos_interacao ?? [])
      .filter((f) => atuais.has(f.id))
      .map((f) => String(f.id)),
    aoEscolher: (valor: string) =>
      definirRecorte(alternarFormatoInteracao(recorte, Number(valor))),
  };
}

/** Hoje, sem hora — é o que faz "há 10 dias" bater no dia seguinte também,
 *  em vez de variar com o minuto em que alguém abriu a tela. */
function meiaNoiteDeHoje(): Date {
  const agora = new Date();
  return new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
}

/** `de` (AAAA-MM-DD) → quantos dias atrás disso é, a partir de hoje. */
function diasDesde(iso: string): number {
  const inicio = new Date(`${iso}T00:00:00`);
  return Math.round((meiaNoiteDeHoje().getTime() - inicio.getTime()) / 86_400_000);
}

/** `ate` (AAAA-MM-DD) → daqui a quantos dias é, a partir de hoje. Espelha
 *  `diasDesde`, para o lado de "próximos". */
function diasAte(iso: string): number {
  const fim = new Date(`${iso}T00:00:00`);
  return Math.round((fim.getTime() - meiaNoiteDeHoje().getTime()) / 86_400_000);
}

/** Quantos dias atrás → `de` (AAAA-MM-DD), para gravar no recorte. */
function deHaDias(dias: number): string {
  const data = meiaNoiteDeHoje();
  data.setDate(data.getDate() - dias);
  return data.toISOString().slice(0, 10);
}

/** Daqui a quantos dias → `ate` (AAAA-MM-DD). Espelha `deHaDias`. */
function ateEmDias(dias: number): string {
  const data = meiaNoiteDeHoje();
  data.setDate(data.getDate() + dias);
  return data.toISOString().slice(0, 10);
}

export function PainelDeFiltros({ view }: { view: Destino }) {
  const { recorte, definirRecorte, catalogo } = usePainel();
  const [abertoAvancados, definirAbertoAvancados] = useState(false);
  //: RETRÁTIL COMO OS AVANÇADOS: quem já escolheu o que precisa pode recolher
  //: para sobrar tela para a tabela.
  const [abertoRapidos, definirAbertoRapidos] = useState(false);

  const definirOuAlternar = <C extends keyof Recorte>(
    campo: C,
    valorAtual: string | undefined,
    valorNovo: string,
    converter: (valor: string) => Recorte[C],
  ) => {
    const proximo = { ...recorte };
    if (valorAtual === valorNovo) delete proximo[campo];
    else proximo[campo] = converter(valorNovo);
    definirRecorte(proximo);
  };

  const alternarTema = (nome: string) => {
    const atuais = new Set(recorte.tags ?? []);
    if (atuais.has(nome)) atuais.delete(nome);
    else atuais.add(nome);
    const tags = [...atuais].sort();
    definirRecorte(tags.length ? { ...recorte, tags } : { ...recorte, tags: undefined });
  };

  const CAMPOS_RAPIDOS: CampoDeFiltro[] = [
    {
      chave: 'frente',
      rotulo: 'Frente',
      valorAtual: recorte.frente,
      itens: (catalogo?.dicionarios.frentes ?? []).map((f) => ({ valor: f.codigo, rotulo: f.nome })),
      aoEscolher: (valor: string) => definirOuAlternar('frente', recorte.frente, valor, (v) => v as Frente),
    },
    {
      chave: 'tier',
      rotulo: 'Relevância',
      valorAtual: recorte.tier != null ? String(recorte.tier) : undefined,
      itens: (catalogo?.dicionarios.relevancias ?? []).map((n) => ({
        valor: String(n.id),
        rotulo: n.nome,
      })),
      aoEscolher: (valor: string) =>
        definirOuAlternar(
          'tier',
          recorte.tier != null ? String(recorte.tier) : undefined,
          valor,
          (v) => Number(v),
        ),
    },
    {
      chave: 'tags',
      rotulo: 'Temas',
      multiplo: true,
      selecionados: recorte.tags ?? [],
      itens: (catalogo?.dicionarios.temas ?? []).map((t) => ({ valor: t.nome, rotulo: t.nome })),
      aoEscolher: alternarTema,
    },
  ].filter((campo) => campo.itens.length > 0);

  const CAMPOS_AVANCADOS: CampoDeFiltro[] = [
    // NO PAINEL, "Área(s)" mora fixa abaixo da "Síntese Executiva" — ver o
    // comentário no topo do arquivo — e não duplica aqui.
    ...(view !== 'painel' ? [campoDeAreaPorCategoria(recorte, definirRecorte, catalogo ?? null)] : []),
    {
      chave: 'esfera',
      rotulo: 'Esfera',
      valorAtual: recorte.esfera,
      itens: (catalogo?.dicionarios.esferas ?? []).map((e) => ({ valor: e.codigo, rotulo: e.nome })),
      aoEscolher: (valor: string) => definirOuAlternar('esfera', recorte.esfera, valor, (v) => v),
    },
    {
      chave: 'clima',
      rotulo: 'Clima registrado',
      valorAtual: recorte.clima,
      itens: (catalogo?.dicionarios.climas ?? []).map((c) => ({ valor: c.codigo, rotulo: c.nome })),
      aoEscolher: (valor: string) => definirOuAlternar('clima', recorte.clima, valor, (v) => v),
    },
    // DOIS FILTROS DE CLIMA, um por momento: o esperado ao marcar a reunião e
    // o registrado depois dela. Mesmo dicionário, campos distintos do recorte.
    {
      chave: 'climaEsperado',
      rotulo: 'Clima esperado',
      valorAtual: recorte.climaEsperado,
      itens: (catalogo?.dicionarios.climas ?? []).map((c) => ({ valor: c.codigo, rotulo: c.nome })),
      aoEscolher: (valor: string) =>
        definirOuAlternar('climaEsperado', recorte.climaEsperado, valor, (v) => v),
    },
    {
      chave: 'resultado',
      rotulo: 'Desfecho',
      valorAtual: recorte.resultado,
      itens: (catalogo?.dicionarios.resultados ?? []).map((r) => ({ valor: r.codigo, rotulo: r.nome })),
      aoEscolher: (valor: string) => definirOuAlternar('resultado', recorte.resultado, valor, (v) => v),
    },
    {
      chave: 'grupo',
      rotulo: 'Situação',
      valorAtual: recorte.grupo,
      itens: (catalogo?.dicionarios.grupos_de_status ?? []).map((g) => ({
        valor: g.codigo,
        rotulo: g.nome,
      })),
      aoEscolher: (valor: string) => definirOuAlternar('grupo', recorte.grupo, valor, (v) => v as GrupoDeStatus),
    },
    {
      chave: 'unidade',
      rotulo: 'Unidade de negócio',
      valorAtual: recorte.unidade,
      itens: (catalogo?.dicionarios.unidades_negocio ?? []).map((u) => ({
        valor: u.nome,
        rotulo: u.nome,
      })),
      aoEscolher: (valor: string) => definirOuAlternar('unidade', recorte.unidade, valor, (v) => v),
    },
    {
      chave: 'entidade',
      rotulo: 'Instituição',
      valorAtual: recorte.entidade,
      // COM AS DESATIVADAS, de propósito: o filtro recorta HISTÓRICO, e uma
      // instituição desativada é justamente a que só existe no histórico.
      // Tirá-la daqui esconderia as agendas dela sem esconder os números.
      itens: [...(catalogo?.instituicoes.values() ?? [])].map((i) => ({
        valor: i.nome,
        rotulo: i.nome,
      })),
      aoEscolher: (valor: string) => definirOuAlternar('entidade', recorte.entidade, valor, (v) => v),
    },
    {
      chave: 'subtipo',
      rotulo: 'Tipo de investidor',
      valorAtual: recorte.subtipo,
      itens: (catalogo?.dicionarios.tipos_investidor ?? []).map((t) => ({
        valor: t.codigo,
        rotulo: t.nome,
      })),
      aoEscolher: (valor: string) => definirOuAlternar('subtipo', recorte.subtipo, valor, (v) => v),
    },
    {
      chave: 'uf',
      rotulo: 'UF',
      valorAtual: recorte.uf,
      itens: (catalogo?.dicionarios.ufs ?? []).map((u) => ({ valor: u.codigo, rotulo: u.nome })),
      aoEscolher: (valor: string) => definirOuAlternar('uf', recorte.uf, valor, (v) => v),
    },
  ].filter((campo) => campo.itens.length > 0);

  const ativosContando = (campos: CampoDeFiltro[]) =>
    campos.filter((c) => (c.multiplo ? (c.selecionados?.length ?? 0) > 0 : c.valorAtual != null)).length;

  const ativosAvancados = ativosContando(CAMPOS_AVANCADOS);
  const ativosRapidos =
    ativosContando(CAMPOS_RAPIDOS) +
    (recorte.periodoPassado || recorte.periodoFuturo || recorte.de || recorte.ate ? 1 : 0);

  return (
    <div className="sem-impressao" style={{ marginBottom: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* -- Filtros Rápidos: retrátil como os avançados, mas nasce aberto --- */}
      <div
        style={{
          border: '1px solid var(--borda)',
          borderRadius: 'var(--r-card-int)',
          background: 'var(--branco)',
        }}
      >
        <button
          type="button"
          onClick={() => definirAbertoRapidos((v) => !v)}
          aria-expanded={abertoRapidos}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 14px',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontSize: 12.5,
            fontWeight: 700,
            color: 'var(--azul-mar)',
            letterSpacing: '0.02em',
          }}
        >
          <span>Filtros rápidos{ativosRapidos ? ` · ${ativosRapidos}` : ''}</span>
          <SetaDaAegea aberto={abertoRapidos} />
        </button>

        {abertoRapidos ? (
          <div
            style={{
              padding: '4px 14px 16px',
              borderTop: '1px solid var(--borda)',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <CampoDePeriodo recorte={recorte} definirRecorte={definirRecorte} />
            {CAMPOS_RAPIDOS.map((campo) => (
              <GrupoDeCampo key={campo.chave} campo={campo} />
            ))}
          </div>
        ) : null}
      </div>

      {/* -- Filtros Avançados: atrás do clique, para não poluir a tela ----- */}
      {CAMPOS_AVANCADOS.length > 0 ? (
        <div
          style={{
            border: '1px solid var(--borda)',
            borderRadius: 'var(--r-card-int)',
            background: 'var(--branco)',
          }}
        >
          <button
            type="button"
            onClick={() => definirAbertoAvancados((v) => !v)}
            aria-expanded={abertoAvancados}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 14px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: 12.5,
              fontWeight: 700,
              color: 'var(--cinza-3)',
            }}
          >
            <span>Filtros avançados{ativosAvancados ? ` · ${ativosAvancados}` : ''}</span>
            <SetaDaAegea aberto={abertoAvancados} />
          </button>

          {abertoAvancados ? (
            <div
              style={{
                padding: '4px 14px 16px',
                borderTop: '1px solid var(--borda)',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              {CAMPOS_AVANCADOS.map((campo) => (
                <GrupoDeCampo key={campo.chave} campo={campo} />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** O período — atalhos de sempre, mais um "Últimos N dias" de preenchimento
 *  livre. Cobre o caso que os quatro atalhos fixos não previam ("os últimos
 *  45 dias", "os últimos 200") sem multiplicar pílula por número.
 *
 *  Fica FORA de `CampoDeFiltro`/`GrupoDeCampo`: as pílulas ali são todas do
 *  tipo "escolher um valor de uma lista fechada", e o campo de dias é o
 *  oposto disso — um número que a pessoa digita. */
function CampoDePeriodo({
  recorte,
  definirRecorte,
}: {
  recorte: Recorte;
  definirRecorte: (recorte: Recorte) => void;
}) {
  //: O texto do campo "Últimos ___ dias" nasce do que o recorte já diz —
  //: `de` agora pertence só a este lado (Passado), então basta checar se ele
  //: veio de texto livre (sem `periodoPassado` junto) e não mais comparar
  //: com hoje: antes da divisão de `de`/`ate` por lado, os dois eram
  //: escritos juntos e só dava para saber quem escreveu comparando `ate`
  //: com hoje — essa ambiguidade não existe mais.
  const derivadoPassado =
    recorte.de && !recorte.periodoPassado ? String(diasDesde(recorte.de)) : '';
  const [anteriorPassado, definirAnteriorPassado] = useState(derivadoPassado);
  const [diasNoPassado, definirDiasNoPassado] = useState(derivadoPassado);
  if (derivadoPassado !== anteriorPassado) {
    definirAnteriorPassado(derivadoPassado);
    definirDiasNoPassado(derivadoPassado);
  }

  //: MESMA LÓGICA, para o lado de "Próximos".
  const derivadoFuturo =
    recorte.ate && !recorte.periodoFuturo ? String(diasAte(recorte.ate)) : '';
  const [anteriorFuturo, definirAnteriorFuturo] = useState(derivadoFuturo);
  const [diasNoFuturo, definirDiasNoFuturo] = useState(derivadoFuturo);
  if (derivadoFuturo !== anteriorFuturo) {
    definirAnteriorFuturo(derivadoFuturo);
    definirDiasNoFuturo(derivadoFuturo);
  }

  function aplicarPassado() {
    const numero = Number(diasNoPassado);
    if (!diasNoPassado.trim() || !Number.isFinite(numero) || numero <= 0) return;
    // Só mexe no lado Passado — `ate`/`periodoFuturo` ficam como estavam,
    // para não apagar uma seleção de Futuro que já exista.
    const proximo = { ...recorte, de: deHaDias(numero) };
    delete proximo.periodoPassado;
    definirRecorte(proximo);
  }

  function aplicarFuturo() {
    const numero = Number(diasNoFuturo);
    if (!diasNoFuturo.trim() || !Number.isFinite(numero) || numero <= 0) return;
    const proximo = { ...recorte, ate: ateEmDias(numero) };
    delete proximo.periodoFuturo;
    definirRecorte(proximo);
  }

  //: OS ATALHOS SE DIVIDEM PELO PRÓPRIO NOME: "proximos-*" é o único prefixo
  //: que olha para a frente; "ultimos-*" olha para trás. Não é uma lista
  //: separada para manter em dia — é a mesma `ATALHOS_DE_PERIODO` de sempre,
  //: só particionada na hora de desenhar.
  const atalhosDoPassado = Object.entries(ATALHOS_DE_PERIODO).filter(
    ([chave]) => !chave.startsWith('proximos-'),
  );
  const atalhosDoFuturo = Object.entries(ATALHOS_DE_PERIODO).filter(([chave]) =>
    chave.startsWith('proximos-'),
  );

  //: PASSADO E FUTURO SÃO CAMPOS DIFERENTES DO RECORTE agora
  //: (`periodoPassado`/`periodoFuturo`) — por isso a função recebe de qual
  //: lado veio o clique, e só mexe nesse lado. Antes da divisão, os dois
  //: escreviam o mesmo campo `periodo`, e escolher um sempre substituía o
  //: outro; combinar os dois exige justamente que isso pare de acontecer.
  const escolherAtalho = (lado: 'passado' | 'futuro', chave: string) => {
    const proximo = { ...recorte };
    if (lado === 'passado') {
      if (recorte.periodoPassado === chave) delete proximo.periodoPassado;
      else proximo.periodoPassado = chave as AtalhoDoPassado;
      delete proximo.de;
    } else {
      if (recorte.periodoFuturo === chave) delete proximo.periodoFuturo;
      else proximo.periodoFuturo = chave as AtalhoDoFuturo;
      delete proximo.ate;
    }
    definirRecorte(proximo);
  };

  return (
    <div>
      <div style={ESTILO_DO_ROTULO}>Período</div>
      {/* DOIS SUB-BLOCOS, e não uma fileira só: "passado" e "futuro" são
          perguntas diferentes ("o que já aconteceu" vs. "o que vem por aí"),
          e misturados numa fileira só a pessoa precisa ler o texto de cada
          pílula para saber de que lado do calendário ela está. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <div style={ESTILO_DO_SUBROTULO}>Passado</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            {atalhosDoPassado.map(([chave, rotulo]) => (
              <button
                key={chave}
                type="button"
                onClick={() => escolherAtalho('passado', chave)}
                style={pilulaEstilo(recorte.periodoPassado === chave)}
              >
                {rotulo}
              </button>
            ))}
            <CaixaDeDias
              rotulo="Últimos"
              valor={diasNoPassado}
              aoAlterar={definirDiasNoPassado}
              aoAplicar={aplicarPassado}
              rotuloAcessivel="Quantidade de dias atrás, até hoje"
            />
          </div>
        </div>

        <div>
          <div style={ESTILO_DO_SUBROTULO}>Futuro</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            {atalhosDoFuturo.map(([chave, rotulo]) => (
              <button
                key={chave}
                type="button"
                onClick={() => escolherAtalho('futuro', chave)}
                style={pilulaEstilo(recorte.periodoFuturo === chave)}
              >
                {rotulo}
              </button>
            ))}
            <CaixaDeDias
              rotulo="Próximos"
              valor={diasNoFuturo}
              aoAlterar={definirDiasNoFuturo}
              aoAplicar={aplicarFuturo}
              rotuloAcessivel="Quantidade de dias à frente, a partir de hoje"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/** A caixinha "Últimos ___ dias" / "Próximos ___ dias" — mesmo desenho pros
 *  dois lados do calendário, só o rótulo e o sentido da conta mudam. */
function CaixaDeDias({
  rotulo,
  valor,
  aoAlterar,
  aoAplicar,
  rotuloAcessivel,
}: {
  rotulo: string;
  valor: string;
  aoAlterar: (valor: string) => void;
  aoAplicar: () => void;
  rotuloAcessivel: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        height: 27,
        padding: '0 4px 0 12px',
        borderRadius: 'var(--r-chip)',
        border: `1px solid ${valor ? 'var(--azul-mar)' : 'var(--borda-input)'}`,
        background: valor ? 'var(--bg-hover)' : 'var(--branco)',
      }}
    >
      <span style={{ fontSize: 12, color: 'var(--cinza-3)' }}>{rotulo}</span>
      <input
        type="number"
        min={1}
        inputMode="numeric"
        value={valor}
        onChange={(evento) => aoAlterar(evento.target.value)}
        onBlur={aoAplicar}
        onKeyDown={(evento) => {
          if (evento.key === 'Enter') {
            evento.preventDefault();
            aoAplicar();
          }
        }}
        placeholder="N"
        aria-label={rotuloAcessivel}
        style={{
          width: 44,
          height: 21,
          padding: '0 4px',
          border: 'none',
          background: 'transparent',
          color: 'var(--cinza-4)',
          fontSize: 12.5,
          textAlign: 'center',
        }}
      />
      <span style={{ fontSize: 12, color: 'var(--cinza-3)' }}>dias</span>
    </div>
  );
}

/** A seta que abre/fecha "Filtros avançados" — maior e na cor da marca, e não
 *  o `▾` pequeno e cinza de antes. O selo circular é o que dá peso ao gesto de
 *  clicar; a rotação de 180° continua sendo o que diz "já está aberto". */
function SetaDaAegea({ aberto }: { aberto: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 22,
        height: 22,
        borderRadius: '50%',
        background: 'var(--bg-trilho)',
        flexShrink: 0,
        transform: aberto ? 'rotate(180deg)' : 'none',
        transition: 'transform .18s',
      }}
    >
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
        <path
          d="M3.2 6 8 10.4 12.8 6"
          stroke="var(--azul-mar)"
          strokeWidth="2.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

/** O título de cada campo de filtro (Período, Frente, Área(s)…) — na cor da
 *  marca, e um pouco maior que o texto das pílulas abaixo, para que a lista de
 *  rótulos funcione como um índice rápido de "que filtros existem aqui". */
const ESTILO_DO_ROTULO: CSSProperties = {
  fontSize: 12.5,
  fontWeight: 700,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: 'var(--turquesa-rio)',
  marginBottom: 8,
};

/** Mesmo rótulo, tingido com `--sobre-turquesa` — a versão `--turquesa-rio`
 *  some contra o próprio fundo da faixa fixa de filtros do Painel. */
/** "Passado"/"Futuro", dentro do campo Período — mais discreto que o título
 *  do campo, senão os dois níveis de rótulo se confundem à primeira olhada. */
const ESTILO_DO_SUBROTULO: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--cinza-2)',
  marginBottom: 6,
};

export function GrupoDeCampo({ campo }: { campo: CampoDeFiltro }) {
  const [expandido, definirExpandido] = useState(false);
  const visiveis = expandido ? campo.itens : campo.itens.slice(0, LIMITE_PADRAO);
  const escondidos = campo.itens.length - visiveis.length;

  return (
    <div>
      <div style={ESTILO_DO_ROTULO}>{campo.rotulo}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {visiveis.map((item) => {
          const marcado = campo.multiplo
            ? (campo.selecionados ?? []).includes(item.valor)
            : campo.valorAtual === item.valor;
          return (
            <button
              key={item.valor}
              type="button"
              onClick={() => campo.aoEscolher(item.valor)}
              style={pilulaEstilo(marcado)}
            >
              {item.rotulo}
            </button>
          );
        })}
        {escondidos > 0 ? (
          <button type="button" onClick={() => definirExpandido(true)} style={pilulaFantasmaEstilo}>
            +{escondidos}
          </button>
        ) : expandido && campo.itens.length > LIMITE_PADRAO ? (
          <button type="button" onClick={() => definirExpandido(false)} style={pilulaFantasmaEstilo}>
            mostrar menos
          </button>
        ) : null}
      </div>
    </div>
  );
}

function pilulaEstilo(marcado: boolean): CSSProperties {
  return {
    height: 27,
    padding: '0 12px',
    borderRadius: 'var(--r-chip)',
    border: marcado ? '1px solid var(--azul-mar)' : '1px solid var(--borda-input)',
    background: marcado ? 'var(--azul-mar)' : 'var(--branco)',
    color: marcado ? 'var(--branco)' : 'var(--cinza-3)',
    fontSize: 12,
    fontWeight: marcado ? 700 : 500,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  };
}

const pilulaFantasmaEstilo: CSSProperties = {
  height: 27,
  padding: '0 12px',
  borderRadius: 'var(--r-chip)',
  border: '1px dashed var(--borda-input)',
  background: 'transparent',
  color: 'var(--cinza-2)',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};
