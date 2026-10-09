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
 */

import { useEffect, useId, useMemo, useRef, useState } from 'react';

import { obterOpcoesDeFiltroDaLente } from '@/api/cliente';
import type { FiltroDaLente, OpcoesDeFiltroDaLente } from '@/api/cliente';
import { Botao, Chip } from '@/componentes/basicos';
import { filtrarSugestoes, montarSugestoes } from '@/dominio/buscaDoRadar';
import type { LenteParaBusca, SugestaoDoRadar } from '@/dominio/buscaDoRadar';
import { LENTES_COM_FILTRO, dimensoesDaLente, rotuloDoValor } from '@/dominio/filtrosDasLentes';

export function BuscaDoRadar({
  mes,
  lentes,
  lenteAberta,
  filtro,
  aoEscolher,
  aoMudarFiltro,
}: {
  mes: string;
  lentes: LenteParaBusca[];
  /** A lente cujo filtro está ativo — é a ela que os chips se referem. */
  lenteAberta: string;
  filtro: FiltroDaLente;
  aoEscolher: (sugestao: SugestaoDoRadar) => void;
  aoMudarFiltro: (filtro: FiltroDaLente) => void;
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

  useEffect(() => {
    if (!aberto) return;
    const fora = (evento: MouseEvent) => {
      if (!caixa.current?.contains(evento.target as Node)) definirAberto(false);
    };
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, [aberto]);

  const escolher = (sugestao: SugestaoDoRadar) => {
    aoEscolher(sugestao);
    definirTermo('');
    definirAberto(false);
  };

  const nomeDaLente = lentes.find((lente) => lente.codigo === lenteAberta)?.nome ?? lenteAberta;
  const chips = dimensoesDaLente(lenteAberta)
    .filter((dimensao) => filtro[dimensao.chave])
    .map((dimensao) => ({
      chave: dimensao.chave,
      rotulo: `${nomeDaLente} · ${dimensao.rotulo}: ${rotuloDoValor(dimensao, filtro[dimensao.chave] as string)}`,
    }));

  return (
    <div
      className="sem-impressao"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap',
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
            if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
              evento.preventDefault();
              const passo = evento.key === 'ArrowDown' ? 1 : -1;
              definirEmFoco((i) => (i + passo + encontradas.length) % Math.max(1, encontradas.length));
            } else if (evento.key === 'Enter') {
              evento.preventDefault();
              const alvo = encontradas[emFoco];
              if (alvo) escolher(alvo);
            } else if (evento.key === 'Escape') {
              definirAberto(false);
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
              maxHeight: 320,
              overflowY: 'auto',
              background: 'var(--branco)',
              border: '1px solid var(--borda)',
              borderRadius: 'var(--r-card-int)',
              boxShadow: 'var(--sh-tooltip)',
            }}
          >
            {!encontradas.length ? (
              <li style={{ padding: '9px 10px', fontSize: 13, color: 'var(--cinza-2)' }}>
                {porLente ? 'Nada com esse termo neste mês.' : 'Carregando as opções do mês…'}
              </li>
            ) : (
              encontradas.map((sugestao, indice) => (
                <li
                  key={sugestao.id}
                  role="option"
                  aria-selected={indice === emFoco}
                  onMouseDown={(evento) => {
                    evento.preventDefault();
                    escolher(sugestao);
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
              ))
            )}
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
}
