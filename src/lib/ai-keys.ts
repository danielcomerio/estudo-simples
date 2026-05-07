/**
 * Gestão de API keys de IA pelo usuário (Bring Your Own — BYO).
 *
 * Modelo: usuário pluga sua própria chave OpenAI/Anthropic/Gemini.
 * App nunca paga API call. Settings page tem campos pra cada provider.
 *
 * Storage: localStorage (NÃO sincroniza com Supabase — chave é pessoal,
 * nunca sai do device do user). Dificulta vazamento mas trade-off:
 * user perde chave ao trocar de browser/device.
 *
 * Uso planejado: botão "🤖 Explicar" em questão errada chama
 * /api/ai/chat com a chave + mensagem. Server faz pass-through pro
 * provider (NÃO armazena a chave no server).
 */

export type AIProvider = 'openai' | 'anthropic' | 'gemini';

const STORAGE_KEYS: Record<AIProvider, string> = {
  openai: 'estudo-simples:ai-key:openai',
  anthropic: 'estudo-simples:ai-key:anthropic',
  gemini: 'estudo-simples:ai-key:gemini',
};

const PROVIDER_LABELS: Record<AIProvider, string> = {
  openai: 'OpenAI (ChatGPT)',
  anthropic: 'Anthropic (Claude)',
  gemini: 'Google Gemini',
};

const PROVIDER_KEY_PREFIX: Record<AIProvider, string> = {
  openai: 'sk-',
  anthropic: 'sk-ant-',
  gemini: '', // Gemini keys não têm prefixo padrão
};

export function getAIKey(provider: AIProvider): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEYS[provider]);
}

export function setAIKey(provider: AIProvider, key: string | null): void {
  if (typeof localStorage === 'undefined') return;
  if (!key || !key.trim()) {
    localStorage.removeItem(STORAGE_KEYS[provider]);
    return;
  }
  // Validação básica: keys têm tamanho e prefix esperado
  const trimmed = key.trim();
  if (trimmed.length < 20 || trimmed.length > 500) {
    throw new Error('Chave inválida (tamanho fora do esperado)');
  }
  const expectedPrefix = PROVIDER_KEY_PREFIX[provider];
  if (expectedPrefix && !trimmed.startsWith(expectedPrefix)) {
    throw new Error(
      `Chave deve começar com "${expectedPrefix}" (${PROVIDER_LABELS[provider]})`
    );
  }
  localStorage.setItem(STORAGE_KEYS[provider], trimmed);
}

export function hasAnyAIKey(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return (
    !!localStorage.getItem(STORAGE_KEYS.openai) ||
    !!localStorage.getItem(STORAGE_KEYS.anthropic) ||
    !!localStorage.getItem(STORAGE_KEYS.gemini)
  );
}

export function getDefaultProvider(): AIProvider | null {
  if (getAIKey('anthropic')) return 'anthropic';
  if (getAIKey('openai')) return 'openai';
  if (getAIKey('gemini')) return 'gemini';
  return null;
}

export function maskKey(key: string): string {
  if (key.length <= 8) return '****';
  return key.slice(0, 4) + '****' + key.slice(-4);
}

export { PROVIDER_LABELS };
