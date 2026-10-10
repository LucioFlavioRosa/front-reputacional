/** O estado que atravessa o aplicativo: o Recorte corrente e os dados dele.
 *
 *  Todas as telas de análise leem o MESMO conjunto de registros. Buscar uma
 *  vez aqui e compartilhar é o que garante que o KPI e a tabela nunca contem
 *  coisas diferentes — o mesmo motivo pelo qual o backend tem um `Recorte` só.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import {
  listarInstituicoes,
  listarAlegacoes,
  listarInterlocutores,
  listarPessoasAegea,
  listarRecorteCompleto,
  listarReferencias,
  obterDicionarios,
} from '@/api/cliente';
import { agendasMudaram, catalogoMudou } from '@/dominio/sincronizacao';
import type { Catalogo } from '@/dominio/derivacoes';
import { divergenciasDoCatalogo, montarCatalogo } from '@/dominio/derivacoes';
import { registrarEvento } from '@/observabilidade/telemetria';
import type { Recorte } from '@/dominio/recorte';
import { consultaDe, lerRecorte } from '@/navegacao/rota';
import type { Interacao } from '@/dominio/tipos';

interface EstadoDoPainel {
  recorte: Recorte;
  definirRecorte: (recorte: Recorte) => void;
  limparRecorte: () => void;

  interacoes: Interacao[];
  total: number;
  truncado: boolean;
  catalogo: Catalogo | null;

  /** Só na primeira carga, quando ainda não há nada para mostrar. */
  carregando: boolean;
  /** Refetch com dados anteriores em tela — segura o render, não pisca. */
  atualizando: boolean;
  erro: string | null;
  recarregar: () => void;
}

const Contexto = createContext<EstadoDoPainel | null>(null);

export function ProvedorDoPainel({
  children,
  alcancaOCrm,
  carregaCatalogo,
}: {
  children: ReactNode;
  /**
   * Se quem está logado abre o CRM dos Stakeholders.
   *
   * Só gate da BASE DE INTERAÇÕES — o recorte que `painel`/`base`/etc. leem.
   * Para quem não abre aquele portal, o backend responde 403, e a tela
   * mostrava erro logo ao entrar: um erro correto, numa tela que nem
   * oferece o módulo.
   *
   * NÃO é controle de acesso. Quem decide é o backend, e ele decide bem — o
   * que se evita aqui é PEDIR o que se sabe que será negado.
   */
  alcancaOCrm: boolean;
  /**
   * Se deve buscar o catálogo (temas, instituições, interlocutores, pessoas
   * da Aegea, referências, dicionários).
   *
   * TEM DOIS DONOS, e por isso é um gate à parte de `alcancaOCrm`: quem abre
   * o CRM lê o catálogo pelas telas de agenda, e quem só administra os
   * cadastros (`administra_dicionarios`) o lê pelo cartão de Cadastro
   * compartilhado, fora do CRM. Um só gate faria um administrador de
   * cadastros sem CRM também pedir a base de interações — que o backend
   * negaria.
   */
  carregaCatalogo: boolean;
}) {
  //: O RECORTE MORA NA URL.
  //:
  //: Nasce do endereço e volta para ele a cada mudança — é o que faz "manda
  //: este recorte para a liderança" ser um link em vez de uma captura de tela.
  //:
  //: `replaceState`, e não `pushState`: ajustar um filtro é refinar a mesma
  //: leitura. Empilhar histórico a cada tecla digitada na busca faria o botão
  //: de voltar percorrer letra por letra antes de sair da tela.
  const [recorte, definirRecorteEstado] = useState<Recorte>(() =>
    lerRecorte(window.location.search),
  );

  //: O HASH VIAJA JUNTO. Ele é do drill da aba Lentes (`#consulta&…`, decisão
  //: A3 da Consulta em profundidade), e regravar o endereço sem ele devolveria
  //: o drill ao Nível 1 a cada ajuste da barra de filtros, em silêncio e sem
  //: volta pelo navegador (é `replaceState`).
  const definirRecorte = useCallback((novo: Recorte) => {
    definirRecorteEstado(novo);
    window.history.replaceState(
      null,
      '',
      window.location.pathname + consultaDe(novo) + window.location.hash,
    );
  }, []);

  useEffect(function ouvirOBotaoDeVoltar() {
    // O caminho é escrito pela navegação; a consulta, aqui. Mas o botão de
    // voltar move os DOIS de uma vez — então este lado também precisa reler.
    //
    // SÓ TROCA O RECORTE QUANDO A CONSULTA MUDOU: voltar dentro do drill (que
    // mexe só no hash) também dispara `popstate`, e um recorte novo, mesmo
    // igual, rebuscaria a base inteira do CRM a cada voltar. Compara pela
    // forma canônica (`consultaDe`), para a ordem dos parâmetros não contar.
    const aoVoltar = () => {
      const lido = lerRecorte(window.location.search);
      definirRecorteEstado((atual) => (consultaDe(atual) === consultaDe(lido) ? atual : lido));
    };
    window.addEventListener('popstate', aoVoltar);
    return () => window.removeEventListener('popstate', aoVoltar);
  }, []);
  const [catalogo, definirCatalogo] = useState<Catalogo | null>(null);
  const [interacoes, definirInteracoes] = useState<Interacao[]>([]);
  const [total, definirTotal] = useState(0);
  const [truncado, definirTruncado] = useState(false);
  const [carregando, definirCarregando] = useState(true);
  const [atualizando, definirAtualizando] = useState(false);
  const [erro, definirErro] = useState<string | null>(null);
  // DUAS VERSÕES, porque são duas cargas com gatilhos diferentes: salvar uma
  // agenda rebusca as agendas, e não os dicionários; cadastrar um tema rebusca
  // o catálogo, e não as agendas. Uma versão só fazia cada gravação pagar as
  // duas cargas.
  const [versaoDasAgendas, definirVersaoDasAgendas] = useState(0);
  const [versaoDoCatalogo, definirVersaoDoCatalogo] = useState(0);

  const recarregar = useCallback(() => definirVersaoDasAgendas((v) => v + 1), []);

  // A SINCRONIZAÇÃO TOTAL COMEÇA AQUI. O cliente da API avisa a cada escrita
  // bem-sucedida numa rota de catálogo — tema, instituição, interlocutor,
  // pessoa da Aegea, referência — e este é o único ouvinte: recarrega o
  // catálogo inteiro, e com ele todo formulário, filtro e ficha que o lê.
  // Nenhuma tela de cadastro precisa lembrar de fazer isso.
  useEffect(
    () => catalogoMudou.assinar(() => definirVersaoDoCatalogo((v) => v + 1)),
    [],
  );

  // O MESMO PARA AS AGENDAS, e por isso são dois barramentos: cadastrar um tema não
  // precisa rebuscar a base, e confirmar uma importação não precisa rebuscar os
  // dicionários. Um barramento só faria cada escrita pagar as duas cargas.
  useEffect(() => agendasMudaram.assinar(() => definirVersaoDasAgendas((v) => v + 1)), []);

  // Os diretórios mudam raramente: carregam uma vez e servem todas as telas.
  useEffect(function carregarCatalogo() {
    if (!carregaCatalogo) {
      // Nem o CRM nem a administração de cadastros — não há o que carregar,
      // e pedir renderia 403.
      definirCarregando(false);
      return;
    }

    let ativo = true;
    Promise.all([
      obterDicionarios(),
      listarInstituicoes(),
      listarInterlocutores(),
      listarPessoasAegea(),
      listarReferencias(),
      listarAlegacoes(),
    ])
      .then(([dicionarios, instituicoes, interlocutores, pessoas, referencias, alegacoes]) => {
        if (!ativo) return;
        const catalogo = montarCatalogo(
          dicionarios, instituicoes, interlocutores, pessoas, referencias, alegacoes,
        );
        // AS LISTAS FIXAS DO FRONT CONFERIDAS CONTRA O DICIONÁRIO, a cada
        // carga: uma frente renomeada ou recolorida no banco sem o código
        // acompanhar não pode passar em silêncio. Aviso, e não erro — a tela
        // continua; a telemetria e o console é que acusam.
        const divergencias = divergenciasDoCatalogo(catalogo);
        if (divergencias.length) {
          console.warn('Catálogo divergente das listas fixas do front:', divergencias);
          registrarEvento('catalogo_divergente', { divergencias });
        }
        definirCatalogo(catalogo);
      })
      .catch((falha: Error) => {
        if (ativo) definirErro(falha.message);
      });
    return function cancelarCargaDoCatalogo() {
      ativo = false;
    };
  }, [versaoDoCatalogo, carregaCatalogo]);

  // O recorte muda: rebusca o conjunto inteiro.
  //
  // Os dados anteriores permanecem em tela durante o refetch. Trocar tudo por
  // um esqueleto a cada clique de filtro faria a página saltar de altura e
  // piscar — o painel inteiro some e volta para mudar um número.
  useEffect(function buscarInteracoesDoRecorte() {
    if (!alcancaOCrm) {
      definirCarregando(false);
      return;
    }

    let ativo = true;
    definirAtualizando(true);
    definirErro(null);

    listarRecorteCompleto(recorte)
      .then((resposta) => {
        if (!ativo) return;
        definirInteracoes(resposta.itens);
        definirTotal(resposta.total);
        definirTruncado(resposta.truncado);
      })
      .catch((falha: Error) => {
        if (ativo) definirErro(falha.message);
      })
      .finally(() => {
        if (!ativo) return;
        definirAtualizando(false);
        definirCarregando(false);
      });

    return function cancelarBuscaDeInteracoes() {
      ativo = false;
    };
  }, [recorte, versaoDasAgendas, alcancaOCrm]);

  const valor = useMemo<EstadoDoPainel>(
    () => ({
      recorte,
      definirRecorte,
      limparRecorte: () => definirRecorte({}),
      interacoes,
      total,
      truncado,
      catalogo,
      carregando,
      atualizando,
      erro,
      recarregar,
    }),
    [
      recorte, interacoes, total, truncado, catalogo,
      carregando, atualizando, erro, recarregar,
      // `definirRecorte` não é o `setState` cru: também escreve o endereço, e
      // por isso é um `useCallback` que precisa entrar aqui. Fora da lista, um
      // provedor remontado serviria a função antiga, que escreveria numa URL
      // que já não é a da tela.
      definirRecorte,
    ],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

// `use...`, e não `usar...`, apesar de todo o resto do código ser em português.
//
// Não é concessão de estilo: o prefixo `use` é como o React IDENTIFICA um hook.
// A regra `react/rules-of-hooks` — que este projeto marca como `error` no
// `.oxlintrc.json` — e o React Compiler, que está ligado, reconhecem hook pelo
// nome. Chamado de `usarPainel`, este aqui não seria tratado como hook por
// nenhum dos dois: uma chamada dentro de `if` passaria batida, e o compilador
// não o otimizaria.
export function usePainel(): EstadoDoPainel {
  const contexto = useContext(Contexto);
  if (!contexto) {
    throw new Error('usePainel precisa estar dentro de <ProvedorDoPainel>.');
  }
  return contexto;
}
