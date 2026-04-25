'use client';

import { useRef, useState } from 'react';
import { useStore, addQuestionsBulk, selectActiveQuestions } from '@/lib/store';
import { scheduleSync } from '@/lib/sync';
import {
  dedupeKey,
  extractItems,
  normalizeQuestion,
  safeParseJSON,
  validateQuestion,
} from '@/lib/validation';
import { toast } from './Toast';

type ImportResult = { added: number; skipped: number; errors: string[] };

export function ImportZone() {
  const userId = useStore((s) => s.userId);
  const existing = useStore(selectActiveQuestions);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [paste, setPaste] = useState('');
  const [report, setReport] = useState<ImportResult | null>(null);

  const importText = (text: string): ImportResult => {
    if (!userId) return { added: 0, skipped: 0, errors: ['Sem usuário autenticado'] };
    if (!text || !text.trim()) return { added: 0, skipped: 0, errors: ['Vazio.'] };
    const { value, error } = safeParseJSON(text);
    if (error) return { added: 0, skipped: 0, errors: ['JSON inválido: ' + error] };
    const items = extractItems(value);
    if (items.length === 0) return { added: 0, skipped: 0, errors: ['Nenhum item encontrado.'] };

    const existingKeys = new Set(existing.map(dedupeKey));
    const novos: Parameters<typeof addQuestionsBulk>[0] = [];
    const errors: string[] = [];
    let skipped = 0;

    items.forEach((raw, idx) => {
      const v = validateQuestion(raw);
      if (!v.ok) {
        errors.push(`Item #${idx + 1}: ${v.errors.join(' | ')}`);
        return;
      }
      const norm = normalizeQuestion(raw as Record<string, unknown>, v.type);
      const key = dedupeKey(norm);
      if (existingKeys.has(key)) {
        skipped++;
        return;
      }
      existingKeys.add(key);
      novos.push(norm);
    });

    if (novos.length) {
      addQuestionsBulk(novos, userId);
      scheduleSync(800);
    }
    return { added: novos.length, skipped, errors };
  };

  const handleFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files).filter(
      (f) => f.name.toLowerCase().endsWith('.json') || /json/i.test(f.type)
    );
    if (!arr.length) {
      toast('Nenhum arquivo JSON.', 'warn');
      return;
    }
    const aggregate: ImportResult = { added: 0, skipped: 0, errors: [] };
    for (const file of arr) {
      try {
        const text = await file.text();
        const r = importText(text);
        aggregate.added += r.added;
        aggregate.skipped += r.skipped;
        aggregate.errors.push(...r.errors.map((e) => `[${file.name}] ${e}`));
      } catch (e) {
        aggregate.errors.push(
          `[${file.name}] Falha ao ler: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    }
    setReport(aggregate);
    if (aggregate.added > 0) toast(`${aggregate.added} questão(ões) importada(s).`, 'success');
    else if (aggregate.errors.length) toast('Importação falhou. Veja relatório.', 'error');
  };

  const handlePaste = () => {
    const r = importText(paste);
    setReport(r);
    if (r.added > 0) {
      toast(`${r.added} questão(ões) importada(s).`, 'success');
      setPaste('');
    } else if (r.errors.length) {
      toast('Importação falhou. Veja relatório.', 'error');
    }
  };

  return (
    <div className="card">
      <h2>Importar questões</h2>
      <p className="muted">
        Aceita um único objeto, um array, ou um objeto com a chave <code>questions</code>. Suporta
        objetivas e discursivas (campo <code>tipo: &quot;discursiva&quot;</code>).
      </p>

      <div
        className={'dropzone' + (dragOver ? ' dragover' : '')}
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer?.files?.length) void handleFiles(e.dataTransfer.files);
        }}
      >
        <span className="icon" aria-hidden>
          ⬆
        </span>
        <strong>Arraste arquivos JSON aqui</strong>
        <span>ou clique para selecionar</span>
        <input
          ref={inputRef}
          type="file"
          accept=".json,application/json"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) void handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      <details className="paste-block">
        <summary>Colar JSON manualmente</summary>
        <textarea
          rows={10}
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          placeholder='Cole aqui o JSON. Ex.: [{"disciplina_id":"...","enunciado":"...","alternativas":[...]}, ...]'
        />
        <div className="row gap">
          <button type="button" className="primary" onClick={handlePaste}>
            Importar JSON colado
          </button>
          <button type="button" onClick={() => setPaste('')}>
            Limpar
          </button>
        </div>
      </details>

      {report && (
        <div
          className={
            'import-report ' +
            (report.added > 0 && report.errors.length === 0
              ? 'ok'
              : report.errors.length
                ? 'fail'
                : '')
          }
        >
          <strong>{report.added}</strong> adicionada(s)
          {report.skipped > 0 && <> · <strong>{report.skipped}</strong> duplicada(s) ignorada(s)</>}
          {report.errors.length > 0 && (
            <details open>
              <summary>
                <strong>{report.errors.length}</strong> erro(s)
              </summary>
              <ul>
                {report.errors.slice(0, 50).map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
                {report.errors.length > 50 && <li>… e {report.errors.length - 50} a mais</li>}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
