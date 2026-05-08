'use client';

import { useEffect, useState } from 'react';
import {
  readAutoBackup,
  decompressSnapshot,
  type AutoBackupSnapshot,
} from '@/lib/auto-backup';
import { confirmDialog } from './ConfirmDialog';
import { toast } from './Toast';
import { mergeFromServer, useStore } from '@/lib/store';
import { scheduleSync } from '@/lib/sync';

/**
 * UI pra ver e restaurar o último auto-backup local (24h).
 *
 * Restore: substitui dados em memória + IDB com snapshot. Não toca
 * Supabase — sync vai re-mergir depois.
 *
 * Use com cuidado: pode reverter mudanças recentes não-backupeadas.
 */
export function AutoBackupRestoreSection() {
  const userId = useStore((s) => s.userId);
  const [snap, setSnap] = useState<AutoBackupSnapshot | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const s = await readAutoBackup();
      setSnap(s);
    })();
  }, []);

  const restore = async () => {
    if (!snap) return;
    if (snap.userId !== userId) {
      toast('Backup é de outro usuário — não pode restaurar.', 'error');
      return;
    }
    const ok = await confirmDialog({
      title: 'Restaurar auto-backup',
      message: `Substituir TODAS suas ${snap.count} questões pelo snapshot de ${new Date(snap.savedAt).toLocaleString('pt-BR')}? Mudanças recentes podem ser perdidas.`,
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const questions = decompressSnapshot(snap);
      mergeFromServer(questions);
      scheduleSync();
      toast(`✅ ${questions.length} questões restauradas.`, 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'erro', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (!snap) return null;

  return (
    <div className="card" style={{ padding: 12, marginTop: 12 }}>
      <h3 style={{ margin: '0 0 8px', fontSize: '0.95rem' }}>
        💾 Auto-backup local
      </h3>
      <p className="muted" style={{ fontSize: '0.85rem', margin: 0 }}>
        Snapshot de <strong>{snap.count}</strong> questões salvo em{' '}
        {new Date(snap.savedAt).toLocaleString('pt-BR')} (1×/dia automático).
      </p>
      <button
        type="button"
        className="ghost"
        onClick={restore}
        disabled={busy}
        style={{ marginTop: 8, padding: '4px 10px', fontSize: '0.82rem' }}
      >
        {busy ? 'Restaurando…' : '↺ Restaurar este snapshot'}
      </button>
    </div>
  );
}
