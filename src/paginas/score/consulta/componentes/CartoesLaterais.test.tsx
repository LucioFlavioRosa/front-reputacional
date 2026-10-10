// @vitest-environment jsdom
import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DADOS } from '../dados/dados';
import type { Item, Lente, Tema } from '../dados/tipos';
import type { AlvoDaPrevia } from './apoioDosCartoes';
import {
  acharItem,
  acharSubtemaDoDestino,
  nomeDoMes,
  pilarNavegavelPeloNome,
  urlSegura,
} from './apoioDosCartoes';
import { CartaoDeRecortes } from './CartaoDeRecortes';
import { CartoesLaterais } from './CartoesLaterais';
import { ModalDePrevia } from './ModalDePrevia';

function lente(id: string): Lente {
  const l = DADOS.lentes.find((x) => x.id === id);
  if (!l) throw new Error(id);
  return l;
}

const IMPRENSA = lente('imprensa');
const MERCADO = lente('mercado');

function temaComRecortes(): Tema {
  const tema = IMPRENSA.pilares.flatMap((p) => p.filhos ?? []).find((t) => t.id === 'abastecimento-agua');
  if (!tema) throw new Error('tema');
  return tema;
}

function cartaoComKicker(kicker: string): HTMLElement {
  const el = screen.getByText(kicker).closest('.cartao');
  if (!el) throw new Error(kicker);
  return el as HTMLElement;
}

describe('apoio dos cartões', () => {
  it('nomeDoMes deriva com segurança', () => {
    expect(nomeDoMes('Agosto de 2026')).toBe('agosto');
    expect(nomeDoMes('Setembro')).toBe('setembro');
    expect(nomeDoMes('')).toBe('');
  });

  it('acha item, subtema de destino e só pilar navegável pelo nome', () => {
    expect(acharItem(IMPRENSA, 'rom-01')?.veiculo).toBe('O Globo');
    expect(acharItem(IMPRENSA, 'nao-existe')).toBeUndefined();
    expect(
      acharSubtemaDoDestino(IMPRENSA, { pilar: 'eficiencia-operacional', tema: 'abastecimento-agua', subtema: 'rompimento-adutora' })?.volume,
    ).toBe(96);
    expect(acharSubtemaDoDestino(IMPRENSA, { pilar: 'x', tema: 'y', subtema: 'z' })).toBeUndefined();
    expect(pilarNavegavelPeloNome(IMPRENSA, 'Governança')?.id).toBeDefined();
    expect(pilarNavegavelPeloNome(MERCADO, 'Governança')).toBeUndefined();
    expect(pilarNavegavelPeloNome(IMPRENSA, 'Pilar que não existe')).toBeUndefined();
  });

  it('urlSegura só aceita http(s)', () => {
    expect(urlSegura(null)).toBeNull();
    expect(urlSegura('#')).toBeNull();
    expect(urlSegura('javascript:alert(1)')).toBeNull();
    expect(urlSegura('https://exemplo.com/a')).toBe('https://exemplo.com/a');
  });
});

describe('CartoesLaterais · Imprensa', () => {
  it('"O que mudou" não afirma a nota (D1): sem 48, 42 e sem o título', () => {
    render(<CartoesLaterais lente={IMPRENSA} aoIr={vi.fn()} aoAbrirItem={vi.fn()} />);
    const cartao = cartaoComKicker('O que mudou desde julho');
    expect(within(cartao).queryByText(/A nota caiu/)).toBeNull();
    // O único cabeçalho é o próprio kicker (navegação por títulos), sem texto novo.
    const cabecalhos = within(cartao).getAllByRole('heading');
    expect(cabecalhos.map((h) => h.textContent)).toEqual(['O que mudou desde julho']);
    expect(cabecalhos[0]).toHaveClass('kicker');
    expect(cartao.textContent).not.toMatch(/\b48\b/);
    expect(cartao.textContent).not.toMatch(/\b42\b/);
    expect(cartao.textContent).not.toContain('→');
    // Linhas na ordem do JSON, com a barra compacta, e a nota de rodapé. A
    // barra NÃO se chama "Impacto na nota": o valor é a variação desde julho.
    const barras = within(cartao).getAllByRole('img');
    const linhas = IMPRENSA.cartoesLaterais.find((c) => c.tipo === 'oQueMudou');
    if (linhas?.tipo !== 'oQueMudou') throw new Error('oQueMudou');
    expect(barras.map((b) => b.getAttribute('aria-label'))).toEqual(
      linhas.linhas.map((l, i) => `${l.rotulo}: ${['−2,8', '−2,1', '−0,9', '−0,4', '+0,1', '+0,1', '0,0'][i]} pt`),
    );
    expect(barras.some((b) => /Impacto na nota/.test(b.getAttribute('aria-label') ?? ''))).toBe(false);
    const nota = within(cartao).getByText(/Governança saiu de/);
    expect(nota.style.fontSize).toBe('13px');
    expect(within(cartao).getByRole('button', { name: 'Baixar "O que mudou desde julho" em PNG' })).toBeInTheDocument();
  });

  it('o nome do pilar é link só quando o pilar é navegável (A16)', async () => {
    const aoIr = vi.fn();
    const pilares = IMPRENSA.pilares.map((p) => ({ ...p }));
    // Um pilar sem temas: deixa de ser navegável e vira texto comum.
    const semTemas = pilares.find((p) => p.nome === 'Inovação e Tecnologia');
    if (!semTemas) throw new Error('pilar');
    semTemas.filhos = [];
    const lenteAjustada: Lente = { ...IMPRENSA, pilares };
    render(<CartoesLaterais lente={lenteAjustada} aoIr={aoIr} aoAbrirItem={vi.fn()} />);
    const cartao = cartaoComKicker('O que mudou desde julho');

    const link = within(cartao).getByRole('link', { name: 'Governança' });
    const governanca = IMPRENSA.pilares.find((p) => p.nome === 'Governança');
    expect(link).toHaveAttribute('href', `#consulta&lente=imprensa&pilar=${governanca?.id}`);
    expect(within(cartao).queryByRole('link', { name: 'Inovação e Tecnologia' })).toBeNull();
    expect(within(cartao).getByText('Inovação e Tecnologia').tagName).not.toBe('A');
    expect(within(cartao).getAllByRole('link')).toHaveLength(6);

    await userEvent.click(link);
    expect(aoIr).toHaveBeenCalledWith({ ativo: true, lente: 'imprensa', pilar: governanca?.id });
  });

  it('"A história do mês": item, "Ver as 96 matérias" com o destino e "Abrir matéria"', async () => {
    const aoIr = vi.fn();
    const aoAbrirItem = vi.fn();
    render(<CartoesLaterais lente={IMPRENSA} aoIr={aoIr} aoAbrirItem={aoAbrirItem} />);
    const cartao = cartaoComKicker('A história do mês');
    expect(within(cartao).getByRole('heading', { name: 'Rompimento de adutora na Zona Norte do Rio' })).toBeInTheDocument();
    expect(within(cartao).getByText('O Globo · 12/08/2026')).toBeInTheDocument();
    expect(within(cartao).getByText('Negativo')).toBeInTheDocument();
    expect(within(cartao).getByText('Tier 1')).toBeInTheDocument();
    const negativa = within(cartao).getByText('pontos na nota').closest('li');
    expect(negativa?.getAttribute('style')).toContain('var(--erro-bg)');
    expect(within(cartao).getByText('matérias').closest('li')?.getAttribute('style')).toContain('var(--bg-app)');

    const ver = within(cartao).getByRole('link', { name: 'Ver as 96 matérias' });
    expect(ver).toHaveAttribute(
      'href',
      '#consulta&lente=imprensa&pilar=eficiencia-operacional&tema=abastecimento-agua&subtema=rompimento-adutora',
    );
    expect(ver).toHaveClass('sem-png', 'sem-impressao');
    await userEvent.click(ver);
    expect(aoIr).toHaveBeenCalledWith({
      ativo: true,
      lente: 'imprensa',
      pilar: 'eficiencia-operacional',
      tema: 'abastecimento-agua',
      subtema: 'rompimento-adutora',
    });

    const abrir = within(cartao).getByRole('button', { name: 'Abrir matéria' });
    await userEvent.click(abrir);
    expect(aoAbrirItem).toHaveBeenCalledTimes(1);
    expect((aoAbrirItem.mock.calls[0][0] as Item).id).toBe('rom-01');
    expect(aoAbrirItem.mock.calls[0][1]).toBe(abrir);
  });

  it('item ou destino que não existem não quebram o cartão', () => {
    const historia = IMPRENSA.cartoesLaterais.find((c) => c.tipo === 'historia');
    if (!historia || historia.tipo !== 'historia') throw new Error('historia');
    const quebrada: Lente = {
      ...IMPRENSA,
      cartoesLaterais: [{ ...historia, itemId: 'x', destino: { ...historia.destino, subtema: 'y' } }],
    };
    render(<CartoesLaterais lente={quebrada} aoIr={vi.fn()} aoAbrirItem={vi.fn()} />);
    expect(screen.getByText('A história do mês')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Abrir matéria' })).toBeNull();
    expect(screen.queryByRole('link', { name: /Ver as/ })).toBeNull();
  });
});

describe('CartoesLaterais · Mercado e demais', () => {
  it('divergentes: kicker, título, subtítulo e barras compactas na ordem do JSON', () => {
    render(<CartoesLaterais lente={MERCADO} aoIr={vi.fn()} aoAbrirItem={vi.fn()} />);
    const cartao = cartaoComKicker('Temas financeiros');
    expect(within(cartao).getByRole('heading', { name: /Rating e resultado explicam/ })).toBeInTheDocument();
    expect(within(cartao).getByText(/Tarifa é o tema a vigiar/)).toBeInTheDocument();
    expect(within(cartao).getAllByRole('img').map((b) => b.getAttribute('aria-label'))).toEqual([
      'Impacto na nota: +5,1 pt',
      'Impacto na nota: +4,0 pt',
      'Impacto na nota: +2,1 pt',
      'Impacto na nota: +1,6 pt',
      'Impacto na nota: −0,4 pt',
    ]);
  });

  it('eventos: selo com o texto do JSON, meta, título e nota só quando houver', () => {
    render(<CartoesLaterais lente={MERCADO} aoIr={vi.fn()} aoAbrirItem={vi.fn()} />);
    const cartao = cartaoComKicker('Sinais do mercado no mês');
    expect(within(cartao).getByText('Sem nova leitura')).toBeInTheDocument();
    expect(within(cartao).getByText('Positivo')).toBeInTheDocument();
    expect(within(cartao).getByText('18/08/2026 · evento de rating').style.fontSize).toBe('12px');
    expect(within(cartao).getByText('Rating nacional reafirmado em AA, perspectiva estável').style.fontSize).toBe('14px');
    expect(within(cartao).getByText(/Evento ilustrativo/).style.fontSize).toBe('12px');
    expect(within(cartao).getAllByRole('listitem')).toHaveLength(2);
    expect(within(cartao).getAllByText(/Evento ilustrativo/)).toHaveLength(1);
  });

  it('desenha tabela, post, saldos e contagens e ignora tipo desconhecido', () => {
    const outras = ['sociedade', 'clientes', 'institucional'].flatMap((id) => lente(id).cartoesLaterais);
    const desconhecido = { tipo: 'futuro', rotulo: 'Não sei' } as unknown as Lente['cartoesLaterais'][number];
    const mista: Lente = { ...MERCADO, cartoesLaterais: [...outras, desconhecido] };
    const aoAbrirPost = vi.fn();
    render(<CartoesLaterais lente={mista} aoIr={vi.fn()} aoAbrirItem={vi.fn()} aoAbrirPost={aoAbrirPost} />);
    expect(screen.getByText('Quem fala')).toBeInTheDocument();
    expect(screen.getByText('O que viralizou')).toBeInTheDocument();
    expect(screen.getByText('Instagram · 14/08 · Águas do Pará · PA')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver post' })).toBeInTheDocument();
    expect(screen.getByText('Onde o clima está mais tenso')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Saldo de clima −56' })).toBeInTheDocument();
    expect(screen.getByText('Conversas negativas com o regulador')).toBeInTheDocument();
    expect(screen.queryByText('Não sei')).toBeNull();
    expect(document.querySelectorAll('.cartao')).toHaveLength(outras.length);
  });
});

describe('CartaoDeRecortes', () => {
  it('cabeçalho, botão com o volume do subtema e quatro quadros', async () => {
    const aoVerMaterias = vi.fn();
    render(<CartaoDeRecortes tema={temaComRecortes()} aoVerMaterias={aoVerMaterias} />);
    expect(screen.getByText('Recortes · Rompimento de adutora em agosto')).toHaveClass('kicker');
    expect(screen.getByRole('heading', { level: 3, name: /A grande imprensa fez o estrago/ })).toBeInTheDocument();
    expect(screen.getByText(/96 matérias, 71 negativas/)).toBeInTheDocument();

    const quadros = screen.getAllByRole('heading', { level: 4 });
    expect(quadros).toHaveLength(4);
    for (const kicker of ['Por tier', 'Concessionária e UF', 'Veículos que mais puxaram o negativo', 'Jornalistas']) {
      expect(screen.getByText(kicker)).toHaveClass('kicker');
    }
    expect(screen.getByText('34 matérias · 35%')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Águas do Rio: 81 matérias, 84% do subtema' })).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader', { name: 'Negat.' })).toHaveLength(2);
    expect(screen.getByRole('rowheader', { name: /Renata Moura\s*O Globo/ })).toBeInTheDocument();

    const botao = screen.getByRole('button', { name: 'Ver as 96 matérias' });
    expect(botao).toHaveClass('sem-png', 'sem-impressao', 'consulta-botao-primario');
    expect(botao.style.background).toBe('');
    expect(botao.style.height).toBe('44px');
    await userEvent.click(botao);
    expect(aoVerMaterias).toHaveBeenCalledWith(expect.objectContaining({ id: 'rompimento-adutora' }));
  });

  it('tema sem destaque não desenha nada', () => {
    const { container } = render(<CartaoDeRecortes tema={{ ...temaComRecortes(), nivel3: undefined }} aoVerMaterias={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});

function ComModal({ alvo }: { alvo: AlvoDaPrevia }) {
  const [aberto, definirAberto] = useState(false);
  return (
    <>
      <button type="button" onClick={() => definirAberto(true)}>
        Abrir matéria
      </button>
      {aberto ? <ModalDePrevia alvo={alvo} aoFechar={() => definirAberto(false)} /> : null}
    </>
  );
}

/** Como a integração: guarda o botão que `aoAbrirItem` entrega e o repassa. */
function ComModalEBotao({ alvo }: { alvo: AlvoDaPrevia }) {
  const [botao, definirBotao] = useState<HTMLElement | null>(null);
  return (
    <>
      <button type="button" onClick={(e) => definirBotao(e.currentTarget)}>
        Abrir matéria
      </button>
      {botao ? <ModalDePrevia alvo={alvo} aoFechar={() => definirBotao(null)} devolverFocoPara={botao} /> : null}
    </>
  );
}

describe('ModalDePrevia', () => {
  const item = acharItem(IMPRENSA, 'rom-01') as Item;

  it('foco volta ao botão que abriu mesmo quando o clique não o focou (Safari/macOS)', () => {
    render(<ComModalEBotao alvo={{ tipo: 'item', item }} />);
    const abrir = screen.getByRole('button', { name: 'Abrir matéria' });
    // `fireEvent.click` não foca o botão, como o Safari: o ativo segue o body.
    fireEvent.click(abrir);
    expect(screen.getByRole('dialog', { name: item.titulo })).toBeInTheDocument();
    expect(abrir).not.toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(abrir).toHaveFocus();
  });

  it('url nula mostra a frase da spec, sem link; Esc fecha e o foco volta', async () => {
    const usuario = userEvent.setup();
    render(<ComModal alvo={{ tipo: 'item', item }} />);
    const abrir = screen.getByRole('button', { name: 'Abrir matéria' });
    await usuario.click(abrir);

    const dialogo = screen.getByRole('dialog', { name: item.titulo });
    expect(within(dialogo).getByText('O Globo · Renata Moura · 12/08/2026')).toBeInTheDocument();
    expect(within(dialogo).getByText('Águas do Rio · RJ')).toBeInTheDocument();
    expect(within(dialogo).getByText('Impacto na nota:', { exact: false }).textContent).toBe('Impacto na nota: −0,12 pt');
    expect(within(dialogo).getByText('O link para a fonte original entra com a integração do clipping.')).toBeInTheDocument();
    expect(within(dialogo).queryByRole('link')).toBeNull();

    await usuario.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(abrir).toHaveFocus();
  });

  it('com url, link que abre noutra aba com rel seguro', () => {
    render(<ModalDePrevia alvo={{ tipo: 'item', item: { ...item, url: 'https://exemplo.com/materia' } }} aoFechar={vi.fn()} />);
    const link = screen.getByRole('link', { name: 'Abrir no site de origem' });
    expect(link).toHaveAttribute('href', 'https://exemplo.com/materia');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.queryByText(/integração do clipping/)).toBeNull();
  });

  it('post: selo de perfil e linha da rede', () => {
    const cartao = lente('sociedade').cartoesLaterais.find((c) => c.tipo === 'post');
    if (!cartao || cartao.tipo !== 'post') throw new Error('post');
    render(<ModalDePrevia alvo={{ tipo: 'post', post: cartao.post, titulo: cartao.titulo }} aoFechar={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: cartao.titulo })).toBeInTheDocument();
    expect(screen.getByText('Instagram · Figura pública · 14/08/2026')).toBeInTheDocument();
    expect(screen.getByText('Figura pública').getAttribute('style')).toContain('var(--atencao-bg)');
    expect(screen.queryByText(/Impacto na nota/)).toBeNull();
  });
});
