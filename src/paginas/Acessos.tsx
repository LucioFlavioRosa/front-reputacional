/** Administração de acessos — quem entra, o que alcança, e até quando.
 *
 *  A tela existe por um motivo específico: sem ela, conceder acesso é `UPDATE`
 *  manual no banco, e ninguém audita `UPDATE` manual. Acesso a terceiro sem
 *  registro de quem concedeu é o tipo de coisa que só se descobre quando já
 *  não dá para reconstruir.
 *
 *  O que ela mostra e o que ela esconde:
 *
 *    - o prazo de quem é externo aparece com destaque quando está perto de
 *      vencer, porque acesso de terceiro que vence em silêncio é o caso que
 *      motivou o campo
 *    - o histórico fica a um clique, e não escondido, porque a pergunta "quem
 *      liberou isto?" costuma aparecer no meio de uma investigação, não antes
 *
 *  A tela NÃO é a barreira. Esconder botão é conveniência: quem decide é o
 *  backend, que responde 403.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  concederAcesso,
  definirSituacaoDeAcesso,
  historicoDeAcesso,
  listarAcessos,
  listarPapeis,
} from '@/api/cliente';
import {
  Botao,
  Campo,
  Carregando,
  Cartao,
  Chip,
  FaixaDeErro,
  Modal,
  Secao,
  Selo,
  Vazio,
  estiloDeEntrada,
} from '@/componentes/basicos';
import { dataCompleta, diasDesde } from '@/dominio/formato';
import { formularioDe, impedimento, montarConcessao } from '@/dominio/concessao';
import type { Formulario } from '@/dominio/concessao';
import type { Acesso, PapelDisponivel, TrilhaDeAcesso } from '@/dominio/tipos';

/** Abaixo disto o prazo aparece em vermelho: é hora de renovar ou encerrar. */
const DIAS_DE_ALERTA = 30;

export function Acessos({ euId }: { euId: string | null }) {
  const [pessoas, definirPessoas] = useState<Acesso[] | null>(null);
  const [papeis, definirPapeis] = useState<PapelDisponivel[]>([]);
  const [erro, definirErro] = useState<string | null>(null);
  const [emEdicao, definirEmEdicao] = useState<Acesso | null>(null);
  const [emHistorico, definirEmHistorico] = useState<Acesso | null>(null);
  const [aDesativar, definirADesativar] = useState<Acesso | null>(null);
  const [busca, definirBusca] = useState('');

  const carregar = async () => {
    definirErro(null);
    try {
      const [lista, disponiveis] = await Promise.all([listarAcessos(), listarPapeis()]);
      definirPessoas(lista);
      definirPapeis(disponiveis);
    } catch (falha) {
      definirErro(falha instanceof Error ? falha.message : 'Falha ao carregar acessos.');
      definirPessoas([]);
    }
  };

  useEffect(function carregarPessoasAoAbrir() {
    void carregar();
  }, []);

  /** Religar é reversível e não tira nada de ninguém: vai direto.
   *
   *  Desligar passa pela confirmação — ver `ConfirmarDesativacao`. Pedir
   *  confirmação para as duas faria a pessoa aprender a clicar em "sim" sem
   *  ler, e aí a confirmação que importa também deixaria de ser lida.
   */
  const reativar = async (pessoa: Acesso) => {
    definirErro(null);
    try {
      await definirSituacaoDeAcesso(pessoa.id, true);
      await carregar();
    } catch (falha) {
      definirErro(falha instanceof Error ? falha.message : 'Falha ao reativar.');
    }
  };

  //: BUSCA POR NOME (E E-MAIL), em memória — a lista inteira já chegou do
  //: servidor numa chamada só (`listarAcessos()`, sem paginação), então
  //: filtrar aqui é o mesmo padrão já usado na Biblioteca de referências.
  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return pessoas ?? [];
    return (pessoas ?? []).filter(
      (p) => p.nome.toLowerCase().includes(termo) || p.email.toLowerCase().includes(termo),
    );
  }, [pessoas, busca]);

  const { internos, externos, semAcesso } = useMemo(() => {
    return {
      // Quem não tem papel encabeça a lista: é o convidado que entrou pelo SSO
      // e está esperando alguém liberar. Deixá-lo no fim da tabela é deixá-lo
      // esperando mais.
      semAcesso: filtradas.filter((p) => !p.papel),
      externos: filtradas.filter((p) => p.papel && p.externo),
      internos: filtradas.filter((p) => p.papel && !p.externo),
    };
  }, [filtradas]);

  if (erro) return <FaixaDeErro mensagem={erro} />;
  if (!pessoas) return <Carregando rotulo="Carregando acessos…" />;

  return (
    <>
      <Secao titulo="Acessos">
        <p style={{ color: 'var(--cinza-2)', fontSize: 13, margin: '0 0 16px' }}>
          Quem entra no painel, o que cada um alcança e até quando.
        </p>

        <input
          style={{ ...estiloDeEntrada, marginBottom: 16 }}
          value={busca}
          onChange={(evento) => definirBusca(evento.target.value)}
          placeholder="Buscar por nome ou e-mail…"
          aria-label="Buscar nos acessos"
        />

        {semAcesso.length > 0 && (
          <Cartao titulo={`Aguardando liberação (${semAcesso.length})`}>
            <p style={{ color: 'var(--cinza-2)', fontSize: 13, margin: '0 0 12px' }}>
              Entraram pelo SSO e ainda não têm papel. Enquanto isso, não
              enxergam nada.
            </p>
            <Tabela
              pessoas={semAcesso}
              aoEditar={definirEmEdicao}
              aoVerHistorico={definirEmHistorico}
              aoDesativar={definirADesativar}
              aoReativar={reativar}
              euId={euId}
            />
          </Cartao>
        )}

        <Cartao titulo={`Externos (${externos.length})`}>
          <Tabela
            pessoas={externos}
            mostrarPrazo
            aoEditar={definirEmEdicao}
            aoVerHistorico={definirEmHistorico}
            aoDesativar={definirADesativar}
            aoReativar={reativar}
            euId={euId}
          />
        </Cartao>

        <Cartao titulo={`Da casa (${internos.length})`}>
          <Tabela
            pessoas={internos}
            aoEditar={definirEmEdicao}
            aoVerHistorico={definirEmHistorico}
            aoDesativar={definirADesativar}
            aoReativar={reativar}
            euId={euId}
          />
        </Cartao>
      </Secao>

      {emEdicao && (
        <FormularioDeConcessao
          pessoa={emEdicao}
          papeis={papeis}
          aoFechar={() => definirEmEdicao(null)}
          aoSalvar={async () => {
            definirEmEdicao(null);
            await carregar();
          }}
        />
      )}

      {emHistorico && (
        <Historico pessoa={emHistorico} aoFechar={() => definirEmHistorico(null)} />
      )}

      {aDesativar && (
        <ConfirmarDesativacao
          pessoa={aDesativar}
          aoFechar={() => definirADesativar(null)}
          aoConfirmar={async () => {
            definirADesativar(null);
            await carregar();
          }}
        />
      )}
    </>
  );
}

function Tabela({
  pessoas,
  mostrarPrazo = false,
  aoEditar,
  aoVerHistorico,
  aoDesativar,
  aoReativar,
  euId,
}: {
  pessoas: Acesso[];
  mostrarPrazo?: boolean;
  aoEditar: (p: Acesso) => void;
  aoVerHistorico: (p: Acesso) => void;
  aoDesativar: (p: Acesso) => void;
  aoReativar: (p: Acesso) => void | Promise<void>;
  /** Quem está olhando. A própria linha não ganha botão de desativar. */
  euId: string | null;
}) {
  if (pessoas.length === 0) return <Vazio mensagem="Ninguém nesta situação." />;

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: 'left', color: 'var(--cinza-2)' }}>
            <th style={celulaDeCabecalho}>Pessoa</th>
            <th style={celulaDeCabecalho}>Papel</th>
            <th style={celulaDeCabecalho}>Alcance</th>
            {mostrarPrazo && <th style={celulaDeCabecalho}>Prazo</th>}
            <th style={celulaDeCabecalho}>Concedido por</th>
            <th style={celulaDeCabecalho} />
          </tr>
        </thead>
        <tbody>
          {pessoas.map((pessoa) => (
            <tr key={pessoa.id} style={{ borderTop: '1px solid var(--borda)' }}>
              <td style={celula}>
                <strong>{pessoa.nome}</strong>
                <br />
                <span style={{ color: 'var(--cinza-2)' }}>{pessoa.email}</span>
                {!pessoa.ativo && (
                  <Selo rotulo="inativo" fundo="var(--erro-bg)" texto="var(--erro-fg)" />
                )}
              </td>
              <td style={celula}>
                {pessoa.papel ? <Chip rotulo={pessoa.papel} /> : '—'}
              </td>
              <td style={celula}>
                <Alcance pessoa={pessoa} />
              </td>
              {mostrarPrazo && (
                <td style={celula}>
                  <Prazo ate={pessoa.expira_em} />
                </td>
              )}
              <td style={{ ...celula, color: 'var(--cinza-2)' }}>
                {pessoa.concedido_por ?? '—'}
              </td>
              <td style={{ ...celula, textAlign: 'right', whiteSpace: 'nowrap' }}>
                <Botao variante="secundario" aoClicar={() => aoVerHistorico(pessoa)}>
                  Histórico
                </Botao>{' '}
                <Botao aoClicar={() => aoEditar(pessoa)}>Alterar</Botao>{' '}
                {/* A PRÓPRIA LINHA NÃO GANHA BOTÃO.
                    O backend recusa ("Ninguém desativa a própria conta"), e
                    oferecer o botão seria convidar para uma porta que não
                    abre — a pessoa clica, lê o nome no modal, digita, e só
                    então leva 403. Esconder é conveniência de tela; quem
                    decide continua sendo o backend. */}
                {pessoa.id === euId ? null : pessoa.ativo ? (
                  <Botao variante="secundario" aoClicar={() => aoDesativar(pessoa)}>
                    Desativar
                  </Botao>
                ) : (
                  <Botao variante="secundario" aoClicar={() => void aoReativar(pessoa)}>
                    Reativar
                  </Botao>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Alcance({ pessoa }: { pessoa: Acesso }) {
  if (pessoa.acesso_irrestrito) return <span>Tudo</span>;
  if (pessoa.frentes.length === 0 && pessoa.unidades.length === 0) {
    // O caso que confunde: tem papel e não vê nada. É o padrão de quem foi
    // criado sem escopo — e a mensagem precisa dizer isso, não ficar em branco.
    return <span style={{ color: 'var(--erro-fg)' }}>Nada — sem escopo</span>;
  }
  return (
    <span>
      {[...pessoa.frentes, ...pessoa.unidades].map((valor) => (
        <Chip key={valor} rotulo={valor} />
      ))}
    </span>
  );
}

function Prazo({ ate }: { ate: string | null }) {
  if (!ate) return <span style={{ color: 'var(--cinza-2)' }}>sem prazo</span>;

  const faltam = -diasDesde(ate);
  const vencido = faltam < 0;
  const perto = faltam >= 0 && faltam <= DIAS_DE_ALERTA;

  return (
    <span style={{ color: vencido || perto ? 'var(--erro-fg)' : undefined }}>
      {dataCompleta(ate)}
      <br />
      <span style={{ fontSize: 12 }}>
        {vencido ? 'vencido' : `faltam ${faltam} dias`}
      </span>
    </span>
  );
}

function FormularioDeConcessao({
  pessoa,
  papeis,
  aoFechar,
  aoSalvar,
}: {
  pessoa: Acesso;
  papeis: PapelDisponivel[];
  aoFechar: () => void;
  aoSalvar: () => void | Promise<void>;
}) {
  const [forma, definirForma] = useState(() => formularioDe(pessoa));
  const [salvando, definirSalvando] = useState(false);
  const [erro, definirErro] = useState<string | null>(null);

  const { papel, irrestrito, externo, expira, frentes, unidades } = forma;
  const ajustar = (mudanca: Partial<Formulario>) =>
    definirForma((atual) => ({ ...atual, ...mudanca }));

  // O que o backend recusaria, dito antes de a pessoa preencher o resto.
  const barreira = impedimento(forma);

  const salvar = async () => {
    if (barreira) return;
    definirSalvando(true);
    definirErro(null);
    try {
      await concederAcesso(pessoa.id, montarConcessao(pessoa, forma));
      await aoSalvar();
    } catch (falha) {
      // A mensagem vem do backend — "Acesso externo exige prazo", "Frente
      // desconhecida: X". Escrever outra aqui esconderia a que explica.
      definirErro(falha instanceof Error ? falha.message : 'Falha ao conceder.');
      definirSalvando(false);
    }
  };

  return (
    <Modal titulo={`Acesso de ${pessoa.nome}`} aoFechar={aoFechar}>
      {erro && <FaixaDeErro mensagem={erro} />}

      <Campo rotulo="Papel">
        <select
          value={papel}
          onChange={(e) => ajustar({ papel: e.target.value })}
          style={estiloDeEntrada}
        >
          <option value="">Sem acesso</option>
          {papeis.map((p) => (
            <option key={p.codigo} value={p.codigo}>
              {p.nome}
            </option>
          ))}
        </select>
      </Campo>

      <Campo rotulo="É de fora da Aegea">
        <input
          type="checkbox"
          checked={externo}
          onChange={(e) =>
            // Externo e irrestrito não se combinam — o banco recusa. Desmarcar
            // junto evita que a pessoa preencha o formulário inteiro para
            // descobrir isso no fim.
            ajustar({ externo: e.target.checked, irrestrito: false })
          }
        />
      </Campo>

      {externo && (
        <Campo
          rotulo="Vence em"
          dica="Obrigatório para quem é de fora."
        >
          <input
            type="date"
            value={expira}
            onChange={(e) => ajustar({ expira: e.target.value })}
            style={estiloDeEntrada}
          />
        </Campo>
      )}

      {!externo && (
        <Campo rotulo="Alcança tudo">
          <input
            type="checkbox"
            checked={irrestrito}
            onChange={(e) => ajustar({ irrestrito: e.target.checked })}
          />
        </Campo>
      )}

      {!irrestrito && papel && (
        <>
          <Campo
            rotulo="Frentes"
            dica="Separadas por vírgula. Vazias e sem alcance total: não vê nada."
          >
            <input
              value={frentes}
              onChange={(e) => ajustar({ frentes: e.target.value })}
              placeholder="imprensa, governo"
              style={estiloDeEntrada}
            />
          </Campo>

          {/* As unidades são editáveis, e não só reenviadas: o formulário manda
              o estado COMPLETO do alcance, então esconder metade dele faria a
              tela parecer definir uma coisa e definir outra. */}
          <Campo rotulo="Unidades de negócio" dica="Separadas por vírgula.">
            <input
              value={unidades}
              onChange={(e) => ajustar({ unidades: e.target.value })}
              placeholder="Prolagos, Águas de Timon"
              style={estiloDeEntrada}
            />
          </Campo>
        </>
      )}

      {!papel && (
        <p style={{ color: 'var(--cinza-2)', fontSize: 13 }}>
          Sem papel, a pessoa continua existindo e não alcança nada. Prazo e
          escopo são apagados — guardar o alcance de quem não tem acesso é
          guardar uma surpresa para quem conceder papel depois.
        </p>
      )}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
        <Botao variante="secundario" aoClicar={aoFechar}>
          Cancelar
        </Botao>
        <Botao
          aoClicar={salvar}
          desabilitado={salvando || Boolean(barreira)}
          titulo={barreira ?? undefined}
        >
          {salvando ? 'Salvando…' : 'Salvar'}
        </Botao>
      </div>
    </Modal>
  );
}

function Historico({ pessoa, aoFechar }: { pessoa: Acesso; aoFechar: () => void }) {
  const [linhas, definirLinhas] = useState<TrilhaDeAcesso[] | null>(null);
  const [erro, definirErro] = useState<string | null>(null);

  //: FALHA NÃO É VAZIO. Antes o `catch` chamava `definirLinhas([])`, e a tela
  //: dizia "Nenhuma alteração registrada" — uma afirmação sobre a trilha de
  //: auditoria de uma pessoa, feita a partir de uma requisição que não voltou.
  //: Num histórico de acesso, "não houve mudança" e "não consegui ler" são
  //: respostas opostas.
  useEffect(function carregarHistoricoDaPessoa() {
    definirErro(null);
    historicoDeAcesso(pessoa.id)
      .then(definirLinhas)
      .catch((falha: unknown) =>
        definirErro(falha instanceof Error ? falha.message : 'Não foi possível ler.'),
      );
  }, [pessoa.id]);

  return (
    <Modal titulo={`Histórico de ${pessoa.nome}`} aoFechar={aoFechar}>
      {erro && <FaixaDeErro mensagem={erro} />}
      {!linhas && !erro && <Carregando />}
      {linhas?.length === 0 && <Vazio mensagem="Nenhuma alteração registrada." />}
      {linhas && linhas.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <tbody>
            {linhas.map((linha, indice) => (
              <tr key={indice} style={{ borderTop: '1px solid var(--borda)' }}>
                <td style={celula}>{dataCompleta(linha.ocorrido_em)}</td>
                <td style={celula}>{linha.campo}</td>
                <td style={celula}>
                  {linha.valor_anterior ?? '—'} → {linha.valor_novo ?? '—'}
                </td>
                <td style={celula}>
                  {/* Autor nulo significa alteração fora da aplicação. Mostrar
                      a conta de banco é o que separa "não sei" de "foi por
                      fora do sistema". */}
                  {linha.concedido_por ?? (
                    <Selo
                      rotulo={`fora do sistema (${linha.origem ?? '?'})`}
                      fundo="var(--erro-bg)"
                      texto="var(--erro-fg)"
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  );
}

const celulaDeCabecalho = {
  padding: '8px 10px',
  fontWeight: 500,
  fontSize: 12,
  textTransform: 'uppercase' as const,
  letterSpacing: 0.3,
};

const celula = { padding: '10px', verticalAlign: 'top' as const };

/** A confirmação de desativar, com o nome digitado.
 *
 *  NÃO é cerimônia. Desativar é a ÚNICA remoção que o produto tem — ninguém é
 *  apagado, porque `interacao.criado_por` e mais nove chaves apontam para
 *  `usuario` e apagar a pessoa apagaria a autoria dos registros dela. Então
 *  este botão é o fim da linha, e ele fica na mesma coluna de "Alterar", a um
 *  pixel de distância.
 *
 *  Digitar o nome não é para dificultar: é para obrigar a LER de quem se
 *  trata. Um "tem certeza?" seria clicado no reflexo, e numa tabela com
 *  dezenas de linhas a pessoa errada está sempre a uma linha da certa.
 *
 *  O efeito é imediato — o backend descarta a permissão em cache no ato —, e é
 *  isso que o texto promete. Reversível pelo botão Reativar, que não pede
 *  confirmação nenhuma.
 */
function ConfirmarDesativacao({
  pessoa,
  aoFechar,
  aoConfirmar,
}: {
  pessoa: Acesso;
  aoFechar: () => void;
  aoConfirmar: () => void | Promise<void>;
}) {
  const [digitado, definirDigitado] = useState('');
  const [salvando, definirSalvando] = useState(false);
  const [erro, definirErro] = useState<string | null>(null);

  // Comparação frouxa de propósito: espaço sobrando e caixa não são o ponto.
  // O ponto é ter lido o nome.
  const confere =
    digitado.trim().replace(/\s+/g, ' ').toLowerCase() ===
    pessoa.nome.trim().replace(/\s+/g, ' ').toLowerCase();

  const desativar = async () => {
    definirErro(null);
    definirSalvando(true);
    try {
      await definirSituacaoDeAcesso(pessoa.id, false);
      await aoConfirmar();
    } catch (falha) {
      definirSalvando(false);
      definirErro(falha instanceof Error ? falha.message : 'Falha ao desativar.');
    }
  };

  return (
    <Modal titulo="Desativar acesso" aoFechar={aoFechar} largura={520}>
      <p style={{ fontSize: 14, lineHeight: 1.6, margin: '0 0 12px' }}>
        <strong>{pessoa.nome}</strong> perde o acesso ao painel imediatamente,
        e não consegue mais entrar — nem pelo SSO.
      </p>
      <p style={{ fontSize: 13, color: 'var(--cinza-2)', lineHeight: 1.6, margin: '0 0 16px' }}>
        Os registros que essa pessoa criou permanecem, com o nome dela. Nada é
        apagado, e o acesso pode ser devolvido depois pelo botão Reativar.
      </p>

      <Campo rotulo={`Digite “${pessoa.nome}” para confirmar`}>
        <input
          style={estiloDeEntrada}
          value={digitado}
          onChange={(evento) => definirDigitado(evento.target.value)}
          autoFocus
          aria-describedby="por-que-digitar"
        />
      </Campo>
      <p id="por-que-digitar" style={{ fontSize: 12, color: 'var(--cinza-3)', margin: '6px 0 0' }}>
        Pedimos o nome para você conferir de quem se trata — as linhas da
        tabela são parecidas.
      </p>

      {erro && (
        <div style={{ marginTop: 14 }}>
          <FaixaDeErro mensagem={erro} />
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
        <Botao variante="secundario" aoClicar={aoFechar}>
          Cancelar
        </Botao>
        <Botao
          variante="primario"
          aoClicar={() => void desativar()}
          desabilitado={!confere || salvando}
        >
          {salvando ? 'Desativando…' : 'Desativar acesso'}
        </Botao>
      </div>
    </Modal>
  );
}
