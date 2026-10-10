/** Consulta em profundidade: a raiz do drill, montada dentro do bloco
 *  expansível "Drill down" da aba Lentes (decisões A1 e D2).
 *
 *  OS DADOS SÃO OS REAIS DO MÊS DA TELA (D5): a árvore da lente vem do
 *  endpoint `/consulta` (`useConsultaDaLente`, com cache por lente e mês
 *  compartilhado com a busca do cabeçalho). Enquanto ela não chega, o bloco
 *  mostra "Carregando"; se a leitura falha, a faixa de erro com "Tentar de
 *  novo"; e, se a lente não teve matéria no mês, o recado de vazio. Os níveis
 *  só montam com os dados.
 *
 *  O ENDEREÇO É A ÚNICA FONTE DA VERDADE (A3): o nível, o nó e os filtros da
 *  lista saem do hash (`useEnderecoDoDrill`), resolvidos contra a árvore do
 *  mês com a LENTE DA ABA (A4). Descer e subir de nível faz `pushState`; filtros da
 *  lista e correção de endereço inválido fazem `replaceState`. Por isso
 *  recarregar, voltar e avançar do navegador reabrem exatamente a mesma tela.
 *
 *  ENDEREÇO QUE NÃO É O CANÔNICO É CORRIGIDO COM `replace` (D.2, A20), SÓ
 *  DEPOIS DE OS DADOS CHEGAREM: corrigir contra uma árvore que ainda não
 *  existe levaria todo link profundo ao Nível 1 durante o carregamento. Na
 *  troca de mês vale o mesmo: o hash fica intacto enquanto o mês novo carrega,
 *  o drill continua no mesmo caminho se os nós existem nele e, se não
 *  existem, a correção o leva ao nível válido mais fundo. A correção roda num
 *  efeito: chamar `history` não é `setState`, e a correção dispara o evento
 *  do endereço, que faz o hook reler o hash. Não entra em laço porque o
 *  canônico do canônico é ele mesmo (`resolverCaminho` não devolve
 *  `corrigido` para ele), e porque o efeito só roda quando o texto do
 *  endereço corrigido muda e o hash ainda não é ele.
 *
 *  AO TROCAR DE NÍVEL OU DE NÓ NA MESMA LENTE (A5), ou quando a busca do
 *  cabeçalho pede foco (A6, `navegarNoDrill(…, { focar: true })`), a janela
 *  rola até o topo do bloco, logo abaixo do cabeçalho e da faixa de filtros
 *  fixos, e o foco vai para o `h2` do nível. Não no primeiro render sem
 *  pedido (abrir o bloco à mão ou recarregar não pula a tela), não ao trocar
 *  a aba da lente, não quando só mudam `sent`, `ordem` ou filtros (a pessoa
 *  está mexendo na lista) e, com `item` no endereço, só o foco: é a lista
 *  que rola até a linha (F.9).
 *
 *  O MODAL DE PRÉVIA MORA AQUI, e não em cada nível: cartões laterais e lista
 *  de matérias abrem a mesma prévia, e o botão que abriu recebe o foco de
 *  volta ao fechar (F.8, A8). Trocar de nível com o modal aberto (o voltar do
 *  navegador) o descarta, porque a prévia guarda a chave do nível em que
 *  abriu.
 */

import { useEffect, useRef, useState } from 'react';

import { Botao, Carregando, FaixaDeErro } from '@/componentes/basicos';

import type { AlvoDaPrevia } from './componentes/apoioDosCartoes';
import { CabecalhoDoDrill } from './componentes/CabecalhoDoDrill';
import { IndicadorDeNivel } from './componentes/IndicadorDeNivel';
import { LimiteDoBloco } from './componentes/LimiteDoBloco';
import { ModalDePrevia } from './componentes/ModalDePrevia';
import { Trilha } from './componentes/Trilha';
import { avisoDaConsulta, lenteDoDrill, resolverCaminho } from './dados/seletores';
import type { Dados } from './dados/tipos';
import { tentarConsultaDeNovo, useConsultaDaLente } from './dados/useConsultaDaLente';
import { escreverEndereco, lerEndereco } from './endereco';
import type { EnderecoDoDrill } from './endereco';
import { enderecoDoNivel, rolarAteOTopoDoBloco } from './niveis/apoioDosNiveis';
import type { AcoesDoNivel } from './niveis/apoioDosNiveis';
import { NivelLente } from './niveis/NivelLente';
import { NivelPilar } from './niveis/NivelPilar';
import { NivelSubtema } from './niveis/NivelSubtema';
import { NivelTema } from './niveis/NivelTema';
import { atenderPedidoDeFoco, navegarNoDrill, useEnderecoDoDrill, usePedidoDeFoco } from './useEnderecoDoDrill';

interface PreviaAberta {
  alvo: AlvoDaPrevia;
  /** O botão que abriu: recebe o foco de volta ao fechar. */
  botao: HTMLElement | null;
  /** A chave do nível em que a prévia abriu. */
  nivel: string;
}

function descer(endereco: EnderecoDoDrill) {
  navegarNoDrill(endereco, 'push');
}

const ESTILO_DO_BLOCO = { display: 'flex', flexDirection: 'column', gap: 20 } as const;

/** 'Agosto de 2026' → 'agosto de 2026', para o meio da frase do vazio. */
function mesNoMeioDaFrase(rotuloMes: string, mes: string): string {
  const rotulo = rotuloMes.trim();
  return rotulo ? rotulo.charAt(0).toLocaleLowerCase('pt-BR') + rotulo.slice(1) : mes;
}

export function ConsultaEmProfundidade({ lente, mes }: { lente: string; mes: string }) {
  const { dados, erro, carregando } = useConsultaDaLente(lente, mes);

  // --- Restauração de rolagem do navegador --------------------------------
  // MANUAL ENQUANTO O DRILL ESTÁ NA TELA: no voltar e no avançar, o navegador
  // restaurava a posição antiga da entrada DEPOIS da rolagem da A5, e o
  // título focado ficava fora da janela ou sob o cabeçalho fixo. As entradas
  // criadas com o drill montado herdam o modo; ao desmontar, o modo anterior
  // volta para a entrada atual. AQUI, E NÃO NOS NÍVEIS, para valer também
  // enquanto o mês carrega.
  useEffect(() => {
    const antes = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => {
      window.history.scrollRestoration = antes;
    };
  }, []);

  if (erro) {
    // O BOTÃO DE TENTAR DE NOVO: sem ele, uma falha passageira (um 5xx do
    // back) prendia o drill na faixa até alguém descobrir que recolher e
    // expandir o bloco, ou trocar de mês, refaz o pedido.
    return (
      <div data-consulta-profundidade style={ESTILO_DO_BLOCO}>
        <FaixaDeErro mensagem={erro} />
        <div>
          <Botao aoClicar={() => tentarConsultaDeNovo(lente, mes)}>Tentar de novo</Botao>
        </div>
      </div>
    );
  }
  if (!dados) {
    // LENTE SEM DRILL NO FRONT (D2): o hook nem busca. O Dossiê já não monta
    // o bloco nessas lentes; isto só evita um "Carregando" eterno.
    if (!carregando) return null;
    return (
      <div data-consulta-profundidade style={ESTILO_DO_BLOCO}>
        <Carregando />
      </div>
    );
  }
  const daLente = lenteDoDrill(dados, lente);
  if (!daLente || daLente.volumeTotal === 0) {
    return (
      <div data-consulta-profundidade style={ESTILO_DO_BLOCO}>
        <p style={{ margin: 0, padding: '24px 0', textAlign: 'center', fontSize: 14, color: 'var(--cinza-3)' }}>
          Sem matérias desta lente em {mesNoMeioDaFrase(dados.meta.rotuloMes, mes)}.
        </p>
      </div>
    );
  }
  return <DrillDoMes dados={dados} lente={lente} />;
}

/** O drill com a árvore do mês já carregada: endereço, correção, rolagem,
 *  níveis e prévia. */
function DrillDoMes({ dados, lente }: { dados: Dados; lente: string }) {
  const endereco = useEnderecoDoDrill();
  const caminho = resolverCaminho(dados, lente, endereco);

  // O ENDEREÇO DA TELA, já canônico: é dele que a lista do Nível 4 lê os
  // filtros, e é ele a chave de reinício dos limites de erro (um bloco que
  // quebrou tenta de novo quando a tela muda).
  const enderecoDaTela: EnderecoDoDrill = caminho.corrigido ?? (endereco.ativo ? endereco : enderecoDoNivel(caminho));
  const chaveDaTela = escreverEndereco(enderecoDaTela);
  // A CHAVE DO NÍVEL ignora os filtros da lista: muda só quando muda o nível
  // ou o nó (A5).
  const chaveDoNivel = escreverEndereco(enderecoDoNivel(caminho));
  const temItem = enderecoDaTela.item !== undefined;

  // --- Correção do endereço (D.2, A20) ------------------------------------
  const textoCorrigido = caminho.corrigido ? escreverEndereco(caminho.corrigido) : '';
  useEffect(() => {
    if (!textoCorrigido || window.location.hash === textoCorrigido) return;
    navegarNoDrill(lerEndereco(textoCorrigido), 'replace');
  }, [textoCorrigido]);

  // --- Rolagem e foco ao trocar de nível (A5) -----------------------------
  const refDoBloco = useRef<HTMLDivElement>(null);
  const refDoTitulo = useRef<HTMLHeadingElement>(null);
  const anterior = useRef({ nivel: chaveDoNivel, lente: caminho.lente.id });
  const idDaLente = caminho.lente.id;
  const pedidoDeFoco = usePedidoDeFoco();
  useEffect(() => {
    const antes = anterior.current;
    anterior.current = { nivel: chaveDoNivel, lente: idDaLente };
    // A BUSCA DO CABEÇALHO PEDE FOCO (A6): rola e foca também na montagem
    // (o bloco abriu agora) e quando a lente muda junto. `pedidoDeFoco` está
    // nas dependências para o efeito rodar também quando o pedido é para a
    // tela que já está aberta.
    const pedido = atenderPedidoDeFoco();
    // TROCAR A ABA DA LENTE NÃO É DESCER NO DRILL: a pessoa está no topo da
    // página, nas abas, e levá-la até o bloco seria um salto que ela não
    // pediu (A4: trocar de lente só volta ao Nível 1). Montar sem pedido
    // (abrir o bloco à mão, recarregar) também não rola.
    const desceuNaMesmaLente = antes.nivel !== chaveDoNivel && antes.lente === idDaLente;
    if (!pedido && !desceuNaMesmaLente) return;
    if (!temItem && refDoBloco.current) rolarAteOTopoDoBloco(refDoBloco.current);
    refDoTitulo.current?.focus({ preventScroll: true });
  }, [chaveDoNivel, idDaLente, temItem, pedidoDeFoco]);

  // --- Modal de prévia ----------------------------------------------------
  const [previa, definirPrevia] = useState<PreviaAberta | null>(null);
  // AJUSTE DURANTE O RENDER, e não num efeito (padrão do React para estado
  // que depende de outro valor): a prévia de outro nível é descartada, e não
  // só escondida, para não reaparecer quando o avançar do navegador trouxer
  // aquele nível de volta.
  if (previa && previa.nivel !== chaveDoNivel) definirPrevia(null);
  const previaVisivel = previa && previa.nivel === chaveDoNivel ? previa : null;
  const acoes: AcoesDoNivel = {
    aoIr: descer,
    aoAbrirItem: (item, botao) => definirPrevia({ alvo: { tipo: 'item', item }, botao, nivel: chaveDoNivel }),
    aoAbrirPost: (post, titulo, botao) =>
      definirPrevia({ alvo: { tipo: 'post', post, titulo }, botao, nivel: chaveDoNivel }),
  };

  const { lente: lenteDoCaminho, pilar, tema, subtema, nivel } = caminho;
  const { meta } = dados;
  const comum = { refDoTitulo, chaveDeReinicio: chaveDaTela, meta };

  let conteudoDoNivel;
  if (nivel === 4 && pilar && tema && subtema) {
    conteudoDoNivel = (
      <NivelSubtema
        {...comum}
        lente={lenteDoCaminho}
        pilar={pilar}
        tema={tema}
        subtema={subtema}
        endereco={enderecoDaTela}
        aoIr={acoes.aoIr}
        aoAbrirItem={acoes.aoAbrirItem}
        aoMudarLista={(parcial) => navegarNoDrill({ ...enderecoDaTela, ...parcial }, 'replace')}
      />
    );
  } else if (nivel === 3 && pilar && tema) {
    conteudoDoNivel = <NivelTema {...comum} lente={lenteDoCaminho} pilar={pilar} tema={tema} aoIr={acoes.aoIr} />;
  } else if (nivel === 2 && pilar) {
    conteudoDoNivel = <NivelPilar {...comum} lente={lenteDoCaminho} pilar={pilar} aoIr={acoes.aoIr} />;
  } else {
    conteudoDoNivel = (
      <NivelLente refDoTitulo={refDoTitulo} chaveDeReinicio={chaveDaTela} {...acoes} lente={lenteDoCaminho} />
    );
  }

  return (
    <div ref={refDoBloco} data-consulta-profundidade style={ESTILO_DO_BLOCO}>
      <CabecalhoDoDrill meta={meta} />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px 20px',
        }}
      >
        <Trilha caminho={caminho} aoIr={descer} />
        {/* SEMPRE À DIREITA (E.3.4), mesmo quando a trilha longa do Nível 4
            o empurra para a linha de baixo: sozinho na linha, o
            `space-between` o deixaria colado à esquerda. */}
        <div style={{ marginLeft: 'auto' }}>
          <IndicadorDeNivel nivel={nivel} aviso={avisoDaConsulta(meta)} />
        </div>
      </div>

      {/* UM LIMITE PARA O NÍVEL INTEIRO, além dos de cada bloco: uma conta
          que falhe fora de um bloco (no próprio nível) também fica contida
          aqui, sem derrubar a aba Lentes. */}
      <LimiteDoBloco nome={`Nível ${nivel}`} chaveDeReinicio={chaveDaTela}>
        {conteudoDoNivel}
      </LimiteDoBloco>

      {previaVisivel ? (
        <ModalDePrevia
          alvo={previaVisivel.alvo}
          devolverFocoPara={previaVisivel.botao}
          aoFechar={() => definirPrevia(null)}
          dadosReais={!meta.aviso.trim()}
        />
      ) : null}
    </div>
  );
}
