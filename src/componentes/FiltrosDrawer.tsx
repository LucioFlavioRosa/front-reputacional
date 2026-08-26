/** Barra lateral de filtros — 312px, sobre um scrim que fecha ao clicar fora.
 *
 *  Os filtros da tela, na ordem em que o handoff os lista. Cada campo
 *  produz um Recorte novo; nenhum deles troca de aba.
 */

import { usePainel } from '@/estado/painel';
import { ATALHOS_DE_PERIODO } from '@/dominio/recorte';
import type { AtalhoDePeriodo, Recorte } from '@/dominio/recorte';
import { ROTULOS_DE_FRENTE } from '@/dominio/frentes';
import { FRENTES } from '@/dominio/tipos';
import type { Frente, GrupoDeStatus } from '@/dominio/tipos';
import { Botao, Campo, Chip, estiloDeEntrada } from '@/componentes/basicos';

export function DrawerDeFiltros() {
  const { recorte, definirRecorte, limparRecorte, drawerAberto, fecharDrawer, catalogo, filtrosAtivos } =
    usePainel();

  if (!drawerAberto) return null;

  const alterar = <C extends keyof Recorte>(campo: C, valor: Recorte[C] | '') => {
    const proximo = { ...recorte };
    if (valor === '' || valor == null) delete proximo[campo];
    else proximo[campo] = valor as Recorte[C];
    definirRecorte(proximo);
  };

  const alternarTema = (nome: string) => {
    const atuais = new Set(recorte.tags ?? []);
    if (atuais.has(nome)) atuais.delete(nome);
    else atuais.add(nome);
    const tags = [...atuais].sort();
    definirRecorte(tags.length ? { ...recorte, tags } : { ...recorte, tags: undefined });
  };

  return (
    <div
      onClick={fecharDrawer}
      className="sem-impressao"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(25,27,35,0.42)',
        zIndex: 50,
        display: 'flex',
      }}
    >
      <aside
        onClick={(evento) => evento.stopPropagation()}
        style={{
          width: 312,
          background: 'var(--branco)',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--sh-drawer)',
        }}
      >
        <header
          style={{
            padding: '18px 20px',
            borderBottom: '1px solid var(--borda)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h2 style={{ fontSize: 17 }}>Filtros</h2>
            <div style={{ fontSize: 12, color: 'var(--cinza-2)' }}>
              {filtrosAtivos === 0
                ? 'Nenhum filtro aplicado'
                : `${filtrosAtivos} ${filtrosAtivos === 1 ? 'filtro ativo' : 'filtros ativos'}`}
            </div>
          </div>
          <button
            type="button"
            onClick={fecharDrawer}
            aria-label="Fechar filtros"
            style={{
              width: 32,
              height: 32,
              borderRadius: 'var(--r-btn)',
              border: '1px solid var(--borda-input)',
              background: 'var(--branco)',
              fontSize: 17,
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </header>

        <div
          className="rolagem-interna"
          style={{ flex: 1, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}
        >
          <Campo rotulo="Busca livre">
            <input
              style={estiloDeEntrada}
              value={recorte.q ?? ''}
              placeholder="pauta, veículo, pessoa…"
              onChange={(evento) => alterar('q', evento.target.value)}
            />
          </Campo>

          <Campo rotulo="Período">
            <select
              style={estiloDeEntrada}
              value={recorte.periodo ?? ''}
              onChange={(evento) => alterar('periodo', evento.target.value as AtalhoDePeriodo)}
            >
              <option value="">Todo o histórico</option>
              {Object.entries(ATALHOS_DE_PERIODO).map(([chave, rotulo]) => (
                <option key={chave} value={chave}>
                  {rotulo}
                </option>
              ))}
            </select>
          </Campo>

          <Campo rotulo="Frente">
            <select
              style={estiloDeEntrada}
              value={recorte.frente ?? ''}
              onChange={(evento) => alterar('frente', evento.target.value as Frente)}
            >
              <option value="">Todas</option>
              {FRENTES.map((frente) => (
                <option key={frente} value={frente}>
                  {ROTULOS_DE_FRENTE[frente]}
                </option>
              ))}
            </select>
          </Campo>

          <SeletorDeDicionario
            rotulo="Esfera"
            valor={recorte.esfera}
            itens={catalogo?.dicionarios.esferas ?? []}
            aoMudar={(valor) => alterar('esfera', valor)}
          />

          <Campo rotulo="Relevância">
            <select
              style={estiloDeEntrada}
              value={recorte.tier ?? ''}
              onChange={(evento) =>
                alterar('tier', evento.target.value ? Number(evento.target.value) : '')
              }
            >
              <option value="">Todas</option>
              <option value="1">Tier 1</option>
              <option value="2">Tier 2</option>
              <option value="3">Tier 3</option>
            </select>
          </Campo>

          <SeletorDeDicionario
            rotulo="Clima"
            valor={recorte.clima}
            itens={catalogo?.dicionarios.climas ?? []}
            aoMudar={(valor) => alterar('clima', valor)}
          />

          <SeletorDeDicionario
            rotulo="Resultado"
            valor={recorte.resultado}
            itens={catalogo?.dicionarios.resultados ?? []}
            aoMudar={(valor) => alterar('resultado', valor)}
          />

          <Campo rotulo="Situação" dica="O grupo reúne os status equivalentes.">
            <select
              style={estiloDeEntrada}
              value={recorte.grupo ?? ''}
              onChange={(evento) => alterar('grupo', evento.target.value as GrupoDeStatus)}
            >
              <option value="">Todas</option>
              <option value="resolvido">Resolvidos</option>
              <option value="aberto">Em aberto</option>
              <option value="declinado">Declinados</option>
            </select>
          </Campo>

          <Campo rotulo="Unidade de negócio">
            <select
              style={estiloDeEntrada}
              value={recorte.unidade ?? ''}
              onChange={(evento) => alterar('unidade', evento.target.value)}
            >
              <option value="">Todas</option>
              {catalogo?.dicionarios.unidades_negocio.map((unidade) => (
                <option key={unidade.id} value={unidade.nome}>
                  {unidade.nome}
                </option>
              ))}
            </select>
          </Campo>

          <Campo rotulo="Veículo / órgão">
            <select
              style={estiloDeEntrada}
              value={recorte.entidade ?? ''}
              onChange={(evento) => alterar('entidade', evento.target.value)}
            >
              <option value="">Todos</option>
              {[...(catalogo?.instituicoes.values() ?? [])].map((instituicao) => (
                <option key={instituicao.id} value={instituicao.nome}>
                  {instituicao.nome}
                </option>
              ))}
            </select>
          </Campo>

          <SeletorDeDicionario
            rotulo="Tipo de investidor"
            valor={recorte.subtipo}
            itens={catalogo?.dicionarios.tipos_investidor ?? []}
            aoMudar={(valor) => alterar('subtipo', valor)}
          />

          <Campo rotulo="UF">
            <select
              style={estiloDeEntrada}
              value={recorte.uf ?? ''}
              onChange={(evento) => alterar('uf', evento.target.value)}
            >
              <option value="">Todas</option>
              <option value="NA">Nacional</option>
              <option value="IN">Internacional</option>
              {UFS.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </select>
          </Campo>

          <div>
            <span
              style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 500,
                color: 'var(--cinza-3)',
                marginBottom: 7,
              }}
            >
              Temas
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {catalogo?.dicionarios.temas.map((tema) => {
                const ativo = recorte.tags?.includes(tema.nome) ?? false;
                return (
                  <Chip
                    key={tema.id}
                    rotulo={tema.nome}
                    ativo={ativo}
                    fundo={ativo ? 'var(--azul-mar)' : 'var(--bg-trilho)'}
                    texto={ativo ? 'var(--branco)' : 'var(--cinza-3)'}
                    aoClicar={() => alternarTema(tema.nome)}
                  />
                );
              })}
            </div>
          </div>
        </div>

        <footer
          style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--borda)',
            display: 'flex',
            gap: 10,
          }}
        >
          <Botao aoClicar={limparRecorte} estilo={{ flex: 1 }}>
            Limpar
          </Botao>
          <Botao variante="primario" aoClicar={fecharDrawer} estilo={{ flex: 1 }}>
            Aplicar
          </Botao>
        </footer>
      </aside>
    </div>
  );
}

function SeletorDeDicionario({
  rotulo,
  valor,
  itens,
  aoMudar,
}: {
  rotulo: string;
  valor: string | undefined;
  itens: { codigo: string; nome: string }[];
  aoMudar: (valor: string) => void;
}) {
  return (
    <Campo rotulo={rotulo}>
      <select
        style={estiloDeEntrada}
        value={valor ?? ''}
        onChange={(evento) => aoMudar(evento.target.value)}
      >
        <option value="">Todos</option>
        {itens.map((item) => (
          <option key={item.codigo} value={item.codigo}>
            {item.nome}
          </option>
        ))}
      </select>
    </Campo>
  );
}

const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];
