/**
 * 외부 화면 ID 규칙 — 내부 UUID 와 외부 ID 분리, 프로젝트 내 현재 외부 ID 유일성, 중복 수입 분리, 별칭 이력.
 *
 * 출처:
 * - 설계 §6: "프로젝트 내 현재 외부 ID 는 유일해야 한다. 중복 수입은 별도 임시 레코드로 받아 해결 전 공식 레지스트리에 합치지 않는다."
 *            "파일명·화면 ID 변경은 별칭 이력과 경로 이동 기록을 남기는 명시적 변경 작업이다. 과거 승인본은 당시 ID 를 유지한다."
 *            "내부 UUID 를 별도로 두며 새 `SP-...` 번호를 기존 ID 대신 강제하지 않는다."
 * - 보고서 §3: INDEX 고유 ID 1,385 / ID 중복 그룹 43 / 그중 서로 다른 경로 32 그룹 → 자동 병합 금지; 경로 미확인 52 행은 연결 후보일 뿐.
 * - 보고서 §4: 폐기 ID 가 서로 다른 명칭으로 등장하므로 이름 하나로 자동 별칭을 만들지 않는다.
 * - 개발프롬프트: "기존 화면 ID 를 새로운 SP 번호로 일괄 바꾸지 않습니다. 별칭·이력과 버전별 ID 를 보존하세요."
 *
 * 이 파일이 코드로 고정하는 것:
 * - ID 를 생성·부여하는 함수가 없다. 외부 ID 는 항상 사람이(또는 수입 행이) 준 값이다.
 * - 개명은 `renameExternalId` 한 건씩만 가능하고 사유·행위자·시점 없이는 실패한다. 일괄 개명 API 는 두지 않는다.
 * - 개명해도 내부 UUID(`ScreenPlan.id`)와 과거 `ScreenRevision.external_id` 는 건드리지 않는다.
 */
import { ExternalId, IsoDateTime, type InternalId, type ScreenPlan } from '@con-ai/schemas'
import { DomainRuleError, allow, assertAllowed, decide, deny, type RuleDecision, type RuleReason } from './result.js'

/** 레지스트리 상태 (schemas 의 ScreenRegistryStatus enum 값; 타입 별칭이 없어 ScreenPlan 에서 파생). */
export type ScreenRegistryStatus = ScreenPlan['registry_status']

/** 별칭 이력 항목 (schemas 의 ScreenPlan.aliases 원소). */
export type ScreenAlias = ScreenPlan['aliases'][number]

/** 공식 레지스트리에 속한 상태. 나머지(import_candidate / duplicate_id / path_resolution_required)는 임시 레코드다 (설계 §6). */
export const OFFICIAL_REGISTRY_STATUS: ScreenRegistryStatus = 'registered'

/** 공식 레지스트리 — `registered` 상태인 화면만. 임시 레코드는 포함하지 않는다. */
export function officialRegistry(plans: readonly ScreenPlan[]): ScreenPlan[] {
  return plans.filter((p) => p.registry_status === OFFICIAL_REGISTRY_STATUS)
}

/** 같은 프로젝트에서 현재 외부 ID 가 같은 레코드 (임시 레코드 포함). `exclude_plan_id` 는 자기 자신을 뺄 때 쓴다. */
export function findPlansWithCurrentExternalId(
  plans: readonly ScreenPlan[],
  projectId: InternalId,
  externalId: string,
  options: { exclude_plan_id?: InternalId } = {},
): ScreenPlan[] {
  return plans.filter((p) => p.project_id === projectId && p.external_id === externalId && p.id !== options.exclude_plan_id)
}

/** 프로젝트 안 현재 외부 ID 유일성 검사 (설계 §6). 공식 레지스트리뿐 아니라 임시 레코드와도 겹치면 유일하지 않다. */
export function checkExternalIdUnique(
  plans: readonly ScreenPlan[],
  projectId: InternalId,
  externalId: string,
  options: { exclude_plan_id?: InternalId } = {},
): RuleDecision {
  const parsed = ExternalId.safeParse(externalId)
  if (!parsed.success) {
    return deny([{ code: 'external_id.invalid', message: `외부 ID 형식이 잘못됐다: ${parsed.error.issues.map((i) => i.message).join('; ')}` }])
  }
  const holders = findPlansWithCurrentExternalId(plans, projectId, externalId, options)
  if (holders.length === 0) return allow()
  const official = holders.filter((p) => p.registry_status === OFFICIAL_REGISTRY_STATUS)
  const temporary = holders.filter((p) => p.registry_status !== OFFICIAL_REGISTRY_STATUS)
  const reasons: RuleReason[] = []
  if (official.length > 0) {
    reasons.push({
      code: 'external_id.duplicate',
      message: `외부 ID '${externalId}' 는 프로젝트의 공식 레지스트리에 이미 있다 (내부 UUID ${official.map((p) => p.id).join(', ')}) — 프로젝트 내 현재 외부 ID 는 유일해야 한다 (설계 §6)`,
    })
  }
  if (temporary.length > 0) {
    reasons.push({
      code: 'external_id.duplicate_pending',
      message: `외부 ID '${externalId}' 를 가진 미해결 임시 레코드가 ${temporary.length}건 있다 — 실제 화면 구분(설계 §15)을 끝내기 전에는 같은 ID 를 등록할 수 없다 (설계 §6)`,
    })
  }
  return deny(reasons)
}

// ---------------------------------------------------------------------------
// 수입(INDEX 등) 분류 — 중복·경로 미확인 행은 임시 레코드로 분리한다
// ---------------------------------------------------------------------------

/** 수입 행 하나 (INDEX 한 줄 등). 합성 데이터 기준이며 실제 S2B 경로를 담지 않는다. */
export interface ImportRow {
  external_id: string
  /** 파일 경로. 없거나 확인되지 않으면 `path_resolution_required` 로 분리한다 (보고서 §3 경로 미확인 52 행). */
  path?: string | undefined
  portal: string
  /** 원문 위치 표시 (예: INDEX 행 번호). 검토 화면에서 원문을 찾기 위한 값. */
  source_ref?: string | undefined
}

/** 같은 외부 ID 가 여러 곳에서 나타난 그룹. `paths_differ` 가 true 면 서로 다른 화면일 수 있으므로 절대 자동 병합하지 않는다 (보고서 §3). */
export interface DuplicateGroup {
  external_id: string
  rows: ImportRow[]
  /** 이미 저장된 레코드 중 현재 외부 ID 가 같은 것 (공식·임시 모두). */
  existing: ScreenPlan[]
  paths_differ: boolean
}

/** 수입 계획 — 각 행을 어떤 레코드로 받을지. 어느 항목도 외부 ID 를 새로 만들지 않는다. */
export interface ImportPlan {
  /** 유일하고 경로가 있는 행 → `registered` 로 등록할 수 있다. */
  register: ImportRow[]
  /** 중복 그룹 → 그룹의 모든 행을 `duplicate_id` 임시 레코드로 받는다. */
  duplicate_groups: DuplicateGroup[]
  /** 경로 없는 행 → `path_resolution_required` 임시 레코드. */
  path_unresolved: ImportRow[]
  /** 기존 레코드의 과거 별칭과 같은 ID 를 쓰는 행 → `import_candidate`. 이름이 같다는 이유로 자동 연결하지 않는다 (보고서 §4). */
  alias_collisions: { row: ImportRow; plan: ScreenPlan; alias: ScreenAlias }[]
  /** 외부 ID 형식이 잘못된 행. 등록도 임시 레코드도 만들지 않는다. */
  invalid: { row: ImportRow; message: string }[]
}

/** 수입 계획에서 행에 부여할 레지스트리 상태. */
export const IMPORT_STATUS: Readonly<Record<keyof Omit<ImportPlan, 'invalid'>, ScreenRegistryStatus>> = {
  register: 'registered',
  duplicate_groups: 'duplicate_id',
  path_unresolved: 'path_resolution_required',
  alias_collisions: 'import_candidate',
}

function normalizePath(path: string | undefined): string | undefined {
  const trimmed = path?.trim()
  return trimmed ? trimmed.replace(/\\/g, '/') : undefined
}

/**
 * 수입 행을 분류한다 (설계 §2 4단계, §6; 보고서 §3).
 * - 같은 외부 ID 가 수입 행끼리 또는 기존 레코드와 겹치면 전부 중복 그룹으로 보낸다. 경로가 같아도 병합하지 않는다.
 * - 경로가 없는 행은 경로 확인 대상으로 분리한다.
 * - 기존 레코드의 과거 별칭과 같은 ID 는 연결 후보로만 둔다.
 */
export function planImport(existing: readonly ScreenPlan[], projectId: InternalId, rows: readonly ImportRow[]): ImportPlan {
  const plan: ImportPlan = { register: [], duplicate_groups: [], path_unresolved: [], alias_collisions: [], invalid: [] }
  const byId = new Map<string, ImportRow[]>()
  for (const row of rows) {
    const parsed = ExternalId.safeParse(row.external_id)
    if (!parsed.success) {
      plan.invalid.push({ row, message: parsed.error.issues.map((i) => i.message).join('; ') })
      continue
    }
    const group = byId.get(row.external_id) ?? []
    group.push(row)
    byId.set(row.external_id, group)
  }
  const projectPlans = existing.filter((p) => p.project_id === projectId)
  for (const [externalId, group] of byId) {
    const existingHolders = projectPlans.filter((p) => p.external_id === externalId)
    if (group.length > 1 || existingHolders.length > 0) {
      const paths = new Set<string>()
      for (const r of group) paths.add(normalizePath(r.path) ?? '<경로 없음>')
      for (const p of existingHolders) paths.add(normalizePath(p.path) ?? '<경로 없음>')
      plan.duplicate_groups.push({ external_id: externalId, rows: group, existing: existingHolders, paths_differ: paths.size > 1 })
      continue
    }
    const row = group[0]
    if (row === undefined) continue
    const aliasHit = findAliasHolder(projectPlans, externalId)
    if (aliasHit !== undefined) {
      plan.alias_collisions.push({ row, ...aliasHit })
      continue
    }
    if (normalizePath(row.path) === undefined) {
      plan.path_unresolved.push(row)
      continue
    }
    plan.register.push(row)
  }
  return plan
}

function findAliasHolder(plans: readonly ScreenPlan[], externalId: string): { plan: ScreenPlan; alias: ScreenAlias } | undefined {
  for (const plan of plans) {
    const alias = plan.aliases.find((a) => a.external_id === externalId)
    if (alias !== undefined) return { plan, alias }
  }
  return undefined
}

// ---------------------------------------------------------------------------
// 임시 레코드 → 공식 레지스트리 승격
// ---------------------------------------------------------------------------

/** 임시 레코드를 공식 레지스트리에 합칠 수 있는지 — 같은 ID 의 다른 레코드가 남아 있거나 경로가 없으면 불가 (설계 §6 "해결 전 합치지 않는다"). */
export function canPromoteToRegistry(plans: readonly ScreenPlan[], plan: ScreenPlan): RuleDecision {
  const reasons: RuleReason[] = []
  if (plan.registry_status === OFFICIAL_REGISTRY_STATUS) {
    reasons.push({ code: 'external_id.already_registered', message: `'${plan.external_id}' 는 이미 공식 레지스트리에 있다` })
  }
  const unique = checkExternalIdUnique(plans, plan.project_id, plan.external_id, { exclude_plan_id: plan.id })
  reasons.push(...unique.reasons)
  if (normalizePath(plan.path) === undefined) {
    reasons.push({ code: 'external_id.path_required', message: `'${plan.external_id}' 의 파일 경로가 확인되지 않았다 — 경로 이동·폐기 여부를 사람이 정한 뒤 등록한다 (설계 §15, 보고서 §3)` })
  }
  return decide(reasons)
}

/** 임시 레코드를 공식 레지스트리로 승격한 새 ScreenPlan 을 돌려준다. 원본 객체는 바꾸지 않는다. */
export function promoteToRegistry(plans: readonly ScreenPlan[], plan: ScreenPlan): ScreenPlan {
  assertAllowed(canPromoteToRegistry(plans, plan), `'${plan.external_id}' 를 공식 레지스트리에 합칠 수 없다`)
  return { ...plan, registry_status: OFFICIAL_REGISTRY_STATUS }
}

// ---------------------------------------------------------------------------
// 명시적 개명·경로 이동 — 별칭 이력 필수, 일괄 API 없음
// ---------------------------------------------------------------------------

/** 개명·경로 이동 요청. 사유·행위자·시점이 모두 있어야 한다 (설계 §6 명시적 변경 작업; 설계 §2 행위자·시점 기록). */
export interface ExternalIdChange {
  /** 새 외부 ID. 경로만 옮기면 현재 ID 를 그대로 넣는다. */
  new_external_id: string
  new_path?: string | undefined
  reason: string
  actor: string
  at: string
}

/** 개명 가능 판정. 한 화면(ScreenPlan) 한 건만 다룬다 — 일괄 개명은 제공하지 않는다 (개발프롬프트: SP 번호로 일괄 변경 금지). */
export function canRenameExternalId(plans: readonly ScreenPlan[], plan: ScreenPlan, change: ExternalIdChange): RuleDecision {
  const reasons: RuleReason[] = []
  if (change.reason.trim() === '') {
    reasons.push({ code: 'external_id.rename.reason_required', message: '개명·경로 이동에는 사유가 필요하다 (설계 §6 명시적 변경 작업)' })
  }
  if (change.actor.trim() === '') {
    reasons.push({ code: 'external_id.rename.actor_required', message: '개명·경로 이동에는 행위자가 필요하다 (설계 §2: 행위자·시점을 남긴다)' })
  }
  if (!IsoDateTime.safeParse(change.at).success) {
    reasons.push({ code: 'external_id.rename.at_required', message: '개명·경로 이동 시점은 ISO 8601 시각이어야 한다' })
  }
  const parsedId = ExternalId.safeParse(change.new_external_id)
  if (!parsedId.success) {
    reasons.push({ code: 'external_id.invalid', message: `새 외부 ID 형식이 잘못됐다: ${parsedId.error.issues.map((i) => i.message).join('; ')}` })
  }
  const idChanged = change.new_external_id !== plan.external_id
  const pathChanged = change.new_path !== undefined && normalizePath(change.new_path) !== normalizePath(plan.path)
  if (!idChanged && !pathChanged) {
    reasons.push({ code: 'external_id.rename.no_change', message: '바뀌는 것이 없다 — 외부 ID 또는 경로 중 하나는 달라야 한다' })
  }
  if (idChanged && parsedId.success) {
    reasons.push(...checkExternalIdUnique(plans, plan.project_id, change.new_external_id, { exclude_plan_id: plan.id }).reasons)
  }
  return decide(reasons)
}

/**
 * 외부 ID 개명 또는 경로 이동. 이전 ID·경로를 별칭 이력에 남긴 새 ScreenPlan 을 돌려준다.
 * - 내부 UUID(`id`)는 바뀌지 않는다. 내부 관계는 UUID 로 보존된다 (설계 §6).
 * - 과거 ScreenRevision 의 `external_id` 는 이 함수가 건드리지 않는다 — 과거 승인본은 당시 ID 를 유지한다 (설계 §6).
 */
export function renameExternalId(plans: readonly ScreenPlan[], plan: ScreenPlan, change: ExternalIdChange): ScreenPlan {
  assertAllowed(canRenameExternalId(plans, plan, change), `'${plan.external_id}' 를 '${change.new_external_id}' 로 바꿀 수 없다`)
  const lastAlias = plan.aliases[plan.aliases.length - 1]
  const validFrom = lastAlias?.valid_to ?? plan.created_at
  const alias: ScreenAlias = {
    external_id: plan.external_id,
    valid_from: validFrom,
    valid_to: change.at,
    reason: `${change.reason} (행위자: ${change.actor})`,
    ...(plan.path !== undefined ? { path: plan.path } : {}),
  }
  const nextPath = change.new_path !== undefined ? change.new_path : plan.path
  return {
    ...plan,
    external_id: change.new_external_id,
    aliases: [...plan.aliases, alias],
    ...(nextPath !== undefined ? { path: nextPath } : {}),
  }
}

// ---------------------------------------------------------------------------
// 조회 — 과거 ID 로도 찾을 수 있어야 한다
// ---------------------------------------------------------------------------

/** 외부 ID 조회 결과. `via='alias'` 면 과거 ID 로 찾은 것이다. */
export interface ExternalIdMatch {
  plan: ScreenPlan
  via: 'current' | 'alias'
  alias?: ScreenAlias | undefined
}

/** 현재 ID 또는 별칭 이력으로 화면을 찾는다. 임시 레코드가 여러 개면 여러 건이 나올 수 있다 — 호출자가 검토 대상으로 표시한다. */
export function resolveExternalId(plans: readonly ScreenPlan[], projectId: InternalId, externalId: string): ExternalIdMatch[] {
  const matches: ExternalIdMatch[] = []
  for (const plan of plans) {
    if (plan.project_id !== projectId) continue
    if (plan.external_id === externalId) {
      matches.push({ plan, via: 'current' })
      continue
    }
    const alias = plan.aliases.find((a) => a.external_id === externalId)
    if (alias !== undefined) matches.push({ plan, via: 'alias', alias })
  }
  return matches
}

/** 특정 시점에 이 화면이 쓰던 외부 ID (별칭 이력 기준). 과거 승인본의 표시 ID 를 확인할 때 쓴다 (설계 §6). */
export function externalIdAt(plan: ScreenPlan, at: string): string {
  const t = Date.parse(at)
  if (Number.isNaN(t)) throw new DomainRuleError('시점을 해석할 수 없다', [{ code: 'external_id.at_invalid', message: `'${at}' 은 ISO 8601 시각이 아니다` }])
  for (const alias of plan.aliases) {
    const from = Date.parse(alias.valid_from)
    const to = alias.valid_to === undefined ? Number.POSITIVE_INFINITY : Date.parse(alias.valid_to)
    if (from <= t && t < to) return alias.external_id
  }
  return plan.external_id
}
