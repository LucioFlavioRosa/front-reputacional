/** O cartão "Onde está a causa": o mês cortado por cada dimensão que o explica,
 *  uma por aba.
 *
 *  É O DEGRAU QUE FALTAVA ENTRE A NOTA E O ITEM. A tela tinha o nível 1 (a nota
 *  e a evolução) e o nível 3 (a lista de menções), e no meio dois painéis — tema
 *  e concessionária. As outras dimensões que o pacote prioriza (subtema, perfil
 *  de quem fala, autor, UF) só existiam no seletor da barra de filtros, que
 *  serve a quem JÁ SABE o que procurar. Quem abre a lente porque a nota caiu não
 *  sabe: a pergunta é "onde está a causa", e ela se responde trocando o corte
 *  até uma barra pular.
 *
 *  UM CARTÃO COM ABAS, E NÃO SEIS CARTÕES. Seis painéis empilhados dariam uma
 *  tela de rolagem em que nada se compara: a leitura é "o mês inteiro, visto
 *  deste ângulo", e trocar de ângulo é trocar de aba, no mesmo lugar da tela.
 *
 *  A ORDEM E O CONJUNTO DAS ABAS VÊM DO SERVIDOR — ver `_onde_esta_a_causa` e
 *  `app/dominio/causa_da_lente` no back. É lá que mora por que a aba de tema vem
 *  antes da de autor, e por que uma dimensão que a fonte quase não classificou
 *  não entra. A tela não escolhe nem adivinha: desenha o que recebe.
 */

import { useState } from 'react';

import type { FiltroDaLente } from '@/api/cliente';
import { Abas } from '@/componentes/Abas';
import { Secao } from '@/componentes/basicos';
import { NotaDeFonte } from '@/componentes/Procedencia';
import type { Bloco } from '@/dominio/dossie';
import { comoNumero, comoTexto, rotuloNaFrase } from '@/dominio/dossie';
import { BarrasCemPorCento } from '@/graficos/PecasDoDossie';

export function OndeEstaACausa({
  abas,
  filtro,
  aoAprofundar,
}: {
  abas: Bloco[];
  filtro: FiltroDaLente;
  /** ABRE O APROFUNDAMENTO, e não aplica o filtro na tela — e esta é a correção
   *  que o dono do produto pediu: "ao clicar em um dado temos que abrir um modal
   *  com o deep diving, e não como é feito hoje". Filtrar a tela REFAZ o mês; o
   *  modal põe o pedaço ao lado dele. Ver `RecorteDaLente`. */
  aoAprofundar: (chave: string, valor: string) => void;
}) {
  // ABRE NA DIMENSÃO JÁ RECORTADA, e isto não é conveniência: quem chega por um
  // link com `?uf=RJ` vê o selo "recorte filtrado" no topo da tela, e um cartão
  // aberto na aba de tema não mostra onde o recorte foi aplicado.
  const recortada = abas.find((bloco) => bloco.recorta && filtro[asChave(bloco.recorta)]);
  const [ativa, definirAtiva] = useState<string>((recortada ?? abas[0])?.titulo ?? '');

  // CARTÃO VAZIO É PIOR QUE CARTÃO AUSENTE: a moldura sem conteúdo se lê como
  // dado que sumiu. Mercado e Institucional não vêm de menção, e o servidor
  // manda lista vazia para elas.
  if (!abas.length) return null;


  const bloco = abas.find((candidata) => candidata.titulo === ativa) ?? abas[0];
  const chave = bloco.recorta ? asChave(bloco.recorta) : undefined;
  const ativo = chave ? filtro[chave] : undefined;

  return (
    <Secao
      titulo="Onde está a causa"
      subtitulo="O mesmo mês por cada corte que o explica — clique numa barra para descer nela"
    >
      <Abas
        abas={abas.map((candidata) => ({ id: candidata.titulo, rotulo: candidata.titulo }))}
        ativa={bloco.titulo}
        aoTrocar={definirAtiva}
        rotulo="Corte da causa"
        prefixo="causa"
      />

      <div
        role="tabpanel"
        id={`painel-${bloco.titulo}`}
        aria-labelledby={`causa-${bloco.titulo}`}
        style={{ paddingTop: 16 }}
      >
        <BarrasCemPorCento
          itens={bloco.dados.map((linha) => ({
            rotulo: comoTexto(linha.rotulo),
            positivo: comoNumero(linha.positivo ?? 0),
            neutro: comoNumero(linha.neutro ?? 0),
            negativo: comoNumero(linha.negativo ?? 0),
          }))}
          legenda={bloco.legenda.length ? bloco.legenda : undefined}
          cores={bloco.cores.length ? bloco.cores : undefined}
          //: A ABA VAZIA DIZ POR QUÊ. A fileira de abas é a mesma em todo mês —
          //: decisão do dono do produto, depois de abrir junho pela Jornada e
          //: reparar que o tema não estava lá "como aparece nos demais meses". O
          //: preço é a aba sem dado, e ela só não é um quadro em branco porque a
          //: frase da ficha está logo abaixo.
          vazio={`Nenhuma menção deste mês traz ${rotuloNaFrase(bloco.titulo)}.`}
          //: MARCADO PELO RECORTE DA BARRA DE FILTROS, que continua existindo e
          //: continua filtrando a tela: o seletor serve a quem já sabe o que
          //: quer ver. A marca diz "esta linha é o recorte que está ativo lá em
          //: cima", e o clique aqui aprofunda — as duas coisas conversam.
          ativo={ativo}
          aoClicar={chave ? (rotulo) => aoAprofundar(chave, rotulo) : undefined}
        />
        <NotaDeFonte ficha={bloco.ficha} />
      </div>

    </Secao>
  );
}

/** A chave do recorte como o filtro a conhece.
 *
 *  O SERVIDOR MANDA A CHAVE DO PARÂMETRO (`tema`, `perfil_autor`) justamente
 *  para a tela não traduzir nada — os nomes do filtro são os mesmos de
 *  propósito. A conversão de tipo é só para o TypeScript, e fica numa função
 *  nomeada em vez de um `as` solto no meio do JSX. */
function asChave(recorta: string): keyof FiltroDaLente {
  return recorta as keyof FiltroDaLente;
}
