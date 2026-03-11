module.exports = {

  apps: [{

    name: 'ducell',

    script: 'bot.js',

    env: {

      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,

      GITHUB_TOKEN: process.env.GITHUB_TOKEN,

      CLAUDECODE: "0", VERCEL_TOKEN: process.env.VERCEL_TOKEN

    }

  }]

}

