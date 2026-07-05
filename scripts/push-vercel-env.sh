#!/usr/bin/env bash
# Push production env vars from .env to the linked Vercel project.
# Overrides URL vars to the production domain. Never prints secret values.
set -u
DOMAIN="https://billing.gotoanalyze.com"
ENV_FILE=".env"
TARGET="production"

while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in ''|\#*) continue;; esac
  key="${line%%=*}"
  val="${line#*=}"
  # strip surrounding double quotes
  val="${val%\"}"; val="${val#\"}"
  case "$key" in
    NEXTAUTH_URL|NEXT_PUBLIC_APP_URL) val="$DOMAIN";;
  esac
  if [ -z "$val" ]; then echo "skip (empty): $key"; continue; fi
  if printf '%s' "$val" | vercel env add "$key" "$TARGET" --force >/dev/null 2>&1; then
    echo "set: $key"
  else
    echo "FAILED: $key"
  fi
done < "$ENV_FILE"
echo "done."
