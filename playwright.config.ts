import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from '@playwright/test'

/**
 * e2e: 세로 조각 전체 흐름(생성 → 검토·코멘트 → 수정 → 완료 v1.0 → 내보내기)을 실제 브라우저로 확인한다.
 * API(8787)와 웹(5173)을 webServer 로 띄운다. 어댑터는 fixture(더미) — 모델 호출 없이 결정적으로 동작한다.
 * 이 실행 환경처럼 Playwright 기본 브라우저가 없으면 PLAYWRIGHT_CHROMIUM_PATH 의 실행 파일을 쓴다.
 */
const chromiumPath = process.env['PLAYWRIGHT_CHROMIUM_PATH'] ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined)
// API 는 CON_AI_DB·EXPORT_DIR 상대 경로를 자기 cwd(apps/api) 기준으로 풀므로, 초기화(rm)와 서버가 같은 파일을 보도록 절대 경로로 넘긴다.
const ROOT = dirname(fileURLToPath(import.meta.url))
const e2eDb = resolve(ROOT, '.local', 'e2e.db')
const e2eExports = resolve(ROOT, '.local', 'e2e-exports')
const serverEnv = {
  ...process.env,
  MODEL_ADAPTER: 'fixture',
  PORT: '8787',
  CON_AI_DB: e2eDb,
  EXPORT_DIR: e2eExports,
  ...(chromiumPath ? { PLAYWRIGHT_CHROMIUM_PATH: chromiumPath } : {}),
}

export default defineConfig({
  testDir: 'e2e',
  // *.spec.ts 만 검사한다. *.capture.ts(화면 캡처 유틸리티)는 CAPTURE=1 일 때만 포함한다.
  testMatch: process.env['CAPTURE'] ? /\.(spec|capture)\.ts$/ : /\.spec\.ts$/,
  // demo-*.spec.ts 는 정적 배포(API 없음)를 대상으로 하므로 여기서 돌리지 않는다 → `pnpm e2e:demo`.
  testIgnore: /demo-.*\.spec\.ts$/,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    ...(chromiumPath ? { launchOptions: { executablePath: chromiumPath } } : {}),
  },
  webServer: [
    {
      command: `rm -f ${e2eDb} ${e2eDb}-wal ${e2eDb}-shm && rm -rf ${e2eExports} && pnpm --filter @con-ai/api start`,
      url: 'http://localhost:8787/api/meta',
      reuseExistingServer: false,
      timeout: 60_000,
      env: serverEnv,
    },
    {
      command: 'pnpm --filter @con-ai/web dev',
      url: 'http://localhost:5173',
      reuseExistingServer: false,
      timeout: 60_000,
      env: serverEnv,
    },
  ],
})
