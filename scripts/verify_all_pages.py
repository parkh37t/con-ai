#!/usr/bin/env python3
"""verify_all_pages (L5) — 화면설계/ 전 HTML 전수 구조 검증 (S2B verify_all_pages.py 이식 골격).

검사: root-shell 자식 구조 · SECTION-CARD 마커 · info-table 화면ID 중복행 ·
좌(num-badge) ↔ 우(spec-header-2) 섹션 수 · msg-tbl 위치(right-panel 내부).
결과: scripts/verify_all.json + stdout 요약. (Playwright 렌더 검증은 추후 추가)

전 프로젝트(projects/*/화면설계/) 의 화면을 전수 검사한다.
실행: python3 scripts/verify_all_pages.py
"""
import os, re, json, glob

REPO = os.path.join(os.path.dirname(__file__), "..")
PATTERN = os.path.join(REPO, "projects", "*", "화면설계", "**", "*.html")

def verify(path):
    html = open(path, encoding="utf-8").read()
    issues = []
    if "root-shell" not in html:
        return ["root-shell 없음 (본 화면 아님 — 팝업/조각일 수 있음)"]
    if "SECTION-CARD" not in html:
        issues.append("SECTION-CARD 주석 마커 누락")
    if re.search(r"<th>\s*화면ID\s*</th>", html):
        issues.append("info-table 화면ID 행(금지)")
    # 좌(화면)/우(디스크립션) 분리 후 비교 — right-panel 직전까지가 LEFT
    rp = html.find('id="right-panel"')
    left_seg = html[:rp] if rp != -1 else html
    right_seg = html[rp:] if rp != -1 else ""
    left = len(re.findall(r'class="num-badge"', left_seg))
    right = len(re.findall(r"spec-header-2", right_seg))
    if left != right:
        issues.append(f"섹션 마커 좌({left}) ↔ 우 spec-header-2({right}) 불일치")
    # msg-tbl 이 right-panel 내부인지 (간이): right-panel 시작 이후 등장
    rp = html.find('id="right-panel"')
    mt = html.find("msg-tbl")
    if mt != -1 and rp != -1 and mt < rp:
        issues.append("msg-tbl 이 right-panel 외부에 위치")
    return issues

def main():
    files = sorted(glob.glob(PATTERN, recursive=True))
    report, bad = {}, 0
    for f in files:
        rel = os.path.relpath(f, REPO)
        issues = verify(f)
        if issues:
            bad += 1
            report[rel] = issues
    out = os.path.join(os.path.dirname(__file__), "verify_all.json")
    json.dump(report, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(f"검사 {len(files)}건 · 이슈 {bad}건 → {out}")
    for rel, issues in report.items():
        print(f"  ✗ {rel}: {', '.join(issues)}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
