/** O recorte, sempre à vista.
 *
 *  POR QUE SAIU DA GAVETA
 *  ----------------------
 *  Os filtros moravam num drawer. Num sistema em que várias telas compartilham
 *  o mesmo recorte, quem via uma queda não sabia se ela era do mês ou do filtro
 *  que pôs dez minutos antes. O contexto de tudo o que está na tela precisa
 *  estar NA tela.
 *
 *  Fichas removíveis, e não uma frase corrida: para desfazer um filtro era
 *  preciso abrir a gaveta e procurá-lo lá dentro.
 *
 *  E COPIAR O LINK MORA AQUI, ao lado do recorte, porque é o recorte que o
 *  link carrega: "manda esta leitura para a liderança" passou a ser um
 *  endereço, e não uma captura de tela.
 */

import { useState } from 'react';
import { usePainel } from '@/estado/painel';
import { Botao, Chip } from '@/componentes/basicos';
import { fichasDoRecorte, semOFiltro } from '@/dominio/resumo-do-recorte';
import { numero } from '@/dominio/formato';

export function BarraDeRecorte() {
  const { recorte, definirRecorte, limparRecorte, catalogo, total, abrirDrawer, atualizando } =
    usePainel();
  const [copiado, definirCopiado] = useState(false);

  const fichas = fichasDoRecorte(recorte, catalogo);

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
        marginBottom: 18,
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

      {fichas.length ? (
        fichas.map((ficha) => (
          <Chip
            key={`${ficha.campo}:${ficha.rotulo}`}
            rotulo={ficha.rotulo}
            ativo
            fundo="var(--branco)"
            texto="var(--cinza-3)"
            titulo={`Remover o filtro ${ficha.rotulo}`}
            aoClicar={() => definirRecorte(semOFiltro(recorte, ficha.campo))}
          />
        ))
      ) : (
        <span style={{ fontSize: 13, color: 'var(--cinza-2)' }}>
          Base completa, sem filtros
        </span>
      )}

      <span
        className="tabular"
        style={{ fontSize: 12, color: 'var(--cinza-2)', marginLeft: 4 }}
      >
        {atualizando ? 'atualizando…' : `${numero(total)} ${total === 1 ? 'agenda' : 'agendas'}`}
      </span>

      <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
        {fichas.length ? (
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
        <Botao aoClicar={abrirDrawer}>Filtros</Botao>
      </span>
    </div>
  );
}
