/**
 * API 서버 진입점. `.env` 파일은 읽지 않고 process.env 만 본다 (`set -a; source .env` 또는 scripts/setup.sh 참고).
 * `.env` 가 없어도 기본값(fixture 어댑터, .local/con-ai.db, exports/, 0.0.0.0:8787)으로 동작한다.
 *
 * 운영 모드(한 포트로 UI+API): `WEB_DIST`(기본 `apps/web/dist`)에 웹 빌드가 있으면 함께 제공한다(runtime.ts).
 * 빌드가 없으면 API 만 제공하고 안내를 남긴다 — 오류로 죽지 않는다. `pnpm serve` 가 빌드 후 이 서버를 띄운다.
 */
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { serve } from '@hono/node-server'
import { createAdapter } from '@con-ai/model-adapter'
import { S2B_LEARNED_PROFILE, renderScreen } from '@con-ai/renderer'
import { REQUIRED_CHECKS, runAll } from '@con-ai/validators'
import { createApp } from './app.js'
import { adapterAuthOf, detectPlaywright } from './meta.js'
import { buildStartupLines, resolveWebDist, type WebDistResolution } from './runtime.js'
import { seedIfEmpty } from './seed.js'
import { openStore, resolveDbPath } from './store.js'

/** 저장소 루트 (apps/api/src → ../../..). 기본 DB·내보내기 경로를 cwd 와 무관하게 여기 기준으로 잡는다. */
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

export interface ServerConfig {
  port: number
  /** 바인드 주소. 컨테이너 밖에서 접속하려면 0.0.0.0 이어야 한다 (HOST 로 바꿀 수 있다). */
  host: string
  db_path: string
  export_dir: string
  /** 웹 빌드 위치와 사용 가능 여부 (운영 모드). */
  web: WebDistResolution
}

export function readConfig(env: NodeJS.ProcessEnv): ServerConfig {
  const port = Number.parseInt(env.PORT ?? '', 10)
  const host = env.HOST?.trim()
  const exportDir = env.EXPORT_DIR?.trim()
  return {
    port: Number.isFinite(port) && port > 0 ? port : 8787,
    host: host && host.length > 0 ? host : '0.0.0.0',
    db_path: resolveDbPath(env, resolve(REPO_ROOT, '.local', 'con-ai.db')),
    export_dir: exportDir && exportDir.length > 0 ? resolve(exportDir) : resolve(REPO_ROOT, 'exports'),
    web: resolveWebDist(env, resolve(REPO_ROOT, 'apps', 'web', 'dist')),
  }
}

function main(): void {
  const env = process.env
  const config = readConfig(env)
  const store = openStore(config.db_path)
  const seed = seedIfEmpty(store)
  const adapter = createAdapter(env)

  const { app, recovered_job_ids, recovered_asis_ids } = createApp({
    store,
    adapter,
    export_dir: config.export_dir,
    web_dist: config.web.available ? config.web.dir : undefined,
    env,
    render: renderScreen,
    validate: ({ spec, html, required_cases, artifact_hash }) => runAll({ spec, html, profile: S2B_LEARNED_PROFILE, required_cases, artifact_hash }),
    required_check_ids: REQUIRED_CHECKS,
    profile: S2B_LEARNED_PROFILE,
  })

  serve({ fetch: app.fetch, port: config.port, hostname: config.host }, (info) => {
    // 키·토큰 값은 절대 출력하지 않는다 — 어댑터 종류·모델·인증 방식(종류)만.
    console.log(`[con-ai api] DB ${config.db_path}  exports ${config.export_dir}`)
    console.log(`[con-ai api] 어댑터 ${adapter.kind}(${adapter.model}) 인증 ${adapterAuthOf(adapter)}  Playwright ${detectPlaywright(env) ? '있음' : '없음'}`)
    if (adapter.kind === 'fixture') {
      console.log('[con-ai api] 어댑터 fixture(더미) — 실제 모델은 .env 의 MODEL_ADAPTER=anthropic 과 ANTHROPIC_API_KEY 또는 ANTHROPIC_AUTH_TOKEN 설정')
    }
    if (seed.seeded) console.log(`[con-ai api] 샘플 프로젝트를 시드했다 (project ${seed.project_id})`)
    if (recovered_job_ids.length > 0) console.log(`[con-ai api] 서버 재시작으로 중단된 작업 ${recovered_job_ids.length}건을 failed 로 정리했다`)
    if (recovered_asis_ids.length > 0) console.log(`[con-ai api] 서버 재시작으로 중단된 AS-IS 분석 ${recovered_asis_ids.length}건을 failed 로 정리했다`)
    // 접속 주소 → 웹 빌드 상태 → 인증 경고 (실제로 열린 포트 info.port 를 쓴다).
    for (const line of buildStartupLines({ host: config.host, port: info.port, adapter: adapter.kind, web: config.web })) console.log(line)
  })
}

main()
