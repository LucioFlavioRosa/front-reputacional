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
});
