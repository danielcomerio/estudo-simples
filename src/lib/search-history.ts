/**
 * Histórico de buscas no /banco. Persistido em localStorage.
 *
 * Cap em N entries (default 10). Mais recente primeiro. Deduplica:
 * se o user repete uma busca, ela vai pro topo (não duplica).
 *
 * Buscas com < 3 chars ou só prefixos (tag:, disc:) não entram —
 * pouco úteis pra recuperar depois.
 */

const KEY = 'estudo-simples:banco:search-history';
const MAX_ENTRIES = 10;
const MIN_LENGTH = 3;

export function loadSearchHistory(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((s) => typeof s === 'string').slice(0, MAX_ENTRIES);
    }
  } catch {}
  return [];
}

export function saveSearchHistory(entry: string): void {
  if (typeof window === 'undefined') return;
  const trimmed = entry.trim();
  if (trimmed.length < MIN_LENGTH) return;
  // Skip se for SÓ prefixos (sem texto livre)
  const onlyPrefixes = trimmed
    .split(/\s+/)
    .every((tok) =>
      /^(tag|disc|banca|id|due|bookmark|fav):/i.test(tok) || tok === '⭐'
    );
  if (onlyPrefixes) return;
  try {
    const existing = loadSearchHistory();
    // Dedup: remove a versão antiga se existir
    const next = [trimmed, ...existing.filter((s) => s !== trimmed)].slice(
      0,
      MAX_ENTRIES
    );
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
}

export function clearSearchHistory(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(KEY);
  } catch {}
}
