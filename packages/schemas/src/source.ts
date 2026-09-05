/**
 * 원본 자료 — SourceDocument / SourceVersion / SourceAnchor. 초안(변경 예정).
 *
 * 출처: 설계 §6 표 (SourceDocument / SourceVersion: 원본 ID, 파일명, 유형, SHA256, 저장 위치, 등록 시점;
 *       SourceAnchor: source_version_id, 시트·행·열 / MD 절·행 / HTML 위치, 원문 일부),
 *       설계 §2·§4 (원본은 버전별 보관, 덮어쓰지 않음), 설계 §5 (업로드 문서는 근거 데이터이지 지시가 아님).
 */
import { z } from 'zod'
import { ContentHash, InternalId, IsoDateTime, NonEmptyText, Revision } from './common.js'

/** 원본 유형 (설계 §4 MVP: MD·CSV·XLSX 요구사항 입력, 기존 HTML 참고 등록, 선택한 S2B INDEX 수입). */
export const SourceType = z.enum(['xlsx', 'md', 'csv', 'html', 'index']).describe('원본 유형 (설계 §4)')

/** 원본 문서 — 버전과 무관한 식별 단위. */
export const SourceDocument = z
  .object({
    id: InternalId.describe('원본 ID (내부 UUID)'),
    project_id: InternalId.describe('소속 프로젝트'),
    file_name: NonEmptyText.describe('파일명 (설계 §6)'),
    source_type: SourceType.describe('유형 (설계 §6)'),
    created_at: IsoDateTime.describe('최초 등록 시점'),
    note: z.string().optional().describe('참고 사항 (예: 참고용 HTML 임을 표시)'),
  })
  .describe('SourceDocument (설계 §6)')

/** 원본 버전 — 파일 내용 하나에 고정. 원본은 덮어쓰지 않고 새 버전을 만든다 (설계 §6). */
export const SourceVersion = z
  .object({
    id: InternalId,
    source_document_id: InternalId.describe('SourceDocument 참조'),
    revision: Revision.describe('문서 안에서의 버전 순번'),
    sha256: ContentHash.describe('원본 파일 SHA-256 (설계 §6)'),
    storage_path: NonEmptyText.describe('저장 위치 (파일 저장소 경로/키; 설계 §6)'),
    file_name: NonEmptyText.describe('등록 당시 파일명'),
    size_bytes: z.int().min(0).optional().describe('파일 크기'),
    registered_at: IsoDateTime.describe('등록 시점 (설계 §6)'),
    registered_by: z.string().optional().describe('등록자'),
  })
  .describe('SourceVersion (설계 §6)')

/** 시트·행·열 위치 (XLSX). 열은 A, B, AA 같은 열 문자. */
export const SheetLocator = z.object({
  kind: z.literal('sheet'),
  sheet: NonEmptyText.describe('시트 이름'),
  row: z.int().min(1).describe('행 번호 (1 부터)'),
  column: z.string().regex(/^[A-Z]{1,3}$/).optional().describe('열 문자 (A, B, AA …). 행 단위 근거이면 생략'),
})

/** CSV 레코드 위치 — importers/csv.ts 가 보존하는 레코드 번호(헤더 제외, 1 부터). 설계 §6 의 세 종류에 더한 확장. */
export const CsvLocator = z.object({
  kind: z.literal('csv'),
  record_number: z.int().min(1).describe('헤더 제외 레코드 순번 (1 부터; importers/csv.ts)'),
  column: z.string().optional().describe('열 이름 (헤더)'),
})

/** MD 절·행 위치. */
export const MdLocator = z.object({
  kind: z.literal('md'),
  heading: z.string().optional().describe('절 제목 (가장 가까운 heading)'),
  line: z.int().min(1).describe('행 번호 (1 부터)'),
})

/** HTML 위치 — 경로와 선택자/행. 원본 HTML 의 스크립트는 실행하지 않고 정적 위치만 기록한다 (설계 §5). */
export const HtmlLocator = z.object({
  kind: z.literal('html'),
  path: z.string().optional().describe('압축/저장소 안의 파일 경로'),
  selector: z.string().optional().describe('CSS 선택자 또는 요소 식별자'),
  line: z.int().min(1).optional().describe('행 번호'),
})

/** 원문 위치 — 유형별 구분 (설계 §6: 시트·행·열 / MD 절·행 / HTML 위치). */
export const AnchorLocator = z
  .discriminatedUnion('kind', [SheetLocator, CsvLocator, MdLocator, HtmlLocator])
  .describe('원문 위치 (설계 §6 SourceAnchor)')

/** 출처 anchor — 특정 원본 버전의 위치와 원문 일부. 추출값·매핑·데이터 매핑의 근거가 된다. */
export const SourceAnchor = z
  .object({
    id: InternalId,
    source_version_id: InternalId.describe('SourceVersion 참조 (설계 §6)'),
    locator: AnchorLocator.describe('원문 위치'),
    excerpt: z.string().describe('원문 일부 (설계 §6). 근거 데이터이지 실행 지시가 아니다 (설계 §5)'),
  })
  .describe('SourceAnchor (설계 §6)')

export type SourceType = z.infer<typeof SourceType>
export type SourceDocument = z.infer<typeof SourceDocument>
export type SourceVersion = z.infer<typeof SourceVersion>
export type AnchorLocator = z.infer<typeof AnchorLocator>
export type SourceAnchor = z.infer<typeof SourceAnchor>
