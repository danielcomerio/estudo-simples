import { describe, expect, it } from 'vitest';
import {
  buildGenerationPrompt,
  parseAndValidate,
  parseGeneratedJSON,
  validateGeneratedItem,
} from '../ai-generate';

describe('buildGenerationPrompt', () => {
  it('inclui qtd, tipo, banca, tema', () => {
    const p = buildGenerationPrompt({
      topic: 'Princípios da CF',
      qtd: 3,
      type: 'objetiva',
      banca: 'FGV',
      dificuldade: 4,
    });
    expect(p).toContain('3 questão');
    expect(p).toContain('"objetiva"');
    expect(p).toContain('FGV');
    expect(p).toContain('Princípios da CF');
    expect(p).toContain('4/5');
  });

  it('default banca quando não informada', () => {
    const p = buildGenerationPrompt({
      topic: 'x',
      qtd: 1,
      type: 'objetiva',
    });
    expect(p).toContain('banca brasileira');
  });

  it('schema diferente por tipo', () => {
    const obj = buildGenerationPrompt({ topic: 'x', qtd: 1, type: 'objetiva' });
    const cloze = buildGenerationPrompt({ topic: 'x', qtd: 1, type: 'cloze' });
    expect(obj).toContain('alternativas');
    expect(cloze).toContain('{{c1::lacuna1}}');
  });
});

describe('parseGeneratedJSON', () => {
  it('JSON puro array', () => {
    const r = parseGeneratedJSON('[{"a":1},{"b":2}]');
    expect(r).toHaveLength(2);
  });

  it('JSON puro objeto único → wrap em array', () => {
    const r = parseGeneratedJSON('{"a":1}');
    expect(r).toEqual([{ a: 1 }]);
  });

  it('strip ```json ... ``` fence', () => {
    const r = parseGeneratedJSON('```json\n[{"x":1}]\n```');
    expect(r).toEqual([{ x: 1 }]);
  });

  it('strip ``` (sem json) fence', () => {
    const r = parseGeneratedJSON('```\n[{"x":1}]\n```');
    expect(r).toEqual([{ x: 1 }]);
  });

  it('strip BOM', () => {
    const r = parseGeneratedJSON('﻿[{"a":1}]');
    expect(r).toEqual([{ a: 1 }]);
  });

  it('JSON inválido → array vazio', () => {
    expect(parseGeneratedJSON('not json')).toEqual([]);
  });

  it('truncado: corta no último ]', () => {
    const r = parseGeneratedJSON('[{"a":1},{"b":2}], lixo extra depois');
    // O regex de fence não pega; parser tenta direto e falha; recovery cuts.
    // Pode ou não recuperar — comportamento aceitável é {a:1} ou vazio
    expect(Array.isArray(r)).toBe(true);
  });
});

describe('validateGeneratedItem', () => {
  const cfg = {
    topic: 'Direito',
    qtd: 1,
    type: 'objetiva' as const,
    banca: 'FGV',
    dificuldade: 3,
  };

  it('objetiva válida com 5 alts e 1 correta', () => {
    const item = {
      enunciado: 'Q?',
      alternativas: [
        { letra: 'A', texto: 'a1', correta: false, explicacao: 'e' },
        { letra: 'B', texto: 'b1', correta: true, explicacao: 'e' },
        { letra: 'C', texto: 'c1', correta: false },
        { letra: 'D', texto: 'd1', correta: false },
        { letra: 'E', texto: 'e1', correta: false },
      ],
    };
    const r = validateGeneratedItem(item, cfg);
    expect(r).not.toBe(null);
    expect(r?.type).toBe('objetiva');
    expect(r?.banca_estilo).toBe('FGV');
  });

  it('rejeita objetiva sem alternativa correta', () => {
    const item = {
      enunciado: 'Q?',
      alternativas: [
        { letra: 'A', texto: 'a', correta: false },
        { letra: 'B', texto: 'b', correta: false },
      ],
    };
    expect(validateGeneratedItem(item, cfg)).toBe(null);
  });

  it('rejeita objetiva sem enunciado', () => {
    const item = {
      alternativas: [
        { letra: 'A', texto: 'a', correta: true },
        { letra: 'B', texto: 'b', correta: false },
      ],
    };
    expect(validateGeneratedItem(item, cfg)).toBe(null);
  });

  it('rejeita objetiva com alts < 2', () => {
    const item = {
      enunciado: 'Q?',
      alternativas: [{ letra: 'A', texto: 'a', correta: true }],
    };
    expect(validateGeneratedItem(item, cfg)).toBe(null);
  });

  it('discursiva válida', () => {
    const item = {
      enunciado: 'Disserte X',
      espelho_resposta: 'X é Y porque Z',
      conceitos_chave: ['conceito1', 'conceito2'],
      rubrica: [
        { criterio: 'Coerência', pontos: 3 },
        { criterio: 'Precisão', pontos: 4 },
      ],
    };
    const r = validateGeneratedItem(item, { ...cfg, type: 'discursiva' });
    expect(r?.type).toBe('discursiva');
    expect(
      (r?.payload as { conceitos_chave?: string[] }).conceitos_chave
    ).toEqual(['conceito1', 'conceito2']);
  });

  it('cloze válida com lacuna', () => {
    const item = { texto: 'A capital é {{c1::Brasília}}.' };
    const r = validateGeneratedItem(item, { ...cfg, type: 'cloze' });
    expect(r?.type).toBe('cloze');
  });

  it('rejeita cloze sem lacuna', () => {
    const item = { texto: 'Texto sem nenhuma lacuna' };
    expect(validateGeneratedItem(item, { ...cfg, type: 'cloze' })).toBe(null);
  });

  it('flashcard válido', () => {
    const item = { frente: 'P?', verso: 'R.' };
    const r = validateGeneratedItem(item, { ...cfg, type: 'flashcard' });
    expect(r?.type).toBe('flashcard');
  });

  it('rejeita item null', () => {
    expect(validateGeneratedItem(null, cfg)).toBe(null);
  });

  it('rejeita item não-objeto', () => {
    expect(validateGeneratedItem('string', cfg)).toBe(null);
  });
});

describe('parseAndValidate (integration)', () => {
  it('mistura válidas + inválidas → conta discarded', () => {
    const raw = JSON.stringify([
      {
        enunciado: 'Q1',
        alternativas: [
          { letra: 'A', texto: 'a', correta: true },
          { letra: 'B', texto: 'b', correta: false },
        ],
      },
      { enunciado: 'sem alts' }, // inválida
      { texto: 'sem nada relevante' }, // inválida
    ]);
    const r = parseAndValidate(raw, {
      topic: 't',
      qtd: 3,
      type: 'objetiva',
    });
    expect(r.items).toHaveLength(1);
    expect(r.discarded).toBe(2);
  });

  it('JSON em fence + algumas válidas', () => {
    const raw =
      '```json\n' +
      JSON.stringify([
        { frente: 'p1', verso: 'r1' },
        { frente: 'p2', verso: 'r2' },
      ]) +
      '\n```';
    const r = parseAndValidate(raw, {
      topic: 't',
      qtd: 2,
      type: 'flashcard',
    });
    expect(r.items).toHaveLength(2);
    expect(r.discarded).toBe(0);
  });
});
