#!/usr/bin/env bash
# scripts/export_room.sh — one room (messages, reactions, meta) to JSON.
# Usage: ./scripts/export_room.sh <roomId> [outfile]
set -euo pipefail
DB="https://cosanlab-chat-default-rtdb.firebaseio.com"
ROOM="${1:?usage: export_room.sh <roomId> [outfile]}"
OUT="${2:-${ROOM}-export-$(date +%Y%m%d-%H%M%S).json}"
curl -sf "$DB/rooms/$ROOM.json?access_token=$(gcloud auth print-access-token)&print=pretty" > "$OUT"
echo "Wrote $OUT ($(wc -c < "$OUT" | tr -d ' ') bytes)"
