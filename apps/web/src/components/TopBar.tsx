/** 상단 바 — 프로젝트명, 어댑터 배지(실제/더미 + 인증 방식), Playwright 가능 여부, 주요 링크. */
import { adapterBadgeText } from '../adapter-badge.js'
import { IS_DEMO } from '../demo-mode.js'
import { hrefTo } from '../router.js'
import type { Meta } from '../types.js'
import { Badge } from './common.js'

export function TopBar({ meta, metaError, projectName, current }: { meta: Meta | null; metaError: unknown; projectName: string | null; current: 'home' | 'references' | 'asis' | 'screen' | 'other' }) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <a className="brand" href={hrefTo('main')}>
          con-ai 기획 작업대
        </a>
        <span className="project-name" data-testid="project-name">{projectName ?? '프로젝트를 불러오는 중…'}</span>
      </div>
      <nav className="topbar-nav" aria-label="주요 화면">
        <a href={hrefTo('main')} data-testid="nav-main">
          메인
        </a>
        <a href={hrefTo('create')} data-testid="nav-simple">
          만들기
        </a>
        <a href={hrefTo('advanced')} className={current === 'home' ? 'active' : ''}>
          프로젝트 홈
        </a>
        <a href={hrefTo('references')} className={current === 'references' ? 'active' : ''}>
          레퍼런스 포트폴리오
        </a>
        <a href={hrefTo('asis')} className={current === 'asis' ? 'active' : ''} data-testid="nav-asis">
          AS-IS 분석
        </a>
      </nav>
      <div className="topbar-right">
        {meta ? (
          <>
            <Badge
              testId="adapter-badge"
              tone={meta.adapter === 'anthropic' ? 'green' : 'amber'}
              title={IS_DEMO && meta.adapter === 'anthropic' ? '이 브라우저가 내 자격 증명으로 api.anthropic.com 을 직접 호출합니다 (서버 없음)' : `어댑터: ${meta.adapter}, 모델: ${meta.model}${meta.auth ? `, 인증: ${meta.auth}` : ''}`}
            >
              {meta.adapter === 'anthropic' && !IS_DEMO ? '실제 호출 · ' : ''}
              {IS_DEMO && meta.adapter === 'fixture' ? '스냅샷 데모' : adapterBadgeText(meta, { browser: IS_DEMO })}
            </Badge>
            <Badge testId="playwright-badge" tone={meta.playwright ? 'blue' : 'gray'} title="V3 실행 검사(Playwright) 가능 여부">
              Playwright {meta.playwright ? '가능' : IS_DEMO ? '불가 (브라우저 — V3 는 not_run)' : '불가 (V3 는 error 로 기록)'}
            </Badge>
            <span className="muted small">API v{meta.version}</span>
          </>
        ) : metaError ? (
          <Badge tone="red" title={String(metaError)}>
            API 연결 실패
          </Badge>
        ) : (
          <span className="muted small">어댑터 확인 중…</span>
        )}
      </div>
    </header>
  )
}
