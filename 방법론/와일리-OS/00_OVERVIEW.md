# 와일리 OS — 멀티입력 → 프로토타입 환경 (00 개요)

> **와일리(Wylie)** = 이 워크벤치의 빌더 에이전트 페르소나.
> 미션: **어떤 기획 산출물(PPTX·PDF·HTML·Figma·이미지·Claude Design·Canva)이든 입력받아 → 학습된 S2B 방법론으로 → 어떤 프로토타입이든 산출**한다.
> 발주자: **박재하 본부장님**. (호칭·언어 규칙은 루트 `CLAUDE.md` 최상단 참조.)

---

## 1. 한 장 요약 (파이프라인 6단계)

```
[입력 산출물]          [추출]              [정규화]            [생산]             [검증]          [배포/렌더]
 PPTX/PDF      →   구조 우선 파싱    →   ScreenSpec     →   골든 복제→개조   →   lint·미러   →   HTML(SSOT)
 Figma/이미지        (+ 비전 보강)        JSON(스키마)        2단 HTML 화면설계서   audit·서버      ├ GitHub Pages
 HTML/Claude설계     ─────────────       ───────────         ─────────────       ─────────       ├ Figma(use_figma)
 Canva                01_intake-router    03_screenspec       screen-spec 스킬     04_knowhow      ├ Adobe Express
                                          .schema.json        +template_screen     §검증           └ Canva
```

**핵심 원칙: 2단 HTML 화면설계서가 SSOT(단일 진실원).** Figma·Express·Canva는 *렌더 타깃*일 뿐, 진실원이 아니다. 라운드트립으로 되돌릴 때도 HTML→타깃 방향이 기준.

---

## 2. 왜 ScreenSpec(중간 JSON)을 거치는가

입력이 제각각(PPTX·이미지·Figma)이어도 **하나의 정규 스펙으로 수렴**시키면:
- 생산 단계가 입력 종류와 **무관**해진다(라우터만 갈아끼움).
- **마커 1:1 미러**를 LLM 추측이 아니라 *코드로* 생성 → 좌/우 개수·순서가 구조적으로 보장.
- **더미데이터 드리프트**·**환각 필드**를 `dummyRef`/`sourceId` 그라운딩으로 차단.

스키마: `03_screenspec-schema.md` · 기계용 스키마: `screenspec.schema.json` · 실증 예시: `examples/BO006.screenspec.json`.

---

## 3. 구성 요소 ↔ Claude Code 메커니즘 매핑

| 단계 | 담당 메커니즘 | 위치 |
|------|--------------|------|
| 인테이크·라우팅 | 라우터 문서 + 서브에이전트 팬아웃 | `01_intake-router.md` |
| 방법론(규칙·골든) | **스킬** + 템플릿 (매 세션 X, 호출 시 로드) | `.claude/skills/screen-spec/` · `방법론/templates/` |
| 정규 스펙 | JSON 스키마(strict tool 구조화 추출) | `screenspec.schema.json` |
| 생산 | 골든 복제→개조 (백지 금지) | `screen-spec` 스킬 |
| 검증 게이트 | **훅**(PostToolUse lint) + 스크립트 | `.claude/hooks/html-lint.py` · `scripts/*` |
| 외부 렌더 | **MCP**(Figma·Adobe·Canva) | `02_mcp-capability-map.md` |
| 학습·축적 | CLAUDE.md(사실)·스킬(절차)·노하우(이 폴더) | 본 폴더 + `CLAUDE.md` |

> **규칙 강제는 훅, 사실·표준은 CLAUDE.md, 절차·템플릿은 스킬.** "앞으로 항상 X"는 메모리가 아니라 훅으로 박아야 실제로 강제된다.

---

## 4. 출력 타깃 결정표 (목적지로 도구 선택)

| 목적 | 타깃 | 도구 | 비고 |
|------|------|------|------|
| 화면설계서/검토(기본) | **2단 HTML** | `screen-spec` 스킬 | SSOT. 항상 이것부터. |
| 편집 가능한 디자인 핸드오프 | **Figma** | `use_figma`(사전 `/figma-use` 스킬) | 코드→디자인 라운드트립 |
| 정돈된 발표 덱·이미지 | **Adobe Express** | `export_html_to_express`(사전 `html_export_readiness_skill`) | HTML 자기완결 필수 |
| 빠른 브랜드 초안 | **Canva** | `import-design-from-url`·`generate-design` | 비동기 잡, 상태 폴링 |

상세·한계·함정: `02_mcp-capability-map.md`, `04_knowhow.md`.

---

## 5. 현재 실증

- `projects/shinsegae-simon-bo/` — SSTM BO 사양서(PPTX 67p) → BO006·BO316 2단 HTML. **PPTX→HTML 경로 검증 완료.**
- 다음: ScreenSpec JSON 경유 자동화, Figma/Express 렌더 타깃 1건씩 실증.
