# SOP engine — известные ограничения и долг

Часть ранее запланированного долга **реализована в коде и миграции** `20260322200000_sop_engine_hardening.sql`:

- **Атомарность run + `sop_due`**: RPC `create_sop_run_with_due_event` (транзакция в БД).
- **Дедуп event-based**: колонка `sop_runs.source_event_id` + частичный unique index `(farm_id, trigger_id, source_event_id)`.
- **Метрики материализации**: в ответе API — `skippedIneligible` и `evalNoMatch` (плюс сумма в `skippedTriggers` для совместимости).
- **Compliance snapshot**: таблица `sop_compliance_daily`, RPC `refresh_sop_compliance_daily`, вызывается после материализации дня.
- **Обязательные поля после исполнения**: проверка `required_inputs_after_execution` в `executeSopRun` (см. `lib/growlog/sop-required-inputs.ts`), UI — JSON замеров / evidence на странице run.

---

## Оставшийся долг

### Строгая TZ-семантика для `recurring_interval`

Интервал по-прежнему считается в **календарных днях** между строкой `grow_cycles.start_date` и `anchor_date`. Для редких часовых поясов при необходимости можно явно нормализовать обе даты в TZ фермы на всём пути eval.

### Транзакции на стороне клиента

Исполнение SOP (`executeSopRun`) по-прежнему несколько шагов через PostgREST; при сбое между шагами возможны редкие несоответствия. При необходимости — отдельный RPC «finalize execution».

### Ночные job’ы и пересчёт compliance

`sop_compliance_daily` обновляется при вызове материализации за день. Отдельный **nightly job** для всех ферм/циклов и подключение к `background-worker` — по мере масштабирования (см. ADR-008).

---

## Связанные документы

- [ADR-006: SOP Scheduling and Compliance Engine](../adr/adr-006-sop-scheduling-compliance-engine.md)
- [ADR-008: Background jobs / derived data](../adr/adr-008-background-jobs-derived-data-pipeline.md)
