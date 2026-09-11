/** A seção "Filtros" — um campo por linha, com todos os valores já em
 *  pílulas clicáveis. Sem menu escondido: escolher é UM clique, não dois.
 *
 *  Referência trazida pelo usuário: uma tela de controle de projeto onde
 *  cada campo (Aplicação, Fase, Status...) aparece como rótulo + pílulas
 *  sempre visíveis, que ligam/desligam no próprio clique. Esta seção segue a
 *  mesma lógica para os campos do Recorte.
 *
 *  Clicar numa pílula já marcada REMOVE o filtro — a mesma regra de
 *  `alternar()` usada em toda a tela (chip de frente, bolha do mapa, item de
 *  ranking). "Assuntos" é a exceção: aceita vários ao mesmo tempo.
 *
 *  LISTAS GRANDES (Instituição, Assuntos, UF) começam recolhidas em
 *  `LIMITE_PADRAO` itens, com uma pílula "+N" para abrir o resto. Sem isso, um
 *  cadastro com trinta assuntos empurraria os campos seguintes para fora da
 *  tela assim que a seção abrisse — o mesmo problema que a gaveta antiga já
 *  tinha resolvido de outro jeito, e que continua valendo aqui.
 *
 *  NÃO INCLUI "Busca livre": esse campo é texto digitado, não uma lista de
 *  valores — por isso mora fixo em `BarraDeRecorte`, e nunca aqui.
 */

import { useState } from 'react';
import type { CSSProperties } from 'react';
import { usePainel } from '@/estado/painel';
import { ATALHOS_DE_PERIODO } from '@/dominio/recorte';
import type { AtalhoDePeriodo, Recorte } from '@/dominio/recorte';
import type { Frente, GrupoDeStatus } from '@/dominio/tipos';

const LIMITE_PADRAO = 10;

interface ItemDeValor {
  valor: string;
  rotulo: string;
}

interface CampoDeFiltro {
  chave: string;
  rotulo: string;
  itens: ItemDeValor[];
  valorAtual?: string;
  multiplo?: boolean;
  selecionados?: string[];
  aoEscolher: (valor: string) => void;
}

export function PainelDeFiltros() {
  const { recorte, definirRecorte, catalogo } = usePainel();
  const [aberto, definirAberto] = useState(false);

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

  const campos: CampoDeFiltro[] = [
    {
      chave: 'periodo',
      rotulo: 'Período',
      valorAtual: recorte.periodo,
      itens: Object.entries(ATALHOS_DE_PERIODO).map(([chave, rotulo]) => ({ valor: chave, rotulo })),
      aoEscolher: (valor) =>
        definirOuAlternar('periodo', recorte.periodo, valor, (v) => v as AtalhoDePeriodo),
    },
    {
      chave: 'frente',
      rotulo: 'Frente',
      valorAtual: recorte.frente,
      itens: (catalogo?.dicionarios.frentes ?? []).map((f) => ({ valor: f.codigo, rotulo: f.nome })),
      aoEscolher: (valor) => definirOuAlternar('frente', recorte.frente, valor, (v) => v as Frente),
    },
    {
      chave: 'esfera',
      rotulo: 'Esfera',
      valorAtual: recorte.esfera,
      itens: (catalogo?.dicionarios.esferas ?? []).map((e) => ({ valor: e.codigo, rotulo: e.nome })),
      aoEscolher: (valor) => definirOuAlternar('esfera', recorte.esfera, valor, (v) => v),
    },
    {
      chave: 'tier',
      rotulo: 'Relevância',
      valorAtual: recorte.tier != null ? String(recorte.tier) : undefined,
      itens: (catalogo?.dicionarios.relevancias ?? []).map((n) => ({
        valor: String(n.id),
        rotulo: n.nome,
      })),
      aoEscolher: (valor) =>
        definirOuAlternar(
          'tier',
          recorte.tier != null ? String(recorte.tier) : undefined,
          valor,
          (v) => Number(v),
        ),
    },
    {
      chave: 'clima',
      rotulo: 'Clima',
      valorAtual: recorte.clima,
      itens: (catalogo?.dicionarios.climas ?? []).map((c) => ({ valor: c.codigo, rotulo: c.nome })),
      aoEscolher: (valor) => definirOuAlternar('clima', recorte.clima, valor, (v) => v),
    },
    {
      chave: 'resultado',
      rotulo: 'Desfecho',
      valorAtual: recorte.resultado,
      itens: (catalogo?.dicionarios.resultados ?? []).map((r) => ({ valor: r.codigo, rotulo: r.nome })),
      aoEscolher: (valor) => definirOuAlternar('resultado', recorte.resultado, valor, (v) => v),
    },
    {
      chave: 'grupo',
      rotulo: 'Situação',
      valorAtual: recorte.grupo,
      itens: (catalogo?.dicionarios.grupos_de_status ?? []).map((g) => ({
        valor: g.codigo,
        rotulo: g.nome,
      })),
      aoEscolher: (valor) => definirOuAlternar('grupo', recorte.grupo, valor, (v) => v as GrupoDeStatus),
    },
    {
      chave: 'unidade',
      rotulo: 'Unidade de negócio',
      valorAtual: recorte.unidade,
      itens: (catalogo?.dicionarios.unidades_negocio ?? []).map((u) => ({
        valor: u.nome,
        rotulo: u.nome,
      })),
      aoEscolher: (valor) => definirOuAlternar('unidade', recorte.unidade, valor, (v) => v),
    },
    {
      chave: 'entidade',
      rotulo: 'Instituição',
      valorAtual: recorte.entidade,
      itens: [...(catalogo?.instituicoes.values() ?? [])].map((i) => ({
        valor: i.nome,
        rotulo: i.nome,
      })),
      aoEscolher: (valor) => definirOuAlternar('entidade', recorte.entidade, valor, (v) => v),
    },
    {
      chave: 'subtipo',
      rotulo: 'Tipo de investidor',
      valorAtual: recorte.subtipo,
      itens: (catalogo?.dicionarios.tipos_investidor ?? []).map((t) => ({
        valor: t.codigo,
        rotulo: t.nome,
      })),
      aoEscolher: (valor) => definirOuAlternar('subtipo', recorte.subtipo, valor, (v) => v),
    },
    {
      chave: 'uf',
      rotulo: 'UF',
      valorAtual: recorte.uf,
      itens: (catalogo?.dicionarios.ufs ?? []).map((u) => ({ valor: u.codigo, rotulo: u.nome })),
      aoEscolher: (valor) => definirOuAlternar('uf', recorte.uf, valor, (v) => v),
    },
    {
      chave: 'tags',
      rotulo: 'Assuntos',
      multiplo: true,
      selecionados: recorte.tags ?? [],
      itens: (catalogo?.dicionarios.temas ?? []).map((t) => ({ valor: t.nome, rotulo: t.nome })),
      aoEscolher: alternarTema,
    },
  ].filter((campo) => campo.itens.length > 0);

  const ativos = campos.filter((c) =>
    c.multiplo ? (c.selecionados?.length ?? 0) > 0 : c.valorAtual != null,
  ).length;

  return (
    <div
      className="sem-impressao"
      style={{
        border: '1px solid var(--borda)',
        borderRadius: 'var(--r-card-int)',
        background: 'var(--branco)',
        marginBottom: 18,
      }}
    >
      <button
        type="button"
        onClick={() => definirAberto((v) => !v)}
        aria-expanded={aberto}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '11px 14px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 700,
          color: 'var(--cinza-3)',
        }}
      >
        <span>Filtros{ativos ? ` · ${ativos}` : ''}</span>
        <span
          aria-hidden
          style={{
            color: 'var(--cinza-2)',
            display: 'inline-block',
            transform: aberto ? 'rotate(180deg)' : 'none',
            transition: 'transform .15s',
          }}
        >
          ▾
        </span>
      </button>

      {aberto ? (
        <div
          style={{
            padding: '4px 14px 16px',
            borderTop: '1px solid var(--borda)',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {campos.map((campo) => (
            <GrupoDeCampo key={campo.chave} campo={campo} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function GrupoDeCampo({ campo }: { campo: CampoDeFiltro }) {
  const [expandido, definirExpandido] = useState(false);
  const visiveis = expandido ? campo.itens : campo.itens.slice(0, LIMITE_PADRAO);
  const escondidos = campo.itens.length - visiveis.length;

  return (
    <div style={{ paddingTop: 10 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          color: 'var(--cinza-2)',
          marginBottom: 8,
        }}
      >
        {campo.rotulo}
      </div>
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
