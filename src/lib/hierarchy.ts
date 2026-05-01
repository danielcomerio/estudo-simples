'use client';

/**
 * Camada de acesso às entidades da hierarquia (concursos, disciplinas,
 * tópicos, edital_itens). Volume baixo (dezenas de linhas por user),
 * então NÃO usamos o offline-first do `store.ts` — fazemos cache em
 * memória + refetch sob demanda. Mutações vão direto ao Supabase com
 * RLS validando user_id.
 *
 * Validação acontece em 3 camadas:
 *  1. UI (componentes de formulário) — para feedback imediato.
 *  2. Esta lib (validateX) — defense-in-depth pré-rede.
 *  3. DB (CHECK constraints da migration 0002) — última linha.
 *
 * Erros de rede ou validação viram throw — chamadores devem
 * try/catch + toast.
 */

import { useEffect, useState } from 'react';
import { createClient } from './supabase/client';
import type {
  Concurso,
  ConcursoStatus,
  Disciplina,
} from './types';

// =====================================================================
// Validação compartilhada
// =====================================================================

export class HierarchyValidationError extends Error {
  constructor(public field: string, msg: string) {
    super(`${field}: ${msg}`);
    this.name = 'HierarchyValidationError';
  }
}

type TextRules = {
  required?: boolean;
  max: number;
  pattern?: RegExp;
  patternMsg?: string;
};

/** Valida um campo de texto opcional ou obrigatório com limites. */
export function validateText(
  field: string,
  val: unknown,
  rules: TextRules
): string | null {
  if (val === undefined || val === null) {
    if (rules.required) {
      throw new HierarchyValidationError(field, 'obrigatório');
    }
    return null;
  }
  if (typeof val !== 'string') {
    throw new HierarchyValidationError(field, 'tipo inválido');
  }
  const trimmed = val.trim();
  if (!trimmed) {
    if (rules.required) {
      throw new HierarchyValidationError(field, 'obrigatório');
    }
    return null;
  }
  if (trimmed.length > rules.max) {
    throw new HierarchyValidationError(
      field,
      `máximo ${rules.max} caracteres`
    );
  }
  if (rules.pattern && !rules.pattern.test(trimmed)) {
    throw new HierarchyValidationError(
      field,
      rules.patternMsg ?? 'formato inválido'
    );
  }
  return trimmed;
}

// =====================================================================
// Concursos
// =====================================================================

export type ConcursoInput = {
  nome: string;
  banca?: string | null;
  orgao?: string | null;
  cargo?: string | null;
  data_prova?: string | null;
  status?: ConcursoStatus;
  edital_url?: string | null;
  notas?: string | null;
};

const VALID_STATUS: ConcursoStatus[] = ['ativo', 'arquivado', 'concluido'];

export function validateConcursoInput(input: ConcursoInput): void {
  validateText('nome', input.nome, { required: true, max: 200 });
  if (input.banca !== undefined)
    validateText('banca', input.banca, { max: 100 });
  if (input.orgao !== undefined)
    validateText('orgao', input.orgao, { max: 200 });
  if (input.cargo !== undefined)
    validateText('cargo', input.cargo, { max: 200 });
  if (input.notas !== undefined)
    validateText('notas', input.notas, { max: 10_000 });
  if (input.edital_url !== undefined && input.edital_url) {
    validateText('edital_url', input.edital_url, {
      max: 2048,
      pattern: /^https?:\/\/.+/,
      patternMsg: 'deve começar com http:// ou https://',
    });
  }
  if (input.data_prova !== undefined && input.data_prova) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.data_prova)) {
      throw new HierarchyValidationError('data_prova', 'formato YYYY-MM-DD');
    }
    const ano = Number(input.data_prova.slice(0, 4));
    if (ano < 1980 || ano > 2100) {
      throw new HierarchyValidationError('data_prova', 'ano implausível');
    }
  }
  if (input.status !== undefined && !VALID_STATUS.includes(input.status)) {
    throw new HierarchyValidationError('status', 'valor inválido');
  }
}

type CacheState<T> = {
  data: T[] | null;
  loading: boolean;
  error: string | null;
};

let concursosCache: CacheState<Concurso> = {
  data: null,
  loading: false,
  error: null,
};
const concursosListeners = new Set<() => void>();

function notifyConcursos() {
  concursosListeners.forEach((l) => l());
}

function setConcursos(next: CacheState<Concurso>) {
  concursosCache = next;
  notifyConcursos();
}

export async function loadConcursos(): Promise<void> {
  if (concursosCache.loading) return;
  setConcursos({ ...concursosCache, loading: true, error: null });

  const sb = createClient();
  const { data, error } = await sb
    .from('concursos')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    setConcursos({
      data: concursosCache.data,
      loading: false,
      error: error.message,
    });
    return;
  }
  setConcursos({
    data: (data ?? []) as Concurso[],
    loading: false,
    error: null,
  });
}

/**
 * Normaliza input vindo do form: trim em strings, vazio → null nos
 * campos opcionais, status default 'ativo' se não fornecido.
 */
function normalizeConcursoInput(input: ConcursoInput): ConcursoInput {
  const nz = (v: string | null | undefined) => {
    if (v === undefined || v === null) return null;
    const t = v.trim();
    return t ? t : null;
  };
  return {
    nome: input.nome.trim(),
    banca: nz(input.banca),
    orgao: nz(input.orgao),
    cargo: nz(input.cargo),
    data_prova: nz(input.data_prova),
    status: input.status ?? 'ativo',
    edital_url: nz(input.edital_url),
    notas: nz(input.notas),
  };
}

export async function createConcurso(input: ConcursoInput): Promise<Concurso> {
  validateConcursoInput(input);
  const norm = normalizeConcursoInput(input);

  const sb = createClient();
  const {
    data: { user },
    error: authErr,
  } = await sb.auth.getUser();
  if (authErr || !user) {
    throw new Error('Não autenticado');
  }

  const { data, error } = await sb
    .from('concursos')
    .insert({ ...norm, user_id: user.id })
    .select('*')
    .single();

  if (error) throw new Error(error.message);

  // Adiciona no topo da cache pra evitar refetch
  setConcursos({
    ...concursosCache,
    data: concursosCache.data
      ? [data as Concurso, ...concursosCache.data]
      : [data as Concurso],
  });
  return data as Concurso;
}

export async function updateConcurso(
  id: string,
  patch: Partial<ConcursoInput>
): Promise<Concurso> {
  validateConcursoInput({ nome: 'placeholder', ...patch }); // checa só campos presentes
  // Reaproveitamos validateConcursoInput passando placeholder pro nome
  // se ele não está no patch — mas validateText pula undefined, então
  // só os campos do patch são checados. (Hack consciente.)

  const norm = normalizeConcursoInput({ nome: 'placeholder', ...patch });
  // Remove campos que não vieram no patch
  const filtered: Record<string, unknown> = {};
  for (const k of Object.keys(patch) as (keyof ConcursoInput)[]) {
    filtered[k] = norm[k];
  }

  if (Object.keys(filtered).length === 0) {
    throw new HierarchyValidationError('patch', 'sem campos pra atualizar');
  }

  const sb = createClient();
  const { data, error } = await sb
    .from('concursos')
    .update(filtered)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(error.message);

  setConcursos({
    ...concursosCache,
    data:
      concursosCache.data?.map((c) => (c.id === id ? (data as Concurso) : c)) ??
      null,
  });
  return data as Concurso;
}

export async function softDeleteConcurso(id: string): Promise<void> {
  const sb = createClient();
  const { error } = await sb
    .from('concursos')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw new Error(error.message);

  setConcursos({
    ...concursosCache,
    data: concursosCache.data?.filter((c) => c.id !== id) ?? null,
  });
}

export function useConcursos(): CacheState<Concurso> {
  const [, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick((t) => (t + 1) & 0xfffffff);
    concursosListeners.add(listener);
    if (concursosCache.data === null && !concursosCache.loading) {
      void loadConcursos();
    }
    return () => {
      concursosListeners.delete(listener);
    };
  }, []);

  return concursosCache;
}

// =====================================================================
// Disciplinas
// =====================================================================

export type DisciplinaInput = {
  nome: string;
  peso_default?: number | null;
  cor?: string | null;
};

const COR_PATTERN = /^#[0-9a-fA-F]{6}$/;

export function validateDisciplinaInput(input: DisciplinaInput): void {
  validateText('nome', input.nome, { required: true, max: 200 });
  if (input.peso_default !== undefined && input.peso_default !== null) {
    if (typeof input.peso_default !== 'number' || !Number.isFinite(input.peso_default)) {
      throw new HierarchyValidationError('peso_default', 'tipo inválido');
    }
    if (input.peso_default <= 0) {
      throw new HierarchyValidationError('peso_default', 'deve ser > 0');
    }
    if (input.peso_default > 9999) {
      throw new HierarchyValidationError('peso_default', 'máximo 9999');
    }
  }
  if (input.cor !== undefined && input.cor !== null && input.cor !== '') {
    validateText('cor', input.cor, {
      max: 7,
      pattern: COR_PATTERN,
      patternMsg: 'formato hex #rrggbb',
    });
  }
}

let disciplinasCache: CacheState<Disciplina> = {
  data: null,
  loading: false,
  error: null,
};
const disciplinasListeners = new Set<() => void>();

function notifyDisciplinas() {
  disciplinasListeners.forEach((l) => l());
}

function setDisciplinas(next: CacheState<Disciplina>) {
  disciplinasCache = next;
  notifyDisciplinas();
}

export async function loadDisciplinas(): Promise<void> {
  if (disciplinasCache.loading) return;
  setDisciplinas({ ...disciplinasCache, loading: true, error: null });

  const sb = createClient();
  const { data, error } = await sb
    .from('disciplinas')
    .select('*')
    .is('deleted_at', null)
    .order('nome', { ascending: true });

  if (error) {
    setDisciplinas({
      data: disciplinasCache.data,
      loading: false,
      error: error.message,
    });
    return;
  }
  setDisciplinas({
    data: (data ?? []) as Disciplina[],
    loading: false,
    error: null,
  });
}

function normalizeDisciplinaInput(input: DisciplinaInput): {
  nome: string;
  peso_default: number | null;
  cor: string | null;
} {
  const nome = input.nome.trim();
  const peso_default =
    input.peso_default === undefined || input.peso_default === null
      ? null
      : input.peso_default;
  const corRaw = input.cor;
  const cor =
    corRaw === undefined || corRaw === null || corRaw.trim() === ''
      ? null
      : corRaw.trim();
  return { nome, peso_default, cor };
}

export async function createDisciplina(
  input: DisciplinaInput
): Promise<Disciplina> {
  validateDisciplinaInput(input);
  const norm = normalizeDisciplinaInput(input);

  const sb = createClient();
  const {
    data: { user },
    error: authErr,
  } = await sb.auth.getUser();
  if (authErr || !user) throw new Error('Não autenticado');

  const { data, error } = await sb
    .from('disciplinas')
    .insert({ ...norm, user_id: user.id })
    .select('*')
    .single();

  if (error) {
    // 23505 = unique violation no índice (user_id, lower(nome))
    if (error.code === '23505') {
      throw new HierarchyValidationError(
        'nome',
        'já existe uma disciplina com esse nome'
      );
    }
    throw new Error(error.message);
  }

  // Insere ordenado por nome (espelha order do load)
  const lista = disciplinasCache.data
    ? [...disciplinasCache.data, data as Disciplina].sort((a, b) =>
        a.nome.localeCompare(b.nome)
      )
    : [data as Disciplina];

  setDisciplinas({ ...disciplinasCache, data: lista });
  return data as Disciplina;
}

export async function updateDisciplina(
  id: string,
  patch: Partial<DisciplinaInput>
): Promise<Disciplina> {
  // Valida só o que veio
  validateDisciplinaInput({ nome: 'placeholder', ...patch });
  const norm = normalizeDisciplinaInput({ nome: 'placeholder', ...patch });
  const filtered: Record<string, unknown> = {};
  for (const k of Object.keys(patch) as (keyof DisciplinaInput)[]) {
    filtered[k] = norm[k as keyof typeof norm];
  }
  if (Object.keys(filtered).length === 0) {
    throw new HierarchyValidationError('patch', 'sem campos pra atualizar');
  }

  const sb = createClient();
  const { data, error } = await sb
    .from('disciplinas')
    .update(filtered)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new HierarchyValidationError(
        'nome',
        'já existe uma disciplina com esse nome'
      );
    }
    throw new Error(error.message);
  }

  const lista =
    disciplinasCache.data
      ?.map((d) => (d.id === id ? (data as Disciplina) : d))
      .sort((a, b) => a.nome.localeCompare(b.nome)) ?? null;
  setDisciplinas({ ...disciplinasCache, data: lista });
  return data as Disciplina;
}

export async function softDeleteDisciplina(id: string): Promise<void> {
  const sb = createClient();
  const { error } = await sb
    .from('disciplinas')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw new Error(error.message);

  setDisciplinas({
    ...disciplinasCache,
    data: disciplinasCache.data?.filter((d) => d.id !== id) ?? null,
  });
}

export function useDisciplinas(): CacheState<Disciplina> {
  const [, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick((t) => (t + 1) & 0xfffffff);
    disciplinasListeners.add(listener);
    if (disciplinasCache.data === null && !disciplinasCache.loading) {
      void loadDisciplinas();
    }
    return () => {
      disciplinasListeners.delete(listener);
    };
  }, []);

  return disciplinasCache;
}

// =====================================================================
// Limpeza no logout (chamado de StoreProvider/logoutAndReset)
// =====================================================================

export function clearHierarchyCache(): void {
  setConcursos({ data: null, loading: false, error: null });
  setDisciplinas({ data: null, loading: false, error: null });
}
