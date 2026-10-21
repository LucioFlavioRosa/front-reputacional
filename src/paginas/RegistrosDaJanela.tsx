/** Os registros de um grupo do quadro da janela — o que abre ao clicar nele.
 *
 *  O PEDIDO: "se eu clicar em alguma dessas opções quero que abra um modal com
 *  os registros do tema ou pilar, assim como fazemos nas lentes no KPI
 *  reputacional".
 *
 *  O TOTAL DO MODAL É, POR CONSTRUÇÃO, O NÚMERO DO QUADRO. A rota que alimenta
 *  esta lista reusa o recorte exato da janela — mesma lente, mesma régua de
 *  datas, mesma exclusão das menções sem data, mesmas fontes ligadas, grupo por
 *  id. Reusar a rota da Base das lentes (que já lista menção por período e por
 *  tema) traria linhas que o quadro excluiu, e a lista discordaria do número
 *  que está ao lado dela na mesma tela.
 *
 *  CINCO COLUNAS, por decisão do dono do produto: data, veículo, título com
 *  link, sentimento e tier. A Base de dados tem mais — concessionária, UF,
 *  autor, subtema —, e aqui elas seriam ruído: quem clica num tema quer ver
 *  QUAIS matérias são, não reabrir a Base dentro de um modal.
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
  dias,
  aoFechar,
}: {
  grupo: GrupoNaJanela;
  /** O dia clicado no gráfico e o nível do quadro: é com eles que o servidor
   *  reconstrói a MESMA janela que produziu o número. */
  ate: string;
  nivel: NivelDaJanela;
  /** Só para o cabeçalho dizer o período que a pessoa está olhando. */
  de: string;
  /** Os dias da janela que produziu o número (o período do gráfico, até 90).
   *  Sem ele o servidor usaria o padrão de 15, e a lista não seria a do quadro. */
  dias?: number;
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
    //: OS DIAS SÓ VÃO QUANDO EXISTEM, para a chamada sem eles continuar a de
    //: sempre (o padrão do servidor).
    (dias === undefined
      ? obterRegistrosDaJanela(ate, grupo.id, nivel, pagina)
      : obterRegistrosDaJanela(ate, grupo.id, nivel, pagina, dias)
    )
      .then((lida) => {
        if (!vivo.current || minha !== versao.current) return;
        definirDados(lida);
        definirErro('');
      })
      .catch((falha: Error) => {
        if (!vivo.current || minha !== versao.current) return;
        definirErro(falha.message);
      });
  }, [ate, grupo.id, nivel, pagina, dias]);

  useEffect(carregar, [carregar]);

  const total = dados?.total ?? grupo.mencoes;
  const paginas = dados ? Math.max(1, Math.ceil(dados.total / dados.tamanho)) : 1;

  return (
    <Modal
      titulo={grupo.rotulo}
      subtitulo={
        //: O RECORTE NO CABEÇALHO, porque o modal é uma janela dentro de uma
        //: janela: sem as datas, a lista parece ser "todas as matérias deste
        //: tema" — e é só as de quinze dias.
        `${grupo.contexto ? `${grupo.contexto} · ` : ''}` +
        `${diaEMes(de)} a ${diaEMes(ate)} · ${numero(total)} ${
          total === 1 ? 'menção' : 'menções'
        }`
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
            {`Página ${dados.pagina} de ${paginas} · ${numero(dados.total)} menções.`}
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
