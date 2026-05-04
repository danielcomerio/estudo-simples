'use client';

import { useState } from 'react';
import { selectActiveQuestions, useStore } from '@/lib/store';
import {
  useAllConcursoDisciplinas,
  useConcursos,
  useDisciplinas,
  useTopicos,
} from '@/lib/hierarchy';
import { useSimuladosForUser } from '@/lib/simulado-store';
import { getActiveConcursoId, getAlgorithm, getTheme } from '@/lib/settings';
import { toast } from './Toast';

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
    </section>
  );
}
