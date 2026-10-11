/**  OS CADASTROS QUE NASCERAM DE PLANILHA E ESPERAM CONFERÊNCIA.
 *
 *  PEDIDO DO DONO DO PRODUTO (11/10/2026), cobrado duas vezes:
 *
 *    "Quando subirmos uma base que tenha algum ponto de conferência de cadastro,
 *    pode subir sem problemas. Porém, dentro de cada uma das 3 abas de Cadastro
 *    compartilhado, uma aba específica para cadastros que precisam de serem
 *    revisados para serem consolidados na base de instituições, contatos, temas e
 *    representantes da Aegea. Assim o profissional consegue subir a planilha sem
 *    problemas e pode revisar depois, e inclusive pode ser trabalho de outra
 *    pessoa. Queremos dar padronização, mas com menor impacto."
 *
 *  "MENOR IMPACTO" É O QUE DESENHA ESTA TELA. Ela não pede nada: não há campo
 *  obrigatório, não há formulário, e nada aqui impede a planilha de subir — isso
 *  já aconteceu. O que ela faz é MOSTRAR o que entrou sem conferência e deixar
 *  dizer "este está certo". Padronização que trava a entrada do dado é
 *  padronização que faz a pessoa registrar em outro lugar.
 *
 *  A LISTA É UMA FILA, e não um relatório: cada "Está certo" tira uma linha, e a
 *  seção desaparece quando chega a zero — o mesmo desenho de `FilaDeDuplicados`,
 *  pela mesma razão.
 *
 *  O `contexto` AO LADO DO NOME é a linha mais importante da tela. O motivo mais
 *  frequente é "apareceu em 2 instituições na mesma planilha", que cria DOIS
 *  cadastros com o mesmo nome, de propósito. Sem a instituição ao lado, a fila
 *  mostraria "Artur Santa" duas vezes, com o mesmo motivo, e quem revisa não
 *  teria como saber qual é o do Banco XP e qual é o da XP Asset.
 */

import { useCallback, useEffect, useState } from 'react';

import {
  consolidarCadastro,
  filaDeRevisao,
  type AbaDeRevisao,
  type CadastroPendente,
} from '@/api/cliente';
import { Botao, Carregando, Cartao, FaixaDeErro, Secao } from '@/componentes/basicos';

/** Qual das três abas de Cadastro compartilhado está pedindo a sua fila. */
export type AbaDoCadastro = 'instituicoes' | 'assuntos' | 'porta_vozes';

//: O rótulo de cada tabela, para a linha dizer de que cadastro ela é.
//:
//: SÓ A ABA `instituicoes` MOSTRA ISSO, e por isso o rótulo existe: ela junta
//: DUAS tabelas — a instituição e a pessoa que fala por ela. Nas outras duas a
//: aba já diz o que é, e repetir "Tema" em cada linha seria ruído.
const ROTULO_DA_TABELA: Record<string, string> = {
  instituicao: 'Instituição',
  interlocutor: 'Contato',
  tema: 'Tema',
  pessoa_aegea: 'Representante',
};

const MOTIVO_GENERICO =
  'Entrou por planilha e ninguém conferiu o enquadramento ainda.';

function quantos(n: number): string {
  return n === 1 ? '1 cadastro' : `${n} cadastros`;
}

export function FilaDeRevisao({ aba }: { aba: AbaDoCadastro }) {
  const [fila, definirFila] = useState<AbaDeRevisao | null>(null);
  const [erro, definirErro] = useState('');
  const [emCurso, definirEmCurso] = useState('');
  //: O QUE OUTRA PESSOA JÁ TINHA CONSOLIDADO, para a tela dizer isso em vez de
  //: piscar uma confirmação que não era dela. Ver `consolidarCadastro`.
  const [deOutraPessoa, definirDeOutraPessoa] = useState<string[]>([]);

  const carregar = useCallback(() => {
    filaDeRevisao()
      .then((abas) => {
        definirFila(abas.find((a) => a.id === aba) ?? { id: aba, rotulo: '', pendentes: [] });
        definirErro('');
      })
      .catch((falha: Error) => {
        //: A FILA É ACESSÓRIA: ela não pode derrubar o cadastro inteiro. O erro
        //: aparece no lugar dela e o resto da tela segue funcionando. É também o
        //: que mantém a aba utilizável para quem não tem permissão de
        //: administrar cadastros, e recebe 403 aqui.
        definirFila({ id: aba, rotulo: '', pendentes: [] });
        definirErro(falha.message);
      });
  }, [aba]);

  useEffect(carregar, [carregar]);

  async function consolidar(pendente: CadastroPendente) {
    definirEmCurso(`${pendente.tipo}:${pendente.id}`);
    definirErro('');
    try {
      const { ja_estava_consolidado } = await consolidarCadastro(
        pendente.tipo,
        pendente.id,
      );
      if (ja_estava_consolidado) {
        definirDeOutraPessoa((antes) => [...antes, pendente.nome]);
      }
      //: RECARREGA A FILA INTEIRA, e não remove a linha na mão: outra pessoa
      //: pode ter consolidado três enquanto esta tela estava aberta, e tirar só
      //: a que foi clicada deixaria as outras duas na tela, clicáveis.
      carregar();
    } catch (falha) {
      definirErro((falha as Error).message);
    } finally {
      definirEmCurso('');
    }
  }

  if (fila === null) {
    return (
      <Secao titulo="Esperando conferência">
        <Cartao>
          <Carregando rotulo="Procurando cadastros que entraram por planilha…" />
        </Cartao>
      </Secao>
    );
  }

  //: FILA VAZIA NÃO OCUPA TELA, como em `FilaDeDuplicados`: não há nada a fazer,
  //: e um cartão dizendo "nada pendente" seria uma linha a mais para ler em
  //: toda abertura do cadastro.
  if (fila.pendentes.length === 0 && !erro && deOutraPessoa.length === 0) return null;

  return (
    <Secao
      titulo={`Esperando conferência (${fila.pendentes.length})`}
      ajuda={
        'Cadastros que entraram por planilha e ninguém conferiu ainda. Eles já ' +
        'estão em uso — a agenda e a menção apontam para eles —, só falta ' +
        'alguém confirmar o enquadramento. Corrigir é na lista abaixo; aqui se ' +
        'diz que está certo.'
      }
    >
      <Cartao>
        {erro ? <FaixaDeErro mensagem={erro} /> : null}

        {deOutraPessoa.length > 0 ? (
          <p
            role="status"
            style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--cinza-2)' }}
          >
            {`Outra pessoa já havia conferido ${quantos(deOutraPessoa.length)}: ` +
              `${deOutraPessoa.join(', ')}.`}
          </p>
        ) : null}

        {fila.pendentes.map((pendente) => {
          const ocupado = emCurso === `${pendente.tipo}:${pendente.id}`;
          return (
            <div
              key={`${pendente.tipo}:${pendente.id}`}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 12,
                flexWrap: 'wrap',
                padding: '12px 0',
                borderTop: '1px solid var(--cinza-0)',
              }}
            >
              <div style={{ flex: 1, minWidth: 220 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>
                  {pendente.nome}
                </p>
                {/* A MESMA GRAMÁTICA DA LINHA DO CADASTRO: "Contato · Banco XP ·
                    Diretor", na ordem em que se lê o ator. */}
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--cinza-2)' }}>
                  {aba === 'instituicoes'
                    ? `${ROTULO_DA_TABELA[pendente.tipo] ?? pendente.tipo}${
                        pendente.contexto ? ` · ${pendente.contexto}` : ''
                      }`
                    : (pendente.contexto ?? '')}
                </p>
                <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--cinza-3)' }}>
                  {pendente.motivo ?? MOTIVO_GENERICO}
                </p>
              </div>

              <Botao
                variante="primario"
                desabilitado={ocupado}
                aoClicar={() => void consolidar(pendente)}
                rotuloAcessivel={`Confirmar que o cadastro de ${pendente.nome} está certo`}
                titulo={
                  'Tira este cadastro da fila. Não muda nada no registro — se ' +
                  'ele estiver errado, corrija na lista abaixo primeiro.'
                }
              >
                Está certo
              </Botao>
            </div>
          );
        })}
      </Cartao>
    </Secao>
  );
}
