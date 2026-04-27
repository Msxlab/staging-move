#!/usr/bin/env bash
# Email pipeline diagnostic. Verifies env config + recent EmailLog activity
# without sending any test mail. Use against staging or production.
#
# Required env (set before running):
#   DATABASE_URL                — psql-compatible connection string
#   ADMIN_URL                    — admin app URL (defaults to http://localhost:3001)
#   ADMIN_SESSION_COOKIE         — value of admin_session cookie (read-only health check)
#
# Optional env:
#   RESEND_API_KEY               — if set, prints the prefix (e.g. re_xxx... ok)
#   EMAIL_FROM                   — printed if set
#   NEXT_PUBLIC_APP_URL          — printed if set
#   SUPPORT_EMAIL                — printed if set
#
# Usage:
#   DATABASE_URL=postgres://... ADMIN_URL=https://admin.example.com \
#     ADMIN_SESSION_COOKIE=... ./scripts/diagnose-email-pipeline.sh
set -euo pipefail

ADMIN_URL="${ADMIN_URL:-http://localhost:3001}"

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
warn() { printf '\033[33m%s\033[0m\n' "$*"; }
fail() { printf '\033[31m%s\033[0m\n' "$*"; }
ok()   { printf '\033[32m%s\033[0m\n' "$*"; }

bold "== 1. Environment config =="
if [ -n "${RESEND_API_KEY:-}" ]; then
  prefix="${RESEND_API_KEY:0:3}"
  if [ "$prefix" = "re_" ]; then ok "RESEND_API_KEY ${prefix}***"; else fail "RESEND_API_KEY does not start with 're_'"; fi
else
  warn "RESEND_API_KEY not set in current shell (the running process may still have it)"
fi
[ -n "${EMAIL_FROM:-}" ] && ok "EMAIL_FROM=${EMAIL_FROM}" || warn "EMAIL_FROM not in shell"
[ -n "${NEXT_PUBLIC_APP_URL:-}" ] && ok "NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}" || warn "NEXT_PUBLIC_APP_URL not in shell"
[ -n "${SUPPORT_EMAIL:-}" ] && ok "SUPPORT_EMAIL=${SUPPORT_EMAIL}" || warn "SUPPORT_EMAIL not in shell"
echo

bold "== 2. Admin email-health endpoint =="
if [ -z "${ADMIN_SESSION_COOKIE:-}" ]; then
  warn "Skipping — set ADMIN_SESSION_COOKIE to query ${ADMIN_URL}/api/email-health"
else
  resp=$(curl -sS -o /tmp/email-health.json -w "%{http_code}" \
    --cookie "admin_session=${ADMIN_SESSION_COOKIE}" \
    "${ADMIN_URL}/api/email-health" || echo "000")
  if [ "$resp" = "200" ]; then
    ok "GET ${ADMIN_URL}/api/email-health → 200"
    cat /tmp/email-health.json | sed 's/^/  /'
  else
    fail "GET ${ADMIN_URL}/api/email-health → ${resp}"
    [ -s /tmp/email-health.json ] && cat /tmp/email-health.json | head -c 500
  fi
  echo
fi

bold "== 3. EmailLog activity =="
if [ -z "${DATABASE_URL:-}" ]; then
  fail "DATABASE_URL not set — skipping DB checks"
  exit 0
fi
if ! command -v psql >/dev/null 2>&1; then
  fail "psql not installed — install postgresql-client to run DB checks"
  exit 0
fi

run_sql() { psql "$DATABASE_URL" -X -A -F $'\t' --pset=footer=off "$@"; }

echo "  -- counts by status (last 7 days)"
run_sql -c "
SELECT status, COUNT(*) AS count
FROM \"EmailLog\"
WHERE \"createdAt\" >= NOW() - INTERVAL '7 days'
GROUP BY status
ORDER BY count DESC;
" | sed 's/^/  /'
echo

echo "  -- last 20 entries"
run_sql -c "
SELECT \"createdAt\"::timestamp(0) AS at,
       status,
       COALESCE(\"templateId\"::text, '-') AS template,
       LEFT(COALESCE(error, ''), 80) AS err,
       LEFT(\"to\", 40) AS recipient
FROM \"EmailLog\"
ORDER BY \"createdAt\" DESC
LIMIT 20;
" | sed 's/^/  /'
echo

echo "  -- top 5 failure reasons (last 30 days)"
run_sql -c "
SELECT COUNT(*) AS count, LEFT(error, 120) AS error
FROM \"EmailLog\"
WHERE status = 'FAILED' AND \"createdAt\" >= NOW() - INTERVAL '30 days'
GROUP BY error
ORDER BY count DESC
LIMIT 5;
" | sed 's/^/  /'
echo

echo "  -- pending entries older than 5 minutes (queue stuck?)"
run_sql -c "
SELECT COUNT(*) AS stuck_pending
FROM \"EmailLog\"
WHERE status = 'PENDING' AND \"createdAt\" < NOW() - INTERVAL '5 minutes';
" | sed 's/^/  /'

bold "Done. If counts are 0 or only verification mails appear, triggers are not firing."
