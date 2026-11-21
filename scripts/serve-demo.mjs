#!/usr/bin/env node
/**
 * 정적 데모 미리보기 서버 — `pnpm demo:build` 결과(`apps/web/dist`)를 GitHub Pages 와 같은
 * 하위 경로(`/con-ai/`)로 내보낸다. 배포 전에 배포 주소와 같은 조건에서 열어 보기 위한 것이다.
 *
 * 실행: `pnpm demo:serve` (포트는 PORT, 기준 경로는 DEMO_BASE 로 바꾼다)
 * 여기서는 API 를 띄우지 않는다 — 정적 데모는 브라우저 안에서 스스로 동작해야 하므로,
 * 서버가 있으면 「서버 덕분에 동작한 것」과 구분되지 않는다.
 */
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { dirname, extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'apps', 'web', 'dist')
const BASE = process.env['DEMO_BASE'] ?? '/con-ai/'
const PORT = Number(process.env['PORT'] ?? 4321)

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
}

const server = createServer(async (req, res) => {
  const path = decodeURIComponent((req.url ?? '/').split('?')[0] ?? '/')
  if (!path.startsWith(BASE)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end(`이 서버는 ${BASE} 아래만 제공합니다`)
    return
  }
  const rel = path.slice(BASE.length - 1)
  const file = join(ROOT, normalize(rel === '/' ? '/index.html' : rel))
  // dist 밖으로 나가는 경로는 거절한다.
  if (!file.startsWith(ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('허용되지 않는 경로')
    return
  }
  try {
    const body = await readFile(file)
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' })
    res.end(body)
  } catch {
    // 해시 라우팅 SPA — 없는 경로는 index.html 로 돌려준다 (Pages 와 같은 동작).
    try {
      const body = await readFile(join(ROOT, 'index.html'))
      res.writeHead(200, { 'Content-Type': TYPES['.html'] })
      res.end(body)
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end(`빌드 결과가 없습니다: ${ROOT} (먼저 pnpm demo:build)`)
    }
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[demo] http://127.0.0.1:${PORT}${BASE} (정적 파일: ${ROOT})`)
})
