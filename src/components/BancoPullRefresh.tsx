'use client';

import { PullToRefresh } from './PullToRefresh';
import { syncNow } from '@/lib/sync';
import { toast } from './Toast';

/**
 * Wrapper client-side pra aplicar pull-to-refresh no /banco. Dispara
 * sincronização manual ao soltar — útil em mobile pra forçar refresh
 * (ex: depois de mudar dados em outra aba/dispositivo).
 */
export function BancoPullRefresh({ children }: { children: React.ReactNode }) {
  const onRefresh = async () => {
    try {
      await syncNow();
      toast('Atualizado', 'success');
    } catch {
      // sync já mostra erro próprio se falhar; toast aqui seria duplicado
    }
  };
  return <PullToRefresh onRefresh={onRefresh}>{children}</PullToRefresh>;
}
