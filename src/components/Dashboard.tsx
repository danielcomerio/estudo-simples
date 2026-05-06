'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore, selectActiveQuestions, selectDisciplinas } from '@/lib/store';
import { fmtPercent } from '@/lib/format';
import { DAY_MS } from '@/lib/srs';
import { startOfDay } from '@/lib/utils';
import { useDailyGoal } from '@/lib/settings';
import { useActiveConcursoFilter } from '@/lib/hierarchy';
import type { Question } from '@/lib/types';
import { DailyQuests } from './DailyQuests';
import { SmartSuggestions } from './SmartSuggestions';
import { WelcomeBackBanner } from './WelcomeBackBanner';
import { triggerConfetti } from './ConfettiHost';
import { ShareStreakButton } from './ShareStreakButton';

export function Dashboard() {
  const hydrated = useStore((s) => s.hydrated);
  const questions = useStore(selectActiveQuestions);
  const disciplinas = useStore(selectDisciplinas);
  const syncStatus = useStore((s) => s.syncStatus);
  const lastPullAt = useStore((s) => s.lastPullAt);
  const userId = useStore((s) => s.userId);
  const isGuest = userId === 'guest';
  const dailyGoal = useDailyGoal();
  const router = useRouter();
  const { concurso: activeConcurso } = useActiveConcursoFilter();

  // Pré-computa totais usados em atalhos de teclado. Hooks têm que vir
  // antes dos early returns abaixo (regra do React) — então defina aqui
  // mesmo (questions vazio devolve 0 e os atalhos checam > 0).
  const totalAttemptsForShortcut = questions.reduce(
    (s, q) => s + (q.stats?.attempts || 0),
    0
  );
  const tomorrowForShortcut = startOfDay(Date.now()) + DAY_MS;
  const dueTodayForShortcut = questions.filter(
    (q) => (q.srs?.dueDate ?? 0) < tomorrowForShortcut
  ).length;
  const erradasRecentesForShortcut = questions.filter((q) => {
    const h = q.stats?.history || [];
    return h.slice(-5).some((r) => r.result === 'wrong' || r.result === 'timeout');
  }).length;
  const novasForShortcut = questions.filter(
    (q) => !q.srs?.lastReviewed && q.type === 'objetiva'
  ).length;
  const totalRecForShortcut =
    Math.min(15, dueTodayForShortcut) +
    Math.min(5, erradasRecentesForShortcut) +
    Math.min(5, novasForShortcut);

  // Atalho P (capital): inicia sessão recomendada se houver
  // Atalho R (capital): inicia revisão pré-prova (30q variadas)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'P' && totalRecForShortcut > 0) {
        e.preventDefault();
        router.push(`/estudar?modo=srs&qtd=${totalRecForShortcut}&auto=1`);
      } else if (e.key === 'R' && totalAttemptsForShortcut > 0) {
        e.preventDefault();
        router.push(`/estudar?modo=final-prova&qtd=30&auto=1`);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [totalRecForShortcut, totalAttemptsForShortcut, router]);

  // Delay antes de mostrar empty state. Sem isso, o painel pisca
  // "Bem-vindo + Em 3 passos" enquanto o seed está sendo carregado
  // (caso comum: visitante tem 2745 questões depois de ~1-2s). Com 3s
  // de margem, o seed comum termina antes e o empty state nem aparece.
  const [emptyStateAllowed, setEmptyStateAllowed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setEmptyStateAllowed(true), 3000);
    return () => clearTimeout(t);
  }, []);
  // Dia clicado no heatmap (modal de detalhes)
  const [heatmapDay, setHeatmapDay] = useState<number | null>(null);

  // Confetti idempotente em PR de revisões/dia + streak milestones.
  // CRÍTICO: hooks ficam ANTES dos early returns (regra do React).
  // Calculam streak/PR inline em vez de depender de variáveis locais
  // declaradas só depois do return condicional.
  useEffect(() => {
    if (!hydrated) return;
    const today0 = startOfDay(Date.now());
    // Conta revisões hoje + max histórico (excluindo hoje) + streak
    const dayCounts = new Map<number, number>();
    for (const q of questions) {
      for (const h of q.stats?.history ?? []) {
        const d = startOfDay(h.date);
        dayCounts.set(d, (dayCounts.get(d) ?? 0) + 1);
      }
    }
    const reviewsToday = dayCounts.get(today0) ?? 0;
    let bestBefore = 0;
    for (const [d, c] of dayCounts) {
      if (d < today0 && c > bestBefore) bestBefore = c;
    }
    // PR celebration
    if (reviewsToday > 0 && reviewsToday > bestBefore && bestBefore >= 5) {
      const key =
        'estudo-simples:pr-celebrated:' +
        new Date(today0).toISOString().slice(0, 10);
      try {
        if (localStorage.getItem(key) !== '1') {
          localStorage.setItem(key, '1');
          triggerConfetti();
        }
      } catch {}
    }
    // Streak (consecutivos a partir de hoje pra trás, com freeze de 1 dia)
    let s = 0;
    let freeze = false;
    let cur = reviewsToday > 0 ? today0 : today0 - DAY_MS;
    for (let i = 0; i < 365; i++) {
      const c = dayCounts.get(cur) ?? 0;
      if (c > 0) {
        s++;
      } else if (!freeze) {
        freeze = true;
        s++;
      } else {
        break;
      }
      cur -= DAY_MS;
    }
    if (s >= 3) {
      const milestones = [3, 7, 14, 30, 60, 90, 180, 365];
      const reached = milestones.filter((m) => s >= m);
      if (reached.length > 0) {
        const top = reached[reached.length - 1];
        const key = `estudo-simples:streak-celebrated:${top}`;
        try {
          if (localStorage.getItem(key) !== '1') {
            localStorage.setItem(key, '1');
            triggerConfetti();
          }
        } catch {}
      }
    }
  }, [hydrated, questions]);

  // Mostra skeleton enquanto carrega o store local OU enquanto a
  // primeira sincronização com o servidor ainda não terminou — sem
  // isso, o painel pisca "0 questões" antes do pull inicial completar.
  const firstSyncInFlight = syncStatus === 'syncing' && !lastPullAt;
  const total = questions.length;
  // Antes de declarar "banco vazio", também espera o delay (pra dar
  // chance do seed carregar) ou que tenha pelo menos uma questão.
  const stillBootstrapping = !emptyStateAllowed && total === 0;
  if (!hydrated || firstSyncInFlight || stillBootstrapping) {
    return (
      <>
        <div className="grid-cards">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="card stat">
              <div className="skeleton" style={{ height: 14, width: '60%', margin: '0 auto 10px' }} />
              <div className="skeleton" style={{ height: 30, width: '40%', margin: '0 auto' }} />
            </div>
          ))}
        </div>
        <div className="card">
          <p className="muted center">Carregando suas questões…</p>
        </div>
      </>
    );
  }

  // Empty state: usuário recém-chegado sem nenhuma questão.
  // Mostra onboarding em 3 passos em vez do painel padrão zerado.
  if (total === 0) {
    return (
      <>
        <div
          className="card"
          style={{ background: 'var(--primary-soft)', border: '1px solid var(--primary)' }}
        >
          <h2 style={{ margin: '0 0 8px' }}>👋 Bem-vindo ao Estudo Simples</h2>
          <p style={{ margin: 0 }}>
            Você ainda não tem questões. Vamos começar:
          </p>
        </div>

        <div className="card">
          <h2 style={{ margin: '0 0 12px' }}>Em 3 passos</h2>
          <ol style={{ paddingLeft: 20, lineHeight: 1.8 }}>
            <li>
              <strong>Crie seu concurso</strong> em{' '}
              <Link href="/concursos">/concursos</Link> — banca, órgão,
              cargo, data da prova. Vincula as disciplinas que vão cair
              (com peso e qtd_questoes_prova esperada). Aí no topbar você
              seleciona ele como ativo pra filtrar tudo.
            </li>
            <li>
              <strong>Importe questões</strong> em{' '}
              <Link href="/banco">/banco</Link>. Suporta JSON formato
              autoral (`disciplina_id` + `enunciado` + `alternativas`)
              ou formato real (extração tipo QConcursos: `materia` +
              `concursoAno` + `gabarito`). Detecta automático e abre
              wizard com mapping de disciplinas.
            </li>
            <li>
              <strong>Comece a estudar</strong> em{' '}
              <Link href="/estudar">/estudar</Link> (objetivas) ou{' '}
              <Link href="/discursivas">/discursivas</Link>. SRS prioriza
              vencidas; ative interleaving pra misturar disciplinas. Pra
              memorização decoreba, use{' '}
              <Link href="/cards">/cards</Link> (Cloze + Flashcard).
            </li>
          </ol>
          <p
            className="muted"
            style={{ marginTop: 14, fontSize: '0.88rem', fontStyle: 'italic' }}
          >
            Dica: pra entender o app a fundo, leia o{' '}
            <a
              href="https://github.com/estudo-simples/estudo-simples/blob/main/README.md"
              target="_blank"
              rel="noopener noreferrer"
            >
              README
            </a>{' '}
            (se você é o desenvolvedor) ou simplesmente vá explorando — todas as
            ações são reversíveis.
          </p>
        </div>
      </>
    );
  }

  const tomorrow = startOfDay(Date.now()) + DAY_MS;
  const dueToday = questions.filter((q) => (q.srs?.dueDate ?? 0) < tomorrow).length;
  const totalAttempts = questions.reduce((s, q) => s + (q.stats?.attempts || 0), 0);
  const totalCorrect = questions.reduce((s, q) => s + (q.stats?.correct || 0), 0);

  // Heatmap dos últimos 90 dias
  const today = startOfDay(Date.now());
  const days: { date: number; count: number }[] = [];
  for (let i = 89; i >= 0; i--) {
    days.push({ date: today - i * DAY_MS, count: 0 });
  }
  for (const q of questions) {
    for (const h of q.stats?.history || []) {
      const d = startOfDay(h.date);
      const idx = days.findIndex((x) => x.date === d);
      if (idx >= 0) days[idx].count += 1;
    }
  }
  const max = Math.max(1, ...days.map((d) => d.count));
  const level = (n: number) =>
    n === 0
      ? ''
      : n / max < 0.25
        ? 'l1'
        : n / max < 0.5
          ? 'l2'
          : n / max < 0.75
            ? 'l3'
            : 'l4';

  // Streak atual (dias consecutivos com >=1 revisão até hoje).
  // Hoje conta com "graça": se hoje ainda não estudou mas ontem sim,
  // a streak ainda está viva (conta de ontem pra trás).
  //
  // Freeze: permite até 1 dia perdido por janela de 7 dias sem quebrar.
  // Marca o dia frozen visualmente. Reset do uso após 7 dias sem freeze.
  // Conhecida UX em apps de hábito (Duolingo): tira pressão de "perder
  // tudo" sem desincentivar consistência.
  const todayCount = days[days.length - 1]?.count ?? 0;
  let streak = 0;
  let freezeUsed = false;
  const startIdx = todayCount === 0 ? days.length - 2 : days.length - 1;
  for (let i = startIdx; i >= 0; i--) {
    if (days[i].count > 0) {
      streak++;
    } else if (!freezeUsed) {
      // Usa o freeze: dia perdido conta como "ok", streak segue
      freezeUsed = true;
      streak++;
    } else {
      break;
    }
  }
  const streakAtRisk = todayCount === 0 && streak > 0;
  // Maior streak no histórico de 90 dias (ou retroage se houver dados)
  let bestStreak = 0;
  let curStreak = 0;
  for (const d of days) {
    if (d.count > 0) {
      curStreak++;
      if (curStreak > bestStreak) bestStreak = curStreak;
    } else {
      curStreak = 0;
    }
  }
  // Total de dias com pelo menos 1 revisão (no histórico carregado)
  const diasEstudados = days.filter((d) => d.count > 0).length;

  // Revisões feitas hoje (último elemento de days)
  const reviewsToday = days[days.length - 1]?.count ?? 0;

  // Recordes pessoais (PRs) — top performance em janela de 90 dias.
  //  - bestDayBefore: maior dia EXCLUINDO hoje (pra comparar com hoje)
  //  - bestDayEver: maior dia incluindo hoje (mostrado como chip)
  //  - prTodayCount: hoje quebrou o PR de revisões/dia?
  let bestDayBefore = 0;
  for (let i = 0; i < days.length - 1; i++) {
    if (days[i].count > bestDayBefore) bestDayBefore = days[i].count;
  }
  const bestDayEver = Math.max(bestDayBefore, reviewsToday);
  const prTodayCount =
    reviewsToday > 0 && reviewsToday > bestDayBefore && bestDayBefore >= 5;

  const goalPct = Math.min(100, Math.round((reviewsToday / dailyGoal) * 100));
  const goalReached = reviewsToday >= dailyGoal;

  // Tempo total estudado hoje + nos últimos 7 dias (soma timeMs).
  // Só conta as que registraram tempo (objetivas no submit).
  const todayStart = startOfDay(Date.now());
  const week0 = todayStart - 6 * DAY_MS;
  let tempoHojeMs = 0;
  let tempoSemanaMs = 0;
  for (const q of questions) {
    for (const h of q.stats?.history || []) {
      if (typeof h.timeMs !== 'number') continue;
      if (h.date >= todayStart) tempoHojeMs += h.timeMs;
      if (h.date >= week0) tempoSemanaMs += h.timeMs;
    }
  }
  const tempoHojeMin = Math.round(tempoHojeMs / 60000);
  const tempoSemanaMin = Math.round(tempoSemanaMs / 60000);

  // Contagem regressiva pra prova (se concurso ativo tem data_prova)
  const diasParaProva = (() => {
    if (!activeConcurso?.data_prova) return null;
    const prova = new Date(activeConcurso.data_prova).getTime();
    if (Number.isNaN(prova)) return null;
    const dias = Math.ceil((startOfDay(prova) - startOfDay(Date.now())) / DAY_MS);
    return dias;
  })();

  // Por disciplina: total, vencendo hoje, %acerto. Pra um ranking
  // visual no painel — usuário identifica quais disciplinas estão
  // pedindo mais atenção sem precisar entrar em /stats.
  const discMap = new Map<
    string,
    { total: number; due: number; attempts: number; correct: number }
  >();
  for (const q of questions) {
    const d = q.disciplina_id || '—';
    let cur = discMap.get(d);
    if (!cur) {
      cur = { total: 0, due: 0, attempts: 0, correct: 0 };
      discMap.set(d, cur);
    }
    cur.total++;
    if ((q.srs?.dueDate ?? 0) < tomorrow) cur.due++;
    cur.attempts += q.stats?.attempts ?? 0;
    cur.correct += q.stats?.correct ?? 0;
  }
  const discBreakdown = Array.from(discMap.entries())
    .map(([nome, d]) => ({
      nome,
      ...d,
      acertoPct: d.attempts > 0 ? d.correct / d.attempts : null,
    }))
    .sort((a, b) => b.due - a.due || b.total - a.total);

  // Counts pra quick actions
  const erradasRecentes = questions.filter((q) => {
    const h = q.stats?.history || [];
    return h.slice(-5).some((r) => r.result === 'wrong' || r.result === 'timeout');
  }).length;
  const pendentes = questions.filter(
    (q) => q.type === 'objetiva' && q.verificacao === 'pendente'
  ).length;
  const novasNuncaEstudadas = questions.filter(
    (q) => !q.srs?.lastReviewed && q.type === 'objetiva'
  ).length;

  // "Inimigas": questões que persistem errando — ≥3 tentativas e
  // taxa de acerto < 30%. Foco direto no que mais machuca.
  const inimigas = questions.filter((q) => {
    if (q.type !== 'objetiva') return false;
    const a = q.stats?.attempts ?? 0;
    const c = q.stats?.correct ?? 0;
    if (a < 3) return false;
    return c / a < 0.3;
  }).length;

  // Sessão recomendada (mesma fórmula do card "Hoje, recomendado").
  const recVencendo = Math.min(15, dueToday);
  const recErradas = Math.min(5, erradasRecentes);
  const recNovas = Math.min(5, novasNuncaEstudadas);
  const totalRec = recVencendo + recErradas + recNovas;

  // Dominadas: questões com >=5 acertos consecutivos no fim do histórico.
  // É o sinal mais barato de "memorizado de verdade".
  let dominadas = 0;
  for (const q of questions) {
    const h = q.stats?.history || [];
    if (h.length < 5) continue;
    if (h.slice(-5).every((r) => r.result === 'correct' || r.result === 'self_pass')) dominadas++;
  }

  // Conquistas: marcos atingidos. Mostramos até 4 de categorias variadas
  // (esforço, consistência, memorização, qualidade, banco) pra não ficar
  // só "streak streak streak". Cada categoria contribui no máximo 1 chip.
  const achievements: { emoji: string; label: string }[] = [];
  // Streak atual
  const streakTiers = [3, 7, 14, 30, 60, 90, 180, 365];
  for (let i = streakTiers.length - 1; i >= 0; i--) {
    if (streak >= streakTiers[i]) {
      achievements.push({ emoji: '🔥', label: `Streak ${streakTiers[i]}d` });
      break;
    }
  }
  // Total de tentativas (esforço acumulado)
  const attemptTiers = [50, 100, 250, 500, 1000, 2500, 5000, 10000];
  for (let i = attemptTiers.length - 1; i >= 0; i--) {
    if (totalAttempts >= attemptTiers[i]) {
      achievements.push({ emoji: '🎯', label: `${attemptTiers[i]} respondidas` });
      break;
    }
  }
  // Dominadas (memorização)
  const domTiers = [10, 25, 50, 100, 250, 500, 1000];
  for (let i = domTiers.length - 1; i >= 0; i--) {
    if (dominadas >= domTiers[i]) {
      achievements.push({ emoji: '🏆', label: `${domTiers[i]} dominadas` });
      break;
    }
  }
  // % acerto geral (com base mínima de 100 tentativas pra ser justo)
  if (totalAttempts >= 100) {
    const pct = totalCorrect / totalAttempts;
    if (pct >= 0.9) achievements.push({ emoji: '💎', label: '90% acerto' });
    else if (pct >= 0.8) achievements.push({ emoji: '🎖', label: '80% acerto' });
    else if (pct >= 0.7) achievements.push({ emoji: '🥇', label: '70% acerto' });
  }
  // Recorde do melhor dia (PR)
  if (bestDayEver >= 10) {
    achievements.push({ emoji: '⚡', label: `PR: ${bestDayEver} num dia` });
  }
  // Banco (organização)
  const bankTiers = [100, 500, 1000, 2500, 5000];
  for (let i = bankTiers.length - 1; i >= 0; i--) {
    if (total >= bankTiers[i]) {
      achievements.push({ emoji: '📚', label: `${bankTiers[i]} no banco` });
      break;
    }
  }

  // (Atalhos P e R já registrados via useEffect no topo do componente —
  //  hooks precisam vir antes dos early returns.)

  return (
    <>
      {isGuest && (
        <div
          className="card"
          style={{
            background: 'var(--warn-bg, rgba(217, 119, 6, 0.08))',
            border: '1px solid var(--warn, #d97706)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
            padding: 12,
          }}
        >
          <div style={{ fontSize: '0.92rem' }}>
            👤 Você está em <strong>modo visitante</strong> — dados ficam só
            neste navegador. Crie conta pra sincronizar entre dispositivos.
          </div>
          <Link href="/signup">
            <button type="button" className="primary">
              Criar conta
            </button>
          </Link>
        </div>
      )}

      <WelcomeBackBanner dueCount={dueToday} />

      {streakAtRisk && streak >= 3 && (
        <div
          className="card"
          style={{
            background: 'var(--warn-bg, rgba(217, 119, 6, 0.08))',
            border: '1px solid var(--warn, #d97706)',
            padding: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}
          role="alert"
        >
          <span style={{ fontSize: '1.6rem' }} aria-hidden>🔥</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong style={{ fontSize: '1rem', color: 'var(--warn, #d97706)' }}>
              Sua streak de {streak} dia(s) está em risco!
            </strong>
            <div style={{ fontSize: '0.88rem', color: 'var(--muted)', marginTop: 2 }}>
              Você ainda não estudou hoje. Faça 1 questão pra manter — 30 segundos
              salvam {streak} dias.
            </div>
          </div>
          <Link href="/estudar?modo=srs&qtd=5&auto=1">
            <button
              type="button"
              className="primary"
              style={{ whiteSpace: 'nowrap' }}
            >
              ▶ Salvar streak
            </button>
          </Link>
        </div>
      )}

      {prTodayCount && (
        <div
          className="card"
          style={{
            background: 'linear-gradient(135deg, rgba(34,197,94,0.18), rgba(34,197,94,0.06))',
            border: '1px solid var(--primary)',
            padding: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}
          role="status"
        >
          <span style={{ fontSize: '1.5rem' }} aria-hidden>⚡</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong style={{ fontSize: '1rem' }}>Novo recorde pessoal!</strong>
            <div style={{ fontSize: '0.88rem', color: 'var(--muted)' }}>
              {reviewsToday} revisões hoje · antes era {bestDayBefore}. Continue assim!
            </div>
          </div>
        </div>
      )}

      <div className="grid-cards">
        <div className="card stat">
          <div className="stat-label">Total</div>
          <div className="stat-value">{total}</div>
          <div className="stat-sub">{disciplinas.length} disciplina{disciplinas.length === 1 ? '' : 's'}</div>
        </div>
        <div className="card stat">
          <div className="stat-label">Vencendo hoje</div>
          <div className="stat-value">{dueToday}</div>
          <div className="stat-sub">{total === 0 ? '—' : `${Math.round((100 * dueToday) / total)}% do banco`}</div>
        </div>
        <div className="card stat">
          <div className="stat-label">% Acerto</div>
          <div className="stat-value">{fmtPercent(totalCorrect, totalAttempts)}</div>
          <div className="stat-sub">{totalAttempts} tentativa{totalAttempts === 1 ? '' : 's'}</div>
        </div>
        <div
          className="card stat"
          title={`Maior: ${bestStreak} dia(s) · ${diasEstudados} dia(s) estudados nos últimos 90${streakAtRisk ? ' · em risco hoje' : ''}`}
          style={
            streakAtRisk
              ? {
                  borderColor: 'var(--warn, #d97706)',
                  background: 'var(--warn-bg, rgba(217, 119, 6, 0.08))',
                }
              : undefined
          }
        >
          <div className="stat-label">
            Streak{streakAtRisk ? ' ⚠️' : ''}{freezeUsed ? ' 🧊' : ''}
            {streak >= 3 && !streakAtRisk && <ShareStreakButton streak={streak} />}
          </div>
          <div className="stat-value">{streak}</div>
          <div className="stat-sub">
            dia{streak === 1 ? '' : 's'} consecutivo{streak === 1 ? '' : 's'}
            {streakAtRisk && (
              <>
                <br />
                <span
                  style={{
                    fontSize: '0.78rem',
                    color: 'var(--warn, #d97706)',
                    fontWeight: 600,
                  }}
                >
                  em risco — estude hoje
                </span>
              </>
            )}
            {freezeUsed && !streakAtRisk && (
              <>
                <br />
                <span
                  style={{
                    fontSize: '0.78rem',
                    color: 'var(--muted)',
                  }}
                  title="Dia perdido coberto pelo freeze. Próximo dia perdido quebra a streak."
                >
                  🧊 freeze usado
                </span>
              </>
            )}
            {!streakAtRisk && bestStreak > streak && (
              <>
                <br />
                <span style={{ fontSize: '0.78rem', opacity: 0.7 }}>
                  recorde: {bestStreak}
                </span>
              </>
            )}
            {!streakAtRisk && bestStreak === streak && streak > 0 && (
              <>
                <br />
                <span
                  style={{
                    fontSize: '0.78rem',
                    color: 'var(--primary)',
                    fontWeight: 600,
                  }}
                >
                  🔥 recorde!
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Contagem regressiva pra prova (só com concurso ativo + data) */}
      {diasParaProva !== null && diasParaProva >= 0 && (
        <ProvaCountdownCard
          diasParaProva={diasParaProva}
          concursoNome={activeConcurso?.nome ?? ''}
          dataProva={activeConcurso?.data_prova as string}
          questions={questions}
          dailyGoal={dailyGoal}
          dominadas={dominadas}
        />
      )}

      {/* Meta diária */}
      <div className="card">
        <div
          className="row between"
          style={{ alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}
        >
          <div>
            <strong style={{ fontSize: '1rem' }}>
              {goalReached ? '🏆' : '📈'} Meta diária
            </strong>{' '}
            <span className="muted">
              · {reviewsToday}/{dailyGoal} revisões hoje
              {tempoHojeMin > 0 && ` · ⏱ ${tempoHojeMin} min`}
              {tempoSemanaMin > tempoHojeMin && ` · 7d: ${Math.round(tempoSemanaMin / 60)}h${tempoSemanaMin % 60 > 0 ? (tempoSemanaMin % 60).toString().padStart(2, '0') : ''}`}
            </span>
          </div>
          <Link
            href="/configuracoes"
            className="muted"
            style={{ fontSize: '0.82rem' }}
          >
            ajustar
          </Link>
        </div>
        <div
          aria-label={`progresso: ${goalPct}%`}
          style={{
            height: 8,
            background: 'var(--bg-elev)',
            border: '1px solid var(--border)',
            borderRadius: 999,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${goalPct}%`,
              background: goalReached ? '#22c55e' : 'var(--primary)',
              transition: 'width 320ms ease',
            }}
          />
        </div>
        {goalReached && (
          <p
            className="muted"
            style={{ marginTop: 8, marginBottom: 0, fontSize: '0.85rem' }}
          >
            Meta batida! Continuar adiante segue contando pra streak. 🔥
          </p>
        )}
      </div>

      {/* Missões diárias — derivadas do histórico do dia, sem state */}
      <DailyQuests questions={questions} dailyGoal={dailyGoal} />

      <SmartSuggestions questions={questions} />

      {achievements.length > 0 && (
        <div className="card" style={{ padding: '12px 16px' }}>
          <div
            className="row gap wrap"
            style={{ alignItems: 'center', gap: 10 }}
          >
            <strong
              style={{ fontSize: '0.92rem', color: 'var(--muted)' }}
              title={`${dominadas} questão(ões) com 5+ acertos seguidos · ${diasEstudados} dia(s) estudados nos últimos 90`}
            >
              🏆 Conquistas
            </strong>
            {achievements.slice(0, 4).map((a) => (
              <span
                key={a.label}
                className="chip"
                style={{
                  background: 'var(--primary-soft)',
                  borderColor: 'var(--primary)',
                  color: 'var(--primary)',
                  fontWeight: 600,
                }}
              >
                {a.emoji} {a.label}
              </span>
            ))}
            <Link
              href="/conquistas"
              style={{
                marginLeft: 'auto',
                color: 'var(--primary)',
                fontSize: '0.85rem',
                textDecoration: 'none',
              }}
            >
              ver todas →
            </Link>
          </div>
        </div>
      )}

      {totalRec > 0 && (() => {
        const minEstim = Math.ceil((totalRec * 90) / 60);
        return (
          <div
            className="card"
            style={{
              background: 'var(--primary-soft)',
              border: '1px solid var(--primary)',
            }}
          >
            <h2 style={{ margin: '0 0 6px' }}>🎯 Hoje, recomendado</h2>
            <p style={{ margin: '0 0 10px', fontSize: '0.95rem' }}>
              <strong>{totalRec}</strong> questão(ões){' '}
              <span className="muted">(~{minEstim} min)</span>
              {recVencendo > 0 && ` · ${recVencendo} vencendo`}
              {recErradas > 0 && ` · ${recErradas} erradas recentes`}
              {recNovas > 0 && ` · ${recNovas} novas`}
            </p>
            <Link href={`/estudar?modo=srs&qtd=${totalRec}&auto=1`}>
              <button type="button" className="primary">
                Começar agora (P)
              </button>
            </Link>
          </div>
        );
      })()}

      <div className="card">
        <h2>Comece agora</h2>
        <div className="row gap wrap">
          {dueToday > 0 && (
            <Link
              href={`/estudar?modo=srs&qtd=${Math.min(20, dueToday)}&auto=1`}
            >
              <button className="primary" type="button">
                🎯 Estudar {Math.min(20, dueToday)} vencendo
              </button>
            </Link>
          )}
          {erradasRecentes > 0 && (
            <Link
              href={`/estudar?modo=erros&qtd=${Math.min(20, erradasRecentes)}&auto=1`}
            >
              <button type="button">
                🔁 Revisar {Math.min(20, erradasRecentes)} erradas recentes
              </button>
            </Link>
          )}
          {inimigas > 0 && (
            <Link
              href={`/estudar?modo=inimigas&qtd=${Math.min(20, inimigas)}&auto=1`}
              title="Questões que você persiste errando (>=3 tentativas, <30% acerto)"
            >
              <button
                type="button"
                style={{
                  background: 'var(--danger-soft, #4a1d1d)',
                  borderColor: 'var(--danger, #ef4444)',
                  color: 'var(--danger, #ef4444)',
                }}
              >
                ⚔ Bater {Math.min(20, inimigas)} inimigas
              </button>
            </Link>
          )}
          {inimigas > 0 && (
            <Link href="/banco?srs=inimigas" title="Abrir /banco filtrado por inimigas">
              <button type="button" className="ghost">
                Ver todas {inimigas}
              </button>
            </Link>
          )}
          {novasNuncaEstudadas > 0 && (
            <Link
              href={`/estudar?modo=novas&qtd=${Math.min(10, novasNuncaEstudadas)}&auto=1`}
            >
              <button type="button">
                ✨ Estudar {Math.min(10, novasNuncaEstudadas)} novas
              </button>
            </Link>
          )}
          {pendentes > 0 && (
            <Link href="/revisar">
              <button type="button">⏳ Revisar {pendentes} pendentes</button>
            </Link>
          )}
          {totalAttempts >= 30 && (
            <Link
              href="/estudar?modo=final-prova&qtd=30&auto=1"
              title="Mistura SRS vencidas + inimigas + recém-aprendidas + variadas. Atalho R."
            >
              <button type="button">
                🎓 Revisão pré-prova (R)
              </button>
            </Link>
          )}
        </div>

        <div
          className="row gap wrap"
          style={{ marginTop: 12, fontSize: '0.88rem' }}
        >
          <span className="muted">Outras:</span>
          <Link href="/estudar">
            <button type="button" className="ghost">
              Configurar sessão
            </button>
          </Link>
          <Link href="/discursivas">
            <button type="button" className="ghost">
              Discursivas
            </button>
          </Link>
          <Link href="/cards">
            <button type="button" className="ghost">
              Cards (Cloze + Flashcard)
            </button>
          </Link>
          <Link href="/simulado">
            <button type="button" className="ghost">
              Simulado
            </button>
          </Link>
          <Link href="/banco">
            <button type="button" className="ghost">
              Importar
            </button>
          </Link>
        </div>
      </div>

      <div className="card">
        <h2>Atividade — últimos 90 dias</h2>
        <Heatmap
          days={days}
          level={level}
          today={today}
          onDayClick={(d) => setHeatmapDay(d)}
        />
      </div>

      {heatmapDay !== null && (
        <HeatmapDayModal
          dayMs={heatmapDay}
          questions={questions}
          onClose={() => setHeatmapDay(null)}
        />
      )}

      <PlanoSemanaSection
        questions={questions}
        today={today}
        dailyGoal={dailyGoal}
      />

      <TopErradasSection questions={questions} />

      <PrevisaoSection questions={questions} today={today} />


      <div className="card">
        <h2>Por disciplina</h2>
        {discBreakdown.length === 0 ? (
          <span className="muted">Sem disciplinas no banco.</span>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {discBreakdown.slice(0, 12).map((d) => {
              const pct = d.acertoPct == null ? null : Math.round(d.acertoPct * 100);
              const cor =
                pct == null
                  ? 'var(--muted)'
                  : pct >= 70
                    ? '#22c55e'
                    : pct >= 40
                      ? '#f59e0b'
                      : '#ef4444';
              return (
                <div key={d.nome}>
                  <div
                    className="row between"
                    style={{ alignItems: 'center', marginBottom: 4 }}
                  >
                    <div style={{ fontSize: '0.88rem', fontWeight: 500 }}>
                      {d.nome}
                      {d.due > 0 && (
                        <span
                          className="muted"
                          style={{ marginLeft: 8, fontSize: '0.82rem' }}
                        >
                          🔴 {d.due} vencendo
                        </span>
                      )}
                    </div>
                    <div
                      className="muted"
                      style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}
                    >
                      {pct != null ? `${pct}% · ` : ''}
                      {d.total} questão(ões)
                    </div>
                  </div>
                  <div
                    style={{
                      height: 6,
                      background: 'var(--bg-elev)',
                      border: '1px solid var(--border)',
                      borderRadius: 999,
                      overflow: 'hidden',
                    }}
                    title={
                      pct != null
                        ? `${d.correct}/${d.attempts} acertos`
                        : 'Sem tentativas ainda'
                    }
                  >
                    {pct != null && (
                      <div
                        style={{
                          height: '100%',
                          width: `${pct}%`,
                          background: cor,
                          transition: 'width 320ms ease',
                        }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
            {discBreakdown.length > 12 && (
              <div
                className="muted"
                style={{ fontSize: '0.82rem', marginTop: 4, textAlign: 'center' }}
              >
                + {discBreakdown.length - 12} disciplina(s). Veja todas em{' '}
                <Link href="/stats">/stats</Link>.
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

/**
 * Top 5 questões com pior taxa de acerto (>=3 tentativas). Inimigas
 * absolutas — vencer essas é alto ROI. Click vai pra /estudar com aquela
 * questão específica via ?qid.
 */
function TopErradasSection({ questions }: { questions: Question[] }) {
  const top5 = questions
    .filter((q) => {
      const a = q.stats?.attempts ?? 0;
      return a >= 3;
    })
    .map((q) => {
      const a = q.stats?.attempts ?? 0;
      const c = q.stats?.correct ?? 0;
      const enun =
        (q.payload as Record<string, unknown>).enunciado ??
        (q.payload as Record<string, unknown>).enunciado_completo ??
        (q.payload as Record<string, unknown>).texto ??
        (q.payload as Record<string, unknown>).frente ??
        '';
      return {
        id: q.id,
        type: q.type,
        disc: q.disciplina_id ?? '(sem)',
        preview: String(enun).slice(0, 120),
        a,
        c,
        pct: c / a,
      };
    })
    .sort((x, y) => x.pct - y.pct)
    .slice(0, 5);

  if (top5.length === 0) return null;

  return (
    <div className="card">
      <h2 style={{ margin: '0 0 8px' }}>⚔ Suas inimigas</h2>
      <p
        className="muted"
        style={{ marginTop: 0, marginBottom: 12, fontSize: '0.85rem' }}
      >
        Top 5 com pior acerto (≥3 tentativas). Vencer essas é alto retorno.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {top5.map((q) => {
          const pct = Math.round(q.pct * 100);
          const studyHref =
            q.type === 'objetiva'
              ? `/estudar?qid=${q.id}`
              : q.type === 'cloze' || q.type === 'flashcard'
                ? `/cards?qid=${q.id}`
                : `/banco?search=${encodeURIComponent('id:' + q.id)}`;
          return (
            <Link
              key={q.id}
              href={studyHref}
              style={{
                display: 'block',
                padding: '8px 10px',
                background: 'var(--bg-elev-2)',
                borderRadius: 'var(--radius)',
                fontSize: '0.85rem',
                textDecoration: 'none',
                color: 'inherit',
              }}
              title={`${q.c}/${q.a} acertos`}
            >
              <div className="muted" style={{ fontSize: '0.75rem', marginBottom: 2 }}>
                {q.disc} · {q.type} ·{' '}
                <span style={{ color: 'var(--danger)', fontWeight: 500 }}>{pct}%</span>
              </div>
              <div
                style={{
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {q.preview}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Plano da semana: 7 colunas (próximos 7 dias), cada uma mostra
 * quantidade vencendo no dia + indicador de "leve / médio / pesado"
 * relativo ao dailyGoal. Click no dia abre /estudar pre-filtrado.
 *
 * Diferente do PrevisaoSection (30 dias, gráfico de barras): este é
 * acionável e foca na semana imediata. Útil pro user planejar tempo.
 */
function PlanoSemanaSection({
  questions,
  today,
  dailyGoal,
}: {
  questions: Question[];
  today: number;
  dailyGoal: number;
}) {
  const daysLabels = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const week: { date: number; label: string; count: number; isToday: boolean }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = today + i * DAY_MS;
    week.push({
      date: d,
      label: daysLabels[new Date(d).getDay()],
      count: 0,
      isToday: i === 0,
    });
  }
  let atrasadas = 0;
  for (const q of questions) {
    const due = q.srs?.dueDate ?? 0;
    if (!due) continue;
    if (due < today) {
      atrasadas++;
      continue;
    }
    const diff = Math.floor((due - today) / DAY_MS);
    if (diff <= 6) week[diff].count += atrasadas; // include atrasadas only on day 0?
  }
  // Atrasadas vão pra hoje (precisa recuperar)
  week[0].count += atrasadas;
  const total = week.reduce((s, d) => s + d.count, 0);
  if (total === 0 && atrasadas === 0) return null;

  const max = Math.max(dailyGoal, ...week.map((d) => d.count));

  return (
    <div className="card">
      <h2 style={{ margin: '0 0 6px' }}>📅 Plano da semana</h2>
      <p
        className="muted"
        style={{ marginTop: 0, fontSize: '0.85rem', marginBottom: 12 }}
      >
        Quantidade vencendo nos próximos 7 dias. Cor indica carga relativa
        à sua meta diária ({dailyGoal}).
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 6,
        }}
      >
        {week.map((d, i) => {
          const heavy = d.count > dailyGoal * 1.5;
          const moderate = d.count > dailyGoal;
          const cor = heavy
            ? 'var(--danger)'
            : moderate
              ? 'var(--warn, #d97706)'
              : d.count > 0
                ? 'var(--primary)'
                : 'var(--muted)';
          return (
            <div
              key={i}
              style={{
                background: 'var(--bg-elev-2)',
                border: d.isToday
                  ? '2px solid var(--primary)'
                  : '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: 8,
                textAlign: 'center',
              }}
              title={`${new Date(d.date).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'short' })}: ${d.count} questão(ões)`}
            >
              <div className="muted" style={{ fontSize: '0.7rem' }}>
                {d.label}
              </div>
              <div
                style={{
                  fontSize: '1.2rem',
                  fontWeight: 600,
                  color: cor,
                  marginTop: 2,
                }}
              >
                {d.count}
              </div>
              <div
                style={{
                  height: 4,
                  background: 'var(--bg-elev)',
                  borderRadius: 999,
                  marginTop: 4,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(100, (d.count / max) * 100)}%`,
                    background: cor,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
      {atrasadas > 0 && (
        <p
          className="muted"
          style={{
            marginTop: 10,
            fontSize: '0.82rem',
            color: 'var(--danger)',
          }}
        >
          🔴 {atrasadas} atrasada(s) acumuladas em "hoje" — recupere antes que
          empile mais.
        </p>
      )}
    </div>
  );
}

/**
 * Heatmap de PREVISÃO: próximos 30 dias com quantas questões vencem
 * em cada dia. Útil pra ver carga futura ("antes da prova vou ter
 * picos de N revisões/dia").
 *
 * Atrasadas (dueDate < hoje) viram primeira coluna especial (vermelha).
 * Cada coluna = 1 dia. Altura proporcional ao count, normalizada pelo
 * pico do mês.
 */
function PrevisaoSection({
  questions,
  today,
}: {
  questions: { srs?: { dueDate?: number } }[];
  today: number;
}) {
  const buckets = new Array(31).fill(0); // 0=atrasadas, 1..30=próximos dias
  for (const q of questions) {
    const due = q.srs?.dueDate ?? 0;
    if (!due) continue;
    if (due < today) {
      buckets[0] += 1;
      continue;
    }
    const diff = Math.floor((due - today) / DAY_MS);
    if (diff <= 30) buckets[diff] += 1;
  }
  const max = Math.max(1, ...buckets);
  const total = buckets.reduce((s, n) => s + n, 0);
  if (total === 0) return null;

  return (
    <div className="card">
      <h2>Previsão — próximos 30 dias</h2>
      <p className="muted" style={{ marginTop: -4, fontSize: '0.88rem' }}>
        Quantas questões vão vencer em cada dia. Útil pra antecipar dias
        de carga alta (e atrasadas que precisam recuperar).
      </p>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          height: 80,
          gap: 2,
          marginTop: 10,
        }}
      >
        {buckets.map((n, i) => {
          const isAtrasadas = i === 0;
          const isHoje = i === 1;
          const heightPct = (n / max) * 100;
          const cor = isAtrasadas
            ? 'var(--danger)'
            : isHoje
              ? 'var(--warn, #d97706)'
              : 'var(--primary)';
          const dia =
            i === 0
              ? 'Atrasadas'
              : i === 1
                ? 'Hoje'
                : `+${i - 1}d`;
          return (
            <div
              key={i}
              title={`${dia}: ${n} questão(ões)`}
              style={{
                flex: 1,
                height: `${Math.max(2, heightPct)}%`,
                background: cor,
                borderRadius: '2px 2px 0 0',
                position: 'relative',
                cursor: 'default',
              }}
            />
          );
        })}
      </div>
      <div
        className="muted"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 6,
          fontSize: '0.78rem',
        }}
      >
        <span>🔴 atrasadas: {buckets[0]}</span>
        <span>📅 hoje: {buckets[1]}</span>
        <span>+30d</span>
      </div>
    </div>
  );
}

const DAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']; // dom, seg, ter, qua, qui, sex, sab
const MONTH_LABELS = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
];

/**
 * Heatmap GitHub-style: 7 linhas (dom-sáb), N colunas (semanas).
 * Inclui labels de dias da semana, marcas de mês e legenda de
 * intensidade. Hoje é destacado com borda.
 *
 * Days vem ordenado do mais antigo pro mais recente. Padding inicial
 * com null pra alinhar o primeiro dia ao seu dia-da-semana correto.
 */
function Heatmap({
  days,
  level,
  today,
  onDayClick,
}: {
  days: { date: number; count: number }[];
  level: (n: number) => string;
  today: number;
  onDayClick?: (dayMs: number) => void;
}) {
  // Calcula padding inicial: se primeiro dia é uma quarta (3),
  // precisamos de 3 cells null antes dele pra começar na coluna certa.
  const firstDay = days[0] ? new Date(days[0].date).getDay() : 0;
  const padded: ({ date: number; count: number } | null)[] = [
    ...Array(firstDay).fill(null),
    ...days,
  ];
  // Trailing padding pra completar a última semana
  while (padded.length % 7 !== 0) padded.push(null);

  // Marcas de mês: colunas onde aparece o 1º do mês
  const weeksCount = padded.length / 7;
  const monthLabels: { col: number; label: string }[] = [];
  let lastMonth = -1;
  for (let week = 0; week < weeksCount; week++) {
    // Olha primeiro dia REAL da semana (pula nulls)
    for (let row = 0; row < 7; row++) {
      const cell = padded[week * 7 + row];
      if (!cell) continue;
      const m = new Date(cell.date).getMonth();
      if (m !== lastMonth) {
        monthLabels.push({ col: week, label: MONTH_LABELS[m] });
        lastMonth = m;
      }
      break;
    }
  }

  return (
    <div>
      <div
        className="heatmap-month-labels"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${weeksCount}, 13px)`,
          gap: 3,
          paddingLeft: 22,
        }}
      >
        {Array.from({ length: weeksCount }).map((_, week) => {
          const m = monthLabels.find((x) => x.col === week);
          return (
            <div key={week} style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>
              {m?.label ?? ''}
            </div>
          );
        })}
      </div>
      <div className="heatmap-wrap">
        <div className="heatmap-day-labels">
          {DAY_LABELS.map((l, i) => (
            <div
              key={i}
              style={{
                fontSize: '0.7rem',
                color: 'var(--muted)',
                lineHeight: '13px',
                visibility: i % 2 === 0 ? 'visible' : 'hidden',
              }}
            >
              {l}
            </div>
          ))}
        </div>
        <div className="heatmap">
          {padded.map((d, i) =>
            d === null ? (
              <div key={'pad-' + i} style={{ visibility: 'hidden' }} />
            ) : (
              <div
                key={d.date}
                role={onDayClick ? 'button' : undefined}
                tabIndex={onDayClick ? 0 : undefined}
                onClick={
                  onDayClick && d.count > 0
                    ? () => onDayClick(d.date)
                    : undefined
                }
                onKeyDown={
                  onDayClick && d.count > 0
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onDayClick(d.date);
                        }
                      }
                    : undefined
                }
                className={
                  'day ' +
                  level(d.count) +
                  (d.date === today ? ' today' : '') +
                  (onDayClick && d.count > 0 ? ' clickable' : '')
                }
                title={
                  new Date(d.date).toLocaleDateString('pt-BR', {
                    weekday: 'short',
                    day: '2-digit',
                    month: 'short',
                  }) +
                  ' · ' +
                  d.count +
                  ' revisão(ões)' +
                  (d.count > 0 && onDayClick ? ' (clique pra detalhes)' : '')
                }
              />
            )
          )}
        </div>
      </div>
      <div className="heatmap-legend">
        <span>menos</span>
        <span className="day"></span>
        <span className="day l1"></span>
        <span className="day l2"></span>
        <span className="day l3"></span>
        <span className="day l4"></span>
        <span>mais</span>
      </div>
    </div>
  );
}

/**
 * Modal mostrando detalhes do dia clicado no heatmap. Lista por
 * disciplina: quantas revisões, % acerto, tempo total. Útil pra
 * lembrar do que estudou um dia específico.
 */
function HeatmapDayModal({
  dayMs,
  questions,
  onClose,
}: {
  dayMs: number;
  questions: Question[];
  onClose: () => void;
}) {
  // Esc fecha
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const dayStart = dayMs;
  const dayEnd = dayMs + DAY_MS;

  // Agrega revisões do dia por disciplina
  const byDisc = new Map<
    string,
    { rev: number; correct: number; timeMs: number }
  >();
  let totalRev = 0;
  let totalCorrect = 0;
  let totalTimeMs = 0;
  for (const q of questions) {
    for (const h of q.stats?.history ?? []) {
      if (h.date < dayStart || h.date >= dayEnd) continue;
      totalRev++;
      const ok = h.result === 'correct' || h.result === 'self_pass';
      if (ok) totalCorrect++;
      const tm = h.timeMs ?? 0;
      totalTimeMs += tm;
      const d = q.disciplina_id || '(sem disciplina)';
      const agg = byDisc.get(d) ?? { rev: 0, correct: 0, timeMs: 0 };
      agg.rev++;
      if (ok) agg.correct++;
      agg.timeMs += tm;
      byDisc.set(d, agg);
    }
  }
  const rows = Array.from(byDisc.entries()).sort((a, b) => b[1].rev - a[1].rev);
  const dayLabel = new Date(dayMs).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const totalPct = totalRev > 0 ? Math.round((100 * totalCorrect) / totalRev) : 0;
  const fmtMin = (ms: number) => {
    if (ms < 1000) return '—';
    const min = Math.round(ms / 60000);
    if (min < 1) return '<1min';
    if (min < 60) return `${min}min`;
    return `${Math.floor(min / 60)}h${(min % 60).toString().padStart(2, '0')}`;
  };

  return (
    <div
      role="dialog"
      aria-modal
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-elev)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          maxWidth: 520,
          width: '100%',
          padding: 24,
          maxHeight: '85vh',
          overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        }}
      >
        <div className="row between" style={{ alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: '1.05rem' }}>📅 {dayLabel}</h2>
          <button
            type="button"
            className="ghost icon"
            onClick={onClose}
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        {totalRev === 0 ? (
          <p className="muted">Sem revisões nesse dia.</p>
        ) : (
          <>
            <div
              className="row gap"
              style={{
                background: 'var(--bg-elev-2)',
                borderRadius: 'var(--radius)',
                padding: 12,
                marginBottom: 14,
                fontSize: '0.92rem',
                flexWrap: 'wrap',
              }}
            >
              <span><strong>{totalRev}</strong> revisões</span>
              <span style={{ color: totalPct >= 70 ? '#22c55e' : totalPct >= 40 ? '#f59e0b' : '#ef4444' }}>
                <strong>{totalPct}%</strong> acerto
              </span>
              {totalTimeMs > 0 && <span>⏱ {fmtMin(totalTimeMs)}</span>}
            </div>

            <h3 style={{ margin: '12px 0 8px', fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--muted)' }}>
              Por disciplina
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {rows.map(([disc, s]) => {
                const pct = Math.round((100 * s.correct) / s.rev);
                return (
                  <div
                    key={disc}
                    className="row gap"
                    style={{
                      padding: '6px 10px',
                      background: 'var(--bg-elev-2)',
                      borderRadius: 'var(--radius)',
                      fontSize: '0.85rem',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ flex: 1 }}>{disc}</span>
                    <span className="muted">{s.rev} rev</span>
                    <span
                      style={{
                        color:
                          pct >= 70 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#ef4444',
                        fontWeight: 500,
                      }}
                    >
                      {pct}%
                    </span>
                    {s.timeMs > 0 && (
                      <span className="muted">{fmtMin(s.timeMs)}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Card de countdown rico pra prova. Mostra:
 *  - Dias até a prova com cor escalonada (verde > 30d, amarelo 8-30d, vermelho ≤7d)
 *  - Velocidade atual (rev/dia média últimos 7 dias)
 *  - Projeção: total estimado até a prova
 *  - Domínio atual (% dominadas no banco)
 *  - Mensagem motivacional dependente do estado
 *
 * Não distingue tipos de questão — todas as objetivas/discursivas/cards
 * entram. Histórico < 7 dias usa todos disponíveis.
 */
function ProvaCountdownCard({
  diasParaProva,
  concursoNome,
  dataProva,
  questions,
  dailyGoal,
  dominadas,
}: {
  diasParaProva: number;
  concursoNome: string;
  dataProva: string;
  questions: Question[];
  dailyGoal: number;
  dominadas: number;
}) {
  // Calcula velocidade atual: revisões/dia nos últimos 7 dias estudados
  const week0 = startOfDay(Date.now()) - 6 * DAY_MS;
  let revUltimos7d = 0;
  const diasComRev = new Set<number>();
  for (const q of questions) {
    for (const h of q.stats?.history ?? []) {
      if (h.date < week0) continue;
      revUltimos7d++;
      diasComRev.add(startOfDay(h.date));
    }
  }
  const diasAtivosNaSemana = Math.max(1, diasComRev.size);
  const velocidadeMedia = Math.round(revUltimos7d / diasAtivosNaSemana);
  const velocidadeAlvo = Math.max(velocidadeMedia, dailyGoal);

  const projecaoTotal = velocidadeAlvo * diasParaProva;
  const totalQuestoes = questions.length;
  const dominadasPct =
    totalQuestoes > 0 ? Math.round((100 * dominadas) / totalQuestoes) : 0;

  // Mensagem motivacional contextual
  let mensagem = '';
  let tom: 'success' | 'warn' | 'danger' | 'info' = 'info';
  if (diasParaProva === 0) {
    mensagem = 'É HOJE. Confia em quem já estudou. Boa prova!';
    tom = 'danger';
  } else if (diasParaProva === 1) {
    mensagem =
      'Amanhã. Não estuda muito hoje — descansa e revisa só o essencial.';
    tom = 'warn';
  } else if (diasParaProva <= 3) {
    mensagem =
      'Reta final. Foco em revisar dominadas e bater poucas inimigas — não introduza novidade.';
    tom = 'danger';
  } else if (diasParaProva <= 7) {
    mensagem =
      'Última semana. Modo "🎓 Revisão pré-prova" no /estudar agora é seu melhor amigo.';
    tom = 'danger';
  } else if (diasParaProva <= 30) {
    mensagem =
      velocidadeMedia >= dailyGoal
        ? `No ritmo (${velocidadeMedia}/dia). Mantenha consistência e continue derrubando inimigas.`
        : `Acelera: pra cobrir tudo, mira em ~${dailyGoal}+ revisões/dia (você tá em ${velocidadeMedia}).`;
    tom = velocidadeMedia >= dailyGoal ? 'success' : 'warn';
  } else {
    mensagem =
      'Tempo bom. Foco em ampliar o banco e construir base — diversifica disciplinas via interleaving.';
    tom = 'info';
  }

  const cor =
    tom === 'danger'
      ? 'var(--danger, #ef4444)'
      : tom === 'warn'
        ? 'var(--warn, #d97706)'
        : tom === 'success'
          ? '#22c55e'
          : 'var(--primary)';
  const bg =
    tom === 'danger'
      ? 'var(--danger-soft, rgba(239,68,68,0.08))'
      : tom === 'warn'
        ? 'var(--warn-bg, rgba(217,119,6,0.08))'
        : tom === 'success'
          ? 'rgba(34,197,94,0.08)'
          : 'var(--primary-soft)';

  return (
    <div
      className="card"
      style={{
        background: bg,
        border: `1px solid ${cor}`,
        padding: 16,
      }}
    >
      <div className="row gap" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ fontSize: '2.6rem', lineHeight: 1, color: cor }}>
          {diasParaProva === 0
            ? '🚨'
            : diasParaProva <= 3
              ? '⚡'
              : diasParaProva <= 7
                ? '⏳'
                : diasParaProva <= 30
                  ? '📅'
                  : '🎯'}
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <strong style={{ fontSize: '1.1rem', color: cor }}>
            {diasParaProva === 0
              ? `Hoje é a prova: ${concursoNome}`
              : diasParaProva === 1
                ? `Amanhã é a prova: ${concursoNome}`
                : `${diasParaProva} dias até a prova`}
          </strong>
          {diasParaProva > 1 && concursoNome && (
            <div className="muted" style={{ fontSize: '0.85rem', marginTop: 2 }}>
              {concursoNome} —{' '}
              {new Date(dataProva).toLocaleDateString('pt-BR', {
                weekday: 'long',
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
            </div>
          )}
          <p style={{ margin: '8px 0 0', fontSize: '0.92rem', lineHeight: 1.5 }}>
            {mensagem}
          </p>
        </div>
      </div>

      {diasParaProva >= 1 && totalQuestoes > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 10,
            marginTop: 14,
            padding: '12px 0 0',
            borderTop: `1px solid ${cor}`,
          }}
        >
          <div>
            <div className="muted" style={{ fontSize: '0.75rem' }}>
              Velocidade atual
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>
              {velocidadeMedia} <span style={{ fontWeight: 400, fontSize: '0.85rem' }}>rev/dia</span>
            </div>
          </div>
          <div>
            <div className="muted" style={{ fontSize: '0.75rem' }}>
              Até a prova (estimado)
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>
              ~{projecaoTotal.toLocaleString('pt-BR')} <span style={{ fontWeight: 400, fontSize: '0.85rem' }}>revisões</span>
            </div>
          </div>
          <div>
            <div className="muted" style={{ fontSize: '0.75rem' }}>
              Domínio atual
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>
              {dominadasPct}% <span style={{ fontWeight: 400, fontSize: '0.85rem' }}>({dominadas} questões)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
