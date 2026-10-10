/**
 * 로컬 브리지 계획 — 「내 Claude 계정으로, API 키 없이, 웹 화면에서」의 실행 모드 규칙.
 *
 * 여기서 못 박는 것:
 * - `claude` 가 없으면 **더미로 바꿔 띄우지 않는다.** 그러면 사용자는 자기 계정으로 돌고 있다고 오해한다.
 * - 셸에 다른 어댑터가 있어도 브리지 모드는 claude_code 로 **고정**하고 그 사실을 적는다.
 * - 루프백에만 연다 — 같은 망의 다른 기기가 내 Claude 사용량을 태우지 못하게.
 */
import { describe, expect, it } from 'vitest'
import { BRIDGE_DEFAULT_PORT, planBridge } from './bridge.js'

const base = { env: {} as NodeJS.ProcessEnv, argv: [] as string[], claude_found: true, web_built: true }

describe('planBridge', () => {
  it('기본값: claude_code · 127.0.0.1 · 8787 · 웹 빌드 포함', () => {
    const p = planBridge(base)
    expect(p.ok).toBe(true)
    expect(p.host).toBe('127.0.0.1')
    expect(p.port).toBe(BRIDGE_DEFAULT_PORT)
    expect(p.build_web).toBe(true)
    expect(p.env_overrides).toEqual({ MODEL_ADAPTER: 'claude_code', HOST: '127.0.0.1', PORT: '8787' })
    expect(p.url).toBe('http://127.0.0.1:8787/')
    expect(p.messages.join('\n')).toContain('API 키·토큰을 넣지 않습니다')
  })

  it('claude 가 없으면 띄우지 않고 설치·로그인 방법을 적는다 (더미로 바꾸지 않는다)', () => {
    const p = planBridge({ ...base, claude_found: false })
    expect(p.ok).toBe(false)
    const text = p.messages.join('\n')
    expect(text).toContain('`claude` 실행 파일을 찾지 못했습니다')
    expect(text).toContain('code.claude.com/docs/en/setup')
    expect(text).toContain('CLAUDE_BIN')
    // 「더미로 바꿔 띄웠다」는 선택지를 남기지 않는다
    expect(text).toContain('더미 어댑터로 바꿔 띄우지 않습니다')
    expect(p.env_overrides).toEqual({})
  })

  it('셸의 다른 MODEL_ADAPTER 를 고정하고 그 사실을 알린다', () => {
    const p = planBridge({ ...base, env: { MODEL_ADAPTER: 'fixture' } as NodeJS.ProcessEnv })
    expect(p.env_overrides['MODEL_ADAPTER']).toBe('claude_code')
    expect(p.messages.join('\n')).toContain('MODEL_ADAPTER=fixture 가 설정돼 있지만')
  })

  it('claude_code 가 이미 설정돼 있으면 군말을 적지 않는다', () => {
    const p = planBridge({ ...base, env: { MODEL_ADAPTER: 'claude_code' } as NodeJS.ProcessEnv })
    expect(p.messages.join('\n')).not.toContain('고정합니다')
  })

  it('--port 가 PORT 환경변수보다 우선하고, 잘못된 값은 기본값으로 떨어진다', () => {
    expect(planBridge({ ...base, argv: ['--port', '9000'], env: { PORT: '7000' } as NodeJS.ProcessEnv }).port).toBe(9000)
    expect(planBridge({ ...base, env: { PORT: '7000' } as NodeJS.ProcessEnv }).port).toBe(7000)
    expect(planBridge({ ...base, argv: ['--port', '0'] }).port).toBe(BRIDGE_DEFAULT_PORT)
    expect(planBridge({ ...base, argv: ['--port', '99999'] }).port).toBe(BRIDGE_DEFAULT_PORT)
    expect(planBridge({ ...base, argv: ['--port', '아무말'] }).port).toBe(BRIDGE_DEFAULT_PORT)
  })

  it('--no-build 로 빌드를 건너뛸 수 있고, 빌드가 없으면 경고한다 (조용히 API 만 띄우지 않는다)', () => {
    const skip = planBridge({ ...base, argv: ['--no-build'] })
    expect(skip.build_web).toBe(false)
    // 「경고」라는 낱말은 안내문(pnpm serve 설명)에도 들어 있다 — 그 낱말이 아니라 **이 경고**가 없는지 본다.
    expect(skip.messages.join('\n')).not.toContain('웹 빌드가 없습니다')

    const missing = planBridge({ ...base, argv: ['--no-build'], web_built: false })
    expect(missing.messages.join('\n')).toContain('웹 빌드가 없습니다')
    expect(missing.ok).toBe(true) // API 만으로도 쓸 수는 있다 — 다만 그 사실을 적는다
  })

  it('HOST 를 셸에서 바꿔도 루프백을 유지한다 (같은 망의 다른 기기에 내 계정을 열지 않는다)', () => {
    const p = planBridge({ ...base, env: { HOST: '0.0.0.0' } as NodeJS.ProcessEnv })
    expect(p.host).toBe('127.0.0.1')
    expect(p.env_overrides['HOST']).toBe('127.0.0.1')
    expect(p.messages.join('\n')).toContain('pnpm serve')
  })
})
