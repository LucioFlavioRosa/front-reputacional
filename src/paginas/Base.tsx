/** Base — a tabela completa do recorte, com cabeçalho fixo e exportação. */

import { useMemo, useState } from 'react';
import { usePainel } from '@/estado/painel';
import { temCadeia } from '@/dominio/grafo';
import { registrarExportacao } from '@/api/cliente';
import { resumirRecorte } from '@/dominio/resumo-do-recorte';
import { Botao, Carregando, ChipDeFrente, FaixaDeErro, Secao, Vazio } from '@/componentes/basicos';
import { celula } from '@/componentes/estilos';
import { Abas } from '@/componentes/Abas';
import { FiltrosDeAgendas } from '@/componentes/FiltrosDeAgendas';
import { Linha as LinhaDaTabela, Tabela } from '@/componentes/Tabela';
import { SeletorDeColunas, useColunasVisiveis } from '@/componentes/SeletorDeColunas';
import { DocumentosDaReuniao } from '@/paginas/DocumentosDaReuniao';
import { MateriaisOficiais } from '@/paginas/MateriaisOficiais';
import { dataCompleta, numero, tituloDaAgenda, truncar } from '@/dominio/formato';
import { rotuloDeAbrangencia } from '@/dominio/frentes';
import { alternarOrdenacao, ordenarPor } from '@/dominio/ordenacao';
import type { Ordenacao } from '@/dominio/ordenacao';
import type { Interacao } from '@/dominio/tipos';
import {
  nomeDaEsfera,
  nomeDaInstituicao,
  nomeDaUnidade,
  nomeDoInterlocutor,
  nomesDosTemas,
  rotuloDeCodigo,
  rotuloDeRelevancia,
} from '@/dominio/derivacoes';
import type { Catalogo } from '@/dominio/derivacoes';

/** As tres abas da Base, e o que separa uma da outra.
 *
 *  AS AGENDAS sao os registros — o que a Base sempre foi.
 *
 *  OS MATERIAIS OFICIAIS sao o acervo oficial, o que se leva PARA a
 *  reuniao. Ficam aqui, e nao so na Administracao, porque quem prepara uma
 *  reuniao nao deveria entrar na tela de administracao para consultar — e quem
 *  entra la para consultar acaba editando por engano.
 *
 *  OS DOCUMENTOS sao o que VOLTA da reuniao e mora no nosso armazenamento: a
 *  ata que a outra parte entregou, o material produzido depois. Sem esta aba,
 *  um arquivo so se acha abrindo a agenda que o gerou — e e preciso saber qual
 *  foi.
 *
 *  A PROCEDENCIA E O QUE AS SEPARA, e nao o formato: as tres listam coisas
 *  diferentes vindas de lugares diferentes, com governanca diferente.
 */
const ABAS = [
  { id: 'agendas' as const, rotulo: 'Interações' },
  { id: 'oficiais' as const, rotulo: 'Posicionamentos e Papers' },
  { id: 'documentos' as const, rotulo: 'Documentos das reuniões' },
];

type AbaDaBase = (typeof ABAS)[number]['id'];

const COLUNAS = [
  'Cadeia', 'Data', 'Frente', 'Instituição', 'Unidade', 'Interlocutor',
  'Pauta', 'UF', 'Relevância', 'Situação', 'Temas',
  // -- o resto do que o cadastro pergunta, escondido por padrão -------------
  //
  // Nasce OCULTO (ver `NOVAS_COLUNAS_OCULTAS_POR_PADRAO` logo abaixo): são
  // campos reais do formulário de cadastro, mas menos lidos no dia a dia do
  // que os de cima. Quem quiser, liga em "Colunas".
  'Área(s)', 'Modalidade', 'Local', 'Esfera', 'Clima', 'Desfecho', 'Iniciativa',
];

//: Some destas colunas de propósito na primeira visita — ver o comentário de
//: `useColunasVisiveis` em `SeletorDeColunas.tsx`.
const NOVAS_COLUNAS_OCULTAS_POR_PADRAO = [
  'Área(s)', 'Modalidade', 'Local', 'Esfera', 'Clima', 'Desfecho', 'Iniciativa',
];

//: TODAS MENOS "CADEIA": ela é só o ícone de encadeamento, sem texto para
//: comparar entre linhas — ordenar por ela não diria nada.
const COLUNAS_ORDENAVEIS = COLUNAS.filter((coluna) => coluna !== 'Cadeia');

//: A LARGURA DE SAÍDA de cada coluna, em proporção — não em pixel final.
//:
//: `Tabela` escala tudo isto para caber nos 100% do cartão (é o que
//: `table-layout: fixed` faz quando a soma das larguras não bate com a largura
//: real): o número aqui é só o PESO relativo entre colunas, não um valor
//: absoluto. Sem isto, a tabela nasce em `table-layout: auto` — que cresce
//: pelo conteúdo em vez de respeitar o cartão — e é o que cortava "Copasa" e
//: "Clima" na borda direita sem barra de rolagem nenhuma aparecer: o cartão
//: tinha crescido além do viewport, e não sobrava tela para rolar até lá.
//:
//: Cobre TODAS as colunas, e não só as visíveis por padrão: quem ligar
//: "Área(s)" ou "Modalidade" em Colunas precisa de uma largura pronta também,
//: e não de uma coluna nova brigando por espaço sem peso nenhum definido.
const LARGURAS_PADRAO: Record<string, number> = {
  Cadeia: 40,
  Data: 95,
  Frente: 130,
  Instituição: 150,
  Unidade: 150,
  Interlocutor: 140,
  Pauta: 280,
  UF: 55,
  Relevância: 90,
  Situação: 100,
  Temas: 160,
  'Área(s)': 130,
  Modalidade: 100,
  Local: 130,
  Esfera: 120,
  Clima: 100,
  Desfecho: 110,
  Iniciativa: 110,
};

const ROTULO_DA_MODALIDADE: Record<string, string> = {
  presencial: 'Presencial',
  online: 'Online',
  hibrida: 'Híbrida',
};

const EXTRATORES_DE_ORDENACAO: Record<string, (linha: Linha) => string | number> = {
  Data: (linha) => linha.data,
  Frente: (linha) => linha.frente,
  Instituição: (linha) => linha.entidade,
  Unidade: (linha) => linha.unidade,
  Interlocutor: (linha) => linha.interlocutor,
  Pauta: (linha) => linha.pauta,
  UF: (linha) => linha.uf,
  Relevância: (linha) => linha.tier,
  Situação: (linha) => linha.status,
  Temas: (linha) => linha.tags,
  'Área(s)': (linha) => linha.areas,
  Modalidade: (linha) => linha.modalidade,
  Local: (linha) => linha.local,
  Esfera: (linha) => linha.esfera,
  Clima: (linha) => linha.clima,
  Desfecho: (linha) => linha.resultado,
  Iniciativa: (linha) => linha.iniciativa,
};

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

export function Base({
  aoAbrirFicha,
  aoAbrirCadeia,
}: {
  aoAbrirFicha: (id: string) => void;
  /** A cadeia tem ENDEREÇO PRÓPRIO (`/agenda/<id>/cadeia`), então quem a abre
   *  navega em vez de guardar estado. Duas formas de abrir o mesmo modal — uma
   *  por estado, outra por endereço — divergiriam no primeiro ajuste. */
  aoAbrirCadeia: (id: string) => void;
}) {
  const { interacoes, catalogo, carregando, erro, recorte, total } = usePainel();
  const [aba, definirAba] = useState<AbaDaBase>('agendas');
  const [ordenacao, definirOrdenacao] = useState<Ordenacao | null>(null);
  const { ocultas, visiveis, alternar } = useColunasVisiveis(
    'base-interacoes',
    COLUNAS,
    NOVAS_COLUNAS_OCULTAS_POR_PADRAO,
  );

  const linhas = useMemo(() => {
    if (!catalogo) return [];
    return interacoes.map((interacao) => montarLinha(interacao, catalogo));
  }, [interacoes, catalogo]);

  const linhasOrdenadas = useMemo(
    () => ordenarPor(linhas, ordenacao, EXTRATORES_DE_ORDENACAO),
    [linhas, ordenacao],
  );

  if (erro) return <FaixaDeErro mensagem={erro} />;
  if (carregando || !catalogo) return <Carregando />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Abas
        abas={ABAS}
        ativa={aba}
        aoTrocar={definirAba}
        rotulo="O que a Base mostra"
        prefixo="base"
      />

      {aba === 'oficiais' ? (
        <Secao nivelDoTitulo={1} titulo="Posicionamentos e Papers" estilo={{ padding: 20 }}>
          <MateriaisOficiais />
        </Secao>
      ) : null}

      {aba === 'documentos' ? (
        <Secao nivelDoTitulo={1} titulo="Documentos das reuniões" estilo={{ padding: 20 }}>
          <DocumentosDaReuniao aoAbrirFicha={aoAbrirFicha} />
        </Secao>
      ) : null}

      {aba !== 'agendas' ? null : (
    <Secao
      // O TÍTULO DA TELA É `h1`, e não `h2`: cada destino tem um, e um só.
      // Leitor de tela navega por cabeçalho, e uma tela que abre em `h2`
      // parece um pedaço de outra página.
      nivelDoTitulo={1}
      titulo={`Base de registros — ${numero(total)} ${total === 1 ? 'registro' : 'registros'}`}
      estilo={{ padding: 20 }}
    >
      <div style={{ padding: '16px 16px 12px' }}>
        <FiltrosDeAgendas />
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: 10,
          padding: '0 16px 16px',
        }}
      >
        <SeletorDeColunas todasAsColunas={COLUNAS} ocultas={ocultas} aoAlternar={alternar} />
        <Botao
          variante="primario"
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
            exportarCsv(linhasOrdenadas, resumirRecorte(recorte, catalogo));
          }}
          desabilitado={!linhas.length}
        >
          Exportar CSV
        </Botao>
      </div>

      {!linhas.length ? (
        <div style={{ padding: 16 }}>
          <Vazio
            mensagem="Nenhum registro no recorte"
            dica="Ajuste a busca ou os filtros para ver resultados."
          />
        </div>
      ) : (
        <Tabela
          colunas={visiveis}
          altura="calc(100vh - 400px)"
          colunasOrdenaveis={COLUNAS_ORDENAVEIS.filter((coluna) => visiveis.includes(coluna))}
          ordenacao={ordenacao}
          aoOrdenar={(coluna) => definirOrdenacao((atual) => alternarOrdenacao(atual, coluna))}
          chaveDeArmazenamento="base-interacoes"
          largurasPadrao={LARGURAS_PADRAO}
        >
          {linhasOrdenadas.map((linha) => (
            <LinhaDaTabela
              key={linha.id}
              aoClicar={() => aoAbrirFicha(linha.id)}
              titulo="Abrir a ficha da interação"
            >
            {!visiveis.includes('Cadeia') ? null : (
              <td style={{ ...celula, padding: '6px 10px' }}>
                <BotaoDaCadeia
                  linha={linha}
                  aoAbrir={() => aoAbrirCadeia(linha.id)}
                />
              </td>
            )}
            {!visiveis.includes('Data') ? null : (
              <td style={{ ...celula, whiteSpace: 'nowrap' }} className="tabular">
                {dataCompleta(linha.data)}
              </td>
            )}
            {!visiveis.includes('Frente') ? null : (
              <td style={celula}>
                <ChipDeFrente frente={linha.frente} />
              </td>
            )}
            {!visiveis.includes('Instituição') ? null : (
              <td style={{ ...celula, fontWeight: 500 }}>{linha.entidade}</td>
            )}
            {!visiveis.includes('Unidade') ? null : (
              <td style={{ ...celula, color: 'var(--cinza-2)' }}>{linha.unidade}</td>
            )}
            {!visiveis.includes('Interlocutor') ? null : (
              <td style={celula}>{linha.interlocutor}</td>
            )}
            {!visiveis.includes('Pauta') ? null : (
              <td style={{ ...celula, minWidth: 260 }}>{truncar(linha.pauta, 90)}</td>
            )}
            {!visiveis.includes('UF') ? null : <td style={celula}>{linha.uf}</td>}
            {!visiveis.includes('Relevância') ? null : <td style={celula}>{linha.tier}</td>}
            {!visiveis.includes('Situação') ? null : <td style={celula}>{linha.status}</td>}
            {!visiveis.includes('Temas') ? null : (
              <td style={{ ...celula, color: 'var(--cinza-2)' }}>{linha.tags}</td>
            )}
            {!visiveis.includes('Área(s)') ? null : (
              <td style={{ ...celula, color: 'var(--cinza-2)' }}>{linha.areas}</td>
            )}
            {!visiveis.includes('Modalidade') ? null : <td style={celula}>{linha.modalidade}</td>}
            {!visiveis.includes('Local') ? null : <td style={celula}>{linha.local}</td>}
            {!visiveis.includes('Esfera') ? null : <td style={celula}>{linha.esfera}</td>}
            {!visiveis.includes('Clima') ? null : <td style={celula}>{linha.clima}</td>}
            {!visiveis.includes('Desfecho') ? null : <td style={celula}>{linha.resultado}</td>}
            {!visiveis.includes('Iniciativa') ? null : <td style={celula}>{linha.iniciativa}</td>}
            </LinhaDaTabela>
          ))}
        </Tabela>
      )}
      {/* O GRAFO ENTRA PELA LINHA, e não por uma aba própria — e o modal é
          montado pelo App, a partir do endereço. Ver `aoAbrirCadeia`. */}
    </Secao>
      )}
    </div>
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
      aria-label={`${descreverCadeia(linha)}. Ver a cadeia desta interação.`}
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
  if (vemDe > 0) partes.push(`decorre de ${vemDe} ${vemDe === 1 ? 'interação' : 'interações'}`);
  if (levouA > 0) partes.push(`levou a ${levouA} ${levouA === 1 ? 'interação' : 'interações'}`);
  const frase = partes.join(', ');
  return frase.charAt(0).toUpperCase() + frase.slice(1);
}

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
  areas: string;
  modalidade: string;
  local: string;
  esfera: string;
  clima: string;
  resultado: string;
  iniciativa: string;
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
    areas: (interacao.areas ?? [])
      .map((id) => catalogo.dicionarios.areas_pessoa.find((a) => a.id === id)?.nome ?? String(id))
      .join(', '),
    modalidade: interacao.modalidade ? ROTULO_DA_MODALIDADE[interacao.modalidade] ?? interacao.modalidade : '',
    local: interacao.local ?? '',
    esfera: nomeDaEsfera(catalogo, interacao.esfera_id),
    clima: rotuloDeCodigo(catalogo, 'climas', interacao.clima),
    resultado: rotuloDeCodigo(catalogo, 'resultados', interacao.resultado),
    iniciativa: rotuloDeCodigo(catalogo, 'iniciativas', interacao.iniciativa),
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
        linha.areas,
        linha.modalidade,
        linha.local,
        linha.esfera,
        linha.clima,
        linha.resultado,
        linha.iniciativa,
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
  console.info('[CRM dos Stakeholders] CSV exportado do recorte:', resumoDoRecorte);
}
