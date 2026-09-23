/** Os campos que só uma frente tem — e que, até aqui, ninguém conseguia
 *  preencher.
 *
 *  A ficha contava "sem preenchimento nesta frente: casa, tramitação…" e o
 *  filtro "Tipo de investidor" filtrava por um campo que só a importação
 *  tinha alimentado: o dado existia, viajava no `form.extensao`, e a tela não
 *  pedia. Aqui ele passa a ser pedido, com a lista que a Administração
 *  conhece quando é dicionário (`formatos`, `casas`, `tramitacoes`,
 *  `tipos_investidor`) e com a lista fechada do back quando é enumeração
 *  (`PRIORIDADES`, `NATUREZAS`, `CUMPRIMENTOS`, `COMPLEXIDADES` — ver
 *  `dominio/frentes.ts`; o servidor recusa o que não estiver nelas).
 *
 *  `natureza_orgao` NÃO é pedida: está sendo aposentada pela categoria de
 *  público da instituição (`0036`), e o servidor já ignora o campo em
 *  interação nova.
 */

import { CampoDeDicionario, CampoDeTexto } from '@/paginas/cadastro/campos';
import { Campo, estiloDeEntrada } from '@/componentes/basicos';
import { CampoQueCompleta } from '@/componentes/CampoQueCompleta';
import { ENUMERACOES_DA_EXTENSAO } from '@/dominio/frentes';
import type { Dicionarios, Frente } from '@/dominio/tipos';

type Extensao = Record<string, string>;

function CampoDeEnumeracao({
  rotulo,
  chave,
  valor,
  aoMudar,
  ajuda,
}: {
  rotulo: string;
  chave: keyof typeof ENUMERACOES_DA_EXTENSAO;
  valor: string | undefined;
  aoMudar: (valor: string) => void;
  ajuda?: string;
}) {
  return (
    <CampoQueCompleta
      rotulo={rotulo}
      valor={valor ?? ''}
      aoEscolher={aoMudar}
      ajuda={ajuda}
      opcoes={ENUMERACOES_DA_EXTENSAO[chave].map((item) => ({
        valor: item.codigo,
        rotulo: item.nome,
      }))}
    />
  );
}

export function CamposDaFrente({
  frente,
  extensao,
  dicionarios,
  aoMudar,
}: {
  frente: Frente;
  extensao: Extensao;
  dicionarios: Dicionarios;
  aoMudar: (campo: string, valor: string) => void;
}) {
  const campo = (nome: string) => ({
    valor: extensao[nome],
    aoMudar: (valor: string) => aoMudar(nome, valor),
  });
  //: `formato` tem escopo: o de imprensa (entrevista, release…) não é o de
  //: investidores (roadshow, call de resultados…). `geral` serve aos dois.
  const formatos = (escopo: 'imprensa' | 'investidores') =>
    dicionarios.formatos.filter((f) => f.escopo === escopo || f.escopo === 'geral');

  switch (frente) {
    case 'imprensa':
      return (
        <div className="grade grade--3" style={{ gap: 16 }}>
          <CampoDeDicionario
            rotulo="Formato"
            itens={formatos('imprensa')}
            ajuda="Entrevista, release, coletiva… o formato desta pauta."
            {...campo('formato')}
          />
          <CampoDeTexto
            rotulo="Data atendida"
            tipo="date"
            ajuda="O dia em que a Aegea atendeu o pedido da imprensa."
            {...campo('data_atendida')}
          />
          <CampoDeTexto
            rotulo="Data de publicação"
            tipo="date"
            ajuda="O dia em que a matéria saiu, se já saiu."
            {...campo('data_publicacao')}
          />
          <div style={{ gridColumn: 'span 2' }}>
            <CampoDeTexto
              rotulo="Link da matéria"
              tipo="url"
              ajuda="O endereço da publicação, quando existir."
              {...campo('link_materia')}
            />
          </div>
          <CampoDeTexto
            rotulo="Mensagens-chave"
            ajuda="As frases que a Aegea quis deixar. Separe com ponto e vírgula."
            {...campo('mensagens_chave')}
          />
        </div>
      );
    case 'governo':
    case 'parceiros':
    case 'bancos_credores':
      return (
        <div className="grade grade--3" style={{ gap: 16 }}>
          <CampoDeTexto
            rotulo="Cargo do interlocutor"
            ajuda="O cargo de quem conversou conosco nesta agenda."
            {...campo('cargo_interlocutor')}
          />
        </div>
      );
    case 'eventos':
      return (
        <div className="grade grade--3" style={{ gap: 16 }}>
          <div style={{ gridColumn: 'span 2' }}>
            <CampoDeTexto
              rotulo="Nome do evento"
              ajuda="O nome do congresso, seminário ou encontro."
              {...campo('nome_evento')}
            />
          </div>
          <CampoDeTexto
            rotulo="Cargo do interlocutor"
            ajuda="O cargo de quem conversou conosco neste evento."
            {...campo('cargo_interlocutor')}
          />
        </div>
      );
    case 'legislativo':
      return (
        <div className="grade grade--3" style={{ gap: 16 }}>
          <CampoDeDicionario
            rotulo="Casa"
            itens={dicionarios.casas}
            ajuda="Câmara, Senado, Assembleia… onde o tema tramita."
            {...campo('casa')}
          />
          <CampoDeDicionario
            rotulo="Tramitação"
            itens={dicionarios.tramitacoes}
            ajuda="Em que estágio o projeto está hoje."
            {...campo('tramitacao')}
          />
          <CampoDeEnumeracao
            rotulo="Prioridade"
            chave="prioridade"
            ajuda="O quanto este tema importa para a Aegea neste momento."
            {...campo('prioridade')}
          />
          <div style={{ gridColumn: 'span 3' }}>
            <Campo
              rotulo="Ementa"
              ajuda="O resumo do que o projeto trata, em poucas linhas."
            >
              <textarea
                style={{ ...estiloDeEntrada, minHeight: 74, resize: 'vertical' }}
                value={extensao.ementa ?? ''}
                onChange={(evento) => aoMudar('ementa', evento.target.value)}
              />
            </Campo>
          </div>
        </div>
      );
    case 'investidores':
      return (
        <div className="grade grade--3" style={{ gap: 16 }}>
          <CampoDeDicionario
            rotulo="Tipo de investidor"
            itens={dicionarios.tipos_investidor}
            ajuda="Fundo, banco, rating… que tipo de investidor é este."
            {...campo('tipo_investidor')}
          />
          <CampoDeDicionario
            rotulo="Formato"
            itens={formatos('investidores')}
            ajuda="Roadshow, call de resultados, reunião one-on-one…"
            {...campo('formato')}
          />
        </div>
      );
    case 'interna':
      return (
        <div className="grade grade--3" style={{ gap: 16 }}>
          <CampoDeEnumeracao
            rotulo="Natureza"
            chave="natureza"
            ajuda="Que tipo de demanda interna é esta."
            {...campo('natureza')}
          />
          <CampoDeEnumeracao
            rotulo="Cumprimento"
            chave="cumprimento"
            ajuda="Se o pedido foi atendido, e em que medida."
            {...campo('cumprimento')}
          />
          <CampoDeEnumeracao
            rotulo="Complexidade"
            chave="complexidade"
            ajuda="O quanto este pedido dá trabalho para responder."
            {...campo('complexidade')}
          />
          <CampoDeTexto
            rotulo="Prazo (dias)"
            tipo="number"
            ajuda="Quantos dias a área tem para responder, se houver prazo."
            {...campo('prazo_dias')}
          />
        </div>
      );
  }
}
