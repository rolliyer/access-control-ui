#!/bin/sh
# Writes /config.js from APP_* environment variables so the same image can run
# against mock data or any backend. Runs before nginx starts.
set -eu

json_string() {
  # Escape for a JSON/JS double-quoted string.
  printf '"%s"' "$(printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')"
}

target=/usr/share/nginx/html/config.js
cat > "$target" <<CONFIG
window.__APP_CONFIG__ = {
  apiMode: $(json_string "${APP_API_MODE:-mock}"),
  apiBaseUrl: $(json_string "${APP_API_BASE_URL:-/api}"),
  actorEmail: $(json_string "${APP_ACTOR_EMAIL:-admin@rollerdigital.com}"),
}
CONFIG

echo "40-runtime-config: wrote $target (apiMode=${APP_API_MODE:-mock})"
