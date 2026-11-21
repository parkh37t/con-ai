# 01 인테이크 라우터 — 입력 산출물 → ScreenSpec

> 입력 종류를 판별하고, **구조 우선 파싱 → (필요 시) 비전 보강 → ScreenSpec JSON**으로 수렴시키는 규칙.
> 원칙: **구조화된 데이터가 있으면 비전을 단독 근거로 쓰지 않는다**(비전은 빈틈 메우기 전용).

---

## 0. 라우팅 결정 (입력 판별)

| 입력 신호 | 유형 | 1차 추출 경로 |
|----------|------|--------------|
| `.pptx` | PowerPoint 기획서 | §1 OOXML/python-pptx |
| `.pdf` | PDF 기획·산출물 | §2 디지털born vs 스캔 분기 |
| `figma.com/...` URL | Figma 디자인 | §3 Figma MCP(노드 우선) |
| `.png/.jpg`/스크린샷/와이어프레임 | 이미지 | §4 비전 LLM 주석 |
| `.html`/Claude Design URL | 마크업/디자인 번들 | §5 DOM 직접 |
| `canva.com/...` | Canva 디자인 | Canva `get-design-content` → §5 취급 |

---

## 1. PPTX (가장 흔한 기획 입력)

`.pptx` = ZIP(OOXML). **python-pptx** 권장:
- `prs.slides → slide.shapes`, 분기: `has_text_frame` / `has_table` / `shape_type==PICTURE`.
- 텍스트: `text_frame.paragraphs[].runs[].text` (런·불릿 보존). 표: `shape.table.rows/cells` (행×열 수 검증).
- 이미지: `shape.image.blob`. **지오메트리: `shape.left/top/width/height`(EMU)** → 좌측 레이아웃·마커 순서 근거.
- 노트: `slide.notes_slide`.
- 빠른 텍스트만 필요하면: `unzip → ppt/slides/slideN.xml`의 `<a:t>` 추출(현 BO 작업에서 사용).

**한계**: SmartArt·차트·그룹중첩·마스터 상속 텍스트는 누락 → 해당 슬라이드만 PNG 렌더 후 §4 비전 보강.

---

## 2. PDF

- **디지털born** → `PyMuPDF4LLM`(마크다운, 표·헤딩 보존).
- **스캔/복잡 레이아웃** → 레이아웃 ML: **Docling**(DocLayNet+TableFormer)·**Marker**·**MinerU**, 또는 VLM 파서.
- 벤치마크 현실(2025–26): 다양한 코퍼스에서 **편집유사도 ~88% 상한** → "90%+" 주장 경계. 문서 유형별로 파서 선택.

---

## 3. Figma

- **스크린샷보다 노드 데이터 우선.** Figma **Dev Mode MCP**: `get_design_context`(레이아웃·토큰·컴포넌트), `get_metadata`(희소 아웃라인 → 재호출 타깃팅), `get_variable_defs`(토큰), `get_code_connect_map`.
- **그라운딩용 `get_screenshot` 1장 병행**("스크린샷+코드 동시"가 단독보다 정확).
- **청크 단위 = 프레임/섹션**(페이지 전체 `get_design_context`는 토큰 폭발·트렁케이션 — 최다 실패).
- 파일 위생(오토레이아웃·명명된 변수·컴포넌트)이 정확도를 좌우.

---

## 4. 이미지 / 와이어프레임 / 슬라이드 PNG

- **비전 LLM 화면 주석**: 요소를 *유형 + 위치(섹션) + 텍스트/라벨*로 JSON 출력 요청. (계보: Google ScreenAI, Ferret-UI.)
- 프롬프트 예: "섹션별 모든 텍스트·라벨 추출, 상태 인디케이터·표·버튼·강조색 표기."
- 좌표는 **거친 상대 순서**만 신뢰. 절대 위치는 PPTX EMU/Figma 노드 지오메트리로 앵커.
- 러프 스케치는 최상위 VLM도 약함(Sketch2Code) → **수동적 피드백보다 능동적 질문(clarification) 루프**가 우월. 애매하면 본부장님께 질문.

---

## 5. HTML / Claude Design / Canva 콘텐츠

- DOM을 직접 파싱(섹션·테이블·폼·버튼). 이미 마크업이면 ScreenSpec로의 매핑이 가장 직접적.
- Canva: `import-design-from-url`은 **비동기** → 상태 폴링 후 `get-design-content`.

---

## 6. 공통 산출: ScreenSpec JSON

모든 경로의 종점은 동일한 정규 스펙(`03_screenspec-schema.md`):
- **구조화 추출은 strict 스키마로 강제**(JSON Schema → 제약 디코딩/`output_format`·`strict` tool).
- **모든 필드·값에 `sourceId`(슬라이드/노드/스팬) 부여** → 그라운딩 안 되면 폐기(환각 차단).
- **더미데이터는 `dummyRef`로 사전 사전(辭典) 참조만**(창작 금지).
- 표는 행×열 수를 원본과 대조 검증.

→ 이후 생산은 입력과 무관하게 `screen-spec` 스킬이 ScreenSpec 하나만 본다.
