/** O "?" de um parâmetro da Calibração — o que ele é, e o que muda no número.
 *
 *  POR QUE UM MODAL, E NÃO O `Ajuda` DE SEMPRE. O `Ajuda` é uma dica que
 *  aparece no hover, boa para uma linha, e a docstring dele pede que se use
 *  pouco — um "?" em todo campo vira ruído. A Calibração é a exceção que
 *  justifica a regra: aqui TODO campo muda o número que a companhia inteira
 *  lê, e a pergunta não é "o que é isto" e sim "o que acontece se eu mexer".
 *  Isso não cabe num balão de hover.
 *
 *  É O MESMO GESTO DO DOSSIÊ — o "?" que abre a procedência de um bloco. Quem
 *  aprendeu lá não precisa aprender de novo aqui.
 *
 *  POR QUE ELE NÃO É UM `<button>`, e o modal não deixa o clique subir:
 *
 *  ELE MORA DENTRO DO `<label>` DE `Campo`. Um `<label>` se associa ao PRIMEIRO
 *  elemento rotulável que houver dentro dele, e `button` é rotulável. Com um
 *  botão aqui, o rótulo "Virada · pontos de nota" passava a rotular o "?", e
 *  não o campo — e todo clique dentro do label era reencaminhado pelo navegador
 *  para o "?".
 *
 *  O SINTOMA ERA O MODAL QUE NÃO FECHAVA. Clicar no X fechava (o estado ia a
 *  falso) e reabria no mesmo clique, porque o evento subia até o `<label>` e
 *  voltava para o "?" como ativação. Só o Escape funcionava, por ser tecla e
 *  não clique.
 *
 *  São dois consertos, e os dois precisam existir: o "?" vira um `span`
 *  focável — o mesmo que `Ajuda` já fazia, e pelo mesmo motivo —, e o modal
 *  fica dentro de um envoltório que barra o clique antes do `<label>`, senão o
 *  clique no X abriria o `select` que o rótulo de fato rotula.
 */

import { useState } from 'react';

import { Modal } from '@/componentes/basicos';
import { verbeteDe } from '@/dominio/guiaDaCalibracao';

export function GuiaDoParametro({ chave }: { chave: string }) {
  const [aberto, definirAberto] = useState(false);
  const verbete = verbeteDe(chave);
  if (!verbete) return null;

  return (
    <>
      <span
        role="button"
        tabIndex={0}
        onClick={(evento) => {
          evento.preventDefault();
          evento.stopPropagation();
          definirAberto(true);
        }}
        onKeyDown={(evento) => {
          if (evento.key !== 'Enter' && evento.key !== ' ') return;
          evento.preventDefault();
          evento.stopPropagation();
          definirAberto(true);
        }}
        aria-label={`O que faz: ${verbete.titulo}`}
        title="O que este ajuste muda no resultado"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 18,
          height: 18,
          marginLeft: 6,
          verticalAlign: 'middle',
          borderRadius: '50%',
          border: '1px solid var(--borda-input)',
          background: 'var(--branco)',
          color: 'var(--cinza-3)',
          fontSize: 11,
          fontWeight: 700,
          lineHeight: 1,
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        ?
      </span>

      {aberto ? (
        // O ENVOLTÓRIO BARRA O CLIQUE ANTES DO `<label>`: sem ele, fechar pelo
        // X ou pelo fundo também abriria o `select` que o rótulo rotula.
        <span onClick={(evento) => evento.stopPropagation()}>
        <Modal
          titulo={verbete.titulo}
          subtitulo="O que este ajuste muda no resultado"
          aoFechar={() => definirAberto(false)}
          largura={600}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, fontSize: 13 }}>
            <Parte rotulo="O que é">{verbete.oQueE}</Parte>
            <Parte rotulo="O que muda no resultado">{verbete.comoAfeta}</Parte>
            {verbete.exemplo ? <Parte rotulo="Na prática">{verbete.exemplo}</Parte> : null}
            {verbete.aviso ? (
              <div
                style={{
                  background: 'var(--atencao-bg)',
                  color: 'var(--atencao-fg)',
                  padding: '11px 13px',
                  borderRadius: 'var(--r-card-int)',
                  lineHeight: 1.6,
                }}
              >
                {verbete.aviso}
              </div>
            ) : null}
          </div>
        </Modal>
        </span>
      ) : null}
    </>
  );
}

function Parte({ rotulo, children }: { rotulo: string; children: string }) {
  return (
    <div>
      <p className="kicker" style={{ margin: '0 0 5px' }}>
        {rotulo}
      </p>
      <p style={{ margin: 0, lineHeight: 1.6 }}>{children}</p>
    </div>
  );
}
