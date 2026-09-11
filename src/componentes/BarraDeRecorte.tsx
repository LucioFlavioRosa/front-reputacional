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
 *  E COPIAR O LINK MORA AQUI, ao lado do recorte, porque é o recorte que o
 *  link carrega: "manda esta leitura para a liderança" é um endereço, e não
 *  uma captura de tela.
 */

import { Fragment, useState } from 'react';
import { usePainel } from '@/estado/painel';
import { Botao, Chip } from '@/componentes/basicos';
import { PainelDeFiltros } from '@/componentes/PainelDeFiltros';
import { fichasDoRecorte, semOFiltro } from '@/dominio/resumo-do-recorte';
import { numero } from '@/dominio/formato';

export function BarraDeRecorte() {
  const { recorte, definirRecorte, limparRecorte, catalogo, total, atualizando } = usePainel();
  const [copiado, definirCopiado] = useState(false);

  // `q` já tem campo próprio, sempre visível, logo abaixo — virar também uma
  // ficha aqui duplicaria o mesmo valor em dois lugares da barra.
  const fichas = fichasDoRecorte(recorte, catalogo).filter((ficha) => ficha.campo !== 'q');

  const alterarBusca = (valor: string) => {
    const proximo = { ...recorte };
    if (valor) proximo.q = valor;
    else delete proximo.q;
    definirRecorte(proximo);
  };

  const copiar = async () => {
    try {
      // DA JANELA, e não do estado da navegação.
      //
      // MEDIDO: aplicar um filtro clicando num indicador troca a URL por
      // `replaceState`, dentro do provedor — e o hook de navegação não é
      // avisado. Copiando do estado, o link saía sem o filtro que a pessoa
      // acabara de aplicar: a URL na barra dizia `?tier=1` e a área de
      // transferência levava `/painel`.
      await navigator.clipboard.writeText(window.location.href);
      definirCopiado(true);
      window.setTimeout(() => definirCopiado(false), 2200);
    } catch {
      // Área de transferência negada pelo navegador — o endereço continua na
      // barra, e dizer "falhou" aqui não ajudaria em nada.
    }
  };

  return (
    <Fragment>
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
        marginBottom: 10,
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
        Recorte
      </span>

      <input
        value={recorte.q ?? ''}
        placeholder="Buscar pauta, instituição, pessoa…"
        onChange={(evento) => alterarBusca(evento.target.value)}
        style={{
          height: 28,
          width: 190,
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
        {atualizando ? 'atualizando…' : `${numero(total)} ${total === 1 ? 'agenda' : 'agendas'}`}
      </span>

      <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
        {fichas.length || recorte.q ? (
          <Botao variante="fantasma" aoClicar={limparRecorte}>
            Limpar
          </Botao>
        ) : null}
        <Botao
          variante="fantasma"
          aoClicar={copiar}
          titulo="Copia o endereço desta tela com o recorte aplicado"
        >
          {copiado ? 'Link copiado' : 'Copiar link'}
        </Botao>
      </span>
    </div>

    <PainelDeFiltros />
    </Fragment>
  );
}
