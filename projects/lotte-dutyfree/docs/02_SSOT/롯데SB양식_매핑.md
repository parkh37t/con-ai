# 롯데 표준 SB 양식 → 2단 화면설계서 매핑 (골든 프로파일) — SSOT

> **목적**: 롯데 AI 테스트에서 드러난 **GAP-1(표준 양식 미준수)**를 구조적으로 영구 해소한다.
> 롯데 정답 SB(PPTX)의 표준 양식 요소를 우리 2단 HTML 화면설계서의 **공용 8단 디스크립션**에 1:1로 흡수해,
> wylie-screen이 **롯데 정답 양식 그대로** 양산하도록 한다.
>
> **골든 파일**: `화면설계/_공통/프로토타입_템플릿/lotte-sb-golden.html` (복제 → 개조, 백지 생성 금지)
> **DS**: `lotte-front.css`

---

## 0. 원칙 — 공용 8단은 불변, 롯데 요소는 "흡수 + 전용 2종"

- 공용 **8단 고정 순서**(CLAUDE.md §2)는 **깨지 않는다**.
- 롯데 SB 양식 요소는 8단 슬롯 안에 **흡수**하거나, 메타/푸터 존에 **롯데 전용 2종**(개정이력·End)으로만 추가한다.
- 즉 롯데 양식 = **공용 8단의 "롯데 프로파일"**. 다른 프로젝트의 8단과 호환된다.

---

## 1. 매핑표 — 롯데 SB 양식 요소 ↔ 8단 슬롯

| 롯데 정답 SB 양식 요소 | 우리 위치(슬롯) | 구현(골든) |
|---|---|---|
| **표지**(화면ID·화면명·작성자·작성일·버전) | ① 화면ID `rp-h2` + ② `info-table` **표지 메타 행**(`th.cover`) | 화면ID=h2, 작성자·버전·작성일=info-table 하단 cover 행 |
| **JIRA 메타**(요건 연결) | ② `info-table` 요구사항 행 + cover JIRA 행 | `req-badge`(요건ID) + `th.cover`(JIRA 키) |
| **개정이력**(Revision History) | **[롯데 전용]** ②와 ③ 사이 메타존 | `rev-tbl`(일자·버전·변경내용·작성) |
| **Description**(항목별 상세) | ⑦ 필드 사양 매트릭스 `fs-matrix` | 좌측 마커와 1:1, No·필드·타입·값/규칙·비고 |
| **번역표**(다국어) | ⑥ 데이터 매핑 | `info-table`(국/간/영/일) — 롯데 강조 |
| **처리/분기** | ④ proc | Mermaid `flowchart` 우선, 단순 시 `proc-table` |
| **정책/비고** | ⑤ policy | `policy-box` |
| **케이스/상태 전환** | ③ CASE | `case-chip` → 좌측 실제 변경 |
| **메시지/검증** | ⑧ msg-tbl(맨 아래) | `msg-tbl` — right-panel 내부 마지막 표 |
| **End**(문서 종료) | **[롯데 전용]** msg-tbl 직후 푸터 | `doc-end`("— END OF SB · 화면ID —") |

> 좌측(실제 화면)에는 GNB·LNB·브레드크럼·`section-box`(마커 1·2…)가 그대로. 우측이 위 매핑을 따른다.

---

## 2. 최종 디스크립션 순서 (롯데 프로파일)

```
① 화면ID (rp-h2)
② info-table  ──┐ 화면명 · 화면목적 · 요구사항(요건ID)
                └ [표지 메타] JIRA · 작성자 · 버전(작성일)   ← th.cover 강조
   [개정이력]  rev-tbl                                      ← 롯데 전용①
③ CASE 전환
④ proc (flowchart/proc-table)
⑤ policy
⑥ 데이터매핑 · 번역표(국/간/영/일)
⑦ spec (fs-matrix, 좌측 마커 1:1)
⑧ msg-tbl (맨 아래, right-panel 내부 마지막 표)
   [End]  doc-end                                          ← 롯데 전용②
```

- **불변식 유지**: msg-tbl 은 여전히 right-panel **내부 마지막 "표"**(html-lint 패턴 14 통과). `doc-end` 는 표가 아닌 푸터 `<div>` 라 패턴 14에 영향 없음.

---

## 3. GAP → 해소 매핑 (검증 가능)

| 롯데 AI 갭 | 이 골든이 강제하는 것 |
|---|---|
| GAP-1 양식 미준수 | 표지 메타·개정이력·번역표·Description·End **모두 슬롯 고정** |
| GAP-3 메타 임의(MFPD1·기획AI) | **3대 키 일치**(data-page=화면ID=파일명=개발목록) + 작성자 규칙(Wylie·검수 기획자) |
| GAP-2 분량 빈약 | 좌측 마커 전수 → ⑦ spec 행 전수(마커 1:1 강제) |
| GAP-4 일관성 부재 | html-lint·audit_markers·verify 게이트 통과가 양산 조건 |

---

## 4. 사용 절차 (wylie-screen)

1. `lotte-sb-golden.html` **복제** → `화면설계/<포털>/<화면ID>.html` (백지 금지).
2. `[대괄호]` 플레이스홀더를 SSOT(작업가이드·요건·더미데이터_사전)로 치환. **더미 창작 금지**.
3. 좌측 `section-box` 마커(1·2…/a·b·c)와 우측 `fs-matrix` 를 **1:1**로 맞춘다.
4. CASE 칩이 좌측을 실제 변경하도록 `setCase` 개조(예: `gnb-bar.classList.toggle('tobe')`).
5. 표지 메타·개정이력·번역표·End 를 채운다(빈 값도 행은 유지 — 양식 강제).
6. 검증: `python3 .claude/hooks/html-lint.py <file>` → `python scripts/audit_markers.py` → 로컬 http 서버 확인. **`file://` 금지**.

---

## 5. 실증

- `화면설계/프론트/front-home-main.html` (PD-4247) — **골든 기준 리빌드 완료**: 표지 메타(JIRA·작성자·버전 cover행)·개정이력·번역표·End 전부 정합, 8단 순서(정책→데이터매핑→spec) 적용. html-lint 0·audit 0·verify 0·미러 0 통과.
- 대조: `docs/pd4247-comparison.html` — Claude SB(정적) vs 본 양식(인터랙티브·검증).
