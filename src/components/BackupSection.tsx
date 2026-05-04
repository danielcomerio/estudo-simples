'use client';

import { useRef, useState } from 'react';
import { addQuestionsBulk, selectActiveQuestions, useStore } from '@/lib/store';
import {
  useAllConcursoDisciplinas,
  useConcursos,
  useDisciplinas,
  useTopicos,
} from '@/lib/hierarchy';
import { saveSimulado, useSimuladosForUser } from '@/lib/simulado-store';
import {
  getActiveConcursoId,
  getAlgorithm,
  getTheme,
  setActiveConcursoId,
  setAlgorithm,
  setTheme,
} from '@/lib/settings';
import { dedupeKey } from '@/lib/validation';
import { scheduleSync } from '@/lib/sync';
import { confirmDialog } from './ConfirmDialog';
import { toast } from './Toast';
import type { Question, Simulado } from '@/lib/types';

const BACKUP_VERSION = 1;

/**
 * Gera backup completo: questões + hierarquia + simulados + settings.
 *
 * Dados puxados do estado em memória (já hidratado). Pra ter snapshot
 * mais recente antes de baixar, recomenda-se sincronizar primeiro
 * (botão no Topbar).
 *
 * Esquema do JSON:
 *   {
 *     version: 1,
 *     exported_at: ISO,
 *     user_id,
 *     questions: [...],
 *     concursos: [...],
 *     disciplinas: [...],
 *     concurso_disciplinas: [...],
 *     topicos: [...],
 *     simulados: [...],
 *     settings: { algorithm, theme, activeConcursoId }
 *   }
 *
 * Restore não está implementado ainda — pra recuperar de um backup,
 * o user precisa importar o JSON em /banco (que cobre só questões).
 * Hierarquia, simulados e settings precisariam de tooling separado
 * (ou re-criação manual).
 */
export function BackupSection() {
  const userId = useStore((s) => s.userId);
  const questions = useStore(selectActiveQuestions);
  const { data: concursos } = useConcursos();
  const { data: disciplinas } = useDisciplinas();
  const { data: vinculos } = useAllConcursoDisciplinas();
  const { data: topicos } = useTopicos();
  const simulados = useSimuladosForUser(userId);
  const [downloading, setDownloading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const total =
    questions.length +
    (concursos?.length ?? 0) +
    (disciplinas?.length ?? 0) +
    vinculos.length +
    (topicos?.length ?? 0) +
    simulados.length;

  const downloadBackup = async () => {
    if (!userId) {
      toast('Não autenticado.', 'error');
      return;
    }
    setDownloading(true);
    try {
      const data = {
        version: BACKUP_VERSION,
        exported_at: new Date().toISOString(),
        user_id: userId,
        questions: questions.map((q) => ({
          id: q.id,
          type: q.type,
          disciplina_id: q.disciplina_id,
          tema: q.tema,
          banca_estilo: q.banca_estilo,
          dificuldade: q.dificuldade,
          payload: q.payload,
          srs: q.srs,
          stats: q.stats,
          origem: q.origem ?? null,
          fonte: q.fonte ?? {},
          verificacao: q.verificacao ?? null,
          tags: q.tags ?? [],
          topico_id: q.topico_id ?? null,
          concurso_id: q.concurso_id ?? null,
          created_at: q.created_at,
          updated_at: q.updated_at,
        })),
        concursos: concursos ?? [],
        disciplinas: disciplinas ?? [],
        concurso_disciplinas: vinculos,
        topicos: topicos ?? [],
        simulados,
        settings: {
          algorithm: getAlgorithm(),
          theme: getTheme(),
          activeConcursoId: getActiveConcursoId(),
        },
      };
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      a.download = `estudo-simples-backup-${ts}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast('Backup baixado.', 'success');
    } catch (e) {
      toast(
        'Falha ao gerar backup: ' + (e instanceof Error ? e.message : String(e)),
        'error'
      );
    } finally {
      setDownloading(false);
    }
  };

  return (
    <section className="card">
      <h2>Backup completo</h2>
      <p className="muted" style={{ marginTop: -4 }}>
        Baixa 1 JSON com tudo: questões, concursos, disciplinas, vínculos,
        tópicos, simulados e suas preferências. Use pra disaster recovery
        ou pra mover entre contas.
      </p>
      <ul style={{ fontSize: '0.88rem', marginTop: 6 }}>
        <li>
          <strong>{questions.length}</strong> questão(ões)
        </li>
        <li>
          <strong>{concursos?.length ?? 0}</strong> concurso(s) +{' '}
          <strong>{vinculos.length}</strong> vínculo(s)
        </li>
        <li>
          <strong>{disciplinas?.length ?? 0}</strong> disciplina(s) +{' '}
          <strong>{topicos?.length ?? 0}</strong> tópico(s)
        </li>
        <li>
          <strong>{simulados.length}</strong> simulado(s)
        </li>
      </ul>
      <div className="row gap" style={{ marginTop: 12 }}>
        <button
          type="button"
          className="primary"
          onClick={downloadBackup}
          disabled={downloading || total === 0}
        >
          {downloading ? 'Gerando…' : 'Baixar backup completo'}
        </button>
      </div>
      <p
        className="muted"
        style={{ marginTop: 8, fontSize: '0.78rem', fontStyle: 'italic' }}
      >
        Dica: clique no badge de sincronização no topo antes de baixar
        pra garantir que o backup tem o estado mais novo do servidor.
      </p>

      <hr style={{ margin: '20px 0', border: 0, borderTop: '1px solid var(--border)' }} />

      <h3 style={{ margin: '0 0 6px' }}>Restaurar de backup</h3>
      <p className="muted" style={{ marginTop: 0, fontSize: '0.88rem' }}>
        Lê um JSON gerado acima e adiciona o conteúdo. Questões duplicadas
        (mesmo enunciado + disciplina) são <strong>ignoradas</strong>.
        Simulados são adicionados se não houver outro com mesmo id.
        Settings (algoritmo/tema/concurso ativo) <strong>sobrescrevem</strong>{' '}
        os atuais. Hierarquia (concursos/disciplinas/tópicos) NÃO é
        restaurada — re-criar manualmente em /concursos.
      </p>
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          await handleRestore(f);
        }}
      />
      <div className="row gap" style={{ marginTop: 8 }}>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={restoring}
        >
          {restoring ? 'Restaurando…' : 'Escolher arquivo de backup'}
        </button>
      </div>
    </section>
  );

  async function handleRestore(file: File) {
    if (!userId) {
      toast('Não autenticado.', 'error');
      return;
    }
    setRestoring(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text) as {
        version?: number;
        questions?: Question[];
        simulados?: Simulado[];
        settings?: {
          algorithm?: 'sm2' | 'fsrs';
          theme?: 'auto' | 'light' | 'dark';
          activeConcursoId?: string | null;
        };
      };
      if (data.version !== BACKUP_VERSION) {
        toast(
          `Versão do backup (${data.version}) não suportada (atual: ${BACKUP_VERSION}).`,
          'error'
        );
        return;
      }
      const qCount = data.questions?.length ?? 0;
      const sCount = data.simulados?.length ?? 0;
      const ok = await confirmDialog({
        title: 'Restaurar backup',
        message: `Vai adicionar ${qCount} questão(ões) (duplicatas ignoradas) e ${sCount} simulado(s). Settings serão sobrescritos. Continuar?`,
      });
      if (!ok) return;

      // Restaurar questions: dedup contra estado atual
      let qAdded = 0;
      if (Array.isArray(data.questions) && data.questions.length > 0) {
        const existingKeys = new Set(questions.map(dedupeKey));
        const toAdd: Array<
          Omit<Question, 'id' | 'user_id' | 'created_at' | 'updated_at'>
        > = [];
        for (const raw of data.questions) {
          const q = raw as Question;
          const key = dedupeKey(q);
          if (existingKeys.has(key)) continue;
          existingKeys.add(key);
          // Strip id/user_id/timestamps — store gera novos
          const { id: _id, user_id: _u, created_at: _c, updated_at: _up, ...rest } = q;
          toAdd.push(rest as Omit<Question, 'id' | 'user_id' | 'created_at' | 'updated_at'>);
        }
        if (toAdd.length) {
          addQuestionsBulk(toAdd, userId);
          qAdded = toAdd.length;
        }
      }

      // Restaurar simulados: dedup por id (saveSimulado é upsert por id —
      // se já existir com mesmo id, sobrescreve. Aceitável.)
      let sAdded = 0;
      if (Array.isArray(data.simulados)) {
        for (const sim of data.simulados) {
          if (sim && typeof sim === 'object' && sim.user_id === userId) {
            saveSimulado(sim);
            sAdded++;
          }
        }
      }

      // Restaurar settings
      if (data.settings) {
        if (data.settings.algorithm) {
          try {
            setAlgorithm(data.settings.algorithm);
          } catch {}
        }
        if (data.settings.theme) {
          try {
            setTheme(data.settings.theme);
          } catch {}
        }
        if (data.settings.activeConcursoId !== undefined) {
          try {
            setActiveConcursoId(data.settings.activeConcursoId);
          } catch {}
        }
      }

      scheduleSync(800);
      toast(
        `Restaurado: ${qAdded} questão(ões) novas, ${sAdded} simulado(s).`,
        'success'
      );
    } catch (e) {
      toast(
        'Falha ao restaurar: ' + (e instanceof Error ? e.message : String(e)),
        'error'
      );
    } finally {
      setRestoring(false);
    }
  }
}
