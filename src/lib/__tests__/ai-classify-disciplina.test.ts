import { describe, expect, it } from 'vitest';
import { parseResponse } from '../ai-classify-disciplina';

describe('parseResponse', () => {
  it('JSON válido com todos campos', () => {
    const text = `{"mappings":[{"novo":"Direito Adm","match":"Direito Administrativo","confidence":0.9}]}`;
    const r = parseResponse(text, ['Direito Adm']);
    expect(r.size).toBe(1);
    expect(r.get('Direito Adm')).toEqual({
      match: 'Direito Administrativo',
      confidence: 0.9,
    });
  });

  it('match null preservado', () => {
    const text = `{"mappings":[{"novo":"X","match":null,"confidence":0.2}]}`;
    const r = parseResponse(text, ['X']);
    expect(r.get('X')?.match).toBeNull();
  });

  it('confidence clampado em [0,1]', () => {
    const text = `{"mappings":[{"novo":"X","match":"Y","confidence":2.5}]}`;
    const r = parseResponse(text, ['X']);
    expect(r.get('X')?.confidence).toBe(1);
  });

  it('JSON wrapped em texto extra (markdown)', () => {
    const text = `Here is the result:\n\n\`\`\`json\n{"mappings":[{"novo":"X","match":"Y","confidence":0.8}]}\n\`\`\``;
    const r = parseResponse(text, ['X']);
    expect(r.get('X')?.confidence).toBe(0.8);
  });

  it('JSON malformado → defaults all', () => {
    const r = parseResponse('not json at all', ['X', 'Y']);
    expect(r.get('X')).toEqual({ match: null, confidence: 0 });
    expect(r.get('Y')).toEqual({ match: null, confidence: 0 });
  });

  it('lista vazia → map vazio', () => {
    const r = parseResponse('{"mappings":[]}', []);
    expect(r.size).toBe(0);
  });

  it('mappings com items inválidos descartados', () => {
    const text = `{"mappings":[{"novo":"X","match":"Y","confidence":0.5},{"x":"y"},null]}`;
    const r = parseResponse(text, ['X']);
    expect(r.get('X')?.confidence).toBe(0.5);
  });
});
