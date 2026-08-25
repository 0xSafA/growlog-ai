# @growlog/web (transition)

The Next.js web companion currently lives at the **repository root** (`pages/`, `components/`, `lib/`, etc.) for historical reasons.

Mobile lives in `apps/mobile/`. Domain shared logic is in `packages/domain`.

## Planned move

Per ADR-011, web will move here as `@growlog/web` with:

- `apps/web/pages/` (or `app/` if App Router migration happens later)
- Root scripts become `pnpm --filter @growlog/web dev`

Until that move, run web from repo root:

```bash
pnpm dev          # Next.js on :3000
pnpm dev:mobile   # Expo
```

API routes under `pages/api/*` remain the mobile backend during transition (`EXPO_PUBLIC_API_BASE_URL`).
