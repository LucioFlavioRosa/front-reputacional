// @vitest-environment jsdom

/** O assunto aposentado que a agenda já tem continua visível no formulário.
 *
 *  O DEFEITO QUE ESTE ARQUIVO IMPEDE, medido na base: 60 agendas têm 80
 *  vínculos com 17 assuntos que a `0058` aposentou. `SeletorDeTemas` montava os
 *  chips de "Temas selecionados" a partir de `temas` — que é
 *  `catalogo.dicionarios.temas`, só os ativos. Abrir uma dessas 60 agendas
 *  mostrava MENOS temas do que ela tem: sem chip, a pessoa não via a
 *  classificação e nem podia removê-la, porque o × vive no chip.
 *
 *  O DADO NÃO SE PERDIA — o estado do formulário segue com o id —, e é isso que
 *  torna o defeito pior de achar: nada quebra, a tela só afirma outra coisa.
 *
 *  IMPORTA O COMPONENTE DE VERDADE, e não uma reimplementação. Um teste que
 *  refaz a lógica do componente passa com o componente inteiro quebrado — foi
 *  exatamente o que aconteceu num teste meu de `SeletorDeRisco`, e o conserto
 *  foi importar o componente e deixá-lo achar o defeito.
 */

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SeletorDeTemas } from '@/componentes/SeletorDeTemas';
import type { Tema } from '@/dominio/tipos';

const ATIVOS = [
  { id: 1, nome: 'Tarifa social', nivel: 'estrategico', ativo: true },
  { id: 2, nome: 'Obras e intervenções', nivel: 'estrategico', ativo: true },
] as unknown as Tema[];

const APOSENTADOS = [
  { id: 99, nome: 'Regulação', nivel: 'estrategico', ativo: false },
] as unknown as Tema[];

/** A região dos chips já escolhidos, pelo rótulo que a tela mostra. */
function selecionados() {
  // O rótulo traz a contagem ("Temas selecionados (2)"), então casa por prefixo.
  const titulo = screen.getByText(/^Temas selecionados/);
  return titulo.parentElement as HTMLElement;
}

describe('SeletorDeTemas e os assuntos aposentados', () => {
  it('O TEMA APOSENTADO JÁ ESCOLHIDO APARECE como chip', () => {
    render(
      <SeletorDeTemas
        temas={ATIVOS}
        temasInativos={APOSENTADOS}
        selecionados={[1, 99]}
        aoAlternar={vi.fn()}
      />,
    );

    const area = selecionados();
    expect(within(area).getByText('Tarifa social')).toBeTruthy();
    expect(within(area).getByText('Regulação (aposentado)')).toBeTruthy();
    expect(screen.getByText(/^Temas selecionados/).textContent).toContain('(2)');
  });

  it('sem a lista de aposentados, o chip SOME — o defeito, reproduzido', () => {
    // O CONTRAPESO: sem isto, o teste acima passaria mesmo que o componente
    // ignorasse `temasInativos` e por sorte achasse o tema na lista de ativos.
    render(
      <SeletorDeTemas temas={ATIVOS} selecionados={[1, 99]} aoAlternar={vi.fn()} />,
    );

    const area = selecionados();
    expect(within(area).getByText('Tarifa social')).toBeTruthy();
    expect(within(area).queryByText(/Regulação/)).toBeNull();
  });

  it('o aposentado NÃO entra na busca: agenda nova não pode escolhê-lo', async () => {
    const pessoa = userEvent.setup();
    render(
      <SeletorDeTemas
        temas={ATIVOS}
        temasInativos={APOSENTADOS}
        selecionados={[]}
        aoAlternar={vi.fn()}
      />,
    );

    await pessoa.type(screen.getByPlaceholderText('Digite para buscar um tema…'), 'Regul');
    expect(screen.queryByText('Regulação')).toBeNull();
    expect(screen.queryByText('Regulação (aposentado)')).toBeNull();
  });

  it('o ativo continua entrando na busca', async () => {
    const pessoa = userEvent.setup();
    render(
      <SeletorDeTemas
        temas={ATIVOS}
        temasInativos={APOSENTADOS}
        selecionados={[]}
        aoAlternar={vi.fn()}
      />,
    );

    await pessoa.type(screen.getByPlaceholderText('Digite para buscar um tema…'), 'Tarifa');
    expect(screen.getByText('Tarifa social')).toBeTruthy();
  });

  it('o chip do aposentado remove, como qualquer outro', async () => {
    // SEM CHIP NÃO HÁ × — e era isso que prendia a classificação aposentada na
    // agenda: a pessoa a via no painel e não tinha como tirá-la no formulário.
    const alternar = vi.fn();
    const pessoa = userEvent.setup();
    render(
      <SeletorDeTemas
        temas={ATIVOS}
        temasInativos={APOSENTADOS}
        selecionados={[99]}
        aoAlternar={alternar}
      />,
    );

    await pessoa.click(within(selecionados()).getByText('Regulação (aposentado)'));
    expect(alternar).toHaveBeenCalledWith(99);
  });

  it('o chip do aposentado AVISA que ele não volta pela busca', () => {
    render(
      <SeletorDeTemas
        temas={ATIVOS}
        temasInativos={APOSENTADOS}
        selecionados={[99]}
        aoAlternar={vi.fn()}
      />,
    );

    const chip = within(selecionados()).getByText('Regulação (aposentado)');
    // Remover é irreversível pela tela: ele não está na busca para voltar. O
    // aviso tem de estar no gesto, não só na documentação.
    const comTitulo = chip.closest('[title]');
    expect(comTitulo?.getAttribute('title')).toContain('não está mais na busca');
  });
});
