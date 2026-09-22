/** Apurar o que está circulando.
 *
 *  A alegação NASCE no registro da consulta (ver `CamposDaConsulta`): quem lê
 *  o e-mail reconhece a premissa e a cadastra ali. Esta tela é o outro lado —
 *  o trabalho da área depois: verificar, dizer em que pé está, e amarrar o
 *  posicionamento da biblioteca que responde.
 *
 *  AMARRAR O POSICIONAMENTO É O QUE ESVAZIA A FILA. A aba de Sinais cobra
 *  "circula e não temos resposta publicada" olhando exatamente para este
 *  campo; enquanto ele estiver vazio, a alegação continua na fila.
 *
 *  NÃO HÁ EXCLUIR. A alegação é o histórico do que circulou — apagá-la
 *  reescreveria a leitura de um período que já foi lido. Sai de circulação
 *  por Desativar, o mesmo verbo de instituição e contato.
 */

import { useEffect, useState } from 'react';
import { editarAlegacao, listarAlegacoesParaAdministracao } from '@/api/cliente';
import { usePainel } from '@/estado/painel';
import {
  Botao,
  Campo,
  Carregando,
  Cartao,
  Chip,
  FaixaDeErro,
  Secao,
  Vazio,
  estiloDeEntrada,
} from '@/componentes/basicos';
import { CampoQueCompleta } from '@/componentes/CampoQueCompleta';
import { dataCompleta } from '@/dominio/formato';
import { nomesDosTemas } from '@/dominio/derivacoes';
import type { Alegacao } from '@/dominio/tipos';

export function Alegacoes() {
  const { catalogo, recarregar } = usePainel();
  const [alegacoes, definirAlegacoes] = useState<Alegacao[] | null>(null);
  const [erro, definirErro] = useState<string | null>(null);
  const [emEdicao, definirEmEdicao] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    listarAlegacoesParaAdministracao()
      .then((lista) => ativo && definirAlegacoes(lista))
      .catch((falha: unknown) =>
        ativo &&
        definirErro(falha instanceof Error ? falha.message : 'Não foi possível carregar.'),
      );
    return () => {
      ativo = false;
    };
  }, []);

  async function salvar(alegacao: Alegacao, mudancas: Partial<Alegacao>) {
    definirErro(null);
    try {
      const atualizada = await editarAlegacao(alegacao.id, {
        texto: mudancas.texto ?? alegacao.texto,
        temas: mudancas.temas ?? alegacao.temas,
        apuracao_id: mudancas.apuracao_id ?? alegacao.apuracao_id,
        referencia_id:
          mudancas.referencia_id !== undefined ? mudancas.referencia_id : alegacao.referencia_id,
        nota: mudancas.nota !== undefined ? mudancas.nota : alegacao.nota,
        ativo: mudancas.ativo ?? alegacao.ativo,
      });
      definirAlegacoes((atual) =>
        (atual ?? []).map((a) => (a.id === atualizada.id ? atualizada : a)),
      );
      definirEmEdicao(null);
      // O catálogo guarda a lista que o formulário oferece: sem isto, a
      // alegação desativada continuaria sendo oferecida numa consulta nova.
      recarregar();
    } catch (falha) {
      definirErro(falha instanceof Error ? falha.message : 'Não foi possível salvar.');
    }
  }

  if (!catalogo || alegacoes === null) return <Carregando rotulo="Carregando as alegações…" />;

  return (
    <Secao
      titulo="Alegações"
      subtitulo="O que as consultas recebidas deram como fato. Apurar é dizer em que pé está e amarrar o posicionamento que responde."
    >
      {erro ? <FaixaDeErro mensagem={erro} /> : null}

      {alegacoes.length === 0 ? (
        <Vazio
          mensagem="Nenhuma alegação registrada"
          dica="Elas nascem no registro de uma consulta recebida, com quem lê o e-mail."
        />
      ) : (
        <Cartao>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {alegacoes.map((alegacao) => (
              <li
                key={alegacao.id}
                style={{
                  padding: '12px 0',
                  borderTop: '1px solid var(--borda)',
                  opacity: alegacao.ativo ? 1 : 0.55,
                }}
              >
                <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{alegacao.texto}</span>
                  <span style={{ fontSize: 11, color: 'var(--cinza-2)', whiteSpace: 'nowrap' }}>
                    {alegacao.consultas} consulta{alegacao.consultas === 1 ? '' : 's'}
                    {alegacao.criado_em ? ` · desde ${dataCompleta(alegacao.criado_em)}` : ''}
                  </span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 6,
                    alignItems: 'center',
                    marginTop: 6,
                  }}
                >
                  {catalogo.dicionarios.apuracoes.map((apuracao) => (
                    <Chip
                      key={apuracao.id}
                      rotulo={apuracao.nome}
                      ativo={alegacao.apuracao_id === apuracao.id}
                      aoClicar={() => salvar(alegacao, { apuracao_id: apuracao.id })}
                    />
                  ))}
                  {alegacao.temas.length ? (
                    <span style={{ fontSize: 11, color: 'var(--cinza-2)' }}>
                      {nomesDosTemas(catalogo, alegacao.temas).join(', ')}
                    </span>
                  ) : null}
                  <span style={{ flex: 1 }} />
                  <Botao
                    variante="fantasma"
                    aoClicar={() => definirEmEdicao(emEdicao === alegacao.id ? null : alegacao.id)}
                  >
                    {emEdicao === alegacao.id ? 'Fechar' : 'Apurar'}
                  </Botao>
                  <Botao
                    variante="fantasma"
                    aoClicar={() => salvar(alegacao, { ativo: !alegacao.ativo })}
                  >
                    {alegacao.ativo ? 'Desativar' : 'Reativar'}
                  </Botao>
                </div>

                {emEdicao === alegacao.id ? (
                  <Apuracao alegacao={alegacao} aoSalvar={salvar} catalogo={catalogo} />
                ) : (
                  <p style={{ fontSize: 12, color: 'var(--cinza-2)', margin: '6px 0 0' }}>
                    {alegacao.referencia_id
                      ? `Responde: ${
                          catalogo.referencias.find((r) => r.id === alegacao.referencia_id)
                            ?.titulo ?? 'referência removida'
                        }`
                      : 'Sem posicionamento publicado.'}
                    {alegacao.nota ? ` · ${alegacao.nota}` : ''}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Cartao>
      )}
    </Secao>
  );
}

function Apuracao({
  alegacao,
  aoSalvar,
  catalogo,
}: {
  alegacao: Alegacao;
  aoSalvar: (alegacao: Alegacao, mudancas: Partial<Alegacao>) => void;
  catalogo: { referencias: { id: string; titulo: string; ativo: boolean }[] };
}) {
  const [referencia, definirReferencia] = useState(alegacao.referencia_id ?? '');
  const [nota, definirNota] = useState(alegacao.nota ?? '');

  return (
    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <CampoQueCompleta
        rotulo="Posicionamento que responde"
        valor={referencia}
        aoEscolher={definirReferencia}
        opcoes={catalogo.referencias
          .filter((r) => r.ativo)
          .map((r) => ({ valor: r.id, rotulo: r.titulo }))}
      />
      <Campo rotulo="O que se apurou">
        <textarea
          value={nota}
          onChange={(evento) => definirNota(evento.target.value)}
          rows={2}
          style={{ ...estiloDeEntrada, resize: 'vertical' }}
          placeholder="O reajuste segue o contrato de concessão."
        />
      </Campo>
      <div style={{ display: 'flex', gap: 8 }}>
        <Botao
          aoClicar={() =>
            aoSalvar(alegacao, { referencia_id: referencia || null, nota: nota.trim() || null })
          }
        >
          Salvar a apuração
        </Botao>
      </div>
    </div>
  );
}
