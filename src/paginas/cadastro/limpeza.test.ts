/** Limpar um formulário de trinta campos sem rede embaixo.
 *
 *  O QUE ACONTECIA: "Limpar" fica imediatamente à esquerda de "Salvar
 *  interação", num rodapé alinhado à direita. No caminho de CRIAÇÃO não há
 *  registro carregado, então o botão caía em `VAZIO` — quinze minutos de
 *  preenchimento iam embora num clique 10px fora do alvo, sem diálogo, sem
 *  aviso e sem volta. O caminho de EDIÇÃO já estava protegido: ali "Desfazer
 *  alterações" restaura o que veio do servidor.
 *
 *  POR QUE DESFAZER, E NÃO CONFIRMAR — decisão de quem cuida do produto:
 *  diálogo de confirmação é o que todo mundo aprende a clicar sem ler, e ele
 *  cobra um gesto de todas as vezes para proteger o acidente de uma.
 */

import { describe, expect, it } from 'vitest';

import { VAZIO } from '@/paginas/cadastro/formulario';
import { desfazerDisponivel, desfazerLimpeza, limpar } from '@/paginas/cadastro/limpeza';

const PREENCHIDO = { ...VAZIO, pauta: 'Reajuste tarifário', uf: 'SP' };

describe('limpar', () => {
  it('esvazia o formulário e guarda o que estava lá', () => {
    const depois = limpar(PREENCHIDO, VAZIO);

    expect(depois.form).toEqual(VAZIO);
    expect(depois.desfazer).toEqual(PREENCHIDO);
  });

  it('não oferece desfazer quando não havia nada a perder', () => {
    // Um botão "Desfazer limpeza" depois de limpar o que já estava vazio
    // promete devolver algo que não existe, e ensina a ignorar o aviso quando
    // ele importar.
    const depois = limpar(VAZIO, VAZIO);

    expect(depois.form).toEqual(VAZIO);
    expect(depois.desfazer).toBeNull();
  });
});

describe('desfazerLimpeza', () => {
  it('devolve exatamente o que havia antes', () => {
    const limpo = limpar(PREENCHIDO, VAZIO);

    expect(desfazerLimpeza(limpo)).toEqual(PREENCHIDO);
  });

  it('sem nada guardado, não inventa um formulário', () => {
    expect(desfazerLimpeza({ form: VAZIO, desfazer: null })).toBeNull();
  });
});

describe('a validade do desfazer', () => {
  it('vale por UM gesto: escrever qualquer coisa o retira', () => {
    // A JANELA É CURTA DE PROPÓSITO. Restaurar depois que a pessoa já começou
    // a preencher de novo apagaria o trabalho NOVO para devolver o velho — o
    // mesmo dano, ao contrário, e dessa vez causado pelo próprio conserto.
    const limpo = limpar(PREENCHIDO, VAZIO);

    const aoEscrever = { ...limpo, form: { ...limpo.form, uf: 'RJ' }, desfazer: null };

    expect(desfazerLimpeza(aoEscrever)).toBeNull();
  });
});

describe('desfazerDisponivel', () => {
  it('vale enquanto o formulário continua sendo o vazio que a limpeza deixou', () => {
    const { desfazer, form } = limpar(PREENCHIDO, VAZIO);

    expect(desfazerDisponivel(desfazer, form, VAZIO)).toBe(true);
  });

  it('CAI SOZINHO assim que qualquer coisa muda o formulário', () => {
    // O DEFEITO QUE ISTO CONSERTA: eu retirava o desfazer numa linha dentro de
    // `alterar` — e `alterar` é UM dos mutadores. Trocar a data, marcar um
    // tema, marcar uma área, mexer na lista de participantes ou na de materiais
    // passam por outros caminhos, e nenhum deles avisava. Depois de limpar e
    // marcar um tema, o botão continuava "Desfazer limpeza", e clicar nele
    // destruía o trabalho novo — o dano inverso, causado pelo conserto.
    //
    // A resposta não é acrescentar a linha nos outros seis: é o sétimo que
    // alguém escrever amanhã. A validade passa a ser DERIVADA do formulário —
    // qualquer mutação cria um objeto novo, e a comparação é por identidade.
    const { desfazer } = limpar(PREENCHIDO, VAZIO);
    const depoisDeMexer = { ...VAZIO, uf: 'RJ' };

    expect(desfazerDisponivel(desfazer, depoisDeMexer, VAZIO)).toBe(false);
  });

  it('sem nada guardado, não há o que oferecer', () => {
    expect(desfazerDisponivel(null, VAZIO, VAZIO)).toBe(false);
  });
});
