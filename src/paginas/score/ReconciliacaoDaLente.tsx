/** A lista de veículos vale para os meses JÁ ingeridos — e isto é onde se vê e
 *  se manda aplicar.
 *
 *  O PEDIDO DO DONO DO PRODUTO: "se eu dizer que uma instituição pertence a
 *  categoria de público como imprensa e esfera econômica e de negócios, todos
 *  seus registros devem ser movidos para a lente de mercado, atualizando tudo".
 *  E, por decisão dele em 19/10/2026, nos DOIS sentidos: desclassificar tira.
 *
 *  POR QUE NÃO É AUTOMÁTICO NO SALVAR. Aplicar reescreve o agregado de meses
 *  FECHADOS: o índice daqueles meses muda, e com ele o número que já foi citado
 *  em reunião. Um salvamento de cadastro que mexe na série histórica sem avisar
 *  é a coisa que esta tela inteira existe para não fazer. Então: a lista se
 *  mantém como sempre, e aqui aparece o que aquela mudança significa para trás,
 *  com os números, antes de qualquer escrita.
 *
 *  O PAINEL SÓ APARECE QUANDO HÁ DESVIO. Sem diferença entre o cadastro e a
 *  lente, não há nada a decidir — e um cartão dizendo "está tudo certo" seria
 *  mais uma linha para ler em toda abertura. É a mesma regra da fila de
 *  duplicados, que some quando chega a zero.
 *
 *  ACESSÓRIO, COMO A FILA DE DUPLICADOS: se a prévia falhar, a falha aparece
 *  aqui e a lista continua funcionando. A manutenção da lista não pode depender
 *  de uma leitura que é sobre outra coisa.
 */

import { useCallback, useEffect, useState } from 'react';

import {
  aplicarReconciliacao,
  previaDaReconciliacao,
  type Reconciliacao,
} from '@/api/cliente';
import { Botao, Cartao, FaixaDeErro } from '@/componentes/basicos';
import { numero } from '@/dominio/formato';

/** `2026-08-01` como `08/2026` — é mês, e o dia não diz nada aqui. */
function mesPorExtenso(iso: string): string {
  const [ano, mes] = iso.split('-');
  return `${mes}/${ano}`;
}

function mencoes(quantas: number): string {
  return quantas === 1 ? '1 menção' : `${numero(quantas)} menções`;
}

/** Os meses que serão reescritos.
 *
 *  QUEM DECIDE É O SERVIDOR, pelo campo `mudou`, e a tela NÃO recalcula por
 *  `antes !== depois`: um veículo que sai e outro que entra com a mesma
 *  contagem deixam o total igual e o conjunto diferente. Refazer a conta aqui
 *  seria a segunda definição de "este mês muda", livre para discordar da
 *  primeira. */
function mesesQueMudam(medida: Reconciliacao) {
  return medida.meses.filter((mes) => mes.mudou);
}

function temDesvio(medidas: Reconciliacao[]): boolean {
  return medidas.some((medida) => mesesQueMudam(medida).length > 0);
}

function Quadro({
  titulo,
  veiculos,
  cor,
}: {
  titulo: string;
  veiculos: Reconciliacao['entram'];
  cor: string;
}) {
  if (veiculos.length === 0) return null;
  return (
    <div style={{ minWidth: 220, flex: '1 1 220px' }}>
      <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 700, color: cor }}>
        {titulo}
      </p>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
        {veiculos.map((veiculo) => (
          <li key={veiculo.nome}>
            {veiculo.nome}
            <span style={{ color: 'var(--cinza-2)' }}>
              {` · ${mencoes(veiculo.mencoes)}`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ReconciliacaoDaLente() {
  const [medidas, definirMedidas] = useState<Reconciliacao[] | null>(null);
  const [erro, definirErro] = useState('');
  const [aplicando, definirAplicando] = useState(false);
  const [feito, definirFeito] = useState('');

  const carregar = useCallback(() => {
    previaDaReconciliacao()
      .then((lista) => {
        definirMedidas(lista);
        definirErro('');
      })
      .catch((falha: Error) => {
        definirMedidas([]);
        definirErro(falha.message);
      });
  }, []);

  useEffect(carregar, [carregar]);

  async function aplicar() {
    definirAplicando(true);
    definirErro('');
    try {
      const depois = await aplicarReconciliacao();
      //: O RESULTADO VEM DA RESPOSTA, e não do que a prévia tinha dito: entre
      //: ler a prévia e clicar, alguém pode ter mexido na lista. Repetir o
      //: número da prévia seria afirmar o que não foi medido.
      const quantos = depois.reduce(
        (soma, medida) =>
          soma + medida.meses.reduce((parcial, mes) => parcial + mes.depois, 0),
        0,
      );
      definirFeito(
        `Pronto: a lente Mercado passou a contar ${mencoes(quantos)} nos meses já ingeridos.`,
      );
      definirMedidas(depois);
    } catch (falha) {
      definirErro(
        falha instanceof Error ? falha.message : 'Não consegui aplicar.',
      );
    } finally {
      definirAplicando(false);
    }
  }

  //: NADA A DECIDIR, NADA NA TELA — nem enquanto carrega. O painel é sobre uma
  //: exceção (o cadastro e a lente discordarem), e um "Carregando…" em toda
  //: abertura faria a exceção parecer rotina.
  if (medidas === null) return null;
  if (erro) {
    return (
      <Cartao>
        <FaixaDeErro mensagem={erro} />
      </Cartao>
    );
  }
  if (feito && !temDesvio(medidas)) {
    return (
      <Cartao>
        <p style={{ margin: 0, fontSize: 13 }}>{feito}</p>
      </Cartao>
    );
  }
  if (!temDesvio(medidas)) return null;

  const total = medidas.reduce(
    (soma, medida) => soma + mesesQueMudam(medida).length,
    0,
  );

  return (
    <Cartao>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>
        A lente Mercado ainda não reflete esta lista
      </p>
      {/* O QUE O BOTÃO FAZ, ANTES DE ELE SER CLICADO. Aplicar reescreve meses
          fechados: o índice deles muda. Quem clica precisa saber disso e ver
          quais, senão o gesto é um salto no escuro — e a série histórica é o
          número que a diretoria cita. */}
      <p style={{ margin: '4px 0 12px', fontSize: 13, color: 'var(--cinza-3)' }}>
        A lista define a lente a partir da próxima subida de cada mês. Aplicar
        agora faz ela valer também para os meses já ingeridos — o que reescreve
        a nota desses meses, inclusive os fechados.
      </p>

      {medidas.filter((medida) => mesesQueMudam(medida).length > 0).map((medida) => (
        <div key={medida.fonte} style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <Quadro
              titulo="Passam a contar"
              veiculos={medida.entram}
              cor="var(--sucesso-fg)"
            />
            <Quadro
              titulo="Deixam de contar"
              veiculos={medida.saem}
              cor="var(--erro-fg)"
            />
          </div>
          <p
            data-testid="meses-que-mudam"
            style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--cinza-2)' }}
          >
            {mesesQueMudam(medida)
              .map(
                (mes) =>
                  `${mesPorExtenso(mes.mes)}: ${numero(mes.antes)} → ${numero(mes.depois)}`,
              )
              .join(' · ')}
          </p>
        </div>
      ))}

      <Botao
        variante="primario"
        desabilitado={aplicando}
        aoClicar={() => void aplicar()}
        titulo="Reescreve a nota dos meses listados acima. Não tem volta automática: desfazer é mexer na lista de novo e aplicar outra vez."
      >
        {aplicando
          ? 'Aplicando…'
          : total === 1
            ? 'Aplicar a 1 mês'
            : `Aplicar aos ${total} meses`}
      </Botao>
    </Cartao>
  );
}
