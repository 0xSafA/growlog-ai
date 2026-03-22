ADR-006: Growlog AI - SOP Scheduling and Compliance Engine

Статус: Proposed
Дата: 2026-03-22
Автор: A. Safiulin, OG Lab.
Связан с: ADR-001, ADR-002, ADR-003, ADR-004, ADR-005

⸻

Контекст

В выращивании ключевую роль играет соблюдение регламентов (SOP - Standard Operating Procedures):
	•	регулярные действия: полив, питание, обслуживание оборудования
	•	действия по стадиям цикла
	•	реакции на события и отклонения
	•	протоколы безопасности и качества
	•	проверки и follow-up после действий

В большинстве систем SOP существует как статический документ, чеклист или PDF и не встроен в ежедневную работу.

В Growlog AI SOP должен стать:

живой операционной системой действий фермы

которая:
	•	напоминает,
	•	отслеживает,
	•	фиксирует выполнение,
	•	связывает действия с результатами,
	•	влияет на рекомендации AI,
	•	влияет на daily focus,
	•	даёт основу для compliance и WHY engine.

`ADR-001` уже зафиксировал, что SOP - часть ядра продукта.
`ADR-002` уже зафиксировал канонические сущности:
	•	`sop_definitions`
	•	`sop_triggers`
	•	`sop_assignments`
	•	`sop_runs`
	•	`sop_executions`
	•	`sop_compliance_daily`

`ADR-005` зафиксировал, что SOP должен быть частью ежедневного пользовательского потока, а не только административной настройкой.

Теперь нужно зафиксировать сам engine:

как именно SOP срабатывает, становится обязательством, попадает в Daily Focus, проходит through execution dialog и превращается в compliance signal.

⸻

Проблема

Без SOP engine:
	•	действия выполняются несистемно
	•	ошибки повторяются
	•	невозможно понять, что пошло не так
	•	нет связи между действиями и результатами
	•	невозможно построить WHY engine
	•	сложно масштабировать процессы
	•	SOP остаётся документом, а не механизмом исполнения

Без чёткой архитектуры engine появятся отдельные ошибки:
	•	один и тот же SOP будет срабатывать по-разному в разных местах кода
	•	будут дублироваться due items
	•	будет неясно, что считать overdue
	•	будет путаница между reminder, run и execution
	•	AI не сможет reliably учитывать факт невыполнения SOP

Главный вывод:

SOP в Growlog AI должен моделироваться не как "список задач", а как event-driven engine с каноническим жизненным циклом и строгими правилами генерации `sop_runs`.

⸻

Основное решение

Мы принимаем архитектуру:

event-driven SOP scheduling, execution, and compliance engine

SOP не является просто списком задач.

SOP - это:
	•	набор правил
	•	набор триггеров
	•	набор назначений
	•	набор обязательств
	•	execution dialog
	•	история выполнения
	•	compliance analytics

Ключевое правило:

SOP Definition не равен задаче.

Каноническая цепочка такая:

`SOP Definition -> SOP Trigger -> SOP Assignment -> SOP Run -> SOP Execution -> Compliance / AI / Daily Focus`

Именно `sop_runs` являются конкретными обязательствами "сделать это в этом контексте и в это время".

⸻

Границы ответственности engine

SOP engine отвечает за:
	•	оценку trigger conditions
	•	решение, нужно ли создать `sop_run`
	•	жизненный цикл `sop_run`
	•	учёт `sop_executions`
	•	overdue detection
	•	compliance aggregates
	•	подачу сигнала в Daily Focus, timeline и AI layer

SOP engine не отвечает за:
	•	пиксельный UI execution screens
	•	формулировки AI explanation text
	•	ручное редактирование event log как источника правды
	•	автономное принятие действий вместо пользователя

Правило:

UI показывает и помогает выполнить SOP.
AI объясняет и советует.
Но только SOP engine определяет:
	•	когда SOP стал обязательством,
	•	в каком он статусе,
	•	считается ли он overdue,
	•	достаточно ли evidence для завершения.

⸻

Канонические сущности engine

### 1. SOP Definition

Описание регламента:
	•	что нужно сделать
	•	зачем это нужно
	•	какой scope применимости
	•	какие данные обязательны после выполнения
	•	что считать провалом исполнения

SOP Definition - это шаблон поведения, а не instance задачи.

### 2. SOP Trigger

Условие, которое делает SOP релевантным.

Trigger отвечает на вопрос:
	•	когда или при каком условии SOP должен породить `sop_run`

### 3. SOP Assignment

Привязка SOP к реальному контексту:
	•	к какой ферме
	•	к какому scope
	•	к какому циклу или объекту
	•	кому назначено

Assignment нужен, чтобы один и тот же SOP definition работал в разных местах по-разному.

### 4. SOP Run

Конкретное обязательство:
	•	что надо сделать
	•	где
	•	почему
	•	до какого времени или в каком окне

`SOP Run` - это канонический объект "due item".

### 5. SOP Execution

Факт пользовательской реакции и/или выполнения:
	•	done
	•	delayed
	•	skipped
	•	blocked
	•	partially_done

### 6. SOP Compliance Layer

Derived layer, который считает:
	•	completion rate
	•	overdue rate
	•	skipped and blocked patterns
	•	repeated failures by scope / SOP / operator / cycle

⸻

Типы триггеров

Система обязана поддерживать канонические trigger types из ADR-001 / ADR-002:

1. `date_based`
	•	конкретная дата или набор дат

2. `time_based`
	•	время суток или окно времени

3. `stage_based`
	•	при входе в стадию или в момент нахождения на стадии

4. `offset_based`
	•	через N дней или часов после anchor event
	•	пример: через 2 дня после transplant

5. `event_based`
	•	после конкретного события
	•	пример: после `issue_detected`

6. `recurring_daily`
	•	ежедневно

7. `recurring_interval`
	•	каждые N часов / дней

8. `condition_based`
	•	при выполнении проверяемого условия
	•	пример: EC выше порога

9. `location_based`
	•	когда пользователь на месте или делает check-in

10. `manual`
	•	когда `sop_run` создаётся человеком или системной командой вручную
	•	пример: менеджер вручную создаёт внеплановый sanitation SOP

Правило:

Каждый trigger type обязан иметь собственную семантику и валидируемый `trigger_config`.
Нельзя использовать один размытый "универсальный trigger json" без правила интерпретации.

⸻

Trigger semantics

### `date_based`

Используется, когда известна точная дата или календарный план.

Примеры:
	•	2026-03-24 09:00
	•	каждое 1-е число месяца нельзя моделировать как `date_based`, это уже recurrence

### `time_based`

Используется, когда важен локальный момент суток.

Примеры:
	•	каждый день в 09:00 проверка оборудования
	•	каждый день между 08:00 и 10:00 осмотр

### `stage_based`

Используется, когда SOP зависит от стадии цикла.

Примеры:
	•	при входе в flower показать SOP по смене схемы питания
	•	на week_3_flower активировать определённый inspection SOP

### `offset_based`

Используется, когда есть anchor event.

Примеры anchor events:
	•	start cycle
	•	transplant
	•	flip_to_12_12
	•	flush_started

Пример:
	•	через 48 часов после transplant сделать root check

### `event_based`

Используется, когда SOP должен следовать за конкретным событием.

Пример:
	•	после `pest_detected` активировать treatment SOP

### `recurring_daily`

Используется для ежедневных регулярных действий.

### `recurring_interval`

Используется для повторяющихся действий с интервалом.

Пример:
	•	каждые 12 часов
	•	каждые 3 дня

### `condition_based`

Используется для rule-based реакции на измеряемый факт.

Пример:
	•	если `runoff_ec > threshold`, создать flushing SOP run

На MVP condition rules должны быть deterministic и rule-based.

### `location_based`

Используется, когда выполнение имеет смысл только на месте.

MVP-упрощение:
	•	не строим сложный background geofencing engine
	•	trigger активируется при app open on site или explicit check-in

### `manual`

Используется, когда SOP должен быть запущен без автоматического условия.

Примеры:
	•	менеджер вручную создаёт extra inspection run
	•	оператор вручную активирует SOP после устного указания

Правило:
	•	`manual` не означает "без причины"
	•	даже ручной запуск должен иметь `reason_text` и понятный initiator
	•	ручной запуск должен создавать такой же канонический `sop_run`, как и любой другой trigger type

⸻

Генерация `sop_runs`

Система должна:
	1.	отслеживать trigger conditions
	2.	проверять applicability через assignment и scope
	3.	создавать `sop_run`
	4.	привязывать `sop_run` к контексту
	5.	делать его видимым в Daily Focus / SOP execution flow

Каноническая цепочка:

`trigger evaluation -> run generation decision -> sop_run -> reminder/display -> user response -> sop_execution -> compliance analysis`

Правило:

Run generation - это отдельный системный шаг. Нельзя смешивать его с UI reminders, AI recommendations или direct execution logging.

⸻

Правила генерации run

При создании `sop_run` engine обязан определить:
	•	`farm_id`
	•	`cycle_id`, если применимо
	•	`scope_id`
	•	`sop_definition_id`
	•	`trigger_id`
	•	`assignment_id`, если применимо
	•	`due_at` или due window
	•	`priority`
	•	`reason_text`
	•	`trigger_snapshot`

`trigger_snapshot` должен фиксировать, почему именно был создан run.

Примеры:
	•	значение EC на момент срабатывания
	•	ID anchor event
	•	стадия цикла
	•	время локального календарного запуска

Это важно для explainability.

Дополнительное правило:

Engine обязан различать:
	•	exact due point: `due_at`
	•	allowable execution window: `due_window_start` / `due_window_end`

Нельзя смешивать эти две семантики.

Если SOP допускает окно исполнения, overdue должен считаться от конца окна, а не от его начала.

⸻

Дедупликация run

Engine обязан предотвращать бессмысленное дублирование `sop_runs`.

Нужны как минимум следующие правила deduplication:

1. Same definition + same scope + same trigger window
	•	не создавать второй активный run, если уже есть `open` или `acknowledged`

2. Recurring trigger
	•	новый run создаётся только для следующего периода
	•	нельзя плодить несколько run за один и тот же daily slot

3. Event-based trigger
	•	один и тот же triggering event не должен создавать run повторно без явного повода

4. Condition-based trigger
	•	если condition всё ещё true, но run уже открыт, не создавать бесконечные дубликаты

MVP правило:

Лучше иногда не создать лишний run, чем заспамить пользователя десятью одинаковыми обязательствами.

⸻

Жизненный цикл `sop_run`

Каноническое состояние `sop_run`:

1. `open`
	•	run создан и ожидает реакции

2. `acknowledged`
	•	пользователь увидел и подтвердил намерение заняться

3. `completed`
	•	есть execution с достаточным завершением

4. `skipped`
	•	пользователь осознанно пропустил

5. `overdue`
	•	дедлайн или окно прошло без достаточного исполнения

6. `blocked`
	•	исполнение невозможно по объективной причине

7. `cancelled`
	•	run больше не актуален из-за изменения контекста или ручной отмены

Правило:

`postponed` и `delayed` - это, прежде всего, характеристика execution/response, а не отдельный обязательный terminal status для run.

⸻

Канонические переходы состояний

Чтобы слабая модель или новый разработчик не придумали собственную state machine, фиксируем допустимые переходы:

* `open -> acknowledged`
* `open -> completed`
* `open -> skipped`
* `open -> blocked`
* `open -> overdue`
* `acknowledged -> completed`
* `acknowledged -> blocked`
* `acknowledged -> skipped`
* `acknowledged -> overdue`
* `overdue -> completed`
* `overdue -> blocked`
* `overdue -> skipped`
* `open -> cancelled`
* `acknowledged -> cancelled`

Запрещённые переходы по умолчанию:

* `completed -> open`
* `completed -> acknowledged`
* `skipped -> open`
* `blocked -> open`

Если нужен возврат из terminal state, это должен быть:
	•	либо новый `sop_run`
	•	либо отдельный explicit admin override, а не обычный пользовательский flow

Правило:

SOP engine должен быть append-friendly. Лучше создать новый run или override event, чем silently переписать историю исполнения.

⸻

Execution semantics

Пользователь может:
	•	выполнить
	•	частично выполнить
	•	отложить
	•	пропустить
	•	заблокировать исполнение
	•	попросить помощь или уточнение

Каждая реакция сохраняется в `sop_executions`.

Важно различать:
	•	`intent_status`
	•	`execution_status`

Пример:
	•	пользователь сказал "сделаю позже" -> это ещё не `done`, а acknowledgement or delayed reaction
	•	пользователь внёс measurement и evidence -> это execution

Дополнительное правило:

`sop_execution` фиксирует реакцию пользователя или outcome, но не заменяет состояние `sop_run`.
Именно engine должен решать, какой run status следует из набора executions и времени.

⸻

Follow-up dialog

SOP engine обязан поддерживать follow-up questions после ответа пользователя.

Follow-up нужен, чтобы:
	•	проверить факт выполнения
	•	собрать обязательные measurements
	•	собрать evidence photo
	•	собрать отклонения и комментарии

Примеры:
	•	"Сделал ли ты промывку?"
	•	"Какой был runoff EC?"
	•	"Есть ли фото после процедуры?"
	•	"Были ли отклонения от протокола?"

Правило:

Если SOP требует `required_inputs_after_execution`, engine не должен считать run fully complete без попытки собрать эти данные.

MVP-упрощение:
	•	если пользователь не дал все required inputs, run может остаться `acknowledged` или считаться partially completed в execution layer
	•	но система должна явно видеть, что доказательств недостаточно

⸻

Reminder policy

Reminder - это не сам run и не execution. Это presentation layer над `sop_runs`.

Engine должен поддерживать напоминания на основе статуса run и времени.

Минимальные reminder states:
	•	upcoming
	•	due now
	•	overdue
	•	escalated

Reminder channels в MVP:
	•	in-app Daily Focus
	•	in-app badge / card
	•	optional push later

Правило:

Нельзя моделировать reminder как единственный источник истины о задаче. Источник истины - это `sop_run`.

Правило:

Reminder policy должна быть идемпотентной.
Один и тот же `sop_run` может быть показан несколько раз, но не должен создавать несколько новых obligations только потому, что пользователь открыл экран несколько раз.

⸻

Приоритизация

Каждый `sop_run` должен иметь приоритет, который влияет на Daily Focus и reminder order.

Минимальные факторы приоритета:
	•	criticality of SOP definition
	•	severity_if_missed
	•	overdue status
	•	current anomaly/risk context
	•	stage criticality

MVP priority labels:
	•	low
	•	normal
	•	high
	•	critical

Priority используется для показа, а не заменяет compliance или risk analysis.

Priority также не заменяет criticality самого SOP.
Приоритет run может изменяться в зависимости от контекста, даже если definition критичность остаётся той же.

⸻

Связь с Event Log

Каждое значимое действие SOP engine должно иметь отражение в event log.

Как минимум:
	•	создание обязательного run -> `sop_due`
	•	достаточное выполнение -> `sop_executed`
	•	пропуск или невыполнение -> `sop_missed`

Дополнительно могут логироваться:
	•	acknowledgement
	•	blocking reason
	•	follow-up outcome

Это позволяет:
	•	использовать SOP в WHY engine
	•	анализировать последствия
	•	связывать compliance с аномалиями и результатами

Правило:

SOP engine не должен существовать вне timeline.

Но также и обратное:

Event log не должен быть единственным механизмом понимания статуса SOP.
События дают историю, а канонический operational state живёт в `sop_runs` и `sop_executions`.

⸻

Связь с AI

SOP влияет на AI минимум в 4 направлениях:

1. Recommendations
	•	AI должен учитывать, выполнен ли relevant SOP

2. Causal analysis
	•	AI может использовать missed or delayed SOP как одну из причин гипотезы

3. Anomaly interpretation
	•	аномалия при выполненном SOP и аномалия при пропущенном SOP интерпретируются по-разному

4. Daily Focus generation
	•	актуальные SOP runs являются обязательной частью assembled context

Правило:

AI не должен silently считать SOP выполненным, если в engine нет соответствующего execution evidence.

AI также не должен самостоятельно менять status SOP.
Он может:
	•	объяснять,
	•	спрашивать,
	•	подсказывать,
но не закрывать `sop_run` как completed без engine-mediated execution.

⸻

Daily Focus integration

SOP - ключевая часть Daily Focus.

Daily Focus должен получать от SOP engine:
	•	задачи на сегодня
	•	просроченные задачи
	•	critical tasks
	•	tasks blocked by missing data or missing execution
	•	объяснение, почему задача появилась

Порядок сортировки в Daily Focus:
	1.	critical overdue SOP
	2.	critical due today
	3.	high priority due today
	4.	acknowledged but not completed items
	5.	normal recurring items

⸻

Compliance metrics

Система должна считать compliance как derived layer, а не руками в UI.

Минимальные метрики:
	•	completion rate
	•	overdue rate
	•	skipped rate
	•	blocked rate
	•	repeated non-compliance
	•	average completion latency

Разрезы compliance:
	•	per farm
	•	per scope
	•	per cycle
	•	per SOP definition
	•	per operator, если доступно

Правило:

Compliance нельзя считать только по факту "есть execution". Нужно учитывать run status, window, skipped, blocked и delayed patterns.

⸻

Escalation policy

Engine должен поддерживать escalation, если SOP долго не исполняется или имеет высокую критичность.

MVP-правила escalation:
	•	critical overdue SOP поднимается выше в Daily Focus
	•	repeated misses повышают severity в presentation layer
	•	blocked critical SOP требует заметной видимости

Escalation в MVP не обязан отправлять внешние уведомления, но обязан менять приоритет и видимость.

⸻

Ownership model

Чтобы не было путаницы между слоями системы, фиксируем ownership:

* SOP engine owns:
	* trigger evaluation
	* run generation
	* status transitions
	* compliance math

* UI owns:
	* display of due / overdue / completed states
	* execution dialog UX
	* reminder presentation

* AI owns:
	* explanation
	* prioritization narrative
	* causal use of SOP history in recommendations

* Event log owns:
	* historical trace of what happened

Если возникает конфликт, источником истины для operational status SOP является engine layer, а не AI text и не reminder UI.

⸻

Пример сценария

Сценарий:
	1.	EC выше нормы.
	2.	Condition-based trigger для flushing SOP становится true.
	3.	Engine проверяет deduplication и applicability.
	4.	Создаётся `sop_run` с `reason_text = high runoff EC`.
	5.	В event log появляется `sop_due`.
	6.	Daily Focus показывает critical task.
	7.	Пользователь отвечает и запускает execution dialog.
	8.	Система спрашивает runoff EC, runoff pH и просит фото.
	9.	Фиксируется `sop_execution`.
	10.	Run становится `completed` или остаётся недозавершённым при нехватке evidence.
	11.	AI потом учитывает этот факт в рекомендациях и causal analysis.

⸻

MVP

Для первой рабочей версии фиксируем safe MVP:
	•	`date_based`
	•	`time_based`
	•	`recurring_daily`
	•	`recurring_interval`
	•	`manual`
	•	базовый `event_based`
	•	`sop_runs`
	•	execution tracking
	•	follow-up questions with required inputs
	•	Daily Focus integration
	•	basic compliance metrics

MVP-ограничения:
	•	`condition_based` и `location_based` разрешены в упрощённом виде
	•	`manual` trigger разрешён как explicit user or manager action
	•	нет сложной adaptive rescheduling
	•	нет AI-generated SOP definitions by default
	•	нет fully autonomous scheduling optimizer

MVP-safe policy:
	•	лучше меньше типов умного поведения, но детерминированно
	•	лучше явно показать overdue, чем silently reschedule

⸻

Что должно быть детерминированным

Следующие части engine должны быть максимально rule-based:
	•	trigger evaluation
	•	run generation
	•	deduplication
	•	status transitions
	•	overdue detection
	•	priority calculation baseline
	•	compliance metrics

LLM может помогать только в дополнительном слое:
	•	объяснить пользователю, зачем нужен SOP
	•	сформулировать follow-up dialog мягче
	•	объяснить missed SOP в context of AI assistant

Правило:
	•	LLM не должен решать, создавать ли `sop_run`
	•	LLM не должен решать, считается ли SOP выполненным

⸻

Тестируемость

SOP engine должен быть тестируемым без AI.

Минимальные test scenarios:
	•	recurring trigger создаёт ровно один run на период
	•	event-based trigger не дублирует run на один и тот же event
	•	condition-based trigger не спамит одинаковыми run при уже открытом run
	•	overdue вычисляется корректно при due window
	•	blocked execution не считается completed
	•	missing required inputs не даёт falsely complete execution
	•	Daily Focus получает runs в правильном порядке
	•	compliance aggregates корректно отражают skipped / overdue / done

⸻

Не-цели этого ADR

ADR-006 не фиксирует:
	•	конкретный UI layout SOP screens
	•	финальный формат push notifications
	•	точную SQL реализацию trigger evaluator
	•	конкретный cron schedule background jobs
	•	политику AI-generated SOP authoring

Это будет вынесено в implementation docs.

⸻

Будущее развитие
	•	адаптивные SOP
	•	AI-assisted SOP authoring
	•	умная rescheduling policy
	•	cross-cycle optimization
	•	operator-specific coaching based on compliance history

Это future layer, а не основание архитектуры.

⸻

Последствия

Плюсы
	•	SOP становится реальным engine, а не статическим документом
	•	Daily Focus получает операционное ядро
	•	AI получает надёжный signal о discipline and execution
	•	compliance становится измеримым
	•	why engine получает причинный материал о выполненных и пропущенных действиях

Минусы
	•	нужно проектировать больше background logic
	•	есть риск переусложнить trigger semantics
	•	нужно аккуратно реализовывать deduplication и status transitions
	•	слишком агрессивные reminders могут раздражать пользователя

Риски
	•	если run generation будет шумным, пользователи перестанут доверять SOP
	•	если completion semantics будут слишком мягкими, compliance потеряет смысл
	•	если engine не будет хорошо связан с Daily Focus, SOP снова станет "отдельным модулем"
	•	если scope resolution будет неверной, регламенты начнут срабатывать не там

⸻

Итог

SOP Engine в Growlog AI - это операционная система действий фермы, где регламент из документа превращается в конкретное обязательство, проходит через execution dialog, отражается в timeline, влияет на AI и заканчивается measurable compliance signal.

⸻

Короткая формулировка

Growlog AI использует event-driven SOP engine, который детерминированно оценивает trigger conditions, создаёт `sop_runs`, отслеживает `sop_executions`, управляет reminders и compliance, связывает действия с результатами и интегрируется с Daily Focus и AI для анализа и рекомендаций.
