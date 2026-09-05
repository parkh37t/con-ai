/** 상단 바 — 프로젝트명, 어댑터 배지(실제/더미 + 인증 방식), Playwright 가능 여부, 주요 링크. */
import { adapterBadgeText } from '../adapter-badge.js'
import { hrefTo } from '../router.js'
import type { Meta } from '../types.js'
import { Badge } from './common.js'

export function TopBar({ meta, metaError, projectName, current }: { meta: Meta | null; metaError: unknown; projectName: string | null; current: 'home' | 'references' | 'screen' | 'other' }) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <a className="brand" href={hrefTo('home')}>
          con-ai 기획 작업대
        </a>
        <span className="project-name" data-testid="project-name">{projectName ?? '프로젝트를 불러오는 중…'}</span>
      </div>
      <nav className="topbar-nav" aria-label="주요 화면">
        <a href={hrefTo('home')} className={current === 'home' ? 'active' : ''}>
          프로젝트 홈
        </a>
        <a href={hrefTo('references')} className={current === 'references' ? 'active' : ''}>
          레퍼런스 포트폴리오
        </a>
      </nav>
      <div className="topbar-right">
        {meta ? (
          <>
            <Badge testId="adapter-badge" tone={meta.adapter === 'anthropic' ? 'green' : 'amber'} title={`어댑터: ${meta.adapter}, 모델: ${meta.model}${meta.auth ? `, 인증: ${meta.auth}` : ''}`}>
              {meta.adapter === 'anthropic' ? '실제 호출 · ' : ''}
              {adapterBadgeText(meta)}
            </Badge>
            <Badge testId="playwright-badge" tone={meta.playwright ? 'blue' : 'gray'} title="V3 실행 검사(Playwright) 가능 여부">
              Playwright {meta.playwright ? '가능' : '불가 (V3 는 error 로 기록)'}
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
