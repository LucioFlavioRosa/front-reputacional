/** Quando cada base foi carregada, e por quem.
 *
 *  A PERGUNTA QUE ESTA TELA RESPONDE é "esta base está velha?", e é por isso que
 *  o tempo vem relativo ("há 3 dias") com a data exata no `title`: ninguém abre
 *  esta aba para saber a data.
 *
 *  DIZ "CARGA" E NÃO "ATUALIZAÇÃO". A trilha do back registra carga de arquivo;
 *  reconciliação da lista de veículos, edição de jornalista e fusão de atores
 *  alteram menção por fora da ingestão e não passam por lá. O rótulo honesto é
 *  o que impede alguém concluir, desta tela, que ninguém tocou na base.
 *
 *  AS CARGAS VÊM AGRUPADAS POR LOTE: uma subida da Clipei alimenta Imprensa e
 *  Mercado e rende duas linhas na trilha — está certo, cada fonte foi
 *  atualizada —, mas foi UMA carga. Ver `agruparPorLote`.
 */

import { useEffect, useMemo, useState } from 'react';
import { obterCargasDasBases } from '@/api/cliente';
import type { Base, CargaDaBase } from '@/dominio/cargasDasBases';
import {
  BASES,
  NOME_DA_BASE,
  agruparPorLote,
  basesSemRegistro,
  quantoTempo,
  rotuloDeQuem,
} from '@/dominio/cargasDasBases';

type Filtro = Base | 'todas';

export function AtualizacaoDasBases() {
  const [cargas, definirCargas] = useState<CargaDaBase[] | null>(null);
  const [erro, definirErro] = useState<string | null>(null);
  const [filtro, definirFiltro] = useState<Filtro>('todas');

  useEffect(() => {
    let vivo = true;
    obterCargasDasBases()
      .then((lista) => {
        if (vivo) definirCargas(lista);
      })
      .catch((falha: unknown) => {
        if (vivo) definirErro(falha instanceof Error ? falha.message : String(falha));
      });
    return () => {
      vivo = false;
    };
  }, []);

  const grupos = useMemo(() => {
    if (!cargas) return [];
    const recorte = filtro === 'todas' ? cargas : cargas.filter((c) => c.base === filtro);
    return agruparPorLote(recorte);
  }, [cargas, filtro]);

  const semRegistro = useMemo(() => (cargas ? basesSemRegistro(cargas) : []), [cargas]);

  if (erro) {
    return (
      <p role="alert" style={{ color: 'var(--vermelho)', fontSize: 14 }}>
        Não foi possível ler a trilha das cargas: {erro}
      </p>
    );
  }

  if (!cargas) {
    return <p style={{ fontSize: 14, color: 'var(--cinza-2)' }}>Carregando…</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p style={{ fontSize: 13, color: 'var(--cinza-2)', margin: 0, maxWidth: 760 }}>
        A última vez que cada base recebeu carga de arquivo, e quem a fez.{' '}
        <strong>Carga não é toda alteração</strong>: reconciliar a lista de
        veículos, editar o jornalista de uma menção ou fundir dois cadastros muda
        a base sem passar por aqui.
      </p>

      {/* SEM REGISTRO VEM ANTES DA LISTA, e não depois: é a informação que faz
          alguém agir. Uma base que nunca foi carregada não aparece na trilha, e
          ficar calada sobre ela esconderia o caso mais importante. */}
      {semRegistro.length > 0 ? (
        <p
          style={{
            fontSize: 13,
            background: 'var(--amarelo-fraco, #fff8e1)',
            border: '1px solid var(--borda)',
            borderRadius: 6,
            padding: '10px 12px',
            margin: 0,
          }}
        >
          Sem registro de carga:{' '}
          <strong>{semRegistro.map((base) => NOME_DA_BASE[base]).join(', ')}</strong>. A
          trilha começa na implantação desta funcionalidade — carga anterior a ela
          não foi registrada, e isso não significa que a base esteja vazia.
        </p>
      ) : null}

      <div role="group" aria-label="Filtrar por base" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {(['todas', ...BASES] as Filtro[]).map((opcao) => {
          const ativo = opcao === filtro;
          return (
            <button
              key={opcao}
              type="button"
              aria-pressed={ativo}
              onClick={() => definirFiltro(opcao)}
              style={{
                border: `1px solid ${ativo ? 'var(--azul-mar)' : 'var(--borda)'}`,
                background: ativo ? 'var(--azul-mar)' : 'transparent',
                color: ativo ? '#fff' : 'var(--cinza-3)',
                borderRadius: 999,
                padding: '6px 14px',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {opcao === 'todas' ? 'Todas' : NOME_DA_BASE[opcao]}
            </button>
          );
        })}
      </div>

      {grupos.length === 0 ? (
        <p style={{ fontSize: 14, color: 'var(--cinza-2)' }}>
          Nenhuma carga registrada {filtro === 'todas' ? 'ainda' : 'nesta base'}.
        </p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--cinza-2)' }}>
              <th style={{ padding: '8px 10px', borderBottom: '1px solid var(--borda)' }}>Base</th>
              <th style={{ padding: '8px 10px', borderBottom: '1px solid var(--borda)' }}>
                Última carga
              </th>
              <th style={{ padding: '8px 10px', borderBottom: '1px solid var(--borda)' }}>Quem</th>
              <th style={{ padding: '8px 10px', borderBottom: '1px solid var(--borda)' }}>
                Arquivo
              </th>
              <th
                style={{
                  padding: '8px 10px',
                  borderBottom: '1px solid var(--borda)',
                  textAlign: 'right',
                }}
              >
                Linhas
              </th>
            </tr>
          </thead>
          <tbody>
            {grupos.map((grupo) => (
              <tr key={grupo.chave}>
                <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--borda-fraca, #eee)' }}>
                  <div style={{ fontWeight: 600 }}>
                    {NOME_DA_BASE[grupo.base as Base] ?? grupo.base}
                  </div>
                  {/* AS FONTES IRMÃS JUNTAS, porque foi uma carga só. */}
                  {grupo.fontes.length > 0 ? (
                    <div style={{ color: 'var(--cinza-2)', fontSize: 12 }}>
                      {grupo.fontes.join(' · ')}
                    </div>
                  ) : null}
                </td>
                <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--borda-fraca, #eee)' }}>
                  <span title={new Date(grupo.quando).toLocaleString('pt-BR')}>
                    {quantoTempo(grupo.quando)}
                  </span>
                  {grupo.meses.length > 0 ? (
                    <div style={{ color: 'var(--cinza-2)', fontSize: 12 }}>
                      {grupo.meses.length === 1
                        ? `mês de ${mesPorExtenso(grupo.meses[0])}`
                        : `${grupo.meses.length} meses`}
                    </div>
                  ) : null}
                </td>
                <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--borda-fraca, #eee)' }}>
                  {rotuloDeQuem(grupo)}
                </td>
                <td
                  style={{
                    padding: '8px 10px',
                    borderBottom: '1px solid var(--borda-fraca, #eee)',
                    color: grupo.arquivo ? undefined : 'var(--cinza-2)',
                  }}
                >
                  {grupo.arquivo ?? '—'}
                </td>
                <td
                  style={{
                    padding: '8px 10px',
                    borderBottom: '1px solid var(--borda-fraca, #eee)',
                    textAlign: 'right',
                    //: ZERO NÃO É ERRO, e a tela não pode fazê-lo parecer: é o
                    //: recorte que não achou veículo, ou a planilha que não
                    //: mudou nada. Esmaecido, não vermelho.
                    color: grupo.linhas === 0 ? 'var(--cinza-2)' : undefined,
                  }}
                  title={grupo.linhas === 0 ? 'A carga aconteceu e não trouxe linha nenhuma' : undefined}
                >
                  {grupo.linhas.toLocaleString('pt-BR')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/** `2026-08-01` → `agosto de 2026`. */
function mesPorExtenso(dia: string): string {
  const data = new Date(`${dia}T00:00:00`);
  if (Number.isNaN(data.getTime())) return dia;
  return data.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}
