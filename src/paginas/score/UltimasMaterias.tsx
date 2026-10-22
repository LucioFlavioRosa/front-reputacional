/** "Últimas matérias" da Imprensa e do Mercado: as 15 do mês na MESMA tabela da
 *  Base de dados (por pedido) — colunas que se alargam arrastando, "Restaurar
 *  layout", e clique no cabeçalho para classificar. Cada linha abre um popup com
 *  o detalhe da matéria e, dentro dele, o link para a matéria na fonte.
 *
 *  A CLASSIFICAÇÃO É NO NAVEGADOR: são 15 linhas já na mão, e uma ida ao
 *  servidor por clique no cabeçalho só atrasaria a resposta.
 */

import { useState } from 'react';
import type { CSSProperties } from 'react';

import { Cartao, ComFaixaDoTopo, Modal, Secao } from '@/componentes/basicos';
import { CabecalhoDoBloco, NotaDeFonte } from '@/componentes/Procedencia';
import { Linha, Tabela } from '@/componentes/Tabela';
import type { Bloco } from '@/dominio/dossie';
import { dataCompleta, numero } from '@/dominio/formato';
import { rotuloDeAbrangencia } from '@/dominio/frentes';
import { GUIA_DO_BLOCO } from '@/dominio/guiaDoDossie';
import { ordenarPor } from '@/dominio/ordenacao';
import type { Ordenacao } from '@/dominio/ordenacao';

type Materia = Record<string, unknown>;

function texto(valor: unknown): string | null {
  if (valor === null || valor === undefined || valor === '') return null;
  return String(valor);
}

/** Só `http`/`https`: o endereço vem do arquivo do fornecedor, e um
 *  `javascript:` viraria código na sessão de quem clicou. */
function linkSeguro(valor: unknown): string | null {
  const endereco = texto(valor);
  return endereco && /^https?:\/\//i.test(endereco) ? endereco : null;
}

//: AS COLUNAS, com o campo de cada uma e o que se compara ao classificar. A data
//: classifica pela ISO (`data`), e não pelo "28/08" que se lê.
const COLUNAS: { rotulo: string; campo: string; ordena: (m: Materia) => string }[] = [
  { rotulo: 'Data', campo: 'quando', ordena: (m) => texto(m.data) ?? '' },
  { rotulo: 'Veículo', campo: 'veiculo', ordena: (m) => texto(m.veiculo) ?? '' },
  { rotulo: 'Classificação', campo: 'sentimento', ordena: (m) => texto(m.sentimento) ?? '' },
  { rotulo: 'Tier', campo: 'tier', ordena: (m) => texto(m.tier) ?? '' },
  { rotulo: 'Atributo (N1)', campo: 'atributo', ordena: (m) => texto(m.atributo) ?? '' },
  { rotulo: 'Tema', campo: 'tema', ordena: (m) => texto(m.tema) ?? '' },
];
const DETALHES = 'Detalhes';
const LARGURAS_PADRAO: Record<string, number> = {
  Data: 90,
  Veículo: 170,
  Classificação: 160,
  Tier: 80,
  'Atributo (N1)': 240,
  [DETALHES]: 120,
};
const EXTRATORES = Object.fromEntries(COLUNAS.map((coluna) => [coluna.rotulo, coluna.ordena]));

//: A COR DA CLASSIFICAÇÃO, a mesma que a tabela antiga usava: o negativo em
//: alerta, o positivo em verde, o neutro sem destaque. Sentimento de NOTÍCIA,
//: e não o termômetro de reunião (`clima`) — por isso "Positivo"/"Negativo",
//: pedido do cliente de 21/10/2026, e não "Propositivo"/"Reativo".
function estiloDaClassificacao(valor: string | null): CSSProperties {
  if (valor === 'Negativo') return { color: 'var(--erro-fg)', fontWeight: 700 };
  if (valor === 'Positivo') return { color: 'var(--ok-fg)', fontWeight: 700 };
  return {};
}

export function UltimasMaterias({ bloco }: { bloco: Bloco }) {
  const [aberta, definirAberta] = useState<Materia | null>(null);
  //: DA MAIS NOVA PARA A MAIS ANTIGA de saída — é o que "últimas" promete.
  const [ordem, definirOrdem] = useState<Ordenacao>({ coluna: 'Data', direcao: 'desc' });
  const linhas = ordenarPor(bloco.dados, ordem, EXTRATORES);

  return (
    <ComFaixaDoTopo>
      <Secao titulo="Últimas matérias">
        <Cartao>
          <CabecalhoDoBloco
            titulo={bloco.titulo}
            conclusao={bloco.conclusao}
            ficha={bloco.ficha}
            ajuda={GUIA_DO_BLOCO[bloco.titulo]}
          />
          {linhas.length ? (
            <Tabela
              colunas={[...COLUNAS.map((coluna) => coluna.rotulo), DETALHES]}
              colunasOrdenaveis={COLUNAS.map((coluna) => coluna.rotulo)}
              ordenacao={ordem}
              aoOrdenar={(coluna) =>
                definirOrdem((atual) =>
                  atual.coluna === coluna
                    ? { coluna, direcao: atual.direcao === 'asc' ? 'desc' : 'asc' }
                    : { coluna, direcao: coluna === 'Data' ? 'desc' : 'asc' },
                )
              }
              chaveDeArmazenamento="ultimas-materias-v1"
              altura="460px"
              largurasPadrao={LARGURAS_PADRAO}
              barraDeLargura
            >
              {linhas.map((materia, indice) => (
                <Linha
                  key={`${texto(materia.data) ?? ''}-${texto(materia.veiculo) ?? ''}-${indice}`}
                  aoClicar={() => {
                    //: SELECIONAR TEXTO NÃO ABRE NADA: copiar o nome de um
                    //: veículo termina num clique.
                    if (window.getSelection()?.toString()) return;
                    definirAberta(materia);
                  }}
                  titulo="Ver detalhes"
                >
                  {COLUNAS.map((coluna) => {
                    const valor = texto(materia[coluna.campo]);
                    return (
                      <td
                        key={coluna.rotulo}
                        style={{
                          padding: '9px 12px',
                          fontSize: 13,
                          verticalAlign: 'top',
                          overflowWrap: 'anywhere',
                          ...(coluna.campo === 'sentimento' ? estiloDaClassificacao(valor) : {}),
                        }}
                      >
                        {valor ?? <span style={{ color: 'var(--cinza-2)' }}>—</span>}
                      </td>
                    );
                  })}
                  <td style={{ padding: '9px 12px', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                    <button
                      type="button"
                      onClick={(evento) => {
                        evento.stopPropagation();
                        definirAberta(materia);
                      }}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        padding: 0,
                        color: 'var(--azul-mar)',
                        fontWeight: 700,
                        fontSize: 12.5,
                        textDecoration: 'underline',
                        cursor: 'pointer',
                      }}
                    >
                      Ver detalhes
                    </button>
                  </td>
                </Linha>
              ))}
            </Tabela>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--cinza-2)', margin: 0 }}>
              Sem registro no período.
            </p>
          )}
          <NotaDeFonte ficha={bloco.ficha} />
        </Cartao>
      </Secao>
      {aberta ? <DetalheDaMateria materia={aberta} aoFechar={() => definirAberta(null)} /> : null}
    </ComFaixaDoTopo>
  );
}

function DetalheDaMateria({ materia, aoFechar }: { materia: Materia; aoFechar: () => void }) {
  const link = linkSeguro(materia.link);
  const data = texto(materia.data);
  const uf = texto(materia.uf);
  const engajamento = materia.engajamento;
  const campos: [string, string | null][] = [
    ['Data', data ? dataCompleta(data) : texto(materia.quando)],
    ['Veículo', texto(materia.veiculo)],
    ['Classificação', texto(materia.sentimento)],
    ['Tier', texto(materia.tier)],
    ['Atributo (N1)', texto(materia.atributo)],
    ['Tema', texto(materia.tema)],
    ['Autor', texto(materia.autor)],
    ['Estado do veículo', uf ? rotuloDeAbrangencia(uf) : null],
    ['Engajamento', typeof engajamento === 'number' ? numero(engajamento) : texto(engajamento)],
  ];
  const conteudo = texto(materia.texto);

  return (
    <Modal
      titulo={texto(materia.veiculo) ?? 'Matéria'}
      subtitulo={data ? dataCompleta(data) : (texto(materia.quando) ?? undefined)}
      aoFechar={aoFechar}
      largura={720}
      rodape={
        link ? (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              borderRadius: 'var(--r-btn)',
              background: 'var(--azul-mar)',
              color: 'var(--branco)',
              fontWeight: 700,
              fontSize: 13,
              textDecoration: 'none',
            }}
          >
            Abrir a matéria ↗
          </a>
        ) : (
          <span style={{ fontSize: 12.5, color: 'var(--cinza-2)' }}>
            Esta matéria veio sem link na planilha.
          </span>
        )
      }
    >
      {conteudo ? (
        <p style={{ margin: '0 0 18px', fontSize: 14, lineHeight: 1.55, color: 'var(--cinza-4)' }}>
          {conteudo}
        </p>
      ) : null}
      <dl
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: '12px 24px',
          margin: 0,
        }}
      >
        {campos.map(([rotulo, valor]) => (
          <div key={rotulo}>
            <dt className="kicker" style={{ marginBottom: 2 }}>
              {rotulo}
            </dt>
            <dd
              style={{
                margin: 0,
                fontSize: 13.5,
                color: valor ? 'var(--cinza-4)' : 'var(--cinza-2)',
                ...(rotulo === 'Classificação' ? estiloDaClassificacao(valor) : {}),
              }}
            >
              {valor ?? '—'}
            </dd>
          </div>
        ))}
      </dl>
      {link ? (
        <p style={{ margin: '18px 0 0', fontSize: 12, color: 'var(--cinza-2)', wordBreak: 'break-all' }}>
          Link:{' '}
          <a href={link} target="_blank" rel="noopener noreferrer">
            {link}
          </a>
        </p>
      ) : null}
    </Modal>
  );
}
