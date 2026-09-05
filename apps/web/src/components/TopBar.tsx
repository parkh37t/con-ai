/**
 * 상단 바 — 제품명 › 구분선 › 메뉴, 오른쪽에 상태 칩만.
 *
 * 위계를 한 줄 안에서 만든다:
 *  - 왼쪽: 제품명(굵게) → 얇은 세로 구분선 → 메뉴. 프로젝트명은 여기 두지 않는다(각 페이지 본문에서 보여준다).
 *  - 현재 메뉴는 배경 박스가 아니라 밑줄로 표시한다 — 화면설계서 GNB 와 같은 언어.
 *  - 오른쪽: 자격 증명 칩(정적 배포), 정적 데모 표시, 어댑터·Playwright 상태 칩.
 *    긴 설명은 title 로 내리고 칩 문구는 짧게 유지한다.
 */
import type { ReactNode } from 'react'
import { adapterBadgeText } from '../adapter-badge.js'
import { DEMO_BANNER_TEXT, DEMO_REPO_URL, IS_DEMO } from '../demo-mode.js'
import { hrefTo } from '../router.js'
import type { Meta } from '../types.js'

export type TopBarSection = 'home' | 'references' | 'asis' | 'screen' | 'other'

const NAV_ITEMS: ReadonlyArray<{ to: Parameters<typeof hrefTo>[0]; label: string; section: TopBarSection | null; testId?: string }> = [
  { to: 'main', label: '메인', section: null, testId: 'nav-main' },
  { to: 'create', label: '만들기', section: null, testId: 'nav-simple' },
  { to: 'advanced', label: '프로젝트 홈', section: 'home' },
  { to: 'references', label: '레퍼런스 포트폴리오', section: 'references' },
  { to: 'asis', label: 'AS-IS 분석', section: 'asis', testId: 'nav-asis' },
]

export function TopBar({ meta, metaError, current, credentialChip }: { meta: Meta | null; metaError: unknown; current: TopBarSection; credentialChip?: ReactNode }) {
  return (
    <header className="topbar">
      <a className="brand" href={hrefTo('main')}>
        con-ai 기획 작업대
      </a>
      <span className="topbar-sep" aria-hidden="true" />
      <nav className="topbar-nav" aria-label="주요 화면">
        {NAV_ITEMS.map((item) => {
          const active = item.section !== null && item.section === current
          return (
            <a
              key={item.to}
              href={hrefTo(item.to)}
              className={active ? 'active' : ''}
              {...(active ? { 'aria-current': 'page' as const } : {})}
              {...(item.testId ? { 'data-testid': item.testId } : {})}
            >
              {item.label}
            </a>
          )
        })}
      </nav>
      <div className="topbar-right">
        {credentialChip}
        {/* 정적 데모 표시는 어댑터 칩과 뜻이 겹치므로 링크만 남기고 문구는 어댑터 칩이 갖는다. */}
        {IS_DEMO && (
          <a className="chip chip-quiet" data-testid="demo-banner" href={DEMO_REPO_URL} target="_blank" rel="noreferrer noopener" title={`${DEMO_BANNER_TEXT} · 저장소 parkh37t/con-ai`}>
            저장소
          </a>
        )}
        {meta ? (
          <>
            {/* 더미/실제 구분은 색이 아니라 문구로 한다 (CLAUDE.md). 실제 호출일 때만 파랑 강조 하나를 쓴다. */}
            <span
              className={`chip ${meta.adapter === 'anthropic' ? 'chip-accent' : 'chip-quiet'}`}
              data-testid="adapter-badge"
              title={`${IS_DEMO && meta.adapter === 'anthropic' ? '이 브라우저가 내 자격 증명으로 api.anthropic.com 을 직접 호출합니다 (서버 없음). ' : ''}어댑터: ${meta.adapter}, 모델: ${meta.model}${meta.auth ? `, 인증: ${meta.auth}` : ''} · API v${meta.version}`}
            >
              {meta.adapter === 'anthropic' && !IS_DEMO ? '실제 호출 · ' : ''}
              {IS_DEMO && meta.adapter === 'fixture' ? '스냅샷 데모 · fixture 더미' : adapterBadgeText(meta, { browser: IS_DEMO })}
            </span>
            {/* 브라우저 모드는 V3 를 아예 돌릴 수 없다(항상 not_run). 그 사실은 검증 결과 표에 적히므로 상단에서는 칩을 만들지 않는다.
                서버 모드에서만 실행 검사 가능 여부를 알린다. */}
            {!IS_DEMO && (
              <span
                className="chip chip-quiet"
                data-testid="playwright-badge"
                title={`V3 실행 검사(Playwright) ${meta.playwright ? '가능' : '불가 — V3 는 error 로 기록됩니다'}`}
              >
                실행 검사 {meta.playwright ? '가능' : '불가'}
              </span>
            )}
          </>
        ) : metaError ? (
          <span className="chip chip-red" title={String(metaError)}>
            API 연결 실패
          </span>
        ) : (
          <span className="muted small">어댑터 확인 중…</span>
        )}
      </div>
    </header>
  )
}
