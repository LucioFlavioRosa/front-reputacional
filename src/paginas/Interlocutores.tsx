/** Interlocutores — panorama, comparativo entre períodos e a tabela completa. */

import { useMemo, useState } from 'react';
import { usePainel } from '@/estado/painel';
import {
  Cartao,
  Carregando,
  Chip,
  ChipDeFrente,
  FaixaDeErro,
  Kpi,
  Secao,
  Vazio,
  estiloDeEntrada,
} from '@/componentes/basicos';
import { dataCompleta, numero, variacao } from '@/dominio/formato';
import { alternar } from '@/dominio/recorte';
import {
  ROTULOS_DE_JANELA,
  dividirEmJanelas,
  novosContatos,
  panoramaDeInterlocutores,
  semContatoNoPeriodo,
} from '@/dominio/derivacoes';
import type { Janela } from '@/dominio/derivacoes';
import { TabelaComparativa } from '@/paginas/PortaVozes';

type Aba = 'panorama' | 'comparativo' | 'diretorio';

const ABAS: { chave: Aba; rotulo: string }[] = [
  { chave: 'panorama', rotulo: 'Panorama' },
  { chave: 'comparativo', rotulo: 'Comparativo de períodos' },
  { chave: 'diretorio', rotulo: 'Diretório' },
];

export function Interlocutores() {
  const { interacoes, catalogo, carregando, erro, recorte, definirRecorte } = usePainel();
  const [aba, definirAba] = useState<Aba>('panorama');
  const [janela, definirJanela] = useState<Janela>('trimestre');
  const [busca, definirBusca] = useState('');

  const panorama = useMemo(
    () => (catalogo ? panoramaDeInterlocutores(interacoes, catalogo) : []),
    [interacoes, catalogo],
  );

  const comparativo = useMemo(() => {
    if (!catalogo) return null;
    const janelas = dividirEmJanelas(interacoes, janela);
    return {
      janelas,
      atual: panoramaDeInterlocutores(janelas.atual, catalogo),
      anterior: panoramaDeInterlocutores(janelas.anterior, catalogo),
      novos: novosContatos(janelas),
      semContato: semContatoNoPeriodo(janelas),
    };
  }, [interacoes, catalogo, janela]);

  if (erro) return <FaixaDeErro mensagem={erro} />;
  if (carregando || !catalogo) return <Carregando />;

  const filtrados = busca
    ? panorama.filter(
        (item) =>
          item.nome.toLowerCase().includes(busca.toLowerCase()) ||
          item.instituicao.toLowerCase().includes(busca.toLowerCase()),
      )
    : panorama;

  const contatoUnico = panorama.filter((item) => item.total === 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        {ABAS.map((item) => (
          <Chip
            key={item.chave}
            rotulo={item.rotulo}
            ativo={aba === item.chave}
            fundo={aba === item.chave ? 'var(--azul-mar)' : 'var(--bg-trilho)'}
            texto={aba === item.chave ? 'var(--branco)' : 'var(--cinza-3)'}
            aoClicar={() => definirAba(item.chave)}
          />
        ))}
      </div>

      {aba === 'panorama' ? (
        <>
          <div className="grade grade--4" style={{ gap: 14 }}>
            <Kpi rotulo="Interlocutores no recorte" valor={numero(panorama.length)} />
            {panorama.slice(0, 3).map((item) => (
              <Kpi
                key={item.id}
                rotulo={item.instituicao}
                valor={numero(item.total)}
                dica={item.nome}
                cor="var(--azul-mar)"
                aoClicar={() => definirRecorte(alternar(recorte, 'pessoa', item.id))}
              />
            ))}
          </div>

          <div className="grade grade--2" style={{ gap: 16 }}>
            <Secao titulo="Por frente">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {[...new Set(panorama.map((item) => item.frente))].map((frente) => {
                  const quantos = panorama.filter((item) => item.frente === frente).length;
                  return (
                    <Cartao key={frente} estilo={{ padding: '12px 14px', flex: '1 1 130px' }}>
                      <ChipDeFrente frente={frente} />
                      <div
                        className="tabular"
                        style={{ fontSize: 22, fontWeight: 700, marginTop: 7 }}
                      >
                        {numero(quantos)}
                      </div>
                    </Cartao>
                  );
                })}
              </div>
            </Secao>

            <Secao titulo="Contato único">
              <div
                className="tabular"
                style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-0.03em' }}
              >
                {numero(contatoUnico.length)}
              </div>
              <p style={{ fontSize: 13, color: 'var(--cinza-3)', marginTop: 6 }}>
                {contatoUnico.length === 1 ? 'Pessoa que apareceu' : 'Pessoas que apareceram'} uma
                única vez no recorte — relacionamento ainda não construído.
              </p>
            </Secao>
          </div>

          <Secao
            titulo={`Todos os interlocutores — ${numero(filtrados.length)}`}
            acao={
              <input
                value={busca}
                placeholder="Buscar nome ou veículo…"
                onChange={(evento) => definirBusca(evento.target.value)}
                style={{ ...estiloDeEntrada, width: 240, height: 34 }}
              />
            }
            estilo={{ padding: 0 }}
          >
            {!filtrados.length ? (
              <Vazio mensagem="Nenhum interlocutor encontrado" />
            ) : (
              <div className="rolagem-interna" style={{ maxHeight: 'calc(100vh - 420px)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr>
                      {['Interlocutor', 'Veículo / órgão', 'Frente', 'Última', 'Registros'].map(
                        (coluna) => (
                          <th
                            key={coluna}
                            style={{
                              position: 'sticky',
                              top: 0,
                              background: 'var(--bg-trilho)',
                              textAlign: 'left',
                              padding: '10px 14px',
                              fontSize: 11,
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                              color: 'var(--cinza-2)',
                              borderBottom: '1px solid var(--borda)',
                            }}
                          >
                            {coluna}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filtrados.map((item) => (
                      <tr
                        key={item.id}
                        onClick={() => definirRecorte(alternar(recorte, 'pessoa', item.id))}
                        title="Filtrar o painel por este interlocutor"
                        style={{ cursor: 'pointer', borderBottom: '1px solid var(--borda)' }}
                      >
                        <td style={{ padding: '10px 14px', fontWeight: 500 }}>{item.nome}</td>
                        <td style={{ padding: '10px 14px', color: 'var(--cinza-3)' }}>
                          {item.instituicao}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <ChipDeFrente frente={item.frente} />
                        </td>
                        <td className="tabular" style={{ padding: '10px 14px', color: 'var(--cinza-2)' }}>
                          {dataCompleta(item.ultima)}
                        </td>
                        <td className="tabular" style={{ padding: '10px 14px', fontWeight: 700 }}>
                          {item.total}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Secao>
        </>
      ) : null}

      {aba === 'comparativo' && comparativo ? (
        <>
          <div style={{ display: 'flex', gap: 6 }}>
            {(Object.keys(ROTULOS_DE_JANELA) as Janela[]).map((opcao) => (
              <Chip
                key={opcao}
                rotulo={ROTULOS_DE_JANELA[opcao]}
                ativo={janela === opcao}
                fundo={janela === opcao ? 'var(--cinza-4)' : 'var(--bg-trilho)'}
                texto={janela === opcao ? 'var(--branco)' : 'var(--cinza-3)'}
                aoClicar={() => definirJanela(opcao)}
              />
            ))}
          </div>

          <div className="grade grade--4" style={{ gap: 14 }}>
            <Kpi rotulo="Período atual" valor={numero(comparativo.atual.length)} dica="contatos" />
            <Kpi
              rotulo="Período anterior"
              valor={numero(comparativo.anterior.length)}
              dica="contatos"
              cor="var(--cinza-2)"
            />
            <Kpi
              rotulo="Novos contatos"
              valor={numero(comparativo.novos)}
              dica="não apareciam antes"
              cor="var(--turquesa-rio)"
            />
            <Kpi
              rotulo="Sem contato no período"
              valor={numero(comparativo.semContato)}
              dica="apareciam e sumiram"
              cor="var(--laranja-baia)"
            />
          </div>

          <Secao
            titulo={`Variação — ${variacao(comparativo.atual.length, comparativo.anterior.length)}`}
          >
            <TabelaComparativa
              atual={comparativo.atual.map((i) => ({ nome: i.nome, total: i.total }))}
              anterior={comparativo.anterior.map((i) => ({ nome: i.nome, total: i.total }))}
            />
          </Secao>
        </>
      ) : null}

      {aba === 'diretorio' ? (
        <Secao titulo="Diretório de interlocutores">
          <p style={{ fontSize: 13, color: 'var(--cinza-3)', marginBottom: 16 }}>
            Cargo, tipo e temas de interesse são somente leitura por enquanto — os endpoints de
            escrita do cadastro entram junto com os de porta-vozes.
          </p>
          <div className="rolagem-interna" style={{ maxHeight: 420 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <tbody>
                {[...catalogo.interlocutores.values()].map((pessoa) => (
                  <tr key={pessoa.id} style={{ borderBottom: '1px solid var(--borda)' }}>
                    <td style={{ padding: '9px 4px', fontWeight: 500 }}>{pessoa.nome}</td>
                    <td style={{ padding: '9px 4px', color: 'var(--cinza-2)' }}>
                      {pessoa.cargo ?? '—'}
                    </td>
                    <td style={{ padding: '9px 4px', color: 'var(--cinza-2)' }}>
                      {pessoa.tipo ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Secao>
      ) : null}
    </div>
  );
}
