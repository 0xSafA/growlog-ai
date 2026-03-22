ADR-003: Growlog AI — Retrieval and Context Assembly Architecture

Статус: Proposed
Дата: 2026-03-22
Автор: A. Safiulin, OG Lab.
Связан с: ADR-001, ADR-002, ADR-004, ADR-005

⸻

Контекст

`ADR-001` зафиксировал, что Growlog AI должен отвечать не как "общий чат про выращивание", а как ассистент, опирающийся на обновляемую модель конкретной фермы.

`ADR-002` зафиксировал, что для этого у нас уже есть event-centered data model:
	•	`events`
	•	`observations`
	•	`actions_log`
	•	`sensor_readings`
	•	`media_assets`
	•	`photo_analysis`
	•	`sop_runs`
	•	`sop_executions`
	•	`ai_insights`
	•	`grow_memory_items`
	•	`knowledge_items`
	•	`searchable_documents`

Но сама по себе хорошая схема данных не гарантирует хорошие ответы. Между вопросом пользователя и ответом модели должен существовать явный retrieval pipeline, который:
	•	понимает, о чём именно пользователь спрашивает,
	•	понимает, к какой ферме / циклу / scope относится вопрос,
	•	собирает только релевантные данные,
	•	отделяет факты от интерпретаций,
	•	компрессирует контекст до безопасного и полезного размера,
	•	при нехватке данных не заставляет модель фантазировать.

Главная цель ADR:

Зафиксировать retrieval и context assembly так, чтобы даже слабая модель или новый разработчик смогли реализовать grounded AI-ответы без архитектурной импровизации.

⸻

Проблема

Без продуманного retrieval возникают 4 класса ошибок:

1. Missing context
	•	ответ строится по последнему сообщению, а не по реальной истории фермы
	•	игнорируются сенсоры, SOP, фото и исторические кейсы

2. Wrong context
	•	берётся не тот цикл
	•	берётся не тот scope
	•	берётся устаревший или нерелевантный фрагмент истории

3. Noisy context
	•	в prompt попадает слишком много данных
	•	полезные сигналы теряются среди шума
	•	ответ становится общим и расплывчатым

4. Unsafe inference
	•	система делает выводы без evidence
	•	опасные рекомендации выдаются при низкой уверенности
	•	невозможно объяснить пользователю "почему"

Главный вывод:

В Growlog AI retrieval является не вспомогательной функцией, а обязательным слоем между данными и любой AI-генерацией.

⸻

Основное решение

Мы принимаем архитектуру:

retrieval-first, scope-aware, layered context assembly

Ключевое правило:

AI не отвечает напрямую из пользовательского текста. Любой ответ, совет, summary, WHY explanation или report generation начинается с явной сборки контекста.

Это означает:
	•	no context -> no answer
	•	wrong scope -> stop and clarify
	•	facts before interpretations
	•	recent + relevant > everything
	•	context is assembled in stages, not by one naive search

⸻

Принципы retrieval

1. Scope before semantics

Сначала система понимает "для какой части фермы вопрос", а уже потом "что именно искать".

2. Facts before AI artifacts

Приоритет контекста:
	•	raw events
	•	structured observations/actions/readings
	•	SOP state
	•	photo and photo analysis
	•	derived insights
	•	knowledge base

3. Time matters

Для operational вопросов недавние данные важнее старых.

4. Historical analogs are optional, not default noise

Исторические циклы и похожие кейсы подключаются только тогда, когда они действительно помогают ответить.

5. Knowledge supplements farm reality, not replaces it

Curated knowledge нужна как профессиональная опора, но не должна перекрывать реальные факты по ферме.

6. If uncertainty is high, ask before advising

Если retrieval не смог собрать достаточный evidence set, система должна задать уточняющий вопрос вместо прямого совета.

⸻

Типы запросов пользователя

Система обязана классифицировать запрос хотя бы в один основной intent:

1. Status
	•	что происходит сейчас
	•	какое текущее состояние цикла / растения / зоны

2. Causal
	•	почему это произошло
	•	что, вероятно, вызвало проблему или изменение

3. Action
	•	что делать сейчас
	•	какой следующий шаг

4. Planning
	•	что будет если
	•	как лучше спланировать действие или этап

5. Report
	•	собери отчёт
	•	сделай recap / summary / grow report section

6. Exploration
	•	покажи, найди, перечисли, сравни

7. SOP execution dialog
	•	диалог по регламенту
	•	подтверждение, перенос, блокировка, follow-up questions

8. Daily focus
	•	что важно сегодня
	•	что просрочено
	•	на что обратить внимание на месте

Один запрос может иметь secondary intent, но pipeline обязан выбрать один primary intent для сборки контекста.

⸻

Канонические входы retrieval pipeline

Каждый retrieval run обязан получить или определить:
	•	`farm_id`
	•	`user_id`
	•	`query_text`
	•	`conversation_id` или session context, если есть
	•	`cycle_id`, если пользователь уже находится внутри цикла
	•	`scope_id`, если пользователь уже находится внутри scope
	•	`requested_time_window`, если пользователь явно указал период

Если `farm_id` не определён, retrieval run не должен продолжаться.

⸻

Context Assembly Pipeline

Контекст собирается по фиксированным стадиям.

### Stage 1. Access and scope resolution

Система должна определить:
	•	к какой ферме относится запрос
	•	какой активный цикл выбран по UI context
	•	есть ли явный `scope_id`
	•	если `scope_id` не задан, нужно ли вывести его из текста или из текущего экрана

Результат stage:
	•	`farm_id`
	•	`cycle_id | null`
	•	`scope_id | null`
	•	`time_window`
	•	`needs_clarification boolean`

Правило:

Если вопрос многозначен и есть несколько одинаково вероятных scope, pipeline обязан вернуть `needs_clarification = true`.

### Stage 2. Intent classification

Система определяет:
	•	primary intent
	•	secondary intents
	•	diagnostic risk level
	•	требуется ли answer или достаточно retrieval-only output для UI

Результат stage:
	•	`intent_type`
	•	`sub_intents[]`
	•	`requires_historical_context`
	•	`requires_knowledge_context`
	•	`requires_sop_context`
	•	`requires_photo_context`

### Stage 3. Core context retrieval

Это обязательный слой, который включается почти всегда.

Нужно собрать:
	•	текущий cycle summary
	•	последние события по `scope_id` / `cycle_id`
	•	последние sensor snapshots или readings
	•	последние связанные фото
	•	текущую stage цикла
	•	открытые и overdue SOP runs

Если часть этих слоёв отсутствует, это не ошибка пайплайна, но должно быть явно отражено в output как `missing_data`.

### Stage 4. Intent-specific expansion

Дальнейший retrieval зависит от типа вопроса.

Status:
	•	последние события
	•	текущие метрики
	•	последние фото
	•	open anomalies

Causal:
	•	события перед инцидентом
	•	сенсорная динамика
	•	SOP compliance
	•	anomalies
	•	causal_links
	•	релевантные photo signals

Action:
	•	open/overdue SOP
	•	история последних действий
	•	похожие успешные кейсы
	•	grow memory
	•	curated knowledge

Planning:
	•	stage timeline
	•	historical analogs
	•	grow memory
	•	SOP templates
	•	curated knowledge

Report:
	•	full timeline in selected period
	•	daily summaries
	•	photo candidates
	•	key insights
	•	stage transitions

Exploration:
	•	поиск по `searchable_documents`
	•	поиск по timeline
	•	выдача отфильтрованных records для UI

SOP execution dialog:
	•	current SOP run
	•	trigger reason
	•	required follow-up inputs
	•	last related execution
	•	recent evidence in same scope

Daily focus:
	•	SOP due today
	•	overdue SOP
	•	новые anomalies
	•	важные изменения с прошлого визита
	•	1-3 ключевые risks

### Stage 5. Historical analog retrieval

Исторический слой подключается не всегда.

Он нужен, когда:
	•	вопрос causal или planning
	•	нужен "похожий кейс"
	•	нужно понять, повторяется ли паттерн

Источники:
	•	прошлые циклы той же фермы
	•	grow_memory_items
	•	связанные ai insights типа `pattern`

Правило:

Исторический слой не должен подменять текущую реальность. Он только расширяет контекст.

### Stage 6. Knowledge retrieval

Подключается, если нужен профессиональный контекст:
	•	knowledge_items
	•	релевантные SOP definitions
	•	curated sources

Правило:
	•	knowledge retrieval не должен вытеснять farm-specific context
	•	если реальность фермы противоречит общей рекомендации, ответ обязан сначала описать факты фермы

### Stage 7. Compression and packaging

После сборки сырых слоёв контекста pipeline обязан:
	•	удалить дубли
	•	схлопнуть шумные повторения
	•	сгруппировать однотипные события
	•	ограничить число записей по каждому блоку
	•	сформировать compact assembly object

Именно этот объект передаётся в LLM.

⸻

Context layers

Контекст должен быть организован слоями.

Layer 1 — Immediate
	•	последние 24-72 часа
	•	главный слой для operational ответов

Layer 2 — Current cycle
	•	весь текущий цикл или его релевантная часть
	•	нужен для status, action, report

Layer 3 — Historical cycles
	•	раньше происходившие похожие случаи
	•	нужен для causal и planning

Layer 4 — Knowledge base
	•	curated docs, SOP knowledge, professional practices

Порядок приоритета:
	1. Immediate
	2. Current cycle
	3. Historical
	4. Knowledge

⸻

Retrieval sources

Система использует несколько источников retrieval, и они имеют приоритеты.

Primary sources:
	•	SQL queries against source tables
	•	precomputed summaries
	•	`searchable_documents`

Secondary sources:
	•	`ai_insights`
	•	`grow_memory_items`
	•	`causal_links`

Optional future layer:
	•	embeddings / vector search

Главное правило:

SQL и explicit filters являются primary mechanism. Vector search не должен быть обязательным для первой рабочей версии.

⸻

Ranking and relevance

Каждый candidate context item должен иметь score.

Минимальные компоненты score:
	•	time relevance
	•	entity match
	•	scope match
	•	intent match
	•	semantic relevance
	•	anomaly weight
	•	SOP importance
	•	trust weight

Пример формулы не фиксируется жёстко, но логика фиксируется:
	•	совпадение по `scope_id` важнее простого semantic similarity
	•	недавние критичные аномалии важнее старых нейтральных заметок
	•	overdue SOP weight повышает приоритет контекста для action/daily focus

⸻

Канонический набор retrieval блоков

Каждый assembled context должен использовать одинаковые логические блоки. Это снижает хаос в prompt-building и упрощает тестирование.

Обязательные блоки:
	•	`request`
	•	`scope`
	•	`current_state`
	•	`recent_events`
	•	`sensor_context`
	•	`photo_context`
	•	`sop_context`
	•	`anomaly_context`
	•	`historical_context`
	•	`memory_context`
	•	`knowledge_context`
	•	`missing_data`
	•	`guardrails`

Не все блоки обязаны быть заполнены, но ключи должны быть стабильными.

⸻

Assembly output format

Контекст передаётся в AI не как сырые SQL rows, а как нормализованный object.

Каноническая форма:

```json
{
  "request": {
    "query_text": "Почему листья поникли?",
    "intent_type": "causal"
  },
  "scope": {
    "farm_id": "uuid",
    "cycle_id": "uuid",
    "scope_id": "uuid",
    "time_window": {
      "from": "2026-03-19T00:00:00Z",
      "to": "2026-03-22T12:00:00Z"
    }
  },
  "current_state": {
    "cycle_stage": "flower",
    "summary": "Week 5 flower, medium stress signals"
  },
  "recent_events": [],
  "sensor_context": [],
  "photo_context": [],
  "sop_context": [],
  "anomaly_context": [],
  "historical_context": [],
  "memory_context": [],
  "knowledge_context": [],
  "missing_data": [],
  "guardrails": {
    "must_not_claim_without_evidence": true,
    "must_ask_clarifying_question_if_scope_ambiguous": true
  }
}
```

Правило:
	•	этот формат должен быть единым для answer generation, WHY generation и daily focus generation
	•	report generation может использовать расширенный superset этого объекта

⸻

Guardrails

Retrieval pipeline обязан сам обеспечивать безопасные ограничения до генерации ответа.

Обязательные guardrails:
	•	не отвечать без хотя бы минимального context package
	•	не отвечать без `farm_id`
	•	не давать конкретную диагностику при ambiguous scope
	•	не выдавать action advice без попытки собрать SOP и recent actions
	•	не генерировать causal answer без события/сигнала, который объясняется
	•	при недостатке данных формировать `missing_data` и уточняющий вопрос

Специальное правило для diagnostic questions:

Если intent = `causal` или `action` и тема похожа на проблему/дефицит/болезнь, assembled context обязан содержать:
	•	минимум один recent event или observation
	•	минимум один текущий signal: sensor, photo, SOP status или anomaly

Если этого нет, safe output должен быть:
	•	"данных недостаточно"
	•	"вот что нужно уточнить"

⸻

Fallback policy

Если retrieval не может уверенно определить scope:
	•	не пытаемся угадать silently
	•	возвращаем clarify question

Если нет current cycle:
	•	используем farm-level context только для общих вопросов
	•	не даём конкретные farm-action советы без уточнения цикла

Если сенсорных данных нет:
	•	не считаем это ошибкой
	•	но явно помечаем как missing evidence

Если фото есть, но нет photo analysis:
	•	можно передать сами фото metadata и captions
	•	не выдумывать визуальные сигналы без анализа

⸻

Performance strategy

Retrieval должен быть полезным, но не тяжёлым.

MVP performance rules:
	•	сначала SQL-only retrieval
	•	использовать `daily_timelines`, `sensor_snapshots`, `daily_focus_cards`, если они уже есть
	•	ограничивать количество raw events
	•	использовать fixed retrieval windows по intent

Рекомендуемые лимиты для MVP:
	•	recent events: 20-50
	•	recent readings/snapshots: 10-30
	•	photos: 3-12
	•	historical analogs: 3-10
	•	knowledge items: 3-8

Эти числа не являются продуктовой истиной, но служат safe defaults.

⸻

MVP retrieval strategy

Для первой рабочей версии фиксируем упрощённую стратегию:
	•	SQL-first retrieval
	•	без обязательного vector search
	•	без сложного adaptive ranking
	•	без fully agentic planner

MVP pipeline:
	1. resolve farm / cycle / scope
	2. classify intent
	3. fetch core context through SQL
	4. fetch intent-specific context through SQL + `searchable_documents`
	5. build compact assembly object
	6. if insufficient data -> ask clarification
	7. else -> generate answer

Это обязательный baseline. Более сложный retrieval допустим только поверх него, а не вместо него.

⸻

Канонические backend use cases

Чтобы retrieval не расползся по приложению, он должен использоваться через ограниченный набор server-side functions.

Минимальные use cases:
	•	`resolve_query_scope`
	•	`classify_query_intent`
	•	`retrieve_core_context`
	•	`retrieve_intent_context`
	•	`assemble_answer_context`
	•	`assemble_report_context`

Рекомендуемый orchestration flow:
	•	Edge Function orchestrates
	•	SQL/RPC gives deterministic retrieval fragments
	•	LLM used only where deterministic classification is insufficient

⸻

Что должно быть детерминированным

Следующие части retrieval pipeline должны быть реализованы максимально детерминированно:
	•	access check
	•	farm / cycle / scope resolution from UI context
	•	SOP retrieval
	•	recent event retrieval
	•	sensor snapshot retrieval
	•	report period retrieval
	•	missing data detection for obvious cases

Следующие части могут использовать LLM как вспомогательный слой:
	•	intent classification в сложных формулировках
	•	semantic query expansion
	•	historical analog summarization
	•	context compression summary

Правило:
	•	LLM не заменяет SQL retrieval
	•	LLM помогает над retrieval, но не подменяет data access layer

⸻

Тестируемость retrieval

Retrieval architecture должна быть тестируемой без запуска LLM.

Минимальные тесты:
	•	вопрос в контексте scope A не должен подтягивать scope B
	•	action question должен вернуть SOP context, если SOP существует
	•	causal question должен вернуть preceding events и anomalies, если они есть
	•	report question должен расширить time window
	•	ambiguous scope должен приводить к clarification state
	•	empty sensor data не должно ломать pipeline

Тестовое правило:
	•	quality retrieval оценивается прежде всего по assembled context, а не по красоте final answer

⸻

Не-цели этого ADR

ADR-003 не фиксирует:
	•	точную формулу ranking score
	•	конкретный prompt template для answer generation
	•	окончательную стратегию embeddings и pgvector
	•	финальную реализацию all-in-one context cache
	•	UI rendering assembled context

Это будет конкретизироваться в implementation docs и смежных ADR.

⸻

Последствия

Плюсы
	•	ответы становятся grounded и повторяемыми
	•	система лучше объясняет "почему"
	•	retrieval становится тестируемым и не зависит полностью от магии LLM
	•	AI можно улучшать без ломки data model
	•	`Daily Focus`, SOP dialogs и reports используют один и тот же контекстный механизм

Минусы
	•	появляется дополнительный orchestration layer
	•	нужно поддерживать больше derived summaries и helper queries
	•	ошибки scope resolution могут дорого стоить
	•	понадобится дисциплина в naming, scoring и retrieval contracts

Риски
	•	если retrieval pipeline станет слишком умным и недетерминированным, отладка усложнится
	•	если исторический слой подключать слишком агрессивно, ответы будут шумными
	•	если knowledge layer начнёт доминировать над farm facts, доверие пользователей упадёт

⸻

Итог

Retrieval в Growlog AI — это не поиск "чего-нибудь релевантного", а канонический механизм сборки operational context для конкретной фермы, цикла, scope и вопроса пользователя.

Именно retrieval layer делает возможным:
	•	grounded advice,
	•	WHY explanations,
	•	Daily Focus,
	•	SOP dialogs,
	•	report generation,
	•	безопасные ответы при нехватке данных.

⸻

Короткая формулировка

Growlog AI использует scope-aware multi-layer retrieval architecture, в которой контекст собирается по фиксированному pipeline из facts, sensors, photos, SOP, memory и knowledge, адаптируется под intent запроса и передаётся в AI только в нормализованном assembled виде.
