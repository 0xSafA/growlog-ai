# ADR-011: Growlog AI — Mobile Client Architecture

**Status:** Proposed
**Date:** 2026-08-20
**Author:** Team Growlog AI
**Related:** ADR-001, ADR-002, ADR-003, ADR-004, ADR-005, ADR-008, ADR-009, ADR-010

---

## Context

ADR-001 originally fixed the client stack as Next.js + PWA. ADR-005 already describes a mobile-first, field-first, voice-first interaction model. The current Next.js implementation validates domain logic, Supabase integration, and AI pipelines, but the primary user surface — a grower on-site with one hand free — maps more naturally to a native mobile client.

This ADR records the decision to make **React Native (Expo) the primary client** while preserving:

* the event-centric data spine (ADR-002)
* retrieval and trust contracts (ADR-003, ADR-004)
* the five-mode UX model (ADR-005)
* background jobs and RLS (ADR-008, ADR-009)
* the photo intelligence pipeline (ADR-010)

The existing Next.js app becomes a **web companion**, not the product center of gravity.

---

## Problem

If we continue treating PWA as the primary client:

* voice capture, camera, push notifications, and offline queue remain second-class browser APIs
* mobile UX patterns (tab bar, FAB, native sheets) fight against web layout conventions already baked into `pages/` and shadcn
* domain logic in `lib/growlog/` stays coupled to Next.js API routes and server-only imports
* SOP reminders depend on the user opening the app instead of native push delivery

We need an explicit mobile architecture before scaffolding code, so we do not recreate web patterns inside React Native or fork business logic.

---

## Decision

Growlog AI adopts a **monorepo with Expo React Native as the primary client**.

| Layer | Choice | Role |
| --- | --- | --- |
| Primary client | Expo (React Native) | Daily use: capture, SOP, assistant, timeline |
| Shared domain | `packages/domain` | Pure TS: queries, mutations, types, SOP engine, retrieval helpers |
| API client | `packages/api-client` | Supabase client wrappers, RPC calls, upload helpers |
| Backend | Supabase + Edge Functions + worker | Source of truth, AI orchestration, derived data |
| Web companion | Next.js (`apps/web`) | Landing, HTML report viewer, admin — optional, secondary |

### Why Expo

* faster MVP for camera, audio, notifications, secure storage, and OTA updates
* EAS Build for App Store / Play Store without maintaining native project forks early
* Expo Router aligns with file-based routing similar to Next.js, easing mental model transfer
* escape hatch to bare workflow remains available if a native module requirement appears later

Expo is the default. Bare React Native is not rejected, but not chosen for MVP unless Expo blocks a hard requirement.

---

## Repository Layout

Target monorepo structure:

```text
growlog-ai/
├── apps/
│   ├── mobile/              # Expo React Native — primary client
│   └── web/                 # Next.js — landing, reports viewer, admin (migrated from root)
├── packages/
│   ├── domain/              # lib/growlog/*, types/* — platform-agnostic
│   └── api-client/          # Supabase queries, mutations, storage upload
├── supabase/                # migrations, RLS — unchanged
├── scripts/                 # worker, i18n checks — unchanged
└── docs/adr/
```

### Extraction rules

Move into `packages/domain` (no React, no Next, no Expo imports):

* `types/*`
* `lib/growlog/*` except route handlers and Next-specific adapters
* pure functions: SOP engine, retrieval assembly, trust helpers, report HTML builders

Keep in `apps/web`:

* Next.js `pages/api/*` until migrated to Supabase Edge Functions
* landing and report HTML rendering
* shadcn/ui components

Keep in `apps/mobile`:

* screens, navigation, native modules usage
* mobile UI components (React Native Paper, NativeWind, or custom — decided in implementation spec, not this ADR)

**Rule:** business facts and mutations never live only inside a screen component. All writes go through shared domain use cases already documented in ADR-002.

---

## Navigation Model

ADR-005 defines five core modes. The mobile app maps them to **tab navigation + persistent FAB**.

### Tab bar (primary)

| Tab | ADR-005 mode | Default route |
| --- | --- | --- |
| Home | Daily Focus | `/dashboard` |
| Timeline | Timeline | `/timeline` |
| Assistant | Assistant | `/assistant` |
| SOP | SOP Management | `/sop` |
| More | Reports, Sensors, Photos, Settings | stack from `/more` |

`More` consolidates secondary surfaces so the tab bar stays at five items and thumb-reachable.

### Persistent FAB

The golden action **REC / ADD EVENT** (ADR-005) is a floating action button visible on all primary tabs except when a full-screen capture flow is open.

FAB opens a bottom sheet with capture intents:

1. Voice log
2. Text log
3. Photo
4. Sensor reading
5. Ask the farm

Intent detection and confirmation rules remain identical to ADR-005; only the container changes from web modal to native sheet.

### Scope bar

Every primary tab shows current `farm / cycle / scope` in a persistent header (ADR-005 scope-aware UX). Tapping opens a scope picker sheet. Unresolved scope blocks strong farm-specific AI advice (ADR-004).

### Stack screens (push navigation)

| Screen | Entry |
| --- | --- |
| Log capture flow | FAB |
| SOP execution dialog | SOP tab, push notification deep link |
| SOP definition editor | SOP tab → planning view |
| Report detail | More → Reports |
| Photo gallery / detail | More → Photos, Timeline drill-down |
| Sensor manual entry | More → Sensors, FAB |
| Onboarding | first launch after auth |
| Settings | More → Settings |

### Deep links and notifications

Push notification payloads must include:

* `farm_id`, `cycle_id`, `scope_id` when applicable
* target screen: `sop_run`, `daily_focus`, `anomaly`
* `sop_run_id` for direct execution dialog entry

Cold start from notification lands in execution dialog, not generic home (ADR-005 alternative flow).

---

## Screen Mapping (Current Next.js → Mobile)

Migration reference from the existing `pages/` router implementation:

| Current route | Mobile screen | Notes |
| --- | --- | --- |
| `/dashboard` | Home tab | Daily Focus — default after login |
| `/timeline` | Timeline tab | event spine viewer |
| `/assistant` | Assistant tab | trust-aware chat |
| `/sop` | SOP tab | planning + execution list |
| `/sop/run/[id]` | SOP execution stack | deep link target |
| `/sop/new` | SOP editor stack | progressive form |
| `/log` | Capture stack | opened from FAB |
| `/photos` | More → Photos | native camera/gallery |
| `/sensors` | More → Sensors | manual entry |
| `/reports` | More → Reports | list |
| `/reports/[id]` | Report detail stack | HTML in WebView or open in web companion |
| `/settings` | More → Settings | scope, farm, cycle, locale |
| `/onboarding` | Onboarding stack | first-run only |
| `/auth/login` | Auth stack | Supabase Auth |
| `/` (landing) | **web companion only** | not shipped in mobile app |
| `/preview/*` | **web companion only** | marketing preview |

---

## Data and API Layer

### Supabase as primary API

Mobile talks directly to Supabase for:

* Auth (email/password; OAuth providers as added)
* RLS-protected reads and writes via PostgREST
* Storage uploads for photos
* Realtime subscriptions where useful (e.g. job status)

All access remains tenant-scoped through RLS (ADR-009). Mobile must not use service-role keys.

### Server-side use cases

Operations that must not run on device:

| Use case | Current location | Target |
| --- | --- | --- |
| Voice transcribe | `pages/api/voice/transcribe` | Edge Function |
| Voice extract | `pages/api/voice/extract` | Edge Function |
| Assistant ask | `pages/api/assistant/ask` | Edge Function |
| Report generate | `pages/api/reports/generate` | Edge Function + worker job |
| Sensor ingest (external) | `pages/api/sensors/ingest` | Edge Function |
| SOP materialize | `pages/api/sop/materialize` | Edge Function or RPC |

**Migration rule:** new mobile features call Edge Functions or RPCs, not Next.js API routes. Existing Next routes remain during transition; `packages/api-client` abstracts the call site so the transport can switch without screen changes.

### TanStack Query

Both mobile and web companion use TanStack Query against shared hooks in `packages/api-client`. Cache keys include `farm_id`, `cycle_id`, and `scope_id` to prevent cross-tenant bleed in UI state.

### Offline capture queue

Mobile maintains a local queue (SQLite or MMKV-backed) for:

* draft log entries pending upload
* photos pending Storage upload + `finalize_photo_capture` RPC
* failed mutations with retry metadata

Rules:

* queue items are user-initiated captures, not AI-generated facts
* sync is deterministic: upload media → call RPC → invalidate query keys
* AI extraction runs server-side after sync, same as online flow
* user sees pending/synced/failed status per item

LLM must not resolve conflicts or invent merged facts during offline sync.

---

## Native Capabilities

| Capability | Expo module / approach | ADR link |
| --- | --- | --- |
| Camera / gallery | `expo-camera`, `expo-image-picker` | ADR-010 capture stage |
| Voice record | `expo-av` | ADR-005 voice-first |
| Push notifications | `expo-notifications` + EAS | ADR-005, ADR-006 SOP reminders |
| Secure token storage | `expo-secure-store` | ADR-009 |
| Background upload | task manager / upload queue on reconnect | ADR-008 |
| Haptics | `expo-haptics` on capture confirm | UX polish |
| TTS playback | `expo-speech` or streamed audio from Edge Function | ADR-005 voice output |

Location-based SOP (ADR-001 MVP simplification) remains check-in on app open, not background geofencing, unless explicitly added in a future ADR.

---

## Web Companion Scope

Next.js (`apps/web`) is **not deprecated**, but its role narrows:

**In scope for web companion:**

* marketing landing (`/`)
* public or authenticated HTML report viewing
* manager-oriented wide layouts (optional)
* admin / configuration surfaces that benefit from keyboard and large screen

**Out of scope for web companion as primary:**

* daily grower capture flow
* voice-first field logging
* SOP execution as main path

Reports that need rich HTML layout may open in an in-app WebView on mobile or defer to the web companion URL. PDF export remains server-generated (ADR-007).

---

## Authentication

* Supabase Auth with session persisted in `expo-secure-store`
* Mobile uses `@supabase/supabase-js` with anon key only
* Auth gate: unauthenticated users see login → onboarding → Daily Focus
* Session refresh handled by Supabase client; no custom JWT logic in UI

---

## Internationalization

Existing `lib/i18n/*` message catalogs move to `packages/domain` or a dedicated `packages/i18n` package. Mobile and web share the same translation keys. Locale detection differs (device locale on mobile; browser/header on web) but message content is single-source.

---

## Testing Strategy

| Layer | Tool | Scope |
| --- | --- | --- |
| `packages/domain` | Vitest (existing) | pure logic, no change |
| `packages/api-client` | Vitest + mocked Supabase | query/mutation wrappers |
| `apps/mobile` | Jest + React Native Testing Library | screen behavior, navigation |
| E2E | Detox or Maestro (implementation spec) | capture flow, auth, SOP execution |

Existing integration tests against Supabase remain valid for domain and API client layers.

---

## Migration Phases

### Phase 0 — Documentation (this ADR)

Fix client target in ADR-001, ADR-005, and ADR-011. No code move yet.

### Phase 1 — Monorepo scaffold

* create `apps/mobile` with Expo + Expo Router
* create `packages/domain` and `packages/api-client`
* extract `types/*` and pure `lib/growlog/*` into packages
* wire Turborepo or pnpm workspaces

### Phase 2 — Core mobile surfaces

* Auth + onboarding
* Daily Focus (Home tab)
* FAB → voice/text capture flow
* Scope bar + FarmProvider equivalent

### Phase 3 — Remaining tabs

* Timeline, Assistant, SOP tab
* Photos, Sensors via More
* Push notifications for SOP

### Phase 4 — API migration

* move Next.js API routes to Edge Functions
* mobile calls through `packages/api-client` only

### Phase 5 — Web companion split

* move current Next.js app to `apps/web`
* trim web to landing + reports + admin

Each phase ships a usable increment. Phase 2 is the first demoable mobile app.

---

## Invariants (Must Not Change)

These ADR-governed rules apply unchanged on mobile:

1. Database-backed farm data is source of truth; LLM output does not invent canonical facts.
2. Resolve `farm_id`, `cycle_id`, `scope_id` before retrieval, mutation, or farm-specific guidance.
3. All time-based operations anchor to `events` or documented derived projections.
4. Writes go through explicit use cases: `create_log_entry`, `create_manual_sensor_reading`, `finalize_photo_capture`, etc.
5. AI insights are stored as `ai_insights`, not silently merged into events.
6. Trust layer surfaces confidence, grounding, and missing data on actionable output (ADR-004, ADR-005).

---

## Out of Scope

* Pixel-perfect UI kit choice (NativeWind vs Paper vs custom)
* App Store listing, ASO, and marketing assets
* Bluetooth / proprietary sensor hardware SDKs
* Background geofencing for location-based SOP
* Full offline mode for Assistant (retrieval requires network)
* Replacing Supabase or the worker architecture

These belong in implementation specs or future ADRs.

Implementation detail: [`docs/implementation/mobile-client-spec.md`](../implementation/mobile-client-spec.md) — monorepo scaffold, screen map, Phase 1 checklist.

---

## Consequences

**Pros**

* native voice, camera, and push match the field-first product vision
* shared domain package reduces duplication between mobile and web
* clear separation: mobile = operate, web = publish and administer
* existing Supabase schema, RLS, and worker investments are preserved

**Cons**

* monorepo migration cost before new feature velocity on mobile
* two UI codebases (mobile components + web shadcn) instead of one PWA
* Edge Function migration needed to remove Next.js API dependency from mobile
* App Store / Play Store release process adds operational overhead vs PWA

**Risks**

* extracting `lib/growlog/` too late causes copy-paste drift — mitigate in Phase 1
* offline queue complexity if over-scoped — MVP queue covers capture only, not full app offline
* report viewing on mobile may feel cramped — mitigate with WebView or defer to web companion

---

## Summary

Growlog AI's primary client is **Expo React Native**, organized as a monorepo with shared domain logic, Supabase as the API backbone, and Next.js relegated to a web companion. Navigation implements ADR-005's five modes via tabs, a persistent FAB, and scope-aware headers. Migration is phased: document → scaffold → Daily Focus + capture → full tabs → API migration → web split.

---

## Short Formulation

**Growlog AI ships as a native mobile app (Expo) for daily grow operations, with shared TypeScript domain packages and Supabase as the backend, while Next.js remains an optional web companion for landing and report viewing.**
