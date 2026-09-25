/** Composição do aplicativo: qual view está aberta e quais modais.
 *
 *  HÁ ROTEADOR desde a reorganização da navegação: a tela vem do endereço, e
 *  não de `useState`. Ver `@/navegacao/rota`. O protótipo previa navegação por
 *  estado; ela impedia que qualquer coisa fosse enviada por link — inclusive o
 *  leitura executiva.
 */

import { useEffect, useState } from 'react';
import { obterEu } from '@/api/cliente';
import { Botao, Carregando, Cartao } from '@/componentes/basicos';
import { portaisDe } from '@/dominio/tipos';
import { MenuDoUsuario } from '@/componentes/MenuDoUsuario';
import { LimiteDeErro } from '@/observabilidade/LimiteDeErro';
import { registrarView } from '@/observabilidade/telemetria';
import { ProvedorDoPainel } from '@/estado/painel';
import { PortalDaPlataforma } from '@/paginas/PortalDaPlataforma';
import { PortalDoAdmin } from '@/paginas/PortalDoAdmin';
import { ConfiguracoesDoScore } from '@/paginas/score/ConfiguracoesDoScore';
import { Login } from '@/paginas/Login';
import { Inicio } from '@/paginas/Inicio';
import { Painel } from '@/paginas/Painel';
import { Base } from '@/paginas/Base';
import { RelatoriosExecutivos } from '@/paginas/RelatoriosExecutivos';
import { PrepararAgenda } from '@/paginas/PrepararAgenda';
import { Score } from '@/paginas/Score';
import { SinaisDeMercado } from '@/paginas/SinaisDeMercado';
import { Cadastro } from '@/paginas/Cadastro';
import { Ficha } from '@/paginas/Ficha';
import { CadeiaDaAgenda } from '@/componentes/CadeiaDaAgenda';
import type { Eu } from '@/dominio/tipos';
import { Layout } from '@/componentes/Layout';
import { useNavegacao } from '@/navegacao/useNavegacao';
import { nomeDaTela } from '@/navegacao/rota';
import type { Destino } from '@/navegacao/rota';

export function App() {
  const [autenticado, definirAutenticado] = useState(false);
  const [preparando, definirPreparando] = useState(false);
  const [eu, definirEu] = useState<Eu | null>(null);
  const [falhaNaEntrada, definirFalhaNaEntrada] = useState<string | null>(null);
  //: Se ainda estamos perguntando ao servidor se já existe sessão.
  //:
  //: Começa `true` para não piscar a tela de login por um instante antes de
  //: descobrir que a pessoa já está dentro — que é o caso mais comum, porque é
  //: o que acontece a cada F5.
  const [verificandoSessao, definirVerificandoSessao] = useState(true);

  /**
   * Já existe sessão? Pergunta feita UMA vez, ao carregar.
   *
   * Sem isto o SSO nunca fecha o ciclo, e o sintoma é exatamente o que se vê:
   * a tela de login não avança.
   *
   * O fluxo OIDC termina com o backend redirecionando o NAVEGADOR de volta para
   * o painel, com o cookie de sessão já gravado. Do ponto de vista do React
   * isso é um carregamento novo, do zero: `autenticado` volta a ser `false` e a
   * tela de login aparece de novo — apesar de a sessão existir e o cookie estar
   * ali. A pessoa entra, é devolvida ao login, clica outra vez, e assim por
   * diante.
   *
   * Um 401 aqui é resposta normal, e não erro: quer dizer "ainda não entrou".
   * Por isso a falha é silenciosa — mostrar mensagem de erro para quem só abriu
   * o site pela primeira vez seria ruído.
   */
  useEffect(function conferirSessaoAoAbrir() {
    let vivo = true;
    obterEu()
      .then((quem) => {
        if (!vivo) return;
        definirEu(quem);
        definirAutenticado(true);
      })
      .catch(() => {
        /* Sem sessão: a tela de login é a resposta certa, sem alarde. */
      })
      .finally(() => {
        if (vivo) definirVerificandoSessao(false);
      });
    return function cancelarConferenciaDeSessao() {
      vivo = false;
    };
  }, []);

  /**
   * Entrar não é só trocar a tela: é buscar quem somos e guardar o token
   * anti-CSRF ANTES de qualquer escrita.
   *
   * Sem esta chamada, ler funciona e escrever volta 403 — e o erro apareceria
   * na tela de cadastro, longe do login, sem relação óbvia com ele.
   */
  const entrar = async (): Promise<boolean> => {
    definirPreparando(true);
    definirFalhaNaEntrada(null);
    try {
      definirEu(await obterEu());
      definirAutenticado(true);
      return true;
    } catch (falha) {
      // NÃO entra em silêncio.
      //
      // Engolir a falha e seguir para o painel pareceria tolerante e seria
      // pior: sem `/api/eu` não há token anti-CSRF, então ler funcionaria e
      // TODA escrita voltaria 403 — na tela de cadastro, longe do login e sem
      // relação óbvia com ele.
      //
      // Falhar aqui, dizendo o motivo, é mais curto para quem precisa resolver.
      definirFalhaNaEntrada(
        falha instanceof Error
          ? falha.message
          : 'Não foi possível confirmar a sessão. Tente entrar novamente.',
      );
      // `false` = não há sessão. Quem chamou decide o que fazer com isso — e a
      // tela de login decide ir para o SSO.
      //
      // A mensagem de erro continua sendo guardada porque nem toda falha é
      // "ainda não entrou": pode ser a API fora do ar, e aí o redirecionamento
      // vai falhar também. Melhor a pessoa ver o motivo do que uma tela em
      // branco.
      return false;
    } finally {
      definirPreparando(false);
    }
  };

  // Nada é decidido antes de saber se há sessão. Pintar o login e trocar
  // depois faria piscar a tela errada em todo carregamento de quem já entrou.
  if (verificandoSessao) return <Carregando />;

  if (!autenticado)
    return <Login aoEntrar={entrar} carregando={preparando} erro={falhaNaEntrada} />;

  // O provedor busca dicionários, diretórios e a base — tudo do CRM.
  // Quem não abre aquele portal receberia 403 em todas essas chamadas, e
  // veria erro ao entrar numa tela que nem oferece o módulo.
  return (
    <ProvedorDoPainel alcancaOCrm={portaisDe(eu?.papel ?? null).has('crm')}>
      <Aplicativo eu={eu} />
    </ProvedorDoPainel>
  );
}

function Aplicativo({ eu }: { eu: Eu | null }) {
  //: A TELA VEM DO ENDEREÇO, e não de `useState`.
  //:
  //: É o que dá link a toda leitura, faz o botão de voltar andar dentro da
  //: aplicação sem perder o recorte, e deixa a telemetria dizer em que tela o
  //: erro aconteceu. Navegação em `useState` não faz nenhuma das três.
  const { rota, irPara } = useNavegacao();
  const naCapa = rota.destino === 'inicio';

  //: A ABA ENTRA NA ROTA porque as telas do Score viraram a barra de cima
  //: daquela divisão: uma barra cujos itens não são endereços não se
  //: compartilha, não volta no histórico e não recarrega onde estava.
  const irParaDestino = (destino: Destino, aba?: string) => irPara({ destino, aba });
  const abrirAgenda = (id: string) =>
    irPara({ destino: 'base', agenda: id, sobre: 'ficha' });

  useEffect(function registrarTrocaDeTela() {
    registrarView(nomeDaTela(rota));
    // `nomeDaTela` é derivado: comparar a string evita reenviar o mesmo evento
    // a cada renderização.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nomeDaTela(rota)]);

  const fechandoParaBase = () => irPara({ destino: 'base' });

  return (
    <>
      {/* A CAPA NÃO TEM CABEÇALHO, mas precisa de saída.
          Sem isto, quem abre o painel e decide sair tem de ENTRAR no CRM
          primeiro para achar o botão — pedir que a pessoa avance para poder
          recuar.

          É o MESMO menu da barra, e não um botão "Sair" solto: sair mora em um
          lugar só na aplicação inteira, e duas formas diferentes de fazer a
          mesma coisa ensinam que há duas coisas. */}
      {naCapa ? (
        <div className="capa__conta">
          {/* A MESMA ENTRADA DA BARRA, pelo mesmo motivo que o sair está aqui:
              quem abre o painel e quer administrar acessos não deve ter de
              ENTRAR numa divisão para achar uma tela que não é de nenhuma. */}
          <MenuDoUsuario
            eu={eu}
            lugar="capa"
            aoAbrirPlataforma={
              eu?.papel?.administra_acessos
                ? () => irPara({ destino: 'plataforma' })
                : undefined
            }
          />
        </div>
      ) : null}

      <Layout
        view={rota.destino}
        irPara={irParaDestino}
        abaAtiva={rota.aba}
        eu={eu}
        podeCriar={eu?.papel?.pode_criar ?? false}
        // Esconder a entrada de quem não administra acessos é conveniência de
        // tela, não controle: o backend recusa com 403 de qualquer forma.
        administraAcessos={eu?.papel?.administra_acessos ?? false}
      >
        {/* O limite fica AQUI, e não só na raiz, para a falha de uma tela não
            levar o painel inteiro junto. `key` é o que dá a saída: trocar de
            tela remonta o limite e zera o erro, então a pessoa navega para
            outro lugar em vez de ficar presa. */}
        <LimiteDeErro
          key={rota.destino}
          saida={
            naCapa
              ? { rotulo: 'Ir para o CRM', aoAcionar: () => irPara({ destino: 'painel' }) }
              : undefined
          }
        >
          {rota.destino === 'inicio' ? (
            <Inicio irPara={irParaDestino} portais={portaisDe(eu?.papel ?? null)} />
          ) : null}


          {/* O PANORAMA: o recorte visto de uma vez. Clicar num indicador
              FILTRA a própria tela, como todo gráfico dela. */}
          {rota.destino === 'painel' ? <Painel aoAbrirAgenda={abrirAgenda} /> : null}

          {rota.destino === 'base' ? (
            <Base
              aoAbrirFicha={abrirAgenda}
              aoAbrirCadeia={(id) =>
                irPara({ destino: 'base', agenda: id, sobre: 'cadeia' })
              }
            />
          ) : null}

          {rota.destino === 'relatorios' ? (
            <RelatoriosExecutivos aoAbrirAgenda={abrirAgenda} />
          ) : null}

          {rota.destino === 'preparar' ? <PrepararAgenda aoAbrirAgenda={abrirAgenda} /> : null}

          {rota.destino === 'sinais' ? <SinaisDeMercado aoAbrirAgenda={abrirAgenda} /> : null}

          {rota.destino === 'score' ? (
            <Score
              aba={rota.aba}
              aoTrocarAba={(aba) => irPara({ destino: 'score', aba })}
            />
          ) : null}


          {/* A TELA também recusa, e não só o botão.
              O endereço é público: quem digitar `/agenda/nova` chega aqui
              mesmo sem permissão, e o formulário preenchido acabaria num 403
              do backend. */}
          {rota.destino === 'cadastro' ? (
            eu?.papel?.pode_criar ? (
              <Cadastro
                // `key` força um formulário NOVO ao trocar de registro. Sem
                // ela, React reaproveita o estado: abrir outra agenda mostraria
                // os campos da anterior até o carregamento terminar, e um
                // salvamento apressado gravaria o que estava na tela.
                key={rota.agenda ?? 'nova'}
                id={rota.agenda}
                aoSalvar={() => irPara({ destino: 'base' })}
              />
            ) : (
              <SemPermissaoParaCriar irPara={irParaDestino} />
            )
          ) : null}

          {/* `euId` para a tela saber qual linha é a de quem está olhando:
              ninguém desativa a própria conta. */}
          {rota.destino === 'admin' ? <PortalDoAdmin /> : null}
          {/* ACESSOS SAIU DO PORTAL DO CRM: quem entra na plataforma não é
              assunto de agenda, vale igual para o Score, e agora tem botão
              próprio. */}
          {rota.destino === 'plataforma' ? (
            <PortalDaPlataforma euId={eu?.id ?? null} />
          ) : null}
          {rota.destino === 'config-score' ? <ConfiguracoesDoScore /> : null}
        </LimiteDeErro>
      </Layout>

      {/* A ficha e a cadeia abrem POR CIMA da Base, e têm endereço próprio:
          `/agenda/<id>` e `/agenda/<id>/cadeia`. Fechar volta para a Base — e
          o botão de voltar do navegador faz a mesma coisa, que é o que a
          pessoa espera.

          Limite próprio: um registro com dado estranho não pode derrubar a
          tela que continua atrás dele. */}
      {rota.agenda && rota.sobre === 'ficha' ? (
        <LimiteDeErro key={`ficha-${rota.agenda}`} aoFechar={fechandoParaBase}>
          <Ficha
            id={rota.agenda}
            aoFechar={fechandoParaBase}
            aoEditar={
              eu?.papel?.pode_criar
                ? (id) => irPara({ destino: 'cadastro', agenda: id, sobre: 'editar' })
                : undefined
            }
          />
        </LimiteDeErro>
      ) : null}

      {rota.agenda && rota.sobre === 'cadeia' ? (
        <LimiteDeErro key={`cadeia-${rota.agenda}`} aoFechar={fechandoParaBase}>
          <CadeiaDaAgenda
            id={rota.agenda}
            aoFechar={fechandoParaBase}
            aoAbrirFicha={abrirAgenda}
          />
        </LimiteDeErro>
      ) : null}
    </>
  );
}

/** O que aparece no lugar do formulário quando o papel não cria.
 *
 *  Diz o motivo e oferece uma saída. Uma tela vazia, ou o formulário que
 *  recusaria no fim, fariam a pessoa concluir que o sistema está quebrado —
 *  quando a resposta é "seu perfil não faz isto", que é acionável.
 */
function SemPermissaoParaCriar({ irPara }: { irPara: (view: Destino) => void }) {
  return (
    <Cartao estilo={{ padding: 28, maxWidth: 520 }}>
      <div className="kicker" style={{ color: 'var(--cinza-3)' }}>
        Registrar interação
      </div>
      <h1 style={{ fontSize: 20, marginTop: 8 }}>Seu perfil não registra interações</h1>
      <p style={{ fontSize: 14, color: 'var(--cinza-3)', marginTop: 10, lineHeight: 1.6 }}>
        Você consulta e exporta a base, mas não cria nem edita registros. Se
        precisar registrar uma interação, peça à coordenação do painel — o menu
        da sua conta, no canto da barra, mostra tudo o que o seu perfil alcança.
      </p>
      <div style={{ marginTop: 18 }}>
        <Botao variante="primario" aoClicar={() => irPara('base')}>
          Ver a base de registros
        </Botao>
      </div>
    </Cartao>
  );
}
