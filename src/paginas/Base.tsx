/** Base — a tabela completa do recorte, com cabeçalho fixo e exportação. */

import { useMemo } from 'react';
import { usePainel } from '@/estado/painel';
import { registrarExportacao } from '@/api/cliente';
import { resumirRecorte } from '@/dominio/resumo-do-recorte';
import { Botao, Carregando, ChipDeFrente, FaixaDeErro, Secao, Vazio } from '@/componentes/basicos';
import { dataCompleta, numero, truncar } from '@/dominio/formato';
import { rotuloDeAbrangencia } from '@/dominio/frentes';
import type { Interacao } from '@/dominio/tipos';
import {
  nomeDaInstituicao,
  nomeDaUnidade,
  nomeDoInterlocutor,
  nomesDosTemas,
  rotuloDeCodigo,
  rotuloDeRelevancia,
} from '@/dominio/derivacoes';
import type { Catalogo } from '@/dominio/derivacoes';

const COLUNAS = [
  'Data', 'Frente', 'Veículo/órgão', 'Unidade', 'Interlocutor',
  'Pauta', 'UF', 'Relevância', 'Status', 'Tags',
];

export function Base({ aoAbrirFicha }: { aoAbrirFicha: (id: string) => void }) {
  const { interacoes, catalogo, carregando, erro, recorte, total } = usePainel();

  const linhas = useMemo(() => {
    if (!catalogo) return [];
    return interacoes.map((interacao) => montarLinha(interacao, catalogo));
  }, [interacoes, catalogo]);

  if (erro) return <FaixaDeErro mensagem={erro} />;
  if (carregando || !catalogo) return <Carregando />;

  return (
    <Secao
      titulo={`Base de registros — ${numero(total)} ${total === 1 ? 'registro' : 'registros'}`}
      acao={
        <Botao
          aoClicar={async () => {
            // Registra ANTES de montar o arquivo. Falhar aqui não impede a
            // exportação — o CSV é trabalho legítimo, e bloqueá-lo por causa da
            // trilha inverteria a prioridade. A falha vai para a telemetria
            // pelo caminho normal de erro do cliente HTTP.
            try {
              await registrarExportacao(recorte);
            } catch {
              /* registrado em `cliente.ts` */
            }
            exportarCsv(linhas, resumirRecorte(recorte, catalogo));
          }}
          desabilitado={!linhas.length}
        >
          Exportar CSV
        </Botao>
      }
      estilo={{ padding: 0 }}
    >
      {!linhas.length ? (
        <Vazio mensagem="Nenhum registro no recorte" dica="Ajuste os filtros para ver resultados." />
      ) : (
        <div className="rolagem-interna" style={{ maxHeight: 'calc(100vh - 340px)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {COLUNAS.map((coluna) => (
                  <th
                    key={coluna}
                    style={{
                      position: 'sticky',
                      top: 0,
                      zIndex: 1,
                      background: 'var(--bg-trilho)',
                      textAlign: 'left',
                      padding: '10px 14px',
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                      color: 'var(--cinza-2)',
                      whiteSpace: 'nowrap',
                      borderBottom: '1px solid var(--borda)',
                    }}
                  >
                    {coluna}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map((linha) => (
                <tr
                  key={linha.id}
                  onClick={() => aoAbrirFicha(linha.id)}
                  title="Abrir a ficha do registro"
                  style={{ cursor: 'pointer', borderBottom: '1px solid var(--borda)' }}
                  onMouseEnter={(evento) => {
                    evento.currentTarget.style.background = 'var(--bg-hover)';
                  }}
                  onMouseLeave={(evento) => {
                    evento.currentTarget.style.background = '';
                  }}
                >
                  <td style={{ ...celula, whiteSpace: 'nowrap' }} className="tabular">
                    {dataCompleta(linha.data)}
                  </td>
                  <td style={celula}>
                    <ChipDeFrente frente={linha.frente} />
                  </td>
                  <td style={{ ...celula, fontWeight: 500 }}>{linha.entidade}</td>
                  <td style={{ ...celula, color: 'var(--cinza-2)' }}>{linha.unidade}</td>
                  <td style={celula}>{linha.interlocutor}</td>
                  <td style={{ ...celula, minWidth: 260 }}>{truncar(linha.pauta, 90)}</td>
                  <td style={celula}>{linha.uf}</td>
                  <td style={celula}>{linha.tier}</td>
                  <td style={celula}>{linha.status}</td>
                  <td style={{ ...celula, color: 'var(--cinza-2)' }}>{linha.tags}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Secao>
  );
}

const celula: React.CSSProperties = {
  padding: '10px 14px',
  verticalAlign: 'top',
  color: 'var(--cinza-3)',
};

interface Linha {
  id: string;
  data: string;
  frente: Interacao['frente'];
  entidade: string;
  unidade: string;
  interlocutor: string;
  pauta: string;
  uf: string;
  tier: string;
  status: string;
  tags: string;
}

function montarLinha(interacao: Interacao, catalogo: Catalogo): Linha {
  return {
    id: interacao.id,
    data: interacao.data_interacao,
    frente: interacao.frente,
    entidade: nomeDaInstituicao(catalogo, interacao.instituicao_id),
    unidade: nomeDaUnidade(catalogo, interacao.unidade_negocio_id),
    interlocutor: nomeDoInterlocutor(catalogo, interacao.interlocutor_id),
    pauta: interacao.pauta,
    uf: rotuloDeAbrangencia(interacao.uf),
    tier: rotuloDeRelevancia(catalogo, interacao.tier),
    status: rotuloDeCodigo(catalogo, 'status', interacao.status),
    tags: nomesDosTemas(catalogo, interacao.temas).join(', '),
  };
}

/** CSV com BOM e separador ";" — é o que o Excel em pt-BR abre sem assistente
 *  de importação e sem quebrar acento. */
function exportarCsv(linhas: Linha[], resumoDoRecorte: string) {
  const escapar = (valor: string) => `"${String(valor).replace(/"/g, '""')}"`;

  const conteudo = [
    COLUNAS.map(escapar).join(';'),
    ...linhas.map((linha) =>
      [
        dataCompleta(linha.data),
        linha.frente,
        linha.entidade,
        linha.unidade,
        linha.interlocutor,
        linha.pauta,
        linha.uf,
        linha.tier,
        linha.status,
        linha.tags,
      ]
        .map(escapar)
        .join(';'),
    ),
  ].join('\r\n');

  const blob = new Blob([`﻿${conteudo}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const carimbo = new Date().toISOString().slice(0, 10);

  link.href = url;
  link.download = `painel-reputacional-${carimbo}.csv`;
  link.click();
  URL.revokeObjectURL(url);

  // O recorte exportado fica registrado no console para quem precisar
  // reconstituir de onde veio o arquivo.
  console.info('[Painel Reputacional] CSV exportado do recorte:', resumoDoRecorte);
}
