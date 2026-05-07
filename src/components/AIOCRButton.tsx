'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { Modal } from './Modal';
import { useStore } from '@/lib/store';
import { scheduleSync } from '@/lib/sync';
import { saveGeneratedQuestions } from '@/lib/ai-save-generated';
import {
  getAIKey,
  getDefaultProvider,
  PROVIDER_LABELS,
} from '@/lib/ai-keys';
import {
  buildOCRPrompt,
  parseOCRResult,
  type GeneratedQuestion,
} from '@/lib/ai-generate';
import { AIQuestionPreviewItem } from './AIQuestionPreviewItem';
import { toast } from './Toast';

const ACCEPTED_TYPES = 'image/png,image/jpeg,image/webp,image/gif';
const MAX_BYTES = 5 * 1024 * 1024; // 5MB

/**
 * Botão "📷 OCR de questão" no toolbar do BancoList.
 *
 * User escolhe arquivo de imagem (foto de prova/print/PDF page) → IA
 * vision parseia → preview com edit → adicionar.
 *
 * Suporta:
 *  - File picker
 *  - Paste de imagem do clipboard (Ctrl+V no modal)
 *  - Câmera (em mobile via input capture)
 */
export function AIOCRButton() {
  const [open, setOpen] = useState(false);
  const provider = getDefaultProvider();

  if (!provider) {
    return (
      <Link
        href="/configuracoes"
        title="Configure uma chave de IA"
        style={{
          fontSize: '0.85rem',
          color: 'var(--muted)',
          textDecoration: 'underline',
          padding: '6px 12px',
        }}
      >
        🤖 Configurar IA
      </Link>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`Tirar foto de questão e OCR via ${PROVIDER_LABELS[provider]}`}
        style={{
          background: 'var(--bg-elev-2)',
          border: '1px solid var(--primary)',
          color: 'var(--primary)',
          fontWeight: 500,
        }}
      >
        📷 OCR foto
      </button>
      {open && <OCRWizard onClose={() => setOpen(false)} />}
    </>
  );
}

type Step = 'pick' | 'loading' | 'preview';

function OCRWizard({ onClose }: { onClose: () => void }) {
  const provider = getDefaultProvider();
  const userId = useStore((s) => s.userId);

  const [step, setStep] = useState<Step>('pick');
  const [error, setError] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [base64, setBase64] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<string | null>(null);
  const [parsed, setParsed] = useState<GeneratedQuestion | null>(null);

  const [banca, setBanca] = useState('FGV');
  const [disciplina, setDisciplina] = useState('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!provider) return null;

  function handleFile(f: File) {
    setError(null);
    if (f.size > MAX_BYTES) {
      setError(`Arquivo muito grande (${Math.round(f.size / 1024)}KB). Max 5MB.`);
      return;
    }
    if (!ACCEPTED_TYPES.split(',').includes(f.type)) {
      setError(`Formato não suportado: ${f.type}. Use PNG, JPEG, WEBP ou GIF.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64Part = dataUrl.split(',')[1] ?? '';
      setBase64(base64Part);
      setMediaType(f.type);
      setImagePreview(dataUrl);
    };
    reader.onerror = () => setError('Falha ao ler arquivo');
    reader.readAsDataURL(f);
  }

  function handlePaste(e: React.ClipboardEvent) {
    const items = Array.from(e.clipboardData.items);
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const f = item.getAsFile();
        if (f) {
          handleFile(f);
          e.preventDefault();
          return;
        }
      }
    }
  }

  async function ocr() {
    if (!base64 || !mediaType) {
      setError('Selecione uma imagem');
      return;
    }
    setError(null);
    setStep('loading');
    const apiKey = getAIKey(provider!);
    if (!apiKey) {
      setError('Chave não configurada');
      setStep('pick');
      return;
    }
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey,
          prompt: buildOCRPrompt({
            banca: banca.trim() || undefined,
            disciplina: disciplina.trim() || undefined,
          }),
          images: [{ base64, mediaType }],
          kind: 'ocr',
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.message ?? `Erro do provider (${res.status})`);
        setStep('pick');
        return;
      }
      const result = parseOCRResult((json as { text: string }).text, {
        banca: banca.trim() || undefined,
        disciplina: disciplina.trim() || undefined,
      });
      if (!result) {
        setError(
          'Nenhuma questão detectada na imagem. Tente uma foto mais nítida ou enquadrada.'
        );
        setStep('pick');
        return;
      }
      setParsed(result);
      setStep('preview');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro de rede');
      setStep('pick');
    }
  }

  function accept() {
    if (!userId || !parsed) {
      toast('Não autenticado ou sem questão', 'error');
      return;
    }
    const { added } = saveGeneratedQuestions([parsed], userId);
    if (added > 0) {
      scheduleSync(500);
      toast('Questão extraída adicionada ao banco.', 'success');
      onClose();
    } else {
      toast('Falha ao adicionar', 'error');
    }
  }

  return (
    <Modal onClose={onClose} ariaLabel="OCR de questão" maxWidth={680}>
      <div onPaste={handlePaste}>
        <h2 style={{ margin: '0 0 6px' }}>📷 OCR de foto de questão</h2>
        <p
          className="muted"
          style={{ margin: '0 0 14px', fontSize: '0.85rem' }}
        >
          Tire foto, faça print ou cole imagem (Ctrl+V). Vision IA extrai a
          questão pro banco. Tag <code>gabarito-ia</code> + revisão pendente.
        </p>

        {step === 'pick' && (
          <>
            {!imagePreview ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: '2px dashed var(--border)',
                  borderRadius: 8,
                  padding: 30,
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: 'var(--bg-elev-2)',
                  marginBottom: 12,
                }}
              >
                <div style={{ fontSize: '2rem', marginBottom: 8 }}>📷</div>
                <div style={{ fontWeight: 500 }}>Clique pra escolher foto</div>
                <div
                  className="muted"
                  style={{ fontSize: '0.82rem', marginTop: 6 }}
                >
                  ou cole com Ctrl+V · ou tire foto no celular
                  <br />
                  PNG/JPEG/WEBP/GIF · max 5MB
                </div>
              </div>
            ) : (
              <div style={{ marginBottom: 12 }}>
                <img
                  src={imagePreview}
                  alt="preview"
                  style={{
                    maxWidth: '100%',
                    maxHeight: 300,
                    display: 'block',
                    margin: '0 auto',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    setImagePreview(null);
                    setBase64(null);
                    setMediaType(null);
                  }}
                  className="ghost"
                  style={{
                    marginTop: 8,
                    fontSize: '0.82rem',
                    padding: '4px 10px',
                  }}
                >
                  ✕ Trocar imagem
                </button>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_TYPES}
              capture="environment"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
              style={{ display: 'none' }}
            />

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <label style={{ flex: 1 }}>
                <div style={{ fontSize: '0.85rem', marginBottom: 4 }}>
                  Banca (opcional)
                </div>
                <input
                  type="text"
                  value={banca}
                  onChange={(e) => setBanca(e.target.value)}
                  placeholder="FGV"
                />
              </label>
              <label style={{ flex: 1 }}>
                <div style={{ fontSize: '0.85rem', marginBottom: 4 }}>
                  Disciplina (opcional)
                </div>
                <input
                  type="text"
                  value={disciplina}
                  onChange={(e) => setDisciplina(e.target.value)}
                  placeholder="Direito Constitucional"
                />
              </label>
            </div>

            {error && (
              <p
                style={{
                  color: 'var(--danger)',
                  fontSize: '0.85rem',
                  marginTop: 10,
                }}
              >
                ⚠ {error}
              </p>
            )}

            <div className="row gap" style={{ marginTop: 16 }}>
              <button
                type="button"
                className="primary"
                onClick={ocr}
                disabled={!base64}
              >
                Extrair questão →
              </button>
              <button type="button" onClick={onClose}>
                Cancelar
              </button>
            </div>
          </>
        )}

        {step === 'loading' && (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div style={{ fontSize: '2rem', marginBottom: 12 }}>👁️</div>
            <div>Lendo imagem…</div>
            <div
              className="muted"
              style={{ fontSize: '0.82rem', marginTop: 8 }}
            >
              ~10-30s · vision pode ser mais lento
            </div>
          </div>
        )}

        {step === 'preview' && parsed && (
          <>
            <div
              className="muted"
              style={{
                fontSize: '0.85rem',
                marginBottom: 12,
                padding: 8,
                background: 'var(--bg-elev-2)',
                borderRadius: 6,
              }}
            >
              ✓ Questão extraída. Revise antes de adicionar.
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 14px' }}>
              <AIQuestionPreviewItem
                question={parsed}
                checked={true}
                onToggle={() => {}}
              />
            </ul>
            <div className="row gap">
              <button type="button" className="primary" onClick={accept}>
                ✓ Adicionar ao banco
              </button>
              <button type="button" onClick={() => setStep('pick')}>
                ← Refazer
              </button>
              <button type="button" onClick={onClose}>
                Cancelar
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
