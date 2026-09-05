/** 상단 어댑터 배지 문구 (순수 함수). `/api/meta` 의 adapter·model·auth 로 만든다. auth 가 없으면(구버전 API) 생략. */
import type { AuthKind, Meta } from './types.js'

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
    return '지금은 스냅샷 데모입니다(모델 호출 없음). 위 자격 증명 패널에 Claude API 키나 토큰을 넣으면 이 브라우저가 직접 모델을 호출해 실제로 생성합니다.'
  }
  return '지금은 fixture 더미 어댑터입니다. 실제 모델을 쓰려면 .env 에 MODEL_ADAPTER=anthropic 과 ANTHROPIC_API_KEY 또는 ANTHROPIC_AUTH_TOKEN 을 설정하고 API 를 재시작하세요.'
}
