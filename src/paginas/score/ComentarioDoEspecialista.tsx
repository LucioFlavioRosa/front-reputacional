/** O comentário do especialista, mês a mês.
 *
 *  O QUE O NÚMERO NÃO DIZ. A jornada já mostra o tema que mais pesou — quanto
 *  cada assunto custou ou rendeu em pontos do índice. O que ela não sabe é
 *  POR QUE aquilo aconteceu: "o atraso das demonstrações financeiras", "o
 *  aporte anunciado na Brazil Week". Isso não se deriva de menção nenhuma; é
 *  leitura de quem acompanha o assunto.
 *
 *  E É POR ISSO QUE O CADASTRO EXISTE. A rota já existia desde o começo do
 *  Score, e nenhuma tela a chamava: o campo estava lá, vazio, e a coluna do
 *  mês repetia "sem fato registrado" dez vezes. O recurso estava pronto e sem
 *  porta de entrada.
 *
 *  VÁRIOS POR MÊS, de propósito. A curva de março não se explica só pelo
 *  atraso das demonstrações; obrigar a escolher um faria o segundo motivo
 *  sumir do painel, e é justamente o segundo que costuma explicar o resto do
 *  degrau.
 *
 *  O EFEITO NÃO É DECORAÇÃO: ele pinta o filete da coluna e a etiqueta do
 *  ponto na jornada, e é o mesmo vocabulário que o tema derivado usa —
 *  `sustenta`, `pressiona`, `misto`. Quem lê a coluna não precisa saber qual
 *  linha veio de gente e qual veio da conta para entender o sinal.
 */

import { useEffect, useState } from 'react';

import {
  criarFatoDoScore,
  obterSerieDoScore,
  removerFatoDoScore,
} from '@/api/cliente';
import {
  Botao,
  Campo,
  Cartao,
  Carregando,
  Chip,
  FaixaDeErro,
  Secao,
  Vazio,
  estiloDeEntrada,
} from '@/componentes/basicos';
import { mesPorExtenso } from '@/dominio/jornadaDoIndice';
import { COR_DO_EFEITO, ROTULO_DO_EFEITO } from '@/dominio/score';
import type { PontoDaSerie } from '@/dominio/score';

const EFEITOS = ['sustenta', 'pressiona', 'misto'] as const;

export function ComentarioDoEspecialista({ mes }: { mes: string }) {
  const [serie, definirSerie] = useState<PontoDaSerie[] | null>(null);
  const [erro, definirErro] = useState<string | null>(null);
  const [salvando, definirSalvando] = useState(false);
  const [emQualMes, definirEmQualMes] = useState(mes);
  const [texto, definirTexto] = useState('');
  const [efeito, definirEfeito] = useState<string>('misto');

  async function recarregar() {
    try {
      definirSerie(await obterSerieDoScore());
      definirErro(null);
    } catch (falha) {
      definirErro(falha instanceof Error ? falha.message : 'Não foi possível ler.');
    }
  }

  useEffect(() => {
    void recarregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function executar(acao: () => Promise<unknown>) {
    definirSalvando(true);
    definirErro(null);
    try {
      await acao();
      await recarregar();
    } catch (falha) {
      definirErro(falha instanceof Error ? falha.message : 'Não foi possível gravar.');
    } finally {
      definirSalvando(false);
    }
  }

  if (!serie) return <Carregando rotulo="Carregando os meses…" />;

  const comIndice = serie.filter((ponto) => ponto.isr !== null);
  const podeGravar = Boolean(texto.trim()) && Boolean(emQualMes);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {erro ? <FaixaDeErro mensagem={erro} /> : null}

      <Secao
        titulo="Escrever um comentário"
        subtitulo="O que explica o mês, e que o número sozinho não conta. Ele aparece na coluna daquele mês, na Jornada do índice."
      >
        <Cartao>
          <div className="grade grade--2" style={{ gap: 16, alignItems: 'start' }}>
            <Campo rotulo="Mês" obrigatorio>
              <select
                style={estiloDeEntrada}
                value={emQualMes}
                disabled={salvando}
                onChange={(evento) => definirEmQualMes(evento.target.value)}
              >
                {comIndice.map((ponto) => (
                  <option key={ponto.mes} value={ponto.mes}>
                    {mesPorExtenso(ponto.mes)} de {ponto.mes.slice(0, 4)} · índice{' '}
                    {ponto.isr}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo
              rotulo="Efeito"
              dica="Pinta o filete da coluna e a etiqueta do ponto no gráfico."
            >
              <select
                style={estiloDeEntrada}
                value={efeito}
                disabled={salvando}
                onChange={(evento) => definirEfeito(evento.target.value)}
              >
                {EFEITOS.map((opcao) => (
                  <option key={opcao} value={opcao}>
                    {ROTULO_DO_EFEITO[opcao]}
                  </option>
                ))}
              </select>
            </Campo>
          </div>

          <div style={{ marginTop: 16 }}>
            <Campo
              rotulo="Comentário"
              dica="Uma frase. A coluna do mês tem espaço para poucas linhas, e o que não couber ali não será lido."
              obrigatorio
            >
              <textarea
                style={{ ...estiloDeEntrada, height: 76, padding: 10, resize: 'vertical' }}
                value={texto}
                disabled={salvando}
                placeholder="Atraso e revisão das demonstrações financeiras"
                onChange={(evento) => definirTexto(evento.target.value)}
              />
            </Campo>
          </div>

          <div style={{ marginTop: 14 }}>
            <Botao
              desabilitado={!podeGravar || salvando}
              aoClicar={() =>
                void executar(async () => {
                  await criarFatoDoScore({ mes: emQualMes, texto: texto.trim(), efeito });
                  definirTexto('');
                })
              }
            >
              {salvando ? 'Gravando…' : 'Gravar comentário'}
            </Botao>
          </div>
        </Cartao>
      </Secao>

      <Secao
        titulo="Comentários já escritos"
        subtitulo="Do mês mais recente para o mais antigo. Um mês pode ter vários."
      >
        {comIndice.some((ponto) => ponto.fatos.length) ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[...comIndice]
              .reverse()
              .filter((ponto) => ponto.fatos.length)
              .map((ponto) => (
                <Cartao key={ponto.mes}>
                  <p className="kicker" style={{ margin: '0 0 10px' }}>
                    {mesPorExtenso(ponto.mes)} de {ponto.mes.slice(0, 4)}
                  </p>
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {ponto.fatos.map((fato) => (
                      <li
                        key={fato.id}
                        style={{
                          display: 'flex',
                          gap: 12,
                          alignItems: 'baseline',
                          padding: '10px 0',
                          borderTop: '1px solid var(--borda)',
                        }}
                      >
                        <Chip
                          rotulo={ROTULO_DO_EFEITO[fato.efeito] ?? fato.efeito}
                          texto={COR_DO_EFEITO[fato.efeito]}
                        />
                        <span style={{ flex: 1, fontSize: 13.5, lineHeight: 1.55 }}>
                          {fato.texto}
                        </span>
                        <Botao
                          variante="fantasma"
                          desabilitado={salvando}
                          aoClicar={() => void executar(() => removerFatoDoScore(fato.id))}
                        >
                          Remover
                        </Botao>
                      </li>
                    ))}
                  </ul>
                </Cartao>
              ))}
          </div>
        ) : (
          <Vazio
            mensagem="Nenhum comentário escrito"
            dica="É o que transforma a curva em explicação — “caiu em março porque saíram as demonstrações financeiras”."
          />
        )}
      </Secao>
    </div>
  );
}
