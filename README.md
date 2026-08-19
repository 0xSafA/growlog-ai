# Growlog AI

PWA-журнал выращивания с голосовым вводом, датчиками, фото-анализом и AI-советником на базе полной истории цикла.

## Стек

- **Next.js 15** (Pages Router) + PWA
- **Supabase** — Postgres, Auth (email/password), Storage, RLS
- **OpenAI** — Whisper (STT), gpt-4o-mini (advisor, voice extract, photo vision), TTS
- **TanStack Query**, shadcn/ui, Tailwind

## Быстрый старт

1. Скопируйте переменные окружения:

   ```bash
   cp .env.example .env.local
   ```

2. Создайте Supabase-проект и примените все **12** миграций из [`supabase/migrations/`](supabase/migrations/) — см. [docs/setup/supabase-runbook.md](docs/setup/supabase-runbook.md).

3. Установите зависимости и запустите приложение:

   ```bash
   pnpm install
   pnpm dev
   ```

4. **Отдельным процессом** запустите фоновый worker (анализ фото, daily timelines, индексация, Daily Focus):

   ```bash
   pnpm worker
   ```

5. Откройте [http://localhost:3000](http://localhost:3000), зарегистрируйтесь и пройдите онбординг (ферма + цикл).

## Основные сценарии

| Сценарий | Маршрут |
|----------|---------|
| Daily Focus (после входа) | `/dashboard` |
| Голосовая заметка | FAB → `/log` → «Голосом» |
| Текстовая запись | `/log` |
| Таймлайн | `/timeline` |
| AI-советник | `/assistant` |
| Датчики (ручной ввод) | `/sensors` |
| Ingest датчиков (API) | `POST /api/sensors/ingest` |
| Фото | `/photos` |
| SOP | `/sop` |
| Отчёты | `/reports` |
| Настройки / scope | `/settings` |

## Архитектура

- **Event spine** — все операции пишутся в `events` через RPC (`create_log_entry`, `create_manual_sensor_reading`, `finalize_photo_capture`).
- **Retrieval-first AI** — советник собирает контекст из журнала, сенсоров, фото, SOP, daily summaries и памяти цикла (ADR-003).
- **Trust layer** — факты отделены от гипотез; слабый контекст блокирует или ослабляет ответ (ADR-004).
- **Background jobs** — `document.index`, `timeline.daily.refresh`, `focus.refresh`, `snapshot.refresh`, `photo.analyze`, `report.generate`.

Документация: [docs/adr/](docs/adr/)

## Скрипты

```bash
pnpm dev          # Next.js dev server
pnpm worker       # Background job processor
pnpm build        # Production build
pnpm test         # Unit + integration tests
pnpm test:unit
pnpm test:integration
```

## Переменные окружения

См. [.env.example](.env.example).
