'use client';

import { useEffect, useState } from 'react';
import { toast } from './Toast';

type Prefs = {
  regions: string[];
  areas: string[];
  enabled: boolean;
};

const REGIONS: Array<{ value: string; label: string }> = [
  { value: 'BR', label: '🇧🇷 Federal' },
  { value: 'SP', label: 'SP' },
  { value: 'RJ', label: 'RJ' },
  { value: 'MG', label: 'MG' },
  { value: 'DF', label: 'DF' },
  { value: 'RS', label: 'RS' },
  { value: 'PR', label: 'PR' },
  { value: 'BA', label: 'BA' },
  { value: 'CE', label: 'CE' },
  { value: 'PE', label: 'PE' },
  { value: 'GO', label: 'GO' },
  { value: 'SC', label: 'SC' },
  { value: 'ES', label: 'ES' },
  { value: 'PB', label: 'PB' },
  { value: 'PA', label: 'PA' },
  { value: 'AM', label: 'AM' },
  { value: 'MA', label: 'MA' },
  { value: 'RN', label: 'RN' },
  { value: 'MT', label: 'MT' },
  { value: 'MS', label: 'MS' },
  { value: 'AL', label: 'AL' },
  { value: 'PI', label: 'PI' },
  { value: 'SE', label: 'SE' },
  { value: 'TO', label: 'TO' },
  { value: 'RO', label: 'RO' },
  { value: 'AC', label: 'AC' },
  { value: 'AP', label: 'AP' },
  { value: 'RR', label: 'RR' },
];

const AREAS: Array<{ value: string; label: string }> = [
  { value: 'TI', label: 'TI' },
  { value: 'Direito', label: 'Direito' },
  { value: 'Saude', label: 'Saúde' },
  { value: 'Educacao', label: 'Educação' },
  { value: 'Policia', label: 'Polícia' },
  { value: 'Adm', label: 'Administrativo' },
];

export function EditaisPreferencesSection() {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/editais/preferences')
      .then((r) => r.json())
      .then((j: { prefs: Prefs }) => setPrefs(j.prefs))
      .catch(() => toast('Falha ao carregar preferências', 'error'));
  }, []);

  function update<K extends keyof Prefs>(key: K, value: Prefs[K]) {
    if (!prefs) return;
    setPrefs({ ...prefs, [key]: value });
  }

  function toggleSet(key: 'regions' | 'areas', value: string) {
    if (!prefs) return;
    const cur = new Set(prefs[key]);
    if (cur.has(value)) cur.delete(value);
    else cur.add(value);
    update(key, Array.from(cur));
  }

  async function save() {
    if (!prefs) return;
    setSaving(true);
    try {
      const res = await fetch('/api/editais/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      toast('Preferências salvas', 'success');
    } catch (e) {
      toast(`Falha: ${(e as Error).message}`, 'error');
    } finally {
      setSaving(false);
    }
  }

  if (!prefs) {
    return (
      <div className="card" id="editais">
        <h2>📋 Editais no Dashboard</h2>
        <p className="muted">Carregando…</p>
      </div>
    );
  }

  return (
    <div className="card" id="editais">
      <h2 style={{ margin: '0 0 8px' }}>📋 Editais no Dashboard</h2>
      <p className="muted" style={{ margin: '0 0 14px', fontSize: '0.85rem' }}>
        Filtra os editais que aparecem no card do Dashboard. Vazio = mostra
        tudo. Fonte: PCI Concursos.
      </p>

      <label style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <input
          type="checkbox"
          checked={prefs.enabled}
          onChange={(e) => update('enabled', e.target.checked)}
        />
        <span>Mostrar card de editais no Dashboard</span>
      </label>

      <div style={{ marginBottom: 14 }}>
        <strong style={{ fontSize: '0.9rem' }}>Regiões</strong>
        <div className="muted" style={{ fontSize: '0.78rem', marginBottom: 6 }}>
          Vazio = qualquer região
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {REGIONS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => toggleSet('regions', r.value)}
              className={prefs.regions.includes(r.value) ? 'primary' : 'ghost'}
              style={{ padding: '3px 10px', fontSize: '0.82rem' }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <strong style={{ fontSize: '0.9rem' }}>Áreas</strong>
        <div className="muted" style={{ fontSize: '0.78rem', marginBottom: 6 }}>
          Vazio = qualquer área
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {AREAS.map((a) => (
            <button
              key={a.value}
              type="button"
              onClick={() => toggleSet('areas', a.value)}
              className={prefs.areas.includes(a.value) ? 'primary' : 'ghost'}
              style={{ padding: '3px 10px', fontSize: '0.82rem' }}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      <button onClick={save} disabled={saving}>
        {saving ? 'Salvando…' : 'Salvar preferências'}
      </button>
    </div>
  );
}
