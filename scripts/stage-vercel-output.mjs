import { cp, mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { build } from 'vite'

const root = process.cwd()
const dist = path.join(root, 'dist')
const out = path.join(root, '.vercel', 'output')

await rm(out, { recursive: true, force: true })
await mkdir(path.join(out, 'static'), { recursive: true })
await cp(dist, path.join(out, 'static'), { recursive: true })
const apiOut = path.join(out, 'functions', 'creator-api.func')
await build({
  configFile: false,
  ssr: { noExternal: true },
  build: {
    ssr: path.join(root, 'server/vercel.js'),
    outDir: apiOut,
    rollupOptions: { output: { entryFileNames: 'index.js' } },
  },
})
await writeFile(path.join(apiOut, 'package.json'), '{"type":"module"}\n')
await writeFile(path.join(apiOut, '.vc-config.json'),
  JSON.stringify({ runtime: 'nodejs22.x', handler: 'index.js', launcherType: 'Nodejs',
    shouldAddHelpers: true, maxDuration: 60 }))
await writeFile(
  path.join(out, 'config.json'),
  JSON.stringify(
    {
      version: 3,
      routes: [
        { src: '/api/(creator|printful|checkout|webhooks)(/.*)?', dest: '/creator-api' },
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
