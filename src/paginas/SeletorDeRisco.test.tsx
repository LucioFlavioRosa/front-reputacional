// @vitest-environment jsdom

/** Os três campos de risco: Risk cluster → Risk → Severity.
 *
 *  O COMPONENTE DE VERDADE, e isto é o ponto deste arquivo. A primeira versão
 *  deste teste reimplementava a lógica do seletor num dublê e media o dublê —
 *  passaria com o `SeletorDeRisco` inteiramente quebrado. Aqui só o `useState`
 *  em volta e o checkbox (três linhas, que moram na página) são de mentira; a
 *  cascata, a severidade e a leitura do cluster vêm do componente importado.
 *
 *  A INVARIANTE SOB TESTE: no `Risk tracking map` os 32 riscos são distintos e
 *  cada um determina o seu cluster e a sua severidade. Por isso a tela pede UMA
 *  escolha e mostra três campos.
 *
 *  OS CASOS QUE IMPORTAM, e cada um é um jeito de a tela se contradizer:
 *
 *    trocar de cluster       um risco de outro cluster ainda selecionado deixaria
 *                            os três campos se contradizendo — cluster A com
 *                            risco de B.
 *
 *    desmarcar o checkbox    um risco gravado atrás de um campo escondido é como
 *                            o painel passa a afirmar o que ninguém vê.
 *
 *    abrir um já enquadrado  `tema` guarda só `risco_id`; o cluster se lê do
 *                            risco. Se o componente esperasse o cluster de
 *                            fora, a lista de riscos abriria vazia na edição.
 *
 *    severidade              não é escolhida: a planilha a determina por risco.
 *                            Um campo editável criaria divergência com a fonte
 *                            que ninguém reconciliaria depois.
 */

import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import type { RascunhoDeTema } from '@/paginas/CadastroDeAssuntos';
import { SeletorDeRisco } from '@/paginas/CadastroDeAssuntos';
import type { RiscoReputacional } from '@/dominio/tipos';

/** Um recorte do mapa com a MESMA forma: dois clusters, três riscos, as três
 *  severidades. Pequeno de propósito — o que está sob teste é a mecânica, e 32
 *  linhas só tornariam a falha mais difícil de ler.
 */
const RISCOS: RiscoReputacional[] = [
  { id: 1, cluster: 'Riscos Operacionais', nome: 'Qualidade da água', severidade: 'alto' },
  { id: 2, cluster: 'Riscos Operacionais', nome: 'Continuidade do serviço', severidade: 'critico' },
  { id: 3, cluster: 'Riscos ESG', nome: 'Licenciamento ambiental', severidade: 'moderado' },
];

const BASE: RascunhoDeTema = {
  nome: 'Assunto de teste',
  nivel: 'gerais',
  e_risco: false,
  bloco_tema_id: null,
  macro_tema_id: null,
  camada_lso: '',
  risco_id: null,
  cluster: '',
};

/** O `useState` e o checkbox da página em volta do componente de verdade. */
function Em({ inicial }: { inicial: RascunhoDeTema }) {
  const [r, definirR] = useState(inicial);
  return (
    <>
      <label>
        <span>e risco</span>
        <input
          type="checkbox"
          checked={r.e_risco}
          onChange={(e) =>
            definirR(
              e.target.checked
                ? { ...r, e_risco: true }
                : { ...r, e_risco: false, risco_id: null, cluster: '' },
            )
          }
        />
      </label>
      {r.e_risco ? (
        <SeletorDeRisco riscos={RISCOS} rascunho={r} aoMudar={definirR} />
      ) : null}
      <output>{JSON.stringify({ e_risco: r.e_risco, risco_id: r.risco_id })}</output>
    </>
  );
}

// Nome EXATO, e nao regex: `Campo` monta o nome acessivel com o rotulo (mais a
// `dica`, quando ha uma), e `/^Risk/` casava com "Risk cluster" tambem — o erro
// foi "found multiple elements". Dois campos cujo nome de um e prefixo do outro
// precisam de igualdade.
const combo = (nome: string | RegExp) =>
  screen.getByRole('combobox', { name: nome }) as HTMLSelectElement;
const severidade = () => screen.getByRole('textbox', { name: /Severity/ }) as HTMLInputElement;
const gravado = () => JSON.parse(screen.getByRole('status').textContent ?? '{}');

describe('SeletorDeRisco', () => {
  it('escolher o risco preenche a severidade sozinho', async () => {
    const usuario = userEvent.setup();
    render(<Em inicial={{ ...BASE, e_risco: true }} />);

    await usuario.selectOptions(combo(/Risk cluster/), 'Riscos Operacionais');
    await usuario.selectOptions(combo('Risk'), '2');

    expect(severidade().value).toBe('Crítico');
    expect(gravado().risco_id).toBe(2);
  });

  it('o campo de risco fica travado até o cluster ser escolhido', () => {
    render(<Em inicial={{ ...BASE, e_risco: true }} />);
    expect(combo('Risk').disabled).toBe(true);
  });

  it('a lista de riscos é só a do cluster escolhido', async () => {
    const usuario = userEvent.setup();
    render(<Em inicial={{ ...BASE, e_risco: true }} />);

    await usuario.selectOptions(combo(/Risk cluster/), 'Riscos ESG');
    const opcoes = [...combo('Risk').querySelectorAll('option')]
      .map((o) => o.textContent)
      .filter((x) => x !== '— selecione —');
    expect(opcoes).toEqual(['Licenciamento ambiental']);
  });

  it('trocar de cluster SOLTA o risco, para os três campos não se contradizerem', async () => {
    const usuario = userEvent.setup();
    render(<Em inicial={{ ...BASE, e_risco: true }} />);

    await usuario.selectOptions(combo(/Risk cluster/), 'Riscos Operacionais');
    await usuario.selectOptions(combo('Risk'), '1');
    expect(gravado().risco_id).toBe(1);

    await usuario.selectOptions(combo(/Risk cluster/), 'Riscos ESG');
    expect(gravado().risco_id).toBeNull();
    expect(severidade().value).toBe('');
  });

  it('abrir um assunto JÁ enquadrado mostra cluster, risco e severidade', () => {
    // `cluster` vazio de propósito: é o que vem do back, porque `tema` guarda só
    // `risco_id`. O componente lê o cluster do risco — sem isso, a lista abriria
    // vazia e a pessoa teria de reescolher para ver o que já estava gravado.
    render(<Em inicial={{ ...BASE, e_risco: true, risco_id: 3 }} />);

    expect(combo(/Risk cluster/).value).toBe('Riscos ESG');
    expect(combo('Risk').value).toBe('3');
    expect(severidade().value).toBe('Moderado');
  });

  it('a severidade não é editável', () => {
    render(<Em inicial={{ ...BASE, e_risco: true, risco_id: 1 }} />);
    expect(severidade().readOnly).toBe(true);
  });

  it('sem riscos no catálogo, o seletor abre vazio em vez de estourar', () => {
    // Back anterior à 0060 não manda `riscos_reputacionais`; a página passa `[]`.
    render(
      <SeletorDeRisco
        riscos={[]}
        rascunho={{ ...BASE, e_risco: true }}
        aoMudar={() => {}}
      />,
    );
    expect(combo(/Risk cluster/).querySelectorAll('option')).toHaveLength(1);
  });
});

describe('o checkbox que abre os três campos', () => {
  it('só mostra o seletor depois de marcar que é tema de risco', async () => {
    const usuario = userEvent.setup();
    render(<Em inicial={BASE} />);

    expect(screen.queryByRole('combobox', { name: /Risk cluster/ })).toBeNull();
    await usuario.click(screen.getByRole('checkbox'));
    expect(combo(/Risk cluster/)).toBeTruthy();
  });

  it('desmarcar apaga o enquadramento, e não só o esconde', async () => {
    const usuario = userEvent.setup();
    render(<Em inicial={{ ...BASE, e_risco: true, risco_id: 3 }} />);
    expect(gravado().risco_id).toBe(3);

    await usuario.click(screen.getByRole('checkbox'));

    expect(screen.queryByRole('combobox', { name: 'Risk' })).toBeNull();
    expect(gravado()).toEqual({ e_risco: false, risco_id: null });
  });
});
