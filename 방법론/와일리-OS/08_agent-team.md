# 08 와일리 에이전트 팀 — 롤 분업 파이프라인

> 학습·내재화한 스킬을 **각자 롤을 가진 6개 서브에이전트**로 분업한다. 정의: `.claude/agents/wiley-*.md`.
> 호출: `Agent` 도구의 `subagent_type` 또는 `Workflow`의 `agentType`. 발주자 **박재하 본부장님**.

---

## 팀 구성 (파이프라인 단계별)

| # | 에이전트 | 롤 | 핵심 스킬·규범 | 도구(frontmatter와 일치) | 산출 |
|---|----------|----|--------------|------|------|
| 1 | **wiley-intake** | 인테이크·리서치 | ia-from-url · screen-inventory · benchmark-painpoint · 01·04 | Read·Write·Grep·Glob·Bash·WebSearch·WebFetch | IA 구조도·화면 카탈로그·벤치 리포트 |
| 2 | **wiley-extract** | 산출물 추출 | 01_intake-router · ScreenSpec 스키마 | Read·Write·Bash·Grep·Glob·WebFetch·ToolSearch | ScreenSpec JSON |
| 3 | **wiley-screen** | 화면 생산 ★ | screen-spec · 07(8단·마커·골든·5원칙) | Read·Write·Edit·Bash·Grep·Glob | 2단 HTML 화면설계서 |
| 4 | **wiley-diagram** | 도식·비주얼 | 06_diagramming(Wireflow·상태도·시퀀스·매트릭스) | Read·Edit·Bash·Grep·Glob | 도식 강화·비주얼 |
| 5 | **wiley-verify** | 검증 게이트 | 07§G·H·C · audit/patch 도구 | Read·Bash·Grep·Glob·Edit | 검증 리포트·자동정정 |
| 6 | **wiley-render** | 렌더·**배포** | 02_mcp-map(Figma·Express·Canva) · CLAUDE §5(Pages) | Read·Bash·Grep·Glob·ToolSearch·Skill | Figma/Express/Canva·이미지 · **GitHub Pages 배포** |

---

## 협업 흐름 (E2E)

```
[입력]  URL · PPTX · Figma · 기획서
   │
   ▼  ① wiley-intake     리서치(IA·본수·벤치) → 컨텍스트 확보
   ▼  ② wiley-extract    산출물 → ScreenSpec JSON(그라운딩·strict)
   ▼  ③ wiley-screen ★   ScreenSpec/SSOT → 2단 HTML(골든 복제→개조, 8단·마커)
   ▼  ④ wiley-diagram    우측 디스크립션 도식화·비주얼 디벨롭
   ▼  ⑤ wiley-verify     lint·미러·마커 audit → patch (품질 게이트)
   ▼  ⑥ wiley-render     Figma/Express/Canva 렌더 변환 + 루트 카탈로그 갱신 → GitHub Pages 배포
[출고]  화면설계서(SSOT) + 렌더 산출물 + 공개 URL(Pages/raw.githack)
```

- **역할 경계 불변식**: intake/verify는 화면을 만들지 않고(읽기·검사), screen만 백지→생산, diagram은 **기존 강화(Edit만)**, render는 변환·**배포**. 경계를 넘지 않는다.
- **검증은 항상 verify로 수렴** — screen·diagram 변경 후 verify 통과가 출고 조건.
- **마지막 마일(배포)은 render** — 루트 `index.html` 카탈로그 등록 + `git push` → Actions 자동 배포(CLAUDE §5).
- **경계 단서(중복 방지)**: SVG 인라인 = diagram(작성 시)·render(출력 직전 보강). p5 마커 = screen(미생성)·verify(수동정정). URL만 입력 = intake / 산출물 파일 입력 = extract.

---

## 조율(오케스트레이션) 패턴

- **단발**: 메인 루프가 단계별로 `Agent(subagent_type: 'wiley-screen')` 호출.
- **대량/병렬**: `Workflow`로 `pipeline(화면목록, screen단계, verify단계)` — 화면별 생산→검증을 병렬 파이프라인.
- **조율자 부재 시**: 메인 에이전트(와일리)가 본 문서를 조율 규범으로 삼아 순서대로 위임.

> 한 에이전트가 막히면 핸드오프 대상(표의 핸드오프 열)에게 넘긴다. 모든 보고는 한국어, 발주자는 박재하 본부장님.
