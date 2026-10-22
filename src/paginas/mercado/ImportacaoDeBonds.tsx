/** A aba de importação do Painel de Inteligência de Mercado.
 *
 *  REAPROVEITA O QUE A SUBIDA DO SCORE JÁ RESOLVEU, e não só os componentes:
 *
 *    `CampoDeArquivo`   o seletor, com o nome do arquivo e o `ref` para limpar
 *                       o `<input>` nativo depois de gravar
 *    `Botao`, `Cartao`  a moldura e os dois botões, nas mesmas variantes
 *    `FaixaDeErro`      a faixa que mostra a recusa do servidor
 *    `requisitar`       o transporte: manda o `X-CSRF-Token`, esquece o cache
 *                       depois da escrita, e traduz falha de upload em frase
 *
 *  E REAPROVEITA A FORMA, que é o que mais importa: CONFERIR, mostrar a conta,
 *  e só então gravar. A razão está escrita na importação de agendas —
 *  "importação de planilha sem conferência humana cria duplicata em massa, e
 *  desfazer isso depois é pior que digitar de novo". Aqui o risco é outro e
 *  igualmente caro: uma planilha errada substitui a série que o gráfico desenha.
 *
 *  O QUE NÃO SE REAPROVEITA, e é medição: a subida EM PARTES. O limiar do front
 *  é 1.258.291 bytes e o export de bonds tem 1,05 MB, então ele cabe numa
 *  requisição. A montagem por partes é por FONTE DO SCORE e generalizá-la
 *  exigiria rota nova no servidor; o arquivo cresce ~3 KB por semana, o que põe
 *  a travessia do limiar a anos de distância.
 *
 *  A SUBIDA SEMANAL É UM `upsert`. O arquivo é CUMULATIVO — o de hoje traz as
 *  1.750 datas desde 2022 —, então a conferência mostra quase tudo como
 *  "atualizar". É esse número que diz, antes de clicar, que subir de novo é
 *  inofensivo: a tela não pede que a pessoa confie, ela mostra.
 */

import { useRef, useState } from 'react';

import {
  conferirPlanilhaDeBonds,
  importarPlanilhaDeBonds,
} from '@/api/cliente';
import type { ConferenciaDeBonds, ImportacaoDeBonds as Resultado } from '@/api/cliente';
import { Botao, CampoDeArquivo, Cartao, FaixaDeErro, Secao } from '@/componentes/basicos';
import { numero } from '@/dominio/formato';

function dataLegivel(iso: string | null): string {
  if (!iso) return '—';
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

/** Uma lista do que NÃO vai entrar. Some quando está vazia.
 *
 *  QUATRO LISTAS SEPARADAS, e não uma de "problemas": cada uma pede uma decisão
 *  diferente de quem lê. Ticker fora do cadastro pede uma linha em `bond`;
 *  papel sem valor nenhum é informação sobre a planilha; rótulo ignorado quer
 *  dizer que a coluna mudou de nome na origem; par repetido é erro de montagem
 *  do arquivo. Juntá-las esconderia qual é qual.
 */
function ListaDoQueFica({
  titulo,
  explicacao,
  itens,
}: {
  titulo: string;
  explicacao: string;
  itens: string[];
}) {
  if (!itens.length) return null;
  return (
    <div style={{ marginTop: 12 }}>
      <p style={{ fontSize: 12, fontWeight: 600, margin: '0 0 2px' }}>
        {titulo} ({numero(itens.length)})
      </p>
      <p style={{ fontSize: 11, color: 'var(--cinza-2)', margin: '0 0 4px' }}>{explicacao}</p>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--cinza-3)' }}>
        {itens.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function ImportacaoDeBonds() {
  const [arquivo, definirArquivo] = useState<File | null>(null);
  const [conferencia, definirConferencia] = useState<ConferenciaDeBonds | null>(null);
  const [resultado, definirResultado] = useState<Resultado | null>(null);
  const [erro, definirErro] = useState<string | null>(null);
  const [ocupado, definirOcupado] = useState(false);
  //: O IDENTIFICADOR DA SUBIDA EM PARTES, quando houve uma. Nulo para arquivo
  //: pequeno e para ambiente sem armazenamento — nos dois casos a importação
  //: reenvia os bytes, como sempre fez.
  const [subidaId, definirSubidaId] = useState<string | null>(null);
  const [progresso, definirProgresso] = useState<{ enviadas: number; total: number } | null>(
    null,
  );
  const entrada = useRef<HTMLInputElement | null>(null);

  const limpar = () => {
    definirConferencia(null);
    definirResultado(null);
    definirErro(null);
    definirArquivo(null);
    //: O IDENTIFICADOR SAI JUNTO. Sem isto, trocar de arquivo e importar
    //: gravaria o export ANTERIOR — o que subiu em partes — com a tela
    //: mostrando o nome do novo.
    definirSubidaId(null);
    definirProgresso(null);
    //: O `<input type="file">` É NÃO CONTROLADO: sem isto o navegador continua
    //: mostrando o nome do arquivo anterior ao reabrir o seletor. Mesmo motivo
    //: pelo qual `CampoDeArquivo` aceita um `ref`.
    if (entrada.current) entrada.current.value = '';
  };

  const conferir = () => {
    if (!arquivo) return;
    definirOcupado(true);
    definirErro(null);
    definirResultado(null);
    definirProgresso(null);
    conferirPlanilhaDeBonds(arquivo, (enviadas, total) =>
      //: O PROGRESSO NÃO É ENFEITE: um export grande sobe em várias
      //: requisições, e uma tela parada por minutos se lê como travada. Foi
      //: assim que o defeito do Score apareceu para quem usava — "está
      //: demorando", sem erro nenhum.
      definirProgresso({ enviadas, total }),
    )
      .then((feita) => {
        definirConferencia(feita.conferencia);
        //: GUARDA O IDENTIFICADOR para a importação ler o arquivo que já subiu
        //: em vez de mandá-lo de novo. Nulo quando foi de uma vez só.
        definirSubidaId(feita.subidaId);
      })
      .catch((falha: unknown) =>
        definirErro(falha instanceof Error ? falha.message : 'Não foi possível ler a planilha.'),
      )
      .finally(() => {
        definirOcupado(false);
        definirProgresso(null);
      });
  };

  const importar = () => {
    if (!arquivo) return;
    definirOcupado(true);
    definirErro(null);
    importarPlanilhaDeBonds(arquivo, subidaId)
      .then((feito) => {
        definirResultado(feito);
        definirConferencia(null);
        //: O ARQUIVO SAI DA TELA depois de gravar, para o botão de subir não
        //: ficar oferecendo a mesma planilha de novo como se faltasse algo.
        definirArquivo(null);
        //: E O IDENTIFICADOR TAMBÉM: o servidor já descartou a linha e o byte
        //: depois de gravar. Mantê-lo faria o próximo "Subir" apontar para um
        //: arquivo que não existe mais.
        definirSubidaId(null);
        if (entrada.current) entrada.current.value = '';
      })
      .catch((falha: unknown) =>
        definirErro(falha instanceof Error ? falha.message : 'Não foi possível gravar.'),
      )
      .finally(() => definirOcupado(false));
  };

  return (
    <section style={{ maxWidth: 1440, margin: '0 auto', padding: '0 16px' }}>
      <Secao titulo="Cotação dos bonds">
        <Cartao>
          <p style={{ fontSize: 13, color: 'var(--cinza-3)', margin: '0 0 12px' }}>
            O export de preço e yield dos papéis acompanhados. A planilha é
            cumulativa — subir a versão da semana <strong>atualiza</strong> os
            pregões que já estão na base e acrescenta os novos. Subir o mesmo
            arquivo duas vezes não duplica nada.
          </p>

          <div style={{ display: 'grid', gap: 5, maxWidth: 520 }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>1. A planilha</span>
            <CampoDeArquivo
              valor={arquivo}
              desabilitado={ocupado}
              aceitar=".xlsx"
              ariaLabel="Planilha de cotação dos bonds"
              entradaRef={entrada}
              aoEscolher={(escolhido) => {
                definirArquivo(escolhido);
                //: TROCAR O ARQUIVO DESCARTA A CONFERÊNCIA ANTERIOR. Sem isto, a
                //: conta na tela passaria a descrever um arquivo que não é o
                //: que o botão vai subir — e seria impossível notar.
                definirConferencia(null);
                definirResultado(null);
                definirErro(null);
                //: E O IDENTIFICADOR DA SUBIDA ANTERIOR, pelo mesmo motivo —
                //: senão "Subir" gravaria o export antigo com o nome do novo
                //: na tela.
                definirSubidaId(null);
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <Botao
              variante="secundario"
              aoClicar={conferir}
              desabilitado={ocupado || !arquivo}
            >
              {ocupado && !conferencia
                ? progresso
                  ? //: O NÚMERO DA PARTE, e não um "Lendo…" parado. Um export
                    //: grande sobe em várias requisições e pode levar minutos;
                    //: sem isto a tela parece travada, que foi exatamente como
                    //: o defeito do Score apareceu para quem usava.
                    `Subindo ${progresso.enviadas} de ${progresso.total}…`
                  : 'Lendo…'
                : '2. Conferir antes de subir'}
            </Botao>
            {conferencia ? (
              <Botao variante="fantasma" aoClicar={limpar} desabilitado={ocupado}>
                Cancelar
              </Botao>
            ) : null}
          </div>

          {/* O PROGRESSO TAMBÉM FORA DO BOTÃO, e isto é achado de revisão de
              acessibilidade: o texto do botão muda a cada parte, mas o botão
              fica DESABILITADO enquanto sobe — e leitor de tela não anuncia
              mudança em elemento desabilitado de forma confiável. Numa subida
              de minutos, quem não vê a tela ficaria sem nenhum sinal de que
              algo acontece.

              `aria-live="polite"`: avisa entre uma frase e outra, sem
              interromper o que está sendo lido. Onze anúncios atropelando a
              leitura seriam piores que nenhum. */}
          {progresso ? (
            <p
              role="status"
              aria-live="polite"
              style={{ fontSize: 12, color: 'var(--cinza-3)', margin: '10px 0 0' }}
            >
              Subindo a planilha: parte {progresso.enviadas} de {progresso.total}.
            </p>
          ) : null}

          {erro ? (
            <div style={{ marginTop: 14 }}>
              <FaixaDeErro mensagem={erro} />
            </div>
          ) : null}

          {resultado ? (
            <div
              role="status"
              style={{
                marginTop: 14,
                padding: 12,
                borderRadius: 'var(--r-card-int)',
                background: 'var(--ok-bg)',
                color: 'var(--ok-fg)',
                fontSize: 13,
              }}
            >
              {/* OS TRÊS NÚMEROS SEPARADOS, e não um total: "33.294 cotações
                  gravadas" não distingue a primeira carga de uma recarga do
                  mesmo arquivo — e é essa diferença que diz se a subida da
                  semana trouxe dado novo. */}
              {numero(resultado.inseridas)} cotações novas,{' '}
              {numero(resultado.atualizadas)} atualizadas
              {resultado.papeis_completados
                ? `, e ${numero(resultado.papeis_completados)} papéis com o cadastro completado`
                : ''}
              .
            </div>
          ) : null}
        </Cartao>
      </Secao>

      {conferencia ? (
        <Secao titulo="O que esta subida faria">
          <Cartao>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: 12,
              }}
            >
              <Numero rotulo="Período" valor={`${dataLegivel(conferencia.primeira_data)} a ${dataLegivel(conferencia.ultima_data)}`} />
              <Numero rotulo="Cotações no arquivo" valor={numero(conferencia.cotacoes_no_arquivo)} />
              <Numero rotulo="A inserir" valor={numero(conferencia.a_inserir)} />
              <Numero rotulo="A atualizar" valor={numero(conferencia.a_atualizar)} />
              <Numero
                rotulo="Papéis alimentados"
                valor={numero(Object.keys(conferencia.por_ticker).length)}
              />
            </div>

            <ListaDoQueFica
              titulo="Ficam de fora: papel que o cadastro não tem"
              explicacao="O cadastro é a autoridade — a subida não inventa papel. Um bond novo emitido pede uma linha no cadastro de bonds."
              itens={conferencia.tickers_desconhecidos}
            />
            <ListaDoQueFica
              titulo="Sem valor nenhum na planilha"
              explicacao="O papel está no arquivo e todas as células dele estão vazias ou em zero. Não é erro: é o que a origem trouxe."
              itens={conferencia.tickers_sem_valor}
            />
            <ListaDoQueFica
              titulo="Colunas de rótulo desconhecido"
              explicacao="A coluna existe e o leitor não sabe o que ela mede — provavelmente o nome mudou na origem. Ela é ignorada, e é por isso que aparece aqui."
              itens={conferencia.rotulos_ignorados.map(([t, r]) => `${t} — coluna "${r}"`)}
            />
            <ListaDoQueFica
              titulo="O mesmo papel e medida em duas colunas"
              explicacao="A primeira coluna vence. Duas colunas para a mesma coisa costuma ser erro de montagem do arquivo."
              itens={conferencia.pares_repetidos.map(([t, m]) => `${t} — ${m}`)}
            />

            {conferencia.linha_que_encerrou ? (
              <p style={{ fontSize: 12, color: 'var(--atencao-fg)', marginTop: 12 }}>
                {/* ONDE A LEITURA PAROU. O rodapé em branco do Excel é normal e
                    não aparece aqui; uma linha COM conteúdo e sem data no meio
                    da série significa que o formato mudou, e aí o que vem
                    depois não foi lido. */}
                A leitura parou na linha {numero(conferencia.linha_que_encerrou)}: ela
                tem conteúdo e não tem data. O que vem depois dela não entra.
              </p>
            ) : null}

            <div
              style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}
            >
              <Botao variante="fantasma" aoClicar={limpar} desabilitado={ocupado}>
                Cancelar
              </Botao>
              <Botao variante="primario" aoClicar={importar} desabilitado={ocupado}>
                {/* O RÓTULO DIZ AS DUAS COISAS QUE VÃO ACONTECER, como o do
                    Score: inserir e atualizar são operações diferentes, e um
                    "Confirmar" sozinho esconderia a segunda. */}
                {ocupado
                  ? 'Subindo…'
                  : `Subir ${numero(conferencia.a_inserir)} novas e atualizar ${numero(conferencia.a_atualizar)}`}
              </Botao>
            </div>
          </Cartao>
        </Secao>
      ) : null}
    </section>
  );
}

function Numero({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <p style={{ fontSize: 11, color: 'var(--cinza-2)', margin: 0 }}>{rotulo}</p>
      <p
        style={{
          fontSize: 18,
          fontWeight: 700,
          margin: 0,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {valor}
      </p>
    </div>
  );
}
