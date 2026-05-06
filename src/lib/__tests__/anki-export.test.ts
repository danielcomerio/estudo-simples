import { describe, expect, it } from 'vitest';
import { questionsToAnkiCsv } from '../anki-export';
import type { Question } from '../types';

const baseQ: Question = {
  id: 'q1',
  user_id: 'u',
  type: 'objetiva',
  disciplina_id: 'Matematica',
  tema: null,
  banca_estilo: null,
  dificuldade: null,
  payload: {} as Record<string, unknown>,
  srs: {
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    dueDate: 0,
    lastReviewed: null,
  },
  stats: { attempts: 0, correct: 0, wrong: 0, history: [] },
  tags: [],
  concurso_id: null,
  topico_id: null,
  origem: null,
  fonte: undefined,
  verificacao: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  deleted_at: null,
};

describe('anki-export', () => {
  describe('questionsToAnkiCsv', () => {
    it('header com #separator', () => {
      const csv = questionsToAnkiCsv([]);
      expect(csv).toContain('#separator:Comma');
      expect(csv).toContain('#html:false');
    });

    it('objetiva: front=enunciado+alts, back=gabarito', () => {
      const q: Question = {
        ...baseQ,
        payload: {
          enunciado: 'Capital do Brasil?',
          alternativas: [
            { letra: 'A', texto: 'SP', correta: false },
            { letra: 'B', texto: 'RJ', correta: false },
            { letra: 'C', texto: 'Brasília', correta: true, explicacao: 'capital federal' },
          ],
        },
      };
      const csv = questionsToAnkiCsv([q]);
      expect(csv).toContain('Capital do Brasil?');
      expect(csv).toContain('A) SP');
      expect(csv).toContain('Gabarito: C');
      expect(csv).toContain('Brasília');
      expect(csv).toContain('capital federal');
    });

    it('flashcard: front+back direto', () => {
      const q: Question = {
        ...baseQ,
        type: 'flashcard',
        payload: { frente: 'Q1', verso: 'R1' },
      };
      const csv = questionsToAnkiCsv([q]);
      expect(csv).toContain('Q1');
      expect(csv).toContain('R1');
    });

    it('cloze: front com [___], back completo', () => {
      const q: Question = {
        ...baseQ,
        type: 'cloze',
        payload: { texto: 'A capital é {{c1::Brasília}} desde {{c2::1960}}.' },
      };
      const csv = questionsToAnkiCsv([q]);
      expect(csv).toContain('[___]');
      expect(csv).toContain('Brasília');
      expect(csv).toContain('1960');
    });

    it('discursiva: front=enunciado, back=espelho', () => {
      const q: Question = {
        ...baseQ,
        type: 'discursiva',
        payload: {
          enunciado: 'Disserte sobre X',
          espelho_resposta: 'Resposta modelo Y',
        },
      };
      const csv = questionsToAnkiCsv([q]);
      expect(csv).toContain('Disserte sobre X');
      expect(csv).toContain('Resposta modelo Y');
    });

    it('escapa vírgulas e aspas', () => {
      const q: Question = {
        ...baseQ,
        type: 'flashcard',
        payload: { frente: 'Frase com, vírgula', verso: 'Disse "olá"' },
      };
      const csv = questionsToAnkiCsv([q]);
      expect(csv).toContain('"Frase com, vírgula"');
      expect(csv).toContain('"Disse ""olá"""');
    });

    it('tags: disciplina + tags com espaço → underscore', () => {
      const q: Question = {
        ...baseQ,
        type: 'flashcard',
        payload: { frente: 'q', verso: 'r' },
        disciplina_id: 'Direito Constitucional',
        tags: ['art 5 cf', 'fundamentais'],
      };
      const csv = questionsToAnkiCsv([q]);
      expect(csv).toContain('Direito_Constitucional art_5_cf fundamentais');
    });

    it('pula questões com front ou back vazios', () => {
      const q: Question = {
        ...baseQ,
        type: 'flashcard',
        payload: { frente: '', verso: 'algo' },
      };
      const csv = questionsToAnkiCsv([q]);
      // Só header — questão vazia pulada
      const lines = csv.split('\n').filter((l) => !l.startsWith('#'));
      expect(lines.length).toBe(0);
    });

    it('múltiplas questões → uma linha cada', () => {
      const qs = [
        { ...baseQ, type: 'flashcard' as const, payload: { frente: 'a', verso: 'b' } },
        { ...baseQ, id: 'q2', type: 'flashcard' as const, payload: { frente: 'c', verso: 'd' } },
      ];
      const csv = questionsToAnkiCsv(qs);
      const dataLines = csv.split('\n').filter((l) => !l.startsWith('#') && l.trim());
      expect(dataLines.length).toBe(2);
    });
  });
});
