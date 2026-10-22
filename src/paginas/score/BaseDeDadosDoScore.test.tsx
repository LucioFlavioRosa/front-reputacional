// @vitest-environment jsdom

/** A Base de dados dos KPIs: as menções na fonte, para consulta. */

import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { MencaoDaBase, OpcoesDaBase } from '@/api/cliente';
import { colunasDaBase, csvDaBase, periodoDoAtalho } from '@/dominio/baseDasLentes';

const mencao = (extra: Partial<MencaoDaBase>): MencaoDaBase => ({
  id: 'm1', data: '2026-08-20', mes: '2026-08', fonte: 'Clipei', fonte_no_calculo: true,
  veiculo: 'Folha de S.Paulo', instituicao_id: null, tier: 'muito_relevante', sentimento: 'neg', atributo: null,
  tema: 'Abastecimento', tema_n1: null, tema_n2: null, tema_n3: null, subtema: null,
  empresa: 'Águas do Rio', uf: 'RJ', autor: 'Ana Lima', perfil_autor: null, engajamento: null,
  publico_alvo: null, titulo: 'Falta d’água em São Gonçalo', link: 'https://folha.com/x',
  ...extra,
});

const OPCOES: OpcoesDaBase = {
  fontes: ['Clipei'], sentimentos: ['neg', 'pos'], tiers: ['muito_relevante'], veiculos: ['Folha de S.Paulo'],
  atributos: [], temas: ['Abastecimento'], temas_n1: [], temas_n2: [], temas_n3: [], subtemas: [],
  empresas: ['Águas do Rio'], ufs: ['RJ'], autores: ['Ana Lima'], perfis: [],
};

const listar = vi.fn();
//: O JORNALISTA busca os interlocutores uma vez, ao montar — sem isto, todo
//: teste deste arquivo quebraria no `useEffect` por chamar `undefined()`.
//: Expostos fora da fábrica do mock para os testes de edição poderem mudar o
//: que cada um devolve.
const listarInterlocutoresMock = vi.fn(() => Promise.resolve([] as unknown[]));
const editarJornalistaMock = vi.fn((_id: string, _interlocutorId: string | null) =>
  Promise.resolve({ autor: null as string | null }),
);
vi.mock('@/api/cliente', () => ({
  listarMencoesDaBase: (...args: unknown[]) => listar(...args),
  obterOpcoesDaBase: vi.fn(() => Promise.resolve(OPCOES)),
  listarInterlocutores: () => listarInterlocutoresMock(),
  editarJornalistaDaMencao: (id: string, interlocutorId: string | null) =>
    editarJornalistaMock(id, interlocutorId),
}));

describe('BaseDeDadosDoScore', () => {
  beforeEach(() => {
    window.localStorage.clear();
    listar.mockReset();
    listar.mockResolvedValue({ itens: [mencao({})], total: 1, pagina: 1, tamanho: 50 });
    listarInterlocutoresMock.mockReset().mockResolvedValue([]);
    editarJornalistaMock.mockReset().mockResolvedValue({ autor: null });
  });

  it('lista as menções da lente com o link para a matéria', async () => {
    const { BaseDeDadosDoScore } = await import('@/paginas/score/BaseDeDadosDoScore');
    render(<BaseDeDadosDoScore />);
    await waitFor(() => expect(screen.getByText('Falta d’água em São Gonçalo')).toBeTruthy());
    const link = screen.getByRole('link', { name: 'Abrir matéria ↗' });
    expect(link.getAttribute('href')).toBe('https://folha.com/x');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(screen.getByText('1 menção')).toBeTruthy();
  });

  it('não tem faixa de filtros rápidos (por enquanto): só busca e período', async () => {
    const { BaseDeDadosDoScore } = await import('@/paginas/score/BaseDeDadosDoScore');
    render(<BaseDeDadosDoScore />);
    await waitFor(() => expect(screen.getByText('Falta d’água em São Gonçalo')).toBeTruthy());
    expect(screen.queryByText('Filtros:')).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Buscar nas menções' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '90 dias' })).toBeTruthy();
  });

  it('abre com o layout ajustado: TODA coluna tem largura, e o texto longo não invade a vizinha', async () => {
    const { BaseDeDadosDoScore } = await import('@/paginas/score/BaseDeDadosDoScore');
    const { container } = render(<BaseDeDadosDoScore />);
    await waitFor(() => expect(screen.getByText('Falta d’água em São Gonçalo')).toBeTruthy());
    const colunas = [...container.querySelectorAll('col')] as HTMLElement[];
    expect(colunas.length).toBeGreaterThan(5);
    expect(colunas.every((col) => Number.parseInt(col.style.width, 10) >= 60)).toBe(true);
    // O VEÍCULO PASSOU DE UMA LINHA PARA DUAS, e isto reverte uma decisão que
    // estava escrita aqui ("o veículo é de uma linha só, cortado com reticências
    // dentro da própria coluna"). O que mudou foi a MEDIDA, na base de 28.617
    // menções: a coluna tem 140px e cabiam ~20 caracteres; 918 dos 3.729
    // veículos passam disso, e QUARENTA E DOIS veículos diferentes começam com
    // "Prefeitura Municipal" — nos vinte primeiros caracteres os 42 apareciam
    // idênticos, e a pessoa via 42 linhas que pareciam o mesmo veículo. As
    // reticências estavam no pior lugar possível, porque o que distingue esses
    // nomes é o FIM.
    //
    // DUAS LINHAS mostram ~40 caracteres, que é onde eles se separam. O `title`
    // continua com o valor inteiro, e a coluna continua arrastável para quem
    // quiser mais.
    //
    // PARA VOLTAR: tire `Veículo`, `Rede` e `Canal` de `LINHAS_DA_COLUNA`, em
    // `dominio/baseDasLentes.ts`. É uma linha.
    const celulaDoVeiculo = screen.getByText('Folha de S.Paulo').closest('td')!;
    expect(celulaDoVeiculo.getAttribute('title')).toBe('Folha de S.Paulo');
    // E O TEXTO NÃO INVADE A VIZINHA, que é o que a asserção antiga protegia: o
    // `overflow: hidden` agora vem da classe, junto do limite de duas linhas.
    expect(celulaDoVeiculo.style.whiteSpace).toBe('normal');

    // O LIMITE VIVE NUM EMBRULHO DENTRO DA CÉLULA, nunca na célula.
    //
    // `-webkit-line-clamp` só age com `display: -webkit-box`, e esse `display`
    // num `<td>` substitui o `table-cell`: a célula sai do modelo nativo da
    // tabela e passa a brigar com o `<colgroup>` e o `table-layout: fixed`.
    // Achado de revisão, e esta asserção é o que impede a volta.
    //
    // E ELA PERGUNTA PELA INTENÇÃO, não por "o `td` não tem classe nenhuma":
    // uma classe legítima e sem relação com isto (um `tabular`, digamos)
    // derrubaria o teste sem que nada tivesse quebrado.
    expect(celulaDoVeiculo.classList.contains('duas-linhas')).toBe(false);
    const embrulho = screen.getByText('Folha de S.Paulo');
    expect(embrulho.tagName).toBe('SPAN');
    expect(embrulho.classList.contains('duas-linhas')).toBe(true);

    // E NENHUM `display` EM LINHA NOS EMBRULHOS LIMITADOS.
    //
    // Este é o defeito mais silencioso dos três, e ele estava vivo: o embrulho
    // do título tinha `style={{ display: 'block' }}`, e estilo em linha vence a
    // classe. Isso desligava o `display: -webkit-box` de que o
    // `-webkit-line-clamp` depende, então o limite de três linhas NÃO AGIA — a
    // célula de 39 linhas continuava inteira, e nada no código denunciava.
    //
    // O `display` vem só da classe, e o CSS gerado por `npm run build` preserva
    // `display:-webkit-box` nela (conferido). Qualquer `display` em linha aqui
    // é um limite desligado.
    const limitados = [...container.querySelectorAll('.tres-linhas, .duas-linhas')];
    expect(limitados.length).toBeGreaterThan(0);
    for (const alvo of limitados as HTMLElement[]) {
      expect(alvo.style.display).toBe('');
    }
    // A dica de como ajustar está à vista.
    expect(screen.getByText(/Arraste a borda de um cabeçalho/)).toBeTruthy();
  });

  it('a busca vai ao servidor depois que a pessoa para de digitar', async () => {
    const { BaseDeDadosDoScore } = await import('@/paginas/score/BaseDeDadosDoScore');
    render(<BaseDeDadosDoScore />);
    await userEvent.type(screen.getByRole('textbox', { name: 'Buscar nas menções' }), 'agua');
    await waitFor(() =>
      expect(listar).toHaveBeenLastCalledWith('imprensa', expect.objectContaining({ q: 'agua', pagina: 1 })),
    );
  });

  it('Institucional CONSULTA a base, como qualquer outra lente', async () => {
    /** DEFEITO VISTO NO AMBIENTE, e este teste fixava o avesso dele.
     *
     *  A tela tinha `lente !== 'institucional'` e, nessa aba, mostrava no lugar
     *  da base um texto dizendo que a Institucional lia o CRM dos Stakeholders.
     *  Isso era verdade até a `0107`/`0108`, quando a lente passou a recortar a
     *  Imprensa pela lista de veículos: ela virou clipping e o back a pôs em
     *  `LENTES_DA_BASE` — e esta tela continuou recusando a consulta.
     *
     *  A REGRA ERA DUPLICADA: o back decide por `lente_e_interna`, pelo cadastro
     *  das fontes; a cópia aqui decidia pelo código da lente. O teste antigo
     *  passava porque media a cópia, e não o que a pessoa vê. */
    const { BaseDeDadosDoScore } = await import('@/paginas/score/BaseDeDadosDoScore');
    //: UMA RESPOSTA DISTINTIVA PARA A ABA, e não a tabela por si — achado da
    //: revisão desta correção: `findByRole('table')` passaria mesmo sem
    //: resposta, porque a tabela é montada antes de a leitura chegar. O que
    //: prova a aba é uma LINHA que só a Institucional devolveria.
    listar.mockImplementation((lente: string) =>
      Promise.resolve({
        itens: [
          mencao(
            lente === 'institucional'
              ? { id: 'mi', titulo: 'Audiência pública na ARSESP', veiculo: 'Valor Econômico' }
              : {},
          ),
        ],
        total: 1,
        pagina: 1,
        tamanho: 50,
      }),
    );
    render(<BaseDeDadosDoScore />);
    await userEvent.click(screen.getByRole('tab', { name: 'Institucional' }));

    await waitFor(() =>
      expect(listar).toHaveBeenLastCalledWith('institucional', expect.anything()),
    );
    //: A LINHA DA INSTITUCIONAL NA TELA, dentro da tabela.
    const celula = await screen.findByText('Audiência pública na ARSESP');
    expect(celula.closest('table')).toBeTruthy();
    //: E O TEXTO DO CRM NÃO APARECE MAIS EM LUGAR NENHUM.
    expect(screen.queryByText(/CRM dos Stakeholders/)).toBeNull();
  });
});

describe('editar o jornalista', () => {
  beforeEach(() => {
    window.localStorage.clear();
    listarInterlocutoresMock.mockReset().mockResolvedValue([
      { id: 'i1', nome: 'Dani Souza', instituicao_id: 'globo', ativo: true },
      { id: 'i2', nome: 'Ana Lima', instituicao_id: 'folha', ativo: true },
    ]);
    editarJornalistaMock.mockReset().mockResolvedValue({ autor: 'Dani Souza' });
  });

  it('sem veículo cadastrado, o nome é só texto — sem botão de editar', async () => {
    listar.mockReset().mockResolvedValue({
      itens: [mencao({ instituicao_id: null, autor: 'Alguém' })],
      total: 1, pagina: 1, tamanho: 50,
    });
    const { BaseDeDadosDoScore } = await import('@/paginas/score/BaseDeDadosDoScore');
    render(<BaseDeDadosDoScore />);
    await waitFor(() => expect(screen.getByText('Alguém')).toBeTruthy());
    expect(screen.queryByRole('button', { name: /Alguém/ })).toBeNull();
  });

  it('com veículo cadastrado, clicar abre a busca só com quem está naquela instituição', async () => {
    listar.mockReset().mockResolvedValue({
      itens: [mencao({ instituicao_id: 'globo', autor: null })],
      total: 1, pagina: 1, tamanho: 50,
    });
    const { BaseDeDadosDoScore } = await import('@/paginas/score/BaseDeDadosDoScore');
    render(<BaseDeDadosDoScore />);
    const usuario = userEvent.setup();

    const botao = await screen.findByRole('button', { name: /Vincular jornalista/ });
    await usuario.click(botao);

    const campo = await screen.findByRole('combobox', { name: /Jornalista de/ });
    await usuario.click(campo);
    expect(await screen.findByText('Dani Souza')).toBeTruthy();
    expect(screen.queryByText('Ana Lima')).toBeNull(); // é da Folha, outra instituição
  });

  it('escolher um nome salva e recarrega a página', async () => {
    listar.mockReset().mockResolvedValue({
      itens: [mencao({ instituicao_id: 'globo', autor: null })],
      total: 1, pagina: 1, tamanho: 50,
    });
    const { BaseDeDadosDoScore } = await import('@/paginas/score/BaseDeDadosDoScore');
    render(<BaseDeDadosDoScore />);
    const usuario = userEvent.setup();

    await usuario.click(await screen.findByRole('button', { name: /Vincular jornalista/ }));
    const campo = await screen.findByRole('combobox', { name: /Jornalista de/ });
    await usuario.click(campo);
    await usuario.click(await screen.findByText('Dani Souza'));

    await waitFor(() => expect(editarJornalistaMock).toHaveBeenCalledWith('m1', 'i1'));
    // A TELA RECARREGA DO SERVIDOR, e não corrige a linha sozinha — por isso a
    // segunda chamada a `listar` é o que faz o nome aparecer de novo.
    await waitFor(() => expect(listar).toHaveBeenCalledTimes(2));
  });

  it('cancelar fecha sem salvar', async () => {
    listar.mockReset().mockResolvedValue({
      itens: [mencao({ instituicao_id: 'globo', autor: null })],
      total: 1, pagina: 1, tamanho: 50,
    });
    const { BaseDeDadosDoScore } = await import('@/paginas/score/BaseDeDadosDoScore');
    render(<BaseDeDadosDoScore />);
    const usuario = userEvent.setup();

    await usuario.click(await screen.findByRole('button', { name: /Vincular jornalista/ }));
    await usuario.click(await screen.findByRole('button', { name: 'Cancelar edição do jornalista' }));

    expect(screen.queryByRole('combobox', { name: /Jornalista de/ })).toBeNull();
    expect(editarJornalistaMock).not.toHaveBeenCalled();
    expect(await screen.findByRole('button', { name: /Vincular jornalista/ })).toBeTruthy();
  });
});

describe('domínio da Base', () => {
  it('o CSV leva as colunas pedidas, com aspas e ";"', () => {
    const colunas = colunasDaBase('imprensa').filter((c) => ['Data', 'Veículo', 'Sentimento'].includes(c.rotulo));
    expect(csvDaBase([mencao({})], colunas)).toBe('"Data";"Veículo";"Sentimento"\r\n"20/08/2026";"Folha de S.Paulo";"Negativo"');
  });

  it('o nome da coluna de fonte muda por lente', () => {
    expect(colunasDaBase('sociedade').map((c) => c.rotulo)).toContain('Rede');
    expect(colunasDaBase('imprensa').map((c) => c.rotulo)).toContain('Jornalista');
  });

  it('o atalho de período vira datas; "tudo" não limita', () => {
    expect(periodoDoAtalho('tudo')).toEqual({});
    expect(periodoDoAtalho('30', new Date('2026-10-09T12:00:00Z'))).toEqual({ de: '2026-09-09', ate: '2026-10-09' });
  });
});
