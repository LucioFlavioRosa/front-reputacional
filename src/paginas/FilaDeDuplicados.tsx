/**  O MESMO ATOR CADASTRADO DUAS VEZES — a fila, e as duas respostas.
 *
 *  O QUE O DONO DO PRODUTO PERGUNTOU: "o Valor Econômico é uma empresa grande
 *  que está na base de imprensa; caso tenhamos Valor Econômico no CRM, empresa
 *  e rede social, vamos consultar o mesmo perfil?" — e decidiu: "deveria ser um
 *  único cadastro que vem de Cadastro compartilhado".
 *
 *  O homônimo exato a migration `0076` fundiu sozinha, sem perguntar: nome igual
 *  não pede julgamento. O que chega aqui são os pares que só casam depois de
 *  tirar pontuação e espaço — `valoreconomico` ↔ `Valor Econômico` —, e ali
 *  semelhança NÃO é identidade: `Diário SM` e `Diários M` casam assim, e
 *  `bmc.news` casa com dois veículos. Quem conhece o ator decide.
 *
 *  A TELA É UMA FILA, e não um relatório: cada decisão tira uma linha, e a
 *  seção desaparece quando chega a zero. Por isso "Não é o mesmo" grava — sem
 *  isso o par recusado voltaria idêntico para sempre, e a fila que não anda é a
 *  que ninguém olha.
 *
 *  O NÚMERO DE MENÇÕES está em cada lado de propósito: é ele que diz qual é a
 *  linha com história (`Valor Econômico` tem 86 de clipping; o handle tem 2), e
 *  é sempre a linha com história que sobrevive.
 */

import { useCallback, useEffect, useState } from 'react';

import {
  declararCadastroDistinto,
  duplicadosDeCadastro,
  fundirCadastro,
  type CadastroDuplicado,
  type CandidatoDeFusao,
} from '@/api/cliente';
import { Botao, Carregando, Cartao, FaixaDeErro, Secao } from '@/componentes/basicos';

const ROTULO_DO_TIPO: Record<string, string> = {
  veiculo: 'Veículo de imprensa',
  perfil_rede: 'Perfil de rede',
  orgao: 'Órgão público',
  entidade: 'Entidade',
  investidor: 'Investidor',
  proposicao: 'Proposição',
  area_interna: 'Área interna',
  escritorio: 'Escritório',
  credor: 'Credor',
};

function mencoes(quantas: number): string {
  return quantas === 1 ? '1 menção' : `${quantas} menções`;
}

export function FilaDeDuplicados() {
  const [fila, definirFila] = useState<CadastroDuplicado[] | null>(null);
  const [erro, definirErro] = useState('');
  const [emCurso, definirEmCurso] = useState('');

  const carregar = useCallback(() => {
    duplicadosDeCadastro()
      .then((lista) => {
        definirFila(lista);
        definirErro('');
      })
      .catch((falha: Error) => {
        //: A FILA É ACESSÓRIA: ela não pode derrubar o cadastro inteiro. O erro
        //: aparece no lugar dela e o resto da tela segue funcionando.
        definirFila([]);
        definirErro(falha.message);
      });
  }, []);

  useEffect(carregar, [carregar]);

  async function responder(
    perfil: CadastroDuplicado,
    candidato: CandidatoDeFusao,
    resposta: 'fundir' | 'distinto',
  ) {
    definirEmCurso(`${perfil.id}:${candidato.id}`);
    definirErro('');
    try {
      if (resposta === 'fundir') {
        //: SEM AVISAR A TELA DE FORA: `/api/instituicoes/.../fundir` está sob
        //: uma rota de catálogo, e o barramento de sincronização recarrega o
        //: catálogo inteiro sozinho. Ver `dominio/sincronizacao.ts`.
        await fundirCadastro(perfil.id, candidato.id);
      } else {
        await declararCadastroDistinto(perfil.id, candidato.id);
      }
      carregar();
    } catch (falha) {
      definirErro((falha as Error).message);
    } finally {
      definirEmCurso('');
    }
  }

  if (fila === null) {
    return (
      <Secao titulo="Possíveis duplicados">
        <Cartao>
          <Carregando rotulo="Procurando o mesmo ator cadastrado duas vezes…" />
        </Cartao>
      </Secao>
    );
  }

  //: FILA VAZIA NÃO OCUPA TELA. Não há nada a fazer, e um cartão dizendo
  //: "nenhum duplicado" seria uma linha a mais para ler em toda abertura.
  if (fila.length === 0 && !erro) return null;

  return (
    <Secao
      titulo={`Possíveis duplicados (${fila.length})`}
      ajuda={
        'O mesmo ator cadastrado duas vezes: o fornecedor de redes manda o ' +
        'handle (valoreconomico) e o clipping manda o nome (Valor Econômico). ' +
        'Fundir junta as menções dos dois num cadastro só — e não tem volta.'
      }
    >
      <Cartao>
        {erro ? <FaixaDeErro mensagem={erro} /> : null}

        {fila.map((perfil) => (
          <div
            key={perfil.id}
            style={{
              padding: '14px 0',
              borderTop: '1px solid var(--cinza-0)',
            }}
          >
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{perfil.nome}</p>
            {/* A MESMA GRAMÁTICA DA LINHA DO CADASTRO: "Perfil de rede ·
                Imprensa · 2 menções", na ordem em que se lê o ator. */}
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--cinza-2)' }}>
              {ROTULO_DO_TIPO.perfil_rede}
              {perfil.cargo ? ` · ${perfil.cargo}` : ''}
              {` · ${mencoes(perfil.mencoes)}`}
            </p>

            {perfil.candidatos.map((candidato) => {
              const ocupado = emCurso === `${perfil.id}:${candidato.id}`;
              return (
                <div
                  key={candidato.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    flexWrap: 'wrap',
                    marginTop: 8,
                    paddingLeft: 14,
                  }}
                >
                  <span style={{ fontSize: 13, color: 'var(--cinza-3)' }}>
                    é o mesmo que
                  </span>
                  <strong style={{ fontSize: 14 }}>{candidato.nome}</strong>
                  <span style={{ fontSize: 12, color: 'var(--cinza-2)' }}>
                    {`${ROTULO_DO_TIPO[candidato.tipo] ?? candidato.tipo} · ${mencoes(
                      candidato.mencoes,
                    )}`}
                  </span>
                  <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                    <Botao
                      variante="primario"
                      desabilitado={ocupado}
                      aoClicar={() => void responder(perfil, candidato, 'fundir')}
                      rotuloAcessivel={`Fundir ${perfil.nome} em ${candidato.nome}`}
                      titulo={
                        `As ${mencoes(perfil.mencoes)} de ${perfil.nome} passam para ` +
                        `${candidato.nome}, e o perfil sai do cadastro. Não tem volta.`
                      }
                    >
                      {`Fundir em «${candidato.nome}»`}
                    </Botao>
                    <Botao
                      desabilitado={ocupado}
                      aoClicar={() => void responder(perfil, candidato, 'distinto')}
                      rotuloAcessivel={`${perfil.nome} não é ${candidato.nome}`}
                      titulo="Guarda a decisão: o par não volta a aparecer aqui."
                    >
                      Não é o mesmo
                    </Botao>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </Cartao>
    </Secao>
  );
}
