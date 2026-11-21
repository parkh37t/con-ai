# 02 MCP 능력 지도 — 이 환경에 실제 연결된 무기

> 이 세션에 붙어있는 MCP 서버 인벤토리와 **프로토타이핑 파이프라인에서의 역할**.
> 도구명은 라이브 스키마로 교차검증함(환각 도구명 금지). 베타·요금·레이트리밋 주의.

---

## 1. 디자인 생산·렌더 (핵심)

| 서버 | 입력(Ingest) | 출력 | 적합 용도 | 한계 |
|------|-------------|------|----------|------|
| **Figma** | 선택 노드/프레임 URL; 토큰·변형·오토레이아웃·Code Connect | 구조화 코드(React+Tailwind), `get_screenshot` PNG, 희소 노드맵; **쓰기**: `use_figma`로 네이티브 편집 레이어 생성 | **디자인→코드**(기존 화면→정확 코드) / **코드→디자인**(프로토타입 역송) | 대형 선택 트렁케이트·토큰 폭발; 쓰기는 베타·향후 과금; `use_figma` 전 `/figma-use` 스킬 필수 |
| **Adobe_for_creativity** (Express/Firefly) | 자기완결 HTML(인라인/URL); 텍스트 프롬프트; 자산/PDF | 네이티브 **Express** 문서(편집 가능, 슬라이드별 HzHTML 반환); Firefly 생성이미지; 배경제거·생성확장·벡터화 | **HTML 화면설계서 → 정돈된 편집 가능 Express 덱**; 프로토타입용 이미지 생성·보정 | HTML 자기완결·도달가능 필수; 임포터가 DOM 재정규화(누락 검증); 일부 도구 Adobe 로그인 |
| **Canva** | 텍스트; URL/외부 디자인(비동기 잡); 브랜드템플릿+데이터셋 | 새 Canva 디자인; 임포트 디자인; 다포맷 export(PDF·PNG·PPTX·GIF·MP4) | 빠른 1차 초안 덱·소셜·마케팅; 브랜드템플릿 오토필 대량 | Canva 네이티브 레이아웃(소스 HTML과 픽셀 불일치); 임포트 비동기(폴링) |

**필수 절차**
- Express export **직전 매번** `html_export_readiness_skill` 실행 → 인라인/호스팅 결정·자산 임베드.
- `use_figma` **직전** `/figma-use` 스킬 로드.
- 두 "Adobe MCP" 혼동 금지: 여기 연결된 **Adobe_for_creativity**(HTML 임포트·Firefly 실동작) ≠ 공개 *Express Developer MCP*(문서 헬퍼).

---

## 2. 자산·미디어 생성 (보조 — 프로토타입 비주얼)

| 서버 | 역할 |
|------|------|
| **Higgsfield** | 이미지·비디오·오디오·3D(GLB) 생성, 업스케일·아웃페인트·리프레임·배경제거·모션. 로컬 미디어는 `media_upload_widget`, 웹 URL은 `media_import_url`(반환 media_id 사용). 프로토타입용 히어로 이미지·목업 영상. |
| **Adobe image_*** | Firefly 계열 정밀 보정(노출·HSL·블러·할프톤·벡터화·프리셋). 스크린샷/자산 후처리. |

---

## 3. 입력·리서치·운영 (인테이크·컨텍스트)

| 서버 | 역할 |
|------|------|
| **Google_Drive** | 기획 산출물(PPTX·PDF·문서) 검색·다운로드·읽기 → 인테이크 소스. |
| **Gmail / Google_Calendar** | 요구사항 수신 메일·미팅 컨텍스트 회수(필요 시). |
| **Hugging_Face** | 모델·데이터셋·논문·Space 탐색(기법 리서치·OCR/레이아웃 모델 후보). |
| **ListeningMind** | 검색데이터 기반 소비자/의도 분석(`intent_finder`·`cluster_finder`·`keyword_info`·`path_finder`) → 기획 단계 사용자 인사이트·정보구조 근거. |
| **github** | 저장소·PR·CI·코드검색·파일 R/W(배포·협업). 스코프: `parkh37t/con-ai`. |

---

## 4. 선택 가이드 (한 줄)

- **검토용 설계서 →** 2단 HTML(SSOT)부터. 외부 MCP는 *그 다음*.
- **편집 핸드오프 →** Figma 쓰기.
- **발표 덱/이미지 →** Adobe Express + Firefly.
- **빠른 브랜드 초안 →** Canva.
- **기획 인사이트 →** ListeningMind. **산출물 수집 →** Google Drive. **비주얼 자산 →** Higgsfield/Firefly.

> 도구는 많을수록 좋은 게 아니다. **2단 HTML을 진실원으로 두고 나머지는 렌더 타깃**으로 한정해야 드리프트가 없다.
