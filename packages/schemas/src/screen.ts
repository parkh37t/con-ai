/**
 * 화면 — IANode / ScreenPlan / ScreenRevision / NonUIScreenWork / ShellProfile. 초안(변경 예정).
 *
 * 출처: 설계 §6 표 (IANode: 부모, 명칭, 순서, 포털, 화면 연결, 카테고리와 화면 구분;
 *       ScreenPlan / ScreenRevision: 내부 UUID, 기존 화면 ID, 별칭 이력, 목적, shell, 기기, 역할, 명세;
 *       NonUIScreenWork: 배치·연계·권한 서비스 등, 수용조건 연결, 담당·검증 근거),
 *       설계 §6 본문 (외부 화면 ID 유지, 별칭 이력·경로 이동 기록, 과거 승인본은 당시 ID 유지),
 *       설계 §9 (S2B 프로파일: 페이지 `.root-shell`/`.screen-wrap`/`#right-panel`, 팝업 `.popup-shell`/`.spec-side`),
 *       보고서 §3 (중복 ID·경로 미확인 행은 자동 병합하지 않음).
 */
import { z } from 'zod'
import { Actor, AnchorRef, ContentHash, ExternalId, InternalId, IsoDateTime, NonEmptyText, Revision } from './common.js'

/** 기기 프로파일 (설계 §2 PC/모바일; §9 예시 `device: "desktop"`). */
export const DeviceProfile = z.enum(['desktop', 'mobile']).describe('기기 (설계 §2, §9)')

/** 사용자 역할 식별자 — 프로젝트가 정의한다 (예: buyer, supplier, admin). */
export const RoleId = z.string().min(1).regex(/^\S+$/, '역할 ID 에는 공백을 쓸 수 없다').describe('사용자 역할 (설계 §2, §8 대상 구역)')

/** shell 종류 — 페이지/팝업 (설계 §9). */
export const ShellKind = z.enum(['page', 'popup']).describe('shell 종류: 페이지 / 별도 팝업 (설계 §9)')

/**
 * shell 프로파일 ID. 초안 규칙: `<포털>-page` 또는 `<포털>-popup` (설계 §9 예시의 `buyer-page` 를 따름).
 * 페이지 구조를 팝업에 기계적으로 복사하지 않도록 종류를 ID 에 드러낸다 (설계 §9).
 */
export const ShellId = z
  .string()
  .regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*-(?:page|popup)$/, 'shell ID 는 `<포털>-page` 또는 `<포털>-popup` 형식')
  .describe('shell 프로파일 ID (설계 §9). 예: buyer-page, admin-popup')

/** shell ID 에서 종류를 읽는다. */
export function shellKindOf(shell: string): 'page' | 'popup' {
  return shell.endsWith('-popup') ? 'popup' : 'page'
}

/** shell 프로파일 — 프로젝트별 렌더링 규격을 데이터로 둔다. S2B 규칙은 승인된 프로파일에 한해 적용 (설계 §9). */
export const ShellProfile = z
  .object({
    id: ShellId,
    project_id: InternalId,
    kind: ShellKind,
    portal: NonEmptyText.describe('포털 (관리자·수요기관·공급업체 등)'),
    root_selector: NonEmptyText.describe('루트 선택자 (예: 페이지 .root-shell, 팝업 .popup-shell; 설계 §9)'),
    screen_selector: NonEmptyText.describe('화면 영역 선택자 (예: .screen-wrap)'),
    spec_panel_selector: NonEmptyText.describe('우측 설명 영역 선택자 (예: #right-panel, .spec-side)'),
    rules: z.array(z.string()).default([]).describe('이 프로파일에만 적용하는 규칙 (예: 검색 초기화 버튼 제거). 모든 프로젝트에 강제하지 않음 (설계 §9)'),
  })
  .superRefine((p, ctx) => {
    if (shellKindOf(p.id) !== p.kind) {
      ctx.addIssue({ code: 'custom', path: ['kind'], message: `shell ID 의 종류(${shellKindOf(p.id)})와 kind(${p.kind})가 다르다` })
    }
  })
  .describe('ShellProfile (설계 §9 S2B 규격의 프로젝트 프로파일화)')

/** IA 노드 종류 — 카테고리와 화면을 구분한다 (설계 §6). */
export const IANodeKind = z.enum(['category', 'screen']).describe('IA 노드 종류 (설계 §6)')

export const IANode = z
  .object({
    id: InternalId,
    project_id: InternalId,
    parent_id: InternalId.nullable().describe('부모 (최상위면 null; 설계 §6)'),
    name: NonEmptyText.describe('명칭'),
    order: z.int().min(0).describe('형제 안 순서'),
    portal: NonEmptyText.describe('포털'),
    kind: IANodeKind,
    screen_plan_id: InternalId.optional().describe('화면 연결 (kind=screen 일 때; 설계 §6)'),
  })
  .superRefine((n, ctx) => {
    if (n.kind === 'category' && n.screen_plan_id !== undefined) {
      ctx.addIssue({ code: 'custom', path: ['screen_plan_id'], message: '카테고리 노드는 화면을 직접 연결하지 않는다 (설계 §6 카테고리와 화면 구분)' })
    }
  })
  .describe('IANode (설계 §6)')

/** 별칭 이력 항목 — 파일명·화면 ID 변경은 명시적 변경 작업이며 이력을 남긴다 (설계 §6). */
export const ScreenAlias = z.object({
  external_id: ExternalId.describe('당시 외부 화면 ID'),
  path: z.string().optional().describe('당시 파일 경로'),
  valid_from: IsoDateTime,
  valid_to: IsoDateTime.optional().describe('비어 있으면 현재'),
  reason: z.string().optional().describe('변경 사유'),
})

/** 화면 수입 검토 상태 — INDEX 수입 시 충돌·유실 경로는 공식 레지스트리에 합치기 전 검토 대상으로 분리 (설계 §2, §6; 보고서 §3). */
export const ScreenRegistryStatus = z
  .enum(['registered', 'import_candidate', 'duplicate_id', 'path_resolution_required'])
  .describe('화면 레지스트리 상태 (설계 §6, 보고서 §3)')

export const ScreenPlan = z
  .object({
    id: InternalId.describe('내부 UUID'),
    project_id: InternalId,
    external_id: ExternalId.describe('기존 외부 화면 ID (S2B 파일명 기반 ID 우선; 새 SP 번호를 강제하지 않음; 설계 §6)'),
    path: z.string().optional().describe('현재 파일 경로'),
    portal: NonEmptyText,
    aliases: z.array(ScreenAlias).default([]).describe('별칭 이력 (설계 §6)'),
    registry_status: ScreenRegistryStatus.describe('수입 검토 상태'),
    current_revision: Revision.optional(),
    created_at: IsoDateTime,
  })
  .describe('ScreenPlan (설계 §6)')

export const ScreenRevision = z
  .object({
    id: InternalId,
    screen_plan_id: InternalId,
    revision: Revision,
    external_id: ExternalId.describe('이 revision 당시의 외부 화면 ID (과거 승인본은 당시 ID 유지; 설계 §6)'),
    purpose: NonEmptyText.describe('목적 (설계 §6)'),
    shell: ShellId.describe('shell (설계 §6, §9)'),
    device: DeviceProfile.describe('기기'),
    roles: z.array(RoleId).describe('역할'),
    baseline_id: ExternalId.optional().describe('이 revision 이 고정한 기준 버전'),
    spec_hash: ContentHash.optional().describe('명세(ScreenSpec) artifact 의 content hash (설계 §6 명세)'),
    created_at: IsoDateTime,
    created_by: Actor.optional(),
  })
  .describe('ScreenRevision (설계 §6)')

/** 비UI 작업 종류 (설계 §6: 배치·연계·권한 서비스 등). */
export const NonUIWorkKind = z.enum(['batch', 'integration', 'permission_service', 'other']).describe('비UI 작업 종류 (설계 §6)')

/** 비화면 작업 — 화면만으로 완료할 수 없는 수용조건의 별도 책임·검증 연결 (설계 §6, §7). */
export const NonUIScreenWork = z
  .object({
    id: InternalId,
    project_id: InternalId,
    kind: NonUIWorkKind,
    title: NonEmptyText,
    description: z.string().optional(),
    criterion_ids: z.array(InternalId).min(1).describe('연결한 수용조건 (AcceptanceCriterion 내부 UUID; 설계 §6)'),
    owner: Actor.describe('담당 (설계 §6)'),
    evidence: z.array(AnchorRef).default([]).describe('검증 근거 (설계 §6)'),
    verification_note: z.string().optional().describe('검증 방법·결과 메모'),
  })
  .describe('NonUIScreenWork (설계 §6)')

export type DeviceProfile = z.infer<typeof DeviceProfile>
export type RoleId = z.infer<typeof RoleId>
export type ShellKind = z.infer<typeof ShellKind>
export type ShellId = z.infer<typeof ShellId>
export type ShellProfile = z.infer<typeof ShellProfile>
export type IANode = z.infer<typeof IANode>
export type ScreenPlan = z.infer<typeof ScreenPlan>
export type ScreenRevision = z.infer<typeof ScreenRevision>
export type NonUIScreenWork = z.infer<typeof NonUIScreenWork>
