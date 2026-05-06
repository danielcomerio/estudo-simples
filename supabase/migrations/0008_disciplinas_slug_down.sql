-- Down de 0008. Idempotente. Aplicar manualmente no Supabase Dashboard
-- só se quiser reverter — a coluna `slug` é aditiva e não-destrutiva.

drop index if exists public.disciplinas_user_slug_uidx;
drop index if exists public.disciplinas_user_slug_idx;

alter table public.disciplinas
  drop constraint if exists disciplinas_slug_chk;

alter table public.disciplinas
  drop column if exists slug;
