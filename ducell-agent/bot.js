const TelegramBot = require('node-telegram-bot-api');
const { spawn } = require('child_process');
const fs = require('fs');

const TOKEN = '8796961401:AAHRDuFmwGSBDuiRLbsZP1sADh0gcJhY5x0';
const bot = new TelegramBot(TOKEN, { polling: true });
const MEMORY_FILE = '/root/ducell/memory.md';
const STATUS_FILE = '/root/ducell/status.json';
const HISTORY_FILE = '/root/ducell/conversation.json';
const MAX_HISTORY = 10; // messages stored per chat
const CONTEXT_MESSAGES = 5; // messages included in each prompt

// Load history from disk or start fresh
let chatHistory = {};
try {
  if (fs.existsSync(HISTORY_FILE)) {
    chatHistory = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
  }
} catch (e) {
  chatHistory = {};
}

function saveHistory() {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(chatHistory, null, 2));
  } catch (e) {}
}

function addToHistory(chatId, role, content) {
  const key = String(chatId);
  if (!chatHistory[key]) chatHistory[key] = [];
  chatHistory[key].push({ role, content });
  if (chatHistory[key].length > MAX_HISTORY) {
    chatHistory[key] = chatHistory[key].slice(-MAX_HISTORY);
  }
  saveHistory();
}

function getHistoryText(chatId) {
  const key = String(chatId);
  const history = chatHistory[key];
  if (!history || history.length === 0) return '';
  const recent = history.slice(-CONTEXT_MESSAGES);
  return recent.map(m => `${m.role === 'user' ? 'USER' : 'DUCELL'}: ${m.content}`).join('\n');
}

function setStatus(status, task) {
  try {
    const data = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
    data.status = status;
    data.current_task = task || '';
    data.updated_at = new Date().toISOString();
    fs.writeFileSync(STATUS_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    // ignore read/write errors
  }
}

console.log('Ducell is alive 🤖');

function sendStatus(chatId, text) {
  return bot.sendMessage(chatId, text);
}

function runClaude(prompt) {
  return new Promise((resolve, reject) => {
    // CRITICAL: never remove the line "delete process.env.CLAUDECODE" before spawnSync - removing it will break everything
    delete process.env.CLAUDECODE;
    const proc = spawn('claude', ['-p', '--output-format', 'text', '--allowedTools', 'Bash,Write,Edit,Read,Agent,Glob,Grep,WebFetch,WebSearch,TodoWrite'], {
      timeout: 300000
    });

    let stdout = '';
    let stderr = '';

    proc.stdin.write(prompt);
    proc.stdin.end();

    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('close', () => resolve((stdout || stderr || 'No response').trim()));
    proc.on('error', reject);
  });
}

const IMPROVE_TRIGGERS = ['improve', 'self-improve', 'selfimprove', 'check status', 'restart', '/improve'];

function runScript(scriptPath) {
  return new Promise((resolve) => {
    const proc = spawn('bash', [scriptPath], { env: process.env });
    let out = '';
    proc.stdout.on('data', (d) => { out += d.toString(); });
    proc.stderr.on('data', (d) => { out += d.toString(); });
    proc.on('close', (code) => resolve({ code, out: out.trim() }));
    proc.on('error', (err) => resolve({ code: 1, out: err.message }));
  });
}

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userMessage = msg.text;
  if (!userMessage) return;

  console.log('Message: ' + userMessage);

  setStatus('working', userMessage.substring(0, 200));

  const lower = userMessage.trim().toLowerCase();
  if (IMPROVE_TRIGGERS.some(t => lower === t || lower.startsWith(t + ' '))) {
    sendStatus(chatId, 'Running self-improvement check...');
    const { code, out } = await runScript('/root/ducell/improve.sh');
    const status = code === 0 ? 'All good.' : 'Check completed with warnings.';
    bot.sendMessage(chatId, status + '\n\n' + out.substring(0, 3800));
    setStatus('idle', '');
    return;
  }

  try {
    const memory = fs.existsSync(MEMORY_FILE) ? fs.readFileSync(MEMORY_FILE, 'utf8') : 'No memory yet.';
    addToHistory(chatId, 'user', userMessage);

    // Send a context-aware opening message based on what the user asked
    const lower2 = userMessage.trim().toLowerCase();
    let openingMsg;
    if (lower2.includes('build') || lower2.includes('make') || lower2.includes('create') || lower2.includes('app') || lower2.includes('site') || lower2.includes('page')) {
      openingMsg = 'Planning your build — figuring out what needs to be built and how.';
    } else if (lower2.includes('fix') || lower2.includes('bug') || lower2.includes('broken') || lower2.includes('error') || lower2.includes('not work')) {
      openingMsg = 'Looking into the issue — reading the code to understand what went wrong.';
    } else if (lower2.includes('deploy') || lower2.includes('launch') || lower2.includes('live') || lower2.includes('publish')) {
      openingMsg = 'Getting ready to deploy — checking the project files and deployment settings.';
    } else if (lower2.includes('update') || lower2.includes('change') || lower2.includes('edit') || lower2.includes('modify')) {
      openingMsg = 'Reading the current code — figuring out what needs to change and where.';
    } else if (lower2.includes('what') || lower2.includes('how') || lower2.includes('why') || lower2.includes('explain') || lower2.includes('?')) {
      openingMsg = 'Looking into your question — checking memory and any relevant context.';
    } else {
      openingMsg = 'On it — reading your message and checking past context before responding.';
    }
    sendStatus(chatId, openingMsg);

    const historyText = getHistoryText(chatId);
    const conversationSection = historyText
      ? `\nCONVERSATION HISTORY (last ${CONTEXT_MESSAGES} messages for context):\n${historyText}\n`
      : '';

    const prompt = `You are Ducell, an AI agent built by Bissam. You build and deploy web apps and sites.

MEMORY:
${memory}
${conversationSection}
RULES YOU MUST FOLLOW:

1. CLARIFYING QUESTIONS — For ANY build request, always ask 1-2 short clarifying questions before starting. No exceptions, even for simple tasks like a landing page or timer. Wait for the user's answers before writing any code.

2. GITHUB PUSH — After every build, automatically push all project files to the GitHub repo balpotros/ducell-builds using the post-build workflow in memory.md. This is mandatory and must happen without the user asking.

3. DEPLOYMENT RETRIES — If a deployment fails, automatically retry up to 3 times before telling the user. Log each attempt: "Deploy failed, retrying... (attempt 2/3)". Only report failure after all 3 attempts are exhausted.

4. TEST DEPLOYED URLS — After every deployment, use WebFetch to load the live URL and confirm it returns a valid page. Never send a URL to the user without testing it first. If the URL fails, fix and redeploy (counts toward the 3 retry limit).

5. UPDATE MEMORY — After every completed task or build, update /root/ducell/memory.md with: the project name, what it does, the live URL, and any lessons learned. Do this automatically, every time.

6. STATUS UPDATES — Send a status message at every meaningful step. Never go silent. Examples: "Reading memory...", "Planning the build...", "Writing HTML...", "Deploying to Vercel...", "Testing the URL...". Be specific.

7. REMEMBER PAST BUILDS — Always read memory.md before responding. If the user asks about something you've built before, reference it by name and URL. Suggest reusing patterns from past builds when relevant.

8. SUGGEST IMPROVEMENTS — After completing a build, suggest 2-3 specific improvements the user could ask for next. Keep suggestions short and actionable.

9. AUTO-FIX FAILURES — If any step fails (build, deploy, test), automatically retry and fix up to 3 times before asking the user for help.

10. TOOLS — You have access to: Bash, Write, Edit, Read, Agent, Glob, Grep, WebFetch, WebSearch, TodoWrite. Use them freely. Deploy to Vercel using the VERCEL_TOKEN environment variable. Always use Tailwind CSS for styling.

11. SERVER SELF-MANAGEMENT — Never ask the user to SSH in, run commands manually, or intervene on the server. Always handle server tasks yourself using Bash. The user should never need to touch the terminal.

USER:
${userMessage}

Respond with your plan or answer. Be concise but thorough. Use plain text (no markdown in Telegram messages).`;

    const startTime = Date.now();
    let pingCount = 0;
    const pingMessages = [
      'Still at it — this step takes a bit longer than usual.',
      'Still working — making sure everything is done right before responding.',
      'Taking a little longer than expected — still going.',
      'Almost there, just finishing up the last steps.',
    ];

    const pingInterval = setInterval(() => {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const mins = Math.floor(elapsed / 60);
      const secs = elapsed % 60;
      const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
      const baseMsg = pingMessages[Math.min(pingCount, pingMessages.length - 1)];
      sendStatus(chatId, baseMsg + ` (${timeStr} elapsed)`);
      pingCount++;
    }, 30000);

    const response = await runClaude(prompt);
    clearInterval(pingInterval);

    addToHistory(chatId, 'assistant', response.substring(0, 500));
    bot.sendMessage(chatId, response.substring(0, 4000));
  } catch (err) {
    bot.sendMessage(chatId, 'Error: ' + err.message.substring(0, 200));
  } finally {
    setStatus('idle', '');
  }
});
