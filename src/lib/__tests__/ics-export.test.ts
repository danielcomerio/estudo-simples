import { describe, expect, it } from 'vitest';
import { generateRevisionICS } from '../ics-export';
import type { Question } from '../types';

const DAY = 86400000;

function mockQuestion(overrides: Partial<Question>): Question {
  return {
    id: 'q1',
    user_id: 'user1',
    type: 'objetiva',
    disciplina_id: 'matematica',
    tema: 'tema',
    banca_estilo: null,
    dificuldade: 3,
    payload: {} as Record<string, unknown>,
    srs: {
      easeFactor: 2.5,
      interval: 1,
      repetitions: 1,
      dueDate: Date.now() + DAY,
      lastReviewed: Date.now(),
    },
    stats: { attempts: 0, correct: 0, wrong: 0 },
    tags: [],
    concurso_id: null,
    topico_id: null,
    origem: null,
    fonte: null,
    verificacao: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
    ...overrides,
  } as Question;
}

describe('generateRevisionICS', () => {
  it('gera ICS válido sem questões', () => {
    const ics = generateRevisionICS([], 30);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('END:VCALENDAR');
    expect(ics).toContain('VERSION:2.0');
    expect(ics).toContain('X-WR-CALNAME:Estudo Simples');
  });

  it('linhas terminam com CRLF (RFC 5545)', () => {
    const ics = generateRevisionICS([], 30);
    expect(ics).toMatch(/\r\n/);
  });

  it('cria evento pra dia futuro', () => {
    const tomorrow = Date.now() + DAY;
    const q = mockQuestion({
      srs: {
        ...({} as Question['srs']),
        dueDate: tomorrow,
        easeFactor: 2.5,
        interval: 1,
        repetitions: 1,
        lastReviewed: Date.now(),
      },
    });
    const ics = generateRevisionICS([q], 30);
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('END:VEVENT');
    expect(ics).toContain('1 revisão');
  });

  it('agrupa N questões do mesmo dia em 1 evento', () => {
    const day = Date.now() + 2 * DAY;
    const qs = Array.from({ length: 5 }, (_, i) =>
      mockQuestion({
        id: `q${i}`,
        srs: {
          dueDate: day,
          easeFactor: 2.5,
          interval: 1,
          repetitions: 1,
          lastReviewed: Date.now(),
        },
      })
    );
    const ics = generateRevisionICS(qs, 30);
    // 1 evento (5 agrupadas) — não 5 eventos
    const events = ics.split('BEGIN:VEVENT').length - 1;
    expect(events).toBe(1);
    expect(ics).toContain('5 revisões');
  });

  it('atrasadas viram evento "hoje"', () => {
    const yesterday = Date.now() - DAY;
    const q = mockQuestion({
      srs: {
        dueDate: yesterday,
        easeFactor: 2.5,
        interval: 1,
        repetitions: 1,
        lastReviewed: Date.now() - 2 * DAY,
      },
    });
    const ics = generateRevisionICS([q], 30);
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('1 revisão');
  });

  it('respeita daysAhead — não inclui questões além do limite', () => {
    const farFuture = Date.now() + 60 * DAY;
    const q = mockQuestion({
      srs: {
        dueDate: farFuture,
        easeFactor: 2.5,
        interval: 60,
        repetitions: 1,
        lastReviewed: Date.now(),
      },
    });
    const ics = generateRevisionICS([q], 30);
    // 60 dias > 30 dias daysAhead, não vira evento
    expect(ics.split('BEGIN:VEVENT').length - 1).toBe(0);
  });

  it('escapa caracteres especiais ICS', () => {
    // Contagem alta deveria gerar texto livre de qualquer ; ou , ou \
    // (nosso DESCRIPTION é fixo). Smoke test que não há corrupção:
    const qs = Array.from({ length: 3 }, (_, i) =>
      mockQuestion({
        id: `q${i}`,
        srs: {
          dueDate: Date.now() + DAY,
          easeFactor: 2.5,
          interval: 1,
          repetitions: 1,
          lastReviewed: Date.now(),
        },
      })
    );
    const ics = generateRevisionICS(qs, 30);
    // Nada de ; cru fora de campos válidos (DTSTART;VALUE=DATE é válido)
    expect(ics).not.toMatch(/SUMMARY:[^\r\n]*[^\\];/);
  });
});
