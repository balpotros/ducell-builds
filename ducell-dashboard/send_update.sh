#!/bin/bash
# Usage: bash /root/ducell/send_update.sh <chat_id> <message>
# Sends a plain text message to the user via Telegram Bot API
# Also appends the message + timestamp to status.json task_log

CHAT_ID="$1"
MESSAGE="$2"
TOKEN="8796961401:AAHRDuFmwGSBDuiRLbsZP1sADh0gcJhY5x0"
STATUS_FILE="/root/ducell/status.json"

if [ -z "$CHAT_ID" ] || [ -z "$MESSAGE" ]; then
  echo "Usage: send_update.sh <chat_id> <message>"
  exit 1
fi

curl -s -X POST "https://api.telegram.org/bot${TOKEN}/sendMessage" \
  -H "Content-Type: application/json" \
  -d "{\"chat_id\": \"${CHAT_ID}\", \"text\": $(echo "$MESSAGE" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')}" \
  > /dev/null

# Append message + timestamp to status.json task_log (keep last 5)
python3 - <<PYEOF
import json, os, sys
from datetime import datetime, timezone

status_file = "$STATUS_FILE"
message = """$MESSAGE"""
timestamp = datetime.now(timezone.utc).isoformat()

try:
    with open(status_file, 'r') as f:
        data = json.load(f)
except:
    data = {}

log = data.get('task_log', [])
log.append({'timestamp': timestamp, 'message': message})
log = log[-5:]  # keep last 5
data['task_log'] = log
data['updated_at'] = timestamp

with open(status_file, 'w') as f:
    json.dump(data, f, indent=2)
PYEOF

exit 0
