/** O recorte, sempre à vista.
 *
 *  POR QUE FORA DA GAVETA
 *  ----------------------
 *  Várias telas compartilham o mesmo recorte. Com os filtros num drawer, quem
 *  vê uma queda não sabe se ela é do mês ou do filtro que pôs dez minutos
 *  antes — o contexto de tudo o que está na tela precisa estar NA tela.
 *
 *  Fichas removíveis, e não uma frase corrida: desfazer um filtro é um clique
 *  na ficha, e não uma busca dentro de uma gaveta.
 *
 *  `PainelDeFiltros` (a seção "Filtros" com as pílulas) NÃO mora aqui dentro,
 *  de propósito: esta barra vive num `<header>` `position: sticky` em
 *  `Layout`, e um painel que expande e recolhe DENTRO de um elemento fixo no
 *  topo infla o próprio cabeçalho a cada clique — na tela toda, empurrando ou
 *  cobrindo o conteúdo abaixo. `Layout` monta os dois lado a lado, mas só a
 *  barra compacta entra no `<header>`; o painel expansível fica no fluxo
 *  normal da página, logo abaixo dele.
 */

import { usePainel } from '@/estado/painel';
import { Botao, Chip } from '@/componentes/basicos';
import { fichasDoRecorte, semOFiltro } from '@/dominio/resumo-do-recorte';
import { numero } from '@/dominio/formato';

export function BarraDeRecorte() {
  const { recorte, definirRecorte, limparRecorte, catalogo, total, atualizando } = usePainel();

  // `q` já tem campo próprio, sempre visível, logo abaixo — virar também uma
  // ficha aqui duplicaria o mesmo valor em dois lugares da barra.
  const fichas = fichasDoRecorte(recorte, catalogo).filter((ficha) => ficha.campo !== 'q');

  const alterarBusca = (valor: string) => {
    const proximo = { ...recorte };
    if (valor) proximo.q = valor;
    else delete proximo.q;
    definirRecorte(proximo);
  };

  return (
    <div
      className="sem-impressao"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap',
        padding: '10px 14px',
        background: 'var(--bg-trilho)',
        border: '1px solid var(--borda)',
        borderRadius: 'var(--r-card-int)',
        marginBottom: 0,
      }}
    >
      <span
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--cinza-2)',
        }}
      >
        Busca inteligente
      </span>

      <input
        value={recorte.q ?? ''}
        placeholder="Buscar por tema, pauta, área, frente, stakeholder, tier..."
        onChange={(evento) => alterarBusca(evento.target.value)}
        style={{
          height: 28,
          flex: '1 1 260px',
          minWidth: 200,
          padding: '0 10px',
          border: '1px solid var(--borda-input)',
          borderRadius: 'var(--r-btn)',
          background: 'var(--branco)',
          color: 'var(--cinza-4)',
          fontSize: 12.5,
        }}
      />

      {fichas.map((ficha) => (
        <Chip
          key={`${ficha.campo}:${ficha.rotulo}`}
          rotulo={ficha.rotulo}
          ativo
          fundo="var(--branco)"
          texto="var(--cinza-3)"
          titulo={`Remover o filtro ${ficha.rotulo}`}
          aoClicar={() => definirRecorte(semOFiltro(recorte, ficha.campo))}
        />
      ))}

      {!fichas.length && !recorte.q ? (
        <span style={{ fontSize: 13, color: 'var(--cinza-2)' }}>Base completa, sem filtros</span>
      ) : null}

      <span
        className="tabular"
        style={{ fontSize: 12, color: 'var(--cinza-2)', marginLeft: 4 }}
      >
        {atualizando ? 'atualizando…' : `${numero(total)} ${total === 1 ? 'interação' : 'interações'}`}
      </span>

      {fichas.length || recorte.q ? (
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <Botao variante="fantasma" aoClicar={limparRecorte}>
            Limpar
          </Botao>
        </span>
      ) : null}
    </div>
  );
}
