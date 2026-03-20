# Ducell Memory

## Who I am
I am Ducell, an AI agent built by Bissam. I build and deploy full-stack web apps and sites including real backends, databases, and APIs.

## What I have built
- **ny2027** — New Year 2027 countdown timer with fireworks animation (pure HTML/JS/CSS, single file). Live: https://ny2027-orcin.vercel.app | GitHub: https://github.com/balpotros/ducell-builds/tree/main/ny2027
- **ducell-dashboard** — Live status dashboard for Ducell agent. Shows online status, uptime, current task, and last 10 completed builds. Hosted on this server at http://165.227.42.130:3001. Reads from status.json.
- **tasklist** — Single shared task list (no login). Add tasks, check them off, delete them. Frontend: https://tasklist-frontend-rosy.vercel.app | Backend API: https://165.227.42.130.nip.io (nginx HTTPS proxy → PM2 port 4000 on this server) | DB: Docker PostgreSQL on port 5433 (container: tasklist-postgres) | GitHub: https://github.com/balpotros/ducell-builds/tree/main/tasklist-frontend
- **finance-tracker** — GitHub: https://github.com/balpotros/finance-tracker | Frontend: https://mykashboard.vercel.app (primary) | Backend: https://finance.165.227.42.130.nip.io (PM2 port 4001, nginx proxy) | DB: Docker PostgreSQL on port 5434 (finance_tracker DB, password: financepass123) | Vercel project: kashboard (prj_MXSfOEKBNcUA4hoNrJI8VLDc8Itj) | Auth0 app: "Finance Tracker" (Client ID: h4lzDs4RJXLBDji9YN8cLws01yRAuzQ8)
  - ⚠️ NEVER deploy finance-tracker to finance-tracker-bissam.vercel.app — only use mykashboard.vercel.app
  - frontend-five-sand-47.vercel.app is kept as a secondary/redirect alias
  - **UAT environment**: Frontend: https://kashboard-uat.vercel.app (Vercel project: kashboard-uat, prj_Fw4A6BezAAP7dMLk5wfpzZO6WqV2, uat branch) | Backend: https://finance-tracker-uat-api.onrender.com (Render service: srv-d6tibakr85hc73f9rrhg, uat branch, auto-deploys on push) | DB: finance_tracker_uat on localhost:5434 (same docker container as prod, separate DB)
  - UAT workflow: push to `uat` branch → Render auto-deploys backend, Vercel auto-deploys frontend → test at kashboard-uat.vercel.app → merge uat→main to promote to prod

## Preferences
- Always use Tailwind CSS for styling
- Deploy to Vercel using VERCEL_TOKEN environment variable
- Keep code clean and simple
- Ask clarifying questions before building complex apps

## Communication style
- Send step-by-step status updates while working (not just "working on it")
- After deploying, test the URL with WebFetch before sending it to the user
- For complex builds, briefly describe the plan before starting

## Post-build workflow (ALWAYS do this after every build)
After every build, push the project files to GitHub:
1. Clone or update the repo: `balpotros/ducell-builds`
2. Create a folder named after the project (e.g., `my-project-name/`)
3. Copy all project files into that folder
4. Commit and push to the repo
5. Confirm the push succeeded

Use the dedicated script (one command):
```bash
bash /root/ducell/push-build.sh <project-name> <source-dir>
```

Example:
```bash
bash /root/ducell/push-build.sh ny2027 /tmp/ny2027
```

The script handles clone/pull, copy, commit, and push automatically.

## Full-stack capabilities (set up 2026-03-11)
- Docker 29.3 installed and running on this server (systemd service, auto-starts)
- PostgreSQL 16 client tools installed (psql, pg_dump, etc.)
- Can spin up a PostgreSQL container with: docker run -d --name <name> -e POSTGRES_PASSWORD=<pass> -e POSTGRES_DB=<db> -p 5432:5432 postgres:16-alpine
- Can build Node.js/Express backends on this server, run them with PM2
- RENDER_API_KEY = rnd_rUA40k0N0kpfZvJB9eNsOKsz41Gy (set as fallback in ecosystem.config.js)
- VERCEL_TOKEN = vcp_6ZTKGSZSidPD0JMnmZ2uOIuAp8jeaZcrPB8e7S7Bsratr3B1Sz4FQdu4 (set as fallback in ecosystem.config.js)
- Render API: creating web services via POST /v1/services requires ownerId="tea-d6ouspfafjfc739eaoc0". Creating postgres via POST /v1/postgres also requires ownerId.
- Render web service creation returns 400 with the envVars fromDatabase format — use ecosystem.config.js env approach instead for reliable deployments.
- Render web service creation needs serviceDetails.envSpecificDetails with buildCommand+startCommand. Use array POST for Vercel env vars (single JSON array POST works; individual POSTs conflict).
- Preferred full-stack pattern: Vercel (frontend) + PM2 on this server (backend/API) + Docker PostgreSQL (database). Simpler and faster than Render for backends.
- For UAT environments: use Render web service (free, HTTPS, auto-deploy from GitHub branch) + existing local postgres with a new DB. Render free tier allows only 1 postgres but unlimited web services.
- claudeuser (Claude Code) CANNOT use Docker, PM2, or write to nginx configs — those require root. Use Render for UAT backends. Use GitHub API for file updates instead of editing files in /root/.
- Local postgres on port 5434 is publicly accessible at 165.227.42.130:5434 (Docker port mapping). Password: financepass123. Render services can connect to it directly.
- Port 5433: tasklist postgres (password: varies). Port 5434: finance-tracker postgres (password: financepass123, DBs: finance_tracker prod, finance_tracker_uat UAT).

## Self-update workflow
Whenever you edit bot.js or any core file and need to restart, always end by running:
  bash /root/ducell/update-self.sh 'description of what changed'
This restarts PM2 and sends a confirmation to Bissam automatically after restart.

## Milestones
- **March 16 2026 - Ducell 2.1** — Self-update flow working. update-self.sh sends Telegram confirmation BEFORE restarting PM2 so confirmation always arrives. Real chat ID is 8420721200. Bot username is Ducell_bot with capital D. Two-tier routing working - build keywords go to Claude Code, simple questions go to Haiku. Group chat works when privacy mode is disabled in BotFather.

## Auth0 Credentials (use for any app needing login)
- AUTH0_DOMAIN=dev-yoag06mta5zqt28n.us.auth0.com
- AUTH0_CLIENT_ID=bTX0bT7sTKi2heGFao4yvTNz0nbWp0Ju
- AUTH0_CLIENT_SECRET=B9sTSvNfw4_afi5gQOwzocL-ZzzeE2d7vS6_qkuy_SCGLS73eZjmiJeWCY1ANjb5
- Rules:
  1. Every app that needs user login should use these credentials
  2. Always add Google as a social login option
  3. Add the callback URL for each app in Auth0 dashboard: Applications > Ducell Apps > Settings > Allowed Callback URLs
  4. Use the `auth0` npm package for Node.js backends

## Lessons learned
- The status dashboard uses status.json as its data source. Always update status.json when starting or completing tasks so the dashboard reflects real state.
- dashboard.js runs as a separate PM2 process named ducell-dashboard on port 3001.
- Docker postgres:16-alpine image is cached locally on this server — fast to spin up.
- When running PM2 with env vars, use the inline env format: DATABASE_URL="..." PORT=4000 pm2 start file.js --name name. The ssl option in pg Pool must be controlled by a separate env var (DATABASE_SSL=true) since local Docker postgres doesn't support SSL but Render/cloud postgres does.
- When deploying backends on this server, map Docker postgres to a non-default port (e.g., 5433) to avoid conflicts with any existing postgres on 5432.
- Vercel frontends are on HTTPS. Backend APIs on this server must also be HTTPS or browsers block the requests (mixed content). Fix: install nginx + certbot, get a Let's Encrypt cert for `165.227.42.130.nip.io` (nip.io provides free DNS for IPs), set up nginx as HTTPS reverse proxy. The cert is at /etc/letsencrypt/live/165.227.42.130.nip.io/. Auto-renews via certbot systemd timer.
- nginx config for tasklist API is at /etc/nginx/sites-available/tasklist-api (proxies HTTPS to port 4000).
