'use client';

import { useRef, useCallback } from 'react';
import {
  createInsightState,
  pushAndDetect,
  type SessionEvent,
  type Insight,
  type InsightDetectorState,
} from './live-insights';

/**
 * Hook reusável que encapsula o estado de detecção de insights ao
 * vivo. Permite reuso em DiscursivaRunner / CardsRunner sem duplicar
 * createInsightState/ref.
 *
 * Retorna { record(ev) → insight | null, reset() }.
 */
export function useLiveInsights() {
  const stateRef = useRef<InsightDetectorState>(createInsightState());

  const record = useCallback((ev: SessionEvent): Insight | null => {
    return pushAndDetect(stateRef.current, ev);
  }, []);

  const reset = useCallback(() => {
    stateRef.current = createInsightState();
  }, []);

  return { record, reset };
}
