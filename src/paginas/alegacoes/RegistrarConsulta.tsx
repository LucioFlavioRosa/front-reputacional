/** O atalho de quem RECEBE o e-mail: colar e sair.
 *
 *  POR QUE EXISTE, SE O CADASTRO JÁ REGISTRA. O formulário de agenda tem oito
 *  seções e pergunta o que uma reunião precisa — modalidade, local, situação,
 *  expectativa, materiais. Quem acabou de receber um questionário de um banco
 *  não está registrando uma agenda: está guardando um e-mail antes de voltar
 *  ao trabalho. Uma tela de trinta segundos é a diferença entre a aba de
 *  Sinais ter dado e não ter.
 *
 *  É A MESMA COISA POR BAIXO: cria uma interação do tipo "Consulta recebida",
 *  pela mesma rota, com as mesmas regras. Não há segundo caminho de dado — o
 *  que muda é quanto se pergunta. O que ficou de fora (materiais, cadeia,
 *  participantes da outra parte) se completa depois, abrindo a ficha.
 *
 *  OS ANEXOS SOBEM DEPOIS DE A CONSULTA EXISTIR, e não antes: o arquivo mora
 *  numa pasta que leva o id dela (`consultas/<mês>/<instituição>/<dia>-<id>/`),
 *  e essa pasta é o que permite vistoriar o contêiner sem consultar o banco.
 *  Por isso o salvar é uma sequência — cria, sobe cada anexo, e amarra os
 *  materiais à consulta.
 *
 *  O QUE NÃO SE PERGUNTA AQUI, e por quê:
 *  - a FRENTE: o servidor deriva do tipo da instituição;
 *  - a SITUAÇÃO: um e-mail que chegou aconteceu — nasce "Aceito";
 *  - a UF: vem da instituição, e "NA" quando ela não tem.
 */

import { useState } from 'react';
import { criarInteracao, editarInteracao, subirArquivoDeMaterial } from '@/api/cliente';
import { usePainel } from '@/estado/painel';
import { Botao, Campo, Cartao, Chip, FaixaDeErro, Secao, estiloDeEntrada } from '@/componentes/basicos';
import { CampoQueCompleta } from '@/componentes/CampoQueCompleta';
import { CamposDaConsulta } from '@/paginas/cadastro/CamposDaConsulta';
import type { Catalogo } from '@/dominio/derivacoes';
import { CODIGO_DA_CONSULTA } from '@/dominio/sinais';

/** Um e-mail que chegou ACONTECEU — não é um pedido à espera de resposta. */
const SITUACAO_DE_QUEM_RECEBEU = 'confirmada';

/** O anexo veio de fora — é material OBTIDO, e não produzido pela casa nem
 *  levado como apoio. */
const MOMENTO_DO_ANEXO = 'obtido';

/** O papel de quem recebeu: acompanhou, não falou pela companhia. Porta-voz é
 *  quem conduz, e entra no ranking de exposição — um destinatário de e-mail
 *  não deveria. */
const PAPEL_DE_QUEM_RECEBEU = 'equipe';

const HOJE = () => new Date().toISOString().slice(0, 10);

interface Rascunho {
  instituicao_id: string;
  data_interacao: string;
  recebida_por: string;
  temas: number[];
  areas: number[];
  clima: string;
  observacoes: string;
  canal_id: string;
  remetente: string;
  teor: string;
  motivo: string;
  prazo_resposta: string;
  alegacoes: string[];
}

const VAZIO = (): Rascunho => ({
  instituicao_id: '',
  data_interacao: HOJE(),
  recebida_por: '',
  temas: [],
  areas: [],
  clima: '',
  observacoes: '',
  canal_id: '',
  remetente: '',
  teor: '',
  motivo: '',
  prazo_resposta: '',
  alegacoes: [],
});

export function RegistrarConsulta({ catalogo }: { catalogo: Catalogo }) {
  const { recarregar } = usePainel();
  const [rascunho, definirRascunho] = useState<Rascunho>(VAZIO);
  const [aberto, definirAberto] = useState(false);
  const [anexos, definirAnexos] = useState<File[]>([]);
  const [salvando, definirSalvando] = useState(false);
  const [erro, definirErro] = useState<string | null>(null);
  const [sucesso, definirSucesso] = useState<string | null>(null);

  const alterar = <C extends keyof Rascunho>(campo: C, valor: Rascunho[C]) =>
    definirRascunho((atual) => ({ ...atual, [campo]: valor }));

  const alternarNaLista = (campo: 'temas' | 'areas', id: number) =>
    definirRascunho((atual) => ({
      ...atual,
      [campo]: atual[campo].includes(id)
        ? atual[campo].filter((marcado) => marcado !== id)
        : [...atual[campo], id],
    }));

  const tipoDeConsulta = catalogo.dicionarios.formatos_interacao.find(
    (formato) => formato.codigo === CODIGO_DA_CONSULTA,
  );

  const instituicao = rascunho.instituicao_id
    ? catalogo.instituicoes.get(rascunho.instituicao_id)
    : undefined;

  //: SEM O TIPO NO DICIONÁRIO NÃO DÁ PARA REGISTRAR — e o botão precisa
  //: DIZER isso. Só desabilitar por instituição deixava o clique não fazer
  //: nada num catálogo divergente da migration, que é a falha mais difícil de
  //: entender de todas: a tela parece funcionar.
  const podeSalvar = Boolean(rascunho.instituicao_id) && Boolean(tipoDeConsulta) && !salvando;

  async function salvar() {
    // O `tipoDeConsulta` volta a ser conferido aqui, e não só em `podeSalvar`:
    // é o que faz o compilador saber que ele existe daqui para baixo.
    if (!podeSalvar || !tipoDeConsulta) return;
    definirSalvando(true);
    definirErro(null);
    definirSucesso(null);
    try {
      const criada = await criarInteracao({
        data_interacao: rascunho.data_interacao,
        instituicao_id: rascunho.instituicao_id,
        // A UF vem da instituição: quem registra um e-mail não tem o que
        // dizer sobre abrangência, e o campo é obrigatório no servidor.
        uf: instituicao?.uf || 'NA',
        status: SITUACAO_DE_QUEM_RECEBEU,
        formato_interacao_id: tipoDeConsulta.id,
        temas: rascunho.temas,
        areas: rascunho.areas,
        clima: rascunho.clima || undefined,
        observacoes: rascunho.observacoes.trim() || undefined,
        participacoes: rascunho.recebida_por
          ? [{ pessoa_aegea_id: rascunho.recebida_por, papel: PAPEL_DE_QUEM_RECEBEU }]
          : [],
        consulta: {
          canal_id: rascunho.canal_id ? Number(rascunho.canal_id) : undefined,
          remetente: rascunho.remetente.trim() || undefined,
          teor: rascunho.teor.trim() || undefined,
          motivo: rascunho.motivo.trim() || undefined,
          prazo_resposta: rascunho.prazo_resposta || undefined,
        },
        alegacoes: rascunho.alegacoes,
      });

      // UM A UM, e não em paralelo: o servidor recusa arquivo fora da lista de
      // tipos, e subir tudo junto tornaria impossível dizer QUAL falhou.
      const materiais = [];
      for (const anexo of anexos) {
        const salvo = await subirArquivoDeMaterial(criada.id, MOMENTO_DO_ANEXO, anexo);
        materiais.push({
          momento: MOMENTO_DO_ANEXO,
          // O nome do arquivo É o título: quem anexa "Questionário anual.pdf"
          // já disse como o material se chama.
          titulo: salvo.nome,
          arquivo_id: salvo.id,
          temas: rascunho.temas,
        });
      }
      if (materiais.length) await editarInteracao(criada.id, { materiais });
      definirRascunho(VAZIO());
      definirAnexos([]);
      definirSucesso(
        anexos.length
          ? `Consulta registrada com ${anexos.length} anexo${anexos.length > 1 ? 's' : ''}. Ela já conta na aba de Sinais.`
          : 'Consulta registrada. Ela já conta na aba de Sinais.',
      );
      // O catálogo guarda as alegações que o formulário oferece, e a lista de
      // baixo mostra em quantas consultas cada uma apareceu.
      recarregar();
    } catch (falha) {
      definirErro(falha instanceof Error ? falha.message : 'Não foi possível registrar.');
    } finally {
      definirSalvando(false);
    }
  }

  return (
    <Secao
      titulo="Registrar uma consulta recebida"
      subtitulo="Chegou um questionário por e-mail? Guarde aqui, em trinta segundos — o resto se completa depois, pela ficha."
      acao={
        <Botao variante="secundario" aoClicar={() => definirAberto((v) => !v)}>
          {aberto ? 'Fechar' : 'Registrar e-mail'}
        </Botao>
      }
    >
      {!aberto ? null : (
        <Cartao>
          {erro ? <FaixaDeErro mensagem={erro} /> : null}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="grade grade--3" style={{ gap: 14 }}>
              <CampoQueCompleta
                rotulo="Quem enviou (instituição) *"
                valor={rascunho.instituicao_id}
                aoEscolher={(valor) => alterar('instituicao_id', valor)}
                opcoes={[...catalogo.instituicoes.values()]
                  .filter((i) => i.ativo)
                  .map((i) => ({ valor: i.id, rotulo: i.nome }))}
              />
              <Campo rotulo="Quando chegou *">
                <input
                  type="date"
                  value={rascunho.data_interacao}
                  onChange={(evento) => alterar('data_interacao', evento.target.value)}
                  style={estiloDeEntrada}
                />
              </Campo>
              <CampoQueCompleta
                rotulo="Quem recebeu"
                valor={rascunho.recebida_por}
                aoEscolher={(valor) => alterar('recebida_por', valor)}
                opcoes={[...catalogo.pessoas.values()]
                  .filter((p) => p.ativo)
                  .map((p) => ({ valor: p.id, rotulo: p.nome }))}
              />
            </div>

            {/* O RESTO DA CONSULTA é o mesmo bloco do formulário de agenda —
                um componente só, para os dois caminhos perguntarem a mesma
                coisa com as mesmas palavras. */}
            <CamposDaConsulta
              canalId={rascunho.canal_id}
              remetente={rascunho.remetente}
              teor={rascunho.teor}
              motivo={rascunho.motivo}
              prazoResposta={rascunho.prazo_resposta}
              respondidaEm=""
              alegacoesMarcadas={rascunho.alegacoes}
              alegacoes={catalogo.alegacoes}
              dicionarios={catalogo.dicionarios}
              aoMudar={(campo, valor) => {
                // `respondida_em` não é perguntada aqui: o e-mail acabou de
                // chegar, e responder é o passo seguinte.
                if (campo === 'respondida_em') return;
                alterar(campo as keyof Rascunho, valor as never);
              }}
              aoMarcarAlegacoes={(ids) => alterar('alegacoes', ids)}
              aoCadastrarAlegacao={() => recarregar()}
            />

            <Campo rotulo="Temas">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                {catalogo.dicionarios.temas.map((tema) => {
                  const ativo = rascunho.temas.includes(tema.id);
                  return (
                    <Chip
                      key={tema.id}
                      rotulo={tema.nome}
                      ativo={ativo}
                      fundo={ativo ? 'var(--turquesa-rio)' : 'var(--bg-trilho)'}
                      texto={ativo ? 'var(--sobre-turquesa)' : 'var(--cinza-3)'}
                      aoClicar={() => alternarNaLista('temas', tema.id)}
                    />
                  );
                })}
              </div>
            </Campo>

            <div className="grade grade--2" style={{ gap: 14, alignItems: 'start' }}>
              <Campo rotulo="Área(s) que receberam">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                  {catalogo.dicionarios.areas_pessoa.map((area) => {
                    const ativo = rascunho.areas.includes(area.id);
                    return (
                      <Chip
                        key={area.id}
                        rotulo={area.nome}
                        ativo={ativo}
                        fundo={ativo ? 'var(--turquesa-rio)' : 'var(--bg-trilho)'}
                        texto={ativo ? 'var(--sobre-turquesa)' : 'var(--cinza-3)'}
                        aoClicar={() => alternarNaLista('areas', area.id)}
                      />
                    );
                  })}
                </div>
              </Campo>

              <CampoQueCompleta
                rotulo="Clima da abordagem"
                valor={rascunho.clima}
                aoEscolher={(valor) => alterar('clima', valor)}
                opcoes={catalogo.dicionarios.climas.map((clima) => ({
                  valor: clima.codigo,
                  rotulo: clima.nome,
                }))}
              />
            </div>

            {/* O ANEXO — o questionário em si, que é o documento que se
                reutiliza depois. Vai para `consultas/<mês>/<instituição>/…` no
                armazenamento, uma pasta por e-mail. */}
            <Campo rotulo="Anexos do e-mail">
              <input
                type="file"
                multiple
                onChange={(evento) =>
                  definirAnexos([...(evento.target.files ?? [])])
                }
                style={{ ...estiloDeEntrada, padding: '6px 8px' }}
              />
              {anexos.length ? (
                <p style={{ fontSize: 12, color: 'var(--cinza-2)', margin: '6px 0 0' }}>
                  {anexos.map((a) => a.name).join(', ')} — sobem quando você
                  registrar.
                </p>
              ) : (
                <p style={{ fontSize: 12, color: 'var(--cinza-2)', margin: '6px 0 0' }}>
                  PDF, Word, Excel, PowerPoint ou imagem.
                </p>
              )}
            </Campo>

            <Campo rotulo="Sua percepção">
              <textarea
                value={rascunho.observacoes}
                onChange={(evento) => alterar('observacoes', evento.target.value)}
                rows={2}
                style={{ ...estiloDeEntrada, resize: 'vertical' }}
                placeholder="O que chamou a atenção na abordagem."
              />
            </Campo>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <Botao aoClicar={salvar} desabilitado={!podeSalvar}>
                {salvando
                  ? anexos.length
                    ? 'Registrando e subindo os anexos…'
                    : 'Registrando…'
                  : 'Registrar consulta'}
              </Botao>
              {!tipoDeConsulta ? (
                <span style={{ fontSize: 12, color: 'var(--erro-fg)' }}>
                  O tipo de interação "Consulta recebida" não está no catálogo —
                  a migration 0046 não chegou a este ambiente.
                </span>
              ) : sucesso ? (
                <span style={{ fontSize: 12, color: 'var(--ok-fg)' }}>{sucesso}</span>
              ) : (
                <span style={{ fontSize: 12, color: 'var(--cinza-2)' }}>
                  Só a instituição e a data são obrigatórias.
                </span>
              )}
            </div>
          </div>
        </Cartao>
      )}
    </Secao>
  );
}
