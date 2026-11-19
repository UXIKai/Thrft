// Copies the @imgly/background-removal model + wasm files into public/imgly so they load from our own origin.
import { mkdir, writeFile, access } from 'node:fs/promises'
import { join } from 'node:path'

const version = '1.7.0'
const base = `https://staticimgly.com/@imgly/background-removal-data/${version}/dist/`
const out = join(import.meta.dirname, '..', 'public', 'imgly')

async function get(name) {
  const res = await fetch(new URL(name, base))
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

try {
  await access(join(out, 'resources.json'))
  console.log('public/imgly already present')
} catch {
  try {
    await mkdir(out, { recursive: true })
    const manifest = await get('resources.json')
    await writeFile(join(out, 'resources.json'), manifest)
    const chunks = new Set(Object.values(JSON.parse(manifest)).flatMap((entry) => entry.chunks.map((chunk) => chunk.name)))
    for (const name of chunks) await writeFile(join(out, name), await get(name))
    console.log(`Downloaded ${chunks.size} imgly files to public/imgly`)
  } catch (error) {
    console.warn('Could not download imgly assets; the app will fall back to staticimgly.com:', error.message)
  }
}
