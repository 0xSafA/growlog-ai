# Supabase Runbook — Growlog AI

## 1. Создание проекта

1. [supabase.com](https://supabase.com) → New project.
2. Запишите **Project URL** и **anon key** (Settings → API).
3. Запишите **service_role key** (только для сервера и `pnpm worker` — не публикуйте в клиенте).

## 2. Миграции

Примените SQL-файлы из `supabase/migrations/` **в порядке имени файла** (12 файлов):

1. `20260322120000_foundation_mvp.sql`
2. `20260322140000_sop_phase3.sql`
3. `20260322150000_ai_advisor_phase4.sql`
4. `20260322160000_adr002_mvp_adr009_membership_adr008_jobs.sql`
5. `20260322170000_adr_foundation_hardening.sql`
6. `20260322180000_adr_worker_and_usecase_contracts.sql`
7. `20260322190000_photo_pipeline_adr010.sql`
8. `20260322200000_sop_engine_hardening.sql`
9. `20260322210000_adr004_story_block_insight_type.sql`
10. `20260322220000_reports_adr007.sql`
11. `20260322220100_insert_ai_insight_with_grounding_rpc.sql`
12. `20260323000000_phase_bc_extensions.sql`

## 3. Auth

1. Authentication → Providers → **Email** — включите.
2. (Опционально) отключите подтверждение email для локальной разработки.

## 4. Storage

Миграция `foundation_mvp` создаёт bucket **`media`** с RLS по `farm_id` в пути объекта.

Проверьте: Storage → bucket `media` существует и **не public** (доступ через signed URL / policies).

## 5. Локальный `.env.local`

```bash
cp .env.example .env.local
```

Заполните:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`

## 6. Запуск

```bash
pnpm install
pnpm dev          # терминал 1
pnpm worker       # терминал 2 — обязателен для фото и derived data
```

## 7. Первый пользователь

1. `/auth/login` — регистрация email + password.
2. `/onboarding` — имя фермы, timezone, цикл.
3. Запишите голосовую заметку на `/log` — в таймлайне появится событие.
4. Загрузите фото на `/photos` — worker выполнит `photo.analyze`.

## 8. Sensor ingest (устройства)

1. В Supabase создайте строку в `sensor_devices` (или через UI позже).
2. В `config` устройства укажите `"ingest_token": "your-token"` или задайте глобальный `SENSOR_INGEST_SECRET`.
3. `POST /api/sensors/ingest` с телом `{ deviceId, metricCode, value, capturedAt? }` и заголовком `X-Sensor-Token`.

## 9. Integration tests

```bash
# Получите access token залогиненного пользователя (DevTools → Application → Supabase session)
export INTEGRATION_TEST_ACCESS_TOKEN=...
pnpm test:integration
```

## 10. Production checklist

- [ ] Worker запущен как отдельный процесс (Railway, Fly, systemd, Vercel не подходит для long-poll — используйте VPS или Supabase Edge + cron alternative).
- [ ] `SUPABASE_SERVICE_ROLE_KEY` только на сервере/worker.
- [ ] `OPENAI_API_KEY` только на сервере.
- [ ] RLS включён на всех tenant-таблицах (миграции делают это по умолчанию).
