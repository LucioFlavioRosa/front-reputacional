/** Todos os agregados do painel, derivados do recorte filtrado.
 *
 *  ESTE É O ÚNICO LUGAR QUE CALCULA AGREGADO NO FRONT.
 *
 *  O painel busca o recorte inteiro em `GET /api/interacoes` e deriva aqui,
 *  com teto de `TETO_DE_DERIVACAO` (5.000) registros.
 *
 *  ⚠ AS ROTAS `GET /api/metricas/*` JÁ EXISTEM E ESTÃO TESTADAS no backend —
 *  este arquivo simplesmente não as consome ainda. As regras estão duplicadas
 *  nos dois lados de propósito enquanto isso, e é dívida conhecida: mudar uma
 *  regra aqui sem mudar em `app/banco/consultas_metricas.py` do `back-reputacional`
 *  faz os dois números divergirem.
 *
 *  Migrar é trocar a origem SÓ NESTE ARQUIVO: nenhuma tela conhece de onde os
 *  números vêm.
 */

import { chaveDoMes, diasDesde } from '@/dominio/formato';
import { faixaDeRisco } from '@/dominio/frentes';
import type { FaixaDeRisco } from '@/dominio/frentes';
import type {
  Dicionarios,
  Frente,
  GrupoDeStatus,
  Instituicao,
  Interacao,
  Interlocutor,
  PessoaAegea,
} from '@/dominio/tipos';

/** Os diretórios que resolvem chave estrangeira em nome legível. */
export interface Catalogo {
  dicionarios: Dicionarios;
  instituicoes: Map<string, Instituicao>;
  interlocutores: Map<string, Interlocutor>;
  pessoas: Map<string, PessoaAegea>;
}

export function montarCatalogo(
  dicionarios: Dicionarios,
  instituicoes: Instituicao[],
  interlocutores: Interlocutor[],
  pessoas: PessoaAegea[],
): Catalogo {
  return {
    dicionarios,
    instituicoes: new Map(instituicoes.map((i) => [i.id, i])),
    interlocutores: new Map(interlocutores.map((i) => [i.id, i])),
    pessoas: new Map(pessoas.map((p) => [p.id, p])),
  };
}

/* -- utilidades ----------------------------------------------------------- */

export interface ItemContado {
  chave: string;
  rotulo: string;
  total: number;
  cor?: string;
}

function contar<T>(itens: T[], chave: (item: T) => string | null | undefined): Map<string, number> {
  const contagem = new Map<string, number>();
  for (const item of itens) {
    const k = chave(item);
    if (k == null || k === '') continue;
    contagem.set(k, (contagem.get(k) ?? 0) + 1);
  }
  return contagem;
}

function ordenarDecrescente(contagem: Map<string, number>): ItemContado[] {
  return [...contagem.entries()]
    .map(([chave, total]) => ({ chave, rotulo: chave, total }))
    .sort((a, b) => b.total - a.total || a.rotulo.localeCompare(b.rotulo, 'pt-BR'));
}

/* -- nomes ---------------------------------------------------------------- */

export function nomeDaInstituicao(catalogo: Catalogo, id: string): string {
  return catalogo.instituicoes.get(id)?.nome ?? '—';
}

export function nomeDoInterlocutor(catalogo: Catalogo, id: string | null): string {
  if (!id) return '—';
  return catalogo.interlocutores.get(id)?.nome ?? '—';
}

export function nomeDaPessoa(catalogo: Catalogo, id: string): string {
  return catalogo.pessoas.get(id)?.nome ?? '—';
}

export function nomeDaUnidade(catalogo: Catalogo, id: number | null): string {
  if (id == null) return '—';
  return catalogo.dicionarios.unidades_negocio.find((u) => u.id === id)?.nome ?? '—';
}

export function nomeDaEsfera(catalogo: Catalogo, id: number | null): string {
  if (id == null) return '—';
  return catalogo.dicionarios.esferas.find((e) => e.id === id)?.nome ?? '—';
}

export function rotuloDeCodigo(
  catalogo: Catalogo,
  dicionario: keyof Dicionarios,
  codigo: string | null,
): string {
  if (!codigo) return '—';
  const lista = catalogo.dicionarios[dicionario] as { codigo: string; nome: string }[];
  return lista.find((item) => item.codigo === codigo)?.nome ?? codigo;
}

export function nomesDosTemas(catalogo: Catalogo, ids: number[]): string[] {
  const porId = new Map(catalogo.dicionarios.temas.map((t) => [t.id, t.nome]));
  return ids.map((id) => porId.get(id)).filter((n): n is string => Boolean(n));
}

export function grupoDoStatus(catalogo: Catalogo, codigo: string): GrupoDeStatus | null {
  return catalogo.dicionarios.status.find((s) => s.codigo === codigo)?.grupo ?? null;
}

/* -- KPIs ----------------------------------------------------------------- */

export interface Kpis {
  institucionais: number;
  imprensa: { total: number; atendidas: number; taxa: number };
  eventos: number;
  investidores: { total: number; internacionais: number };
  legislativo: number;
  tier1: { total: number; percentual: number };
}

export function kpis(interacoes: Interacao[], catalogo: Catalogo): Kpis {
  const porFrente = (frente: Frente) => interacoes.filter((i) => i.frente === frente);

  const imprensa = porFrente('imprensa');
  const atendidas = imprensa.filter((i) => grupoDoStatus(catalogo, i.status) === 'resolvido');
  const investidores = porFrente('investidores');
  const tier1 = interacoes.filter((i) => i.tier === 1);

  return {
    institucionais: porFrente('governo').length + porFrente('parceiros').length,
    imprensa: {
      total: imprensa.length,
      atendidas: atendidas.length,
      taxa: imprensa.length ? atendidas.length / imprensa.length : 0,
    },
    eventos: porFrente('eventos').length,
    investidores: {
      total: investidores.length,
      internacionais: investidores.filter((i) => i.uf === 'IN').length,
    },
    legislativo: porFrente('legislativo').length,
    tier1: {
      total: tier1.length,
      percentual: interacoes.length ? tier1.length / interacoes.length : 0,
    },
  };
}

/* -- séries mensais ------------------------------------------------------- */

export interface Segmento {
  chave: string;
  rotulo: string;
  cor: string;
  total: number;
}

export interface ColunaMensal {
  mes: string;
  total: number;
  segmentos: Segmento[];
}

/** Série empilhada por mês. `categorias` define a ordem e as cores da pilha;
 *  `categoriasDe` diz a que categorias cada interação pertence — uma só, no
 *  caso de frente e clima, várias no caso de tema. */
export function serieMensal(
  interacoes: Interacao[],
  categorias: { chave: string; rotulo: string; cor: string }[],
  categoriasDe: (interacao: Interacao) => string[],
): ColunaMensal[] {
  const meses = new Map<string, Map<string, number>>();

  for (const interacao of interacoes) {
    const mes = chaveDoMes(interacao.data_interacao);
    if (!meses.has(mes)) meses.set(mes, new Map());
    const contagem = meses.get(mes)!;
    for (const categoria of categoriasDe(interacao)) {
      contagem.set(categoria, (contagem.get(categoria) ?? 0) + 1);
    }
  }

  return [...meses.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, contagem]) => {
      const segmentos = categorias
        .map((categoria) => ({ ...categoria, total: contagem.get(categoria.chave) ?? 0 }))
        .filter((segmento) => segmento.total > 0);
      return {
        mes,
        // Em temas o total é a soma das ocorrências de tag, não de registros:
        // uma interação com três temas conta três vezes na pilha.
        total: segmentos.reduce((soma, s) => soma + s.total, 0),
        segmentos,
      };
    });
}

/** Preenche meses sem registro, para o eixo não pular buracos. */
export function completarMeses(colunas: ColunaMensal[]): ColunaMensal[] {
  if (colunas.length < 2) return colunas;

  const porMes = new Map(colunas.map((c) => [c.mes, c]));
  const [primeiro] = colunas;
  const ultimo = colunas[colunas.length - 1];

  const completas: ColunaMensal[] = [];
  const cursor = new Date(`${primeiro.mes}-01T00:00:00`);
  const fim = new Date(`${ultimo.mes}-01T00:00:00`);

  while (cursor <= fim) {
    const chave = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    completas.push(porMes.get(chave) ?? { mes: chave, total: 0, segmentos: [] });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return completas;
}

/** Os temas mais recorrentes do recorte, já com a contagem.
 *
 *  Serve tanto como categorias da série empilhada quanto como ranking, e por
 *  isso devolve `total`: jogar a contagem fora obrigaria quem monta o ranking a
 *  recontar, e duas contagens da mesma base são duas chances de divergir. */
export function temasMaisRecorrentes(
  interacoes: Interacao[],
  catalogo: Catalogo,
  quantos = 5,
): { chave: string; rotulo: string; cor: string; total: number }[] {
  const paleta = ['#0027BD', '#17E3CB', '#A11FFF', '#FE952B', '#E12379', '#F8DC00'];
  const contagem = new Map<string, number>();

  for (const interacao of interacoes) {
    for (const nome of nomesDosTemas(catalogo, interacao.temas)) {
      contagem.set(nome, (contagem.get(nome) ?? 0) + 1);
    }
  }

  return ordenarDecrescente(contagem)
    .slice(0, quantos)
    .map((item, indice) => ({
      chave: item.chave,
      rotulo: item.rotulo,
      total: item.total,
      cor: paleta[indice % paleta.length],
    }));
}

/* -- geografia ------------------------------------------------------------ */

export interface PontoNoMapa {
  uf: string;
  total: number;
}

export function distribuicaoPorUf(interacoes: Interacao[]): PontoNoMapa[] {
  // 'NA' (nacional) e 'IN' (internacional) não têm capital: entram no ranking
  // ao lado, nunca como bolha no mapa.
  const contagem = contar(interacoes, (i) => i.uf);
  return [...contagem.entries()]
    .map(([uf, total]) => ({ uf, total }))
    .sort((a, b) => b.total - a.total);
}

/* -- rankings ------------------------------------------------------------- */

export type DimensaoDeRanking =
  | 'entidade'
  | 'pessoa'
  | 'portaVoz'
  | 'unidade'
  | 'esfera'
  | 'uf'
  | 'tag'
  | 'status'
  | 'frente';

export function ranking(
  interacoes: Interacao[],
  catalogo: Catalogo,
  dimensao: DimensaoDeRanking,
  limite = 8,
): ItemContado[] {
  const contagem = new Map<string, number>();
  const somar = (chave: string) => contagem.set(chave, (contagem.get(chave) ?? 0) + 1);

  for (const interacao of interacoes) {
    switch (dimensao) {
      case 'entidade':
        somar(nomeDaInstituicao(catalogo, interacao.instituicao_id));
        break;
      case 'pessoa': {
        const nome = nomeDoInterlocutor(catalogo, interacao.interlocutor_id);
        if (nome !== '—') somar(nome);
        break;
      }
      case 'portaVoz':
        // O registro conta para cada porta-voz: "Radamés e André" soma nos dois.
        for (const participacao of interacao.participacoes) {
          if (participacao.papel === 'porta_voz') {
            somar(nomeDaPessoa(catalogo, participacao.pessoa_aegea_id));
          }
        }
        break;
      case 'unidade': {
        const nome = nomeDaUnidade(catalogo, interacao.unidade_negocio_id);
        if (nome !== '—') somar(nome);
        break;
      }
      case 'esfera': {
        const nome = nomeDaEsfera(catalogo, interacao.esfera_id);
        if (nome !== '—') somar(nome);
        break;
      }
      case 'uf':
        somar(interacao.uf);
        break;
      case 'tag':
        for (const tema of nomesDosTemas(catalogo, interacao.temas)) somar(tema);
        break;
      case 'status':
        somar(rotuloDeCodigo(catalogo, 'status', interacao.status));
        break;
      case 'frente':
        somar(interacao.frente);
        break;
    }
  }

  return ordenarDecrescente(contagem).slice(0, limite);
}

/* -- status e resolutividade ---------------------------------------------- */

export interface GrupoDeResolucao {
  grupo: GrupoDeStatus;
  total: number;
  percentual: number;
  statusQueCompoem: { codigo: string; nome: string; total: number }[];
}

export interface Resolutividade {
  taxa: number;
  grupos: GrupoDeResolucao[];
  porFrente: {
    frente: Frente;
    total: number;
    /** Total da frente menos os declinados — o mesmo critério da taxa geral. */
    denominador: number;
    resolvidos: number;
    taxa: number;
  }[];
}

export function resolutividade(interacoes: Interacao[], catalogo: Catalogo): Resolutividade {
  const grupos: GrupoDeStatus[] = ['resolvido', 'aberto', 'declinado'];
  const total = interacoes.length;

  const porGrupo = grupos.map((grupo) => {
    const doGrupo = interacoes.filter((i) => grupoDoStatus(catalogo, i.status) === grupo);
    const contagemPorStatus = contar(doGrupo, (i) => i.status);

    return {
      grupo,
      total: doGrupo.length,
      percentual: total ? doGrupo.length / total : 0,
      statusQueCompoem: [...contagemPorStatus.entries()]
        .map(([codigo, quantos]) => ({
          codigo,
          nome: rotuloDeCodigo(catalogo, 'status', codigo),
          total: quantos,
        }))
        .sort((a, b) => b.total - a.total),
    };
  });

  const resolvidos = porGrupo.find((g) => g.grupo === 'resolvido')?.total ?? 0;

  // A taxa exclui os declinados do denominador: recusar uma demanda não é
  // deixá-la pendente, e contá-la como não resolvida distorceria o indicador.
  const declinados = porGrupo.find((g) => g.grupo === 'declinado')?.total ?? 0;
  const denominador = total - declinados;

  const frentes = [...new Set(interacoes.map((i) => i.frente))];

  return {
    taxa: denominador ? resolvidos / denominador : 0,
    grupos: porGrupo,
    porFrente: frentes
      .map((frente) => {
        const daFrente = interacoes.filter((i) => i.frente === frente);
        const resolvidosDaFrente = daFrente.filter(
          (i) => grupoDoStatus(catalogo, i.status) === 'resolvido',
        ).length;
        // Mesmo denominador da taxa geral: sem os declinados. Usar o total da
        // frente aqui faria a barra contradizer o número grande da tela.
        const declinadosDaFrente = daFrente.filter(
          (i) => grupoDoStatus(catalogo, i.status) === 'declinado',
        ).length;
        const denominadorDaFrente = daFrente.length - declinadosDaFrente;

        return {
          frente,
          total: daFrente.length,
          denominador: denominadorDaFrente,
          resolvidos: resolvidosDaFrente,
          taxa: denominadorDaFrente ? resolvidosDaFrente / denominadorDaFrente : 0,
        };
      })
      .sort((a, b) => b.total - a.total),
  };
}

export interface ItemDaFila {
  interacao: Interacao;
  dias: number;
  risco: FaixaDeRisco;
}

export function filaDePendencias(
  interacoes: Interacao[],
  catalogo: Catalogo,
  hoje = new Date(),
): ItemDaFila[] {
  return interacoes
    .filter((i) => grupoDoStatus(catalogo, i.status) === 'aberto')
    .map((interacao) => {
      const dias = diasDesde(interacao.data_interacao, hoje);
      return { interacao, dias, risco: faixaDeRisco(dias) };
    })
    // Agenda futura ainda não está parada: dias negativos vão para o fim.
    .sort((a, b) => b.dias - a.dias);
}

/* -- resultado ------------------------------------------------------------ */

export interface Resultados {
  itens: ItemContado[];
  taxaDeAvanco: number;
  denominador: number;
  porFrente: {
    frente: Frente;
    total: number;
    /** Total da frente menos os sem definição — o mesmo critério da taxa geral. */
    denominador: number;
    avancou: number;
    taxa: number;
  }[];
  recuaram: number;
  semResultado: number;
}

export function resultados(interacoes: Interacao[], catalogo: Catalogo): Resultados {
  const cores: Record<string, string> = {
    avancou: '#17E3CB',
    mantido: '#0027BD',
    recuou: '#FF5C60',
    sem_definicao: '#D5DAEA',
  };

  const codigo = (i: Interacao) => i.resultado ?? 'sem_definicao';
  const contagem = contar(interacoes, codigo);

  const itens = catalogo.dicionarios.resultados.map((resultado) => ({
    chave: resultado.codigo,
    rotulo: resultado.nome,
    total: contagem.get(resultado.codigo) ?? 0,
    cor: cores[resultado.codigo] ?? 'var(--cinza-2)',
  }));

  const avancou = contagem.get('avancou') ?? 0;
  const semDefinicao = contagem.get('sem_definicao') ?? 0;

  // Denominador explícito: só entram os registros com desfecho informado.
  const denominador = interacoes.length - semDefinicao;
  const frentes = [...new Set(interacoes.map((i) => i.frente))];

  return {
    itens,
    taxaDeAvanco: denominador ? avancou / denominador : 0,
    denominador,
    porFrente: frentes
      .map((frente) => {
        const daFrente = interacoes.filter((i) => i.frente === frente);
        const avancouNaFrente = daFrente.filter((i) => i.resultado === 'avancou').length;
        // Mesmo denominador da taxa geral: só os registros com desfecho
        // informado. Incluir os sem definição puniria a frente por falta de
        // preenchimento, e não por resultado ruim.
        const semDefinicaoNaFrente = daFrente.filter(
          (i) => (i.resultado ?? 'sem_definicao') === 'sem_definicao',
        ).length;
        const denominadorDaFrente = daFrente.length - semDefinicaoNaFrente;

        return {
          frente,
          total: daFrente.length,
          denominador: denominadorDaFrente,
          avancou: avancouNaFrente,
          taxa: denominadorDaFrente ? avancouNaFrente / denominadorDaFrente : 0,
        };
      })
      .sort((a, b) => b.total - a.total),
    recuaram: contagem.get('recuou') ?? 0,
    semResultado: semDefinicao,
  };
}

/* -- porta-vozes ---------------------------------------------------------- */

export interface ExposicaoDePortaVoz {
  id: string;
  nome: string;
  cargo: string | null;
  total: number;
  porFrente: ItemContado[];
  temas: string[];
  ultimaAparicao: string | null;
  emTier1: number;
}

export interface Exposicao {
  /** Soma das aparições — maior que o número de registros quando há mais de um
   *  porta-voz na mesma interação. É este o denominador da concentração. */
  aparicoes: number;
  acionados: number;
  concentracaoNoPrimeiro: number;
  mediaPorPortaVoz: number;
  emTier1: number;
  pessoas: ExposicaoDePortaVoz[];
}

export function exposicaoDePortaVozes(
  interacoes: Interacao[],
  catalogo: Catalogo,
): Exposicao {
  const porPessoa = new Map<string, Interacao[]>();

  for (const interacao of interacoes) {
    for (const participacao of interacao.participacoes) {
      if (participacao.papel !== 'porta_voz') continue;
      const lista = porPessoa.get(participacao.pessoa_aegea_id) ?? [];
      lista.push(interacao);
      porPessoa.set(participacao.pessoa_aegea_id, lista);
    }
  }

  const pessoas: ExposicaoDePortaVoz[] = [...porPessoa.entries()]
    .map(([id, registros]) => {
      const cadastro = catalogo.pessoas.get(id);
      const temas = new Set<string>();
      for (const registro of registros) {
        for (const tema of nomesDosTemas(catalogo, registro.temas)) temas.add(tema);
      }
      const datas = registros.map((r) => r.data_interacao).sort();

      return {
        id,
        nome: cadastro?.nome ?? '—',
        cargo: cadastro?.cargo ?? null,
        total: registros.length,
        porFrente: ordenarDecrescente(contar(registros, (r) => r.frente)),
        temas: [...temas].sort((a, b) => a.localeCompare(b, 'pt-BR')),
        ultimaAparicao: datas.length ? datas[datas.length - 1] : null,
        emTier1: registros.filter((r) => r.tier === 1).length,
      };
    })
    .sort((a, b) => b.total - a.total);

  const aparicoes = pessoas.reduce((soma, p) => soma + p.total, 0);

  return {
    aparicoes,
    acionados: pessoas.length,
    concentracaoNoPrimeiro: aparicoes ? (pessoas[0]?.total ?? 0) / aparicoes : 0,
    mediaPorPortaVoz: pessoas.length ? aparicoes / pessoas.length : 0,
    emTier1: pessoas.reduce((soma, p) => soma + p.emTier1, 0),
    pessoas,
  };
}

/** Fora do escopo: registro cujo tema não está entre os temas autorizados do
 *  porta-voz que o conduziu. Depende de `pessoa_aegea_tema`, que ainda não é
 *  exposto pela API — por isso a função recebe os temas autorizados de fora. */
export function aderenciaAoEscopo(
  exposicao: ExposicaoDePortaVoz,
  temasAutorizados: string[] | undefined,
): { dentro: number; fora: number; semCadastro: boolean } {
  if (!temasAutorizados?.length) {
    return { dentro: 0, fora: 0, semCadastro: true };
  }
  const autorizados = new Set(temasAutorizados);
  const dentro = exposicao.temas.filter((t) => autorizados.has(t)).length;
  return { dentro, fora: exposicao.temas.length - dentro, semCadastro: false };
}

/* -- interlocutores ------------------------------------------------------- */

export interface PanoramaDeInterlocutor {
  id: string;
  nome: string;
  instituicao: string;
  frente: Frente;
  ultima: string;
  total: number;
}

export function panoramaDeInterlocutores(
  interacoes: Interacao[],
  catalogo: Catalogo,
): PanoramaDeInterlocutor[] {
  const porPessoa = new Map<string, Interacao[]>();

  for (const interacao of interacoes) {
    if (!interacao.interlocutor_id) continue;
    const lista = porPessoa.get(interacao.interlocutor_id) ?? [];
    lista.push(interacao);
    porPessoa.set(interacao.interlocutor_id, lista);
  }

  return [...porPessoa.entries()]
    .map(([id, registros]) => {
      const datas = registros.map((r) => r.data_interacao).sort();
      const maisRecente = registros.reduce((a, b) =>
        a.data_interacao > b.data_interacao ? a : b,
      );
      return {
        id,
        nome: nomeDoInterlocutor(catalogo, id),
        instituicao: nomeDaInstituicao(catalogo, maisRecente.instituicao_id),
        frente: maisRecente.frente,
        ultima: datas[datas.length - 1],
        total: registros.length,
      };
    })
    .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR'));
}

/* -- comparativo entre períodos ------------------------------------------- */

export type Janela = 'semestre' | 'trimestre' | '90d';

export const ROTULOS_DE_JANELA: Record<Janela, string> = {
  semestre: 'Semestres',
  trimestre: 'Trimestres',
  '90d': 'Últimos 90 dias',
};

export interface Comparativo<T> {
  atual: T[];
  anterior: T[];
  inicioAtual: Date;
  inicioAnterior: Date;
}

/** Divide o conjunto em dois períodos consecutivos do mesmo tamanho. */
export function dividirEmJanelas(
  interacoes: Interacao[],
  janela: Janela,
  hoje = new Date(),
): Comparativo<Interacao> {
  const dias = { semestre: 182, trimestre: 91, '90d': 90 }[janela];

  const inicioAtual = new Date(hoje);
  inicioAtual.setDate(inicioAtual.getDate() - dias);
  const inicioAnterior = new Date(inicioAtual);
  inicioAnterior.setDate(inicioAnterior.getDate() - dias);

  const entre = (interacao: Interacao, de: Date, ate: Date) => {
    const data = new Date(`${interacao.data_interacao}T00:00:00`);
    return data >= de && data < ate;
  };

  return {
    atual: interacoes.filter((i) => entre(i, inicioAtual, hoje)),
    anterior: interacoes.filter((i) => entre(i, inicioAnterior, inicioAtual)),
    inicioAtual,
    inicioAnterior,
  };
}

/** Contatos que aparecem no período atual e não apareciam no anterior. */
export function novosContatos(comparativo: Comparativo<Interacao>): number {
  const antes = new Set(comparativo.anterior.map((i) => i.interlocutor_id).filter(Boolean));
  const agora = new Set(comparativo.atual.map((i) => i.interlocutor_id).filter(Boolean));
  return [...agora].filter((id) => !antes.has(id)).length;
}

export function semContatoNoPeriodo(comparativo: Comparativo<Interacao>): number {
  const antes = new Set(comparativo.anterior.map((i) => i.interlocutor_id).filter(Boolean));
  const agora = new Set(comparativo.atual.map((i) => i.interlocutor_id).filter(Boolean));
  return [...antes].filter((id) => !agora.has(id)).length;
}
