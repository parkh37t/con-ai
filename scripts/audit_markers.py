#!/usr/bin/env python3
"""audit_markers (L5) — 마커 5종 금지 패턴 일괄 스캔 (S2B audit_markers_admin_v2.py 이식).

전 프로젝트(projects/*/화면설계/**/*.html)에서 마커 컨벤션 위반을 검출한다:
  p1b  인접 중복 num-badge-sm (같은 라벨 안 두 span)
  p2   num-badge-sm 안 숫자/N-M (sub-section ID는 num-badge가 표준)
  p3   num-badge 안 알파벳 (P/Q/D/R 등 — 골든 외)
  p4   폐기 클래스 num-badge-xs
  p5   인라인 bg-black rounded-full 마커 (X-close 제외)

규범: 방법론/와일리-OS/07_s2b-production-mechanism.md §C.
실행: python3 scripts/audit_markers.py [--json]
정정: python3 scripts/patch_markers.py --apply
"""
import os, re, glob, json, sys

REPO = os.path.join(os.path.dirname(__file__), "..")
PATTERN = os.path.join(REPO, "projects", "*", "화면설계", "**", "*.html")

CHECKS = [
    ("p1b", "인접 중복 num-badge-sm",
     r'class="num-badge-sm"[^>]*>[^<]*</span>\s*<span class="num-badge-sm"'),
    ("p2", "num-badge-sm 안 숫자/N-M",
     r'class="num-badge-sm"[^>]*>\s*\d'),
    ("p3", "num-badge 안 알파벳(P/Q/D/R)",
     r'class="num-badge"[^>]*>\s*[A-Za-z]\s*<'),
    ("p4", "폐기 클래스 num-badge-xs",
     r'num-badge-xs'),
    ("p5", "인라인 bg-black rounded-full 마커",
     r'bg-black[^"]*rounded-full'),
]

def audit(path):
    html = open(path, encoding="utf-8").read()
    hits = {}
    for code, _desc, rx in CHECKS:
        m = re.findall(rx, html)
        if m:
            hits[code] = len(m)
    return hits

def main():
    as_json = "--json" in sys.argv
    files = sorted(glob.glob(PATTERN, recursive=True))
    report, totals = {}, {c[0]: 0 for c in CHECKS}
    for f in files:
        rel = os.path.relpath(f, REPO)
        hits = audit(f)
        if hits:
            report[rel] = hits
            for c, n in hits.items():
                totals[c] += n
    if as_json:
        print(json.dumps({"files": report, "totals": totals}, ensure_ascii=False, indent=2))
        return 0
    bad = sum(totals.values())
    print(f"마커 audit {len(files)}건 · 위반 {bad}건 "
          f"(" + " ".join(f"{c}:{totals[c]}" for c in totals) + ")")
    desc = {c[0]: c[1] for c in CHECKS}
    for rel, hits in report.items():
        detail = ", ".join(f"{c}({n}) {desc[c]}" for c, n in hits.items())
        print(f"  ✗ {rel}: {detail}")
    if not report:
        print("  ✅ 위반 없음")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
