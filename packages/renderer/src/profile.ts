/**
 * S2B 학습 규격 프로파일 — 세로 조각 계약 §4.
 *
 * 출처: 설계 §9 (페이지 .root-shell/.screen-wrap/#right-panel, 팝업 .popup-shell/.spec-side, 설명 순서 8단계,
 *       영역 번호와 영역 안 a/b/c 는 같은 데이터에서 생성, 영역마다 반복되는 a 는 전역 중복 아님, 검색 초기화 버튼 제거는 프로파일 규칙),
 *       보고서 §5 (shell·설명 순서·영역별 번호·검색 영역 규칙을 프로젝트 프로파일로 옮김).
 *
 * `rules` 는 프롬프트 템플릿(GenerationContext.profile_rules)에도 그대로 들어가는 규격 요약 문장이다.
 * 이 규칙은 승인된 프로파일(s2b-learned-v1)에만 적용하며 모든 프로젝트에 강제하지 않는다 (설계 §9).
 */
import type { RenderProfile } from './types.js'

export const S2B_LEARNED_PROFILE: RenderProfile = {
  id: 's2b-learned-v1',
  name: 'S2B 학습 규격 v1',
  page_shell: { root: 'root-shell', screen: 'screen-wrap', panel: 'right-panel' },
  popup_shell: { root: 'popup-shell', screen: 'popup-wrap', panel: 'spec-side' },
  description_order: ['screen_id', 'overview', 'cases', 'flow', 'policy', 'data_mapping', 'sections', 'messages'],
  numbering: { section: 'number', element: 'alpha' },
  rules: [
    '페이지 shell: .root-shell 안에서 화면 목업(.screen-wrap)과 우측 설명(#right-panel)을 분리한다. 포털 GNB 와 breadcrumb 는 목업 머리에 둔다.',
    '팝업 shell: .popup-shell 과 .spec-side 를 쓴다. 페이지 구조(GNB·LNB·breadcrumb)를 팝업에 기계적으로 복사하지 않는다.',
    '우측 설명 순서: 화면 ID 제목 → 화면명·목적·REQ(요구사항·수용조건 ID) → CASE 표 → 처리 흐름 → 정책 → 근거가 있는 데이터 매핑 → 영역·필드 설명 → 메시지 표.',
    '영역 번호는 1, 2, 3 이고 영역 안 요소는 a, b, c 다. 요소 번호는 영역마다 다시 시작하며 영역마다 반복되는 a 는 전역 중복 오류가 아니다. 내부 요소 ID 와 표시 번호는 구분한다.',
    '화면의 번호 배지와 설명의 번호는 같은 element_index 에서 만든다. 화면과 설명을 따로 쓰고 나중에 문자열로 맞추지 않는다.',
    '검색 영역에 초기화(리셋) 버튼을 두지 않는다. 검색 버튼 하나로 더미데이터를 거른다.',
    '동작은 제한 목록만 쓴다: 검색=더미데이터 필터, 정렬=명세 기본 정렬, 팝업=대상 화면 ID 를 보여주는 간단 모달, 다운로드=명세 컬럼으로 만든 CSV 예제 파일, CASE 전환=data-case.',
    '실제 업무 API·거래·개인정보 조회는 연결하지 않는다. 표의 값은 CASE 의 fixture_id 가 가리키는 더미데이터이며 화면 숫자와 설명 숫자는 같은 데이터에서 만든다.',
    'HTML 은 오프라인 단일 파일이다. 외부 CDN·웹폰트·이미지 참조를 넣지 않고 CSS·JS 는 인라인으로 둔다.',
    '결과물은 웹앱이 아니라 흰 바탕의 화면설계서다. 영역은 둥근 카드에 좌상단 검은 사각 번호 배지, 요소는 라벨 앞 파란 원형 배지, 표는 회색 머리·얇은 테두리, 버튼은 검은 채움(주요)과 흰 배경 테두리(보조) 두 단계로 렌더된다. 영역 제목·요소 라벨에 번호를 직접 적지 않는다(번호는 배지가 붙인다).',
    '모든 영역·요소와 설명 항목에 data-element-id / data-section-id / data-display-no 를 붙여 클릭 코멘트와 검증이 같은 ID 를 쓴다.',
  ],
}
