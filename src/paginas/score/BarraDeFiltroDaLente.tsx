/** Os filtros da aba Lentes: "Filtro avançado" recolhível em cima, filtros
 *  rápidos na faixa azul embaixo — a mesma ordem e os mesmos componentes do
 *  CRM dos Stakeholders (`PainelDeFiltros` + `FaixaDeFiltros`).
 *
 *  MESMA FAIXA, MESMO GATILHO, MESMA LISTA DE PÍLULAS do Painel: `FaixaDeFiltros`
 *  e `CampoSuspenso` reaproveitados direto, e não reconstruídos — quem já
 *  aprendeu a filtrar numa tela filtra igual na outra.
 *
 *  QUAIS FILTROS, E ONDE, MUDAM POR LENTE (`FILTROS_DAS_LENTES`): Imprensa
 *  filtra por tier e veículo, Sociedade digital por rede e perfil de quem fala,
 *  Clientes por concessionária. A barra só percorre a tabela.
 *
 *  ESCOLHA ÚNICA POR CAMPO, e os campos se somam (E): escolher um veículo não
 *  implica tier nenhum, e clicar numa pílula já escolhida a desmarca — é como o
 *  servidor recebe (`FiltroDaLente`, um valor por campo).
 *
 *  CAMPO SEM OPÇÃO NO MÊS NÃO É DESENHADO: um seletor que abre vazio faz a
 *  pessoa concluir que o dado sumiu, quando a fonte nunca mandou o campo.
 */

import { useState } from 'react';

import type { FiltroDaLente, OpcoesDeFiltroDaLente } from '@/api/cliente';
import { CampoSuspenso } from '@/componentes/CampoSuspenso';
import { GrupoDeCampo, SetaDaAegea } from '@/componentes/PainelDeFiltros';
import type { CampoDeFiltro } from '@/componentes/PainelDeFiltros';
import { FaixaDeFiltros } from '@/componentes/FaixaDeFiltros';
import { FILTROS_DAS_LENTES, rotuloDoValor } from '@/dominio/filtrosDasLentes';
import type { DimensaoDaLente } from '@/dominio/filtrosDasLentes';

/** ATIVO É QUALQUER CAMPO PREENCHIDO, perguntado ao próprio objeto — uma lista
 *  escrita à mão esqueceria o campo acrescentado depois. */
function filtroAtivo(filtro: FiltroDaLente): boolean {
  return Object.values(filtro).some(Boolean);
}

/** Um campo de escolha única: escolher de novo o que já estava ativo DESMARCA. */
function campoDa(
  dimensao: DimensaoDaLente,
  valores: string[],
  filtro: FiltroDaLente,
  definirFiltro: (filtro: FiltroDaLente) => void,
): CampoDeFiltro {
  const valorAtual = filtro[dimensao.chave];
  return {
    chave: dimensao.chave,
    rotulo: dimensao.rotulo,
    itens: valores.map((valor) => ({ valor, rotulo: rotuloDoValor(dimensao, valor) })),
    valorAtual,
    aoEscolher: (valor) =>
      definirFiltro({ ...filtro, [dimensao.chave]: valorAtual === valor ? undefined : valor }),
  };
}

export function BarraDeFiltroDaLente({
  lente,
  filtro,
  definirFiltro,
  opcoes,
}: {
  lente: string;
  filtro: FiltroDaLente;
  definirFiltro: (filtro: FiltroDaLente) => void;
  opcoes: OpcoesDeFiltroDaLente | null;
}) {
  const [abertoAvancado, definirAbertoAvancado] = useState(false);
  const config = FILTROS_DAS_LENTES[lente];
  if (!config) return null;

  const comValores = (lista: DimensaoDaLente[]) =>
    lista
      .map((dimensao) => ({ dimensao, valores: opcoes?.[dimensao.de] ?? [] }))
      .filter(({ valores }) => valores.length > 0);
  const rapidos = comValores(config.rapidos);
  const avancados = comValores(config.avancados);
  const ativosNoAvancado = avancados.filter(({ dimensao }) => filtro[dimensao.chave]).length;

  return (
    <div className="sem-impressao">
      {avancados.length ? (
        <div
          style={{
            border: '1px solid var(--borda)',
            borderRadius: 'var(--r-card-int)',
            background: 'var(--branco)',
            marginBottom: 8,
          }}
        >
          <button
            type="button"
            onClick={() => definirAbertoAvancado((v) => !v)}
            aria-expanded={abertoAvancado}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '3px 12px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--cinza-3)',
            }}
          >
            <span>Filtro avançado{ativosNoAvancado ? ` · ${ativosNoAvancado}` : ''}</span>
            <SetaDaAegea aberto={abertoAvancado} />
          </button>
          {abertoAvancado ? (
            <div
              style={{
                padding: '4px 12px 10px',
                borderTop: '1px solid var(--borda)',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              {avancados.map(({ dimensao, valores }) => (
                <GrupoDeCampo
                  key={dimensao.chave}
                  campo={campoDa(dimensao, valores, filtro, definirFiltro)}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {rapidos.length ? (
        <FaixaDeFiltros>
          {rapidos.map(({ dimensao, valores }) => (
            <CampoSuspenso
              key={dimensao.chave}
              campo={campoDa(dimensao, valores, filtro, definirFiltro)}
              aoLimpar={
                filtro[dimensao.chave]
                  ? () => definirFiltro({ ...filtro, [dimensao.chave]: undefined })
                  : undefined
              }
            />
          ))}
          {filtroAtivo(filtro) ? (
            <button
              type="button"
              onClick={() => definirFiltro({})}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--branco)',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                padding: '0 4px',
                textDecoration: 'underline',
                flexShrink: 0,
              }}
            >
              Limpar recorte
            </button>
          ) : null}
        </FaixaDeFiltros>
      ) : null}
    </div>
  );
}
