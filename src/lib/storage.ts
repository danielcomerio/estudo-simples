'use client';

/**
 * Helpers pra Supabase Storage — upload/delete de imagens de questão.
 *
 * Bucket: 'questions-images' (público, com RLS no INSERT/UPDATE/DELETE).
 * Path: '{user_id}/{question_id}/{uuid}.{ext}'.
 *
 * Estratégia de privacidade:
 *  - Bucket público (URL direta, sem signed URL — simplifica render)
 *  - Path obscuro via UUID — não enumerable
 *  - RLS no `storage.objects` impede cross-user no INSERT/DELETE
 *
 * NÃO é privacidade absoluta (URL vazada = imagem acessível). Pra
 * questões de concurso isso é aceitável (conteúdo não-sensível).
 * Quando virar prioridade, migrar pra bucket privado + signed URLs.
 *
 * USER ACTION: criar bucket manualmente — ver supabase/storage_setup.sql
 */

import { createClient } from './supabase/client';
import { uid } from './utils';

const BUCKET = 'questions-images';

const ALLOWED_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
]);
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_IMAGES_PER_QUESTION = 8;

export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageError';
  }
}

/**
 * Faz upload de um arquivo. Retorna URL pública (direto-acessível).
 *
 * Validações client-side antes do upload:
 *  - tipo MIME (PNG, JPEG, WEBP, GIF)
 *  - tamanho (≤ 5 MB)
 */
export async function uploadQuestionImage(
  file: File,
  questionId: string,
  userId: string
): Promise<string> {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new StorageError(
      `tipo não suportado: ${file.type}. Use PNG, JPEG, WEBP ou GIF.`
    );
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new StorageError(
      `arquivo muito grande: ${(file.size / 1024 / 1024).toFixed(1)}MB (max 5MB)`
    );
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin';
  const path = `${userId}/${questionId}/${uid()}.${ext}`;

  const sb = createClient();
  const { error } = await sb.storage.from(BUCKET).upload(path, file, {
    cacheControl: '31536000', // 1 ano — paths são UUIDs (imutáveis)
    upsert: false,
  });

  if (error) {
    // Erros comuns: 403 (RLS), 409 (duplicate), bucket inexistente
    throw new StorageError(`upload falhou: ${error.message}`);
  }

  const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Deleta uma imagem. Best-effort — se a URL não puder ser parseada
 * pro path, retorna sem erro (caller já removeu do payload).
 */
export async function deleteQuestionImage(publicUrl: string): Promise<void> {
  const path = pathFromPublicUrl(publicUrl);
  if (!path) return;

  const sb = createClient();
  const { error } = await sb.storage.from(BUCKET).remove([path]);
  if (error) {
    // Não throw — UI já tirou a imagem da lista; órfão é aceitável
    // (cleanup pode rodar como tarefa futura se virar problema).
    console.warn('failed to delete image', path, error.message);
  }
}

/**
 * Extrai o path interno do bucket de uma public URL.
 * Formato esperado: https://{project}.supabase.co/storage/v1/object/public/questions-images/{path}
 */
function pathFromPublicUrl(url: string): string | null {
  const match = url.match(/\/storage\/v1\/object\/public\/[^/]+\/(.+)$/);
  return match?.[1] ?? null;
}

export const IMAGE_LIMITS = {
  maxSizeBytes: MAX_SIZE_BYTES,
  maxPerQuestion: MAX_IMAGES_PER_QUESTION,
  allowedTypes: Array.from(ALLOWED_TYPES),
};
