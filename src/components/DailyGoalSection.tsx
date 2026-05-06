'use client';

import { useEffect, useState } from 'react';
import {
  setDailyGoal,
  useDailyGoal,
  setWeeklyGoal,
  useWeeklyGoal,
  setMonthlyGoal,
  useMonthlyGoal,
} from '@/lib/settings';
import { toast } from './Toast';

export function DailyGoalSection() {
  const dailyCurrent = useDailyGoal();
  const weeklyCurrent = useWeeklyGoal();
  const monthlyCurrent = useMonthlyGoal();

  const [daily, setDaily] = useState<string>(String(dailyCurrent));
  const [weekly, setWeekly] = useState<string>(String(weeklyCurrent));
  const [monthly, setMonthly] = useState<string>(String(monthlyCurrent));

  useEffect(() => setDaily(String(dailyCurrent)), [dailyCurrent]);
  useEffect(() => setWeekly(String(weeklyCurrent)), [weeklyCurrent]);
  useEffect(() => setMonthly(String(monthlyCurrent)), [monthlyCurrent]);

  const saveDaily = () => {
    const n = Number(daily);
    if (!Number.isInteger(n) || n < 1 || n > 1000) {
      toast('Meta diária: número inteiro entre 1 e 1000', 'error');
      return;
    }
    setDailyGoal(n);
    toast('Meta diária atualizada', 'success');
  };

  const saveWeekly = () => {
    const n = Number(weekly);
    if (!Number.isInteger(n) || n < 0 || n > 10000) {
      toast('Meta semanal: 0 (off) a 10000', 'error');
      return;
    }
    setWeeklyGoal(n);
    toast(n === 0 ? 'Meta semanal desabilitada' : 'Meta semanal atualizada', 'success');
  };

  const saveMonthly = () => {
    const n = Number(monthly);
    if (!Number.isInteger(n) || n < 0 || n > 50000) {
      toast('Meta mensal: 0 (off) a 50000', 'error');
      return;
    }
    setMonthlyGoal(n);
    toast(n === 0 ? 'Meta mensal desabilitada' : 'Meta mensal atualizada', 'success');
  };

  return (
    <section className="card">
      <h2>Metas de revisão</h2>
      <p className="muted" style={{ marginTop: -4 }}>
        Diária aparece no painel com barra de progresso. Semanal e mensal são
        opcionais (0 = desabilitado) — útil pra quem prefere flexibilidade
        ("posso pegar firme uns dias e descansar em outros, contanto que bata
        X/semana").
      </p>

      <GoalRow
        label="Diária"
        unit="revisões/dia"
        value={daily}
        setValue={setDaily}
        save={saveDaily}
        current={String(dailyCurrent)}
        min={1}
        max={1000}
      />

      <GoalRow
        label="Semanal"
        unit="revisões/semana"
        value={weekly}
        setValue={setWeekly}
        save={saveWeekly}
        current={String(weeklyCurrent)}
        min={0}
        max={10000}
        suggestion={`(sugestão: ${dailyCurrent * 7})`}
      />

      <GoalRow
        label="Mensal"
        unit="revisões/mês"
        value={monthly}
        setValue={setMonthly}
        save={saveMonthly}
        current={String(monthlyCurrent)}
        min={0}
        max={50000}
        suggestion={`(sugestão: ${dailyCurrent * 30})`}
      />
    </section>
  );
}

function GoalRow({
  label,
  unit,
  value,
  setValue,
  save,
  current,
  min,
  max,
  suggestion,
}: {
  label: string;
  unit: string;
  value: string;
  setValue: (v: string) => void;
  save: () => void;
  current: string;
  min: number;
  max: number;
  suggestion?: string;
}) {
  return (
    <div
      className="row gap"
      style={{ marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}
    >
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          minWidth: 140,
        }}
      >
        <strong style={{ minWidth: 70 }}>{label}:</strong>
        <input
          type="number"
          min={min}
          max={max}
          step={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          style={{ width: 90 }}
        />
        <span className="muted" style={{ fontSize: '0.85rem' }}>
          {unit}
        </span>
        {suggestion && (
          <span className="muted" style={{ fontSize: '0.78rem' }}>
            {suggestion}
          </span>
        )}
      </label>
      <button
        type="button"
        className="primary"
        onClick={save}
        disabled={value === current}
        style={{ padding: '6px 14px' }}
      >
        Salvar
      </button>
    </div>
  );
}
