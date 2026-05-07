/**
 * Helpers de cache de respostas IA.
 *
 * cacheKey é hash sha-256 hex de `provider|model|prompt`. Determinístico,
 * isomórfico (Web Crypto disponível em Node 20+ e browsers modernos).
 *
 * Lado client: gera cacheKey antes de enviar (pra evitar prompt grande
 * trafegar 2x quando vai cair em cache).
 * Lado server: re-gera no /api/ai/chat e cruza com o do client (paranoia)
 * + lookup no DB.
 */

export async function buildCacheKey(
  provider: string,
  model: string,
  prompt: string
): Promise<string> {
  const input = `${provider}|${model}|${prompt}`;
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  const bytes = new Uint8Array(hash);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}
