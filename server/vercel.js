import { handleCreatorApi } from './creatorApi.js'

export default async function handler(req, res) {
  if (!await handleCreatorApi(req, res)) {
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ message: 'API route not found' }))
  }
}
