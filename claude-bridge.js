const net = require('net');
const fs = require('fs');

const SOCKET_PATH = '/tmp/claude-bridge.sock';
const LOG_FILE = '/tmp/claude-bridge.log';
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 min idle

function log(msg) {
  const line = new Date().toISOString() + ' ' + msg + '\n';
  fs.appendFileSync(LOG_FILE, line);
  console.log(msg);
}

try { fs.unlinkSync(SOCKET_PATH); } catch(e) {}

let session = null;
let sessionLastUsed = null;
let sessionInitializing = false;
let pendingResolvers = [];

async function getSession() {
  if (session && sessionLastUsed && Date.now() - sessionLastUsed > SESSION_TIMEOUT) {
    log('Session timeout — resetting');
    try { session.close(); } catch(e) {}
    session = null;
  }

  if (session) return session;

  if (sessionInitializing) {
    return new Promise((resolve) => pendingResolvers.push(resolve));
  }

  sessionInitializing = true;
  log('Starting persistent Claude session...');

  try {
    const { unstable_v2_createSession } = await import('/root/ducell/node_modules/@anthropic-ai/claude-agent-sdk/sdk.mjs');

    const env = {
      HOME: '/home/claudeuser',
      GITHUB_TOKEN: process.env.GITHUB_TOKEN || '',
      VERCEL_TOKEN: process.env.VERCEL_TOKEN || '',
      RENDER_API_KEY: process.env.RENDER_API_KEY || '',
      PATH: process.env.PATH || '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
    };
    delete env.ANTHROPIC_API_KEY;
    delete env.CLAUDECODE;

    session = unstable_v2_createSession({
      model: 'claude-sonnet-4-6',
      allowedTools: ['Bash', 'Write', 'Edit', 'Read', 'Agent', 'Glob', 'Grep', 'WebFetch', 'WebSearch', 'TodoWrite'],
      env,
      cwd: '/root',
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
    });

    log('Session started');
    sessionInitializing = false;
    const pending = [...pendingResolvers];
    pendingResolvers = [];
    for (const r of pending) r(session);
    return session;
  } catch(err) {
    log('Session init error: ' + err.message);
    sessionInitializing = false;
    session = null;
    throw err;
  }
}

async function runPrompt(prompt) {
  const s = await getSession();
  sessionLastUsed = Date.now();
  await s.send(prompt);
  let result = '';
  for await (const msg of s.stream()) {
    if (msg.type === 'result') { result = msg.result || ''; break; }
    if (msg.type === 'system' && msg.subtype === 'error') throw new Error(JSON.stringify(msg));
  }
  return result || 'No response from Claude.';
}

const server = net.createServer((socket) => {
  log('Client connected');
  let promptData = '';

  socket.on('data', (data) => {
    promptData += data.toString();
    if (promptData.endsWith('\n__END__\n')) {
      const prompt = promptData.replace('\n__END__\n', '');
      promptData = '';
      log('Prompt: ' + prompt.substring(0, 80));

      runPrompt(prompt)
        .then((output) => {
          log('Done: ' + output.length + ' chars');
          socket.write(output);
          socket.write('\n__DONE__\n');
        })
        .catch((err) => {
          log('Error: ' + err.message);
          try { session.close(); } catch(e) {}
          session = null;
          socket.write('FAILED: ' + err.message);
          socket.write('\n__DONE__\n');
        });
    }
  });

  socket.on('error', (err) => log('Socket error: ' + err.message));
  socket.on('close', () => log('Client disconnected'));
});

server.listen(SOCKET_PATH, () => {
  fs.chmodSync(SOCKET_PATH, '777');
  log('Bridge listening — pre-warming session...');
  getSession().then(() => log('Session ready')).catch(err => log('Pre-warm failed: ' + err.message));
});

server.on('error', (err) => log('Server error: ' + err.message));

process.on('SIGTERM', () => {
  if (session) try { session.close(); } catch(e) {}
  server.close();
  try { fs.unlinkSync(SOCKET_PATH); } catch(e) {}
  process.exit(0);
});
