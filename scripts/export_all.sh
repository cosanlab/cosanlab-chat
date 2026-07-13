#!/usr/bin/env bash
# scripts/export_all.sh — every room + index, one JSON snapshot.
set -euo pipefail
DB="https://cosanlab-chat-default-rtdb.firebaseio.com"
OUT="${1:-cosanlab-chat-export-$(date +%Y%m%d-%H%M%S).json}"
curl -sf "$DB/.json?access_token=$(gcloud auth print-access-token)&print=pretty" > "$OUT"
echo "Wrote $OUT ($(wc -c < "$OUT" | tr -d ' ') bytes)"
