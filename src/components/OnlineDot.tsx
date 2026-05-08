'use client';

import { useEffect, useState } from 'react';

/**
 * Indicador discreto online/offline (verde/vermelho dot). Plug em Topbar.
 *
 * Pulse leve quando offline pra chamar atenção.
 */
export function OnlineDot() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <span
      title={online ? 'Online' : 'Offline'}
      aria-label={online ? 'online' : 'offline'}
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: online ? 'var(--primary, #22c55e)' : 'var(--danger, #dc2626)',
        marginLeft: 6,
        animation: online ? undefined : 'pulse 1.5s ease-in-out infinite',
      }}
    />
  );
}
