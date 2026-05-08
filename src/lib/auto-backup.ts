'use client';

/**
 * Backup automático local — 1×/dia salva snapshot das questions em
 * IDB (chave separada). Se sync corromper, user pode restaurar manual.
 *
 * NÃO substitui sync. Não envia pra Supabase. É net seguro local.
 *
 * Storage: localStorage flag `lastBackupAt` (ms). IDB key
 * `auto-backup-snapshot` armazena o blob compactado.
 */

import { idbGet, idbSet } from './idb';
import LZString from 'lz-string';
import type { Question } from './types';

const FLAG_KEY = 'estudo-simples:last-auto-backup';
const SNAPSHOT_KEY = 'auto-backup-snapshot';
const DAY_MS = 86_400_000;

export type AutoBackupSnapshot = {
  savedAt: number;
  userId: string;
  count: number;
  data: string; // questions JSON compactado lz-string
};

/** Roda 1×/dia max. Idempotente. */
export async function maybeAutoBackup(
  userId: string,
  questions: Question[]
): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!userId || userId === 'guest') return false;
  try {
    const last = parseInt(localStorage.getItem(FLAG_KEY) ?? '0', 10);
    if (Date.now() - last < DAY_MS) return false;
    const json = JSON.stringify(questions);
    const compressed = LZString.compressToUTF16(json);
    const snap: AutoBackupSnapshot = {
      savedAt: Date.now(),
      userId,
      count: questions.length,
      data: compressed,
    };
    await idbSet(SNAPSHOT_KEY, snap);
    localStorage.setItem(FLAG_KEY, String(Date.now()));
    return true;
  } catch {
    return false;
  }
}

export async function readAutoBackup(): Promise<AutoBackupSnapshot | null> {
  if (typeof window === 'undefined') return null;
  try {
    const snap = (await idbGet(SNAPSHOT_KEY)) as AutoBackupSnapshot | null;
    if (!snap || typeof snap !== 'object') return null;
    return snap;
  } catch {
    return null;
  }
}

export function decompressSnapshot(snap: AutoBackupSnapshot): Question[] {
  try {
    const json = LZString.decompressFromUTF16(snap.data);
    if (!json) return [];
    const arr = JSON.parse(json);
    if (!Array.isArray(arr)) return [];
    return arr;
  } catch {
    return [];
  }
}
