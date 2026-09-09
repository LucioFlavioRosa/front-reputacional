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
import { dataCompleta, iniciais, nomeParaExibir } from '@/dominio/formato';
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

/** Onde o controle está pousado.
 *
 *  `barra` é a barra branca do painel: ali um círculo de 36px basta, porque o
 *  fundo é liso e o entorno já é cheio de controles — a pessoa lê aquele canto
 *  como "coisas da minha conta".
 *
 *  `capa` é a foto d'água da página inicial, e ali o mesmo círculo NÃO
 *  aparece. Não é falta de contraste no papel — são 9,17:1 contra o topo
 *  escuro do gradiente —, mas o controle pousa no canto direito, que é quase
 *  branco. E numa capa sem nenhum outro controle, um círculo com duas letras
 *  não se anuncia como botão: lê-se como enfeite da arte.
 *
 *  Por isso a capa ganha uma PASTILHA: fundo sólido, o primeiro nome escrito e
 *  uma seta. O que a torna um controle não é o contraste, é o rótulo.
 */
export type LugarDoMenu = 'barra' | 'capa';

export function MenuDoUsuario({ eu, lugar = 'barra' }: { eu: Eu | null; lugar?: LugarDoMenu }) {
  const [aberto, definirAberto] = useState(false);
  const [saindo, definirSaindo] = useState(false);
  const [falhaAoSair, definirFalhaAoSair] = useState<string | null>(null);
  const caixa = useRef<HTMLDivElement>(null);
  const avatar = useRef<HTMLButtonElement>(null);
  const naCapa = lugar === 'capa';

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
      // Recarregar mesmo com a falha esconderia o problema: um logout com
      // token anti-CSRF vencido devolve 403, a sessão sobrevive, e a pessoa
      // voltaria logada achando que tinha saído.
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
        // O NOME ACESSÍVEL VEM DAQUI, e não do conteúdo. O avatar e a seta
        // são `aria-hidden`, e abaixo de 520px o nome vai a `display: none` —
        // que o remove da árvore de acessibilidade, não só da tela. Sem este
        // rótulo, no celular quem navega por leitor de tela ouviria só
        // "botão".
        //
        // O rótulo diz o que há DENTRO, e não só de quem é a conta: "sair" é a
        // razão de a maioria das pessoas abrir isto, e é a palavra que elas
        // procuram.
        aria-label={`Conta de ${eu.nome} — permissões e sair`}
        title={`${eu.nome} — ${eu.papel?.nome ?? 'sem papel'}`}
        className={naCapa ? 'menu-conta__pastilha' : undefined}
        style={
          naCapa
            ? {
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                height: 36,
                padding: '0 12px 0 4px',
                borderRadius: 999,
                // Fundo SÓLIDO, e não translúcido: atrás dele passa uma foto
                // com respingos claros e escuros, e qualquer transparência faz
                // o rótulo mudar de legibilidade conforme o pedaço da onda.
                background: 'var(--branco)',
                // BORDA ESCURA, e não `--borda` (#E2E5F0, quase branco).
                //
                // O texto passa folgado — 10,37:1 contra o branco. O que
                // não passa é a FORMA: sobre a foto, o branco da pastilha
                // contra a água clara dá 1,08:1, e um componente
                // precisa de 3:1 no próprio limite (WCAG 1.4.11). Uma placa
                // branca sobre água quase branca não tem contorno, e um
                // contorno quase branco não o devolve.
                //
                // `--azul-mar` resolve nos dois extremos do gradiente: contra a
                // água clara é a borda que marca o limite; contra a água escura
                // do topo é o branco interno. Sempre uma das duas fronteiras
                // passa, e a pastilha nunca some.
                //
                // 2px, e não 1,5. Com 1,5 o Chrome arredonda para 1px CSS
                // e o que sobra do traço é antialiasing: no topo da pastilha o
                // pixel lê `rgb(131,150,223)` — azul diluído, não `#0027BD` —
                // e o limite cai para 2,06:1 sobre a água clara.
                // Uma borda fina demais para sobreviver ao próprio antialiasing
                // não é uma borda; é uma intenção.
                border: `2px solid var(${aberto ? '--azul-mar-sombra' : '--azul-mar'})`,
                boxShadow: '0 2px 10px rgba(0,25,120,0.18)',
                color: 'var(--azul-mar)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }
            : {
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
              }
        }
      >
        {naCapa ? (
          <>
            <span
              aria-hidden="true"
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: 'var(--bg-trilho)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {iniciais(eu.nome)}
            </span>
            {/* O nome INTEIRO, normalizado. Quem corta é o CSS logo abaixo,
                com reticência, e é o único que corta: `nomeParaExibir` só
                arruma espaço.

                Já houve duas regras de corte aqui, e as duas apagavam
                identidade — ver o comentário de `nomeParaExibir`. O nome
                completo está no painel, a um clique. */}
            <span
              className="menu-conta__nome"
              style={{ maxWidth: 168, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {nomeParaExibir(eu.nome)}
            </span>
            {/* NO CELULAR O NOME NÃO CABE, mas alguma palavra tem de caber.
                Sem nenhuma, a pastilha volta a ser o círculo mudo que causou
                todo este conserto. "Conta" e não "Sair" porque o botão ABRE um
                painel; prometer a saída e entregar um menu é a mesma classe de
                mentira que `role="menu"` seria. */}
            <span aria-hidden="true" className="menu-conta__conta">
              Conta
            </span>
            <span aria-hidden="true" style={{ fontSize: 10, opacity: 0.7 }}>
              ▾
            </span>
          </>
        ) : (
          iniciais(eu.nome)
        )}
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
