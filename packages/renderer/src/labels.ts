/** 설명·화면에 쓰는 한국어 라벨 (컴포넌트·동작·CASE·메시지 종류). */

export const ELEMENT_TYPE_LABELS: Record<string, string> = {
  'text-input': '텍스트 입력',
  'number-input': '숫자 입력',
  textarea: '여러 줄 입력',
  select: '선택 목록',
  radio: '라디오',
  checkbox: '체크박스',
  'date-input': '날짜 입력',
  'date-range': '기간 입력',
  button: '버튼',
  table: '표',
  text: '텍스트',
  link: '링크',
  pagination: '페이지 이동',
}

export const ACTION_TYPE_LABELS: Record<string, string> = {
  'filter-fixture': '검색(더미데이터 필터)',
  'sort-fixture': '정렬(명세 기본 정렬)',
  'open-popup': '팝업 열기(간단 모달)',
  'close-popup': '팝업 닫기',
  'download-fixture': '다운로드(명세 컬럼 CSV 예제 파일)',
  navigate: '화면 이동(더미, 실제 이동 없음)',
  'set-state': 'CASE 전이',
}

export const CASE_KIND_LABELS: Record<string, string> = {
  normal: '정상',
  empty: '빈값',
  error: '오류',
  permission: '권한',
  processing: '처리중',
}

export const MESSAGE_KIND_LABELS: Record<string, string> = {
  info: '안내',
  success: '성공',
  warning: '경고',
  error: '오류',
  confirm: '확인',
}

export const UNRESOLVED_KIND_LABELS: Record<string, string> = {
  question: '질문',
  assumption: '가정',
  conflict: '충돌',
  missing_evidence: '근거 없음',
}

export const VALIDATION_RULE_LABELS: Record<string, string> = {
  required: '필수',
  min_length: '최소 글자수',
  max_length: '최대 글자수',
  pattern: '형식',
  range: '범위',
  date_range: '기간 범위',
}

export function labelOf(table: Record<string, string>, key: string): string {
  return table[key] ?? key
}
