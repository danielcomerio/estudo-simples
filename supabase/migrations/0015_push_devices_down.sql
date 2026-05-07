begin;
drop policy if exists "push_devices_own_all" on public.push_devices;
drop table if exists public.push_devices;
commit;
