#!/usr/bin/env python3
"""patch_markers (L5) — 마커 5종 위반 보수적 자동 정정 (S2B patch_phase1~5 이식 통합).

audit_markers.py 가 검출한 위반을 안전하게 정정한다:
  p4   num-badge-xs            → num-badge-sm (클래스명 치환)
  p3   <span class="num-badge">알파벳</span> → 제거 (골든 외 P/Q/D/R)
  p2   num-badge-sm 안 숫자     → num-badge 로 클래스 변경(그 span 한정)
  p1b  인접 중복 num-badge-sm   → 둘째 span 제거(첫째 유지)
  p5   인라인 bg-black rounded-full → 검출만(컨텍스트 의존, 수동 정정 권장)

규범: 방법론/와일리-OS/07_s2b-production-mechanism.md §C.
실행: python3 scripts/patch_markers.py            (dry-run — 변경 건수만)
      python3 scripts/patch_markers.py --apply    (실제 정정·저장)
"""
import os, re, glob, sys

REPO = os.path.join(os.path.dirname(__file__), "..")
PATTERN = os.path.join(REPO, "projects", "*", "화면설계", "**", "*.html")

def patch(html):
    changes = {}
    # p4: num-badge-xs → num-badge-sm
    html, n = re.subn(r"num-badge-xs", "num-badge-sm", html)
    if n: changes["p4"] = n
    # p3: num-badge 안 알파벳 span 통째 제거
    html, n = re.subn(r'<span class="num-badge"[^>]*>\s*[A-Za-z]\s*</span>', "", html)
    if n: changes["p3"] = n
    # p2: num-badge-sm 안 숫자 → 클래스만 num-badge 로 변경
    html, n = re.subn(r'class="num-badge-sm"([^>]*>\s*\d)', r'class="num-badge"\1', html)
    if n: changes["p2"] = n
    # p1b: 인접 중복 num-badge-sm → 둘째 제거
    html, n = re.subn(
        r'(<span class="num-badge-sm"[^>]*>[^<]*</span>)\s*<span class="num-badge-sm"[^>]*>[^<]*</span>',
        r"\1", html)
    if n: changes["p1b"] = n
    # p5: 검출만 (정정 안 함)
    p5 = len(re.findall(r'bg-black[^"]*rounded-full', html))
    return html, changes, p5

def main():
    apply = "--apply" in sys.argv
    files = sorted(glob.glob(PATTERN, recursive=True))
    touched, total, p5total = 0, {}, 0
    for f in files:
        rel = os.path.relpath(f, REPO)
        orig = open(f, encoding="utf-8").read()
        new, changes, p5 = patch(orig)
        p5total += p5
        if changes:
            touched += 1
            for c, n in changes.items():
                total[c] = total.get(c, 0) + n
            mark = "정정" if apply else "정정대상"
            print(f"  {'✏' if apply else '·'} {rel}: " +
                  ", ".join(f"{c}({n})" for c, n in changes.items()) + f" [{mark}]")
            if apply and new != orig:
                open(f, "w", encoding="utf-8").write(new)
    mode = "APPLY(저장)" if apply else "DRY-RUN(미저장)"
    print(f"[{mode}] 대상 {len(files)}건 · 정정 파일 {touched}건 · " +
          (" ".join(f"{c}:{n}" for c, n in total.items()) or "변경 없음"))
    if p5total:
        print(f"  ⚠ p5(인라인 bg-black rounded-full) {p5total}건 — 자동정정 제외, 수동 확인 권장")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
