const TelegramBot = require('node-telegram-bot-api');
const { spawnSync } = require('child_process');
const fs = require('fs');

const TOKEN = '8796961401:AAHRDuFmwGSBDuiRLbsZP1sADh0gcJhY5x0';
const bot = new TelegramBot(TOKEN, { polling: true });
const MEMORY_FILE = '/root/ducell/memory.md';

console.log('Ducell is alive 🤖');

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userMessage = msg.text;
  if (!userMessage) return;

  console.log('Message: ' + userMessage);
  bot.sendMessage(chatId, 'Working on it...');

  try {
    const memory = fs.existsSync(MEMORY_FILE) ? fs.readFileSync(MEMORY_FILE, 'utf8') : 'No memory yet.';
    const prompt = 'You are Ducell, an AI agent.\n\nMEMORY:\n' + memory + '\n\nUSER:\n' + userMessage + '\n\nBuild things when asked. Update memory.md after builds. Be concise.';

    const result = spawnSync('claude', ['-p', '--output-format', 'text', '--allowedTools', 'Bash,Write,Edit,Read'], {
      input: prompt,
      timeout: 180000,
      encoding: 'utf8'
    });

    const response = (result.stdout || result.stderr || 'No response').trim();
    bot.sendMessage(chatId, response.substring(0, 4000));
  } catch (err) {
    bot.sendMessage(chatId, 'Error: ' + err.message.substring(0, 200));
  }
});
