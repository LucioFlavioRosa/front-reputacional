/** As decisões do campo que se digita e se completa — sem React no meio.
 *
 *  ESTÃO AQUI PORQUE ERRAR AQUI MENTE NA TELA. O defeito que motivou separar:
 *  quem digitava "Bloomberg" e clicava direto em Salvar via a tela dizer
 *  Bloomberg e o registro guardar a instituição anterior. É uma regra de duas
 *  linhas que só se prova com teste, e teste de regra não precisa de DOM.
 */

export interface Opcao {
  valor: string;
  rotulo: string;
  /** Uma linha extra na sugestão — o nome por extenso, o cargo, a frente. */
  detalhe?: string;
}

/** Sem acento, em minúsculas. A mesma normalização que o backend usa para
 *  deduplicar nome: assim "Radames" encontra "Radamés".
 *
 *  A faixa é a dos sinais diacríticos que o `NFD` separa da letra, escrita em
 *  escapes e não com os caracteres literais: eles são INVISÍVEIS no editor, e
 *  um intervalo que ninguém enxerga é um intervalo que ninguém confere. */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** As opções que sobram para o que já se digitou.
 *
 *  Casa em QUALQUER POSIÇÃO, e não só no começo: quem procura a "Agência
 *  Nacional de Águas" digita "aguas", não "agência". O detalhe entra na busca
 *  pelo mesmo motivo — a sigla costuma estar lá. */
export function filtrar(opcoes: Opcao[], busca: string): Opcao[] {
  const termo = normalizar(busca);
  if (!termo) return opcoes;
  return opcoes.filter(
    (o) =>
      normalizar(o.rotulo).includes(termo) ||
      normalizar(o.detalhe ?? '').includes(termo),
  );
}

/** A opção que LIMPA o campo. `valor` vazio é o "não informado" do formulário. */
const LIMPAR: Opcao = { valor: '', rotulo: '' };

/** O que gravar quando a lista fecha sem clique numa sugestão — clique fora,
 *  Tab, foco no campo seguinte.
 *
 *  `null` quer dizer: descarte o texto e volte a mostrar o que já estava
 *  escolhido. Uma opção quer dizer: essa é a escolha, grave. A opção de valor
 *  vazio quer dizer: limpe o campo.
 *
 *  A REGRA É "INEQUÍVOCO". Digitar o nome inteiro e sair vale como escolha —
 *  é o comportamento de planilha que motivou trocar os `select`. O que não
 *  pode acontecer, nunca, é a tela mostrar um rótulo e o formulário guardar
 *  outro valor.
 *
 *  O EXATO GANHA DO PARCIAL. "Bloomberg" filtra duas opções, porque "Bloomberg
 *  Línea" também contém o termo — e ainda assim quem digitou o nome inteiro de
 *  uma delas escolheu ela. Sem esta regra, o nome mais curto de uma família de
 *  nomes seria justamente o que não dá para digitar.
 *
 *  APAGAR O TEXTO E SAIR LIMPA o campo opcional. Só quando a pessoa APAGOU:
 *  abrir a lista e sair sem tocar em nada não é gesto de limpeza, e campo
 *  obrigatório não se limpa por descuido.
 */
export function escolhaAoFechar(
  opcoes: Opcao[],
  busca: string,
  situacao: { digitou?: boolean; obrigatorio?: boolean } = {},
): Opcao | null {
  const texto = busca.trim();
  if (!texto) {
    return situacao.digitou && !situacao.obrigatorio ? LIMPAR : null;
  }
  // A OPÇÃO VAZIA NÃO CONTA como candidata: ela é o "Não informado" do topo da
  // lista, que existe para limpar o campo com um clique, e casaria com quase
  // qualquer coisa que se digitasse.
  const candidatas = filtrar(opcoes, busca).filter((o) => o.valor);
  const alvo = normalizar(texto);
  const exatas = candidatas.filter((o) => normalizar(o.rotulo) === alvo);
  if (exatas.length === 1) return exatas[0];
  return candidatas.length === 1 ? candidatas[0] : null;
}
