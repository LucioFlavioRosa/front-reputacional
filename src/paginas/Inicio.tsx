/** Início — o hub que mostra o roadmap em ondas e o que já está disponível. */

import { Cartao } from '@/componentes/basicos';
import { OndaDoHero } from '@/componentes/Onda';
import type { Destino } from '@/navegacao/rota';
import type { Portal } from '@/dominio/tipos';

/** As três divisões da plataforma.
 *
 *  `portal` é o que amarra cada cartão à permissão: quem não alcança o portal
 *  não vê o cartão. Ver `portaisDe` em `@/dominio/tipos`.
 */
const ONDA_1: {
  portal: Portal;
  view: Destino | null;
  titulo: string;
  descricao: string;
  /** De onde vem o dado que o painel lê — o sinal de confiança que falta para
   *  quem abre o cartão sem conhecer o modelo por trás. O "o que responde" já
   *  mora dentro da própria `descricao`, em vez de uma terceira linha que
   *  repetiria o que a primeira já diz com outras palavras. Só nos dois
   *  painéis prontos: o terceiro ainda não tem fonte definida. */
  fontes?: string;
  pronto: boolean;
}[] = [
  {
    portal: 'crm',
    // A porta do CRM é o Painel: quem entra vê o panorama de uma vez, e todo
    // clique nele filtra a própria tela.
    view: 'painel',
    titulo: 'CRM dos Stakeholders',
    descricao:
      'O que a Aegea já conversou com reguladores, imprensa, investidores e demais públicos institucionais — o assunto, o resultado e o que ainda está pendente de resposta.',
    fontes: 'Alimentado pela própria equipe, a cada interação registrada.',
    pronto: true,
  },
  {
    portal: 'score',
    // O SEGUNDO MÓDULO FICA COM O SCORE porque ele EXISTE: a tela está de pé,
    // lendo as planilhas dos quatro fornecedores — só o rótulo do cartão virou
    // "KPIs Reputacionais" (pedido do Jones), enquanto "Painel de Inteligência
    // de Mercado" foi para o cartão de 'inteligencia_de_mercado', ainda não pronto. A ordem
    // aqui segue o que está pronto: os dois disponíveis primeiro, o "em
    // construção" por último.
    view: 'score',
    titulo: 'KPIs Reputacionais',
    descricao:
      'Uma nota única de reputação, atualizada todo mês, que mostra como a Aegea é vista pela imprensa, pelo mercado, pela sociedade, pelos clientes e pelas instituições — e se essa nota está subindo ou caindo.',
    // MESMAS FONTES DE `DESCRICAO_DAS_LENTES` (dominio/descricaoDasLentes.ts),
    // só resumidas por fornecedor em vez de por lente: é a mesma fonte única
    // de verdade, não um texto novo que pode divergir dela.
    //
    // O CRM SAIU DAQUI porque saiu do índice: a `0108` aposentou a fonte `crm`
    // (`ativo = false`) quando a Institucional passou a recortar a imprensa, e
    // `calcular_indice` deixou de contá-la. O CRM continua existindo e tem o
    // portal dele — o que deixou de ser verdade é que ele alimenta esta nota.
    fontes:
      'Monitoramento de imprensa e redes contratado pela Aegea (Clipei, Approach SL e Bites) e o canal de atendimento (CM).',
    pronto: true,
  },
  {
    portal: 'inteligencia_de_mercado',
    // O TERCEIRO MÓDULO ABRIU. Ele nasceu aqui com `view: null` e
    // `pronto: false` — o cartão aparecia e não levava a lugar nenhum —, e a
    // primeira tela dele é o cruzamento das cotações dos bonds com o índice
    // reputacional da companhia.
    //
    // A PORTA DE VERDADE NÃO É ESTA. `configuracao.mercado_lancado`, no back,
    // é quem decide se as rotas servem dado; esconder ou mostrar o cartão é
    // conveniência de tela. Enquanto a bandeira estiver desligada, clicar aqui
    // leva uma tela de erro do servidor em vez de um gráfico — e isso é
    // melhor que um cartão que mente sobre estar pronto.
    view: 'mercado',
    titulo: 'Painel de Inteligência de Mercado',
    descricao:
      'Como as cotações dos bonds da Aegea se moveram e como o índice reputacional da companhia se moveu no mesmo período.',
    fontes:
      'Cotação diária dos papéis em circulação (export do provedor de preço) e o índice mensal do painel de KPIs.',
    pronto: true,
  },
];

/** O cartão do Cadastro compartilhado — fora de `ONDA_1` de propósito.
 *
 *  NÃO É UM QUARTO PAINEL. É cadastro: instituições e contatos, temas e
 *  representantes Aegea — o dado mestre que o CRM, o Score e o futuro Painel
 *  de Inteligência de Mercado leem igualmente. Misturá-lo na mesma grade dos
 *  três painéis o apresentaria como um painel a mais — e a permissão que abre
 *  esta porta também é outra: `administra_dicionarios`, não um portal
 *  (`acessa_crm`/`acessa_score`/`acessa_inteligencia_de_mercado`) como os três acima.
 *
 *  UM CARTÃO SÓ PARA OS TRÊS, e não três cartões: quem cadastra uma faz as
 *  outras (ver `PortalDoCadastroCompartilhado`), e três cartões repetiriam o
 *  aviso "não é um painel" três vezes em vez de uma.
 */
const CADASTRO_COMPARTILHADO = {
  view: 'compartilhado' as const,
  //: DIFERENTE DO RÓTULO DA SEÇÃO ("Cadastro compartilhado", no JSX abaixo)
  //: de propósito: repetir o mesmo texto no rótulo e no título do cartão, um
  //: em cima do outro, leria como erro de cópia, não como reforço.
  titulo: 'Instituições, Temas e Representantes Aegea',
  descricao:
    'Com quem a Aegea se relaciona, os temas que o painel consegue somar e quem fala pela Aegea — uma base só, usada pelo CRM, pelo Score e por quem vier depois.',
};

/** Uma gaveta de arquivo — o glifo do cadastro. Uma forma simples, e não um
 *  ícone de biblioteca: a única cor que ele veste é `currentColor`, herdada
 *  do fundo que o envolve. Mesmo padrão de `IconeDeAnexo`, em `basicos.tsx`. */
function IconeDeCadastro() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden focusable="false">
      <path
        d="M2 4a1 1 0 0 1 1-1h3l1.4 1.4H13a1 1 0 0 1 1 1v6.6a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** A ÁRVORE DA TAXONOMIA — fora de `ONDA_1` e fora do Cadastro compartilhado,
 *  as duas de propósito.
 *
 *  NÃO É UM QUARTO PAINEL, pela mesma razão do Cadastro compartilhado: é
 *  consulta ao dado mestre, não um recorte com nota própria.
 *
 *  E NÃO É O MESMO CARTÃO DO CADASTRO, mesmo os dois sendo "base compartilhada
 *  que todos leem" — o Cadastro é onde o dado se EDITA (`administra_dicionarios`,
 *  3 abas de formulário); a Árvore é só VISUALIZAÇÃO, aberta a qualquer pessoa
 *  logada, sem papel nenhum — o backend não exige um
 *  (`GET /api/taxonomia/arvore` só pede sessão, ver `app/api/arvore_da_taxonomia.py`).
 *  Misturar as duas no mesmo cartão prometeria edição a quem só pode olhar, ou
 *  esconderia a árvore de quem não administra cadastro — e ela foi pensada
 *  para a empresa inteira entender a taxonomia, não só quem a mantém.
 *
 *  SAIU DE DENTRO DO SCORE (20/10/2026, por pedido): morar em "KPIs
 *  Reputacionais" escondia de quem nunca abre aquele portal algo que não
 *  depende dele — ver `Score.tsx`.
 */
const ARVORE_DA_TAXONOMIA = {
  view: 'taxonomia' as const,
  //: DIFERENTE DO RÓTULO DA SEÇÃO, pela mesma razão do Cadastro compartilhado.
  titulo: 'Árvore da taxonomia',
  descricao:
    'Como os subtemas se organizam por atributo reputacional e por risco corporativo — para toda a equipe entender a organização por trás dos indicadores.',
};

/** Um galho se dividindo em três — o glifo da árvore. Mesma forma simples e
 *  `currentColor` de `IconeDeCadastro`, acima. */
function IconeDeArvore() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden focusable="false">
      <path
        d="M8 14V8M8 8L4 4M8 8l4-4M4 4V2M12 4V2"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

//: A JORNADA INTEIRA, não só a Onda 1 — Onda 1 é o "foundation": estruturar
//: os dados que sustentam os três painéis executivos acima, o projeto
//: atual; as próximas cinco descrevem para onde a plataforma vai, uma
//: capacidade por onda.
const ONDAS = [
  'Onda 1 · Foundation — estruturação dos dados e 3 painéis (projeto atual)',
  'Onda 2 · Novos blocos e expansão para novas áreas',
  'Onda 3 · Backtests e aplicação de agentes',
  'Onda 4 · Insights preditivos',
  'Onda 5 · Tendências e alertas dinâmicos com correlações',
  'Onda 6 · Ecossistema escalável',
];

export function Inicio({
  irPara,
  portais,
  administraCadastros,
}: {
  irPara: (view: Destino) => void;
  /** Os portais que o papel de quem está logado abre. */
  portais: Set<Portal>;
  /** Se administra Instituições e Contatos — não é portal, é `administra_dicionarios`. */
  administraCadastros: boolean;
}) {
  // Esconder um portal é conveniência de tela, NUNCA controle: quem decide é o
  // backend, que responde 403 a quem forçar a navegação. O que se evita aqui é
  // oferecer uma porta que não abre — pior do que não mostrá-la, porque nesse
  // caso o convite partiu de nós. A mesma regra vale para o cartão de
  // cadastro, só que pela permissão dele (`administraCadastros`), não por portal.
  const meus = ONDA_1.filter((modulo) => portais.has(modulo.portal));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      <section
        style={{
          position: 'relative',
          borderRadius: 'var(--r-destaque)',
          overflow: 'hidden',
          minHeight: 260,
          display: 'flex',
          alignItems: 'flex-end',
          padding: 36,
          backgroundImage:
            'linear-gradient(155deg, rgba(0,39,189,0.82) 0%, rgba(0,39,189,0.52) 52%, rgba(23,227,203,0.20) 100%), url(/imagens/hero-agua.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center 82%',
          color: 'var(--branco)',
        }}
      >
        {/* A classe reserva espaço para o menu da conta, que flutua no canto. */}
        <div className="entrada__hero-texto">
          <div className="kicker" style={{ color: 'var(--turquesa-sombra)' }}>
            Aegea · Reputação
          </div>
          <h1
            style={{
              fontSize: 44,
              lineHeight: 1.1,
              marginTop: 10,
              maxWidth: '20ch',
              textShadow: '0 2px 18px rgba(0,25,120,0.4)',
              // O h1 global agora nasce azul-mar — este vive dentro do hero
              // com foto e gradiente, então precisa do branco de volta.
              color: 'var(--branco)',
            }}
          >
            O relacionamento institucional{' '}
            <span className="destaque" style={{ color: 'var(--turquesa-rio)' }}>
              medido
            </span>
          </h1>
          <p style={{ fontSize: 15, marginTop: 12, maxWidth: '56ch', color: '#EAEEFC' }}>
            Uma base só. O que era planilha vira registro com histórico, e o que era
            leitura de e-mail vira indicador.
          </p>
        </div>
        <OndaDoHero />
      </section>

      <section>
        <div className="kicker" style={{ marginBottom: 12 }}>
          MVP · Onda 1 — os três painéis executivos
        </div>
        {meus.length === 0 ? (
          <Cartao estilo={{ padding: 24 }}>
            <h2 style={{ fontSize: 17 }}>Seu acesso ainda não foi liberado</h2>
            <p style={{ fontSize: 13, color: 'var(--cinza-3)', marginTop: 8, lineHeight: 1.6 }}>
              Você entrou, mas nenhum dos módulos está liberado para o seu perfil.
              Peça à coordenação do painel.
            </p>
          </Cartao>
        ) : null}

        {/* TRÊS COLUNAS IGUAIS (`grade--3`), não `grade--destaque` (que dava
            1.35fr ao primeiro cartão): os três módulos pesam o mesmo aqui,
            mesmo só o CRM estando disponível. */}
        <div className="grade grade--3" style={{ gap: 16 }}>
          {meus.map((modulo) => (
            <Cartao
              key={modulo.titulo}
              aoClicar={modulo.view ? () => irPara(modulo.view!) : undefined}
              // FLEX COLUNA, para o "Abrir o painel" cair no rodapé
              // (`marginTop: auto`, mais abaixo) e alinhar entre os três
              // cartões — a grade já estica os três para a mesma altura.
              estilo={{
                padding: 24,
                opacity: modulo.pronto ? 1 : 0.62,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <span
                style={{
                  // `alignSelf`, e não o padrão `stretch` do flex-coluna: sem
                  // isto o selo vira uma barra da largura inteira do cartão —
                  // foi exatamente esse o defeito da primeira tentativa.
                  alignSelf: 'flex-start',
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  padding: '3px 8px',
                  borderRadius: 'var(--r-chip)',
                  background: modulo.pronto ? 'var(--amarelo-pequi)' : 'transparent',
                  color: modulo.pronto ? '#332727' : 'var(--cinza-2)',
                  border: modulo.pronto ? 'none' : '1px solid var(--borda-input)',
                }}
              >
                {modulo.pronto ? 'Disponível' : 'Em construção'}
              </span>
              <h2 style={{ fontSize: 17, marginTop: 12 }}>{modulo.titulo}</h2>
              {/* `minHeight` NAS QUATRO LINHAS DO MAIOR TEXTO (KPIs) — mesma
                  técnica de `TRUNCAR_EM_DUAS_LINHAS` (`TabelaDeInteracoes.tsx`):
                  reservar o espaço do texto mais comprido para a Fonte cair na
                  mesma altura nos dois cartões, sem flex nem tocar em nada do
                  cartão do KPI (a descrição dele já ocupa as 4 linhas). */}
              <p
                style={{
                  fontSize: 13,
                  color: 'var(--cinza-3)',
                  marginTop: 8,
                  lineHeight: 1.6,
                  minHeight: '6.4em',
                }}
              >
                {modulo.descricao}
              </p>
              {/* A FONTE, SÓ QUANDO EXISTE — hoje, só os dois painéis
                  prontos. É o sinal de confiança que faltava para quem abre o
                  cartão sem conhecer o modelo: de onde vem o dado. */}
              {modulo.fontes ? (
                <div
                  style={{
                    marginTop: 12,
                    paddingTop: 12,
                    borderTop: '1px solid var(--borda)',
                    fontSize: 12,
                    color: 'var(--cinza-2)',
                    lineHeight: 1.5,
                  }}
                >
                  <strong style={{ color: 'var(--cinza-3)' }}>Fonte: </strong>
                  {modulo.fontes}
                </div>
              ) : null}
              {modulo.view ? (
                <div
                  style={{
                    marginTop: 'auto',
                    paddingTop: 14,
                    fontSize: 13,
                    fontWeight: 700,
                    color: 'var(--azul-mar)',
                  }}
                >
                  Abrir o painel →
                </div>
              ) : null}
            </Cartao>
          ))}
        </div>
      </section>

      {/* FORA DA GRADE DOS TRÊS PAINÉIS DE PROPÓSITO — ver o comentário de
          `CADASTRO_COMPARTILHADO`: é a base que os três leem, não um painel a
          mais. `administraCadastros` decide a visibilidade do primeiro
          cartão, não um portal; o segundo (`ARVORE_DA_TAXONOMIA`) não tem
          condição nenhuma — ver o comentário dela, acima.
          LADO A LADO, por pedido (20/10/2026): os dois são a mesma "classe"
          de atalho — consulta ao dado mestre, não um painel com nota —, e
          `flexWrap` empilha num celular sem precisar de duas larguras fixas.
          O TRATAMENTO VISUAL TAMBÉM DIZ "não é painel": fundo acinzentado,
          em vez de um `Cartao` branco do mesmo porte dos três painéis — e
          sem o selo "Disponível", que é o que igualava a leitura dos quatro. */}
      <section>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          {administraCadastros ? (
            <div style={{ flex: '1 1 320px', minWidth: 0 }}>
              <div className="kicker" style={{ marginBottom: 10 }}>
                Cadastro compartilhado
              </div>
              <Cartao
                aoClicar={() => irPara(CADASTRO_COMPARTILHADO.view)}
                estilo={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '13px 18px',
                  height: '100%',
                  background: 'var(--cinza-0)',
                  // SÓLIDA, e não tracejada: tracejado neste app é o
                  // vocabulário de "falta dado" (mês sem base, ponto parcial
                  // da Jornada, chip fantasma de filtro) — herdar isso aqui
                  // diria "incompleto" sobre uma área pronta e funcionando.
                  border: '1px solid var(--borda)',
                  // SEM `boxShadow` AQUI: sobrescrever para 'none' mataria o
                  // hover que `.cartao--clicavel:hover` já dá de graça
                  // (inline sempre vence classe) — o padrão do `Cartao` já é
                  // sutil o bastante para não competir com os painéis.
                }}
              >
                <span
                  style={{
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 32,
                    height: 32,
                    borderRadius: 'var(--r-chip)',
                    background: 'var(--cinza-1)',
                    color: 'var(--cinza-3)',
                  }}
                >
                  <IconeDeCadastro />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h2 style={{ fontSize: 14 }}>{CADASTRO_COMPARTILHADO.titulo}</h2>
                  <p style={{ fontSize: 12, color: 'var(--cinza-2)', marginTop: 2, lineHeight: 1.5 }}>
                    {CADASTRO_COMPARTILHADO.descricao}
                  </p>
                </div>
                <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 600, color: 'var(--azul-mar)' }}>
                  Abrir →
                </span>
              </Cartao>
            </div>
          ) : null}

          <div style={{ flex: '1 1 320px', minWidth: 0 }}>
            <div className="kicker" style={{ marginBottom: 10 }}>
              Metodologia
            </div>
            <Cartao
              aoClicar={() => irPara(ARVORE_DA_TAXONOMIA.view)}
              estilo={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '13px 18px',
                height: '100%',
                background: 'var(--cinza-0)',
                border: '1px solid var(--borda)',
              }}
            >
              <span
                style={{
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 32,
                  height: 32,
                  borderRadius: 'var(--r-chip)',
                  background: 'var(--cinza-1)',
                  color: 'var(--cinza-3)',
                }}
              >
                <IconeDeArvore />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 style={{ fontSize: 14 }}>{ARVORE_DA_TAXONOMIA.titulo}</h2>
                <p style={{ fontSize: 12, color: 'var(--cinza-2)', marginTop: 2, lineHeight: 1.5 }}>
                  {ARVORE_DA_TAXONOMIA.descricao}
                </p>
              </div>
              <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 600, color: 'var(--azul-mar)' }}>
                Abrir →
              </span>
            </Cartao>
          </div>
        </div>
      </section>

      <section>
        <div className="kicker" style={{ marginBottom: 12 }}>
          Jornada via ondas de evolução
        </div>
        <div
          className="rolagem-interna"
          style={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: 'minmax(168px, 1fr)', gap: 12 }}
        >
          {ONDAS.map((onda, indice) => (
            <div
              key={onda}
              style={{
                padding: 16,
                borderRadius: 'var(--r-card-int)',
                border: '1px solid var(--borda)',
                background: indice === 0 ? 'var(--branco)' : 'transparent',
              }}
            >
              <div
                className="tabular"
                style={{ fontSize: 22, fontWeight: 700, color: indice === 0 ? 'var(--azul-mar)' : 'var(--cinza-1)' }}
              >
                {String(indice + 1).padStart(2, '0')}
              </div>
              <div style={{ fontSize: 12, color: 'var(--cinza-3)', marginTop: 6 }}>{onda}</div>
            </div>
          ))}
        </div>
      </section>

      <section
        style={{
          background: 'var(--cinza-4)',
          color: 'var(--branco)',
          borderRadius: 'var(--r-card)',
          padding: 28,
        }}
      >
        <div className="kicker" style={{ color: 'var(--turquesa-sombra)' }}>
          As cinco camadas
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 20,
            marginTop: 16,
          }}
        >
          {[
            ['Registro', 'o cadastro único que substitui a planilha'],
            ['Classificação', 'formato, público, tier, termômetro, resultado e temas'],
            ['Derivação', 'os indicadores saem do recorte filtrado'],
            ['Leitura', 'painéis por status e desfecho'],
            ['Decisão', 'o que precisa de resposta, e de quem'],
          ].map(([titulo, descricao]) => (
            <div key={titulo}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{titulo}</div>
              <div style={{ fontSize: 12, color: '#8C91A4', marginTop: 4, lineHeight: 1.55 }}>
                {descricao}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
