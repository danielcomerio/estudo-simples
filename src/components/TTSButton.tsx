'use client';

import { useEffect, useState } from 'react';

/**
 * Botão pra leitura em voz alta de um texto via Web Speech API.
 *
 * Útil pra:
 *  - estudo em deslocamento (ouvir enunciado)
 *  - acessibilidade (a11y)
 *  - revisão hands-free
 *
 * Voz default em pt-BR. Browsers nativamente suportam — nenhuma dep
 * externa. Em iOS funciona, mas precisa user gesture (não auto-play).
 *
 * Strip de marcadores de markdown/LaTeX antes de falar — TTS lê
 * "asterisco asterisco bold" senão.
 */
export function TTSButton({
  text,
  size = 'small',
}: {
  text: string;
  size?: 'small' | 'medium';
}) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    setSupported(
      typeof window !== 'undefined' && 'speechSynthesis' in window
    );
  }, []);

  if (supported === false) return null;

  const speak = () => {
    if (!('speechSynthesis' in window)) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const cleaned = cleanForTTS(text);
    if (!cleaned) return;
    const utter = new SpeechSynthesisUtterance(cleaned);
    utter.lang = 'pt-BR';
    utter.rate = 1.0;
    utter.pitch = 1.0;
    // Tenta voz pt-BR explícita se disponível
    const voices = window.speechSynthesis.getVoices();
    const ptBr = voices.find((v) => v.lang.startsWith('pt'));
    if (ptBr) utter.voice = ptBr;
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utter);
  };

  const fontSize = size === 'small' ? '0.85rem' : '1rem';
  const padding = size === 'small' ? '4px 8px' : '6px 12px';

  return (
    <button
      type="button"
      onClick={speak}
      title={speaking ? 'Parar leitura' : 'Ler em voz alta (TTS)'}
      aria-label={speaking ? 'Parar leitura' : 'Ler enunciado em voz alta'}
      className="ghost"
      style={{
        padding,
        fontSize,
        background: speaking ? 'var(--primary-soft)' : undefined,
        color: speaking ? 'var(--primary)' : undefined,
        borderColor: speaking ? 'var(--primary)' : undefined,
      }}
    >
      {speaking ? '⏹ Parar' : '🔊 Ouvir'}
    </button>
  );
}

/**
 * Remove markdown/LaTeX/code marcadores antes de TTS.
 * Mantém o texto natural pra leitura humana ouvir.
 */
function cleanForTTS(text: string): string {
  if (!text) return '';
  return text
    // Remove blocos LaTeX (inline e display)
    .replace(/\$\$[\s\S]*?\$\$/g, ' fórmula matemática ')
    .replace(/\$[^$\n]+\$/g, ' fórmula ')
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, ' bloco de código ')
    .replace(/`([^`]+)`/g, '$1')
    // Markdown bold/italic — mantém o texto, remove asteriscos
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    // Links markdown [texto](url) → texto
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // HTML tags (caso vazem)
    .replace(/<[^>]+>/g, ' ')
    // Normaliza whitespace
    .replace(/\s+/g, ' ')
    .trim()
    // Cap pra evitar falar texto absurdamente longo
    .slice(0, 2000);
}
