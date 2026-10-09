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
 *
 *  DUAS LISTAS, E NÃO UMA. `temas` são os ativos, e é só deles que a busca
 *  sugere: um assunto aposentado não pode entrar em agenda nova. `temasInativos`
 *  serve apenas para MOSTRAR o que já está escolhido.
 *
 *  POR QUE ISSO É NECESSÁRIO, medido na base: 60 agendas têm 80 vínculos com 17
 *  assuntos que a `0058` aposentou. Com uma lista só — a de ativos, que é o que
 *  `/api/dicionarios` devolve —, abrir uma dessas agendas mostrava MENOS temas
 *  do que ela tem: o chip não aparecia, a pessoa não via a classificação e nem
 *  podia removê-la, porque sem chip não há o × do gesto de remover. O dado
 *  continuava gravado, e o formulário afirmava outra coisa.
 *
 *  É o mesmo defeito que `nomeDoTema` e `nomeDoFormatoDeInteracao` resolvem no
 *  domínio, e a razão é a mesma: preservar o vínculo histórico e esconder o
 *  nome é meia preservação.
 */

import { useState } from 'react';
import { Chip } from '@/componentes/basicos';
import { estiloDeEntrada } from '@/componentes/basicos';
import { filtrar } from '@/dominio/completar';
import type { Tema } from '@/dominio/tipos';

const LIMITE_DE_SUGESTOES = 8;

export function SeletorDeTemas({
  temas,
  temasInativos = [],
  selecionados,
  aoAlternar,
}: {
  /** Os ativos: aparecem na busca e podem ser escolhidos. */
  temas: Tema[];
  /** Os aposentados: NÃO aparecem na busca, e aparecem como chip quando a
   *  agenda já os tem. Opcional para não quebrar quem ainda não os passa — e
   *  o padrão vazio reproduz o comportamento antigo, não um erro silencioso. */
  temasInativos?: Tema[];
  selecionados: number[];
  /** Alterna UM id por vez — mesmo gesto de `alternarAssunto`/
   *  `alternarNaLista` usados nos formulários que chamam este componente,
   *  que também soltam efeitos colaterais (ex.: referências vinculadas) por
   *  id alternado, não por array substituído inteiro. */
  aoAlternar: (id: number) => void;
}) {
  const [busca, definirBusca] = useState('');

  // OS MARCADOS SAEM DAS DUAS LISTAS; as sugestões, só dos ativos.
  const marcados = [...temas, ...temasInativos].filter((tema) =>
    selecionados.includes(tema.id),
  );
  const aposentados = new Set(temasInativos.map((tema) => tema.id));

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
            {marcados.map((tema) => {
              // O APOSENTADO SE DISTINGUE, em vez de se disfarçar de ativo: ele
              // não está na busca, então quem tentar reencontrá-lo depois de
              // remover não vai achar. Dizer isso no chip é o aviso antes do
              // gesto irreversível.
              const aposentado = aposentados.has(tema.id);
              return (
                <Chip
                  key={tema.id}
                  rotulo={aposentado ? `${tema.nome} (aposentado)` : tema.nome}
                  ativo
                  fundo={aposentado ? 'var(--bg-trilho)' : 'var(--turquesa-rio)'}
                  texto={aposentado ? 'var(--cinza-2)' : 'var(--sobre-turquesa)'}
                  titulo={
                    aposentado
                      ? 'Assunto aposentado: continua valendo nesta agenda, mas não está mais na busca. Clique para remover.'
                      : 'Clique para remover'
                  }
                  aoClicar={() => aoAlternar(tema.id)}
                />
              );
            })}
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
