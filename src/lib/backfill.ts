/**
 * Lógica pura de backfill — sem IO. Permite testar dedup/normalização
 * isoladamente; o script CLI (scripts/backfill-disciplinas.ts) chama
 * estas funções e cuida das chamadas Supabase.
 */

export type QuestionDiscPicker = {
  disciplina_id: string | null;
  deleted_at: string | null;
};

/**
 * Extrai nomes únicos de disciplina das questões ativas.
 *
 * Regras:
 *  - Ignora questões soft-deleted (`deleted_at != null`).
 *  - `trim()` em cada nome.
 *  - Strings vazias após trim são ignoradas.
 *  - Dedup case-insensitive: "Portugues" e "portugues" colidem (espelha
 *    o índice unique `lower(nome)` da migration 0002). A primeira
 *    ocorrência (visualmente) é mantida — preserva capitalização do
 *    usuário.
 *  - Resultado ordenado alfabeticamente (case-insensitive) pra saída
 *    determinística.
 */
export function extractUniqueDisciplinaNomes(
  questions: QuestionDiscPicker[]
): string[] {
  const byLower = new Map<string, string>();
  for (const q of questions) {
    if (q.deleted_at) continue;
    const raw = q.disciplina_id;
    if (typeof raw !== 'string') continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (!byLower.has(key)) byLower.set(key, trimmed);
  }
  return Array.from(byLower.values()).sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase())
  );
}

/**
 * Dada a lista alvo (do `extractUniqueDisciplinaNomes`) e a lista das
 * disciplinas que JÁ existem no servidor, retorna apenas os nomes que
 * faltam inserir (também case-insensitive).
 *
 * Idempotência: se rodado 2x, segunda execução retorna [].
 */
export function diffDisciplinasFaltantes(
  alvo: string[],
  existentes: string[]
): string[] {
  const existentesLower = new Set(existentes.map((n) => n.toLowerCase()));
  return alvo.filter((n) => !existentesLower.has(n.toLowerCase()));
}
