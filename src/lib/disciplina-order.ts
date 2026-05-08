'use client';

/**
 * Ordem manual de disciplinas no /disciplinas — persistida em
 * localStorage. Sem migration (per-device, simplesmente cosmético).
 *
 * Storage: 'estudo-simples:disciplina-order' = JSON array de nomes
 * em ordem desejada.
 */

const KEY = 'estudo-simples:disciplina-order';

export function readOrder(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((x): x is string => typeof x === 'string');
  } catch {
    return [];
  }
}

export function writeOrder(order: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(order));
  } catch {
    /* ignore */
  }
}

/** Move um item up/down dentro da ordem. Se item não existe na ordem,
 *  insere na posição apropriada baseado em allNames. */
export function move(
  order: string[],
  allNames: string[],
  name: string,
  direction: -1 | 1
): string[] {
  // Garante que todos allNames estão em order (preserva ordem existente,
  // append novos no fim na ordem alfabética)
  const merged = [...order];
  for (const n of allNames) {
    if (!merged.includes(n)) merged.push(n);
  }
  // Remove nomes que não existem mais
  const filtered = merged.filter((n) => allNames.includes(n));

  const idx = filtered.indexOf(name);
  if (idx < 0) return filtered;
  const newIdx = idx + direction;
  if (newIdx < 0 || newIdx >= filtered.length) return filtered;
  const swapped = [...filtered];
  [swapped[idx], swapped[newIdx]] = [swapped[newIdx], swapped[idx]];
  return swapped;
}

/** Aplica ordem custom em uma lista de nomes. Nomes não-listados vão pro fim. */
export function applyOrder(allNames: string[], order: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of order) {
    if (allNames.includes(n) && !seen.has(n)) {
      out.push(n);
      seen.add(n);
    }
  }
  for (const n of allNames) {
    if (!seen.has(n)) out.push(n);
  }
  return out;
}
