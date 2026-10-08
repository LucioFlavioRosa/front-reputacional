// @vitest-environment jsdom

/** Os dois eixos de risco na lista, o LSO que deixou de ser obrigatório, e o
 *  enquadramento que deixou de ficar invisível.
 *
 *  POR QUE A DIVERGÊNCIA FICA VISÍVEL em vez de ser corrigida: `e_risco` é a
 *  binária Risco/Outros da taxonomia v3 — "este assunto é exposição?" — e os
 *  riscos vêm da matriz corporativa, que responde outra pergunta: "que risco
 *  corporativo ele toca?".
 *
 *  Uma pauta positiva responde diferente às duas. "Reúso de água", "Educação
 *  ambiental" e "Geração de empregos" tocam o cluster ESG sem serem, elas
 *  mesmas, temas de exposição. No desenho anterior os eixos divergiam em 21 dos
 *  104 subtemas. Derivar um do outro apagaria uma das duas leituras.
 *
 *  O QUE A TELA PRECISA FAZER é deixar ACHAR essas linhas sem abrir 104
 *  assuntos um por um — e nunca ESCONDER enquadramento gravado.
 */

import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CadastroDeAssuntos } from '@/paginas/CadastroDeAssuntos';

const CLUSTERS = [
  { id: 1, codigo: 'esg', nome: 'Riscos ESG', ordem: 1 },
  { id: 2, codigo: 'operacionais', nome: 'Riscos Operacionais', ordem: 2 },
];

const RISCOS = [
  {
    id: 1, risk_cluster_id: 1, codigo: 'R01', nome: 'Externalidades',
    severidade: 'critico' as const, ordem: 1,
  },
  {
    id: 2, risk_cluster_id: 2, codigo: 'R02', nome: 'Saúde e Segurança',
    severidade: 'alto' as const, ordem: 1,
  },
];

const base = {
  nivel: 'estrategico', ativo: true, tipo: null, macro_tema_id: 1,
  camada_lso: null, area_dona_id: null,
};

/** Quatro assuntos, um por quadrante dos dois eixos — é o mínimo que distingue
 *  "concorda" de "discorda" nos dois sentidos.
 */
const TEMAS = [
  // concordam: a v3 diz risco e a matriz enquadra
  { ...base, id: 10, nome: 'Qualidade da água', e_risco: true, riscos: [2] },
  // DISCORDAM: pauta positiva que toca um cluster sem ser exposição
  { ...base, id: 11, nome: 'Reúso de água', e_risco: false, riscos: [1] },
  // DISCORDAM no outro sentido: a v3 diz risco, a matriz não enquadra
  { ...base, id: 12, nome: 'Modelo Operacional Aegea', e_risco: true, riscos: [] },
  // concordam: nenhum dos dois
  { ...base, id: 13, nome: 'Patrocínio de corrida', e_risco: false, riscos: [] },
];

vi.mock('@/api/cliente', () => ({
  listarTemas: vi.fn(async () => TEMAS),
  criarTema: vi.fn(async () => TEMAS[0]),
  editarTema: vi.fn(async () => TEMAS[0]),
  obterDicionarios: vi.fn(async () => ({
    blocos_tema: [{ id: 1, codigo: 'governanca', nome: 'Governança', ordem: 1 }],
    macro_temas: [
      { id: 1, bloco_tema_id: 1, codigo: 'integridade', nome: 'Integridade', ordem: 1 },
    ],
    risk_clusters: CLUSTERS,
    riscos: RISCOS,
  })),
}));

const pronto = () => screen.findByText('Qualidade da água', undefined, { timeout: 3000 });

/** A linha aberta em edição.
 *

 *  O NOME DO RISCO É EXATO porque cada checkbox ganhou `aria-label`: antes, o
 *  primeiro da lista herdava o `<label>` do `Campo`, e o nome acessível dele era
 *  a seção inteira. Era defeito de acessibilidade, não do teste, e foi corrigido
 *  no componente.
 *
 *  ÂNCORA NO "Salvar", e não um índice no DOM: o formulário de criar repete os
 *  mesmos rótulos (o checkbox de risco, o seletor), e depender de "o último"
 *  deixaria o teste refém da ordem dos blocos na tela. O "Salvar" só existe na
 *  linha aberta.
 */
const emEdicao = () =>
  within(screen.getByRole('button', { name: 'Salvar' }).closest('div')!.parentElement!);

describe('a lista mostra os dois eixos', () => {
  it('traz o selo da matriz com a maior severidade, ao lado do selo da v3', async () => {
    render(<CadastroDeAssuntos />);
    await pronto();

    // Dois assuntos têm o selo da v3 (ids 10 e 12).
    expect(screen.getAllByText('Risco')).toHaveLength(2);
    // "Qualidade da água" toca o R02 (alto); "Reúso de água" o R01 (crítico) —
    // e é esta a leitura que torna a divergência visível na lista.
    expect(screen.getByText('Matriz · Alto')).toBeTruthy();
    expect(screen.getByText('Matriz · Crítico')).toBeTruthy();
  });

  it('oferece filtrar só os que discordam, com a contagem', async () => {
    render(<CadastroDeAssuntos />);
    await pronto();
    expect(
      await screen.findByText(/Só os 2 em que os dois eixos de risco discordam/),
    ).toBeTruthy();
  });

  it('o filtro deixa só os dois que discordam', async () => {
    const usuario = userEvent.setup();
    render(<CadastroDeAssuntos />);
    await pronto();

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

describe('o enquadramento não fica invisível', () => {
  it('abrir um assunto com risco e sem a marca da v3 mostra a seção', async () => {
    // "Reúso de água": `e_risco` false, um risco associado. Gatear só pelo
    // checkbox não mostraria nada, e salvar MANTERIA o risco — o painel
    // afirmando o que a pessoa não viu.
    const usuario = userEvent.setup();
    render(<CadastroDeAssuntos />);
    await pronto();

    await usuario.click(screen.getByRole('button', { name: /Editar Reúso de água/ }));
    const linha = emEdicao();

    expect(linha.getByText('Risco(s) associado(s)')).toBeTruthy();
    expect(linha.getByRole('checkbox', { name: 'Externalidades' })).toHaveProperty(
      'checked',
      true,
    );
  });

  it('desmarcar "é um tema de risco" NÃO apaga os riscos associados', async () => {
    // Limpar ali trocaria dado invisível por dado DESTRUÍDO: quem desmarca por
    // engano e salva perde o enquadramento sem aviso. Tirar um risco é
    // desmarcá-lo na própria lista, que é visível e reversível.
    const usuario = userEvent.setup();
    render(<CadastroDeAssuntos />);
    await pronto();

    await usuario.click(
      screen.getByRole('button', { name: /Editar Qualidade da água/ }),
    );
    const linha = emEdicao();

    await usuario.click(linha.getByRole('checkbox', { name: /Este é um tema de risco/ }));

    // A seção continua lá, com o risco ainda marcado.
    expect(linha.getByText('Risco(s) associado(s)')).toBeTruthy();
    expect(linha.getByRole('checkbox', { name: 'Saúde e Segurança' })).toHaveProperty(
      'checked',
      true,
    );
  });
});

describe('o LSO deixou de ser obrigatório', () => {
  it('o campo explica por que pode ficar vazio', async () => {
    render(<CadastroDeAssuntos />);
    await pronto();
    expect(
      await screen.findByText(/não define LSO para 47 dos 104 subtemas/),
    ).toBeTruthy();
  });

  it('dá para cadastrar com pilar e tema estratégico, sem LSO e sem risco', async () => {
    // A taxonomia deixa 47 dos 104 subtemas sem LSO e 4 sem enquadramento de
    // risco. Exigir qualquer um dos dois travaria classificação que a planilha
    // considera completa. Pilar e Tema estratégico seguem exigidos: a planilha
    // os preenche em 104 de 104.
    const usuario = userEvent.setup();
    render(<CadastroDeAssuntos />);
    await pronto();

    const botao = screen.getByRole('button', { name: /^Cadastrar$/ });
    expect(botao).toHaveProperty('disabled', true);

    await usuario.type(screen.getByPlaceholderText('Reajuste tarifário'), 'Assunto novo');
    await usuario.selectOptions(screen.getByRole('combobox', { name: /Pilar/ }), '1');
    await usuario.selectOptions(
      screen.getByRole('combobox', { name: /Tema estratégico/ }),
      '1',
    );

    expect(botao).toHaveProperty('disabled', false);
  });
});
