/**
 * 어댑터 오류 — SDK 오류·거부·파싱 실패를 한국어 메시지와 분류 코드로 감싼다. 원인(cause)은 유지한다.
 * 메시지·details 에는 키·토큰 값을 넣지 않는다 (CLAUDE.md: 모델 키는 로그·응답에 넣지 않는다).
 */
export type AdapterErrorCode =
  | 'auth' // 인증 실패 (401) 또는 인증 수단 미해결
  | 'rate_limit' // 요청 한도 (429)
  | 'bad_request' // 요청 형식·파라미터 오류 (400)
  | 'api_error' // 그 밖의 API·연결 오류
  | 'refusal' // stop_reason === 'refusal'
  | 'empty_output' // parsed_output 이 null (텍스트 블록 없음 등)
  | 'parse' // 구조화 출력이 wire 스키마에 맞지 않음 (SDK 가 던진 파싱 오류)
  // 아래 5개는 Claude Code CLI 경로(claude-code-cli.ts) 전용이다. 「CLI 가 없다」와 「로그인하지 않았다」를
  // 섞지 않는다 — 사용자가 할 일이 다르다(설치 vs `claude` 로그인).
  | 'cli_missing' // `claude` 실행 파일을 찾지 못함
  | 'not_logged_in' // CLI 는 있는데 그 기계에 로그인되어 있지 않음
  | 'timeout' // 제한 시간 초과로 중단
  | 'budget' // 한 호출의 정가 환산 상한(--max-budget-usd) 초과
  | 'cancelled' // 사용자가 취소
  | 'cli_error' // 그 밖의 CLI 실패 (종료 코드·실행 오류)
  | 'unknown'

export class AdapterError extends Error {
  readonly code: AdapterErrorCode
  readonly details: Record<string, unknown>
  constructor(code: AdapterErrorCode, message: string, opts: { cause?: unknown; details?: Record<string, unknown> } = {}) {
    super(message, opts.cause === undefined ? undefined : { cause: opts.cause })
    this.name = 'AdapterError'
    this.code = code
    this.details = opts.details ?? {}
  }
}
