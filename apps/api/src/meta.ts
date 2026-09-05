/** GET /api/meta — 어댑터 종류·모델·버전·Playwright 사용 가능 여부. 키·토큰 값은 절대 넣지 않는다. */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ModelAdapter } from '@con-ai/model-adapter'

export type AdapterAuth = 'api_key' | 'token' | 'profile' | 'none'

export interface MetaResponse {
  adapter: ModelAdapter['kind']
  model: string
  /** 인증 방식 (값이 아니라 종류만). 어댑터가 auth 를 아직 주지 않으면 'none'. */
  auth: AdapterAuth
  version: string
  playwright: boolean
}

const AUTH_VALUES = new Set<string>(['api_key', 'token', 'profile', 'none'])

/** 어댑터의 auth 표기를 읽는다. model-adapter 가 `readonly auth` 를 추가하기 전이면 'none'. */
export function adapterAuthOf(adapter: ModelAdapter): AdapterAuth {
  const raw = (adapter as { auth?: unknown }).auth
  return typeof raw === 'string' && AUTH_VALUES.has(raw) ? (raw as AdapterAuth) : 'none'
}

/** apps/api/package.json 의 version. */
export function apiVersion(): string {
  try {
    const pkgPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version?: unknown }
    return typeof pkg.version === 'string' ? pkg.version : '0.0.0'
  } catch {
    return '0.0.0'
  }
}

/**
 * Playwright 브라우저 실행 파일이 있는지 (V3 실행 검사를 돌릴 수 있는지).
 * PLAYWRIGHT_CHROMIUM_PATH 가 가리키는 파일, 또는 PLAYWRIGHT_BROWSERS_PATH / <HOME>/.cache/ms-playwright 아래 chromium* 디렉터리를 찾는다.
 * 여기서는 존재만 확인하며 실행하지 않는다 — 실제 실행 가능 여부는 V3 결과(status error)로 드러난다.
 */
export function detectPlaywright(env: NodeJS.ProcessEnv): boolean {
  const explicit = env.PLAYWRIGHT_CHROMIUM_PATH?.trim()
  if (explicit && existsSync(explicit)) return true
  // 홈 디렉터리도 주입된 env 를 따른다(테스트가 환경을 온전히 통제할 수 있어야 한다).
  const home = env.HOME?.trim() || env.USERPROFILE?.trim() || homedir()
  const roots = [env.PLAYWRIGHT_BROWSERS_PATH?.trim(), join(home, '.cache', 'ms-playwright')].filter((p): p is string => !!p)
  for (const root of roots) {
    try {
      if (readdirSync(root).some((name) => name.startsWith('chromium'))) return true
    } catch {
      // 디렉터리가 없으면 다음 후보
    }
  }
  return false
}

export function buildMeta(adapter: ModelAdapter, env: NodeJS.ProcessEnv): MetaResponse {
  return { adapter: adapter.kind, model: adapter.model, auth: adapterAuthOf(adapter), version: apiVersion(), playwright: detectPlaywright(env) }
}
