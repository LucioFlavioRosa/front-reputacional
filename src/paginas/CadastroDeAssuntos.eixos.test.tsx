// @vitest-environment jsdom

/** Os dois eixos de risco na lista, e o LSO que deixou de ser obrigatório.
 *
 *  POR QUE A DIVERGÊNCIA FICA VISÍVEL em vez de ser corrigida: `e_risco` é a
 *  binária Risco/Outros da taxonomia v3 — "este assunto é exposição?" — e o
 *  enquadramento vem do `Risk tracking map`, que responde outra pergunta: "que
 *  risco corporativo ele toca?".
 *
 *  Uma pauta positiva responde diferente às duas. "Reúso de água", "Educação
 *  ambiental" e "Geração de empregos" tocam o cluster ESG sem serem, elas
 *  mesmas, temas de exposição — e são três dos 18 que divergem nesse sentido.
 *  No outro sentido são 3, que a v3 chama de risco e o mapa marca "Sem
 *  enquadramento". Derivar um eixo do outro apagaria uma das duas leituras.
 *
 *  O QUE A TELA PRECISA FAZER é deixar ACHAR os 21 sem abrir 104 assuntos um
 *  por um, e é isso que estes testes travam.
 */

import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CadastroDeAssuntos } from '@/paginas/CadastroDeAssuntos';

const RISCOS = [
  { id: 1, cluster: 'Riscos ESG', nome: 'Externalidades', severidade: 'critico' },
  { id: 2, cluster: 'Riscos Operacionais', nome: 'Saúde e Segurança', severidade: 'alto' },
];

/** Quatro assuntos, um por quadrante dos dois eixos — é o mínimo que distingue
 *  "concorda" de "discorda" nos dois sentidos.
 */
const TEMAS = [
  // concordam: v3 diz risco, o mapa enquadra
  { id: 10, nome: 'Qualidade da água', nivel: 'sensivel', ativo: true, tipo: null,
    macro_tema_id: 1, camada_lso: 'credibilidade', area_dona_id: null,
    e_risco: true, risco_id: 2 },
  // DISCORDAM: pauta positiva que toca um cluster sem ser exposição
  { id: 11, nome: 'Reúso de água', nivel: 'estrategico', ativo: true, tipo: null,
    macro_tema_id: 1, camada_lso: null, area_dona_id: null,
    e_risco: false, risco_id: 1 },
  // DISCORDAM no outro sentido: v3 diz risco, o mapa não enquadra
  { id: 12, nome: 'Modelo Operacional Aegea', nivel: 'estrategico', ativo: true, tipo: null,
    macro_tema_id: 1, camada_lso: null, area_dona_id: null,
    e_risco: true, risco_id: null },
  // concordam: nenhum dos dois
  { id: 13, nome: 'Patrocínio de corrida', nivel: 'gerais', ativo: true, tipo: null,
    macro_tema_id: 1, camada_lso: null, area_dona_id: null,
    e_risco: false, risco_id: null },
];

vi.mock('@/api/cliente', () => ({
  listarTemas: vi.fn(async () => TEMAS),
  criarTema: vi.fn(async () => TEMAS[0]),
  editarTema: vi.fn(async () => TEMAS[0]),
  obterDicionarios: vi.fn(async () => ({
    blocos_tema: [{ id: 1, codigo: 'governanca', nome: 'Governança', ordem: 1 }],
    macro_temas: [{ id: 1, bloco_tema_id: 1, codigo: 'integridade', nome: 'Integridade', ordem: 1 }],
    riscos_reputacionais: RISCOS,
    riscos_inativos: [],
  })),
}));

const aparecer = async (texto: RegExp | string) =>
  screen.findByText(texto, undefined, { timeout: 3000 });

describe('a lista de assuntos mostra os dois eixos', () => {
  it('traz o selo do RepRisk com a severidade, ao lado do selo de risco da v3', async () => {
    render(<CadastroDeAssuntos />);
    await aparecer('Qualidade da água');

    // DOIS assuntos têm o selo da v3 (ids 10 e 12) — `getAllByText`, porque
    // `getByText` falha com "found multiple elements" e o número faz parte do
    // que está sob teste.
    expect(screen.getAllByText('Risco')).toHaveLength(2);
    expect(screen.getByText(/RepRisk · Alto/)).toBeTruthy();
    // A pauta positiva tem só o do RepRisk — e é assim que a divergência se lê
    // na lista, sem abrir o assunto.
    expect(screen.getByText(/RepRisk · Crítico/)).toBeTruthy();
  });

  it('oferece filtrar só os que discordam, com a contagem', async () => {
    render(<CadastroDeAssuntos />);
    await aparecer('Qualidade da água');

    // Dois dos quatro discordam, um em cada sentido.
    const filtro = await screen.findByText(/Só os 2 em que os dois eixos de risco discordam/);
    expect(filtro).toBeTruthy();
  });

  it('o filtro deixa só os dois que discordam', async () => {
    const usuario = userEvent.setup();
    render(<CadastroDeAssuntos />);
    await aparecer('Qualidade da água');

    await usuario.click(
      screen.getByRole('checkbox', { name: /dois eixos de risco discordam/ }),
    );

    expect(screen.getByText('Reúso de água')).toBeTruthy();
    expect(screen.getByText('Modelo Operacional Aegea')).toBeTruthy();
    // Os que concordam saem — nos dois sentidos de concordar.
    expect(screen.queryByText('Qualidade da água')).toBeNull();
    expect(screen.queryByText('Patrocínio de corrida')).toBeNull();
  });
});

describe('o LSO deixou de ser obrigatório', () => {
  it('o campo não tem asterisco e explica por quê', async () => {
    render(<CadastroDeAssuntos />);
    await aparecer('Qualidade da água');

    const dica = await screen.findByText(/não define LSO para 47 dos 104 subtemas/);
    expect(dica).toBeTruthy();
  });

  it('dá para cadastrar com pilar e tema estratégico, sem escolher LSO', async () => {
    // A taxonomia v4 deixa 47 dos 104 subtemas sem LSO. Exigi-lo travaria 45%
    // das classificações válidas e afirmaria uma camada que a Aegea não
    // atribuiu. Pilar e Tema estratégico seguem exigidos: a planilha os
    // preenche em 104 de 104.
    const usuario = userEvent.setup();
    render(<CadastroDeAssuntos />);
    await aparecer('Qualidade da água');

    // O placeholder exato do campo de nome do formulário de criar; a busca da
    // lista também tem um, e o regex pegava os dois.
    const nome = screen.getByPlaceholderText('Reajuste tarifário');
    await usuario.type(nome, 'Assunto sem LSO');

    await usuario.selectOptions(
      screen.getByRole('combobox', { name: /Pilar/ }), '1',
    );
    await usuario.selectOptions(
      screen.getByRole('combobox', { name: /Tema estratégico/ }), '1',
    );

    const botao = screen.getByRole('button', { name: /^Cadastrar$/ });
    expect(botao).toHaveProperty('disabled', false);
  });
});
