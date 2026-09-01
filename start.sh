#!/bin/sh
# Railway start script — hosts the production build and forwards the
# platform-assigned PORT. Vite preview serves the built SPA and handles
# client-side routing (fallback to index.html) for /system-map, /settings, etc.
set -e

PORT="${PORT:-4173}"
exec npx vite preview --host 0.0.0.0 --port "$PORT"