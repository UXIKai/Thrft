import http from 'node:http'
import handler from './vercel.js'

const port = Number(process.env.THRFT_API_PORT || 8787)
http.createServer(handler).listen(port, '127.0.0.1', () => {
  console.log(`[creator-api] listening on http://127.0.0.1:${port}`)
})
