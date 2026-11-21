/**
 * 실측 검증: `MODEL_ADAPTER=claude_code` 로 **화면명세를 실제로 생성**한다 (`pnpm probe:claude-code`).
 *
 * 이 기계에 로그인된 Claude Code 가 호출하므로 **API 키를 쓰지 않는다.** 모델을 1회 부른다 (사용량 발생).
 * `pnpm check` 에 넣지 않는다 — 비결정적이고 사용량을 쓴다. 검사는 사람이 따로 돌린다.
 *
 * 판정 (CLAUDE.md: pass / fail / error / not_run 을 구분한다)
 *  - not_run : `claude` 가 없거나 로그인되지 않았다 → 어댑터가 cli_missing·not_logged_in 으로 끝낸다
 *  - fail    : 작업이 failed 로 끝났다 (failure 를 그대로 적는다)
 *  - pass    : succeeded + 저장된 revision 의 섹션·검증 집계를 적는다
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createAdapter } from '../packages/model-adapter/src/index.js'
import { S2B_LEARNED_PROFILE, renderScreen } from '../packages/renderer/src/index.js'
import { REQUIRED_CHECKS, runAll } from '../packages/validators/src/index.js'
import { createApp } from '../apps/api/src/app.js'
import { SEED, seedIfEmpty } from '../apps/api/src/seed.js'
import { SqliteStore } from '../apps/api/src/store.js'

const exportDir = mkdtempSync(join(tmpdir(), 'con-ai-probe-'))
const store = new SqliteStore(':memory:')
seedIfEmpty(store)
const adapter = createAdapter({ ...process.env, MODEL_ADAPTER: 'claude_code' } as NodeJS.ProcessEnv)
console.log('adapter:', adapter.kind, adapter.model, adapter.auth)

const { app } = createApp({
  store,
  adapter,
  export_dir: exportDir,
  env: { ...process.env, PLAYWRIGHT_CHROMIUM_PATH: process.env['PLAYWRIGHT_CHROMIUM_PATH'] ?? '/opt/pw-browsers/chromium' },
  render: renderScreen,
  validate: ({ spec, html, required_cases, artifact_hash }) => runAll({ spec, html, profile: S2B_LEARNED_PROFILE, required_cases, artifact_hash }),
  required_check_ids: REQUIRED_CHECKS,
  log: () => {},
})

const body = {
  task_type: 'create',
  purpose: '견적 목록 화면 신규 생성 (claude_code 경로 실측)',
  requirement_ids: [SEED.requirements['REQ-QT-001'], SEED.requirements['REQ-QT-004']],
  criterion_ids: [],
  reference_ids: [SEED.references['REF-quote-list']],
  cases: ['normal', 'empty', 'error'],
  keep_conditions: [],
  roles: ['partner'],
  device: 'desktop',
}
const screenId = SEED.screens['SAMPLE-quote-list']
const started = await app.request(`/api/screens/${screenId}/generation-jobs`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})
console.log('job start status', started.status)
const { job_id } = (await started.json()) as { job_id: string }

const t0 = Date.now()
for (;;) {
  const job = (await (await app.request(`/api/jobs/${job_id}`)).json()) as { status: string; stage?: string; failure?: unknown; result?: { revision_id: string } }
  if (job.status === 'succeeded' || job.status === 'failed') {
    console.log('JOB', job.status, 'stage', job.stage, 'in', Math.round((Date.now() - t0) / 1000), 's')
    if (job.failure) console.log('failure', JSON.stringify(job.failure, null, 2).slice(0, 1200))
    if (job.result) {
      const rev = (await (await app.request(`/api/revisions/${job.result.revision_id}`)).json()) as {
        spec: { sections: Array<{ id: string; title: string; elements: Array<{ label: string }> }> }
        validation_results: Array<{ check_id: string; status: string }>
        artifact: { status: string }
      }
      console.log('섹션', rev.spec.sections.map((s) => `${s.id}(${s.elements.length})`).join(', '))
      const sum = rev.validation_results.reduce<Record<string, number>>((a, r) => ({ ...a, [r.status]: (a[r.status] ?? 0) + 1 }), {})
      console.log('검증', JSON.stringify(sum), 'artifact', rev.artifact.status)
    }
    break
  }
  await new Promise((r) => setTimeout(r, 1500))
  if (Date.now() - t0 > 420_000) {
    console.log('TIMEOUT waiting for job')
    break
  }
}
store.close()
rmSync(exportDir, { recursive: true, force: true })
