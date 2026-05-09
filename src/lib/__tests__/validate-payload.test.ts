import { describe, expect, it } from 'vitest';
import { validatePayload } from '../validate-payload';

describe('validatePayload — objetiva', () => {
  it('válida com enunciado + 2 alternativas + correta', () => {
    const r = validatePayload('objetiva', {
      enunciado: 'Pergunta?',
      alternativas: [
        { letra: 'A', texto: 'A1', correta: true },
        { letra: 'B', texto: 'B1' },
      ],
    });
    expect(r.ok).toBe(true);
  });

  it('falha sem enunciado', () => {
    const r = validatePayload('objetiva', {
      alternativas: [{ letra: 'A', texto: 'x', correta: true }],
    });
    expect(r.ok).toBe(false);
  });

  it('falha com letras duplicadas', () => {
    const r = validatePayload('objetiva', {
      enunciado: 'Q',
      alternativas: [
        { letra: 'A', texto: 'a', correta: true },
        { letra: 'A', texto: 'b' },
      ],
    });
    expect(r.ok).toBe(false);
  });

  it('aceita gabarito mesmo sem correta=true', () => {
    const r = validatePayload('objetiva', {
      enunciado: 'Q',
      alternativas: [
        { letra: 'A', texto: 'a' },
        { letra: 'B', texto: 'b' },
      ],
      gabarito: 'A',
    });
    expect(r.ok).toBe(true);
  });
});

describe('validatePayload — flashcard', () => {
  it('válido', () => {
    const r = validatePayload('flashcard', { frente: 'F', verso: 'V' });
    expect(r.ok).toBe(true);
  });
  it('falha sem frente', () => {
    const r = validatePayload('flashcard', { verso: 'V' });
    expect(r.ok).toBe(false);
  });
  it('falha sem verso', () => {
    const r = validatePayload('flashcard', { frente: 'F' });
    expect(r.ok).toBe(false);
  });
});

describe('validatePayload — cloze', () => {
  it('válido com marker', () => {
    const r = validatePayload('cloze', { texto: 'Capital é {{c1::Brasília}}' });
    expect(r.ok).toBe(true);
  });
  it('falha sem marker', () => {
    const r = validatePayload('cloze', { texto: 'Sem cloze nenhum' });
    expect(r.ok).toBe(false);
  });
});

describe('validatePayload — discursiva', () => {
  it('válido com enunciado', () => {
    const r = validatePayload('discursiva', { enunciado: 'Disserte sobre X.' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.warnings).toBeDefined(); // warning sem espelho
    }
  });
  it('falha sem enunciado', () => {
    const r = validatePayload('discursiva', {});
    expect(r.ok).toBe(false);
  });
});

describe('validatePayload — soma', () => {
  it('válido', () => {
    const r = validatePayload('soma', {
      enunciado: 'Marque os corretos',
      itens: [
        { valor: 1, texto: 'a', correta: true },
        { valor: 2, texto: 'b' },
      ],
    });
    expect(r.ok).toBe(true);
  });
  it('warning sem nenhum correto', () => {
    const r = validatePayload('soma', {
      enunciado: 'X',
      itens: [
        { valor: 1, texto: 'a' },
        { valor: 2, texto: 'b' },
      ],
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.warnings).toBeDefined();
  });
});

describe('validatePayload — bordas', () => {
  it('payload null retorna erro', () => {
    const r = validatePayload('objetiva', null);
    expect(r.ok).toBe(false);
  });
  it('payload array retorna erro', () => {
    const r = validatePayload('objetiva', []);
    expect(r.ok).toBe(false);
  });
});
