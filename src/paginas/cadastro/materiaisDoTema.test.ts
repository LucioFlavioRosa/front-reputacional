/** Desmarcar um tema não pode levar o trabalho de quem editou a linha.
 *
 *  O QUE ACONTECIA: marcar um tema traz da biblioteca os materiais daquele
 *  assunto. Desmarcá-lo levava de volta TODA linha com `referencia_id` — e a
 *  linha guarda esse vínculo a vida inteira, independentemente do que a pessoa
 *  tenha feito com ela depois.
 *
 *  O dano concreto: a pessoa troca o anexo por um PDF mais novo (o upload grava
 *  o byte no servidor na hora), escreve um resumo, percebe que o tema certo era
 *  outro e desmarca o primeiro. A linha some sem aviso, o resumo vai junto, e o
 *  arquivo fica órfão no blob — fora da varredura de órfãos, que por comentário
 *  do próprio código "só alcança arquivo que já esteve ligado a um material".
 */

import { describe, expect, it } from 'vitest';

import { intocado, linhaDaBiblioteca } from '@/paginas/cadastro/materiaisDoTema';

const REFERENCIA = {
  id: 'ref-1',
  titulo: 'Nota técnica do reajuste',
  resumo: 'O que muda na tarifa',
  temas: [7],
  versao: { id: 'v-9' },
};

const url = (referenciaId: string, versaoId: string) => `/arquivo/${referenciaId}/${versaoId}`;

describe('linhaDaBiblioteca', () => {
  it('monta a linha com o que a biblioteca sabe', () => {
    const linha = linhaDaBiblioteca(REFERENCIA, url);

    expect(linha.titulo).toBe('Nota técnica do reajuste');
    expect(linha.observacao).toBe('O que muda na tarifa');
    expect(linha.url).toBe('/arquivo/ref-1/v-9');
    expect(linha.referencia_id).toBe('ref-1');
    expect(linha.arquivo_id).toBeNull();
  });

  it('sem versão, a linha nasce sem link', () => {
    const linha = linhaDaBiblioteca({ ...REFERENCIA, versao: null }, url);

    expect(linha.url).toBe('');
  });
});

describe('intocado', () => {
  it('reconhece a linha que a biblioteca acabou de trazer', () => {
    const linha = linhaDaBiblioteca(REFERENCIA, url);

    expect(intocado(linha, REFERENCIA, url)).toBe(true);
  });

  it('título reescrito é edição', () => {
    const linha = { ...linhaDaBiblioteca(REFERENCIA, url), titulo: 'Nota revisada' };

    expect(intocado(linha, REFERENCIA, url)).toBe(false);
  });

  it('resumo reescrito é edição', () => {
    const linha = { ...linhaDaBiblioteca(REFERENCIA, url), observacao: 'Ver página 4' };

    expect(intocado(linha, REFERENCIA, url)).toBe(false);
  });

  it('arquivo trocado é edição — e é o caso que deixa byte órfão', () => {
    const linha = { ...linhaDaBiblioteca(REFERENCIA, url), arquivo_id: 'arq-77' };

    expect(intocado(linha, REFERENCIA, url)).toBe(false);
  });

  it('link trocado à mão é edição', () => {
    const linha = { ...linhaDaBiblioteca(REFERENCIA, url), url: 'https://outro.link' };

    expect(intocado(linha, REFERENCIA, url)).toBe(false);
  });

  it('movida para outro momento da reunião é edição', () => {
    // Arrastar o material de "apoio" para "depois" é uma decisão sobre a
    // agenda, e some junto se a linha for tratada como intocada.
    const linha = { ...linhaDaBiblioteca(REFERENCIA, url), momento: 'ata' };

    expect(intocado(linha, REFERENCIA, url)).toBe(false);
  });

  it('sem a referência de origem, NÃO é intocada', () => {
    // A referência pode ter saído da biblioteca entre trazer e desmarcar. Sem
    // com o que comparar, o seguro é preservar a linha: apagar o que não se
    // consegue conferir é justamente o defeito que isto conserta.
    const linha = linhaDaBiblioteca(REFERENCIA, url);

    expect(intocado(linha, undefined, url)).toBe(false);
  });
});

describe('a identidade da linha', () => {
  it('cada linha nasce com um `uid` próprio', () => {
    // POR QUE A LINHA PRECISA DE NOME. O upload de um arquivo guarda a POSIÇÃO
    // da linha e, quando volta, escreve nela por índice. Se nesse meio-tempo a
    // lista encolheu — a pessoa removeu outra linha, ou desmarcou um tema e a
    // biblioteca recolheu os materiais dele — o índice passou a apontar para
    // outro material: o arquivo gruda no errado, ou se perde e o byte fica
    // órfão no servidor. Casar por identidade de objeto também não resolve:
    // digitar na linha durante o upload cria um objeto novo.
    const a = linhaDaBiblioteca(REFERENCIA, url);
    const b = linhaDaBiblioteca(REFERENCIA, url);

    expect(a.uid).toBeTruthy();
    expect(a.uid).not.toBe(b.uid);
  });

  it('o `uid` não conta como edição', () => {
    // Ele é da tela, não do conteúdo: duas linhas iguais com uids diferentes
    // continuam sendo a linha que a biblioteca trouxe.
    const linha = linhaDaBiblioteca(REFERENCIA, url);

    expect(intocado(linha, REFERENCIA, url)).toBe(true);
  });
});

describe('os temas do documento', () => {
  it('mexer neles é edição — a linha deixa de ser da biblioteca', () => {
    // `temas` É CAMPO EDITÁVEL: a linha do material tem "Temas do documento",
    // com os chips que se marcam e desmarcam, e o valor viaja no corpo. Eu
    // tinha deixado ele fora da comparação, então uma linha em que a pessoa só
    // corrigiu os temas ainda contava como "intocada" — e sumia ao desmarcar o
    // tema da agenda, levando a correção junto.
    const linha = { ...linhaDaBiblioteca(REFERENCIA, url), temas: [7, 9] };

    expect(intocado(linha, REFERENCIA, url)).toBe(false);
  });

  it('a mesma lista em outra ordem não é edição', () => {
    // Os chips são um conjunto: marcar 9 depois de 7 e marcar 7 depois de 9
    // deixam a mesma linha. Comparar posição inventaria uma edição que ninguém
    // fez, e a linha deixaria de ser recolhida quando deveria.
    const linha = {
      ...linhaDaBiblioteca({ ...REFERENCIA, temas: [7, 9] }, url),
      temas: [9, 7],
    };

    expect(intocado(linha, { ...REFERENCIA, temas: [7, 9] }, url)).toBe(true);
  });
});
