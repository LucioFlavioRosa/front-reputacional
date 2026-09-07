/** O grafo de agendas: quem veio de quem, em camadas.
 *
 *  POR QUE EM CAMADAS, E NÃO POR FORÇA
 *  -----------------------------------
 *  Causalidade tem direção. Um layout por força espalha os nós por atração, e
 *  "a agência e a bancada levaram a esta reunião, que abriu duas frentes com
 *  bancos" sai como um novelo sem ordem de leitura — justamente a informação
 *  que a tela existe para dar.
 *
 *  E força-dirigido assenta diferente a cada carregamento. O mesmo grafo teria
 *  aparência distinta toda vez, e estas telas são comparadas em captura de tela
 *  e em reunião.
 *
 *  Em camadas, a profundidade vira um eixo: quem olha lê da esquerda para a
 *  direita e vê o encadeamento sem mexer o mouse.
 *
 *  TUDO AQUI É FUNÇÃO PURA. O componente só desenha o que estas funções
 *  devolvem — é o que permite testar o layout sem montar tela.
 */

import type { Interacao } from '@/dominio/tipos';

export interface NoDoGrafo {
  id: string;
  /** Quantos passos desde a agenda mais antiga da cadeia. Vira a coluna. */
  profundidade: number;
  /** Posição dentro da camada. Vira a linha. */
  ordem: number;
  /** Quantas origens deste nó ficaram FORA do que a tela carregou.
   *
   *  Zero na maioria dos casos. Maior que zero significa que este nó parece
   *  uma raiz e NÃO é: a conversa começou antes, num registro que o recorte
   *  atual não trouxe.
   *
   *  Sem este número, a tela mostraria uma história começando onde ela não
   *  começou — e quem se prepara para a reunião leria menos do que existe,
   *  sem nada indicando que falta.
   */
  origensForaDaJanela: number;
  interacao: Interacao;
}

export interface ArestaDoGrafo {
  de: string;
  para: string;
}

export interface Grafo {
  nos: NoDoGrafo[];
  arestas: ArestaDoGrafo[];
  /** Quantas agendas ficaram de fora por não terem linhagem nenhuma. */
  soltas: number;
  /** Quantos nós têm origem fora do que a tela carregou.
   *
   *  É o aviso de que o desenho está INCOMPLETO. Medido: numa janela de 50
   *  registros desta base, dois nós caem nesse caso — e sem o aviso os dois
   *  apareceriam como início de conversa.
   */
  comOrigemForaDaJanela: number;
}

/** A agenda faz parte de alguma cadeia?
 *
 *  As DUAS pontas contam: uma agenda que só originou outras não decorre de
 *  nada, e mesmo assim é o começo de uma história.
 *
 *  Os dois números vêm do SERVIDOR, e não do que a tela carregou. Contados na
 *  janela, diriam "não faz parte de cadeia" para uma agenda cuja descendente
 *  ficou fora do recorte — que é exatamente o erro que esconderia a cadeia que
 *  alguém procurava.
 */
export function temCadeia(interacao: Pick<Interacao, 'origens' | 'derivadas'>): boolean {
  return (interacao.origens?.length ?? 0) > 0 || (interacao.derivadas ?? 0) > 0;
}

/** Quantas agendas decorrem deste nó SEM estar no desenho.
 *
 *  A contagem do servidor menos as setas que saem daqui. Maior que zero quer
 *  dizer que a história continua fora do recorte — e um nó que parece FOLHA sem
 *  ser é a mesma mentira que um nó que parece RAIZ sem ser, que
 *  `origensForaDaJanela` já cobre do outro lado.
 *
 *  Nunca negativo: se o servidor contar menos do que a tela desenha, o dado
 *  está inconsistente, e o certo é não avisar nada em vez de avisar ao
 *  contrário.
 */
export function derivadasForaDaJanela(no: NoDoGrafo, arestas: ArestaDoGrafo[]): number {
  const desenhadas = arestas.filter((aresta) => aresta.de === no.id).length;
  return Math.max(0, (no.interacao.derivadas ?? 0) - desenhadas);
}

/** As agendas que participam de alguma cadeia.
 *
 *  Uma agenda entra se `temCadeia` — o que o SERVIDOR diz, e não o que a
 *  janela carregada mostra. As soltas — que são a maioria em qualquer base
 *  real — ficam de fora, e a tela diz quantas são: sem esse número, o grafo
 *  pareceria representar tudo o que existe.
 *
 *  ANTES ELA OLHAVA SÓ A JANELA, e o efeito medido era este: uma agenda cuja
 *  única descendente ficou fora do recorte não entrava, e o modal aberto pela
 *  marca da Base respondia "a cadeia desta agenda está fora do recorte" — para
 *  uma agenda que a mesma tela acabara de marcar como parte de uma cadeia.
 *  Duas telas dizendo coisas opostas sobre o mesmo registro.
 *
 *  Agora ela entra sozinha, e o `⋯` ao lado do nó diz de que lado a história
 *  continua. Um nó só é mais honesto do que nenhum.
 */
function comLinhagem(interacoes: Interacao[]): Interacao[] {
  return interacoes.filter(temCadeia);
}

/** A profundidade de cada nó: o MAIOR caminho desde uma raiz.
 *
 *  O maior, e não o menor. Uma agenda que decorre da raiz E de uma neta precisa
 *  ficar depois da neta — pelo menor caminho ela empataria com a filha, e a
 *  seta que vem da neta apontaria para trás.
 *
 *  Uma origem que não está no conjunto carregado (fora da janela de 200, por
 *  exemplo) é ignorada no cálculo: contá-la deslocaria o nó para uma camada
 *  cuja origem ninguém vê, e o desenho teria uma coluna vazia à esquerda.
 */
function profundidades(interacoes: Interacao[]): Map<string, number> {
  const porId = new Map(interacoes.map((i) => [i.id, i]));
  const calculada = new Map<string, number>();

  const calcular = (id: string, visitando: Set<string>): number => {
    const pronta = calculada.get(id);
    if (pronta !== undefined) return pronta;

    // O CICLO É BARRADO NO SERVIDOR, e mesmo assim a travessia se protege: um
    // dado inconsistente vindo de outro caminho — importação, escrita direta no
    // banco — travaria a aba inteira num laço infinito, e a tela não tem como
    // saber que o dado está errado.
    if (visitando.has(id)) return 0;
    visitando.add(id);

    const pais = (porId.get(id)?.origens ?? []).filter((o) => porId.has(o));
    const valor = pais.length
      ? Math.max(...pais.map((p) => calcular(p, visitando))) + 1
      : 0;

    visitando.delete(id);
    calculada.set(id, valor);
    return valor;
  };

  for (const i of interacoes) calcular(i.id, new Set());
  return calculada;
}

/** Monta o grafo pronto para desenhar.
 *
 *  A ordem dentro de cada camada usa o BARICENTRO dos pais: um nó fica na
 *  altura média de quem o originou. É o que reduz cruzamento de setas sem
 *  precisar de otimização — e cruzamento é o que torna um grafo ilegível antes
 *  de qualquer outra coisa.
 *
 *  Duas passadas bastam: a primeira ordena pelos pais já posicionados, a
 *  segunda refina. Mais passadas dão ganho decrescente e custam previsibilidade
 *  — o layout precisa ser o MESMO a cada carregamento.
 */
export function montarGrafo(interacoes: Interacao[]): Grafo {
  const participantes = comLinhagem(interacoes);
  const soltas = interacoes.length - participantes.length;

  if (participantes.length === 0)
    return { nos: [], arestas: [], soltas, comOrigemForaDaJanela: 0 };

  const porId = new Map(participantes.map((i) => [i.id, i]));
  const profundidade = profundidades(participantes);

  const camadas = new Map<number, string[]>();
  for (const i of participantes) {
    const nivel = profundidade.get(i.id) ?? 0;
    camadas.set(nivel, [...(camadas.get(nivel) ?? []), i.id]);
  }

  // A primeira camada em ordem de DATA: é a única sem pais para orientá-la, e
  // a cronologia é a ordem que quem lê espera.
  const niveis = [...camadas.keys()].sort((a, b) => a - b);
  for (const nivel of niveis) {
    camadas.set(
      nivel,
      [...(camadas.get(nivel) ?? [])].sort((a, b) =>
        (porId.get(a)?.data_interacao ?? '').localeCompare(
          porId.get(b)?.data_interacao ?? '',
        ),
      ),
    );
  }

  const posicao = new Map<string, number>();
  const registrarPosicoes = () => {
    for (const nivel of niveis) {
      (camadas.get(nivel) ?? []).forEach((id, indice) => posicao.set(id, indice));
    }
  };
  registrarPosicoes();

  for (let passada = 0; passada < 2; passada += 1) {
    for (const nivel of niveis.slice(1)) {
      const ordenada = [...(camadas.get(nivel) ?? [])].sort((a, b) => {
        const centro = (id: string) => {
          const pais = (porId.get(id)?.origens ?? []).filter((o) => porId.has(o));
          if (!pais.length) return Number.MAX_SAFE_INTEGER;
          const soma = pais.reduce((t, p) => t + (posicao.get(p) ?? 0), 0);
          return soma / pais.length;
        };
        const diferenca = centro(a) - centro(b);
        // Empate resolvido pela DATA, e não pela ordem de chegada: sem isso, a
        // mesma base poderia sair em ordens diferentes conforme a consulta.
        return diferenca !== 0
          ? diferenca
          : (porId.get(a)?.data_interacao ?? '').localeCompare(
              porId.get(b)?.data_interacao ?? '',
            );
      });
      camadas.set(nivel, ordenada);
    }
    registrarPosicoes();
  }

  const nos: NoDoGrafo[] = [];
  for (const nivel of niveis) {
    (camadas.get(nivel) ?? []).forEach((id, indice) => {
      const interacao = porId.get(id);
      if (interacao) {
        nos.push({
          id,
          profundidade: nivel,
          ordem: indice,
          origensForaDaJanela: (interacao.origens ?? []).filter(
            (o) => !porId.has(o),
          ).length,
          interacao,
        });
      }
    });
  }

  const arestas: ArestaDoGrafo[] = [];
  for (const i of participantes) {
    for (const origem of i.origens ?? []) {
      if (porId.has(origem)) arestas.push({ de: origem, para: i.id });
    }
  }

  return {
    nos,
    arestas,
    soltas,
    comOrigemForaDaJanela: nos.filter((n) => n.origensForaDaJanela > 0).length,
  };
}

/** As cadeias independentes, para poder mostrar uma de cada vez.
 *
 *  Um grafo com nove cadeias sobrepostas é ilegível mesmo bem desenhado. Cada
 *  componente conexo é uma conversa que evoluiu por conta própria, e é assim
 *  que quem se prepara para uma reunião quer ler: a cadeia DELA.
 *
 *  Conexidade ignora a direção da seta: duas agendas que compartilham uma
 *  origem pertencem à mesma história, ainda que nenhuma decorra da outra.
 */
export function cadeias(grafo: Grafo): string[][] {
  const vizinhos = new Map<string, string[]>();
  const ligar = (a: string, b: string) =>
    vizinhos.set(a, [...(vizinhos.get(a) ?? []), b]);
  for (const { de, para } of grafo.arestas) {
    ligar(de, para);
    ligar(para, de);
  }

  const visto = new Set<string>();
  const grupos: string[][] = [];
  for (const no of grafo.nos) {
    if (visto.has(no.id)) continue;
    const grupo: string[] = [];
    const fila = [no.id];
    visto.add(no.id);
    while (fila.length) {
      const atual = fila.shift() as string;
      grupo.push(atual);
      for (const vizinho of vizinhos.get(atual) ?? []) {
        if (!visto.has(vizinho)) {
          visto.add(vizinho);
          fila.push(vizinho);
        }
      }
    }
    grupos.push(grupo);
  }

  // A maior primeiro: é a que tem mais história, e a que alguém procura ao
  // abrir a tela sem saber o que quer ver.
  return grupos.sort((a, b) => b.length - a.length);
}
