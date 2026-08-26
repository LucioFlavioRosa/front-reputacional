/** Cadastro — o formulário único, com campos condicionais por frente.
 *
 *  O seletor de frente define quais blocos aparecem. Nenhum campo de outra
 *  frente fica escondido no formulário: o que não se aplica não é enviado.
 */

import { useState } from 'react';
import { criarInteracao } from '@/api/cliente';
import { usePainel } from '@/estado/painel';
import {
  Botao,
  Campo,
  Carregando,
  Cartao,
  Chip,
  ChipDeFrente,
  FaixaDeErro,
  Secao,
  estiloDeEntrada,
} from '@/componentes/basicos';
import { hojeLocal } from '@/dominio/formato';
import { ROTULOS_DE_FRENTE } from '@/dominio/frentes';
import { FRENTES } from '@/dominio/tipos';
import type { Frente } from '@/dominio/tipos';

// As 27 UFs saíram daqui: vêm de `catalogo.dicionarios.ufs`, montado a
// partir do domínio `abrangencia` do Postgres — o mesmo que recusa uma UF
// inválida na escrita. O formulário passa a oferecer exatamente o que o
// banco aceita, nem mais nem menos.

/** Quais blocos de extensão cada frente mostra. Governo, Parceiros e Eventos
 *  usam o mesmo bloco — só Eventos acrescenta o nome do evento. */
type BlocoDeExtensao = 'imprensa' | 'institucional' | 'legislativo' | 'investidores' | 'interna';

const BLOCO_POR_FRENTE: Record<Frente, BlocoDeExtensao> = {
  imprensa: 'imprensa',
  governo: 'institucional',
  parceiros: 'institucional',
  eventos: 'institucional',
  legislativo: 'legislativo',
  investidores: 'investidores',
  interna: 'interna',
};

interface Formulario {
  frente: Frente;
  data_interacao: string;
  instituicao_id: string;
  interlocutor_id: string;
  unidade_negocio_id: string;
  esfera_id: string;
  uf: string;
  tier: string;
  status: string;
  clima: string;
  resultado: string;
  iniciativa: string;
  pauta: string;
  posicionamento: string;
  relato: string;
  encaminhamentos: string;
  pendencias: string;
  observacoes: string;
  registro_url: string;
  temas: number[];
  portaVozes: string[];
  extensao: Record<string, string>;
}

const VAZIO: Formulario = {
  frente: 'imprensa',
  data_interacao: hojeLocal(),
  instituicao_id: '',
  interlocutor_id: '',
  unidade_negocio_id: '',
  esfera_id: '',
  uf: '',
  tier: '',
  status: '',
  clima: '',
  resultado: '',
  iniciativa: '',
  pauta: '',
  posicionamento: '',
  relato: '',
  encaminhamentos: '',
  pendencias: '',
  observacoes: '',
  registro_url: '',
  temas: [],
  portaVozes: [],
  extensao: {},
};

export function Cadastro({ aoSalvar }: { aoSalvar: () => void }) {
  const { catalogo, recarregar } = usePainel();
  const [form, definirForm] = useState<Formulario>(VAZIO);
  const [enviando, definirEnviando] = useState(false);
  const [erro, definirErro] = useState<string | null>(null);
  const [sucesso, definirSucesso] = useState(false);

  if (!catalogo) return <Carregando />;

  const alterar = <C extends keyof Formulario>(campo: C, valor: Formulario[C]) => {
    definirForm((atual) => ({ ...atual, [campo]: valor }));
    definirSucesso(false);
  };

  const alterarExtensao = (campo: string, valor: string) => {
    definirForm((atual) => ({ ...atual, extensao: { ...atual.extensao, [campo]: valor } }));
  };

  // Trocar de frente descarta a extensão anterior: são campos de outro
  // conjunto, e mantê-los faria o backend recusar o registro.
  const trocarFrente = (frente: Frente) => {
    definirForm((atual) => ({ ...atual, frente, extensao: {} }));
    definirSucesso(false);
  };

  const enviar = async () => {
    definirEnviando(true);
    definirErro(null);
    try {
      await criarInteracao(montarCorpo(form));
      definirForm({ ...VAZIO, frente: form.frente });
      definirSucesso(true);
      recarregar();
      aoSalvar();
    } catch (falha) {
      definirErro((falha as Error).message);
    } finally {
      definirEnviando(false);
    }
  };

  const bloco = BLOCO_POR_FRENTE[form.frente];
  const formatosDaFrente = catalogo.dicionarios.formatos.filter((formato) =>
    bloco === 'investidores' ? formato.escopo === 'investidores' : formato.escopo === 'imprensa',
  );

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 26 }}>Novo registro</h1>
        <p style={{ fontSize: 13, color: 'var(--cinza-2)', marginTop: 4 }}>
          O tipo de registro define quais campos aparecem.
        </p>
      </div>

      {erro ? <FaixaDeErro mensagem={erro} /> : null}
      {sucesso ? (
        <div
          style={{
            background: 'var(--ok-bg)',
            color: 'var(--ok-fg)',
            padding: '11px 14px',
            borderRadius: 'var(--r-card-int)',
            fontSize: 13,
          }}
        >
          Registro salvo. O formulário está pronto para o próximo.
        </div>
      ) : null}

      <Secao titulo="Tipo de registro">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          {FRENTES.map((frente) => (
            <ChipDeFrente
              key={frente}
              frente={frente}
              ativo={form.frente === frente}
              aoClicar={() => trocarFrente(frente)}
            />
          ))}
        </div>
      </Secao>

      <Secao titulo="Identificação">
        <div className="grade grade--2" style={{ gap: 16 }}>
          <Campo rotulo="Data da interação" obrigatorio>
            <input
              type="date"
              style={estiloDeEntrada}
              value={form.data_interacao}
              onChange={(evento) => alterar('data_interacao', evento.target.value)}
            />
          </Campo>

          <Campo rotulo={form.frente === 'legislativo' ? 'Proposição' : 'Veículo / órgão'} obrigatorio>
            <select
              style={estiloDeEntrada}
              value={form.instituicao_id}
              onChange={(evento) => alterar('instituicao_id', evento.target.value)}
            >
              <option value="">Selecione…</option>
              {[...catalogo.instituicoes.values()].map((instituicao) => (
                <option key={instituicao.id} value={instituicao.id}>
                  {instituicao.nome}
                </option>
              ))}
            </select>
          </Campo>

          <Campo rotulo="Interlocutor" dica="A pessoa da outra ponta — nunca a instituição.">
            <select
              style={estiloDeEntrada}
              value={form.interlocutor_id}
              onChange={(evento) => alterar('interlocutor_id', evento.target.value)}
            >
              <option value="">Sem interlocutor identificado</option>
              {[...catalogo.interlocutores.values()].map((pessoa) => (
                <option key={pessoa.id} value={pessoa.id}>
                  {pessoa.nome}
                </option>
              ))}
            </select>
          </Campo>

          <Campo rotulo="Abrangência" obrigatorio dica="O mapa do painel depende deste campo.">
            <select
              style={estiloDeEntrada}
              value={form.uf}
              onChange={(evento) => alterar('uf', evento.target.value)}
            >
              <option value="">Selecione…</option>
              {catalogo?.dicionarios.ufs.map((abrangencia) => (
                <option key={abrangencia.codigo} value={abrangencia.codigo}>
                  {abrangencia.nome}
                </option>
              ))}
            </select>
          </Campo>

          <Campo rotulo="Unidade de negócio">
            <select
              style={estiloDeEntrada}
              value={form.unidade_negocio_id}
              onChange={(evento) => alterar('unidade_negocio_id', evento.target.value)}
            >
              <option value="">Holding / corporativo</option>
              {catalogo.dicionarios.unidades_negocio.map((unidade) => (
                <option key={unidade.id} value={unidade.id}>
                  {unidade.nome}
                </option>
              ))}
            </select>
          </Campo>

          <Campo rotulo="Esfera">
            <select
              style={estiloDeEntrada}
              value={form.esfera_id}
              onChange={(evento) => alterar('esfera_id', evento.target.value)}
            >
              <option value="">Não informada</option>
              {catalogo.dicionarios.esferas.map((esfera) => (
                <option key={esfera.id} value={esfera.id}>
                  {esfera.nome}
                </option>
              ))}
            </select>
          </Campo>
        </div>
      </Secao>

      <Secao titulo="Classificação">
        <div className="grade grade--3" style={{ gap: 16 }}>
          <Campo rotulo="Status" obrigatorio>
            <select
              style={estiloDeEntrada}
              value={form.status}
              onChange={(evento) => alterar('status', evento.target.value)}
            >
              <option value="">Selecione…</option>
              {catalogo.dicionarios.status.map((status) => (
                <option key={status.codigo} value={status.codigo}>
                  {status.nome}
                </option>
              ))}
            </select>
          </Campo>

          <Campo rotulo="Relevância">
            <select
              style={estiloDeEntrada}
              value={form.tier}
              onChange={(evento) => alterar('tier', evento.target.value)}
            >
              <option value="">Não classificada</option>
              {/* Do banco, e nao escrito aqui — pelo mesmo motivo do filtro. Um
                  nivel que o painel oferece para FILTRAR e nao oferece para
                  CLASSIFICAR seria um filtro que nunca acha nada. */}
              {catalogo?.dicionarios.relevancias.map((nivel) => (
                <option key={nivel.id} value={nivel.id}>
                  {nivel.nome}
                </option>
              ))}
            </select>
          </Campo>

          <Campo rotulo="Clima">
            <select
              style={estiloDeEntrada}
              value={form.clima}
              onChange={(evento) => alterar('clima', evento.target.value)}
            >
              <option value="">Não informado</option>
              {catalogo.dicionarios.climas.map((clima) => (
                <option key={clima.codigo} value={clima.codigo}>
                  {clima.nome}
                </option>
              ))}
            </select>
          </Campo>

          <Campo rotulo="Resultado">
            <select
              style={estiloDeEntrada}
              value={form.resultado}
              onChange={(evento) => alterar('resultado', evento.target.value)}
            >
              <option value="">Sem definição</option>
              {catalogo.dicionarios.resultados.map((resultado) => (
                <option key={resultado.codigo} value={resultado.codigo}>
                  {resultado.nome}
                </option>
              ))}
            </select>
          </Campo>

          <Campo rotulo="Iniciativa">
            <select
              style={estiloDeEntrada}
              value={form.iniciativa}
              onChange={(evento) => alterar('iniciativa', evento.target.value)}
            >
              <option value="">Não informada</option>
              {catalogo.dicionarios.iniciativas.map((iniciativa) => (
                <option key={iniciativa.codigo} value={iniciativa.codigo}>
                  {iniciativa.nome}
                </option>
              ))}
            </select>
          </Campo>
        </div>
      </Secao>

      <Secao titulo={`Campos de ${ROTULOS_DE_FRENTE[form.frente]}`}>
        <div className="grade grade--2" style={{ gap: 16 }}>
          {bloco === 'imprensa' ? (
            <>
              <CampoDeDicionario
                rotulo="Formato"
                itens={formatosDaFrente}
                valor={form.extensao.formato}
                aoMudar={(v) => alterarExtensao('formato', v)}
              />
              <CampoDeTexto
                rotulo="Data atendida"
                tipo="date"
                valor={form.extensao.data_atendida}
                aoMudar={(v) => alterarExtensao('data_atendida', v)}
              />
              <CampoDeTexto
                rotulo="Data de publicação"
                tipo="date"
                valor={form.extensao.data_publicacao}
                aoMudar={(v) => alterarExtensao('data_publicacao', v)}
              />
              <CampoDeTexto
                rotulo="Link da matéria"
                valor={form.extensao.link_materia}
                aoMudar={(v) => alterarExtensao('link_materia', v)}
              />
              <CampoDeTexto
                rotulo="Mensagens-chave"
                dica="Separe por ponto e vírgula."
                valor={form.extensao.mensagens_chave}
                aoMudar={(v) => alterarExtensao('mensagens_chave', v)}
              />
            </>
          ) : null}

          {bloco === 'institucional' ? (
            <>
              <CampoDeDicionario
                rotulo="Natureza do órgão"
                itens={catalogo.dicionarios.naturezas_orgao}
                valor={form.extensao.natureza_orgao}
                aoMudar={(v) => alterarExtensao('natureza_orgao', v)}
              />
              <CampoDeTexto
                rotulo="Cargo do interlocutor"
                valor={form.extensao.cargo_interlocutor}
                aoMudar={(v) => alterarExtensao('cargo_interlocutor', v)}
              />
              {form.frente === 'eventos' ? (
                <CampoDeTexto
                  rotulo="Nome do evento"
                  dica="Não confundir com a entidade promotora nem com o interlocutor."
                  valor={form.extensao.nome_evento}
                  aoMudar={(v) => alterarExtensao('nome_evento', v)}
                />
              ) : null}
            </>
          ) : null}

          {bloco === 'legislativo' ? (
            <>
              <CampoDeDicionario
                rotulo="Casa"
                itens={catalogo.dicionarios.casas}
                valor={form.extensao.casa}
                aoMudar={(v) => alterarExtensao('casa', v)}
              />
              <CampoDeDicionario
                rotulo="Tramitação"
                itens={catalogo.dicionarios.tramitacoes}
                valor={form.extensao.tramitacao}
                aoMudar={(v) => alterarExtensao('tramitacao', v)}
              />
              <Campo rotulo="Prioridade">
                <select
                  style={estiloDeEntrada}
                  value={form.extensao.prioridade ?? ''}
                  onChange={(evento) => alterarExtensao('prioridade', evento.target.value)}
                >
                  <option value="">Não classificada</option>
                  <option value="alta">Alta</option>
                  <option value="media">Média</option>
                  <option value="baixa">Baixa</option>
                  <option value="monitoramento">Monitoramento</option>
                </select>
              </Campo>
              <CampoDeTexto
                rotulo="Ementa"
                valor={form.extensao.ementa}
                aoMudar={(v) => alterarExtensao('ementa', v)}
              />
            </>
          ) : null}

          {bloco === 'investidores' ? (
            <>
              <CampoDeDicionario
                rotulo="Tipo de investidor"
                itens={catalogo.dicionarios.tipos_investidor}
                valor={form.extensao.tipo_investidor}
                aoMudar={(v) => alterarExtensao('tipo_investidor', v)}
              />
              <CampoDeDicionario
                rotulo="Formato"
                itens={formatosDaFrente}
                valor={form.extensao.formato}
                aoMudar={(v) => alterarExtensao('formato', v)}
              />
            </>
          ) : null}

          {bloco === 'interna' ? (
            <>
              <Campo rotulo="Natureza">
                <select
                  style={estiloDeEntrada}
                  value={form.extensao.natureza ?? ''}
                  onChange={(evento) => alterarExtensao('natureza', evento.target.value)}
                >
                  <option value="">Não informada</option>
                  <option value="demanda">Demanda</option>
                  <option value="entrega">Entrega</option>
                </select>
              </Campo>
              <Campo rotulo="Cumprimento">
                <select
                  style={estiloDeEntrada}
                  value={form.extensao.cumprimento ?? ''}
                  onChange={(evento) => alterarExtensao('cumprimento', evento.target.value)}
                >
                  <option value="">Não informado</option>
                  <option value="interno">Interno</option>
                  <option value="externo">Externo</option>
                  <option value="misto">Misto</option>
                </select>
              </Campo>
              <Campo rotulo="Complexidade">
                <select
                  style={estiloDeEntrada}
                  value={form.extensao.complexidade ?? ''}
                  onChange={(evento) => alterarExtensao('complexidade', evento.target.value)}
                >
                  <option value="">Não informada</option>
                  <option value="baixa">Baixa</option>
                  <option value="media">Média</option>
                  <option value="alta">Alta</option>
                </select>
              </Campo>
              <CampoDeTexto
                rotulo="Prazo em dias"
                tipo="number"
                valor={form.extensao.prazo_dias}
                aoMudar={(v) => alterarExtensao('prazo_dias', v)}
              />
              <CampoDeTexto
                rotulo="Data de retorno"
                tipo="date"
                valor={form.extensao.data_retorno}
                aoMudar={(v) => alterarExtensao('data_retorno', v)}
              />
            </>
          ) : null}
        </div>
      </Secao>

      <Secao titulo="Conteúdo">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Campo rotulo="Pauta" obrigatorio dica="É o que identifica o registro na base.">
            <textarea
              style={{ ...estiloDeEntrada, height: 68, padding: 11, resize: 'vertical' }}
              value={form.pauta}
              onChange={(evento) => alterar('pauta', evento.target.value)}
            />
          </Campo>
          {(
            [
              ['posicionamento', 'Posicionamento da companhia'],
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
          <Campo rotulo="Registro / documentação">
            <input
              style={estiloDeEntrada}
              placeholder="Link do SharePoint, por exemplo"
              value={form.registro_url}
              onChange={(evento) => alterar('registro_url', evento.target.value)}
            />
          </Campo>
        </div>
      </Secao>

      <Secao titulo="Porta-vozes e temas">
        <Campo
          rotulo="Porta-vozes"
          dica="Vários são permitidos: o registro conta para cada um no painel de exposição."
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
            {[...catalogo.pessoas.values()]
              .filter((pessoa) => pessoa.eh_porta_voz)
              .map((pessoa) => {
                const ativo = form.portaVozes.includes(pessoa.id);
                return (
                  <Chip
                    key={pessoa.id}
                    rotulo={pessoa.nome}
                    ativo={ativo}
                    fundo={ativo ? 'var(--azul-mar)' : 'var(--bg-trilho)'}
                    texto={ativo ? 'var(--branco)' : 'var(--cinza-3)'}
                    aoClicar={() =>
                      alterar(
                        'portaVozes',
                        ativo
                          ? form.portaVozes.filter((id) => id !== pessoa.id)
                          : [...form.portaVozes, pessoa.id],
                      )
                    }
                  />
                );
              })}
          </div>
        </Campo>

        <div style={{ marginTop: 18 }}>
          <Campo rotulo="Temas">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
              {catalogo.dicionarios.temas.map((tema) => {
                const ativo = form.temas.includes(tema.id);
                return (
                  <Chip
                    key={tema.id}
                    rotulo={tema.nome}
                    ativo={ativo}
                    fundo={ativo ? 'var(--turquesa-rio)' : 'var(--bg-trilho)'}
                    texto={ativo ? 'var(--sobre-turquesa)' : 'var(--cinza-3)'}
                    aoClicar={() =>
                      alterar(
                        'temas',
                        ativo
                          ? form.temas.filter((id) => id !== tema.id)
                          : [...form.temas, tema.id],
                      )
                    }
                  />
                );
              })}
            </div>
          </Campo>
        </div>
      </Secao>

      <Cartao estilo={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <Botao aoClicar={() => definirForm(VAZIO)}>Limpar</Botao>
        <Botao
          variante="primario"
          aoClicar={enviar}
          desabilitado={
            enviando ||
            !form.data_interacao ||
            !form.pauta.trim() ||
            !form.instituicao_id ||
            !form.uf ||
            !form.status
          }
        >
          {enviando ? 'Salvando…' : 'Salvar registro'}
        </Botao>
      </Cartao>
    </div>
  );
}

function CampoDeTexto({
  rotulo,
  valor,
  aoMudar,
  tipo = 'text',
  dica,
}: {
  rotulo: string;
  valor: string | undefined;
  aoMudar: (valor: string) => void;
  tipo?: string;
  dica?: string;
}) {
  return (
    <Campo rotulo={rotulo} dica={dica}>
      <input
        type={tipo}
        style={estiloDeEntrada}
        value={valor ?? ''}
        onChange={(evento) => aoMudar(evento.target.value)}
      />
    </Campo>
  );
}

function CampoDeDicionario({
  rotulo,
  itens,
  valor,
  aoMudar,
}: {
  rotulo: string;
  itens: { codigo: string; nome: string }[];
  valor: string | undefined;
  aoMudar: (valor: string) => void;
}) {
  return (
    <Campo rotulo={rotulo}>
      <select
        style={estiloDeEntrada}
        value={valor ?? ''}
        onChange={(evento) => aoMudar(evento.target.value)}
      >
        <option value="">Não informado</option>
        {itens.map((item) => (
          <option key={item.codigo} value={item.codigo}>
            {item.nome}
          </option>
        ))}
      </select>
    </Campo>
  );
}

/** Converte o formulário no corpo que a API espera: campo vazio vira ausência,
 *  não string vazia — o backend distingue "não informado" de "limpo". */
function montarCorpo(form: Formulario) {
  const opcional = (valor: string) => (valor.trim() ? valor.trim() : undefined);
  const numeroOpcional = (valor: string) => (valor ? Number(valor) : undefined);

  const extensao: Record<string, unknown> = {};
  for (const [campo, valor] of Object.entries(form.extensao)) {
    if (!valor) continue;
    if (campo === 'mensagens_chave') {
      extensao[campo] = valor
        .split(';')
        .map((parte) => parte.trim())
        .filter(Boolean);
    } else if (campo === 'prazo_dias') {
      extensao[campo] = Number(valor);
    } else {
      extensao[campo] = valor;
    }
  }

  return {
    frente: form.frente,
    data_interacao: form.data_interacao,
    instituicao_id: form.instituicao_id,
    uf: form.uf,
    status: form.status,
    pauta: form.pauta.trim(),
    interlocutor_id: opcional(form.interlocutor_id),
    unidade_negocio_id: numeroOpcional(form.unidade_negocio_id),
    esfera_id: numeroOpcional(form.esfera_id),
    tier: numeroOpcional(form.tier),
    clima: opcional(form.clima),
    resultado: opcional(form.resultado),
    iniciativa: opcional(form.iniciativa),
    posicionamento: opcional(form.posicionamento),
    relato: opcional(form.relato),
    encaminhamentos: opcional(form.encaminhamentos),
    pendencias: opcional(form.pendencias),
    observacoes: opcional(form.observacoes),
    registro_url: opcional(form.registro_url),
    temas: form.temas,
    participacoes: form.portaVozes.map((id) => ({ pessoa_aegea_id: id, papel: 'porta_voz' })),
    extensao: Object.keys(extensao).length ? extensao : undefined,
  };
}
