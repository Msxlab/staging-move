#!/bin/sh
set -eu

target="${1:-}"
path="${2:-}"
method="${3:-GET}"

case "$target" in
  web)
    port="3000"
    ;;
  admin)
    port="3001"
    ;;
  *)
    echo "cron runner: target must be web or admin" >&2
    exit 64
    ;;
esac

case "$path" in
  /api/cron/*)
    ;;
  *)
    echo "cron runner: path must be an /api/cron route" >&2
    exit 64
    ;;
esac

case "$method" in
  GET|POST)
    ;;
  *)
    echo "cron runner: method must be GET or POST" >&2
    exit 64
    ;;
esac

secret="${CRON_SECRET:-}"
if [ "$target" = "admin" ] && [ "$path" = "/api/cron/backup" ] && [ -n "${BACKUP_CRON_SECRET:-}" ]; then
  secret="${BACKUP_CRON_SECRET}"
fi

if [ -z "$secret" ]; then
  echo "cron runner: CRON_SECRET is required" >&2
  exit 64
fi

url="http://127.0.0.1:${port}${path}"

if [ "$method" = "POST" ]; then
  exec wget -qO- --post-data="" --header "Authorization: Bearer ${secret}" "$url"
fi

exec wget -qO- --header "Authorization: Bearer ${secret}" "$url"
