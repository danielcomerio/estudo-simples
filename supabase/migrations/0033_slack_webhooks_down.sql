DROP TABLE IF EXISTS public.slack_webhooks CASCADE;
DROP FUNCTION IF EXISTS public.set_slack_webhooks_updated_at();
DELETE FROM public.applied_migrations WHERE id = '0033';
