/**
 * Export/import de preferências do usuário (settings em LS).
 *
 * Não inclui dados de questão (use Backup pra isso). Só preferências
 * de UI/UX. Útil pra migrar entre dispositivos/navegadores sem
 * perder configuração.
 *
 * Formato versionado pra permitir migrações futuras se schema mudar.
 */

const PREFIX = 'estudo-simples:';
const VERSION = 1;

const SETTINGS_KEYS = [
  'estudo-simples:settings:algorithm',
  'estudo-simples:settings:activeConcurso',
  'estudo-simples:settings:theme',
  'estudo-simples:settings:dailyGoal',
  'estudo-simples:settings:weeklyGoal',
  'estudo-simples:settings:monthlyGoal',
  'estudo-simples:settings:cvd',
  'estudo-simples:settings:fontSize',
  'estudo-simples:settings:highContrast',
  'estudo-simples:sounds:enabled',
  'estudo-simples:notifications:enabled',
  'estudo-simples:pomodoro:settings:v1',
];

export type SettingsExport = {
  version: number;
  exportedAt: string;
  app: 'estudo-simples';
  prefs: Record<string, string>;
};

export function exportSettings(): SettingsExport {
  if (typeof window === 'undefined') {
    return {
      version: VERSION,
      exportedAt: new Date().toISOString(),
      app: 'estudo-simples',
      prefs: {},
    };
  }
  const prefs: Record<string, string> = {};
  for (const k of SETTINGS_KEYS) {
    try {
      const v = localStorage.getItem(k);
      if (v !== null) prefs[k] = v;
    } catch {}
  }
  return {
    version: VERSION,
    exportedAt: new Date().toISOString(),
    app: 'estudo-simples',
    prefs,
  };
}

export type ImportResult =
  | { ok: true; restored: number }
  | { ok: false; error: string };

export function importSettings(data: unknown): ImportResult {
  if (typeof window === 'undefined') {
    return { ok: false, error: 'Sem acesso a localStorage' };
  }
  if (!data || typeof data !== 'object') {
    return { ok: false, error: 'Dados inválidos' };
  }
  const d = data as Partial<SettingsExport>;
  if (d.app !== 'estudo-simples') {
    return { ok: false, error: 'Não é export do Estudo Simples' };
  }
  if (typeof d.version !== 'number' || d.version > VERSION) {
    return {
      ok: false,
      error: `Versão ${d.version} não suportada (máx: ${VERSION})`,
    };
  }
  if (!d.prefs || typeof d.prefs !== 'object') {
    return { ok: false, error: 'Sem preferências no export' };
  }
  let restored = 0;
  for (const [k, v] of Object.entries(d.prefs)) {
    if (typeof v !== 'string') continue;
    // Defesa: só importa keys que começam com nosso prefixo (sandbox)
    if (!k.startsWith(PREFIX)) continue;
    // Cap tamanho pra evitar abuse de localStorage
    if (v.length > 100_000) continue;
    try {
      localStorage.setItem(k, v);
      restored++;
    } catch {}
  }
  return { ok: true, restored };
}

export function downloadSettings(filename = 'estudo-simples-settings.json'): void {
  if (typeof window === 'undefined') return;
  const data = exportSettings();
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
