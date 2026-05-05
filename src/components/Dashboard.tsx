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

export function Dashboard() {
  const hydrated = useStore((s) => s.hydrated);
  const questions = useStore(selectActiveQuestions);
  const disciplinas = useStore(selectDisciplinas);
  const syncStatus = useStore((s) => s.syncStatus);
  const lastPullAt = useStore((s) => s.lastPullAt);
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
  // a streak ainda está viva (conta de ontem pra trás). streakAtRisk
  // sinaliza esse estado — o user precisa fazer pelo menos 1 questão
  // hoje pra não quebrar.
  const todayCount = days[days.length - 1]?.count ?? 0;
  let streak = 0;
  const startIdx = todayCount === 0 ? days.length - 2 : days.length - 1;
  for (let i = startIdx; i >= 0; i--) {
    if (days[i].count > 0) streak++;
    else break;
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
  const goalPct = Math.min(100, Math.round((reviewsToday / dailyGoal) * 100));
  const goalReached = reviewsToday >= dailyGoal;

  // Tempo total estudado hoje (soma timeMs das revisões de hoje).
  // Só conta as que registraram tempo (objetivas no submit).
  const todayStart = startOfDay(Date.now());
  let tempoHojeMs = 0;
  for (const q of questions) {
    for (const h of q.stats?.history || []) {
      if (h.date >= todayStart && typeof h.timeMs === 'number') {
        tempoHojeMs += h.timeMs;
      }
    }
  }
  const tempoHojeMin = Math.round(tempoHojeMs / 60000);

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
          <div className="stat-label">Streak{streakAtRisk ? ' ⚠️' : ''}</div>
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
        <div
          className="card"
          style={{
            background:
              diasParaProva <= 7
                ? 'var(--danger-soft, #4a1d1d)'
                : diasParaProva <= 30
                  ? 'var(--warn-bg, #4a3a1a)'
                  : 'var(--bg-elev-2)',
            border: `1px solid ${
              diasParaProva <= 7
                ? 'var(--danger, #ef4444)'
                : diasParaProva <= 30
                  ? 'var(--warn, #d97706)'
                  : 'var(--border)'
            }`,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ fontSize: '2.4rem', lineHeight: 1 }}>
            {diasParaProva === 0 ? '🚨' : diasParaProva <= 7 ? '⏳' : '📅'}
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <strong style={{ fontSize: '1rem' }}>
              {diasParaProva === 0
                ? `Hoje é a prova: ${activeConcurso?.nome}`
                : diasParaProva === 1
                  ? `Amanhã é a prova: ${activeConcurso?.nome}`
                  : `${diasParaProva} dias até a prova`}
            </strong>
            {diasParaProva > 1 && (
              <div className="muted" style={{ fontSize: '0.85rem' }}>
                {activeConcurso?.nome} —{' '}
                {new Date(
                  activeConcurso?.data_prova as string
                ).toLocaleDateString('pt-BR')}
              </div>
            )}
          </div>
        </div>
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
        <Heatmap days={days} level={level} today={today} />
      </div>

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
}: {
  days: { date: number; count: number }[];
  level: (n: number) => string;
  today: number;
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
                className={
                  'day ' + level(d.count) + (d.date === today ? ' today' : '')
                }
                title={
                  new Date(d.date).toLocaleDateString('pt-BR', {
                    weekday: 'short',
                    day: '2-digit',
                    month: 'short',
                  }) +
                  ' · ' +
                  d.count +
                  ' revisão(ões)'
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
