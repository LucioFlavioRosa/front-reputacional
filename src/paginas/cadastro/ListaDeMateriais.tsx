/** Os materiais da agenda: apoio antes, obtido e produzido depois.
 *
 *  SAIU DE `Cadastro.tsx`, que tinha 2.572 linhas e um componente de 921 — o
 *  arquivo em que eu mais errei nesta base, e por um motivo: nada cabia na
 *  cabeça de uma vez. Este pedaço já era auto-contido; só não tinha porta
 *  própria.
 */

import { useState } from 'react';

import { Botao, Campo, estiloDeEntrada } from '@/componentes/basicos';
import { CampoQueCompleta } from '@/componentes/CampoQueCompleta';
import { subirArquivoDeMaterial, urlDoArquivo } from '@/api/cliente';
import { tamanhoLegivel } from '@/dominio/formato';
import type { MaterialNoForm } from '@/paginas/cadastro/formulario';

/** Os documentos de um MOMENTO da agenda.
 *
 *  Uma instância por seção: preparação (`apoio`) e pós-reunião (`obtido`,
 *  `produzido`). `momentos` diz quais valores esta lista governa — com um só,
 *  o seletor de momento some, porque não há escolha a fazer.
 *
 *  O UPLOAD EXIGE QUE A AGENDA JÁ EXISTA. O arquivo mora na pasta dela, e numa
 *  agenda nova ainda não há pasta. Em vez de fingir que dá, a tela diz o que
 *  falta — e o campo de link continua servindo, que é o caminho de sempre.
 */
/** Os materiais da agenda: apoio antes, obtido e produzido depois.
 *
 *  O `id` viaja escondido em cada linha e volta no salvamento. Sem ele o
 *  backend recria o material e troca a identidade — e a tela perde a
 *  referência do que estava editando.
 */
export function ListaDeMateriais({
  materiais,
  momentos,
  interacaoId,
  aoMudar,
  aoFalhar,
  aoDispensar,
  temasDaAgenda,
  assuntos,
}: {
  materiais: MaterialNoForm[];
  momentos: { valor: string; rotulo: string }[];
  /** `undefined` numa agenda ainda não salva. */
  interacaoId?: string;
  /** Recebe uma FUNÇÃO, e não a lista pronta.
   *
   *  O upload é assíncrono: quando ele volta, a lista que a closure capturou
   *  já pode estar velha — quem digitou o título enquanto o arquivo subia
   *  perderia o que escreveu, porque a volta reescrevia tudo a partir do
   *  retrato antigo. Com função, a atualização se aplica ao que existe AGORA.
   */
  aoMudar: (atualizar: (atual: MaterialNoForm[]) => MaterialNoForm[]) => void;
  aoFalhar: (mensagem: string) => void;
  /** Os assuntos que uma linha NOVA herda — os da agenda. */
  temasDaAgenda: number[];
  /** O dicionário de assuntos, para os botões. */
  assuntos: { id: number; nome: string }[];
  /** Uma linha vinda da biblioteca foi removida a mao.
   *
   *  Sem este aviso, remove-la e depois mexer em qualquer assunto a traria de
   *  volta — a tela desfazendo, sozinha, o que a pessoa acabou de fazer.
   */
  aoDispensar?: (referenciaId: string) => void;
}) {
  //: Qual linha está subindo. Índice, e não booleano: subir dois arquivos ao
  //: mesmo tempo mostraria "enviando" nas duas linhas.
  const [subindo, definirSubindo] = useState<number | null>(null);

  const trocar = (indice: number, mudanca: Partial<MaterialNoForm>) =>
    aoMudar((atual) => atual.map((m, i) => (i === indice ? { ...m, ...mudanca } : m)));

  const subir = async (indice: number, arquivo: File) => {
    if (!interacaoId) return;
    definirSubindo(indice);
    try {
      const salvo = await subirArquivoDeMaterial(
        interacaoId,
        materiais[indice].momento,
        arquivo,
      );
      // O TÍTULO VAZIO GANHA O NOME DO ARQUIVO. Quem sobe "Nota técnica
      // ANA.pdf" já disse como o material se chama; pedir para digitar de novo
      // é trabalho que a tela podia ter poupado. Título preenchido fica.
      // `atual`, e não `materiais`: entre o clique e a volta do upload a
      // pessoa pode ter digitado o título, e a lista capturada pela closure
      // não sabe disso. Reescrevê-la apagaria o que ela escreveu.
      aoMudar((atual) =>
        atual.map((m, i) =>
          i === indice
            ? {
                ...m,
                arquivo_id: salvo.id,
                arquivo: salvo,
                titulo: m.titulo.trim() || salvo.nome,
              }
            : m,
        ),
      );
    } catch (falha) {
      // A mensagem do servidor diz o que houve — tipo recusado, tamanho acima
      // do limite — e é ela que a pessoa precisa ler, não "falha no upload".
      aoFalhar((falha as Error).message);
    } finally {
      definirSubindo(null);
    }
  };

  return (
    <>
      {materiais.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--cinza-3)', margin: '0 0 12px' }}>
          Nenhum material ainda.
        </p>
      )}

      {materiais.map((material, indice) => (
        <div
          key={material.id ?? indice}
          style={{
            marginBottom: 14,
            paddingBottom: 14,
            borderBottom: '1px solid var(--borda)',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: momentos.length > 1 ? '1fr 2fr auto' : '1fr auto',
              gap: 10,
              alignItems: 'end',
            }}
          >
            {momentos.length > 1 && (
              <CampoQueCompleta
                rotulo={indice === 0 ? 'Momento' : undefined}
                ariaLabel={`Momento do material ${indice + 1}`}
                obrigatorio
                valor={material.momento}
                aoEscolher={(v) => trocar(indice, { momento: v })}
                opcoes={momentos.map((op) => ({ valor: op.valor, rotulo: op.rotulo }))}
              />
            )}

            <Campo rotulo={indice === 0 ? 'Título' : ''}>
              <input
                aria-label={`Título do material ${indice + 1}`}
                style={estiloDeEntrada}
                value={material.titulo}
                onChange={(evento) => trocar(indice, { titulo: evento.target.value })}
                placeholder="Nota técnica do reajuste"
              />
              {/* DE ONDE A LINHA VEIO, quando não foi a pessoa que a escreveu.
                  Sem a marca, a linha aparece sozinha no formulário e parece
                  coisa que alguém digitou e esqueceu. */}
              {material.referencia_id ? (
                <span
                  style={{
                    display: 'block',
                    marginTop: 4,
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    color: 'var(--cinza-2)',
                  }}
                >
                  Da biblioteca
                </span>
              ) : null}
            </Campo>

            <div style={{ paddingBottom: 4 }}>
              <Botao
                variante="secundario"
                aoClicar={() => {
                  if (material.referencia_id) aoDispensar?.(material.referencia_id);
                  aoMudar((atual) => atual.filter((_, i) => i !== indice));
                }}
                rotuloAcessivel={`Remover o material ${indice + 1}`}
              >
                Remover
              </Botao>
            </div>
          </div>

          {/* O ARQUIVO, QUANDO HÁ UM. Substitui o campo de link: um material
              aponta para UM lugar, e oferecer os dois ao mesmo tempo convida a
              preencher os dois e deixar a dúvida sobre qual vale. */}
          {material.arquivo ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginTop: 10,
                padding: '8px 11px',
                background: 'var(--bg-trilho)',
                borderRadius: 'var(--r-card-int)',
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  flex: 1,
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {material.arquivo.nome}
              </span>
              <span
                style={{ fontSize: 12, color: 'var(--cinza-3)', whiteSpace: 'nowrap' }}
              >
                {tamanhoLegivel(material.arquivo.tamanho)}
              </span>
              {/* Baixar só faz sentido para o que JÁ FOI SALVO: o arquivo
                  recém-subido ainda não tem material amarrado a ele, e a rota
                  de download confere justamente esse vínculo. */}
              {interacaoId && material.id ? (
                <a
                  href={urlDoArquivo(interacaoId, material.arquivo.id)}
                  style={{ fontSize: 12, color: 'var(--azul-mar)' }}
                >
                  Baixar
                </a>
              ) : null}
              <Botao
                variante="fantasma"
                rotuloAcessivel={`Tirar o arquivo do material ${indice + 1}`}
                // TIRA A LIGAÇÃO, e o byte some no salvamento seguinte — não
                // agora. Apagar na hora destruiria o arquivo de quem clicou
                // sem querer e fechou a tela sem salvar; ligado ao salvamento,
                // "Desfazer alterações" ainda traz o anexo de volta.
                aoClicar={() => trocar(indice, { arquivo_id: null, arquivo: null })}
              >
                Trocar
              </Botao>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr',
                gap: 10,
                marginTop: 10,
              }}
            >
              <Campo
                rotulo="Arquivo"
                dica={
                  interacaoId
                    ? 'PDF, Word, Excel, PowerPoint, imagem ou texto. Até 25 MB.'
                    : 'Salve a agenda antes de anexar arquivos.'
                }
              >
                <input
                  type="file"
                  aria-label={`Arquivo do material ${indice + 1}`}
                  disabled={!interacaoId || subindo !== null}
                  style={{ ...estiloDeEntrada, paddingTop: 7, height: 'auto' }}
                  onChange={(evento) => {
                    const escolhido = evento.target.files?.[0];
                    // O `value` é limpo para que escolher O MESMO arquivo
                    // depois de um erro dispare `change` de novo. Sem isso, a
                    // segunda tentativa não acontece e a tela parece travada.
                    evento.target.value = '';
                    if (escolhido) void subir(indice, escolhido);
                  }}
                />
              </Campo>

              <Campo rotulo="Ou link">
                <input
                  aria-label={`Link do material ${indice + 1}`}
                  style={estiloDeEntrada}
                  value={material.url}
                  onChange={(evento) => trocar(indice, { url: evento.target.value })}
                  placeholder="https://…"
                />
              </Campo>
            </div>
          )}

          {subindo === indice && (
            <p style={{ fontSize: 12, color: 'var(--cinza-3)', margin: '8px 0 0' }}>
              Enviando o arquivo…
            </p>
          )}

          <div style={{ marginTop: 10 }}>
            {/* RESUMO, e nao "Observacao".
                A palavra antiga pedia um comentario sobre o documento e quase
                nunca era preenchida — nao ha o que observar sobre um arquivo
                que ainda nao se leu. "Resumo" pede o que a biblioteca ja tem
                escrito, e por isso a linha vinda de la ja chega preenchida: uma
                linha do que o documento diz vale mais que o titulo, e e o que
                evita abrir cinco para achar um. */}
            <Campo rotulo="Resumo">
              <input
                aria-label={`Resumo do material ${indice + 1}`}
                style={estiloDeEntrada}
                value={material.observacao}
                onChange={(evento) => trocar(indice, { observacao: evento.target.value })}
                placeholder="Uma linha do que o documento diz"
              />
            </Campo>

            {/* O ASSUNTO DO DOCUMENTO, e nao o da agenda.
                Quase sempre sao os mesmos — e por isso a linha nova ja nasce
                com os da agenda —, mas nao sempre: a ata de uma reuniao sobre
                tarifa pode trazer um trecho sobre regulacao, e e por assunto
                que alguem vai procurar esse trecho seis meses depois. */}
            <div style={{ marginTop: 10 }}>
              <Campo
                rotulo="Assuntos do documento"
                dica="É por eles que ele aparece na busca da Base."
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {assuntos.map((assunto) => {
                    const marcado = material.temas.includes(assunto.id);
                    return (
                      <button
                        key={assunto.id}
                        type="button"
                        aria-pressed={marcado}
                        onClick={() =>
                          trocar(indice, {
                            temas: marcado
                              ? material.temas.filter((id) => id !== assunto.id)
                              : [...material.temas, assunto.id],
                          })
                        }
                        style={{
                          padding: '4px 10px',
                          borderRadius: 999,
                          border: `1px solid ${marcado ? 'var(--turquesa-rio)' : 'var(--borda)'}`,
                          background: marcado ? 'var(--turquesa-rio)' : 'transparent',
                          color: marcado ? 'var(--sobre-turquesa)' : 'var(--cinza-2)',
                          fontSize: 12,
                          fontWeight: marcado ? 600 : 400,
                          cursor: 'pointer',
                          font: 'inherit',
                        }}
                      >
                        {assunto.nome}
                      </button>
                    );
                  })}
                </div>
              </Campo>
            </div>
          </div>
        </div>
      ))}

      <Botao
        aoClicar={() =>
          aoMudar((atual) => [
            ...atual,
            {
              momento: momentos[0].valor,
              titulo: '',
              url: '',
              observacao: '',
              referencia_id: null,
              temas: [...temasDaAgenda],
              arquivo_id: null,
              arquivo: null,
            },
          ])
        }
      >
        Acrescentar material
      </Botao>
    </>
  );
}

/** Traduz o que o servidor devolve para o estado do formulário.
 *
 *  O caminho de volta de `montarCorpo`, e precisa ser fiel a ele: um campo que
 *  saia daqui vazio some do registro no primeiro salvamento, sem erro nenhum.
 *  É a mesma classe de perda silenciosa que a revisão pegou três vezes no
 *  backend — o dado existe, e a camada do meio o descarta.
 */
