import { describe, expect, it } from 'vitest';
import { interleaveByGroup } from '../utils';

describe('interleaveByGroup', () => {
  it('vazio → vazio', () => {
    expect(interleaveByGroup<{ k: string }>([], (x) => x.k)).toEqual([]);
  });

  it('1 item → mesmo array', () => {
    const items = [{ k: 'a', v: 1 }];
    expect(interleaveByGroup(items, (x) => x.k)).toEqual(items);
  });

  it('1 grupo só → mesmo array', () => {
    const items = [{ k: 'a', v: 1 }, { k: 'a', v: 2 }, { k: 'a', v: 3 }];
    expect(interleaveByGroup(items, (x) => x.k)).toEqual(items);
  });

  it('2 grupos balanceados → alterna', () => {
    const items = [
      { k: 'a', v: 1 },
      { k: 'a', v: 2 },
      { k: 'b', v: 10 },
      { k: 'b', v: 20 },
    ];
    const out = interleaveByGroup(items, (x) => x.k);
    // Esperado: a1, b10, a2, b20
    expect(out.map((x) => x.k)).toEqual(['a', 'b', 'a', 'b']);
    expect(out.map((x) => x.v)).toEqual([1, 10, 2, 20]);
  });

  it('grupos desbalanceados → distribui restantes no fim', () => {
    const items = [
      { k: 'a', v: 1 },
      { k: 'a', v: 2 },
      { k: 'a', v: 3 },
      { k: 'a', v: 4 },
      { k: 'a', v: 5 },
      { k: 'b', v: 10 },
      { k: 'b', v: 20 },
    ];
    const out = interleaveByGroup(items, (x) => x.k);
    // Esperado: a1, b10, a2, b20, a3, a4, a5
    expect(out.map((x) => x.k)).toEqual(['a', 'b', 'a', 'b', 'a', 'a', 'a']);
  });

  it('mantém ordem relativa dentro de cada grupo', () => {
    const items = [
      { k: 'a', v: 1 },
      { k: 'b', v: 100 },
      { k: 'a', v: 2 },
      { k: 'b', v: 200 },
      { k: 'a', v: 3 },
      { k: 'b', v: 300 },
    ];
    const out = interleaveByGroup(items, (x) => x.k);
    // Filtra por grupo e confere ordem original
    const as = out.filter((x) => x.k === 'a').map((x) => x.v);
    const bs = out.filter((x) => x.k === 'b').map((x) => x.v);
    expect(as).toEqual([1, 2, 3]);
    expect(bs).toEqual([100, 200, 300]);
  });

  it('preserva total de items', () => {
    const items = Array.from({ length: 50 }, (_, i) => ({
      k: ['a', 'b', 'c', 'd'][i % 4],
      v: i,
    }));
    const out = interleaveByGroup(items, (x) => x.k);
    expect(out.length).toBe(50);
  });

  it('3+ grupos round-robin', () => {
    const items = [
      { k: 'a', v: 1 },
      { k: 'a', v: 2 },
      { k: 'b', v: 10 },
      { k: 'b', v: 20 },
      { k: 'c', v: 100 },
      { k: 'c', v: 200 },
    ];
    const out = interleaveByGroup(items, (x) => x.k);
    expect(out.map((x) => x.k)).toEqual(['a', 'b', 'c', 'a', 'b', 'c']);
  });
});
