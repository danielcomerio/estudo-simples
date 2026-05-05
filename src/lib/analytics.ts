'use client';

import { createClient } from './supabase/client';

/**
 * Logger de eventos de analytics. Fire-and-forget, não bloqueia UX.
 * Falhas silenciosas — telemetria não pode quebrar o app.
 *
 * Privacy-first: sem PII, sem IP, sem fingerprinting.
 *
 * Uso:
 *   track('landing.viewed')
 *   track('checkout.started', { interval: 'monthly' })
 */
export function track(
  event: string,
  props: Record<string, string | number | boolean> = {}
): void {
  if (typeof window === 'undefined') return;
  // Sanity: trunca event e props pra não estourar CHECK do DB.
  const evt = event.slice(0, 64);
  const safeProps = JSON.stringify(props).slice(0, 3900);
  let parsedProps: Record<string, unknown> = {};
  try {
    parsedProps = JSON.parse(safeProps);
  } catch {
    parsedProps = {};
  }
  try {
    const sb = createClient();
    void sb
      .from('analytics_events')
      .insert({ event: evt, props: parsedProps })
      .then(() => undefined, () => undefined);
  } catch {
    // Sem network, sem auth setup — ignorar
  }
}
