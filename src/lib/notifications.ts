/**
 * Notifications API helper. Sem service worker (push real), só
 * notifica enquanto a aba está aberta. Mas mesmo assim é útil:
 * lembrar revisões vencidas quando o user abre o app de manhã.
 *
 * Opt-in por setting localStorage. Pede permissão sob clique do user
 * (browsers bloqueiam pedido sem gesto). Cooldown de 6h pra não spammar
 * (não notifica de novo se já notificou hoje).
 */

const SETTING_KEY = 'estudo-simples:notifications:enabled';
const LAST_KEY = 'estudo-simples:notifications:lastShownAt';
const COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6h

export function isNotificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function notificationsPermission(): NotificationPermission | 'unsupported' {
  if (!isNotificationsSupported()) return 'unsupported';
  return Notification.permission;
}

export function isNotificationsEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  if (!isNotificationsSupported()) return false;
  if (Notification.permission !== 'granted') return false;
  try {
    return localStorage.getItem(SETTING_KEY) === '1';
  } catch {
    return false;
  }
}

export async function enableNotifications(): Promise<boolean> {
  if (!isNotificationsSupported()) return false;
  try {
    if (Notification.permission === 'default') {
      const result = await Notification.requestPermission();
      if (result !== 'granted') return false;
    } else if (Notification.permission !== 'granted') {
      return false;
    }
    localStorage.setItem(SETTING_KEY, '1');
    return true;
  } catch {
    return false;
  }
}

export function disableNotifications(): void {
  try {
    localStorage.setItem(SETTING_KEY, '0');
  } catch {}
}

/**
 * Mostra notificação se elegível: notificações habilitadas + permissão
 * granted + último alerta foi há mais de COOLDOWN_MS.
 */
export function maybeNotifyDue(dueCount: number): void {
  if (!isNotificationsEnabled()) return;
  if (dueCount <= 0) return;
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
    // Se a aba está visível, não notifica (user já vai ver no próprio app)
    return;
  }
  try {
    const lastRaw = localStorage.getItem(LAST_KEY);
    const last = lastRaw ? parseInt(lastRaw) : 0;
    if (Date.now() - last < COOLDOWN_MS) return;
    new Notification('Estudo Simples', {
      body: `Você tem ${dueCount} questão(ões) vencendo hoje. Bora revisar?`,
      icon: '/icon.svg',
      tag: 'estudo-simples-due',
    });
    localStorage.setItem(LAST_KEY, String(Date.now()));
  } catch {
    // ignora
  }
}
