/** As consultas recebidas, em tabela — o que chegou de fora perguntando.
 *
 *  "CONSULTA", E NÃO "E-MAIL": e-mail é o CANAL, e o glossário o evita como
 *  nome da coisa — há consulta por formulário e por plataforma de rating.
 *
 *  POR QUE UMA ABA PRÓPRIA, SE A BASE JÁ LISTA TUDO. Uma consulta é uma
 *  interação, e aparece na aba Interações como qualquer outra. Mas o que se
 *  quer saber DELA é outra coisa: quem assinou, por onde chegou, o que
 *  perguntaram, se o prazo venceu — colunas que não existem numa reunião e que
 *  a tabela de agendas não teria como mostrar sem ficar vazia em 97% das
 *  linhas.
 *
 *  E A LEITURA É OUTRA. Na aba Interações procura-se um registro; aqui
 *  percorre-se uma caixa de entrada: o que chegou, de quem, e o que ainda não
 *  foi respondido.
 *
 *  SEGUE O RECORTE, como as outras abas — o mesmo motivo de
 *  `DocumentosDaReuniao`: uma aba que ignorasse os filtros mostraria consultas
 *  que a Base não lista, e os dois números não se reconciliariam.
 *
 *  A ABA DE SINAIS É A LEITURA, ESTA É O REGISTRO. Lá se pergunta "o que está
 *  circulando" e a resposta é por alegação; aqui se pergunta "o que chegou" e
 *  a resposta é uma consulta por linha.
 */

import { useMemo, useState } from 'react';

import { usePainel } from '@/estado/painel';
import { Carregando, FaixaDeErro, Vazio } from '@/componentes/basicos';
import { celula } from '@/componentes/estilos';
import { Linha, Tabela } from '@/componentes/Tabela';
import { SeletorDeColunas, useColunasVisiveis } from '@/componentes/SeletorDeColunas';
import { dataCompleta, hojeLocal } from '@/dominio/formato';
import { alternarOrdenacao, ordenarPor } from '@/dominio/ordenacao';
import type { Ordenacao } from '@/dominio/ordenacao';
import { nomeDaInstituicao, nomesDosTemas, rotuloDeCodigo } from '@/dominio/derivacoes';
import type { Catalogo } from '@/dominio/derivacoes';
import { consultasDe, consultasVencidas } from '@/dominio/sinais';
import type { Interacao } from '@/dominio/tipos';

const COLUNAS = [
  'Data', 'Instituição', 'Quem assina', 'Canal', 'O que perguntaram',
  'Alegações', 'Temas', 'Prazo', 'Anexos',
];

//: Nasce oculta: o teor ocupa a linha inteira e, com ele à mostra, a tabela
//: deixa de ser comparável de linha a linha. Quem quer ler o texto abre a
//: ficha; quem quer varrer a caixa de entrada olha data, quem mandou e prazo.
const OCULTAS_POR_PADRAO = ['O que perguntaram', 'Temas'];

const COLUNAS_ORDENAVEIS = ['Data', 'Instituição', 'Prazo'];

interface LinhaDeConsulta {
  id: string;
  data: string;
  instituicao: string;
  remetente: string;
  canal: string;
  teor: string;
  alegacoes: string[];
  temas: string;
  prazo: string;
  vencida: boolean;
  anexos: number;
}

function montarLinha(
  consulta: Interacao,
  catalogo: Catalogo,
  vencida: boolean,
): LinhaDeConsulta {
  const canal = catalogo.dicionarios.canais_consulta.find(
    (item) => item.id === consulta.consulta?.canal_id,
  );
  return {
    id: consulta.id,
    data: consulta.data_interacao,
    instituicao: nomeDaInstituicao(catalogo, consulta.instituicao_id),
    remetente: consulta.consulta?.remetente ?? '—',
    canal: canal ? rotuloDeCodigo(catalogo, 'canais_consulta', canal.codigo) : '—',
    teor: consulta.consulta?.teor ?? '',
    alegacoes: consulta.alegacoes.map(
      (id) => catalogo.alegacoes.find((a) => a.id === id)?.texto ?? 'alegação fora de circulação',
    ),
    temas: nomesDosTemas(catalogo, consulta.temas).join(', '),
    prazo: consulta.consulta?.prazo_resposta ?? '',
    vencida,
    anexos: consulta.materiais.filter((material) => material.arquivo).length,
  };
}

const EXTRATORES = {
  Data: (linha: LinhaDeConsulta) => linha.data,
  Instituição: (linha: LinhaDeConsulta) => linha.instituicao,
  Prazo: (linha: LinhaDeConsulta) => linha.prazo,
};

/** A ordenação da tabela, com SEM PRAZO SEMPRE NO FIM.
 *
 *  `ordenarPor` multiplica a comparação pelo sinal da direção, então um valor
 *  sentinela ("9999") só empurra os vazios para o fim na ordem crescente — ao
 *  inverter, eles subiriam para o topo, justamente na leitura "maior prazo
 *  primeiro". Consulta sem prazo não cobra ação: ela não disputa o topo em
 *  nenhuma das duas direções.
 */
function ordenarConsultas(
  linhas: LinhaDeConsulta[],
  ordenacao: Ordenacao | null,
): LinhaDeConsulta[] {
  if (ordenacao?.coluna !== 'Prazo') return ordenarPor(linhas, ordenacao, EXTRATORES);

  const comPrazo = linhas.filter((linha) => linha.prazo);
  const semPrazo = linhas.filter((linha) => !linha.prazo);
  return [...ordenarPor(comPrazo, ordenacao, EXTRATORES), ...semPrazo];
}

export function ConsultasRecebidas({ aoAbrirFicha }: { aoAbrirFicha: (id: string) => void }) {
  const { interacoes, catalogo, carregando, erro } = usePainel();
  const [ordenacao, definirOrdenacao] = useState<Ordenacao | null>(null);
  const { ocultas, visiveis, alternar } = useColunasVisiveis(
    'base-consultas-recebidas',
    COLUNAS,
    OCULTAS_POR_PADRAO,
  );

  // `hojeLocal`, e não `toISOString`: em São Paulo, depois das 21h, o UTC já
  // virou o dia seguinte — e o prazo apareceria vencido horas antes de vencer.
  const hoje = hojeLocal();

  const linhas = useMemo(() => {
    if (!catalogo) return [];
    const consultas = consultasDe(interacoes);
    const vencidas = new Set(consultasVencidas(consultas, hoje).map((c) => c.id));
    return consultas.map((consulta) =>
      montarLinha(consulta, catalogo, vencidas.has(consulta.id)),
    );
  }, [interacoes, catalogo, hoje]);

  const ordenadas = useMemo(() => ordenarConsultas(linhas, ordenacao), [linhas, ordenacao]);

  if (erro) return <FaixaDeErro mensagem={erro} />;
  if (carregando || !catalogo) return <Carregando />;

  if (!linhas.length) {
    return (
      <div style={{ padding: 16 }}>
        <Vazio
          mensagem="Nenhuma consulta recebida neste recorte"
          dica='Registre o questionário em Administração › "Consultas e alegações", ou pelo formulário com o tipo "Consulta recebida".'
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 10,
          padding: '0 16px',
        }}
      >
        <span style={{ fontSize: 12.5, color: 'var(--cinza-2)' }}>
          {linhas.length} {linhas.length === 1 ? 'consulta' : 'consultas'} no recorte
          {linhas.some((linha) => linha.vencida)
            ? ` · ${linhas.filter((l) => l.vencida).length} com prazo vencido`
            : ''}
        </span>
        <SeletorDeColunas todasAsColunas={COLUNAS} ocultas={ocultas} aoAlternar={alternar} />
      </div>

      <Tabela
        colunas={visiveis}
        altura="calc(100vh - 420px)"
        colunasOrdenaveis={COLUNAS_ORDENAVEIS.filter((coluna) => visiveis.includes(coluna))}
        ordenacao={ordenacao}
        aoOrdenar={(coluna) => definirOrdenacao((atual) => alternarOrdenacao(atual, coluna))}
        chaveDeArmazenamento="base-consultas-recebidas"
      >
        {ordenadas.map((linha) => (
          <Linha
            key={linha.id}
            titulo="Abrir a consulta"
            aoClicar={() => aoAbrirFicha(linha.id)}
          >
            {!visiveis.includes('Data') ? null : (
              <td style={{ ...celula, whiteSpace: 'nowrap' }} className="tabular">
                {dataCompleta(linha.data)}
              </td>
            )}
            {!visiveis.includes('Instituição') ? null : (
              <td style={celula}>{linha.instituicao}</td>
            )}
            {!visiveis.includes('Quem assina') ? null : (
              <td style={celula}>{linha.remetente}</td>
            )}
            {!visiveis.includes('Canal') ? null : <td style={celula}>{linha.canal}</td>}
            {!visiveis.includes('O que perguntaram') ? null : (
              <td style={{ ...celula, minWidth: 260 }}>{linha.teor || '—'}</td>
            )}
            {!visiveis.includes('Alegações') ? null : (
              <td style={{ ...celula, minWidth: 220 }}>
                {linha.alegacoes.length ? linha.alegacoes.join(' · ') : '—'}
              </td>
            )}
            {!visiveis.includes('Temas') ? null : (
              <td style={celula}>{linha.temas || '—'}</td>
            )}
            {!visiveis.includes('Prazo') ? null : (
              <td
                style={{
                  ...celula,
                  whiteSpace: 'nowrap',
                  color: linha.vencida ? 'var(--erro-fg)' : undefined,
                }}
                className="tabular"
              >
                {linha.prazo ? dataCompleta(linha.prazo) : '—'}
                {linha.vencida ? ' · vencido' : ''}
              </td>
            )}
            {!visiveis.includes('Anexos') ? null : (
              <td style={{ ...celula, whiteSpace: 'nowrap' }} className="tabular">
                {linha.anexos || '—'}
              </td>
            )}
          </Linha>
        ))}
      </Tabela>
    </div>
  );
}
