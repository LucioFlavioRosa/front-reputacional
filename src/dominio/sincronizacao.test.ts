import { describe, expect, it, vi } from 'vitest';

import {
  type CanalEntreAbas,
  MENSAGEM_DO_CATALOGO,
  ROTAS_DO_CATALOGO,
  Sincronizador,
  escreveNoCatalogo,
} from './sincronizacao';

describe('escreveNoCatalogo — a regra que decide quem avisa', () => {
  // AS CINCO ROTAS × OS QUATRO VERBOS DE ESCRITA. Enumerado, e não amostrado:
  // é a lista inteira do que a Administração cadastra, e cada combinação é
  // um cadastro que precisa chegar ao resto da plataforma.
  it.each(ROTAS_DO_CATALOGO)('toda escrita em %s avisa', (rota) => {
    for (const metodo of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      expect(escreveNoCatalogo(metodo, rota)).toBe(true);
      expect(escreveNoCatalogo(metodo, `${rota}/9f3a`)).toBe(true);
      expect(escreveNoCatalogo(metodo, `${rota}/9f3a/versoes`)).toBe(true);
    }
  });

  it('ler não é escrever', () => {
    for (const rota of ROTAS_DO_CATALOGO) {
      expect(escreveNoCatalogo('GET', rota)).toBe(false);
      expect(escreveNoCatalogo('get', rota)).toBe(false);
      expect(escreveNoCatalogo('HEAD', rota)).toBe(false);
    }
  });

  it('escrever fora do catálogo não avisa', () => {
    // A agenda tem o próprio caminho de atualização; o login não muda opção
    // nenhuma. Avisar aqui recarregaria o catálogo a cada agenda salva.
    expect(escreveNoCatalogo('POST', '/api/interacoes')).toBe(false);
    expect(escreveNoCatalogo('PATCH', '/api/interacoes/abc')).toBe(false);
    expect(escreveNoCatalogo('POST', '/api/auth/senha')).toBe(false);
    expect(escreveNoCatalogo('PUT', '/api/acessos/abc')).toBe(false);
  });

  it('o prefixo respeita a fronteira do caminho', () => {
    // `/api/temas` não pode casar `/api/temas-arquivados` só por começar igual.
    expect(escreveNoCatalogo('POST', '/api/temas-arquivados')).toBe(false);
    expect(escreveNoCatalogo('POST', '/api/temasx')).toBe(false);
  });

  it('a query string não engana a regra', () => {
    expect(escreveNoCatalogo('POST', '/api/temas?forcar=1')).toBe(true);
    expect(escreveNoCatalogo('POST', '/api/interacoes?x=/api/temas')).toBe(false);
  });
});

describe('Sincronizador — o aviso', () => {
  it('avisa a todos que assinaram, uma vez por aviso', () => {
    const s = new Sincronizador();
    const a = vi.fn();
    const b = vi.fn();
    s.assinar(a);
    s.assinar(b);

    s.avisar();
    s.avisar();

    expect(a).toHaveBeenCalledTimes(2);
    expect(b).toHaveBeenCalledTimes(2);
  });

  it('quem cancelou não é mais avisado', () => {
    // É o que o `useEffect` chama ao desmontar: sem isto, uma tela fechada
    // continuaria recarregando um estado que já não existe.
    const s = new Sincronizador();
    const a = vi.fn();
    const cancelar = s.assinar(a);

    cancelar();
    s.avisar();

    expect(a).not.toHaveBeenCalled();
  });

  it('assinar duas vezes a mesma função não duplica o aviso', () => {
    const s = new Sincronizador();
    const a = vi.fn();
    s.assinar(a);
    s.assinar(a);

    s.avisar();

    expect(a).toHaveBeenCalledTimes(1);
  });
});

/* -- entre abas -------------------------------------------------------------- */

/** Um barramento como o do navegador: o que uma aba publica chega às OUTRAS,
 *  e nunca a ela mesma — é assim que o `BroadcastChannel` se comporta. */
function abasLigadas(quantas: number): CanalEntreAbas[] {
  const canais: CanalEntreAbas[] = [];
  for (let i = 0; i < quantas; i += 1) {
    const canal: CanalEntreAbas = {
      onmessage: null,
      postMessage(mensagem) {
        for (const outro of canais) {
          if (outro !== canal) outro.onmessage?.({ data: mensagem } as MessageEvent);
        }
      },
    };
    canais.push(canal);
  }
  return canais;
}

describe('Sincronizador — o aviso atravessa abas', () => {
  it('um cadastro numa aba avisa a agenda aberta na outra', () => {
    const [canalA, canalB] = abasLigadas(2);
    const abaA = new Sincronizador(canalA);
    const abaB = new Sincronizador(canalB);
    const agendaNaAbaB = vi.fn();
    abaB.assinar(agendaNaAbaB);

    abaA.avisar();

    expect(agendaNaAbaB).toHaveBeenCalledTimes(1);
  });

  it('a aba que escreveu também é avisada, e uma vez só', () => {
    // O canal não devolve a mensagem a quem a publicou; o aviso local tem de
    // sair por conta própria — e não pode sair duas vezes.
    const [canalA, canalB] = abasLigadas(2);
    const abaA = new Sincronizador(canalA);
    new Sincronizador(canalB);
    const propria = vi.fn();
    abaA.assinar(propria);

    abaA.avisar();

    expect(propria).toHaveBeenCalledTimes(1);
  });

  it('o aviso que chega de outra aba não é repassado — senão as abas trocariam o mesmo aviso para sempre', () => {
    const [canalA, canalB, canalC] = abasLigadas(3);
    const publicacoes = vi.spyOn(canalB, 'postMessage');
    new Sincronizador(canalA);
    const abaB = new Sincronizador(canalB);
    const abaC = new Sincronizador(canalC);
    const ouvinteB = vi.fn();
    const ouvinteC = vi.fn();
    abaB.assinar(ouvinteB);
    abaC.assinar(ouvinteC);

    canalA.postMessage(MENSAGEM_DO_CATALOGO);

    expect(ouvinteB).toHaveBeenCalledTimes(1);
    expect(ouvinteC).toHaveBeenCalledTimes(1);
    expect(publicacoes).not.toHaveBeenCalled();
  });

  it('mensagem estranha no canal não é aviso', () => {
    const [canalA, canalB] = abasLigadas(2);
    new Sincronizador(canalA);
    const abaB = new Sincronizador(canalB);
    const ouvinte = vi.fn();
    abaB.assinar(ouvinte);

    canalA.postMessage('outra coisa');
    canalA.postMessage({ tipo: MENSAGEM_DO_CATALOGO });

    expect(ouvinte).not.toHaveBeenCalled();
  });

  it('sem canal, avisar continua avisando esta aba', () => {
    const s = new Sincronizador(null);
    const a = vi.fn();
    s.assinar(a);

    s.avisar();

    expect(a).toHaveBeenCalledTimes(1);
  });
});
