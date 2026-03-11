#!/bin/bash
set -e

ECOSYSTEM="/root/ducell/ecosystem.config.js"
REQUIRED_VARS="ANTHROPIC_API_KEY GITHUB_TOKEN VERCEL_TOKEN"
ERRORS=0

echo "=== Ducell Self-Improvement Check ==="
echo ""

# 1. Check required env vars
echo ">> Checking environment variables..."
for VAR in $REQUIRED_VARS; do
  if [ -z "${!VAR}" ]; then
    echo "   MISSING: $VAR"
    ERRORS=$((ERRORS + 1))
  else
    echo "   OK: $VAR"
  fi
done

if [ $ERRORS -gt 0 ]; then
  echo ""
  echo "ERROR: $ERRORS required env var(s) missing. Source your env file and retry."
  exit 1
fi

echo ""

# 2. Check pm2 status and restart if needed
echo ">> Checking pm2 status..."
STATUS=$(pm2 jlist 2>/dev/null | node -e "
  const list = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  const app = list.find(a => a.name === 'ducell');
  console.log(app ? app.pm2_env.status : 'not_found');
" 2>/dev/null || echo "not_found")

echo "   Status: $STATUS"

if [ "$STATUS" != "online" ]; then
  echo "   Ducell is $STATUS — restarting with ecosystem config..."
  pm2 start "$ECOSYSTEM" --update-env
  sleep 3
else
  echo "   Ducell is online. Reloading with latest env..."
  pm2 reload "$ECOSYSTEM" --update-env
fi

echo ""

# 3. Confirm
echo ">> Final status:"
pm2 show ducell | grep -E "status|uptime|restarts|pid"

echo ""
echo "=== All good. Ducell is running. ==="
