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
      <button
        type="button"
        onClick={(evento) => {
          // O "?" costuma ficar dentro do `<label>` do campo: sem isto, abrir a
          // ajuda também focaria o controle ao lado.
          evento.preventDefault();
          evento.stopPropagation();
          definirAberto(true);
        }}
        aria-label={`O que faz: ${verbete.titulo}`}
        title="O que este ajuste muda no resultado"
        style={{
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
      </button>

      {aberto ? (
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
