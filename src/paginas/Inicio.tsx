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
  pronto: boolean;
}[] = [
  {
    portal: 'crm',
    // A porta do CRM é o Painel: quem entra vê o panorama de uma vez, e todo
    // clique nele filtra a própria tela.
    view: 'painel',
    titulo: 'CRM dos Stakeholders',
    descricao:
      'Fonte única das interações institucionais — o registro e a síntese executiva que leem essa base.',
    pronto: true,
  },
  {
    portal: 'sintese',
    view: null,
    titulo: 'KPIs Reputacionais',
    descricao:
      'O tracking da saúde reputacional da Aegea, traduzido em indicadores para decisão estratégica.',
    pronto: false,
  },
  {
    portal: 'score',
    // O TERCEIRO MÓDULO FICA COM O SCORE porque ele EXISTE: a tela está de pé,
    // lendo as planilhas dos quatro fornecedores. O main renomeou este cartão
    // para "Inteligência de Mercado" e o marcou como não pronto — decisão de
    // nomenclatura tomada enquanto este branch estava aberto, e que apagaria a
    // porta de entrada da tela sem colocar outra no lugar.
    view: 'score',
    titulo: 'Score Executivo',
    descricao:
      'O Índice de Saúde Reputacional: uma nota por mês, de cinco lentes.',
    pronto: true,
  },
];

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
}: {
  irPara: (view: Destino) => void;
  /** Os portais que o papel de quem está logado abre. */
  portais: Set<Portal>;
}) {
  // Esconder um portal é conveniência de tela, NUNCA controle: quem decide é o
  // backend, que responde 403 a quem forçar a navegação. O que se evita aqui é
  // oferecer uma porta que não abre — pior do que não mostrá-la, porque nesse
  // caso o convite partiu de nós.
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
              estilo={{ padding: 24, opacity: modulo.pronto ? 1 : 0.62 }}
            >
              <span
                style={{
                  display: 'inline-block',
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
              <p style={{ fontSize: 13, color: 'var(--cinza-3)', marginTop: 8, lineHeight: 1.6 }}>
                {modulo.descricao}
              </p>
              {modulo.view ? (
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--azul-mar)', marginTop: 14 }}>
                  Abrir o painel →
                </div>
              ) : null}
            </Cartao>
          ))}
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
            ['Classificação', 'formato, público, tier, clima, resultado e temas'],
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
