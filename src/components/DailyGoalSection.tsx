'use client';

import { useEffect, useState } from 'react';
import { setDailyGoal, useDailyGoal } from '@/lib/settings';
import { toast } from './Toast';

export function DailyGoalSection() {
  const current = useDailyGoal();
  const [val, setVal] = useState<string>(String(current));

  useEffect(() => {
    setVal(String(current));
  }, [current]);

  const save = () => {
    const n = Number(val);
    if (!Number.isInteger(n) || n < 1 || n > 1000) {
      toast('Use um número inteiro entre 1 e 1000', 'error');
      return;
    }
    setDailyGoal(n);
    toast('Meta atualizada', 'success');
  };

  return (
    <section className="card">
      <h2>Meta diária</h2>
      <p className="muted" style={{ marginTop: -4 }}>
        Quantas revisões você quer fazer por dia. Aparece no painel com barra
        de progresso. Não bloqueia nada — é só um norte.
      </p>
      <div
        className="row gap"
        style={{ marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}
      >
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span>Meta:</span>
          <input
            type="number"
            min={1}
            max={1000}
            step={1}
            value={val}
            onChange={(e) => setVal(e.target.value)}
            style={{ width: 100 }}
          />
          <span className="muted">revisões/dia</span>
        </label>
        <button
          type="button"
          className="primary"
          onClick={save}
          disabled={val === String(current)}
        >
          Salvar
        </button>
      </div>
    </section>
  );
}
