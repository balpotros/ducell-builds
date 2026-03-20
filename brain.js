const fs = require('fs');
const net = require('net');
const https = require('https');

const BOT_USERNAME = 'Ducell_bot';
const MEMORY_FILE = '/root/ducell/memory.md';
const STATUS_FILE = '/root/ducell/status.json';
const HISTORY_FILE = '/root/ducell/conversation.json';
const SOCKET_PATH = '/tmp/claude-bridge.sock';
const MAX_HISTORY = 30;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const VERCEL_TOKEN = process.env.VERCEL_TOKEN;

// ── STATE ──────────────────────────────────────────────────────────────────────
// Persisted to disk so PM2 restarts don't lose state
const STATE_FILE = '/root/ducell/chat_state.json';

function loadStates() {
  try {
    if (fs.existsSync(STATE_FILE)) return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch(e) {}
  return {};
}

function saveStates(states) {
  try { fs.writeFileSync(STATE_FILE, JSON.stringify(states, null, 2)); } catch(e) {}
}

function getState(chatId) {
  const states = loadStates();
  return states[String(chatId)] || { mode: 'conversation' };
}

function setState(chatId, mode, data) {
  const states = loadStates();
  states[String(chatId)] = { mode, data, updated: new Date().toISOString() };
  saveStates(states);
}

function clearState(chatId) {
  const states = loadStates();
  states[String(chatId)] = { mode: 'conversation' };
  saveStates(states);
}

// ── PERSISTENCE ────────────────────────────────────────────────────────────────
function setStatus(status, task) {
  try { fs.writeFileSync(STATUS_FILE, JSON.stringify({ status, task, updated: new Date().toISOString() })); } catch(e) {}
}

function getHistory(chatId) {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const all = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
      return all[String(chatId)] || [];
    }
  } catch(e) {}
  return [];
}

function addToHistory(chatId, role, content) {
  try {
    let all = {};
    if (fs.existsSync(HISTORY_FILE)) all = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
    const key = String(chatId);
    if (!all[key]) all[key] = [];
    all[key].push({ role, content, time: new Date().toISOString() });
    if (all[key].length > MAX_HISTORY) all[key] = all[key].slice(-MAX_HISTORY);
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(all, null, 2));
  } catch(e) {}
}

// ── GROQ (fast conversation) ───────────────────────────────────────────────────
function callGroq(systemPrompt, messages) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 1024,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ]
    });

    const req = https.request({
      hostname: 'api.groq.com',
      path: '/openai/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + GROQ_API_KEY,
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) return reject(new Error(parsed.error.message));
          resolve(parsed.choices[0].message.content);
        } catch(e) {
          reject(new Error('Groq parse error: ' + data.substring(0, 200)));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Groq timeout')); });
    req.write(body);
    req.end();
  });
}

// ── BRIDGE (Claude Code execution) ────────────────────────────────────────────
function ensureBridge() {
  try { fs.statSync(SOCKET_PATH); return; } catch(e) {}
  const { execSync } = require('child_process');
  try {
    execSync('su -c "node /root/ducell/claude-bridge.js >> /tmp/claude-bridge.log 2>&1 &" claudeuser');
  } catch(e) {}
  const start = Date.now();
  while (Date.now() - start < 15000) {
    try { fs.statSync(SOCKET_PATH); return; } catch(e) {}
    require('child_process').spawnSync('sleep', ['0.5']);
  }
}

function askBridge(prompt, timeoutMs) {
  return new Promise((resolve) => {
    try { ensureBridge(); } catch(e) { return resolve('Bridge unavailable: ' + e.message); }
    const client = net.connect(SOCKET_PATH, () => {
      client.write(prompt + '\n__END__\n');
    });
    let response = '';
    client.on('data', (d) => {
      response += d.toString();
      if (response.includes('\n__DONE__\n')) {
        client.destroy();
        resolve(response.replace('\n__DONE__\n', '').trim());
      }
    });
    client.on('error', (err) => resolve('Bridge error: ' + err.message));
    setTimeout(() => { client.destroy(); resolve(response.trim() || 'Timeout.'); }, timeoutMs || 180000);
  });
}

// ── SYSTEM PROMPTS ─────────────────────────────────────────────────────────────
const CONVERSATION_SYSTEM = `You are Ducell, an AI technical co-founder built by Bissam Al-Potros.

YOUR PERSONALITY:
- Brilliant, opinionated technical co-founder — mix of senior engineer and product strategist
- Direct, warm, genuinely invested in helping people build great products
- Ask smart questions to understand the real problem before proposing solutions
- Push back when an idea needs refinement — don't just say yes to everything
- Celebrate wins, be honest about limitations

YOUR JOB:
1. Help people think through their app ideas — ask questions, challenge assumptions, suggest approaches
2. When you have enough clarity, propose exactly what you will build
3. Only start building after the user explicitly confirms
4. Build it, deploy it, send the live URL

CONVERSATION RULES:
- NEVER start building without explicit confirmation: "yes", "go ahead", "build it", "do it", "go"
- Ask 1-2 focused questions at a time — never a wall of questions
- When ready to propose: "I have enough to build this. Here's my plan: [plan]. Should I go ahead?"
- Be conversational — Telegram texts, not documents
- No markdown — write like a human texting
- Concise — 2-4 sentences for casual chat
- Reference past builds naturally

CRITICAL — HONESTY:
- You do NOT have direct server/GitHub/live system access
- NEVER make up or guess about server state, URLs, deployments, or code
- When asked to check/look/verify/investigate anything real, output ONLY:
{"action":"investigate","prompt":"specific detailed investigation instructions"}

INVESTIGATION EXAMPLES:
- "check the UAT setup" → {"action":"investigate","prompt":"Check UAT status: is docker container finance-uat-postgres running on port 5435, is PM2 process finance-api-uat running on port 4001, does uat branch exist in balpotros/finance-tracker"}
- "why is X broken" → {"action":"investigate","prompt":"Debug X: check PM2 logs, test the endpoint, check nginx config"}
- "where are we" → {"action":"investigate","prompt":"Check current state: list PM2 processes, recent git commits in finance-tracker, running docker containers"}

WHEN READY TO BUILD:
After user confirms with yes/go/do it/build it, output ONLY:
{"action":"build","steps":["specific step 1","specific step 2","specific step 3"]}
Each step completable in under 3 minutes. Only output this when user JUST confirmed.`;

const EXECUTION_SYSTEM = `You are Ducell, executing tasks on a DigitalOcean Ubuntu server at 165.227.42.130.

TOOLS: Bash, Write, Edit, Read, WebFetch, WebSearch, TodoWrite, Glob, Grep
USE SUDO FOR: pm2, nginx, certbot, systemctl, docker (if needed)

CREDENTIALS (environment variables):
- GITHUB_TOKEN: for git push/GitHub API
- VERCEL_TOKEN: for Vercel deployments  
- RENDER_API_KEY: for Render deployments

AUTH0:
- AUTH0_DOMAIN=dev-yoag06mta5zqt28n.us.auth0.com
- AUTH0_CLIENT_ID=bTX0bT7sTKi2heGFao4yvTNz0nbWp0Ju
- AUTH0_CLIENT_SECRET=B9sTSvNfw4_afi5gQOwzocL-ZzzeE2d7vS6_qkuy_SCGLS73eZjmiJeWCY1ANjb5

KEY PATHS:
- Ducell: /root/ducell/
- Kashboard backend: /root/finance-tracker-backend/
- Kashboard frontend: /root/finance-tracker-frontend/ (or /home/claudeuser/finance-build/frontend/)
- GitHub repo: balpotros/finance-tracker

RULES:
- Always push to GitHub after changes
- Always test URLs before reporting them
- Never ask user to run commands
- If a step fails, retry up to 3 times before reporting FAILED
- Use sudo for system commands`;

// ── STEP TIMEOUTS ──────────────────────────────────────────────────────────────
function getStepTimeout(step) {
  const s = step.toLowerCase();
  if (s.includes('deploy') || s.includes('vercel') || s.includes('npm run build') || s.includes('certbot')) return 600000; // 10 min
  if (s.includes('docker') || s.includes('postgres') || s.includes('database') || s.includes('npm install')) return 600000; // 10 min
  if (s.includes('git') || s.includes('push') || s.includes('commit') || s.includes('migration')) return 600000; // 10 min
  return 600000; // 10 min
}

// ── PARSE ACTION FROM GROQ RESPONSE ───────────────────────────────────────────
function parseAction(response) {
  try {
    // Look for JSON object with "action" key
    const match = response.match(/\{[^{}]*"action"\s*:\s*"[^"]+[^{}]*\}/s);
    if (match) return JSON.parse(match[0]);
  } catch(e) {}
  return null;
}

// ── MAIN HANDLER ───────────────────────────────────────────────────────────────
async function handleMessage(bot, msg) {
  const chatId = msg.chat.id;
  let userMessage = msg.text;
  if (!userMessage) return;

  const isGroup = msg.chat.type === 'group' || msg.chat.type === 'supergroup';
  if (isGroup) {
    const mentioned = userMessage.toLowerCase().includes('@' + BOT_USERNAME.toLowerCase());
    if (!mentioned) return;
    userMessage = userMessage.replace(new RegExp('@' + BOT_USERNAME, 'gi'), '').trim();
    if (!userMessage) userMessage = 'Hello';
  }

  const firstName = (msg.from && msg.from.first_name) ? msg.from.first_name : 'Bissam';
  console.log(`[${firstName}]: ${userMessage}`);
  setStatus('working', userMessage.substring(0, 200));
  addToHistory(String(chatId), 'user', userMessage);

  const memory = fs.existsSync(MEMORY_FILE) ? fs.readFileSync(MEMORY_FILE, 'utf8') : 'No memory yet.';
  const history = getHistory(String(chatId));
  const state = getState(chatId);

  try {
    // If currently executing, acknowledge and return
    if (state.mode === 'executing') {
      await bot.sendMessage(chatId, "Still working on the current task. I'll update you shortly.");
      return;
    }

    // SHORTCUT: if user says fix/go after recent investigation, skip Groq
    const FIX_WORDS = ['fix','go','do it','apply','yes','now','proceed','build it','just do','make it'];
    if (state.mode === 'investigated' && state.data && state.investigatedAt && (Date.now() - new Date(state.investigatedAt || 0).getTime()) < 600000 && FIX_WORDS.some(k => userMessage.toLowerCase().includes(k))) {
      const prevFindings = state.data.findings || '';
      await bot.sendMessage(chatId, '🔍 Planning fixes based on investigation...');
      const fixPrompt = CONVERSATION_SYSTEM + '\n\nYOUR MEMORY:\n' + memory.substring(0, 1000) + '\n\nINVESTIGATION FINDINGS (already completed — do NOT investigate again):\n' + prevFindings + '\n\nUser says: ' + userMessage + '\n\nOutput the build JSON immediately to fix these issues. No investigation needed.';
      const fixResponse = await callGroq(fixPrompt, [{role:'user', content: userMessage}]);
      const fixAction = parseAction(fixResponse);
      if (fixAction && fixAction.action === 'build' && fixAction.steps && fixAction.steps.length > 0) {
        clearState(chatId);
        setState(chatId, 'executing', fixAction);
        await bot.sendMessage(chatId, 'Ὠ0 Starting — ' + fixAction.steps.length + ' steps');
        let completedResults = [];
        let failed = false;
        for (let i = 0; i < fixAction.steps.length; i++) {
          const step = fixAction.steps[i];
          await bot.sendMessage(chatId, '⚙️ ' + (i+1) + '/' + fixAction.steps.length + ': ' + step);
          const stepPrompt = EXECUTION_SYSTEM + '\n\nCURRENT TASK: Executing confirmed build.\nCOMPLETED: ' + (completedResults.length > 0 ? completedResults.map((r,j) => 'Step '+(j+1)+': '+r.substring(0,100)).join(' | ') : 'None') + '\n\nEXECUTE THIS STEP ONLY: ' + step + '\n\nBe concise. If fails after 3 retries say FAILED: [reason].';
          const result = await askBridge(stepPrompt, getStepTimeout(step));
          if (result === 'Timeout.' || result.startsWith('FAILED:') || result.startsWith('Bridge error:')) {
            await bot.sendMessage(chatId, '❌ Step ' + (i+1) + ' failed: ' + result);
            failed = true; break;
          }
          completedResults.push(result);
          await bot.sendMessage(chatId, '✅ ' + (i+1) + '/' + fixAction.steps.length + ': ' + result.substring(0, 280));
        }
        if (!failed) await bot.sendMessage(chatId, '✅ All done!\n\n' + completedResults[completedResults.length-1]);
        clearState(chatId);
        addToHistory(String(chatId), 'assistant', 'Build: ' + fixAction.steps.join(', '));
        setStatus('idle', '');
        return;
      }
    }

    // Build Groq messages from history
    const groqMessages = history.slice(-15).map(h => ({
      role: h.role === 'user' ? 'user' : 'assistant',
      content: h.content
    }));
    groqMessages.push({ role: 'user', content: userMessage });

    const systemWithMemory = CONVERSATION_SYSTEM + '\n\nYOUR MEMORY:\n' + memory.substring(0, 2000);

    // Call Groq
    const response = await callGroq(systemWithMemory, groqMessages);
    const action = parseAction(response);

    // ── INVESTIGATE ──
    if (action && action.action === 'investigate') {
      await bot.sendMessage(chatId, '🔍 Checking...');

      const investigatePrompt = `${EXECUTION_SYSTEM}

TASK: Investigate and report — do NOT change anything.
${action.prompt}

Report findings in plain English — no SQL, no code blocks, no technical jargon. Write like you are explaining to a non-technical person. Focus on: what is broken, why it is broken, and what needs to be done to fix it. Keep it under 5 sentences.`;

      const findings = await askBridge(investigatePrompt, 180000);
      addToHistory(String(chatId), 'assistant', findings.substring(0, 500));
      setState(chatId, 'investigated', { findings: findings.substring(0, 2000), investigatedAt: new Date().toISOString() });

      const chunks = findings.match(/.{1,4000}/gs) || [findings];
      for (const chunk of chunks) {
        await bot.sendMessage(chatId, chunk);
        await new Promise(r => setTimeout(r, 200));
      }

    // ── BUILD ──
    } else if (action && action.action === 'build' && Array.isArray(action.steps) && action.steps.length > 0) {
      setState(chatId, 'executing', action);
      await bot.sendMessage(chatId, `🚀 Starting — ${action.steps.length} steps`);

      let completedResults = [];
      let failed = false;

      for (let i = 0; i < action.steps.length; i++) {
        const step = action.steps[i];
        await bot.sendMessage(chatId, `⚙️ ${i+1}/${action.steps.length}: ${step}`);

        const stepPrompt = `${EXECUTION_SYSTEM}

CURRENT TASK: Executing confirmed build.
COMPLETED SO FAR: ${completedResults.length > 0 ? completedResults.map((r,j) => `Step ${j+1}: ${r.substring(0,100)}`).join(' | ') : 'None yet'}

EXECUTE THIS STEP ONLY: ${step}

Be concise. Report exactly what you did. If this fails after 3 retries, respond with "FAILED: [specific reason]".`;

        const result = await askBridge(stepPrompt, getStepTimeout(step));

        if (result === 'Timeout.' || result.startsWith('FAILED:') || result.startsWith('Bridge error:')) {
          await bot.sendMessage(chatId, `❌ Step ${i+1} failed: ${result}\n\nStopped here. Steps 1–${i} completed successfully.`);
          failed = true;
          break;
        }

        completedResults.push(result);
        await bot.sendMessage(chatId, `✅ ${i+1}/${action.steps.length}: ${result.substring(0, 280)}`);
      }

      if (!failed) {
        await bot.sendMessage(chatId, `✅ All done!\n\n${completedResults[completedResults.length - 1]}`);
      }

      clearState(chatId);
      addToHistory(String(chatId), 'assistant', `Build: ${action.steps.join(', ')}`);

    // ── CONVERSATION ──
    } else {
      addToHistory(String(chatId), 'assistant', response.substring(0, 500));
      const chunks = response.match(/.{1,4000}/gs) || [response];
      for (const chunk of chunks) {
        await bot.sendMessage(chatId, chunk);
        await new Promise(r => setTimeout(r, 200));
      }
    }

  } catch(err) {
    console.error('Error:', err);
    clearState(chatId);
    await bot.sendMessage(chatId, `Something went wrong: ${err.message.substring(0, 200)}`);
  } finally {
    setStatus('idle', '');
  }
}

module.exports = { handleMessage };
