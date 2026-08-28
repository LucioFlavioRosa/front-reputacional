/** As iniciais do avatar.
 *
 *  Duas letras num círculo de 36px é tudo o que identifica a conta na barra.
 *  Se elas colidirem entre pessoas da mesma equipe, o ícone deixa de informar
 *  qualquer coisa — e é por isso que a regra não é "as duas primeiras".
 */

import { describe, expect, it } from 'vitest';
import { iniciais, nomeParaExibir } from '@/dominio/formato';

describe('iniciais', () => {
  it('usa o primeiro nome e o ÚLTIMO sobrenome', () => {
    // Não o do meio: numa equipe há vários "Silva" e poucos "Costa".
    expect(iniciais('Maria Silva Costa')).toBe('MC');
  });

  it('nome e sobrenome simples', () => {
    expect(iniciais('Ana Prado')).toBe('AP');
  });

  it('nome único vira as duas primeiras letras', () => {
    expect(iniciais('Madonna')).toBe('MA');
  });

  it('aguenta espaço sobrando', () => {
    // O nome vem do Entra ID ou de um `insert` à mão; nem sempre está limpo.
    expect(iniciais('  João   Neves  ')).toBe('JN');
  });

  it('nome vazio não quebra o avatar', () => {
    // Preferível a uma letra indefinida no círculo, ou a um erro de render na
    // barra — que derrubaria a navegação inteira.
    expect(iniciais('')).toBe('?');
    expect(iniciais('   ')).toBe('?');
  });

  it('devolve sempre em maiúsculas', () => {
    expect(iniciais('ana prado')).toBe('AP');
  });
});

describe('nomeParaExibir', () => {
  /* O REGRESSO QUE ESTE BLOCO EXISTE PARA IMPEDIR: qualquer corte por conta
   * própria. Já houve dois, e os dois apagaram identidade.
   *
   *  O primeiro devolvia o primeiro nome, e os perfis do painel chamam-se
   *  "<módulo> · <nível>" — "CRM · leitura" e "CRM · edição" viravam ambos
   *  "CRM", e o controle que diz QUEM está logado passava a esconder isso.
   *  O segundo cortava acima de 20 caracteres, limite escolhido porque
   *  "Plataforma · edição" tem 19: regra ajustada ao dado que havia à mão.
   *
   *  Quem corta agora é o CSS, com reticência. Se algum destes voltar a
   *  falhar, é porque a amputação voltou.
   */
  it('devolve os perfis do painel inteiros, e distintos entre si', () => {
    expect(nomeParaExibir('CRM · leitura')).toBe('CRM · leitura');
    expect(nomeParaExibir('CRM · edição')).toBe('CRM · edição');
    expect(nomeParaExibir('Plataforma · edição')).toBe('Plataforma · edição');
  });

  it('não corta nome comprido — a reticência do CSS é que faz isso', () => {
    // "Ana Paula Rodrigues Lima" cortado no primeiro espaço vira "Ana", e
    // deixa de distinguir Ana Paula de Ana Carolina. Truncado com reticência,
    // ainda distingue.
    expect(nomeParaExibir('Ana Paula Rodrigues Lima')).toBe('Ana Paula Rodrigues Lima');
  });

  it('normaliza o espaço que vem do diretório', () => {
    // O nome vem do Entra ID ou de um `insert` à mão; nem sempre está limpo,
    // e espaço duplo dentro de uma pastilha estreita rouba largura útil.
    expect(nomeParaExibir('  Ana   Prado  ')).toBe('Ana Prado');
    expect(nomeParaExibir('João	Neves')).toBe('João Neves');
  });

  it('nome vazio devolve vazio, e não um "Usuário" inventado', () => {
    // A pastilha fica só com avatar e seta — feio, mas honesto. Inventar um
    // nome faria a pessoa acreditar num cadastro que não existe.
    expect(nomeParaExibir('')).toBe('');
    expect(nomeParaExibir('   ')).toBe('');
  });
});
