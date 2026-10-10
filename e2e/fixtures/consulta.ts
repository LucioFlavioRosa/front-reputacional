import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// -------------------------------------------------------------------------
// AS RESPOSTAS DO ENDPOINT `/consulta` NO TESTE DE PONTA A PONTA (D5)
//
// A Consulta em profundidade lê os dados reais do mês em
// `GET /api/score/lentes/{codigo}/consulta?mes=AAAA-MM`, que devolve o tipo
// `Dados` do drill com UMA lente em `lentes`. Aqui a resposta é DERIVADA do
// JSON ilustrativo que os testes do front já usam
// (`src/paginas/score/consulta/dados/fixtures/consulta-profundidade.dados.json`),
// em vez de uma cópia dele em `e2e/fixtures/`: uma fonte só, e o roteiro G
// continua conferindo os mesmos números que os testes jsdom.
//
// O AVISO É O DA FONTE ILUSTRATIVA ('Dados ilustrativos'), para o selo
// continuar aparecendo no roteiro. `consultaReal` simula a resposta de dados
// reais: aviso vazio e um nó de fechamento 'sem-tema'.
// -------------------------------------------------------------------------

/** O mínimo do tipo `Dados` que o teste precisa tocar (os tipos do front
 *  ficam fora do `tsconfig` do e2e). */
interface NoDaConsulta {
  id: string;
  nome: string;
  volume: number;
  impacto: number;
  sentimento: { pos: number; neu: number; neg: number };
  filhos?: NoDaConsulta[];
}

interface ConsultaJson {
  meta: { aviso: string } & Record<string, unknown>;
  lentes: ({ id: string; pilares: NoDaConsulta[] } & Record<string, unknown>)[];
}

const ARQUIVO_ILUSTRATIVO = join(
  import.meta.dirname,
  '..',
  '..',
  'src',
  'paginas',
  'score',
  'consulta',
  'dados',
  'fixtures',
  'consulta-profundidade.dados.json',
);

export const AVISO_ILUSTRATIVO = 'Dados ilustrativos';

/** As lentes que o endpoint responde (as que têm drill no front, D2). */
export const LENTES_DA_CONSULTA = ['imprensa', 'mercado'] as const;

function base(): ConsultaJson {
  return JSON.parse(readFileSync(ARQUIVO_ILUSTRATIVO, 'utf-8')) as ConsultaJson;
}

/** A resposta de `/consulta` com a lente ilustrativa e o selo. */
export function consultaIlustrativa(lente: string): ConsultaJson {
  const dados = base();
  return {
    ...dados,
    meta: { ...dados.meta, aviso: AVISO_ILUSTRATIVO },
    lentes: dados.lentes.filter((l) => l.id === lente),
  };
}

/** A resposta de dados reais da Imprensa: `aviso` vazio (o selo some) e a
 *  linha de fechamento 'Sem tema identificado' entre os temas da Eficiência,
 *  como o back manda as matérias sem tema da taxonomia. */
export function consultaReal(): ConsultaJson {
  const dados = consultaIlustrativa('imprensa');
  dados.meta = { ...dados.meta, aviso: '' };
  const eficiencia = dados.lentes[0].pilares.find((p) => p.id === 'eficiencia-operacional');
  if (!eficiencia?.filhos) throw new Error('consultaReal: a Imprensa ilustrativa mudou de forma');
  eficiencia.filhos.push({
    id: 'sem-tema',
    nome: 'Sem tema identificado',
    volume: 4,
    impacto: -0.2,
    sentimento: { pos: 0, neu: 50, neg: 50 },
  });
  return dados;
}
