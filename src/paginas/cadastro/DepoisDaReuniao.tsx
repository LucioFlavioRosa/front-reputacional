/** A aba "Depois da reunião": o que só existe quando o encontro já houve.
 *
 *  UMA FRONTEIRA DE VERDADE, e não só uma aba: quem preenche isto está num
 *  dia diferente de quem marcou a agenda. Por isso mora em arquivo próprio, e
 *  não misturada de linha com os campos de antes.
 *
 *  RECEBE `form` E `definirForm`, e não um punhado de campos soltos. Passar
 *  relato, encaminhamentos, pendências, observações, clima, resultado e
 *  desdobramento um a um seriam sete entradas para dizer "o formulário" — e
 *  cada campo novo mexeria na assinatura.
 */

import { useState } from 'react';
import type { CSSProperties } from 'react';
import { Cartao, Secao, estiloDeEntrada } from '@/componentes/basicos';
import { CampoQueCompleta } from '@/componentes/CampoQueCompleta';
import { ListaDeMateriais } from '@/paginas/cadastro/ListaDeMateriais';
import { MOMENTOS_DE_PREPARACAO, MOMENTOS_POS_REUNIAO, materiaisDe } from '@/paginas/cadastro/formulario';
import type { Formulario } from '@/paginas/cadastro/formulario';
import type { Catalogo } from '@/dominio/derivacoes';

//: MESMO TAMANHO USADO EM `Cadastro.tsx` — as duas metades do mesmo
//: formulário, "Antes" e "Depois", precisam do mesmo peso de título.
const ESTILO_DO_TITULO_DO_CADASTRO: CSSProperties = { fontSize: 24 };

//: A NUMERAÇÃO DOS TÍTULOS (8, 9, 10) CONTINUA A DE `Cadastro.tsx` (1 a 7) —
//: é UM formulário só, em duas abas. Acrescentar ou remover uma seção em
//: qualquer um dos dois arquivos exige renumerar as duas pontas à mão.

//: UM SCRIPT POR CAMPO, e não um só para os quatro: quem cola a transcrição
//: para tirar só as pendências não quer reler a resposta inteira procurando
//: o pedaço certo — cada prompt já pede exatamente aquele recorte.
const SCRIPTS_DE_TRANSCRICAO: Record<
  'relato' | 'encaminhamentos' | 'pendencias' | 'observacoes',
  string
> = {
  relato:
    'A partir da transcrição da reunião abaixo, escreva um RELATO objetivo do que foi discutido: os principais pontos abordados, o que cada parte disse e o tom geral da conversa. Sem opinião — só o que de fato foi dito.\n\nTranscrição:\n[colar aqui]',
  encaminhamentos:
    'A partir da transcrição da reunião abaixo, liste os ENCAMINHAMENTOS combinados: o que ficou definido como próximo passo, quem ficou responsável por cada ação e até quando. Inclua também qualquer repercussão relevante (reações, compromissos assumidos).\n\nTranscrição:\n[colar aqui]',
  pendencias:
    'A partir da transcrição da reunião abaixo, liste as PENDÊNCIAS: o que ficou em aberto, sem resposta definitiva, ou que depende de uma ação futura de qualquer uma das partes.\n\nTranscrição:\n[colar aqui]',
  observacoes:
    'A partir da transcrição da reunião abaixo, escreva OBSERVAÇÕES gerais que não caibam num relato formal: contexto informal, sinais do clima da conversa, alertas para quem for ler o registro depois.\n\nTranscrição:\n[colar aqui]',
};

/** O campo de texto + o balão com o script sugerido, ao passar o mouse no "?".
 *
 *  POR QUE UM BOTÃO DE COPIAR DENTRO DO BALÃO, e não um link "ver script":
 *  o script é longo e ninguém quer selecionar à mão dentro de um balão que
 *  some se o mouse escorregar. Copiar de um clique é o que faz "todos
 *  possam copiar esse script e jogar numa transcrição" valer de verdade. */
function CampoComScript({
  campo,
  rotulo,
  valor,
  aoAlterar,
}: {
  campo: keyof typeof SCRIPTS_DE_TRANSCRICAO;
  rotulo: string;
  valor: string;
  aoAlterar: (valor: string) => void;
}) {
  const [copiado, definirCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(SCRIPTS_DE_TRANSCRICAO[campo]);
      definirCopiado(true);
      window.setTimeout(() => definirCopiado(false), 2000);
    } catch {
      /* área de transferência negada pelo navegador — o texto do balão
         continua visível e selecionável à mão */
    }
  }

  return (
    <label style={{ display: 'block' }}>
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
          fontWeight: 500,
          color: 'var(--cinza-3)',
          marginBottom: 5,
        }}
      >
        {rotulo}
        <span className="dica-flutuante">
          <span
            aria-hidden
            tabIndex={0}
            title="Ver script sugerido para extrair este campo de uma transcrição"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 16,
              height: 16,
              borderRadius: '50%',
              border: '1px solid var(--cinza-2)',
              color: 'var(--cinza-2)',
              fontSize: 10,
              fontWeight: 700,
              cursor: 'help',
            }}
          >
            ?
          </span>
          <span className="dica-flutuante__balao" role="tooltip" style={{ width: 280, maxWidth: 280 }}>
            <span
              style={{
                display: 'block',
                fontWeight: 700,
                color: 'var(--cinza-4)',
                marginBottom: 6,
              }}
            >
              Script sugerido — cole numa IA junto com a transcrição
            </span>
            <span style={{ display: 'block', marginBottom: 8, whiteSpace: 'pre-line' }}>
              {SCRIPTS_DE_TRANSCRICAO[campo]}
            </span>
            <button
              type="button"
              onClick={copiar}
              style={{
                border: 'none',
                background: 'var(--azul-mar)',
                color: 'var(--branco)',
                borderRadius: 'var(--r-btn)',
                padding: '5px 10px',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {copiado ? 'Copiado!' : 'Copiar script'}
            </button>
          </span>
        </span>
      </span>
      <textarea
        style={{ ...estiloDeEntrada, height: 62, padding: 11, resize: 'vertical' }}
        value={valor}
        onChange={(evento) => aoAlterar(evento.target.value)}
      />
    </label>
  );
}

export function DepoisDaReuniao({
  form,
  alterar,
  definirForm,
  catalogo,
  id,
  aoFalhar,
}: {
  form: Formulario;
  alterar: <C extends keyof Formulario>(campo: C, valor: Formulario[C]) => void;
  definirForm: (atualizar: (atual: Formulario) => Formulario) => void;
  catalogo: Catalogo;
  /** A agenda em edição. Sem ela não há pasta para o arquivo subir. */
  id?: string;
  aoFalhar: (mensagem: string) => void;
}) {
  return (
    <>
      <Secao
        titulo="8. Outputs da interação"
        ajuda="O que ficou escrito depois da reunião: relato, encaminhamentos, pendências e observações."
        estiloDoTitulo={ESTILO_DO_TITULO_DO_CADASTRO}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {(
            [
              ['relato', 'Relato'],
              ['encaminhamentos', 'Repercussão e encaminhamentos'],
              ['pendencias', 'Pendências'],
              ['observacoes', 'Observações'],
            ] as const
          ).map(([campo, rotulo]) => (
            <CampoComScript
              key={campo}
              campo={campo}
              rotulo={rotulo}
              valor={form[campo]}
              aoAlterar={(v) => alterar(campo, v)}
            />
          ))}
          {/* "POSICIONAMENTO DA COMPANHIA" E "REGISTRO / DOCUMENTACAO" NAO
              SE PREENCHEM AQUI. Documento tem secao propria, com upload e
              momento; um link solto neste bloco seria uma terceira forma de
              guardar arquivo, sem dizer se e de antes ou de depois. As duas
              colunas continuam no banco, e a ficha mostra o que ja tem. */}
        </div>
      </Secao>

      {/* O DESFECHO — o que só existe DEPOIS da agenda acontecer.
          Estes três campos estavam em "Situação e expectativa", junto do que
          se sabe antes. Quem abre o formulário para marcar uma reunião não tem
          como responder nenhum deles, e o formulário pedia mesmo assim.

          Fica logo depois de "Conteúdo" de propósito: o relato acabou de ser
          escrito ali, e estes campos são a classificação daquele mesmo texto.
          Separá-los faria voltar a rolar a tela para dizer duas vezes como a
          reunião foi. */}
      <Secao
        titulo="9. Desfecho da interação"
        ajuda="Como a reunião foi, se o objetivo foi atingido e se vai ter continuidade."
        estiloDoTitulo={ESTILO_DO_TITULO_DO_CADASTRO}
      >
        <Cartao>
          <div className="grade grade--3" style={{ gap: 16 }}>
            <CampoQueCompleta
              rotulo="Clima"
              ajuda="Como a conversa de fato foi: tensa, neutra ou positiva."
              valor={form.clima}
              aoEscolher={(v) => alterar('clima', v)}
              opcoes={catalogo.dicionarios.climas.map((c) => ({
                valor: c.codigo,
                rotulo: c.nome,
              }))}
            />

            <CampoQueCompleta
              rotulo="Desfecho"
              ajuda="Em relação ao objetivo da interação: avançou, ficou no mesmo ou recuou."
              vazio="Sem definição"
              valor={form.resultado}
              aoEscolher={(v) => alterar('resultado', v)}
              opcoes={catalogo.dicionarios.resultados.map((r) => ({
                valor: r.codigo,
                rotulo: r.nome,
              }))}
            />

            {/* "Não informado" é o padrão, e não "não". A diferença entre
                não saber e saber que não é o que esta plataforma existe para
                reduzir. */}
            <CampoQueCompleta
              rotulo="Desdobra em outra interação?"
              ajuda="Vai haver um próximo encontro por causa desta conversa?"
              valor={form.preve_desdobramento}
              aoEscolher={(v) =>
                alterar('preve_desdobramento', v as Formulario['preve_desdobramento'])
              }
              opcoes={[
                { valor: 'sim', rotulo: 'Sim, prevê continuidade' },
                { valor: 'nao', rotulo: 'Não' },
              ]}
            />
          </div>
        </Cartao>
      </Secao>

      <Secao
        titulo="10. Materiais pós-reunião"
        ajuda="O que saiu da reunião. Obtido é o que a outra parte entregou; produzido é o que a Aegea escreveu depois."
        estiloDoTitulo={ESTILO_DO_TITULO_DO_CADASTRO}
      >
        <Cartao>
          <p style={{ fontSize: 13, color: 'var(--cinza-2)', margin: '0 0 16px' }}>
            O que saiu da reunião. <strong>Obtido</strong> é o que a outra parte
            entregou; <strong>produzido</strong> é o que a Aegea escreveu depois.
          </p>
          <ListaDeMateriais
            materiais={materiaisDe(form.materiais, MOMENTOS_POS_REUNIAO)}
            momentos={MOMENTOS_POS_REUNIAO}
            interacaoId={id}
            aoFalhar={aoFalhar}
            temasDaAgenda={form.temas}
            assuntos={catalogo.dicionarios.temas}
            aoMudar={(atualizar) =>
              definirForm((atual) => ({
                ...atual,
                materiais: [
                  ...materiaisDe(atual.materiais, MOMENTOS_DE_PREPARACAO),
                  ...atualizar(materiaisDe(atual.materiais, MOMENTOS_POS_REUNIAO)),
                ],
              }))
            }
          />
        </Cartao>
      </Secao>

    </>
  );
}
