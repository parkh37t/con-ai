# @con-ai/model-adapter — 모델 호출 어댑터

> 세로 조각 계약 §3 의 `ModelAdapter` 구현. `anthropic`(실제 호출, 구조화 출력) / `fixture`(더미, 네트워크 없음). 모델 호출은 서버(API·워커)에서만 하고 키·토큰은 환경변수에서만 읽으며 어디에도 로그·응답하지 않는다 (CLAUDE.md AI 경계).

근거 문서: `docs/plan/세로조각_계약.md` §3, 설계 §5·§8·§9, Anthropic SDK 사용법은 claude-api skill 의 `typescript/claude-api/README.md`(클라이언트 초기화·오류 처리·stop reason)·`tool-use.md` "Structured Outputs"(`client.messages.parse` + `zodOutputFormat`)·`shared/anthropic-cli.md`(OAuth 토큰 헤더) 에서 확인했다. SDK 는 `@anthropic-ai/sdk@0.124.0`.

## 실행

```bash
pnpm vitest run packages/model-adapter     # 네트워크 없이 fetch 를 흉내낸 테스트
pnpm check                                 # 저장소 전체
```

## 어댑터 선택과 환경변수

| 변수 | 값 | 기본 | 뜻 |
|---|---|---|---|
| `MODEL_ADAPTER` | `anthropic` \| `fixture` | `fixture` | 실제 호출 / 더미. 화면 배지에 `anthropic(모델)` / `fixture(더미)` 로 표시한다 |
| `MODEL_ID` | 모델 ID | `claude-opus-5` | anthropic 어댑터가 쓰는 모델 |
| `MODEL_AUTH` | `api_key` \| `token` \| `auto` | `auto` | 인증 방식 선택. `auto` 는 `ANTHROPIC_API_KEY` → `ANTHROPIC_AUTH_TOKEN` → `ant auth login` 프로필 순 |
| `ANTHROPIC_API_KEY` | API 키 | — | API 키 방식 |
| `ANTHROPIC_AUTH_TOKEN` | OAuth/구독 토큰 | — | 토큰 방식 |
| `ANTHROPIC_BASE_URL` | URL | SDK 기본 | SDK 가 직접 읽는다 (프록시·게이트웨이) |
| `ANTHROPIC_CONFIG_DIR`, `ANTHROPIC_PROFILE` | 경로·프로필명 | SDK 기본 | 프로필 방식에서 SDK 가 읽는다 |

`createAdapter(env)` 는 `MODEL_ADAPTER=anthropic` 인데 인증 수단이 없으면 **생성 시점에** 세 방법을 안내하는 한국어 오류를 던진다. 어댑터의 `auth` 필드(`'api_key' | 'token' | 'profile' | 'none'`)는 방식만 알려주고 값은 담지 않는다.

### 인증 방식 두 가지 (+ 프로필)

| 방식 | 설정 | 요청 헤더 | 비고 |
|---|---|---|---|
| API 키 | `ANTHROPIC_API_KEY=<키>` (`MODEL_AUTH=api_key` 또는 auto) | `x-api-key: <키>` | `new Anthropic({ apiKey, authToken: null })` — 토큰 env 가 함께 있어도 두 헤더를 같이 보내지 않는다 (API 가 거부) |
| 토큰 | `ANTHROPIC_AUTH_TOKEN=<토큰>` (`MODEL_AUTH=token` 또는 auto). `set -a; eval "$(ant auth print-credentials --env)"; set +a` 로 넣을 수 있다 | `Authorization: Bearer <토큰>` + `anthropic-beta: oauth-2025-04-20` | SDK 는 `authToken` 을 직접 넘길 때 oauth beta 헤더를 붙이지 않는다(프로필 체인에서만 붙임 — `client.js` `prepareRequest` 확인). `/v1/messages` 는 이 헤더가 필요하므로 `defaultHeaders` 로 넣는다. 토큰은 짧게 살고 env 로 넘기면 자동 갱신되지 않는다 |
| 프로필 | `ant auth login` 후 두 변수 없이 실행 (auto 전용) | SDK 가 프로필 토큰 + oauth beta 헤더를 스스로 붙임 | zero-arg `new Anthropic()`. 프로필 존재는 `ANTHROPIC_PROFILE` 또는 설정 디렉터리의 `configs/` 로 판정하며, 실제 해석 실패는 첫 호출 때 `AdapterError('auth')` 로 나온다 |

테스트(`index.test.ts`)는 fake fetch 로 각 방식에서 실제로 보내는 헤더(`x-api-key` vs `Authorization: Bearer` + beta)를 확인한다.

## anthropic 어댑터 (실제 호출)

- `client.messages.parse({ model, max_tokens: 16000, system, messages: [{ role: 'user', content }], output_config: { format: zodOutputFormat(WireOutput), effort: 'high' } })`. `thinking` 은 넣지 않는다 (claude-opus-5 는 기본 adaptive).
- 구조화 출력 스키마는 `src/wire-schema.ts` 의 순수 zod 객체다. schemas 의 `ScreenSpec`/`GenerationOutput` 은 superRefine·정규식·default 가 있어 그대로 JSON Schema 로 바꾸기 어렵고, SDK 변환기는 `enum`·`pattern`·`minItems>1` 을 description 으로 밀어낸다. wire 결과는 그대로 `AdapterResult.output`(GenerationOutputInput) 이 되며 **참조 무결성·필수 CASE 검증은 서버가 다시 한다**.
- 오류 (`AdapterError`, `code` 와 `cause` 유지): `stop_reason === 'refusal'` → `refusal`(details.stop_details), `parsed_output === null` → `empty_output`(details.raw_text), SDK 파싱 실패(`AnthropicError`) → `parse`, `AuthenticationError` → `auth`, `RateLimitError` → `rate_limit`, `BadRequestError` → `bad_request`, 그 밖의 `APIError`(연결 실패 포함) → `api_error`. 메시지 안의 키·토큰 값은 `[비공개]` 로 가린다.
- `usage`(input/output tokens) 와 `stop_reason` 을 `AdapterResult` 에 기록한다 → job.cost.
- `reviseSpec` 은 문맥에 `base_spec` 이 없을 때만 현재 명세를 덧붙인다(있으면 프롬프트가 이미 담고 있다). `draftRevisionPrompt` 는 같은 방식으로 `{ prompt, rationale }` 을 구조화 출력으로 받는다.

### 비용·모델

- 기본 모델 `claude-opus-5`, 호출당 `max_tokens: 16000`, `effort: 'high'`. 생성 한 번에 참고 명세·요구사항이 통째로 들어가므로 입력 수천~수만 토큰, 출력은 명세 크기(보통 3천~1만 토큰)다. 비용은 job.cost 의 토큰 수에 현재 단가를 곱해 계산한다 (단가는 skill 의 `shared/models.md` 참고, 코드에 넣지 않았다).
- 재시도는 SDK 기본(2회)이다. 파이프라인의 재시도 제한(job.max_attempts)과 겹치지 않게 서버에서 조정한다.
- 프롬프트 캐싱은 아직 쓰지 않는다 (system 이 프로젝트·프로파일에 따라 바뀌므로 도입 시 안정 prefix 를 분리해야 한다).

## fixture 어댑터 (더미)

네트워크 없이 결정적으로 동작한다. 화면에는 "더미 어댑터" 로 표시한다.

- `generateSpec`: `ctx.references[0].spec` 이 `ScreenSpecShape` 로 파싱되면 복제해 `screen_id`(문맥의 외부 ID)·`baseline_id`·`purpose`·`shell`·`device`·`roles`·`requirements` 를 요청에 맞추고, 없으면 목록 기본 템플릿(검색 영역 + 표 + 다운로드·페이지 버튼)을 만든다. `clone_reference` 는 참고 spec 우선, `create` 는 화면명(문맥 제목, 없으면 목적 문장에서 추출)을 purpose·영역 제목에 반영한다.
  - UI 수용조건을 요소·동작에 순서대로 배분해 `trace` 와 `trace_proposals`(candidate) 를 만들고, 비UI 조건은 `unresolved(question)` 으로 남긴다.
  - CASE 는 `req.cases` 로 다시 만든다(`normal` 은 항상 포함). id=CASE 종류, `fixture_id = <screen_id>-<case>`, 종류별 메시지(`msg-empty` 등)와 `show-<case>` set-state 동작을 만든다.
  - 참고 spec 의 `data_mapping` 은 근거 anchor 가 이 문맥에 없으므로 비우고 `unresolved(missing_evidence)` 로 남긴다. 참고 spec 의 예전 `trace` 는 지운다.
- `reviseSpec`: 코멘트(`req.comment_ids` 로 선택) 문장에 단순 규칙을 적용한다. 잠긴 요소(`locked_elements`/`locked: true`)는 바꾸지 않고 `unresolved(conflict)`.
  | 코멘트 문장 | 규칙 |
  |---|---|
  | `필수` (예: "필수 입력으로") | `required: true`; "필수 아님/해제/제거", "선택 입력" 이면 `false` |
  | `라벨/이름/명칭/제목을 "X"로 바꿔/변경/수정` | `label = X` |
  | `메시지/문구/안내문` + 따옴표 문구 | CASE(`case_id`)의 첫 메시지나 요소 검증 메시지를 수정, 없으면 `msg-<case|element>` 추가 후 CASE 에 연결 |
  | `삭제/제거/없애/빼` | 요소 제거 + 그 요소를 가리키는 동작·매핑·잠금 정리 (영역이 비면 영역도 제거) |
  | 그 외, 요소 미지정 | `unresolved(question)` 으로 남김 |
  `change_summary` 에 반영 목록과 `added/changed/removed_ids` 를 적는다.
- `draftRevisionPrompt`: 코멘트를 역할(기획자/디자이너/퍼블리셔/개발자/고객)·요소·CASE 별로 묶은 한국어 지시문과, 묶음 통계·잠긴 요소 제외를 설명하는 rationale 을 만든다.

## 파일

| 파일 | 내용 |
|---|---|
| `src/types.ts` | 계약 §3 타입 (`ModelAdapter`, `AdapterResult`, `AdapterAuth`) |
| `src/index.ts` | `createAdapter(env, opts?)`, 인증 방식 해석, `OAUTH_BETA_HEADER`, `defaultProfileAvailable` |
| `src/anthropic-adapter.ts` | `AnthropicAdapter` (parse + zodOutputFormat, 오류 변환, 비밀 값 가림) |
| `src/fixture-adapter.ts` | `FixtureAdapter`, `deriveScreenName` |
| `src/wire-schema.ts` | `WireOutput`, `WireScreenSpec`, `WireRevisionDraft`, `toGenerationOutputInput` |
| `src/errors.ts` | `AdapterError`, `AdapterErrorCode` |
| `src/test-fixtures.ts` | fake fetch·합성 데이터 (재수출하지 않음) |

## 남은 제한

- 거부 응답에 JSON 이 아닌 텍스트가 실려 오면 SDK 의 `parse()` 가 결과를 돌려주기 전에 파싱 오류를 던지므로 `refusal` 이 아니라 `parse` 로 분류된다 (내용 없는 거부는 `refusal`). 정확히 나누려면 `messages.create` + 수동 `format.parse` 로 바꿔야 한다.
- 실제 API 에 대해서는 호출하지 않았다. `zodOutputFormat` 변환과 요청 형태(파라미터·헤더)는 SDK 소스와 fake fetch 로만 확인했다.
- 프로필 방식의 "존재 판정" 은 설정 디렉터리 검사이며 토큰 만료·워크스페이스 불일치는 첫 호출에서야 드러난다.
- 스트리밍·프롬프트 캐싱·배치 API 는 쓰지 않는다. 긴 명세에서 `max_tokens` 에 잘리면 `empty_output`/`parse` 오류로 실패한다(재시도는 파이프라인 정책).
- fixture 의 라벨·메시지·삭제 규칙은 한국어 정규식 몇 개뿐이다. 요소를 지정하지 않은 코멘트, 표 컬럼 변경, 동작 추가는 처리하지 않고 질문으로 남긴다.
- `ModelAdapter.auth` 는 계약 §3 원문에 없던 필드다(코디네이터 요청으로 추가). `docs/plan/세로조각_계약.md` §3 에 반영이 필요하다.
