/** Ficha do registro — o modal de leitura.
 *
 *  Mostra só os campos preenchidos, e lista à parte os que estão vazios *e são
 *  aplicáveis àquela frente*. Um campo de imprensa não aparece como "faltando"
 *  numa agenda de governo.
 */

import { useEffect, useState } from 'react';
import { obterInteracao } from '@/api/cliente';
import { usePainel } from '@/estado/painel';
import {
  Carregando,
  Chip,
  ChipDeFrente,
  FaixaDeErro,
  Modal,
} from '@/componentes/basicos';
import { dataCompleta, urlSegura } from '@/dominio/formato';
import { ROTULOS_DE_FRENTE, rotuloDeAbrangencia } from '@/dominio/frentes';
import type { Frente, Interacao } from '@/dominio/tipos';
import {
  nomeDaEsfera,
  nomeDaInstituicao,
  nomeDaPessoa,
  nomeDaUnidade,
  nomeDoInterlocutor,
  nomesDosTemas,
  rotuloDeCodigo,
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

/** Campos de extensão aplicáveis a cada frente — a lista do "o que falta". */
const EXTENSAO_POR_FRENTE: Record<Frente, { campo: string; rotulo: string }[]> = {
  imprensa: [
    { campo: 'formato', rotulo: 'Formato' },
    { campo: 'data_atendida', rotulo: 'Data atendida' },
    { campo: 'data_publicacao', rotulo: 'Data de publicação' },
    { campo: 'link_materia', rotulo: 'Link da matéria' },
    { campo: 'mensagens_chave', rotulo: 'Mensagens-chave' },
  ],
  governo: [
    { campo: 'natureza_orgao', rotulo: 'Natureza do órgão' },
    { campo: 'cargo_interlocutor', rotulo: 'Cargo do interlocutor' },
  ],
  parceiros: [
    { campo: 'natureza_orgao', rotulo: 'Natureza do órgão' },
    { campo: 'cargo_interlocutor', rotulo: 'Cargo do interlocutor' },
  ],
  eventos: [
    { campo: 'natureza_orgao', rotulo: 'Natureza do órgão' },
    { campo: 'cargo_interlocutor', rotulo: 'Cargo do interlocutor' },
    { campo: 'nome_evento', rotulo: 'Nome do evento' },
  ],
  legislativo: [
    { campo: 'casa', rotulo: 'Casa' },
    { campo: 'tramitacao', rotulo: 'Tramitação' },
    { campo: 'prioridade', rotulo: 'Prioridade' },
    { campo: 'ementa', rotulo: 'Ementa' },
  ],
  investidores: [
    { campo: 'tipo_investidor', rotulo: 'Tipo de investidor' },
    { campo: 'formato', rotulo: 'Formato' },
  ],
  interna: [
    { campo: 'natureza', rotulo: 'Natureza' },
    { campo: 'cumprimento', rotulo: 'Cumprimento' },
    { campo: 'complexidade', rotulo: 'Complexidade' },
    { campo: 'prazo_dias', rotulo: 'Prazo em dias' },
    { campo: 'data_retorno', rotulo: 'Data de retorno' },
  ],
};

export function Ficha({ id, aoFechar }: { id: string; aoFechar: () => void }) {
  const { catalogo } = usePainel();
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
      <Modal titulo="Registro" aoFechar={aoFechar}>
        <FaixaDeErro mensagem={erro} />
      </Modal>
    );
  }

  if (!interacao || !catalogo) {
    return (
      <Modal titulo="Registro" aoFechar={aoFechar}>
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
          {interacao.tier ? ` · Tier ${interacao.tier}` : ''}
        </span>
      }
      aoFechar={aoFechar}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        <section>
          <div className="kicker" style={{ marginBottom: 10 }}>
            Conteúdo do registro
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
                Abrir registro / documentação
              </a>
            ) : interacao.registro_url ? (
              <span style={{ fontSize: 12, color: 'var(--cinza-2)' }}>
                O registro tem um endereço que não é um link navegável.
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
              rotulo="Status"
              valor={rotuloDeCodigo(catalogo, 'status', interacao.status)}
            />
            <Metadado rotulo="Clima" valor={rotuloDeCodigo(catalogo, 'climas', interacao.clima)} />
            <Metadado
              rotulo="Resultado"
              valor={rotuloDeCodigo(catalogo, 'resultados', interacao.resultado)}
            />
            <Metadado rotulo="Esfera" valor={nomeDaEsfera(catalogo, interacao.esfera_id)} />
            <Metadado
              rotulo="Unidade de negócio"
              valor={nomeDaUnidade(catalogo, interacao.unidade_negocio_id)}
            />
            <Metadado
              rotulo="Abrangência"
              valor={rotuloDeAbrangencia(interacao.uf)}
            />
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

        {faltando.length ? (
          <p style={{ fontSize: 11, color: 'var(--texto-placeholder)' }}>
            Sem preenchimento nesta frente: {faltando.join(', ')}.
          </p>
        ) : null}
      </div>
    </Modal>
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
