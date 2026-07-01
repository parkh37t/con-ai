# CLAUDE.md — con-ai 화면설계 워크벤치

> 이 저장소는 **S2B AI 생산 방법론(7계층 OS)**을 코어로 두고, **여러 프로젝트의 화면설계 방법론을 테스트·프로토타이핑하고 S2B처럼 GitHub Pages로 배포**하는 **워크벤치**다.
> 방법론 원리: `방법론/s2b-methodology-study.md`. 멀티입력→프로토타입 환경: `방법론/와일리-OS/00_OVERVIEW.md`.

---

## ★ 호칭·언어 규칙 (절대 — 위반 시 신뢰 손상)

- **사용자 = 박재하 본부장.** 호칭은 항상 **"박재하 본부장님"** 또는 **"본부장님"**. `당신·너·유저·사용자분` 등 절대 금지.
- **모든 응답·문서는 한국어.** 영어 문장·표현 사용 금지(코드·식별자·고유명사·기술 약어 — MCP·HTML·PPTX·Figma 등 — 은 불가피하므로 예외). 영어로 응대하려면 **사전 허락 필수.**
- 빌더 에이전트 페르소나 = **와일리(Wylie).** 산출물 주체를 칭할 때 사용.

---

## 0. 저장소 구조 (워크벤치)

```
con-ai/
├── index.html · .nojekyll          GitHub Pages 랜딩 (프로젝트 카탈로그)
├── .github/workflows/pages.yml      Pages 자동 배포
├── 방법론/                          ★ 공용 방법론 코어 (프로젝트 무관)
│   ├── s2b-methodology-study.md      7계층 OS 학습 보고서
│   ├── templates/template_screen.html  골든 2단 템플릿
│   ├── 표준/입력필드_정책.md          공용 입력 표준
│   ├── 와일리-OS/                    ★ 멀티입력→프로토타입 환경 (00~09 + screenspec.schema.json)
│   └── s2b-원전/                     S2B 생산 메커니즘 원전(SKILL·규칙·작업가이드·IA·glossary·더미·입력필드)
├── .claude/skills/                  ★ 커스텀 스킬 (공용)
│   ├── screen-spec/                  화면 생산(2단 도식화)
│   ├── ia-from-url/                  URL→As-Is IA 구조도
│   ├── screen-inventory/             화면 본수 집계·카탈로그
│   └── benchmark-painpoint/          벤치마킹→페인포인트·개선
├── .claude/agents/                  ★ 와일리 에이전트 팀 6종 (intake·extract·screen·diagram·verify·render)
├── .claude/hooks/html-lint.py       회귀 13패턴 훅
├── scripts/                         전 프로젝트 일괄 검증
└── projects/                        ◆ 프로젝트 인스턴스들
    ├── lotte-dutyfree/              롯데면세점 (프론트·관리자)
    │   ├── index.html               프로젝트 프로토타입 랜딩
    │   ├── docs/ (00_INDEX·01_규칙·02_SSOT·03_요구사항·04_공통표준)
    │   └── 화면설계/ (프론트·관리자·_공통)
    └── shinsegae-simon-bo/          신세계사이먼 BO (PPTX→2단 HTML 실증)
```

- **공용(재사용)** = `방법론/` · `.claude/` · `scripts/`. **프로젝트별** = `projects/<name>/`.

---

## 1. 새 프로젝트 추가 절차

1. `projects/<slug>/` 생성. 아래 골격 복제:
   - `docs/00_INDEX.md` · `docs/01_규칙/명명규칙.md` · `docs/02_SSOT/*_작업가이드.md` · `docs/03_요구사항/요구사항_추적표.md` · `docs/04_공통표준/{더미데이터_사전,용어집}.md`
   - `화면설계/<포털>/` · `index.html`(프로토타입 랜딩) · `README.md`
   - 참고 골격: `projects/lotte-dutyfree/`
2. `docs/02_SSOT/*`(권한·흐름·상태·정책·용어)를 **가장 먼저** 채운다 = 가장 중요한 입력 컨텍스트.
3. 화면 생산은 `screen-spec` 스킬 + `방법론/templates/template_screen.html` 골든 복제→개조.
4. 루트 `index.html` 프로젝트 카탈로그에 항목 추가.

---

## 2. 화면 생산 원칙 (요약 — 상세는 `.claude/skills/screen-spec/SKILL.md`)

- **신규 화면 = 골든 복제 → 개조.** 백지 생성 금지.
- **2단 구조 불변식**: GNB·LNB·브레드크럼은 `screen-wrap` 안, `#right-panel`은 그 형제.
- **마커 1:1 미러링**: 좌 `num-badge`/`num-badge-sm` == 우 `spec-field`(개수·라벨·순서 일치).
- **우측 디스크립션 8단 고정 순서**: 화면ID→info-table 3행→CASE→proc→policy→데이터매핑→spec→msg-tbl(맨 아래).
- **더미데이터 창작 금지** — 해당 프로젝트 `더미데이터_사전.md` 고정 캐스트만.
- **디자인시스템 클래스만** 사용.

---

## 3. 프롬프트 가드레일 (L7) — 절대 규칙

> **"위에서 언급한 수정 사항 외의 기존 코드는 절대 삭제·이동하지 말고, 수정 완료 후 저장한다."**

- 언급되지 않은 코드는 보존(삭제·이동·재정렬 금지).
- 변경은 요소 단위로 (추가)/(삭제)/(유지) 명시. 대상은 화면ID/파일경로로 고정.
- **컨펌 3대 키 일치**: `화면ID = HTML 파일명 = 개발목록 ID`.

---

## 4. 검증 (L5)

- 저장 즉시: `python3 .claude/hooks/html-lint.py <file>` (회귀 13패턴)
- 단일 화면: `python -m http.server 18877` → `http://localhost:18877/...`, 강력 새로고침. **`file://` 금지**.
- 전체: `python scripts/verify_all_pages.py` · `python scripts/audit_mirror_lr.py` · `python scripts/audit_markers.py`(마커 5종 p1b~p5) (전 프로젝트 스캔)
- 자동정정: `python scripts/patch_markers.py`(dry-run) → `--apply`(p1b~p4 일괄 수리)

---

## 5. GitHub Pages 배포 (S2B 방식)

- 랜딩 `index.html` + `.nojekyll` + `.github/workflows/pages.yml`(Actions 배포).
- 저장소 Settings → Pages → Source를 **GitHub Actions**로 설정하면 push 시 자동 배포.
- 배포 URL(예): `https://parkh37t.github.io/con-ai/`

---

## 6. 와일리 OS — 멀티입력 → 프로토타입 (상세: `방법론/와일리-OS/`)

- **미션**: 입력이 PPTX·PDF·HTML·Figma·이미지·Claude Design·Canva 무엇이든 → S2B 방법론으로 → 어떤 프로토타입이든 산출.
- **파이프라인 6단계**: 입력 → 추출(구조 우선+비전 보강) → **ScreenSpec JSON**(정규 스펙) → 골든 복제→개조 → lint·미러 검증 → 배포/렌더.
- **SSOT = 2단 HTML 화면설계서.** Figma(`use_figma`)·Adobe Express(`export_html_to_express`)·Canva는 *렌더 타깃*.
- **연결된 MCP 지도**: `방법론/와일리-OS/02_mcp-capability-map.md` (Figma·Adobe·Canva·Google Drive·Hugging Face·ListeningMind·Higgsfield·github).
- **신뢰성 7원칙·실패모드 대응**: `방법론/와일리-OS/04_knowhow.md` (그라운딩 없으면 폐기 / 더미 창작 금지 / 마커는 코드 생성 / strict 스키마).
- **벤치마크·도식화 노하우**: `05_s2b2-benchmark.md`(s2b2 능가 9+5요소) · `06_diagramming.md`(3자 공통언어 도식 — Wireflow·상태도·시퀀스·필드 매트릭스, Mermaid).
- **인테이크·리서치 스킬 3종**: `ia-from-url`(URL→IA 구조도) · `screen-inventory`(화면 본수 카탈로그) · `benchmark-painpoint`(벤치마킹→페인포인트·개선).
- **S2B 생산 메커니즘 내재화**: `07_s2b-production-mechanism.md`(SSOT 4계층·8단 디스크립션·마커 5종금지(p1b~p5)/부여 5기법·검색 2-A·골든 복제→개조·콘텐츠 5원칙·도구 인벤토리·입력필드 정책) · 원전 보관 `방법론/s2b-원전/`. `screen-spec` 스킬이 이를 규범으로 삼는다.
- **에이전트 팀 6종**: `08_agent-team.md` + `.claude/agents/wylie-*.md` (intake·extract·screen·diagram·verify·render). 파이프라인 단계별 롤 분업. `Agent(subagent_type)`·`Workflow(agentType)`로 호출.
- **세션 회고(방법론 자산)**: `09_session-retrospective.md` — "와일리 OS는 어떤 AI 방법론인가"를 5관점(과정·원리·AI 인사이트·거버넌스·메타)으로 종합. 핵심: **AI는 내용은 맞히나 표준 양식·분량·일관성에서 무너진다 → 골든+SSOT+검증으로 "AI를 표준 위에 올린다"**. 다음 세션 계승용 1문서.

---

## 현재 상태

| 프로젝트 | 상태 |
|---------|------|
| `lotte-dutyfree` | 화면 3종(front-home-main GNB개선·front-product-list·admin-product-list) + AI 활용 테스트 갭 분석 리포트(6과제) + **PD-4247 대조 화면**(Claude SB vs 와일리 OS) + **롯데 SB 골든 템플릿 등록**(`lotte-sb-golden.html` + `롯데SB양식_매핑.md` — GAP-1 영구 해소). 도메인 콘텐츠는 PPTX 확정 후 |
| `shinsegae-simon-bo` | PPTX(67p)→BO006·BO007·BO316 2단 HTML(도식화) 실증. s2b2 벤치마크로 품질 상향. ScreenSpec 예시 `examples/BO006.screenspec.json` |
| `ambassador-hotel` | 인테이크 리서치 3종(IA·화면본수·벤치마킹) + **정식 프로젝트 승격**(docs 7계층 골격 + `00_입력원본` RFP 투입소). RFP·요구사항서 투입 대기 → 화면 양산 |
| 와일리 OS | 환경+노하우(00~07)·도식화·인테이크/리서치 스킬 3종·**S2B 생산 메커니즘 내재화(07+원전)**. 앰배서더 호텔로 스킬 3종 실증 완료. 다음: Figma/Express 렌더 실증 |
