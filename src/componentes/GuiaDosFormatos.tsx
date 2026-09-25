/** O "?" da seção "Tipo de interação": o que cada formato cobre, com
 *  exemplos — a mesma tabela que a Aegea usa para explicar a diferença entre
 *  eles.
 *
 *  MODAL, E NÃO BALÃO. São até oito linhas de referência, e um balão de hover
 *  que fecha assim que o mouse sai não dá tempo de ler isso — a mesma razão
 *  que já levou `GuiaDoParametro` a abrir modal em vez do balão de sempre.
 *
 *  POR QUE O "?" NÃO É UM `<button>`, e o modal não deixa o clique subir: ver
 *  a nota em `GuiaDoParametro.tsx` — o mesmo problema, o mesmo conserto.
 */

import { useState } from 'react';

import { Modal } from '@/componentes/basicos';
import { verbeteDoFormato } from '@/dominio/guiaDoCadastro';

export function GuiaDosFormatos({ formatos }: { formatos: { id: number; nome: string }[] }) {
  const [aberto, definirAberto] = useState(false);

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
        aria-label="O que é cada tipo de interação"
        title="O que cada tipo cobre, com exemplos"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 18,
          height: 18,
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
        <span onClick={(evento) => evento.stopPropagation()}>
          <Modal
            titulo="O que é cada tipo de interação"
            subtitulo="Escolha o que mais se aproxima do que aconteceu. Ele muda o que o formulário pede mais abaixo."
            aoFechar={() => definirAberto(false)}
            largura={640}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontSize: 13 }}>
              {formatos.map((formato) => {
                const verbete = verbeteDoFormato(formato.nome);
                if (!verbete) return null;
                return (
                  <div key={formato.id}>
                    <p style={{ margin: '0 0 4px', fontWeight: 700, color: 'var(--cinza-4)' }}>
                      {formato.nome}
                    </p>
                    <p style={{ margin: '0 0 4px', lineHeight: 1.6 }}>{verbete.oQuePreencher}</p>
                    {verbete.exemplo ? (
                      <p style={{ margin: 0, lineHeight: 1.6, color: 'var(--cinza-2)' }}>
                        Ex.: {verbete.exemplo}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </Modal>
        </span>
      ) : null}
    </>
  );
}
