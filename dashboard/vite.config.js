import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

// Serve POST /api/chat in dev with the same handler Vercel runs in production.
// The key is read from dashboard/.env.local (ANTHROPIC_API_KEY) and never reaches the browser.
function rayaApi(mode) {
  return {
    name: 'raya-api',
    configureServer(server) {
      const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
      server.middlewares.use('/api/chat', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; return res.end('{}') }
        let raw = ''
        req.on('data', (c) => { raw += c; if (raw.length > 200000) req.destroy() })
        req.on('end', async () => {
          let body = {}
          try { body = JSON.parse(raw || '{}') } catch { /* ignore */ }
          const { handleChat } = require('../api/_raya.js')
          const { status, json } = await handleChat(body, env)
          res.statusCode = status
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify(json))
        })
      })
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), rayaApi(mode)],
  base: '/dashboard/dist/',
}))
