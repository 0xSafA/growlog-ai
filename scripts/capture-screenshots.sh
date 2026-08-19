#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/screenshots"
mkdir -p "$OUT"

echo "Capturing screenshots to $OUT ..."

npx --yes playwright@1.52.0 screenshot \
  --browser chromium \
  --viewport-size "1440,900" \
  --wait-for-timeout 1200 \
  --full-page \
  http://localhost:3000/ \
  "$OUT/landing.png"

npx --yes playwright@1.52.0 screenshot \
  --browser chromium \
  --viewport-size "1440,900" \
  --wait-for-selector "input[type=email]" \
  --full-page \
  http://localhost:3000/auth/login \
  "$OUT/login.png"

npx --yes playwright@1.52.0 screenshot \
  --browser chromium \
  --viewport-size "390,844" \
  --wait-for-selector "nav" \
  --full-page \
  http://localhost:3000/preview/dashboard \
  "$OUT/dashboard-mobile.png"

npx --yes playwright@1.52.0 screenshot \
  --browser chromium \
  --viewport-size "1440,900" \
  --wait-for-selector "nav" \
  --full-page \
  http://localhost:3000/preview/dashboard \
  "$OUT/dashboard.png"

echo "Done:"
ls -lh "$OUT"/*.png
