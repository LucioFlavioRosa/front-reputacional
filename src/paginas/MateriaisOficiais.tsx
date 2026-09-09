/** Os materiais oficiais — o acervo da companhia, visto de dentro da Base.
 *
 *  A MESMA BIBLIOTECA DA ADMINISTRAÇÃO, e de propósito: lá se cadastra, aqui se
 *  consulta. Quem prepara uma reunião não deveria ter de entrar na tela de
 *  administração para descobrir o que existe sobre um assunto — e quem entra lá
 *  para consultar acaba editando por engano.
 *
 *  SÓ AS ATIVAS. A tela de administração mostra as desativadas para poder
 *  reativá-las; aqui elas seriam ruído: ninguém deve levar para uma reunião o
 *  que alguém tirou de circulação.
 *
 *  EM COLUNAS, como a aba de agendas. O que se faz aqui é comparar — qual está
 *  mais velho, quantos há de cada tipo, o que existe sobre um assunto — e
 *  comparar exige que o mesmo dado fique na mesma posição em toda linha.
 */

import { useEffect, useMemo, useState } from 'react';

import { Carregando, FaixaDeErro, Vazio, estiloDeEntrada } from '@/componentes/basicos';
import { celula } from '@/componentes/estilos';
import { Linha, Tabela } from '@/componentes/Tabela';
import { listarReferencias, urlDaVersao } from '@/api/cliente';
import { dataCompleta, tamanhoLegivel } from '@/dominio/formato';
import type { Referencia } from '@/dominio/tipos';
import { usePainel } from '@/estado/painel';

const ROTULO_DO_TIPO: Record<string, string> = {
  posicionamento: 'Posicionamento oficial',
  qa: 'Q&A',
  release: 'Release',
  apresentacao: 'Apresentação',
  dados: 'Dados e números',
  nota_tecnica: 'Nota técnica',
};

//: A ORDEM DA LISTA DE TIPOS, do que fala pela companhia ao que a apoia.
//: Alfabética poria "Apresentação" antes de "Posicionamento oficial", que é o
//: documento que manda em todos os outros.
const TIPOS = ['posicionamento', 'qa', 'release', 'nota_tecnica', 'dados', 'apresentacao'];

const COLUNAS = ['Título', 'Tipo', 'Assuntos', 'Versão', 'Atualizado', 'Arquivo', 'Tamanho'];

/** O tipo MIME em palavra de gente.
 *
 *  ERA DEDUZIDO DA EXTENSÃO DO LINK, quando o arquivo morava no SharePoint e o
 *  painel só tinha o endereço. Agora o arquivo é nosso, e o tipo veio com ele.
 */
function formatoLegivel(tipo: string): string {
  if (tipo.includes('pdf')) return 'PDF';
  if (tipo.includes('wordprocessing') || tipo.includes('msword')) return 'Word';
  if (tipo.includes('spreadsheet') || tipo.includes('ms-excel')) return 'Excel';
  if (tipo.includes('presentation') || tipo.includes('ms-powerpoint')) return 'PowerPoint';
  if (tipo.startsWith('image/')) return 'Imagem';
  if (tipo.startsWith('text/')) return 'Texto';
  return tipo.split('/').pop() ?? tipo;
}

export function MateriaisOficiais() {
  const { catalogo } = usePainel();
  const [referencias, definirReferencias] = useState<Referencia[] | null>(null);
  const [erro, definirErro] = useState<string | null>(null);
  const [busca, definirBusca] = useState('');
  const [tipo, definirTipo] = useState('');
  const [tema, definirTema] = useState('');

  useEffect(() => {
    let vivo = true;
    listarReferencias()
      .then((lista) => {
        if (vivo) definirReferencias(lista.filter((r) => r.ativo));
      })
      .catch((e: Error) => {
        if (vivo) definirErro(e.message);
      });
    return () => {
      vivo = false;
    };
  }, []);

  const filtradas = useMemo(() => {
    if (!referencias) return [];
    const termo = busca.trim().toLowerCase();
    return referencias.filter((r) => {
      if (tipo && r.tipo !== tipo) return false;
      if (tema && !r.temas.includes(Number(tema))) return false;
      if (!termo) return true;
      return (
        r.titulo.toLowerCase().includes(termo) ||
        (r.resumo ?? '').toLowerCase().includes(termo)
      );
    });
  }, [referencias, busca, tipo, tema]);

  if (erro) return <FaixaDeErro mensagem={erro} />;
  if (referencias === null || !catalogo) return <Carregando />;

  const nomeDoTema = (id: number) =>
    catalogo.dicionarios.temas.find((t) => t.id === id)?.nome ?? String(id);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', padding: '16px 16px 0' }}>
        <input
          style={{ ...estiloDeEntrada, flex: 1, minWidth: 220 }}
          value={busca}
          onChange={(e) => definirBusca(e.target.value)}
          placeholder="Buscar por título ou resumo…"
          aria-label="Buscar nos materiais oficiais"
        />
        <select
          style={{ ...estiloDeEntrada, width: 200 }}
          value={tipo}
          onChange={(e) => definirTipo(e.target.value)}
          aria-label="Filtrar por tipo"
        >
          <option value="">Todos os tipos</option>
          {TIPOS.map((valor) => (
            <option key={valor} value={valor}>
              {ROTULO_DO_TIPO[valor]}
            </option>
          ))}
        </select>
        <select
          style={{ ...estiloDeEntrada, width: 200 }}
          value={tema}
          onChange={(e) => definirTema(e.target.value)}
          aria-label="Filtrar por assunto"
        >
          <option value="">Todos os assuntos</option>
          {catalogo.dicionarios.temas.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nome}
            </option>
          ))}
        </select>
      </div>

      <p style={{ fontSize: 13, color: 'var(--cinza-2)', margin: 0, padding: '0 16px' }}>
        {filtradas.length} de {referencias.length} no acervo. Clique na linha para
        abrir a versão mais recente.
      </p>

      {!filtradas.length ? (
        <div style={{ padding: 16 }}>
          <Vazio
            mensagem="Nada com esses filtros"
            dica="Limpe a busca ou escolha outro tipo."
          />
        </div>
      ) : (
        <Tabela colunas={COLUNAS} altura="calc(100vh - 420px)">
          {filtradas.map((referencia) => (
            <Linha
              key={referencia.id}
              titulo="Abrir a versão mais recente"
              aoClicar={() => {
                if (referencia.versao)
                  window.open(
                    urlDaVersao(referencia.id, referencia.versao.id),
                    '_blank',
                    'noopener,noreferrer',
                  );
              }}
            >
              <td style={{ ...celula, minWidth: 260 }}>
                <span style={{ fontWeight: 500, color: 'var(--cinza-4)' }}>
                  {referencia.titulo}
                </span>
                {referencia.resumo ? (
                  <span
                    style={{
                      display: 'block',
                      color: 'var(--cinza-2)',
                      marginTop: 3,
                      maxWidth: '62ch',
                    }}
                  >
                    {referencia.resumo}
                  </span>
                ) : null}
              </td>
              <td style={{ ...celula, whiteSpace: 'nowrap' }}>
                {ROTULO_DO_TIPO[referencia.tipo] ?? referencia.tipo}
              </td>
              <td style={{ ...celula, color: 'var(--cinza-2)' }}>
                {referencia.temas.map(nomeDoTema).join(', ')}
              </td>
              {/* A VERSÃO ANTES DA DATA. Quem lê a biblioteca procura saber
                  se o que está na tela é o atual, e "v3" responde isso antes
                  de qualquer data. */}
              <td
                style={{ ...celula, whiteSpace: 'nowrap' }}
                className="tabular"
                title={
                  referencia.quantas_versoes > 1
                    ? `${referencia.quantas_versoes} versões; a tela mostra a mais recente`
                    : 'versão única'
                }
              >
                {referencia.versao ? `v${referencia.versao.numero}` : '—'}
              </td>
              <td style={{ ...celula, whiteSpace: 'nowrap' }} className="tabular">
                {referencia.versao ? dataCompleta(referencia.versao.atualizado_em) : '—'}
              </td>
              <td style={{ ...celula, whiteSpace: 'nowrap' }}>
                {referencia.versao ? formatoLegivel(referencia.versao.arquivo_tipo) : '—'}
              </td>
              <td style={{ ...celula, whiteSpace: 'nowrap' }} className="tabular">
                {referencia.versao
                  ? tamanhoLegivel(referencia.versao.arquivo_tamanho)
                  : '—'}
              </td>
            </Linha>
          ))}
        </Tabela>
      )}
    </div>
  );
}
