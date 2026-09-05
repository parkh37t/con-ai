/** 앱 루트 — 해시 라우팅, 메타·프로젝트 로딩, 상단 바. */
import type { ReactNode } from 'react'
import { api } from './api.js'
import { ErrorBox, Loading } from './components/common.js'
import { TopBar } from './components/TopBar.js'
import { useAsync, useHashRoute } from './hooks.js'
import { ApprovePage } from './pages/ApprovePage.js'
import { AsisDetailPage } from './pages/AsisDetailPage.js'
import { AsisListPage } from './pages/AsisListPage.js'
import { GeneratePage } from './pages/GeneratePage.js'
import { HomePage } from './pages/HomePage.js'
import { ReferencesPage } from './pages/ReferencesPage.js'
import { ReviewPage } from './pages/ReviewPage.js'
import { hrefTo } from './router.js'

export function App() {
  const route = useHashRoute()
  const meta = useAsync(() => api.meta(), [])
  const projects = useAsync(() => api.projects(), [])

  const requestedProject = route.query['project']
  const projectList = projects.data ?? []
  const project = (requestedProject ? projectList.find((p) => p.id === requestedProject) : undefined) ?? projectList[0] ?? null

  const current =
    route.name === 'home'
      ? 'home'
      : route.name === 'references'
        ? 'references'
        : route.name === 'asis' || route.name === 'asis_detail'
          ? 'asis'
          : route.name === 'not_found'
            ? 'other'
            : 'screen'

  let body: ReactNode
  if (projects.error) {
    body = <ErrorBox error={projects.error} title="프로젝트 목록을 읽지 못했습니다" />
  } else if (route.name === 'generate') {
    body = <GeneratePage key={route.screenId} screenId={route.screenId} route={route} />
  } else if (route.name === 'review') {
    body = <ReviewPage key={route.screenId} screenId={route.screenId} route={route} />
  } else if (route.name === 'approve') {
    body = <ApprovePage key={route.screenId} screenId={route.screenId} route={route} />
  } else if (route.name === 'asis_detail') {
    body = <AsisDetailPage key={route.analysisId} analysisId={route.analysisId} />
  } else if (!projects.data) {
    body = <Loading text="프로젝트를 불러오는 중…" />
  } else if (!project) {
    body = <div className="empty">프로젝트가 없습니다. API 의 시드 데이터(계약 §10)가 만들어졌는지 확인하세요.</div>
  } else if (route.name === 'home') {
    body = <HomePage key={project.id} project={project} projects={projectList} meta={meta.data} />
  } else if (route.name === 'references') {
    body = <ReferencesPage key={project.id} projectId={project.id} />
  } else if (route.name === 'asis') {
    body = <AsisListPage key={project.id} project={project} />
  } else {
    body = (
      <div className="empty">
        알 수 없는 경로입니다: <code>{route.path}</code> · <a href={hrefTo('home')}>프로젝트 홈으로</a>
      </div>
    )
  }

  return (
    <div className="app">
      <TopBar meta={meta.data} metaError={meta.error} projectName={project?.name ?? null} current={current} />
      <main className="main">{body}</main>
    </div>
  )
}
