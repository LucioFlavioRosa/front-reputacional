// @vitest-environment jsdom

/** A tabela de leitura do dossiê, e o endereço que agora chega nela.
 *
 *  POR QUE ESTE ARQUIVO EXISTE AGORA: a lente Sociedade digital passou a listar
 *  as menções do mês com o LINK de cada uma — a carga do padrão Aegea trouxe o
 *  endereço de 2.208 itens. A célula renderizava `String(valor)`, então a tabela
 *  mostrava a URL inteira como texto: ocupava a largura de três colunas, não se
 *  clicava, e quem quisesse abrir tinha de selecionar e copiar.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TabelaDeLeitura } from '@/graficos/PecasDoDossie';

const COLUNAS = [
  { chave: 'texto', titulo: 'Menção' },
  { chave: 'link', titulo: 'Link' },
];

describe('TabelaDeLeitura', () => {
  it('o endereço vira um link que se abre, e não uma URL escrita', () => {
    render(
      <TabelaDeLeitura
        colunas={COLUNAS}
        linhas={[{ texto: 'Falta água no bairro', link: 'https://instagram.com/p/abc' }]}
      />,
    );

    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('https://instagram.com/p/abc');
    //: EM OUTRA ABA, porque sair do painel para ver um post e perder o recorte
    //: aberto é o tipo de ida que ninguém faz duas vezes.
    expect(link.getAttribute('target')).toBe('_blank');
    //: `noreferrer` junto: a página de destino não precisa saber de onde veio o
    //: clique, e `noopener` fecha a porta que `target="_blank"` abre.
    expect(link.getAttribute('rel')).toContain('noreferrer');
    //: O TEXTO DO LINK É CURTO: a URL inteira ocupava a largura de três colunas.
    expect(link.textContent).not.toContain('instagram.com');
  });

  it('o texto comum continua texto', () => {
    render(
      <TabelaDeLeitura
        colunas={COLUNAS}
        linhas={[{ texto: 'Falta água no bairro', link: null }]}
      />,
    );

    expect(screen.getByText('Falta água no bairro')).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('o que PARECE endereço mas não é fica como texto', () => {
    //: O CRITÉRIO É O ESQUEMA, e não a presença de um ponto: "aegea.com.br" sem
    //: `https://` pode ser o nome de um perfil, e virar link um texto que não é
    //: endereço daria um clique para lugar nenhum.
    render(
      <TabelaDeLeitura
        colunas={COLUNAS}
        linhas={[{ texto: 'perfil', link: 'instagram.com/sem-esquema' }]}
      />,
    );

    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('instagram.com/sem-esquema')).toBeTruthy();
  });
});
