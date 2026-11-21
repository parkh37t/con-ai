/**
 * 공통 타입 — 초안(변경 예정).
 *
 * 출처: 설계 §6 (데이터 모델과 버전 원칙: 내부 UUID 와 외부 ID 분리, 원본 불변, content hash),
 *       설계 §11 (revision 기반 충돌 검사), 설계 §8 (원문 anchor 기록).
 * 모든 도메인 스키마가 이 파일의 타입을 조합해 만든다.
 */
import { z } from 'zod'

/** 내부 UUID. 외부 ID 와 분리하며 내부 관계는 항상 이 값으로 보존한다 (설계 §6). */
export const InternalId = z.uuid().describe('내부 UUID. 외부 ID 와 분리하며 내부 관계는 UUID 로 보존한다 (설계 §6)')

/**
 * 외부 ID — 사용자에게 익숙한 기존 ID (기존 화면 ID, 외부 REQ ID, baseline ID 등).
 * 프로젝트 내 현재 외부 ID 는 유일해야 하지만(설계 §6) 유일성은 저장소/도메인 규칙에서 검사한다.
 * 새 `SP-...` 번호를 기존 ID 대신 강제하지 않는다.
 */
export const ExternalId = z
  .string()
  .min(1, '외부 ID 는 비어 있을 수 없다')
  .regex(/^\S+$/, '외부 ID 에는 공백을 쓸 수 없다')
  .describe('외부 ID(문자열). 프로젝트 내 현재 값은 유일. 내부 UUID 와 별도 (설계 §6)')

/**
 * 명세 안에서만 유효한 로컬 ID (영역·요소·동작·CASE·메시지).
 * 표시 번호(a/b/c, ①②③)와 구분한다 (설계 §9: 내부 요소 ID 와 표시 번호를 구분).
 */
export const LocalId = z
  .string()
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/, '로컬 ID 는 영숫자로 시작하고 영숫자·. _ : - 만 쓴다')
  .describe('화면명세 안에서만 유효한 로컬 ID. 표시 번호와 구분한다 (설계 §9)')

/** revision — 1 부터 시작하는 정수. 동시 편집 충돌 검사와 PATCH 의 필수 값 (설계 §11, §13). */
export const Revision = z.int().min(1).describe('revision (정수, 1 부터). 오래된 저장을 차단하는 기준 (설계 §11)')

/** content hash — SHA-256 소문자 hex 64자. 산출물·승인·검증 결과를 정확한 내용에 고정한다 (설계 §6, §10, §11). */
export const ContentHash = z
  .string()
  .regex(/^[0-9a-f]{64}$/, 'content hash 는 SHA-256 소문자 hex 64자')
  .describe('SHA-256 hex (소문자 64자). 산출물·승인·검증 결과를 고정하는 키 (설계 §6)')

/** ISO 8601 시각 (시간대 오프셋 허용). */
export const IsoDateTime = z.iso.datetime({ offset: true }).describe('ISO 8601 시각 (오프셋 허용)')

/** 사람 식별자(작성자·승인자·담당). 파일럿에서는 한 사람이 여러 역할을 맡지만 승인자·시점은 남긴다 (설계 §2). */
export const Actor = z.string().min(1).describe('작성자·승인자·담당 식별자 (설계 §2: 승인자·대상 버전·승인 시점을 남긴다)')

/** 비어 있지 않은 텍스트 (제목·목적·설명 등). 앞뒤 공백은 제거한다. */
export const NonEmptyText = z.string().trim().min(1, '빈 문자열은 허용하지 않는다').describe('비어 있지 않은 텍스트')

/**
 * 출처 anchor 참조. 본체는 source.ts 의 SourceAnchor.
 * 매핑·데이터 매핑·비UI 작업의 "근거"는 이 참조 목록으로 표현한다 (설계 §6 SourceAnchor, §7 근거 확인, §8 원문 anchor 기록).
 */
export const AnchorRef = z
  .object({
    anchor_id: InternalId.describe('SourceAnchor 의 내부 UUID'),
    note: z.string().optional().describe('이 근거를 인용한 이유·해석 (선택)'),
  })
  .describe('출처 anchor 참조 (설계 §6 SourceAnchor)')

export type InternalId = z.infer<typeof InternalId>
export type ExternalId = z.infer<typeof ExternalId>
export type LocalId = z.infer<typeof LocalId>
export type Revision = z.infer<typeof Revision>
export type ContentHash = z.infer<typeof ContentHash>
export type IsoDateTime = z.infer<typeof IsoDateTime>
export type AnchorRef = z.infer<typeof AnchorRef>
