/**
 * XLSX 가져오기 설정 — XlsxImportConfig. 초안(변경 예정).
 *
 * 출처: 설계 §4 (범용 자동 추론 대신 시트·헤더·ID 열을 확인하는 가져오기 설정; 프로젝트별 규칙 저장 — 현재 원장의 SFR 시트 A열),
 *       보고서 §3 (시트 전체 정규식 검색은 부모 ID 까지 잡으므로 지정한 ID 열 기준으로 수입), 개발프롬프트 2항 (원문 위치 보존).
 */
import { z } from 'zod'
import { InternalId, IsoDateTime, NonEmptyText, Revision } from './common.js'

/** 열 문자 (A, B, …, AA). */
export const ColumnLetter = z.string().regex(/^[A-Z]{1,3}$/, '열은 A~ZZZ 형식의 열 문자').describe('열 문자')

/** 요구사항 필드 ↔ 열 매핑의 필드 이름 (RequirementRevision 의 필드 + 참고 열). */
export const XlsxRequirementField = z.enum(['title', 'body', 'scope', 'category', 'priority', 'owner', 'note']).describe('열 매핑 대상 필드')

export const XlsxImportConfig = z
  .object({
    id: InternalId.optional(),
    project_id: InternalId.describe('프로젝트별 규칙 (설계 §4)'),
    name: NonEmptyText.describe('규칙 이름 (예: 요구사항 원장 SFR 시트)'),
    revision: Revision.optional(),
    sheet: NonEmptyText.describe('시트 이름 (설계 §4)'),
    header_row: z.int().min(1).describe('헤더 행 (1 부터; 설계 §4)'),
    data_row_start: z.int().min(1).optional().describe('데이터 시작 행. 생략하면 header_row+1'),
    id_column: ColumnLetter.describe('ID 열 (설계 §4; 보고서 §3 지정 ID 열 기준)'),
    id_pattern: z.string().optional().describe('ID 형식 정규식 (문자열). 맞지 않는 값은 건너뛰지 않고 검토 대상으로 남긴다'),
    columns: z.partialRecord(XlsxRequirementField, ColumnLetter).default({}).describe('필드 ↔ 열 매핑'),
    skip_empty_id: z.boolean().default(true).describe('ID 빈 행 건너뛰기 (건너뛴 행 수는 결과에 기록)'),
    created_at: IsoDateTime.optional(),
  })
  .superRefine((cfg, ctx) => {
    if (cfg.data_row_start !== undefined && cfg.data_row_start <= cfg.header_row) {
      ctx.addIssue({ code: 'custom', path: ['data_row_start'], message: '데이터 시작 행은 헤더 행보다 커야 한다' })
    }
    for (const [field, col] of Object.entries(cfg.columns)) {
      if (col === cfg.id_column) ctx.addIssue({ code: 'custom', path: ['columns', field], message: `필드 ${field} 의 열이 ID 열(${cfg.id_column})과 같다` })
    }
    if (cfg.id_pattern !== undefined) {
      try {
        new RegExp(cfg.id_pattern)
      } catch {
        ctx.addIssue({ code: 'custom', path: ['id_pattern'], message: 'id_pattern 이 유효한 정규식이 아니다' })
      }
    }
  })
  .describe('XlsxImportConfig (설계 §4)')

export type XlsxImportConfig = z.infer<typeof XlsxImportConfig>
export type XlsxImportConfigInput = z.input<typeof XlsxImportConfig>
