/**
 * Persistência local de chats IA por questão. Não sincroniza — cada
 * device tem seu próprio histórico (sem custo extra de tabela DB).
 *
 * Limites:
 *  - Max 20 turns por questão (40 mensagens user+assistant)
 *  - Max 50KB total por questão
 *
 * Storage: localStorage com chave `qc:<questionId>` + value JSON.
 */

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
};

const KEY_PREFIX = 'qc:';
const MAX_TURNS = 20;
const MAX_BYTES = 50_000;

export function getChatHistory(questionId: string): ChatMessage[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + questionId);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (m): m is ChatMessage =>
        m &&
        typeof m === 'object' &&
        (m.role === 'user' || m.role === 'assistant') &&
        typeof m.content === 'string' &&
        typeof m.timestamp === 'number'
    );
  } catch {
    return [];
  }
}

export function saveChatHistory(
  questionId: string,
  messages: ChatMessage[]
): void {
  if (typeof window === 'undefined') return;
  try {
    // Trim ao limite
    let trimmed = messages.slice(-MAX_TURNS * 2);
    let serialized = JSON.stringify(trimmed);
    while (serialized.length > MAX_BYTES && trimmed.length > 2) {
      // Remove o par mais antigo
      trimmed = trimmed.slice(2);
      serialized = JSON.stringify(trimmed);
    }
    window.localStorage.setItem(KEY_PREFIX + questionId, serialized);
  } catch {
    // localStorage cheio — ignora
  }
}

export function clearChatHistory(questionId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEY_PREFIX + questionId);
  } catch {
    /* ignore */
  }
}

/**
 * Converte histórico em prompt único pra envio ao /api/ai/chat (que
 * aceita prompt string). Usa formato simples "User: ...\nAssistant: ..."
 * Não usa role nativo do provider porque /api/ai/chat hoje só aceita
 * prompt — refator pra messages array é trabalho futuro.
 */
export function historyToPrompt(
  messages: ChatMessage[],
  questionContext: string
): string {
  const turns = messages
    .map((m) => (m.role === 'user' ? `Usuário: ${m.content}` : `Você: ${m.content}`))
    .join('\n\n');

  return `Você é um professor de concurso público brasileiro. Responda dúvidas do aluno sobre a questão abaixo. Seja didático, conciso (até 250 palavras) e em pt-BR.

CONTEXTO DA QUESTÃO:
${questionContext}

CONVERSA ATÉ AGORA:
${turns}

Continue como "Você:". Responda direto, sem cabeçalho. Não se identifique novamente.`;
}
