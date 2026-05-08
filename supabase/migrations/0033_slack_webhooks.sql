-- 0033_slack_webhooks.sql
-- Webhooks Slack por user (alternativa ao Discord 0022).
-- Mesmo pattern: webhook_url validado, RLS owner-only, idempotente.

CREATE TABLE IF NOT EXISTS public.slack_webhooks (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  webhook_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (webhook_url ~* '^https://hooks\.slack\.com/services/[A-Z0-9/]+$')
);

ALTER TABLE public.slack_webhooks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS slack_webhooks_select_own ON public.slack_webhooks;
CREATE POLICY slack_webhooks_select_own ON public.slack_webhooks
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS slack_webhooks_upsert_own ON public.slack_webhooks;
CREATE POLICY slack_webhooks_upsert_own ON public.slack_webhooks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS slack_webhooks_update_own ON public.slack_webhooks;
CREATE POLICY slack_webhooks_update_own ON public.slack_webhooks
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS slack_webhooks_delete_own ON public.slack_webhooks;
CREATE POLICY slack_webhooks_delete_own ON public.slack_webhooks
  FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.set_slack_webhooks_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS slack_webhooks_set_updated_at ON public.slack_webhooks;
CREATE TRIGGER slack_webhooks_set_updated_at
  BEFORE UPDATE ON public.slack_webhooks
  FOR EACH ROW
  EXECUTE FUNCTION public.set_slack_webhooks_updated_at();

insert into public.applied_migrations (id, applied_at)
values ('0033', now())
on conflict (id) do update set applied_at = excluded.applied_at;
