module.exports = {
  apps: [
    {
      name: 'ducell',
      script: '/root/ducell/bot.js',
      cwd: '/root/ducell',
      env: {
        CLAUDECODE: '',
        GROQ_API_KEY: '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',
        GITHUB_TOKEN: process.env.GITHUB_TOKEN || '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',
        VERCEL_TOKEN: process.env.VERCEL_TOKEN || 'vcp_6ZTKGSZSidPD0JMnmZ2uOIuAp8jeaZcrPB8e7S7Bsratr3B1Sz4FQdu4',
        RENDER_API_KEY: process.env.RENDER_API_KEY || 'rnd_rUA40k0N0kpfZvJB9eNsOKsz41Gy'
      }
    },
    {
      name: 'ducell-dashboard',
      script: '/root/ducell/dashboard.js',
      cwd: '/root/ducell',
      env: {
        CLAUDECODE: ''
      }
    },
    {
      name: 'claude-bridge',
      script: '/root/ducell/claude-bridge.js',
      cwd: '/root/ducell',
      user: 'claudeuser',
      env: {
        HOME: '/home/claudeuser',
        GITHUB_TOKEN: process.env.GITHUB_TOKEN || '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',
        VERCEL_TOKEN: process.env.VERCEL_TOKEN || 'vcp_6ZTKGSZSidPD0JMnmZ2uOIuAp8jeaZcrPB8e7S7Bsratr3B1Sz4FQdu4',
        RENDER_API_KEY: process.env.RENDER_API_KEY || 'rnd_rUA40k0N0kpfZvJB9eNsOKsz41Gy',
        GROQ_API_KEY: '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'
      }
    }
  ]
};
