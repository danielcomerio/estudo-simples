import { describe, expect, it } from 'vitest';
import {
  applyAnswer,
  formatBatchForAI,
  parseAIResponse,
} from '../revisor';
import type { ObjetivaPayload, Question } from '../types';
import { newSRS, newStats } from '../srs';

const mkQ = (id: string, enun: string, letras: string[]): Question => ({
  id,
  user_id: 'u',
  type: 'objetiva',
  disciplina_id: 'd',
  tema: null,
  banca_estilo: null,
  dificuldade: null,
  payload: {
    enunciado: enun,
    alternativas: letras.map((l) => ({ letra: l, texto: 'opção ' + l })),
  } as ObjetivaPayload,
  srs: newSRS(),
  stats: newStats(),
  created_at: '',
  updated_at: '',
  deleted_at: null,
});

describe('formatBatchForAI', () => {
  it('vazio retorna ""', () => {
    expect(formatBatchForAI([])).toBe('');
  });

  it('inclui instrução, total e separadores', () => {
    const qs = [mkQ('q1', 'enunciado 1', ['A', 'B'])];
    const out = formatBatchForAI(qs);
    expect(out).toContain('Q1:');
    expect(out).toContain('Total de questões: 1');
    expect(out).toContain('Q1) enunciado 1');
    expect(out).toContain('A) opção A');
    expect(out).toContain('B) opção B');
  });

  it('separa múltiplas com ---', () => {
    const qs = [
      mkQ('q1', 'um', ['A', 'B']),
      mkQ('q2', 'dois', ['A', 'B']),
    ];
    const out = formatBatchForAI(qs);
    expect(out).toContain('Q1) um');
    expect(out).toContain('Q2) dois');
    expect(out.split('---').length).toBeGreaterThan(1);
  });
});

describe('parseAIResponse', () => {
  it('vazio retorna Map vazio', () => {
    expect(parseAIResponse('').size).toBe(0);
  });

  it('formato Q1: C', () => {
    const r = parseAIResponse('Q1: C\nQ2: A\nQ3: E');
    expect(r.get(1)).toBe('C');
    expect(r.get(2)).toBe('A');
    expect(r.get(3)).toBe('E');
  });

  it('formato 1) C', () => {
    const r = parseAIResponse('1) A\n2) B\n3) C');
    expect(r.get(1)).toBe('A');
    expect(r.get(2)).toBe('B');
    expect(r.get(3)).toBe('C');
  });

  it('formato 1. C', () => {
    const r = parseAIResponse('1. D\n2. E');
    expect(r.get(1)).toBe('D');
    expect(r.get(2)).toBe('E');
  });

  it('formato 1 - C', () => {
    const r = parseAIResponse('1 - C\n2 - A');
    expect(r.get(1)).toBe('C');
    expect(r.get(2)).toBe('A');
  });

  it('formato 1 = C', () => {
    const r = parseAIResponse('1=C 2=A 3=E');
    expect(r.get(1)).toBe('C');
    expect(r.get(2)).toBe('A');
    expect(r.get(3)).toBe('E');
  });

  it('case-insensitive na letra', () => {
    const r = parseAIResponse('Q1: c\nQ2: a');
    expect(r.get(1)).toBe('C');
    expect(r.get(2)).toBe('A');
  });

  it('aceita "letra" no meio do match', () => {
    const r = parseAIResponse('Q1: letra C\nQ2: Letra A');
    expect(r.get(1)).toBe('C');
    expect(r.get(2)).toBe('A');
  });

  it('última ocorrência ganha em duplicatas', () => {
    const r = parseAIResponse('Q1: A\nQ1: D');
    expect(r.get(1)).toBe('D');
  });

  it('ignora linhas sem padrão reconhecível', () => {
    const r = parseAIResponse('lalala\nQ1: B\noutra coisa');
    expect(r.get(1)).toBe('B');
    expect(r.size).toBe(1);
  });

  it('múltiplas respostas inline', () => {
    const r = parseAIResponse('Q1: A, Q2: B, Q3: C');
    expect(r.get(1)).toBe('A');
    expect(r.get(2)).toBe('B');
    expect(r.get(3)).toBe('C');
  });
});

describe('applyAnswer', () => {
  it('marca alternativa correta + gabarito', () => {
    const q = mkQ('q1', 'enun', ['A', 'B', 'C', 'D', 'E']);
    const updated = applyAnswer(q, 'C');
    expect(updated).not.toBeNull();
    expect(updated!.gabarito).toBe('C');
    expect(updated!.alternativas.find((a) => a.letra === 'C')?.correta).toBe(true);
    expect(updated!.alternativas.find((a) => a.letra === 'A')?.correta).toBe(false);
  });

  it('case-insensitive na entrada', () => {
    const q = mkQ('q1', 'enun', ['A', 'B', 'C']);
    expect(applyAnswer(q, 'b')?.gabarito).toBe('B');
  });

  it('retorna null se letra não existe na questão', () => {
    const q = mkQ('q1', 'enun', ['A', 'B', 'C']);
    expect(applyAnswer(q, 'D')).toBeNull();
  });

  it('preserva campos extras do payload', () => {
    const q = mkQ('q1', 'enun', ['A', 'B']);
    (q.payload as ObjetivaPayload).explicacao_geral = 'preexistente';
    const updated = applyAnswer(q, 'A');
    expect(updated?.explicacao_geral).toBe('preexistente');
  });
});
