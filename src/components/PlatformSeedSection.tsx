'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import { clearSeedFlag, loadPlatformSeed } from '@/lib/platform-seed';
import { clearSessionsLog } from '@/lib/sessions-log';
import { scheduleSync } from '@/lib/sync';
import { confirmDialog } from './ConfirmDialog';
import { toast } from './Toast';

/**
 * Permite recarregar o seed da plataforma manualmente. Útil quando o
 * owner publica uma nova versão do seed e o usuário quer puxar as
 * questões novas.
 *
 * Cuidado: cada recarga clona TODAS as questões do seed novamente,
 * então pode duplicar as que você já tem. Default: usuário só usa
 * isso depois de limpar o banco ou se sabe o que está fazendo.
 */
export function PlatformSeedSection() {
  const userId = useStore((s) => s.userId);
  const [loading, setLoading] = useState(false);

  const reload = async () => {
    if (!userId) return;
    const ok = await confirmDialog({
      title: 'Recarregar questões da plataforma',
      message:
        'Vai baixar as questões da plataforma e adicionar ao seu banco. Pode duplicar questões que você já tem. Continuar?',
    });
    if (!ok) return;
    setLoading(true);
    try {
      clearSeedFlag(userId);
      const n = await loadPlatformSeed(userId);
      if (n > 0) {
        toast(`📦 ${n} questão(ões) da plataforma carregadas.`, 'success');
        if (userId !== 'guest') scheduleSync(800);
      } else {
        toast('Nenhuma questão da plataforma disponível agora.', 'warn');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h2 style={{ margin: '0 0 8px' }}>Plataforma</h2>
      <p className="muted" style={{ marginTop: 0, fontSize: '0.88rem' }}>
        Visitantes e contas novas recebem automaticamente um pacote de
        questões base da plataforma. Se quiser puxar uma versão atualizada
        (e não se importar com possíveis duplicatas), use o botão abaixo.
      </p>
      <button type="button" onClick={reload} disabled={loading}>
        {loading ? 'Carregando…' : '📦 Recarregar questões da plataforma'}
      </button>

      <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '14px 0' }} />

      <p className="muted" style={{ marginTop: 0, fontSize: '0.88rem' }}>
        Histórico de sessões fica salvo localmente (últimas 100). Use o
        botão abaixo pra zerar — não afeta questões nem stats.
      </p>
      <button
        type="button"
        className="ghost"
        onClick={async () => {
          const ok = await confirmDialog({
            title: 'Limpar histórico de sessões',
            message:
              'Apagar o registro de sessões completadas? Isso só afeta a lista no /stats — questões e SRS ficam intactos.',
          });
          if (!ok) return;
          clearSessionsLog();
          toast('Histórico de sessões limpo.', 'success');
        }}
      >
        🗑 Limpar histórico de sessões
      </button>

      <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '14px 0' }} />

      <p className="muted" style={{ marginTop: 0, fontSize: '0.88rem' }}>
        Limpar todo o cache local (IDB + localStorage). Útil pra resolver
        bugs de estado preso. Você precisa fazer login de novo. Os dados
        no servidor ficam intactos — voltam no próximo sync.
      </p>
      <button
        type="button"
        className="danger"
        onClick={async () => {
          const ok = await confirmDialog({
            title: 'Limpar TODO o cache local',
            message:
              'Vai apagar IndexedDB e localStorage. Você precisa fazer login de novo. Dados no servidor ficam — volta tudo no próximo sync. Continuar?',
            danger: true,
          });
          if (!ok) return;
          try {
            localStorage.clear();
            sessionStorage.clear();
            // Apaga IDB databases conhecidos do app
            if (typeof indexedDB !== 'undefined') {
              const req = indexedDB.deleteDatabase('estudo-simples');
              req.onsuccess = () => {
                location.reload();
              };
              req.onerror = () => location.reload();
              // Fallback se não disparar callback em ~1s
              setTimeout(() => location.reload(), 1500);
            } else {
              location.reload();
            }
          } catch {
            location.reload();
          }
        }}
      >
        🧨 Limpar todo o cache local
      </button>
    </div>
  );
}
