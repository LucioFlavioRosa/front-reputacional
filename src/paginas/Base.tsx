/** Base — a tabela completa do recorte, com cabeçalho fixo e exportação. */

import { useMemo, useState } from 'react';
import { usePainel } from '@/estado/painel';
import { CadeiaDaAgenda } from '@/componentes/CadeiaDaAgenda';
import { temCadeia } from '@/dominio/grafo';
import { registrarExportacao } from '@/api/cliente';
import { resumirRecorte } from '@/dominio/resumo-do-recorte';
import { Botao, Carregando, ChipDeFrente, FaixaDeErro, Secao, Vazio } from '@/componentes/basicos';
import { dataCompleta, numero, tituloDaAgenda, truncar } from '@/dominio/formato';
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
  'Cadeia', 'Data', 'Frente', 'Veículo/órgão', 'Unidade', 'Interlocutor',
  'Pauta', 'UF', 'Relevância', 'Status', 'Tags',
];

/** A CADEIA VEM PRIMEIRO, como marca de calha.
 *
 *  É a única posição que não depende de rolagem horizontal — e uma marca que
 *  só aparece depois de rolar não avisa ninguém de nada. A coluna fica VAZIA
 *  na maioria das linhas, que é o correto: encadeamento é minoria, e uma marca
 *  que aparece em toda linha deixa de ser marca.
 *
 *  Vazia mesmo, sem traço de preenchimento. Um travessão repetido em quatro de
 *  cada cinco linhas pesa mais na leitura do que a célula em branco, e não
 *  informa nada que a ausência do ícone já não diga.
 */

export function Base({ aoAbrirFicha }: { aoAbrirFicha: (id: string) => void }) {
  const { interacoes, catalogo, carregando, erro, recorte, total } = usePainel();
  const [cadeiaAberta, definirCadeiaAberta] = useState<string | null>(null);

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
                  <td style={{ ...celula, padding: '6px 10px' }}>
                    <BotaoDaCadeia
                      linha={linha}
                      aoAbrir={() => definirCadeiaAberta(linha.id)}
                    />
                  </td>
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
      {/* O GRAFO ENTRA PELA LINHA, e não por uma aba própria. A pergunta que
          ele responde — "de onde veio esta reunião" — nasce olhando a agenda,
          e uma aba obrigaria a escolher a cadeia antes de poder olhar. */}
      {cadeiaAberta ? (
        <CadeiaDaAgenda
          id={cadeiaAberta}
          aoFechar={() => definirCadeiaAberta(null)}
          aoAbrirFicha={aoAbrirFicha}
        />
      ) : null}
    </Secao>
  );
}

/** O acesso à cadeia, na linha da agenda.
 *
 *  Ícone e não texto: a coluna é uma calha estreita e "Ver cadeia" repetido em
 *  duzentas linhas é ruído. Mas ícone sozinho não diz nada a quem não vê — daí
 *  o `aria-label` que soletra o que a marca significa NAQUELA linha, com os
 *  números, e não um "cadeia" genérico igual em todas.
 *
 *  `stopPropagation` porque a linha inteira abre a ficha: sem isso o clique
 *  abriria as duas coisas, e a de cima ganharia.
 */
function BotaoDaCadeia({ linha, aoAbrir }: { linha: Linha; aoAbrir: () => void }) {
  if (!linha.naCadeia) return null;

  return (
    <button
      type="button"
      onClick={(evento) => {
        evento.stopPropagation();
        aoAbrir();
      }}
      title={descreverCadeia(linha)}
      aria-label={`${descreverCadeia(linha)}. Ver a cadeia desta agenda.`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 30,
        height: 30,
        borderRadius: 'var(--r-btn)',
        border: '1px solid var(--borda)',
        background: 'var(--branco)',
        color: 'var(--azul-mar)',
        cursor: 'pointer',
      }}
    >
      {/* Dois nós levando a um: a forma do que o clique abre. SVG, e não
          emoji — emoji muda de desenho a cada sistema e não herda a cor. */}
      <svg width={16} height={16} viewBox="0 0 16 16" aria-hidden focusable="false">
        <path
          d="M4.4 3.6 L11.6 8 M4.4 12.4 L11.6 8"
          stroke="currentColor"
          strokeWidth={1.3}
          fill="none"
        />
        <circle cx={3.4} cy={3.4} r={2.1} fill="currentColor" />
        <circle cx={3.4} cy={12.6} r={2.1} fill="currentColor" />
        <circle cx={12.6} cy={8} r={2.4} fill="currentColor" />
      </svg>
    </button>
  );
}

/** "Decorre de 2 agendas, levou a 1" — o que a marca quer dizer, em palavras. */
function descreverCadeia({ vemDe, levouA }: Linha): string {
  const partes: string[] = [];
  if (vemDe > 0) partes.push(`decorre de ${vemDe} ${vemDe === 1 ? 'agenda' : 'agendas'}`);
  if (levouA > 0) partes.push(`levou a ${levouA} ${levouA === 1 ? 'agenda' : 'agendas'}`);
  const frase = partes.join(', ');
  return frase.charAt(0).toUpperCase() + frase.slice(1);
}

const celula: React.CSSProperties = {
  padding: '10px 14px',
  verticalAlign: 'top',
  color: 'var(--cinza-3)',
};

interface Linha {
  id: string;
  /** Quantas agendas levaram a esta, e quantas saíram dela — os dois números
   *  vindos do SERVIDOR. `naCadeia` é a decisão tomada UMA vez, em
   *  `montarLinha`: o botão, o traço e o CSV leem o mesmo booleano, e três
   *  cópias da mesma condição são três lugares para ela divergir. */
  vemDe: number;
  levouA: number;
  naCadeia: boolean;
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
    vemDe: interacao.origens?.length ?? 0,
    levouA: interacao.derivadas ?? 0,
    naCadeia: temCadeia(interacao),
    data: interacao.data_interacao,
    frente: interacao.frente,
    entidade: nomeDaInstituicao(catalogo, interacao.instituicao_id),
    unidade: nomeDaUnidade(catalogo, interacao.unidade_negocio_id),
    interlocutor: nomeDoInterlocutor(catalogo, interacao.interlocutor_id),
    pauta: tituloDaAgenda(interacao, (ids) => nomesDosTemas(catalogo, ids)),
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
        linha.naCadeia ? descreverCadeia(linha) : '',
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
