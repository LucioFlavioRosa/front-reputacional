// @vitest-environment jsdom

/** A entrada da Plataforma, no menu da conta.
 *
 *  POR QUE RENDERIZAR, e não testar uma função pura: o defeito que trouxe esta
 *  entrada para cá não foi de lógica. A tela existia, a rota existia, e ela
 *  simplesmente não tinha botão nenhum que a abrisse — compila, renderiza, e
 *  ninguém chega. Só montar prova que a porta está lá.
 */

import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { MenuDoUsuario } from '@/componentes/MenuDoUsuario';
import type { Eu } from '@/dominio/tipos';

const EU: Eu = {
  id: 'u-1',
  nome: 'Ana Souza',
  email: 'ana@aegea.com.br',
  externo: false,
  acesso_expira_em: null,
  csrf_token: 'token-de-teste',
  papel: {
    codigo: 'plataforma_edicao',
    nome: 'Plataforma — edição',
    pode_criar: true,
    pode_editar_proprio: true,
    pode_editar_tudo: true,
    administra_dicionarios: true,
    administra_acessos: true,
    ve_campos_sensiveis: true,
    ve_diretorio: true,
    pode_exportar: true,
    acessa_crm: true,
    acessa_sintese: true,
    acessa_score: true,
  },
};

/** Abre o painel suspenso — ele nasce fechado, e o avatar é quem o revela. */
async function abrir() {
  await userEvent.click(screen.getByRole('button', { expanded: false }));
}

describe('o menu da conta', () => {
  it('mostra a Plataforma a quem recebe para onde ir', async () => {
    render(<MenuDoUsuario eu={EU} aoAbrirPlataforma={() => {}} />);
    await abrir();
    expect(screen.getByRole('button', { name: 'Plataforma' })).toBeInTheDocument();
  });

  it('não mostra a Plataforma a quem não a administra', async () => {
    // Sem o callback não há para onde ir: mostrar a entrada seria oferecer uma
    // porta que não abre.
    render(<MenuDoUsuario eu={EU} />);
    await abrir();
    expect(screen.queryByRole('button', { name: 'Plataforma' })).toBeNull();
  });

  it('navega e fecha o painel no mesmo clique', async () => {
    // FECHAR FAZ PARTE: o painel é `position: absolute` sobre o conteúdo, e
    // deixá-lo aberto cobriria justamente a tela que se acabou de pedir.
    const abrirPlataforma = vi.fn();
    render(<MenuDoUsuario eu={EU} aoAbrirPlataforma={abrirPlataforma} />);
    await abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Plataforma' }));

    expect(abrirPlataforma).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: 'Plataforma' })).toBeNull();
  });

  it('põe a Plataforma antes do sair', async () => {
    // A ORDEM É A REGRA: sair é a última coisa que se faz, e um controle depois
    // dele convida ao clique errado.
    render(<MenuDoUsuario eu={EU} aoAbrirPlataforma={() => {}} />);
    await abrir();
    const acoes = screen
      .getAllByRole('button')
      .map((botao) => botao.textContent?.trim())
      .filter((rotulo) => rotulo === 'Plataforma' || rotulo === 'Sair');
    expect(acoes).toEqual(['Plataforma', 'Sair']);
  });
});
