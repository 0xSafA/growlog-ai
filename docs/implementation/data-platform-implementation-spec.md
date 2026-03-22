# Growlog AI — Data Platform Implementation Spec

Статус: Draft
Дата: 2026-03-22
Автор: A. Safiulin, OG Lab.
Связан с: `ADR-001`, `ADR-002`, `ADR-003`, `ADR-004`, `ADR-005`

⸻

## Назначение

Этот документ переводит решения из `ADR-001` и `ADR-002` в уровень, пригодный для реализации.

Его цель:
	•	зафиксировать naming conventions,
	•	зафиксировать обязательные SQL-инварианты,
	•	дать рекомендуемый порядок первых миграций,
	•	зафиксировать backend write contracts,
	•	убрать двусмысленности, из-за которых слабая модель или новый разработчик могут сделать несовместимую реализацию.

Этот документ не заменяет ADR. Он конкретизирует их для реализации.

⸻

## Главные правила реализации

1. Источник истины

Source-of-truth слой:
	•	`events`
	•	`observations`
	•	`actions_log`
	•	`sensor_readings`
	•	`media_assets`
	•	`sop_definitions`
	•	`sop_triggers`
	•	`sop_runs`
	•	`sop_executions`
	•	`conversation_messages`

Derived слой:
	•	`daily_timelines`
	•	`sensor_snapshots`
	•	`environmental_daily_stats`
	•	`photo_analysis`
	•	`photo_timeline_signals`
	•	`ai_insights`
	•	`insight_grounding`
	•	`anomalies`
	•	`grow_memory_items`
	•	`causal_links`
	•	`daily_focus_cards`
	•	`searchable_documents`

Правило:
	•	source tables не должны silently перезаписываться AI-пайплайнами
	•	derived tables можно пересчитывать

2. Event spine обязателен

Если что-то произошло во времени и должно влиять на историю, AI, daily focus или отчёты, это должно иметь запись в `events`.

3. Scope first

Для всех операционных сценариев канонической адресацией является:
	•	`farm_id`
	•	`cycle_id`
	•	`scope_id`

`zone_id`, `plant_id`, `plant_group_id`, `site_id` являются shortcut-полями, но не заменяют `scope_id`.

4. LLM не пишет факты напрямую

LLM может:
	•	предложить структуру,
	•	сделать summary,
	•	сгенерировать hypothesis,
	•	подготовить report draft.

LLM не может:
	•	самостоятельно вставлять raw facts в source tables,
	•	обновлять status критичных сущностей без backend validation,
	•	смешивать hypothesis и факт в одной записи.

5. Raw first, then enrichment

Порядок записи:
	1. сохраняем raw input
	2. создаём event spine
	3. создаём специализированную source-запись
	4. запускаем derived enrichment jobs

⸻

## Naming Conventions

### Таблицы

Обязательные правила:
	•	имена таблиц во множественном числе: `events`, `reports`, `sensor_readings`
	•	snake_case only
	•	без префиксов `tbl_`, `app_`, `growlog_`
	•	join tables называются по смыслу, а не как случайный набор сущностей: `event_links`, `event_entities`, `insight_grounding`

### Колонки

Обязательные правила:
	•	primary key всегда `id`
	•	foreign key всегда `<entity>_id`
	•	время бизнес-события: `occurred_at`, `captured_at`, `due_at`, `completed_at`
	•	время записи в БД: `created_at`, `updated_at`
	•	флаги: `is_*` только для true/false семантики факта, например `is_deleted`, `is_user_confirmed`
	•	обычные boolean состояния без "is" допускаются только если это устоявшееся доменное слово: `active`
	•	JSON payload-поля заканчиваются на `_json`, кроме общего поля `payload`
	•	массивы id должны заканчиваться на `_ids`

### Enum-like поля

В MVP допускается `text + check constraint`.

Обязательные правила:
	•	значения enum-like полей только в lowercase snake_case
	•	никаких пробелов
	•	никаких camelCase значений

Примеры:
	•	`event_type = sensor_snapshot`
	•	`trigger_type = recurring_interval`
	•	`execution_status = partially_done`

### RPC и use case names

Для backend use cases принимается шаблон:
	•	`create_*` для записи новых фактов
	•	`update_*` только если сущность действительно mutable
	•	`generate_*` для производных артефактов
	•	`refresh_*` для derived слоя

Канонические имена:
	•	`create_log_entry`
	•	`create_sensor_reading`
	•	`create_media_asset`
	•	`create_sop_definition`
	•	`create_sop_run`
	•	`create_sop_execution`
	•	`create_ai_insight`
	•	`generate_report`

⸻

## Обязательные SQL-инварианты

Ниже перечислены не все возможные constraints, а те, которые считаются обязательными для совместимой реализации.

### Общие для большинства таблиц

Обязательные поля:
	•	`id uuid primary key default gen_random_uuid()`
	•	`created_at timestamptz not null default now()`
	•	`updated_at timestamptz not null default now()`

Обязательные правила:
	•	все FK должны иметь явный `references`
	•	все source tables должны иметь `farm_id not null`
	•	все derived tables должны иметь `farm_id not null`, кроме truly global knowledge tables

### `events`

Обязательные constraints:
	•	`event_type is not null`
	•	`source_type is not null`
	•	`occurred_at is not null`
	•	минимум один из context-полей должен присутствовать:
	•	`cycle_id is not null` или `scope_id is not null` или событие явно farm-wide

Обязательная логика:
	•	если `scope_id` задан, он должен принадлежать тому же `farm_id`
	•	если `cycle_id` и `scope_id` заданы одновременно, они не должны противоречить друг другу
	•	`event_type` должен принадлежать каноническому списку из `ADR-001`

Рекомендуемый partial rule:
	•	для операционных событий `scope_id` делать `not null`
	•	farm-wide события разрешать только для ограниченного списка, например `external_sync`, `report_generated`

### `observations`

Обязательные constraints:
	•	`event_id not null unique` только если выбрана модель "1 observation row = 1 extracted observation"
	•	если observations могут быть несколькими на одно событие, `unique(event_id)` не ставить
	•	`observation_type not null`

Выбор для Growlog AI:
	•	не ставить `unique(event_id)`, потому что из одного voice log может извлекаться несколько наблюдений

### `actions_log`

Обязательные constraints:
	•	`event_id not null`
	•	`action_type not null`
	•	`completed_at >= started_at`, если оба заполнены

### `sensor_readings`

Обязательные constraints:
	•	`captured_at not null`
	•	`value_numeric not null`
	•	минимум один из `device_id`, `metric_id`, `raw_payload` должен быть полезно заполнен

Обязательная реализационная норма:
	•	если reading используется в AI или daily focus, он должен быть адресуем по `scope_id`

### `media_assets`

Обязательные constraints:
	•	`storage_bucket not null`
	•	`storage_path not null`
	•	`media_type not null`
	•	`mime_type not null`

Уникальность:
	•	рекомендуется уникальность по `storage_bucket + storage_path`

### `sop_definitions`

Обязательные constraints:
	•	`title not null`
	•	`applies_to_scope not null`
	•	`instructions_json not null default '{}'`
	•	`required_inputs_after_execution not null default '[]'`
	•	`severity_if_missed not null`

### `sop_triggers`

Обязательные constraints:
	•	`sop_definition_id not null`
	•	`trigger_type not null`
	•	`trigger_config not null`

Обязательная логика:
	•	валидность `trigger_config` должна проверяться backend use case по `trigger_type`
	•	нельзя хранить один "универсальный" формат config без валидации

### `sop_runs`

Обязательные constraints:
	•	`sop_definition_id not null`
	•	хотя бы одно из:
	•	`due_at is not null`
	•	или `due_window_start is not null`
	•	`status not null`

Обязательная логика:
	•	если заданы `due_window_start` и `due_window_end`, то `due_window_end >= due_window_start`
	•	если `scope_id` задан, он должен соответствовать `farm_id`

### `sop_executions`

Обязательные constraints:
	•	`sop_run_id not null`
	•	`execution_status not null`
	•	`response_at not null`

Обязательная логика:
	•	`completed_at` обязателен для `done`
	•	`completed_at` должен быть null или позже `response_at`
	•	при `execution_status in ('blocked', 'skipped')` желательно требовать `notes` или `performer_feedback`

### `ai_insights`

Обязательные constraints:
	•	`insight_type not null`
	•	`body not null`
	•	`facts_json not null default '[]'`
	•	AI-таблица не может использоваться как замена `events`

Обязательная логика:
	•	каждый insight, влияющий на UI, должен иметь хотя бы одну запись в `insight_grounding`

### `reports`

Обязательные constraints:
	•	`report_type not null`
	•	`title not null`
	•	`status not null`

Обязательная логика:
	•	для `public_html` и `pdf` должен существовать хотя бы один `report_artifact`

⸻

## Канонический список `event_type`

Нельзя придумывать альтернативные имена в коде, сидерах и RPC.

Разрешённые значения:
	•	`note`
	•	`observation`
	•	`action_taken`
	•	`watering`
	•	`feeding`
	•	`pruning`
	•	`training`
	•	`transplant`
	•	`issue_detected`
	•	`pest_detected`
	•	`deficiency_suspected`
	•	`stage_changed`
	•	`harvest`
	•	`drying`
	•	`curing`
	•	`sensor_snapshot`
	•	`photo_capture`
	•	`sop_due`
	•	`sop_executed`
	•	`sop_missed`
	•	`ai_analysis`
	•	`report_generated`
	•	`conversation_turn`
	•	`external_sync`
	•	`anomaly`

Если нужен новый тип:
	1. сначала обновляется `ADR-001`
	2. затем `ADR-002`
	3. затем constraints, сиды и код

Нельзя:
	•	вводить локальные синонимы типа `photo_added`, `irrigation`, `issue`
	•	маппить одно и то же доменное действие на разные `event_type` в разных местах кода

⸻

## Канонический список `source_type`

Разрешённые значения:
	•	`user_text`
	•	`user_voice`
	•	`user_form`
	•	`sensor_api`
	•	`file_upload`
	•	`internal_system`
	•	`ai_generated`
	•	`imported`

Правило:
	•	`ai_generated` допустим только для derived- или narrative-сценариев
	•	raw human fact не должен сохраняться как `ai_generated`

⸻

## Рекомендуемый набор первых миграций

Имена миграций даны как рекомендация. Их можно адаптировать под формат Supabase migrations, но порядок должен остаться тем же.

### Foundation migrations

1. `0001_extensions_and_utilities.sql`
	•	`pgcrypto`
	•	trigger function для `updated_at`
	•	общие helper functions

2. `0002_farms_and_membership.sql`
	•	`farms`
	•	`farm_sites`
	•	`farm_zones`
	•	`farm_users`

3. `0003_grow_operations.sql`
	•	`grow_cycles`
	•	`plants`
	•	`plant_groups`
	•	`cycle_stage_history`

4. `0004_scopes.sql`
	•	`scopes`
	•	indexes on `farm_id`, `cycle_id`, `scope_type`, `parent_scope_id`

5. `0005_events.sql`
	•	`events`
	•	`event_links`
	•	`event_entities`
	•	первые check constraints на `event_type` и `source_type`

6. `0006_human_inputs.sql`
	•	`observations`
	•	`actions_log`

7. `0007_sensor_core.sql`
	•	`sensor_devices`
	•	`sensor_metrics`
	•	`sensor_readings`

8. `0008_media_core.sql`
	•	`media_assets`

9. `0009_sop_core.sql`
	•	`sop_documents`
	•	`sop_definitions`
	•	`sop_triggers`
	•	`sop_assignments`
	•	`sop_runs`
	•	`sop_executions`

10. `0010_reports_and_conversation.sql`
	•	`voice_sessions`
	•	`conversation_messages`
	•	`transcription_jobs`
	•	`reports`
	•	`report_artifacts`

### Product MVP migrations

11. `0011_ai_and_grounding.sql`
	•	`ai_insights`
	•	`insight_grounding`
	•	`anomalies`
	•	`grow_memory_items`
	•	`causal_links`
	•	`daily_focus_cards`

12. `0012_photo_intelligence_and_summaries.sql`
	•	`photo_analysis`
	•	`photo_timeline_signals`
	•	`daily_timelines`
	•	`sensor_snapshots`
	•	`environmental_daily_stats`

13. `0013_knowledge_and_retrieval.sql`
	•	`knowledge_sources`
	•	`knowledge_items`
	•	`searchable_documents`

14. `0014_publication_layer.sql`
	•	`publication_targets`
	•	`publication_jobs`

15. `0015_rls_policies.sql`
	•	RLS на все рабочие таблицы
	•	service-role access for jobs
	•	read policies через `farm_users`

⸻

## Обязательные индексы для первого прохода

### `events`
	•	`(farm_id, occurred_at desc)`
	•	`(cycle_id, occurred_at desc)`
	•	`(scope_id, occurred_at desc)`
	•	`(event_type, occurred_at desc)`
	•	`gin(tags)`

### `sensor_readings`
	•	`(farm_id, captured_at desc)`
	•	`(scope_id, captured_at desc)`
	•	`(metric_id, captured_at desc)`

### `media_assets`
	•	`(cycle_id, captured_at desc)`
	•	`(scope_id, captured_at desc)`
	•	`(media_type, captured_at desc)`

### `sop_runs`
	•	`(farm_id, coalesce(due_at, due_window_start))`
	•	`(scope_id, coalesce(due_at, due_window_start))`
	•	`(status, coalesce(due_at, due_window_start))`

### `ai_insights`
	•	`(farm_id, created_at desc)`
	•	`(scope_id, created_at desc)`
	•	`(insight_type, created_at desc)`

### `searchable_documents`
	•	`(farm_id, doc_type)`
	•	`(cycle_id)`
	•	`(scope_id)`

⸻

## Backend boundary

### Что может делать клиент

Клиент может:
	•	загружать файл в Storage
	•	вызывать Edge Function / RPC
	•	читать разрешённые данные через RLS

Клиент не должен:
	•	писать напрямую в несколько связанных таблиц руками
	•	сам синхронизировать `events` и доменные таблицы
	•	сам выбирать derived side-effects

### Что делает backend use case

Каждый write use case обязан:
	•	валидировать membership и доступ к `farm_id`
	•	валидировать согласованность `farm_id`, `cycle_id`, `scope_id`
	•	создать или не создать `events` по доменному правилу
	•	создать специализированную запись
	•	создать `event_entities`, если нужны связи
	•	вернуть стабильный payload ответа

### Где реализовывать

Рекомендуемый вариант:
	•	thin client
	•	Supabase Edge Functions для orchestration
	•	SQL/RPC для простых атомарных операций
	•	background jobs для derived refresh

⸻

## Канонические write contracts

Ниже описан минимальный контракт. Реальные JSON payloads могут включать дополнительные поля, но не должны нарушать эту структуру.

### 1. `create_log_entry`

Назначение:
	•	создать human log entry
	•	создать `events`
	•	опционально создать `observations` и/или `actions_log`

Минимальный input:

```json
{
  "farm_id": "uuid",
  "cycle_id": "uuid",
  "scope_id": "uuid",
  "occurred_at": "2026-03-22T10:30:00Z",
  "source_type": "user_voice",
  "raw_text": "Сегодня листья повисли, дал 2 литра воды",
  "event_type_hint": "watering",
  "observations": [
    {
      "observation_type": "vigor",
      "value_text": "leaves drooping"
    }
  ],
  "actions": [
    {
      "action_type": "watering",
      "parameters": {
        "water_liters": 2
      }
    }
  ]
}
```

Обязательная валидация:
	•	`farm_id`, `cycle_id`, `scope_id` согласованы
	•	`source_type` в каноническом списке
	•	`occurred_at` не пустой
	•	если есть `actions`, `event_type` должен быть совместим с действием

Шаги:
	1. создать `events`
	2. для каждого extracted observation создать `observations`
	3. для каждого action создать `actions_log`
	4. связать сущности через `event_id`
	5. поставить задачу на enrichment

Output:

```json
{
  "event_id": "uuid",
  "observation_ids": ["uuid"],
  "action_ids": ["uuid"],
  "status": "created"
}
```

### 2. `create_sensor_reading`

Назначение:
	•	сохранить reading
	•	при необходимости создать `sensor_snapshot` event

Минимальный input:

```json
{
  "farm_id": "uuid",
  "cycle_id": "uuid",
  "scope_id": "uuid",
  "captured_at": "2026-03-22T10:35:00Z",
  "metric_code": "temp_air",
  "value_numeric": 25.4,
  "unit": "C",
  "ingestion_source": "sensor_api",
  "device_id": "uuid"
}
```

Обязательная валидация:
	•	метрика валидна
	•	unit согласован с metric
	•	device принадлежит той же ферме

Шаги:
	1. создать `sensor_readings`
	2. при пакетной записи разрешается не создавать отдельный event на каждый reading
	3. если reading важен для timeline, создать или обновить событие `sensor_snapshot`

### 3. `create_media_asset`

Назначение:
	•	зарегистрировать уже загруженный файл
	•	создать событие `photo_capture` или иное медиа-событие при необходимости

Минимальный input:

```json
{
  "farm_id": "uuid",
  "cycle_id": "uuid",
  "scope_id": "uuid",
  "storage_bucket": "growlog-media",
  "storage_path": "farm/2026/03/22/photo-1.jpg",
  "media_type": "image",
  "mime_type": "image/jpeg",
  "captured_at": "2026-03-22T10:40:00Z"
}
```

Шаги:
	1. создать `media_assets`
	2. если `media_type = image`, создать `photo_capture` event
	3. поставить job на `photo_analysis`

### 4. `create_sop_definition`

Назначение:
	•	создать SOP definition и связанные trigger rows

Минимальный input:

```json
{
  "farm_id": "uuid",
  "title": "Daily runoff check",
  "applies_to_scope": "reservoir",
  "instructions_json": {
    "steps": [
      "Measure runoff EC",
      "Record runoff pH"
    ]
  },
  "required_inputs_after_execution": [
    "runoff_ec",
    "runoff_ph",
    "evidence_photo"
  ],
  "severity_if_missed": "high",
  "triggers": [
    {
      "trigger_type": "recurring_daily",
      "trigger_config": {
        "local_time": "09:00"
      }
    }
  ]
}
```

Шаги:
	1. создать `sop_definitions`
	2. создать все `sop_triggers`
	3. валидировать `trigger_config` по типу триггера

### 5. `create_sop_run`

Назначение:
	•	создать конкретный ожидаемый запуск SOP
	•	создать событие `sop_due`

Минимальный input:

```json
{
  "farm_id": "uuid",
  "cycle_id": "uuid",
  "scope_id": "uuid",
  "sop_definition_id": "uuid",
  "trigger_id": "uuid",
  "due_at": "2026-03-22T09:00:00Z",
  "priority": "high",
  "reason_text": "Daily recurring SOP"
}
```

Шаги:
	1. создать `sop_runs`
	2. создать `sop_due` event
	3. при необходимости обновить derived daily focus

### 6. `create_sop_execution`

Назначение:
	•	зафиксировать исполнение, пропуск или блокировку SOP
	•	создать `sop_executed` или `sop_missed`

Минимальный input:

```json
{
  "farm_id": "uuid",
  "scope_id": "uuid",
  "sop_run_id": "uuid",
  "execution_status": "done",
  "response_at": "2026-03-22T09:12:00Z",
  "completed_at": "2026-03-22T09:12:00Z",
  "measured_values": {
    "runoff_ec": 1.8,
    "runoff_ph": 6.1
  },
  "performer_feedback": "All values within normal range"
}
```

Шаги:
	1. проверить, что `sop_run_id` существует и относится к этой ферме
	2. создать `sop_executions`
	3. обновить `sop_runs.status`
	4. создать `sop_executed` или `sop_missed` event
	5. если есть evidence media ids, создать `event_entities`

### 7. `create_ai_insight`

Назначение:
	•	сохранить структурированный AI output как derived артефакт

Минимальный input:

```json
{
  "farm_id": "uuid",
  "cycle_id": "uuid",
  "scope_id": "uuid",
  "insight_type": "recommendation",
  "body": "Check runoff EC today because the last two waterings reduced vigor.",
  "facts_json": [
    {"source_type": "event", "source_id": "uuid"},
    {"source_type": "sensor_reading", "source_id": "uuid"}
  ],
  "confidence": 0.72
}
```

Обязательная логика:
	•	если insight показывается пользователю, создать `insight_grounding`
	•	если insight не нужен как артефакт истории, его можно не сохранять

### 8. `generate_report`

Назначение:
	•	создать report row и artifacts

Минимальный input:

```json
{
  "farm_id": "uuid",
  "cycle_id": "uuid",
  "scope_id": "uuid",
  "report_type": "public_html",
  "title": "Week 5 Flower Report",
  "period_start": "2026-03-15T00:00:00Z",
  "period_end": "2026-03-22T00:00:00Z"
}
```

Шаги:
	1. собрать контекст
	2. создать `reports`
	3. создать artifact rows в `report_artifacts`
	4. создать `report_generated` event

⸻

## Ошибки и коды отказа

Все backend use cases должны возвращать machine-readable code.

Минимальный словарь:
	•	`farm_not_found`
	•	`access_denied`
	•	`cycle_scope_mismatch`
	•	`invalid_scope`
	•	`invalid_event_type`
	•	`invalid_source_type`
	•	`invalid_trigger_type`
	•	`invalid_trigger_config`
	•	`sop_run_not_found`
	•	`invalid_execution_status`
	•	`report_generation_failed`
	•	`validation_error`

Нельзя возвращать только свободный текст без кода.

⸻

## Derived jobs, которые должны существовать с самого начала

Даже если их первая версия будет простой, эти jobs нужно проектировать как отдельные процессы.

Обязательные jobs:
	•	`refresh_daily_timeline_for_scope`
	•	`refresh_sensor_snapshot_for_scope`
	•	`enqueue_photo_analysis`
	•	`generate_due_sop_runs`
	•	`refresh_daily_focus`
	•	`upsert_searchable_document`

Правило:
	•	jobs не должны писать raw fact tables, кроме тех случаев, где это явно предусмотрено системным use case

⸻

## RLS implementation minimum

Минимальная политика:
	•	пользователь видит записи только тех `farm_id`, где он присутствует в `farm_users`
	•	manager/admin могут иметь более широкие read права
	•	write доступ только через разрешённые use cases или ограниченный набор insert policies
	•	public report artifacts должны публиковаться отдельно, не через ослабление RLS на внутренних таблицах

Рекомендация:
	•	на первых итерациях критичные write-операции вести через Edge Functions с service role
	•	но сами Edge Functions обязаны повторять доменные проверки, а не просто обходить их

⸻

## Что должен сделать первый разработчик

Если проект поднимается с нуля, безопасный порядок такой:
	1. Реализовать foundation migrations.
	2. Настроить `updated_at` triggers.
	3. Настроить RLS на `farms`, `farm_users`, `grow_cycles`, `scopes`, `events`.
	4. Реализовать `create_log_entry`.
	5. Реализовать `create_media_asset`.
	6. Реализовать `create_sop_definition`, `create_sop_run`, `create_sop_execution`.
	7. Реализовать `create_sensor_reading`.
	8. Только после этого подключать AI-derived слой.

Причина:
	•	если журнал и scope layer сделаны плохо, потом придётся ломать retrieval, SOP и reports

⸻

## Что считается несовместимой реализацией

Следующие решения считаются нарушением архитектуры:
	•	клиент пишет напрямую и в `events`, и в `observations`, и в `actions_log`
	•	разные части кода используют разные словари `event_type`
	•	`scope_id` игнорируется, а всё строится только вокруг `zone_id`
	•	SOP моделируется как просто чеклист без `sop_runs`
	•	AI summary сохраняется в raw event как будто это факт пользователя
	•	public pages отдаются прямым доступом к внутренним таблицам

⸻

## Короткая формулировка

Implementation spec фиксирует, как именно строить data platform Growlog AI: через event spine, канонический scope layer, строгие write use cases, валидируемые SOP runs, совместимый словарь событий и отделение raw facts от AI-derived слоя.
