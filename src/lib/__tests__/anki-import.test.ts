import { describe, expect, it } from 'vitest';
import { parseAnkiTxt, ankiRowsToImport } from '../anki-import';

describe('parseAnkiTxt', () => {
  it('parseia formato TAB simples (default Anki)', () => {
    const txt = 'Frente A\tVerso A\nFrente B\tVerso B';
    const r = parseAnkiTxt(txt);
    expect(r.rows.length).toBe(2);
    expect(r.rows[0]).toEqual({ frente: 'Frente A', verso: 'Verso A', tags: [] });
    expect(r.rows[1]).toEqual({ frente: 'Frente B', verso: 'Verso B', tags: [] });
  });

  it('respeita #separator:comma', () => {
    const txt = '#separator:comma\nFrente A,Verso A';
    const r = parseAnkiTxt(txt);
    expect(r.rows.length).toBe(1);
    expect(r.rows[0].frente).toBe('Frente A');
    expect(r.rows[0].verso).toBe('Verso A');
  });

  it('respeita #separator:semicolon', () => {
    const txt = '#separator:semicolon\nA;B';
    const r = parseAnkiTxt(txt);
    expect(r.rows[0].verso).toBe('B');
  });

  it('extrai tags via #tags column', () => {
    const txt = '#tags column:3\nFrente\tVerso\ttag1 tag2';
    const r = parseAnkiTxt(txt);
    expect(r.rows[0].tags.length).toBeGreaterThan(0);
  });

  it('strip HTML básico', () => {
    const txt = '<b>Bold</b><br>Line2\tVerso<i>italic</i>';
    const r = parseAnkiTxt(txt);
    expect(r.rows[0].frente).toContain('Bold');
    expect(r.rows[0].frente).not.toContain('<b>');
    expect(r.rows[0].verso).toContain('italic');
    expect(r.rows[0].verso).not.toContain('<i>');
  });

  it('decode entities HTML', () => {
    const txt = 'Pergunta &amp; teste\tResposta &lt;ok&gt;';
    const r = parseAnkiTxt(txt);
    expect(r.rows[0].frente).toContain('&');
    expect(r.rows[0].verso).toContain('<ok>');
  });

  it('ignora BOM e linhas vazias', () => {
    const txt = '﻿\n\nFrente\tVerso\n\n';
    const r = parseAnkiTxt(txt);
    expect(r.rows.length).toBe(1);
  });

  it('ignora linhas sem verso', () => {
    const txt = 'Frente sem verso\nFrente\tVerso';
    const r = parseAnkiTxt(txt);
    expect(r.rows.length).toBe(1);
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it('comentários começando com # contam separadamente', () => {
    const txt = '#metadata foo\n#outro\nFrente\tVerso';
    const r = parseAnkiTxt(txt);
    expect(r.commentLines).toBeGreaterThanOrEqual(2);
    expect(r.rows.length).toBe(1);
  });
});

describe('ankiRowsToImport', () => {
  it('converte rows pra formato autoral flashcard', () => {
    const rows = [
      { frente: 'Q1', verso: 'A1', tags: ['banca-fgv'] },
      { frente: 'Q2', verso: 'A2', tags: [] },
    ];
    const items = ankiRowsToImport(rows);
    expect(items.length).toBe(2);
    expect(items[0].type).toBe('flashcard');
    expect(items[0].frente).toBe('Q1');
    expect(items[0].verso).toBe('A1');
    expect(items[0].origem).toBe('autoral');
  });

  it('aplica disciplinaDefault quando fornecida', () => {
    const items = ankiRowsToImport(
      [{ frente: 'F', verso: 'V', tags: [] }],
      'Direito'
    );
    expect(items[0].disciplina_id).toBe('Direito');
  });

  it('default disciplina = "sem-disciplina" quando ausente', () => {
    const items = ankiRowsToImport([{ frente: 'F', verso: 'V', tags: [] }]);
    expect(items[0].disciplina_id).toBe('sem-disciplina');
  });
});
