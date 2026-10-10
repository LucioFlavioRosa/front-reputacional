/** O estado do drill no endereço (decisão A3): ler e escrever o HASH, puro.
 *
 *  POR QUE O HASH E NÃO A CONSULTA (`?`): a consulta pertence ao recorte do
 *  CRM (`src/estado/painel.tsx`). `tier` e `uf` virariam filtros do CRM, e a
 *  navegação entre telas levaria os parâmetros do drill a todas elas. Nenhum
 *  outro código lê o hash, mas quem regrava o endereço precisa preservá-lo:
 *  `definirRecorte` (painel) e `irPara` (navegação) gravam sem ele (ver A3 e
 *  "Integração" em `docs/consulta-profundidade/ARQUITETURA.md`).
 *
 *  Formato: `#consulta&lente=imprensa&pilar=…&tema=…&subtema=…&sent=…&ordem=…&tier=…&conc=…&uf=…&item=…`
 *
 *  - O primeiro segmento `consulta` é o marcador: sem ele, o hash não é do
 *    drill e nada é lido.
 *  - ORDEM FIXA DE CHAVES na escrita, para que o mesmo estado dê sempre o
 *    mesmo endereço (comparar endereços vira comparar strings).
 *  - Vazios e padrões (`sent=todas`, `ordem=impacto`) são omitidos.
 *  - Valores com espaço ou acento (`Tier 1`, `Águas do Rio`) vão codificados
 *    com `encodeURIComponent` e voltam iguais.
 */

export type SentimentoDaLista = 'todas' | 'negativas' | 'neutras' | 'positivas';
export type OrdemDaLista = 'impacto' | 'data';

export interface EnderecoDoDrill {
  /** O hash tem o marcador "consulta". */
  ativo: boolean;
  lente?: string;
  pilar?: string;
  tema?: string;
  subtema?: string;
  sent?: SentimentoDaLista;
  ordem?: OrdemDaLista;
  tier?: string;
  conc?: string;
  uf?: string;
  item?: string;
}

export const MARCADOR = 'consulta';

/** Chaves de texto livre, na ordem em que são escritas. `sent` e `ordem`
 *  entram no meio porque têm valores fechados e padrão próprio. */
const CHAVES = ['lente', 'pilar', 'tema', 'subtema', 'sent', 'ordem', 'tier', 'conc', 'uf', 'item'] as const;
type Chave = (typeof CHAVES)[number];

const SENTIMENTOS: readonly SentimentoDaLista[] = ['todas', 'negativas', 'neutras', 'positivas'];
const ORDENS: readonly OrdemDaLista[] = ['impacto', 'data'];

function ehChave(k: string): k is Chave {
  return (CHAVES as readonly string[]).includes(k);
}

/** `decodeURIComponent` lança em sequência malformada (`%E0%A4%A`); um
 *  endereço colado à mão não pode derrubar a tela, então o par é ignorado. */
function decodificar(texto: string): string | undefined {
  try {
    return decodeURIComponent(texto);
  } catch {
    return undefined;
  }
}

/** `'#consulta&pilar=x'` → `{ ativo: true, pilar: 'x' }`. Aceita o hash com
 *  ou sem `#`. Chave desconhecida, valor vazio e valor fora da lista (em
 *  `sent` e `ordem`) são descartados; chave repetida vale a primeira. */
export function lerEndereco(hash: string): EnderecoDoDrill {
  const semCerquilha = hash.startsWith('#') ? hash.slice(1) : hash;
  const [marcador, ...pares] = semCerquilha.split('&');
  if (marcador !== MARCADOR) return { ativo: false };

  const e: EnderecoDoDrill = { ativo: true };
  for (const par of pares) {
    const i = par.indexOf('=');
    if (i <= 0) continue;
    const chave = decodificar(par.slice(0, i));
    const valor = decodificar(par.slice(i + 1));
    if (chave === undefined || valor === undefined || !ehChave(chave)) continue;
    if (valor.trim() === '' || e[chave] !== undefined) continue;

    if (chave === 'sent') {
      if ((SENTIMENTOS as readonly string[]).includes(valor)) e.sent = valor as SentimentoDaLista;
    } else if (chave === 'ordem') {
      if ((ORDENS as readonly string[]).includes(valor)) e.ordem = valor as OrdemDaLista;
    } else {
      e[chave] = valor;
    }
  }
  return e;
}

/** `{ ativo: true, lente: 'imprensa', pilar: 'x' }` → `'#consulta&lente=imprensa&pilar=x'`.
 *  Endereço inativo vira `''` (sem hash). */
export function escreverEndereco(e: EnderecoDoDrill): string {
  if (!e.ativo) return '';
  const partes: string[] = [MARCADOR];
  for (const chave of CHAVES) {
    const valor = e[chave];
    if (valor === undefined || valor.trim() === '') continue;
    if (chave === 'sent' && valor === 'todas') continue;
    if (chave === 'ordem' && valor === 'impacto') continue;
    partes.push(`${chave}=${encodeURIComponent(valor)}`);
  }
  return `#${partes.join('&')}`;
}
