/** Os documentos que saíram das reuniões — os que moram no nosso armazenamento.
 *
 *  DUAS PROCEDÊNCIAS, DUAS ABAS. Os materiais oficiais são o acervo da
 *  companhia — posicionamentos, Q&A, notas técnicas —, o que a Aegea leva PARA
 *  a reunião, e que tem VERSÃO. Isto aqui é o que VOLTA dela: a ata que a
 *  outra parte entregou, o material que a equipe produziu depois.
 *
 *  OS DOIS MORAM NO MESMO BLOB, em árvores separadas: `referencias/…` e
 *  `interacoes/…`. O que os separa não é onde estão, é o que são.
 *
 *  SÓ O QUE TEM ARQUIVO. Material por link já é alcançável pelo link; o que
 *  justifica uma tela própria é o acervo que só existe dentro do painel e que,
 *  sem uma listagem, só se encontra abrindo a agenda que o gerou — e é preciso
 *  saber qual foi.
 *
 *  SEGUE O RECORTE, como a tabela ao lado. Uma aba que ignorasse os filtros
 *  mostraria documentos de agendas que a Base não lista, e os dois números não
 *  se reconciliariam.
 *
 *  EM COLUNAS. O que se faz aqui é comparar — qual arquivo é maior, o que veio
 *  de qual reunião, quantos há de cada momento — e comparar exige que o mesmo
 *  dado fique na mesma posição em toda linha.
 */

import { useEffect, useMemo, useState } from 'react';

import {
  Carregando,
  ChipDeFrente,
  FaixaDeErro,
  Vazio,
  estiloDeEntrada,
} from '@/componentes/basicos';
import { celula } from '@/componentes/estilos';
import { Linha, Tabela } from '@/componentes/Tabela';
import { SeletorDeColunas, useColunasVisiveis } from '@/componentes/SeletorDeColunas';
import { listarDocumentosDaReuniao } from '@/api/cliente';
import { dataCompleta, tamanhoLegivel } from '@/dominio/formato';
import { alternarOrdenacao, ordenarPor } from '@/dominio/ordenacao';
import type { Ordenacao } from '@/dominio/ordenacao';
import type { DocumentoDaReuniao, Frente } from '@/dominio/tipos';
import { usePainel } from '@/estado/painel';

const ROTULO_DO_MOMENTO: Record<string, string> = {
  apoio: 'Apoio',
  obtido: 'Obtido na reunião',
  produzido: 'Produzido depois',
};

const COLUNAS = [
  'Data',
  'Frente',
  'Documento',
  'Momento',
  'Temas',
  'Arquivo',
  'Formato',
  'Tamanho',
  'Anexado por',
];

const COLUNAS_ORDENAVEIS = ['Data', 'Documento', 'Momento', 'Tamanho', 'Anexado por'];

const EXTRATORES_DE_ORDENACAO: Record<string, (documento: DocumentoDaReuniao) => string | number> = {
  Data: (documento) => documento.data_interacao,
  Documento: (documento) => documento.titulo,
  Momento: (documento) => ROTULO_DO_MOMENTO[documento.momento] ?? documento.momento,
  Tamanho: (documento) => documento.arquivo_tamanho,
  'Anexado por': (documento) => documento.criado_por ?? '',
};

/** O tipo MIME em palavra de gente.
 *
 *  "application/vnd.openxmlformats-officedocument.wordprocessingml.document" é
 *  o que o navegador manda, e não é o que alguém quer ler numa coluna.
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

export function DocumentosDaReuniao({
  aoAbrirFicha,
}: {
  aoAbrirFicha: (id: string) => void;
}) {
  const { recorte, catalogo } = usePainel();
  //: A LISTA GUARDA DE QUAL RECORTE ELA É.
  //:
  //: Sem isso, mostrar "carregando" ao trocar de filtro exigia um
  //: `definirDocumentos(null)` no começo do efeito — um `setState` síncrono que
  //: dispara uma renderização só para dizer que a próxima vem depois. Com o
  //: recorte guardado ao lado da lista, "está velha" se descobre COMPARANDO, na
  //: renderização, e o efeito só escreve quando a resposta chega.
  const [dados, definirDados] = useState<{
    recorte: typeof recorte;
    lista: DocumentoDaReuniao[];
  } | null>(null);
  const [erro, definirErro] = useState<string | null>(null);
  const [busca, definirBusca] = useState('');
  //: O MESMO FILTRO DA ABA AO LADO. Procurar "o que existe sobre tarifa" tem
  //: de funcionar igual nas duas procedências, senão a pessoa aprende a
  //: procurar numa e desconfia da outra.
  const [tema, definirTema] = useState('');
  //: Momento não tem equivalente na biblioteca — lá o que separa é o TIPO do
  //: documento. Fica aqui porque é o que distingue o que a outra parte entregou
  //: do que a Aegea produziu depois, e essa é a pergunta desta aba.
  const [momento, definirMomento] = useState('');
  const [ordenacao, definirOrdenacao] = useState<Ordenacao | null>(null);
  const { ocultas, visiveis, alternar } = useColunasVisiveis(
    'base-documentos-da-reuniao',
    COLUNAS,
  );

  const documentos = dados?.recorte === recorte ? dados.lista : null;

  useEffect(() => {
    let vivo = true;
    listarDocumentosDaReuniao(recorte)
      .then((lista) => {
        if (vivo) definirDados({ recorte, lista });
      })
      .catch((e: Error) => {
        if (vivo) definirErro(e.message);
      });
    return () => {
      vivo = false;
    };
    // RECARREGA A CADA RECORTE. É o que mantém esta aba dizendo a mesma coisa
    // que o cabeçalho da Base diz logo acima dela.
  }, [recorte]);

  const filtrados = useMemo(() => {
    if (!documentos) return [];
    const termo = busca.trim().toLowerCase();
    return documentos.filter((d) => {
      if (tema && !d.temas.includes(Number(tema))) return false;
      if (momento && d.momento !== momento) return false;
      if (!termo) return true;
      return (
        d.titulo.toLowerCase().includes(termo) ||
        d.arquivo_nome.toLowerCase().includes(termo) ||
        (d.resumo ?? '').toLowerCase().includes(termo) ||
        (d.instituicao ?? '').toLowerCase().includes(termo)
      );
    });
  }, [documentos, busca, tema, momento]);

  const ordenados = useMemo(
    () => ordenarPor(filtrados, ordenacao, EXTRATORES_DE_ORDENACAO),
    [filtrados, ordenacao],
  );

  if (erro) return <FaixaDeErro mensagem={erro} />;
  if (documentos === null || !catalogo) return <Carregando />;

  const nomeDoTema = (id: number) =>
    catalogo.dicionarios.temas.find((t) => t.id === id)?.nome ?? String(id);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div
        style={{ display: 'flex', gap: 10, flexWrap: 'wrap', padding: '16px 16px 12px' }}
      >
        <input
          style={{ ...estiloDeEntrada, flex: 1, minWidth: 220 }}
          value={busca}
          onChange={(e) => definirBusca(e.target.value)}
          placeholder="Buscar por título, arquivo, resumo ou instituição…"
          aria-label="Buscar nos documentos das reuniões"
        />
        <select
          style={{ ...estiloDeEntrada, width: 200 }}
          value={momento}
          onChange={(e) => definirMomento(e.target.value)}
          aria-label="Filtrar por momento"
        >
          <option value="">Todos os momentos</option>
          {Object.entries(ROTULO_DO_MOMENTO).map(([valor, rotulo]) => (
            <option key={valor} value={valor}>
              {rotulo}
            </option>
          ))}
        </select>
        <select
          style={{ ...estiloDeEntrada, width: 200 }}
          value={tema}
          onChange={(e) => definirTema(e.target.value)}
          aria-label="Filtrar por tema"
        >
          <option value="">Todos os temas</option>
          {catalogo.dicionarios.temas.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nome}
            </option>
          ))}
        </select>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          padding: '0 16px',
        }}
      >
        <p style={{ fontSize: 13, color: 'var(--cinza-2)', margin: 0 }}>
          {filtrados.length} {filtrados.length === 1 ? 'documento' : 'documentos'} no
          recorte. Clique na linha para abrir a agenda de onde ele saiu.
        </p>
        <SeletorDeColunas todasAsColunas={COLUNAS} ocultas={ocultas} aoAlternar={alternar} />
      </div>

      {!filtrados.length ? (
        <div style={{ padding: 16 }}>
          <Vazio
            mensagem="Nenhum documento no recorte"
            dica="Só aparecem aqui os materiais com arquivo anexado."
          />
        </div>
      ) : (
        <Tabela
          colunas={visiveis}
          altura="calc(100vh - 420px)"
          colunasOrdenaveis={COLUNAS_ORDENAVEIS.filter((coluna) => visiveis.includes(coluna))}
          ordenacao={ordenacao}
          aoOrdenar={(coluna) => definirOrdenacao((atual) => alternarOrdenacao(atual, coluna))}
          chaveDeArmazenamento="base-documentos-da-reuniao"
        >
          {ordenados.map((documento) => (
            <Linha
              key={documento.id}
              titulo="Abrir a agenda de onde o documento saiu"
              // LEVA À AGENDA, e não ao arquivo. O download exige a rota
              // autenticada de cada agenda, e a ficha já a oferece com o
              // contexto do que foi aquela reunião — que é o que dá sentido ao
              // documento.
              aoClicar={() => aoAbrirFicha(documento.interacao_id)}
            >
              {!visiveis.includes('Data') ? null : (
                <td style={{ ...celula, whiteSpace: 'nowrap' }} className="tabular">
                  {dataCompleta(documento.data_interacao)}
                </td>
              )}
              {!visiveis.includes('Frente') ? null : (
                <td style={celula}>
                  <ChipDeFrente frente={documento.frente as Frente} />
                </td>
              )}
              {!visiveis.includes('Documento') ? null : (
                <td style={{ ...celula, minWidth: 240 }}>
                  <span style={{ fontWeight: 500, color: 'var(--cinza-4)' }}>
                    {documento.titulo}
                  </span>
                  <span
                    style={{ display: 'block', color: 'var(--cinza-2)', marginTop: 2 }}
                  >
                    {documento.instituicao ?? '—'}
                  </span>
                  {documento.resumo ? (
                    <span
                      style={{
                        display: 'block',
                        color: 'var(--cinza-2)',
                        marginTop: 2,
                        maxWidth: '56ch',
                      }}
                    >
                      {documento.resumo}
                    </span>
                  ) : null}
                </td>
              )}
              {!visiveis.includes('Momento') ? null : (
                <td style={{ ...celula, whiteSpace: 'nowrap' }}>
                  {ROTULO_DO_MOMENTO[documento.momento] ?? documento.momento}
                </td>
              )}
              {!visiveis.includes('Assuntos') ? null : (
                <td style={{ ...celula, color: 'var(--cinza-2)' }}>
                  {documento.temas.map(nomeDoTema).join(', ') || '—'}
                </td>
              )}
              {!visiveis.includes('Arquivo') ? null : (
                <td style={{ ...celula, wordBreak: 'break-all', minWidth: 150 }}>
                  {documento.arquivo_nome}
                </td>
              )}
              {!visiveis.includes('Formato') ? null : (
                <td style={{ ...celula, whiteSpace: 'nowrap' }}>
                  {formatoLegivel(documento.arquivo_tipo)}
                </td>
              )}
              {!visiveis.includes('Tamanho') ? null : (
                <td style={{ ...celula, whiteSpace: 'nowrap' }} className="tabular">
                  {tamanhoLegivel(documento.arquivo_tamanho)}
                </td>
              )}
              {!visiveis.includes('Anexado por') ? null : (
                <td style={{ ...celula, whiteSpace: 'nowrap' }}>
                  {documento.criado_por ?? '—'}
                  <span
                    className="tabular"
                    style={{ display: 'block', color: 'var(--cinza-2)', marginTop: 2 }}
                  >
                    {dataCompleta(documento.criado_em.slice(0, 10))}
                  </span>
                </td>
              )}
            </Linha>
          ))}
        </Tabela>
      )}
    </div>
  );
}
