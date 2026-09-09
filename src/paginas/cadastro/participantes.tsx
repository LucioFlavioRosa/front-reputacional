/** Quem participa: pela Aegea e pela outra parte.
 *
 *  Ficam FORA de `Cadastro.tsx`: as duas listas são auto-contidas, e a tela
 *  do formulário já é longa o bastante sem elas.
 */

import { useId } from 'react';

import { Botao } from '@/componentes/basicos';
import { CampoQueCompleta } from '@/componentes/CampoQueCompleta';
import { PAPEIS, PRESENCAS } from '@/paginas/cadastro/formulario';
import type {
  ParticipanteAegeaNoForm,
  ParticipanteNoForm,
} from '@/paginas/cadastro/formulario';

export function ListaDaAegea({
  participantes,
  pessoas,
  aoMudar,
}: {
  participantes: ParticipanteAegeaNoForm[];
  pessoas: { id: string; nome: string; eh_porta_voz: boolean }[];
  aoMudar: (lista: ParticipanteAegeaNoForm[]) => void;
}) {
  const trocar = (indice: number, mudanca: Partial<ParticipanteAegeaNoForm>) =>
    aoMudar(participantes.map((p, i) => (i === indice ? { ...p, ...mudanca } : p)));

  return (
    <>
      {participantes.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--cinza-3)', margin: '0 0 12px' }}>
          Acrescente quem representa a Aegea.
        </p>
      )}

      {participantes.map((participante, indice) => (
        <div key={indice} className="linha-participante">
          {/* Rótulo visível só na primeira linha, `aria-label` em todas: sem
              ele a árvore de acessibilidade lê "caixa de combinação" seis
              vezes sem dizer de quê. Mesma razão da outra lista. */}
          <CampoQueCompleta
            rotulo={indice === 0 ? 'Pessoa' : undefined}
            ariaLabel={`Pessoa da Aegea ${indice + 1}`}
            obrigatorio
            valor={participante.pessoa_aegea_id}
            aoEscolher={(escolhido) => {
              // O PAPEL SEGUE QUEM FOI ESCOLHIDO. `eh_porta_voz` já diz quem
              // fala pela companhia; deixar o padrão em 'porta_voz' para todo
              // mundo faria alguém da equipe entrar contando no painel de
              // exposição sem ninguém ter decidido isso. Continua editável — é
              // um padrão, não uma trava.
              const pessoa = pessoas.find((p) => p.id === escolhido);
              trocar(indice, {
                pessoa_aegea_id: escolhido,
                papel: pessoa?.eh_porta_voz ? 'porta_voz' : 'equipe',
              });
            }}
            opcoes={pessoas.map((pessoa) => ({
              valor: pessoa.id,
              rotulo: pessoa.nome,
              detalhe: pessoa.eh_porta_voz ? 'porta-voz' : undefined,
            }))}
          />

          <div style={{ paddingBottom: 4 }}>
            <Botao
              variante="secundario"
              aoClicar={() => aoMudar(participantes.filter((_, i) => i !== indice))}
              rotuloAcessivel={`Remover a pessoa da Aegea ${indice + 1}`}
            >
              Remover
            </Botao>
          </div>

          <div className="linha-participante__miudos">
            <CampoQueCompleta
              rotulo={indice === 0 ? 'Papel' : undefined}
              ariaLabel={`Papel da pessoa da Aegea ${indice + 1}`}
              obrigatorio
              valor={participante.papel}
              aoEscolher={(v) => trocar(indice, { papel: v })}
              opcoes={PAPEIS.map((op) => ({ valor: op.valor, rotulo: op.rotulo }))}
            />

            <CampoQueCompleta
              rotulo={indice === 0 ? 'Presença' : undefined}
              ariaLabel={`Presença da pessoa da Aegea ${indice + 1}`}
              obrigatorio
              valor={participante.presenca}
              aoEscolher={(v) => trocar(indice, { presenca: v })}
              opcoes={PRESENCAS.map((op) => ({ valor: op.valor, rotulo: op.rotulo }))}
            />
          </div>
        </div>
      ))}

      <Botao
        aoClicar={() =>
          aoMudar([
            ...participantes,
            { pessoa_aegea_id: '', papel: 'porta_voz', presenca: '' },
          ])
        }
      >
        Acrescentar pessoa
      </Botao>
    </>
  );
}

export function ListaDeParticipantes({
  participantes,
  interlocutores,
  rotuloEsperado,
  aoMudar,
}: {
  participantes: ParticipanteNoForm[];
  interlocutores: { id: string; nome: string }[];
  //: Como o campo de instituicao se chama NESTA frente. Vem de fora para a
  //: mensagem nao contradizer o rotulo — no Legislativo ele e "Proposicao".
  rotuloEsperado: string;
  aoMudar: (lista: ParticipanteNoForm[]) => void;
}) {
  // `name` ÚNICO POR INSTÂNCIA. Fixo, duas listas na mesma página
  // compartilhariam o grupo de rádio e marcar o principal numa desmarcaria o
  // da outra. Hoje só existe uma lista; a Ficha vai reusar este componente.
  const grupo = useId();

  const trocar = (indice: number, mudanca: Partial<ParticipanteNoForm>) =>
    aoMudar(participantes.map((p, i) => (i === indice ? { ...p, ...mudanca } : p)));

  const marcarPrincipal = (indice: number) =>
    // Desmarca os outros no mesmo gesto. Deixar isso para o servidor faria a
    // tela mostrar dois principais até o próximo salvamento.
    aoMudar(participantes.map((p, i) => ({ ...p, principal: i === indice })));

  return (
    <>
      {participantes.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--cinza-3)', margin: '0 0 12px' }}>
          {interlocutores.length === 0
            ? `Escolha o ${rotuloEsperado} em "Identificação" primeiro.`
            : 'Acrescente quem vai à reunião.'}
        </p>
      )}

      {participantes.map((participante, indice) => (
        <div key={indice} className="linha-participante">
          {/* O RÓTULO VISÍVEL só na primeira linha — repeti-lo em todas
              viraria ruído numa lista de seis pessoas. Mas `Campo` é um
              `<label>`, e rótulo vazio deixa o controle SEM NOME ACESSÍVEL:
              quem usa leitor de tela ouviria "caixa de combinação" seis vezes,
              sem saber do quê. O `aria-label` dá o nome em todas as linhas. */}
          <CampoQueCompleta
            rotulo={indice === 0 ? 'Pessoa' : undefined}
            ariaLabel={`Pessoa ${indice + 1}`}
            obrigatorio
            valor={participante.interlocutor_id}
            aoEscolher={(v) => trocar(indice, { interlocutor_id: v })}
            opcoes={interlocutores.map((pessoa) => ({
              valor: pessoa.id,
              rotulo: pessoa.nome,
            }))}
          />

          <div style={{ paddingBottom: 4 }}>
            <Botao
              variante="secundario"
              aoClicar={() => aoMudar(participantes.filter((_, i) => i !== indice))}
              rotuloAcessivel={`Remover a pessoa ${indice + 1}`}
            >
              Remover
            </Botao>
          </div>

          <div className="linha-participante__miudos">
            <CampoQueCompleta
              rotulo={indice === 0 ? 'Presença' : undefined}
              ariaLabel={`Presença da pessoa ${indice + 1}`}
              obrigatorio
              valor={participante.presenca}
              aoEscolher={(v) => trocar(indice, { presenca: v })}
              opcoes={PRESENCAS.map((op) => ({ valor: op.valor, rotulo: op.rotulo }))}
            />

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 13,
                paddingBottom: 9,
                whiteSpace: 'nowrap',
              }}
            >
              <input
                type="radio"
                name={grupo}
                // O TEXTO VISÍVEL "Principal" se repete em toda linha, e sozinho
                // ele é o nome acessível de TODOS os rádios: a árvore de
                // acessibilidade lia `radio "Principal"` seis vezes, sem dizer de
                // quem. O `aria-label` traz a linha junto.
                aria-label={`Pessoa ${indice + 1} representa a outra parte`}
                checked={participante.principal}
                onChange={() => marcarPrincipal(indice)}
              />
              Principal
            </label>
          </div>
        </div>
      ))}

      <Botao
        aoClicar={() =>
          aoMudar([
            ...participantes,
            { interlocutor_id: '', presenca: '', principal: false },
          ])
        }
      >
        Acrescentar pessoa
      </Botao>
    </>
  );
}
