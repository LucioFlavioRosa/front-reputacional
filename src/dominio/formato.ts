/** Formatação de data, número e texto — em pt-BR, num lugar só. */

const MESES_CURTOS = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
];

/** Datas do backend vêm como "2026-05-07". Interpretar sem fuso evita o
 *  clássico deslocamento de um dia que `new Date('2026-05-07')` provoca. */
export function paraData(iso: string): Date {
  const [ano, mes, dia] = iso.slice(0, 10).split('-').map(Number);
  return new Date(ano, mes - 1, dia);
}

export function dataCurta(iso: string): string {
  const d = paraData(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function dataCompleta(iso: string): string {
  const d = paraData(iso);
  return d.toLocaleDateString('pt-BR');
}

export function mesCurto(iso: string): string {
  return MESES_CURTOS[paraData(iso).getMonth()];
}

/** Chave "2026-05" para agrupar séries mensais. */
export function chaveDoMes(iso: string): string {
  return iso.slice(0, 7);
}

export function rotuloDoMes(chave: string): string {
  const [, mes] = chave.split('-').map(Number);
  return MESES_CURTOS[mes - 1];
}

/** Hoje no fuso do usuário, em ISO.
 *
 *  `new Date().toISOString()` devolve UTC: no Brasil, depois das 21h, ele já
 *  aponta para o dia seguinte — e o formulário abriria com a data errada.
 */
export function hojeLocal(agora = new Date()): string {
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');
  return `${agora.getFullYear()}-${mes}-${dia}`;
}

export function diasDesde(iso: string, hoje = new Date()): number {
  const inicio = paraData(iso);
  const fim = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.round((fim.getTime() - inicio.getTime()) / 86_400_000);
}

export function numero(valor: number): string {
  return valor.toLocaleString('pt-BR');
}

export function percentual(parte: number, total: number, casas = 0): string {
  if (!total) return '0%';
  return `${((parte / total) * 100).toFixed(casas).replace('.', ',')}%`;
}

/** Variação entre dois períodos, já com o sinal. */
export function variacao(atual: number, anterior: number): string {
  if (!anterior) return atual ? '+100%' : '0%';
  const delta = ((atual - anterior) / anterior) * 100;
  const sinal = delta > 0 ? '+' : '';
  return `${sinal}${delta.toFixed(0).replace('-0', '0')}%`;
}

export function titulo(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Concordância de número — evita "1 registros" nos textos gerados. */
export function plural(quantidade: number, singular: string, plural_: string): string {
  return quantidade === 1 ? singular : plural_;
}

export function truncar(texto: string, limite: number): string {
  return texto.length <= limite ? texto : `${texto.slice(0, limite - 1)}…`;
}

/** Devolve a URL só se ela for navegável com segurança.
 *
 *  `registro_url` é texto vindo do banco, digitado por quem cadastra. Jogado
 *  direto num `href`, um valor como `javascript:...` executa ao clique — XSS
 *  armazenado. Com cadastro por usuário externo, isso deixa de ser hipótese.
 *  Só http e https passam; o resto vira `null` e o link não é renderizado.
 */
export function urlSegura(valor: string | null | undefined): string | null {
  if (!valor) return null;
  try {
    // Sem URL de base de propósito: `registro_url` é sempre um endereço
    // absoluto (SharePoint, em geral). Passar `window.location.origin` como
    // base amarrava a função ao navegador — fora dele ela recusava tudo,
    // inclusive endereços legítimos.
    const url = new URL(valor.trim());
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

/** As duas iniciais que identificam a conta no avatar da barra.
 *
 *  Primeiro nome e ÚLTIMO sobrenome, e não os dois primeiros: numa equipe há
 *  vários "Silva" e poucos "Costa". Duas letras num círculo de 36px é tudo o
 *  que distingue uma conta da outra ali.
 *
 *  Mora AQUI, e não no componente, por uma razão de ferramenta: exportar uma
 *  função de um arquivo que também exporta componente quebra o Fast Refresh do
 *  Vite — a tela recarrega inteira a cada edição em vez de preservar o estado.
 */
export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}
