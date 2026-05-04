'use client';

import { useEffect, useState } from 'react';

/**
 * Banner discreto exibido quando o navegador detecta offline.
 * Some quando online volta. Mensagem indica que o app continua
 * funcionando localmente (offline-first em questions).
 */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="offline-banner" role="status" aria-live="polite">
      <span aria-hidden>📵</span>
      <span>Sem conexão — alterações ficam salvas localmente.</span>
    </div>
  );
}
