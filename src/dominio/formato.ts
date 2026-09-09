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

/** O tamanho de um arquivo, legível por gente e não em bytes.
 *
 *  ESTAVA ESCRITA DUAS VEZES — na lista de materiais do cadastro e na aba de
 *  documentos da Base —, com o mesmo corpo e o mesmo comentário. Duas escritas
 *  da mesma regra divergem no primeiro ajuste: bastaria alguém querer uma casa
 *  decimal nos KB para as duas telas passarem a dizer coisas diferentes sobre
 *  o mesmo arquivo.
 */
export function tamanhoLegivel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
    // absoluto. Passar `window.location.origin` como base amarraria a função
    // ao navegador — fora dele ela recusaria tudo, inclusive endereços
    // legítimos.
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
/** O nome de quem está logado, pronto para caber num controle de largura fixa.
 *
 *  Só normaliza o espaço. A largura é problema do CSS, e é lá que ele está
 *  resolvido — `max-width` mais reticência no `span` da pastilha.
 *
 *  E O CORTE NÃO É NO CÓDIGO. Devolver só o primeiro nome faria "CRM ·
 *  leitura" e "CRM · edição" virarem ambos "CRM" — o controle que existe para
 *  dizer quem está logado esconderia exatamente isso —, e "Ana Paula Rodrigues
 *  Lima" viraria "Ana". O CSS resolve melhor: "Ana Paula Rodrig…" cabe e ainda
 *  distingue Ana Paula de Ana Carolina.
 *
 *  Reticência informa mais que amputação, e não precisa de um limite mágico.
 */
export function nomeParaExibir(nome: string): string {
  return nome.trim().replace(/\s+/g, ' ');
}

export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}


/** Como esta agenda se chama numa lista.
 *
 *  UM LUGAR SO, e nao um ternario em cada tela. A pauta e opcional, e o nome
 *  da agenda aparece na Base, na exportacao, em Frentes, em Status e na
 *  escolha de agenda de origem — cinco lugares que, resolvidos cada um por si,
 *  divergem.
 *
 *  A ordem do fallback vai do mais especifico ao mais generico: a pauta, quando
 *  existe, e o que alguem escreveu de proprio punho sobre aquela agenda; os
 *  temas sao a mesma coisa classificada; e a expectativa diz o que se quer
 *  dela. Restando nada, o rotulo diz que falta preencher — e nao finge que a
 *  agenda nao tem assunto.
 */
export function tituloDaAgenda(
  interacao: { pauta: string | null; temas: number[]; expectativa: string | null },
  nomesDeTemas: (ids: number[]) => string[],
): string {
  if (interacao.pauta?.trim()) return interacao.pauta;

  const temas = nomesDeTemas(interacao.temas ?? []);
  if (temas.length) return temas.join(', ');

  if (interacao.expectativa?.trim()) return interacao.expectativa;

  return 'Sem assunto informado';
}
