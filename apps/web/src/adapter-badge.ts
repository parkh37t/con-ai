/** 상단 어댑터 배지·자격 증명 칩 문구 (순수 함수). `/api/meta` 의 adapter·model·auth 로 만든다. auth 가 없으면(구버전 API) 생략. */
// 종류 라벨은 보관 모듈에 한 벌만 둔다 (여기서 또 적으면 두 곳이 어긋난다).
export { CREDENTIAL_KIND_LABELS } from './browser-run/credential.js'
import { CREDENTIAL_KIND_LABELS as KIND_LABELS, type CredentialInfo } from './browser-run/credential.js'
import type { AuthKind, Meta } from './types.js'

/**
 * 자격 증명 칩 문구.
 *
 * 없을 때 「스냅샷 데모」라고 적던 때가 있었는데 **사실이 아니었다** — 자격 증명이 없어도
 * 더미 어댑터(fixture)가 명세를 쓰고 나머지 단계는 실제로 돈다. 그래서 무엇이 쓰는지를 적는다.
 */
export function credentialChipLabel(info: CredentialInfo | null): string {
  return info === null ? '자격 증명 없음 — 더미 어댑터' : `내 ${KIND_LABELS[info.kind]} ····${info.last4}`
}

export const AUTH_LABELS: Readonly<Record<AuthKind, string>> = {
  api_key: 'API 키',
  token: '토큰',
  profile: '프로파일',
  none: '인증 없음',
}

export function adapterBadgeText(meta: Pick<Meta, 'adapter' | 'model' | 'auth'>, opts: { browser?: boolean } = {}): string {
  if (meta.adapter === 'fixture') return 'fixture 더미 어댑터(모델 호출 없음)'
  // 브라우저 모드: 서버가 아니라 이 브라우저가 사용자의 토큰으로 직접 호출한다.
  const parts = [opts.browser === true ? '내 토큰으로 실제 호출' : 'anthropic', meta.model]
  if (meta.auth !== undefined && Object.prototype.hasOwnProperty.call(AUTH_LABELS, meta.auth)) parts.push(AUTH_LABELS[meta.auth])
  return parts.join(' · ')
}

/**
 * fixture 일 때 홈에 한 줄 보여줄 안내. anthropic 이면 null.
 * 정적 배포(브라우저 모드)에는 서버 .env 가 없으므로 자격 증명 패널을 안내한다.
 */
export function realModelHint(meta: Pick<Meta, 'adapter'> | null, opts: { demo?: boolean } = {}): string | null {
  if (!meta || meta.adapter !== 'fixture') return null
  if (opts.demo === true) {
    // 화면은 실제로 돈다 — 더미인 것은 «명세를 쓰는 모델» 뿐이다. 그 하나만 정확히 적는다.
    // 칩 위치는 셸마다 다르므로(작업대는 좌측 레일 아래, 진입 화면은 상단 바) 위치를 못박지 않는다.
    return '지금은 더미 어댑터(fixture)입니다 — 모델을 호출하지 않고 규칙으로 명세를 만듭니다. 문맥 조립·스키마 검사·목업 렌더·V1·V2·V3 검사는 실제로 실행됩니다. 자격 증명 칩에 내 Claude 토큰(「claude setup-token」 으로 발급)을 넣으면 명세도 모델이 직접 씁니다.'
  }
  return '지금은 fixture 더미 어댑터입니다. 실제 모델을 쓰려면 .env 에 MODEL_ADAPTER=anthropic · MODEL_AUTH=token · ANTHROPIC_AUTH_TOKEN(발급 「claude setup-token」)을 설정하고 API 를 재시작하세요. API 키를 쓰려면 MODEL_AUTH=api_key 와 ANTHROPIC_API_KEY 입니다.'
}
