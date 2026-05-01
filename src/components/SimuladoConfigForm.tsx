'use client';

import { useMemo, useState } from 'react';
import { useStore, selectActiveQuestions, selectDisciplinas } from '@/lib/store';
import type { SimuladoConfig } from '@/lib/types';

const DEFAULT_CONFIG: SimuladoConfig = {
  disciplinas: [],
  qtd: 30,
  tempo_limite_min: 60,
  embaralhar: true,
  embaralhar_alternativas: false,
};

export function SimuladoConfigForm({
  objetivasDisponiveis,
  onSubmit,
  onCancel,
}: {
  objetivasDisponiveis: number;
  onSubmit: (cfg: SimuladoConfig) => void;
  onCancel: () => void;
}) {
  const all = useStore(selectActiveQuestions);
  const disciplinas = useStore(selectDisciplinas);
  const bancas = useMemo(() => {
    const set = new Set<string>();
    for (const q of all) if (q.banca_estilo) set.add(q.banca_estilo);
    return Array.from(set).sort();
  }, [all]);

  const [cfg, setCfg] = useState<SimuladoConfig>(DEFAULT_CONFIG);
  const [tempoStr, setTempoStr] = useState(String(DEFAULT_CONFIG.tempo_limite_min));

  // Tempo recomendado: ~3min por questão (média concurso real FGV)
  const tempoSugerido = Math.max(1, cfg.qtd * 3);

  const toggleDisc = (d: string) => {
    setCfg((c) => {
      const set = new Set(c.disciplinas);
      if (set.has(d)) set.delete(d);
      else set.add(d);
      return { ...c, disciplinas: Array.from(set) };
    });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const tempo = Number(tempoStr);
    if (!Number.isFinite(tempo) || tempo < 0) {
      // validação leve aqui; lib/simulado também valida
      return;
    }
    onSubmit({
      ...cfg,
      tempo_limite_min: Math.floor(tempo),
    });
  };

  return (
    <div className="card">
      <h2 style={{ margin: '0 0 6px' }}>Novo simulado</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        {objetivasDisponiveis} questão(ões) objetiva(s) disponível(eis) no
        seu banco. Discursivas não entram em simulado (exigem
        autoavaliação que não cabe sob cronômetro).
      </p>

      <form onSubmit={submit}>
        <div className="form-grid">
          <label>
            <span>Quantidade de questões *</span>
            <input
              type="number"
              min={1}
              max={500}
              step={1}
              value={cfg.qtd}
              onChange={(e) =>
                setCfg((c) => ({
                  ...c,
                  qtd: Math.max(1, Math.min(500, Number(e.target.value) || 1)),
                }))
              }
              required
            />
          </label>
          <label>
            <span>Tempo limite (minutos)</span>
            <input
              type="number"
              min={0}
              max={1440}
              step={1}
              value={tempoStr}
              onChange={(e) => setTempoStr(e.target.value)}
            />
            <span
              className="muted"
              style={{ fontSize: '0.78rem', marginTop: 4 }}
            >
              0 = sem limite. Sugestão pra {cfg.qtd} questões: {tempoSugerido}min (3min/questão)
              {' '}
              <button
                type="button"
                className="ghost"
                style={{ padding: '2px 6px', fontSize: '0.78rem' }}
                onClick={() => setTempoStr(String(tempoSugerido))}
              >
                aplicar
              </button>
            </span>
          </label>
          {bancas.length > 0 && (
            <label>
              <span>Banca (opcional)</span>
              <select
                value={cfg.banca_estilo ?? ''}
                onChange={(e) =>
                  setCfg((c) => ({
                    ...c,
                    banca_estilo: e.target.value || undefined,
                  }))
                }
              >
                <option value="">Qualquer</option>
                {bancas.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            <span>Dificuldade mínima</span>
            <select
              value={cfg.dif_min ?? ''}
              onChange={(e) =>
                setCfg((c) => ({
                  ...c,
                  dif_min: e.target.value ? Number(e.target.value) : undefined,
                }))
              }
            >
              <option value="">Qualquer</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Dificuldade máxima</span>
            <select
              value={cfg.dif_max ?? ''}
              onChange={(e) =>
                setCfg((c) => ({
                  ...c,
                  dif_max: e.target.value ? Number(e.target.value) : undefined,
                }))
              }
            >
              <option value="">Qualquer</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>

        {disciplinas.length > 0 && (
          <fieldset
            style={{
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: 12,
              marginBottom: 14,
            }}
          >
            <legend className="muted" style={{ padding: '0 6px', fontSize: '0.85rem' }}>
              Disciplinas (vazio = todas)
            </legend>
            <div className="row gap wrap">
              {disciplinas.map((d) => {
                const ativa = cfg.disciplinas.includes(d);
                return (
                  <button
                    type="button"
                    key={d}
                    className={'chip' + (ativa ? ' active' : '')}
                    onClick={() => toggleDisc(d)}
                    style={{
                      borderColor: ativa ? 'var(--primary)' : 'var(--border)',
                      background: ativa ? 'var(--primary-soft)' : 'var(--bg-elev-2)',
                    }}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}

        <div
          className="row gap wrap"
          style={{ marginBottom: 14, alignItems: 'center' }}
        >
          <label className="check-row">
            <input
              type="checkbox"
              checked={cfg.embaralhar}
              onChange={(e) =>
                setCfg((c) => ({ ...c, embaralhar: e.target.checked }))
              }
            />
            <span>Embaralhar ordem das questões</span>
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={cfg.embaralhar_alternativas}
              onChange={(e) =>
                setCfg((c) => ({
                  ...c,
                  embaralhar_alternativas: e.target.checked,
                }))
              }
            />
            <span>Embaralhar alternativas dentro de cada questão</span>
          </label>
        </div>

        <div className="row gap right">
          <button type="button" className="ghost" onClick={onCancel}>
            Cancelar
          </button>
          <button
            type="submit"
            className="primary"
            disabled={objetivasDisponiveis === 0}
          >
            Iniciar simulado
          </button>
        </div>
      </form>
    </div>
  );
}
