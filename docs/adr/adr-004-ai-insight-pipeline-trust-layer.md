ADR-004: Growlog AI — AI Insight Pipeline and Trust Layer

Статус: Proposed
Дата: 2026-03-22
Автор: A. Safiulin, OG Lab.
Связан с: ADR-001, ADR-002, ADR-003, ADR-005

⸻

Контекст

`ADR-001` зафиксировал, что Growlog AI должен давать не "общие AI-ответы", а советы и объяснения, основанные на модели конкретной фермы.

`ADR-002` зафиксировал data model, где:
	•	raw facts живут отдельно,
	•	AI outputs хранятся отдельно,
	•	grounding хранится отдельно,
	•	derived layer должен быть пересчитываемым.

`ADR-003` зафиксировал retrieval-first pipeline:
	•	AI не отвечает без assembled context,
	•	scope должен быть определён,
	•	при нехватке данных система сначала уточняет, а не фантазирует.

Остаётся архитектурный вопрос:

Как именно из assembled context получается безопасный AI output?

Growlog AI использует AI как:
	•	анализатор событий,
	•	интерпретатор фактов,
	•	генератор рекомендаций,
	•	объясняющий механизм (WHY engine),
	•	генератор narrative blocks для отчётов,
	•	механизм выделения рисков и паттернов.

Главная проблема AI в таком продукте:

Недоверие пользователей из-за галлюцинаций, непрозрачности и ложной уверенности.

Поэтому система обязана:
	•	отделять факт от интерпретации,
	•	отделять интерпретацию от гипотезы,
	•	отделять гипотезу от действия,
	•	показывать grounding,
	•	показывать confidence,
	•	явно перечислять missing data,
	•	уметь не только отвечать, но и безопасно отказываться от сильного вывода.

⸻

Проблема

Без строгого insight pipeline и trust layer:
	•	AI будет давать "красивые, но неверные" ответы
	•	невозможно будет проверить рекомендации
	•	пользователь не будет доверять системе
	•	система не сможет масштабироваться как профессиональный инструмент

Дополнительные опасности:
	•	AI может записать гипотезу как будто это факт
	•	AI может сгенерировать сильный совет без реального grounding
	•	один и тот же context может приводить к inconsistent outputs
	•	непонятно, какие результаты стоит сохранять в `ai_insights`, а какие должны быть одноразовыми

Главный вывод:

AI output должен быть не просто текстом, а каноническим структурированным объектом, проходящим через trust policy до показа пользователю и до сохранения в БД.

⸻

Основное решение

Мы принимаем архитектуру:

Insight Pipeline + Trust Layer с обязательным grounding и safe output policy

Ключевое правило:

Любой AI-результат в Growlog AI должен формироваться как structured insight object.

Этот объект:
	•	строится только на основе assembled context из ADR-003,
	•	имеет разделы facts / interpretation / hypotheses / recommendation,
	•	включает confidence и missing data,
	•	проходит trust checks,
	•	и только потом:
	•	либо показывается пользователю как response,
	•	либо сохраняется как `ai_insight`,
	•	либо отбрасывается как ephemeral output.

⸻

Типы AI Insights

Система должна генерировать следующие типы:

1. Summary
	•	краткое описание ситуации

2. Recommendation
	•	что делать

3. Anomaly
	•	объяснение или framing detected deviation

4. Causal Explanation (WHY)
	•	объяснение причин

5. Pattern
	•	повторяющийся паттерн

6. Risk
	•	потенциальная проблема

7. Daily Focus
	•	что важно сегодня

8. Story Block
	•	narrative часть отчёта

9. Clarification Request
	•	каких данных не хватает до сильного вывода

10. Evidence Summary
	•	структурированная сборка evidence без сильной интерпретации

Правило:

Не каждый AI response обязан сохраняться как `ai_insight`, но каждый значимый AI artifact должен быть приведён к одному из этих типов.

⸻

Insight Object Structure

Каждый инсайт должен иметь структуру:

```json
{
  "type": "recommendation",
  "scope": {
    "farm_id": "uuid",
    "cycle_id": "uuid",
    "scope_id": "uuid"
  },
  "facts": [],
  "interpretation": {},
  "hypotheses": [],
  "recommendation": {},
  "confidence": {
    "score": 0.72,
    "label": "medium"
  },
  "missing_data": [],
  "grounding": [],
  "trust_flags": []
}
```

Обязательные поля:
	•	`type`
	•	`facts`
	•	`confidence`
	•	`missing_data`
	•	`grounding`
	•	`trust_flags`

`facts`:
	•	только retrieved или измеренные факты
	•	никаких догадок

`interpretation`:
	•	что эти факты, вероятно, значат

`hypotheses`:
	•	список альтернативных причин или объяснений

`recommendation`:
	•	действие, только если trust policy это разрешает

`grounding`:
	•	список ссылок на retrieval sources

`trust_flags`:
	•	`low_confidence`
	•	`missing_scope`
	•	`missing_recent_signal`
	•	`conflicting_evidence`
	•	`requires_user_confirmation`
	•	`safe_to_store`
	•	`ephemeral_only`

⸻

AI Output Classes

Для реализации важно различать 3 класса outputs:

1. User-facing response
	•	то, что прямо показывается пользователю в текущем turn

2. Persisted insight
	•	derived artifact, который стоит сохранить в `ai_insights`

3. Ephemeral internal output
	•	вспомогательный reasoning/summary/object, который не надо хранить

Правило:

Не каждый user-facing response должен становиться persisted insight.

⸻

Insight Pipeline

### 1. Context Input

Получаем assembled context из ADR-003:
	•	events
	•	sensors
	•	photos
	•	SOP
	•	memory
	•	knowledge
	•	missing_data
	•	guardrails

Правило:

Если assembled context не прошёл minimal retrieval checks из ADR-003, insight pipeline не должен продолжаться в normal answer mode.

### 2. Fact Extraction

Выделяем:
	•	raw facts
	•	ключевые изменения
	•	critical evidence
	•	conflicts between sources

На этом этапе запрещено:
	•	ставить диагноз
	•	делать causal claims
	•	предлагать действие

Результат этапа:
	•	`fact_set`
	•	`evidence_set`
	•	`conflict_markers`

### 3. Interpretation Layer

Понимаем:
	•	что это, вероятно, значит
	•	какие паттерны видны
	•	какие сигналы важнее остальных

Правило:

Interpretation layer может описывать meaning, но не должен маскировать inference под certainty.

### 4. Hypothesis Layer

Строим гипотезы:
	•	возможные причины
	•	альтернативные объяснения
	•	что нужно проверить дальше

Для diagnostic сценариев гипотезы должны быть множественными, если evidence не уникален.

MVP правило:
	•	2-4 гипотезы максимум
	•	не больше одной `most likely`, если confidence действительно выше остальных

### 5. Recommendation Layer

Генерируем действия.

Recommendation layer разрешён только если:
	•	scope определён,
	•	есть достаточно evidence,
	•	нет критической неоднозначности,
	•	действие совместимо с known SOP/context,
	•	trust policy не запрещает strong recommendation.

Типы рекомендаций:
	•	`check_next`
	•	`measure_next`
	•	`safe_action_now`
	•	`monitor_only`
	•	`escalate_to_human`

Специальное правило:

При низкой уверенности рекомендация "что проверить" безопаснее и предпочтительнее, чем рискованная рекомендация "что сделать".

### 6. Confidence Scoring

Оцениваем:
	•	полноту данных
	•	согласованность
	•	силу evidence
	•	наличие conflicts
	•	наличие актуальных сигналов
	•	совпадение между несколькими источниками

Confidence должен существовать в двух видах:
	•	numeric score: `0.00 - 1.00`
	•	user label: `low / medium / high`

Confidence не означает "истина". Это оценка качества опоры для вывода.

### 7. Grounding

Сохраняем:
	•	ссылки на события
	•	метрики
	•	фото
	•	SOP runs / executions
	•	knowledge items
	•	grow memory items

Grounding должен быть пригоден и для:
	•	user-visible explanation
	•	storage in `insight_grounding`
	•	internal debugging

### 8. Trust Layer Check

Перед final output система обязана проверить:
	•	есть ли достаточный grounding
	•	совместим ли тип ответа с confidence
	•	не скрыта ли неоднозначность
	•	разрешено ли рекомендовать действие
	•	разрешено ли сохранять output как `ai_insight`

Trust layer может:
	•	понизить уверенность
	•	удалить слишком сильную рекомендацию
	•	заменить output на clarification request
	•	запретить сохранение результата в БД

### 9. Response Formatting

После trust checks строится user-facing output.

### 10. Persistence Decision

После response formatting принимается решение:
	•	store as reusable insight
	•	keep ephemeral only

⸻

Trust Layer

Каждый user-facing AI output должен содержать:

1. Grounding
	•	какие данные использованы

2. Confidence
	•	уровень уверенности

3. Missing Data
	•	чего не хватает

4. Alternatives
	•	альтернативные объяснения, если они есть

Trust Layer является отдельной обязательной стадией, а не просто красивой подачей.

Он обязан:
	•	проверять силу evidence
	•	проверять ambiguity
	•	проверять допустимость action advice
	•	проверять, допустимо ли persistence

⸻

Ответ пользователю

Ответ должен разделяться по смыслу на:
	•	Observed facts
	•	Interpretation
	•	Possible causes
	•	Recommended actions
	•	Missing data
	•	Confidence

Порядок обязателен по логике:
	1. что известно
	2. что это может значить
	3. какие есть альтернативы
	4. что делать дальше
	5. чего не хватает

Правило:
	•	ответ может быть короче полного stored object
	•	но не должен ломать эту структуру по смыслу

⸻

Правила безопасности

Обязательные правила:
	•	no evidence -> no strong recommendation
	•	low confidence -> ask questions
	•	conflicting data -> show ambiguity
	•	no scope -> no farm-specific action advice
	•	no recent signal -> no strong diagnosis
	•	derived insight must not overwrite raw fact
	•	narrative fluency must not outrank factual precision
	•	if SOP is relevant, recommendation must acknowledge SOP state

Специальное правило для risky diagnostic scenarios:

Если есть high-severity risk, но confidence низкий:
	•	система не должна придумывать точный диагноз
	•	она должна сообщить риск и следующий безопасный шаг проверки

⸻

Fallback policy

Если context недостаточен:
	•	выдать clarification request
	•	не пытаться "догадаться красиво"

Если evidence конфликтует:
	•	явно показать ambiguity
	•	не скрывать конкурирующие гипотезы

Если пользователь просит действие, но safe action невозможен:
	•	выдать `measure_next`, `check_next` или `escalate_to_human`

⸻

What gets stored vs not stored

Не каждый AI output нужно хранить.

Сохранять стоит:
	•	high-signal recommendation
	•	causal explanation with reusable value
	•	daily focus insight
	•	story block for report
	•	pattern insight
	•	risk insight

Необязательно сохранять:
	•	одноразовый rephrase
	•	clarification question
	•	ephemeral compression summary
	•	временный reasoning scaffold

Правило:
	•	если output полезен только в текущем turn и не нужен как часть памяти фермы, он должен остаться ephemeral

⸻

Stored Insight Contract

Когда output сохраняется в `ai_insights`, он обязан иметь:
	•	`insight_type`
	•	`body`
	•	`facts_json`
	•	`confidence`
	•	минимум один grounding source в `insight_grounding`
	•	scope compatibility with `farm_id` / `cycle_id` / `scope_id`

Рекомендуемый маппинг:
	•	`summary` -> short factual synthesis
	•	`recommendation` -> action or next-check advice
	•	`anomaly` -> explanation around detected anomaly
	•	`causal_explanation` -> WHY output
	•	`pattern` -> reusable repeated pattern
	•	`risk` -> explicit risk framing
	•	`daily_focus` -> today's priority output
	•	`story_block` -> report narrative block

⸻

Integration с WHY ENGINE

WHY engine использует:
	•	retrieval context из ADR-003
	•	`causal_links`
	•	`anomalies`
	•	recent events
	•	sensor/photo/SOP evidence

WHY output обязан:
	•	отделять observation от cause
	•	содержать альтернативы
	•	содержать `what_to_check_next`

Insights могут создавать новые `causal_links`, но только как derived hypotheses, а не как доказанные истины.

⸻

Integration с Anomaly Detection

Аномалия и insight не одно и то же.

Правило:
	•	`anomalies` фиксируют detected deviation
	•	`ai_insights` объясняют deviation, оценивают риск или предлагают next step

Допускается:
	•	anomaly -> recommendation insight
	•	anomaly -> causal explanation insight
	•	anomaly -> clarification request

Запрещено:
	•	считать anomaly автоматически доказанным диагнозом

⸻

Integration с Daily Focus

Daily Focus является downstream consumer insight layer.

Он использует:
	•	open/overdue SOP
	•	anomalies
	•	recommendation insights
	•	risk insights

Daily Focus не должен blindly копировать весь output модели. Он должен отбирать только actionable high-signal outputs.

⸻

Integration с Reports

Reports используют не все инсайты подряд, а только те, которые:
	•	имеют стабильную ценность как часть истории,
	•	имеют достаточный grounding,
	•	подходят для narrative, summary или explanation block.

`Story Block` является отдельным типом AI output, но всё равно подчиняется trust policy:
	•	не выдумывать факты,
	•	не скрывать missing data,
	•	не романтизировать uncertainty как истину.

⸻

Канонический AI execution flow

Для любой AI-функции в продукте принимается один и тот же базовый flow:

1. Retrieve assembled context from ADR-003
2. Validate minimal context completeness
3. Build fact set
4. Build interpretation
5. Build hypotheses
6. Build recommendation or clarification
7. Score confidence
8. Build grounding bundle
9. Run trust layer checks
10. Format user-facing response
11. Optionally persist reusable insight

Это канонический baseline.

Специализации:
	•	answering
	•	WHY explanation
	•	daily focus generation
	•	anomaly explanation
	•	report story block generation

не должны ломать этот порядок, а только адаптировать отдельные шаги.

⸻

Что должно быть детерминированным

Следующие части AI pipeline должны быть максимально rule-based:
	•	проверка наличия context package
	•	проверка минимального grounding
	•	решение "можно ли давать strong recommendation"
	•	решение "сохранять ли output"
	•	проверка missing data
	•	маппинг stored output в `ai_insights`

Следующие части могут использовать LLM:
	•	interpretation wording
	•	hypothesis generation
	•	narrative phrasing
	•	report prose

Правило:
	•	LLM отвечает за reasoning and phrasing
	•	rules отвечают за safety and persistence policy

⸻

Performance

Performance strategy:
	•	кеширование assembled context where appropriate
	•	переиспользование уже посчитанных summaries
	•	переиспользование stored `ai_insights`, если они ещё валидны
	•	не пересчитывать дорогое reasoning без причины

Но:
	•	старый insight нельзя использовать как единственный источник истины
	•	перед reuse нужно проверить scope, freshness и applicability

⸻

Тестируемость

AI insight pipeline должен быть тестируем не только по "какой красивый текст получился".

Минимальные test cases:
	•	при отсутствии grounding strong recommendation должна быть запрещена
	•	при low confidence output должен превращаться в clarification-first answer
	•	при conflicting evidence ambiguity должна быть видна в response
	•	ephemeral answer не должен попадать в `ai_insights`
	•	stored insight должен иметь `insight_grounding`
	•	diagnostic answer без recent signal должен выдавать missing data

Качество pipeline оценивается по:
	•	корректности структуры
	•	корректности trust flags
	•	корректности persistence decision
	•	совместимости с retrieval constraints

⸻

MVP

Для первой рабочей версии фиксируем:
	•	single-pass insight pipeline
	•	одна основная LLM для interpretation/hypothesis/recommendation
	•	без multi-agent orchestration
	•	без reinforcement loops
	•	без автономного самоисправления persisted insights

MVP-ограничение:
	•	без assembled context из ADR-003 AI не должен генерировать farm-specific response

MVP-safe policy:
	•	лучше чаще просить уточнение, чем давать смелый, но шаткий совет

⸻

Будущее
	•	multi-agent review for critical outputs
	•	richer confidence estimation
	•	adaptive persistence policy
	•	separate verifier model
	•	higher-fidelity causal reasoning

Это future layer, а не основание архитектуры.

⸻

Не-цели этого ADR

ADR-004 не фиксирует:
	•	конкретный prompt text для каждой AI-функции
	•	точную numerical formula confidence score
	•	конкретный провайдер моделей
	•	final UI wording for trust presentation
	•	точную политику cache invalidation для reused insights

Это будет детализироваться в implementation docs.

⸻

Последствия

Плюсы
	•	AI становится прозрачнее и безопаснее
	•	сохраняется разделение facts / interpretation / hypotheses / action
	•	insight layer становится совместимым с retrieval и data model
	•	проще тестировать качество системы не только текстом, но и структурой output
	•	можно отдельно развивать trust layer и reasoning quality

Минусы
	•	пайплайн становится сложнее, чем "просто спросить модель"
	•	нужно поддерживать отдельные persistence rules
	•	часть output будет специально ослабляться ради безопасности
	•	появляется больше служебных структур и metadata

Риски
	•	если trust layer станет формальным, а не реальным, пользователи быстро это заметят
	•	если persistence policy будет слишком агрессивной, база засорится слабополезными insights
	•	если confidence будет завышаться, доверие будет разрушено быстрее всего
	•	если модель будет красиво формулировать uncertainty как будто это знание, это создаст ложную уверенность

⸻

Итог

AI в Growlog — это система интерпретации и объяснения поверх retrieval и фактов фермы, а не свободная генерация текста.

Insight pipeline нужен, чтобы каждый AI output:
	•	был основан на assembled context,
	•	имел отделённые факты и гипотезы,
	•	прошёл trust checks,
	•	либо безопасно показался пользователю,
	•	либо безопасно сохранился как reusable derived artifact.

⸻

Короткая формулировка

Growlog AI использует structured insight pipeline с обязательным trust layer, где каждый AI-вывод строится только поверх assembled context, разделяет facts / interpretation / hypotheses / actions, проходит safety checks, получает grounding и confidence, а затем либо показывается пользователю, либо сохраняется как derived insight.
