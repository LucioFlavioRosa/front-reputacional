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
import { AjudaDoCampo } from '@/componentes/AjudaDoCampo';
import { ENUMERACOES_DA_EXTENSAO } from '@/dominio/frentes';
import { GUIA_DO_CADASTRO } from '@/dominio/guiaDoCadastro';
import type { VerbeteDoCampo } from '@/dominio/guiaDoCadastro';
import type { Dicionarios, Frente } from '@/dominio/tipos';

type Extensao = Record<string, string>;

function CampoDeEnumeracao({
  rotulo,
  chave,
  guia,
  valor,
  aoMudar,
}: {
  rotulo: string;
  chave: keyof typeof ENUMERACOES_DA_EXTENSAO;
  guia: VerbeteDoCampo;
  valor: string | undefined;
  aoMudar: (valor: string) => void;
}) {
  return (
    <CampoQueCompleta
      rotulo={rotulo}
      aoLadoDoRotulo={<AjudaDoCampo verbete={guia} />}
      valor={valor ?? ''}
      aoEscolher={aoMudar}
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
            aoLadoDoRotulo={<AjudaDoCampo verbete={GUIA_DO_CADASTRO.formato_atendimento_imprensa} />}
            {...campo('formato')}
          />
          <CampoDeTexto
            rotulo="Data atendida"
            tipo="date"
            aoLadoDoRotulo={<AjudaDoCampo verbete={GUIA_DO_CADASTRO.data_atendida} />}
            {...campo('data_atendida')}
          />
          <CampoDeTexto
            rotulo="Data de publicação"
            tipo="date"
            aoLadoDoRotulo={<AjudaDoCampo verbete={GUIA_DO_CADASTRO.data_publicacao} />}
            {...campo('data_publicacao')}
          />
          <div style={{ gridColumn: 'span 2' }}>
            <CampoDeTexto
              rotulo="Link da matéria"
              tipo="url"
              aoLadoDoRotulo={<AjudaDoCampo verbete={GUIA_DO_CADASTRO.link_materia} />}
              {...campo('link_materia')}
            />
          </div>
          <CampoDeTexto
            rotulo="Mensagens-chave"
            dica="Separe com ponto e vírgula."
            aoLadoDoRotulo={<AjudaDoCampo verbete={GUIA_DO_CADASTRO.mensagens_chave} />}
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
            aoLadoDoRotulo={<AjudaDoCampo verbete={GUIA_DO_CADASTRO.cargo_interlocutor} />}
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
              aoLadoDoRotulo={<AjudaDoCampo verbete={GUIA_DO_CADASTRO.nome_evento} />}
              {...campo('nome_evento')}
            />
          </div>
          <CampoDeTexto
            rotulo="Cargo do interlocutor"
            aoLadoDoRotulo={<AjudaDoCampo verbete={GUIA_DO_CADASTRO.cargo_interlocutor} />}
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
            aoLadoDoRotulo={<AjudaDoCampo verbete={GUIA_DO_CADASTRO.casa_legislativa} />}
            {...campo('casa')}
          />
          <CampoDeDicionario
            rotulo="Tramitação"
            itens={dicionarios.tramitacoes}
            aoLadoDoRotulo={<AjudaDoCampo verbete={GUIA_DO_CADASTRO.tramitacao} />}
            {...campo('tramitacao')}
          />
          <CampoDeEnumeracao
            rotulo="Prioridade"
            chave="prioridade"
            guia={GUIA_DO_CADASTRO.prioridade_legislativa}
            {...campo('prioridade')}
          />
          <div style={{ gridColumn: 'span 3' }}>
            <Campo rotulo="Ementa" aoLadoDoRotulo={<AjudaDoCampo verbete={GUIA_DO_CADASTRO.ementa} />}>
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
            aoLadoDoRotulo={<AjudaDoCampo verbete={GUIA_DO_CADASTRO.tipo_investidor} />}
            {...campo('tipo_investidor')}
          />
          <CampoDeDicionario
            rotulo="Formato"
            itens={formatos('investidores')}
            aoLadoDoRotulo={<AjudaDoCampo verbete={GUIA_DO_CADASTRO.formato_atendimento_investidores} />}
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
            guia={GUIA_DO_CADASTRO.natureza_interna}
            {...campo('natureza')}
          />
          <CampoDeEnumeracao
            rotulo="Cumprimento"
            chave="cumprimento"
            guia={GUIA_DO_CADASTRO.cumprimento_interna}
            {...campo('cumprimento')}
          />
          <CampoDeEnumeracao
            rotulo="Complexidade"
            chave="complexidade"
            guia={GUIA_DO_CADASTRO.complexidade_interna}
            {...campo('complexidade')}
          />
          <CampoDeTexto
            rotulo="Prazo (dias)"
            tipo="number"
            aoLadoDoRotulo={<AjudaDoCampo verbete={GUIA_DO_CADASTRO.prazo_dias} />}
            {...campo('prazo_dias')}
          />
        </div>
      );
  }
}
