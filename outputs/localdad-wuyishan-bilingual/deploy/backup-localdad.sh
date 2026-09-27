#!/usr/bin/env bash
set -euo pipefail
stamp="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
root="${LOCALDAD_ROOT:-/srv/localdad}"
target="$root/backups/manual/$stamp"
mkdir -p "$target"
cp "$root/data/visitor-content/data.json" "$target/visitor-content.json"
cp -a "$root/data/visitor-content/media" "$target/media"
pg_dump --format=custom --file="$target/database.dump" "${DATABASE_URL:?DATABASE_URL is required}"
printf '%s\n' "Backup created: $target"
