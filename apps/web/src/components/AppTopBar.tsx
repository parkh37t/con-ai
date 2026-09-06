/**
 * 얇은 상단 바 — 진입 화면(메인 · 만들기 · 설계서 결과) 전용.
 *
 * 설계 산출물 screens-v1 의 「얇은 상단 바」: 60px 한 줄, 본문과 같은 1180px 폭,
 * 왼쪽에 제품명 하나, 오른쪽에 상태 칩과 「프로젝트 홈 →」. 메뉴는 두지 않는다 —
 * 진입 화면에서 갈 곳은 본문의 큰 버튼이 안내하고, 작업대에서는 좌측 레일이 맡는다.
 */
import type { ReactNode } from 'react'
import { adapterBadgeText } from '../adapter-badge.js'
import { IS_DEMO } from '../demo-mode.js'
import { hrefTo } from '../router.js'
import type { Meta } from '../types.js'

export function AppTopBar({ meta, metaError, credentialChip }: { meta: Meta | null; metaError: unknown; credentialChip?: ReactNode }) {
  return (
    <div className="apptop">
      <header className="apptop-inner">
        <a className="brand" href={hrefTo('main')}>
          <span className="brand-mark" aria-hidden="true" />
          AI 기획 에이전트
        </a>
        <span className="apptop-right">
          {meta ? (
            <span
              className={`chip ${meta.adapter === 'anthropic' ? 'chip-accent' : 'chip-quiet'}`}
              data-testid="adapter-badge"
              title={`${IS_DEMO && meta.adapter === 'anthropic' ? '이 브라우저가 내 자격 증명으로 api.anthropic.com 을 직접 호출합니다 (서버 없음). ' : ''}어댑터: ${meta.adapter}, 모델: ${meta.model}${meta.auth ? `, 인증: ${meta.auth}` : ''} · API v${meta.version}`}
            >
              {IS_DEMO && meta.adapter === 'fixture' ? '스냅샷 데모 · fixture 더미' : adapterBadgeText(meta, { browser: IS_DEMO })}
            </span>
          ) : metaError ? (
            <span className="chip chip-red" title={String(metaError)}>
              API 연결 실패
            </span>
          ) : (
            <span className="muted small">어댑터 확인 중…</span>
          )}
          {credentialChip}
          <a className="apptop-link" data-testid="link-advanced" href={hrefTo('advanced')}>
            프로젝트 홈 →
          </a>
        </span>
      </header>
    </div>
  )
}
