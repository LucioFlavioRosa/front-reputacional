/** Escolher Tema(s) (nível 3) por busca, em vez de uma grade com os 104 de
 *  uma vez — ver `CadastroDeAssuntos.tsx`/`migrations/0058`, que levou a
 *  taxonomia de ~60 para 104 subtemas e tornou a grade inteira difícil de
 *  escanear.
 *
 *  O FLUXO: digita um pedaço do nome, clica numa sugestão (ela some da busca
 *  e entra em "Temas selecionados" logo abaixo), repete para o próximo. Cada
 *  selecionado é um `Chip` ativo — o × já é o mesmo gesto de remover que o
 *  resto da tela usa, sem inventar um botão novo.
 *
 *  SEM BUSCA, SEM SUGESTÃO: a lista de 104 nunca aparece inteira de novo —
 *  só o que bateu com o texto digitado, e só os que ainda não foram
 *  escolhidos (um tema já selecionado some da busca, porque já está visível
 *  logo abaixo).
 */

import { useState } from 'react';
import { Chip } from '@/componentes/basicos';
import { estiloDeEntrada } from '@/componentes/basicos';
import { filtrar } from '@/dominio/completar';
import type { Tema } from '@/dominio/tipos';

const LIMITE_DE_SUGESTOES = 8;

export function SeletorDeTemas({
  temas,
  selecionados,
  aoAlternar,
}: {
  temas: Tema[];
  selecionados: number[];
  /** Alterna UM id por vez — mesmo gesto de `alternarAssunto`/
   *  `alternarNaLista` usados nos formulários que chamam este componente,
   *  que também soltam efeitos colaterais (ex.: referências vinculadas) por
   *  id alternado, não por array substituído inteiro. */
  aoAlternar: (id: number) => void;
}) {
  const [busca, definirBusca] = useState('');

  const marcados = temas.filter((tema) => selecionados.includes(tema.id));

  const sugestoes = busca.trim()
    ? filtrar(
        temas
          .filter((tema) => !selecionados.includes(tema.id))
          .map((tema) => ({ valor: String(tema.id), rotulo: tema.nome })),
        busca,
      ).slice(0, LIMITE_DE_SUGESTOES)
    : [];

  function adicionar(id: number) {
    aoAlternar(id);
    // LIMPA A BUSCA: devolve o campo pronto para o próximo tema, em vez de
    // deixar o texto de quem acabou de achar atrapalhando a próxima digitação.
    definirBusca('');
  }

  return (
    <div>
      <input
        type="text"
        value={busca}
        onChange={(evento) => definirBusca(evento.target.value)}
        placeholder="Digite para buscar um tema…"
        style={{ ...estiloDeEntrada, maxWidth: 360 }}
      />
      {sugestoes.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {sugestoes.map((sugestao) => (
            <Chip
              key={sugestao.valor}
              rotulo={sugestao.rotulo}
              titulo="Clique para adicionar"
              aoClicar={() => adicionar(Number(sugestao.valor))}
            />
          ))}
        </div>
      ) : null}

      <div style={{ marginTop: 12 }}>
        <div style={ESTILO_DO_ROTULO_SELECIONADOS}>
          Temas selecionados{marcados.length > 0 ? ` (${marcados.length})` : ''}
        </div>
        {marcados.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--cinza-2)', margin: '4px 0 0' }}>
            Nenhum tema selecionado ainda.
          </p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
            {marcados.map((tema) => (
              <Chip
                key={tema.id}
                rotulo={tema.nome}
                ativo
                fundo="var(--turquesa-rio)"
                texto="var(--sobre-turquesa)"
                titulo="Clique para remover"
                aoClicar={() => aoAlternar(tema.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const ESTILO_DO_ROTULO_SELECIONADOS = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.02em',
  textTransform: 'uppercase' as const,
  color: 'var(--cinza-2)',
};
