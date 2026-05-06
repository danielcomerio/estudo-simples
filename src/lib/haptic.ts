/**
 * Haptic feedback helper. Wrapper sobre navigator.vibrate.
 *
 * Funciona em Android (Chrome, Edge, Firefox). iOS Safari ignora
 * silenciosamente — sem erro, só sem efeito. Acessibilidade: respeita
 * `prefers-reduced-motion`.
 *
 * Patterns curtas (10-20ms) são imperceptíveis se não estiver com
 * o telefone na mão. 50ms+ é mais notável. Usar com moderação —
 * vibração excessiva irrita.
 */

type Pattern = 'tap' | 'success' | 'error' | 'select';

const PATTERNS: Record<Pattern, number | number[]> = {
  tap: 10,
  select: 15,
  success: [12, 40, 18],
  error: [30, 50, 30],
};

let allowed: boolean | null = null;

function isAllowed(): boolean {
  if (allowed !== null) return allowed;
  if (typeof window === 'undefined') return false;
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) {
    allowed = false;
    return false;
  }
  // Respeita prefers-reduced-motion: usuários sensíveis a estímulos
  // não vão querer vibração também.
  try {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) {
      allowed = false;
      return false;
    }
  } catch {
    // matchMedia pode falhar em ambientes muito antigos
  }
  allowed = true;
  return true;
}

export function haptic(pattern: Pattern = 'tap'): void {
  if (!isAllowed()) return;
  try {
    navigator.vibrate(PATTERNS[pattern]);
  } catch {
    // ignora
  }
}
