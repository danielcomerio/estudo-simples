import { describe, expect, it } from 'vitest';
import {
  buildQuestionsCSV,
  buildDisciplinasCSV,
  buildHistoryCSV,
} from '../stats-export';
import type { Question } from '../types';

function mkQuestion(over: Partial<Question> = {}): Question {
  return {
    id: 'q1',
    user_id: 'u1',
    type: 'objetiva',
    disciplina_id: 'Português',
    tema: '',
    banca_estilo: 'FGV',
    dificuldade: 3,
    payload: { enunciado: 'Teste', alternativas: [], correta: 0 },
    srs: { dueDate: 0, repetitions: 0, easeFactor: 2.5, intervalDays: 0 },
    stats: { attempts: 0, correct: 0, wrong: 0, history: [] },
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...over,
  } as Question;
}

describe('buildQuestionsCSV', () => {
  it('header + 1 linha pra 1 questão', () => {
    const csv = buildQuestionsCSV([mkQuestion()]);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('id,tipo,disciplina');
  });

  it('escapa vírgula no campo', () => {
    const q = mkQuestion({ disciplina_id: 'Direito, Adm' });
    const csv = buildQuestionsCSV([q]);
    expect(csv).toContain('"Direito, Adm"');
  });

  it('escapa aspas duplas duplicando-as', () => {
    const q = mkQuestion({ tema: 'aspas " no meio' });
    const csv = buildQuestionsCSV([q]);
    expect(csv).toContain('"aspas "" no meio"');
  });

  it('pct_acerto = "" quando attempts = 0', () => {
    const csv = buildQuestionsCSV([mkQuestion()]);
    const cells = csv.split('\n')[1].split(',');
    // pct_acerto é a 13ª coluna (index 12)
    expect(cells[12]).toBe('');
  });

  it('pct_acerto correto com tentativas', () => {
    const q = mkQuestion({
      stats: { attempts: 4, correct: 3, wrong: 1, history: [] },
    });
    const csv = buildQuestionsCSV([q]);
    const cells = csv.split('\n')[1].split(',');
    expect(cells[12]).toBe('75');
  });

  it('tags joined por ;', () => {
    const q = mkQuestion({ tags: ['t1', 't2', 't3'] });
    const csv = buildQuestionsCSV([q]);
    expect(csv).toContain('t1;t2;t3');
  });
});

describe('buildDisciplinasCSV', () => {
  it('agrega por disciplina_id', () => {
    const qs = [
      mkQuestion({ id: 'a', disciplina_id: 'Port' }),
      mkQuestion({ id: 'b', disciplina_id: 'Port' }),
      mkQuestion({ id: 'c', disciplina_id: 'Mat' }),
    ];
    const csv = buildDisciplinasCSV(qs);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(3); // header + 2 disc
    expect(lines.find((l) => l.startsWith('Port'))).toContain(',2,'); // 2 questões
    expect(lines.find((l) => l.startsWith('Mat'))).toContain(',1,'); // 1 questão
  });

  it('disciplina vazia vira "(sem)"', () => {
    const csv = buildDisciplinasCSV([mkQuestion({ disciplina_id: '' })]);
    expect(csv).toContain('(sem),1');
  });

  it('inimigas: < 30% acerto com >= 3 tentativas', () => {
    const q = mkQuestion({
      disciplina_id: 'Mat',
      stats: { attempts: 10, correct: 2, wrong: 8, history: [] },
    });
    const csv = buildDisciplinasCSV([q]);
    const matLine = csv.split('\n')[1];
    // colunas: disciplina, total, attempts, correct, pct, due, novas, dominadas, inimigas
    expect(matLine.split(',')[8]).toBe('1');
  });

  it('dominadas: 5 últimos correct/self_pass', () => {
    const history = Array(5).fill({ date: 1, result: 'correct' as const });
    const q = mkQuestion({
      stats: { attempts: 5, correct: 5, wrong: 0, history },
    });
    const csv = buildDisciplinasCSV([q]);
    expect(csv.split('\n')[1].split(',')[7]).toBe('1');
  });

  it('novas: sem lastReviewed', () => {
    const q = mkQuestion();
    const csv = buildDisciplinasCSV([q]);
    expect(csv.split('\n')[1].split(',')[6]).toBe('1');
  });
});

describe('buildHistoryCSV', () => {
  it('1 linha por entry de history', () => {
    const q = mkQuestion({
      stats: {
        attempts: 3,
        correct: 2,
        wrong: 1,
        history: [
          { date: 1, result: 'correct' },
          { date: 2, result: 'wrong' },
          { date: 3, result: 'correct', confidence: 3, timeMs: 1234 },
        ],
      },
    });
    const csv = buildHistoryCSV([q]);
    expect(csv.split('\n')).toHaveLength(4); // header + 3
  });

  it('campos opcionais vazios quando ausentes', () => {
    const q = mkQuestion({
      stats: {
        attempts: 1,
        correct: 1,
        wrong: 0,
        history: [{ date: 1, result: 'correct' }],
      },
    });
    const csv = buildHistoryCSV([q]);
    const cells = csv.split('\n')[1].split(',');
    // confidence, time_ms, quality são as 3 últimas
    expect(cells.slice(-3)).toEqual(['', '', '']);
  });

  it('lista vazia → só header', () => {
    expect(buildHistoryCSV([]).split('\n')).toHaveLength(1);
  });
});
