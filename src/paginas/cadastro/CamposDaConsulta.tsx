/** Os campos que só uma CONSULTA RECEBIDA tem.
 *
 *  Aparece quando o tipo de interação escolhido é "Consulta recebida" — o
 *  mesmo desenho de `CamposDaFrente`, com a diferença de que ali o gatilho é
 *  a frente e aqui é o tipo.
 *
 *  A ALEGAÇÃO SE CADASTRA AQUI, e não só na Administração. Ela NASCE deste
 *  gesto: quem lê o e-mail é quem reconhece a premissa, e mandar a pessoa
 *  sair para outra tela e voltar é o atrito que faz o campo ficar vazio — e
 *  um campo vazio aqui esvazia a aba inteira. Apurar continua sendo trabalho
 *  da área, na Administração.
 */

import { useState } from 'react';
import { criarAlegacao } from '@/api/cliente';
import { Ajuda, Botao, Campo, Chip, estiloDeEntrada } from '@/componentes/basicos';
import { CampoQueCompleta } from '@/componentes/CampoQueCompleta';
import { CampoDeTexto } from '@/paginas/cadastro/campos';
import type { Alegacao, Dicionarios } from '@/dominio/tipos';

export function CamposDaConsulta({
  canalId,
  remetente,
  teor,
  motivo,
  prazoResposta,
  respondidaEm,
  alegacoesMarcadas,
  alegacoes,
  dicionarios,
  aoMudar,
  aoMarcarAlegacoes,
  aoCadastrarAlegacao,
}: {
  canalId: string;
  remetente: string;
  teor: string;
  motivo: string;
  prazoResposta: string;
  respondidaEm: string;
  alegacoesMarcadas: string[];
  /** O catálogo traz ativas e inativas; aqui só se oferece o que está em uso. */
  alegacoes: Alegacao[];
  dicionarios: Dicionarios;
  aoMudar: (campo: string, valor: string) => void;
  aoMarcarAlegacoes: (ids: string[]) => void;
  /** Avisa quem carrega o catálogo que há uma alegação nova. */
  aoCadastrarAlegacao: (alegacao: Alegacao) => void;
}) {
  const [textoNovo, definirTextoNovo] = useState('');
  const [salvando, definirSalvando] = useState(false);
  const [erro, definirErro] = useState<string | null>(null);

  const disponiveis = alegacoes.filter((a) => a.ativo || alegacoesMarcadas.includes(a.id));

  const alternar = (id: string) =>
    aoMarcarAlegacoes(
      alegacoesMarcadas.includes(id)
        ? alegacoesMarcadas.filter((marcada) => marcada !== id)
        : [...alegacoesMarcadas, id],
    );

  async function cadastrar() {
    const texto = textoNovo.trim();
    if (!texto || salvando) return;
    definirSalvando(true);
    definirErro(null);
    try {
      const nova = await criarAlegacao({ texto, temas: [] });
      aoCadastrarAlegacao(nova);
      // JÁ MARCADA: quem acabou de escrever a premissa está dizendo que esta
      // consulta a trouxe. Cadastrar e ter de marcar depois é o mesmo atrito
      // em dois passos.
      aoMarcarAlegacoes([...alegacoesMarcadas, nova.id]);
      definirTextoNovo('');
    } catch (falha) {
      // A recusa mais comum é a alegação repetida (índice único sobre o texto
      // normalizado). Mostrar aqui, e não em cima, é o que faz a pessoa
      // entender que basta marcar a que já existe na lista.
      definirErro(falha instanceof Error ? falha.message : 'Não foi possível cadastrar.');
    } finally {
      definirSalvando(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="grade grade--3" style={{ gap: 14 }}>
        {/* Pelo ID, como esfera e unidade: é o id que o corpo leva. */}
        <CampoQueCompleta
          rotulo="Por onde chegou"
          ajuda="E-mail, ofício, ligação… o canal pelo qual o questionário chegou."
          valor={canalId}
          aoEscolher={(valor) => aoMudar('canal_id', valor)}
          opcoes={dicionarios.canais_consulta.map((canal) => ({
            valor: String(canal.id),
            rotulo: canal.nome,
          }))}
        />
        <Campo
          rotulo="Prazo para responder"
          ajuda="Até quando a Aegea precisa responder. Se não houver prazo, deixe em branco."
        >
          <input
            type="date"
            value={prazoResposta}
            onChange={(evento) => aoMudar('prazo_resposta', evento.target.value)}
            style={estiloDeEntrada}
          />
        </Campo>
        <Campo
          rotulo="Respondida em"
          ajuda="O dia em que a resposta saiu. Deixe em branco se ainda não respondeu."
        >
          <input
            type="date"
            value={respondidaEm}
            onChange={(evento) => aoMudar('respondida_em', evento.target.value)}
            style={estiloDeEntrada}
          />
        </Campo>
      </div>

      <CampoDeTexto
        rotulo="Quem assina"
        valor={remetente}
        aoMudar={(valor) => aoMudar('remetente', valor)}
        ajuda="Nome ou e-mail de quem mandou, quando não é um contato cadastrado."
      />

      <Campo
        rotulo="O que perguntaram"
        ajuda="Cole as perguntas do e-mail ou do ofício, do jeito que chegaram."
      >
        <textarea
          value={teor}
          onChange={(evento) => aoMudar('teor', evento.target.value)}
          rows={3}
          style={{ ...estiloDeEntrada, resize: 'vertical' }}
          placeholder="Cole as perguntas do e-mail."
        />
      </Campo>

      {/* A HIPÓTESE DE QUEM LEU, e por isso separada da alegação logo abaixo:
          a alegação é o que a pergunta DIZ e é o que a aba conta; o motivo é a
          intenção que se supõe. Juntá-los faria suposição ser apresentada com
          a mesma autoridade de um fato registrado. */}
      <Campo
        rotulo="Por que você acha que perguntaram"
        ajuda="A sua leitura: o que essa pessoa está tentando descobrir ou justificar."
      >
        <textarea
          value={motivo}
          onChange={(evento) => aoMudar('motivo', evento.target.value)}
          rows={2}
          style={{ ...estiloDeEntrada, resize: 'vertical' }}
          placeholder="Quer justificar revisão de spread; está montando relatório setorial…"
        />
      </Campo>

      <div>
        <p
          className="kicker"
          style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}
        >
          O que a pergunta dá como fato
          <Ajuda texto="A premissa, em uma frase, na voz de quem alega — é ela que se repete de um remetente para outro." />
        </p>
        <p style={{ fontSize: 12, color: 'var(--cinza-2)', margin: '0 0 8px' }}>
          A premissa, em uma frase, na voz de quem alega — é ela que se repete de
          um remetente para outro, e é contá-la que mostra o movimento.
        </p>

        {disponiveis.length ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {disponiveis.map((alegacao) => (
              <Chip
                key={alegacao.id}
                rotulo={alegacao.texto}
                ativo={alegacoesMarcadas.includes(alegacao.id)}
                aoClicar={() => alternar(alegacao.id)}
                titulo={`Já apareceu em ${alegacao.consultas} consulta(s)`}
              />
            ))}
          </div>
        ) : null}

        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <input
            value={textoNovo}
            onChange={(evento) => definirTextoNovo(evento.target.value)}
            placeholder="Nova: o Banco X não renegociaria a dívida…"
            style={{ ...estiloDeEntrada, flex: 1 }}
          />
          <Botao
            variante="secundario"
            aoClicar={cadastrar}
            desabilitado={!textoNovo.trim() || salvando}
          >
            {salvando ? 'Cadastrando…' : 'Cadastrar'}
          </Botao>
        </div>
        {erro ? (
          <p style={{ fontSize: 12, color: 'var(--erro-fg)', margin: '6px 0 0' }}>{erro}</p>
        ) : null}
      </div>
    </div>
  );
}
