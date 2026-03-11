const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3001;
const STATUS_FILE = path.join(__dirname, 'status.json');

function getStatus() {
  try {
    return JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
  } catch {
    return { started_at: new Date().toISOString(), current_task: 'Unknown', completed_tasks: [] };
  }
}

function formatUptime(startedAt) {
  const ms = Date.now() - new Date(startedAt).getTime();
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h ${m % 60}m`;
  if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function buildHTML(status) {
  const uptime = formatUptime(status.started_at);
  const tasks = (status.completed_tasks || []).slice(-10).reverse();

  const taskRows = tasks.length === 0
    ? `<tr><td colspan="4" class="px-6 py-8 text-center text-gray-500">No completed tasks yet</td></tr>`
    : tasks.map((t, i) => `
      <tr class="${i % 2 === 0 ? 'bg-gray-800' : 'bg-gray-750'}">
        <td class="px-6 py-3 text-sm font-mono text-purple-400">${escapeHtml(t.name)}</td>
        <td class="px-6 py-3 text-sm text-gray-300">${escapeHtml(t.description || '')}</td>
        <td class="px-6 py-3 text-sm">
          ${t.url ? `<a href="${escapeHtml(t.url)}" target="_blank" class="text-blue-400 hover:text-blue-300 underline break-all">${escapeHtml(t.url)}</a>` : '<span class="text-gray-500">—</span>'}
        </td>
        <td class="px-6 py-3 text-sm text-gray-400 whitespace-nowrap">${t.completed_at ? new Date(t.completed_at).toLocaleString() : '—'}</td>
      </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Ducell Status Dashboard</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <meta http-equiv="refresh" content="15" />
  <style>
    .bg-gray-750 { background-color: #1f2937; }
    @keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
    .pulse-dot { animation: pulse-dot 2s ease-in-out infinite; }
  </style>
</head>
<body class="bg-gray-900 text-white min-h-screen font-sans">

  <!-- Header -->
  <div class="border-b border-gray-700 px-8 py-5 flex items-center justify-between">
    <div class="flex items-center gap-3">
      <span class="text-2xl">🤖</span>
      <div>
        <h1 class="text-xl font-bold tracking-tight">Ducell</h1>
        <p class="text-xs text-gray-400">AI Agent by Bissam</p>
      </div>
    </div>
    <p class="text-xs text-gray-500">Auto-refreshes every 15s &nbsp;·&nbsp; ${new Date().toLocaleString()}</p>
  </div>

  <div class="max-w-6xl mx-auto px-8 py-8 space-y-6">

    <!-- Status cards -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">

      <!-- Online/Offline -->
      <div class="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <p class="text-xs text-gray-400 uppercase tracking-widest mb-3">Status</p>
        <div class="flex items-center gap-3">
          <span class="pulse-dot w-4 h-4 rounded-full bg-green-400 inline-block shadow-lg shadow-green-400/40"></span>
          <span class="text-2xl font-bold text-green-400">Online</span>
        </div>
      </div>

      <!-- Uptime -->
      <div class="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <p class="text-xs text-gray-400 uppercase tracking-widest mb-3">Uptime</p>
        <p class="text-2xl font-bold text-white font-mono">${uptime}</p>
        <p class="text-xs text-gray-500 mt-1">since ${new Date(status.started_at).toLocaleString()}</p>
      </div>

      <!-- Builds delivered -->
      <div class="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <p class="text-xs text-gray-400 uppercase tracking-widest mb-3">Builds Delivered</p>
        <p class="text-2xl font-bold text-white">${tasks.length}</p>
      </div>

    </div>

    <!-- Current task -->
    <div class="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <p class="text-xs text-gray-400 uppercase tracking-widest mb-2">Currently Working On</p>
      <p class="text-lg font-medium ${status.current_task === 'Idle' ? 'text-gray-400 italic' : 'text-yellow-300'}">${escapeHtml(status.current_task)}</p>
    </div>

    <!-- Completed tasks -->
    <div class="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
      <div class="px-6 py-4 border-b border-gray-700">
        <p class="text-sm font-semibold text-gray-200">Last 10 Completed Tasks</p>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="bg-gray-900 text-left text-xs text-gray-400 uppercase tracking-wider">
              <th class="px-6 py-3">Project</th>
              <th class="px-6 py-3">Description</th>
              <th class="px-6 py-3">Live URL</th>
              <th class="px-6 py-3">Completed</th>
            </tr>
          </thead>
          <tbody>
            ${taskRows}
          </tbody>
        </table>
      </div>
    </div>

  </div>
</body>
</html>`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const server = http.createServer((req, res) => {
  if (req.url === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(getStatus(), null, 2));
    return;
  }
  const status = getStatus();
  const html = buildHTML(status);
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(html);
});

server.listen(PORT, () => {
  console.log(`Ducell dashboard running on port ${PORT}`);
});
