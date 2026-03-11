module.exports = {

  apps: [{

    name: 'ducell',

    script: 'bot.js',

    env: {
      CLAUDECODE: "",

      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,

      GITHUB_TOKEN: process.env.GITHUB_TOKEN,

      VERCEL_TOKEN: process.env.VERCEL_TOKEN,

      RENDER_API_KEY: process.env.RENDER_API_KEY || 'rnd_rUA40k0N0kpfZvJB9eNsOKsz41Gy'

    }

  }, {

    name: 'ducell-dashboard',

    script: 'dashboard.js',

    env: {
      CLAUDECODE: "",}

  }]

}

