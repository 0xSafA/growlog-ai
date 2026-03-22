ADR-007: Growlog AI - Report Generation Pipeline

Статус: Proposed
Дата: 2026-03-22
Автор: A. Safiulin, OG Lab.
Связан с: ADR-001, ADR-002, ADR-003, ADR-004, ADR-005, ADR-006

⸻

Контекст

Growlog AI задуман не только как операционный журнал и AI-ассистент, но и как система, которая умеет превращать историю выращивания в понятные, красивые и полезные отчёты.

Это важно по нескольким причинам:

1. Операционная ценность
	•	руководитель должен быстро понимать, что происходит сейчас
	•	гровер должен видеть итоги дня, периода и цикла
	•	команда должна иметь прозрачную историю действий, отклонений и решений

2. Аналитическая ценность
	•	отчёт должен собирать в одном месте ключевые события, параметры, фото, SOP, аномалии и выводы AI
	•	отчёт должен помогать понять причинно-следственные связи
	•	отчёт должен быть пригоден для ретроспективы и обучения

3. Публикационная ценность
	•	гроверы любят формировать Grow Report как историю цикла
	•	продукт должен помогать готовить отчёты для публикации на сайте, в комьюнити, на внешних платформах и в личном архиве
	•	отчёты должны усиливать ценность Growlog AI как продукта и как контентного движка

4. Доверие к AI
	•	отчёт не должен быть просто красивым текстом
	•	он должен быть grounded, воспроизводимым и проверяемым
	•	пользователь должен понимать, из каких фактов собран итоговый narrative

`ADR-001` уже зафиксировал, что reports - одна из продуктовых целей.
`ADR-002` уже зафиксировал сущности `reports` и `report_artifacts`.
`ADR-003` зафиксировал retrieval как основу context assembly.
`ADR-004` зафиксировал trust layer для AI-generated blocks.
`ADR-005` зафиксировал `Reports` как отдельный UI mode, связанный с timeline, а не отдельный мир.
`ADR-006` зафиксировал, что SOP history и compliance должны быть частью операционной картины.

Теперь нужно зафиксировать сам report engine:

как именно история выращивания превращается в reproducible report artifact.

⸻

Проблема

Если отчёты генерируются как "один большой текст по запросу", возникают проблемы:
	•	теряется связь с исходными данными
	•	сложно понять, почему в отчёте появились те или иные выводы
	•	фото вставляются хаотично
	•	повторная генерация может давать слишком разные результаты
	•	отчёты трудно адаптировать под разные аудитории
	•	менеджерский отчёт, цикл-отчёт и публичный grow report начинают смешиваться

Если же отчёт делать только как жёсткий export из базы, он становится сухим, неудобным и не даёт продукту narrative ценности.

Нужен pipeline, который одновременно:
	•	строит отчёт из фактов и структурированных блоков
	•	умеет добавлять narrative и story mode
	•	поддерживает разные типы отчётов
	•	работает воспроизводимо
	•	отделяет internal report от public publication
	•	разделяет report intent, report audience и output format

Главный вывод:

Отчёт в Growlog AI должен моделироваться как многошаговый pipeline сборки артефактов, а не как "текстовый ответ модели" и не как "простая выгрузка из БД".

⸻

Основное решение

Мы принимаем архитектуру:

structured, grounded, multi-stage report generation pipeline

Отчёт в Growlog AI - это не просто текст и не просто export.
Это собранный артефакт, который создаётся в несколько этапов:
	1.	определение intent, audience и output format
	2.	сбор context package
	3.	сбор structured report blocks
	4.	генерация narrative layer
	5.	отбор и компоновка фото
	6.	формирование output artifacts
	7.	сохранение, просмотр, публикация или экспорт

Ключевое правило:

`report` - это канонический объект сборки и хранения.
`report_artifact` - это конкретный output в формате HTML, PDF, preview image или ином представлении.

Нельзя смешивать:
	•	type of report
	•	audience
	•	format
	•	publication target

⸻

Канонические сущности report engine

### 1. Report Request

Концептуальный запрос на генерацию отчёта.

Он определяет:
	•	что за отчёт нужен
	•	для кого он нужен
	•	за какой период
	•	в каком scope
	•	какие форматы нужно построить

В MVP request не обязан быть отдельной таблицей, но обязан существовать как каноническое понятие pipeline.

### 2. Report

`Report` - это persisted сущность, которая хранит:
	•	тип отчёта
	•	scope
	•	период
	•	summary
	•	narrative draft
	•	structured report_json
	•	status

### 3. Report Artifact

`Report Artifact` - это render output:
	•	HTML
	•	PDF
	•	preview image
	•	JSON export

### 4. Report Block

Концептуальный строительный блок отчёта.

Он может быть:
	•	factual block
	•	metrics block
	•	SOP block
	•	anomaly block
	•	photo block
	•	narrative block
	•	appendix block

В MVP blocks могут храниться внутри `report_json`, а не отдельной таблицей, но в архитектуре они считаются first-class building units.

### 5. Publication Layer

Публичная выдача и экспорт не являются частью core report assembly. Это отдельный слой после генерации и optional manual review.

⸻

Канонические измерения report engine

Чтобы не путать разные оси отчёта, фиксируем 4 независимых измерения.

### 1. Report Type

Это бизнес-тип отчёта. Он должен быть согласован с `ADR-002`.

Канонические `report_type`:
	•	`daily`
	•	`cycle`
	•	`manager`
	•	`public_html`
	•	`pdf`

Правило:

`public_html` и `pdf` в `ADR-002` зафиксированы как допустимые `report_type`, даже если фактически они часто ведут себя как artifact-oriented modes. Это нужно уважать в реализации.

Дополнительное уточнение:
	•	`weekly` не является отдельным каноническим `report_type`
	•	weekly report должен моделироваться как шаблон или preset периода внутри `daily` или `manager` style pipeline, а не как отдельный новый базовый тип

### 2. Audience Type

Канонические audience types:
	•	`internal_operational`
	•	`internal_management`
	•	`public_community`
	•	`archive_personal`

### 3. Scope

Report scope может быть:
	•	farm
	•	site
	•	zone
	•	cycle
	•	plant_group
	•	plant

### 4. Output Format

Output format может быть:
	•	html
	•	pdf
	•	both
	•	preview_only

⸻

Цели pipeline

Pipeline должен обеспечивать:
	•	единый способ построения разных отчётов
	•	повторяемость и воспроизводимость
	•	grounded content
	•	поддержку narrative mode
	•	красивый HTML output
	•	качественный PDF output
	•	отдельную логику для public publication
	•	возможность ручной доработки перед публикацией
	•	ясное разделение internal и public representations

⸻

Принципы построения отчёта

Канонические принципы:
	•	reports are assembled, not improvised
	•	facts before narrative
	•	visuals are curated, not dumped
	•	one source of truth = underlying data spine
	•	public and internal reports are different products
	•	regeneration should be reproducible
	•	manual review is allowed, but must not destroy grounding

⸻

Канонический report pipeline

### Stage 1. Report Request Definition

Сначала определяется:
	•	`report_type`
	•	`audience_type`
	•	`scope`
	•	`time_window`
	•	`output_format`
	•	`publication_target`, если нужен

Вход может идти:
	•	от пользователя вручную
	•	автоматически по расписанию
	•	автоматически в конце цикла
	•	как follow-up после крупного события

Правило:

Если request не определяет scope и период, pipeline не должен silently подставлять случайные значения.

### Stage 2. Context Retrieval

Контекст собирается через retrieval architecture из ADR-003.

В зависимости от типа отчёта retrieval должен доставать:
	•	relevant events
	•	observations
	•	actions
	•	sensor summaries
	•	daily summaries
	•	anomalies
	•	SOP runs and executions
	•	photo analyses
	•	grow memory items
	•	relevant AI insights

Для отчётов не обязательно использовать весь raw timeline.
Предпочтение отдаётся:
	•	daily summaries
	•	key events
	•	anomaly events
	•	decisive actions
	•	stage transitions
	•	high-signal photo entries

Правило:

Report pipeline не должен сам придумывать отдельный parallel retrieval mechanism. Он использует и расширяет ADR-003.

### Stage 3. Structured Block Assembly

Отчёт должен строиться из блоков, а не генерироваться сразу как сплошной текст.

Базовые блоки:
	1.	Header block
	•	название
	•	период
	•	scope
	•	стадия / статус цикла

	2.	Executive summary block
	•	главное за период

	3.	Key metrics block
	•	релевантные метрики и snapshots

	4.	Timeline highlights block
	•	ключевые события и действия

	5.	Issues / anomalies block
	•	отклонения, риски, необычные паттерны

	6.	SOP compliance block
	•	что нужно было сделать
	•	что выполнено
	•	что пропущено / просрочено

	7.	Photo block
	•	отобранные фото
	•	подписи
	•	группировка

	8.	WHY / causal block
	•	объяснение причин крупных изменений

	9.	Recommendations / next steps block
	•	что делать дальше

	10.	Narrative story block
	•	история периода или цикла человеческим языком

	11.	Appendix block
	•	детальные таблицы
	•	дополнительные фото
	•	дополнительные пояснения

Не каждый тип отчёта обязан использовать все блоки.
Система должна иметь templates по типам отчётов.

### Stage 4. Narrative Layer

Narrative генерируется как отдельный слой поверх factual blocks.

Narrative должен:
	•	опираться на timeline
	•	опираться на stage transitions
	•	использовать ключевые фото
	•	учитывать anomalies и responses
	•	быть grounded
	•	не выдумывать отсутствующие детали

Правила narrative generation:
	•	narrative не должен противоречить фактам
	•	factual blocks имеют приоритет над красивым стилем
	•	system may generate engaging prose, but only on top of verified facts
	•	narrative для public report может быть более плавным и эстетичным, чем для internal report

### Stage 5. Photo Selection and Layout Preparation

Фото - ключевая часть Grow Report, но они не должны вставляться как длинная необработанная лента.

Цели:
	•	отобрать самые информативные и эстетичные изображения
	•	избежать повторов
	•	показать динамику
	•	сохранить читаемость отчёта

### Stage 6. Artifact Rendering

Structured blocks + narrative + selected media превращаются в render artifacts.

### Stage 7. Review, Save, Publish

После генерации отчёт может:
	•	остаться internal
	•	быть отредактирован
	•	быть экспортирован в HTML или PDF
	•	пройти sanitization и publication flow

⸻

Report Templates

Для каждого типа отчёта выбирается шаблон.

### Daily Template

Использует:
	•	header
	•	executive summary
	•	key metrics snapshot
	•	top events
	•	SOP for today / tomorrow
	•	risks
	•	next actions

### Manager Template

Использует:
	•	header
	•	executive summary
	•	current status
	•	top risks
	•	overdue SOP
	•	anomalies
	•	concise next steps

### Cycle Template

Использует:
	•	header
	•	cycle summary
	•	stage timeline
	•	metric trends
	•	important events
	•	anomalies and resolutions
	•	SOP compliance
	•	photo story
	•	final retrospective

### Public Grow Report Template

Использует:
	•	hero block
	•	narrative introduction
	•	cycle journey
	•	photo highlights
	•	key turning points
	•	lessons learned
	•	hidden gallery / accordion sections

⸻

Audience policy

Pipeline должен учитывать аудиторию.

### `internal_operational`

Для гроверов и команды.

Приоритет:
	•	факты
	•	действия
	•	SOP
	•	next steps

### `internal_management`

Для владельца / операционного менеджера.

Приоритет:
	•	executive summary
	•	risk framing
	•	overdue SOP
	•	short action points

### `public_community`

Для комьюнити, сайта, форума, внешних платформ.

Приоритет:
	•	narrative readability
	•	photo presentation
	•	lessons learned
	•	sanitized operational detail

### `archive_personal`

Для личного архива.

Приоритет:
	•	полнота истории
	•	доступность raw context
	•	воспроизводимость

⸻

Photo Selection Pipeline

Фото оцениваются по нескольким критериям:
	•	relevance to period / stage
	•	relation to key events
	•	relation to anomalies or improvements
	•	visual quality
	•	diversity
	•	suitability for cover / hero / collage / appendix

Категории ролей фото:
	•	hero
	•	highlight
	•	evidence
	•	collage
	•	appendix
	•	hidden_gallery

Правило:

Photo selection - это curated layer. Нельзя просто сортировать по времени и вставлять всё подряд.

⸻

PDF Generation Logic

PDF должен быть пригоден для:
	•	отправки
	•	печати
	•	архивирования
	•	презентации результатов

Требования к PDF:
	•	аккуратная титульная часть
	•	чёткая блоковая структура
	•	хорошие отступы и читаемость
	•	таблицы только там, где они реально полезны
	•	изображения не как бесконечная портянка, а как коллажи и тематические блоки

Правило фото в PDF:
	•	1-2 ключевых full-width изображения максимум на крупный раздел
	•	остальные фото - через коллажи и компактную компоновку

⸻

HTML Report Logic

HTML-отчёт - это отдельный продукт, а не просто "тот же PDF в браузере".

Требования к HTML report:
	•	адаптивность
	•	красивый layout
	•	удобное чтение на телефоне и десктопе
	•	narrative-first структура
	•	возможность скрывать большие блоки фото

Специальное решение по фото:

Для HTML-отчёта принимается решение:

фото могут быть размещены в скрытых аккордеонах / collapsible sections

Это позволяет:
	•	не перегружать страницу
	•	сохранить красивую narrative подачу
	•	всё же давать доступ к full photo archive по нажатию

HTML block types:
	•	hero section
	•	summary section
	•	metric cards
	•	timeline highlights
	•	anomaly cards
	•	SOP cards
	•	gallery accordion
	•	lessons learned section

⸻

Grounding and trust in reports

Поскольку Growlog AI строится вокруг доверия, отчёты должны быть grounded.

Это означает:
	1.	основные выводы должны опираться на реальные данные
	2.	крупные рекомендации должны быть связаны с evidence
	3.	narrative не должен создавать ложное впечатление certainty
	4.	при недостатке данных отчёт должен это явно показывать

Внутри pipeline должно поддерживаться различие между:
	•	observed facts
	•	derived metrics
	•	detected patterns
	•	AI interpretations
	•	recommendations
	•	narrative framing

Это особенно важно для manager reports и cycle reports.

Правило:

Report pipeline не должен ослаблять trust rules из ADR-004 только потому, что output выглядит как документ, а не как чат-ответ.

⸻

Reproducibility and versioning

Каждый отчёт должен быть воспроизводимым.

Для этого сохраняется:
	•	template type
	•	period
	•	scope
	•	selected inputs
	•	selected media
	•	generated blocks
	•	narrative version
	•	output artifacts

Последствие:

Повторная генерация не обязана быть bit-for-bit идентичной, но должна быть:
	•	объяснимой
	•	близкой по структуре
	•	привязанной к тем же исходным данным, если input не изменился

Правило:

Если данные не изменились, regenerated report не должен внезапно менять базовый storyline или набор ключевых фактов.

⸻

Manual review and editing

Pipeline должен позволять ручную доработку отчёта.

Пользователь или менеджер может:
	•	отредактировать title
	•	заменить summary
	•	убрать или добавить фото
	•	скрыть отдельные блоки
	•	отредактировать public-facing text
	•	выбрать другой narrative tone

Решение:

AI генерирует draft, а не принудительно финальный immutable артефакт.

Правило:

Ручная редактура не должна уничтожать связь отчёта с source data. Manual changes должны считаться отдельным слоем над generated draft.

⸻

Publication pipeline

После генерации отчёт может:
	•	остаться internal
	•	быть опубликован как HTML page
	•	быть экспортирован как PDF
	•	быть отправлен на external target через publication adapter

Publication targets:
	•	internal project page
	•	public grow page
	•	external community platform
	•	partner portal
	•	future integrations

Правило:

Публичная публикация никогда не должна автоматически раскрывать:
	•	внутренние служебные данные
	•	приватные operational notes
	•	внутренние SOP
	•	чувствительные метрики, если они не предназначены для публикации

Поэтому public pipeline должен иметь отдельный sanitization layer.

⸻

Sanitization layer for public reports

Для `public_community` и public-oriented report modes принимается отдельное решение:

public reports must pass a sanitization and publication filter

Фильтр должен:
	•	убирать внутренние идентификаторы
	•	скрывать внутренние служебные замечания
	•	убирать чувствительные operational details
	•	ограничивать technical depth там, где это нужно
	•	сохранять narrative ценность и эстетическую подачу

Правило:

Sanitization - это отдельная архитектурная стадия. Нельзя считать, что public report получается автоматически из internal report без преобразования.

⸻

Ownership model

Чтобы не было путаницы между слоями системы, фиксируем ownership.

* Report engine owns:
	* request definition
	* block assembly
	* artifact generation
	* reproducibility metadata

* Retrieval layer owns:
	* context collection for report inputs

* AI layer owns:
	* summary prose
	* narrative blocks
	* confidence-aware textual framing

* UI layer owns:
	* report list
	* draft review flow
	* manual edit interactions
	* publish flow UX

* Publication layer owns:
	* sanitization
	* target-specific publishing

Правило:

Если возникает конфликт, источником истины о содержимом и его происхождении является report engine + source data, а не финальная красивая HTML-страница.

⸻

Integration with other ADRs

ADR-003 Retrieval

Используется для сборки контекста отчёта.

ADR-004 Insight Pipeline

Используется для:
	•	summaries
	•	anomalies
	•	recommendations
	•	story blocks
	•	confidence-aware text

ADR-005 UX

Определяет:
	•	report mode
	•	report list
	•	manual edit flow
	•	publish flow

ADR-006 SOP Engine

Даёт:
	•	compliance section
	•	overdue items
	•	executed actions
	•	process discipline narrative

⸻

Что должно быть детерминированным

Следующие части report pipeline должны быть максимально rule-based:
	•	report request validation
	•	scope and period resolution
	•	block selection by template
	•	photo role assignment baseline
	•	artifact type generation
	•	public sanitization rules
	•	reproducibility metadata persistence

Следующие части могут использовать LLM:
	•	executive summary prose
	•	narrative story mode
	•	lessons learned wording
	•	public-facing copy polishing

Правило:
	•	LLM помогает сформулировать отчет красиво
	•	но не должен подменять deterministic assembly structure

⸻

MVP scope

На первом этапе pipeline должен поддерживать:
	•	`daily`
	•	`manager`
	•	`cycle`
	•	HTML output
	•	PDF output
	•	базовый photo selection
	•	базовый collage layout
	•	базовый narrative draft
	•	manual review before publication

В MVP можно упростить:
	•	без сложного adaptive layout engine
	•	без внешних publication adapters
	•	без глубокой version history editing
	•	без глубокой персонализации tone per audience
	•	без fully automated social publishing

MVP-safe policy:
	•	лучше стабильный и grounded отчёт, чем супер-красивый, но плохо объяснимый
	•	лучше curated photo selection, чем полная dump gallery

⸻

Тестируемость

Report pipeline должен быть тестируемым не только по качеству финального текста.

Минимальные test scenarios:
	•	одинаковый request на одинаковом input даёт структурно близкий отчёт
	•	public sanitization скрывает internal-only fields
	•	manager report не уходит в слишком длинный narrative mode
	•	cycle report включает stage timeline и SOP compliance
	•	public report не dump-ит все фото подряд
	•	missing data отражается в blocks, если важных данных не хватает
	•	selected media имеет roles и не дублируется бессмысленно

Качество pipeline оценивается по:
	•	корректности block assembly
	•	корректности source grounding
	•	читаемости artifacts
	•	разделению internal vs public outputs

⸻

Future extensions

В будущем pipeline может быть расширен:
	•	автоматическим сравнением нескольких циклов
	•	benchmarking against past grows
	•	multi-cycle retrospective reports
	•	experiment reports
	•	social/community-friendly templates
	•	branded templates
	•	interactive embedded charts
	•	auto-generated landing pages for each grow

Это future layer, а не основание архитектуры.

⸻

Последствия

Положительные
	•	Growlog AI получает мощный output layer
	•	продукт становится полезным не только во время цикла, но и после него
	•	появляется ценность для менеджеров, команды и комьюнити
	•	grow reports становятся естественным продолжением журнала, а не отдельной фичей
	•	усиливается дифференциация продукта

Отрицательные
	•	pipeline генерации отчётов заметно сложнее обычного export
	•	потребуется careful design для HTML/PDF layouts
	•	понадобится logic для отбора и компоновки фото
	•	public/private branching добавляет сложность

Риски
	•	если report type, audience и format смешать в одной оси, реализация быстро станет хаотичной
	•	если narrative layer начнёт доминировать над factual blocks, доверие упадёт
	•	если sanitization будет формальной, публичные отчёты могут утекать лишние данные
	•	если report engine не будет воспроизводимым, пользователи не смогут ему доверять как артефакту истории

⸻

Что не фиксируется этим ADR

ADR-007 не фиксирует:
	•	конкретный UI редактора отчётов
	•	конкретную библиотеку для PDF rendering
	•	окончательный visual design HTML templates
	•	финальную стратегию публикации на внешние платформы
	•	полный набор branded themes

Это может быть вынесено в implementation docs или последующие ADR.

⸻

Итог

Report Engine в Growlog AI - это grounded pipeline, который превращает историю выращивания в воспроизводимый артефакт из structured blocks, narrative layer и curated visuals, сохраняя связь с source data, поддерживая manual review и разделяя internal и public outputs.

⸻

Короткая формулировка решения

Growlog AI использует grounded multi-stage report generation pipeline, который собирает отчёты из структурированных блоков, AI insights, фото и timeline данных, разделяет report type, audience и format, поддерживает narrative story mode, генерирует HTML и PDF artifacts и проводит public-oriented outputs через отдельный sanitization and publication layer.
