---
name: ia-from-url
description: 홈페이지/사이트 URL만으로 As-Is IA(정보구조)를 파악해 IA 구조도(Mermaid 트리 + 2단 HTML)로 그린다. 트리거 — "IA 그려", "정보구조 파악", "사이트 구조도", "메뉴 구조 추출", "as-is IA", "URL 보고 구조".
---

# ia-from-url — URL → As-Is IA 구조도

> 와일리 OS 인테이크의 일부(`방법론/와일리-OS/01_intake-router.md` §5). **URL만** 받아 사이트의 정보구조(IA)를 복원해 **도식**으로 산출한다.
> 원칙: **그라운딩 없으면 폐기** — 추측 메뉴 금지, 실제로 수집된 링크·구조만 그린다. 한계는 명시한다.

## 입력
- 대상 URL 1개 이상(루트 또는 진입 페이지). 프로젝트 slug(없으면 도메인 기반 생성).

## 절차

### 1. 수집 (구조 우선)
1. `robots.txt` → 허용/차단 + `Sitemap:` 라인 확보. **robots 차단 경로는 크롤 금지.**
2. `sitemap.xml`(및 index sitemap 하위) 전수 fetch → URL 풀(가장 신뢰도 높은 IA 소스).
3. 홈 HTML fetch → **GNB·LNB·메가메뉴·푸터·브레드크럼** 링크 추출(`<nav>`, `role=navigation`, `<header>/<footer>`).
4. 보강(선택): 1~2 depth 얕은 크롤로 섹션 허브 페이지 링크 수집(동일 도메인 한정, rate-limit 존중).
- 도구: `curl`/WebFetch. 대규모면 섹션별 **서브에이전트 팬아웃**(병렬 수집).

### 2. 정규화 → IA 트리
- URL을 path 세그먼트로 분해 → **depth 계층** 구성. 브레드크럼/메뉴 라벨로 노드명 보정.
- 쿼리스트링·세션·앵커 제거, 중복 병합, 페이지네이션(`?page=`) 1개로 축약.
- 섹션(1depth) → 카테고리(2depth) → 화면(3depth+) 트리. 라벨은 메뉴 텍스트 우선, 없으면 path.

### 3. 산출 (도식)
- `projects/<slug>/IA/as-is-ia.html` — 2단 HTML(좌: **Mermaid `flowchart TD` IA 트리**, 우: 수집 메타·커버리지·범례). `방법론/와일리-OS/06_diagramming.md` 도식 규칙 준수(좁은 패널 TD·11px).
- `projects/<slug>/IA/ia-map.json` — `{site, collectedAt, nodes:[{id,label,url,depth,parent,source}], coverage}` (각 노드 `source`: sitemap|nav|crawl).
- 1depth가 많으면 섹션별 서브 다이어그램으로 분할(노드 과밀 방지).

### 4. 검증·한계 명시
- 죽은 링크(4xx/5xx) 표기, 중복 제거 결과 기록.
- **SPA/JS 렌더 사이트는 정적 fetch로 라우트가 안 보인다** → 비전/렌더 보강 필요 또는 "JS 라우트 미수집" 한계 명시.
- 로그인 뒤(인증) 영역은 미수집으로 표기. robots 차단 구간 표기.
- 커버리지 = 수집 URL / (sitemap 총수). **추정·창작 노드 금지.**

## 산출물 골격(요약)
```
projects/<slug>/IA/
├── as-is-ia.html     # Mermaid IA 트리(도식) + 메타
└── ia-map.json       # 정규화 노드 그래프
```

## 함정
- 메뉴는 메가메뉴/드롭다운이 JS로 늦게 렌더 → HTML에 없으면 sitemap·크롤로 보강.
- 동일 화면 다중 URL(파라미터) → 템플릿 단위로 병합.
- 외부 링크·소셜은 IA에서 제외(별도 표기).
- 대량(수백+)이면 `screen-inventory` 스킬로 본수 집계를 먼저/병행.
