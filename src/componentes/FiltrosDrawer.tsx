/** Barra lateral de filtros — 312px, sobre um scrim que fecha ao clicar fora.
 *
 *  Os filtros da tela, na ordem em que o handoff os lista. Cada campo
 *  produz um Recorte novo; nenhum deles troca de aba.
 *
 *  NENHUMA LISTA DE OPÇÃO MORA NESTE ARQUIVO.
 *
 *  Todas saem de `catalogo.dicionarios`, que vem de `GET /api/dicionarios` —
 *  frentes, relevâncias, esferas, climas, resultados, situações, unidades,
 *  instituições, tipos de investidor, UFs e temas. Uma linha nova num
 *  dicionário do banco aparece aqui na próxima carga da tela, sem build e sem
 *  deploy.
 *
 *  Isso já foi diferente, e o preço apareceu: as opções de relevância estavam
 *  escritas aqui como Tier 1, 2 e 3; o schema tinha `check between 1 and 3`; e
 *  o domínio Python tinha `not in (1, 2, 3)` em DOIS módulos. Quatro cópias da
 *  mesma lista. Registrar um Tier 4 era impossível, e nenhuma das quatro dizia
 *  por quê — a quarta só apareceu quando as outras três já tinham sido
 *  corrigidas e o erro continuou saindo igual.
 *
 *  As duas exceções são deliberadas, e nenhuma é vocabulário: a BUSCA LIVRE, que
 *  é texto digitado, e o PERÍODO, que são atalhos de intervalo de datas
 *  ("últimos 30 dias") calculados no cliente — não existem como linha em lugar
 *  nenhum.
 */

import { usePainel } from '@/estado/painel';
import { ATALHOS_DE_PERIODO } from '@/dominio/recorte';
import type { AtalhoDePeriodo, Recorte } from '@/dominio/recorte';
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

  //: Os temas já escolhidos, e os que sobraram para oferecer.
  //
  // O dropdown não repete o que já está escolhido: reoferecer um tema que já
  // está no filtro faria o clique REMOVÊ-lo, que é o contrário do que a lista
  // "Acrescentar tema…" promete.
  const escolhidos = recorte.tags ?? [];
  const naoEscolhidos = (catalogo?.dicionarios.temas ?? []).filter(
    (tema) => !escolhidos.includes(tema.nome),
  );

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
              {catalogo?.dicionarios.frentes.map((frente) => (
                <option key={frente.id} value={frente.codigo}>
                  {frente.nome}
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
              {catalogo?.dicionarios.relevancias.map((nivel) => (
                <option key={nivel.id} value={nivel.id}>
                  {nivel.nome}
                </option>
              ))}
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
              {catalogo?.dicionarios.grupos_de_status.map((grupo) => (
                <option key={grupo.codigo} value={grupo.codigo}>
                  {grupo.nome}
                </option>
              ))}
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
              {catalogo?.dicionarios.ufs.map((abrangencia) => (
                <option key={abrangencia.codigo} value={abrangencia.codigo}>
                  {abrangencia.nome}
                </option>
              ))}
            </select>
          </Campo>

          {/* Dropdown, e não a lista inteira de chips: os temas passam de trinta,
              e como grade eles empurravam os campos seguintes para fora da tela.

              Continua sendo MÚLTIPLA escolha — o backend faz OR entre os temas,
              e perder isso tiraria do painel a pergunta "tarifa OU regulação".
              O dropdown acrescenta um por vez e volta para o vazio; os
              escolhidos ficam abaixo, como chips que se removem no clique. */}
          <Campo rotulo="Temas" dica="Escolha quantos quiser. O filtro traz quem tiver qualquer um deles.">
            <select
              style={estiloDeEntrada}
              value=""
              onChange={(evento) => {
                if (evento.target.value) alternarTema(evento.target.value);
              }}
            >
              <option value="">
                {escolhidos.length ? 'Acrescentar tema…' : 'Todos'}
              </option>
              {naoEscolhidos.map((tema) => (
                <option key={tema.id} value={tema.nome}>
                  {tema.nome}
                </option>
              ))}
            </select>

          </Campo>

          {/* Os chips ficam FORA do `Campo`, e não dentro.
              `Campo` embrulha os filhos num `<label>`, e um `<button>` dentro de
              label faz o clique no chip cair também no `<select>` associado —
              remover um tema abriria o dropdown junto. */}
          {escolhidos.length ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: -8 }}>
              {escolhidos.map((nome) => (
                <Chip
                  key={nome}
                  // Sem `✕` no rótulo: `Chip` já acrescenta um quando `ativo`.
                  rotulo={nome}
                  titulo={`Tirar ${nome} do filtro`}
                  ativo
                  fundo="var(--azul-mar)"
                  texto="var(--branco)"
                  aoClicar={() => alternarTema(nome)}
                />
              ))}
            </div>
          ) : null}
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

// As 27 UFs estavam escritas aqui. Saíram: agora vêm de
// `catalogo.dicionarios.ufs`, montado a partir do domínio `abrangencia` do
// Postgres — que é quem de fato recusa uma UF inválida na escrita.
//
// Não é preciosismo sobre onde mora a lista dos estados brasileiros, que não
// mudam. É que `abrangencia` também aceita `NA` e `IN`, e ESSES são decisão do
// produto: se um terceiro valor entrar no domínio, o filtro passa a oferecê-lo
// sozinho, em vez de o registro existir sem ninguém conseguir encontrá-lo.
