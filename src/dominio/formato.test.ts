/** Formatação de data: onde o fuso horário costuma morder. */

import { describe, expect, it } from 'vitest';
import {
  chaveDoMes,
  dataCompleta,
  diasDesde,
  hojeLocal,
  paraData,
  urlSegura,
  variacao,
} from '@/dominio/formato';

describe('paraData', () => {
  it('não desloca o dia por causa do fuso', () => {
    // `new Date('2026-05-07')` é interpretada como UTC e, a oeste de
    // Greenwich, volta como 06/05. A leitura por partes evita isso.
    const data = paraData('2026-05-07');
    expect(data.getFullYear()).toBe(2026);
    expect(data.getMonth()).toBe(4);
    expect(data.getDate()).toBe(7);
  });

  it('formata para pt-BR sem perder o dia', () => {
    expect(dataCompleta('2026-01-01')).toBe('01/01/2026');
  });

  it('aceita data com hora e ignora o resto', () => {
    expect(chaveDoMes('2026-05-07T13:45:00')).toBe('2026-05');
  });
});

describe('hojeLocal', () => {
  it('usa a data do fuso do usuário, não a UTC', () => {
    // 24/08/2026 às 22:30 em São Paulo (UTC-3) já é 25/08 em UTC.
    // O formulário precisa abrir com 24, que é o dia de quem digita.
    const noiteEmSaoPaulo = new Date(2026, 7, 24, 22, 30);
    expect(hojeLocal(noiteEmSaoPaulo)).toBe('2026-08-24');
  });

  it('preenche mês e dia com zero à esquerda', () => {
    expect(hojeLocal(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('devolve algo que o input type=date aceita', () => {
    expect(hojeLocal()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('diasDesde', () => {
  it('conta dias corridos', () => {
    expect(diasDesde('2026-08-01', new Date(2026, 7, 24))).toBe(23);
  });

  it('devolve negativo para agenda futura', () => {
    expect(diasDesde('2026-09-10', new Date(2026, 7, 24))).toBeLessThan(0);
  });

  it('ignora a hora do momento de referência', () => {
    const manha = new Date(2026, 7, 24, 8, 0);
    const noite = new Date(2026, 7, 24, 23, 59);
    expect(diasDesde('2026-08-01', manha)).toBe(diasDesde('2026-08-01', noite));
  });
});

describe('variacao', () => {
  it('mostra o sinal na alta', () => {
    expect(variacao(12, 10)).toBe('+20%');
  });

  it('mostra a queda', () => {
    expect(variacao(8, 10)).toBe('-20%');
  });

  it('não divide por zero quando não havia base', () => {
    expect(variacao(5, 0)).toBe('+100%');
    expect(variacao(0, 0)).toBe('0%');
  });
});

describe('urlSegura', () => {
  it('deixa passar http e https', () => {
    expect(urlSegura('https://sharepoint.aegea.com.br/doc')).toContain('https://');
    expect(urlSegura('http://exemplo.com')).toContain('http://');
  });

  it('recusa javascript: — o vetor de XSS armazenado', () => {
    // `registro_url` é texto do banco. Num href cru, isto executa ao clique.
    expect(urlSegura('javascript:alert(document.cookie)')).toBeNull();
    expect(urlSegura('JaVaScRiPt:alert(1)')).toBeNull();
  });

  it('recusa data: e outros esquemas', () => {
    expect(urlSegura('data:text/html,<script>alert(1)</script>')).toBeNull();
    expect(urlSegura('vbscript:msgbox(1)')).toBeNull();
    expect(urlSegura('file:///etc/passwd')).toBeNull();
  });

  it('trata vazio e lixo sem estourar', () => {
    expect(urlSegura(null)).toBeNull();
    expect(urlSegura(undefined)).toBeNull();
    expect(urlSegura('')).toBeNull();
  });
});
