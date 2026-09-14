/** Quem fala pela Aegea, e sobre o quê.
 *
 *  POR QUE ESTA TELA EXISTE
 *  ------------------------
 *  A ligação entre pessoa e assunto já estava modelada desde o começo:
 *  `PessoaAegeaTema` existe com o comentário dizendo para que serve —
 *  "sustenta a regra de 'fora do escopo': registro cujo tema não está na lista
 *  do porta-voz que o conduziu". O conceito existia e não havia como editá-lo.
 *  Os temas de cada pessoa vinham da planilha e ficavam.
 *
 *  PORTA-VOZ E EQUIPE SÃO PAPÉIS, NÃO GRAUS. Quem fala pela companhia conta no
 *  painel de exposição; quem acompanha, não. A marca aqui é o que decide se a
 *  pessoa aparece como porta-voz nas agendas.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  criarPessoaAegea,
  editarPessoaAegea,
  temasDoPortaVoz,
} from '@/api/cliente';
import {
  Botao,
  Campo,
  Cartao,
  Chip,
  FaixaDeErro,
  Secao,
  Vazio,
  estiloDeEntrada,
} from '@/componentes/basicos';
import { usePainel } from '@/estado/painel';
import type { PessoaAegea } from '@/dominio/tipos';

const VAZIA = {
  nome: '',
  cargo: '',
  email: '',
  eh_porta_voz: true,
  area_id: null as number | null,
  temas: [] as number[],
};

export function CadastroDePortaVozes() {
  const { catalogo, recarregar } = usePainel();
  const [erro, definirErro] = useState<string | null>(null);
  const [salvando, definirSalvando] = useState(false);
  const [nova, definirNova] = useState(VAZIA);
  const [emEdicao, definirEmEdicao] = useState<string | null>(null);
  const [rascunho, definirRascunho] = useState(VAZIA);
  const [busca, definirBusca] = useState('');

  //: Os assuntos de cada pessoa, carregados sob demanda.
  //:
  //: A listagem de pessoas alimenta o formulário de agenda, que não usa os
  //: temas — trazê-los junto seria uma consulta por pessoa em toda abertura de
  //: tela, para um dado que só esta aba lê.
  const [temasPorPessoa, definirTemasPorPessoa] = useState<Record<string, number[]>>(
    {},
  );

  //: `useMemo` porque a lista alimenta um efeito. Recriada a cada render, ela
  //: seria uma dependencia nova toda vez, e o efeito buscaria os temas de todo
  //: mundo em loop.
  const pessoas = useMemo(
    () =>
      [...(catalogo?.pessoas.values() ?? [])].sort((a, b) =>
        a.nome.localeCompare(b.nome, 'pt-BR'),
      ),
    [catalogo],
  );

  //: BUSCA POR NOME (E-MAIL E CARGO TAMBÉM), em memória — a lista inteira já
  //: vem carregada do catálogo do painel, mesmo padrão usado na Biblioteca de
  //: referências e nos Acessos.
  const pessoasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return pessoas;
    return pessoas.filter(
      (p) =>
        p.nome.toLowerCase().includes(termo) ||
        (p.email ?? '').toLowerCase().includes(termo) ||
        (p.cargo ?? '').toLowerCase().includes(termo),
    );
  }, [pessoas, busca]);

  useEffect(
    function carregarOsTemasDeCadaPessoa() {
      let vivo = true;
      void Promise.all(
        pessoas.map((p) =>
          temasDoPortaVoz(p.id)
            .then((temas) => [p.id, temas] as const)
            // Silencioso por pessoa: uma falha numa não pode esconder as
            // outras. A lista sai sem os assuntos daquela, e não vazia.
            .catch(() => [p.id, []] as const),
        ),
      ).then((pares) => vivo && definirTemasPorPessoa(Object.fromEntries(pares)));
      return () => {
        vivo = false;
      };
    },
    // `pessoas` inteiro, e nao so o tamanho: editar alguem sem mudar a
    // quantidade tambem precisa recarregar. Com o `useMemo` acima, a referencia
    // so muda quando o catalogo muda — que e exatamente quando importa.
    [pessoas],
  );

  const executar = async (acao: () => Promise<unknown>, aoTerminar: () => void) => {
    definirSalvando(true);
    definirErro(null);
    try {
      await acao();
      await recarregar();
      aoTerminar();
    } catch (falha) {
      definirErro((falha as Error).message);
    } finally {
      definirSalvando(false);
    }
  };

  if (!catalogo) return null;

  const assuntos = catalogo.dicionarios.temas;

  const alternar = (
    atual: { temas: number[] },
    definir: (v: never) => void,
    id: number,
  ) =>
    definir({
      ...atual,
      temas: atual.temas.includes(id)
        ? atual.temas.filter((t) => t !== id)
        : [...atual.temas, id],
    } as never);

  //: TROCAR PARA EQUIPE LIMPA OS ASSUNTOS.
  //:
  //: "Sobre o que pode falar" sustenta a regra de "fora do escopo" para quem
  //: FALA pela companhia — quem acompanha não conduz agenda sozinho, então a
  //: lista não tem o que autorizar. Deixar assuntos escolhidos numa pessoa que
  //: virou equipe guardaria uma autorização que a tela nem mostra mais.
  const escolherPapel = (
    atual: { eh_porta_voz: boolean; temas: number[] },
    definir: (v: never) => void,
    ehPortaVoz: boolean,
  ) =>
    definir({
      ...atual,
      eh_porta_voz: ehPortaVoz,
      temas: ehPortaVoz ? atual.temas : [],
    } as never);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {erro ? <FaixaDeErro mensagem={erro} /> : null}

      <Secao titulo="Cadastrar pessoa da Aegea">
        <Cartao>
          <p style={{ fontSize: 13, color: 'var(--cinza-2)', margin: '0 0 16px' }}>
            Os temas marcados são sobre o que esta pessoa pode falar. É o que
            sustenta a leitura de "fora do escopo": agenda cujo tema não está na
            lista de quem a conduziu.
          </p>

          <div className="grade grade--3" style={{ gap: 16 }}>
            <Campo rotulo="Nome" obrigatorio>
              <input
                style={estiloDeEntrada}
                value={nova.nome}
                onChange={(e) => definirNova({ ...nova, nome: e.target.value })}
                placeholder="Radamés Casseb"
              />
            </Campo>
            <Campo rotulo="E-mail">
              <input
                type="email"
                style={estiloDeEntrada}
                value={nova.email}
                onChange={(e) => definirNova({ ...nova, email: e.target.value })}
                placeholder="radames.casseb@aegea.com.br"
              />
            </Campo>
            <Campo rotulo="Cargo">
              <input
                style={estiloDeEntrada}
                value={nova.cargo}
                onChange={(e) => definirNova({ ...nova, cargo: e.target.value })}
                placeholder="Diretor de Relações Institucionais"
              />
            </Campo>
          </div>

          <div className="grade grade--3" style={{ gap: 16, marginTop: 14 }}>
            <Campo rotulo="Tipo">
              {/* PORTA-VOZ E EQUIPE SÃO PAPÉIS, e não graus. Quem fala pela
                  companhia conta no painel de exposição; quem acompanha, não. */}
              <SeletorDePapel
                ehPortaVoz={nova.eh_porta_voz}
                aoEscolher={(v) => escolherPapel(nova, definirNova as never, v)}
              />
            </Campo>
            <Campo rotulo="Área">
              <select
                style={estiloDeEntrada}
                value={nova.area_id ?? ''}
                onChange={(e) =>
                  definirNova({
                    ...nova,
                    area_id: e.target.value ? Number(e.target.value) : null,
                  })
                }
              >
                <option value="">Sem área definida</option>
                {catalogo.dicionarios.areas_pessoa.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.nome}
                  </option>
                ))}
              </select>
            </Campo>
          </div>

          <div style={{ marginTop: 14, opacity: nova.eh_porta_voz ? 1 : 0.5 }}>
            <Campo
              rotulo="Sobre o que pode falar"
              dica={
                nova.eh_porta_voz
                  ? undefined
                  : 'Só quem é porta-voz tem temas autorizados.'
              }
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                {assuntos.map((tema) => {
                  const ativo = nova.temas.includes(tema.id);
                  return (
                    <Chip
                      key={tema.id}
                      rotulo={tema.nome}
                      ativo={ativo}
                      fundo={ativo ? 'var(--turquesa-rio)' : 'var(--bg-trilho)'}
                      texto={ativo ? 'var(--sobre-turquesa)' : 'var(--cinza-3)'}
                      aoClicar={
                        nova.eh_porta_voz
                          ? () => alternar(nova, definirNova as never, tema.id)
                          : undefined
                      }
                    />
                  );
                })}
              </div>
            </Campo>
          </div>

          <div style={{ marginTop: 14 }}>
            <Botao
              variante="primario"
              desabilitado={salvando || !nova.nome.trim()}
              aoClicar={() =>
                void executar(
                  () =>
                    criarPessoaAegea({
                      nome: nova.nome,
                      cargo: nova.cargo || null,
                      email: nova.email || null,
                      eh_porta_voz: nova.eh_porta_voz,
                      area_id: nova.area_id,
                      temas: nova.temas,
                    }),
                  () => definirNova(VAZIA),
                )
              }
            >
              {salvando ? 'Salvando…' : 'Cadastrar'}
            </Botao>
          </div>
        </Cartao>
      </Secao>

      <Secao titulo={`Cadastradas (${pessoas.length})`}>
        <Cartao>
          <input
            style={{ ...estiloDeEntrada, marginBottom: 14 }}
            value={busca}
            onChange={(evento) => definirBusca(evento.target.value)}
            placeholder="Buscar por nome, e-mail ou cargo…"
            aria-label="Buscar pessoas da Aegea"
          />

          {pessoas.length === 0 ? (
            <Vazio mensagem="Ninguém cadastrado ainda." />
          ) : pessoasFiltradas.length === 0 ? (
            <Vazio mensagem="Nada com esse termo." />
          ) : null}

          {pessoasFiltradas.map((pessoa) => (
            <div
              key={pessoa.id}
              style={{
                paddingTop: 12,
                marginTop: 12,
                borderTop: '1px solid var(--borda)',
              }}
            >
              {emEdicao === pessoa.id ? (
                <EdicaoDaPessoa
                  rascunho={rascunho}
                  assuntos={assuntos}
                  areas={catalogo.dicionarios.areas_pessoa}
                  salvando={salvando}
                  aoRascunhar={definirRascunho}
                  aoAlternarTema={(id) =>
                    alternar(rascunho, definirRascunho as never, id)
                  }
                  aoEscolherPapel={(v) =>
                    escolherPapel(rascunho, definirRascunho as never, v)
                  }
                  aoCancelar={() => definirEmEdicao(null)}
                  aoSalvar={() =>
                    void executar(
                      () =>
                        editarPessoaAegea(pessoa.id, {
                          nome: rascunho.nome,
                          cargo: rascunho.cargo || null,
                          email: rascunho.email || null,
                          eh_porta_voz: rascunho.eh_porta_voz,
                          area_id: rascunho.area_id,
                          ativo: pessoa.ativo,
                          temas: rascunho.temas,
                        }).then((salva) => {
                          // O mapa local acompanha o que acabou de ser gravado:
                          // sem isto, a lista mostraria os assuntos antigos até
                          // a próxima montagem da aba.
                          definirTemasPorPessoa((atual) => ({
                            ...atual,
                            [salva.id]: rascunho.temas,
                          }));
                        }),
                      () => definirEmEdicao(null),
                    )
                  }
                />
              ) : (
                <LinhaDaPessoa
                  pessoa={pessoa}
                  temas={temasPorPessoa[pessoa.id] ?? []}
                  nomeDoTema={(id) => assuntos.find((t) => t.id === id)?.nome ?? ''}
                  nomeDaArea={(id) =>
                    catalogo.dicionarios.areas_pessoa.find((a) => a.id === id)?.nome ?? ''
                  }
                  salvando={salvando}
                  aoEditar={() => {
                    definirEmEdicao(pessoa.id);
                    definirRascunho({
                      nome: pessoa.nome,
                      cargo: pessoa.cargo ?? '',
                      email: pessoa.email ?? '',
                      eh_porta_voz: pessoa.eh_porta_voz,
                      area_id: pessoa.area_id,
                      temas: temasPorPessoa[pessoa.id] ?? [],
                    });
                  }}
                  aoAlternarAtivo={() =>
                    void executar(
                      () =>
                        editarPessoaAegea(pessoa.id, {
                          nome: pessoa.nome,
                          cargo: pessoa.cargo,
                          email: pessoa.email,
                          eh_porta_voz: pessoa.eh_porta_voz,
                          area_id: pessoa.area_id,
                          ativo: !pessoa.ativo,
                          // A LISTA DE TEMAS VAI JUNTO, e não vazia: o `PUT`
                          // substitui a lista inteira, e mandar `[]` num
                          // simples desligar apagaria tudo o que a pessoa podia
                          // falar. É a mesma armadilha da pauta, num campo
                          // diferente.
                          temas: temasPorPessoa[pessoa.id] ?? [],
                        }),
                      () => undefined,
                    )
                  }
                />
              )}
            </div>
          ))}
        </Cartao>
      </Secao>
    </div>
  );
}

function LinhaDaPessoa({
  pessoa,
  temas,
  nomeDoTema,
  nomeDaArea,
  salvando,
  aoEditar,
  aoAlternarAtivo,
}: {
  pessoa: PessoaAegea;
  temas: number[];
  nomeDoTema: (id: number) => string;
  nomeDaArea: (id: number) => string;
  salvando: boolean;
  aoEditar: () => void;
  aoAlternarAtivo: () => void;
}) {
  const area = pessoa.area_id != null ? nomeDaArea(pessoa.area_id) : '';
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: pessoa.ativo ? 'var(--cinza-4)' : 'var(--cinza-2)',
              textDecoration: pessoa.ativo ? 'none' : 'line-through',
            }}
          >
            {pessoa.nome}
            {area ? (
              <span style={{ fontWeight: 400, color: 'var(--cinza-2)' }}>{` · ${area}`}</span>
            ) : null}
            {pessoa.eh_porta_voz ? null : (
              <span style={{ fontWeight: 400, color: 'var(--cinza-2)' }}>
                {' · equipe'}
              </span>
            )}
          </p>
          <p style={{ fontSize: 12, color: 'var(--cinza-2)' }}>
            {pessoa.cargo || 'sem cargo'}
            {' · '}
            {pessoa.email ? (
              <a href={`mailto:${pessoa.email}`} style={{ color: 'var(--azul-mar)' }}>
                {pessoa.email}
              </a>
            ) : (
              'sem e-mail'
            )}
          </p>
        </div>
        <Botao variante="fantasma" desabilitado={salvando} aoClicar={aoEditar}>
          Editar
        </Botao>
        <Botao
          variante="fantasma"
          desabilitado={salvando}
          aoClicar={aoAlternarAtivo}
          rotuloAcessivel={`${pessoa.ativo ? 'Desligar' : 'Reativar'} ${pessoa.nome}`}
        >
          {pessoa.ativo ? 'Desligar' : 'Reativar'}
        </Botao>
      </div>

      <p style={{ fontSize: 12, color: 'var(--cinza-3)', marginTop: 6 }}>
        {temas.length === 0
          ? 'Nenhum tema autorizado ainda.'
          : temas.map(nomeDoTema).filter(Boolean).join(' · ')}
      </p>
    </>
  );
}

function EdicaoDaPessoa({
  rascunho,
  assuntos,
  areas,
  salvando,
  aoRascunhar,
  aoAlternarTema,
  aoEscolherPapel,
  aoCancelar,
  aoSalvar,
}: {
  rascunho: typeof VAZIA;
  assuntos: { id: number; nome: string }[];
  areas: { id: number; nome: string }[];
  salvando: boolean;
  aoRascunhar: (r: typeof VAZIA) => void;
  aoAlternarTema: (id: number) => void;
  aoEscolherPapel: (ehPortaVoz: boolean) => void;
  aoCancelar: () => void;
  aoSalvar: () => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="grade grade--3" style={{ gap: 12 }}>
        <Campo rotulo="Nome">
          <input
            style={estiloDeEntrada}
            value={rascunho.nome}
            onChange={(e) => aoRascunhar({ ...rascunho, nome: e.target.value })}
          />
        </Campo>
        <Campo rotulo="E-mail">
          <input
            type="email"
            style={estiloDeEntrada}
            value={rascunho.email}
            onChange={(e) => aoRascunhar({ ...rascunho, email: e.target.value })}
          />
        </Campo>
        <Campo rotulo="Cargo">
          <input
            style={estiloDeEntrada}
            value={rascunho.cargo}
            onChange={(e) => aoRascunhar({ ...rascunho, cargo: e.target.value })}
          />
        </Campo>
      </div>

      <div className="grade grade--3" style={{ gap: 12 }}>
        <Campo rotulo="Tipo">
          <SeletorDePapel ehPortaVoz={rascunho.eh_porta_voz} aoEscolher={aoEscolherPapel} />
        </Campo>
        <Campo rotulo="Área">
          <select
            style={estiloDeEntrada}
            value={rascunho.area_id ?? ''}
            onChange={(e) =>
              aoRascunhar({
                ...rascunho,
                area_id: e.target.value ? Number(e.target.value) : null,
              })
            }
          >
            <option value="">Sem área definida</option>
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.nome}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      <div style={{ opacity: rascunho.eh_porta_voz ? 1 : 0.5 }}>
        <Campo
          rotulo="Sobre o que pode falar"
          dica={
            rascunho.eh_porta_voz
              ? undefined
              : 'Só quem é porta-voz tem temas autorizados.'
          }
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
            {assuntos.map((tema) => {
              const ativo = rascunho.temas.includes(tema.id);
              return (
                <Chip
                  key={tema.id}
                  rotulo={tema.nome}
                  ativo={ativo}
                  fundo={ativo ? 'var(--turquesa-rio)' : 'var(--bg-trilho)'}
                  texto={ativo ? 'var(--sobre-turquesa)' : 'var(--cinza-3)'}
                  aoClicar={rascunho.eh_porta_voz ? () => aoAlternarTema(tema.id) : undefined}
                />
              );
            })}
          </div>
        </Campo>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <Botao variante="primario" desabilitado={salvando} aoClicar={aoSalvar}>
          Salvar
        </Botao>
        <Botao aoClicar={aoCancelar}>Cancelar</Botao>
      </div>
    </div>
  );
}

/** Porta-voz ou equipe — a escolha por trás de `eh_porta_voz`, dita como
 *  pergunta em vez de caixa marcada. Duas pílulas, e não um `<select>`: são só
 *  duas opções, sempre as mesmas, e qual está ativa precisa estar visível sem
 *  abrir nada — o mesmo raciocínio do seletor de granularidade do Painel. */
function SeletorDePapel({
  ehPortaVoz,
  aoEscolher,
}: {
  ehPortaVoz: boolean;
  aoEscolher: (ehPortaVoz: boolean) => void;
}) {
  const opcoes: { valor: boolean; rotulo: string }[] = [
    { valor: true, rotulo: 'Porta-voz' },
    { valor: false, rotulo: 'Equipe' },
  ];
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {opcoes.map((opcao) => {
        const ativo = ehPortaVoz === opcao.valor;
        return (
          <button
            key={String(opcao.valor)}
            type="button"
            onClick={() => aoEscolher(opcao.valor)}
            aria-pressed={ativo}
            style={{
              flex: 1,
              height: 38,
              borderRadius: 'var(--r-btn)',
              border: ativo ? '1px solid var(--azul-mar)' : '1px solid var(--borda-input)',
              background: ativo ? 'var(--azul-mar)' : 'var(--branco)',
              color: ativo ? 'var(--branco)' : 'var(--cinza-3)',
              fontSize: 13,
              fontWeight: ativo ? 700 : 500,
              cursor: 'pointer',
            }}
          >
            {opcao.rotulo}
          </button>
        );
      })}
    </div>
  );
}
