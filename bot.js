const TelegramBot = require('node-telegram-bot-api');
const TOKEN = '8796961401:AAHRDuFmwGSBDuiRLbsZP1sADh0gcJhY5x0';
const bot = new TelegramBot(TOKEN, { polling: true });

delete process.env.CLAUDECODE;

function loadBrain() {
  delete require.cache[require.resolve('./brain.js')];
  return require('./brain.js');
}

bot.on('message', async (msg) => {
  try {
    const brain = loadBrain();
    await brain.handleMessage(bot, msg);
  } catch (err) {
    console.error('Brain error:', err);
    try { await bot.sendMessage(msg.chat.id, 'Sorry, something went wrong. Try again.'); } catch(e) {}
  }
});

console.log('Ducell is alive 🤖');
