'use client';

import { useEffect, useState } from 'react';
import { selectActiveQuestions, useStore } from '@/lib/store';
import {
  getAIKey,
  getDefaultProvider,
} from '@/lib/ai-keys';
import { getActivePersonaPrompt, withPersona } from '@/lib/persona-active';
import { toast } from './Toast';

const ENABLED_KEY = 'estudo-simples:pomodoro-reflection-enabled';

function isEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(ENABLED_KEY) === '1';
}

/**
 * Listener global que reage ao evento 'es:pomodoro-focus-complete' e
 * mostra reflexão IA curta (≤80 palavras) sobre o que estudou no
 * último ciclo. Opt-in via setting (toggle no /configuracoes/sons ou
 * no próprio Pomodoro futuro).
 *
 * Hoje: simples — sempre off por default. User ativa via:
 *   localStorage.setItem('estudo-simples:pomodoro-reflection-enabled','1')
 *
 * UI: aparece como toast informativo + botão "Pedir reflexão" — só
 * gera se user pedir.
 */
export function PomodoroReflectionToast() {
  const questions = useStore(selectActiveQuestions);
  const [trigger, setTrigger] = useState(0);

  useEffect(() => {
    const handler = () => {
      if (!isEnabled()) return;
      setTrigger((n) => n + 1);
    };
    window.addEventListener('es:pomodoro-focus-complete', handler);
    return () => window.removeEventListener('es:pomodoro-focus-complete', handler);
  }, []);

  useEffect(() => {
    if (trigger === 0) return;
    void doReflection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  async function doReflection() {
    const provider = getDefaultProvider();
    if (!provider) return;
    const apiKey = getAIKey(provider);
    if (!apiKey) return;

    // Pega questões respondidas nos últimos 25min
    const cutoff = Date.now() - 25 * 60_000;
    type Touched = { disciplina: string; correct: number; wrong: number };
    const map = new Map<string, Touched>();
    for (const q of questions) {
      const hist = q.stats?.history ?? [];
      const recent = hist.filter((h) => h.date >= cutoff);
      if (recent.length === 0) continue;
      const d = q.disciplina_id || 'sem-disciplina';
      const t = map.get(d) ?? { disciplina: d, correct: 0, wrong: 0 };
      for (const h of recent) {
        if (h.result === 'correct') t.correct++;
        else t.wrong++;
      }
      map.set(d, t);
    }
    const totals = Array.from(map.values()).reduce(
      (acc, t) => ({ correct: acc.correct + t.correct, wrong: acc.wrong + t.wrong }),
      { correct: 0, wrong: 0 }
    );
    if (totals.correct + totals.wrong === 0) {
      toast('🍅 Foco completo. Mas você não estudou questões — pause direito!', '');
      return;
    }
    const ctx = Array.from(map.values())
      .map((t) => `${t.disciplina}: ${t.correct}/${t.correct + t.wrong}`)
      .join('; ');

    const promptBase = `Reflexão pomodoro — 25min completos. Estudante teve:
${ctx}
Total: ${totals.correct}/${totals.correct + totals.wrong}.

Escreva uma frase curta (max 30 palavras) reconhecendo o esforço E sugerindo 1 ação concreta pro próximo ciclo (descanso, mudar disciplina, etc). pt-BR. Direto. Sem emojis.`;

    const personaPrompt = await getActivePersonaPrompt();
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey,
          prompt: withPersona(promptBase, personaPrompt),
          kind: 'pomodoro-reflection',
        }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) return;
      const t = (j as { text: string }).text;
      if (t) toast(`🍅 ${t.trim()}`, 'success');
    } catch {
      /* ignore */
    }
  }

  return null;
}
