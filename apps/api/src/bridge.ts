/**
 * 로컬 브리지 계획 — 「각자 자기 Claude 계정으로, API 키 없이」를 **웹 화면에서** 쓰게 만드는 실행 모드.
 *
 * 무엇이 브리지인가: 브라우저는 프로세스를 띄울 수 없으므로 모델 호출을 대신할 로컬 종단이 필요하다.
 * 그 종단은 **이미 있다** — `apps/api` 서버다. 브리지 모드는 그 서버를
 *   ① `MODEL_ADAPTER=claude_code` (그 기계의 Claude Code 로 호출)
 *   ② `HOST=127.0.0.1` (루프백만 — 같은 망의 다른 기기가 내 Claude 계정을 쓰지 못한다)
 *   ③ 웹 빌드를 **같은 출처로** 함께 서빙 (`WEB_DIST`)
 * 로 띄우는 것이다.
 *
 * 왜 같은 출처인가 (설계 결정):
 * - Chrome 142+ 는 공개 HTTPS 출처가 루프백을 부를 때 **Local Network Access 권한 프롬프트**를 띄우고
 *   거부를 끈질기게 기억한다. Safari 는 https 페이지에서 `http://localhost` 를 막는다.
 * - 그래서 GitHub Pages 주소에서 로컬 브리지로 붙는 길은 **브라우저가 허용해야만** 열린다 —
 *   코드로 복구할 수 없는 길을 「항상 되는 길」로 둘 수 없다.
 * - 같은 출처로 서빙하면 LNA·CORS·혼합 콘텐츠가 **전부 사라진다.** 그래서 이것이 기본값이다.
 *
 * 이 모듈은 **결정만** 한다 (순수 함수). 실제 실행은 `bridge-cli.ts` 가 한다.
 */

export interface BridgePlanInput {
  env: NodeJS.ProcessEnv
  /** `pnpm bridge -- --port 9000 --no-build` 같은 인자. */
  argv: readonly string[]
  /** `claude` 실행 파일을 찾았는가 (bridge-cli 가 resolveClaudeBin 으로 판정해 넘긴다). */
  claude_found: boolean
  /** 웹 빌드(index.html)가 있는가. */
  web_built: boolean
}

export interface BridgePlan {
  /** 띄울 수 있는가. false 면 `messages` 를 그대로 보여주고 끝낸다. */
  ok: boolean
  host: string
  port: number
  /** 웹 빌드를 먼저 할 것인가 (`--no-build` 면 false). */
  build_web: boolean
  /** 서버에 넘길 환경변수 덮어쓰기. */
  env_overrides: Record<string, string>
  /** 사람에게 그대로 보여줄 줄. 마지막 줄이 접속 주소다 (ok 일 때). */
  messages: string[]
  /** 접속 주소 (ok 일 때만). */
  url?: string
}

export const BRIDGE_DEFAULT_PORT = 8787

const INSTALL_HINT = 'Claude Code 설치: https://code.claude.com/docs/en/setup'

function parsePort(value: string | undefined, fallback: number): number {
  const n = Number.parseInt(value ?? '', 10)
  return Number.isFinite(n) && n > 0 && n < 65536 ? n : fallback
}

/**
 * 브리지 실행 계획을 세운다.
 *
 * - `claude` 가 없으면 **띄우지 않는다.** 이 모드의 전부가 그 CLI 로 호출하는 것이므로,
 *   더미로 바꿔 띄우면 사용자는 자기 계정으로 돌고 있다고 **오해한다** (CLAUDE.md: 더미와 실제를 구분한다).
 * - `MODEL_ADAPTER` 를 셸에 이미 다르게 넣어 두었어도 브리지 모드에서는 `claude_code` 로 **고정**한다 —
 *   `pnpm bridge` 라고 쳤는데 다른 어댑터로 도는 일은 없어야 한다. 대신 그 사실을 적는다.
 * - `HOST` 는 루프백으로 고정한다. 팀에 열어야 하면 `pnpm serve` 를 쓰라고 안내한다(그쪽은 경고를 띄운다).
 */
export function planBridge(input: BridgePlanInput): BridgePlan {
  const args = [...input.argv]
  const flag = (name: string): boolean => args.includes(`--${name}`)
  const value = (name: string): string | undefined => {
    const i = args.indexOf(`--${name}`)
    return i >= 0 ? args[i + 1] : undefined
  }

  const port = parsePort(value('port') ?? input.env['PORT'], BRIDGE_DEFAULT_PORT)
  const host = '127.0.0.1'
  const build_web = !flag('no-build')
  const messages: string[] = []

  if (!input.claude_found) {
    return {
      ok: false,
      host,
      port,
      build_web,
      env_overrides: {},
      messages: [
        '[con-ai] 로컬 브리지를 띄우지 못했습니다 — `claude` 실행 파일을 찾지 못했습니다.',
        `         ${INSTALL_HINT}`,
        '         설치한 뒤 터미널에서 `claude` 를 한 번 실행해 로그인하세요 (Pro·Max·Team·Enterprise 구독).',
        '         설치 경로가 특이하면 CLAUDE_BIN 에 실행 파일 경로를 넣으세요.',
        '         (더미 어댑터로 바꿔 띄우지 않습니다 — 내 계정으로 도는 것으로 오해하게 두지 않기 위해서입니다.)',
      ],
    }
  }

  const requested = input.env['MODEL_ADAPTER']?.trim()
  if (requested !== undefined && requested.length > 0 && requested !== 'claude_code') {
    messages.push(`[con-ai] MODEL_ADAPTER=${requested} 가 설정돼 있지만 브리지 모드는 claude_code 로 고정합니다.`)
  }
  if (!build_web && !input.web_built) {
    messages.push('[con-ai] 경고: --no-build 인데 웹 빌드가 없습니다 — API 만 제공합니다 (`pnpm build:web` 후 다시 실행하세요).')
  }

  const url = `http://${host}:${port}/`
  messages.push(
    '[con-ai] 로컬 브리지 — 이 기계에 로그인된 Claude Code 로 호출합니다 (API 키·토큰을 넣지 않습니다).',
    '[con-ai] 루프백(127.0.0.1)에만 열립니다. 같은 망의 다른 기기는 내 Claude 계정을 쓸 수 없습니다.',
    '[con-ai] 팀에 열어야 하면 `pnpm serve` 를 쓰세요 (그쪽은 「접속하는 누구나 내 계정으로 호출한다」는 경고를 띄웁니다).',
    `[con-ai] 접속: ${url}`,
  )

  return {
    ok: true,
    host,
    port,
    build_web,
    // HOST·PORT·MODEL_ADAPTER 를 **덮어쓴다**. 나머지(.env 의 DB 경로·내보내기 폴더 등)는 그대로 쓴다.
    env_overrides: { MODEL_ADAPTER: 'claude_code', HOST: host, PORT: String(port) },
    messages,
    url,
  }
}
