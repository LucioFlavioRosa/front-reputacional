/** A biblioteca de referências: o acervo oficial, por assunto e por versão.
 *
 *  O PROBLEMA QUE ELA RESOLVE não é guardar arquivo. É o porta-voz entrar numa
 *  reunião de tarifa sem o Q&A de tarifa — ou com a versão de março. Por isso
 *  cada referência é ligada a ASSUNTO: assunto é o que se escolhe ao marcar uma
 *  reunião, e é por ele que o material certo se encontra sozinho, na aba "Antes
 *  da reunião" do cadastro de agenda.
 *
 *  O ARQUIVO MORA NO BLOB, numa árvore navegável por gente:
 *
 *      referencias/<assunto principal>/<tipo>/<referência>/v<n>-<id>-<nome>
 *
 *  O ASSUNTO PRINCIPAL É PEDIDO À PARTE porque é ele que define a pasta. A
 *  referência cobre vários assuntos e todos ficam na busca; o byte mora num
 *  lugar só — copiá-lo criaria duas verdades que envelhecem separado.
 *
 *  E UMA REFERÊNCIA TEM VERSÕES. Subir a de agosto não apaga a de março: foi a
 *  de março que circulou naquela reunião.
 */

import { useEffect, useMemo, useRef, useState } from 'react';

import {
  Botao,
  Campo,
  Cartao,
  FaixaDeErro,
  Secao,
  estiloDeEntrada,
} from '@/componentes/basicos';
import { CampoQueCompleta } from '@/componentes/CampoQueCompleta';
import {
  criarReferencia,
  editarReferencia,
  listarReferencias,
  listarVersoesDaReferencia,
  subirVersaoDaReferencia,
  urlDaVersao,
} from '@/api/cliente';
import { dataCompleta, tamanhoLegivel } from '@/dominio/formato';
import type { Referencia, VersaoDaReferencia } from '@/dominio/tipos';
import { usePainel } from '@/estado/painel';

const TIPOS = [
  { valor: 'posicionamento', rotulo: 'Posicionamento oficial' },
  { valor: 'qa', rotulo: 'Q&A' },
  { valor: 'release', rotulo: 'Release' },
  { valor: 'apresentacao', rotulo: 'Apresentação' },
  { valor: 'dados', rotulo: 'Dados e números' },
  { valor: 'nota_tecnica', rotulo: 'Nota técnica' },
];

const rotuloDoTipo = (valor: string) =>
  TIPOS.find((t) => t.valor === valor)?.rotulo ?? valor;

const VAZIA = {
  titulo: '',
  tipo: 'posicionamento',
  resumo: '',
  atualizado_em: '',
  tema_principal: '',
  temas: [] as number[],
};

type Rascunho = typeof VAZIA;

export function Biblioteca() {
  const { catalogo } = usePainel();
  const [referencias, definirReferencias] = useState<Referencia[] | null>(null);
  const [erro, definirErro] = useState<string | null>(null);
  const [feito, definirFeito] = useState<string | null>(null);
  const [salvando, definirSalvando] = useState(false);
  const [busca, definirBusca] = useState('');
  const [nova, definirNova] = useState<Rascunho>(VAZIA);
  const [arquivoNovo, definirArquivoNovo] = useState<File | null>(null);
  const [emEdicao, definirEmEdicao] = useState<string | null>(null);
  const [rascunho, definirRascunho] = useState<Rascunho>(VAZIA);
  //: Qual referência está com o histórico aberto, e as versões dela.
  const [aberta, definirAberta] = useState<string | null>(null);
  const [versoes, definirVersoes] = useState<VersaoDaReferencia[]>([]);
  const campoDeArquivo = useRef<HTMLInputElement>(null);

  const carregar = () =>
    listarReferencias()
      .then(definirReferencias)
      .catch((e: Error) => definirErro(e.message));

  useEffect(() => {
    void carregar();
    // Uma vez, ao montar: a lista é pequena e recarrega a cada gravação.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const executar = async (acao: () => Promise<unknown>, depois: () => void) => {
    definirSalvando(true);
    definirErro(null);
    try {
      await acao();
      depois();
      await carregar();
      definirFeito('Biblioteca atualizada.');
    } catch (e) {
      definirErro((e as Error).message);
      definirFeito(null);
    } finally {
      definirSalvando(false);
    }
  };

  const filtradas = useMemo(() => {
    if (!referencias) return [];
    const termo = busca.trim().toLowerCase();
    if (!termo) return referencias;
    return referencias.filter(
      (r) =>
        r.titulo.toLowerCase().includes(termo) ||
        (r.resumo ?? '').toLowerCase().includes(termo),
    );
  }, [referencias, busca]);

  if (!catalogo) return null;

  const nomeDoTema = (id: number) =>
    catalogo.dicionarios.temas.find((t) => t.id === id)?.nome ?? String(id);

  //: O QUE FALTA PARA PODER GRAVAR. O arquivo entra na conta porque a rota o
  //: exige: sem ele, a referência não nasce.
  const podeCadastrar =
    Boolean(nova.titulo.trim()) &&
    Boolean(nova.tema_principal) &&
    Boolean(nova.atualizado_em) &&
    Boolean(arquivoNovo);

  const abrirHistorico = async (referencia: Referencia) => {
    if (aberta === referencia.id) return definirAberta(null);
    definirAberta(referencia.id);
    definirVersoes(await listarVersoesDaReferencia(referencia.id));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {erro ? <FaixaDeErro mensagem={erro} /> : null}
      {feito ? (
        <div
          style={{
            background: 'var(--ok-bg)',
            color: 'var(--ok-fg)',
            padding: '11px 14px',
            borderRadius: 'var(--r-card-int)',
            fontSize: 13,
          }}
        >
          {feito}
        </div>
      ) : null}

      <Secao titulo="Cadastrar referência">
        <Cartao>
          <p style={{ fontSize: 13, color: 'var(--cinza-2)', margin: '0 0 16px' }}>
            O arquivo fica no armazenamento do painel, numa pasta por assunto e
            tipo. Depois é só subir versões novas — as anteriores continuam.
          </p>

          <FormularioDeReferencia
            valor={nova}
            aoMudar={definirNova}
            temas={catalogo.dicionarios.temas}
          />

          <div style={{ marginTop: 16 }}>
            <Campo
              rotulo="Arquivo"
              obrigatorio
              dica="É ele que vira a versão 1 da referência."
            >
              <input
                ref={campoDeArquivo}
                type="file"
                style={estiloDeEntrada}
                onChange={(e) => definirArquivoNovo(e.target.files?.[0] ?? null)}
              />
            </Campo>
          </div>

          <div style={{ marginTop: 14 }}>
            <Botao
              variante="primario"
              desabilitado={salvando || !podeCadastrar}
              aoClicar={() =>
                void executar(
                  () =>
                    criarReferencia(
                      {
                        titulo: nova.titulo,
                        tipo: nova.tipo,
                        tema_principal_id: Number(nova.tema_principal),
                        temas: nova.temas,
                        resumo: nova.resumo || null,
                        atualizado_em: nova.atualizado_em,
                      },
                      arquivoNovo as File,
                    ),
                  () => {
                    definirNova(VAZIA);
                    definirArquivoNovo(null);
                    // O `<input type=file>` guarda o arquivo por conta própria:
                    // zerar o estado não limpa o nome que ele mostra.
                    if (campoDeArquivo.current) campoDeArquivo.current.value = '';
                  },
                )
              }
            >
              {salvando ? 'Salvando…' : 'Cadastrar'}
            </Botao>
          </div>
        </Cartao>
      </Secao>

      <Secao titulo={`Na biblioteca (${referencias?.length ?? 0})`}>
        <Cartao>
          <input
            style={{ ...estiloDeEntrada, marginBottom: 14 }}
            value={busca}
            onChange={(e) => definirBusca(e.target.value)}
            placeholder="Buscar por título ou resumo…"
          />

          {referencias === null ? (
            <p style={{ fontSize: 13, color: 'var(--cinza-2)' }}>Carregando…</p>
          ) : filtradas.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--cinza-2)' }}>
              {busca ? 'Nada com esse termo.' : 'A biblioteca está vazia.'}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {filtradas.map((referencia) =>
                emEdicao === referencia.id ? (
                  <div
                    key={referencia.id}
                    style={{
                      padding: 14,
                      background: 'var(--bg-trilho)',
                      borderRadius: 'var(--r-card-int)',
                    }}
                  >
                    <FormularioDeReferencia
                      valor={rascunho}
                      aoMudar={definirRascunho}
                      temas={catalogo.dicionarios.temas}
                      semData
                    />
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <Botao
                        variante="primario"
                        desabilitado={
                          salvando ||
                          !rascunho.titulo.trim() ||
                          !rascunho.tema_principal
                        }
                        aoClicar={() =>
                          void executar(
                            () =>
                              editarReferencia(referencia.id, {
                                titulo: rascunho.titulo,
                                tipo: rascunho.tipo,
                                resumo: rascunho.resumo || null,
                                tema_principal_id: Number(rascunho.tema_principal),
                                temas: rascunho.temas,
                                ativo: referencia.ativo,
                              }),
                            () => definirEmEdicao(null),
                          )
                        }
                      >
                        Salvar
                      </Botao>
                      <Botao aoClicar={() => definirEmEdicao(null)}>Cancelar</Botao>
                    </div>
                  </div>
                ) : (
                  <Linha
                    key={referencia.id}
                    referencia={referencia}
                    nomeDoTema={nomeDoTema}
                    salvando={salvando}
                    aberta={aberta === referencia.id}
                    versoes={aberta === referencia.id ? versoes : []}
                    aoAbrirHistorico={() => void abrirHistorico(referencia)}
                    aoSubirVersao={(arquivo, data, nota) =>
                      void executar(
                        () => subirVersaoDaReferencia(referencia.id, arquivo, data, nota),
                        () => {
                          definirAberta(null);
                          definirVersoes([]);
                        },
                      )
                    }
                    aoEditar={() => {
                      definirEmEdicao(referencia.id);
                      definirRascunho({
                        titulo: referencia.titulo,
                        tipo: referencia.tipo,
                        resumo: referencia.resumo ?? '',
                        atualizado_em: '',
                        tema_principal: String(referencia.tema_principal_id ?? ''),
                        temas: referencia.temas,
                      });
                    }}
                    aoAlternarAtivo={() =>
                      void executar(
                        () =>
                          editarReferencia(referencia.id, {
                            titulo: referencia.titulo,
                            tipo: referencia.tipo,
                            resumo: referencia.resumo,
                            tema_principal_id: referencia.tema_principal_id ?? 0,
                            temas: referencia.temas,
                            ativo: !referencia.ativo,
                          }),
                        () => undefined,
                      )
                    }
                  />
                ),
              )}
            </div>
          )}
        </Cartao>
      </Secao>
    </div>
  );
}

function FormularioDeReferencia({
  valor,
  aoMudar,
  temas,
  semData = false,
}: {
  valor: Rascunho;
  aoMudar: (r: Rascunho) => void;
  temas: { id: number; nome: string }[];
  /** Na edição a data não aparece: ela é da VERSÃO, não da referência. */
  semData?: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="grade grade--2" style={{ gap: 16 }}>
        <Campo rotulo="Título" obrigatorio>
          <input
            style={estiloDeEntrada}
            value={valor.titulo}
            onChange={(e) => aoMudar({ ...valor, titulo: e.target.value })}
            placeholder="Q&A — Reajuste tarifário 2026"
          />
        </Campo>
        <CampoQueCompleta
          rotulo="Tipo"
          obrigatorio
          valor={valor.tipo}
          aoEscolher={(v) => aoMudar({ ...valor, tipo: v })}
          opcoes={TIPOS.map((t) => ({ valor: t.valor, rotulo: t.rotulo }))}
        />
      </div>

      <div className="grade grade--2" style={{ gap: 16 }}>
        <CampoQueCompleta
          rotulo="Assunto principal"
          obrigatorio
          dica="É ele que define a pasta do arquivo."
          valor={valor.tema_principal}
          aoEscolher={(v) => aoMudar({ ...valor, tema_principal: v })}
          opcoes={temas.map((t) => ({ valor: String(t.id), rotulo: t.nome }))}
        />
        {semData ? null : (
          <Campo
            rotulo="Data do documento"
            obrigatorio
            dica="A data do arquivo, não a de hoje."
          >
            <input
              type="date"
              style={estiloDeEntrada}
              value={valor.atualizado_em}
              onChange={(e) => aoMudar({ ...valor, atualizado_em: e.target.value })}
            />
          </Campo>
        )}
      </div>

      <Campo rotulo="Resumo" dica="Uma linha do que o documento diz.">
        <textarea
          style={{ ...estiloDeEntrada, height: 58, padding: 11, resize: 'vertical' }}
          value={valor.resumo}
          onChange={(e) => aoMudar({ ...valor, resumo: e.target.value })}
        />
      </Campo>

      <Campo
        rotulo="Outros assuntos"
        dica="Além do principal. É por eles que a referência aparece no preparo de uma agenda."
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          {temas
            .filter((tema) => String(tema.id) !== valor.tema_principal)
            .map((tema) => {
              const marcado = valor.temas.includes(tema.id);
              return (
                <button
                  key={tema.id}
                  type="button"
                  aria-pressed={marcado}
                  onClick={() =>
                    aoMudar({
                      ...valor,
                      temas: marcado
                        ? valor.temas.filter((id) => id !== tema.id)
                        : [...valor.temas, tema.id],
                    })
                  }
                  style={{
                    padding: '5px 11px',
                    borderRadius: 999,
                    border: `1px solid ${marcado ? 'var(--azul-mar)' : 'var(--borda)'}`,
                    background: marcado ? 'var(--azul-mar)' : 'transparent',
                    color: marcado ? 'var(--branco)' : 'var(--cinza-3)',
                    fontSize: 13,
                    cursor: 'pointer',
                    font: 'inherit',
                    fontWeight: marcado ? 600 : 400,
                  }}
                >
                  {tema.nome}
                </button>
              );
            })}
        </div>
      </Campo>
    </div>
  );
}

function Linha({
  referencia,
  nomeDoTema,
  salvando,
  aberta,
  versoes,
  aoAbrirHistorico,
  aoSubirVersao,
  aoEditar,
  aoAlternarAtivo,
}: {
  referencia: Referencia;
  nomeDoTema: (id: number) => string;
  salvando: boolean;
  aberta: boolean;
  versoes: VersaoDaReferencia[];
  aoAbrirHistorico: () => void;
  aoSubirVersao: (arquivo: File, data: string, nota?: string) => void;
  aoEditar: () => void;
  aoAlternarAtivo: () => void;
}) {
  const [arquivo, definirArquivo] = useState<File | null>(null);
  const [data, definirData] = useState('');
  const [nota, definirNota] = useState('');
  const atual = referencia.versao;

  return (
    <div
      style={{
        padding: '11px 8px',
        borderBottom: '1px solid var(--borda)',
        opacity: referencia.ativo ? 1 : 0.55,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>
            {referencia.titulo}
            <span
              style={{
                marginLeft: 8,
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: 'var(--cinza-2)',
              }}
            >
              {rotuloDoTipo(referencia.tipo)}
            </span>
          </p>
          {referencia.resumo ? (
            <p
              style={{
                fontSize: 13,
                color: 'var(--cinza-3)',
                margin: '3px 0 0',
                maxWidth: '72ch',
              }}
            >
              {referencia.resumo}
            </p>
          ) : null}
          <p style={{ fontSize: 12, color: 'var(--cinza-2)', margin: '5px 0 0' }}>
            {atual ? (
              <>
                <span className="tabular">
                  v{atual.numero} · {dataCompleta(atual.atualizado_em)} ·{' '}
                  {tamanhoLegivel(atual.arquivo_tamanho)}
                </span>
                {' · '}
                <a
                  href={urlDaVersao(referencia.id, atual.id)}
                  target="_blank"
                  rel="noreferrer"
                >
                  abrir
                </a>
              </>
            ) : (
              'sem versão'
            )}
            {' · '}
            {referencia.temas.map(nomeDoTema).join(', ')}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {referencia.quantas_versoes > 1 ? (
            <Botao variante="fantasma" aoClicar={aoAbrirHistorico}>
              {aberta ? 'Fechar' : `${referencia.quantas_versoes - 1} anteriores`}
            </Botao>
          ) : null}
          <Botao aoClicar={aoEditar}>Editar</Botao>
          <Botao variante="fantasma" desabilitado={salvando} aoClicar={aoAlternarAtivo}>
            {referencia.ativo ? 'Desativar' : 'Reativar'}
          </Botao>
        </div>
      </div>

      {aberta ? (
        <div
          style={{
            marginTop: 10,
            padding: 12,
            background: 'var(--bg-trilho)',
            borderRadius: 'var(--r-card-int)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {versoes.map((versao) => (
              <p
                key={versao.id}
                style={{ fontSize: 12, color: 'var(--cinza-3)', margin: 0 }}
              >
                <span className="tabular">
                  v{versao.numero} · {dataCompleta(versao.atualizado_em)}
                </span>
                {' · '}
                <a
                  href={urlDaVersao(referencia.id, versao.id)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {versao.arquivo_nome}
                </a>
                {versao.criado_por ? ` · ${versao.criado_por}` : ''}
                {versao.nota ? ` · ${versao.nota}` : ''}
              </p>
            ))}
          </div>
        </div>
      ) : null}

      {/* SUBIR VERSÃO FICA NA LINHA, e não numa tela à parte: quem chega com o
          arquivo novo já está olhando a referência que ele substitui. */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'flex-end',
          marginTop: 10,
          flexWrap: 'wrap',
        }}
      >
        <input
          type="file"
          aria-label={`Arquivo da nova versão de ${referencia.titulo}`}
          style={{ ...estiloDeEntrada, width: 260 }}
          onChange={(e) => definirArquivo(e.target.files?.[0] ?? null)}
        />
        <input
          type="date"
          aria-label={`Data do documento da nova versão de ${referencia.titulo}`}
          style={{ ...estiloDeEntrada, width: 150 }}
          value={data}
          onChange={(e) => definirData(e.target.value)}
        />
        <input
          aria-label={`O que mudou na nova versão de ${referencia.titulo}`}
          style={{ ...estiloDeEntrada, flex: 1, minWidth: 180 }}
          value={nota}
          onChange={(e) => definirNota(e.target.value)}
          placeholder="O que mudou (opcional)"
        />
        <Botao
          desabilitado={salvando || !arquivo || !data}
          aoClicar={() => {
            if (arquivo && data) aoSubirVersao(arquivo, data, nota || undefined);
          }}
        >
          Nova versão
        </Botao>
      </div>
    </div>
  );
}
