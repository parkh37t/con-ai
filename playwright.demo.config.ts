import { existsSync } from 'node:fs'
import { defineConfig } from '@playwright/test'

/**
 * 정적 데모(배포 주소) e2e — `pnpm demo:build` 결과를 GitHub Pages 와 같은 하위 경로로 띄워 확인한다.
 * **API 서버를 띄우지 않는다.** 서버가 있으면 「브라우저 안에서 동작했는지」를 구분할 수 없다.
 * 실행: `pnpm e2e:demo`
 */
const chromiumPath = process.env['PLAYWRIGHT_CHROMIUM_PATH'] ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined)

export default defineConfig({
  testDir: 'e2e',
  testMatch: /demo-.*\.spec\.ts$/,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4321/con-ai/',
    trace: 'retain-on-failure',
    ...(chromiumPath ? { launchOptions: { executablePath: chromiumPath } } : {}),
  },
  webServer: [
    {
      command: 'pnpm demo:build && node scripts/serve-demo.mjs',
      url: 'http://127.0.0.1:4321/con-ai/demo/snapshot.json',
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
})
