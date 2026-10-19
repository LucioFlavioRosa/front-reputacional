import { describe, expect, it } from 'vitest';

import type { ArvoreDaTaxonomia } from '@/api/score';
import {
  composicao,
  escreverEstado,
  indexar,
  lerEstado,
  passa,
  totais,
  valorDeCor,
} from '@/dominio/arvoreDaTaxonomia';
import FIXTURE from '@/paginas/score/metodologia/fixtures/arvore.json';

//: A FIXTURE É A RESPOSTA DA ROTA com o cadastro carregado da planilha que
//: fechou a taxonomia (20261008_..._Depara.xlsx) — o back confere a rota
//: contra a planilha; aqui se confere a tela contra a rota.
const copia = (): ArvoreDaTaxonomia => structuredClone(FIXTURE) as ArvoreDaTaxonomia;

describe('Árvore da taxonomia', () => {
  it('com a fixture: 7 pilares, 41 temas e 104 subtemas; 32 riscos em 8 clusters', () => {
    const indice = indexar(copia());
    expect(totais(indice, 'atributo').map((t) => t.valor)).toEqual([7, 41, 104]);
    expect(indice.colunasPorAtributo).toHaveLength(7);
    expect(indice.colunasPorAtributo.flatMap((c) => c.grupos)).toHaveLength(41);
    const riscos = indice.colunasPorRisco.filter((c) => !c.semEnquadramento);
    expect(riscos).toHaveLength(8);
    expect(riscos.flatMap((c) => c.grupos)).toHaveLength(32);
    // Todo subtema aparece uma vez em cada árvore.
    const naDeRisco = indice.colunasPorRisco.flatMap((c) => c.grupos.flatMap((g) => g.subtemas));
    expect(naDeRisco).toHaveLength(104);
  });

  it('numera pela ordem do cadastro, e a numeração acompanha a ordem', () => {
    const arvore = copia();
    const primeiro = [...arvore.pilares].sort((a, b) => a.ordem - b.ordem)[0];
    expect(indexar(arvore).colunasPorAtributo[0].nome).toBe(`1. ${primeiro.nome}`);
    expect(indexar(arvore).colunasPorAtributo[0].grupos[1].numero).toBe('1.2');
    // Mandar o primeiro pilar para o fim muda o número, sem número gravado.
    primeiro.ordem = 99;
    expect(indexar(arvore).colunasPorAtributo.at(-1)?.nome).toBe(`7. ${primeiro.nome}`);
  });

  it('renomear, mover subtema e criar pilar aparecem sem mudar código', () => {
    const arvore = copia();
    const subtema = arvore.subtemas[0];
    const outroTema = arvore.temas.find((t) => t.id !== subtema.tema_id)!;
    subtema.nome = 'Nome novo';
    subtema.tema_id = outroTema.id;
    arvore.pilares.push({ id: 999, nome: 'Pilar novo', ordem: 99 });
    arvore.temas.push({ id: 998, nome: 'Tema novo', ordem: 1, pilar_id: 999 });
    arvore.subtemas.push({ id: 997, nome: 'Subtema novo', tema_id: 998, lso: null, risco_id: null });

    const indice = indexar(arvore);
    const grupo = indice.colunasPorAtributo.flatMap((c) => c.grupos).find((g) => g.chave === `t${outroTema.id}`)!;
    expect(grupo.subtemas.map((s) => s.nome)).toContain('Nome novo');
    expect(indice.colunasPorAtributo.at(-1)?.nome).toBe('8. Pilar novo');
    const sem = indice.colunasPorRisco.find((c) => c.semEnquadramento)!;
    expect(sem.grupos[0].subtemas.map((s) => s.nome)).toContain('Subtema novo');
  });

  it('uma classificação nova vinda do cadastro pinta e filtra sem mudar código', () => {
    const arvore = copia();
    arvore.cores.push({
      chave: 'nova',
      nome: 'Classificação nova',
      titulo: 'Classificação nova',
      explicacao: 'Cor do subtema: classificação nova.',
      alvo: 'subtema',
      campo: 'nova',
      valores: [{ codigo: 'a', nome: 'A', cor: '#000000', hachurado: false }],
      vazio: { codigo: 'nenhum', nome: 'Nenhum', cor: '#FFFFFF', hachurado: false },
    });
    arvore.subtemas[0].nova = 'a';
    const indice = indexar(arvore);
    const nova = arvore.cores.at(-1)!;
    expect(valorDeCor(indice, nova, arvore.subtemas[0]).nome).toBe('A');
    expect(composicao(indice, nova, arvore.subtemas).map((c) => c.quantos)).toEqual([1, 103]);
    expect(passa(indice, nova, arvore.subtemas[0], '', new Set(['a']))).toBe(true);
    expect(passa(indice, nova, arvore.subtemas[1], '', new Set(['a']))).toBe(false);
  });

  it('a severidade sai do risco primário, e o subtema sem risco cai no vazio', () => {
    const arvore = copia();
    const indice = indexar(arvore);
    const severidade = arvore.cores.find((d) => d.alvo === 'risco')!;
    const comRisco = arvore.subtemas.find((s) => s.risco_id != null)!;
    const risco = arvore.riscos.find((r) => r.id === comRisco.risco_id)!;
    expect(valorDeCor(indice, severidade, comRisco).codigo).toBe(risco.severidade);
    const semRisco = arvore.subtemas.find((s) => s.risco_id == null)!;
    expect(valorDeCor(indice, severidade, semRisco)).toBe(severidade.vazio);
  });

  it('a busca ignora acento e caixa, e alcança o tema e o risco', () => {
    const arvore = copia();
    const indice = indexar(arvore);
    const severidade = arvore.cores[0];
    const alvo = arvore.subtemas.find((s) => /[áéíóúãõç]/i.test(s.nome))!;
    const semAcento = alvo.nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
    expect(passa(indice, severidade, alvo, semAcento, new Set())).toBe(true);
    const tema = arvore.temas.find((t) => t.id === alvo.tema_id)!;
    expect(passa(indice, severidade, alvo, tema.nome, new Set())).toBe(true);
  });

  it('o estado vai e volta pela URL, sem apagar o que não é dela', () => {
    const estado = { visao: 'risco' as const, cor: 'lso', filtro: ['a', 'b'], busca: 'água', subtema: 12 };
    const consulta = escreverEstado('?mes=2026-08', estado);
    expect(consulta).toContain('mes=2026-08');
    expect(lerEstado(consulta)).toEqual(estado);
    expect(lerEstado('')).toEqual({ visao: 'atributo', cor: '', filtro: [], busca: '', subtema: null });
  });
});
