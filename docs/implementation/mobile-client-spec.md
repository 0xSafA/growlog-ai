# Growlog AI — Mobile Client Implementation Spec

**Статус:** Draft  
**Дата:** 2026-08-20  
**Автор:** Team Growlog AI  
**Связан с:** ADR-001, ADR-005, ADR-011, `data-platform-implementation-spec.md`

---

## Назначение

Этот документ переводит ADR-011 в уровень, пригодный для scaffold и первой итерации mobile client.

Цели:

- зафиксировать monorepo layout и границы пакетов;
- дать карту экранов и компонентов с привязкой к текущему Next.js коду;
- описать Expo Router structure, providers, API client и offline queue;
- дать чеклист Phase 1, после которого mobile app демонстрируема (auth → Daily Focus → capture).

Документ не заменяет ADR. Он конкретизирует ADR-011 для реализации.

---

## Главные правила

1. **Domain logic не дублируется.** Мутации и запросы живут в `packages/domain` / `packages/api-client`, не в screen files.
2. **Screen = composition.** Экран собирает hooks, layout и UI; бизнес-правила — в shared packages.
3. **Тот же event spine.** Mobile пишет через те же use cases: `createLogEntry`, `createPhotoCaptureEvent`, `executeSopRun`, etc.
4. **Trust-aware UI обязателен.** Карточки AI (Daily Focus, Assistant) показывают confidence, grounding, missing_data (ADR-004, ADR-005).
5. **Scope visible everywhere.** `ContextScopeBar` equivalent на всех primary tabs.
6. **FAB persistent.** Golden action виден на primary tabs, скрыт только в full-screen capture flow.

---

## Monorepo Scaffold

### Целевая структура

```text
growlog-ai/
├── apps/
│   ├── mobile/                    # Expo SDK 52+, Expo Router 4
│   └── web/                       # текущий Next.js (миграция позже)
├── packages/
│   ├── domain/                    # pure TS: types, growlog, assistant, voice schemas
│   ├── api-client/                # Supabase factory, hooks, server call wrappers
│   └── i18n/                      # messages/*, translate, locales (optional split)
├── supabase/
├── scripts/
├── docs/
├── pnpm-workspace.yaml
├── turbo.json                     # optional, recommended
└── package.json                   # root scripts
```

### `pnpm-workspace.yaml`

```yaml
packages:
  - apps/*
  - packages/*
```

### Root `package.json` scripts (target)

```json
{
  "scripts": {
    "dev": "turbo dev",
    "dev:mobile": "pnpm --filter @growlog/mobile dev",
    "dev:web": "pnpm --filter @growlog/web dev",
    "worker": "pnpm --filter @growlog/web worker",
    "build": "turbo build",
    "test": "turbo test",
    "lint": "turbo lint"
  }
}
```

На Phase 1 допустимо без Turborepo: `pnpm --filter @growlog/mobile start` из корня.

### `apps/mobile` — bootstrap

```bash
pnpm create expo-app apps/mobile --template tabs
# затем: expo-router, @supabase/supabase-js, @tanstack/react-query,
# expo-secure-store, expo-av, expo-camera, expo-image-picker,
# expo-notifications, react-native-safe-area-context
```

**Package name:** `@growlog/mobile`  
**Entry:** `expo-router/entry`  
**TypeScript:** strict, paths → `@growlog/domain`, `@growlog/api-client`

### Environment variables (`apps/mobile/.env`)

```env
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_API_BASE_URL=          # Next.js or Edge Functions base until migration
```

Правило: только `EXPO_PUBLIC_*` на device. Service role keys запрещены.

---

## Package Boundaries

### `packages/domain`

Platform-agnostic. Запрещены импорты: `react`, `react-native`, `next`, `expo`, `@supabase/ssr`.

| Source (current) | Target | Notes |
| --- | --- | --- |
| `types/*` | `packages/domain/src/types/` | без изменений |
| `lib/growlog/queries.ts` | `packages/domain/src/growlog/queries.ts` | принимает SupabaseClient param |
| `lib/growlog/mutations.ts` | `packages/domain/src/growlog/mutations.ts` | idem |
| `lib/growlog/sop-*.ts` | `packages/domain/src/growlog/sop/` | engine, queries, mutations |
| `lib/growlog/retrieval/*` | `packages/domain/src/growlog/retrieval/` | server-side too |
| `lib/growlog/daily-focus-insights.ts` | domain | constants + types |
| `lib/growlog/photo-constants.ts` | domain | size limits |
| `lib/assistant/*` | `packages/domain/src/assistant/` | schemas, trust, prompts |
| `lib/voice/extraction-schema.ts` | domain | |
| `lib/voice/extractable-event-types.ts` | domain | |
| `lib/i18n/messages/*` | `packages/i18n/` or domain | shared catalogs |
| `lib/i18n/translate.ts`, `locales.ts`, `types.ts` | packages/i18n | |

**Остаётся в `apps/web` (server-only):**

| Source | Reason |
| --- | --- |
| `lib/supabase/admin.ts` | service role |
| `lib/supabase/middleware.ts` | Next middleware |
| `lib/api/auth-from-request.ts` | Next request |
| `lib/growlog/background-worker-core.ts` | worker process |
| `lib/growlog/report-html.ts` | HTML rendering |
| `pages/api/*` | until Edge migration |

**Split later (used by both, but needs adapter):**

| Source | Strategy |
| --- | --- |
| `lib/growlog/photo-pipeline.ts` | domain logic + platform upload adapter in api-client |
| `lib/voice/buffer-to-base64.ts` | api-client or mobile util (RN has different binary APIs) |

### `packages/api-client`

Thin layer over Supabase + authenticated HTTP to AI endpoints.

```text
packages/api-client/src/
├── supabase/
│   ├── create-mobile-client.ts    # @supabase/supabase-js + SecureStore session
│   └── create-web-client.ts       # @supabase/ssr (later, when web moves)
├── hooks/
│   ├── use-farms.ts
│   ├── use-active-cycle.ts
│   ├── use-scopes.ts
│   ├── use-daily-focus.ts
│   ├── use-timeline-events.ts
│   ├── use-sop-runs.ts
│   └── use-advisor-ask.ts
├── server/
│   ├── voice-transcribe.ts        # POST /api/voice/transcribe (temporary)
│   ├── voice-extract.ts
│   ├── assistant-ask.ts
│   ├── sop-materialize.ts
│   └── report-generate.ts
└── index.ts
```

**Правило:** screens вызывают hooks из `api-client`, hooks вызывают functions из `domain`. При миграции на Edge Functions меняется только `server/*`, не screens.

### `create-mobile-client.ts` contract

```typescript
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

export function createMobileSupabase() {
  return createClient(url, anonKey, {
    auth: {
      storage: secureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
    },
  });
}
```

---

## Expo Router Structure

```text
apps/mobile/app/
├── _layout.tsx                 # root: providers, auth gate
├── (auth)/
│   ├── _layout.tsx
│   └── login.tsx               # ← pages/auth/login.tsx
├── (onboarding)/
│   └── index.tsx               # ← pages/onboarding.tsx
├── (tabs)/
│   ├── _layout.tsx             # tab bar + scope header slot
│   ├── index.tsx               # Daily Focus ← pages/dashboard.tsx
│   ├── timeline.tsx            # ← pages/timeline.tsx
│   ├── assistant.tsx           # ← pages/assistant.tsx
│   ├── sop/
│   │   ├── index.tsx           # ← pages/sop/index.tsx
│   │   └── _layout.tsx         # stack for sop sub-routes
│   └── more/
│       ├── _layout.tsx
│       ├── index.tsx           # hub: Photos, Sensors, Reports, Settings
│       ├── photos.tsx
│       ├── sensors.tsx
│       ├── reports/
│       │   ├── index.tsx
│       │   └── [id].tsx
│       └── settings.tsx
├── capture/
│   ├── _layout.tsx             # full-screen modal stack
│   ├── index.tsx               # intent picker (sheet content)
│   ├── voice.tsx               # ← VoiceLogFlow
│   ├── text.tsx                # ← LogForm in pages/log.tsx
│   ├── photo.tsx
│   └── sensor.tsx
├── sop/
│   ├── new.tsx                 # ← pages/sop/new.tsx
│   └── run/[id].tsx            # ← pages/sop/run/[id].tsx
└── +not-found.tsx
```

### Navigation groups

| Group | Presentation | FAB visible |
| --- | --- | --- |
| `(tabs)` | tab bar, bottom | yes |
| `capture/*` | modal / full-screen stack | no |
| `sop/run/[id]` | stack push | no |
| `(auth)`, `(onboarding)` | no tabs | no |

### Deep links (Expo Linking)

```text
growlog://sop/run/:id
growlog://dashboard
growlog://capture/voice
```

Push notification payload → `router.push(`/sop/run/${sopRunId}`)`.

---

## Layout Components (Mobile)

Mapping from current web layout to mobile primitives.

| Web component | Mobile component | Path |
| --- | --- | --- |
| `AppShell` | `AppTabLayout` | `apps/mobile/components/layout/AppTabLayout.tsx` |
| `ContextScopeBar` | `ScopeBar` | `components/layout/ScopeBar.tsx` |
| `CaptureFab` | `CaptureFab` | `components/layout/CaptureFab.tsx` — `Pressable` + `@gorhom/bottom-sheet` |
| `PageHead` | `Stack.Screen options={{ title }}` | expo-router |
| `LanguageSwitcher` | `LanguagePicker` | settings + header overflow menu |
| `ThemeToggle` | `useColorScheme` + optional toggle in settings | |
| bottom nav in `AppShell` | `(tabs)/_layout.tsx` `Tabs` | 5 tabs per ADR-011 |

### Tab bar (canonical)

| Tab key | Icon | Route | Web equivalent |
| --- | --- | --- | --- |
| `index` | home | `(tabs)/index` | `/dashboard` |
| `timeline` | list | `(tabs)/timeline` | `/timeline` |
| `assistant` | message | `(tabs)/assistant` | `/assistant` |
| `sop` | clipboard | `(tabs)/sop` | `/sop` |
| `more` | menu | `(tabs)/more` | photos, sensors, reports, settings |

Web currently exposes Reports as a primary tab; mobile moves Reports under **More** per ADR-011 (keep thumb reach for capture-heavy tabs).

### Header structure (all tabs)

```text
┌─────────────────────────────────────┐
│ Growlog AI          [farm ▼] [⋯]   │
│ Daily Focus                         │
│ Farm › Cycle › Scope               │  ← ScopeBar
├─────────────────────────────────────┤
│           screen content            │
│                                     │
│         ┌──────────────┐            │
│         │  🎤  Log      │            │  ← CaptureFab (floating)
│         └──────────────┘            │
├─────────────────────────────────────┤
│ Home │ Timeline │ AI │ SOP │ More  │
└─────────────────────────────────────┘
```

---

## Screen Specifications

Каждый экран: **purpose**, **web source**, **data hooks**, **primary actions**, **components to build**.

### Auth — `login.tsx`

| | |
| --- | --- |
| **Purpose** | Supabase email/password sign-in |
| **Web source** | `pages/auth/login.tsx`, `components/auth/LoginPageClient.tsx` |
| **Hooks** | `supabase.auth.signInWithPassword`, session listener |
| **Actions** | Sign in → redirect to onboarding or `(tabs)` |
| **Components** | `LoginForm`, `AuthLayout` |
| **Gate** | `(auth)` group; root `_layout` redirects if session exists |

### Onboarding — `(onboarding)/index.tsx`

| | |
| --- | --- |
| **Purpose** | First farm + cycle setup |
| **Web source** | `pages/onboarding.tsx` |
| **Domain** | `createFoundationSetup` from `mutations.ts` |
| **Actions** | Create farm/cycle → `(tabs)/index` |
| **Redirect** | If `farms.length > 0` → dashboard |
| **Components** | `OnboardingForm` (farm name, tz, cycle, cultivar, stage) |
| **Note** | Timezone default from `Intl` / `expo-localization` |

### Daily Focus — `(tabs)/index.tsx`

| | |
| --- | --- |
| **Purpose** | Default home; what matters now (ADR-005) |
| **Web source** | `pages/dashboard.tsx`, `components/daily-focus/DailyFocus.tsx` |
| **Queries** | `useOpenSopRuns` (+ materialize), `ai_insights` (daily focus types), `todayEvents`, `recentEvents` |
| **Sections** | Alerts/Risks, Today SOP, Key Snapshot, AI Focus, Quick Actions |
| **Actions** | Navigate to SOP run, open capture, open assistant |
| **Components** | `DailyFocusScreen`, `RiskCard`, `SopDueCard`, `AiFocusCard`, `QuickActionsRow` |
| **Trust** | `AiFocusCard` shows confidence_label, link to evidence |

Materialize call (temporary):

```typescript
// api-client/server/sop-materialize.ts
await postJson('/api/sop/materialize', { farmId, cycleId, anchorDate }, token);
```

### Timeline — `(tabs)/timeline.tsx`

| | |
| --- | --- |
| **Purpose** | Event spine viewer |
| **Web source** | `pages/timeline.tsx` |
| **Queries** | events by cycle, filters by type/date |
| **Actions** | Drill-down event detail sheet; jump to assistant with context |
| **Components** | `TimelineList`, `EventRow`, `EventDetailSheet`, `TimelineFilters` |
| **Performance** | `FlatList` + pagination; avoid rendering heavy tables |

### Assistant — `(tabs)/assistant.tsx`

| | |
| --- | --- |
| **Purpose** | Grounded Q&A |
| **Web source** | `pages/assistant.tsx`, `components/assistant/AdvisorChat.tsx` |
| **API** | `POST /api/assistant/ask` → migrate to Edge Function |
| **State** | conversation id in `SecureStore` or memory |
| **Components** | `AdvisorChat`, `ChatBubble`, `TrustPanel`, `GroundingList` |
| **Trust UI** | facts / interpretation / hypotheses / recommendation / confidence / missing_data / grounding |
| **Actions** | Send message; link to timeline evidence |

### SOP list — `(tabs)/sop/index.tsx`

| | |
| --- | --- |
| **Purpose** | Open runs, planning entry |
| **Web source** | `pages/sop/index.tsx` |
| **Queries** | `fetchOpenSopRuns`, definitions list |
| **Actions** | Push `sop/run/[id]`; push `sop/new` |
| **Components** | `SopRunList`, `SopPlanningSection` |

### SOP execution — `sop/run/[id].tsx`

| | |
| --- | --- |
| **Purpose** | Execution dialog (primary SOP UX) |
| **Web source** | `pages/sop/run/[id].tsx` |
| **Domain** | `executeSopRun`, `fetchSopRunById` |
| **Actions** | done / delayed / skipped / blocked / partially_done + notes |
| **Push entry** | Primary deep link target |
| **Components** | `SopExecutionForm`, `StatusPicker` |
| **Follow-up** | Required inputs per `sop-required-inputs.ts` — progressive fields, not raw JSON on mobile |

**Phase 1 simplification:** заменить JSON textareas (`measuredJson`, `evidenceJson`) на typed fields driven by `sop-required-inputs` — web currently exposes raw JSON; mobile spec requires structured inputs.

### SOP editor — `sop/new.tsx`

| | |
| --- | --- |
| **Purpose** | Create SOP definition |
| **Web source** | `pages/sop/new.tsx` |
| **Priority** | Phase 3 — not blocking Phase 1 demo |

### Capture — `capture/*`

| Screen | Web source | Native deps |
| --- | --- | --- |
| `capture/index` | FAB intent sheet | bottom sheet |
| `capture/voice` | `VoiceLogFlow.tsx` | `expo-av` Audio.Recording |
| `capture/text` | `LogForm` in `pages/log.tsx` | — |
| `capture/photo` | `pages/photos.tsx` | `expo-image-picker`, Storage upload |
| `capture/sensor` | `pages/sensors.tsx` | numeric inputs |

**Voice flow (canonical):**

1. record (`expo-av`)
2. read file → base64 (mobile util, not web `arrayBufferToBase64`)
3. `voice-transcribe` API
4. `voice-extract` API
5. review step — user confirms event type, body, occurred_at
6. `createLogEntry` with `sourceType: 'user_voice'`

Max duration: 120s (match web `VoiceLogFlow`).

### Photos — `(tabs)/more/photos.tsx`

| | |
| --- | --- |
| **Web source** | `pages/photos.tsx` |
| **Domain** | `createPhotoCaptureEvent`, `getMaxPhotoBytesVisionClient` |
| **Native** | camera or gallery picker; show upload progress |
| **Offline** | queue if offline (see below) |

### Sensors — `(tabs)/more/sensors.tsx`

| | |
| --- | --- |
| **Web source** | `pages/sensors.tsx` |
| **Domain** | manual sensor RPC / mutation |
| **Components** | `SensorReadingForm` with metric picker |

### Reports — `(tabs)/more/reports/*`

| | |
| --- | --- |
| **Web source** | `pages/reports/index.tsx`, `[id].tsx` |
| **List** | Phase 3 |
| **Detail** | `WebView` for HTML artifact or open web companion URL |
| **Generate** | `POST /api/reports/generate` — manager action, not field-critical |

### Settings — `(tabs)/more/settings.tsx`

| | |
| --- | --- |
| **Web source** | `pages/settings.tsx` |
| **Features** | farm rename, farm picker, scope picker, language, logout |
| **Storage** | farm/scope ids → `SecureStore` (replace `localStorage`) |

---

## Providers

### `FarmProvider` → `FarmContextProvider`

Port logic from `components/providers/FarmProvider.tsx` with these changes:

| Web | Mobile |
| --- | --- |
| `localStorage` keys | `expo-secure-store` |
| `createClient()` from `@/lib/supabase/client` | `createMobileSupabase()` |
| single provider in `_app.tsx` | root `app/_layout.tsx` |

Exported context shape stays identical (`farmId`, `cycle`, `scopeId`, `refetchAll`, etc.) so screen logic ports with minimal edits.

### `I18nProvider`

Reuse message catalogs from `packages/i18n`. Locale detection:

- mobile: `expo-localization` device locale → fallback `en`
- persist: `SecureStore` key `growlog_locale`

### `QueryClientProvider`

Shared TanStack Query config. Default `staleTime` for farm context: 30s; mutations invalidate explicit keys (same as web).

---

## Reusable Mobile UI Components

Minimal set for Phase 1–2. Styling: **NativeWind v4** (Tailwind-like, matches existing design tokens conceptually) unless team picks otherwise.

```text
apps/mobile/components/
├── ui/
│   ├── Button.tsx
│   ├── Card.tsx
│   ├── Input.tsx
│   ├── Text.tsx
│   ├── Badge.tsx
│   └── Sheet.tsx              # @gorhom/bottom-sheet wrapper
├── trust/
│   ├── TrustPanel.tsx         # confidence, missing_data, grounding
│   └── GroundingList.tsx
├── capture/
│   ├── CaptureIntentSheet.tsx
│   ├── VoiceRecorder.tsx
│   └── PhotoPicker.tsx
├── sop/
│   ├── SopDueCard.tsx
│   └── SopExecutionForm.tsx
└── layout/
    ├── AppTabLayout.tsx
    ├── ScopeBar.tsx
    └── CaptureFab.tsx
```

Design tokens (map from `tailwind.config.js`):

| Token | Usage |
| --- | --- |
| `grow-sage`, `grow-moss`, `grow-leaf` | headers, accents |
| safe area insets | FAB bottom offset, tab bar |
| dark mode | `useColorScheme` + NativeWind dark: |

---

## Offline Capture Queue

**Scope (MVP):** log entries and photos only. Not assistant, not SOP materialize.

### Storage

`expo-sqlite` or MMKV queue table:

```typescript
type PendingCapture = {
  id: string;                    // uuid
  kind: 'log' | 'photo';
  payload: string;               // JSON serialized mutation params
  localUri?: string;             // photo file path
  status: 'pending' | 'uploading' | 'failed';
  createdAt: string;
  retryCount: number;
};
```

### Sync worker

On connectivity restore (`@react-native-community/netinfo`):

1. upload photo to Storage if needed
2. call domain mutation (`createLogEntry` / `createPhotoCaptureEvent`)
3. mark done, invalidate TanStack Query keys
4. on failure: increment retry, cap at 5, show in Settings → Sync status

**Forbidden:** LLM merge of offline items; user-confirmed facts only.

---

## Push Notifications (Phase 3)

| Event | Payload | Action |
| --- | --- | --- |
| SOP due | `{ type: 'sop_due', sopRunId, farmId, cycleId }` | open execution |
| SOP overdue | `{ type: 'sop_overdue', ... }` | open execution |
| Critical anomaly | `{ type: 'anomaly', insightId }` | open Daily Focus |

Registration: store `expo_push_token` in Supabase table (future migration). Sending: worker or Edge Function — out of Phase 1 scope.

---

## API Endpoints (Transition Map)

Until Edge migration, mobile calls the same routes as web with Bearer token:

| Endpoint | Used by | Phase |
| --- | --- | --- |
| `POST /api/voice/transcribe` | capture/voice | 1 |
| `POST /api/voice/extract` | capture/voice | 1 |
| `POST /api/assistant/ask` | assistant | 2 |
| `POST /api/sop/materialize` | daily focus, sop | 2 |
| `POST /api/reports/generate` | reports | 3 |
| `POST /api/sensors/ingest` | external only | N/A mobile |

`EXPO_PUBLIC_API_BASE_URL` points to deployed Next.js origin during transition.

---

## Phase 1 Checklist (Demoable Mobile App)

Goal: authenticated user sees Daily Focus and can save a voice or text log.

### Scaffold

- [ ] Update `pnpm-workspace.yaml` with `apps/*`, `packages/*`
- [ ] Create `packages/domain` — move `types/*`, `lib/growlog/queries.ts`, `mutations.ts`
- [ ] Create `packages/api-client` — `createMobileSupabase`, `useFarms` hook
- [ ] Create `apps/mobile` with Expo Router tabs template
- [ ] Wire path aliases in mobile + packages tsconfig

### Auth + context

- [ ] `(auth)/login.tsx` with Supabase sign-in
- [ ] Root auth gate in `app/_layout.tsx`
- [ ] `FarmContextProvider` ported (SecureStore persistence)
- [ ] `(onboarding)/index.tsx` if no farms

### Core UI

- [ ] `(tabs)/_layout.tsx` with 5 tabs + header slot
- [ ] `ScopeBar` component
- [ ] `CaptureFab` → open capture modal
- [ ] `(tabs)/index.tsx` — Daily Focus (read-only cards OK for Phase 1; materialize can be Phase 2)

### Capture

- [ ] `capture/text.tsx` — `createLogEntry`
- [ ] `capture/voice.tsx` — record, transcribe, extract, confirm, save
- [ ] `api-client/server/voice-*.ts` wrappers

### Verify

- [ ] Login → onboarding (new user) → Daily Focus
- [ ] FAB → text log → appears in Supabase `events`
- [ ] FAB → voice log → confirm → event saved
- [ ] Scope visible on home tab
- [ ] Unit tests still pass for `packages/domain`

---

## Phase 2 Checklist

- [ ] Timeline tab with `FlatList`
- [ ] Assistant tab with TrustPanel
- [ ] SOP tab + execution screen
- [ ] Photos with native picker
- [ ] Sensors manual entry
- [ ] More → Settings (farm, scope, language)
- [ ] SOP materialize on Daily Focus

---

## Phase 3 Checklist

- [x] Photos — `(tabs)/more/photos` + `capture/photo` with `expo-image-picker`
- [x] Sensors — manual entry screen
- [x] Settings — farm rename, farm/scope picker, plants, offline sync, push registration
- [x] Offline queue for log + photo (`AsyncStorage` + auto-sync on reconnect)
- [x] Push notifications + deep links (`expo-notifications`, local token registration)
- [x] Reports list + native block detail (generate via `/api/reports/generate`)
- [ ] Daily Focus AI cards (`ai_insights` query)
- [ ] SOP definition editor
- [ ] Move `apps/web` from repo root; trim to companion scope

---

## Testing

| Layer | Command | Scope |
| --- | --- | --- |
| `packages/domain` | `pnpm --filter @growlog/domain test` | existing vitest suites |
| `packages/api-client` | vitest + mocked fetch/supabase | hook logic |
| `apps/mobile` | Jest + `@testing-library/react-native` | ScopeBar, CaptureFab, LoginForm |
| E2E | Maestro flows (recommended) | login → capture → verify |

Maestro smoke flow (`apps/mobile/.maestro/smoke.yaml`):

```yaml
appId: ai.growlog.mobile
---
- launchApp
- tapOn: "Log"
- tapOn: "Text"
- inputText: "Test observation"
- tapOn: "Save"
- assertVisible: "Test observation"
```

---

## Explicit Non-Goals (Phase 1)

- Full parity with all web screens
- Offline assistant
- Background geofencing
- App Store submission assets
- Replacing Next.js API with Edge Functions (Phase 4 per ADR-011)
- Raw JSON inputs on SOP execution screen

---

## File Move Order (Safe Migration)

Execute in this order to keep web working while extracting:

1. `types/*` → `packages/domain` — update web imports via re-export shim at old paths
2. `lib/growlog/queries.ts`, `mutations.ts` → domain
3. `lib/i18n/messages/*` → `packages/i18n`
4. Add shims: `lib/growlog/queries.ts` re-exports from `@growlog/domain` (web unchanged)
5. Scaffold `apps/mobile` consuming packages directly
6. Later: move Next.js to `apps/web`, remove shims

Shim example (temporary):

```typescript
// lib/growlog/queries.ts
export * from '@growlog/domain/growlog/queries';
```

---

## Summary

Mobile implementation follows ADR-011: Expo Router tabs mirror the five UX modes, FAB opens a capture stack, and shared domain packages preserve the event spine. Phase 1 delivers auth, Daily Focus shell, and text/voice capture — enough to validate the native client path without blocking the existing web app.

**Short form:** scaffold monorepo → extract domain → Expo tabs + FarmProvider + FAB → voice/text capture → iterate tabs.
