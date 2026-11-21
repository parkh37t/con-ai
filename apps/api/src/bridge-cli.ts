/**
 * `pnpm bridge` — 로컬 브리지 실행기.
 *
 * 하는 일: `claude` 확인 → (필요하면) 웹 빌드 → `MODEL_ADAPTER=claude_code` · `HOST=127.0.0.1` 로 API 서버 실행.
 * 결정 규칙은 `bridge.ts`(순수 함수)에 있고 테스트가 그것을 확인한다. 여기서는 **실행만** 한다.
 *
 * 사용: `pnpm bridge` · `pnpm bridge -- --port 9000` · `pnpm bridge -- --no-build`
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { resolveClaudeBin } from '@con-ai/model-adapter'
import { planBridge } from './bridge.js'
import { REPO_ROOT } from './server.js'

const webIndex = resolve(REPO_ROOT, 'apps', 'web', 'dist', 'index.html')
const plan = planBridge({
  env: process.env,
  argv: process.argv.slice(2),
  claude_found: resolveClaudeBin({ env: process.env }) !== null,
  web_built: existsSync(webIndex),
})

for (const line of plan.messages) console.log(line)
if (!plan.ok) process.exit(1)

const run = (command: string, args: readonly string[], env: NodeJS.ProcessEnv): number => {
  const result = spawnSync(command, [...args], { cwd: REPO_ROOT, env, stdio: 'inherit', shell: process.platform === 'win32' })
  if (result.error !== undefined) {
    console.error(`[con-ai] 실행 실패: ${command} ${args.join(' ')} — ${result.error.message}`)
    return 1
  }
  return result.status ?? 1
}

const env = { ...process.env, ...plan.env_overrides }

if (plan.build_web) {
  console.log('[con-ai] 웹 빌드 (pnpm build:web)')
  const code = run('pnpm', ['build:web'], env)
  if (code !== 0) process.exit(code)
}

// 서버는 `.env` 를 스스로 읽는다. 덮어쓴 세 값은 셸 환경이므로 `.env` 보다 우선한다 (Node --env-file 규칙).
process.exit(run('pnpm', ['start'], env))
