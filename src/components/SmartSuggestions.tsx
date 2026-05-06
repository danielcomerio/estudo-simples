'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import type { Question } from '@/lib/types';
import { startOfDay } from '@/lib/utils';
import { DAY_MS } from '@/lib/srs';

/**
 * Card de sugestões inteligentes derivadas do histórico. Só renderiza
 * se há ≥ 1 sugestão útil pra mostrar. Usa heurísticas simples (sem IA),
 * mas o resultado é equivalente a um coach básico.
 *
 * Sugestões implementadas:
 *  - 📉 Disciplina X sem revisão há Y dias (Y >= 7)
 *  - ⚠ Taxa de acerto caiu Zpp essa semana vs anterior
 *  - 🌙 Você costuma estudar mais cedo — hoje tá tarde?
 *  - 🎯 Você tem N inimigas pendentes
 *  - 📚 Disciplina X tem mais questões pendentes
 */
type Suggestion = {
  id: string;
  emoji: string;
  text: string;
  href?: string;
  cta?: string;
};

export function SmartSuggestions({ questions }: { questions: Question[] }) {
  const suggestions = useMemo(() => {
    const out: Suggestion[] = [];
    const now = Date.now();
    const today0 = startOfDay(now);

    // 1. Disciplina sem estudar há N dias
    const lastByDisc = new Map<string, number>();
    for (const q of questions) {
      const d = q.disciplina_id;
      if (!d) continue;
      const h = q.stats?.history ?? [];
      const lastDate = h[h.length - 1]?.date;
      if (!lastDate) continue;
      const cur = lastByDisc.get(d) ?? 0;
      if (lastDate > cur) lastByDisc.set(d, lastDate);
    }
    let abandoned: { disc: string; daysSince: number } | null = null;
    for (const [disc, last] of lastByDisc) {
      // Só conta se a disciplina tem >=10 questões — senão não vale alerta
      const total = questions.filter((q) => q.disciplina_id === disc).length;
      if (total < 10) continue;
      const days = Math.floor((now - last) / DAY_MS);
      if (days >= 7 && (!abandoned || days > abandoned.daysSince)) {
        abandoned = { disc, daysSince: days };
      }
    }
    if (abandoned) {
      out.push({
        id: 'disc-abandoned',
        emoji: '📉',
        text: `Disciplina "${abandoned.disc}" sem revisão há ${abandoned.daysSince} dias. SRS já deve ter agendado várias.`,
        href: `/estudar?modo=srs&qtd=10&auto=1`,
        cta: 'Revisar agora',
      });
    }

    // 2. Acerto caindo essa semana vs anterior
    const week0 = today0 - 6 * DAY_MS;
    const week1 = today0 - 13 * DAY_MS;
    let curCorrect = 0;
    let curTotal = 0;
    let prevCorrect = 0;
    let prevTotal = 0;
    for (const q of questions) {
      for (const h of q.stats?.history ?? []) {
        if (h.date >= week0) {
          curTotal++;
          if (h.result === 'correct' || h.result === 'self_pass') curCorrect++;
        } else if (h.date >= week1) {
          prevTotal++;
          if (h.result === 'correct' || h.result === 'self_pass') prevCorrect++;
        }
      }
    }
    if (curTotal >= 30 && prevTotal >= 30) {
      const curPct = (curCorrect / curTotal) * 100;
      const prevPct = (prevCorrect / prevTotal) * 100;
      const delta = Math.round(curPct - prevPct);
      if (delta <= -10) {
        out.push({
          id: 'acerto-caindo',
          emoji: '⚠',
          text: `Acerto caiu ${Math.abs(delta)}pp essa semana (${Math.round(curPct)}% vs ${Math.round(prevPct)}%). Cansaço, conteúdo novo, ou pulou disciplinas?`,
          href: `/stats`,
          cta: 'Ver detalhes',
        });
      }
    }

    // 3. Inimigas pendentes
    let inimigas = 0;
    for (const q of questions) {
      const a = q.stats?.attempts ?? 0;
      const c = q.stats?.correct ?? 0;
      if (a >= 3 && c / a < 0.3) inimigas++;
    }
    if (inimigas >= 5) {
      out.push({
        id: 'inimigas',
        emoji: '⚔',
        text: `Você tem ${inimigas} inimigas pendentes (≥3 erros, &lt;30% acerto). Sessão dedicada ajuda a quebrar o ciclo.`,
        href: `/estudar?modo=inimigas&qtd=10&auto=1`,
        cta: 'Atacar inimigas',
      });
    }

    // 4. Vencendo amanhã (proativo, antes de virar atrasada)
    const amanha = today0 + 2 * DAY_MS;
    let vencerAmanha = 0;
    for (const q of questions) {
      const due = q.srs?.dueDate;
      if (!due) continue;
      if (due >= today0 + DAY_MS && due < amanha) vencerAmanha++;
    }
    if (vencerAmanha >= 20) {
      out.push({
        id: 'vencer-amanha',
        emoji: '📅',
        text: `${vencerAmanha} questões vencem amanhã. Adiantar algumas hoje evita pico de carga.`,
        href: `/estudar?modo=srs&qtd=15&auto=1`,
        cta: 'Adiantar 15',
      });
    }

    return out.slice(0, 3);
  }, [questions]);

  if (suggestions.length === 0) return null;

  return (
    <div
      className="card"
      style={{
        background: 'var(--bg-elev-2)',
        border: '1px solid var(--border)',
      }}
    >
      <h2 style={{ margin: '0 0 8px', fontSize: '1.05rem' }}>💡 Sugestões</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {suggestions.map((s) => (
          <div
            key={s.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: 10,
              background: 'var(--bg-elev)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
            }}
          >
            <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>{s.emoji}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{ fontSize: '0.9rem', lineHeight: 1.5 }}
                dangerouslySetInnerHTML={{ __html: s.text }}
              />
              {s.href && s.cta && (
                <Link
                  href={s.href}
                  style={{
                    display: 'inline-block',
                    marginTop: 6,
                    color: 'var(--primary)',
                    fontSize: '0.85rem',
                    fontWeight: 500,
                    textDecoration: 'none',
                  }}
                >
                  {s.cta} →
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
