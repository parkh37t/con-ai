/**
 * 화면 컨텍스트 헤더 — 생성 작업대 · 화면 검토 · 완료·이관이 공유한다.
 *
 * 설계 산출물 screens-v1 의 「화면 컨텍스트 헤더」:
 *   브레드크럼 → 제목 + 상태 pill + 메타 한 줄 → 오른쪽 주 동작 → 아래 탭 3개(② 생성 · ③ 검토 · ④ 완료).
 * 세 화면이 각자 카드 헤더를 그리던 것을 하나로 합쳐, 화면을 옮겨도 머리 부분이 흔들리지 않게 한다.
 * 탭 번호는 4단계 프로세스의 ②③④ 와 같은 번호다.
 */
import type { ReactNode } from 'react'
import { hrefTo, hrefToScreen, type ScreenRouteName } from '../router.js'
import type { Screen } from '../types.js'

const TABS: readonly { key: ScreenRouteName; no: number; label: string }[] = [
  { key: 'generate', no: 2, label: '생성 작업대' },
  { key: 'review', no: 3, label: '화면 검토' },
  { key: 'approve', no: 4, label: '완료·이관' },
]

const STATUS: Record<string, { label: string; tone: 'gray' | 'blue' | 'green' }> = {
  draft: { label: '초안', tone: 'gray' },
  review: { label: '검토 중', tone: 'blue' },
  approved: { label: '완료', tone: 'green' },
}

export function ScreenContextHeader({
  screen,
  current,
  revisionCount,
  openComments,
  revisionQuery,
  actions,
}: {
  screen: Screen
  current: ScreenRouteName
  revisionCount: number
  openComments?: number
  /** 탭을 옮길 때 유지할 revision 쿼리 (검토·완료가 같은 revision 을 보게 한다). */
  revisionQuery?: string | undefined
  actions?: ReactNode
}) {
  const st = STATUS[screen.status] ?? { label: screen.status, tone: 'gray' as const }
  const revQ = revisionQuery ? { rev: revisionQuery } : undefined
  const meta = [
    screen.shell ? `shell ${screen.shell}` : null,
    screen.device === 'mobile' ? '모바일' : 'PC',
    `revision ${revisionCount}개`,
    openComments === undefined ? null : `열린 코멘트 ${openComments}`,
  ]
    .filter((x): x is string => x !== null)
    .join(' · ')

  return (
    <div className="ctxhead">
      <div className="ctxhead-top">
        <div className="ctxhead-id">
          <nav className="breadcrumb" aria-label="경로">
            <a href={hrefTo('advanced')}>프로젝트 홈</a>
            <span aria-hidden="true">/</span>
            <span>화면</span>
            <span aria-hidden="true">/</span>
            <code>{screen.external_id}</code>
          </nav>
          <div className="ctxhead-title">
            <h1>{screen.title}</h1>
            <span className={`pill pill-${st.tone}`} data-testid="ctx-status">
              <span className="pill-dot" aria-hidden="true" />
              {st.label}
            </span>
            <span className="ctxhead-meta">{meta}</span>
          </div>
        </div>
        {actions ? <span className="ctxhead-actions">{actions}</span> : null}
      </div>
      <nav className="ctxtabs" aria-label="화면 작업 단계">
        {TABS.map((t) => {
          const active = t.key === current
          return (
            <a
              key={t.key}
              className={`ctxtab${active ? ' active' : ''}`}
              href={hrefToScreen(t.key, screen.id, revQ)}
              data-testid={`ctxtab-${t.key}`}
              {...(active ? { 'aria-current': 'page' as const } : {})}
            >
              <span className="ctxtab-no" aria-hidden="true">
                {t.no}
              </span>
              {t.label}
            </a>
          )
        })}
      </nav>
    </div>
  )
}
