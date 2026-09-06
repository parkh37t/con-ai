/**
 * 앱 루트 — 해시 라우팅, 메타·프로젝트 로딩, 셸 두 종류.
 *
 * 설계 산출물 screens-v1 을 따라 셸을 둘로 나눈다:
 *  - 진입 셸: 메인 · 만들기 · 설계서 결과 — 60px 얇은 상단 바 하나, 흰 바탕.
 *  - 작업대 셸: 프로젝트 홈 · 생성 · 검토 · 완료 · AS-IS · 레퍼런스 — 228px 좌측 레일 + 회색 캔버스.
 * 가로 메뉴는 두지 않는다. 작업대에서는 레일이 단계 순서와 현재 위치를 함께 보여준다.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { api } from './api.js'
import { AppTopBar } from './components/AppTopBar.js'
import { ErrorBox, Loading } from './components/common.js'
import { CredentialChip, CredentialPanel } from './components/CredentialPanel.js'
import { WorkspaceRail, type RailSection } from './components/WorkspaceRail.js'
import { IS_DEMO } from './demo-mode.js'
import { useAsync, useDataTick, useHashRoute } from './hooks.js'
import { ApprovePage } from './pages/ApprovePage.js'
import { AsisDetailPage } from './pages/AsisDetailPage.js'
import { AsisListPage } from './pages/AsisListPage.js'
import { DesignPage } from './pages/DesignPage.js'
import { GeneratePage } from './pages/GeneratePage.js'
import { HomePage } from './pages/HomePage.js'
import { MainPage } from './pages/MainPage.js'
import { ReferencesPage } from './pages/ReferencesPage.js'
import { ReviewPage } from './pages/ReviewPage.js'
import { SimpleHomePage } from './pages/SimpleHomePage.js'
import { stageCounts } from './project-nav.js'
import { hrefTo } from './router.js'

export function App() {
  const route = useHashRoute()
  const meta = useAsync(() => api.meta(), [])
  const projects = useAsync(() => api.projects(), [])

  const requestedProject = route.query['project']
  const projectList = projects.data ?? []
  const project = (requestedProject ? projectList.find((p) => p.id === requestedProject) : undefined) ?? projectList[0] ?? null

  // 메인·만들기·설계서 결과는 진입 셸(얇은 상단 바)을 쓴다. 나머지는 작업대 셸(좌측 레일).
  const entryShell = route.name === 'main' || route.name === 'create' || route.name === 'design'

  // 레일의 4단계 건수. 작업대 셸에서만 필요하므로 그때만 읽는다.
  // 화면·분석이 만들어지면(dataTick) 다시 읽는다 — 레일이 옛 숫자를 들고 있지 않게 한다.
  const dataTick = useDataTick()
  const detail = useAsync(async () => (project && !entryShell ? api.project(project.id) : null), [project?.id, entryShell, route.name, dataTick])
  const analyses = useAsync(async () => (project && !entryShell ? api.asisAnalyses(project.id) : null), [project?.id, entryShell, route.name, dataTick])
  const counts = stageCounts({ screens: detail.data?.screens ?? null, analyses: analyses.data ?? null })

  // 자격 증명 패널은 기본으로 접혀 있다. 칩을 누르거나, 패널을 열려는 기존 진입(`?help=key` / `?cred=open`)이면 열린 채로 온다.
  const credentialRequested = route.query['help'] === 'key' || route.query['cred'] === 'open'
  const [credentialOpen, setCredentialOpen] = useState(credentialRequested)
  useEffect(() => {
    if (credentialRequested) setCredentialOpen(true)
  }, [credentialRequested])

  const railSection: RailSection =
    route.name === 'asis' || route.name === 'asis_detail'
      ? 'asis'
      : route.name === 'references'
        ? 'references'
        : route.name === 'review'
          ? 'review'
          : route.name === 'approve'
            ? 'done'
            : route.name === 'advanced' || route.name === 'generate'
              ? 'screens'
              : 'other'

  let body: ReactNode
  if (projects.error) {
    body = <ErrorBox error={projects.error} title="프로젝트 목록을 읽지 못했습니다" />
  } else if (route.name === 'design') {
    body = <DesignPage key={route.revisionId} revisionId={route.revisionId} route={route} />
  } else if (route.name === 'generate') {
    body = <GeneratePage key={route.screenId} screenId={route.screenId} route={route} />
  } else if (route.name === 'review') {
    body = <ReviewPage key={route.screenId} screenId={route.screenId} route={route} />
  } else if (route.name === 'approve') {
    body = <ApprovePage key={route.screenId} screenId={route.screenId} route={route} />
  } else if (route.name === 'asis_detail') {
    body = <AsisDetailPage key={route.analysisId} analysisId={route.analysisId} />
  } else if (route.name === 'main') {
    // 메인은 프로젝트를 아직 못 읽었어도 그린다 (히어로·프로세스·안내는 데이터가 없어도 맞는 말이다).
    body = <MainPage key={project?.id ?? 'no-project'} project={project} meta={meta.data} route={route} />
  } else if (!projects.data) {
    body = <Loading text="프로젝트를 불러오는 중…" />
  } else if (!project) {
    body = <div className="empty">프로젝트가 없습니다. API 의 시드 데이터(계약 §10)가 만들어졌는지 확인하세요.</div>
  } else if (route.name === 'create') {
    body = <SimpleHomePage key={project.id} project={project} meta={meta.data} route={route} />
  } else if (route.name === 'advanced') {
    body = <HomePage key={project.id} project={project} projects={projectList} meta={meta.data} route={route} />
  } else if (route.name === 'references') {
    body = <ReferencesPage key={project.id} projectId={project.id} />
  } else if (route.name === 'asis') {
    body = <AsisListPage key={project.id} project={project} />
  } else {
    body = (
      <div className="empty">
        알 수 없는 경로입니다: <code>{route.path}</code> · <a href={hrefTo('main')}>메인 화면으로</a>
      </div>
    )
  }

  const credentialChip = IS_DEMO ? <CredentialChip open={credentialOpen} onToggle={() => setCredentialOpen((v) => !v)} /> : null
  const credentialPanel = IS_DEMO ? <CredentialPanel open={credentialOpen} onClose={() => setCredentialOpen(false)} onChanged={() => meta.reload()} /> : null

  if (entryShell) {
    return (
      <div className={`app app-entry${route.name === 'main' ? ' app-main' : ''}`}>
        <div className="topdock">
          <AppTopBar meta={meta.data} metaError={meta.error} credentialChip={credentialChip} />
          {credentialPanel}
        </div>
        <main className="main main-entry">{body}</main>
      </div>
    )
  }

  return (
    <div className="app app-workspace">
      <WorkspaceRail project={project} meta={meta.data} metaError={meta.error} counts={counts} current={railSection} credentialChip={credentialChip} />
      <div className="workspace-body">
        {credentialPanel}
        <main className="main">{body}</main>
      </div>
    </div>
  )
}
