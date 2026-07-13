#!/usr/bin/env bash
# scripts/reset_room.sh — clear a room's chatter; meta + invites survive.
# Usage: ./scripts/reset_room.sh <roomId>
set -euo pipefail
DB="https://cosanlab-chat-default-rtdb.firebaseio.com"
ROOM="${1:?usage: reset_room.sh <roomId>}"
TOKEN=$(gcloud auth print-access-token)
for node in messages reactions typing presence; do
  curl -sf -X DELETE "$DB/rooms/$ROOM/$node.json?access_token=$TOKEN" > /dev/null
  echo "cleared rooms/$ROOM/$node"
done
