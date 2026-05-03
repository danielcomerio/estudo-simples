-- =====================================================================
-- Estudo Simples — setup do Storage para imagens de questão
-- =====================================================================
-- AÇÃO MANUAL: rodar UMA VEZ no SQL Editor do Supabase.
-- Antes, criar o bucket "questions-images" via UI:
--   Dashboard → Storage → New bucket → name: questions-images
--   Public bucket: ✓ (marcado — paths usam UUID, então não-enumerable)
--   File size limit: 5 MB
--
-- Depois roda este script para aplicar as policies de RLS.
-- =====================================================================

-- Permite SELECT por qualquer um (bucket é público — qualquer URL
-- conhecida abre). Sem isso, listing falha para clientes anônimos
-- (a foto carrega via tag <img>, mas listings via API precisariam).
drop policy if exists "questions-images public read"
  on storage.objects;
create policy "questions-images public read"
  on storage.objects for select
  using (bucket_id = 'questions-images');

-- Só usuários autenticados podem fazer upload, e só na própria pasta
-- (primeiro segmento do path = auth.uid()::text). Bloqueia cross-user.
drop policy if exists "questions-images user upload own"
  on storage.objects;
create policy "questions-images user upload own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'questions-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Atualizar (raro — caller usa upsert=false, mas defesa)
drop policy if exists "questions-images user update own"
  on storage.objects;
create policy "questions-images user update own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'questions-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Deletar só na própria pasta
drop policy if exists "questions-images user delete own"
  on storage.objects;
create policy "questions-images user delete own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'questions-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Confere
select policyname, cmd
from pg_policies
where tablename = 'objects' and schemaname = 'storage'
  and policyname like 'questions-images%'
order by policyname;
