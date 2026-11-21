---
name: 명세-어휘-추가
description: ScreenSpec 의 허용 컴포넌트(ElementType)나 동작(ActionType)을 추가·변경할 때 밟아야 하는 체인 전체. 스키마만 고치고 끝내면 «AI 는 냈는데 목업은 빈 상자» 가 검출 없이 지나간다. hero·stat-strip·card-grid 를 넣을 때 실제로 겪은 함정이 들어 있다.
---

# 명세 어휘를 넓힐 때

ScreenSpec 은 **UI 와 우측 설명의 공통 원본**이다. 그래서 어휘 하나를 더하면 아홉 군데가 같이 움직여야 한다.
한 군데만 빠져도 조용히 통과한다 — 아래는 전부 **실제로 빠뜨려 본 자리**다.

## 체인 (순서대로)

| # | 파일 | 할 일 | 빠뜨리면 |
|---|---|---|---|
| 1 | `packages/schemas/src/screen-spec.ts` | `ElementType` 에 값 추가. 내용 키가 필요하면 `ElementShape` 에 선택 키를 더하고 **superRefine 으로 타입↔내용을 1:1 로 묶는다** | 내용 없는 요소가 통과해 빈 상자가 렌더된다 |
| 2 | `packages/model-adapter/src/wire-schema.ts` | `WireElement` 에 **같은 키**를 더한다. 새 `z.enum`·`z.union` 을 만들지 않는다 | 모델 출력이 서버에서 거부된다 |
| 3 | `pnpm gen:schema` | 구조화 출력 스키마를 **다시 만든다**. `structured-schema.ts` 는 생성물이라 손으로 고치지 않는다 | 실제 모델 호출만 400 으로 죽는다 (fixture 는 통과) |
| 4 | `packages/prompt-templates/src/template-v1.ts` | 사용법을 `CONTENT_COMPONENT_GUIDE` 에 적고, **키 이름은 스키마에서 가져온다**(`Object.keys(HeroContent.shape)`). 본문이 바뀌면 `TEMPLATE_VERSION` 을 올린다 | 프롬프트가 스키마가 거부하는 것을 지시한다 — fixture 는 통과하고 실제 모델만 죽는다 |
| 5 | `packages/model-adapter/src/fixture-adapter.ts` | 더미 어댑터도 새 어휘를 내게 한다 | 키 없이 돌리는 프로토타입에서 새 어휘를 한 번도 못 본다 |
| 6 | `packages/renderer/src/html.ts` | `renderControl` 의 `switch` 에 `case` 추가. **`default:` 폴백이 라벨 한 줄만 그리고 조용히 통과한다** | 목업이 빈 상자가 된다 |
| 7 | `packages/renderer/src/labels.ts` · `content.ts` · `description.ts` | 한국어 라벨, `contentTexts()` 의 문구 목록, 우측 설명 한 줄 | 설명이 손실본이 된다 (명세 우선 원칙 위반) |
| 8 | `packages/renderer/src/styles.ts` | `BRAND_STYLES` 에 CSS. **선택자는 렌더러가 실제로 내보내는 클래스여야 한다** | 규칙이 통째로 죽는다 — 화면에서는 «브랜드가 안 먹은 것» 으로 보인다 |
| 9 | `packages/validators/src/v2.ts` | 필요하면 구조 검사 추가. 범위는 `elementRegion` 으로 **그 요소가 그려진 자리** 로 좁힌다 | 옆 요소의 글자를 빌려 통과한다 |
| 10 | `packages/schemas/src/examples.ts` | 새 어휘를 쓰는 **골든 예시**를 둔다 | 렌더·검증 테스트가 새 경로를 한 번도 안 밟는다 — 초록불이 공허해진다 |

## 테스트가 거짓말하지 않게

- 허용 컴포넌트를 도는 테스트는 **손으로 적은 배열이 아니라 `ElementType.options`** 를 쓴다. 손으로 적으면 enum 이 늘어도 초록불이 유지된다.
- wire 와 스키마의 키가 같은지 보는 단언을 둔다 (`Object.keys(...).sort()` 비교).
- 프롬프트가 나열한 키 이름이 스키마와 같은지 보는 단언을 둔다.
- 조건 분기 안에 단언이 있으면 **그 분기가 몇 번 돌았는지 세고 0이면 실패**시킨다.

## 검증

```bash
pnpm check        # typecheck + vitest
pnpm e2e          # 서버 e2e
pnpm e2e:demo     # 정적 데모 e2e (API 서버·자격증명 없음)
```

실제 모델이 새 어휘를 쓰는지는 따로 본다 (유료·비결정적이라 `pnpm check` 에 넣지 않는다):

```bash
set -a; source .env; set +a
MODEL_ADAPTER=anthropic pnpm probe:vocab
```

자격 증명이 없으면 전 항목 `not_run` 이다. **돌지 않은 검사를 통과로 적지 않는다.**

## 구조화 출력의 제약 (실제로 400 을 두 번 냈다)

- 선택 파라미터는 스키마 전체에서 **24개**가 상한이다. `structuredVariant` 가 `optional` → «필수 + nullable» 로 바꿔 0으로 만든다. 그래서 키를 몇 개 더하든 안전하다.
- SDK 변환기는 `enum`·`const`·중첩 `anyOf` 를 description 으로 밀어낸다. **사람이 그 결과를 따라 적을 수 없다** — 손으로 적은 복사본을 두지 말고 생성물 한 벌을 서버·브라우저가 같이 쓴다.
