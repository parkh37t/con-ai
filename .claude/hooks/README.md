# 훅 (L5 자동 검증)

## html-lint.py
화면설계 HTML 저장 시 13개 회귀 패턴을 검출하는 린터. (S2B `html-lint.ps1` 이식)

### 수동 실행
```bash
python3 .claude/hooks/html-lint.py 화면설계/프론트/front-product-detail.html
```

### 저장 시 자동 실행으로 등록하려면 (선택)
`.claude/settings.json`(또는 `settings.local.json`)에 아래를 추가하세요.
> ⚠️ 에이전트 시작 설정을 바꾸는 작업이라, 사용자가 직접 추가하거나 `/update-config` 스킬로 적용해야 합니다. (자동 등록은 안전 가드레일로 차단됨)

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit",
        "hooks": [
          { "type": "command", "command": "python3 \"$CLAUDE_PROJECT_DIR/.claude/hooks/html-lint.py\"" }
        ]
      }
    ]
  }
}
```

등록되면 Write/Edit 직후 대상이 `화면설계/**/*.html`일 때 경고를 출력합니다(비차단, exit 0).
