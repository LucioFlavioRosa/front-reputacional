/** Ficha do registro — o modal de leitura.
 *
 *  Mostra só os campos preenchidos, e lista à parte os que estão vazios *e são
 *  aplicáveis àquela frente*. Um campo de imprensa não aparece como "faltando"
 *  numa agenda de governo.
 */

import { useEffect, useState } from 'react';
import { arquivarInteracao, obterInteracao } from '@/api/cliente';
import { usePainel } from '@/estado/painel';
import {
  Botao,
  Carregando,
  Chip,
  ChipDeFrente,
  FaixaDeErro,
  Modal,
} from '@/componentes/basicos';
import { dataCompleta, urlSegura } from '@/dominio/formato';
import {
  CAMPOS_DE_EXTENSAO,
  ROTULOS_DE_FRENTE,
  rotuloDeAbrangencia,
} from '@/dominio/frentes';
import type { Interacao } from '@/dominio/tipos';
import {
  nomeDaEsfera,
  nomeDaInstituicao,
  nomeDaPessoa,
  nomeDaUnidade,
  nomeDoInterlocutor,
  nomesDosTemas,
  rotuloDeCodigo,
  rotuloDeRelevancia,
} from '@/dominio/derivacoes';
import type { Catalogo } from '@/dominio/derivacoes';

/** Campos narrativos, na ordem de leitura do handoff. */
const CONTEUDO: { campo: keyof Interacao; rotulo: string }[] = [
  { campo: 'pauta', rotulo: 'Pauta' },
  { campo: 'posicionamento', rotulo: 'Posicionamento da companhia' },
  { campo: 'relato', rotulo: 'Relato' },
  { campo: 'encaminhamentos', rotulo: 'Repercussão e encaminhamentos' },
  { campo: 'pendencias', rotulo: 'Pendências' },
  { campo: 'observacoes', rotulo: 'Observações' },
];

/** Campos de extensão aplicáveis a cada frente — a lista do "o que falta".
 *
 *  Mora em `@/dominio/frentes` porque o cadastro precisa da MESMA lista para
 *  decidir o que sobrevive a uma troca de frente. Duas cópias divergiriam, e a
 *  que divergisse apagaria dado sem ninguém ver.
 */
const EXTENSAO_POR_FRENTE = CAMPOS_DE_EXTENSAO;

export function Ficha({
  id,
  aoFechar,
  aoEditar,
}: {
  id: string;
  aoFechar: () => void;
  /** Ausente quando o perfil não edita — e aí o botão não aparece. */
  aoEditar?: (id: string) => void;
}) {
  //: `recarregar` para a Base e o painel voltarem sem o registro removido —
  //: sem isso a linha continuaria na tela até alguém recarregar a página, e a
  //: remoção pareceria não ter funcionado.
  const { catalogo, recarregar } = usePainel();
  const [interacao, definirInteracao] = useState<Interacao | null>(null);
  const [erro, definirErro] = useState<string | null>(null);

  useEffect(function buscarInteracaoDaFicha() {
    let ativo = true;
    definirInteracao(null);
    definirErro(null);
    obterInteracao(id)
      .then((dados) => ativo && definirInteracao(dados))
      .catch((falha: Error) => ativo && definirErro(falha.message));
    return function cancelarBuscaDaInteracao() {
      ativo = false;
    };
  }, [id]);

  if (erro) {
    return (
      <Modal titulo="Interação" aoFechar={aoFechar}>
        <FaixaDeErro mensagem={erro} />
      </Modal>
    );
  }

  if (!interacao || !catalogo) {
    return (
      <Modal titulo="Interação" aoFechar={aoFechar}>
        <Carregando />
      </Modal>
    );
  }

  const entidade = nomeDaInstituicao(catalogo, interacao.instituicao_id);
  const preenchidos = CONTEUDO.filter(({ campo }) => Boolean(interacao[campo]));
  const faltando = camposAplicaveisVazios(interacao, catalogo);

  return (
    <Modal
      titulo={entidade}
      subtitulo={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          {ROTULOS_DE_FRENTE[interacao.frente]} · {dataCompleta(interacao.data_interacao)}
          {interacao.tier ? ` · ${rotuloDeRelevancia(catalogo, interacao.tier)}` : ''}
        </span>
      }
      aoFechar={aoFechar}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        <section>
          <div className="kicker" style={{ marginBottom: 10 }}>
            Conteúdo da interação
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {preenchidos.map(({ campo, rotulo }) => (
              <div
                key={campo}
                style={{
                  background: 'var(--bg-app)',
                  borderRadius: 'var(--r-card-int)',
                  padding: '13px 15px',
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'var(--cinza-2)',
                    marginBottom: 4,
                  }}
                >
                  {rotulo}
                </div>
                <div style={{ fontSize: 13, color: 'var(--cinza-3)', lineHeight: 1.6 }}>
                  {String(interacao[campo])}
                </div>
              </div>
            ))}
            {urlSegura(interacao.registro_url) ? (
              <a
                href={urlSegura(interacao.registro_url)!}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 13, color: 'var(--azul-mar)' }}
              >
                Abrir link / documentação
              </a>
            ) : interacao.registro_url ? (
              <span style={{ fontSize: 12, color: 'var(--cinza-2)' }}>
                O endereço informado não é um link navegável.
              </span>
            ) : null}
          </div>
        </section>

        <section>
          <div className="kicker" style={{ marginBottom: 10 }}>
            Classificação
          </div>
          <dl
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '10px 22px',
              margin: 0,
            }}
          >
            <Metadado rotulo="Frente" valor={<ChipDeFrente frente={interacao.frente} />} />
            <Metadado
              rotulo="Interlocutor"
              valor={nomeDoInterlocutor(catalogo, interacao.interlocutor_id)}
            />
            <Metadado
              rotulo="Situação"
              valor={rotuloDeCodigo(catalogo, 'status', interacao.status)}
            />
            <Metadado rotulo="Clima" valor={rotuloDeCodigo(catalogo, 'climas', interacao.clima)} />
            <Metadado
              rotulo="Desfecho"
              valor={rotuloDeCodigo(catalogo, 'resultados', interacao.resultado)}
            />
            <Metadado rotulo="Esfera" valor={nomeDaEsfera(catalogo, interacao.esfera_id)} />
            <Metadado
              rotulo="Unidade de negócio"
              valor={nomeDaUnidade(catalogo, interacao.unidade_negocio_id)}
            />
            {/* "UF da interação", como no formulario. O mesmo campo com dois
                nomes faz a pessoa procurar "abrangencia" onde esta escrito
                "UF" — e "Abrangencia" segue valendo no cadastro de
                INSTITUICAO, onde descreve o alcance do orgao e nao a UF de uma
                reuniao. */}
            <Metadado
              rotulo="UF da interação"
              valor={rotuloDeAbrangencia(interacao.uf)}
            />
            {/* ONDE ACONTECEU. Sem isto, o campo entrava no formulario e
                morria ali: quem le a ficha nao saberia se a reuniao foi na
                sala ou por chamada — e essa diferenca muda a leitura da
                presenca e do clima. */}
            {interacao.modalidade || interacao.local ? (
              <Metadado
                rotulo="Onde"
                valor={[
                  interacao.modalidade
                    ? { presencial: 'Presencial', online: 'Online', hibrida: 'Híbrida' }[
                        interacao.modalidade
                      ] ?? interacao.modalidade
                    : null,
                  interacao.local,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              />
            ) : null}
            <Metadado
              rotulo="Porta-vozes"
              valor={
                interacao.participacoes.filter((p) => p.papel === 'porta_voz').length
                  ? interacao.participacoes
                      .filter((p) => p.papel === 'porta_voz')
                      .map((p) => nomeDaPessoa(catalogo, p.pessoa_aegea_id))
                      .join(', ')
                  : '—'
              }
            />
            <Metadado
              rotulo="Iniciativa"
              valor={rotuloDeCodigo(catalogo, 'iniciativas', interacao.iniciativa)}
            />
          </dl>
        </section>

        {interacao.temas.length ? (
          <section>
            <div className="kicker" style={{ marginBottom: 10 }}>
              Temas
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {nomesDosTemas(catalogo, interacao.temas).map((tema) => (
                <Chip key={tema} rotulo={tema} />
              ))}
            </div>
          </section>
        ) : null}

        {/* O CICLO DA AGENDA ------------------------------------------------
            Expectativa e relato lado a lado, e clima esperado ao lado do real:
            e a distancia entre eles que responde "o que prometemos costuma
            acontecer?". Separados em telas diferentes, ninguem compara. */}
        <CicloDaAgenda interacao={interacao} catalogo={catalogo} />

        {aoEditar ? (
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <Remover
              id={interacao.id}
              aoRemover={() => {
                recarregar();
                aoFechar();
              }}
            />
            <Botao variante="primario" aoClicar={() => aoEditar(interacao.id)}>
              Editar interação
            </Botao>
          </div>
        ) : null}

        {faltando.length ? (
          // `--texto-placeholder` é para texto de espera dentro de um campo
          // vazio — não para uma frase real que alguém precisa ler. Usado
          // aqui, a informação em si ficava no contraste de "isto não é
          // conteúdo", que é o oposto do que a frase é.
          <p style={{ fontSize: 12, color: 'var(--cinza-2)', lineHeight: 1.5 }}>
            Sem preenchimento nesta frente: {faltando.join(', ')}.
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

/** Remover a agenda das telas.
 *
 *  O registro sai da Base, do painel e das cadeias, e a linha
 *  permanece no banco com a trilha de quem mexeu no quê. Não é apagar: é tirar
 *  de circulação mantendo rastro.
 *
 *  A TELA NÃO EXPLICA ISSO. Havia um aviso descrevendo o que acontece por
 *  dentro, e ele saiu: quem quer tirar um registro da frente não precisa saber
 *  onde a linha fica. A palavra do botão diz o que a pessoa FAZ.
 *
 *  DOIS PASSOS, e não um `confirm()` do navegador. Remoção é imediata e mexe no
 *  que todo mundo vê, então o primeiro clique só arma. O diálogo nativo não
 *  cabe dentro de um modal e não diz de qual registro se trata.
 */
function Remover({ id, aoRemover }: { id: string; aoRemover: () => void }) {
  const [armado, definirArmado] = useState(false);
  const [removendo, definirRemovendo] = useState(false);
  const [falha, definirFalha] = useState<string | null>(null);

  if (!armado) {
    return (
      <Botao
        variante="fantasma"
        aoClicar={() => {
          definirArmado(true);
          definirFalha(null);
        }}
      >
        Remover
      </Botao>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap',
        marginRight: 'auto',
      }}
    >
      {/* SEM EXPLICAÇÃO DO QUE O SISTEMA FAZ POR DENTRO.
          "Sai da Base, do painel e das cadeias; a linha e o histórico ficam
          guardados" é descrever a implementação a quem só quer tirar um
          registro da frente. A pergunta que o segundo passo faz é "tem
          certeza?", e o botão já a responde. */}
      <Botao aoClicar={() => definirArmado(false)} desabilitado={removendo}>
        Cancelar
      </Botao>
      <Botao
        variante="primario"
        desabilitado={removendo}
        aoClicar={async () => {
          definirRemovendo(true);
          definirFalha(null);
          try {
            await arquivarInteracao(id);
            aoRemover();
          } catch (erro) {
            // A FALHA FICA NA TELA. Fechar a ficha aqui faria a pessoa
            // acreditar que removeu — e o registro continuaria na Base.
            definirFalha(
              erro instanceof Error
                ? erro.message
                : 'Não foi possível remover a interação.',
            );
            definirRemovendo(false);
          }
        }}
      >
        {removendo ? 'Removendo…' : 'Confirmar remoção'}
      </Botao>
      {falha ? (
        <span style={{ fontSize: 12.5, color: 'var(--erro-fg)' }}>{falha}</span>
      ) : null}
    </div>
  );
}

function Metadado({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div>
      <dt style={{ fontSize: 11, fontWeight: 700, color: 'var(--cinza-2)' }}>{rotulo}</dt>
      <dd style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--cinza-3)' }}>{valor}</dd>
    </div>
  );
}

/** Só os campos que aquela frente de fato usa e que estão vazios. */
function camposAplicaveisVazios(interacao: Interacao, catalogo: Catalogo): string[] {
  const faltando: string[] = [];

  for (const { campo, rotulo } of CONTEUDO) {
    if (!interacao[campo]) faltando.push(rotulo.toLowerCase());
  }

  const extensao = interacao.extensao ?? {};
  for (const { campo, rotulo } of EXTENSAO_POR_FRENTE[interacao.frente]) {
    const valor = (extensao as Record<string, unknown>)[campo];
    const vazio = valor == null || valor === '' || (Array.isArray(valor) && !valor.length);
    if (vazio) faltando.push(rotulo.toLowerCase());
  }

  if (!interacao.tier) faltando.push('relevância');
  if (!interacao.clima) faltando.push('clima');
  if (!interacao.unidade_negocio_id) faltando.push('unidade de negócio');
  void catalogo;

  return faltando;
}

/** O ciclo: o previsto, o real, e o que veio depois.
 *
 *  Some inteiro quando nada foi informado. Uma seção com seis "não informado"
 *  ocupa a ficha sem dizer nada — e a maioria dos 60 registros veio de
 *  planilha, sem nenhum destes campos.
 */
function CicloDaAgenda({
  interacao,
  catalogo,
}: {
  interacao: Interacao;
  catalogo: Catalogo;
}) {
  const participantes = interacao.outra_parte ?? [];
  const materiais = interacao.materiais ?? [];
  const temCiclo =
    interacao.expectativa ||
    interacao.clima_esperado ||
    interacao.declinado_por ||
    interacao.nota_situacao ||
    interacao.preve_desdobramento != null ||
    participantes.length > 0 ||
    materiais.length > 0;

  if (!temCiclo) return null;

  return (
    <>
      {(interacao.expectativa || interacao.clima_esperado) && (
        <section>
          <div className="kicker" style={{ marginBottom: 10 }}>
            O que se esperava
          </div>
          {interacao.expectativa ? (
            <p style={{ fontSize: 13, color: 'var(--cinza-3)', lineHeight: 1.6, margin: 0 }}>
              {interacao.expectativa}
            </p>
          ) : null}
          {interacao.clima_esperado ? (
            <p style={{ fontSize: 12, color: 'var(--cinza-2)', marginTop: 8 }}>
              Clima esperado:{' '}
              <strong>{rotuloDeCodigo(catalogo, 'climas', interacao.clima_esperado)}</strong>
              {interacao.clima ? (
                <>
                  {' · '}o que houve:{' '}
                  <strong>{rotuloDeCodigo(catalogo, 'climas', interacao.clima)}</strong>
                </>
              ) : null}
            </p>
          ) : null}
        </section>
      )}

      {/* A CONDIÇÃO DO ACEITE. "Aceitaram, mas só para março" é o que decide
          o preparo, e antes não tinha onde ser lido. */}
      {interacao.nota_situacao ? (
        <section>
          <div className="kicker" style={{ marginBottom: 10 }}>
            Sobre o aceite
          </div>
          <p style={{ fontSize: 13, color: 'var(--cinza-3)', lineHeight: 1.6, margin: 0 }}>
            {interacao.nota_situacao}
          </p>
        </section>
      ) : null}

      {interacao.declinado_por ? (
        <section>
          <div className="kicker" style={{ marginBottom: 10 }}>
            Negada
          </div>
          <p style={{ fontSize: 13, color: 'var(--cinza-3)', lineHeight: 1.6, margin: 0 }}>
            {/* Quem declinou vem PRIMEIRO: declinar é escolha da Aegea, ser
                declinado é porta que se fechou. O motivo só se lê à luz do
                lado. */}
            <strong>
              {interacao.declinado_por === 'aegea' ? 'Pela Aegea' : 'Pela outra parte'}
            </strong>
            {interacao.motivo_declinio ? ` — ${interacao.motivo_declinio}` : ''}
          </p>
        </section>
      ) : null}

      {participantes.length > 0 && (
        <section>
          <div className="kicker" style={{ marginBottom: 10 }}>
            Quem participou
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {participantes.map((pessoa) => (
              <div key={pessoa.interlocutor_id} style={{ fontSize: 13 }}>
                {nomeDoInterlocutor(catalogo, pessoa.interlocutor_id)}
                {pessoa.principal ? (
                  <span style={{ color: 'var(--cinza-2)' }}> · representa a outra parte</span>
                ) : null}
                {/* "Não informado" fica implícito pela ausência: escrevê-lo em
                    toda linha de um registro antigo viraria ruído. Mas FALTOU
                    aparece com destaque — uma reunião em que o decisor não veio
                    não é a reunião que foi pedida. */}
                {pessoa.presenca === 'ausente' ? (
                  <span style={{ color: 'var(--erro-fg)', fontWeight: 600 }}> · faltou</span>
                ) : pessoa.presenca === 'presente' ? (
                  <span style={{ color: 'var(--cinza-2)' }}> · compareceu</span>
                ) : pessoa.presenca === 'previsto' ? (
                  <span style={{ color: 'var(--cinza-2)' }}> · previsto</span>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      )}

      {materiais.length > 0 && (
        <section>
          <div className="kicker" style={{ marginBottom: 10 }}>
            Materiais
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {materiais.map((material) => {
              const link = urlSegura(material.url);
              return (
                <div key={material.id ?? material.titulo} style={{ fontSize: 13 }}>
                  <span style={{ color: 'var(--cinza-2)' }}>
                    {material.momento === 'apoio'
                      ? 'Apoio'
                      : material.momento === 'obtido'
                        ? 'Obtido'
                        : 'Produzido'}
                    {' · '}
                  </span>
                  {link ? (
                    <a
                      href={link}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: 'var(--azul-mar)' }}
                    >
                      {material.titulo}
                    </a>
                  ) : (
                    // Mesmo tratamento que `registro_url` já dava: link que não
                    // navega vira texto, e a ficha diz por quê.
                    <span title="O endereço não é um link navegável.">{material.titulo}</span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {interacao.preve_desdobramento != null && (
        <p style={{ fontSize: 12, color: 'var(--cinza-2)', margin: 0 }}>
          {interacao.preve_desdobramento
            ? 'Prevê desdobramento em outra interação.'
            : 'Não prevê desdobramento.'}
        </p>
      )}
    </>
  );
}
