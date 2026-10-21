/** NENHUM TEXTO DE LENTE DE CLIPPING ATRIBUI A NOTA AO CRM.
 *
 *  POR QUE ESTE ARQUIVO EXISTE. A lente Institucional lia o CRM até as
 *  migrations `0107`/`0108` (renumeradas para `0111`/`0112`), quando passou a
 *  recortar a imprensa pela lista de veículos — igual ao Mercado. O CRM foi
 *  aposentado (`ativo = false`) e saiu do índice.
 *
 *  A PREMISSA VELHA ESTAVA ESCRITA EM TRÊS LUGARES, e eu as encontrei UMA POR
 *  VEZ, cada uma depois de implantar a correção da anterior:
 *
 *    `descricaoDasLentes`   a fonte da lente, no cartão do Radar
 *    `Inicio.tsx`           o resumo das fontes da nota, no cartão dos KPIs
 *    `guiaDoDossie`         o balão de ajuda da nota, no Dossiê
 *
 *  A TERCEIRA SÓ APARECEU quando cacei a frase no bundle SERVIDO — a varredura
 *  que eu fiz no código não a achou, porque cada mapa usa palavras diferentes
 *  para dizer a mesma coisa errada. Este teste olha os mapas pelo que eles
 *  AFIRMAM, e não pela frase que eu me lembrei de procurar: nenhuma das lentes
 *  que leem a Clipei pode atribuir a nota dela ao CRM.
 *
 *  POR ATRIBUIÇÃO, E NÃO POR MENÇÃO: "Próximas ondas: somar as interações
 *  registradas no CRM dos Stakeholders" é verdade e tem de continuar podendo
 *  ser dita. O que não pode é a FONTE da nota de hoje ser o CRM.
 */

import { describe, expect, it } from 'vitest';

import { DESCRICAO_DAS_LENTES } from '@/dominio/descricaoDasLentes';
import { GUIA_DO_DESTAQUE } from '@/dominio/guiaDoDossie';

/** As lentes que leem o export da Clipei, recortado ou inteiro. A nota delas
 *  vem de matéria de imprensa — nunca de interação de CRM. */
const DE_CLIPPING = ['imprensa', 'mercado', 'institucional'];

describe('o que as lentes dizem da própria fonte', () => {
  it.each(DE_CLIPPING)('o cartão de %s não atribui a nota ao CRM', (codigo) => {
    const { objetivo, fonteUtilizada } = DESCRICAO_DAS_LENTES[codigo];
    expect(fonteUtilizada).not.toMatch(/CRM/);
    expect(objetivo).not.toMatch(/CRM/);
  });

  it.each(DE_CLIPPING)('o balão da nota de %s não atribui a nota ao CRM', (codigo) => {
    expect(GUIA_DO_DESTAQUE[codigo]).not.toMatch(/CRM/);
  });

  it.each(DE_CLIPPING)('o balão da nota de %s diz de onde ela vem', (codigo) => {
    //: NÃO BASTA NÃO MENTIR: o balão existe para dizer o que a nota mede, e um
    //: texto esvaziado passaria no teste de cima.
    expect(GUIA_DO_DESTAQUE[codigo]).toMatch(/sentimento/);
  });
});
