/** Lista de matérias do Nível 4 (F.9, decisão D3).
 *
 *  SEM ESTADO PRÓPRIO DE FILTRO: aba de sentimento, ordenação, Tier,
 *  Concessionária e UF são lidos do endereço e escritos por `aoMudar`, que o
 *  nível traduz em `navegarNoDrill(…, 'replace')`. Assim recarregar e voltar
 *  do navegador reabrem a lista exatamente como estava (D.3), e não há dois
 *  lugares dizendo qual filtro está ligado.
 *
 *  OS CONTROLES MORAM NO CARTÃO (D3): não há faixa superior de filtros no
 *  drill. As opções de Tier, Concessionária e UF são só as que existem na
 *  amostra (`opcoesDaAmostra`): oferecer "SP" e devolver lista vazia seria
 *  prometer um dado que a demonstração não tem.
 *
 *  OS NÚMEROS DAS ABAS SÃO DO SUBTEMA INTEIRO (`contagens`, A17), e a lista é
 *  só a amostra: por isso o rodapé que diz "Amostra de 11 … de um total de
 *  96" fica sempre visível.
 *
 *  A FONTE E A DATA DE CORTE DO RODAPÉ VÊM DA CONSULTA DO MÊS (D5), por prop:
 *  `fonte` é o nome da fonte da lente e `dataCorte`, o `meta.dataCorte`.
 *
 *  JORNALISTA VAZIO (o caso da Clipei, que não informa autor) não deixa uma
 *  segunda linha em branco sob o veículo: a célula mostra só o veículo.
 */

import { useEffect, useId, useRef } from 'react';
import type { CSSProperties } from 'react';

import '../consulta.css';
import { COR_LINHA_DESTACADA } from '../cores';
import { filtrarItens, opcoesDaAmostra, ordenarItens } from '../dados/seletores';
import type { Item, Subtema } from '../dados/tipos';
import type { EnderecoDoDrill, OrdemDaLista, SentimentoDaLista } from '../endereco';
import { corDoSinal, fmtDataCurta, fmtDataLonga, fmtInt, fmtPtItem } from '../formatacao';
import { CartaoDoDrill } from './CartaoDoDrill';
import { SeloDeSentimento } from './SeloDeSentimento';
import { SeloDeTier } from './SeloDeTier';

/** Grade da F.9, literal. */
const GRADE: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '62px minmax(0,1.25fr) minmax(0,3.2fr) minmax(0,1fr) 76px 156px',
  gap: 16,
  alignItems: 'center',
};

const ALTURA_DO_CONTROLE = 40;

/** " · fonte Clipei, corte em 31/08/2026" do rodapé (F.9); o que faltar sai. */
function procedencia(fonte: string, dataCorte: string): string {
  const partes = [fonte ? `fonte ${fonte}` : '', dataCorte ? `corte em ${fmtDataLonga(dataCorte)}` : ''].filter(Boolean);
  return partes.length ? ` · ${partes.join(', ')}` : '';
}

const estiloDoSegmento = (ativo: boolean, primeiro: boolean, ultimo: boolean): CSSProperties => ({
  height: ALTURA_DO_CONTROLE,
  padding: '0 14px',
  marginLeft: primeiro ? 0 : -1,
  border: `1px solid ${ativo ? 'var(--azul-mar)' : 'var(--borda-input)'}`,
  background: ativo ? 'var(--azul-mar)' : 'var(--branco)',
  color: ativo ? 'var(--branco)' : 'var(--cinza-4)',
  fontSize: 13,
  fontWeight: ativo ? 700 : 500,
  borderTopLeftRadius: primeiro ? 'var(--r-btn)' : 0,
  borderBottomLeftRadius: primeiro ? 'var(--r-btn)' : 0,
  borderTopRightRadius: ultimo ? 'var(--r-btn)' : 0,
  borderBottomRightRadius: ultimo ? 'var(--r-btn)' : 0,
  // A ORDEM DE EMPILHAMENTO (ativo por cima, foco acima de todos) está em
  // `.consulta-segmento`: o `:focus-visible` não se escreve inline.
  cursor: 'pointer',
  whiteSpace: 'nowrap',
});

/** Cores e borda vêm de `.consulta-botao-contornado` (hover #111799, E.1). */
const estiloDoBotaoContornado: CSSProperties = {
  height: ALTURA_DO_CONTROLE,
  padding: '0 14px',
  borderRadius: 'var(--r-btn)',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const estiloDoCabecalhoDaColuna: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--cinza-2)',
};

/** Segmentado de botões com `aria-pressed` (F.9: 40px, borda `#D5DAEA`,
 *  ativo azul com texto branco). */
function Segmentado<T extends string>({
  opcoes,
  ativo,
  aoEscolher,
}: {
  opcoes: readonly { valor: T; rotulo: string; numero?: string }[];
  ativo: T;
  aoEscolher: (valor: T) => void;
}) {
  return (
    <>
      {opcoes.map((o, i) => (
        <button
          key={o.valor}
          type="button"
          aria-pressed={o.valor === ativo}
          onClick={() => aoEscolher(o.valor)}
          className="tabular consulta-segmento"
          style={estiloDoSegmento(o.valor === ativo, i === 0, i === opcoes.length - 1)}
        >
          {/* UM SÓ TEXTO: com o número num `span` à parte, o nome acessível
              sai colado ("Negativas71"). */}
          {o.numero !== undefined ? `${o.rotulo} ${o.numero}` : o.rotulo}
        </button>
      ))}
    </>
  );
}

/** Seletor compacto com rótulo visível no formato da E.3, "rótulo: valor"
 *  ("Tier: Todos", "UF: Todas"). É um `<select>` nativo: teclado, leitor de
 *  tela e celular já sabem usá-lo. Os dois-pontos ficam fora do nome
 *  acessível (o combobox se chama "Tier", não "Tier:"). */
function Seletor({
  rotulo,
  todos,
  opcoes,
  valor,
  aoMudar,
}: {
  rotulo: string;
  todos: string;
  opcoes: string[];
  valor: string | undefined;
  aoMudar: (valor: string | undefined) => void;
}) {
  return (
    <label
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: ALTURA_DO_CONTROLE,
        padding: '0 0 0 12px',
        border: '1px solid var(--borda-input)',
        borderRadius: 'var(--r-btn)',
        background: 'var(--branco)',
        fontSize: 13,
        color: 'var(--cinza-3)',
      }}
    >
      <span>
        {rotulo}
        <span aria-hidden="true">:</span>
      </span>
      <select
        value={valor ?? ''}
        onChange={(e) => aoMudar(e.target.value || undefined)}
        style={{
          height: ALTURA_DO_CONTROLE - 2,
          border: 'none',
          background: 'transparent',
          paddingRight: 8,
          fontSize: 13,
          fontWeight: 700,
          color: 'var(--cinza-4)',
          fontFamily: 'inherit',
          cursor: 'pointer',
        }}
      >
        <option value="">{todos}</option>
        {opcoes.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ListaDeMaterias({
  subtema,
  unidade,
  endereco,
  aoMudar,
  aoAbrirItem,
  fonte,
  dataCorte,
}: {
  subtema: Subtema;
  /** "matérias", da lente. */
  unidade: string;
  /** "Clipei": o nome da fonte da lente, sem o complemento (`nomeDaFonte`). */
  fonte: string;
  /** `meta.dataCorte` ('2026-08-31'); vazio tira o "corte em" do rodapé. */
  dataCorte: string;
  endereco: EnderecoDoDrill;
  /** Escreve no endereço (o nível usa `replace`). `undefined` remove a chave. */
  aoMudar: (parcial: Partial<EnderecoDoDrill>) => void;
  aoAbrirItem: (item: Item, botao: HTMLElement) => void;
}) {
  const prefixo = useId();
  const idDoOrdenar = `${prefixo}-ordenar`;
  const refDaLinhaDestacada = useRef<HTMLDivElement>(null);

  const itens = subtema.nivel4?.itens ?? [];
  const sent: SentimentoDaLista = endereco.sent ?? 'todas';
  const ordem: OrdemDaLista = endereco.ordem ?? 'impacto';
  const opcoes = opcoesDaAmostra(itens);
  const visiveis = ordenarItens(
    filtrarItens(itens, { sent, tier: endereco.tier, conc: endereco.conc, uf: endereco.uf }),
    ordem,
  );
  const filtroAtivo = sent !== 'todas' || Boolean(endereco.tier || endereco.conc || endereco.uf);

  /** ROLAR DEPOIS DE PINTAR (F.9): a linha só existe no DOM depois do
   *  render. Não é `setState`, só um efeito sobre o DOM. O `?.` cobre
   *  ambientes sem `scrollIntoView` (jsdom). */
  useEffect(() => {
    if (!endereco.item) return;
    refDaLinhaDestacada.current?.scrollIntoView?.({ block: 'center' });
  }, [endereco.item]);

  if (!subtema.nivel4) return null;
  const { tituloLista, subtituloLista } = subtema.nivel4;

  const abas: { valor: SentimentoDaLista; rotulo: string; numero?: string }[] = [
    { valor: 'todas', rotulo: 'Todas', numero: fmtInt(subtema.volume) },
    { valor: 'negativas', rotulo: 'Negativas', numero: subtema.contagens && fmtInt(subtema.contagens.neg) },
    { valor: 'neutras', rotulo: 'Neutras', numero: subtema.contagens && fmtInt(subtema.contagens.neu) },
    { valor: 'positivas', rotulo: 'Positivas', numero: subtema.contagens && fmtInt(subtema.contagens.pos) },
  ];

  const rodape = filtroAtivo
    ? `Mostrando ${fmtInt(visiveis.length)} de ${fmtInt(itens.length)} ${unidade} da amostra · ${fmtInt(subtema.volume)} no subtema`
    : `Amostra de ${fmtInt(itens.length)} ${unidade} de um total de ${fmtInt(subtema.volume)} no subtema${procedencia(fonte, dataCorte)}`;

  return (
    <CartaoDoDrill titulo={tituloLista} subtitulo={subtituloLista}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div role="group" aria-label="Sentimento" style={{ display: 'inline-flex' }}>
          <Segmentado
            opcoes={abas}
            ativo={sent}
            aoEscolher={(v) => aoMudar({ sent: v === 'todas' ? undefined : v })}
          />
        </div>
        <div role="group" aria-labelledby={idDoOrdenar} style={{ display: 'inline-flex', alignItems: 'center' }}>
          <span id={idDoOrdenar} style={{ fontSize: 13, color: 'var(--cinza-3)', marginRight: 8 }}>
            Ordenar por
          </span>
          <Segmentado
            opcoes={[
              { valor: 'impacto', rotulo: 'Maior impacto' },
              { valor: 'data', rotulo: 'Data' },
            ]}
            ativo={ordem}
            aoEscolher={(v) => aoMudar({ ordem: v === 'impacto' ? undefined : v })}
          />
        </div>
        <Seletor
          rotulo="Tier"
          todos="Todos"
          opcoes={opcoes.tiers}
          valor={endereco.tier}
          aoMudar={(v) => aoMudar({ tier: v })}
        />
        <Seletor
          rotulo="Concessionária"
          todos="Todas"
          opcoes={opcoes.concessionarias}
          valor={endereco.conc}
          aoMudar={(v) => aoMudar({ conc: v })}
        />
        <Seletor
          rotulo="UF"
          todos="Todas"
          opcoes={opcoes.ufs}
          valor={endereco.uf}
          aoMudar={(v) => aoMudar({ uf: v })}
        />
      </div>

      {/* A TABELA VAI DE BORDA A BORDA DO CARTÃO, como no mockup: a margem
          negativa desfaz o padding de 20px do `Cartao`. */}
      <div style={{ overflowX: 'auto', margin: '0 -20px' }}>
        <div role="table" aria-label={tituloLista} style={{ minWidth: 1000 }}>
          <div role="rowgroup">
            <div
              role="row"
              style={{
                ...GRADE,
                padding: '12px 20px',
                borderTop: '1px solid var(--borda)',
                borderBottom: '1px solid var(--borda)',
              }}
            >
              <span role="columnheader" style={estiloDoCabecalhoDaColuna}>
                Data
              </span>
              <span role="columnheader" style={estiloDoCabecalhoDaColuna}>
                Veículo
              </span>
              <span role="columnheader" style={estiloDoCabecalhoDaColuna}>
                Matéria
              </span>
              <span role="columnheader" style={estiloDoCabecalhoDaColuna}>
                Concessionária
              </span>
              <span role="columnheader" style={{ ...estiloDoCabecalhoDaColuna, textAlign: 'right' }}>
                Impacto
              </span>
              <span role="columnheader" aria-label="Ação" />
            </div>
          </div>
          <div role="rowgroup">
            {visiveis.map((item) => {
              const destacado = item.id === endereco.item;
              const idDoTitulo = `${prefixo}-${item.id}`;
              return (
                <div
                  key={item.id}
                  role="row"
                  ref={destacado ? refDaLinhaDestacada : undefined}
                  aria-current={destacado ? 'true' : undefined}
                  data-item={item.id}
                  style={{
                    ...GRADE,
                    padding: '14px 20px',
                    borderBottom: '1px solid var(--borda)',
                    background: destacado ? COR_LINHA_DESTACADA : undefined,
                  }}
                >
                  <span role="cell" className="tabular" style={{ fontSize: 13, fontWeight: 700, color: 'var(--cinza-4)' }}>
                    {fmtDataCurta(item.data)}
                  </span>
                  <div role="cell" style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--cinza-4)' }}>{item.veiculo}</div>
                    {item.jornalista.trim() ? (
                      <div style={{ fontSize: 12, color: 'var(--cinza-2)', marginTop: 2 }}>{item.jornalista}</div>
                    ) : null}
                  </div>
                  <div role="cell" style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                      <SeloDeSentimento sentimento={item.sentimento} />
                      <SeloDeTier tier={item.tier} sobreDestaque={destacado} />
                    </div>
                    <div id={idDoTitulo} style={{ fontSize: 15, lineHeight: 1.4, color: 'var(--cinza-4)' }}>
                      {item.titulo}
                    </div>
                  </div>
                  <div role="cell" style={{ minWidth: 0, fontSize: 13 }}>
                    <div style={{ fontWeight: 700, color: 'var(--cinza-4)' }}>{item.concessionaria}</div>
                    <div style={{ color: 'var(--cinza-2)', marginTop: 2 }}>{item.uf}</div>
                  </div>
                  <span
                    role="cell"
                    className="tabular"
                    style={{ fontSize: 15, fontWeight: 800, color: corDoSinal(item.impacto), textAlign: 'right' }}
                  >
                    {fmtPtItem(item.impacto)}
                  </span>
                  <div role="cell" style={{ textAlign: 'right' }}>
                    <button
                      type="button"
                      className="sem-png sem-impressao consulta-botao-contornado"
                      aria-describedby={idDoTitulo}
                      onClick={(e) => aoAbrirItem(item, e.currentTarget)}
                      style={estiloDoBotaoContornado}
                    >
                      {/* A SETA FICA FORA DO NOME ACESSÍVEL, como nos cartões
                          laterais: o botão se chama "Abrir matéria". */}
                      Abrir matéria <span aria-hidden="true">↗</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {visiveis.length === 0 ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
            padding: '28px 0 8px',
            textAlign: 'center',
          }}
        >
          <p style={{ margin: 0, fontSize: 14, color: 'var(--cinza-3)' }}>
            Nenhuma matéria da amostra com esses filtros.
          </p>
          <button
            type="button"
            className="sem-png sem-impressao consulta-botao-contornado"
            onClick={() => aoMudar({ sent: undefined, tier: undefined, conc: undefined, uf: undefined })}
            style={estiloDoBotaoContornado}
          >
            Limpar filtros
          </button>
        </div>
      ) : null}

      {/* O RODAPÉ É O ANÚNCIO DO FILTRO (WCAG 4.1.3): trocar sentimento, ordem,
          Tier, Concessionária ou UF muda a frase ("Mostrando 0 de 11…"), e
          `role="status"` faz o leitor de tela lê-la sem tirar o foco do
          controle. */}
      <p role="status" style={{ margin: '16px 0 0', fontSize: 13, color: 'var(--cinza-2)' }}>
        {rodape}
      </p>
    </CartaoDoDrill>
  );
}
