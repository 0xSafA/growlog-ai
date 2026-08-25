-- Mobile push token registry (Expo). ADR-011 Phase 3 push notifications.

create table public.mobile_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  expo_push_token text not null,
  platform text not null default 'unknown'
    check (platform in ('ios', 'android', 'unknown')),
  device_label text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, expo_push_token)
);

create index mobile_push_tokens_user_id on public.mobile_push_tokens (user_id);
create index mobile_push_tokens_expo_push_token on public.mobile_push_tokens (expo_push_token);

create trigger mobile_push_tokens_updated_at
  before update on public.mobile_push_tokens
  for each row execute function public.set_updated_at();

alter table public.mobile_push_tokens enable row level security;

create policy mobile_push_tokens_select on public.mobile_push_tokens
  for select using (user_id = auth.uid());

create policy mobile_push_tokens_insert on public.mobile_push_tokens
  for insert with check (user_id = auth.uid());

create policy mobile_push_tokens_update on public.mobile_push_tokens
  for update using (user_id = auth.uid());

create policy mobile_push_tokens_delete on public.mobile_push_tokens
  for delete using (user_id = auth.uid());
