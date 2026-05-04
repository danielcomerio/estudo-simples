'use client';

import { useEffect, useState } from 'react';

/**
 * Botão "Instalar app" que aparece só quando o navegador disponibiliza
 * o evento beforeinstallprompt (Chrome/Edge/Brave em desktop e mobile;
 * iOS Safari NÃO suporta — usuário usa "Adicionar à tela inicial"
 * manualmente, e nesse caso o botão simplesmente não aparece).
 */
type BeforeInstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export function InstallPWAButton() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null
  );
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed || !deferred) return null;

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === 'accepted') {
      setDeferred(null);
    }
  };

  return (
    <button
      type="button"
      className="ghost icon"
      onClick={install}
      title="Instalar app"
      aria-label="Instalar como app"
      style={{ fontSize: '1rem' }}
    >
      ⬇
    </button>
  );
}
