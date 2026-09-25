/** O "?" que detalha um campo do Cadastro: o que preencher, um exemplo, e por
 *  que a plataforma pergunta — para quem abre "Nova interação" pela primeira
 *  vez e não quer sair da tela para descobrir o que cada campo espera.
 *
 *  BALÃO, E NÃO MODAL. Usa o mesmo `.dica-flutuante` do script de
 *  transcrição — aparece no hover ou no foco e some ao sair, sem tirar quem
 *  preenche da tela. `GuiaDoParametro` abre modal porque a Calibração é a
 *  exceção: lá cada campo muda um número que a empresa inteira lê. Aqui o
 *  campo só precisa ser entendido, e o balão já resolve — exceto na seção
 *  "Tipo de interação", que é uma tabela de referência e mora em
 *  `GuiaDosFormatos`.
 *
 *  O "?" É UM `span`, e o clique nele não sobe até o `<label>` de `Campo` —
 *  mesmo motivo de `Ajuda`, em `basicos.tsx`: um `button` aqui seria o
 *  primeiro controle rotulável dentro do label e roubaria o rótulo do campo
 *  ao lado dele.
 */

import { useState } from 'react';
import type { VerbeteDoCampo } from '@/dominio/guiaDoCadastro';

export function AjudaDoCampo({ verbete }: { verbete: VerbeteDoCampo }) {
  const [copiado, definirCopiado] = useState(false);

  async function copiar() {
    if (!verbete.script) return;
    try {
      await navigator.clipboard.writeText(verbete.script);
      definirCopiado(true);
      window.setTimeout(() => definirCopiado(false), 2000);
    } catch {
      /* área de transferência negada pelo navegador — o texto do balão
         continua visível e selecionável à mão */
    }
  }

  return (
    <span
      className="dica-flutuante"
      style={{ display: 'inline-flex', marginLeft: 6, verticalAlign: 'middle' }}
    >
      <span
        role="img"
        tabIndex={0}
        aria-label="Ajuda sobre este campo"
        onClick={(evento) => {
          evento.preventDefault();
          evento.stopPropagation();
        }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 16,
          height: 16,
          borderRadius: '50%',
          border: '1px solid var(--borda-input)',
          background: 'var(--branco)',
          color: 'var(--cinza-3)',
          fontSize: 11,
          fontWeight: 700,
          lineHeight: 1,
          cursor: 'help',
          userSelect: 'none',
          flexShrink: 0,
        }}
      >
        ?
      </span>
      {/* O CLIQUE NO BOTÃO "COPIAR" NÃO PODE SUBIR ATÉ O `<label>`: sem isto,
          copiar o script também abriria (ou focaria) o campo ao lado. */}
      <span
        className="dica-flutuante__balao"
        role="tooltip"
        style={{ width: 300, maxWidth: 300 }}
        onClick={(evento) => evento.stopPropagation()}
      >
        <Parte rotulo="O que preencher">{verbete.oQuePreencher}</Parte>
        {verbete.exemplo ? <Parte rotulo="Exemplo">{verbete.exemplo}</Parte> : null}
        {verbete.porQue ? <Parte rotulo="Por que perguntamos">{verbete.porQue}</Parte> : null}
        {verbete.script ? (
          <>
            <Parte rotulo="Script sugerido — cole numa IA junto com a transcrição">
              {verbete.script}
            </Parte>
            <button
              type="button"
              onClick={copiar}
              style={{
                border: 'none',
                background: 'var(--azul-mar)',
                color: 'var(--branco)',
                borderRadius: 'var(--r-btn)',
                padding: '5px 10px',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {copiado ? 'Copiado!' : 'Copiar script'}
            </button>
          </>
        ) : null}
      </span>
    </span>
  );
}

function Parte({ rotulo, children }: { rotulo: string; children: string }) {
  return (
    <span style={{ display: 'block', marginBottom: 8 }}>
      <span style={{ display: 'block', fontWeight: 700, color: 'var(--cinza-4)', marginBottom: 3 }}>
        {rotulo}
      </span>
      <span style={{ display: 'block', whiteSpace: 'pre-line' }}>{children}</span>
    </span>
  );
}
