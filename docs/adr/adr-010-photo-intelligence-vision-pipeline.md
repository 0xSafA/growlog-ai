ADR-010: Growlog AI — Photo Intelligence & Vision Pipeline

Статус: Proposed
Дата: 2026-03-22
Автор: A. Safiulin, OG Lab.
Связан с: ADR-001, ADR-002, ADR-003, ADR-004, ADR-005, ADR-006, ADR-007, ADR-008, ADR-009

---

## Зачем нужен этот ADR

Этот ADR фиксирует сквозной contract для фото в Growlog AI:

- как фото попадает в систему;
- где заканчивается raw media и начинается derived vision layer;
- как visual signals становятся частью retrieval, AI, SOP и reports;
- как не потерять trust, tenant isolation и explainability;
- какие стадии обязательны для реализации, даже если модели или провайдеры со временем изменятся.

Документ должен быть пригоден как implementation contract, а не только как продуктовая идея.

---

## Контекст

По `ADR-001` фотографии - first-class часть operating journal, а не второстепенное вложение. По `ADR-002` каноническая модель уже разделяет:

- `media_assets` - source-of-truth запись о медиа;
- `photo_analysis` - derived interpretation одного кадра;
- `photo_timeline_signals` - derived temporal relations между кадрами;
- `report_media_selections` - curated report layer.

По `ADR-003` assembled context обязан включать `photo_context`, но не имеет права выдумывать visual signals при отсутствии анализа. По `ADR-004` visual interpretation обязана проходить trust layer. По `ADR-008` анализ и relate-стадии по умолчанию асинхронны. По `ADR-009` весь pipeline должен быть tenant-scoped.

Именно поэтому "просто загрузить картинку и иногда спросить vision model" недостаточно. Нужен явный end-to-end pipeline.

---

## Главная проблема

Если фото реализовать как обычный upload в Storage с опциональным единичным вызовом vision API, возникают системные ошибки:

1. фото остаётся приложением к заметке, а не частью timeline memory;
2. сравнение во времени не становится воспроизводимым;
3. retrieval либо игнорирует изображения, либо тащит сырые картинки без отбора;
4. AI легко начинает выдавать догадки как наблюдения;
5. SOP, Daily Focus и reports не получают curated visual evidence;
6. теряется уникальность продукта как farm-scoped, time-aligned visual memory.

Нужен канонический pipeline, который связывает capture, analysis, timeline relation, retrieval и trusted consumption.

---

## Позиционирование продукта

Growlog AI не продаёт generic image chat. Он строит:

`farm-scoped, time-aligned, explainable vision`

Это означает:

1. Фото - это наблюдение во времени.
2. Vision - не isolated trick, а вход в operational context.
3. Сравнение "сегодня vs раньше" является продуктовой функцией, а не ad-hoc prompt.
4. Публикация и отчёты используют curated visuals, а не dump gallery.
5. Visual interpretation не подменяет raw reality и не получает privilege выше journal/sensors/SOP.

---

## Решение

Мы принимаем шестистадийный pipeline:

`Capture -> Persist -> Analyze -> Relate -> Retrieve -> Consume`

Каждая стадия имеет явный вход, выход и ownership.

Если реализация добавляет новый photo feature, она должна:

- вписываться в одну из этих стадий;
- либо явно документировать исключение и его причины.

---

## Нормативные принципы

Ниже `MUST` означает обязательное правило реализации.

- `media_assets` MUST оставаться source of truth для фото и их метаданных.
- `photo_analysis` MUST быть versioned derived output, а не raw fact.
- `photo_timeline_signals` MUST трактоваться как hypotheses/signals, а не как доказанные причины.
- Vision pipeline MUST быть tenant-scoped по `farm_id`.
- Photo retrieval MUST respect `ADR-003` constraints and `missing_data` rules.
- Visual recommendations MUST respect `ADR-004` trust policy.
- Async stages MUST follow `ADR-008` job rules.
- Storage and access MUST follow `ADR-009`.

---

## Канонические сущности

### `media_assets`

Source-of-truth запись о медиа:

- где хранится объект;
- к какой ферме он принадлежит;
- когда был снят (`captured_at`);
- к какому cycle/scope относится;
- какой `media_type` у объекта.

### `photo_analysis`

Derived interpretation одного кадра:

- summary;
- tags;
- structured signals;
- confidence;
- analysis version metadata.

### `photo_timeline_signals`

Derived relation между кадрами:

- from/to media asset;
- тип динамики;
- сила сигнала;
- human-readable description;
- optional correlated context.

### `report_media_selections`

Curated layer для reports:

- hero;
- evidence;
- collage;
- appendix-like roles.

Фото в отчёте выбираются осознанно, а не "по дате подряд".

---

## Stage 1. Capture

### Цель

Сделать фиксацию визуального наблюдения быстрой и low-friction.

### Минимальный input

- изображение;
- `farm_id`;
- `captured_at` или fallback creation time;
- по возможности `cycle_id`;
- по возможности `scope_id`;
- опционально короткий comment/voice-linked context.

### Правила

- UI MUST не заставлять пользователя проходить тяжёлую форму до сохранения;
- `farm_id` MUST быть resolved до upload/persist;
- `scope_id` SHOULD быть передан, если пользователь уже внутри конкретного scope;
- если `scope_id` неизвестен, фото всё равно может быть сохранено, но ambiguity должна быть видима downstream;
- capture stage не пытается делать тяжёлую AI-интерпретацию синхронно.

### Выход

- подготовленный upload;
- минимальный metadata package для `media_assets`;
- optional raw event intent для timeline.

---

## Stage 2. Persist

### Цель

Надёжно сохранить бинарник и канонические метаданные без смешения с AI-слоем.

### Что MUST происходить

1. объект сохраняется в tenant-scoped Storage path;
2. создаётся `media_assets`;
3. при необходимости создаётся связанная запись в `events` для timeline spine;
4. enqueue/mark follow-up work для analysis stage идёт по `ADR-008`.

### Правила

- одна строка `media_assets` = один логический снимок;
- путь Storage MUST быть tenant-scoped по `farm_id`;
- `media_assets` MUST NOT хранить generated interpretation как будто это raw metadata;
- если upload удался, но analysis ещё нет, фото всё равно считается успешно сохранённым;
- persist path MUST фиксировать достаточный context для последующего анализа: `farm_id`, `captured_at`, known `cycle_id`, known `scope_id`.

### Состояния после persist

Рекомендуемые entity-level статусы:

- `saved_unanalyzed`
- `processing_analysis`
- `analysis_ready`
- `analysis_failed`

---

## Stage 3. Analyze

### Цель

Построить structured, versioned interpretation одного изображения.

### Ownership

Canonical owner: job family `photo.analyze` из `ADR-008`.

### Минимальный input

- `media_asset_id`
- `farm_id`
- known `cycle_id` / `scope_id`
- `analysis_version`
- optional cost/latency policy

### Минимальный output contract

`photo_analysis` должен содержать как минимум:

- summary text;
- stable tags;
- structured `signals_json` / `issues_detected`;
- confidence metadata там, где это осмысленно;
- status/version metadata.

### Правила

- output MUST быть versioned;
- rerun того же `(media_asset_id, analysis_version)` MUST быть идемпотентным;
- analysis MUST NOT напрямую писать source operational tables;
- если модель не уверена, output должен это отражать, а не маскировать;
- visual interpretation без достаточной уверенности должна быть мягкой и observation-like.

### Что analysis НЕ должен делать

- выдавать агрономический диагноз как доказанный факт;
- принимать action decision за SOP engine;
- записывать рекомендации напрямую в source tables;
- silently overwrite older analysis без version semantics.

---

## Stage 4. Relate

### Цель

Построить временные и scope-bound связи между кадрами.

### Ownership

Canonical owner: `photo.timeline.refresh`.

### Что делает stage

Использует серию кадров внутри одной фермы и совместимого scope/time window, чтобы строить `photo_timeline_signals`.

### Допустимые trigger paths

- новый completed `photo_analysis`;
- накопление достаточной плотности кадров в scope;
- явный запрос "сравнить";
- scheduled/batched recompute;
- rebuild after analysis version upgrade.

### Выход

- `from_media_asset_id`
- `to_media_asset_id`
- `signal_type`
- `signal_strength`
- `description`
- optional correlated context pointers

### Правила

- relate stage MUST работать только внутри совместимого tenant/scope;
- temporal relation MUST respect `captured_at` / relevant time window;
- signals MUST оставаться hypotheses and pointers;
- correlated factors MAY ссылаться на sensors/events/SOP context, но MUST NOT притворяться доказанной причинностью;
- если данных мало, relate stage может не создать signal вместо выдумывания слабого артефакта.

---

## Stage 5. Retrieve

### Цель

Преобразовать фото-слой в компактный `photo_context` для retrieval и downstream reasoning.

### Источники

- recent `photo_analysis`;
- релевантные `photo_timeline_signals`;
- `media_assets` metadata;
- optional curated selections or ranked candidates.

### Contract with ADR-003

Photo retrieval MUST:

- иметь resolved `farm_id`;
- уважать resolved/visible `scope_id`, если он есть;
- работать SQL-first в MVP;
- возвращать `missing_data`, если фото есть, но analysis отсутствует;
- не выдумывать visual signals по raw image metadata alone;
- уважать retrieval limits, в MVP ориентир `3-12` фото.

### Ranking rules

Приоритет должен быть у:

1. scope match;
2. recency relevant to question;
3. evidence richness;
4. timeline significance;
5. report/summary relevance for current intent.

Простой "самые новые фото" допустим как fallback, но не как единственная стратегия навсегда.

---

## Stage 6. Consume

### Основные потребители

1. Assistant / WHY / AI reasoning
2. Daily Focus / anomaly framing
3. SOP execution as evidence photos
4. Reports and publication flows

### Правила потребления

- Assistant MUST ссылаться на visual evidence как на часть assembled context, а не как на автономное абсолютное знание;
- SOP flow MAY использовать фото как evidence, но фото само по себе не помечает run completed без engine rules;
- Reports MUST использовать curated selection layer;
- Public outputs MUST проходить publish/sanitization flow.

---

## Trust and safety contract

Эта секция выравнивает vision pipeline с `ADR-004`.

### Что считается raw fact

Raw fact:

- наличие фото;
- время съёмки;
- scope/cycle attachment;
- existence of `media_assets`.

### Что считается interpretation

Interpretation:

- summary текста;
- tags;
- предполагаемые симптомы;
- динамические сигналы между кадрами.

### Что из этого следует

- visual interpretation MUST сопровождаться confidence semantics;
- при недостатке поддержки со стороны sensors/events/SOP должны появляться `missing_data` и clarification-first outputs;
- strong recommendation на основе одного визуального сигнала запрещена;
- high-severity visual concern без достаточного evidence должен вести к безопасному "проверь X / собери Y", а не к жёсткому диагнозу.

### Canonical user-facing framing

Система может говорить:

- "на фото похоже на ..."
- "визуально заметен сигнал ..."
- "для уверенного вывода не хватает ..."

Система не должна говорить:

- "это точно X"
- "сделай Y немедленно" без нужного evidence chain

---

## Tenant isolation and storage

Pipeline MUST соблюдать `ADR-009`.

### Обязательные правила

- `media_assets`, `photo_analysis`, `photo_timeline_signals`, `report_media_selections` tenant-scoped по `farm_id`;
- worker jobs получают `farm_id` явно;
- analysis и relate stages не читают cross-farm candidates;
- Storage path для internal photos включает `farm_id`;
- public-facing media access не открывает внутренний tenant bucket целиком.

### Запрещённые паттерны

- глобальный compare across all farms;
- broad unscoped batch read ради "поиска похожих картинок";
- public bucket для internal crop/photo uploads;
- service-role analysis job без explicit tenant context.

---

## Async execution and job model

Photo pipeline по умолчанию асинхронен и должен следовать `ADR-008`.

### Canonical job families

- `photo.analyze`
- `photo.timeline.refresh`
- optional `report.media.select`
- optional `rebuild.photo.analysis.scope`

### Правила

- persist stage durably enqueue анализ;
- heavy relate/rebuild stages coalesce and deduplicate;
- failed analysis не ломает raw media persistence;
- rebuild after model upgrade MUST обновлять derived outputs, а не raw media;
- stale jobs должны корректно отменяться или помечаться `stale`.

---

## Versioning and model policy

Implementation MUST различать:

- `analysis_version`
- provider/model choice
- prompt/schema version

Причина:

- пользователь и разработчик должны понимать, почему старое и новое описание одного фото могут отличаться;
- rebuild должен быть объяснимым;
- сравнение quality между версиями должно быть измеримым.

### Cost policy

Pipeline SHOULD разделять:

- fast cheap per-frame baseline analysis;
- heavier multimodal reasoning only when triggered by question/report/high-value workflow.

Не каждый новый кадр обязан запускать самый дорогой multimodal path.

---

## Report integration

`ADR-007` требует curated visuals.

### Что это означает для ADR-010

- отчёт не должен просто брать последние N фото;
- photo suitability может оцениваться по role-like критериям: `hero`, `evidence`, `collage`, `appendix`;
- `report_media_selections` SHOULD быть отдельным curated output;
- public report использует только sanitization-safe media/text pairing.

### Правило

Photo selection = curated layer. Нельзя подменять её простым chronological dump.

---

## MVP scope

### Обязательно для MVP

- `media_assets` с tenant-safe persist;
- `photo_analysis` с базовым summary/tags/signals contract;
- связь фото с timeline/event spine;
- inclusion of `photo_context` in retrieval;
- правило "если анализа нет, не выдумывать visual signals";
- entity-level async statuses для анализа.

### Можно отложить

- полный автоматический граф `photo_timeline_signals` для всех возможных пар;
- multimodal embeddings самих изображений;
- advanced cross-image ranking beyond SQL-first baseline;
- тонкая visual anomaly calibration;
- сложные collage/layout heuristics.

Архитектурное место для этих вещей должно быть предусмотрено заранее, даже если MVP их ещё не включает.

---

## Testing contract

Минимальный набор тестов:

1. фото сохраняется как `media_assets` без ожидания анализа;
2. analysis job создаёт versioned `photo_analysis` и не дублирует смысл при retry;
3. relate job не строит cross-farm и cross-scope invalid signals;
4. retrieval возвращает `missing_data`, если есть фото без анализа;
5. AI output не делает strong recommendation только на основании visual signal;
6. report flow использует curated photo selection, а не тупой chronological dump;
7. rebuild после смены `analysis_version` обновляет derived layer без изменения raw;
8. internal media не доступно cross-tenant или через случайный public shortcut.

---

## Implementation checklist

### Шаг 1. Сделать capture/persist независимыми от AI

Upload и `media_assets` должны жить даже при полном падении vision pipeline.

### Шаг 2. Ввести canonical `photo.analyze`

Нужен один owner для per-image interpretation.

### Шаг 3. Ввести canonical `photo_context` retrieval path

Assistant и reports не должны тащить фото в prompts каждый по-своему.

### Шаг 4. Добавить controlled relate stage

Сначала локально по scope/time window, без "магического" сравнения всего со всем.

### Шаг 5. Привязать trust policy

Visual outputs должны конвертироваться в `facts / interpretation / missing_data / confidence`-совместимый формат.

### Шаг 6. Привязать report curation

Нужен отдельный selection layer для report roles.

### Шаг 7. Добавить rebuild and version visibility

Пользователь и система должны видеть, какая версия анализа активна и когда нужен rerun.

---

## Acceptance criteria

Реализация соответствует этому ADR, если:

1. Фото сохраняется как raw media независимо от успеха AI анализа.
2. `photo_analysis` versioned и отделён от `media_assets`.
3. `photo_timeline_signals` трактуются как hypotheses/signals, а не доказанные диагнозы.
4. `photo_context` собирается через retrieval contract из `ADR-003`.
5. Visual reasoning obeys trust policy из `ADR-004`.
6. Async execution obeys job contract из `ADR-008`.
7. Tenant isolation obeys `ADR-009`.
8. Reports используют curated photo selection, а не dump gallery.
9. При отсутствии анализа система не выдумывает, что "увидела" на изображении.
10. Rebuild после version change не мутирует raw media layer.

---

## Что этот ADR специально не фиксирует

Документ не фиксирует:

- конкретного vision provider;
- точный JSON schema для всех possible visual signals;
- numerical confidence formula;
- конкретную ranking formula для photo retrieval;
- финальный UX layout галерей и report collages.

Но любой технический выбор обязан сохранять инварианты этого ADR: raw/derived separation, tenant isolation, retrieval-first consumption, trust-aware framing и rebuildability.

---

## Последствия

### Положительные

- фото становится частью операционной памяти фермы, а не просто attachment;
- появляется explainable visual layer для retrieval и reports;
- продукт сильнее дифференцируется от generic image chat;
- можно безопасно улучшать модели без потери архитектурного каркаса;
- timeline comparison и curated reporting получают явный фундамент.

### Отрицательные

- возрастает сложность pipeline и тестов;
- нужны статусы и observability для async analysis;
- relate stage требует дисциплины, чтобы не плодить слабые или шумные сигналы;
- visual trust policy ограничивает "вау-ответы", но это осознанная цена за надёжность.

---

## Короткая формулировка решения

Photo Intelligence в Growlog AI - это не upload + vision call, а tenant-scoped, time-aligned pipeline: raw фото сохраняется в `media_assets`, versioned interpretation живёт в `photo_analysis`, temporal hypotheses - в `photo_timeline_signals`, retrieval собирает из этого `photo_context`, а assistant, SOP и reports потребляют visual layer только через trust-aware и curated contracts.
