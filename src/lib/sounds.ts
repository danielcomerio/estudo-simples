/**
 * Sound effects via Web Audio API. Sem assets — gera tom sintético.
 * Opt-in via setting. Respeita prefers-reduced-motion (silencia em
 * paralelo com confetti/animações).
 *
 * Sons:
 *  - 'success': dois tons ascendentes (alegre)
 *  - 'error':   um tom curto e baixo (descontentamento sutil)
 *  - 'tick':    click quase inaudível pra rate buttons
 */

const SETTING_KEY = 'estudo-simples:sounds:enabled';

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (ctx) return ctx;
  const Ctor =
    (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
    return ctx;
  } catch {
    return null;
  }
}

export function isSoundsEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(SETTING_KEY) === '1';
  } catch {
    return false;
  }
}

export function setSoundsEnabled(on: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SETTING_KEY, on ? '1' : '0');
  } catch {}
}

function reducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function tone(freq: number, durMs: number, volume = 0.06, type: OscillatorType = 'sine'): void {
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, c.currentTime);
  gain.gain.linearRampToValueAtTime(volume, c.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + durMs / 1000);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + durMs / 1000 + 0.05);
}

type SoundKind = 'success' | 'error' | 'tick';

export function playSound(kind: SoundKind): void {
  if (!isSoundsEnabled()) return;
  if (reducedMotion()) return;
  const c = getCtx();
  if (!c) return;
  // Resume context se foi suspenso (Chrome auto-suspende sem user gesture)
  if (c.state === 'suspended') {
    void c.resume().catch(() => {});
  }
  if (kind === 'success') {
    tone(660, 90);
    setTimeout(() => tone(880, 110), 80);
  } else if (kind === 'error') {
    tone(220, 180, 0.08, 'square');
  } else {
    tone(1200, 30, 0.03);
  }
}
