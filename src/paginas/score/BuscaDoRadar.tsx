/** A busca inteligente do Radar: o mesmo desenho da "Busca inteligente" do CRM
 *  dos Stakeholders (`BarraDeRecorte`), com sugestões enquanto se digita.
 *
 *  POR QUE COM SUGESTÕES, e não texto livre como no CRM: o índice não aceita
 *  filtro (é a nota da companhia inteira), quem filtra são as LENTES — e cada
 *  uma com o seu vocabulário. Digitar "folha" e escolher "Veículo · Folha de
 *  S.Paulo · Imprensa" leva à lente certa, já recortada; texto livre deixaria a
 *  pessoa adivinhar onde aquele nome existe.
 *
 *  OS FILTROS ATIVOS APARECEM COMO CHIPS com ×, e "Limpar" tira todos — de novo
 *  o desenho do CRM, para quem já aprendeu lá.
 *
 *  AS OPÇÕES SÃO BUSCADAS NA PRIMEIRA VEZ QUE O CAMPO RECEBE FOCO, e não ao
 *  abrir a tela: são três chamadas (uma por lente com filtro), e quem só olha o
 *  radar não precisa delas.
 *
 *  O GRUPO "CONSULTA EM PROFUNDIDADE" VEM DEPOIS DAS SUGESTÕES REAIS (decisões
 *  D3 e A15, spec E.9): pilares, temas, subtemas e matérias do drill
 *  ilustrativo, com o selo "Dados ilustrativos" no cabeçalho do grupo, para
 *  ninguém confundir com o que veio do servidor. Escolher um leva direto ao
 *  nível dele (`aoEscolherNoDrill`). Sem esse callback, o grupo não aparece.
 */

import { Fragment, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { obterOpcoesDeFiltroDaLente } from '@/api/cliente';
import type { FiltroDaLente, OpcoesDeFiltroDaLente } from '@/api/cliente';
import { Botao, Chip } from '@/componentes/basicos';
import { ID_DA_BUSCA_NO_CABECALHO } from '@/componentes/espacoNoCabecalho';
import {
  agruparResultadosDoDrill,
  filtrarSugestoes,
  montarSugestoes,
  opcoesDaBusca,
  realcarTrecho,
} from '@/dominio/buscaDoRadar';
import type { LenteParaBusca, OpcaoDaBusca, SugestaoDoRadar } from '@/dominio/buscaDoRadar';
import { LENTES_COM_FILTRO, dimensoesDaLente, rotuloDoValor } from '@/dominio/filtrosDasLentes';
import { SeloIlustrativo } from '@/paginas/score/consulta/componentes/SeloIlustrativo';
import { DADOS } from '@/paginas/score/consulta/dados/dados';
import { buscarNoDrill, montarIndiceDeBusca } from '@/paginas/score/consulta/dados/seletores';
import type { ResultadoDeBusca } from '@/paginas/score/consulta/dados/seletores';
import type { EnderecoDoDrill } from '@/paginas/score/consulta/endereco';
import { arred, corDoSinal, fmtPt, fmtPtItem } from '@/paginas/score/consulta/formatacao';

export function BuscaDoRadar({
  mes,
  lentes,
  lenteAberta,
  filtro,
  aoEscolher,
  aoMudarFiltro,
  aoEscolherNoDrill,
}: {
  mes: string;
  lentes: LenteParaBusca[];
  /** A lente cujo filtro está ativo — é a ela que os chips se referem. */
  lenteAberta: string;
  filtro: FiltroDaLente;
  aoEscolher: (sugestao: SugestaoDoRadar) => void;
  aoMudarFiltro: (filtro: FiltroDaLente) => void;
  /** Escolha de um resultado do grupo "Consulta em profundidade": o destino
   *  é o endereço do drill (pilar, tema, subtema ou matéria). */
  aoEscolherNoDrill?: (destino: EnderecoDoDrill) => void;
}) {
  const id = useId();
  const [termo, definirTermo] = useState('');
  const [aberto, definirAberto] = useState(false);
  const [emFoco, definirEmFoco] = useState(0);
  const [carregadas, definirCarregadas] = useState<{
    mes: string;
    porLente: Record<string, OpcoesDeFiltroDaLente | undefined>;
  } | null>(null);
  const caixa = useRef<HTMLDivElement>(null);

  //: AS OPÇÕES SÃO DO MÊS: trocar o mês invalida o que foi carregado.
  const porLente = carregadas?.mes === mes ? carregadas.porLente : null;

  const carregar = () => {
    if (porLente) return;
    Promise.all(
      LENTES_COM_FILTRO.map((lente) =>
        obterOpcoesDeFiltroDaLente(lente, mes)
          .then((opcoes) => [lente, opcoes] as const)
          .catch(() => [lente, undefined] as const),
      ),
    ).then((pares) => definirCarregadas({ mes, porLente: Object.fromEntries(pares) }));
  };

  const sugestoes = useMemo(
    () => montarSugestoes(lentes, porLente ?? {}),
    [lentes, porLente],
  );
  const encontradas = filtrarSugestoes(sugestoes, termo);

  //: O ÍNDICE DO DRILL É MONTADO UMA VEZ (E.9): a base é um JSON local e não
  //: muda com o mês nem com a lente. `buscarNoDrill` só responde com 2
  //: caracteres ou mais, depois de normalizar.
  const indiceDoDrill = useMemo(() => montarIndiceDeBusca(DADOS), []);
  const doDrill = aoEscolherNoDrill ? buscarNoDrill(indiceDoDrill, termo) : [];
  const opcoes = opcoesDaBusca(encontradas, doDrill);
  const idDaOpcao = (indice: number) => `${id}-opcao-${indice}`;

  useEffect(() => {
    if (!aberto) return;
    const fora = (evento: MouseEvent) => {
      if (!caixa.current?.contains(evento.target as Node)) definirAberto(false);
    };
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, [aberto]);

  const escolher = (opcao: OpcaoDaBusca) => {
    if (opcao.origem === 'radar') aoEscolher(opcao.sugestao);
    else aoEscolherNoDrill?.(opcao.resultado.destino);
    definirTermo('');
    definirAberto(false);
    definirEmFoco(0);
  };

  const nomeDaLente = lentes.find((lente) => lente.codigo === lenteAberta)?.nome ?? lenteAberta;
  const chips = dimensoesDaLente(lenteAberta)
    .filter((dimensao) => filtro[dimensao.chave])
    .map((dimensao) => ({
      chave: dimensao.chave,
      rotulo: `${nomeDaLente} · ${dimensao.rotulo}: ${rotuloDoValor(dimensao, filtro[dimensao.chave] as string)}`,
    }));

  //: NO CABEÇALHO AZUL, como a busca do CRM, quando o cabeçalho reserva o lugar
  //: (`ID_DA_BUSCA_NO_CABECALHO`); sem ele (num teste, numa tela sem o
  //: cabeçalho), no próprio lugar.
  const alvo =
    typeof document !== 'undefined' ? document.getElementById(ID_DA_BUSCA_NO_CABECALHO) : null;

  const barra = (
    <div
      className="sem-impressao"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap',
        marginBottom: alvo ? 12 : 0,
        padding: '10px 14px',
        background: 'var(--bg-trilho)',
        border: '1px solid var(--borda)',
        borderRadius: 'var(--r-card-int)',
      }}
    >
      <span
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--cinza-2)',
        }}
      >
        Busca inteligente
      </span>

      <div ref={caixa} style={{ position: 'relative', flex: '1 1 300px', minWidth: 220 }}>
        <input
          role="combobox"
          aria-expanded={aberto && termo.trim().length > 0}
          aria-controls={`${id}-lista`}
          aria-activedescendant={
            aberto && termo.trim() && opcoes[emFoco] ? idDaOpcao(emFoco) : undefined
          }
          aria-autocomplete="list"
          aria-label="Buscar uma lente, veículo, rede, tema ou concessionária"
          autoComplete="off"
          value={termo}
          placeholder="Buscar lente, veículo, rede, tema, concessionária…"
          onFocus={() => {
            carregar();
            definirAberto(true);
          }}
          onChange={(evento) => {
            definirTermo(evento.target.value);
            definirAberto(true);
            definirEmFoco(0);
          }}
          onKeyDown={(evento) => {
            //: AS SETAS ATRAVESSAM OS DOIS GRUPOS (sugestões reais e drill),
            //: porque `opcoes` é uma lista só; o `Enter` abre a ativa, ou a
            //: primeira se nenhuma foi escolhida (E.9).
            if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
              evento.preventDefault();
              if (!opcoes.length) return;
              const passo = evento.key === 'ArrowDown' ? 1 : -1;
              const proxima = (emFoco + passo + opcoes.length) % opcoes.length;
              definirEmFoco(proxima);
              definirAberto(true);
              document.getElementById(idDaOpcao(proxima))?.scrollIntoView?.({ block: 'nearest' });
            } else if (evento.key === 'Enter') {
              evento.preventDefault();
              const alvo = opcoes[emFoco] ?? opcoes[0];
              if (alvo) escolher(alvo);
            } else if (evento.key === 'Escape') {
              definirAberto(false);
              definirEmFoco(0);
            }
          }}
          style={{
            width: '100%',
            height: 30,
            padding: '0 10px',
            border: '1px solid var(--borda-input)',
            borderRadius: 'var(--r-btn)',
            background: 'var(--branco)',
            color: 'var(--cinza-4)',
            fontSize: 12.5,
            boxSizing: 'border-box',
          }}
        />

        {aberto && termo.trim() ? (
          <ul
            id={`${id}-lista`}
            role="listbox"
            style={{
              position: 'absolute',
              zIndex: 40,
              top: 'calc(100% + 4px)',
              left: 0,
              right: 0,
              margin: 0,
              padding: 4,
              listStyle: 'none',
              maxHeight: 420,
              overflowY: 'auto',
              background: 'var(--branco)',
              border: '1px solid var(--borda)',
              borderRadius: 'var(--r-card-int)',
              boxShadow: 'var(--sh-tooltip)',
            }}
          >
            {!opcoes.length ? (
              <li style={{ padding: '9px 10px', fontSize: 13, color: 'var(--cinza-2)' }}>
                {mensagemSemResultado(termo, Boolean(porLente), Boolean(aoEscolherNoDrill))}
              </li>
            ) : null}

            {encontradas.map((sugestao, indice) => (
              <li
                key={sugestao.id}
                id={idDaOpcao(indice)}
                role="option"
                aria-selected={indice === emFoco}
                onMouseDown={(evento) => {
                  evento.preventDefault();
                  escolher({ origem: 'radar', sugestao });
                }}
                onMouseEnter={() => definirEmFoco(indice)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '110px minmax(0, 1fr) auto',
                  alignItems: 'baseline',
                  gap: 10,
                  padding: '8px 10px',
                  borderRadius: 'var(--r-btn)',
                  cursor: 'pointer',
                  background: indice === emFoco ? 'var(--bg-hover)' : 'transparent',
                }}
              >
                <span className="kicker" style={{ fontSize: 10.5, color: 'var(--cinza-2)' }}>
                  {sugestao.grupo}
                </span>
                <span style={{ fontSize: 13, color: 'var(--cinza-4)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {sugestao.rotulo}
                </span>
                <span style={{ fontSize: 11.5, color: 'var(--cinza-2)', whiteSpace: 'nowrap' }}>
                  {sugestao.filtro ? sugestao.nomeDaLente : sugestao.tambem}
                </span>
              </li>
            ))}

            {doDrill.length ? (
              <GrupoDaConsulta
                idBase={id}
                doDrill={doDrill}
                deslocamento={encontradas.length}
                emFoco={emFoco}
                termo={termo}
                comSeparador={encontradas.length > 0}
                idDaOpcao={idDaOpcao}
                aoEscolher={(resultado) => escolher({ origem: 'drill', resultado })}
                aoApontar={definirEmFoco}
              />
            ) : null}
          </ul>
        ) : null}
      </div>

      {chips.map((chip) => (
        <Chip
          key={chip.chave}
          rotulo={chip.rotulo}
          ativo
          fundo="var(--branco)"
          texto="var(--cinza-3)"
          titulo={`Remover o filtro ${chip.rotulo}`}
          aoClicar={() => aoMudarFiltro({ ...filtro, [chip.chave]: undefined })}
        />
      ))}

      {chips.length ? (
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <Botao variante="fantasma" aoClicar={() => aoMudarFiltro({})}>
            Limpar
          </Botao>
        </span>
      ) : null}
    </div>
  );

  return alvo ? createPortal(barra, alvo) : barra;
}

/** "Nenhum resultado…" (E.9) quando nem as sugestões reais nem o drill acham
 *  nada; sem o drill ligado, o recado de sempre das sugestões reais. */
function mensagemSemResultado(termo: string, carregou: boolean, comDrill: boolean): string {
  if (!carregou) return 'Carregando as opções do mês…';
  if (!comDrill) return 'Nada com esse termo neste mês.';
  return `Nenhum resultado para "${termo.trim()}". Tente um tema, um subtema ou um veículo.`;
}

/** O grupo "Consulta em profundidade" da lista (E.9, decisões D3 e A15).
 *
 *  SUBGRUPOS POR TIPO, cada um com o kicker do tipo (Subtema, Tema, Pilar,
 *  Matéria), na ordem que `buscarNoDrill` já devolve. As opções continuam na
 *  MESMA LISTA (`role="listbox"`) das sugestões reais: o índice de cada uma é
 *  `deslocamento + posição`, e é ele que as setas e o `Enter` usam. */
//: O IMPACTO DE UMA MATÉRIA COM 2 CASAS, como na lista do Nível 4 e na
//: prévia (E.2, F.8, F.9): com 1 casa, −0,06 e −0,12 sairiam os dois "−0,1
//: pt", e a mesma matéria teria três números na tela. Pilar, tema e subtema
//: seguem com 1 casa. A cor é a do número ESCRITO, como no resto do drill.
function casasDoImpacto(resultado: ResultadoDeBusca): number {
  return resultado.tipo === 'Matéria' ? 2 : 1;
}

function textoDoImpacto(resultado: ResultadoDeBusca, impacto: number): string {
  return resultado.tipo === 'Matéria' ? `${fmtPtItem(impacto)} pt` : fmtPt(impacto);
}

function GrupoDaConsulta({
  idBase,
  doDrill,
  deslocamento,
  emFoco,
  termo,
  comSeparador,
  idDaOpcao,
  aoEscolher,
  aoApontar,
}: {
  idBase: string;
  doDrill: ResultadoDeBusca[];
  deslocamento: number;
  emFoco: number;
  termo: string;
  comSeparador: boolean;
  idDaOpcao: (indice: number) => string;
  aoEscolher: (resultado: ResultadoDeBusca) => void;
  aoApontar: (indice: number) => void;
}) {
  const idDoCabecalho = `${idBase}-consulta`;
  return (
    <li
      role="presentation"
      style={{
        marginTop: comSeparador ? 4 : 0,
        paddingTop: comSeparador ? 4 : 0,
        borderTop: comSeparador ? '1px solid var(--borda)' : 'none',
      }}
    >
      <div
        id={idDoCabecalho}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          padding: '8px 10px 4px',
        }}
      >
        <span className="kicker" style={{ fontSize: 10.5, color: 'var(--cinza-3)' }}>
          Consulta em profundidade
        </span>
        <SeloIlustrativo />
      </div>

      {agruparResultadosDoDrill(doDrill).map((grupo) => (
        <ul
          key={grupo.tipo}
          role="group"
          aria-label={`Consulta em profundidade · ${grupo.tipo}`}
          style={{ listStyle: 'none', margin: 0, padding: 0 }}
        >
          <li
            role="presentation"
            aria-hidden
            className="kicker"
            style={{ fontSize: 10.5, color: 'var(--cinza-2)', padding: '6px 10px 2px' }}
          >
            {grupo.tipo}
          </li>
          {grupo.resultados.map((resultado, i) => {
            const indice = deslocamento + grupo.inicio + i;
            const ativa = indice === emFoco;
            return (
              <li
                key={resultado.id}
                id={idDaOpcao(indice)}
                role="option"
                aria-selected={ativa}
                onMouseDown={(evento) => {
                  evento.preventDefault();
                  aoEscolher(resultado);
                }}
                onMouseEnter={() => aoApontar(indice)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) auto',
                  alignItems: 'baseline',
                  columnGap: 12,
                  rowGap: 2,
                  padding: '7px 10px',
                  borderRadius: 'var(--r-btn)',
                  cursor: 'pointer',
                  background: ativa ? 'var(--bg-hover)' : 'transparent',
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--cinza-4)' }}>
                  {realcarTrecho(resultado.nome, termo).map((trecho, k) =>
                    trecho.realce ? (
                      <strong key={k} style={{ fontWeight: 700, color: 'var(--azul-mar)' }}>
                        {trecho.texto}
                      </strong>
                    ) : (
                      // TEXTO SOLTO, sem `<span>`: o nome acessível da opção
                      // junta os pedaços, e um elemento em volta perderia o
                      // espaço da borda ("Rompimento deadutora").
                      <Fragment key={k}>{trecho.texto}</Fragment>
                    ),
                  )}
                </span>
                {resultado.impacto !== undefined ? (
                  <span
                    className="tabular"
                    style={{
                      fontSize: 12.5,
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                      color: corDoSinal(arred(resultado.impacto, casasDoImpacto(resultado))),
                    }}
                  >
                    {textoDoImpacto(resultado, resultado.impacto)}
                  </span>
                ) : (
                  <span />
                )}
                <span style={{ gridColumn: '1 / -1', fontSize: 12, color: 'var(--cinza-2)' }}>
                  {resultado.caminho}
                </span>
              </li>
            );
          })}
        </ul>
      ))}
    </li>
  );
}
