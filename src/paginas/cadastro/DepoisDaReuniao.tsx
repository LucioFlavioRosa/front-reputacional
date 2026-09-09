/** A aba "Depois da reunião": o que só existe quando o encontro já houve.
 *
 *  SAIU DO COMPONENTE DE 921 LINHAS. A aba já era uma fronteira de verdade —
 *  quem preenche isto está num dia diferente de quem marcou a agenda —, e o que
 *  ela precisa saber cabe em cinco entradas. Enquanto morava dentro do
 *  formulário, essa fronteira existia só na tela: no código, os campos de antes
 *  e os de depois eram vizinhos de linha.
 *
 *  RECEBE `form` E `definirForm`, e não um punhado de campos soltos. Passar
 *  relato, encaminhamentos, pendências, observações, clima, resultado e
 *  desdobramento um a um seriam sete entradas para dizer "o formulário" — e
 *  cada campo novo mexeria na assinatura.
 */

import { Campo, Cartao, Secao, estiloDeEntrada } from '@/componentes/basicos';
import { CampoQueCompleta } from '@/componentes/CampoQueCompleta';
import { ListaDeMateriais } from '@/paginas/cadastro/ListaDeMateriais';
import { MOMENTOS_DE_PREPARACAO, MOMENTOS_POS_REUNIAO, materiaisDe } from '@/paginas/cadastro/formulario';
import type { Formulario } from '@/paginas/cadastro/formulario';
import type { Catalogo } from '@/dominio/derivacoes';

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
      <Secao titulo="Conteúdo">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {(
            [
              ['relato', 'Relato'],
              ['encaminhamentos', 'Repercussão e encaminhamentos'],
              ['pendencias', 'Pendências'],
              ['observacoes', 'Observações'],
            ] as const
          ).map(([campo, rotulo]) => (
            <Campo key={campo} rotulo={rotulo}>
              <textarea
                style={{ ...estiloDeEntrada, height: 62, padding: 11, resize: 'vertical' }}
                value={form[campo]}
                onChange={(evento) => alterar(campo, evento.target.value)}
              />
            </Campo>
          ))}
          {/* "POSICIONAMENTO DA COMPANHIA" E "REGISTRO / DOCUMENTACAO" SAIRAM.
              O registro apontava para um link solto, e materiais agora tem
              secao propria, com upload e momento — o campo virou a terceira
              forma de guardar documento, sem dizer se e de antes ou de depois.
              Os dois continuam no banco: o que ja foi preenchido segue la, e a
              ficha continua mostrando. */}
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
      <Secao titulo="Desfecho da agenda">
        <Cartao>
          {/* "Depois da reunião." saiu daqui: a aba acima passou a dizer isso,
              e o cartão repetia a mesma frase a dois centímetros dela. */}
          <div className="grade grade--3" style={{ gap: 16 }}>
            <CampoQueCompleta
              rotulo="Clima"
              valor={form.clima}
              aoEscolher={(v) => alterar('clima', v)}
              opcoes={catalogo.dicionarios.climas.map((c) => ({
                valor: c.codigo,
                rotulo: c.nome,
              }))}
            />

            <CampoQueCompleta
              rotulo="Desfecho"
              dica="Em relação ao objetivo da agenda."
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
              rotulo="Desdobra em outra agenda?"
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

      <Secao titulo="Materiais pós-reunião">
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
