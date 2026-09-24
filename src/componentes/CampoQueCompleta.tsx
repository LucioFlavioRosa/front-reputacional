/** Um campo que se digita e se completa sozinho, no lugar de um `select`.
 *
 *  POR QUE TROCAR. Quem preenche este formulário vem da planilha, e na planilha
 *  se digita: "fol" e o resto aparece. Um `select` com 99 instituições obriga a
 *  abrir a lista e rolar — e o teclado do navegador só salta pela PRIMEIRA
 *  letra, então achar "Folha de S.Paulo" entre trinta nomes com F é rolagem
 *  mesmo.
 *
 *  MAS NÃO É TEXTO LIVRE. O valor gravado sai sempre da lista: digitar serve
 *  para FILTRAR, não para inventar. Sair do campo com texto que não casa com
 *  nada devolve o rótulo do que estava escolhido — nunca grava a metade que a
 *  pessoa digitou. É o que separa "planilha com validação" de "planilha".
 *
 *  BUSCA SEM ACENTO E EM QUALQUER POSIÇÃO. "sao paulo" acha "São Paulo", e
 *  "globo" acha "O Globo" — casar só pelo começo faria a busca falhar
 *  justamente nos nomes que começam com artigo.
 *
 *  O TECLADO FAZ TUDO: setas navegam, Enter escolhe, Esc fecha e devolve o que
 *  estava. Quem preenche cinquenta agendas por semana não tira a mão do
 *  teclado, e um campo que exige o mouse para confirmar custa mais do que o
 *  `select` que ele substituiu.
 */

import { useEffect, useId, useMemo, useRef, useState } from 'react';

import { Campo, estiloDeEntrada } from '@/componentes/basicos';
import { escolhaAoFechar, filtrar, type Opcao } from '@/dominio/completar';

export type { Opcao };

export function CampoQueCompleta({
  rotulo,
  opcoes,
  valor,
  aoEscolher,
  vazio = 'Não informado',
  obrigatorio = false,
  dica,
  ajuda,
  placeholder,
  ariaLabel,
}: {
  rotulo?: string;
  opcoes: Opcao[];
  /** O valor escolhido, ou string vazia. */
  valor: string;
  aoEscolher: (valor: string) => void;
  /** O rótulo da opção que limpa o campo. Some quando `obrigatorio`. */
  vazio?: string;
  obrigatorio?: boolean;
  dica?: string;
  /** Explicação num "?" ao lado do rótulo; ver `Campo`. */
  ajuda?: string;
  placeholder?: string;
  /** Quando o campo não tem rótulo visível — dentro de uma tabela, por exemplo. */
  ariaLabel?: string;
}) {
  const id = useId();
  const [aberto, definirAberto] = useState(false);
  const [busca, definirBusca] = useState('');
  const [emFoco, definirEmFoco] = useState(0);
  //: A PESSOA MEXEU NO TEXTO desde que a lista abriu? É o que separa "apaguei
  //: o campo" de "abri e saí sem tocar em nada" — dois gestos que deixam a
  //: busca vazia e pedem coisas opostas.
  const [digitou, definirDigitou] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  const escolhida = opcoes.find((o) => o.valor === valor);
  //: O QUE O CAMPO MOSTRA: o que se digita enquanto a lista está aberta; o
  //: rótulo do escolhido quando está fechada. Guardar os dois no mesmo estado
  //: faria o texto digitado sobreviver ao fechamento e mentir sobre o valor.
  const texto = aberto ? busca : (escolhida?.rotulo ?? '');

  const lista = useMemo(() => {
    const comVazio = obrigatorio
      ? opcoes
      : [{ valor: '', rotulo: vazio } as Opcao, ...opcoes];
    return aberto ? filtrar(comVazio, busca) : comVazio;
  }, [opcoes, busca, aberto, obrigatorio, vazio]);

  const escolher = (opcao: Opcao) => {
    aoEscolher(opcao.valor);
    definirAberto(false);
    definirBusca('');
    definirDigitou(false);
  };

  /** Fecha a lista commitando o que a pessoa digitou, quando é inequívoco, e
   *  descartando o texto quando não é. A regra e o porquê estão em
   *  `escolhaAoFechar`. */
  const fechar = () => {
    const escolha = escolhaAoFechar(opcoes, busca, { digitou, obrigatorio });
    if (escolha) {
      escolher(escolha);
      return;
    }
    definirAberto(false);
    definirBusca('');
    definirDigitou(false);
  };

  // O OUVINTE PRECISA DO `fechar` MAIS NOVO — o que enxerga o texto já digitado
  // —, mas `fechar` nasce a cada render. Guardá-lo numa ref deixa o ouvinte ser
  // assinado UMA VEZ, enquanto a lista está aberta, e ainda assim rodar sempre
  // a versão atual.
  const fecharAtual = useRef(fechar);
  useEffect(() => {
    fecharAtual.current = fechar;
  });

  useEffect(() => {
    if (!aberto) return;
    // FECHA AO CLICAR FORA, e não só ao perder o foco: o clique numa sugestão
    // acontece depois do `blur`, e fechar no `blur` mataria a lista antes de o
    // clique chegar nela.
    const aoClicarFora = (evento: MouseEvent) => {
      if (!caixa.current?.contains(evento.target as Node)) fecharAtual.current();
    };
    document.addEventListener('mousedown', aoClicarFora);
    return () => document.removeEventListener('mousedown', aoClicarFora);
  }, [aberto]);

  const abrir = () => {
    definirAberto(true);
    definirBusca('');
    definirDigitou(false);
    definirEmFoco(Math.max(0, lista.findIndex((o) => o.valor === valor)));
  };

  const campo = (
    <div ref={caixa} style={{ position: 'relative' }}>
      <input
        role="combobox"
        aria-expanded={aberto}
        aria-controls={`${id}-lista`}
        aria-autocomplete="list"
        aria-label={ariaLabel}
        autoComplete="off"
        style={estiloDeEntrada}
        value={texto}
        placeholder={placeholder ?? (obrigatorio ? 'Digite para buscar…' : vazio)}
        onFocus={abrir}
        onChange={(evento) => {
          if (!aberto) definirAberto(true);
          definirBusca(evento.target.value);
          definirDigitou(true);
          definirEmFoco(0);
        }}
        onKeyDown={(evento) => {
          if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
            evento.preventDefault();
            if (!aberto) return abrir();
            const passo = evento.key === 'ArrowDown' ? 1 : -1;
            definirEmFoco((i) => (i + passo + lista.length) % Math.max(1, lista.length));
            return;
          }
          if (evento.key === 'Enter' && aberto) {
            evento.preventDefault();
            const alvo = lista[emFoco];
            if (alvo) escolher(alvo);
            return;
          }
          if (evento.key === 'Escape' && aberto) {
            evento.preventDefault();
            // DEVOLVE O QUE ESTAVA, e não commita como o `fechar` faz: Escape
            // num campo de planilha DESFAZ a digitação. É a saída de quem
            // começou a digitar e mudou de ideia.
            definirAberto(false);
            definirBusca('');
            definirDigitou(false);
          }
          if (evento.key === 'Tab' && aberto) {
            // TAB CONFIRMA, como na planilha. Sem isto, quem digita o nome
            // inteiro e tabula para o campo seguinte deixa para trás o valor
            // anterior — com a tela tendo mostrado o novo.
            fechar();
          }
        }}
      />

      {aberto ? (
        <ul
          id={`${id}-lista`}
          role="listbox"
          style={{
            position: 'absolute',
            zIndex: 30,
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            margin: 0,
            padding: 4,
            listStyle: 'none',
            maxHeight: 260,
            overflowY: 'auto',
            background: 'var(--branco)',
            border: '1px solid var(--borda)',
            borderRadius: 'var(--r-card-int)',
            boxShadow: 'var(--sh-tooltip)',
          }}
        >
          {!lista.length ? (
            <li style={{ padding: '9px 10px', fontSize: 13, color: 'var(--cinza-2)' }}>
              Nada com esse termo.
            </li>
          ) : (
            lista.map((opcao, indice) => (
              <li
                key={opcao.valor || '(vazio)'}
                role="option"
                aria-selected={opcao.valor === valor}
                // `onMouseDown`, e não `onClick`: o clique só chega depois do
                // `blur` do input, e a lista já teria fechado.
                onMouseDown={(evento) => {
                  evento.preventDefault();
                  escolher(opcao);
                }}
                onMouseEnter={() => definirEmFoco(indice)}
                style={{
                  padding: '8px 10px',
                  borderRadius: 'var(--r-btn)',
                  cursor: 'pointer',
                  fontSize: 13,
                  background: indice === emFoco ? 'var(--bg-hover)' : 'transparent',
                  color: opcao.valor ? 'var(--cinza-4)' : 'var(--cinza-2)',
                  fontWeight: opcao.valor === valor ? 600 : 400,
                }}
              >
                {opcao.rotulo}
                {/* O DETALHE SÓ APARECE SE ACRESCENTAR ALGO. No dicionário de
                    UF o código e o nome são a mesma string, e a linha saía
                    "SPSP" — a repetição parece defeito, e é. */}
                {opcao.detalhe && opcao.detalhe !== opcao.rotulo ? (
                  <span
                    style={{
                      display: 'block',
                      fontSize: 12,
                      color: 'var(--cinza-2)',
                      marginTop: 2,
                    }}
                  >
                    {opcao.detalhe}
                  </span>
                ) : null}
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );

  if (!rotulo) return campo;
  return (
    <Campo rotulo={rotulo} obrigatorio={obrigatorio} dica={dica} ajuda={ajuda}>
      {campo}
    </Campo>
  );
}
