import { describe, it, expect } from 'vitest';
import {
  slugify,
  normalizeTag,
  normalizeDisplayName,
  isSameSlug,
  levenshtein,
  findSimilar,
  normalizeTagList,
} from '../normalize';

describe('slugify', () => {
  it('lowercase + remove acento', () => {
    expect(slugify('Matemática')).toBe('matematica');
    expect(slugify('Coração')).toBe('coracao');
    expect(slugify('São João')).toBe('sao-joao');
  });

  it('substitui qualquer não-alfanumérico por hífen', () => {
    expect(slugify('Art. 5º, CF/88')).toBe('art-5-cf-88');
    expect(slugify('Direito_Penal!')).toBe('direito-penal');
    expect(slugify('a/b\\c')).toBe('a-b-c');
  });

  it('trima hífens nas pontas e colapsa repetidos', () => {
    expect(slugify('  matemática  ')).toBe('matematica');
    expect(slugify('---abc---')).toBe('abc');
    expect(slugify('a   b')).toBe('a-b');
  });

  it('retorna vazio pra inputs nulos/vazios', () => {
    expect(slugify('')).toBe('');
    expect(slugify('   ')).toBe('');
    expect(slugify('!@#$')).toBe('');
  });

  it('é determinístico — mesma string, mesmo slug', () => {
    const inputs = ['Matemática', 'Matematica', 'MATEMÁTICA', '  matemática  '];
    const slugs = inputs.map(slugify);
    expect(new Set(slugs).size).toBe(1);
    expect(slugs[0]).toBe('matematica');
  });

  it('limita a 200 chars', () => {
    const long = 'a'.repeat(300);
    expect(slugify(long).length).toBe(200);
  });
});

describe('normalizeTag', () => {
  it('cap em 50 chars', () => {
    const long = 'tag-' + 'x'.repeat(100);
    expect(normalizeTag(long).length).toBe(50);
  });

  it('aplica slugify normal pra tags curtas', () => {
    expect(normalizeTag('Art. 5º')).toBe('art-5');
    expect(normalizeTag('FGV')).toBe('fgv');
  });
});

describe('normalizeDisplayName', () => {
  it('trim + colapsa whitespace, preserva acentos e case', () => {
    expect(normalizeDisplayName('  Matemática  Discreta ')).toBe(
      'Matemática Discreta'
    );
    expect(normalizeDisplayName('São\tJoão')).toBe('São João');
  });

  it('handles null/undefined', () => {
    expect(normalizeDisplayName(undefined as unknown as string)).toBe('');
    expect(normalizeDisplayName(null as unknown as string)).toBe('');
  });
});

describe('isSameSlug', () => {
  it('detecta variações da mesma string', () => {
    expect(isSameSlug('Matemática', 'matematica')).toBe(true);
    expect(isSameSlug('  MAT  ', 'mat')).toBe(true);
    expect(isSameSlug('Art. 5', 'art_5')).toBe(true);
  });

  it('distingue strings de fato diferentes', () => {
    expect(isSameSlug('matematica', 'fisica')).toBe(false);
    expect(isSameSlug('art-5', 'art-6')).toBe(false);
  });

  it('falha pra strings vazias', () => {
    expect(isSameSlug('', '')).toBe(false);
    expect(isSameSlug('!@#', '$%^')).toBe(false);
  });
});

describe('levenshtein', () => {
  it('zero pra strings idênticas', () => {
    expect(levenshtein('abc', 'abc')).toBe(0);
  });

  it('1 pra um caractere de diferença', () => {
    expect(levenshtein('abc', 'abd')).toBe(1);
    expect(levenshtein('abc', 'ab')).toBe(1);
    expect(levenshtein('abc', 'abcd')).toBe(1);
  });

  it('Infinity pra diferenças de tamanho extremas (early exit)', () => {
    expect(levenshtein('a', 'a'.repeat(50))).toBe(Infinity);
  });

  it('handles edge cases', () => {
    expect(levenshtein('', '')).toBe(0);
    expect(levenshtein('', 'abc')).toBe(3);
    expect(levenshtein('abc', '')).toBe(3);
  });
});

describe('findSimilar', () => {
  it('encontra typos', () => {
    const tags = ['matematica', 'fisica', 'quimica', 'historia'];
    expect(findSimilar('matemtica', tags)).toEqual(['matematica']);
    expect(findSimilar('historya', tags)).toEqual(['historia']);
  });

  it('retorna até 3, ordenado por distância', () => {
    const tags = ['art-5', 'art-6', 'art-7', 'art-50'];
    const result = findSimilar('art-4', tags);
    expect(result).toHaveLength(3);
    expect(result[0]).toMatch(/^art-[567]$/);
  });

  it('exclui match exato', () => {
    expect(findSimilar('matematica', ['matematica', 'fisica'])).toEqual([]);
    expect(findSimilar('Matemática', ['matematica'])).toEqual([]);
  });

  it('retorna vazio se nada cabe no threshold', () => {
    expect(findSimilar('xyz', ['matematica', 'fisica'])).toEqual([]);
  });

  it('retorna vazio pra candidato com slug vazio', () => {
    expect(findSimilar('', ['matematica'])).toEqual([]);
    expect(findSimilar('!@#', ['matematica'])).toEqual([]);
  });
});

describe('normalizeTagList', () => {
  it('aceita array', () => {
    expect(normalizeTagList(['art-5', 'BANCA FGV'])).toEqual([
      'art-5',
      'banca-fgv',
    ]);
  });

  it('aceita string com vírgula/ponto-e-vírgula', () => {
    expect(normalizeTagList('art-5, banca-fgv; ano-2024')).toEqual([
      'art-5',
      'banca-fgv',
      'ano-2024',
    ]);
  });

  it('dedup por slug', () => {
    expect(normalizeTagList(['Art. 5', 'art-5', 'ART_5'])).toEqual(['art-5']);
  });

  it('filtra strings vazias e não-strings', () => {
    expect(normalizeTagList(['art-5', '', '  ', null, 42, 'fgv'])).toEqual([
      'art-5',
      'fgv',
    ]);
  });

  it('handles input não-array/não-string', () => {
    expect(normalizeTagList(undefined)).toEqual([]);
    expect(normalizeTagList(null)).toEqual([]);
    expect(normalizeTagList(42)).toEqual([]);
    expect(normalizeTagList({})).toEqual([]);
  });
});
