'use client';

import { useRef, useState } from 'react';
import { downloadSettings, importSettings } from '@/lib/settings-export';
import { toast } from './Toast';

/**
 * Export/import de preferências (não dados). Útil pra migrar entre
 * dispositivos sem perder tema, metas, sons, CVD, etc.
 *
 * Backup completo de DADOS continua em BackupSection — separado.
 */
export function SettingsBackupSection() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const onExport = () => {
    downloadSettings(
      `estudo-simples-prefs-${new Date().toISOString().slice(0, 10)}.json`
    );
    toast('Preferências exportadas', 'success');
  };

  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setImporting(true);
    try {
      const text = await f.text();
      const data = JSON.parse(text);
      const r = importSettings(data);
      if (!r.ok) {
        toast(r.error, 'error');
      } else {
        toast(
          `${r.restored} preferência(s) restaurada(s). Recarregue a página pra aplicar.`,
          'success',
          8000
        );
      }
    } catch (err) {
      toast(
        'Arquivo inválido: ' +
          (err instanceof Error ? err.message : 'erro desconhecido'),
        'error'
      );
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="card">
      <h2 style={{ margin: '0 0 6px' }}>⚙ Preferências (export/import)</h2>
      <p
        className="muted"
        style={{ margin: '0 0 12px', fontSize: '0.88rem', lineHeight: 1.5 }}
      >
        Salva ou restaura suas configurações (tema, fonte, metas,
        algoritmo SRS, sons, CVD, pomodoro, etc). Útil pra migrar
        entre dispositivos. <strong>Não inclui questões</strong> —
        pra isso use Backup completo abaixo.
      </p>
      <div className="row gap" style={{ flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={onExport}
          style={{ padding: '8px 14px' }}
        >
          📥 Exportar preferências (.json)
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={importing}
          style={{ padding: '8px 14px' }}
        >
          {importing ? 'Importando…' : '📤 Importar (.json)'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          onChange={(e) => void onImport(e)}
          style={{ display: 'none' }}
        />
      </div>
    </div>
  );
}
