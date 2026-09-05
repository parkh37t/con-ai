/** 프로젝트 홈 — 요구사항·수용조건(UI/비UI), To-Be IA 트리, 화면 목록(상태·버전·revision·열린 코멘트, 생성/검토/완료 링크). */
import { realModelHint } from '../adapter-badge.js'
import { api } from '../api.js'
import { Badge, Collapsible, Empty, ErrorBox, Loading, ScreenStatusBadge } from '../components/common.js'
import { IS_DEMO } from '../demo-mode.js'
import { useAsync, navigate } from '../hooks.js'
import { hrefTo, hrefToScreen } from '../router.js'
import { buildIATree, type IATreeNode } from '../summary.js'
import type { Meta, Project, Requirement, ScreenSummary } from '../types.js'

export function HomePage({ project, projects, meta }: { project: Project; projects: Project[]; meta: Meta | null }) {
  const detail = useAsync(() => api.project(project.id), [project.id])
  const hint = realModelHint(meta, { demo: IS_DEMO })

  return (
    <div className="page">
      {hint && (
        <div className="notice notice-amber" data-testid="fixture-hint">
          {hint}
        </div>
      )}
      <section className="card">
        <div className="card-head">
          <h2>{project.name}</h2>
          <span className="actions">
            <a className="btn btn-small" data-testid="link-asis" href={hrefTo('asis')} title="4단계 프로세스 ① — 대상 서비스 분석·페인포인트">
              AS-IS 분석
            </a>
            {projects.length > 1 && (
              <label className="inline">
                프로젝트
                <select value={project.id} onChange={(e) => navigate(hrefTo('home', { project: e.target.value }))}>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </span>
        </div>
        <p>{project.description}</p>
        <div className="muted small">
          조직 {project.org} · 프로파일 {project.profile_id} · 생성 {project.created_at}
        </div>
      </section>

      {detail.error ? <ErrorBox error={detail.error} title="프로젝트 상세를 읽지 못했습니다" /> : null}
      {detail.loading && !detail.data && <Loading />}
      {detail.data && (
        <>
          <section className="card">
            <div className="card-head">
              <h3>화면 목록</h3>
              <span className="muted small">{detail.data.screens.length}개 화면</span>
            </div>
            <ScreensTable screens={detail.data.screens} />
          </section>

          <div className="two-col">
            <section className="card">
              <div className="card-head">
                <h3>요구사항·수용조건</h3>
                <span className="muted small">{detail.data.requirements.length}건</span>
              </div>
              <RequirementsList requirements={detail.data.requirements} />
            </section>
            <section className="card">
              <div className="card-head">
                <h3>To-Be IA</h3>
                <span className="muted small">{detail.data.ia_nodes.length}개 노드</span>
              </div>
              {detail.data.ia_nodes.length === 0 ? <Empty>IA 노드가 없습니다.</Empty> : <IATree tree={buildIATree(detail.data.ia_nodes)} screens={detail.data.screens} />}
            </section>
          </div>
        </>
      )}
    </div>
  )
}

function ScreensTable({ screens }: { screens: ScreenSummary[] }) {
  if (screens.length === 0) return <Empty>화면이 없습니다.</Empty>
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>외부 ID</th>
            <th>제목</th>
            <th>shell</th>
            <th>상태</th>
            <th>버전</th>
            <th className="num">revision</th>
            <th className="num">열린 코멘트</th>
            <th>작업</th>
          </tr>
        </thead>
        <tbody>
          {screens.map((s) => {
            const hasRevision = s.revision_count > 0 || Boolean(s.current_revision_id)
            const revQuery = s.current_revision_id ? { rev: s.current_revision_id } : undefined
            return (
              <tr key={s.id} data-testid="screen-row" data-external-id={s.external_id}>
                <td>
                  <code>{s.external_id}</code>
                </td>
                <td>{s.title}</td>
                <td className="muted">{s.shell ?? '—'}</td>
                <td>
                  <ScreenStatusBadge status={s.status} />
                </td>
                <td>{s.version ?? '—'}</td>
                <td className="num">{s.revision_count}</td>
                <td className="num">{s.open_comments > 0 ? <Badge tone="amber">{s.open_comments}</Badge> : 0}</td>
                <td className="actions">
                  <a className="btn btn-small" data-testid="link-generate" href={hrefToScreen('generate', s.id)}>
                    생성
                  </a>
                  {hasRevision ? (
                    <a className="btn btn-small" href={hrefToScreen('review', s.id, revQuery)}>
                      검토
                    </a>
                  ) : (
                    <span className="btn btn-small disabled" title="revision 이 없습니다">
                      검토
                    </span>
                  )}
                  {hasRevision ? (
                    <a className="btn btn-small" href={hrefToScreen('approve', s.id, revQuery)}>
                      완료
                    </a>
                  ) : (
                    <span className="btn btn-small disabled" title="revision 이 없습니다">
                      완료
                    </span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function RequirementsList({ requirements }: { requirements: Requirement[] }) {
  if (requirements.length === 0) return <Empty>요구사항이 없습니다.</Empty>
  return (
    <ul className="req-list">
      {requirements.map((r) => {
        const ui = r.criteria.filter((c) => c.kind === 'ui').length
        const nonUi = r.criteria.length - ui
        return (
          <li key={r.id} className="req-item">
            <div className="req-head">
              <code>{r.external_id}</code> <strong>{r.title}</strong>
              <span className="muted small">
                UI {ui} · 비UI {nonUi}
              </span>
            </div>
            <Collapsible title="내용·수용조건 보기">
              <p className="req-body">{r.body}</p>
              <ul className="criteria">
                {r.criteria.map((c) => (
                  <li key={c.id}>
                    <Badge tone={c.kind === 'ui' ? 'blue' : 'gray'}>{c.kind === 'ui' ? 'UI' : '비UI'}</Badge> <code>{c.id}</code> {c.text}
                  </li>
                ))}
              </ul>
            </Collapsible>
          </li>
        )
      })}
    </ul>
  )
}

function IATree({ tree, screens }: { tree: IATreeNode[]; screens: ScreenSummary[] }) {
  const byId = new Map(screens.map((s) => [s.id, s]))
  const render = (nodes: IATreeNode[]) => (
    <ul className="ia-tree">
      {nodes.map(({ node, children }) => {
        const screen = node.screen_plan_id ? byId.get(node.screen_plan_id) : undefined
        return (
          <li key={node.id}>
            <span className={`ia-node ia-${node.kind}`}>
              {node.kind === 'category' ? '▸ ' : '· '}
              {node.name}
              <span className="muted small"> ({node.portal})</span>
              {screen && (
                <>
                  {' '}
                  <a href={hrefToScreen('generate', screen.id)}>
                    <code>{screen.external_id}</code>
                  </a>{' '}
                  <ScreenStatusBadge status={screen.status} />
                </>
              )}
              {node.kind === 'screen' && !screen && node.screen_plan_id && <span className="muted small"> (화면 {node.screen_plan_id} 없음)</span>}
            </span>
            {children.length > 0 && render(children)}
          </li>
        )
      })}
    </ul>
  )
  return render(tree)
}
