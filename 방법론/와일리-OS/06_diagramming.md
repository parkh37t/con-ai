# 06 디스크립션 도식화 — 3자 공통 언어 (기획·개발·디자인)

> 리서치 결론(NN/G·Material Design·Statecharts.dev·Mermaid 공식 교차검증):
> **우측 사양은 텍스트 나열이 아니라 "다이어그램 + 매트릭스"로.** 누가 봐도 같은 해석이 나오게.

---

## A. 어떤 도식을, 누구를 위해

| 도식 | 용도 | 최대 수혜 | Mermaid 유형 |
|------|------|----------|-------------|
| **화면 전이도(Wireflow)** | 이 화면에서 도달 가능한 화면·분기 | 3자 공통(최고) | `flowchart TD` |
| **처리 흐름(Process/Decision)** | 조회·저장의 의사결정 분기 | 기획·개발 | `flowchart TD` + `{분기}` |
| **상태도(State Machine)** | 상태(등록·승인·반려·삭제) 전이 | 개발(엣지케이스) | `stateDiagram-v2` |
| **상호작용 시퀀스** | 사용자↔화면↔서버 호출 순서 | 개발 | `sequenceDiagram` |
| **필드 사양 매트릭스** | 필드별 규격 한눈에 | 3자 공통(높음) | HTML 표(`fs-matrix`) |

> NN/G: 와이어플로우는 "와이어프레임+플로우차트를 아는 사람이면 학습 불필요". Statecharts.dev: 상태도는 문서가 아니라 *사양* — 코딩 전 전 조합·엣지케이스를 강제 노출.

---

## B. 필드 사양 매트릭스 표준 (좁은 패널 5컬럼)

`No(마커) · 필드 · 타입·필수 · 기본·검증 · 동작·예외`
- **No = 좌측 `num-badge-sm` 라벨과 1:1**(audit_mirror_lr가 set 비교).
- 필수 `●` / 선택 `○`. 타입 enum(text·select·radio·date·popup·button·badge·link·toggle·range).
- 6속성(입력방식·입력값·Default·요소액션·상태변화·예외처리)을 컬럼으로 압축 — 표가 텍스트보다 스캔이 빠르다.
- 풀 컬럼(개발 핸드오프 강화 시): + Key/id · Validation · Linked-field · State · Data-binding.

---

## C. Mermaid 임베드 표준 (검증된 스니펫)

```html
<div class="diagram"><pre class="mermaid">
flowchart TD
  L["상품목록<br/>BO006"]:::cur
  L -->|"상품코드 · 일반"| R["상품등록<br/>BO007"]
  classDef cur fill:#be123c,stroke:#be123c,color:#fff;
</pre></div>
<script type="module">
  import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11.6.0/dist/mermaid.esm.min.mjs';
  mermaid.initialize({ startOnLoad:true, securityLevel:'loose', theme:'base',
    themeVariables:{ fontSize:'11px', fontFamily:"'Noto Sans KR',sans-serif" },
    flowchart:{ htmlLabels:true, nodeSpacing:24, rankSpacing:28 } });
</script>
```

**좁은 패널(360px) 규칙**
- 방향은 **TD(세로)** 고정 — LR은 가로 오버플로.
- `fontSize 11px`, `nodeSpacing/rankSpacing` 압축, 노드 텍스트 6~12자(긴 설명은 매트릭스로).
- CSS: `.diagram .mermaid svg{max-width:100%;height:auto}`.

**함정 체크리스트**
- 한글: `<meta charset="utf-8">` + `fontFamily` 지정(폰트 미탑재 시 깨짐).
- 예약어 `end`(소문자)는 `"end"`로 감쌀 것.
- 라벨 특수문자(`()`,`:`,`{}`)는 `"..."` 이스케이프.
- 동적 삽입(탭/AJAX 후 렌더) 시 `startOnLoad:false` → `await mermaid.run()`.
- 버전 핀(`@11.6.0`) — 마이너 업데이트 파손 방지.

**자기완결(Adobe Express 등 export — 외부 CDN 불가)**
- 빌드 단계 사전 렌더 SVG 인라인이 최선: `const {svg}=await mermaid.render('id',def)` → SVG 문자열 직접 삽입(런타임 JS·네트워크 0). export 대상이면 `htmlLabels:false`(SVG `<text>` 출력 → 변환기 호환↑).

---

## D. 우측 디스크립션 도식화 골격 (확정)

1. 화면ID + info-table(요구사항 REQ 아코디언)
2. 🗺️ 화면 전이도 · 🔀 처리 흐름 · 🔄 상태도 · 🔗 시퀀스 (Mermaid)
3. ⚙ Case 전환(인터랙티브)
4. 📋 필드 사양 매트릭스(영역 `num-badge` + 행 `num-badge-sm`, 좌측 1:1)
5. 🗂 데이터/API · ⚠ 예외/상태 · 📜 정책
6. 🔔 메시지·알림 정의(msg-tbl, sourceId) — 맨 아래

> 실증: `projects/shinsegae-simon-bo/화면설계/관리자/bo006·bo316`. 검증: lint·verify·mirror 전수 통과.

## E. 출처
- NN/G Wireflows: https://www.nngroup.com/articles/wireflows/
- Statecharts in UIs: https://statecharts.dev/use-case-statecharts-in-user-interfaces.html
- Material Interaction States: https://m2.material.io/design/interaction/states.html
- Mermaid flowchart/state/sequence: https://mermaid.js.org/syntax/flowchart.html · /stateDiagram.html · /sequenceDiagram.html
- Figma 핸드오프 핸드북: https://www.figma.com/blog/the-designers-handbook-for-developer-handoff/
