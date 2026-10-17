/** As três camadas do acesso, derivadas das bandeiras do papel.
 *
 *  POR QUE ESTES TESTES SÃO OS QUE IMPORTAM NESTA TELA: um nível derivado
 *  errado não quebra nada visível. A tela abre, mostra um nível, e quem
 *  administra salva achando que não mudou nada — e o papel da pessoa troca.
 *  Não há como descobrir isso olhando; dá para descobrir aqui.
 */

import { describe, expect, it } from 'vitest';

import {
  MODULOS,
  NIVEIS,
  estadoDoModulo,
  niveisConcediveis,
  nivelDoPapel,
  papelParaNivel,
} from '@/dominio/perfis';
import type { PapelDisponivel } from '@/dominio/tipos';

/** Um papel do catálogo, com tudo fechado por padrão.
 *
 *  Fechado por padrão de propósito: um auxiliar que abrisse bandeiras faria
 *  cada teste provar algo sobre um papel que o banco não tem.
 */
function papel(ajustes: Partial<PapelDisponivel> & { codigo: string }): PapelDisponivel {
  return {
    nome: ajustes.codigo,
    administra_acessos: false,
    administra_dicionarios: false,
    ve_campos_sensiveis: false,
    ve_diretorio: false,
    pode_criar: false,
    pode_editar_proprio: false,
    pode_editar_tudo: false,
    pode_exportar: false,
    acessa_crm: false,
    acessa_inteligencia_de_mercado: false,
    acessa_score: false,
    ...ajustes,
  };
}

/** O catálogo que as migrations 0003 e 0088 semeiam, nas bandeiras que importam.
 *
 *  OS PARES DA SÍNTESE SÃO O NÍVEL "MERCADO". Não há papel `mercado_*`, e não
 *  deve haver: `acessa_inteligencia_de_mercado` é o portal do painel que a capa chama de
 *  Inteligência de Mercado. Ver o comentário no topo de `perfis.ts`.
 */
const CATALOGO: PapelDisponivel[] = [
  papel({
    codigo: 'plataforma_leitura',
    acessa_crm: true,
    acessa_inteligencia_de_mercado: true,
    acessa_score: true,
    ve_campos_sensiveis: true,
  }),
  papel({
    codigo: 'plataforma_edicao',
    administra_acessos: true,
    administra_dicionarios: true,
    pode_criar: true,
    pode_editar_tudo: true,
    acessa_crm: true,
    acessa_inteligencia_de_mercado: true,
    acessa_score: true,
    ve_campos_sensiveis: true,
  }),
  papel({
    codigo: 'plataforma_edicao_sem_acessos',
    pode_criar: true,
    acessa_crm: true,
    acessa_inteligencia_de_mercado: true,
    acessa_score: true,
    ve_campos_sensiveis: true,
  }),
  papel({ codigo: 'crm_leitura', acessa_crm: true, ve_campos_sensiveis: true }),
  papel({
    codigo: 'crm_edicao',
    pode_criar: true,
    acessa_crm: true,
    ve_campos_sensiveis: true,
  }),
  papel({ codigo: 'inteligencia_de_mercado_leitura', acessa_inteligencia_de_mercado: true, ve_campos_sensiveis: true }),
  papel({
    codigo: 'inteligencia_de_mercado_edicao',
    pode_criar: true,
    acessa_inteligencia_de_mercado: true,
    ve_campos_sensiveis: true,
  }),
  papel({ codigo: 'score_leitura', acessa_score: true, ve_campos_sensiveis: true }),
  papel({
    codigo: 'score_edicao',
    pode_criar: true,
    acessa_score: true,
    ve_campos_sensiveis: true,
  }),
];

describe('o nível sai das bandeiras, e não do código do papel', () => {
  it.each([
    ['plataforma_edicao', 'admin'],
    ['plataforma_leitura', 'exec'],
    ['plataforma_edicao_sem_acessos', 'exec'],
    ['crm_leitura', 'crm'],
    ['crm_edicao', 'crm'],
    ['score_leitura', 'kpi'],
    ['score_edicao', 'kpi'],
    //: `sintese_*` É O NÍVEL MERCADO. Ver o comentário do catálogo.
    ['inteligencia_de_mercado_leitura', 'mercado'],
    ['inteligencia_de_mercado_edicao', 'mercado'],
  ])('%s cai no nível %s', (codigo, esperado) => {
    const p = CATALOGO.find((x) => x.codigo === codigo)!;
    expect(nivelDoPapel(p)).toBe(esperado);
  });

  it('o nível Mercado é o portal `sintese`, e não um portal próprio', () => {
    //: ESTE TESTE EXISTE PORQUE EU ERREI ISSO. A primeira versão desta mudança
    //: leu "Painel de Inteligência de Mercado" no descritivo, não achou portal
    //: com esse nome no banco, e criou um — `papel.acessa_mercado`, numa
    //: migration, com dois papéis novos.
    //:
    //: O painel já tinha portal: `acessa_inteligencia_de_mercado`. O rótulo da capa mudou e o
    //: nome interno não. O quarto portal concederia uma bandeira que não guarda
    //: rota nenhuma, o painel de verdade continuaria não concedido, e a tela
    //: pareceria certa — que é o pior formato de erro de autorização.
    const leitura = CATALOGO.find((p) => p.codigo === 'inteligencia_de_mercado_leitura')!;
    expect(leitura.acessa_inteligencia_de_mercado).toBe(true);
    expect(nivelDoPapel(leitura)).toBe('mercado');
    expect(papelParaNivel('mercado', false, CATALOGO)?.codigo).toBe('inteligencia_de_mercado_leitura');

    //: E não existe bandeira `acessa_mercado` para ninguém procurar.
    expect('acessa_mercado' in leitura).toBe(false);
  });

  it('administrar acessos DEFINE o nível, mesmo sem alcançar tudo', () => {
    //: A bandeira vem antes dos portais na decisão. Um papel que administre
    //: acessos e abra só o CRM ainda é administrador — e precisa aparecer como
    //: tal, porque é o que ele pode fazer de mais grave.
    const estranho = papel({ codigo: 'x', administra_acessos: true, acessa_crm: true });
    expect(nivelDoPapel(estranho)).toBe('admin');
  });

  it('um papel que não abre painel nenhum não tem nível', () => {
    expect(nivelDoPapel(papel({ codigo: 'vazio' }))).toBeNull();
  });

  it('cada nível do catálogo volta do papel que ele escolhe', () => {
    //: A ida e a volta fecham. Sem esta, `nivelDoPapel` e `papelParaNivel`
    //: podem discordar e a tela mostra um nível, salva outro.
    for (const n of NIVEIS) {
      for (const editor of [false, true]) {
        const escolhido = papelParaNivel(n.id, editor, CATALOGO);
        if (escolhido === null) continue;
        expect(nivelDoPapel(escolhido)).toBe(n.id);
      }
    }
  });
});

describe('o papel escolhido para cada nível', () => {
  it.each([
    ['exec', false, 'plataforma_leitura'],
    ['exec', true, 'plataforma_edicao_sem_acessos'],
    ['crm', false, 'crm_leitura'],
    ['crm', true, 'crm_edicao'],
    ['kpi', false, 'score_leitura'],
    ['kpi', true, 'score_edicao'],
    ['mercado', false, 'inteligencia_de_mercado_leitura'],
    ['mercado', true, 'inteligencia_de_mercado_edicao'],
  ] as const)('%s + editor=%s -> %s', (id, editor, esperado) => {
    expect(papelParaNivel(id, editor, CATALOGO)?.codigo).toBe(esperado);
  });

  it('o Executivo Editor NÃO é o papel que administra acessos', () => {
    //: O ponto da migration 0088. `plataforma_edicao` alcança os três portais E
    //: administra acessos; sem um papel separado, escolher "Executivo + Editor"
    //: daria gerenciamento de usuários a quem o descritivo diz que não deve ter
    //: — e daria em silêncio, porque a tela mostraria "Executivo".
    const escolhido = papelParaNivel('exec', true, CATALOGO)!;
    expect(escolhido.administra_acessos).toBe(false);
    expect(escolhido.pode_criar).toBe(true);
  });

  it('nível sem papel no catálogo devolve nulo em vez de um papel errado', () => {
    //: Acontece de verdade: antes de 0088 não havia "Executivo + Editor", e
    //: oferecer a opção faria a pessoa escolher, clicar em salvar e receber um
    //: erro que não é sobre nada que ela fez.
    const sem = CATALOGO.filter((p) => p.codigo !== 'plataforma_edicao_sem_acessos');
    expect(papelParaNivel('exec', true, sem)).toBeNull();
    expect(niveisConcediveis(sem).has('exec')).toBe(false);

    //: E o nível Mercado deixa de ser concedível num banco sem os papéis da
    //: Síntese — que são os dele.
    const semSintese = CATALOGO.filter((p) => !p.acessa_inteligencia_de_mercado);
    expect(papelParaNivel('mercado', false, semSintese)).toBeNull();
    expect(niveisConcediveis(semSintese).has('mercado')).toBe(false);
  });

  it('o catálogo semeado concede os cinco níveis', () => {
    const prontos = niveisConcediveis(CATALOGO);
    expect([...prontos].sort()).toEqual(['admin', 'crm', 'exec', 'kpi', 'mercado']);
  });
});

describe('o que o nível libera, recalculado antes de salvar', () => {
  it('administrador tem acesso total aos quatro módulos, com o painel no ar', () => {
    for (const m of MODULOS) {
      expect(estadoDoModulo(m.id, 'admin', false, true)).toBe('total');
    }
  });

  it('e o administrador também vê "ao lançar" no painel que não abriu', () => {
    //: A PORTA VEM ANTES DO ALCANCE, inclusive para quem administra.
    //:
    //: Antes, o Executivo via "Liberado ao lançar" no Mercado e o administrador
    //: via "Acesso total" — mesmo painel, mesmo instante, painel fechado.
    //: Administrar acessos não abre uma tela que não existe. Achado de revisão.
    expect(estadoDoModulo('mercado', 'admin', false, false)).toBe('ao-lancar');
    expect(estadoDoModulo('mercado', 'exec', false, false)).toBe('ao-lancar');

    //: E os outros módulos do administrador não mudam por causa disso.
    expect(estadoDoModulo('crm', 'admin', false, false)).toBe('total');
    expect(estadoDoModulo('kpi', 'admin', false, false)).toBe('total');
    expect(estadoDoModulo('usuarios', 'admin', false, false)).toBe('total');
  });

  it('quem não tem o nível continua sem acesso, painel fechado ou aberto', () => {
    //: O par do teste acima: a bandeira de lançamento não concede nada. Sem
    //: isto, o `if` da porta poderia transformar "sem acesso" em "ao lançar"
    //: para todo mundo — e a tela diria a quem não tem o nível que o acesso
    //: chega quando o painel abrir.
    expect(estadoDoModulo('mercado', 'crm', true, false)).toBe('sem-acesso');
    expect(estadoDoModulo('mercado', 'kpi', true, false)).toBe('sem-acesso');
  });

  it('sem nível, nada é liberado', () => {
    for (const m of MODULOS) {
      expect(estadoDoModulo(m.id, null, true, true)).toBe('sem-acesso');
    }
  });

  it('o Executivo alcança os painéis e NÃO o gerenciamento de usuários', () => {
    expect(estadoDoModulo('crm', 'exec', false, true)).toBe('consulta');
    expect(estadoDoModulo('kpi', 'exec', true, true)).toBe('editor');
    expect(estadoDoModulo('usuarios', 'exec', true, true)).toBe('sem-acesso');
  });

  it('o nível de um painel só não vaza para os outros', () => {
    expect(estadoDoModulo('crm', 'crm', true, true)).toBe('editor');
    expect(estadoDoModulo('kpi', 'crm', true, true)).toBe('sem-acesso');
    expect(estadoDoModulo('mercado', 'crm', true, true)).toBe('sem-acesso');
    expect(estadoDoModulo('usuarios', 'crm', true, true)).toBe('sem-acesso');
  });

  it('Mercado não lançado aparece como "ao lançar", e não como Editor', () => {
    //: ALCANCE E PORTA SÃO COISAS DIFERENTES. Quem tem o nível alcança o
    //: painel; o painel é que não responde. Mostrar "Editor" prometeria uma
    //: tela que não abre, e o chamado seria aberto contra a tela de acessos.
    expect(estadoDoModulo('mercado', 'mercado', true, false)).toBe('ao-lancar');
    expect(estadoDoModulo('mercado', 'exec', true, false)).toBe('ao-lancar');
    expect(estadoDoModulo('mercado', 'mercado', true, true)).toBe('editor');
  });

  it('a bandeira de lançamento não afeta os outros módulos', () => {
    expect(estadoDoModulo('crm', 'exec', false, false)).toBe('consulta');
    expect(estadoDoModulo('kpi', 'kpi', false, false)).toBe('consulta');
  });

  it('e não dá acesso a quem não tem o nível', () => {
    //: O par do teste acima: lançar o painel não é conceder o painel.
    expect(estadoDoModulo('mercado', 'crm', true, true)).toBe('sem-acesso');
  });
});
