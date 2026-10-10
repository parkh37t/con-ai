#!/usr/bin/env bash
# con-ai 초기 세팅 — 어떤 환경에서든 `git clone` 뒤 이 스크립트 하나로 시작한다.
#
#   bash scripts/setup.sh                  # 대화형: 어댑터·인증 방식을 물어본다
#   bash scripts/setup.sh --yes            # 비대화: 기본값(fixture 더미 어댑터)으로 진행
#   bash scripts/setup.sh --adapter claude_code                # 실제 모델, **내 Claude 로그인** (API 키 불필요 · 권장)
#   bash scripts/setup.sh --adapter anthropic --auth api_key   # 실제 모델, API 키 방식 (.env 에 키를 채워야 함)
#   bash scripts/setup.sh --adapter anthropic --auth token     # 토큰(Bearer) — 제3자 사용 금지·거부 보고, 권하지 않음
#   옵션: --no-check (설치 후 검사 생략), --no-browser (Playwright 브라우저 설치 생략)
#
# 하는 일: Node/pnpm 확인 → 의존성 설치 → .env 생성(없을 때만) → Playwright 브라우저 확인/설치 → pnpm check → 시작 방법 안내.
# 비밀값(키·토큰)은 .env 에만 쓰고(.gitignore) 화면에 표시하지 않는다.
set -euo pipefail
cd "$(dirname "$0")/.."

YES=0; ADAPTER=""; AUTH=""; RUN_CHECK=1; INSTALL_BROWSER=1
while [ $# -gt 0 ]; do
  case "$1" in
    --yes|-y) YES=1 ;;
    --adapter)
      ADAPTER="$2"; shift
      case "$ADAPTER" in claude_code|anthropic|fixture) ;; *) fail "--adapter 값이 올바르지 않습니다: $ADAPTER (claude_code | anthropic | fixture)" ;; esac
      ;;
    --auth) AUTH="$2"; shift ;;
    --no-check) RUN_CHECK=0 ;;
    --no-browser) INSTALL_BROWSER=0 ;;
    -h|--help) sed -n '2,12p' "$0"; exit 0 ;;
    *) echo "알 수 없는 옵션: $1" >&2; exit 2 ;;
  esac
  shift
done

say() { printf '\n\033[1;34m[con-ai]\033[0m %s\n' "$*"; }
fail() { printf '\n\033[1;31m[con-ai] 실패:\033[0m %s\n' "$*" >&2; exit 1; }

# 1) Node 22+ / pnpm
say "Node·pnpm 확인"
command -v node >/dev/null 2>&1 || fail "Node.js 22 이상이 필요합니다 (https://nodejs.org)"
NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
[ "$NODE_MAJOR" -ge 22 ] || fail "Node.js 22 이상이 필요합니다 (현재 $(node --version))"
if ! command -v pnpm >/dev/null 2>&1; then
  if command -v corepack >/dev/null 2>&1; then
    say "pnpm 이 없어 corepack 으로 활성화합니다"
    corepack enable && corepack prepare "$(node -p 'require("./package.json").packageManager')" --activate
  else
    fail "pnpm 이 필요합니다: npm install -g pnpm@$(node -p 'require("./package.json").packageManager.split("@")[1]')"
  fi
fi
echo "node $(node --version), pnpm $(pnpm --version)"

# 2) 의존성
say "의존성 설치 (pnpm install)"
pnpm install --reporter=append-only

# 3) .env
if [ -f .env ]; then
  say ".env 가 이미 있어 그대로 둡니다"
  # 플래그를 줬는데 조용히 버리면 사용자는 토큰 세팅이 먹은 줄 안다 (SessionStart 훅이 매 세션 fixture .env 를 먼저 만든다).
  if [ -n "$ADAPTER" ] || [ -n "$AUTH" ]; then
    echo "  ⚠ --adapter/--auth 는 적용되지 않았습니다. 기존 .env 를 고치지 않습니다."
    echo "    내 Claude 계정으로 바꾸려면 .env 의 한 줄만 고치세요 (API 키·토큰 불필요):"
    echo "      MODEL_ADAPTER=claude_code"
    echo "      ANTHROPIC_AUTH_TOKEN=<\`claude setup-token\` 으로 받은 값>"
    echo "    (또는 .env 를 지우고 이 스크립트를 다시 실행하세요)"
  fi
else
  if [ -z "$ADAPTER" ]; then
    if [ "$YES" = 1 ]; then ADAPTER=fixture; else
      printf '\n모델 어댑터를 고르세요 [1] claude_code(내 Claude 로그인으로 실제 호출 — API 키 불필요, 권장)  [2] fixture(더미, 기본)  [3] anthropic(API 키): '
      read -r a; case "$a" in 1) ADAPTER=claude_code ;; 3) ADAPTER=anthropic ;; *) ADAPTER=fixture ;; esac
    fi
  fi
  KEY=""; TOKEN=""
  # claude_code 는 자격 증명을 받지 않는다 — 그 기계의 Claude Code 로그인이 인증한다.
  if [ "$ADAPTER" = claude_code ]; then
    if command -v claude >/dev/null 2>&1; then
      echo "  claude CLI 확인: $(claude --version 2>/dev/null | head -1)"
      echo "  로그인이 안 되어 있으면 터미널에서 claude 를 한 번 실행하세요 (구독 필요)."
    else
      echo "  ⚠ claude 를 찾지 못했습니다. 설치 후 다시 실행하세요: https://code.claude.com/docs/en/setup"
      echo "    (설치 전까지는 생성이 「Claude Code CLI 를 찾지 못했습니다」로 정직하게 실패합니다 — 더미로 바꾸지 않습니다.)"
    fi
  fi
  if [ "$ADAPTER" = anthropic ]; then
    if [ -z "$AUTH" ]; then
      if [ "$YES" = 1 ]; then AUTH=api_key; else
        # 구독 토큰 직접 호출은 Anthropic 이 제3자 사용을 금지했고 API 가 거부한다는 보고가 다수다 — 기본값에서 뺐다.
        printf '인증 방식을 고르세요 [1] API 키(ANTHROPIC_API_KEY, 기본)  [2] 구독 토큰(권하지 않음 — 제3자 사용 금지·거부 보고): '
        read -r b; case "$b" in 2) AUTH=token ;; *) AUTH=api_key ;; esac
      fi
    fi
    if [ "$YES" != 1 ]; then
      if [ "$AUTH" = token ]; then
        echo '토큰이 없으면 다른 터미널에서 `claude setup-token` 을 실행해 받으세요 (Claude 구독 필요).'
        printf '토큰을 붙여넣으세요 (입력이 표시되지 않음, 비워 두면 나중에 .env 에 직접 기입): '; read -rs TOKEN; echo
      else
        printf 'API 키를 입력하세요 (입력이 표시되지 않음, 비워 두면 나중에 .env 에 직접 기입): '; read -rs KEY; echo
      fi
    fi
  fi
  # 자격 증명 없이 anthropic 으로 쓰면 API 가 부팅 중 죽는다 (pnpm dev 에서는 Vite 만 살아 브라우저가 연결 오류를 본다).
  if [ "$ADAPTER" = anthropic ]; then
    if { [ "$AUTH" = token ] && [ -z "$TOKEN" ]; } || { [ "$AUTH" = api_key ] && [ -z "$KEY" ]; }; then
      ADAPTER=fixture
      PENDING=1
      echo "  ⚠ 자격 증명이 비어 있어 MODEL_ADAPTER=fixture 로 적습니다 (빈 값으로 anthropic 을 쓰면 API 가 부팅 중 죽습니다)."
      echo "    값을 채운 뒤 .env 의 MODEL_ADAPTER 를 anthropic 으로 바꾸세요."
    fi
  fi
  say ".env 생성 (어댑터: $ADAPTER${AUTH:+, 인증: $AUTH})"
  # 쓰는 동안에도 남이 읽지 못하게 먼저 권한을 준다 (전에는 다 쓴 뒤에 chmod 했다).
  : > .env && chmod 600 .env
  {
    echo "# con-ai 실행 설정 — scripts/setup.sh 가 생성. 비밀값은 이 파일에만 둔다 (.gitignore)"
    echo "MODEL_ADAPTER=$ADAPTER"
    echo "MODEL_ID=claude-opus-5"
    echo "MODEL_AUTH=${AUTH:-auto}"
    # 단일 인용해 적는다 — 특수문자가 든 값이 `source .env` 에서 전개·명령 치환되지 않게.
    printf "ANTHROPIC_API_KEY='%s'\n" "$(printf %s "$KEY" | sed "s/'/'\\\\''/g")"
    printf "ANTHROPIC_AUTH_TOKEN='%s'\n" "$(printf %s "$TOKEN" | sed "s/'/'\\\\''/g")"
    if [ -x /opt/pw-browsers/chromium ]; then echo "PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium"; else echo "PLAYWRIGHT_CHROMIUM_PATH="; fi
    echo "PORT=8787"
    echo "CON_AI_DB=.local/con-ai.db"
    echo "EXPORT_DIR=exports"
  } > .env
  chmod 600 .env
fi
mkdir -p .local exports

# 4) Playwright 브라우저 (V3 실행 검사·e2e 용)
if [ "$INSTALL_BROWSER" = 1 ]; then
  say "Playwright 브라우저 확인"
  if [ -x /opt/pw-browsers/chromium ] || [ -x "${PLAYWRIGHT_CHROMIUM_PATH:-/nonexistent}" ]; then
    echo "미리 설치된 Chromium 을 사용합니다"
  elif pnpm exec playwright install chromium >/dev/null 2>&1; then
    echo "Chromium 설치 완료"
  else
    echo "Chromium 을 설치하지 못했습니다(네트워크 제한?). V3 실행 검사는 'error' 로 기록되며 승인 전에 브라우저를 설치해야 합니다."
  fi
fi

# 5) 검사
if [ "$RUN_CHECK" = 1 ]; then
  say "검사 (pnpm check)"
  pnpm check
fi

say "준비 완료"
cat <<'EOF'
시작:  pnpm dev     (.env 는 API 가 스스로 읽습니다 — source 불필요)
       → 웹 http://localhost:5173 , API http://localhost:8787
실제 모델 호출로 바꾸기: .env 에 MODEL_ADAPTER=claude_code 를 넣고 API 를 재시작 (API 키 불필요 — 터미널에서 claude 로 한 번 로그인)
       (API 키로 쓰려면 MODEL_ADAPTER=anthropic, MODEL_AUTH=api_key, ANTHROPIC_API_KEY)
EOF
