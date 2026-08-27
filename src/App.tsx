/** Composição do aplicativo: qual view está aberta e quais modais.
 *
 *  Não há roteador: a nav é o único caminho para cada view, exatamente como o
 *  protótipo define. O estado corresponde ao que o handoff lista em "Estado
 *  necessário".
 */

import { useEffect, useState } from 'react';
import { obterEu } from '@/api/cliente';
import { DrawerDeFiltros } from '@/componentes/FiltrosDrawer';
import { Botao, Carregando, Cartao } from '@/componentes/basicos';
import { portaisDe } from '@/dominio/tipos';
import { LimiteDeErro } from '@/observabilidade/LimiteDeErro';
import { registrarView } from '@/observabilidade/telemetria';
import { ProvedorDoPainel } from '@/estado/painel';
import { Acessos } from '@/paginas/Acessos';
import { Login } from '@/paginas/Login';
import { Frentes } from '@/paginas/Frentes';
import { Painel } from '@/paginas/Painel';
import { Resultado } from '@/paginas/Resultado';
import { Status } from '@/paginas/Status';
import { Inicio } from '@/paginas/Inicio';
import { Base } from '@/paginas/Base';
import { Cadastro } from '@/paginas/Cadastro';
import { Ficha } from '@/paginas/Ficha';
import { GerarRelatorio } from '@/paginas/GerarRelatorio';
import { Interlocutores } from '@/paginas/Interlocutores';
import { PortaVozes } from '@/paginas/PortaVozes';
import type { Eu, Frente } from '@/dominio/tipos';
import { Layout } from '@/componentes/Layout';
import type { View } from '@/componentes/Layout';

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
  // A capa, e não o painel. Quem abre o endereço vê primeiro o que o
  // produto é; o CRM é uma escolha, e não o lugar onde se cai.
  const [view, definirView] = useState<View>('inicio');
  //: A capa não tem cabeçalho. Ver o `saida` do `LimiteDeErro` abaixo.
  const naCapa = view === 'inicio';

  const [frenteAberta, definirFrenteAberta] = useState<Frente>('imprensa');
  const [fichaAberta, definirFichaAberta] = useState<string | null>(null);
  const [relatorioAberto, definirRelatorioAberto] = useState(false);

  // A navegação é por estado, não por URL: o rastreio automático de rota do
  // SDK depende do history API e nunca dispararia. Sem isto, todo erro seria
  // atribuído à tela inicial e não à que o usuário estava vendo de fato.
  useEffect(function registrarTrocaDeView() {
    registrarView(view);
  }, [view]);

  const abrirFrente = (frente: Frente) => {
    definirFrenteAberta(frente);
    definirView('frentes');
  };

  return (
    <>
      <Layout
        view={view}
        irPara={definirView}
        eu={eu}
        podeCriar={eu?.papel?.pode_criar ?? false}
        aoGerarRelatorio={() => definirRelatorioAberto(true)}
        // Esconder a entrada de quem não administra acessos é conveniência de
        // tela, não controle: o backend recusa com 403 de qualquer forma. O que
        // se ganha é não mostrar a todo mundo uma porta que só alguns abrem.
        administraAcessos={eu?.papel?.administra_acessos ?? false}
      >
        {/* O limite fica AQUI, e não só na raiz, para a falha de uma tela não
            levar o painel inteiro junto. Com ele na raiz apenas, um erro dentro
            do mapa apagava a navegação também, e a única saída era recarregar.

            `key={view}` é o que dá a saída: trocar de tela remonta o limite e
            zera o erro, então a pessoa navega para outro lugar em vez de ficar
            presa. Sem a chave, o limite guardaria o erro para sempre e toda
            tela seguinte nasceria quebrada.

            É também o que torna verdadeira a frase do fallback, "esta tela não
            conseguiu carregar". Na raiz, ela era imprecisa: quem não carregava
            era o painel. */}
        <LimiteDeErro
          key={view}
          // Só a capa recebe saída, e é onde ela é indispensável: sem
          // cabeçalho, uma exceção ali deixa a pessoa sem navegação E sem o
          // cartão de entrada, e recarregar devolve a mesma tela quebrada.
          //
          // Nas outras telas o cabeçalho fica FORA deste limite, então a
          // navegação sobrevive à falha e a saída já existe.
          saida={
            naCapa
              ? { rotulo: 'Ir para o CRM', aoAcionar: () => definirView('painel') }
              : undefined
          }
        >
          {view === 'inicio' ? (
              <Inicio irPara={definirView} portais={portaisDe(eu?.papel ?? null)} />
            ) : null}
          {view === 'painel' ? <Painel aoAbrirFrente={abrirFrente} /> : null}
          {view === 'frentes' ? (
            <Frentes
              frente={frenteAberta}
              aoTrocarFrente={definirFrenteAberta}
              aoAbrirFicha={definirFichaAberta}
            />
          ) : null}
          {view === 'status' ? <Status aoAbrirFicha={definirFichaAberta} /> : null}
          {view === 'resultado' ? <Resultado /> : null}
          {view === 'portavozes' ? <PortaVozes /> : null}
          {view === 'interlocutores' ? <Interlocutores /> : null}
          {view === 'base' ? <Base aoAbrirFicha={definirFichaAberta} /> : null}
          {/* A TELA também recusa, e não só o botão.
              A navegação é por estado, então uma tela alcançável por um caminho
              que ninguém previu continua alcançável. Guardar só o botão seria
              proteger a porta e deixar a janela aberta — e o formulário
              preenchido acabaria num 403 do backend. */}
          {view === 'cadastro' ? (
            eu?.papel?.pode_criar ? (
              <Cadastro aoSalvar={() => definirView('base')} />
            ) : (
              <SemPermissaoParaCriar irPara={definirView} />
            )
          ) : null}
          {view === 'acessos' ? <Acessos /> : null}
        </LimiteDeErro>
      </Layout>

      <DrawerDeFiltros />

      {/* Ficha e relatório abrem POR CIMA do painel, então merecem limite
          próprio: um registro com dado estranho não pode derrubar a tela que
          continua atrás dele. A chave é o id, para que abrir outra ficha depois
          de uma quebrada comece limpa. */}
      {fichaAberta ? (
        <LimiteDeErro key={`ficha-${fichaAberta}`} aoFechar={() => definirFichaAberta(null)}>
          <Ficha id={fichaAberta} aoFechar={() => definirFichaAberta(null)} />
        </LimiteDeErro>
      ) : null}

      {relatorioAberto ? (
        <LimiteDeErro aoFechar={() => definirRelatorioAberto(false)}>
          <GerarRelatorio aoFechar={() => definirRelatorioAberto(false)} />
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
function SemPermissaoParaCriar({ irPara }: { irPara: (view: View) => void }) {
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
