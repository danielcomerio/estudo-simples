'use client';

import { useEffect, useState } from 'react';

/**
 * Camada de acesso à tabela question_concursos (Fase C1 - migration 0011).
 * Permite N:N entre questões e concursos: uma questão pode aparecer em
 * vários concursos sem duplicar.
 *
 * Estratégia:
 *  - questions.concurso_id continua sendo o "concurso primário" (1:1).
 *  - question_concursos adiciona vínculos extras (N:N).
 *  - Filtros por concurso devem unir os 2: questão é "do concurso X"
 *    se concurso_id = X OU existe linha em question_concursos com X.
 *
 * Sem cache offline-first — volume baixo (poucos vínculos por user em
 * geral). Reload sob demanda. Mutações vão direto ao Supabase.
 */

import { createClient } from './supabase/client';

export type QuestionConcursoLink = {
  id: string;
  user_id: string;
  question_id: string;
  concurso_id: string;
  created_at: string;
};

/** Lê todos os vínculos do user atual. Retorna mapa question_id → Set<concurso_id>. */
export async function loadAllLinks(): Promise<
  Map<string, Set<string>>
> {
  const sb = createClient();
  const { data, error } = await sb
    .from('question_concursos')
    .select('question_id, concurso_id');
  if (error) {
    // Schema pré-0011: tabela não existe — retorna vazio sem quebrar.
    if (/relation .* does not exist/i.test(error.message)) {
      return new Map();
    }
    throw new Error(error.message);
  }
  const out = new Map<string, Set<string>>();
  for (const row of (data ?? []) as Array<{
    question_id: string;
    concurso_id: string;
  }>) {
    let set = out.get(row.question_id);
    if (!set) {
      set = new Set();
      out.set(row.question_id, set);
    }
    set.add(row.concurso_id);
  }
  return out;
}

/** Vincula uma questão a um concurso. Idempotente (UNIQUE no DB). */
export async function linkQuestionToConcurso(
  questionId: string,
  concursoId: string
): Promise<void> {
  const sb = createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) throw new Error('Não autenticado');

  const { error } = await sb.from('question_concursos').insert({
    user_id: user.id,
    question_id: questionId,
    concurso_id: concursoId,
  });
  if (error) {
    // 23505 = já existe vínculo (UNIQUE) — ignora silenciosamente.
    if (error.code === '23505') return;
    throw new Error(error.message);
  }
}

/** Remove vínculo. Idempotente. */
export async function unlinkQuestionFromConcurso(
  questionId: string,
  concursoId: string
): Promise<void> {
  const sb = createClient();
  const { error } = await sb
    .from('question_concursos')
    .delete()
    .eq('question_id', questionId)
    .eq('concurso_id', concursoId);
  if (error) throw new Error(error.message);
}

/** Substitui o conjunto de vínculos de uma questão por um novo set. */
export async function setQuestionConcursos(
  questionId: string,
  concursoIds: string[]
): Promise<void> {
  const sb = createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) throw new Error('Não autenticado');

  // Lê os atuais
  const { data: existing } = await sb
    .from('question_concursos')
    .select('concurso_id')
    .eq('question_id', questionId);

  const current = new Set<string>(
    ((existing ?? []) as Array<{ concurso_id: string }>).map(
      (r) => r.concurso_id
    )
  );
  const desired = new Set(concursoIds);

  const toAdd = [...desired].filter((c) => !current.has(c));
  const toRemove = [...current].filter((c) => !desired.has(c));

  if (toAdd.length > 0) {
    const { error } = await sb.from('question_concursos').insert(
      toAdd.map((concurso_id) => ({
        user_id: user.id,
        question_id: questionId,
        concurso_id,
      }))
    );
    if (error && error.code !== '23505') throw new Error(error.message);
  }

  if (toRemove.length > 0) {
    const { error } = await sb
      .from('question_concursos')
      .delete()
      .eq('question_id', questionId)
      .in('concurso_id', toRemove);
    if (error) throw new Error(error.message);
  }
}

/**
 * Helper de filtro client-side: dada uma questão e um concurso ativo,
 * retorna true se a questão aparece nele (via concurso_id direto OU
 * via question_concursos).
 */
export function questionMatchesConcurso(
  question: { id: string; concurso_id?: string | null },
  concursoId: string,
  allLinks: Map<string, Set<string>>
): boolean {
  if (question.concurso_id === concursoId) return true;
  const links = allLinks.get(question.id);
  return links?.has(concursoId) ?? false;
}

// Cache em memória pra evitar refetch a cada mount de componente
let _cache: Map<string, Set<string>> | null = null;
let _loading = false;
let _listeners = new Set<() => void>();

function notify() {
  for (const l of _listeners) l();
}

async function ensureLoaded(): Promise<void> {
  if (_cache !== null || _loading) return;
  _loading = true;
  try {
    _cache = await loadAllLinks();
  } catch {
    _cache = new Map();
  } finally {
    _loading = false;
    notify();
  }
}

/** Invalida cache (útil após link/unlink/setQuestionConcursos). */
export function invalidateLinkCache(): void {
  _cache = null;
  notify();
  void ensureLoaded();
}

/**
 * Hook reativo: retorna o mapa de links (ou Map vazio enquanto carrega).
 * Compartilha cache entre todos os componentes que filtram por concurso
 * — evita N fetches.
 */
export function useQuestionConcursoLinks(): Map<string, Set<string>> {
  const [, setTick] = useState(0);
  useEffect(() => {
    void ensureLoaded();
    const fn = () => setTick((t) => t + 1);
    _listeners.add(fn);
    return () => {
      _listeners.delete(fn);
    };
  }, []);
  return _cache ?? new Map();
}
