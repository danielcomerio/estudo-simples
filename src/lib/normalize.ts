/**
 * Normalização canônica pra disciplinas, tags e identificadores
 * derivados de input livre. Garante que "Matemática", "matematica" e
 * "MAT" não viram entries diferentes no banco.
 *
 * Regra: slug determinístico = lowercase ASCII + kebab-case.
 * Display name = string original (com acento, capitalização).
 *
 * Exemplos:
 *   slugify("Matemática Discreta") → "matematica-discreta"
 *   slugify("Art. 5º, CF/88")      → "art-5-cf-88"
 *   slugify("  Já FOI  ")          → "ja-foi"
 */

const DIACRITICS_RE = /[̀-ͯ]/g;

/** Converte string livre em slug kebab-case ASCII. Determinístico. */
export function slugify(s: string): string {
  if (!s) return '';
  return s
    .normalize('NFD')
    .replace(DIACRITICS_RE, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200);
}

/** Slug de tag — mesmo do slugify mas com cap menor (50 chars). */
export function normalizeTag(s: string): string {
  return slugify(s).slice(0, 50);
}

/**
 * Trim + colapsa whitespace múltiplo. Mantém capitalização e acentos
 * (display preservado). Pra slug interno, usar slugify().
 */
export function normalizeDisplayName(s: string): string {
  return (s ?? '').trim().replace(/\s+/g, ' ');
}

/** Heurística: dois nomes são "o mesmo" se têm o mesmo slug. */
export function isSameSlug(a: string, b: string): boolean {
  return slugify(a) === slugify(b) && slugify(a) !== '';
}

/**
 * Levenshtein distance — quantas edições (insert/delete/substitute)
 * pra transformar a em b. Otimizado pra strings curtas (tags, nomes).
 * Retorna Infinity se diferença de tamanho já excede um threshold
 * razoável (early exit pra performance).
 */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  if (Math.abs(m - n) > 10) return Infinity;
  let prev = new Array<number>(n + 1);
  let cur = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      cur[j] = Math.min(
        cur[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + cost
      );
    }
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}

/**
 * Sugere nomes/tags existentes similares ao candidato. Retorna até 3
 * matches ordenados por proximidade (Levenshtein no slug).
 *
 * Ignora o próprio candidato se aparecer na lista.
 *
 * threshold = max edits permitidos (default 2 — pega "matemtica" vs
 * "matematica", "art-5" vs "art-05", mas não casos completamente
 * diferentes).
 */
export function findSimilar(
  candidate: string,
  existing: readonly string[],
  threshold = 2
): string[] {
  const candSlug = slugify(candidate);
  if (!candSlug) return [];
  const ranked = existing
    .map((e) => ({ name: e, slug: slugify(e) }))
    .filter((e) => e.slug && e.slug !== candSlug)
    .map((e) => ({ ...e, dist: levenshtein(candSlug, e.slug) }))
    .filter((e) => e.dist <= threshold && e.dist < Infinity)
    .sort((a, b) => a.dist - b.dist);
  return ranked.slice(0, 3).map((e) => e.name);
}

/**
 * Aceita string ou array, retorna array de tags normalizadas e dedup-
 * licadas (por slug). Filtra strings vazias.
 *
 * - "art-5, banca-fgv" → ["art-5", "banca-fgv"]
 * - ["Art. 5", "art-5", ""] → ["art-5"]
 */
export function normalizeTagList(input: unknown): string[] {
  let arr: string[] = [];
  if (Array.isArray(input)) {
    arr = input.filter((x): x is string => typeof x === 'string');
  } else if (typeof input === 'string') {
    arr = input.split(/[,;]/).map((t) => t.trim());
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of arr) {
    const slug = normalizeTag(t);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    out.push(slug);
  }
  return out;
}
