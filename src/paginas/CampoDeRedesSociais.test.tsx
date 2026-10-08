// @vitest-environment jsdom

/** O texto digitado não se perde ao clicar direto em "Cadastrar".
 *
 *  O DEFEITO QUE ISTO PEGA (revisão de 08/10/2026): `CampoDeRedesSociais` guarda
 *  o texto sendo digitado num `useState` próprio — de propósito, é estado
 *  transitório do widget — e só o passava para fora no "Adicionar" ou no Enter.
 *  Quem digitava `@fulano` e clicava direto no "Cadastrar" do formulário salvava
 *  o contato sem a rede, sem aviso nenhum.
 *
 *  POR QUE UM TESTE E NÃO UM COMENTÁRIO. A correção é `onBlur={acrescentar}`, e
 *  ela depende de uma ORDEM que não está escrita em lugar nenhum do nosso código:
 *  o clique num botão tira o foco do campo antes de disparar o `onClick`, e o
 *  React precisa ter aplicado o estado novo antes do handler do botão rodar. Se
 *  essa ordem mudar — de versão do React, de como o botão é montado — o bug
 *  volta em silêncio, e é este arquivo que grita.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { CampoDeRedesSociais } from '@/paginas/CadastroDeInstituicoes';

/** Um formulário de mentira com a MESMA forma do de verdade: o widget por
 *  cima, um botão de gravar por baixo, e o estado do contato no meio.
 */
function FormularioDeMentira({ aoGravar }: { aoGravar: (redes: string[]) => void }) {
  const [redes, definirRedes] = useState<string[]>([]);
  return (
    <>
      <CampoDeRedesSociais valores={redes} aoMudar={definirRedes} />
      <button type="button" onClick={() => aoGravar(redes)}>
        Cadastrar
      </button>
    </>
  );
}

describe('CampoDeRedesSociais', () => {
  it('leva o que foi digitado mesmo sem passar pelo "Adicionar"', async () => {
    const aoGravar = vi.fn();
    const usuario = userEvent.setup();
    render(<FormularioDeMentira aoGravar={aoGravar} />);

    // `userEvent`, e NÃO `fireEvent`: é ele que reproduz a sequência do
    // navegador — ponteiro, troca de foco, clique. É justamente essa ordem que
    // está sob teste, e `fireEvent.click` não tiraria o foco do campo, então o
    // teste passaria sem provar nada.
    await usuario.type(screen.getByPlaceholderText('Link ou @usuário'), '@fulano');
    await usuario.click(screen.getByText('Cadastrar'));

    expect(aoGravar).toHaveBeenCalledWith(['@fulano']);
  });

  it('não acrescenta nada quando o campo está vazio ou só com espaço', () => {
    const aoGravar = vi.fn();
    render(<FormularioDeMentira aoGravar={aoGravar} />);
    const campo = screen.getByPlaceholderText('Link ou @usuário');

    fireEvent.blur(campo);
    fireEvent.change(campo, { target: { value: '   ' } });
    fireEvent.blur(campo);
    fireEvent.click(screen.getByText('Cadastrar'));

    expect(aoGravar).toHaveBeenCalledWith([]);
  });

  it('o "Adicionar" e o Enter continuam valendo, e não duplicam no blur', () => {
    const aoGravar = vi.fn();
    render(<FormularioDeMentira aoGravar={aoGravar} />);
    const campo = screen.getByPlaceholderText('Link ou @usuário');

    fireEvent.change(campo, { target: { value: '@um' } });
    fireEvent.click(screen.getByText('Adicionar'));
    // O campo foi limpo pelo "Adicionar", então o blur seguinte não tem o que
    // acrescentar — é isto que impede o chip dobrado.
    fireEvent.blur(campo);

    fireEvent.change(campo, { target: { value: '@dois' } });
    fireEvent.keyDown(campo, { key: 'Enter' });
    fireEvent.blur(campo);

    fireEvent.click(screen.getByText('Cadastrar'));
    expect(aoGravar).toHaveBeenCalledWith(['@um', '@dois']);
  });
});
