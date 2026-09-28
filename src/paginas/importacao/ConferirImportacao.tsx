/** A conferência da importação: o modal É a planilha que acabou de subir.
 *
 *  ERAM TRÊS BLOCOS — as pendências agrupadas, "o que já está decidido" e a grade
 *  das linhas. O dono do produto olhou e disse o que é verdade: espaço demais para
 *  pouca informação, e três lugares olhando as mesmas 54 linhas obrigavam a pessoa a
 *  cruzar as três para entender uma pendência.
 *
 *  UMA SUPERFÍCIE SÓ, e ela é a planilha. O que os blocos diziam foi para onde é
 *  verdade:
 *
 *  - a CONTAGEM subiu para o cabeçalho, numa linha — é o que responde "tenho tempo
 *    de conferir isto agora?" antes de rolar;
 *  - a DECISÃO desceu para a célula vermelha, dizendo quantas linhas ela resolve.
 *    Era a única coisa que o bloco agrupado tinha de insubstituível: "este órgão não
 *    existe" em doze linhas é um clique, não doze, e é isso que faz a conferência
 *    escalar com um dia de evento. Ver `celula.ts`;
 *  - o "o que já está decidido" não voltou em lugar nenhum. Era um painel de
 *    prestação de contas que ninguém pediu: o que ele listava está dito na própria
 *    frase do botão de subir.
 *
 *  DOIS BOTÕES POR LINHA e dois no modal, como pedido. Excluir é reversível até a
 *  confirmação — a linha fica marcada e volta com um clique —, porque errar numa tela
 *  de 54 linhas é fácil e a planilha não é o caminho de volta: o arquivo não é
 *  guardado.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import {
  cancelarImportacao,
  confirmarImportacao,
  corrigirLinhaDaImportacao,
  excluirLinhaDaImportacao,
  obterImportacao,
  resolverDivergencia,
} from '@/api/cliente';
import type { ColunaDaImportacao, Importacao, LinhaDaImportacao } from '@/api/cliente';
import { Botao, FaixaDeErro, Modal, Vazio } from '@/componentes/basicos';
import { decisaoDaCelula } from '@/paginas/importacao/celula';
import { mascaraDeData, paraTelaBr } from '@/paginas/importacao/dataNaTela';
import { corDaCelula, linhaTemPendencia, resumoDeCores } from '@/paginas/importacao/grade';
import type { Medida } from '@/paginas/importacao/medidas';
import {
  larguraDaGrade,
  medidaDaColuna,
  medidaPeloConteudo,
} from '@/paginas/importacao/medidas';
import { porUrgencia } from '@/paginas/importacao/grupos';

interface Props {
  id: string;
  /** Chamado depois de confirmar, para a tela de origem recarregar. */
  aoConfirmar?: (criadas: number) => void;
  /** Fecha a conferência e volta para a tela de trás. */
  aoFechar?: () => void;
}

/** A borda de cada peça. UM PIXEL do cinza do sistema, e não uma cor nova. */
const REGUA = '1px solid var(--borda)';

/** O espaço ENTRE as peças. É ele que divide as colunas agora: com cantos
 *  arredondados não há régua compartilhada, e o vão faz o mesmo trabalho com menos
 *  tinta. Dois pixels — o suficiente para separar, pouco para não afrouxar a grade. */
const VAO = '2px';

/** A ALTURA DE TODA LINHA, e ela não muda nunca.
 *
 *  É o pedido, e é o que faz a grade ser varrível: 54 linhas de alturas diferentes
 *  não se leem de cima a baixo. Ao entrar em edição o campo ocupa exatamente esta
 *  altura, com `box-sizing: border-box`, então a borda dele cabe DENTRO do espaço que
 *  o texto ocupava — a linha não se move um pixel.
 *
 *  DUAS LINHAS DE TEXTO E NÃO UMA, desde que o campo aberto passou a quebrar em vez de
 *  cortar (ver `medidas.ts`). A altura cresceu uma vez, para todas as linhas de uma
 *  vez, e continua sendo a MESMA em todas — que é o que a uniformidade significa.
 *
 *  ERA AQUI O DEFEITO que expandia a célula: o campo levava `className="entrada"`, e
 *  essa classe existe no projeto — é o layout da tela de LOGIN, com
 *  `min-height: 100vh`. O campo estava recebendo altura mínima de uma tela inteira. */
const ALTURA_DA_LINHA = 48;

/** Quantas linhas de texto uma célula de campo aberto mostra antes de cortar.
 *
 *  DUAS, e o número é o compromisso: uma não mostra nada de um relato, e cinco fariam
 *  a grade de 54 agendas ter a altura de quatro telas. O que passa disso está no campo
 *  de edição, que abre com o texto inteiro. */
const LINHAS_DE_TEXTO = 2;

/** A largura da primeira coluna, a do número da linha na planilha. Três dígitos e o
 *  cabeçalho "LINHA" — o teto de 500 agendas não passa de três. */
const LARGURA_DO_NUMERO = 64;

/** A largura da última coluna, a dos dois botões da linha. "Editar" e "Excluir" lado a
 *  lado, e é o que decide se eles ficam na mesma linha ou empilhados. */
const LARGURA_DAS_ACOES = 168;

/** Quantas linhas a grade monta por vez.
 *
 *  MEDIDO, NÃO CHUTADO: montar o teto de 500 agendas por 58 colunas — 29 mil células —
 *  levava ~12 segundos num ambiente que nem faz layout nem pintura. A pessoa veria o
 *  modal congelado depois de subir o arquivo, que é o pior momento possível para a tela
 *  parar de responder.
 *
 *  OITENTA cobre a primeira tela com folga em qualquer monitor (são 2400px de linhas), e
 *  o resto entra conforme ela rola. Ninguém precisa pedir para ver: a grade cresce
 *  sozinha ao chegar perto do fim. */
const LINHAS_POR_BLOCO = 80;

/** A que distância do fim da rolagem o próximo bloco entra. Um bloco de folga, para a
 *  linha seguinte já existir quando o olho chegar nela. */
const MARGEM_DE_ROLAGEM = ALTURA_DA_LINHA * 10;

/** O recheio de toda célula, cabeçalho incluído. Um número só, num lugar só:
 *  cabeçalho e corpo com recheios diferentes desalinham a coluna inteira. */
const RECHEIO = '6px 10px';

/** O cabeçalho: fixo no topo da rolagem, no azul da marca sobre o trilho. É a mesma
 *  linguagem das outras tabelas do produto (`componentes/Tabela.tsx`) — inventar
 *  outra aqui faria esta tela parecer de outro sistema. */
const CABECALHO = {
  position: 'sticky' as const,
  top: 0,
  zIndex: 3,
  background: 'var(--bg-trilho)',
  color: 'var(--azul-mar-sombra)',
  textAlign: 'left' as const,
  padding: RECHEIO,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.02em',
  textTransform: 'uppercase' as const,
  whiteSpace: 'nowrap' as const,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  border: REGUA,
  borderRadius: 'var(--r-destaque)',
};

/** A célula de dados: a régua à direita é o que divide as colunas, e o recheio é o
 *  mesmo do cabeçalho — recheios diferentes desalinham a coluna inteira. */
const CELULA = {
  padding: RECHEIO,
  border: REGUA,
  borderRadius: 'var(--r-destaque)',
  background: 'var(--branco)',
  height: ALTURA_DA_LINHA,
  //: `middle` e não `top`: com altura fixa, o texto centrado verticalmente é o que
  //: faz a peça parecer uma célula e não um bloco com o conteúdo empurrado para cima.
  verticalAlign: 'middle' as const,
  //: A CÉLULA NÃO CRESCE, e o que não cabe nela é cortado. O que muda por tipo de
  //: coluna é COMO não cabe: a sigla e a data cortam com reticências numa linha só, e
  //: o campo aberto quebra em `LINHAS_DE_TEXTO` linhas antes de cortar (ver `RECORTE`).
  whiteSpace: 'nowrap' as const,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

/** Como o VALOR se recorta dentro da célula, por tipo de coluna.
 *
 *  UM `span` E NÃO O `td`: a célula também carrega o sinal de atenção e os botões de
 *  decisão, e um recorte de duas linhas aplicado nela contaria esses pedaços como
 *  texto — o valor perderia linha para um botão. O recorte é do valor.
 *
 *  `-webkit-line-clamp` É O QUE CORTA NA SEGUNDA LINHA com reticências. O
 *  `maxHeight` ao lado dele é a rede: onde o clamp não valer, o corte ainda acontece
 *  na altura certa, sem vazar para cima da linha de baixo. */
const RECORTE = {
  quebra: {
    display: '-webkit-box' as const,
    WebkitLineClamp: LINHAS_DE_TEXTO,
    WebkitBoxOrient: 'vertical' as const,
    whiteSpace: 'normal' as const,
    overflow: 'hidden',
    maxHeight: `calc(${LINHAS_DE_TEXTO} * 1.35em)`,
    lineHeight: 1.35,
  },
  linhaUnica: {
    display: 'block' as const,
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis' as const,
  },
};

/** O campo de edição, que ocupa a célula sem mudá-la de tamanho.
 *
 *  `height: 100%` com `box-sizing: border-box` é o par que faz a borda do campo caber
 *  DENTRO da altura da célula. Sem o `box-sizing`, a borda somaria dois pixels e a
 *  linha inteira desceria. */
const CAMPO = {
  //: `display: block` COM `width: 100%`, e não um campo inline: era aqui o defeito que
  //: o dono do produto achou usando. Um campo inline compartilha a linha com o sinal de
  //: atenção, e numa coluna estreita — a UF tem 76px — o sinal empurra o campo para
  //: fora do `overflow: hidden` da célula. Ele clicava em editar e não achava o campo
  //: da Data nem o da UF: as duas colunas estreitas E marcadas.
  display: 'block' as const,
  width: '100%',
  height: '100%',
  boxSizing: 'border-box' as const,
  margin: 0,
  padding: '0 6px',
  border: '1px solid var(--azul-mar)',
  borderRadius: 'var(--r-btn)',
  background: 'var(--branco)',
  color: 'var(--cinza-4)',
  font: 'inherit',
  fontSize: 12,
};

/** A primeira coluna congelada: a grade rola para os lados, e sem isto a pessoa
 *  perde de vista de qual linha da planilha ela está falando. */
const CONGELADA = {
  position: 'sticky' as const,
  left: 0,
  zIndex: 2,
  background: 'var(--branco)',
};

/** O fundo da célula com problema. OS TOKENS DO PRODUTO — e isto era um defeito meu:
 *  eu havia escrito `--erro-fundo` e `--atencao-fundo`, que não existem no sistema, e
 *  as células vinham caindo nos hex que eu inventei no fallback, fora da paleta. */
const FUNDO_DA_CELULA: Record<string, string | undefined> = {
  trava: 'var(--erro-bg)',
  aviso: 'var(--atencao-bg)',
};

/** Como o CAMPO DE EDIÇÃO mostra o estado da célula que ele está consertando.
 *
 *  ACHADO DA REVISÃO: eu tirei o sinal `!` da célula em edição — ele empurrava o campo
 *  para fora das colunas estreitas —, e com isso o estado passou a ser transmitido só
 *  pelo fundo colorido, que é justamente o que o sinal existia para não ser.
 *
 *  A BORDA MAIS GROSSA É A PISTA QUE NÃO DEPENDE DE COR: dois pixels contra um, visível
 *  em tons de cinza e em qualquer daltonismo. O canal principal, porém, é o
 *  `aria-invalid` no campo — um campo inválido se anuncia ao ser focado, que é o momento
 *  exato em que a pessoa precisa saber. */
const ANUNCIO_DO_CAMPO: Record<string, { borderWidth: number; borderColor: string }> = {
  trava: { borderWidth: 2, borderColor: 'var(--erro-fg)' },
  aviso: { borderWidth: 2, borderColor: 'var(--atencao-fg)' },
};

/** O MARCADOR DA CÉLULA: uma forma e um nome, além da cor.
 *
 *  ACHADO DA REVISÃO DE UI/UX, severidade alta: informação não pode ser transmitida
 *  por cor sozinha. A grade pintava a célula e mais nada — quem não distingue vermelho
 *  de amarelo via 500 linhas uniformes, sem pista de onde mexer.
 *
 *  DUAS FORMAS DIFERENTES, e não a mesma em duas cores: `!` é "está errado, conserte",
 *  `?` é "confira, talvez esteja certo". O nome vai no `aria-label`, que é o que quem
 *  ouve a tela recebe. */
const MARCADOR: Record<string, { sinal: string; nome: string; cor: string }> = {
  trava: { sinal: '!', nome: 'Precisa de atenção', cor: 'var(--erro-fg)' },
  aviso: { sinal: '?', nome: 'Confira este valor', cor: 'var(--atencao-fg)' },
};

export function ConferirImportacao({ id, aoConfirmar, aoFechar }: Props) {
  const [importacao, setImportacao] = useState<Importacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  //: ABRE MOSTRANDO A PLANILHA INTEIRA, e não filtrada nas pendências.
  //:
  //: Quem acabou de subir 54 agendas quer ver as 54: a primeira pergunta dela é
  //: "chegou tudo?", e uma lista filtrada não responde isso — ela precisaria pedir
  //: para ver o que ela mesma acabou de mandar. A COR é o que aponta o que precisa de
  //: atenção, e ela funciona melhor tendo o resto para contrastar.
  //:
  //: O filtro continua como OPÇÃO, porque 500 linhas com três pendências no fim são
  //: um caso real — mas quem decide é ela, não a tela.
  const [soPendentes, setSoPendentes] = useState(false);
  //: A LINHA EM EDIÇÃO, uma de cada vez. Duas linhas abertas ao mesmo tempo
  //: convidariam a pessoa a preencher uma e salvar a outra sem perceber.
  const [editando, setEditando] = useState<number | null>(null);
  const [rascunho, setRascunho] = useState<Record<string, string>>({});
  //: Quantas linhas estão montadas. Ver `LINHAS_POR_BLOCO`.
  const [montadas, setMontadas] = useState(LINHAS_POR_BLOCO);

  //: A MEDIDA DE CADA COLUNA, PELO CONTEÚDO DAQUELE ARQUIVO. Uma vez por carga e não
  //: por render: são até 500 linhas por 58 colunas para percorrer, e refazer isso a cada
  //: tecla digitada na edição travaria a digitação.
  const medidas = useMemo<Map<string, Medida>>(() => {
    if (!importacao) return new Map();
    return new Map(
      importacao.colunas.map(({ nome, tipo }) => [
        nome,
        medidaPeloConteudo(
          tipo,
          importacao.linhas.map((linha) => {
            const valor = linha.dados_brutos[nome];
            return valor === null || valor === undefined ? '' : String(valor);
          }),
          nome,
        ),
      ]),
    );
  }, [importacao]);

  const carregar = useCallback(async () => {
    try {
      setImportacao(await obterImportacao(id));
      setErro(null);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não consegui abrir a conferência.');
    }
  }, [id]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const agir = async (gesto: () => Promise<void>) => {
    setOcupado(true);
    setErro(null);
    try {
      await gesto();
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não consegui completar a ação.');
    } finally {
      setOcupado(false);
    }
  };

  const abrirEdicao = (linha: LinhaDaImportacao, colunas: ColunaDaImportacao[]) => {
    setEditando(linha.id);
    //: O RASCUNHO COMEÇA COM O QUE ESTÁ NA CÉLULA, e não vazio: a pessoa clicou em
    //: editar para CORRIGIR um valor, e um campo vazio a obrigaria a redigitar o que
    //: já estava certo.
    //:
    //: A DATA ENTRA EM PORTUGUÊS. O servidor a guarda em ISO, e abrir a edição com
    //: `2026-09-30` num campo cujo exemplo é `dd/mm/aaaa` faria a pessoa apagar tudo
    //: para digitar de novo no formato certo.
    const inicial: Record<string, string> = {};
    for (const { nome } of colunas) {
      const valor = linha.dados_brutos[nome];
      inicial[`${linha.id}|${nome}`] =
        valor === null || valor === undefined ? '' : paraTelaBr(String(valor));
    }
    setRascunho((atual) => ({ ...atual, ...inicial }));
  };

  const fecharEdicao = () => setEditando(null);

  const salvarLinha = (linha: LinhaDaImportacao, colunas: ColunaDaImportacao[]) => {
    const celulas: Record<string, string> = {};
    for (const { nome } of colunas) {
      const escrito = rascunho[`${linha.id}|${nome}`] ?? '';
      const antes = linha.dados_brutos[nome];
      //: COMPARA NO FORMATO DA TELA, senão toda data viajaria como alteração: o campo
      //: mostra `30/09/2026` e o servidor guardou `2026-09-30`, e uma comparação crua
      //: marcaria "editado aqui" numa célula que a pessoa só olhou.
      const comoEstava =
        antes === null || antes === undefined ? '' : paraTelaBr(String(antes));
      //: SÓ O QUE MUDOU vai para o servidor: mandar a linha inteira marcaria como
      //: "editado na conferência" toda célula que a pessoa nem tocou.
      if (escrito !== comoEstava) celulas[nome] = escrito;
    }
    if (Object.keys(celulas).length === 0) {
      fecharEdicao();
      return;
    }
    void agir(async () => {
      setImportacao(await corrigirLinhaDaImportacao(id, linha.id, celulas));
      fecharEdicao();
    });
  };

  const excluirLinha = (linha: LinhaDaImportacao, excluir: boolean) =>
    void agir(async () => {
      setImportacao(await excluirLinhaDaImportacao(id, linha.id, excluir));
      if (editando === linha.id) fecharEdicao();
    });

  const decidir = (campo: string, valor: string, decisao: string, alvo?: string) =>
    void agir(async () => {
      setImportacao(await resolverDivergencia(id, { campo, valor, decisao, alvo }));
    });

  const moldura = (conteudo: ReactNode, rodape?: ReactNode) => (
    <Modal
      titulo={importacao?.arquivo_nome ?? 'Confira a planilha'}
      subtitulo="Nada foi criado ainda. Confira as linhas e suba quando estiver certo."
      aoFechar={aoFechar ?? (() => {})}
      largura={1240}
      rodape={rodape}
    >
      {conteudo}
    </Modal>
  );

  if (erro && !importacao) return moldura(<FaixaDeErro mensagem={erro} />);
  if (!importacao) return moldura(<Vazio mensagem="Abrindo a conferência…" />);

  const fechada = importacao.situacao !== 'aguardando_conferencia';
  const grupos = porUrgencia(importacao.grupos);
  const cores = resumoDeCores(importacao.linhas);
  const daPlanilha = importacao.linhas.filter((linha) => linha.aba === 'Agendas');
  const aCriar = daPlanilha.filter((linha) => linha.decisao !== 'descartada').length;
  const excluidas = daPlanilha.length - aCriar;
  const candidatas = daPlanilha.filter(
    (linha) => !soPendentes || linhaTemPendencia(linha) || linha.decisao === 'descartada',
  );
  const visiveis = candidatas.slice(0, montadas);
  const faltamMontar = candidatas.length - visiveis.length;

  //: O PRÓXIMO BLOCO ENTRA AO CHEGAR PERTO DO FIM. Sem isto, a pessoa rolaria até o
  //: fim de 80 linhas e concluiria que o arquivo tem 80.
  const aoRolar = (evento: React.UIEvent<HTMLDivElement>) => {
    if (faltamMontar <= 0) return;
    const { scrollTop, clientHeight, scrollHeight } = evento.currentTarget;
    if (scrollHeight - (scrollTop + clientHeight) < MARGEM_DE_ROLAGEM) {
      setMontadas((quantas) => quantas + LINHAS_POR_BLOCO);
    }
  };
  //: As mensagens distintas do que trava, com em quantas linhas cada uma aparece.
  const porMensagem = new Map<string, number>();
  for (const linha of daPlanilha) {
    if (linha.decisao === 'descartada') continue;
    for (const divergencia of linha.divergencias) {
      if (!divergencia.trava) continue;
      porMensagem.set(divergencia.mensagem, (porMensagem.get(divergencia.mensagem) ?? 0) + 1);
    }
  }
  const mensagens = [...porMensagem].map(([texto, linhas]) => ({ texto, linhas }));

  const rodape = fechada ? (
    <span className="etiqueta">{importacao.situacao}</span>
  ) : (
    <div className="linha linha--entre">
      <Botao
        variante="secundario"
        desabilitado={ocupado}
        aoClicar={() => void agir(async () => setImportacao(await cancelarImportacao(id)))}
      >
        Cancelar a importação
      </Botao>
      {/* A FRASE DO BOTÃO É A PRESTAÇÃO DE CONTAS que o bloco recolhido dava: ela
          diz quantas agendas entram, e é a última coisa que a pessoa lê antes de
          decidir. "Subir" é a palavra que o dono usa para este gesto. */}
      <Botao
        desabilitado={ocupado || importacao.pendencias > 0 || aCriar === 0}
        aoClicar={() =>
          void agir(async () => {
            const feito = await confirmarImportacao(id);
            aoConfirmar?.(feito.criadas);
          })
        }
      >
        {importacao.pendencias > 0
          ? `Resolva ${importacao.pendencias} ${
              importacao.pendencias === 1 ? 'linha' : 'linhas'
            } para subir`
          : `Subir ${aCriar} ${aCriar === 1 ? 'agenda' : 'agendas'}`}
      </Botao>
    </div>
  );

  return moldura(
    <div className="pilha pilha--curta">
      {erro ? <FaixaDeErro mensagem={erro} /> : null}

      {/* O QUE FALTA, EM TEXTO E FORA DO HOVER.
          Achado da revisão de UI/UX: a mensagem morava só no `title` da célula, que é
          hover — quem usa teclado ou toque nunca a alcançava.

          UMA VEZ CADA, com a conta de linhas: "Falta Data" repetido 500 vezes é a
          parede de texto que a crítica de espaço desperdiçado queria evitar. São
          poucas mensagens distintas mesmo num arquivo grande, porque é o mesmo
          agrupamento que o servidor já faz. */}
      {mensagens.length > 0 ? (
        <ul className="pilha pilha--curta" style={{ margin: 0, paddingLeft: 18 }}>
          {mensagens.map(({ texto, linhas }) => (
            <li key={texto} className="texto--secundario">
              {texto}
              {linhas > 1 ? ` (${linhas} linhas)` : null}
            </li>
          ))}
        </ul>
      ) : null}

      {/* O CABEÇALHO EM UMA LINHA: contar CÉLULAS e não linhas, porque uma linha com
          três buracos dá três coisas a preencher. */}
      <div className="linha linha--entre">
        <p className="texto--secundario">
          {aCriar} {aCriar === 1 ? 'agenda' : 'agendas'}
          {cores.trava > 0
            ? ` · ${cores.trava} ${cores.trava === 1 ? 'célula' : 'células'} a preencher`
            : ' · nada a preencher'}
          {cores.aviso > 0 ? ` · ${cores.aviso} com aviso` : ''}
          {excluidas > 0 ? ` · ${excluidas} excluída${excluidas === 1 ? '' : 's'}` : ''}
          {/* A CONTRAPARTIDA HONESTA de montar por blocos: sem isto, quem subiu 500
              agendas e vê 80 linhas conclui que o arquivo perdeu 420. */}
          {faltamMontar > 0
            ? ` · mostrando ${visiveis.length} de ${candidatas.length} linhas (role para ver o resto)`
            : ''}
        </p>
        <Botao variante="secundario" aoClicar={() => setSoPendentes(!soPendentes)}>
          {soPendentes ? 'Ver todas as linhas' : 'Só as que precisam de você'}
        </Botao>
      </div>

      <div
        className="rolagem-interna"
        style={{ maxHeight: '62vh', overflowX: 'auto' }}
        onScroll={aoRolar}
      >
        <table
          style={{
            //: SEPARADO E NÃO COLAPSADO: é o que permite canto arredondado por
            //: célula. Com as bordas colapsadas, duas células vizinhas dividem a
            //: mesma linha e o raio não tem onde existir.
            borderCollapse: 'separate',
            borderSpacing: VAO,
            fontSize: 12,
            // FIXO, e é o que faz a largura por tipo valer: em `auto` o navegador
            // redistribui tudo pelo conteúdo, e um relato comprido numa linha
            // esticaria a coluna em TODAS as outras.
            tableLayout: 'fixed',
            // A LARGURA DECLARADA, e sem ela nada do resto vale: `fixed` sem `width`
            // faz a tabela assumir a largura do container e REDUZIR proporcionalmente
            // todas as colunas para caber nela. Cinquenta e nove colunas pedindo onze
            // mil pixels dentro de 1200 ficam com um vigésimo cada — a Data de 120px
            // vira 13px, e foi exatamente isto que o dono do produto viu ao tentar ler
            // a data e a UF enquanto editava. Declarada, a tabela transborda e a
            // rolagem horizontal (que já existe) mostra cada coluna no seu tamanho.
            width: larguraDaGrade(
              importacao.colunas.map(
                ({ nome, tipo }) => medidas.get(nome) ?? medidaDaColuna(tipo),
              ),
              [LARGURA_DO_NUMERO, LARGURA_DAS_ACOES],
            ),
          }}
        >
          {/* A LARGURA DE CADA COLUNA VEM DO TIPO DO DADO E DO CONTEÚDO DELA: o tipo
              dá o piso e o teto, o conteúdo decide entre os dois. Ver `medidas.ts`. */}
          <colgroup>
            <col style={{ width: LARGURA_DO_NUMERO }} />
            {importacao.colunas.map((coluna) => (
              <col
                key={coluna.nome}
                style={{
                  width: (medidas.get(coluna.nome) ?? medidaDaColuna(coluna.tipo)).largura,
                }}
              />
            ))}
            <col style={{ width: LARGURA_DAS_ACOES }} />
          </colgroup>
          <thead>
            <tr>
              <th style={{ ...CABECALHO, ...CONGELADA, top: 0 }}>Linha</th>
              {importacao.colunas.map((coluna) => (
                <th
                  key={coluna.nome}
                  title={coluna.nome}
                  style={{
                    ...CABECALHO,
                    textAlign: medidaDaColuna(coluna.tipo).alinhamento,
                  }}
                >
                  {coluna.nome}
                </th>
              ))}
              <th style={CABECALHO}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.map((linha) => {
              const excluida = linha.decisao === 'descartada';
              const emEdicao = editando === linha.id;
              return (
                <tr
                  key={linha.id}
                  data-linha={linha.linha_origem}
                  style={{ opacity: excluida ? 0.45 : undefined }}
                >
                  {/* A PENDÊNCIA MARCA A PEÇA DO NÚMERO, e não um contorno em
                      volta da linha: com as peças separadas, um contorno na linha
                      cortaria os vãos e brigaria com os cantos. Aqui ele vira uma
                      faixa na primeira peça — que é justamente a que fica congelada
                      quando a grade rola para os lados, então continua visível. */}
                  <td
                    style={{
                      ...CELULA,
                      ...CONGELADA,
                      textAlign: 'center',
                      fontWeight: 600,
                      borderLeft:
                        !excluida && linhaTemPendencia(linha)
                          ? '4px solid var(--erro-fg)'
                          : REGUA,
                    }}
                  >
                    {linha.linha_origem}
                  </td>
                  {importacao.colunas.map(({ nome: coluna, tipo }) => {
                    const cor = corDaCelula(linha, coluna);
                    const valor = linha.dados_brutos[coluna];
                    const decisao = decisaoDaCelula(linha, coluna, grupos);
                    const medida = medidas.get(coluna) ?? medidaDaColuna(tipo);
                    return (
                      <td
                        key={coluna}
                        title={[
                          ...linha.divergencias
                            .filter((d) => d.coluna === coluna)
                            .map((d) => d.mensagem),
                          ...(coluna in linha.herdado ? ['Repetido da linha de cima.'] : []),
                          String(valor ?? ''),
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                        style={{
                          ...CELULA,
                          textAlign: medida.alinhamento,
                          background: excluida
                            ? undefined
                            : (FUNDO_DA_CELULA[cor ?? ''] ?? 'var(--branco)'),
                        }}
                      >
                        {/* O SINAL SAI QUANDO A LINHA ENTRA EM EDIÇÃO, e isto era o
                            defeito: ele divide a linha com o campo, e numa coluna
                            estreita e marcada — a Data e a UF de uma agenda sem data
                            nem UF — empurrava o campo para fora do `overflow: hidden`
                            da célula. A pessoa clicava em editar e não achava o campo.

                            O FUNDO CONTINUA VERMELHO enquanto ela edita, então a
                            informação não se perde: ela está justamente consertando
                            aquela célula, e o campo aberto ali já diz o que fazer. */}
                        {cor && !excluida && !emEdicao ? (
                          <span
                            aria-label={MARCADOR[cor].nome}
                            title={MARCADOR[cor].nome}
                            style={{
                              display: 'inline-block',
                              marginRight: 4,
                              fontWeight: 700,
                              color: MARCADOR[cor].cor,
                            }}
                          >
                            {MARCADOR[cor].sinal}
                          </span>
                        ) : null}
                        {emEdicao ? (
                          /* O CAMPO CABE NA CÉLULA, e isto era um pedido: editar não
                             pode abrir espaço nem empurrar a tabela. Com a largura
                             fixa da coluna e `width: 100%`, a linha em edição ocupa
                             exatamente o mesmo lugar que ocupava antes — a pessoa
                             digita onde estava lendo.

                             O CAMPO ABERTO GANHA VÁRIAS LINHAS, porque é onde mora o
                             parágrafo: um campo de uma linha obrigaria a pessoa a
                             percorrer o relato com a seta do teclado para conferi-lo.
                             A altura é a mesma da célula, e o resto rola dentro. */
                          medida.quebra ? (
                            <textarea
                              /* DIZ QUE ESTÁ INVÁLIDO, e não só pela cor: era o achado
                                 da revisão sobre eu ter tirado o sinal `!` da célula em
                                 edição. `aria-invalid` é o canal que o leitor de tela lê
                                 ao entrar no campo, e é melhor que o sinal — ele fala no
                                 momento em que a pessoa vai digitar. */
                              aria-invalid={cor === 'trava' ? true : undefined}
                              style={{
                                ...CAMPO,
                                ...(cor ? ANUNCIO_DO_CAMPO[cor] : {}),
                                padding: '2px 6px',
                                lineHeight: 1.35,
                                resize: 'none' as const,
                              }}
                              value={rascunho[`${linha.id}|${coluna}`] ?? ''}
                              onChange={(evento) =>
                                setRascunho((atual) => ({
                                  ...atual,
                                  [`${linha.id}|${coluna}`]: evento.target.value,
                                }))
                              }
                            />
                          ) : (
                            <input
                              /* Ver o `aria-invalid` do campo de várias linhas: mesma
                                 razão, e é a célula estreita e marcada — a Data, a UF —
                                 que mais precisa dele. */
                              aria-invalid={cor === 'trava' ? true : undefined}
                              style={{
                                ...CAMPO,
                                ...(cor ? ANUNCIO_DO_CAMPO[cor] : {}),
                                textAlign: medida.alinhamento,
                              }}
                              value={rascunho[`${linha.id}|${coluna}`] ?? ''}
                              placeholder={tipo === 'data' ? 'dd/mm/aaaa' : ''}
                              /* A DATA SE DIGITA SÓ COM NÚMEROS e a tela põe as barras
                                 — são 54 datas num dia de evento, e cada barra é uma
                                 tecla a mais. `inputMode` traz o teclado numérico no
                                 celular, e o limite de dez impede a data de onze
                                 dígitos que ninguém consegue ler. Ver
                                 `dataNaTela.ts`. */
                              inputMode={tipo === 'data' ? 'numeric' : undefined}
                              maxLength={tipo === 'data' ? 10 : undefined}
                              onChange={(evento) =>
                                setRascunho((atual) => ({
                                  ...atual,
                                  [`${linha.id}|${coluna}`]:
                                    tipo === 'data'
                                      ? mascaraDeData(evento.target.value)
                                      : evento.target.value,
                                }))
                              }
                            />
                          )
                        ) : (
                          <>
                            {/* O VALOR VAI DENTRO DO RECORTE DO TIPO DELE: o campo
                                aberto quebra em duas linhas, o resto corta com
                                reticências numa linha só. */}
                            <span
                              style={medida.quebra ? RECORTE.quebra : RECORTE.linhaUnica}
                            >
                              {valor === null || valor === undefined || valor === ''
                                ? '—'
                                : paraTelaBr(String(valor))}
                            </span>
                            {coluna in linha.corrigido ? (
                              <span className="etiqueta"> editado aqui</span>
                            ) : null}
                          </>
                        )}

                        {/* A DECISÃO NA CÉLULA, e o número que justifica o clique.
                            É o que substituiu o bloco de pendências agrupadas: sem
                            ele, consertar um órgão errado em doze linhas seriam doze
                            consertos iguais. */}
                        {/* A DECISÃO SAI ENQUANTO ELA DIGITA, e era o outro achado da
                            revisão: a célula tem altura fixa e corta o que não cabe, então
                            os botões ficavam recortados atrás do campo — invisíveis e
                            ainda alcançáveis pelo Tab.

                            SÃO DOIS CAMINHOS PARA O MESMO CONSERTO, e um de cada vez: ou
                            ela aponta para um cadastro que já existe, ou ela digita o
                            valor certo. Oferecer os dois na mesma célula apertada não dá
                            escolha, dá confusão — e o botão Cancelar devolve o outro
                            caminho num clique. */}
                        {decisao && !excluida && !fechada && !emEdicao ? (
                          <div className="pilha pilha--curta" style={{ marginTop: 4 }}>
                            {decisao.outrasLinhas > 0 ? (
                              <span className="texto--secundario">
                                e em {decisao.outrasLinhas}{' '}
                                {decisao.outrasLinhas === 1 ? 'outra linha' : 'outras linhas'}
                              </span>
                            ) : null}
                            <div className="linha linha--quebra">
                              {decisao.grupo.sugestoes.map((sugestao) => (
                                <Botao
                                  key={sugestao.alvo}
                                  variante="secundario"
                                  desabilitado={ocupado}
                                  aoClicar={() =>
                                    decidir(
                                      decisao.grupo.campo,
                                      decisao.grupo.valor,
                                      'apontar',
                                      sugestao.alvo,
                                    )
                                  }
                                >
                                  É “{sugestao.nome}”
                                </Botao>
                              ))}
                              {decisao.grupo.pode_criar ? (
                                <Botao
                                  variante="secundario"
                                  desabilitado={ocupado}
                                  aoClicar={() =>
                                    decidir(decisao.grupo.campo, decisao.grupo.valor, 'criar')
                                  }
                                >
                                  Cadastrar como novo
                                </Botao>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                      </td>
                    );
                  })}

                  {/* 24 CSS px é o mínimo da WCAG 2.2 AA para alvo de ponteiro, e
                      numa linha de 30px os botões passavam por baixo disso. A célula
                      de ações é a única que não segue a altura fixa: ela cresce para
                      caber o alvo, e é ela que define a altura da linha quando cresce. */}
                  <td style={{ ...CELULA, height: 'auto', padding: 3, minWidth: 0 }}>
                    {fechada ? null : excluida ? (
                      <Botao
                        variante="secundario"
                        desabilitado={ocupado}
                        aoClicar={() => excluirLinha(linha, false)}
                      >
                        Restaurar
                      </Botao>
                    ) : emEdicao ? (
                      <div className="linha">
                        <Botao
                          desabilitado={ocupado}
                          aoClicar={() => salvarLinha(linha, importacao.colunas)}
                        >
                          Salvar
                        </Botao>
                        <Botao variante="secundario" aoClicar={fecharEdicao}>
                          Cancelar
                        </Botao>
                      </div>
                    ) : (
                      <div className="linha">
                        <Botao
                          variante="secundario"
                          desabilitado={ocupado}
                          aoClicar={() => abrirEdicao(linha, importacao.colunas)}
                        >
                          Editar
                        </Botao>
                        <Botao
                          variante="secundario"
                          desabilitado={ocupado}
                          aoClicar={() => excluirLinha(linha, true)}
                        >
                          Excluir
                        </Botao>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {visiveis.length === 0 ? (
          <Vazio mensagem="Nenhuma linha precisa de você. Pode subir." />
        ) : null}
      </div>
    </div>,
    rodape,
  );
}
