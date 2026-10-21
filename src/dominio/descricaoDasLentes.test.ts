/** Toda lente do modelo tem objetivo, fonte e próximas ondas escritos. */

import { describe, expect, it } from 'vitest';

import { DESCRICAO_DAS_LENTES } from '@/dominio/descricaoDasLentes';

describe('DESCRICAO_DAS_LENTES', () => {
  it.each(['imprensa', 'mercado', 'sociedade', 'clientes', 'institucional'])(
    '%s tem as três frases',
    (codigo) => {
      const descricao = DESCRICAO_DAS_LENTES[codigo];
      expect(descricao.objetivo).toMatch(/\.$/);
      expect(descricao.fonteUtilizada.length).toBeGreaterThan(2);
      expect(descricao.proximasOndas).toMatch(/^Próximas ondas:/);
    },
  );

  it.each(['mercado', 'institucional'])(
    'a fonte de %s é a Clipei recortada, e não o CRM',
    (codigo) => {
      /** AS DUAS LENTES QUE RECORTAM A IMPRENSA por lista de veículos.
       *
       *  A Institucional lia o CRM até a `0107`/`0108`, e este texto ficou
       *  dizendo que ainda lia — a pessoa via escrito "CRM — termômetro das
       *  interações" no cartão e matérias de jornal na Base de dados. O teste
       *  antigo só exigia que a frase tivesse mais de dois caracteres, então
       *  não tinha como pegar.
       *
       *  PELA FONTE, E NÃO PELO TEXTO INTEIRO: afirmar a frase toda faria este
       *  teste reprovar em toda melhoria de redação. O que não pode voltar é a
       *  fonte errada. */
      const { fonteUtilizada, premissa } = DESCRICAO_DAS_LENTES[codigo];
      expect(fonteUtilizada).toMatch(/^Clipei,/);
      expect(fonteUtilizada).not.toMatch(/CRM/);
      //: E A PREMISSA DIZ PELO QUE RECORTA, que é o que distingue as duas.
      expect(premissa).toMatch(/Cadastro de Instituições como Imprensa › /);
    },
  );
});
