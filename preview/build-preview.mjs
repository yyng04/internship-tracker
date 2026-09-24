// Copies the current build into preview/app and adapts it for the local preview,
// so the preview always runs the latest code instead of a stale copy.
//
// Two adjustments are needed:
//   1. Inject the browser-API mock before the app's own scripts run.
//   2. Rewrite the build's absolute /assets/ paths, since the app is served
//      under /app/ here rather than at the server root.
import { cp, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const dist = resolve(here, '..', 'dist')
const app = resolve(here, 'app')

const PAGES = ['src/popup/index.html', 'src/dashboard/index.html']
const INJECT = '<script src="/preview-mock.js"></script>'

await rm(app, { recursive: true, force: true })
await cp(dist, app, { recursive: true })

for (const page of PAGES) {
  const path = resolve(app, page)
  let html = await readFile(path, 'utf8')
  html = html.replaceAll('"/assets/', '"/app/assets/')
  if (!html.includes(INJECT)) html = html.replace('<head>', `<head>${INJECT}`)
  await writeFile(path, html)
}

console.log('preview/app refreshed from dist')
