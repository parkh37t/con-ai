---
name: ID와-추적체인
description: 내부 UUID 와 외부 ID 를 섞지 않는 규칙, IA·FN 발번과 화면 ID 부여의 차이, 메뉴구조도(IA)와 화면의 연결, REQ→IA→FN→SCR 추적 체인. ID 의 안팎을 헷갈리면 reference_invalid 로 죽거나 추적이 끊긴다.
---

# ID 와 추적 체인

## 안과 밖을 섞지 않는다

| | 예 | 누가 정하나 | 쓰이는 곳 |
|---|---|---|---|
| **내부 UUID** | `b4000000-…-0003` | 저장소 | 문서 간 참조, **API 요청** |
| **외부 ID (화면)** | `SAMPLE-bank-main`, `SCREEN-001` | 서버가 자동 부여 (`nextScreenExternalId`) | 사람이 보는 화면 ID |
| **외부 ID (IA)** | `IA-2.3.1` | **사람이 사유와 함께 누른다** | 메뉴 번호 |
| **외부 ID (FN)** | `FN-2.3.1-01` | 사람. IA 발번 전에는 만들 수 없다 | 기능 번호 |
| **외부 ID (요구사항)** | `REQ-BK-005` | 원본 자료 | 사람이 보는 요구사항 |

**실제로 데인 자리**: `IANode.requirement_ids` 는 **외부 ID**(`REQ-BK-005`)인데 생성 요청의 `requirement_ids` 는 **내부 문서 id** 다. 옮기지 않고 그대로 보내면 `reference_invalid` 로 죽는다.
→ 사람에게는 외부 ID 를 보여주고 API 에는 내부 id 를 보낸다 (`apps/web/src/plan.ts buildPlanRequest`).

반대로 `criterion_ids` 는 수용조건 자신의 id(`AC-BK-005-01`)를 그대로 쓴다. 필드마다 다르니 **쓰는 쪽 코드를 보고 확인한다.**

## 발번 규칙

- IA·FN 외부 ID 는 **사람이 행위자·사유를 넣고 누를 때만** 생긴다. 부팅 시 자동 발번은 없다.
- 번호는 서버가 **다시 계산**해 응답에 싣는다. 화면이 제안한 번호와 다르면 그 사실을 알린다.
- 개명은 옛 값을 지우지 않고 `aliases` 로 내린다. **번호를 재사용하지 않는다** (중복 검사가 별칭까지 본다).
- 기존 화면 ID 를 새 SP 번호로 일괄 바꾸지 않는다. 별칭·이력과 버전별 ID 를 보존한다.

## 메뉴구조도(IA) ↔ 화면

연결은 **단방향 한 필드**다: `IANode.screen_plan_id → ScreenDocument.id`(내부 UUID). 화면 쪽에 역참조는 없다.

「이 메뉴의 화면이 없다」는 **세 층**이고 뜻이 다르다. 뭉뚱그리지 않는다:

1. `kind === 'screen'` 인데 `screen_plan_id` 가 없다 → **메뉴에 화면 미연결**
2. `screen_plan_id` 는 있는데 화면 문서가 없다 → **고아 참조**
3. 화면은 있고 `current_revision_id` 가 없다 → **아직 안 만듦**

데모 스냅샷은 `current_revision_id` 를 **`null`** 로 직렬화한다. `=== undefined` 만 비교하면 null 을 «만들어짐» 으로 오판한다 — `== null` 로 둘 다 잡는다.

목업의 GNB·breadcrumb 는 `@con-ai/domain` 의 `menusForScreen` 하나로 만든다 (서버·브라우저 파이프라인 공용). 화면명에서 짐작하지 않는다. 트리 순회에는 **부모 고리 방어**가 필요하다 — 없으면 스택이 터진다.

## 추적 체인 (REQ → IA → FN → SCR)

- 수용조건 **단위**로 잇는다. 토큰이 보인다고 승인하지 않는다.
- 비UI 수용조건은 화면에 매핑하지 않는다. 커버리지 분모에서 빼지도 않는다.
- 아직 생성되지 않은 화면은 `spec_indexes` 에서 빼고 **`not_run`** 으로 센다. 0이나 통과로 읽지 않는다.
- 1,428개 INDEX 행을 고유 화면 수나 검증 완료 수로 표시하지 않는다.

## 화면을 메뉴에 붙이기 (2026-10-10 열렸다)

`PATCH /api/ia-nodes/:id` 에 **`screen_plan_id`**(내부 UUID)를 보낸다. 규칙은 `@con-ai/domain` 의
`canLinkScreenToIaNode` 한 벌이고 서버·데모가 같이 쓴다. 막는 것:

| 거부 코드 | 왜 |
|---|---|
| `ia_link.category_node` | 분류 노드에는 화면을 직접 붙이지 않는다 (설계 §6; `IANode` 스키마도 거부) |
| `ia_link.screen_not_found` · `ia_link.other_project` | 없는 화면·다른 프로젝트 화면 → 고아 참조가 된다 |
| `ia_link.screen_taken` | **한 화면은 메뉴 한 곳에만.** `menusForScreen` 이 첫 노드를 대표로 집으므로 둘이면 breadcrumb·GNB 가 조용히 모호해진다 |
| `ia_link.already_linked` · `ia_link.occupied` | 이미 붙어 있다. **연결 교체는 별개 작업**이다 (개명을 발번과 분리한 것과 같은 이유) |
| `ia_link.actor_required` · `reason_required` · `timestamp_invalid` | 연결도 사람이 사유와 함께 한다 |

`#/trace` 의 「화면 연결」은 사람에게 **화면 외부 ID** 를 받아 `api.project` 의 목록에서 **내부 UUID** 로
옮겨 보낸다. 섞으면 연결이 조용히 어긋난다.

## 발번 제안은 대상을 들고 온다 (2026-10-10 고쳤다)

`RtmGapProposal.function_id` 가 `issue_fn_id` 의 **대상 기능**(내부 UUID)이다. 화면은 이 값을 그대로
보내고 **보고서에서 짐작하지 않는다** (`rtm-view.ts issuanceFunctionId`).

- 예전엔 화면이 「보고서 전체의 첫 미발번 기능」을 집어, 다른 노드 것이 집히면 `기능 <uuid> 가 이 IA 노드에 없다` 로 400.
- 서버·데모의 stale 조회는 **`kind` + `ia_node_id` + `function_id`** 로 찾는다. (kind, 노드) 로만 찾던 때는
  한 노드에 미발번 기능이 2개 이상이면 둘째가 항상 409 였다.
- **해시 단독 조회는 쓰지 않는다** — `proposalHash` 는 FNV-1a 32bit 라 충돌이 가능하다.

## 아직 막혀 있는 것 (2026-10-10 기준)

- IA 노드를 **새로 만드는 API 가 없다.** 그래서 「만들기」로 만든 화면을 붙일 **빈 화면 노드**를 화면에서 만들 수 없다 — 이미 있는 노드에만 붙인다.
- 연결을 **바꾸거나 떼는** 경로가 없다 (`ia_link.occupied` 로 거부한다). 사유·이력을 어떻게 남길지 정해야 한다.
- `rtm.ts` 는 분류 노드에도 `link_screen` 을 제안할 수 있다(REQ 가 붙었고 하위에 화면이 없을 때). 그 제안은 규칙상 **실행할 수 없다** — 제안 쪽에서 걸러야 한다.
- 데모 스냅샷에는 미연결 화면 노드가 없어 `link_screen` 제안이 **배포 주소에서는 뜨지 않는다.** 서버·데모 API 테스트로만 덮여 있다.
