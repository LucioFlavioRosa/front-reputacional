/** As agendas mudaram: quem escreve avisa, e o painel recarrega.
 *
 *  O DEFEITO QUE ISTO CORRIGE, na voz de quem usou: "para ver os novos eventos eu
 *  estou precisando atualizar a página, e isso quebra a usabilidade".
 *
 *  O CATÁLOGO JÁ TINHA ISTO — `catalogoMudou`, avisado pelo cliente da API a cada
 *  escrita bem-sucedida numa rota de catálogo, escutado pelo painel. As AGENDAS
 *  não: confirmar 54 agendas não avisava ninguém, e a Base continuava mostrando a
 *  lista de antes até um F5.
 *
 *  É O MESMO MECANISMO, com o seu próprio canal: um `Sincronizador` só, avisando as
 *  duas coisas, faria cada tema cadastrado rebuscar a base inteira — que é
 *  exatamente o motivo de existirem duas versões no estado do painel.
 */

import { describe, expect, it } from 'vitest';

import { escreveAgendas, escreveNoCatalogo } from '@/dominio/sincronizacao';

describe('escreveAgendas', () => {
  it('a CONFIRMAÇÃO da importação muda as agendas', () => {
    // É o único passo da importação que cria agenda: o upload só propõe.
    expect(escreveAgendas('POST', '/api/importacoes/abc-123/confirmacao')).toBe(true);
  });

  it('salvar uma interação muda as agendas', () => {
    expect(escreveAgendas('POST', '/api/interacoes')).toBe(true);
    expect(escreveAgendas('PATCH', '/api/interacoes/abc-123')).toBe(true);
  });

  it('subir a planilha NÃO muda as agendas', () => {
    // Nada foi criado ainda, e rebuscar a base aqui seria pagar uma carga para
    // mostrar exatamente a mesma lista.
    expect(escreveAgendas('POST', '/api/importacoes')).toBe(false);
  });

  it('resolver uma pendência da conferência NÃO muda as agendas', () => {
    expect(escreveAgendas('PATCH', '/api/importacoes/abc/resolucoes')).toBe(false);
    expect(escreveAgendas('PATCH', '/api/importacoes/abc/linhas/1')).toBe(false);
  });

  it('ler nunca muda nada', () => {
    expect(escreveAgendas('GET', '/api/interacoes')).toBe(false);
    expect(escreveAgendas('GET', '/api/importacoes/abc/confirmacao')).toBe(false);
  });

  it('ignora a consulta no fim do endereço', () => {
    expect(escreveAgendas('POST', '/api/interacoes?pagina=2')).toBe(true);
  });
});

it('a CONFIRMACAO da importacao avisa o CATALOGO tambem', () => {
  //: O DEFEITO QUE ISTO PRENDE: ela estava só na lista das agendas.
  //:
  //: A confirmação é o único passo daquele fluxo que GRAVA, e grava as DUAS
  //: coisas — as agendas e os cadastros que elas precisavam. Medido com a
  //: planilha real de RI: 304 agendas e 502 CADASTROS numa chamada.
  //:
  //: Sem este aviso, nada dos 502 chegava ao catálogo: a lista do Cadastro
  //: compartilhado, as opções de todo filtro e de todo formulário seguiam as de
  //: antes até alguém apertar F5 — e a agenda recém criada aponta para uma
  //: instituição que o catálogo não conhece, que é a mesma classe de problema
  //: dos `temas_inativos`: dois lados discordando sobre o mesmo dado.
  //:
  //: E A REGRA DO MÓDULO JÁ DIZIA QUE ERA ASSIM: "a regra aqui é 'a escrita muda
  //: o catálogo?', e não 'o endereço começa com o nome de um cadastro'".
  expect(escreveNoCatalogo('POST', '/api/importacoes/abc-123/confirmacao')).toBe(true);
  //: E CONTINUA AVISANDO AS AGENDAS: são os dois, não um ou o outro.
  expect(escreveAgendas('POST', '/api/importacoes/abc-123/confirmacao')).toBe(true);
});

it('o UPLOAD da importacao NAO avisa ninguem', () => {
  //: O CONTRAPESO, e é ele que mantém a regra significando algo: o upload
  //: PROPÕE e não grava nada — "é por isso que nada nasce no upload: se
  //: nascesse, cancelar a conferência deixaria instituições criadas sem nenhuma
  //: agenda a que servissem", diz `_criar_cadastros` no back.
  //:
  //: Sem esta asserção, trocar o casamento por um prefixo `/api/importacoes`
  //: passaria — e aí cada upload recarregaria o catálogo inteiro para não mudar
  //: nada.
  expect(escreveNoCatalogo('POST', '/api/importacoes')).toBe(false);
  expect(escreveAgendas('POST', '/api/importacoes')).toBe(false);
});

it('a confirmacao dos SUBTEMAS avisa o catalogo, e a conferencia NAO', () => {
  //: MESMO DEFEITO DA IMPORTACAO DE AGENDAS, numa segunda rota — achado de
  //: revisao com severidade ALTA. `/api/taxonomia/subtemas/confirmacao` "aplica
  //: o que foi conferido": cria e altera TEMAS. Sem o aviso, a aba Temas, todo
  //: filtro por tema e todo formulario que oferece tema seguiam os de antes ate
  //: um F5.
  expect(escreveNoCatalogo('POST', '/api/taxonomia/subtemas/confirmacao')).toBe(true);
  //: E A IRMA DELA NAO GRAVA NADA — "NADA E GRAVADO", diz o cliente. Sem esta
  //: asercao, usar o prefixo `/api/taxonomia` passaria, e cada conferencia
  //: recarregaria o catalogo inteiro para nao mudar coisa nenhuma.
  expect(escreveNoCatalogo('POST', '/api/taxonomia/subtemas/conferencia')).toBe(false);
  expect(escreveNoCatalogo('GET', '/api/taxonomia/subtemas/modelo')).toBe(false);
  //: E ELA NAO MEXE EM AGENDA.
  expect(escreveAgendas('POST', '/api/taxonomia/subtemas/confirmacao')).toBe(false);
});

it('a confirmacao da importacao casa o caminho EXATO, e nao qualquer profundidade', () => {
  //: ACHADO DE REVISAO (BAIXA): o predicado era `startsWith('/api/importacoes/')`
  //: com `endsWith('/confirmacao')`, e aceitava qualquer profundidade entre o id
  //: e a palavra. Nao ha subrota dessas hoje, e e por isso que vale apertar
  //: agora: o aviso falso que isso daria amanha recarregaria o catalogo inteiro
  //: por uma rota que ninguem examinou.
  //:
  //: A ASERCAO DO TESTE DA ANCORA JA USAVA ESTA REGEX — implementacao mais larga
  //: que o teste e uma diferenca que ninguem ve ate ela importar.
  expect(escreveNoCatalogo('POST', '/api/importacoes/abc/confirmacao')).toBe(true);
  expect(escreveNoCatalogo('POST', '/api/importacoes/abc/outra/confirmacao')).toBe(false);
  expect(escreveAgendas('POST', '/api/importacoes/abc/outra/confirmacao')).toBe(false);
  //: E A QUERY NAO ESTRAGA O CASAMENTO: `escreve*` corta no `?` antes de olhar.
  expect(escreveNoCatalogo('POST', '/api/importacoes/abc/confirmacao?x=1')).toBe(true);
});
