import { describe, expect, it } from 'vitest';
import {
  diffDisciplinasFaltantes,
  extractUniqueDisciplinaNomes,
  type QuestionDiscPicker,
} from '../backfill';

const mk = (
  disciplina_id: string | null,
  deleted_at: string | null = null
): QuestionDiscPicker => ({ disciplina_id, deleted_at });

describe('extractUniqueDisciplinaNomes', () => {
  it('lista vazia → []', () => {
    expect(extractUniqueDisciplinaNomes([])).toEqual([]);
  });

  it('dedup simples', () => {
    expect(
      extractUniqueDisciplinaNomes([mk('a'), mk('b'), mk('a')])
    ).toEqual(['a', 'b']);
  });

  it('ignora questões soft-deleted', () => {
    expect(
      extractUniqueDisciplinaNomes([
        mk('a'),
        mk('b', '2026-01-01T00:00:00Z'),
      ])
    ).toEqual(['a']);
  });

  it('ignora null e strings vazias/whitespace', () => {
    expect(
      extractUniqueDisciplinaNomes([
        mk(null),
        mk(''),
        mk('   '),
        mk('válido'),
      ])
    ).toEqual(['válido']);
  });

  it('faz trim antes de comparar', () => {
    expect(
      extractUniqueDisciplinaNomes([mk('  Direito  '), mk('Direito')])
    ).toEqual(['Direito']);
  });

  it('dedup case-insensitive (espelha índice DB lower(nome))', () => {
    const r = extractUniqueDisciplinaNomes([
      mk('Portugues'),
      mk('portugues'),
      mk('PORTUGUES'),
    ]);
    expect(r).toHaveLength(1);
    // Primeira ocorrência preserva capitalização original
    expect(r[0]).toBe('Portugues');
  });

  it('ordena case-insensitive', () => {
    const r = extractUniqueDisciplinaNomes([
      mk('zoologia'),
      mk('Antropologia'),
      mk('biologia'),
    ]);
    expect(r).toEqual(['Antropologia', 'biologia', 'zoologia']);
  });

  it('não confia em tipos: ignora valores não-string mesmo que JSON force', () => {
    const malicious = [
      { disciplina_id: 42 as unknown as string, deleted_at: null },
      { disciplina_id: { x: 1 } as unknown as string, deleted_at: null },
      { disciplina_id: 'ok', deleted_at: null },
    ];
    expect(extractUniqueDisciplinaNomes(malicious)).toEqual(['ok']);
  });
});

describe('diffDisciplinasFaltantes', () => {
  it('se nada existe, alvo inteiro vai', () => {
    expect(diffDisciplinasFaltantes(['a', 'b'], [])).toEqual(['a', 'b']);
  });

  it('se tudo existe, retorna []', () => {
    expect(diffDisciplinasFaltantes(['a', 'b'], ['a', 'b'])).toEqual([]);
  });

  it('comparação case-insensitive contra existentes', () => {
    expect(diffDisciplinasFaltantes(['Direito'], ['DIREITO'])).toEqual([]);
    expect(diffDisciplinasFaltantes(['Português'], ['portugues'])).toEqual([
      'Português',
    ]); // ês ≠ es — caracteres diferentes, não colide
  });

  it('é idempotente quando combinado com extractUniqueDisciplinaNomes', () => {
    const questions = [mk('a'), mk('b'), mk('A')];
    const alvo = extractUniqueDisciplinaNomes(questions);
    expect(alvo).toEqual(['a', 'b']); // 'A' colidiu com 'a' (case-insensitive)
    // 1ª passada: nada existe ainda → cria os 2
    expect(diffDisciplinasFaltantes(alvo, [])).toEqual(['a', 'b']);
    // 2ª passada simulando que 'a' foi inserida → falta 'b'
    expect(diffDisciplinasFaltantes(alvo, ['a'])).toEqual(['b']);
    // 3ª passada com tudo já criado → nada a fazer (idempotente)
    expect(diffDisciplinasFaltantes(alvo, ['a', 'b'])).toEqual([]);
  });
});
