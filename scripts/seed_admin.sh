#!/usr/bin/env bash
# scripts/seed_admin.sh — bootstrap (or rescue) an admin email.
# Usage: ./scripts/seed_admin.sh someone@dartmouth.edu
set -euo pipefail
DB="https://cosanlab-chat-default-rtdb.firebaseio.com"
EMAIL="${1:?usage: seed_admin.sh <email>}"
KEY=$(echo "$EMAIL" | tr '[:upper:]' '[:lower:]' | tr '.' ',')
curl -sf -X PUT -d 'true' "$DB/config/adminEmails/$KEY.json?access_token=$(gcloud auth print-access-token)" > /dev/null
echo "admin: $EMAIL (key: $KEY)"
