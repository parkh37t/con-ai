/**
 * 저장 문서 → RTM 입력 어댑터 (산출물 P1-05).
 *
 * 도메인(`computeRtm`)은 순수 함수라 저장소를 모른다. 여기서 문서를 읽어 그 입력 모양으로 옮긴다.
 * 옮기는 것 말고는 하지 않는다 — 없는 값을 채우거나 기본값을 지어내지 않는다.
 */
import type { RtmInput, RtmRequirement, RtmScreen, RtmSpecIndex } from '@con-ai/domain'
import type { IANodeDocument, RequirementDocument, ScreenDocument, ScreenRevisionDocument, Store } from '@con-ai/worker-generation'

/**
 * 프로젝트의 문서를 모아 RTM 입력을 만든다.
 *
 * `spec_indexes` 는 **현재 revision 이 있는 화면만** 담는다. 아직 생성하지 않은 화면을
 * 「요소 0개」로 넘기면 태깅이 전부 stale 로 보이므로, 목록에서 빼서 도메인이 not_run 으로
 * 분류하게 한다 (미실행과 없음을 구분한다).
 */
export function buildRtmInput(store: Store, projectId: string): RtmInput {
  const requirements: RtmRequirement[] = store
    .list<RequirementDocument>('requirement', (d) => d.data.project_id === projectId)
    .map((d) => ({
      external_id: d.data.external_id,
      title: d.data.title,
      criteria: d.data.criteria.map((c) => ({ id: c.id, kind: c.kind })),
    }))

  const ia_nodes = store.list<IANodeDocument>('ia_node', (d) => d.data.project_id === projectId).map((d) => d.data)

  const screenDocs = store.list<ScreenDocument>('screen', (d) => d.data.project_id === projectId).map((d) => d.data)
  const screens: RtmScreen[] = screenDocs.map((s) => ({
    id: s.id,
    external_id: s.external_id,
    title: s.title,
    status: s.status,
    current_revision_id: s.current_revision_id,
  }))

  const spec_indexes: RtmSpecIndex[] = []
  for (const s of screenDocs) {
    if (s.current_revision_id === undefined) continue // 아직 생성 안 됨 — 도메인이 not_run 으로 센다
    const revision = store.get<ScreenRevisionDocument>('screen_revision', s.current_revision_id)
    if (!revision) continue
    spec_indexes.push({ screen_plan_id: s.id, element_or_action_ids: revision.data.element_index.map((e) => e.element_id) })
  }

  return { requirements, ia_nodes, screens, spec_indexes }
}
