#!/usr/bin/env python3
"""audit_mirror_lr (L5) — 좌(화면) ↔ 우(디스크립션) 마커 1:1 미러 검증 (S2B audit_mirror_lr.py 이식 골격).

LEFT = screen-wrap ~ right-panel 직전, RIGHT = #right-panel 내부.
섹션 마커(num-badge)와 필드 마커(num-badge-sm) 라벨 set 을 좌·우 비교해
left_only(디스크립션 누락) / right_only(화면 누락) 를 보고한다.

전 프로젝트(projects/*/화면설계/) 의 화면을 전수 검사한다.
실행: python3 scripts/audit_mirror_lr.py
"""
import os, re, glob, json

REPO = os.path.join(os.path.dirname(__file__), "..")
PATTERN = os.path.join(REPO, "projects", "*", "화면설계", "**", "*.html")

def split_lr(html):
    rp = html.find('id="right-panel"')
    if rp == -1:
        return None, None
    return html[:rp], html[rp:]

def badges(segment):
    sec = re.findall(r'class="num-badge"[^>]*>\s*([^<]+?)\s*<', segment)
    fld = re.findall(r'class="num-badge-sm"[^>]*>\s*([^<]+?)\s*<', segment)
    return [s.strip() for s in sec], [f.strip() for f in fld]

def audit(path):
    html = open(path, encoding="utf-8").read()
    left, right = split_lr(html)
    if left is None:
        return None
    lsec, lfld = badges(left)
    rsec, rfld = badges(right)
    return {
        "left_sections": len(lsec), "right_sections": len(rsec),
        "section_mismatch": len(lsec) != len(rsec),
        "field_left_only": sorted(set(lfld) - set(rfld)),
        "field_right_only": sorted(set(rfld) - set(lfld)),
    }

def main():
    files = sorted(glob.glob(PATTERN, recursive=True))
    report = {}
    for f in files:
        rel = os.path.relpath(f, REPO)
        r = audit(f)
        if r and (r["section_mismatch"] or r["field_left_only"] or r["field_right_only"]):
            report[rel] = r
    print(f"미러 검사 {len(files)}건 · 불일치 {len(report)}건")
    for rel, r in report.items():
        print(f"  ✗ {rel}: 섹션 {r['left_sections']}↔{r['right_sections']}"
              f" | left_only={r['field_left_only']} right_only={r['field_right_only']}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
