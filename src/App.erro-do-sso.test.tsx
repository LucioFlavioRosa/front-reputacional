// @vitest-environment jsdom

/** A recusa do SSO chega pela URL, aparece uma vez, e sai do endereço.
 *
 *  POR QUE ESTE ARQUIVO EXISTE: o back passou a redirecionar as recusas do
 *  callback para `/?erro=<mensagem>` em vez de devolver JSON cru como página
 *  (`app/api/acesso.py`), e o `App` passou a ler esse parâmetro. O lado do
 *  back ficou coberto; este lado não tinha teste nenhum, e é metade do
 *  contrato — um descasamento no NOME do parâmetro daria "login em branco" sem
 *  derrubar teste de unidade de nenhum dos dois lados.
 *
 *  E A LIMPEZA DA URL É A PARTE QUE MAIS PRECISA DE TESTE, porque é a que se
 *  perde numa refatoração sem ninguém notar: sem ela, um F5 reexibe a mensagem
 *  como se o erro tivesse acabado de acontecer, e o `destinoAtual()` do
 *  `Login.tsx` leva `?erro=…` para a PRÓXIMA tentativa de login, como se fosse
 *  o link que a pessoa queria abrir. O comentário no `App.tsx` diz as duas
 *  coisas; agora há teste de cada uma.
 */

import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

//: IMPORTADO UMA VEZ, NO TOPO, e não com `await import()` dentro de cada teste.
//: O `App` puxa o grafo inteiro das páginas; importá-lo quatro vezes custava
//: mais de 5s por teste sob a carga da suíte completa, e os testes estouravam o
//: prazo — passando sozinhos e falhando em conjunto, que é o pior tipo de
//: teste. O `vi.mock` abaixo continua valendo: o vitest o iça acima dos
//: imports.
import { App } from '@/App';

//: Sem sessão: é a resposta normal de quem acabou de ser recusado, e é o que
//: faz o `App` pintar a tela de login.
vi.mock('@/api/cliente', async () => {
  const real = await vi.importActual<typeof import('@/api/cliente')>('@/api/cliente');
  return { ...real, obterEu: vi.fn().mockRejectedValue(new Error('sem sessão')) };
});

//: A telemetria sai do caminho: ela não é o assunto e tentaria rede.
vi.mock('@/observabilidade/telemetria', () => ({
  registrarView: vi.fn(),
  registrarEvento: vi.fn(),
  registrarErro: vi.fn(),
}));

/** Põe o endereço no estado em que o navegador chega voltando do callback. */
function chegarCom(endereco: string) {
  window.history.replaceState(null, '', endereco);
}

let trocas: string[] = [];
let replaceStateOriginal: typeof window.history.replaceState;

beforeEach(() => {
  trocas = [];
  replaceStateOriginal = window.history.replaceState.bind(window.history);
  //: Observa a limpeza SEM impedi-la: o endereço muda de verdade, e o teste
  //: também vê que a troca aconteceu.
  vi.spyOn(window.history, 'replaceState').mockImplementation(
    (estado, titulo, url) => {
      if (typeof url === 'string') trocas.push(url);
      return replaceStateOriginal(estado, titulo, url);
    },
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  chegarCom('/');
});

describe('a recusa do SSO que volta na URL', () => {
  it('mostra a mensagem que o back mandou, na caixa de aviso do login', async () => {
    chegarCom('/?erro=' + encodeURIComponent('Seu acesso ainda não foi liberado. Peça à coordenação do painel.'));
    render(<App />);

    //: A frase é a do `_texto_da_recusa` no back. Se o back mudar o texto, isto
    //: continua passando — o que este teste prende é o CAMINHO: o que vier no
    //: `erro=` tem de chegar à tela.
    await waitFor(() =>
      expect(screen.getByText(/Seu acesso ainda não foi liberado/)).toBeTruthy(),
    );
  });

  it('e tira o `erro` do endereço, para o F5 não reexibir e o login não o levar adiante', async () => {
    chegarCom('/?erro=Sua%20conta%20foi%20desativada.');
    render(<App />);

    await waitFor(() => expect(screen.getByText(/Sua conta foi desativada/)).toBeTruthy());
    //: A limpeza é por `replaceState`, não por navegação: uma navegação de
    //: verdade recarregaria a página e a mensagem se perderia justamente agora.
    expect(trocas.some((url) => !url.includes('erro'))).toBe(true);
    expect(window.location.search).not.toContain('erro');
    expect(new URL(window.location.href).searchParams.get('erro')).toBeNull();
  });

  it('preserva o resto do endereço ao limpar, porque o destino pedido vive nele', async () => {
    //: O `Login.tsx` usa o endereço atual como destino depois de entrar. Se a
    //: limpeza levasse o caminho ou os outros parâmetros junto, a pessoa
    //: entraria e cairia na raiz, tendo de procurar a tela de novo — que é
    //: justamente o defeito que o `Login.sso.test.tsx` já cobre pelo outro lado.
    chegarCom('/score?lente=imprensa&erro=Pedido%20de%20login%20expirado.');
    render(<App />);

    await waitFor(() => expect(screen.getByText(/Pedido de login expirado/)).toBeTruthy());
    expect(window.location.pathname).toBe('/score');
    expect(new URL(window.location.href).searchParams.get('lente')).toBe('imprensa');
    expect(new URL(window.location.href).searchParams.get('erro')).toBeNull();
  });

  it('sem `erro` na URL, não mexe no endereço nem mostra caixa de aviso', async () => {
    //: O caminho de todo dia. Sem esta asserção, um `definirFalhaNaEntrada('')`
    //: ou uma limpeza incondicional passariam — e apagariam a URL de quem só
    //: abriu o site.
    chegarCom('/?lente=mercado');
    render(<App />);

    //: Nome exato: a tela tem DOIS botões que casam com /entrar/i — o de senha
    //: e o do SSO ("Entrar com o e-mail da Aegea").
    await waitFor(() => expect(screen.getByRole('button', { name: 'Entrar' })).toBeTruthy());
    //: O ENDEREÇO SOBREVIVE INTEIRO, e é isto que se afirma — não "ninguém
    //: chamou `replaceState`". O provedor do painel sincroniza os filtros no
    //: endereço pelo mesmo `replaceState` (`estado/painel.tsx`), então exigir
    //: zero chamadas afirmaria algo falso sobre outra parte do sistema.
    expect(new URL(window.location.href).searchParams.get('lente')).toBe('mercado');
    expect(trocas.every((url) => !url.includes('erro'))).toBe(true);
    //: e nenhuma caixa de aviso, que é o outro lado do mesmo efeito
    expect(screen.queryByText(/não foi liberado|desativada|expirou|expirado/)).toBeNull();
  });
});
