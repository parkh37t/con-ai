/**
 * ID 레지스트리 — IA·FN 외부 ID 의 발번·별칭·이력. (산출물 pipeline-v2 P1-05 「ID 매핑 매트릭스」)
 *
 * 산출물이 정한 ID 체계:
 *   IA `IA-2.3.1`   — REQ 1:N · AS-IS 노드 대응 표기 · 변경 사유 필수
 *   FN `FN-2.3.1-02` — IA 1개에만 소속 · 예외 기능은 정상 기능 참조
 *
 * 이 파일이 지키는 규칙 (CLAUDE.md):
 * - **발번은 사람이 한다.** `IdIssuance` 는 `by`(행위자)·`reason`(사유)·`at`(시각)이 모두 필수다.
 *   즉 행위자 없는 발번은 코드 실수로도 만들 수 없다 — parse 단계에서 막힌다.
 * - **내부 UUID 와 외부 ID 를 분리한다.** 실체는 언제나 `id: InternalId` 로 가리키고,
 *   외부 ID 는 사람이 보는 표시값일 뿐이라 개명해도 관계가 끊기지 않는다.
 * - **개명은 이력을 남긴다.** 바뀐 옛 값은 `IdAlias` 로 `valid_to`·사유와 함께 보존한다.
 *   기존 값을 덮어써 지우지 않는다.
 *
 * 여기에는 ID 를 **자동으로** 만드는 함수가 없다. 다음 번호 제안과 발번 규칙은
 * `@con-ai/domain` 의 id-registry.ts 가 맡고, 그것도 행위자·사유를 받아야만 동작한다.
 */
import { z } from 'zod'
import { Actor, ExternalId, InternalId, IsoDateTime, LocalId, NonEmptyText } from './common.js'

/**
 * IA 외부 ID — `IA-` + 마침표로 구분한 계층 번호. 예: `IA-1`, `IA-1.1`, `IA-2.3.1`.
 * 번호 자리 수(깊이)는 트리 깊이를 따르므로 고정하지 않는다.
 */
export const IA_EXTERNAL_ID_PATTERN = /^IA-[1-9][0-9]*(\.[1-9][0-9]*)*$/

/**
 * FN 외부 ID — `FN-` + 소속 IA 의 계층 번호 + `-` + 두 자리 일련번호. 예: `FN-2.3.1-02`.
 * 일련번호를 두 자리로 고정하는 것은 산출물 예시 형식(FN-2.3.1-02)을 그대로 따르기 때문이다.
 */
export const FN_EXTERNAL_ID_PATTERN = /^FN-[1-9][0-9]*(\.[1-9][0-9]*)*-[0-9]{2}$/

export const IaExternalId = z
  .string()
  .regex(IA_EXTERNAL_ID_PATTERN, 'IA 외부 ID 형식은 IA-2.3.1 이다 (계층 번호, 각 자리는 1 이상)')
  .describe('IA 외부 ID (산출물 ID 체계)')

export const FnExternalId = z
  .string()
  .regex(FN_EXTERNAL_ID_PATTERN, 'FN 외부 ID 형식은 FN-2.3.1-02 이다 (소속 IA 계층 번호 + 두 자리 일련번호)')
  .describe('FN 외부 ID (산출물 ID 체계)')

/** 이 레지스트리가 다루는 계층. REQ·SCR 은 기존 external_id 체계를 그대로 쓰므로 여기서 발번하지 않는다. */
export const IdLayer = z.enum(['ia', 'fn']).describe('ID 발번 대상 계층')

/**
 * 발번 기록 — 누가·언제·왜 이 외부 ID 를 붙였는가.
 * 세 필드가 모두 필수인 것이 이 스키마의 존재 이유다. 사람 없는 발번을 타입 수준에서 막는다.
 */
export const IdIssuance = z
  .object({
    by: Actor.describe('발번한 사람 (사람이 승인해야 ID 가 생긴다)'),
    at: IsoDateTime.describe('발번 시각'),
    reason: NonEmptyText.describe('발번 사유. 빈 값·공백만은 거부한다'),
  })
  .describe('ID 발번 기록 — 행위자·시각·사유가 모두 필요하다')

/**
 * 별칭(옛 외부 ID) 한 건. 개명하면 옛 값이 여기로 내려온다.
 * `valid_to` 가 있으면 그 시점부터 이 값은 현재 값이 아니다.
 */
export const IdAlias = z
  .object({
    external_id: ExternalId.describe('당시 외부 ID'),
    valid_from: IsoDateTime.describe('이 값이 현재 값이었던 시작 시각'),
    valid_to: IsoDateTime.optional().describe('현재 값에서 내려온 시각. 없으면 아직 현재 값'),
    reason: NonEmptyText.describe('바꾼 사유 (개명은 사유 없이 하지 않는다)'),
    by: Actor.describe('바꾼 사람'),
  })
  .describe('외부 ID 별칭·이력 한 건')

/** 기능 종류 — 정상 기능과 예외 기능. 예외 기능은 어떤 정상 기능의 예외인지 가리켜야 한다 (산출물 ID 표). */
export const FunctionKind = z.enum(['normal', 'exception']).describe('기능 종류 (산출물: 예외 기능은 정상 기능 참조)')

/**
 * FN 이 가리키는 화면 요소·동작 한 건.
 * ScreenSpec 을 건드리지 않고 「어떤 요소가 이 기능에 속하는가」를 표현하기 위해 FN → 요소 방향으로 둔다.
 * 화면을 다시 생성해 요소 ID 가 바뀌면 이 참조는 고아가 되며, RTM 이 그 사실을 stale 로 보고한다
 * (자동 복구는 하지 않는다 — 사람이 다시 연결한다).
 */
export const FunctionElementRef = z
  .object({
    screen_plan_id: InternalId.describe('대상 화면 (내부 UUID)'),
    element_or_action_id: LocalId.describe('화면명세 안의 요소·동작 로컬 ID'),
  })
  .describe('FN → 화면 요소·동작 참조')

/**
 * 기능(FN) 한 건. IANode 문서 **안에** 배열로 산다.
 * 「FN 은 IA 1개에만 소속」이 교차참조 검사가 아니라 저장 위치의 불변식이 되는 것이 이 배치의 이유다 —
 * 한 문서 안에만 존재하므로 두 IA 에 동시에 매달릴 수 없다.
 */
export const FunctionEntry = z
  .object({
    id: InternalId.describe('내부 UUID. 외부 ID 를 개명해도 이 값은 바뀌지 않는다'),
    name: NonEmptyText.describe('기능 이름'),
    kind: FunctionKind.default('normal'),
    /** 아직 발번하지 않았으면 없다. 없는 것을 «미발번» 으로 표시하고 임의로 채우지 않는다. */
    external_id: FnExternalId.optional().describe('발번된 FN 외부 ID. 없으면 미발번'),
    issued: IdIssuance.optional().describe('external_id 가 있으면 함께 있어야 한다'),
    aliases: z.array(IdAlias).optional().describe('개명 이력'),
    base_function_id: InternalId.optional().describe('예외 기능이 참조하는 정상 기능 (kind=exception 이면 필수)'),
    element_refs: z.array(FunctionElementRef).optional().describe('이 기능에 속하는 화면 요소·동작'),
    note: z.string().optional(),
  })
  .superRefine((fn, ctx) => {
    if (fn.external_id !== undefined && fn.issued === undefined) {
      ctx.addIssue({ code: 'custom', path: ['issued'], message: '외부 ID 가 있으면 발번 기록(누가·언제·왜)이 있어야 한다' })
    }
    if (fn.kind === 'exception' && fn.base_function_id === undefined) {
      ctx.addIssue({ code: 'custom', path: ['base_function_id'], message: '예외 기능은 어떤 정상 기능의 예외인지 가리켜야 한다 (산출물 ID 표)' })
    }
    if (fn.kind === 'normal' && fn.base_function_id !== undefined) {
      ctx.addIssue({ code: 'custom', path: ['base_function_id'], message: '정상 기능은 다른 기능을 예외 참조로 가리키지 않는다' })
    }
    if (fn.base_function_id !== undefined && fn.base_function_id === fn.id) {
      ctx.addIssue({ code: 'custom', path: ['base_function_id'], message: '기능은 자기 자신의 예외일 수 없다' })
    }
  })
  .describe('FunctionEntry (FN) — IANode 문서 안에 산다')

export type IdLayer = z.infer<typeof IdLayer>
export type IdIssuance = z.infer<typeof IdIssuance>
export type IdAlias = z.infer<typeof IdAlias>
export type FunctionKind = z.infer<typeof FunctionKind>
export type FunctionElementRef = z.infer<typeof FunctionElementRef>
export type FunctionEntry = z.infer<typeof FunctionEntry>
