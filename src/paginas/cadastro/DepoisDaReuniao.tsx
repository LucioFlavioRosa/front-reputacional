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

import type { CSSProperties } from 'react';
import { Campo, Cartao, Secao, estiloDeEntrada } from '@/componentes/basicos';
import { CampoQueCompleta } from '@/componentes/CampoQueCompleta';
import { AjudaDoCampo } from '@/componentes/AjudaDoCampo';
import { ListaDeMateriais } from '@/paginas/cadastro/ListaDeMateriais';
import { MOMENTOS_DE_PREPARACAO, MOMENTOS_POS_REUNIAO, materiaisDe } from '@/paginas/cadastro/formulario';
import type { Formulario } from '@/paginas/cadastro/formulario';
import type { Catalogo } from '@/dominio/derivacoes';
import { GUIA_DO_CADASTRO } from '@/dominio/guiaDoCadastro';

//: MESMO TAMANHO USADO EM `Cadastro.tsx` — as duas metades do mesmo
//: formulário, "Antes" e "Depois", precisam do mesmo peso de título.
const ESTILO_DO_TITULO_DO_CADASTRO: CSSProperties = { fontSize: 24 };

//: A NUMERAÇÃO DOS TÍTULOS (8, 9, 10) CONTINUA A DE `Cadastro.tsx` (1 a 7) —
//: é UM formulário só, em duas abas. Acrescentar ou remover uma seção em
//: qualquer um dos dois arquivos exige renumerar as duas pontas à mão.

/** O campo de texto + o "?" com o que preencher, um exemplo, e o script
 *  sugerido para extrair aquele recorte de uma transcrição — o mesmo
 *  `AjudaDoCampo` do resto do Cadastro, com o script vindo junto no mesmo
 *  balão porque só estes quatro campos têm um. */
function CampoComScript({
  campo,
  rotulo,
  valor,
  aoAlterar,
}: {
  campo: 'relato' | 'encaminhamentos' | 'pendencias' | 'observacoes';
  rotulo: string;
  valor: string;
  aoAlterar: (valor: string) => void;
}) {
  return (
    <Campo rotulo={rotulo} aoLadoDoRotulo={<AjudaDoCampo verbete={GUIA_DO_CADASTRO[campo]} />}>
      <textarea
        style={{ ...estiloDeEntrada, height: 62, padding: 11, resize: 'vertical' }}
        value={valor}
        onChange={(evento) => aoAlterar(evento.target.value)}
      />
    </Campo>
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
      <Secao titulo="8. Outputs da interação" estiloDoTitulo={ESTILO_DO_TITULO_DO_CADASTRO}>
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
      <Secao titulo="9. Desfecho da interação" estiloDoTitulo={ESTILO_DO_TITULO_DO_CADASTRO}>
        <Cartao>
          <div className="grade grade--3" style={{ gap: 16 }}>
            <CampoQueCompleta
              rotulo="Clima"
              aoLadoDoRotulo={<AjudaDoCampo verbete={GUIA_DO_CADASTRO.clima_desfecho} />}
              valor={form.clima}
              aoEscolher={(v) => alterar('clima', v)}
              opcoes={catalogo.dicionarios.climas.map((c) => ({
                valor: c.codigo,
                rotulo: c.nome,
              }))}
            />

            <CampoQueCompleta
              rotulo="Desfecho"
              dica="Em relação ao objetivo da interação."
              vazio="Sem definição"
              aoLadoDoRotulo={<AjudaDoCampo verbete={GUIA_DO_CADASTRO.desfecho_resultado} />}
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
              aoLadoDoRotulo={<AjudaDoCampo verbete={GUIA_DO_CADASTRO.desdobramento} />}
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
        acao={<AjudaDoCampo verbete={GUIA_DO_CADASTRO.materiais_pos} />}
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
