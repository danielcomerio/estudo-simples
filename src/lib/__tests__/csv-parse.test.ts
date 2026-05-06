import { describe, expect, it } from 'vitest';
import { parseCsvToQuestions, looksLikeCsv } from '../csv-parse';

describe('csv-parse', () => {
  describe('looksLikeCsv', () => {
    it('detecta CSV com cabeçalho', () => {
      expect(
        looksLikeCsv('enunciado,alt_a,alt_b,alt_c,gabarito\nx,1,2,3,A')
      ).toBe(true);
    });

    it('detecta com palavra alternativa', () => {
      expect(looksLikeCsv('pergunta,a,b,c,d,gab\n')).toBe(true);
    });

    it('rejeita JSON', () => {
      expect(looksLikeCsv('{"type":"objetiva","disciplina_id":"x"}')).toBe(false);
    });

    it('rejeita texto normal', () => {
      expect(looksLikeCsv('Olá, esse é um texto comum')).toBe(false);
    });
  });

  describe('parseCsvToQuestions', () => {
    it('parseia CSV simples', () => {
      const csv = `enunciado,alt_a,alt_b,alt_c,alt_d,alt_e,gabarito,disciplina
"Quem foi o primeiro presidente?",João,Pedro,Silva,Marcos,Antonio,A,Historia`;
      const r = parseCsvToQuestions(csv);
      expect(r.ok).toBe(true);
      expect(r.questions?.length).toBe(1);
      const q = r.questions![0] as Record<string, unknown>;
      expect(q.type).toBe('objetiva');
      expect(q.disciplina_id).toBe('Historia');
      const payload = q.payload as Record<string, unknown>;
      expect(payload.enunciado).toBe('Quem foi o primeiro presidente?');
      const alts = payload.alternativas as Array<{ letra: string; correta: boolean }>;
      expect(alts.length).toBe(5);
      expect(alts[0]).toEqual({ letra: 'A', texto: 'João', correta: true });
      expect(alts[1].correta).toBe(false);
    });

    it('aceita aspas escapadas', () => {
      const csv = `enunciado,alt_a,alt_b,gabarito,disciplina
"Diga ""olá"" em latim",salve,vale,A,Latim`;
      const r = parseCsvToQuestions(csv);
      expect(r.ok).toBe(true);
      const q = r.questions![0] as Record<string, unknown>;
      expect((q.payload as { enunciado: string }).enunciado).toBe(
        'Diga "olá" em latim'
      );
    });

    it('rejeita header faltando campo obrigatório', () => {
      const csv = `enunciado,alt_a,gabarito\nx,1,A`;
      const r = parseCsvToQuestions(csv);
      expect(r.ok).toBe(false);
      expect(r.error).toMatch(/disciplina/);
    });

    it('rejeita gabarito inválido', () => {
      const csv = `enunciado,alt_a,alt_b,gabarito,disciplina
x,1,2,Z,Mat`;
      const r = parseCsvToQuestions(csv);
      // Z não é A-E, linha pulada → 0 questões → erro
      expect(r.ok).toBe(false);
    });

    it('aceita variações de header (português)', () => {
      const csv = `pergunta,a,b,c,resposta,materia,assunto
"Capital do Brasil?",SP,RJ,Brasília,C,Geografia,capitais`;
      const r = parseCsvToQuestions(csv);
      expect(r.ok).toBe(true);
      const q = r.questions![0] as Record<string, unknown>;
      expect(q.tema).toBe('capitais');
      expect(q.disciplina_id).toBe('Geografia');
    });

    it('aceita dificuldade opcional', () => {
      const csv = `enunciado,alt_a,alt_b,gabarito,disciplina,dificuldade
x,1,2,A,Mat,4`;
      const r = parseCsvToQuestions(csv);
      expect(r.ok).toBe(true);
      const q = r.questions![0] as Record<string, unknown>;
      expect(q.dificuldade).toBe(4);
    });

    it('ignora dificuldade fora do range', () => {
      const csv = `enunciado,alt_a,alt_b,gabarito,disciplina,dificuldade
x,1,2,A,Mat,99`;
      const r = parseCsvToQuestions(csv);
      expect(r.ok).toBe(true);
      const q = r.questions![0] as Record<string, unknown>;
      expect(q.dificuldade).toBeUndefined();
    });

    it('múltiplas linhas', () => {
      const csv = `enunciado,alt_a,alt_b,gabarito,disciplina
Q1,1,2,A,Mat
Q2,3,4,B,Mat
Q3,5,6,A,Mat`;
      const r = parseCsvToQuestions(csv);
      expect(r.ok).toBe(true);
      expect(r.questions?.length).toBe(3);
    });

    it('CSV vazio retorna erro', () => {
      const r = parseCsvToQuestions('');
      expect(r.ok).toBe(false);
    });
  });
});
