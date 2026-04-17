#!/usr/bin/env bash
# Post-deploy smoke test. Verifies critical endpoints are reachable.
# Usage: BASE_URL=https://app.example.com ./scripts/smoke-test.sh
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
ADMIN_URL="${ADMIN_URL:-http://localhost:3001}"

pass=0
fail=0

check() {
  local name="$1"
  local url="$2"
  local want="$3"
  local got
  got=$(curl -sS -o /dev/null -w "%{http_code}" "$url" || echo "000")
  if [ "$got" = "$want" ]; then
    echo "  ok   $name ($got)"
    pass=$((pass + 1))
  else
    echo "  FAIL $name (expected $want, got $got) — $url"
    fail=$((fail + 1))
  fi
}

json_field() {
  local url="$1"
  local field="$2"
  curl -sS "$url" | sed -n 's/.*"'"$field"'":"\([^"]*\)".*/\1/p' | head -n1
}

echo "== web ($BASE_URL) =="
check "health endpoint"     "$BASE_URL/api/health"              "200"
check "sign-in page"        "$BASE_URL/sign-in"                  "200"
check "marketing homepage"  "$BASE_URL/"                         "200"
check "unauth dashboard"    "$BASE_URL/dashboard"                "307"
health_status=$(json_field "$BASE_URL/api/health" "status")
echo "  health.status = ${health_status:-unknown}"

echo ""
echo "== admin ($ADMIN_URL) =="
check "admin health"        "$ADMIN_URL/api/health"              "200"
check "admin login page"    "$ADMIN_URL/login"                   "200"
check "unauth admin root"   "$ADMIN_URL/"                        "307"

echo ""
echo "== result =="
echo "  $pass passed, $fail failed"
[ "$fail" = "0" ]
