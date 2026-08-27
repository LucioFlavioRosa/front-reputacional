/** Quem sou eu, o que posso, e como sair.
 *
 *  UM lugar para as três perguntas. Antes não havia nenhum: a pessoa entrava,
 *  via o que via, e não tinha como descobrir POR QUE não via o resto — nem como
 *  encerrar a sessão sem fechar o navegador.
 *
 *  As permissões aparecem em português, e não como nomes de bandeira. Quem lê
 *  não precisa saber que existe uma coluna `ve_campos_sensiveis`; precisa saber
 *  que enxerga relato e pendências. A tradução mora em `PERMISSOES`.
 *
 *  MOSTRAR O QUE NÃO SE PODE É PARTE DO PONTO. Uma lista só com o que a pessoa
 *  alcança não responde "por que não consigo editar isto?" — a resposta é a
 *  linha apagada logo abaixo.
 */

import { useEffect, useRef, useState } from 'react';
import { sair } from '@/api/cliente';
import { dataCompleta, iniciais } from '@/dominio/formato';
import { portaisDe } from '@/dominio/tipos';
import type { Eu, Portal } from '@/dominio/tipos';

/** O nome de cada portal, na ordem em que a capa os apresenta. */
const NOME_DO_PORTAL: Record<Portal, string> = {
  crm: 'CRM dos Stakeholders',
  sintese: 'Síntese Executiva',
  score: 'Score Executivo',
};

/** As bandeiras de `papel`, ditas em português.
 *
 *  A ordem é do mais comum para o mais raro: quem abre este painel quer saber
 *  se pode criar, não se administra dicionários.
 */
const PERMISSOES: { chave: keyof NonNullable<Eu['papel']>; rotulo: string }[] = [
  { chave: 'pode_criar', rotulo: 'Registrar interações' },
  { chave: 'pode_editar_proprio', rotulo: 'Editar os próprios registros' },
  { chave: 'pode_editar_tudo', rotulo: 'Editar registros de qualquer pessoa' },
  { chave: 'pode_exportar', rotulo: 'Exportar a base' },
  { chave: 've_campos_sensiveis', rotulo: 'Ver relato e pendências' },
  { chave: 've_diretorio', rotulo: 'Ver o diretório de stakeholders' },
  { chave: 'administra_dicionarios', rotulo: 'Administrar os dicionários' },
  { chave: 'administra_acessos', rotulo: 'Administrar acessos' },
];

export function MenuDoUsuario({ eu }: { eu: Eu | null }) {
  const [aberto, definirAberto] = useState(false);
  const [saindo, definirSaindo] = useState(false);
  const [falhaAoSair, definirFalhaAoSair] = useState<string | null>(null);
  const caixa = useRef<HTMLDivElement>(null);
  const avatar = useRef<HTMLButtonElement>(null);

  // Fecha ao clicar fora e ao teclar Esc — as duas saídas que quem usa um menu
  // suspenso já espera. Sem elas, o painel fica preso na tela e a pessoa
  // procura um X que não existe.
  useEffect(function fecharAoSairDoMenu() {
    if (!aberto) return;

    function aoClicarFora(evento: MouseEvent) {
      if (!caixa.current?.contains(evento.target as Node)) definirAberto(false);
    }
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key !== 'Escape') return;
      definirAberto(false);
      // Devolve o foco a quem o abriu. Sem isto, fechar com Esc deixa o foco
      // no nada e a próxima tabulação recomeça do topo da página — quem navega
      // por teclado perde o lugar.
      avatar.current?.focus();
    }

    document.addEventListener('mousedown', aoClicarFora);
    document.addEventListener('keydown', aoTeclar);
    return function pararDeOuvir() {
      document.removeEventListener('mousedown', aoClicarFora);
      document.removeEventListener('keydown', aoTeclar);
    };
  }, [aberto]);

  if (!eu) return null;

  const portais = [...portaisDe(eu.papel)];

  async function encerrar() {
    definirSaindo(true);
    definirFalhaAoSair(null);
    try {
      await sair();
      // Recarrega em vez de trocar de estado: é o que garante que nada do
      // usuário anterior sobreviva em memória — catálogo, recorte, listagem.
      // Sair pela metade é pior do que não sair.
      window.location.reload();
    } catch (falha) {
      // SÓ recarrega quando a sessão morreu de verdade.
      //
      // Recarregar mesmo com a falha era o comportamento anterior, e escondia o
      // problema: um logout com token anti-CSRF vencido devolve 403, a sessão
      // sobrevive, e a pessoa voltava logada achando que tinha saído.
      definirSaindo(false);
      definirFalhaAoSair(
        falha instanceof Error
          ? falha.message
          : 'Não foi possível encerrar a sessão. Tente de novo.',
      );
    }
  }

  return (
    <div ref={caixa} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        ref={avatar}
        type="button"
        onClick={() => definirAberto((estava) => !estava)}
        // NÃO é `aria-haspopup="menu"`, e a diferença não é cosmética.
        //
        // Este painel é identidade e uma lista de permissões — conteúdo para
        // ler, não comandos para escolher. Anunciado como menu, a tecnologia
        // assistiva promete navegação por setas e estrutura de `menuitem`, e
        // quem tentar percorrer assim não encontra nada. Prometer uma interação
        // que não existe é pior do que não prometer nenhuma.
        //
        // O padrão certo é DIVULGAÇÃO: um botão que revela conteúdo, descrito
        // por `aria-expanded` e `aria-controls`.
        aria-expanded={aberto}
        aria-controls="menu-do-usuario"
        title={`${eu.nome} — ${eu.papel?.nome ?? 'sem papel'}`}
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          border: aberto ? '2px solid var(--azul-mar)' : '1px solid var(--borda-input)',
          background: 'var(--bg-trilho)',
          color: 'var(--azul-mar)',
          fontSize: 12,
          fontWeight: 700,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {iniciais(eu.nome)}
      </button>

      {aberto ? (
        <div
          id="menu-do-usuario"
          aria-labelledby="menu-do-usuario-nome"
          style={{
            position: 'absolute',
            top: 44,
            right: 0,
            width: 288,
            padding: 16,
            background: 'var(--branco)',
            border: '1px solid var(--borda)',
            borderRadius: 'var(--r-card)',
            boxShadow: '0 12px 32px rgba(0,25,120,0.12)',
            zIndex: 40,
          }}
        >
          <div id="menu-do-usuario-nome" style={{ fontSize: 14, fontWeight: 700 }}>
            {eu.nome}
          </div>
          <div style={{ fontSize: 12, color: 'var(--cinza-3)', marginTop: 2 }}>{eu.email}</div>

          <div
            style={{
              marginTop: 10,
              display: 'inline-block',
              padding: '3px 9px',
              borderRadius: 'var(--r-chip)',
              background: 'var(--bg-trilho)',
              color: 'var(--azul-mar)',
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {eu.papel?.nome ?? 'Acesso não liberado'}
          </div>

          {eu.acesso_expira_em ? (
            <div style={{ fontSize: 12, color: 'var(--atencao-fg)', marginTop: 8 }}>
              Acesso até {dataCompleta(eu.acesso_expira_em)}
            </div>
          ) : null}

          <Secao titulo="Módulos" />
          {portais.length ? (
            <ul style={lista}>
              {portais.map((portal) => (
                <li key={portal} style={item}>
                  <Marca ativa /> {NOME_DO_PORTAL[portal]}
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ fontSize: 12, color: 'var(--cinza-3)', margin: '6px 0 0' }}>
              Nenhum módulo liberado. Peça à coordenação do painel.
            </p>
          )}

          {/* A matriz inteira só aparece para quem TEM papel.
              Para quem ainda não foi liberado ela não informa nada — todas as
              linhas estariam apagadas — e exibe a alguém de fora o vocabulário
              completo de permissões da plataforma. Nada disso é segredo, mas
              mostrar sem necessidade é superfície que não precisa existir. */}
          {eu.papel ? (
            <>
          <Secao titulo="Permissões" />
          <ul style={lista}>
            {PERMISSOES.map(({ chave, rotulo }) => {
              const tem = Boolean(eu.papel?.[chave]);
              return (
                // A cor NÃO distingue tem de não-tem, e é decisão dupla.
                //
                // `--cinza-2` sobre branco dá 3,13:1 — abaixo do mínimo de 4,5
                // da WCAG, e a linha que mais importa ler é justamente a do que
                // a pessoa NÃO pode. E distinguir só por cor reprova em outro
                // critério: quem não separa as duas tonalidades ficaria sem a
                // informação. Quem distingue é a marca, `✓` contra `—`.
                <li key={chave} style={item}>
                  <Marca ativa={tem} /> {rotulo}
                </li>
              );
            })}
          </ul>
            </>
          ) : null}

          <button
            type="button"
            onClick={encerrar}
            disabled={saindo}
            style={{
              width: '100%',
              marginTop: 14,
              height: 38,
              borderRadius: 'var(--r-btn)',
              border: '1px solid var(--borda-input)',
              background: 'var(--branco)',
              color: 'var(--erro-fg)',
              fontSize: 13,
              fontWeight: 700,
              cursor: saindo ? 'progress' : 'pointer',
            }}
          >
            {saindo ? 'Saindo…' : 'Sair'}
          </button>

          {falhaAoSair ? (
            <div
              role="alert"
              style={{
                marginTop: 8,
                padding: '8px 10px',
                borderRadius: 'var(--r-card-int)',
                background: 'var(--erro-bg)',
                color: 'var(--erro-fg)',
                fontSize: 12,
                lineHeight: 1.45,
              }}
            >
              {falhaAoSair} Você continua conectado.
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Secao({ titulo }: { titulo: string }) {
  return (
    <div
      style={{
        marginTop: 14,
        paddingTop: 10,
        borderTop: '1px solid var(--borda)',
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        // `--cinza-3`, e não `--cinza-2`: sobre branco o cinza-2 dá 3,13:1,
        // abaixo do mínimo de 4,5 da WCAG. Em 10px o problema é maior, não
        // menor.
        color: 'var(--cinza-3)',
      }}
    >
      {titulo}
    </div>
  );
}

/** Marca de "tem" ou "não tem".
 *
 *  `aria-hidden`, e o texto do item carrega a informação para quem usa leitor
 *  de tela. Um "marca de seleção" anunciado antes de cada linha faria a lista
 *  virar ruído.
 *
 *  A COR NÃO distingue: `✓` e `—` são formas diferentes, e é isso que separa
 *  os dois estados. Distinguir por cor sozinha deixaria de fora quem não
 *  separa as tonalidades.
 */
function Marca({ ativa }: { ativa: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-block',
        width: 14,
        // `--cinza-1` dava 1,26:1 — o traço sumia, e uma marca invisível não
        // marca nada. `--cinza-3` dá 8,92 e continua lendo como ausência.
        color: ativa ? 'var(--ok-fg)' : 'var(--cinza-3)',
        fontWeight: 700,
      }}
    >
      {ativa ? '✓' : '—'}
    </span>
  );
}

const lista: React.CSSProperties = {
  listStyle: 'none',
  margin: '8px 0 0',
  padding: 0,
  display: 'grid',
  gap: 5,
};

const item: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--cinza-3)',
  display: 'flex',
  alignItems: 'baseline',
  gap: 6,
};
