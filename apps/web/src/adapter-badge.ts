/** 상단 어댑터 배지 문구 (순수 함수). `/api/meta` 의 adapter·model·auth 로 만든다. auth 가 없으면(구버전 API) 생략. */
import type { AuthKind, Meta } from './types.js'

export const AUTH_LABELS: Readonly<Record<AuthKind, string>> = {
  api_key: 'API 키',
  token: '토큰',
  profile: '프로파일',
  none: '인증 없음',
}

export function adapterBadgeText(meta: Pick<Meta, 'adapter' | 'model' | 'auth'>): string {
  if (meta.adapter === 'fixture') return 'fixture 더미 어댑터(모델 호출 없음)'
  const parts = ['anthropic', meta.model]
  if (meta.auth !== undefined && Object.prototype.hasOwnProperty.call(AUTH_LABELS, meta.auth)) parts.push(AUTH_LABELS[meta.auth])
  return parts.join(' · ')
}

/** fixture 일 때 홈에 한 줄 보여줄 안내. anthropic 이면 null. */
export function realModelHint(meta: Pick<Meta, 'adapter'> | null): string | null {
  if (!meta || meta.adapter !== 'fixture') return null
  return '지금은 fixture 더미 어댑터입니다. 실제 모델을 쓰려면 .env 에 MODEL_ADAPTER=anthropic 과 ANTHROPIC_API_KEY 또는 ANTHROPIC_AUTH_TOKEN 을 설정하고 API 를 재시작하세요.'
}
