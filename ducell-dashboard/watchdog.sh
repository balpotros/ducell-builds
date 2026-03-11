#!/bin/bash
# Watchdog: restart ducell via pm2 if not running

APP_NAME="ducell"
ECOSYSTEM="/root/ducell/ecosystem.config.js"
LOG="/root/ducell/watchdog.log"

# Check if the process is online
STATUS=$(pm2 jlist 2>/dev/null | python3 -c "
import sys, json
procs = json.load(sys.stdin)
for p in procs:
    if p.get('name') == '$APP_NAME':
        print(p.get('pm2_env', {}).get('status', 'unknown'))
        sys.exit(0)
print('not_found')
" 2>/dev/null)

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

if [ "$STATUS" = "online" ]; then
    echo "[$TIMESTAMP] ducell is online. OK." >> "$LOG"
else
    echo "[$TIMESTAMP] ducell status: $STATUS. Restarting..." >> "$LOG"
    pm2 start "$ECOSYSTEM" >> "$LOG" 2>&1
    echo "[$TIMESTAMP] pm2 start executed." >> "$LOG"
fi
