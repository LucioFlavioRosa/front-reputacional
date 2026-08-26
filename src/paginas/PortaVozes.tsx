/** Porta-vozes — exposição, comparativo entre períodos e o diretório. */

import { useMemo, useState } from 'react';
import { usePainel } from '@/estado/painel';
import { Ranking } from '@/graficos/Ranking';
import {
  Barra,
  Cartao,
  Carregando,
  Chip,
  ChipDeFrente,
  FaixaDeErro,
  Kpi,
  Secao,
  Selo,
  Vazio,
} from '@/componentes/basicos';
import { dataCompleta, numero, percentual, variacao } from '@/dominio/formato';
import { alternar } from '@/dominio/recorte';
import type { Frente } from '@/dominio/tipos';
import {
  ROTULOS_DE_JANELA,
  dividirEmJanelas,
  exposicaoDePortaVozes,
} from '@/dominio/derivacoes';
import type { Janela } from '@/dominio/derivacoes';

type Aba = 'exposicao' | 'comparativo' | 'diretorio';

const ABAS: { chave: Aba; rotulo: string }[] = [
  { chave: 'exposicao', rotulo: 'Exposição' },
  { chave: 'comparativo', rotulo: 'Comparativo de períodos' },
  { chave: 'diretorio', rotulo: 'Diretório' },
];

/** Acima disso, um único nome concentra exposição demais. */
const LIMITE_DE_CONCENTRACAO = 0.35;

export function PortaVozes() {
  const { interacoes, catalogo, carregando, erro, recorte, definirRecorte } = usePainel();
  const [aba, definirAba] = useState<Aba>('exposicao');
  const [janela, definirJanela] = useState<Janela>('trimestre');

  const exposicao = useMemo(
    () => (catalogo ? exposicaoDePortaVozes(interacoes, catalogo) : null),
    [interacoes, catalogo],
  );

  const comparativo = useMemo(() => {
    if (!catalogo) return null;
    const janelas = dividirEmJanelas(interacoes, janela);
    return {
      atual: exposicaoDePortaVozes(janelas.atual, catalogo),
      anterior: exposicaoDePortaVozes(janelas.anterior, catalogo),
    };
  }, [interacoes, catalogo, janela]);

  if (erro) return <FaixaDeErro mensagem={erro} />;
  if (carregando || !exposicao || !catalogo) return <Carregando />;

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

      {aba === 'exposicao' ? (
        <>
          <div className="grade grade--4" style={{ gap: 14 }}>
            <Kpi rotulo="Porta-vozes acionados" valor={numero(exposicao.acionados)} />
            <Kpi
              rotulo="Concentração no primeiro"
              valor={percentual(exposicao.concentracaoNoPrimeiro * 100, 100)}
              dica={exposicao.pessoas[0]?.nome}
              cor={
                exposicao.concentracaoNoPrimeiro > LIMITE_DE_CONCENTRACAO
                  ? 'var(--laranja-baia)'
                  : 'var(--turquesa-rio)'
              }
            />
            <Kpi
              rotulo="Média por porta-voz"
              valor={exposicao.mediaPorPortaVoz.toFixed(1).replace('.', ',')}
            />
            <Kpi rotulo="Exposição em Tier 1" valor={numero(exposicao.emTier1)} />
          </div>

          <p style={{ fontSize: 12, color: 'var(--cinza-2)' }}>
            O denominador é o total de <strong>aparições</strong> ({numero(exposicao.aparicoes)}), não
            de registros: uma interação com dois porta-vozes conta para os dois.
          </p>

          {exposicao.concentracaoNoPrimeiro > LIMITE_DE_CONCENTRACAO ? (
            <div
              style={{
                background: 'var(--atencao-bg)',
                color: 'var(--atencao-fg)',
                borderRadius: 'var(--r-card-int)',
                padding: '13px 16px',
                fontSize: 13,
              }}
            >
              <strong>{exposicao.pessoas[0]?.nome}</strong> concentra{' '}
              {percentual(exposicao.concentracaoNoPrimeiro * 100, 100)} das aparições no recorte.
              Acima de 35% num único nome, a exposição da companhia fica dependente de uma pessoa.
            </div>
          ) : null}

          {!exposicao.pessoas.length ? (
            <Vazio
              mensagem="Nenhum porta-voz registrado no recorte"
              dica="Os registros importados da planilha trazem porta-voz apenas na frente de imprensa."
            />
          ) : (
            <div className="grade grade--2" style={{ gap: 14 }}>
              {exposicao.pessoas.map((pessoa) => (
                <Cartao key={pessoa.id}>
                  <div
                    style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}
                  >
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700 }}>{pessoa.nome}</div>
                      <div style={{ fontSize: 12, color: 'var(--cinza-2)' }}>
                        {pessoa.cargo ?? 'cargo não cadastrado'}
                      </div>
                    </div>
                    <div
                      className="tabular"
                      style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em' }}
                    >
                      {numero(pessoa.total)}
                    </div>
                  </div>

                  <div style={{ margin: '12px 0' }}>
                    <Barra
                      valor={pessoa.total}
                      maximo={exposicao.pessoas[0].total}
                      cor="var(--azul-mar)"
                    />
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                    {pessoa.porFrente.map((item) => (
                      <ChipDeFrente
                        key={item.chave}
                        frente={item.chave as Frente}
                        aoClicar={() =>
                          definirRecorte(alternar(recorte, 'frente', item.chave as Frente))
                        }
                      />
                    ))}
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
                    {pessoa.temas.slice(0, 6).map((tema) => (
                      <Chip key={tema} rotulo={tema} />
                    ))}
                  </div>

                  <div style={{ fontSize: 11, color: 'var(--cinza-2)' }}>
                    Última aparição:{' '}
                    {pessoa.ultimaAparicao ? dataCompleta(pessoa.ultimaAparicao) : '—'} · Tier 1:{' '}
                    {numero(pessoa.emTier1)}
                  </div>
                </Cartao>
              ))}
            </div>
          )}
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

          <div className="grade grade--3" style={{ gap: 14 }}>
            <Kpi rotulo="Período atual" valor={numero(comparativo.atual.aparicoes)} dica="aparições" />
            <Kpi
              rotulo="Período anterior"
              valor={numero(comparativo.anterior.aparicoes)}
              dica="aparições"
              cor="var(--cinza-2)"
            />
            <Kpi
              rotulo="Variação"
              valor={variacao(comparativo.atual.aparicoes, comparativo.anterior.aparicoes)}
              cor={
                comparativo.atual.aparicoes >= comparativo.anterior.aparicoes
                  ? 'var(--turquesa-rio)'
                  : 'var(--vermelho-pitanga)'
              }
            />
          </div>

          <Secao titulo="Por pessoa">
            <TabelaComparativa
              atual={comparativo.atual.pessoas.map((p) => ({ nome: p.nome, total: p.total }))}
              anterior={comparativo.anterior.pessoas.map((p) => ({
                nome: p.nome,
                total: p.total,
              }))}
            />
          </Secao>
        </>
      ) : null}

      {aba === 'diretorio' ? (
        <Secao titulo="Diretório de porta-vozes">
          <p style={{ fontSize: 13, color: 'var(--cinza-3)', marginBottom: 16 }}>
            Cargo, temas autorizados e o estado ativo/inativo ainda são somente leitura: o backend
            expõe a listagem, e os endpoints de escrita do cadastro entram na próxima etapa.
          </p>
          <Ranking
            itens={[...catalogo.pessoas.values()]
              .filter((pessoa) => pessoa.eh_porta_voz)
              .map((pessoa) => ({
                chave: pessoa.id,
                rotulo: `${pessoa.nome}${pessoa.cargo ? ` — ${pessoa.cargo}` : ''}`,
                total: exposicao.pessoas.find((p) => p.id === pessoa.id)?.total ?? 0,
              }))}
            vazio="Nenhum porta-voz cadastrado."
          />
        </Secao>
      ) : null}
    </div>
  );
}

export function TabelaComparativa({
  atual,
  anterior,
}: {
  atual: { nome: string; total: number }[];
  anterior: { nome: string; total: number }[];
}) {
  const antesPorNome = new Map(anterior.map((item) => [item.nome, item.total]));
  const nomes = [...new Set([...atual.map((a) => a.nome), ...anterior.map((a) => a.nome)])];
  const atualPorNome = new Map(atual.map((item) => [item.nome, item.total]));
  const maximo = Math.max(1, ...atual.map((a) => a.total), ...anterior.map((a) => a.total));

  const linhas = nomes
    .map((nome) => ({
      nome,
      agora: atualPorNome.get(nome) ?? 0,
      antes: antesPorNome.get(nome) ?? 0,
    }))
    .sort((a, b) => b.agora - a.agora);

  if (!linhas.length) {
    return <div style={{ fontSize: 13, color: 'var(--cinza-2)' }}>Sem dados nas duas janelas.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
      {linhas.map((linha) => {
        const delta = linha.agora - linha.antes;
        return (
          <div key={linha.nome}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 13,
                marginBottom: 5,
              }}
            >
              <span>{linha.nome}</span>
              <span style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
                <span className="tabular" style={{ color: 'var(--cinza-2)' }}>
                  {linha.antes}
                </span>
                <span className="tabular" style={{ fontWeight: 700 }}>
                  {linha.agora}
                </span>
                <Selo
                  rotulo={delta > 0 ? `+${delta}` : String(delta)}
                  fundo={
                    delta > 0 ? 'var(--ok-bg)' : delta < 0 ? 'var(--erro-bg)' : 'var(--bg-trilho)'
                  }
                  texto={
                    delta > 0 ? 'var(--ok-fg)' : delta < 0 ? 'var(--erro-fg)' : 'var(--cinza-2)'
                  }
                />
              </span>
            </div>
            <div style={{ display: 'grid', gap: 3 }}>
              <Barra valor={linha.antes} maximo={maximo} cor="var(--cinza-1)" altura={6} />
              <Barra valor={linha.agora} maximo={maximo} cor="var(--azul-mar)" altura={6} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
