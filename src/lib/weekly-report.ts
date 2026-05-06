import type { Question } from './types';
import { startOfDay } from './utils';
import { DAY_MS } from './srs';

/**
 * Gera relatório markdown da semana corrente (últimos 7 dias).
 *
 * Inclui: total revisões, % acerto vs média, top 3 disciplinas,
 * tempo médio, dias estudados, novas aprendidas, recordes, streak.
 *
 * Útil pra acompanhamento pessoal, mostrar pra coach/professor,
 * arquivar progresso.
 */

function fmtPct(num: number, den: number): string {
  if (den === 0) return '—';
  return `${Math.round((100 * num) / den)}%`;
}

function fmtMin(ms: number): string {
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  return `${h}h${(m % 60).toString().padStart(2, '0')}`;
}

export function generateWeeklyReport(questions: Question[]): string {
  const now = Date.now();
  const today = startOfDay(now);
  const week0 = today - 6 * DAY_MS;
  const prevWeek0 = week0 - 7 * DAY_MS;

  let curTotal = 0;
  let curCorrect = 0;
  let curWrong = 0;
  let curTimeMs = 0;
  let prevTotal = 0;
  let prevCorrect = 0;

  const discAttempts = new Map<string, { total: number; correct: number }>();
  const dayCounts = new Map<number, number>();
  let novasAprendidasSemana = 0;
  let bestDay = 0;
  let bestDayDate = 0;

  for (const q of questions) {
    const h = q.stats?.history ?? [];
    const firstReview = h[0];
    if (firstReview && firstReview.date >= week0) {
      novasAprendidasSemana++;
    }
    for (const e of h) {
      if (e.date >= week0) {
        curTotal++;
        if (e.result === 'correct' || e.result === 'self_pass') curCorrect++;
        else curWrong++;
        if (typeof e.timeMs === 'number') curTimeMs += e.timeMs;
        const d = startOfDay(e.date);
        dayCounts.set(d, (dayCounts.get(d) ?? 0) + 1);
        if (q.disciplina_id) {
          const cur = discAttempts.get(q.disciplina_id) ?? {
            total: 0,
            correct: 0,
          };
          cur.total++;
          if (e.result === 'correct' || e.result === 'self_pass') cur.correct++;
          discAttempts.set(q.disciplina_id, cur);
        }
      } else if (e.date >= prevWeek0 && e.date < week0) {
        prevTotal++;
        if (e.result === 'correct' || e.result === 'self_pass') prevCorrect++;
      }
    }
  }

  for (const [d, c] of dayCounts) {
    if (c > bestDay) {
      bestDay = c;
      bestDayDate = d;
    }
  }

  const diasEstudados = dayCounts.size;
  const curPctAcerto = curTotal > 0 ? (100 * curCorrect) / curTotal : 0;
  const prevPctAcerto = prevTotal > 0 ? (100 * prevCorrect) / prevTotal : 0;
  const deltaPct = curPctAcerto - prevPctAcerto;
  const tempoMedio = curTotal > 0 ? curTimeMs / curTotal : 0;

  // Streak corrente
  let streak = 0;
  let cur = today;
  if (!dayCounts.get(today) && dayCounts.get(today - DAY_MS)) cur = today - DAY_MS;
  for (let i = 0; i < 90; i++) {
    if ((dayCounts.get(cur) ?? 0) > 0) {
      streak++;
      cur -= DAY_MS;
    } else {
      break;
    }
  }

  // Top 3 disciplinas mais praticadas na semana
  const topDiscs = Array.from(discAttempts.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 3);

  const fmtDate = (ms: number) =>
    new Date(ms).toLocaleDateString('pt-BR', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
    });

  const start = new Date(week0).toLocaleDateString('pt-BR');
  const end = new Date(today).toLocaleDateString('pt-BR');

  const lines: string[] = [
    `# Relatório semanal — Estudo Simples`,
    ``,
    `**Período:** ${start} → ${end}`,
    `**Gerado em:** ${new Date().toLocaleString('pt-BR')}`,
    ``,
    `## 📊 Visão geral`,
    ``,
    `- **Total de revisões:** ${curTotal}`,
    `- **% acerto:** ${fmtPct(curCorrect, curTotal)} (${curCorrect} acertos · ${curWrong} erros)`,
    `- **Dias estudados:** ${diasEstudados}/7`,
    `- **Tempo médio por questão:** ${tempoMedio > 0 ? fmtMin(tempoMedio) : '—'}`,
    `- **Tempo total:** ${curTimeMs > 0 ? fmtMin(curTimeMs) : '—'}`,
    `- **Streak atual:** ${streak} dia(s) consecutivo(s)`,
    `- **Novas questões aprendidas:** ${novasAprendidasSemana}`,
    ``,
  ];

  if (prevTotal > 0) {
    const arrow = deltaPct >= 0 ? '↑' : '↓';
    lines.push(
      `## 📈 Comparativo com semana anterior`,
      ``,
      `- **Revisões:** ${curTotal} (semana anterior: ${prevTotal})`,
      `- **% acerto:** ${fmtPct(curCorrect, curTotal)} ${arrow} ${Math.abs(deltaPct).toFixed(0)}pp vs ${fmtPct(prevCorrect, prevTotal)} anterior`,
      ``
    );
  }

  if (bestDay > 0) {
    lines.push(
      `## ⚡ Melhor dia`,
      ``,
      `**${fmtDate(bestDayDate)}** com ${bestDay} revisões.`,
      ``
    );
  }

  if (topDiscs.length > 0) {
    lines.push(`## 📚 Top disciplinas`, ``);
    for (const [disc, s] of topDiscs) {
      lines.push(
        `- **${disc}:** ${s.total} revisões · ${fmtPct(s.correct, s.total)} acerto`
      );
    }
    lines.push('');
  }

  // Recomendação simples
  lines.push(`## 💡 Recomendações pra próxima semana`, ``);
  if (curTotal === 0) {
    lines.push(`- Comece estudando — qualquer revisão é melhor que zero.`);
  } else if (curPctAcerto < 50) {
    lines.push(
      `- Acerto baixo. Considere reduzir dificuldade ou revisar fundamentos.`,
      `- Modo "⚔ Inimigas" pode ajudar a quebrar gargalos.`
    );
  } else if (deltaPct < -5) {
    lines.push(
      `- Acerto caiu vs semana anterior. Conteúdo novo? Cansaço?`,
      `- Revisar erradas recentes pode estabilizar.`
    );
  } else if (diasEstudados < 5) {
    lines.push(
      `- Estudou em ${diasEstudados} dia(s). Consistência > intensidade — tente mais dias com menos revisões.`
    );
  } else if (novasAprendidasSemana === 0 && curTotal >= 30) {
    lines.push(
      `- Só revisitou conteúdo conhecido — adicione questões novas pra expandir.`
    );
  } else {
    lines.push(`- Continue assim! Performance consistente.`);
  }
  lines.push(
    '',
    '---',
    '',
    '_Gerado pelo Estudo Simples — repetição espaçada para concursos._'
  );

  return lines.join('\n');
}

export function downloadWeeklyReport(content: string): void {
  if (typeof window === 'undefined') return;
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `estudo-simples-relatorio-${new Date().toISOString().slice(0, 10)}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
