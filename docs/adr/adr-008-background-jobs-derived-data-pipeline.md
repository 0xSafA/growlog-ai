ADR-008: Growlog AI — Background Jobs and Derived Data Pipeline

Статус: Proposed
Дата: 2026-03-22
Автор: A. Safiulin, OG Lab.
Связан с: ADR-001, ADR-002, ADR-003, ADR-004, ADR-005, ADR-006, ADR-007, ADR-009, ADR-010

---

## Зачем нужен этот ADR

Этот ADR фиксирует операционный каркас Growlog AI:

- что разрешено делать в синхронном request path;
- что обязано уходить в фоновые jobs;
- какие данные считаются `raw`, `enriched`, `derived`, `published`;
- как гарантировать, что derived layer можно безопасно пересчитать;
- как не потерять задания между raw write и async execution;
- какие контракты обязан соблюдать implementation, чтобы `ADR-003`..`ADR-007` работали предсказуемо.

Этот документ должен быть пригоден не только как архитектурное описание, но и как implementation contract. Если реализация противоречит этому ADR, нужно либо менять код, либо обновлять ADR явно.

---

## Контекст

Growlog AI уже определён как система, которая:

- сохраняет farm history через `events` и связанные source-of-truth таблицы;
- использует retrieval-first сбор контекста (`ADR-003`);
- строит trust-aware AI outputs (`ADR-004`);
- поддерживает SOP engine с каноническими `sop_runs` и `sop_executions` (`ADR-006`);
- формирует `daily_focus_cards`, `reports`, `report_artifacts`;
- работает в мультитенантной модели с `farm_id` как tenant boundary (`ADR-009`);
- выполняет photo intelligence как отдельный versioned pipeline (`ADR-010`).

Большая часть ценности продукта возникает не в момент сохранения raw записи, а позже, когда система:

- обогащает raw записи;
- пересчитывает snapshots и daily aggregates;
- строит anomalies, insights, memory;
- обновляет retrieval-friendly представления;
- генерирует отчёты и публикационные артефакты.

Если всё это делать прямо в пользовательском запросе, система будет хрупкой, медленной и плохо масштабируемой. Если не определить derived pipeline явно, начнётся дрейф терминов, ownership и консистентности.

---

## Связь с другими ADR

- `ADR-001` задаёт продуктовую логику: timeline spine, AI поверх данных, а не вместо данных.
- `ADR-002` задаёт канонические сущности и разделение на source / derived / publication layers.
- `ADR-003` требует, чтобы retrieval читал согласованные snapshots, summaries и searchable representations.
- `ADR-004` требует, чтобы AI pipeline был grounded, confidence-aware и не путал raw facts с hypotheses.
- `ADR-005` требует быстрый UX и детерминированные статусы async-обработки.
- `ADR-006` требует детерминированный engine для `sop_runs`, overdue и compliance.
- `ADR-007` требует multi-stage report pipeline и отдельный sanitization/publish layer.
- `ADR-009` требует farm-scoped execution даже для service-role workers.
- `ADR-010` требует отдельные enrichment и derived стадии для фото.

Без этого ADR остальные документы отвечают на вопрос "что должно существовать", но не отвечают на вопрос "как это безопасно и воспроизводимо исполнять".

---

## Решение

Мы принимаем архитектуру:

`event-driven background jobs + rebuildable derived data pipeline`

Это означает:

1. `raw` сохраняется быстро, синхронно и является источником истины.
2. `enriched` и `derived` по умолчанию считаются асинхронными результатами.
3. Дорогие AI-операции почти всегда выполняются в фоне.
4. Derived layer проектируется как `recomputable` и по возможности `rebuildable`.
5. Request path обязан не только сохранить raw, но и `durably` зафиксировать follow-up work.
6. Jobs обязаны быть tenant-scoped, idempotent, observable и безопасными к retry.
7. UX обязан показывать состояние async processing, а не делать вид, что derived already fresh.

---

## Нормативные принципы

Ниже `MUST` означает обязательное правило реализации.

- Raw first, derived second.
- User writes must stay fast.
- Derived may be briefly stale; derived must not be silently corrupted.
- Rebuild must never mutate canonical raw history.
- Workers MUST enforce `farm_id`, `cycle_id`, `scope_id` rules from `ADR-002`/`ADR-009`.
- Jobs MUST be safe to retry.
- Jobs SHOULD have one primary responsibility.
- AI jobs MUST NOT directly писать source-of-truth operational tables.
- Public publish flows MUST go through sanitization, never through direct exposure of internal tables.

---

## Канонические термины

Этот ADR использует только термины из принятых ADR.

### Raw data

К raw layer относятся source-of-truth записи, например:

- `events`
- `sensor_readings`
- `media_assets`
- `sop_runs`
- `sop_executions`
- `conversation_messages`
- `reports` как пользовательский запрос/черновик сущности отчёта
- другие source tables из `ADR-002`

Правило: если что-то произошло во времени, оно должно быть отражено через `events` или documented canonical source table, а не через ad-hoc derived substitute.

### Enriched data

Enrichment добавляет смысл к конкретной source record и остаётся привязанным к ней и к версии модели/правил.

Примеры:

- `photo_analysis`
- уточняющие classification/extraction outputs для `events` или `conversation_messages`
- вспомогательные grounding/building blocks, привязанные к конкретному источнику

### Derived data

Derived layer строит агрегаты, slices или интерпретации по scope / времени.

Ключевые derived таблицы:

- `daily_timelines`
- `sensor_snapshots`
- `environmental_daily_stats`
- `photo_timeline_signals`
- `anomalies`
- `ai_insights`
- `insight_grounding`
- `grow_memory_items`
- `daily_focus_cards`
- `searchable_documents`
- `report_artifacts`
- `sop_compliance_daily`

### Published data

Published layer - это внешние или public-facing артефакты, прошедшие отдельный publish/sanitization flow.

Примеры:

- public HTML report
- exported PDF
- publication target payloads

---

## Что именно должно делать request path

Синхронный слой нужен только для следующих задач:

1. аутентификация и авторизация;
2. валидация input;
3. разрешение `farm_id`, `cycle_id`, `scope_id`;
4. сохранение raw data;
5. `durable enqueue` follow-up work;
6. возврат ответа вида "raw сохранён".

Request path НЕ должен:

- ждать фотоанализа;
- ждать anomaly reasoning;
- ждать full insight generation;
- ждать report rendering;
- ждать publish flow;
- пересчитывать большие исторические агрегаты;
- вызывать длинные AI-цепочки, если без них можно завершить сохранение.

Короткое правило:

`request path = validate -> write raw -> durably enqueue -> return`

---

## Durable enqueue: обязательное правило против "потерянных jobs"

Самая опасная ошибка слабой реализации - сохранить raw запись, но потерять фоновые задачи из-за падения между commit и enqueue.

Поэтому implementation MUST соблюдать одно из двух:

1. `preferred`: raw write и enqueue/outbox row фиксируются в одной транзакции БД;
2. `acceptable`: если очередь внешняя и не транзакционная, request path обязан сначала записать durable outbox / pending-work marker в доверенное хранилище, и только потом подтверждать успех пользователю.

Запрещённый паттерн:

- сохранить raw;
- потом fire-and-forget вызвать внешнюю очередь;
- при ошибке всё равно вернуть success без durable recovery path.

Следствие:

- если worker недоступен, raw может быть сохранён, но follow-up work должен остаться видимым и подъёмным через retry/outbox drain;
- rebuild/manual repair работает как safety net, но не как основной механизм.

---

## Классы jobs

Система поддерживает четыре класса задач.

### 1. Event-triggered

Запускаются из значимого изменения source data.

Примеры:

- создан `events` -> обновить `searchable_documents`, `daily_timelines`, запланировать `focus.refresh`;
- загружен `media_assets` -> `photo.analyze`;
- записан `sensor_readings` -> threshold check и refresh affected snapshot;
- обновился `sop_runs` -> refresh `daily_focus_cards`.

### 2. Batch

Считают накопившиеся данные пачкой.

Примеры:

- hourly refresh `sensor_snapshots`;
- daily aggregation `environmental_daily_stats`;
- batched `photo_timeline_signals`;
- batched `anomaly.scan`.

### 3. Scheduled

Запускаются по cron/расписанию.

Примеры:

- morning `focus.refresh`;
- overdue scanner для `sop_runs`;
- nightly `sop_compliance_daily`;
- scheduled manager/daily reports.

### 4. Manual / administrative rebuild

Используются для backfill, repair и version upgrades.

Примеры:

- rebuild `daily_timelines` for cycle/date;
- rerun `photo.analyze` after model upgrade;
- regenerate `report_artifacts`;
- backfill `grow_memory_items`.

---

## Trigger policy

Не каждое изменение должно порождать дорогую работу. Мы принимаем триггерную политику из трёх уровней.

### Level 1: immediate lightweight

Можно запускать почти всегда:

- `document.index` / upsert в `searchable_documents`;
- лёгкий refresh `daily_timelines`;
- threshold checks;
- affected-scope recalculation для `sop_runs`;
- refresh marker для `sensor_snapshots`.

### Level 2: deferred medium

Запускаются с debounce/coalescing:

- `focus.refresh`;
- contextual summary refresh;
- `insight.generate` для scope/day;
- `photo_timeline_signals` recomputation;
- non-critical anomaly scan.

### Level 3: heavy AI / heavy rebuild

Только при явном поводе:

- large-scale causal reasoning;
- cross-cycle memory mining;
- full report generation/render;
- story-like derived blocks;
- global or large-scope rebuild.

Правило: Level 1 не должен зависеть от успешного завершения Level 2 или Level 3, если это не требуется детерминированной доменной логикой.

---

## Priority classes

Очередь должна поддерживать приоритеты.

### Critical

- threshold anomaly checks;
- critical `sop_runs` generation / overdue transition;
- essential media follow-up, без которого запись повисает в "processing";
- high-severity `focus.refresh`.

### High

- `photo.analyze` для только что загруженного изображения;
- `report.generate` по прямому запросу пользователя;
- due/follow-up jobs для `sop_runs`.

### Normal

- `daily_timelines` refresh;
- `searchable_documents` update;
- non-critical `insight.generate`;
- daily aggregates для активного scope.

### Low

- cross-cycle `grow_memory_items`;
- reindexing;
- archival artifact regeneration;
- bulk rebuilds.

---

## Job contract

Технология очереди может быть любой, но каждая job-запись концептуально MUST содержать следующие поля:

- `id`
- `job_type`
- `status`
- `priority`
- `farm_id`
- `cycle_id` nullable
- `scope_id` nullable
- `entity_type` nullable
- `entity_id` nullable
- `scheduled_for`
- `dedup_key`
- `correlation_id`
- `payload_json`
- `attempt_count`
- `last_error`
- `created_at`
- `started_at`
- `finished_at`

### Обязательные свойства payload

Каждый handler должен получать достаточно контекста, чтобы не гадать:

- какой tenant обрабатывается (`farm_id`);
- какой operational scope затронут (`cycle_id`, `scope_id`, дата/окно);
- какой source object породил job (`entity_type`, `entity_id`);
- какая причина запуска (`trigger_reason`);
- какая версия правил/модели ожидается (`pipeline_version`, если релевантно).

Слабая реализация часто делает payload "слишком общим". Это запрещено. Если worker вынужден "посмотреть всю ферму и догадаться", payload спроектирован плохо.

---

## Job state model

Поддерживаются статусы:

- `pending`
- `running`
- `succeeded`
- `failed`
- `retrying`
- `cancelled`
- `stale`

### Смысл `stale`

`stale` означает: job был валиден при постановке в очередь, но к моменту старта уже устарел, потому что:

- тот же scope уже был пересчитан более свежим job;
- появился более новый input;
- дедупликация решила, что полезнее пропустить старый запуск.

`stale` не считается аварией и не должен засорять alerting как `failed`.

---

## Idempotency contract

Все handlers MUST быть идемпотентными.

Это означает:

- повторный запуск не ломает данные;
- retry допустим без ручной чистки;
- blind insert запрещён там, где мы пересчитываем "текущее состояние";
- если нужен history trail, версия должна быть явной, а не случайной.

Рекомендуемые паттерны:

- upsert по естественному ключу;
- replace current active row;
- recompute-for-slice, а не patch-from-memory;
- versioned enrichment by `(source_id, pipeline_version)`.

Примеры:

- `searchable_documents` -> upsert by `(doc_type, source_id)`;
- `environmental_daily_stats` -> replace aggregate for `(scope_id, stat_date, metric)`;
- `daily_timelines` -> recompute for `(scope_id, timeline_date)`;
- `photo_analysis` -> versioned output for `(media_asset_id, analysis_version)`;
- `daily_focus_cards` -> replace current card for affected scope/time window.

---

## Coalescing and deduplication

Система MUST защищаться от job storms.

Примеры типовых всплесков:

- 100 `sensor_readings` за 5 минут;
- 5 событий подряд в одном scope;
- несколько изменений одного отчёта перед рендером;
- серия фото одной зоны за короткое время.

### Правила

Перед выполнением job handler обязан уметь ответить на три вопроса:

1. Есть ли уже активный job этого типа для того же scope/window?
2. Не был ли нужный slice уже пересчитан позже?
3. Не устарел ли текущий запуск относительно нового source input?

### Практический шаблон dedup key

`dedup_key = job_type + farm_id + scope_id + logical_window`

Примеры `logical_window`:

- конкретная дата для `timeline.daily.refresh`;
- `(scope_id, hour)` для snapshot refresh;
- `(report_id, artifact_type)` для render;
- `(scope_id, focus_window)` для `focus.refresh`.

Back-pressure обязателен: при всплесках нагрузки Level 2/3 jobs могут откладываться, но Critical jobs не должны голодать.

---

## Ordering и зависимости

Глобальный порядок всех событий фермы не требуется. Нужен частичный порядок по scope.

### Правило ordering

Внутри одного affected scope агрегирующие handlers должны уметь опираться на:

- `occurred_at`
- `captured_at`
- `created_at`
- явный date/window slice

### Допустимые зависимости

Зависимости должны быть короткими, явными и локальными.

Примеры:

- `photo.analyze` -> затем `photo.timeline.refresh`;
- `sop_runs` update -> затем `focus.refresh`;
- `stats.daily.aggregate` -> затем scheduled report blocks;
- `report.generate` -> затем `report.render.html` / `report.render.pdf`;
- public-oriented report -> затем `report.publish`.

Запрещён анти-паттерн длинной хрупкой цепочки, где failure мелкого шага блокирует всю систему.

---

## Ownership matrix: кто обновляет derived tables

Ниже фиксируется ownership derived outputs. Это нужно, чтобы implementation не дублировал ответственность между несколькими handlers.

| Output | Источник | Кто обновляет | Когда |
| --- | --- | --- | --- |
| `sensor_snapshots` | `sensor_readings` | `snapshot.refresh` | lightweight event-triggered + hourly consistency rebuild |
| `environmental_daily_stats` | `sensor_readings` | `stats.daily.aggregate` | nightly + manual backfill |
| `daily_timelines` | `events` и связанные source rows | `timeline.daily.refresh` | event-triggered incremental + nightly consistency rebuild |
| `photo_analysis` | `media_assets` | `photo.analyze` | on upload + manual rerun on model upgrade |
| `photo_timeline_signals` | `photo_analysis`, `media_assets` | `photo.timeline.refresh` | batched after analysis + manual rebuild |
| `anomalies` | sensors, photos, SOP, events | `anomaly.scan` | threshold-triggered + periodic scan + manual diagnostic rerun |
| `ai_insights` + `insight_grounding` | assembled context from `ADR-003` | `insight.generate` | on-demand, scheduled, or selective event-triggered |
| `grow_memory_items` | history across events/insights/outcomes | `memory.mine` | nightly/end-of-cycle/manual rebuild |
| `daily_focus_cards` | `sop_runs`, anomalies, snapshots, insights | `focus.refresh` | key-event-triggered + scheduled morning refresh |
| `report_artifacts` | `reports` + structured blocks | `report.render.*` | after `report.generate` or regeneration request |
| `searchable_documents` | source and selected derived summaries | `document.index` / `reindex.searchable_documents` | on relevant change + periodic reindex |
| `sop_compliance_daily` | `sop_runs`, `sop_executions` | `compliance.daily.aggregate` | scheduled + manual rebuild |

Если одна и та же таблица может обновляться разными путями, один путь должен быть признан canonical owner, а остальные должны лишь enqueue тот же canonical handler.

---

## Канонические pipeline-направления

### 1. Event ingestion pipeline

Когда создаётся событие:

1. request path валидирует tenant/scope;
2. пишет `events` и связанные canonical source rows;
3. durably enqueue:
   - `document.index`
   - `timeline.daily.refresh`
   - optional `focus.refresh`
   - optional SOP evaluation for affected scope
   - optional `insight.generate.trigger`

Важно: дорогое reasoning не стартует автоматически на каждый event. Сначала trigger evaluation, потом coalesced heavy work.

### 2. Sensor pipeline

Когда приходят `sensor_readings`:

1. request path сохраняет raw reading;
2. Level 1 handler проверяет thresholds и помечает affected snapshot slice;
3. `snapshot.refresh` обновляет current snapshot;
4. `stats.daily.aggregate` считает дневные агрегаты batch/scheduled способом;
5. `anomaly.scan` и `focus.refresh` используют уже обновлённый environmental layer.

### 3. Photo pipeline

Когда загружается `media_assets`:

1. request path пишет raw media metadata;
2. enqueue `photo.analyze`;
3. `photo.analyze` создаёт versioned `photo_analysis`;
4. после этого может идти `photo.timeline.refresh` для `photo_timeline_signals`;
5. anomalies / insights / reports читают только completed and relevant visual enrichments.

Правило из `ADR-010`: фото не должно порождать "диагноз как факт". Визуальные сигналы остаются hypotheses/signals, пока не подкреплены остальным контекстом.

### 4. SOP pipeline

Когда меняется расписание, stage, relevant event или результат исполнения:

1. handler детерминированно решает, нужны ли новые/изменённые `sop_runs`;
2. engine обновляет `sop_runs`;
3. enqueue `focus.refresh`;
4. overdue scanner и compliance aggregation работают отдельно, но по тем же каноническим `sop_runs`/`sop_executions`;
5. derived outputs никогда не подменяют engine state.

Термин `due item` допустим только как продуктовый синоним. Канонический объект реализации - `sop_runs`.

### 5. Insight pipeline

Когда появляется значимый новый контекст:

- аномалия;
- stage transition;
- важное изменение в `sop_runs`;
- новый visual signal;
- запрос пользователя;
- scheduled summary window.

Тогда:

1. trigger layer решает, нужен ли `insight.generate`;
2. retrieval/context assembly идёт по `ADR-003`;
3. job строит insight object по `ADR-004`;
4. если persistence policy разрешает - записывает `ai_insights` и `insight_grounding`;
5. если нет - результат может остаться ephemeral и не засорять derived layer.

Слабая реализация часто пишет AI output сразу в `ai_insights` без grounding/persistence checks. Это запрещено.

### 6. Report pipeline

Когда пользователь или scheduler инициирует отчёт:

1. создаётся/обновляется `reports`;
2. enqueue `report.generate`;
3. `report.generate` собирает structured blocks и metadata;
4. enqueue `report.render.html` и/или `report.render.pdf`;
5. public-oriented outputs идут в `report.publish` только после sanitization;
6. failure одного artifact не должен разрушать весь report entity.

---

## Контракт для AI- и report-jobs

Чтобы слабая реализация не смешала слои, фиксируются отдельные правила.

### Для `insight.generate`

Handler MUST:

- использовать assembled context из `ADR-003`, а не "самостоятельный поиск по базе как получится";
- разделять `facts`, `interpretation`, `hypotheses`, `recommendation`, `missing_data`, `confidence`;
- запрещать strong recommendation без нужного evidence/trust gate;
- записывать `insight_grounding`, если insight persisted;
- не писать raw operational facts в source tables.

### Для `report.generate` / `report.render.*`

Handlers MUST:

- разделять request validation, block assembly, narrative, render и publish;
- сохранять lineage от `reports` к `report_artifacts`;
- поддерживать partial failure;
- для public outputs проходить sanitization перед publication;
- не публиковать внутренние таблицы напрямую.

---

## Freshness model

Derived outputs имеют разную ожидаемую свежесть.

### Near-real-time

Должно обновляться почти сразу:

- threshold breaches;
- critical `sop_runs` changes;
- critical anomalies;
- lightweight `focus.refresh` marker/state.

### Short-delay acceptable

Допустима небольшая задержка:

- `daily_timelines`;
- non-critical `ai_insights`;
- `searchable_documents`;
- batched `photo_timeline_signals`.

### Periodic

Можно считать по расписанию:

- `environmental_daily_stats`;
- `grow_memory_items`;
- manager reports;
- cross-cycle pattern mining.

---

## Eventual consistency model

Для derived layer принимается:

`eventual consistency with explicit UX states`

Это означает:

- raw write должен быть надёжным и мгновенно видимым там, где это важно;
- derived может догонять позже;
- пользователь не должен терять ввод из-за падения вторичного handler;
- UI должен честно показывать состояние перерасчёта.

Рекомендуемые user-facing состояния:

- `saved`
- `processing`
- `refreshed`
- `failed`
- `needs re-run`

---

## Failure handling

Система проектируется с ожиданием регулярных сбоев jobs.

### Обязательные правила

1. Ошибка derived job не ломает raw ingestion.
2. Retry - стандартный путь, а не исключение.
3. Повторяющиеся ошибки должны быть диагностируемыми.
4. Failure локализуется по scope / entity, а не валит весь pipeline.
5. Dead-letter / poison jobs не откатывают raw history.

### Примеры

- `photo.analyze` failed -> `media_assets` остаётся валидным raw, у анализа статус `failed`.
- `report.render.pdf` failed -> `reports` и HTML artifact могут быть валидны, PDF отдельно `failed`.
- rebuild для одного `cycle_id` failed -> другие циклы не блокируются.

---

## Rebuild strategy

Derived layer считается rebuildable, значит implementation MUST поддерживать пересчёт как штатный сценарий, а не emergency hack.

### Виды rebuild

- per event
- per date
- per scope
- per cycle
- per report
- full backfill

### Когда rebuild обязателен

- после schema migration, меняющей derived logic;
- после смены AI model/prompt/rules version;
- после обнаружения bug в aggregation/enrichment;
- после массового импорта истории;
- после изменений доменных правил.

### Главный принцип

Rebuild обновляет `enriched`/`derived`/`published` outputs и не меняет raw truth.

---

## Безопасность и мультитенантность

Даже если worker работает с service role, он MUST исполняться в farm-scoped контексте.

Обязательные правила:

- у каждой job есть `farm_id`;
- worker проверяет допустимость `cycle_id`/`scope_id` внутри этого tenant;
- handler не должен "читать всю базу" без фильтра по tenant;
- cross-farm batch допустим только как отдельный admin/maintenance сценарий;
- public publication идёт только через publish/sanitization flow из `ADR-007`;
- service role не отменяет доменные инварианты из `ADR-002` и `ADR-009`.

---

## Observability

Минимальный production-ready pipeline должен иметь:

- метрики: queue depth, queue age, success/fail rate by `job_type`, retry count;
- структурированные логи: `farm_id`, `cycle_id`, `scope_id`, `job_type`, `attempt_count`, `correlation_id`;
- alerting по росту dead-letter и repeated failures для Critical jobs;
- явные таймауты для долгих AI jobs;
- audit trail, позволяющий объяснить, почему конкретный derived output появился или не появился.

`correlation_id` рекомендуется пробрасывать от request/raw event к downstream jobs и artifact statuses.

---

## Implementation shape

Конкретный vendor/tool не фиксируется, но shape реализации должен быть примерно таким:

1. API/server routes:
   - validate auth + scope;
   - write raw;
   - durably enqueue follow-up work.

2. Background workers:
   - dispatch by `job_type`;
   - perform scoped reads;
   - upsert/recompute owned outputs;
   - mark status and errors.

3. Scheduler/cron layer:
   - запускает periodic jobs;
   - поднимает overdue/compliance/report windows;
   - дренирует rebuild workflows.

4. Administrative rebuild commands:
   - rerun per scope/date/cycle/report;
   - do backfill;
   - requeue stale/failed work.

Для текущего стека вероятный shape:

- Next.js routes/actions
- Supabase/Postgres
- отдельный worker/job runner
- cron/scheduled functions

Но выбор конкретной очереди или движка остаётся за implementation docs.

---

## Recommended job families

Ниже рекомендуемый словарь job types. Его можно расширять, но не стоит ломать именование без причины.

### Ingestion / normalization

- `event.normalize`
- `conversation.parse`
- `sensor.ingest.validate`
- `media.prepare`

### Enrichment

- `photo.analyze`
- `event.enrich`
- `document.index`

### Aggregation

- `snapshot.refresh`
- `stats.daily.aggregate`
- `timeline.daily.refresh`
- `compliance.daily.aggregate`
- `photo.timeline.refresh`

### Intelligence

- `anomaly.scan`
- `insight.generate`
- `focus.refresh`
- `memory.mine`
- `causal.rebuild`

### Reports

- `report.generate`
- `report.render.html`
- `report.render.pdf`
- `report.publish`

### Maintenance

- `reindex.searchable_documents`
- `rebuild.derived.scope`
- `backfill.cycle`
- `cleanup.stale_jobs`

---

## Implementation checklist

Эта секция специально написана так, чтобы даже слабая модель могла выполнить реализацию по шагам без архитектурного дрейфа.

### Шаг 1. Ввести единый enqueue API

Нужен один trustable путь постановки задач:

- принимает `job_type`, tenant/scope, payload, priority, dedup key;
- записывает durable job/outbox entry;
- не даёт анонимно ставить jobs в обход domain checks.

### Шаг 2. Реализовать worker dispatcher

Нужен единый dispatcher:

- выбирает handler по `job_type`;
- переводит status `pending -> running -> succeeded/failed/stale`;
- считает `attempt_count`;
- пишет `last_error`.

### Шаг 3. Реализовать canonical handlers для L1 jobs

Сначала нужно сделать то, без чего retrieval и UX быстро ломаются:

- `document.index`
- `timeline.daily.refresh`
- `snapshot.refresh`
- SOP affected-scope recalculation

### Шаг 4. Реализовать L2/L3 jobs поверх тех же контрактов

После L1:

- `focus.refresh`
- `anomaly.scan`
- `insight.generate`
- `report.generate` / `report.render.*`
- `memory.mine`

### Шаг 5. Реализовать scheduler

Scheduler должен уметь запускать:

- overdue scan для `sop_runs`
- `compliance.daily.aggregate`
- morning `focus.refresh`
- nightly aggregates
- scheduled reports

### Шаг 6. Привязать UX статусы к entity-level processing

Нужно отображать не "глобальный loading", а статусы по сущности:

- upload photo -> processing/failed/completed analysis
- saved event -> timeline visible immediately
- report -> draft ready / artifact failed / published
- focus -> stale/refreshing/refreshed

### Шаг 7. Добавить rebuild paths

Минимум:

- rebuild for scope/date
- rebuild for cycle
- rerun failed artifact
- rerun versioned AI enrichment

### Шаг 8. Добавить observability и алерты

Без этого pipeline быстро становится непрозрачным и ненадёжным.

---

## Acceptance criteria

Реализация соответствует этому ADR, если выполняются все пункты ниже:

1. Raw write завершается без ожидания тяжёлого AI/report work.
2. Между raw write и enqueue нет окна потери работы без durable recovery.
3. Каждый job tenant-scoped и имеет `farm_id`.
4. Каждый handler идемпотентен и безопасен к retry.
5. Critical/L1 jobs отделены от deferred/heavy work.
6. `sop_runs`, а не ad-hoc due tables, остаются canonical state.
7. `ai_insights` сохраняются только после trust/persistence checks из `ADR-004`.
8. `report.publish` не обходит sanitization.
9. Derived outputs можно пересчитать per scope/date/cycle без изменения raw history.
10. UI показывает honest async states и не скрывает partial failure.

---

## Что этот ADR специально не фиксирует

Документ НЕ фиксирует:

- конкретный queue product (`Inngest`, `BullMQ`, `Cloud Tasks`, `Supabase-based queue` и т.д.);
- конкретный DDL для jobs/outbox tables;
- численные SLA/SLO;
- лимиты параллелизма и rate-limit strategy для внешних AI APIs;
- exactly-once delivery semantics.

Но любой технический выбор обязан сохранить инварианты этого ADR: durable enqueue, idempotency, tenant isolation, explicit ownership и rebuildability.

---

## Последствия

### Положительные

- быстрые и надёжные user writes;
- предсказуемый async pipeline вместо спонтанных background calls;
- возможность independently масштабировать API, workers и scheduler;
- восстановимость derived layer после bugs, migrations и model upgrades;
- меньше архитектурного дрейфа между AI, SOP, retrieval и reports.

### Отрицательные

- появляется дополнительная инфраструктура;
- возрастает важность мониторинга и статусов;
- eventual consistency требует более дисциплинированного UX;
- нужно отдельно проектировать deduplication, stale detection и rebuild paths.

---

## Короткая формулировка

Growlog AI использует event-driven background jobs и rebuildable derived data pipeline: request path быстро и надёжно сохраняет raw data и durably фиксирует follow-up work; workers tenant-scoped и идемпотентно пересчитывают enrichment/derived outputs; retrieval, AI, SOP, Daily Focus и reports читают эти слои как explicit operational products, а не как случайный побочный эффект синхронных запросов.
