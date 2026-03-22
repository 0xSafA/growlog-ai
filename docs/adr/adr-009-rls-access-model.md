ADR-009: Growlog AI — RLS и модель доступа

Статус: Proposed
Дата: 2026-03-22
Автор: A. Safiulin, OG Lab.
Связан с: ADR-001, ADR-002, ADR-003, ADR-004, ADR-005, ADR-007, ADR-008, `docs/implementation/data-platform-implementation-spec.md`

---

## Зачем нужен этот ADR

Этот ADR фиксирует security contract для Growlog AI:

- где проходит tenant boundary;
- как Row Level Security участвует в изоляции данных;
- что разрешено клиенту, backend и `service role`;
- как создаются tenant и membership;
- как защищаются Storage-объекты;
- как публикуется public-facing контент без ослабления RLS на внутренних таблицах.

Документ написан как implementation contract. Цель - чтобы даже слабая модель или инженер без глубокого контекста не сделали небезопасный shortcut вроде "дадим service role и сами всё проверим потом".

---

## Контекст

Growlog AI разворачивается как мультитенантный SaaS на Supabase (`Postgres`, `Auth`, `Storage`). По `ADR-002` большинство рабочих сущностей привязаны к `farm_id`, а каноническая tenant boundary проходит по ферме.

В системе одновременно существуют три способа доступа:

1. клиентское приложение с `anon` key и JWT пользователя;
2. доверенный backend / API routes;
3. фоновые jobs и pipelines, которые могут работать с `service role`.

Проблема в том, что `service role` в Supabase обходит RLS. Поэтому безопасность нельзя описывать одной фразой "у нас включён RLS". Нужен явный контракт, кто и что обязан проверять на каждом слое.

---

## Главная проблема

Без чёткой модели доступа появляются типовые сбои:

1. cross-tenant leakage из-за запроса без фильтра по `farm_id`;
2. "слепое" использование `service role`, которое случайно читает или пишет чужие данные;
3. расхождение между доменной политикой, UX и RLS-политиками;
4. открытие внутренних таблиц ради public reports;
5. утечки через Storage, even if SQL tables are protected;
6. небезопасные `security definer` функции, которые делают больше, чем должны.

Этот ADR нужен, чтобы зафиксировать модель "RLS first, but not RLS only".

---

## Решение

Мы принимаем модель доступа:

`farm-scoped tenant isolation with RLS-first enforcement and explicit service-role constraints`

Это означает:

1. tenant boundary по умолчанию = `farm_id`;
2. все рабочие таблицы с tenant data защищаются RLS;
3. клиент не считается доверенным и работает только через RLS-constrained доступ;
4. `service role` допустим только в trustable backend/jobs и не отменяет доменные проверки;
5. public access реализуется через publish layer, а не через ослабление RLS на operational tables;
6. Storage должен соблюдать ту же tenant isolation, что и SQL layer.

---

## Нормативные принципы

Ниже `MUST` означает обязательное правило реализации.

- Tenant boundary MUST быть выражена через `farm_id`, если иное не документировано отдельным ADR.
- Все рабочие tenant tables MUST иметь включённый RLS.
- Отсутствие policy трактуется как deny-by-default.
- Клиент MUST читать и писать только через JWT-bound доступ, подчинённый RLS.
- `service role` MUST NOT использоваться как оправдание для обхода доменных инвариантов.
- Public content MUST публиковаться через отдельный publish flow.
- Storage MUST быть tenant-scoped.
- `security definer` функции MUST быть минимальными, узкими и audit-friendly.

---

## Канонические термины

### Tenant

В текущей архитектуре tenant = ферма (`farms.id`).

### Membership

Право пользователя работать с tenant выражается строкой в `farm_users`.

### Access layer

Есть три разных access layer:

- database policies (`RLS`);
- backend/domain checks;
- product rules and UX constraints.

Безопасная система требует согласованности всех трёх слоёв.

### Publish layer

Отдельный слой артефактов/снимков/URL для внешнего чтения. Это не "ослабленный доступ к внутренним таблицам".

---

## Access surfaces

Чтобы не путать каналы доступа, implementation MUST различать следующие surfaces.

### 1. Client direct access

Клиент читает/пишет с `anon` key и пользовательским JWT.

Разрешено:

- читать свои farm-scoped записи;
- писать только те строки, которые проходят `with check`;
- вызывать разрешённые RPC/use cases.

Запрещено:

- создавать tenant произвольным `insert` в `farms`;
- назначать себе роли прямым `insert`/`update` в `farm_users`;
- читать/писать cross-farm data;
- получать public content через открытие внутренних operational tables.

### 2. Trusted backend

API routes / server actions / Edge Functions могут выполнять доменные use cases.

Они обязаны:

- валидировать `farm_id`, `cycle_id`, `scope_id`;
- проверять, что пользователь имеет membership и нужный role level;
- не расширять доступ просто потому, что запрос пришёл "с сервера".

### 3. Service-role jobs and pipelines

Фоновые jobs, enrichment и rebuild pipelines могут работать через `service role`.

Они обязаны:

- быть tenant-scoped;
- получать `farm_id` из trustable job payload;
- повторять доменные ограничения записи и чтения;
- не выполнять "скан всей базы", если это не explicit admin maintenance scenario.

---

## Канонический способ выражать доступ к tenant

### Membership table

Канонический способ сказать "пользователь имеет доступ к ферме":

- строка в `farm_users`
- с `user_id`
- с `farm_id`
- с `role`

### Canonical helper

Базовый helper для RLS:

```sql
select farm_id
from public.farm_users
where user_id = auth.uid();
```

Рекомендуемый wrapper:

- `public.user_farm_ids()`
- `security definer`
- `stable`
- с фиксированным `search_path`

### Базовый policy template

Для большинства tenant tables с колонкой `farm_id` policy shape должен быть таким:

- `using`: `farm_id in (select public.user_farm_ids())`
- `with check`: `farm_id in (select public.user_farm_ids())`

Если таблица не может использовать этот шаблон, отклонение должно быть задокументировано прямо рядом с DDL или в implementation spec.

---

## Таблицы, которые обязаны быть farm-scoped

По `ADR-002` это как минимум касается:

- `events`
- `sensor_readings`
- `media_assets`
- `photo_analysis`
- `photo_timeline_signals`
- `sop_definitions`
- `sop_triggers`
- `sop_runs`
- `sop_executions`
- `ai_insights`
- `insight_grounding`
- `anomalies`
- `grow_memory_items`
- `daily_focus_cards`
- `conversation_messages`
- `reports`
- `report_artifacts`
- `publication_targets`
- `publication_jobs`
- `searchable_documents`

Смысл правила: новая рабочая таблица без `farm_id` или без документированного tenant mapping считается подозрительной по умолчанию.

---

## Исключения из farm-scoped шаблона

Не все таблицы обязаны иметь `farm_id`, но исключение должно быть явным.

Допустимые типы исключений:

1. глобальные справочники;
2. системные технические таблицы;
3. publish-layer tables с отдельной политикой доступа;
4. security/meta tables, не представляющие farm data напрямую.

Пример допустимого исключения:

- `sensor_metrics` как глобальный справочник;
- чтение разрешено по отдельной безопасной policy;
- запись ограничена доверенным backend/admin path.

Запрещённое исключение:

- "таблица не имеет `farm_id`, потому что так удобнее джойнить потом".

---

## Создание фермы и bootstrap membership

Прямой `insert` с клиента в `farms` и `farm_users` должен быть запрещён.

Причина:

- иначе можно создать осиротевший tenant;
- иначе можно присвоить себе произвольную роль;
- иначе бизнес-правило bootstrap разъедется между клиентом и БД.

### Канонический путь

Создание новой фермы должно идти через узкий use case:

- RPC `create_farm_with_membership`
- или эквивалентный trusted backend path

Этот use case MUST:

1. требовать валидный `auth.uid()`;
2. создать `farms`;
3. создать стартовую строку в `farm_users`;
4. выдать роль `admin` только инициатору;
5. быть atomic;
6. не позволять клиенту подставить произвольный `user_id`.

### Contract for security definer bootstrap RPC

`security definer` функция для bootstrap MUST:

- иметь фиксированный `search_path`;
- выполнять только минимально необходимый набор действий;
- не принимать "лишние" поля, которые открывают privilege escalation;
- возвращать только нужный результат;
- быть покрыта тестами на unauthorized access и role escalation.

---

## Роли и эволюция политик

Канонические роли в `farm_users.role`:

- `admin`
- `manager`
- `grower`
- `viewer`

### MVP stance

Foundation MVP может использовать flat membership policy:

- все участники фермы имеют одинаковый row visibility;
- более тонкие ограничения могут временно жить в backend use cases.

Это допустимо как временное упрощение, но важно явно зафиксировать границу:

- MVP flat membership не означает, что role field "декоративный";
- доменная логика всё равно должна знать о ролях;
- дальнейшая детализация обязана идти через тестируемую эволюцию policies.

### Target stance

Целевое состояние:

- `viewer` = read-only;
- `grower` = ограниченный operational write;
- `manager` = расширенный read/write по своей ферме;
- `admin` = membership/config/export/publish управление.

Если конкретное ограничение ещё не отражено в RLS, оно MUST жить в backend use cases и тестах до момента переноса на policy level.

---

## Service role contract

Это самая важная секция для безопасной реализации.

### Что означает service role

`service role` обходит RLS. Значит, код с service role работает вне защитного периметра БД и сам становится частью security boundary.

### Что service role code MUST делать

- принимать `farm_id` как явный input;
- валидировать, что все читаемые и изменяемые строки относятся к этому `farm_id`;
- валидировать `cycle_id` / `scope_id`, если операция scope-bound;
- выполнять только доверенные use cases;
- логировать correlation/audit context для чувствительных операций.

### Что service role code MUST NOT делать

- читать "все фермы", если нужен только один tenant;
- строить запрос, который сначала читает широкую выборку, а потом фильтрует в памяти;
- писать строку с одним `farm_id`, основываясь на данных, прочитанных из другого;
- отдавать клиенту сырые service-role результаты без повторной проверки access intent;
- использовать service role для удобства там, где можно безопасно использовать JWT-bound client query.

### Canonical service-role pattern

Безопасный шаблон:

1. получить trustable `farm_id`;
2. проверить source of authority для этого access;
3. читать только farm-scoped slice;
4. выполнять use case;
5. писать только в том же tenant context;
6. записывать audit metadata, если операция чувствительная.

---

## Retrieval, AI и background jobs

`ADR-003` и `ADR-008` делают эту секцию особенно важной.

### Retrieval

Retrieval MUST:

- иметь resolved `farm_id` до любых farm-scoped query;
- при неоднозначном scope останавливать или уточнять запрос;
- не расширять контекст за пределы tenant для "более умного ответа".

### AI pipelines

AI/insight/report pipelines MUST:

- читать только допустимый tenant slice;
- сохранять outputs с тем же `farm_id`;
- не писать публичные артефакты напрямую в открытый слой без publish gate.

### Background jobs

Каждый job из `ADR-008` MUST содержать:

- `farm_id`
- при необходимости `cycle_id`
- при необходимости `scope_id`
- trustable `correlation_id`

Job payload без `farm_id` для tenant-bound работы считается дефектом безопасности.

---

## Storage contract

Storage обязан быть tenant-scoped так же строго, как SQL layer.

### Базовые правила

- bucket для tenant media не публичный;
- object path включает `farm_id` в каноническом месте;
- policies на `storage.objects` проверяют принадлежность пути к `user_farm_ids()`;
- публичный URL на внутренний tenant object не должен жить вечно и не должен обходить publish contract.

### Recommended path shape

Например:

`{farm_id}/{cycle_id-or-none}/{entity_type}/{entity_id}/{filename}`

Точный формат может отличаться, но правило одно: из пути должно быть возможно безопасно вывести tenant принадлежность.

### Запрещённые паттерны

- public bucket для внутренних фото;
- path без `farm_id`;
- signed URL, выданный без проверки publish intent;
- смешивание internal и public assets в одном и том же открытом prefix.

---

## Public access and publish layer

`Публичное` не означает `anon SELECT из operational tables`.

### Внутренние таблицы, которые нельзя открывать для anon

- `events`
- `reports`
- `report_artifacts`
- `conversation_messages`
- `ai_insights`
- любые другие operational или tenant-derived tables

### Допустимые паттерны public access

1. отдельные published snapshots;
2. отдельные sanitized artifacts;
3. signed URLs на public-ready object;
4. Edge/API route, которая валидирует publish token и только потом читает internal data сервисным доступом.

### Обязательное правило

Public report или public HTML MUST:

- пройти sanitization;
- иметь publish-specific authorization model;
- не тянуть случайно весь внутренний operational context.

---

## Security definer contract

`security definer` - это controlled escape hatch, а не универсальный бэкдор.

Такие функции MUST:

- иметь фиксированный `search_path`;
- быть минимальными по области действия;
- не принимать параметры, позволяющие privilege escalation;
- не возвращать больше данных, чем нужно;
- быть отдельно перечислены в implementation docs;
- иметь тесты на positive path и abuse cases.

Типовые use cases:

- tenant bootstrap;
- системные membership mutations через trusted backend;
- отдельные audit-safe administrative helpers.

Если задача может быть решена обычным RLS-bound query, `security definer` не нужен.

---

## Domain checks vs RLS

RLS не заменяет доменную логику, а доменная логика не заменяет RLS.

### Что должно жить в use cases

- проверка scope ambiguity;
- проверка продуктовых ролей;
- проверка transition rules;
- publish business rules;
- trust-policy checks для AI outputs.

### Что должно жить в RLS

- tenant visibility;
- tenant-bound insert/update/delete restrictions;
- deny-by-default для client SQL access.

### Design rule

Любое правило вида "кто может делать X" сначала формулируется как domain use case и тест, затем по возможности дублируется или усиливается на уровне RLS.

---

## Testing contract

Эта секция нужна специально для implementation quality.

### Минимальный набор тестов

1. пользователь из фермы A не видит строки фермы B;
2. пользователь не может вставить строку с чужим `farm_id`;
3. пользователь не может создать ферму прямым `insert`, если предусмотрен только bootstrap RPC;
4. пользователь не может выдать себе `admin` через `farm_users`;
5. service-role path не читает/write cross-farm data при tenant-bound use case;
6. storage policy блокирует доступ к чужому object path;
7. public publish route не открывает internal artifact без валидного publish access;
8. `security definer` RPC не допускает role escalation через параметры.

### Что обязательно проверять при каждой новой таблице

- есть ли `farm_id` или документированное исключение;
- включён ли RLS;
- есть ли `select` / `insert` / `update` / `delete` policy;
- совпадает ли policy с доменным use case;
- есть ли тест на cross-tenant isolation.

---

## Implementation checklist

### Шаг 1. Включить deny-by-default mindset

Новая рабочая таблица не считается готовой, пока:

- не включён RLS;
- не описан tenant mapping;
- не написаны policy tests.

### Шаг 2. Централизовать membership helpers

Нужны:

- `user_farm_ids()`
- единый способ получать current membership / role
- повторно используемые policy templates

### Шаг 3. Запретить прямой tenant bootstrap с клиента

Создание `farms` и стартового membership идёт только через узкий trusted path.

### Шаг 4. Ввести service-role guardrails

Нужны явные helper/util patterns, которые заставляют любой job/use case сначала принять и проверить `farm_id`.

### Шаг 5. Привести Storage к той же tenant модели

Путь, policies и signed URL semantics должны быть согласованы с SQL isolation.

### Шаг 6. Разделить internal и public access

Public outputs идут только через publish layer/sanitized artifacts.

### Шаг 7. Добавить security tests в definition of done

Без isolation tests изменение схемы или policies не считается завершённым.

---

## Acceptance criteria

Реализация соответствует этому ADR, если выполняются все условия:

1. Все рабочие tenant tables защищены RLS.
2. Клиент не может читать или писать чужую ферму через прямой SQL access.
3. Tenant bootstrap не делается прямым client insert в `farms`/`farm_users`.
4. `service role` код всегда работает с явным `farm_id` и не делает broad unscoped reads.
5. Storage-объекты tenant-scoped и не доступны cross-farm.
6. Public reports/public HTML не открывают anon доступ к внутренним таблицам.
7. `security definer` функции узкие, фиксируют `search_path` и покрыты abuse-case tests.
8. Новая рабочая таблица без RLS или без documented tenant mapping не проходит review.

---

## Что этот ADR специально не фиксирует

Документ не фиксирует:

- конкретный DDL каждой таблицы;
- полный enterprise IAM (`SSO`, `SCIM`, org hierarchy);
- финальный формат share links и TTL public URLs;
- все audit/compliance runbooks;
- будущую org-level tenancy above farm.

Но любые будущие решения обязаны сохранять главный инвариант: tenant isolation не может зависеть только от "аккуратности кода" без enforceable database boundary.

---

## Последствия

### Положительные

- появляется явная и тестируемая tenant boundary;
- клиент остаётся в безопасном периметре RLS;
- service-role code перестаёт быть "серой зоной" без контракта;
- Storage и publish flow согласуются с SQL security model;
- проще эволюционировать от flat membership к более строгим roles/scopes.

### Отрицательные

- растёт количество security тестов и policy boilerplate;
- service-role код требует больше дисциплины;
- отладка запросов и миграций становится более формальной;
- любые shortcuts с public access становятся архитектурно запрещёнными.

---

## Короткая формулировка решения

Изоляция данных в Growlog AI строится вокруг `farm_id` как tenant boundary: рабочие таблицы и Storage защищены RLS-first политиками, клиент работает только в JWT-bound периметре, `service role` допустим лишь в tenant-scoped trusted use cases с повторением доменных проверок, а public access реализуется через publish layer и sanitized artifacts, а не через ослабление доступа к внутренним таблицам.
