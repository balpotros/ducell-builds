#!/bin/bash
# Ducell cleanup script

echo "Cleaning up junk files..."

cd /root/ducell

# Remove accidental directories
rm -rf cd cp 2>/dev/null && echo "✓ Removed cd/ and cp/ directories"

# Remove old backups (keep one)
rm -f bot.js.backup brain.js.save 2>/dev/null && echo "✓ Removed old backups"

# Remove junk files
rm -f index.html history.json watchdog.log 2>/dev/null && echo "✓ Removed index.html, history.json, watchdog.log"

# Clear bridge log (keep last 100 lines)
if [ -f /tmp/claude-bridge.log ]; then
  tail -100 /tmp/claude-bridge.log > /tmp/claude-bridge.log.tmp && mv /tmp/claude-bridge.log.tmp /tmp/claude-bridge.log
  echo "✓ Trimmed bridge log"
fi

echo "Done! Current files:"
ls -lh /root/ducell/ --ignore=node_modules
