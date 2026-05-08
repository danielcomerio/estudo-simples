'use client';

import { useState } from 'react';
import {
  aiSuggestDisciplinaMapping,
  type AIDiscMappingResult,
} from '@/lib/ai-classify-disciplina';
import { getDefaultProvider } from '@/lib/ai-keys';
import { toast } from './Toast';

/**
 * Botão "🤖 IA sugere mapeamento" no preview de import. Aparece só
 * quando user tem chave configurada. Pede pra IA analisar disciplinas
 * NOVAS e sugerir match com EXISTENTES (mais preciso que fuzzy match).
 */
export function AISuggestMappingButton({
  novosNomes,
  existentes,
  onSuggestion,
}: {
  novosNomes: string[];
  existentes: Array<{ id: string; nome: string }>;
  onSuggestion: (map: AIDiscMappingResult) => void;
}) {
  const [loading, setLoading] = useState(false);
  const provider = getDefaultProvider();

  if (!provider) return null;
  if (existentes.length === 0) return null;

  const handle = async () => {
    setLoading(true);
    try {
      const map = await aiSuggestDisciplinaMapping(novosNomes, existentes);
      if (!map) {
        toast('IA não retornou sugestão útil', 'warn');
        return;
      }
      let applied = 0;
      for (const m of map.values()) {
        if (m.match && m.confidence >= 0.6) applied++;
      }
      onSuggestion(map);
      toast(`IA sugeriu mapeamento de ${applied} disciplina(s)`, 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'erro', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      className="ghost"
      onClick={handle}
      disabled={loading}
      title="Pede pra IA classificar cada disciplina nova com a existente equivalente"
      style={{ padding: '4px 10px', fontSize: '0.82rem' }}
    >
      {loading ? '🤖 Analisando…' : '🤖 IA sugere mapeamento'}
    </button>
  );
}
