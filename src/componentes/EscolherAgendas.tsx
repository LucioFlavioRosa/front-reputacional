/** Escolher agendas na base, com marcação — o seletor de origens.
 *
 *  POR QUE UM MODAL COM A TABELA, E NÃO UMA LISTA NO FORMULÁRIO
 *  -----------------------------------------------------------
 *  A versão anterior era uma lista estreita dentro do campo, com data, título e
 *  instituição. Três campos bastam para confirmar uma agenda que já se tem em
 *  mente; não bastam para RECONHECER a certa entre duzentas. Quem procura a
 *  reunião do mês passado se lembra da frente, do órgão e do quanto ela
 *  importava — e é a linha inteira da Base que carrega isso.
 *
 *  E MARCAR VÁRIAS DE UMA VEZ é o caso que motivou a linhagem plural: "a
 *  agência e a bancada levaram juntas a esta reunião". Escolher uma, fechar,
 *  reabrir e escolher outra transforma um fato único em dois gestos.
 *
 *  O MODAL EDITA O CONJUNTO INTEIRO, e não acrescenta ao que existe. Vem com o
 *  que já está ligado marcado: dá para tirar aqui mesmo, no lugar onde se vê
 *  todas juntas. Um seletor que só soma obriga a fechar para poder remover.
 */

import { useMemo, useState } from 'react';
import { Botao, ChipDeFrente, Modal, Vazio } from '@/componentes/basicos';
import { dataCompleta, numero, tituloDaAgenda } from '@/dominio/formato';
import { estiloDeEntrada } from '@/componentes/basicos';
import { rotuloDeAbrangencia } from '@/dominio/frentes';
import {
  nomeDaInstituicao,
  nomesDosTemas,
  rotuloDeCodigo,
  rotuloDeRelevancia,
} from '@/dominio/derivacoes';
import type { Catalogo } from '@/dominio/derivacoes';
import type { Interacao } from '@/dominio/tipos';

const COLUNAS = ['', 'Data', 'Frente', 'Instituição', 'Pauta', 'UF', 'Relevância', 'Situação'];

export function EscolherAgendas({
  candidatas,
  escolhidas,
  catalogo,
  aoFechar,
  aoConfirmar,
}: {
  /** As que podem ser escolhidas — já sem esta agenda e sem as posteriores. */
  candidatas: Interacao[];
  escolhidas: string[];
  catalogo: Catalogo;
  aoFechar: () => void;
  aoConfirmar: (ids: string[]) => void;
}) {
  const [marcadas, definirMarcadas] = useState<Set<string>>(() => new Set(escolhidas));
  const [busca, definirBusca] = useState('');

  const visiveis = useMemo(() => {
    const procurado = busca.trim().toLowerCase();
    if (!procurado) return candidatas;
    return candidatas.filter((agenda) =>
      [
        agenda.data_interacao,
        dataCompleta(agenda.data_interacao),
        tituloDaAgenda(agenda, (ids) => nomesDosTemas(catalogo, ids)),
        nomeDaInstituicao(catalogo, agenda.instituicao_id),
        rotuloDeAbrangencia(agenda.uf),
      ]
        .join(' ')
        .toLowerCase()
        .includes(procurado),
    );
  }, [candidatas, busca, catalogo]);

  const alternar = (id: string) => {
    definirMarcadas((atuais) => {
      const proximas = new Set(atuais);
      if (proximas.has(id)) proximas.delete(id);
      else proximas.add(id);
      return proximas;
    });
  };

  return (
    <Modal
      titulo="De quais agendas esta decorre"
      subtitulo={
        `${numero(candidatas.length)} ${candidatas.length === 1 ? 'agenda' : 'agendas'} — ` +
        'só as que já aconteceram, até a data desta'
      }
      aoFechar={aoFechar}
      largura={1080}
      rodape={
        <>
          <span style={{ fontSize: 13, color: 'var(--cinza-2)', marginRight: 'auto' }}>
            {marcadas.size === 0
              ? 'Nenhuma marcada'
              : `${numero(marcadas.size)} ${marcadas.size === 1 ? 'marcada' : 'marcadas'}`}
          </span>
          <Botao aoClicar={aoFechar}>Cancelar</Botao>
          <Botao variante="primario" aoClicar={() => aoConfirmar([...marcadas])}>
            {/* "Usar", e não "Adicionar": o modal edita o conjunto inteiro, e
                confirmar com nada marcado LIMPA as origens — que é o gesto de
                quem se enganou e quer desfazer. */}
            {marcadas.size === 0
              ? 'Não vem de nenhuma'
              : `Usar ${numero(marcadas.size)} ${marcadas.size === 1 ? 'agenda' : 'agendas'}`}
          </Botao>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input
          type="search"
          style={estiloDeEntrada}
          placeholder="Buscar por assunto, instituição, UF ou data…"
          value={busca}
          onChange={(evento) => definirBusca(evento.target.value)}
          aria-label="Buscar agenda anterior"
          autoFocus
        />

        {!visiveis.length ? (
          <Vazio
            mensagem={
              candidatas.length
                ? 'Nenhuma agenda encontrada com esse texto'
                : 'Nenhuma agenda concluída antes desta data'
            }
            dica={
              candidatas.length
                ? 'Tente parte do assunto ou o nome do órgão.'
                : 'Só entram aqui as reuniões que já aconteceram.'
            }
          />
        ) : (
          <div className="rolagem-interna" style={{ maxHeight: 420, border: '1px solid var(--borda)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {COLUNAS.map((coluna, indice) => (
                    <th
                      key={coluna || 'marcar'}
                      scope="col"
                      style={{
                        position: 'sticky',
                        top: 0,
                        zIndex: 1,
                        background: 'var(--bg-trilho)',
                        textAlign: 'left',
                        padding: '9px 12px',
                        width: indice === 0 ? 38 : undefined,
                        fontSize: 10.5,
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
                {visiveis.map((agenda) => {
                  const marcada = marcadas.has(agenda.id);
                  const titulo = tituloDaAgenda(agenda, (ids) => nomesDosTemas(catalogo, ids));
                  return (
                    <tr
                      key={agenda.id}
                      onClick={() => alternar(agenda.id)}
                      // A LINHA INTEIRA MARCA. Um alvo de 14px numa tabela de
                      // duzentas linhas é um erro de clique esperando para
                      // acontecer; a caixa continua ali para quem mira nela.
                      style={{
                        cursor: 'pointer',
                        background: marcada ? 'var(--bg-hover)' : undefined,
                        borderBottom: '1px solid var(--borda)',
                      }}
                    >
                      <td style={{ padding: '8px 12px' }}>
                        <input
                          type="checkbox"
                          checked={marcada}
                          onChange={() => alternar(agenda.id)}
                          onClick={(evento) => evento.stopPropagation()}
                          aria-label={`${titulo}, ${dataCompleta(agenda.data_interacao)}`}
                        />
                      </td>
                      <td className="tabular" style={{ ...celula, whiteSpace: 'nowrap' }}>
                        {dataCompleta(agenda.data_interacao)}
                      </td>
                      <td style={celula}>
                        <ChipDeFrente frente={agenda.frente} />
                      </td>
                      <td style={{ ...celula, fontWeight: 500 }}>
                        {nomeDaInstituicao(catalogo, agenda.instituicao_id)}
                      </td>
                      <td style={{ ...celula, minWidth: 240 }}>{titulo}</td>
                      <td style={celula}>{rotuloDeAbrangencia(agenda.uf)}</td>
                      <td style={celula}>{rotuloDeRelevancia(catalogo, agenda.tier)}</td>
                      <td style={celula}>{rotuloDeCodigo(catalogo, 'status', agenda.status)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
}

const celula: React.CSSProperties = {
  padding: '8px 12px',
  verticalAlign: 'top',
  color: 'var(--cinza-3)',
};
