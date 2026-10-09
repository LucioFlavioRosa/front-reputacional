// @vitest-environment jsdom
/** A tela de revisar a taxonomia por planilha.
 *
 *  O QUE ESTES TESTES PROTEGEM é a promessa da tela: destas 149 linhas, quais
 *  mudam? Se a lista mostrar as 149, a tela não serve para nada — e nada no
 *  TypeScript impede isso. Daí o teste que conta as linhas renderizadas contra
 *  um retorno com 146 iguais.
 *
 *  E PROTEGEM A FRASE DO BOTÃO. Linha recusada não prende as outras (decisão do
 *  back, e deliberada), e o preço é a pessoa poder achar que aplicou tudo. O
 *  rótulo que nomeia quantas ficam de fora é onde esse preço se paga; sem teste,
 *  ele é a primeira coisa que alguém "limpa" num refinamento visual.
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ImportarSubtemas } from '@/paginas/taxonomia/ImportarSubtemas';
import type { ConferenciaDeSubtemas, PropostaDeSubtema } from '@/api/cliente';
import type { MacroTema, Risco } from '@/dominio/tipos';

vi.mock('@/api/cliente', () => ({
  baixarModeloDeSubtemas: vi.fn(),
  conferirPlanilhaDeSubtemas: vi.fn(),
  confirmarPlanilhaDeSubtemas: vi.fn(),
}));

const {
  baixarModeloDeSubtemas,
  conferirPlanilhaDeSubtemas,
  confirmarPlanilhaDeSubtemas,
} = await import('@/api/cliente');

const MACROS = [
  { id: 29, bloco_tema_id: 3, codigo: 'MT-29', nome: 'Obras e intervenções', ordem: 1 },
  { id: 31, bloco_tema_id: 3, codigo: 'MT-31', nome: 'Tarifa e reajuste', ordem: 2 },
] as unknown as MacroTema[];

const RISCOS = [
  { id: 13, risk_cluster_id: 2, codigo: 'R13', nome: 'Obra atrasada', severidade: 'alta', ordem: 1 },
  { id: 7, risk_cluster_id: 1, codigo: 'R07', nome: 'Reajuste negado', severidade: 'alta', ordem: 2 },
] as unknown as Risco[];

function conferencia(parcial: Partial<ConferenciaDeSubtemas> = {}): ConferenciaDeSubtemas {
  return {
    totais: { novo: 0, igual: 0, altera: 0, recusada: 0 },
    propostas: [],
    impressao: 'impressao-de-teste',
    ...parcial,
  };
}

function proposta(parcial: Partial<PropostaDeSubtema>): PropostaDeSubtema {
  return {
    linha: 2,
    nome: 'Assunto',
    decisao: 'igual',
    antes: null,
    depois: null,
    divergencias: [],
    ...parcial,
  };
}

const PLANILHA = new File([new Uint8Array([1, 2, 3])], 'taxonomia.xlsx', {
  type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
});

/** Abre o modal e sobe a planilha, que é o estado de onde todo teste parte. */
async function subir(resposta: ConferenciaDeSubtemas, aoAplicar = vi.fn()) {
  vi.mocked(conferirPlanilhaDeSubtemas).mockResolvedValue(resposta);
  const pessoa = userEvent.setup();
  render(<ImportarSubtemas macros={MACROS} riscos={RISCOS} aoAplicar={aoAplicar} />);
  await pessoa.click(screen.getByRole('button', { name: 'Revisar por planilha' }));
  // `upload` E NÃO `fireEvent.change`: o campo é um `<input type=file>` dentro
  // de um `<label>`, e só o `userEvent` reproduz a ordem de foco e evento que o
  // navegador faz — foi assim que a ordem errada apareceu em outros testes.
  await pessoa.upload(
    screen.getByLabelText('Planilha de subtemas preenchida'),
    PLANILHA,
  );
  await waitFor(() => expect(conferirPlanilhaDeSubtemas).toHaveBeenCalled());
  return pessoa;
}

describe('ImportarSubtemas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('o modal só abre pelo botão', async () => {
    const pessoa = userEvent.setup();
    render(<ImportarSubtemas macros={MACROS} riscos={RISCOS} aoAplicar={vi.fn()} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    await pessoa.click(screen.getByRole('button', { name: 'Revisar por planilha' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('baixar a planilha pede o arquivo e não sobe nada', async () => {
    vi.mocked(baixarModeloDeSubtemas).mockResolvedValue(new Blob(['x']));
    const pessoa = userEvent.setup();
    render(<ImportarSubtemas macros={MACROS} riscos={RISCOS} aoAplicar={vi.fn()} />);
    await pessoa.click(screen.getByRole('button', { name: 'Revisar por planilha' }));
    await pessoa.click(screen.getByRole('button', { name: 'Baixar a planilha' }));
    await waitFor(() => expect(baixarModeloDeSubtemas).toHaveBeenCalledTimes(1));
    expect(conferirPlanilhaDeSubtemas).not.toHaveBeenCalled();
  });

  it('A LISTA MOSTRA SÓ O QUE MUDA — as iguais ficam no número', async () => {
    // A promessa inteira da tela. Com 146 iguais na resposta, a lista tem DUAS
    // linhas; se alguém trocar o filtro por "mostrar tudo", este teste cai.
    await subir(
      conferencia({
        totais: { novo: 1, igual: 146, altera: 1, recusada: 0 },
        propostas: [
          ...Array.from({ length: 146 }, (_, i) =>
            proposta({ linha: i + 2, nome: `Igual ${i}` }),
          ),
          proposta({
            linha: 150,
            nome: 'Tarifa social',
            decisao: 'altera',
            antes: { macro_tema_id: 29, camada_lso: 'confianca', e_risco: true, riscos: [13] },
            depois: { macro_tema_id: 29, camada_lso: 'legitimidade', e_risco: true, riscos: [13] },
          }),
          proposta({
            linha: 151,
            nome: 'Assunto novo',
            decisao: 'novo',
            depois: { macro_tema_id: 31, camada_lso: null, e_risco: false, riscos: [] },
          }),
        ],
      }),
    );

    const itens = screen.getAllByRole('listitem');
    expect(itens).toHaveLength(2);
    expect(screen.queryByText('Igual 0')).toBeNull();
    expect(screen.getByText('146 linhas sem mudança')).toBeTruthy();
  });

  it('o ALTERA mostra só os campos que diferem, com o antes e o depois', async () => {
    await subir(
      conferencia({
        totais: { novo: 0, igual: 0, altera: 1, recusada: 0 },
        propostas: [
          proposta({
            nome: 'Tarifa social',
            decisao: 'altera',
            antes: { macro_tema_id: 29, camada_lso: 'confianca', e_risco: true, riscos: [13] },
            depois: { macro_tema_id: 31, camada_lso: 'confianca', e_risco: true, riscos: [13] },
          }),
        ],
      }),
    );

    const linha = screen.getByRole('listitem');
    // O tema estratégico mudou; LSO, risco e riscos não — e por isso NÃO podem
    // aparecer. Mostrar os quatro sempre faria a pessoa procurar a diferença.
    expect(within(linha).getByText('Tema estratégico')).toBeTruthy();
    expect(within(linha).queryByText('LSO')).toBeNull();
    expect(within(linha).queryByText('Riscos')).toBeNull();
    // O riscado não chega a leitor de tela, então a mudança vai em palavras.
    expect(
      within(linha).getByLabelText(
        'Tema estratégico: de Obras e intervenções para Tarifa e reajuste',
      ),
    ).toBeTruthy();
  });

  it('a RECUSADA nomeia a coluna e o valor digitado, não só o motivo', async () => {
    await subir(
      conferencia({
        totais: { novo: 0, igual: 0, altera: 0, recusada: 1 },
        propostas: [
          proposta({
            linha: 37,
            nome: 'Assunto torto',
            decisao: 'recusada',
            divergencias: [
              {
                coluna: 'Pilar (N1)',
                valor: 'Governanca',
                motivo: 'Não é um dos pilares cadastrados.',
              },
            ],
          }),
        ],
      }),
    );

    const linha = screen.getByRole('listitem');
    // "a linha 37 está errada" manda procurar; a coluna e o valor mandam
    // consertar — e o número da linha é o endereço na planilha.
    expect(within(linha).getByText('L37')).toBeTruthy();
    expect(within(linha).getByText('Pilar (N1)')).toBeTruthy();
    expect(linha.textContent).toContain('"Governanca"');
    expect(linha.textContent).toContain('Não é um dos pilares cadastrados.');
  });

  it('O BOTÃO NOMEIA QUANTAS LINHAS FICAM DE FORA', async () => {
    // Recusada não prende as outras, e o preço é a pessoa achar que aplicou
    // tudo. Este rótulo é onde o preço se paga.
    await subir(
      conferencia({
        totais: { novo: 1, igual: 10, altera: 2, recusada: 2 },
        propostas: [
          proposta({ decisao: 'novo', depois: { macro_tema_id: 31, camada_lso: null, e_risco: null, riscos: [] } }),
          proposta({ linha: 3, decisao: 'recusada', divergencias: [] }),
        ],
      }),
    );
    expect(
      screen.getByRole('button', { name: 'Aplicar 3 mudanças (2 ficam de fora)' }),
    ).toBeTruthy();
  });

  it('sem nada para aplicar, o botão fica desabilitado e diz por quê', async () => {
    await subir(conferencia({ totais: { novo: 0, igual: 149, altera: 0, recusada: 0 } }));
    const botao = screen.getByRole('button', { name: 'Nada a aplicar' });
    expect(botao).toBeTruthy();
    expect(botao).toHaveProperty('disabled', true);
    expect(
      screen.getByText('A planilha diz exatamente o que o cadastro já tem. Nada a aplicar.'),
    ).toBeTruthy();
  });

  it('aplicar devolve A MESMA planilha e a impressão da conferência', async () => {
    // O ARQUIVO VAI DE NOVO, e é o que permite o servidor reconferir sem tabela
    // de rascunho. Mandar só a impressão exigiria guardar as propostas.
    vi.mocked(confirmarPlanilhaDeSubtemas).mockResolvedValue({
      criados: 1,
      alterados: 0,
      iguais: 10,
      recusadas: 0,
    });
    const aoAplicar = vi.fn();
    const pessoa = await subir(
      conferencia({
        totais: { novo: 1, igual: 10, altera: 0, recusada: 0 },
        impressao: 'abc123',
        propostas: [
          proposta({ decisao: 'novo', depois: { macro_tema_id: 31, camada_lso: null, e_risco: null, riscos: [] } }),
        ],
      }),
      aoAplicar,
    );

    await pessoa.click(screen.getByRole('button', { name: /^Aplicar 1 mudança/ }));
    await waitFor(() =>
      expect(confirmarPlanilhaDeSubtemas).toHaveBeenCalledWith(PLANILHA, 'abc123'),
    );
    expect(aoAplicar).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status').textContent).toContain('1 criado');
  });

  it('a recusa por cadastro mudado apaga a lista, para não convidar a tentar de novo', async () => {
    // O servidor recusa com "confira de novo". Deixar a lista velha na tela com
    // o botão ativo convidaria a repetir exatamente o que foi recusado.
    vi.mocked(confirmarPlanilhaDeSubtemas).mockRejectedValue(
      new Error('O cadastro mudou depois que você conferiu esta planilha.'),
    );
    const pessoa = await subir(
      conferencia({
        totais: { novo: 1, igual: 0, altera: 0, recusada: 0 },
        propostas: [
          proposta({ nome: 'Assunto novo', decisao: 'novo', depois: { macro_tema_id: 31, camada_lso: null, e_risco: null, riscos: [] } }),
        ],
      }),
    );

    await pessoa.click(screen.getByRole('button', { name: /^Aplicar 1 mudança/ }));
    await waitFor(() =>
      expect(
        screen.getByText('O cadastro mudou depois que você conferiu esta planilha.'),
      ).toBeTruthy(),
    );
    expect(screen.queryByRole('listitem')).toBeNull();
    expect(screen.queryByRole('button', { name: /^Aplicar/ })).toBeNull();
  });

  it('o campo de arquivo continua na tela depois de conferir', async () => {
    // A CORREÇÃO NORMAL É MEXER NA PLANILHA E SUBIR DE NOVO. Esconder o campo
    // depois da conferência faria a pessoa fechar e reabrir o modal para isso.
    await subir(
      conferencia({
        totais: { novo: 0, igual: 0, altera: 0, recusada: 1 },
        propostas: [proposta({ decisao: 'recusada' })],
      }),
    );
    expect(screen.getByLabelText('Planilha de subtemas preenchida')).toBeTruthy();
  });

  it('a falha ao ler a planilha aparece como erro, e não como lista vazia', async () => {
    vi.mocked(conferirPlanilhaDeSubtemas).mockRejectedValue(
      new Error('A aba "Subtemas" não existe neste arquivo.'),
    );
    const pessoa = userEvent.setup();
    render(<ImportarSubtemas macros={MACROS} riscos={RISCOS} aoAplicar={vi.fn()} />);
    await pessoa.click(screen.getByRole('button', { name: 'Revisar por planilha' }));
    await pessoa.upload(
      screen.getByLabelText('Planilha de subtemas preenchida'),
      PLANILHA,
    );
    await waitFor(() =>
      expect(screen.getByText('A aba "Subtemas" não existe neste arquivo.')).toBeTruthy(),
    );
  });
});
