/** Os limites do proxy, conferidos contra os tetos da aplicação.
 *
 *  O QUE ESTE ARQUIVO IMPEDE: o nginx cortando antes da aplicação. A ordem é
 *  nginx -> back, então um teto mais baixo aqui troca a mensagem do domínio
 *  — que diz o tamanho aceito — por um `413` seco do proxy. Já aconteceu:
 *  `client_max_body_size 26m` contra os 40 MB da planilha de score deixava um
 *  vão de 14 MB em que o arquivo era recusado sem explicação nenhuma.
 *
 *  E guarda o `proxy_request_buffering on`, que foi conserto de um defeito que
 *  só aparecia na Azure — corpo em fluxo atravessando o ingress interno, upload
 *  morrendo em `400` de corpo vazio. Voltar para `off` reintroduz aquilo, e
 *  nenhum teste de tela acusaria.
 *
 *  POR QUE LER O ARQUIVO, E NÃO CONFIAR NA REVISÃO: `nginx -t` valida sintaxe,
 *  não intenção. Um número trocado aqui é válido e silencioso.
 */

import { describe, expect, it } from 'vitest';

//: `?raw` é do Vite, e o vitest fala Vite — é o que permite ler um arquivo de
//: configuração sem `node:fs`, que o build do navegador não conhece. Mesma
//: forma que `cliente.test.ts` usa para varrer o próprio código-fonte.
import nginx from '../../nginx.conf?raw';

/* -- os tetos da APLICAÇÃO, copiados do back ------------------------------- */

//: `app/casos_de_uso/ingerir_mencoes.py::TAMANHO_MAXIMO` — pedido do dono do
//: produto: planilhas de até 80 MB.
const PLANILHA_DE_SCORE_MB = 80;

//: `app/configuracao.py::blob_tamanho_maximo` — material de agenda.
const MATERIAL_DE_AGENDA_MB = 25;

//: O ingress do Container Apps corta a requisição por volta disto. Esperar mais
//: que ele não compra nada: a resposta que o navegador recebe passa a ser a
//: página de erro DELE.
const TETO_DO_INGRESS_S = 240;

function emMegabytes(valor: string, unidade: string): number {
  const n = Number(valor);
  if (unidade.toLowerCase() === 'g') return n * 1024;
  if (unidade.toLowerCase() === 'm') return n;
  if (unidade.toLowerCase() === 'k') return n / 1024;
  return n / (1024 * 1024); //: sem unidade, o nginx lê bytes
}

describe('os limites do bloco /api/', () => {
  it('o teto de corpo do nginx fica ACIMA do maior teto da aplicacao', () => {
    const casado = /client_max_body_size\s+(\d+)([kKmMgG]?)\s*;/.exec(nginx);
    expect(casado, 'client_max_body_size não encontrado no nginx.conf').not.toBeNull();

    const mb = emMegabytes(casado![1], casado![2]);
    const maiorTetoDaAplicacao = Math.max(PLANILHA_DE_SCORE_MB, MATERIAL_DE_AGENDA_MB);

    //: ACIMA, e não igual: o multipart carrega o nome do campo, o nome do
    //: arquivo e as fronteiras além dos bytes do arquivo. Um teto exato
    //: recusaria um arquivo exatamente no tamanho permitido.
    expect(mb).toBeGreaterThan(maiorTetoDaAplicacao);
  });

  it('o corpo da requisicao vai BUFFERIZADO', () => {
    //: O `off` quebrava upload de planilha só na Azure. Ver o comentário no
    //: `nginx.conf` para a medição.
    expect(nginx).toMatch(/proxy_request_buffering\s+on\s*;/);
    expect(nginx).not.toMatch(/proxy_request_buffering\s+off\s*;/);
  });

  it('o tempo de leitura cabe no teto do ingress, e nao o ultrapassa', () => {
    const casado = /proxy_read_timeout\s+(\d+)s\s*;/.exec(nginx);
    expect(casado, 'proxy_read_timeout não encontrado no nginx.conf').not.toBeNull();

    const segundos = Number(casado![1]);
    //: 60 s não davam: o clipping de 3,8 MB levou 22,9 s de processamento, e o
    //: teto passou a ser 80 MB.
    expect(segundos).toBeGreaterThanOrEqual(60);
    expect(segundos).toBeLessThanOrEqual(TETO_DO_INGRESS_S);
  });
});
