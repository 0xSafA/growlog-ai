# ADR-005: Growlog AI - Interaction Model and UX Architecture

**Status:** Proposed
**Date:** 2026-03-22
**Author:** Team Growlog AI
**Related:** ADR-001, ADR-002, ADR-003, ADR-004

---

## Context

Growlog AI is not just an app with data and not just an AI chat. It is an operating system for a grower's day-to-day work, where the user interacts with:

* event log
* current farm and cycle state
* SOP tasks and procedures
* AI assistant
* photos and media history
* reports and publication artifacts

After `ADR-001..004`, the following are already fixed:

* the product is built around the event log and farm memory
* AI must work through retrieval and a trust layer
* SOP is part of the operational core
* reports use the same data spine as journal and AI

If UX is not fixed explicitly, the architecture will quickly drift:

* chat will start competing with the journal
* SOP will become an isolated, rarely used admin page
* voice will become just another feature instead of the primary capture path
* reports will live separately from the real history
* the user will not understand what to do now

So we need a single interaction model that defines:

* how the user thinks about the product
* which interface modes exist
* which mode is the default
* where capture lives
* how AI, journal, SOP, and reports connect to each other
* which UX decisions are incompatible with the architecture

---

## Main Decision

Growlog AI is built as:

> **farm operating journal + AI assistant + daily action focus + SOP coordinator**

The interface is **not**:

* just a chat
* just a CRM
* just a task tracker
* just a notes journal

The interface is a unified system for interacting with farm memory and current actions.

Core UX rule:

**the user must always understand three things:**

1. what matters now
2. what happened recently
3. what can be quickly logged or asked

---

## Main UX Paradigm

```md
System is:
- event-first
- voice-first
- action-oriented
- context-aware
- trust-aware
```

Meaning:

* `event-first`: everything starts from facts and actions, not from abstract conversation
* `voice-first`: the fastest capture path should be voice
* `action-oriented`: the product helps the user act, not only inspect
* `context-aware`: everything is tied to farm / cycle / scope
* `trust-aware`: AI in the UI must expose confidence, evidence, and missing data

---

## Canonical Product Mental Model

The user should perceive Growlog AI like this:

* `Daily Focus` tells what matters now
* `Timeline` shows what actually happened
* `Assistant` explains what it means and what to do
* `SOP` manages procedures and execution
* `Reports` turns history into artifacts

These are not 5 separate apps. They are 5 views over the same farm memory.

---

## Main Interface Modes

The system has 5 key modes.

### 1. Daily Focus

**This is the default home screen.**

Purpose:
show the user what matters now.

Contains:

* current cycle status
* key deviations
* active risks
* today's and overdue SOP items
* 1-3 main recommendations
* quick actions: log event, upload photo, answer SOP

Principles:

* minimal text
* maximum clarity
* strict prioritization
* risk and action first, explanation second

Screen structure:

* Alerts / Risks
* Today SOP
* Key Snapshot
* AI Focus
* Quick Actions

`Daily Focus` must not become:

* a long chat
* an endless feed
* an all-time report

### 2. Timeline

Purpose:
show what happened.

Contains:

* events
* photos
* actions
* SOP-related events
* sensor data in aggregated form
* stage transitions

Functions:

* time scrolling
* filters
* drill-down into event details
* compare by day or stage

This is:

* source of truth for the human
* basis for retrieval
* basis for reports

`Timeline` must not force the user to think in terms of tables or technical entities.

### 3. Assistant

Purpose:
understand what it means and what to do.

Contains:

* user questions
* grounded AI answers
* WHY explanations
* recommendations
* clarification requests

Required properties:

* links to facts
* confidence
* missing data
* explicit separation of facts from interpretation

`Assistant` must not:

* replace the journal
* create hidden facts without confirmation
* become the only way to use the product

### 4. SOP Management

Purpose:
manage procedures and their real execution.

Contains:

* SOP definitions
* trigger rules
* active SOP runs
* execution history
* compliance view

SOP mode must allow the user to:

* create and edit procedures
* understand why a SOP fired
* mark `done / delayed / skipped / blocked`
* complete follow-up dialog

This is not just a checklist. It is the operational discipline module.

### 5. Reports

Purpose:
present outcome and history as artifacts.

Contains:

* daily reports
* cycle reports
* manager reports
* public grow story
* PDF / HTML artifacts

Reports mode must use the same history as timeline, not a separate hand-made presentation layer.

---

## Golden Action

The main action in the system is:

> **REC / ADD EVENT**

This is the central action point of the UI.

It must:

* be accessible almost everywhere
* open a fast capture flow
* avoid long forms
* support voice, text, photo, and quick SOP response

Golden rule:

if the user does not know where to go, pressing `REC` must always be a valid next step.

---

## Capture Model

Capture is not a separate app section. It is a cross-mode capability.

Capture must be launchable:

* from `Daily Focus`
* from `Timeline`
* from `Assistant`
* from SOP reminder or execution dialog
* from system CTA after photo or voice input

Capture types:

1. Event log
2. Photo log
3. Sensor or manual measurement
4. SOP response
5. Ask the farm

Rule:

the user should not be forced to select a technical record type first. The system helps infer intent, then asks only for minimal confirmation.

---

## Voice-first UX

The system is optimized for voice as the fastest capture path, especially in field conditions.

### Voice Input Types

1. Event log
2. Assistant question
3. SOP response
4. Quick status comment

The system should infer the probable voice intent automatically, but must not silently store the wrong interpretation as fact.

### Canonical Voice Flow

1. record
2. upload
3. transcribe
4. detect intent
5. structure result
6. confirm if a fact will be written
7. save or answer

Rule:

if the result of voice flow is a journal entry or SOP execution, the user must get a fast chance to confirm or correct the interpretation.

### Voice Output

The system should be able to:

* answer with voice
* read `Daily Focus`
* read recommendations
* guide step-by-step SOP dialog

Voice output is optional convenience, not a separate architecture.

---

## Default Navigation Model

Canonical navigation model:

* default entry -> `Daily Focus`
* from there the user moves:
* to `Timeline` to inspect facts
* to `Assistant` to understand meaning
* to `SOP` to work with procedures
* to `Reports` to generate artifacts

Transition meaning:

* `Daily Focus -> Timeline`: show what happened
* `Daily Focus -> Assistant`: explain what this means
* `Daily Focus -> SOP`: let me execute or inspect procedures
* `Timeline -> Assistant`: explain this part of history
* `Assistant -> Timeline`: show the evidence
* `Reports -> Timeline`: show where the story came from

The user must not lose current `farm / cycle / scope` when moving between modes.

---

## Scope-aware UX

Every major screen must be context-aware relative to:

* `farm`
* `cycle`
* `scope`

The user should always see:

* where they are
* which cycle the screen belongs to
* which scope the conclusions and actions refer to

If scope is ambiguous:

* the UI must show it
* AI must not give strong farm-specific advice

---

## Trust-aware UX

Because `ADR-004` introduces a trust layer, the UI must expose trust signals.

Every significant AI output in the interface must be able to show:

* grounding
* confidence
* missing data
* alternatives, when relevant

This is especially required in:

* `Assistant`
* `Daily Focus`
* anomaly cards
* WHY explanations

It is forbidden to:

* present an AI recommendation as unquestionable fact
* hide ambiguity behind fluent text
* hide absence of data

---

## SOP UX Rules

SOP must not live only as an admin configuration page.

There are 3 UX views of SOP:

1. Planning view
   * definitions
   * triggers
   * applicability and assignment

2. Execution view
   * active due items
   * overdue items
   * response dialog

3. Compliance view
   * history
   * completion rates
   * missed and blocked patterns

Key rule:

for growers, the main SOP interaction is not definition editing. It is execution dialog in the context of today's work.

---

## Minimizing Cognitive Load

Main principle:

> the user should not have to think where to click or which mode is the correct one

Required rules:

* one primary action button
* minimal required fields
* one main call-to-action per screen
* long forms use progressive disclosure
* important states are visible without deep drill-down

Additional rule:

capture over perfection.

The product should help the user record the fact first, then refine structure, not the other way around.

---

## Screen-level Primary Actions

To prevent modes from competing with each other, every screen must have one dominant action category.

* `Daily Focus` -> do the most important action now
* `Timeline` -> inspect and log facts
* `Assistant` -> ask and understand
* `SOP` -> execute or configure procedure
* `Reports` -> generate or export artifact

If one screen ends up with 3-4 equally dominant CTAs, that is a violation of the interaction model.

---

## UI to Data Model Mapping

| UI Mode | Primary Sources |
| --- | --- |
| Daily Focus | `daily_focus_cards`, `ai_insights`, `sop_runs`, `anomalies`, `sensor_snapshots` |
| Timeline | `events`, `observations`, `actions_log`, `media_assets`, `sensor_readings` |
| Assistant | retrieval context from `ADR-003` + `ai_insights` from `ADR-004` |
| SOP Management | `sop_definitions`, `sop_triggers`, `sop_runs`, `sop_executions`, `sop_compliance_daily` |
| Reports | `reports`, `report_artifacts`, `media_assets`, `ai_insights`, `daily_timelines` |

Rule:

A UI mode must not invent a parallel data model. Every screen must work on top of canonical entities from `ADR-002`.

---

## UX Principles

```md
- speed over completeness
- capture over perfection
- explain over suggest
- trust over fluency
- minimal cognitive load
- one primary action per screen
- scope must be visible
```

---

## Mobile-first and Field-first

The product must be:

* easy to use one-handed
* fast on mobile internet
* usable on-site
* PWA-first

Practical consequences:

* important CTAs must be reachable by thumb
* capture must open quickly
* critical information should be visible without heavy tables
* voice and photo flows must not break because of excessive forms

---

## Empty, Loading, and Failure States

The interaction model must define not only happy paths.

### Empty States

When data is sparse, a screen should guide the user instead of just being blank:

* `Daily Focus`: start with first log / add photo / create SOP
* `Timeline`: history is empty so far
* `Assistant`: ask a question or add context
* `Reports`: not enough material yet for a report

### Loading States

During AI and retrieval operations, the interface must indicate:

* what is happening
* whether context is being assembled
* whether clarification is expected

### Failure States

If AI cannot safely provide a strong answer:

* the UI must show the safe fallback
* it must not disguise it as a normal confident answer

---

## Confirmation Model

Not every action requires the same level of confirmation.

### Confirmation is required

* when voice or text is interpreted as a new fact
* when SOP execution has meaningful consequences
* when a user changes SOP structure

### Confirmation can be minimized

* when uploading a photo
* when asking a simple assistant question
* for navigation actions

Rule:

the system should ask for confirmation when risk of error is high, not everywhere all the time.

---

## User Behavior Model

Canonical flow:

1. The user opens `Daily Focus`.
2. Sees what matters today.
3. Takes action or responds to SOP.
4. Quickly logs a fact via voice or photo.
5. Asks the assistant when needed.
6. Later generates a report or grow report.

Alternative flow:

1. The user enters from a SOP notification.
2. Lands directly in execution dialog.
3. Marks completion.
4. Adds photo and comment if needed.
5. Returns to `Daily Focus`.

---

## What Counts as Incompatible UX

The following decisions violate product architecture:

* making `Assistant` the default home screen instead of `Daily Focus`
* hiding `REC / ADD EVENT` deep in navigation
* separating SOP execution from the daily working flow
* showing AI advice without confidence and grounding when it affects action
* building reports as a detached manual editor unrelated to timeline
* losing current `scope` when moving between `Timeline`, `Assistant`, and `SOP`
* requiring a long form where the user could say it in 5 seconds by voice

---

## Out of Scope

This ADR does not define:

* colors
* fonts
* UI kit
* pixel-perfect design
* specific animation details

These belong in design system and implementation docs, but must not violate the interaction contract.

---

## Summary

Growlog AI UX is an interface for interacting with farm memory and current work, not an interface for managing tables, chats, or tasks separately.

The user should always have a clear path to:

* see what matters now
* quickly capture a fact
* understand what is happening
* execute SOP
* generate a report

---

## Short Formulation

**Growlog AI uses a voice-first, event-first, trust-aware interaction model with five core modes (`Daily Focus`, `Timeline`, `Assistant`, `SOP Management`, `Reports`) and one main action point (`REC / ADD EVENT`) to unify capture, execution, explanation, and reporting into a single grower workflow.**
