#!/bin/bash
# Usage: bash /root/ducell/log_build.sh <project-name> <url> <description>
# Appends a completed build entry to status.json completed_tasks

PROJECT_NAME="$1"
URL="$2"
DESCRIPTION="$3"
STATUS_FILE="/root/ducell/status.json"

if [ -z "$PROJECT_NAME" ]; then
  echo "Usage: log_build.sh <project-name> <url> <description>"
  exit 1
fi

python3 - <<PYEOF
import json, os
from datetime import datetime, timezone

status_file = "$STATUS_FILE"
project_name = """$PROJECT_NAME"""
url = """$URL"""
description = """$DESCRIPTION"""
timestamp = datetime.now(timezone.utc).isoformat()

try:
    with open(status_file, 'r') as f:
        data = json.load(f)
except:
    data = {}

builds = data.get('completed_tasks', [])

# Avoid duplicates: remove existing entry with same name if present
builds = [b for b in builds if b.get('name') != project_name]

builds.append({
    'name': project_name,
    'url': url,
    'description': description,
    'completed_at': timestamp
})

data['completed_tasks'] = builds
data['updated_at'] = timestamp

with open(status_file, 'w') as f:
    json.dump(data, f, indent=2)

print(f"Logged build: {project_name}")
PYEOF

exit 0
