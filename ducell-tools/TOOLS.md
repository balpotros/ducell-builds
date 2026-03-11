# Ducell Tools & Reference Guide

## 1. API Keys & Tokens

| Name | Env Var | Status | Purpose |
|------|---------|--------|---------|
| Anthropic API Key | `ANTHROPIC_API_KEY` | SET | Powers the Ducell agent (Claude model). Used by bot.js to call the Claude API. |
| GitHub Token | `GITHUB_TOKEN` | SET | Pushes project files to github.com/balpotros/ducell-builds after every build. Scoped to repo access. |
| Telegram Chat ID | `TELEGRAM_CHAT_ID` | SET | Sends real-time status updates to Bissam via Telegram. Used by send_update.sh. |
| Vercel Token | `VERCEL_TOKEN` | NOT SET | Needed to deploy static sites to Vercel. Bissam must set this via `export VERCEL_TOKEN=...` or add it to the server environment. |
| Render API Key | `RENDER_API_KEY` | NOT SET | Needed to deploy backends to Render. Obtain at dashboard.render.com > Account Settings > API Keys. |

---

## 2. How to Deploy a Static Site to Vercel

### Prerequisites
- `VERCEL_TOKEN` must be set in the environment.
- Vercel CLI must be installed (`npm i -g vercel`).

### Step-by-step

1. **Build the project** — Write all static files (HTML, CSS, JS) into a local directory, e.g. `/tmp/my-project/`.

2. **Create a `vercel.json`** inside the project directory:
   ```json
   { "version": 2 }
   ```

3. **Deploy using the Vercel API** (no CLI needed):
   ```bash
   # Create a deployment via API
   curl -X POST "https://api.vercel.com/v13/deployments" \
     -H "Authorization: Bearer $VERCEL_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "my-project",
       "files": [...],
       "projectSettings": { "framework": null }
     }'
   ```
   Or use the Vercel CLI:
   ```bash
   cd /tmp/my-project
   vercel --token $VERCEL_TOKEN --yes --prod
   ```

4. **Wait for deployment** — Poll the deployment status until `readyState` is `READY`.

5. **Test the URL** — Use WebFetch to load the live URL and confirm it returns a valid page.

6. **Save the URL** — Update memory.md and status.json with the project name and live URL.

---

## 3. How to Deploy a Backend to Render

### Prerequisites
- `RENDER_API_KEY` must be set in the environment.
- Backend code must be in the `balpotros/ducell-builds` GitHub repo (Render pulls from GitHub).

### Step-by-step

1. **Push backend code to GitHub** using the post-build workflow (see section 4).

2. **Create a Render Web Service** via the Render API:
   ```bash
   curl -X POST "https://api.render.com/v1/services" \
     -H "Authorization: Bearer $RENDER_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "type": "web_service",
       "name": "my-backend",
       "repo": "https://github.com/balpotros/ducell-builds",
       "branch": "main",
       "rootDir": "my-project/backend",
       "buildCommand": "npm install",
       "startCommand": "node index.js",
       "envVars": []
     }'
   ```

3. **Check deployment status**:
   ```bash
   curl "https://api.render.com/v1/services/<service-id>/deploys" \
     -H "Authorization: Bearer $RENDER_API_KEY"
   ```

4. **Wait for `live` status** — Poll until the deploy status is `live`.

5. **Test the URL** — Use WebFetch to confirm the backend responds correctly.

---

## 4. How to Push Code to GitHub

Use the dedicated push script. One command handles everything (clone, copy, commit, push):

```bash
bash /root/ducell/push-build.sh <project-name> <source-directory>
```

Example:
```bash
bash /root/ducell/push-build.sh ny2027 /tmp/ny2027
```

### What the script does
1. Clones `balpotros/ducell-builds` (or pulls if already cloned)
2. Creates a folder named `<project-name>/` in the repo
3. Copies all files from `<source-directory>` into that folder
4. Commits with message: `Add <project-name>`
5. Pushes to the `main` branch

### Manual approach (if needed)
```bash
cd /tmp
git clone https://$GITHUB_TOKEN@github.com/balpotros/ducell-builds.git
cd ducell-builds
mkdir -p my-project
cp -r /tmp/my-project/* my-project/
git add .
git commit -m "Add my-project"
git push
```

---

## 5. Preferred Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend styling | Tailwind CSS | Always use Tailwind. Use CDN for static sites: `<script src="https://cdn.tailwindcss.com"></script>` |
| Frontend framework | Vanilla HTML/JS or React | Vanilla for simple sites; React for complex UIs |
| Backend | Node.js + Express | Simple, widely supported, easy to deploy |
| Database | PostgreSQL 16 | Spin up via Docker on this server, or use Render Postgres |
| Process manager | PM2 | Manages long-running Node processes on this server |
| Container runtime | Docker | Available on this server (v29.3), auto-starts on boot |

### Spin up a local PostgreSQL container
```bash
docker run -d \
  --name my-db \
  -e POSTGRES_PASSWORD=secret \
  -e POSTGRES_DB=myapp \
  -p 5432:5432 \
  postgres:16-alpine
```

---

## 6. Rules from Bissam

1. **Always ask clarifying questions** — Before starting any build, ask 1-2 short questions. No exceptions, even for simple tasks. Wait for answers before writing code.

2. **Test URLs before sending** — After every deployment, use WebFetch to load the live URL and confirm it works. Never share a URL without testing it first.

3. **Update memory after every build** — Write to `/root/ducell/memory.md` with the project name, what it does, the live URL, and any lessons learned. Do this automatically.

4. **Never ask Bissam to SSH in** — Handle all server tasks via Bash. Bissam should never need to touch the terminal. If something needs to be done on the server, do it yourself.

5. **Send status updates at every step** — Use `send_update.sh` before and after every meaningful action. Never go silent between tool calls.

6. **Retry failures automatically** — If any step fails, retry up to 3 times before asking for help. Log each attempt.

7. **Push to GitHub after every build** — Use the post-build workflow automatically. Bissam should never have to ask.

8. **Suggest improvements after builds** — Offer 2-3 specific next steps after completing a task.

---

## 7. Deployment URLs & Key Locations

| Resource | URL / Path |
|----------|-----------|
| Status dashboard | http://165.227.42.130:3001 |
| GitHub builds repo | https://github.com/balpotros/ducell-builds |
| Memory file | /root/ducell/memory.md |
| Status data file | /root/ducell/status.json |
| Bot entry point | /root/ducell/bot.js |
| Push script | /root/ducell/push-build.sh |
| Status update script | /root/ducell/send_update.sh |
| Dashboard server | /root/ducell/dashboard.js (PM2: ducell-dashboard) |
| PM2 config | /root/ducell/ecosystem.config.js |

---

## 8. Useful Commands

```bash
# Check PM2 processes
pm2 list

# Restart the bot
pm2 restart ducell

# View bot logs
pm2 logs ducell --lines 50

# View dashboard logs
pm2 logs ducell-dashboard --lines 50

# Send a Telegram update
bash /root/ducell/send_update.sh "$TELEGRAM_CHAT_ID" "message here"

# Check Docker containers
docker ps

# Check disk space
df -h

# Check memory
free -h
```
