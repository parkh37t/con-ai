#!/usr/bin/env node
/**
 * 정적 데모 스냅샷 생성 (GitHub Pages 배포용).
 *
 * 실제 API 서버를 임시 DB·임시 내보내기 폴더로 띄워 아래 시나리오를 그대로 실행하고,
 * 응답과 산출물을 `apps/web/public/demo/` 에 저장한다. 저장된 스냅샷은 `apps/web/src/demo-api.ts` 가 읽어
 * 서버 없이 화면을 움직인다.
 *
 * 시나리오 (계약 §7·§8·§12)
 *   1. 시드 프로젝트·요구사항·레퍼런스 조회
 *   2. `SAMPLE-quote-list` 생성 작업 1회 (요구사항·수용조건·레퍼런스·CASE normal/empty/error) → revision 1
 *   3. revision 1 에 코멘트 2건 (디자이너 = 차단, 퍼블리셔 = 비차단)
 *   4. 수정 프롬프트 초안(revision-prompt) → 단건 수정 작업 1회 → revision 2 (코멘트 해결)
 *   5. AS-IS 분석 1회 (`/asis-sample` 대상) → 스크린샷 2장·페인포인트
 *   6. 모든 GET 응답 수집 (승인 전 상태 — 데모에서 "완료(v1.0)" 를 한 번 눌러볼 수 있게)
 *   7. 승인(v1.0) → 내보내기 6파일 복사
 *
 * 실행: `pnpm demo:snapshot`
 * 실패하면 원인을 출력하고 0 이 아닌 코드로 종료한다. 서버와 임시 DB 는 어떤 경우에도 정리한다.
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { cp, mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(ROOT, 'apps', 'web', 'public', 'demo')
const TMP_DIR = join(ROOT, '.local', 'demo-snapshot')
const DB_PATH = join(TMP_DIR, 'demo.db')
const EXPORT_DIR = join(TMP_DIR, 'exports')

const SERVER_READY_TIMEOUT_MS = 90_000
const JOB_TIMEOUT_MS = 180_000
const ASIS_TIMEOUT_MS = 180_000
const POLL_INTERVAL_MS = 500

/** 승인 없이 화면에서 다시 눌러볼 수 있도록, GET 스냅샷은 승인 직전 상태로 찍는다. */
const APPROVER = '데모 기획자'

/**
 * AS-IS 샘플 대상 — 서버가 자체 제공하는 합성 레거시 페이지(가상 데이터).
 * 정적 배포의 「① AS-IS 분석」이 실제로 돌 수 있게 구조·스크린샷을 여기서 기록해 둔다.
 */
const ASIS_SAMPLE_TARGETS = [
  {
    id: 'partner-mall',
    path: '/asis-sample',
    label: '레거시 파트너몰',
    description: '로그인·견적 현황이 한 화면에 섞여 있고, 레이블 없는 입력과 모호한 버튼 문구가 많다.',
    note: '합성 레거시 파트너몰 (정적 데모 샘플 대상)',
  },
  {
    id: 'settlement',
    path: '/asis-sample-2',
    label: '레거시 정산 시스템',
    description: '표 중심 화면이고 고정 폭(1180px)이라 모바일에서 가로 스크롤로 봐야 한다.',
    note: '합성 레거시 정산 시스템 (정적 데모 샘플 대상)',
  },
]

// ---------------------------------------------------------------- 유틸

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

/** 비어 있는 TCP 포트 하나를 고른다. */
function pickFreePort() {
  return new Promise((res, rej) => {
    const srv = createServer()
    srv.on('error', rej)
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address()
      const port = typeof addr === 'object' && addr ? addr.port : 0
      srv.close(() => (port ? res(port) : rej(new Error('빈 포트를 찾지 못했다'))))
    })
  })
}

/** validators·playwright.config 과 같은 규칙: 환경변수가 있으면 그대로, 없으면 컨테이너 기본 경로. */
function chromiumPath() {
  const explicit = process.env.PLAYWRIGHT_CHROMIUM_PATH?.trim()
  if (explicit) return explicit
  return existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
}

class HttpError extends Error {
  constructor(method, path, status, body) {
    super(`${method} ${path} → HTTP ${status}: ${typeof body === 'string' ? body.slice(0, 500) : JSON.stringify(body).slice(0, 500)}`)
    this.name = 'HttpError'
    this.status = status
  }
}

function humanBytes(n) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

// ---------------------------------------------------------------- 서버 제어

function spawnServer(port) {
  const child = spawn('pnpm', ['--filter', '@con-ai/api', 'start'], {
    cwd: ROOT,
    env: {
      ...process.env,
      MODEL_ADAPTER: 'fixture',
      PORT: String(port),
      CON_AI_DB: DB_PATH,
      EXPORT_DIR,
      ...(chromiumPath() ? { PLAYWRIGHT_CHROMIUM_PATH: chromiumPath() } : {}),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    // 프로세스 그룹으로 띄워 pnpm → tsx → node 를 한 번에 정리한다.
    detached: true,
  })
  const log = []
  const keep = (chunk) => {
    log.push(String(chunk))
    if (log.length > 200) log.shift()
  }
  child.stdout.on('data', keep)
  child.stderr.on('data', keep)
  const state = { child, log, exited: null }
  child.on('exit', (code, signal) => {
    state.exited = `code ${code} signal ${signal}`
  })
  return state
}

/** `/api/meta` 가 응답할 때까지 기다린다. */
async function waitServerReady(server, port) {
  const { log } = server
  const base = `http://127.0.0.1:${port}`
  const deadline = Date.now() + SERVER_READY_TIMEOUT_MS
  for (;;) {
    if (server.exited) throw new Error(`API 서버가 시작 중 종료됐다 (${server.exited})\n--- 서버 출력 ---\n${log.join('')}`)
    try {
      const res = await fetch(`${base}/api/meta`)
      if (res.ok) break
    } catch {
      // 아직 안 떴다 — 다시 시도
    }
    if (Date.now() > deadline) throw new Error(`API 서버가 ${SERVER_READY_TIMEOUT_MS}ms 안에 뜨지 않았다\n--- 서버 출력 ---\n${log.join('')}`)
    await sleep(200)
  }
}

async function stopServer(server) {
  if (!server) return
  const { child } = server
  if (child.exitCode !== null || child.signalCode !== null) return
  try {
    process.kill(-child.pid, 'SIGTERM')
  } catch {
    try {
      child.kill('SIGTERM')
    } catch {
      // 이미 종료
    }
  }
  const deadline = Date.now() + 10_000
  while (child.exitCode === null && child.signalCode === null && Date.now() < deadline) await sleep(100)
  if (child.exitCode === null && child.signalCode === null) {
    try {
      process.kill(-child.pid, 'SIGKILL')
    } catch {
      // 무시
    }
  }
}

// ---------------------------------------------------------------- 시나리오

async function main() {
  await rm(TMP_DIR, { recursive: true, force: true })
  await mkdir(TMP_DIR, { recursive: true })

  const port = await pickFreePort()
  const base = `http://127.0.0.1:${port}`
  /** finally 에서 반드시 정리한다 — 시작 도중 실패해도 자식 프로세스를 남기지 않는다. */
  let server = null

  /** 경로별 GET 응답 맵 — demo/snapshot.json 이 된다. 키는 실제 요청 경로 문자열 그대로. */
  const snapshot = {}

  const call = async (method, path, body) => {
    const init = { method, headers: { Accept: 'application/json' } }
    if (body !== undefined) {
      init.headers['Content-Type'] = 'application/json'
      init.body = JSON.stringify(body)
    }
    const res = await fetch(base + path, init)
    const text = await res.text()
    let data
    try {
      data = text ? JSON.parse(text) : undefined
    } catch {
      data = text
    }
    if (!res.ok) throw new HttpError(method, path, res.status, data)
    return data
  }
  /** GET 하고 스냅샷에 기록한다. */
  const get = async (path) => {
    const data = await call('GET', path)
    snapshot[path] = data
    return data
  }
  const getBytes = async (path) => {
    const res = await fetch(base + path)
    if (!res.ok) throw new HttpError('GET', path, res.status, await res.text())
    return Buffer.from(await res.arrayBuffer())
  }

  try {
    console.log(`[demo] API 서버 시작 (포트 ${port}, DB ${DB_PATH}, 어댑터 fixture)`)
    server = spawnServer(port)
    await waitServerReady(server, port)

    // ---------- 1. 시드 조회 ----------
    const meta = await get('/api/meta')
    if (meta.adapter !== 'fixture') throw new Error(`어댑터가 fixture 가 아니다: ${meta.adapter}`)
    const projects = await get('/api/projects')
    const project = projects[0]
    if (!project) throw new Error('시드 프로젝트가 없다')
    const detail = await get(`/api/projects/${project.id}`)
    const references = await get(`/api/projects/${project.id}/references`)
    console.log(`[demo] 프로젝트 "${project.name}" — 화면 ${detail.screens.length}개, 요구사항 ${detail.requirements.length}건, 레퍼런스 ${references.length}건`)

    const listScreen = detail.screens.find((s) => s.external_id === 'SAMPLE-quote-list')
    if (!listScreen) throw new Error('시드에 SAMPLE-quote-list 화면이 없다')
    const req1 = detail.requirements.find((r) => r.external_id === 'REQ-QT-001')
    if (!req1) throw new Error('시드에 REQ-QT-001 요구사항이 없다')
    const listRef = references.find((r) => r.category === 'list') ?? references[0]
    if (!listRef) throw new Error('시드에 레퍼런스가 없다')

    // ---------- 2. 생성 작업 1회 ----------
    const createRequest = {
      screen_id: listScreen.id,
      task_type: 'create',
      purpose: '파트너가 견적 요청 목록을 조회하고 상태·기간으로 검색한다 (정적 데모 스냅샷)',
      scope: '견적 목록 화면 — 검색 영역, 목록 표, CASE 정상/빈값/오류',
      requirement_ids: [req1.id],
      criterion_ids: req1.criteria.slice(0, 2).map((c) => c.id),
      reference_ids: [listRef.id],
      cases: ['normal', 'empty', 'error'],
      keep_conditions: ['견적번호 컬럼은 유지한다', '상태 코드 값은 데이터 계약을 따른다'],
      roles: ['planner', 'designer', 'publisher'],
      device: 'desktop',
    }
    // 프롬프트 미리보기는 브라우저가 그 자리에서 조립하므로 저장하지 않는다. 여기서는 서버가 200 을 주는지만 본다.
    await call('POST', `/api/screens/${listScreen.id}/prompt-preview`, createRequest)
    console.log('[demo] 프롬프트 미리보기 확인 (저장하지 않음 — 브라우저가 직접 조립한다)')

    const { job_id: job1Id } = await call('POST', `/api/screens/${listScreen.id}/generation-jobs`, createRequest)
    const job1 = await waitJob(call, job1Id, JOB_TIMEOUT_MS)
    const rev1Id = job1.result?.revision_id
    if (!rev1Id) throw new Error(`생성 작업에 결과 revision 이 없다: ${JSON.stringify(job1.failure ?? {})}`)
    console.log(`[demo] 생성 작업 성공 — revision 1 = ${rev1Id}`)

    // ---------- 3. 코멘트 2건 ----------
    const rev1 = await call('GET', `/api/revisions/${rev1Id}`)
    const firstElement = rev1.element_index.find((e) => e.element_id !== e.section_id) ?? rev1.element_index[0]
    if (!firstElement) throw new Error('revision 1 에 element_index 가 없다')
    const firstSection = rev1.element_index.find((e) => e.element_id === e.section_id) ?? firstElement

    const blockingComment = await call('POST', `/api/revisions/${rev1Id}/comments`, {
      target: 'screen',
      element_id: firstElement.element_id,
      section_id: firstElement.section_id,
      display_no: firstElement.display_no,
      case_id: 'normal',
      author: '데모 디자이너',
      role: 'designer',
      text: `검색 영역 ${firstElement.display_no}번 항목(${firstElement.element_id})을 필수 입력으로 표시해 주세요`,
      blocking: true,
    })
    const publisherComment = await call('POST', `/api/revisions/${rev1Id}/comments`, {
      target: 'description',
      section_id: firstSection.section_id,
      display_no: firstSection.display_no,
      author: '데모 퍼블리셔',
      role: 'publisher',
      text: '빈값 CASE 의 안내 문구를 설명에도 같은 문장으로 적어 주세요',
      blocking: false,
    })
    console.log(`[demo] 코멘트 2건 작성 (차단 1건: ${blockingComment.id})`)

    // ---------- 4. 수정 프롬프트 초안 → 단건 수정 ----------
    const commentIds = [blockingComment.id, publisherComment.id]
    const revisionPrompt = await call('POST', `/api/revisions/${rev1Id}/revision-prompt`, { comment_ids: commentIds })
    console.log('[demo] 수정 프롬프트 초안 저장')

    const editRequest = {
      screen_id: listScreen.id,
      task_type: 'edit',
      purpose: '코멘트 2건 반영 — 라벨·필수 표시·빈값 안내 문구 (정적 데모 스냅샷)',
      requirement_ids: [req1.id],
      criterion_ids: createRequest.criterion_ids,
      reference_ids: [],
      cases: ['normal', 'empty', 'error'],
      keep_conditions: [],
      roles: ['planner', 'designer', 'publisher'],
      device: 'desktop',
      base_revision_id: rev1Id,
      comment_ids: commentIds,
      prompt_override: revisionPrompt.prompt,
    }
    const { job_id: job2Id } = await call('POST', `/api/screens/${listScreen.id}/generation-jobs`, editRequest)
    const job2 = await waitJob(call, job2Id, JOB_TIMEOUT_MS)
    const rev2Id = job2.result?.revision_id
    if (!rev2Id) throw new Error(`수정 작업에 결과 revision 이 없다: ${JSON.stringify(job2.failure ?? {})}`)
    if (rev2Id === rev1Id) throw new Error('수정 작업이 새 revision 을 만들지 않았다')
    console.log(`[demo] 수정 작업 성공 — revision 2 = ${rev2Id}`)

    // ---------- 5. AS-IS 분석 — 샘플 대상 2건 ----------
    // 정적 배포에서는 다른 사이트를 캡처할 수 없다. 그래서 여기서 **실제 분석기**로 합성 대상을 분석해
    // 구조·스크린샷을 기록해 두고, 브라우저는 그 구조에 페인포인트 규칙을 실제로 돌린다.
    const asisRuns = []
    for (const target of ASIS_SAMPLE_TARGETS) {
      const { analysis_id: id } = await call('POST', `/api/projects/${project.id}/asis-analyses`, { url: `${base}${target.path}`, note: target.note })
      const doc = await waitAsis(call, id, ASIS_TIMEOUT_MS)
      if (doc.status !== 'succeeded') throw new Error(`AS-IS 분석이 실패했다 (${target.path}): ${doc.failure?.code} ${doc.failure?.message}`)
      if (!doc.screenshots?.desktop || !doc.screenshots?.mobile) throw new Error(`AS-IS 분석에 스크린샷이 없다 (${target.path})`)
      asisRuns.push({ target, doc })
      console.log(`[demo] AS-IS 분석 성공 (${target.path}) — 페인포인트 ${doc.pain_points.length}건, 스크린샷 2장`)
    }
    const asis = asisRuns[0].doc
    const asisId = asis.id

    // ---------- 6. GET 스냅샷 (승인 직전 상태) ----------
    await get('/api/meta')
    await get('/api/projects')
    await get(`/api/projects/${project.id}`)
    await get(`/api/projects/${project.id}/references`)
    await get(`/api/projects/${project.id}/asis-analyses`)
    for (const s of detail.screens) await get(`/api/screens/${s.id}`)
    const revisionIds = [rev1Id, rev2Id]
    for (const id of revisionIds) await get(`/api/revisions/${id}`)
    for (const id of [job1Id, job2Id]) await get(`/api/jobs/${id}`)
    await get(`/api/asis-analyses/${asisId}`)

    // 산출물 HTML — 각 revision 의 artifact
    const artifactIds = revisionIds.map((id) => snapshot[`/api/revisions/${id}`].artifact.id)

    // ---------- 7. 승인 → 내보내기 ----------
    const approval = await call('POST', `/api/screens/${listScreen.id}/approvals`, { revision_id: rev2Id, approver: APPROVER })
    console.log(`[demo] 승인 v${approval.version} — 내보내기 ${approval.files.length}파일 (${approval.export_path})`)

    // ---------- 저장 ----------
    await rm(OUT_DIR, { recursive: true, force: true })
    await mkdir(join(OUT_DIR, 'artifacts'), { recursive: true })
    await mkdir(join(OUT_DIR, 'asis'), { recursive: true })
    await mkdir(join(OUT_DIR, 'exports'), { recursive: true })

    await writeFile(join(OUT_DIR, 'snapshot.json'), `${JSON.stringify(snapshot, null, 2)}\n`)
    await writeFile(
      join(OUT_DIR, 'approval.json'),
      `${JSON.stringify({ screen_id: listScreen.id, revision_id: rev2Id, approver: APPROVER, response: approval }, null, 2)}\n`,
    )

    for (const artifactId of artifactIds) {
      const html = await getBytes(`/api/artifacts/${artifactId}/html`)
      await writeFile(join(OUT_DIR, 'artifacts', `${artifactId}.html`), html)
    }
    for (const { doc } of asisRuns) {
      for (const assetId of [doc.screenshots.desktop, doc.screenshots.mobile]) {
        const png = await getBytes(`/api/asis-assets/${assetId}`)
        await writeFile(join(OUT_DIR, 'asis', `${assetId}.png`), png)
      }
    }

    // 샘플 대상 목록 — 브라우저가 이 구조에 페인포인트 규칙을 돌린다 (분석기가 이미 뽑은 값이므로 지어낸 값이 아니다).
    const asisSamples = asisRuns.map(({ target, doc }) => ({
      id: target.id,
      label: target.label,
      description: target.description,
      /** 화면이 보여줄 대상 URL. 이 브라우저에서 다시 접속하지는 않는다. */
      url: `https://sample.local${target.path}`,
      captured_at: doc.finished_at ?? doc.created_at,
      structure: doc.structure,
      screenshots: doc.screenshots,
    }))
    await writeFile(join(OUT_DIR, 'asis-samples.json'), `${JSON.stringify(asisSamples, null, 2)}\n`)
    // 내보내기 폴더 구조를 그대로 유지한다 (`demo/exports/<project>/<screen>/v1.0/...`).
    await cp(join(EXPORT_DIR, approval.export_path), join(OUT_DIR, 'exports', approval.export_path), { recursive: true })

    await report(OUT_DIR)
    console.log(`[demo] 스냅샷 저장 완료 → ${OUT_DIR}`)
  } finally {
    await stopServer(server)
    await rm(TMP_DIR, { recursive: true, force: true })
  }
}

async function waitJob(call, jobId, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const job = await call('GET', `/api/jobs/${jobId}`)
    if (job.status === 'succeeded') return job
    if (job.status === 'failed' || job.status === 'cancelled') {
      throw new Error(`작업 ${jobId} 가 ${job.status} 로 끝났다: ${job.failure?.code ?? ''} ${job.failure?.message ?? ''}`)
    }
    if (Date.now() > deadline) throw new Error(`작업 ${jobId} 가 ${timeoutMs}ms 안에 끝나지 않았다 (상태 ${job.status})`)
    await sleep(POLL_INTERVAL_MS)
  }
}

async function waitAsis(call, analysisId, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const doc = await call('GET', `/api/asis-analyses/${analysisId}`)
    if (doc.status === 'succeeded' || doc.status === 'failed') return doc
    if (Date.now() > deadline) throw new Error(`AS-IS 분석 ${analysisId} 가 ${timeoutMs}ms 안에 끝나지 않았다 (상태 ${doc.status})`)
    await sleep(POLL_INTERVAL_MS)
  }
}

/** 산출물 목록과 총 용량을 출력한다. */
async function report(dir) {
  const files = []
  const walk = async (d) => {
    for (const entry of await readdir(d, { withFileTypes: true })) {
      const p = join(d, entry.name)
      if (entry.isDirectory()) await walk(p)
      else files.push({ path: p.slice(OUT_DIR.length + 1), size: (await stat(p)).size })
    }
  }
  await walk(dir)
  files.sort((a, b) => a.path.localeCompare(b.path))
  const total = files.reduce((n, f) => n + f.size, 0)
  console.log(`\n[demo] 산출물 ${files.length}개 (apps/web/public/demo/)`)
  for (const f of files) console.log(`  ${f.path.padEnd(64)} ${humanBytes(f.size).padStart(10)}`)
  console.log(`  ${'합계'.padEnd(64)} ${humanBytes(total).padStart(10)}`)
}

main().catch((e) => {
  console.error(`\n[demo] 실패: ${e instanceof Error ? e.message : String(e)}`)
  if (e instanceof Error && e.stack) console.error(e.stack)
  process.exitCode = 1
})
