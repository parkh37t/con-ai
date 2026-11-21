# 04 노하우 — 심층 분석 종합 (와일리 ↔ 박재하 본부장)

> 외부 리서치 3축(디자인 MCP 생태계 · Claude Code 에이전트 메커니즘 · 멀티모달 산출물→스펙)을 검증·종합한 실전 지침.
> 결론 한 줄: **"구조 우선 추출 → strict 스키마로 그라운딩 → 코드로 결정론적 렌더 → 훅으로 검증."** 자유 생성은 최소화한다.

---

## A. 신뢰성 7원칙 (추출·생산의 골격)

1. **구조 우선, 비전은 보강.** 구조화 데이터(PPTX EMU·Figma 노드·DOM)가 있으면 그것이 1차. 비전 LLM은 SmartArt·스캔·이미지전용 화면의 *빈틈만* 채운다.
2. **strict 스키마 강제.** JSON Schema를 제약 디코딩(`output_format`/`strict` tool)으로 강제 → 문법·타입은 보장. **단 문법 보장 ≠ 의미 정확.**
3. **의미 검증은 별도.** 제약 디코딩이 통과해도 값은 틀릴 수 있다 → `sourceId` 그라운딩 + 사후 검증(행×열 수, 라벨 대조).
4. **그라운딩 없으면 폐기.** 원본 추적 id 없는 필드·행·메시지는 버린다(환각 필드 차단). *그라운딩 능력과 날조 저항은 약상관* — 위치를 찾아도 값은 지어낼 수 있으니 둘 다 검사.
5. **더미데이터 창작 금지.** 사전 사전(辭典) `dummyRef`만 참조, enum으로 강제.
6. **마커는 코드가 생성.** 좌 `num-badge`/`num-badge-sm`과 우 `spec-field`를 한 ScreenSpec에서 함께 렌더 → 개수·순서 1:1이 *구조적* 보장(LLM 독립 추측 금지).
7. **애매하면 능동 질문.** 러프 스케치·모호 입력은 최상위 VLM도 약함 → 수동 피드백보다 *능동적 clarification*이 우월(Sketch2Code). 막히면 본부장님께 질문.

---

## B. 실패모드 → 대응

| 실패모드 | 대응 |
|----------|------|
| 환각 필드/값 | `sourceId` 바인딩, 미그라운딩 폐기 |
| 레이아웃 손실 | 비전 좌표 대신 EMU/노드 지오메트리 앵커; 없으면 상대 순서만 |
| 더미 드리프트 | 값 창작 금지, `dummyRef` enum |
| 마커 불일치(좌≠우) | 한 JSON에서 양측 코드 생성 |
| 표 뭉개짐(병합셀·다단) | TableFormer/Docling, 행×열 수 검증 |
| 토큰 폭발(Figma 전체 호출) | 프레임/섹션 청크, `get_metadata`로 타깃팅 |
| 사일런트 트렁케이션 | `max_tokens`/refusal stop 처리, 슬라이드별 분할 |

---

## C. 에이전트 메커니즘 — 효율 운용

- **서브에이전트 팬아웃 = 컨텍스트 격리 + 병렬.** 독립 리서치/분석은 한 턴에 동시 실행, 최종 메시지만 회수(부모 컨텍스트 보존). 읽기전용 리뷰는 도구 제한.
- **역할 분담을 메커니즘으로 고정**:
  - **CLAUDE.md** = 사실·표준·아키텍처(매 세션 로드, <200줄 유지).
  - **스킬**(`.claude/skills`) = 절차·템플릿·체크리스트(호출 시 로드, 점진 공개).
  - **훅**(`.claude/hooks`+settings) = *강제*(PostToolUse lint 게이트, SessionStart 셋업). **"앞으로 항상 X"는 메모리가 아니라 훅.**
- **검증을 모델이 아니라 하네스에 맡긴다.** 저장 후 lint·미러 audit를 PostToolUse 훅으로 → 모델 망각과 무관하게 항상 실행.
- **학습 축적**: 새 패턴·수정은 이 `와일리-OS/` 문서와 스킬에 반영(세션 간 노하우 누적). 사실은 CLAUDE.md, 절차는 스킬로 환류.

---

## D. MCP 운용 수칙

- **Read-before-write.** 생성·구현 전 항상 구조(`get_design_context`/`get_metadata`)+스크린샷 1장 확보. 스크린샷 없는 코드는 드리프트.
- **디자인시스템 앵커.** 변수·컴포넌트·Code Connect를 명시 → 토큰 사용·정확도↑·토큰비용↓.
- **Express export 전 매번 readiness.** `html_export_readiness_skill` → 자기완결 HTML 보장(외부 폰트/CDN 도달성). `use_figma` 전 `/figma-use`.
- **임포터는 픽셀퍼펙트가 아니다.** Express·Canva는 네이티브 모델로 재플로 → 반환 HzHTML/레이어/잡 상태를 *검증*. 1:1 가정 금지.
- **목적지로 도구 선택.** Figma=편집 핸드오프, Express=정돈 덱·이미지, Canva=빠른 초안. **2단 HTML은 항상 SSOT**, 나머지는 렌더 타깃.
- **베타·레이트리밋·향후 과금 리스크.** Figma 쓰기·일부 커넥터는 베타/쿼터(무인 자동화 깨질 수 있음) → 핵심 경로는 자체 HTML로 자립.

---

## E. 주요 출처

**디자인 MCP**
- Figma Dev Mode MCP: https://www.figma.com/blog/introducing-figma-mcp-server/ · 도구: https://developers.figma.com/docs/figma-mcp-server/tools-and-prompts/
- Claude Code→Figma(code-to-design): https://www.figma.com/blog/introducing-claude-code-to-figma/
- 디자인→코드 토큰 함정: https://blog.logrocket.com/ux-design/design-to-code-with-figma-mcp/
- Adobe for creativity: https://developer.adobe.com/adobe-for-creativity/ · 커넥터: https://claude.com/connectors/adobe-creativity
- Canva MCP: https://www.canva.dev/docs/mcp/ · Connect: https://www.canva.dev/docs/connect/mcp-server/

**Claude Code 메커니즘**
- 서브에이전트: https://code.claude.com/docs/en/agent-sdk/subagents.md · 스킬: https://code.claude.com/docs/en/skills.md
- 훅: https://code.claude.com/docs/en/hooks-guide.md · 메모리: https://code.claude.com/docs/en/memory.md · MCP: https://code.claude.com/docs/en/mcp.md

**멀티모달 추출·신뢰성**
- python-pptx: https://python-pptx.readthedocs.io/ · PyMuPDF4LLM(개요): https://pymupdf.readthedocs.io/
- PDF 파서 벤치마크: https://www.applied-ai.com/briefings/pdf-parsing-benchmark/
- Google ScreenAI: https://research.google/blog/screenai-a-visual-language-model-for-ui-and-visually-situated-language-understanding/
- Ferret-UI: https://arxiv.org/html/2501.17799v1 · Sketch2Code(NAACL 2025): https://aclanthology.org/2025.naacl-long.198/
- Anthropic Structured Outputs: https://platform.claude.com/docs/en/build-with-claude/structured-outputs
- PARSE(스키마 최적화): https://arxiv.org/html/2510.08623v1
