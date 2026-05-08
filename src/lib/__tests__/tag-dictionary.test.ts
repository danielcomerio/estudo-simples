import { describe, expect, it } from 'vitest';
import {
  ALL_TAGS,
  allKnownTags,
  canonicalTag,
  canonicalizeTagList,
  tagCategory,
  tagDescription,
} from '../tag-dictionary';

describe('canonicalTag', () => {
  it('reconhece banca via alias curto', () => {
    expect(canonicalTag('fgv')).toBe('banca-fgv');
    expect(canonicalTag('FGV')).toBe('banca-fgv');
    expect(canonicalTag('Cebraspe')).toBe('banca-cebraspe');
    expect(canonicalTag('CESPE')).toBe('banca-cebraspe'); // alias legado
  });

  it('reconhece origem via alias', () => {
    expect(canonicalTag('ia')).toBe('gabarito-ia');
    expect(canonicalTag('AI-Generated')).toBe('gabarito-ia');
    expect(canonicalTag('oficial')).toBe('gabarito-oficial');
  });

  it('tag desconhecida = slug puro', () => {
    expect(canonicalTag('art-5-cf')).toBe('art-5-cf');
    expect(canonicalTag('Algo Custom')).toBe('algo-custom');
  });

  it('preserva canonical já correto', () => {
    expect(canonicalTag('banca-fgv')).toBe('banca-fgv');
  });

  it('input vazio = string vazia', () => {
    expect(canonicalTag('')).toBe('');
  });
});

describe('canonicalizeTagList', () => {
  it('aplica canonical + dedup', () => {
    const r = canonicalizeTagList(['fgv', 'FGV', 'banca-fgv', 'art-5']);
    expect(r).toEqual(['banca-fgv', 'art-5']);
  });

  it('preserva ordem da primeira ocorrência', () => {
    const r = canonicalizeTagList(['art-5', 'fgv', 'art-5', 'cespe']);
    expect(r).toEqual(['art-5', 'banca-fgv', 'banca-cebraspe']);
  });

  it('lista vazia → []', () => {
    expect(canonicalizeTagList([])).toEqual([]);
  });
});

describe('tagDescription', () => {
  it('descrição pra tag conhecida', () => {
    expect(tagDescription('banca-fgv')).toContain('FGV');
    expect(tagDescription('gabarito-ia')).toContain('IA');
  });

  it('null pra tag desconhecida', () => {
    expect(tagDescription('art-5')).toBe(null);
  });
});

describe('tagCategory', () => {
  it('categoria certa pra cada grupo', () => {
    expect(tagCategory('banca-fgv')).toBe('banca');
    expect(tagCategory('gabarito-ia')).toBe('origem');
    expect(tagCategory('pegadinha')).toBe('foco');
    expect(tagCategory('anulada')).toBe('status');
  });
});

describe('ALL_TAGS', () => {
  it('todos têm canonical não-vazio + categoria', () => {
    for (const t of ALL_TAGS) {
      expect(t.canonical).toBeTruthy();
      expect(t.category).toBeTruthy();
    }
  });

  it('todos canonicals são únicos', () => {
    const set = new Set(ALL_TAGS.map((t) => t.canonical));
    expect(set.size).toBe(ALL_TAGS.length);
  });

  it('allKnownTags() retorna lista completa', () => {
    expect(allKnownTags().length).toBe(ALL_TAGS.length);
  });
});
