/**
 * "What's New" — pequeno destaque pro user pra novidades recentes.
 *
 * Versão atual deve ser bumpada toda vez que houver entry visível ao
 * user. Não é a versão do package.json (que é "0.1.0" estático até
 * publicar em registry).
 *
 * Quando user vê o conteúdo, gravamos a versão em localStorage. Próxima
 * abertura compara — se diferente, mostra dot.
 */

export const LATEST_VERSION = '2026-05.2';

export type WhatsNewEntry = {
  version: string;
  date: string; // YYYY-MM-DD
  highlights: string[];
};

export const WHATS_NEW: WhatsNewEntry[] = [
  {
    version: '2026-05.2',
    date: '2026-05-07',
    highlights: [
      '📅 Streak diário do desafio /diario nas Conquistas',
      '⚙️ UI de preferências do desafio diário em Configurações',
      '🩺 Health check inclui status do bot Telegram',
      '📋 Documentação: DEPLOY.md, ADRs, CONTRIBUTING.md',
      '🧪 538 testes (+50 em sharing/anki/stats/migrations/notify)',
    ],
  },
  {
    version: '2026-05.1',
    date: '2026-05-04',
    highlights: [
      '🤖 AI Tutor (BYO key OpenAI/Anthropic/Gemini)',
      '🤖 Avaliador de discursivas via IA',
      '📅 Questões do Dia com ranking comunitário',
      '📲 Telegram bot vinculável',
      '👍/👎 Rating de questões',
      '🎴 Anki TSV export',
      '🔊 TTS leitura de enunciados',
      '📚 Marketplace público de decks',
    ],
  },
  {
    version: '2026-05.0',
    date: '2026-05-01',
    highlights: [
      '🔗 Sharing: snapshot e live decks',
      '🔔 Push notifications (Web Push)',
      '📱 PWA install prompt',
      '👑 Master tier permanente',
    ],
  },
];

const STORAGE_KEY = 'estudo-simples:whats-new-seen';

export function getLastSeenVersion(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function markVersionSeen(version: string = LATEST_VERSION): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, version);
  } catch {
    // ignore storage full
  }
}

export function hasUnseenChanges(): boolean {
  const last = getLastSeenVersion();
  return last !== LATEST_VERSION;
}
