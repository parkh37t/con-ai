#!/usr/bin/env python3
"""html-lint (L5) — 롯데면세점 화면설계서 회귀 패턴 검출 훅 (S2B html-lint.ps1 이식).

PostToolUse 훅으로 동작: Write/Edit 직후 stdin으로 받은 tool_input.file_path가
화면설계/**/*.html 이면 13개 회귀 패턴을 검사하고 경고를 stderr로 출력한다.
경고가 있어도 exit 0 (비차단) — 생산 흐름을 막지 않고 알림만 준다.

수동 실행: python3 .claude/hooks/html-lint.py <file.html>
"""
import sys, os, json, re

PATTERNS = [
    (r"replace\(/\\?/g,", "1. 미터미네이트/오작성 regex replace(/\\/g, ...)"),
    (r"<td>span>", "2. 깨진 <td>span> 태그"),
    (r"<\s*/\s+\w+\s*>", "3. 공백 들어간 닫는 태그 (예: < / div>)"),
    (r"(front-nav\.js[\s\S]*front-nav\.js|admin-nav\.js[\s\S]*admin-nav\.js)", "4. nav 스크립트 중복 로드"),
    (r'class="num-badge"[^>]*>\s*[A-Za-z]\s*<', "9. num-badge 안 알파벳(P/Q/D/R 등)"),
    (r'class="num-badge-sm"[^>]*>\s*\d', "8. num-badge-sm 안 숫자/N-M"),
    (r"num-badge-xs", "10. 폐기 클래스 num-badge-xs"),
    (r'class="num-badge-sm"[^>]*>.*?</span>\s*<span class="num-badge-sm"', "12. 인접 중복 num-badge-sm"),
    (r"\.ui-marker\s*\{[^}]*display\s*:\s*none", "13. 폐기 CSS .ui-marker{display:none}"),
    (r"\[프로토타입\]|데모 단계입니다", "7. msg-text 안 스캐폴딩/데모 문구"),
]

def check(path):
    try:
        html = open(path, encoding="utf-8").read()
    except Exception as e:
        return [f"파일 읽기 실패: {e}"]
    warns = []
    for rx, msg in PATTERNS:
        if re.search(rx, html):
            warns.append(msg)
    # 5. root-shell 인데 SECTION-CARD 주석 마커 누락
    if "root-shell" in html and "SECTION-CARD" not in html:
        warns.append("5. root-shell 이지만 <style>에 SECTION-CARD 주석 마커 누락")
    # 6. info-table 에 화면ID 중복행(화면ID 행 금지 — h2와 중복)
    if re.search(r"<th>\s*화면ID\s*</th>", html):
        warns.append("6. info-table 에 '화면ID' 행 존재(금지 — h2와 중복)")
    # 11. 인라인 bg-black rounded-full 마커 (X-close 제외 단순 검출)
    if re.search(r'bg-black[^"]*rounded-full', html):
        warns.append("11. 인라인 bg-black rounded-full 마커(가능하면 num-badge 사용)")
    # right-panel 있으면 msg-tbl 존재 권고
    if 'id="right-panel"' in html and "msg-tbl" not in html:
        warns.append("권고: right-panel 에 msg-tbl(메시지·알림 정의) 누락")
    # 14. msg-tbl 이 right-panel 외부 (8단 골격 위반 — 디스크립션 맨 아래여야)
    rp = html.find('id="right-panel"'); mt = html.find("msg-tbl")
    if mt != -1 and rp != -1 and mt < rp:
        warns.append("14. msg-tbl 이 right-panel 외부에 위치(디스크립션 맨 아래여야)")
    return warns

def target_path():
    # PostToolUse: stdin JSON / 수동: argv[1]
    if len(sys.argv) > 1:
        return sys.argv[1]
    try:
        data = json.load(sys.stdin)
        return (data.get("tool_input") or {}).get("file_path", "")
    except Exception:
        return ""

def main():
    path = target_path()
    if not path or not path.endswith(".html"):
        return 0
    if "화면설계" not in path and "templates" not in path:
        return 0
    if not os.path.exists(path):
        return 0
    warns = check(path)
    if warns:
        sys.stderr.write(f"\n[html-lint] {os.path.basename(path)} — 회귀 경고 {len(warns)}건:\n")
        for w in warns:
            sys.stderr.write(f"  ⚠ {w}\n")
        sys.stderr.write("  → 가능하면 즉시 수정하세요. (SKILL.md '회귀 방지' 참조)\n\n")
    return 0  # 비차단

if __name__ == "__main__":
    sys.exit(main())
