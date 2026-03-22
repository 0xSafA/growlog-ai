ADR-002: Growlog AI — Data Model and Supabase Schema

Статус: Proposed
Дата: 2026-03-22
Автор: A. Safiulin, OG Lab.
Связан с: ADR-001

⸻

Контекст

ADR-001 зафиксировал, что Growlog AI строится как событийный журнал выращивания с AI-ассистентом, который опирается на:
	•	историю текущего цикла,
	•	историю предыдущих циклов,
	•	сенсорные данные,
	•	фотографии,
	•	SOP,
	•	long-term grow memory,
	•	AI insights и grounded recommendations,
	•	отчёты для гроверов и руководителей.

Для этого нужна модель данных, которая:
	•	поддерживает непрерывный event log,
	•	позволяет связывать факты между собой,
	•	хорошо ложится на Supabase/Postgres,
	•	подходит как для CRUD-интерфейсов, так и для аналитики,
	•	пригодна для RAG / retrieval / summarization,
	•	не разваливается при добавлении новых типов событий, датчиков и AI-функций.

⸻

Проблема

Если сделать слишком простую схему вроде "одна таблица journal_entries + одна таблица photos", то система не сможет надёжно:
	•	связывать события, измерения, фото и SOP,
	•	строить causal analysis,
	•	поддерживать anomaly detection,
	•	формировать manager reports,
	•	отслеживать выполнение регламентов,
	•	строить farm memory,
	•	объяснять ответы AI через grounding,
	•	различать raw facts, derived signals и AI interpretations.

Если, наоборот, сделать чрезмерно нормализованную схему без event spine, то продукт будет сложнее развивать, а timeline, retrieval и отчёты станут неудобными.

Нужна схема, где:
	•	есть единый хребет событий,
	•	структурированные сущности вынесены отдельно,
	•	AI-слой хранит свои выводы отдельно от сырых данных,
	•	а retrieval может быстро собрать контекст по циклу, комнате, растению, дню, инциденту или вопросу.

⸻

Решение

Мы принимаем следующую модель данных:
	1.	Центральной осью модели является timeline событий.
	2.	Сырые факты, операционные сущности и AI-выводы разделяются.
	3.	Все важные сущности имеют связь с grow cycle и/или farm scope.
	4.	Сенсорные данные и человеческие наблюдения хранятся раздельно, но связываются через event context.
	5.	Фото — отдельная first-class сущность.
	6.	SOP — это отдельный домен с definitions, triggers, runs, executions и follow-ups.
	7.	Grow memory и AI insights — производные сущности, которые можно пересчитывать, не теряя raw data.
	8.	Report layer хранится как отдельный домен публикаций и артефактов.
	9.	Канонический scope должен быть явной сущностью, а не только набором nullable foreign keys.
	10.	LLM не создаёт факты напрямую: запись в source-of-truth таблицы происходит только через backend use cases.

⸻

Цели схемы

Схема должна обеспечивать:
	•	быстрый timeline по дням,
	•	drill-down в детали события,
	•	связь "заметка ↔ фото ↔ датчики ↔ SOP ↔ AI insight",
	•	retrieval для AI по текущему циклу и историческим циклам,
	•	daily focus dashboard,
	•	anomaly detection,
	•	causal analysis,
	•	narrative reports,
	•	хранение голосовых входов, транскриптов и голосовых ответов,
	•	работу с несколькими фермами / локациями / комнатами,
	•	расширяемость без постоянных миграций под каждую новую фичу.

⸻

Общее архитектурное решение по данным

Основные домены

Схема делится на следующие домены:
	1.	Org / Farm Structure
	2.	Grow Operations
	3.	Event Log
	4.	Sensors and Environment
	5.	Photos and Media
	6.	SOP Management
	7.	AI Context, Memory and Insights
	8.	Reports and Publications
	9.	Voice and Conversation
	10.	Reference / Knowledge Grounding

⸻

Соответствие ADR-001 -> физическая схема

Чтобы не было расхождений между концептуальным и физическим уровнями, фиксируем каноническое соответствие:
	•	Farm -> `farms`
	•	Grow Cycle -> `grow_cycles`
	•	Scope -> `scopes`
	•	Event Log -> `events`
	•	Sensor Reading -> `sensor_readings`
	•	Photo Asset -> `media_assets` с `media_type = image`
	•	Photo Intelligence -> `photo_analysis`, `photo_timeline_signals`
	•	SOP Definition -> `sop_definitions`
	•	SOP Run -> `sop_runs`
	•	SOP Execution -> `sop_executions`
	•	AI Insight -> `ai_insights`
	•	Grow Memory -> `grow_memory_items`
	•	Report -> `reports`
	•	Report Artifact -> `report_artifacts`
	•	Knowledge Document -> `knowledge_sources`, `knowledge_items`

Если в дальнейшем появится новое имя в продукте или UI, оно должно быть сопоставлено с одной из этих сущностей, а не создавать второй параллельный смысл.

⸻

Идентификаторы и общие поля

Для всех основных таблиц принимаются следующие принципы:
	•	id uuid primary key default gen_random_uuid()
	•	created_at timestamptz not null default now()
	•	updated_at timestamptz not null default now()
	•	created_by uuid null — пользователь, если применимо
	•	farm_id uuid not null — принадлежность ферме
	•	is_deleted boolean not null default false — soft delete, где уместно

Дополнительно:
	•	все enum-поля в MVP можно хранить как text + check constraints либо как Postgres enums, если набор стабилен;
	•	для гибких структур и AI payloads используется jsonb;
	•	для полнотекстового и retrieval-сценария используются text fields + позже embeddings.

⸻

Канонические инварианты схемы

Чтобы даже слабая модель или новый разработчик не "додумывали" правила сами, фиксируем следующие инварианты:

1. Классы таблиц
	•	source tables: первичные факты, введённые человеком, системой или сенсором
	•	derived tables: пересчитываемые производные слои
	•	publication tables: отчёты, артефакты, publish layer

К `source tables` относятся:
	•	events
	•	observations
	•	actions_log
	•	sensor_readings
	•	media_assets
	•	sop_definitions
	•	sop_triggers
	•	sop_runs
	•	sop_executions
	•	conversation_messages

К `derived tables` относятся:
	•	daily_timelines
	•	sensor_snapshots
	•	environmental_daily_stats
	•	photo_analysis
	•	photo_timeline_signals
	•	ai_insights
	•	insight_grounding
	•	anomalies
	•	grow_memory_items
	•	causal_links
	•	daily_focus_cards
	•	searchable_documents

2. Event spine обязателен
	•	если что-то произошло во времени, у этого должен быть ряд в `events`
	•	специализированные таблицы не заменяют `events`, а деталируют его

3. Append-first
	•	история в основном дополняется
	•	исправления значимых фактов предпочтительно делать новыми событиями или revision layer
	•	derived-таблицы разрешено пересчитывать

4. Scope обязателен для операционных данных
	•	все рабочие таблицы должны иметь либо `scope_id`, либо однозначно выводимый scope
	•	для timeline, AI retrieval и daily focus каноническим является именно `scope_id`

5. LLM writes are forbidden
	•	AI может предлагать структуру, summary и интерпретацию
	•	но source-of-truth записи создаются только через backend use cases с валидацией

⸻

1. ORG / FARM STRUCTURE

1.1 farms

Описывает ферму или организацию выращивания.

Поля:
	•	id
	•	name text not null
	•	slug text unique
	•	timezone text not null
	•	country text null
	•	city text null
	•	settings jsonb not null default '{}'::jsonb
	•	created_at
	•	updated_at

1.2 farm_sites

Если у фермы несколько площадок.

Поля:
	•	id
	•	farm_id uuid not null references farms(id)
	•	name text not null
	•	site_type text null — greenhouse, indoor, outdoor, lab
	•	address text null
	•	notes text null
	•	created_at
	•	updated_at

1.3 farm_zones

Комнаты, боксы, секции, столы, линии и т.п.

Поля:
	•	id
	•	farm_id uuid not null references farms(id)
	•	site_id uuid null references farm_sites(id)
	•	parent_zone_id uuid null references farm_zones(id)
	•	name text not null
	•	zone_type text not null — room, tent, rack, table, drying_room, mother_room
	•	code text null
	•	capacity jsonb null
	•	active boolean not null default true
	•	created_at
	•	updated_at

1.4 scopes

Каноническая абстракция области действия, согласованная с ADR-001.

`Scope` нужен для того, чтобы все механики продукта работали одинаково:
	•	для домашнего тента,
	•	для комнаты,
	•	для группы растений,
	•	для одного растения,
	•	для резервуара или другой операционной зоны.

Поля:
	•	id
	•	farm_id uuid not null references farms(id)
	•	cycle_id uuid null references grow_cycles(id)
	•	parent_scope_id uuid null references scopes(id)
	•	scope_type text not null
	•	farm
	•	site
	•	room
	•	tent
	•	zone
	•	bed
	•	reservoir
	•	plant_group
	•	plant
	•	display_name text not null
	•	site_id uuid null references farm_sites(id)
	•	zone_id uuid null references farm_zones(id)
	•	plant_id uuid null references plants(id)
	•	plant_group_id uuid null references plant_groups(id)
	•	active boolean not null default true
	•	metadata jsonb not null default '{}'::jsonb
	•	created_at
	•	updated_at

Правило:
	•	`scopes` является каноническим уровнем адресации для событий, SOP, AI и отчётов
	•	`site_id`, `zone_id`, `plant_id`, `plant_group_id` в других таблицах допускаются как денормализованные shortcut-поля для удобства запросов
	•	но если есть конфликт, источником истины считается `scope_id`

1.5 farm_users

Роли и участие пользователей на ферме.

Поля:
	•	id
	•	farm_id uuid not null references farms(id)
	•	user_id uuid not null
	•	role text not null — grower, manager, admin, viewer
	•	display_name text null
	•	settings jsonb not null default '{}'::jsonb
	•	created_at
	•	updated_at

⸻

2. GROW OPERATIONS

2.1 grow_cycles

Центральная сущность цикла.

Поля:
	•	id
	•	farm_id uuid not null references farms(id)
	•	site_id uuid null references farm_sites(id)
	•	zone_id uuid null references farm_zones(id)
	•	name text not null
	•	cultivar_name text null
	•	batch_code text null
	•	start_date date not null
	•	end_date date null
	•	status text not null — planned, active, harvested, archived, cancelled
	•	stage text not null — propagation, veg, flower, drying, curing, completed
	•	goal_profile jsonb null — например yield, terpene, stability, experiment
	•	metadata jsonb not null default '{}'::jsonb
	•	created_by uuid null
	•	created_at
	•	updated_at

2.2 plants

Если нужно отслеживать отдельные растения или группы.

Поля:
	•	id
	•	farm_id uuid not null references farms(id)
	•	cycle_id uuid null references grow_cycles(id)
	•	zone_id uuid null references farm_zones(id)
	•	plant_code text not null
	•	cultivar_name text null
	•	phenotype text null
	•	source_type text null — seed, clone, mother
	•	source_reference text null
	•	start_date date null
	•	status text not null default 'active'
	•	metadata jsonb not null default '{}'::jsonb
	•	created_at
	•	updated_at

2.3 plant_groups

Для случаев, когда логика идёт не по одному растению, а по группе.

Поля:
	•	id
	•	farm_id uuid not null references farms(id)
	•	cycle_id uuid null references grow_cycles(id)
	•	zone_id uuid null references farm_zones(id)
	•	name text not null
	•	group_type text null — tray, bench, batch, mother_set
	•	metadata jsonb not null default '{}'::jsonb
	•	created_at
	•	updated_at

2.4 cycle_stage_history

История переходов между стадиями.

Поля:
	•	id
	•	farm_id uuid not null references farms(id)
	•	cycle_id uuid not null references grow_cycles(id)
	•	stage text not null
	•	started_at timestamptz not null
	•	ended_at timestamptz null
	•	notes text null
	•	created_by uuid null
	•	created_at
	•	updated_at

⸻

3. EVENT LOG

Решение по event spine

Все значимые факты попадают в events как в единый timeline spine.
Подробные доменные данные лежат в специализированных таблицах, а events даёт:
	•	единый журнал,
	•	единый feed,
	•	единый retrieval entry point,
	•	основу для manager summary и daily focus.

3.1 events

Главная таблица timeline.

Поля:
	•	id
	•	farm_id uuid not null references farms(id)
	•	site_id uuid null references farm_sites(id)
	•	zone_id uuid null references farm_zones(id)
	•	cycle_id uuid null references grow_cycles(id)
	•	scope_id uuid null references scopes(id)
	•	plant_id uuid null references plants(id)
	•	plant_group_id uuid null references plant_groups(id)
	•	event_type text not null
	•	note
	•	observation
	•	action_taken
	•	watering
	•	feeding
	•	pruning
	•	training
	•	transplant
	•	issue_detected
	•	pest_detected
	•	deficiency_suspected
	•	harvest
	•	drying
	•	curing
	•	sensor_snapshot
	•	photo_capture
	•	sop_due
	•	sop_executed
	•	sop_missed
	•	ai_analysis
	•	anomaly
	•	report_generated
	•	stage_changed
	•	conversation_turn
	•	external_sync
	•	event_subtype text null
	•	title text null
	•	body text null
	•	occurred_at timestamptz not null
	•	recorded_at timestamptz not null default now()
	•	source_type text not null
	•	user_text
	•	user_voice
	•	user_form
	•	sensor_api
	•	file_upload
	•	internal_system
	•	ai_generated
	•	imported
	•	source_ref text null
	•	severity text null — info, warning, critical
	•	status text null
	•	tags text[] not null default '{}'
	•	payload jsonb not null default '{}'::jsonb
	•	created_by uuid null
	•	created_at
	•	updated_at

Правила для `events`:
	•	`event_type` должен использовать канонический словарь из ADR-001
	•	`body` хранит raw human/system text, если он есть
	•	`payload` хранит структурированные детали, которые нецелесообразно выносить в отдельные колонки
	•	`scope_id` обязателен для всех операционных событий, кроме truly farm-wide событий
	•	если событие создано как оболочка для специализированной сущности, сначала создаётся `events`, затем дочерняя запись

3.2 event_links

Позволяет связывать события между собой.

Поля:
	•	id
	•	farm_id uuid not null references farms(id)
	•	from_event_id uuid not null references events(id)
	•	to_event_id uuid not null references events(id)
	•	relation_type text not null
	•	caused_by
	•	follows_up
	•	confirms
	•	contradicts
	•	related_to
	•	references
	•	resolved_by
	•	confidence numeric(5,4) null
	•	metadata jsonb not null default '{}'::jsonb
	•	created_at
	•	updated_at

3.3 event_entities

Универсальная связующая таблица для привязки события к произвольным сущностям.

Поля:
	•	id
	•	farm_id uuid not null references farms(id)
	•	event_id uuid not null references events(id)
	•	entity_type text not null — photo, sensor_reading, sop_execution, insight, report, conversation_message
	•	entity_id uuid not null
	•	role text null — primary, attachment, evidence, output, trigger
	•	created_at
	•	updated_at

3.4 daily_timelines

Предрасчитанный daily summary layer для быстрого UI.

Поля:
	•	id
	•	farm_id uuid not null references farms(id)
	•	cycle_id uuid null references grow_cycles(id)
	•	zone_id uuid null references farm_zones(id)
	•	scope_id uuid null references scopes(id)
	•	timeline_date date not null
	•	summary_text text null
	•	summary_json jsonb not null default '{}'::jsonb
	•	event_count integer not null default 0
	•	photo_count integer not null default 0
	•	issue_count integer not null default 0
	•	anomaly_count integer not null default 0
	•	sop_due_count integer not null default 0
	•	generated_at timestamptz null
	•	created_at
	•	updated_at

⸻

4. HUMAN OBSERVATIONS AND STRUCTURED NOTES

4.1 observations

Структурированная таблица человеческих наблюдений, выделенных из голосового или текстового ввода.

Поля:
	•	id
	•	farm_id uuid not null references farms(id)
	•	event_id uuid not null references events(id)
	•	cycle_id uuid null references grow_cycles(id)
	•	zone_id uuid null references farm_zones(id)
	•	scope_id uuid null references scopes(id)
	•	plant_id uuid null references plants(id)
	•	observation_type text not null
	•	leaf_color
	•	flower_state
	•	pest_sign
	•	smell
	•	vigor
	•	disease_risk
	•	substrate_state
	•	root_state
	•	general_note
	•	label text null
	•	value_text text null
	•	value_number numeric null
	•	value_unit text null
	•	normalized_value jsonb null
	•	confidence numeric(5,4) null
	•	is_user_confirmed boolean not null default false
	•	created_at
	•	updated_at

4.2 actions_log

Операционные действия в отдельной таблице.

Поля:
	•	id
	•	farm_id uuid not null references farms(id)
	•	event_id uuid not null references events(id)
	•	cycle_id uuid null references grow_cycles(id)
	•	zone_id uuid null references farm_zones(id)
	•	scope_id uuid null references scopes(id)
	•	plant_id uuid null references plants(id)
	•	action_type text not null
	•	watering
	•	feeding
	•	flushing
	•	pruning
	•	defoliation
	•	training
	•	transplant
	•	harvesting
	•	cleaning
	•	maintenance
	•	started_at timestamptz null
	•	completed_at timestamptz null
	•	parameters jsonb not null default '{}'::jsonb
	•	result_text text null
	•	performed_by uuid null
	•	created_at
	•	updated_at

⸻

5. SENSORS AND ENVIRONMENT

5.1 sensor_devices

Справочник устройств.

Поля:
	•	id
	•	farm_id uuid not null references farms(id)
	•	site_id uuid null references farm_sites(id)
	•	zone_id uuid null references farm_zones(id)
	•	name text not null
	•	device_type text not null — temp_sensor, humidity_sensor, co2_meter, ph_probe, ec_probe, camera, controller
	•	vendor text null
	•	model text null
	•	serial_number text null
	•	api_source text null
	•	status text not null default 'active'
	•	config jsonb not null default '{}'::jsonb
	•	last_seen_at timestamptz null
	•	created_at
	•	updated_at

5.2 sensor_metrics

Справочник метрик.

Поля:
	•	id
	•	farm_id uuid null references farms(id)
	•	metric_code text not null unique
	•	name text not null
	•	unit text null
	•	category text not null — climate, nutrient, irrigation, light, substrate, water, power
	•	normal_range jsonb null
	•	description text null
	•	created_at
	•	updated_at

5.3 sensor_readings

Основная таблица показаний.

Поля:
	•	id
	•	farm_id uuid not null references farms(id)
	•	device_id uuid null references sensor_devices(id)
	•	metric_id uuid null references sensor_metrics(id)
	•	cycle_id uuid null references grow_cycles(id)
	•	zone_id uuid null references farm_zones(id)
	•	scope_id uuid null references scopes(id)
	•	plant_id uuid null references plants(id)
	•	captured_at timestamptz not null
	•	value_numeric numeric not null
	•	value_text text null
	•	unit text null
	•	quality_score numeric(5,4) null
	•	ingestion_source text not null
	•	raw_payload jsonb not null default '{}'::jsonb
	•	created_at

5.4 sensor_snapshots

Нормализованное "состояние среды на момент времени" для быстрого AI-context retrieval.

Поля:
	•	id
	•	farm_id uuid not null references farms(id)
	•	cycle_id uuid null references grow_cycles(id)
	•	zone_id uuid null references farm_zones(id)
	•	scope_id uuid null references scopes(id)
	•	captured_at timestamptz not null
	•	snapshot_json jsonb not null
	•	window_minutes integer not null default 15
	•	created_at

5.5 environmental_daily_stats

Daily aggregates.

Поля:
	•	id
	•	farm_id uuid not null references farms(id)
	•	cycle_id uuid null references grow_cycles(id)
	•	zone_id uuid null references farm_zones(id)
	•	scope_id uuid null references scopes(id)
	•	stat_date date not null
	•	metric_code text not null
	•	min_value numeric null
	•	max_value numeric null
	•	avg_value numeric null
	•	median_value numeric null
	•	stddev_value numeric null
	•	sample_count integer not null default 0
	•	created_at
	•	updated_at

⸻

6. PHOTOS AND MEDIA

6.1 media_assets

Универсальная таблица медиа.

Поля:
	•	id
	•	farm_id uuid not null references farms(id)
	•	cycle_id uuid null references grow_cycles(id)
	•	zone_id uuid null references farm_zones(id)
	•	scope_id uuid null references scopes(id)
	•	plant_id uuid null references plants(id)
	•	uploaded_by uuid null
	•	storage_bucket text not null
	•	storage_path text not null
	•	media_type text not null — image, audio, pdf, html_snapshot
	•	mime_type text not null
	•	file_name text null
	•	file_size bigint null
	•	width integer null
	•	height integer null
	•	duration_seconds numeric null
	•	captured_at timestamptz null
	•	checksum text null
	•	metadata jsonb not null default '{}'::jsonb
	•	created_at
	•	updated_at

6.2 photo_analysis

AI-анализ фотографии.

Поля:
	•	id
	•	farm_id uuid not null references farms(id)
	•	media_asset_id uuid not null references media_assets(id)
	•	cycle_id uuid null references grow_cycles(id)
	•	zone_id uuid null references farm_zones(id)
	•	scope_id uuid null references scopes(id)
	•	plant_id uuid null references plants(id)
	•	analysis_version text not null
	•	summary_text text null
	•	signals jsonb not null default '{}'::jsonb
	•	issues_detected jsonb not null default '[]'::jsonb
	•	tags text[] not null default '{}'
	•	confidence numeric(5,4) null
	•	created_at
	•	updated_at

6.3 photo_timeline_signals

Производная таблица динамики фото во времени.

Поля:
	•	id
	•	farm_id uuid not null references farms(id)
	•	cycle_id uuid null references grow_cycles(id)
	•	zone_id uuid null references farm_zones(id)
	•	scope_id uuid null references scopes(id)
	•	plant_id uuid null references plants(id)
	•	from_media_asset_id uuid not null references media_assets(id)
	•	to_media_asset_id uuid not null references media_assets(id)
	•	signal_type text not null
	•	color_shift
	•	leaf_drop
	•	growth_change
	•	density_change
	•	suspected_stress
	•	signal_strength numeric(5,4) null
	•	description text null
	•	correlated_factors jsonb not null default '{}'::jsonb
	•	created_at
	•	updated_at

6.4 report_media_selections

Выбор фото для отчётов и публикаций.

Поля:
	•	id
	•	farm_id uuid not null references farms(id)
	•	report_id uuid not null
	•	media_asset_id uuid not null references media_assets(id)
	•	selection_reason text null
	•	layout_role text null — hero, collage, appendix, hidden_gallery
	•	sort_order integer not null default 0
	•	created_at
	•	updated_at

⸻

7. SOP MANAGEMENT

7.1 sop_documents

Загруженные SOP-документы.

Поля:
	•	id
	•	farm_id uuid not null references farms(id)
	•	title text not null
	•	version text null
	•	status text not null default 'active'
	•	description text null
	•	media_asset_id uuid null references media_assets(id)
	•	parsed_text text null
	•	metadata jsonb not null default '{}'::jsonb
	•	created_by uuid null
	•	created_at
	•	updated_at

7.2 sop_definitions

Нормализованные SOP-единицы.

Поля:
	•	id
	•	farm_id uuid not null references farms(id)
	•	document_id uuid null references sop_documents(id)
	•	code text null
	•	title text not null
	•	description text null
	•	category text null
	•	criticality text not null default 'normal'
	•	applies_to_scope text not null — farm, site, room, tent, zone, bed, reservoir, plant_group, plant
	•	required_inputs_after_execution jsonb not null default '[]'::jsonb
	•	severity_if_missed text not null default 'normal'
	•	active boolean not null default true
	•	instructions_json jsonb not null default '{}'::jsonb
	•	created_at
	•	updated_at

7.3 sop_triggers

Триггеры запуска SOP.

Поля:
	•	id
	•	farm_id uuid not null references farms(id)
	•	sop_definition_id uuid not null references sop_definitions(id)
	•	trigger_type text not null
	•	date_based
	•	time_based
	•	stage_based
	•	offset_based
	•	event_based
	•	recurring_daily
	•	recurring_interval
	•	condition_based
	•	location_based
	•	trigger_config jsonb not null
	•	active boolean not null default true
	•	created_at
	•	updated_at

7.4 sop_assignments

Назначение SOP на конкретный scope.

Поля:
	•	id
	•	farm_id uuid not null references farms(id)
	•	sop_definition_id uuid not null references sop_definitions(id)
	•	site_id uuid null references farm_sites(id)
	•	zone_id uuid null references farm_zones(id)
	•	cycle_id uuid null references grow_cycles(id)
	•	plant_id uuid null references plants(id)
	•	assigned_to uuid null
	•	assignment_status text not null default 'active'
	•	effective_from timestamptz null
	•	effective_to timestamptz null
	•	metadata jsonb not null default '{}'::jsonb
	•	created_at
	•	updated_at

7.5 sop_runs

Конкретные случаи, когда SOP должен быть выполнен.

Эта таблица канонически соответствует `SOP Run` из ADR-001.
Более старое название `due_items` больше не используется в документации.

Поля:
	•	id
	•	farm_id uuid not null references farms(id)
	•	sop_definition_id uuid not null references sop_definitions(id)
	•	trigger_id uuid null references sop_triggers(id)
	•	assignment_id uuid null references sop_assignments(id)
	•	related_event_id uuid null references events(id)
	•	cycle_id uuid null references grow_cycles(id)
	•	zone_id uuid null references farm_zones(id)
	•	scope_id uuid null references scopes(id)
	•	plant_id uuid null references plants(id)
	•	due_at timestamptz null
	•	due_window_start timestamptz null
	•	due_window_end timestamptz null
	•	status text not null default 'open'
	•	open, acknowledged, completed, skipped, overdue, blocked, cancelled
	•	priority text not null default 'normal'
	•	reason_text text null
	•	trigger_snapshot jsonb not null default '{}'::jsonb
	•	created_at
	•	updated_at

7.6 sop_executions

Факт реакции и выполнения.

Поля:
	•	id
	•	farm_id uuid not null references farms(id)
	•	sop_run_id uuid not null references sop_runs(id)
	•	event_id uuid null references events(id)
	•	scope_id uuid null references scopes(id)
	•	executed_by uuid null
	•	execution_status text not null
	•	done
	•	skipped
	•	delayed
	•	blocked
	•	partially_done
	•	intent_status text null — acknowledged, will_do, needs_help
	•	response_at timestamptz not null default now()
	•	completed_at timestamptz null
	•	notes text null
	•	performer_feedback text null
	•	measured_values jsonb not null default '{}'::jsonb
	•	evidence_json jsonb not null default '{}'::jsonb
	•	result_json jsonb not null default '{}'::jsonb
	•	created_at
	•	updated_at

7.7 sop_compliance_daily

Агрегаты для dashboards.

Поля:
	•	id
	•	farm_id uuid not null references farms(id)
	•	scope_type text not null
	•	scope_id uuid null
	•	stat_date date not null
	•	due_count integer not null default 0
	•	completed_count integer not null default 0
	•	skipped_count integer not null default 0
	•	overdue_count integer not null default 0
	•	compliance_score numeric(5,4) null
	•	created_at
	•	updated_at

⸻

8. AI CONTEXT, MEMORY AND INSIGHTS

Принцип

AI-слой не должен смешиваться с raw data.
Поэтому AI-выводы, гипотезы, аномалии, summaries и memory объекты хранятся отдельно.

8.1 ai_insights

Основная таблица AI-выводов.

Поля:
	•	id
	•	farm_id uuid not null references farms(id)
	•	cycle_id uuid null references grow_cycles(id)
	•	zone_id uuid null references farm_zones(id)
	•	scope_id uuid null references scopes(id)
	•	plant_id uuid null references plants(id)
	•	event_id uuid null references events(id)
	•	insight_type text not null
	•	summary
	•	recommendation
	•	anomaly
	•	causal_explanation
	•	pattern
	•	risk
	•	manager_update
	•	daily_focus
	•	story_block
	•	title text null
	•	body text not null
	•	facts_json jsonb not null default '[]'::jsonb
	•	interpretation_json jsonb not null default '{}'::jsonb
	•	recommendation_json jsonb not null default '{}'::jsonb
	•	confidence numeric(5,4) null
	•	priority text null
	•	valid_from timestamptz null
	•	valid_to timestamptz null
	•	model_name text null
	•	model_version text null
	•	created_at
	•	updated_at

8.2 insight_grounding

Какие данные использовались для ответа / вывода.

Поля:
	•	id
	•	farm_id uuid not null references farms(id)
	•	insight_id uuid not null references ai_insights(id)
	•	source_type text not null
	•	event
	•	observation
	•	sensor_reading
	•	sensor_snapshot
	•	photo_analysis
	•	sop_run
	•	sop_execution
	•	grow_memory_item
	•	knowledge_item
	•	source_id uuid null
	•	weight numeric(6,4) null
	•	excerpt text null
	•	created_at
	•	updated_at

8.3 anomalies

Специализированная таблица аномалий.

Поля:
	•	id
	•	farm_id uuid not null references farms(id)
	•	cycle_id uuid null references grow_cycles(id)
	•	zone_id uuid null references farm_zones(id)
	•	scope_id uuid null references scopes(id)
	•	plant_id uuid null references plants(id)
	•	event_id uuid null references events(id)
	•	anomaly_type text not null
	•	threshold_breach
	•	pattern_mismatch
	•	visual_deviation
	•	sop_noncompliance_risk
	•	outcome_inconsistency
	•	detected_at timestamptz not null
	•	severity text not null
	•	status text not null default 'open'
	•	description text not null
	•	evidence_json jsonb not null default '{}'::jsonb
	•	confidence numeric(5,4) null
	•	resolved_at timestamptz null
	•	created_at
	•	updated_at

8.4 grow_memory_items

Long-term memory фермы.

Поля:
	•	id
	•	farm_id uuid not null references farms(id)
	•	scope_type text not null
	•	farm, site, room, tent, zone, bed, reservoir, user, cultivar, cycle_pattern, plant_group, plant
	•	scope_id uuid null
	•	memory_type text not null
	•	repeated_issue
	•	habit
	•	successful_strategy
	•	cultivar_trait
	•	room_pattern
	•	timing_pattern
	•	operational_risk
	•	title text not null
	•	summary text not null
	•	evidence_json jsonb not null default '[]'::jsonb
	•	strength numeric(5,4) null
	•	confidence numeric(5,4) null
	•	first_seen_at timestamptz null
	•	last_seen_at timestamptz null
	•	active boolean not null default true
	•	created_at
	•	updated_at

8.5 causal_links

WHY ENGINE уровень — причинные гипотезы и связи.

Поля:
	•	id
	•	farm_id uuid not null references farms(id)
	•	cycle_id uuid null references grow_cycles(id)
	•	scope_id uuid null references scopes(id)
	•	cause_entity_type text not null
	•	cause_entity_id uuid null
	•	effect_entity_type text not null
	•	effect_entity_id uuid null
	•	link_type text not null
	•	likely_causes
	•	contributes_to
	•	explains
	•	worsens
	•	mitigates
	•	description text null
	•	confidence numeric(5,4) null
	•	evidence_json jsonb not null default '{}'::jsonb
	•	created_at
	•	updated_at

8.6 daily_focus_cards

Готовая выдача "что важно сегодня".

Поля:
	•	id
	•	farm_id uuid not null references farms(id)
	•	cycle_id uuid null references grow_cycles(id)
	•	zone_id uuid null references farm_zones(id)
	•	scope_id uuid null references scopes(id)
	•	focus_date date not null
	•	headline text null
	•	summary text null
	•	risks_json jsonb not null default '[]'::jsonb
	•	actions_json jsonb not null default '[]'::jsonb
	•	sop_items_json jsonb not null default '[]'::jsonb
	•	insight_ids uuid[] not null default '{}'
	•	generated_at timestamptz null
	•	created_at
	•	updated_at

⸻

9. VOICE AND CONVERSATION

9.1 voice_sessions

Сессия голосового взаимодействия.

Поля:
	•	id
	•	farm_id uuid not null references farms(id)
	•	cycle_id uuid null references grow_cycles(id)
	•	zone_id uuid null references farm_zones(id)
	•	scope_id uuid null references scopes(id)
	•	user_id uuid null
	•	started_at timestamptz not null default now()
	•	ended_at timestamptz null
	•	status text not null default 'active'
	•	context_json jsonb not null default '{}'::jsonb
	•	created_at
	•	updated_at

9.2 conversation_messages

Диалог с ассистентом.

Поля:
	•	id
	•	farm_id uuid not null references farms(id)
	•	session_id uuid null references voice_sessions(id)
	•	cycle_id uuid null references grow_cycles(id)
	•	zone_id uuid null references farm_zones(id)
	•	scope_id uuid null references scopes(id)
	•	related_event_id uuid null references events(id)
	•	role text not null — user, assistant, system
	•	modality text not null — text, voice
	•	message_text text null
	•	media_asset_id uuid null references media_assets(id)
	•	transcript_confidence numeric(5,4) null
	•	grounding_json jsonb not null default '{}'::jsonb
	•	created_at

9.3 transcription_jobs

Хранит обработку аудио.

Поля:
	•	id
	•	farm_id uuid not null references farms(id)
	•	media_asset_id uuid not null references media_assets(id)
	•	status text not null
	•	transcript_text text null
	•	segments_json jsonb not null default '[]'::jsonb
	•	language text null
	•	model_name text null
	•	created_at
	•	updated_at

⸻

10. REPORTS AND PUBLICATIONS

10.1 reports

Главная таблица отчётов.

Поля:
	•	id
	•	farm_id uuid not null references farms(id)
	•	cycle_id uuid null references grow_cycles(id)
	•	zone_id uuid null references farm_zones(id)
	•	scope_id uuid null references scopes(id)
	•	report_type text not null
	•	daily
	•	cycle
	•	manager
	•	public_html
	•	pdf
	•	title text not null
	•	status text not null default 'draft'
	•	period_start timestamptz null
	•	period_end timestamptz null
	•	summary_text text null
	•	narrative_text text null
	•	report_json jsonb not null default '{}'::jsonb
	•	created_by uuid null
	•	published_at timestamptz null
	•	created_at
	•	updated_at

10.2 report_artifacts

Артефакты отчёта: PDF, HTML, snapshots.

Поля:
	•	id
	•	farm_id uuid not null references farms(id)
	•	report_id uuid not null references reports(id)
	•	artifact_type text not null — pdf, html, json_export, preview_image
	•	media_asset_id uuid null references media_assets(id)
	•	url text null
	•	version text null
	•	created_at
	•	updated_at

10.3 publication_targets

Куда отчёты можно публиковать.

Поля:
	•	id
	•	farm_id uuid not null references farms(id)
	•	target_type text not null — internal_page, public_page, external_api
	•	name text not null
	•	config jsonb not null default '{}'::jsonb
	•	active boolean not null default true
	•	created_at
	•	updated_at

10.4 publication_jobs

Попытки публикации.

Поля:
	•	id
	•	farm_id uuid not null references farms(id)
	•	report_id uuid not null references reports(id)
	•	target_id uuid not null references publication_targets(id)
	•	status text not null default 'pending'
	•	request_payload jsonb not null default '{}'::jsonb
	•	response_payload jsonb not null default '{}'::jsonb
	•	published_url text null
	•	created_at
	•	updated_at

⸻

11. KNOWLEDGE GROUNDING

11.1 knowledge_sources

Профессиональные источники.

Поля:
	•	id
	•	farm_id uuid null references farms(id)
	•	name text not null
	•	source_type text not null — internal_sop, curated_doc, research_article, website, manual
	•	url text null
	•	trust_level text not null default 'curated'
	•	active boolean not null default true
	•	metadata jsonb not null default '{}'::jsonb
	•	created_at
	•	updated_at

11.2 knowledge_items

Нормализованные единицы knowledge base.

Поля:
	•	id
	•	source_id uuid not null references knowledge_sources(id)
	•	title text null
	•	body text not null
	•	tags text[] not null default '{}'
	•	topic text null
	•	citation_text text null
	•	metadata jsonb not null default '{}'::jsonb
	•	created_at
	•	updated_at

⸻

12. EMBEDDINGS AND RETRIEVAL PREP

Принцип

Embeddings не являются обязательными для первого SQL слоя, но модель должна быть готова к ним.

12.1 searchable_documents

Унифицированный retrieval layer.

Поля:
	•	id
	•	farm_id uuid not null references farms(id)
	•	doc_type text not null
	•	event
	•	observation
	•	photo_analysis
	•	sop_definition
	•	ai_insight
	•	grow_memory_item
	•	report
	•	knowledge_item
	•	source_id uuid not null
	•	cycle_id uuid null references grow_cycles(id)
	•	zone_id uuid null references farm_zones(id)
	•	scope_id uuid null references scopes(id)
	•	plant_id uuid null references plants(id)
	•	title text null
	•	body text not null
	•	metadata jsonb not null default '{}'::jsonb
	•	embedding vector null — при использовании pgvector
	•	created_at
	•	updated_at

⸻

Ключевые связи между доменами

Event-centered graph
	•	events ← central timeline
	•	observations.event_id -> events.id
	•	actions_log.event_id -> events.id
	•	sop_executions.event_id -> events.id
	•	ai_insights.event_id -> events.id
	•	anomalies.event_id -> events.id
	•	event_entities связывает событие с фото, readings, reports, conversation messages и т.д.

Cycle context

Почти все рабочие домены имеют:
	•	farm_id
	•	cycle_id
	•	scope_id
	•	zone_id как shortcut там, где это полезно

Это позволяет собирать весь контекст для AI и отчётов.

Trust / grounding
	•	ai_insights содержат выводы
	•	insight_grounding показывает, на чём они основаны
	•	knowledge_items дают curated knowledge
	•	causal_links дают WHY ENGINE слой

⸻

Индексы

Минимально рекомендуемые индексы для MVP:

events
	•	(farm_id, occurred_at desc)
	•	(cycle_id, occurred_at desc)
	•	(scope_id, occurred_at desc)
	•	(zone_id, occurred_at desc)
	•	(event_type, occurred_at desc)
	•	gin index on tags

sensor_readings
	•	(farm_id, captured_at desc)
	•	(scope_id, captured_at desc)
	•	(zone_id, captured_at desc)
	•	(cycle_id, captured_at desc)
	•	(device_id, captured_at desc)
	•	(metric_id, captured_at desc)

media_assets
	•	(cycle_id, captured_at desc)
	•	(scope_id, captured_at desc)
	•	(zone_id, captured_at desc)
	•	(plant_id, captured_at desc)

sop_runs
	•	(farm_id, coalesce(due_at, due_window_start) asc)
	•	(status, coalesce(due_at, due_window_start) asc)
	•	(scope_id, coalesce(due_at, due_window_start) asc)
	•	(cycle_id, coalesce(due_at, due_window_start) asc)

ai_insights
	•	(farm_id, created_at desc)
	•	(cycle_id, created_at desc)
	•	(scope_id, created_at desc)
	•	(insight_type, created_at desc)

grow_memory_items
	•	(farm_id, scope_type, scope_id)
	•	(memory_type, active)

searchable_documents
	•	(farm_id, doc_type)
	•	(cycle_id)
	•	(scope_id)
	•	(zone_id)

⸻

Row Level Security

Подробная модель доступа, политики и границы тенанта: ADR-009.

Так как используется Supabase, принимаются следующие принципы:
	1.	Все рабочие таблицы должны быть защищены через RLS.
	2.	Пользователь видит только те записи, где имеет доступ к farm_id через farm_users.
	3.	Менеджер может видеть больше scope, чем обычный гровер.
	4.	Публичные grow reports и public HTML pages должны отдаваться через отдельный publish layer, а не через открытие внутренних таблиц.
	5.	Background jobs и Edge Functions работают через service role и не обходят доменные инварианты записи.

⸻

Что хранить как JSONB, а что как отдельные таблицы

Отдельные таблицы

Выносим отдельно всё, что:
	•	имеет свой жизненный цикл,
	•	часто фильтруется,
	•	участвует в связях,
	•	используется в аналитике,
	•	важно для RLS.

Поэтому отдельными таблицами идут:
	•	events
	•	observations
	•	sensor_readings
	•	media_assets
	•	sop_* tables
	•	ai_insights
	•	anomalies
	•	grow_memory_items
	•	reports

JSONB

Используем для:
	•	редко фильтруемых деталей,
	•	model payloads,
	•	AI structured outputs,
	•	dynamic config,
	•	trigger config,
	•	evidence bundles,
	•	report sections,
	•	snapshot aggregates.

⸻

Рекомендуемый порядок миграций

Чтобы слабая модель или разработчик могли развернуть схему без циклической путаницы, миграции лучше строить в таком порядке:
	1.	farms, farm_sites, farm_zones, farm_users
	2.	grow_cycles, plants, plant_groups
	3.	scopes
	4.	events, event_links, event_entities
	5.	observations, actions_log
	6.	sensor_devices, sensor_metrics, sensor_readings
	7.	media_assets, photo_analysis
	8.	sop_definitions, sop_triggers, sop_assignments, sop_runs, sop_executions
	9.	conversation_messages, voice_sessions, transcription_jobs
	10.	ai_insights, insight_grounding, anomalies, grow_memory_items, causal_links
	11.	reports, report_artifacts, publication_targets, publication_jobs
	12.	searchable_documents и остальные derived tables

Если нужна более простая первая итерация, разрешается:
	•	создать `plants` и `plant_groups` позже
	•	создать `scopes` после `grow_cycles`, а затем backfill-ить `scope_id` в события
	•	сначала хранить часть derived слоя без отдельных materialized summary таблиц

⸻

Поэтапный срез схемы

Чтобы не путать "foundation" из ADR-001 и "полный продуктовый MVP", делим минимум на два уровня.

Foundation MVP schema

Нужна для этапа `Foundation MVP` из ADR-001, где цель: вести журнал без AI-магии.

Обязательные таблицы Foundation MVP
	•	farms
	•	farm_zones
	•	farm_users
	•	grow_cycles
	•	scopes
	•	events
	•	observations
	•	actions_log
	•	sensor_readings
	•	media_assets
	•	sop_definitions
	•	sop_triggers
	•	sop_runs
	•	sop_executions

Product MVP schema

Нужна для первой версии продукта, в которой уже есть grounded AI, voice и reports.

Обязательные таблицы Product MVP
	•	farms
	•	farm_zones
	•	scopes
	•	farm_users
	•	grow_cycles
	•	events
	•	observations
	•	actions_log
	•	sensor_devices
	•	sensor_readings
	•	media_assets
	•	photo_analysis
	•	sop_definitions
	•	sop_triggers
	•	sop_runs
	•	sop_executions
	•	ai_insights
	•	insight_grounding
	•	reports
	•	report_artifacts
	•	conversation_messages
	•	searchable_documents

Можно отложить на V2
	•	plants
	•	plant_groups
	•	cycle_stage_history
	•	sensor_snapshots
	•	environmental_daily_stats
	•	photo_timeline_signals
	•	sop_assignments
	•	sop_compliance_daily
	•	anomalies как отдельную таблицу, если сначала достаточно ai_insights
	•	grow_memory_items
	•	causal_links
	•	daily_focus_cards
	•	publication_jobs

⸻

Принципы наполнения данных

Raw first

Сначала сохраняем raw event / raw reading / raw media, затем делаем AI parsing и enrichment.

Append-friendly

История должна дополняться, а не переписываться. Исправления фиксируются отдельными событиями или revision layer.

Explainability by design

Каждый AI-ответ или отчёт должен иметь grounding chain.

Rebuildable derived layer

Memory, anomalies, snapshots, daily summaries и reports должны быть пересчитываемыми производными слоями.

⸻

Канонические write use cases

Чтобы реализация не разъехалась по фронтенду, Edge Functions и cron jobs, запись в данные должна происходить через конечный набор backend use cases.

Обязательные write use cases для MVP:
	•	create_log_entry
	•	create_sensor_reading
	•	create_media_asset
	•	create_sop_definition
	•	create_sop_run
	•	create_sop_execution
	•	create_ai_insight
	•	generate_report

Контракты use cases:
	•	валидируют `farm_id`, `cycle_id`, `scope_id`
	•	создают запись в `events`, если действие относится к timeline
	•	создают специализированную запись в доменной таблице
	•	создают связи через `event_entities`, если есть вложенные сущности
	•	не смешивают raw fact и AI interpretation в одной операции

Примеры:
	•	`create_log_entry` создаёт `events` + опционально `observations` / `actions_log`
	•	`create_sensor_reading` создаёт `sensor_readings` и при необходимости событие `sensor_snapshot`
	•	`create_sop_execution` создаёт `sop_executions` и событие `sop_executed` или `sop_missed`
	•	`generate_report` создаёт `reports`, `report_artifacts` и событие `report_generated`

⸻

Последствия

Положительные
	•	появляется единая и расширяемая data spine;
	•	AI может работать по-настоящему grounded;
	•	удобно строить daily focus, SOP и reports;
	•	можно постепенно включать WHY engine, anomaly detection и grow memory без ломки базы;
	•	Supabase/Postgres хорошо подходит под такую модель.

Отрицательные
	•	схема достаточно большая уже на раннем этапе;
	•	потребуются хорошие naming conventions и migration discipline;
	•	часть derived tables придётся поддерживать background jobs или edge functions;
	•	retrieval и insights layer нужно проектировать аккуратно, чтобы не дублировать лишнее.

⸻

Что не фиксируется этим ADR

ADR-002 не фиксирует:
	•	финальный набор Postgres enums в виде DDL;
	•	полный набор SQL constraints и partial indexes по каждому полю;
	•	финальную стратегию embeddings и pgvector;
	•	конкретный format report_json;
	•	конкретную политику versioning AI insights;
	•	выбор orchestration для pipelines enrichment.

Практическая конкретизация этих пунктов вынесена в companion document:
	•	`docs/implementation/data-platform-implementation-spec.md`

Дальнейшие углубления могут быть вынесены в отдельные ADR или implementation docs.

⸻

Следующие документы

Рекомендуется после этого подготовить:
	•	Implementation Spec: `docs/implementation/data-platform-implementation-spec.md`
	•	ADR-003: Retrieval and Context Assembly Architecture
	•	ADR-004: AI Insight Pipeline and Trust Layer
	•	ADR-005: Report Generation Pipeline
	•	ADR-006: SOP Scheduling Engine
	•	ADR-007: Voice and Conversation Flow
	•	ADR-009: RLS and Access Model (`docs/adr/adr-009-rls-access-model.md`)
	•	ADR-010: Background Jobs and Derived Data Refresh Strategy

⸻

Короткая формулировка решения

Growlog AI использует event-centered модель данных в Supabase/Postgres, где raw operations, sensor history, photos, SOP, AI insights, grow memory и reports разделены по доменам, но связаны через единый timeline и общий контекст фермы / цикла / зоны.
