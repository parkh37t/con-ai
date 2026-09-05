#!/usr/bin/env bash
# con-ai 초기 세팅 — 어떤 환경에서든 `git clone` 뒤 이 스크립트 하나로 시작한다.
#
#   bash scripts/setup.sh                  # 대화형: 어댑터·인증 방식을 물어본다
#   bash scripts/setup.sh --yes            # 비대화: 기본값(fixture 더미 어댑터)으로 진행
#   bash scripts/setup.sh --adapter anthropic --auth api_key   # 실제 모델, API 키 방식 (.env 에 키를 채워야 함)
#   bash scripts/setup.sh --adapter anthropic --auth token     # 실제 모델, 토큰(Bearer) 방식
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
    --adapter) ADAPTER="$2"; shift ;;
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
else
  if [ -z "$ADAPTER" ]; then
    if [ "$YES" = 1 ]; then ADAPTER=fixture; else
      printf '\n모델 어댑터를 고르세요 [1] fixture(더미, 모델 호출 없음, 기본)  [2] anthropic(실제 호출): '
      read -r a; case "$a" in 2) ADAPTER=anthropic ;; *) ADAPTER=fixture ;; esac
    fi
  fi
  KEY=""; TOKEN=""
  if [ "$ADAPTER" = anthropic ]; then
    if [ -z "$AUTH" ]; then
      if [ "$YES" = 1 ]; then AUTH=api_key; else
        printf '인증 방식을 고르세요 [1] API 키(ANTHROPIC_API_KEY, 기본)  [2] 토큰(ANTHROPIC_AUTH_TOKEN, Bearer): '
        read -r b; case "$b" in 2) AUTH=token ;; *) AUTH=api_key ;; esac
      fi
    fi
    if [ "$YES" != 1 ]; then
      if [ "$AUTH" = token ]; then
        printf '토큰을 입력하세요 (입력이 표시되지 않음, 비워 두면 나중에 .env 에 직접 기입): '; read -rs TOKEN; echo
      else
        printf 'API 키를 입력하세요 (입력이 표시되지 않음, 비워 두면 나중에 .env 에 직접 기입): '; read -rs KEY; echo
      fi
    fi
  fi
  say ".env 생성 (어댑터: $ADAPTER${AUTH:+, 인증: $AUTH})"
  {
    echo "# con-ai 실행 설정 — scripts/setup.sh 가 생성. 비밀값은 이 파일에만 둔다 (.gitignore)"
    echo "MODEL_ADAPTER=$ADAPTER"
    echo "MODEL_ID=claude-opus-5"
    echo "MODEL_AUTH=${AUTH:-auto}"
    echo "ANTHROPIC_API_KEY=$KEY"
    echo "ANTHROPIC_AUTH_TOKEN=$TOKEN"
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
시작:  set -a; source .env; set +a; pnpm dev
       → 웹 http://localhost:5173 , API http://localhost:8787
실제 모델 호출로 바꾸기: .env 의 MODEL_ADAPTER=anthropic 과 ANTHROPIC_API_KEY(API 키) 또는 ANTHROPIC_AUTH_TOKEN(토큰) 중 하나를 채우고 API 를 재시작
EOF
