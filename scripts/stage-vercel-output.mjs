import { cp, mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const dist = path.join(root, 'dist')
const out = path.join(root, '.vercel', 'output')

await rm(out, { recursive: true, force: true })
await mkdir(path.join(out, 'static'), { recursive: true })
await cp(dist, path.join(out, 'static'), { recursive: true })
await writeFile(
  path.join(out, 'config.json'),
  JSON.stringify(
    {
      version: 3,
      routes: [
        { src: '/brand-icons/(.*)', dest: 'https://www.google.com/$1' },
        { handle: 'filesystem' },
        { src: '/(.*)', dest: '/index.html' },
      ],
    },
    null,
    2,
  ) + '\n',
)

// Project settings can publish the repo root instead of dist. In that case
// a root index.js is served at / and the browser shows the API source.
if (process.env.VERCEL) {
  await cp(path.join(dist, 'index.html'), path.join(root, 'index.html'))
  await cp(path.join(dist, 'assets'), path.join(root, 'assets'), {
    recursive: true,
  })
  await cp(path.join(dist, 'icons'), path.join(root, 'icons'), {
    recursive: true,
  }).catch(() => {})
}
