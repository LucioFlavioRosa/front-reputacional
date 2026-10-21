/** Os registros de um grupo do quadro da janela — o que abre ao clicar nele.
 *
 *  O PEDIDO: "se eu clicar em alguma dessas opções quero que abra um modal com
 *  os registros do tema ou pilar, assim como fazemos nas lentes no KPI
 *  reputacional".
 *
 *  AS TRÊS LENTES DE CLIPPING, desde 21/10/2026 ("quero adicionar os registros
 *  de mercado e institucional também"). A rota reusa o recorte exato da janela
 *  — mesma régua de datas, mesma exclusão das menções sem data, mesmas fontes
 *  ligadas, grupo por id — e amplia só a lente. Reusar a rota da Base das
 *  lentes (que já lista menção por período e por tema) traria linhas que o
 *  quadro excluiu, e a lista discordaria do número que está ao lado dela.
 *
 *  O TOTAL DEIXOU DE SER O NÚMERO DA LINHA DO QUADRO, e o cabeçalho diz isso em
 *  vez de repetir aquele número. Era uma igualdade que eu construí e testei
 *  quando este modal nasceu; ela cai junto com a premissa de uma lente só, e
 *  fingir que continua valendo seria pior do que perdê-la: o quadro mede a
 *  IMPRENSA e esta lista mostra o tema nas três.
 *
 *  SEIS COLUNAS: data, veículo, título com link, sentimento, tier e A LENTE.
 *  A coluna da lente foi pedida junto, e é ela que explica por que uma matéria
 *  aparece aqui e não entrou na conta da linha clicada. A Base de dados tem
 *  mais colunas — concessionária, UF, autor, subtema —, e aqui elas seriam
 *  ruído: quem clica num tema quer ver QUAIS matérias são, não reabrir a Base
 *  dentro de um modal.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  obterRegistrosDaJanela,
  type GrupoNaJanela,
  type NivelDaJanela,
  type RegistrosDaJanela as Pagina,
} from '@/api/cliente';
import { Carregando, FaixaDeErro, Modal } from '@/componentes/basicos';
import { Paginacao } from '@/componentes/Paginacao';
import { numero } from '@/dominio/formato';

/** `2026-05-20` como `20/05`. O ano está no cabeçalho da janela; repeti-lo em
 *  cada linha de uma lista de quinze dias é ruído. */
function diaEMes(iso: string): string {
  const [, mes, dia] = iso.split('-');
  return `${dia}/${mes}`;
}

/** "em 2 lentes", quando a PÁGINA mostra mais de uma.
 *
 *  DA PÁGINA, E NÃO DO TOTAL, porque é o que esta tela sabe: o servidor manda
 *  50 registros por vez e não um resumo por lente. Dizer "em 3 lentes" com
 *  base numa página que só tem duas seria afirmar o que não se mediu — e o
 *  cabeçalho é justamente onde alguém confere se a lista é o que ele pensa.
 *
 *  VAZIO COM UMA LENTE SÓ: "28 registros em 1 lente" não informa nada que o
 *  número já não diga. */
function lentesNaLista(pagina: Pagina): string {
  const quantas = new Set(pagina.itens.map((item) => item.lente)).size;
  return quantas > 1 ? `${quantas} lentes` : '';
}

/** O sentimento como a plataforma o escreve. O código cru (`pos`) aparece na
 *  Base de dados porque lá ele é filtro; aqui é leitura. */
const ROTULO_DO_SENTIMENTO: Record<string, string> = {
  pos: 'Propositiva',
  neg: 'Reativa',
  neu: 'Neutra',
};

/** O tier como a plataforma o escreve, e o código cru quando não o conhecemos —
 *  um tier novo aparece na tela no dia em que chega, e não no dia em que alguém
 *  se lembra de cadastrá-lo aqui. */
const ROTULO_DO_TIER: Record<string, string> = {
  muito_relevante: 'Tier 1',
  relevante: 'Tier 2',
  menos_relevante: 'Tier 3',
};

export function RegistrosDaJanela({
  grupo,
  ate,
  nivel,
  de,
  aoFechar,
}: {
  grupo: GrupoNaJanela;
  /** O dia clicado no gráfico e o nível do quadro: é com eles que o servidor
   *  reconstrói a MESMA janela que produziu o número. */
  ate: string;
  nivel: NivelDaJanela;
  /** Só para o cabeçalho dizer o período que a pessoa está olhando. */
  de: string;
  aoFechar: () => void;
}) {
  const [pagina, definirPagina] = useState(1);
  const [dados, definirDados] = useState<Pagina | null>(null);
  const [erro, definirErro] = useState('');

  //: VIVO E VERSÃO: duas guardas pequenas para duas corridas reais.
  //:
  //: `vivo` impede `setState` depois do desmonte — o modal fecha enquanto a
  //: leitura está no ar, e aviso no console atrapalha quem for depurar outra
  //: coisa.
  //:
  //: `versao` impede que uma leitura ANTIGA sobrescreva uma mais nova, e aqui
  //: isso é fácil de provocar: duas páginas seguidas na paginação disparam duas
  //: leituras, e quem termina por último vence. ACHADO DE REVISÃO — como a
  //: lista velha fica na tela enquanto a nova não chega (de propósito), a
  //: resposta atrasada da página 1 pousaria POR CIMA da página 2 e a tabela
  //: passaria a discordar do número da paginação logo abaixo dela.
  const vivo = useRef(true);
  const versao = useRef(0);
  useEffect(
    () => () => {
      vivo.current = false;
    },
    [],
  );

  const carregar = useCallback(() => {
    //: NÃO LIMPA O QUE JÁ ESTÁ NA TELA ao virar de página. Além de evitar o
    //: `setState` síncrono dentro do efeito (que o lint cobra e que dispara um
    //: render a mais), a lista antiga é melhor companhia que um vazio: a página
    //: 2 chega em milissegundos, e o pisca-pisca de uma tabela sumindo e
    //: voltando é pior que ela ficar parada por um instante.
    const minha = ++versao.current;
    obterRegistrosDaJanela(ate, grupo.id, nivel, pagina)
      .then((lida) => {
        if (!vivo.current || minha !== versao.current) return;
        definirDados(lida);
        definirErro('');
      })
      .catch((falha: Error) => {
        if (!vivo.current || minha !== versao.current) return;
        definirErro(falha.message);
      });
  }, [ate, grupo.id, nivel, pagina]);

  useEffect(carregar, [carregar]);

  const paginas = dados ? Math.max(1, Math.ceil(dados.total / dados.tamanho)) : 1;

  return (
    <Modal
      titulo={grupo.rotulo}
      subtitulo={
        //: O RECORTE NO CABEÇALHO, porque o modal é uma janela dentro de uma
        //: janela: sem as datas, a lista parece ser "todas as matérias deste
        //: tema" — e é só as de quinze dias.
        //:
        //: E O NÚMERO É O DESTA LISTA, dito como "em 3 lentes" — não mais o da
        //: linha do quadro. Enquanto o modal mostrava uma lente, os dois eram
        //: o mesmo número; agora ele mostra três, e repetir o número da linha
        //: seria afirmar uma igualdade que deixou de existir. Enquanto a
        //: leitura não chega, o cabeçalho não arrisca número nenhum.
        `${grupo.contexto ? `${grupo.contexto} · ` : ''}` +
        `${diaEMes(de)} a ${diaEMes(ate)}` +
        (dados
          ? ` · ${numero(dados.total)} ${dados.total === 1 ? 'registro' : 'registros'}` +
            `${lentesNaLista(dados) ? ` em ${lentesNaLista(dados)}` : ''}`
          : '')
      }
      largura={860}
      aoFechar={aoFechar}
    >
      {erro ? <FaixaDeErro mensagem={erro} /> : null}

      {!dados && !erro ? <Carregando rotulo="Lendo as menções…" /> : null}

      {dados && dados.itens.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--cinza-2)', margin: 0 }}>
          Nenhuma menção neste recorte.
        </p>
      ) : null}

      {dados && dados.itens.length > 0 ? (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--cinza-2)', fontSize: 12 }}>
              <th style={{ padding: '6px 8px 6px 0', whiteSpace: 'nowrap' }}>Data</th>
              {/* A LENTE VEM CEDO, ao lado da data: ela é o que a pessoa
                  procura quando estranha ver uma matéria aqui que não entrou
                  na conta da linha que ela clicou. No fim da linha, ela só
                  seria achada depois de a dúvida já ter nascido. */}
              <th style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>Lente</th>
              <th style={{ padding: '6px 8px' }}>Veículo</th>
              <th style={{ padding: '6px 8px' }}>Título</th>
              <th style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>Sentimento</th>
              <th style={{ padding: '6px 0 6px 8px', whiteSpace: 'nowrap' }}>Tier</th>
            </tr>
          </thead>
          <tbody>
            {dados.itens.map((registro) => (
              <tr key={registro.id} style={{ borderTop: '1px solid var(--borda)' }}>
                <td style={{ padding: '6px 8px 6px 0', whiteSpace: 'nowrap' }}>
                  {diaEMes(registro.data)}
                </td>
                <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
                  {/* O NOME VEM DO SERVIDOR, do cadastro das lentes. Um mapa
                      de nomes aqui seria uma segunda fonte do mesmo nome, e
                      duas fontes do mesmo nome só divergem calado. */}
                  <span
                    style={{
                      fontSize: 11,
                      padding: '2px 6px',
                      borderRadius: 'var(--r-chip)',
                      background: 'var(--bg-trilho)',
                      color: 'var(--cinza-3)',
                    }}
                  >
                    {registro.lente_nome}
                  </span>
                </td>
                <td style={{ padding: '6px 8px' }}>{registro.veiculo ?? '—'}</td>
                <td style={{ padding: '6px 8px' }}>
                  {/* O TÍTULO É O LINK quando há link, e texto quando não há.
                      O fornecedor manda o endereço só numa amostra das linhas,
                      e um link morto é pior que nenhum. */}
                  {registro.link ? (
                    <a href={registro.link} target="_blank" rel="noreferrer">
                      {registro.titulo ?? 'Abrir a matéria'}
                    </a>
                  ) : (
                    (registro.titulo ?? '—')
                  )}
                </td>
                <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
                  {ROTULO_DO_SENTIMENTO[registro.sentimento] ?? registro.sentimento}
                </td>
                <td style={{ padding: '6px 0 6px 8px', whiteSpace: 'nowrap' }}>
                  {registro.tier ? (ROTULO_DO_TIER[registro.tier] ?? registro.tier) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {dados && dados.total > dados.tamanho ? (
        <>
          <p style={{ margin: '12px 0 0', fontSize: 12, color: 'var(--cinza-2)' }}>
            {`Página ${dados.pagina} de ${paginas} — ${numero(dados.total)} menções.`}
          </p>
          <Paginacao
            pagina={dados.pagina}
            totalDePaginas={paginas}
            aoMudarPagina={definirPagina}
          />
        </>
      ) : null}
    </Modal>
  );
}
