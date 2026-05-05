'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useStore, selectActiveQuestions } from '@/lib/store';

const SEEN_KEY = 'estudo-simples:onboarding-seen';

const STEPS = [
  {
    title: 'Bem-vindo ao Estudo Simples',
    icon: '👋',
    body: (
      <>
        Repetição espaçada para concursos. Funciona offline (suas
        questões ficam no navegador) e sincroniza quando online.
      </>
    ),
  },
  {
    title: 'Importe suas questões',
    icon: '📥',
    body: (
      <>
        Vá em <strong>/banco</strong> e arraste um arquivo JSON ou cole o
        conteúdo. Aceita formato autoral (objetiva/discursiva/cloze/
        flashcard) ou real (QConcursos). Sem questões pra começar?
        Crie pelo botão <strong>+ Nova</strong>.
      </>
    ),
  },
  {
    title: 'Estude e o resto se ajusta',
    icon: '🎯',
    body: (
      <>
        Em <strong>/estudar</strong>, modo SRS prioriza o que está
        vencendo. Avalie quão bem foi (1–4) — o algoritmo agenda a
        próxima revisão. Atalho <kbd>?</kbd> mostra todas as teclas.
      </>
    ),
  },
];

/**
 * Tour guiado de 3 passos no primeiro acesso. Aparece quando IDB tá
 * vazio E o flag de "visto" ainda não foi setado. Skipável a qualquer
 * momento via Esc ou botão pular.
 */
export function OnboardingTour() {
  const hydrated = useStore((s) => s.hydrated);
  const questions = useStore(selectActiveQuestions);
  const [step, setStep] = useState(0);
  const [seen, setSeen] = useState<boolean | null>(null);
  // Delay antes de mostrar o tour. Sem isso, a tela pisca: hydrate
  // completa com banco vazio → tour aparece → seed carrega 2745
  // questões em ~1s → tour some silenciosamente. 3s é suficiente pro
  // seed comum (6.5MB) baixar e popular o store. Em conexão lenta, o
  // tour aparece — e depois fecha. Imperfeito mas raro.
  const [delayPassed, setDelayPassed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDelayPassed(true), 3000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      setSeen(localStorage.getItem(SEEN_KEY) === '1');
    } catch {
      setSeen(true);
    }
  }, []);

  // Esc fecha
  useEffect(() => {
    if (seen !== false) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        finish();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seen]);

  const finish = () => {
    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch {}
    setSeen(true);
  };

  // Não mostra se: ainda não hidrato, já viu, ou tem questões.
  // Também aguarda delayPassed (3s) pra dar chance do seed carregar
  // antes — evita o flash de <1s no boot do visitante.
  if (!hydrated) return null;
  if (seen !== false) return null;
  if (questions.length > 0) {
    // Marca como visto silenciosamente — usuário já tem dados, não
    // precisa do tour
    finish();
    return null;
  }
  if (!delayPassed) return null;

  const cur = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <div
      role="dialog"
      aria-modal
      aria-labelledby="onboarding-title"
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
    >
      <div
        style={{
          background: 'var(--bg-elev)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          maxWidth: 460,
          width: '100%',
          padding: 26,
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        }}
      >
        <div style={{ fontSize: '2.6rem', textAlign: 'center', marginBottom: 8 }}>
          {cur.icon}
        </div>
        <h2 id="onboarding-title" style={{ margin: '0 0 12px', textAlign: 'center' }}>
          {cur.title}
        </h2>
        <p style={{ margin: '0 0 18px', lineHeight: 1.5 }}>{cur.body}</p>

        <div
          className="row gap"
          style={{ alignItems: 'center', justifyContent: 'space-between' }}
        >
          <span className="muted" style={{ fontSize: '0.82rem' }}>
            {step + 1}/{STEPS.length}
          </span>
          <div className="row gap">
            <button type="button" className="ghost" onClick={finish}>
              Pular
            </button>
            {last ? (
              <Link href="/banco" onClick={finish}>
                <button type="button" className="primary">
                  Ir pra /banco
                </button>
              </Link>
            ) : (
              <button
                type="button"
                className="primary"
                onClick={() => setStep((s) => s + 1)}
              >
                Próximo →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
