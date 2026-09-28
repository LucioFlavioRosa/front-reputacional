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

import { escreveAgendas } from '@/dominio/sincronizacao';

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
