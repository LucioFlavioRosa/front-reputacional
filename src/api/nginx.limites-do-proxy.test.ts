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

  it('o tempo de SUBIR o arquivo esta declarado, e nao fica no padrao de 60s', () => {
    /** O SEGUNDO RELÓGIO, e o que faltava.
     *
     *  `proxy_read_timeout` é o tempo de o BACK responder. O tempo de o arquivo
     *  CHEGAR é `client_body_timeout`, e o padrão do nginx são 60 s — que um
     *  arquivo de 10,53 MB numa conexão brasileira comum não cumpre.
     *
     *  MEDIDO NO AMBIENTE em 16/10/2026: `408` de 60 em 60 segundos com corpo
     *  de zero bytes, o navegador reenviando, e o back sem registro nenhum da
     *  requisição. Na tela isso se lê como "está demorando" — não há erro para
     *  investigar e o arquivo nunca chega.
     *
     *  O TESTE EXIGE O VALOR DECLARADO, e não apenas "grande": a ausência da
     *  diretiva é exatamente o defeito, e um teste que só conferisse o número
     *  quando ele existe passaria com ela removida.
     */
    const casado = /client_body_timeout\s+(\d+)s\s*;/.exec(nginx);
    expect(casado, 'client_body_timeout não declarado — volta ao padrão de 60s').not.toBeNull();

    const segundos = Number(casado![1]);
    //: O PISO SAI DO TETO DA APLICAÇÃO: 80 MB a 360 kB/s são ~230 s. Menos que
    //: isto recusa, por tempo, um arquivo que o `client_max_body_size` aceita —
    //: o mesmo desalinhamento entre camadas que este arquivo já consertou uma
    //: vez, agora no relógio em vez do tamanho.
    expect(segundos).toBeGreaterThanOrEqual(230);
  });

  it('nao declara diretiva que o nginx recusa dentro de `location`', () => {
    /** LER O ARQUIVO COMO TEXTO NÃO SABE DE CONTEXTO, e esta é a correção de um
     *  erro meu na mesma mudança: eu pus `client_header_timeout` junto do
     *  `client_body_timeout`, dentro do bloco `/api/`. O `nginx -t` recusou —
     *  aquela diretiva só vale em `http` e `server` — e o teste de texto tinha
     *  passado, porque ele só procura a linha.
     *
     *  Esta guarda é estreita de propósito: ela prende a diretiva que eu errei,
     *  não todas as que existem. A verificação completa é subir a imagem, e o
     *  CI já faz isso — nginx que não arranca derruba o contêiner, e o passo "A
     *  imagem sobe e serve a página" falha.
     *
     *  E A DIRETIVA ATIVA, NÃO A PALAVRA: a primeira versão desta linha
     *  procurava o texto e falhou contra o COMENTÁRIO que explica a ausência.
     *  Diretiva começa a linha; comentário começa com `#`.
     */
    expect(nginx).not.toMatch(/^\s*client_header_timeout\s/m);
  });
});
