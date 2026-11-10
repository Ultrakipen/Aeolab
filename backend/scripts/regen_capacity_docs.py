"""용량 모델(scripts/naver_load_model.py)의 수치로 PLAYBOOK 효과 문구와 용량 문서 표를 다시 쓴다 (2026-11-10).

모델 상수(AI탭 페이지 수·브리핑 페이지 수 등)를 바꾸면 `services/naver_capacity.py`의 `PLAYBOOK` 효과 수치 4개와
`docs/naver_capacity_300_playbook_2026_10_29.md`의 표 9행이 낡는다. 손으로 고치면 어긋나므로 이 스크립트가 같은 규칙으로 다시 쓴다.
`tests/test_naver_page_cost_consistency.py`가 모델과의 일치를 강제한다(어긋나면 시험이 실패 → 이 스크립트를 돌린다).

사용: python backend/scripts/regen_capacity_docs.py            # 다시 쓴다
      python backend/scripts/regen_capacity_docs.py --check    # 쓰지 않고 어긋났는지만 확인(어긋나면 종료 코드 1)
"""
import importlib.util
import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, "backend"))


def _model():
    spec = importlib.util.spec_from_file_location("naver_load_model_regen", os.path.join(ROOT, "scripts", "naver_load_model.py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def _rows(m, n):
    return {r["name"].split(" ")[0]: r for r in m.lever_report(n)}


def _pct(r):
    return f"{r['batch_peak'] / r['batch_cap'] * 100:.0f}%"


def _cell(r):
    return f"{r['batch_peak']:,.0f} ({r['batch_peak'] / r['batch_cap'] * 100:.0f}%)"


def build() -> tuple[str, str]:
    """(새 naver_capacity.py 텍스트, 새 문서 텍스트)"""
    m = _model()
    r100, r300 = _rows(m, 100), _rows(m, 300)
    cap = r100["A"]["batch_cap"]

    cap_path = os.path.join(ROOT, "backend", "services", "naver_capacity.py")
    cap_src = io.open(cap_path, encoding="utf-8", newline="").read().replace("\r\n", "\n")
    subs = [
        (r"100곳 기준 정기 잡 하루 최대 \d+→\d+ \(몫 \d+ 대비 \d+%→\d+%\)",
         f"100곳 기준 정기 잡 하루 최대 {r100['A']['batch_peak']:.0f}→{r100['B']['batch_peak']:.0f} (몫 {cap:.0f} 대비 {_pct(r100['A'])}→{_pct(r100['B'])})"),
        (r"300곳 기준 정기 잡 몫 대비 \d+%→\d+%",
         f"300곳 기준 정기 잡 몫 대비 {_pct(r300['E'])}→{_pct(r300['H'])}"),
        (r"300곳 기준 \d+%→\d+% \(야간·수동 스캔",
         f"300곳 기준 {_pct(r300['B'])}→{_pct(r300['C'])} (야간·수동 스캔"),
        (r"300곳 기준 \d+%→\d+% \(30% 가정\)",
         f"300곳 기준 {_pct(r300['C'])}→{_pct(r300['D'])} (30% 가정)"),
    ]
    for pat, new in subs:
        assert len(re.findall(pat, cap_src)) == 1, pat
        cap_src = re.sub(pat, new, cap_src, count=1)

    doc_path = os.path.join(ROOT, "docs", "naver_capacity_300_playbook_2026_10_29.md")
    doc = io.open(doc_path, encoding="utf-8", newline="").read().replace("\r\n", "\n")
    heads = {"A": "| A 슬롯 분산 |", "B": "| B + AI탭 질의 2 |", "C": "| C + 사전 스캔 재사용 |", "D": "| D + 경쟁사 겹침 30% |",
             "E": "| E + 키워드 3·경쟁사 2 |", "F": "| F + 순위 모바일만 |", "G": "| G + AI탭 끔 |", "H": "| H + 경쟁사 4주 갱신 |",
             "I": "| I + 경쟁사 겹침 60% |"}
    for key, head in heads.items():
        pat = re.compile(r"^(" + re.escape(head) + r") [^|]+\| [^|]+\|", re.M)
        assert len(pat.findall(doc)) == 1, head
        doc = pat.sub(lambda mo: f"{mo.group(1)} {_cell(r300[key])} | {_cell(r100[key])} |", doc, count=1)
    h = r300["H"]
    doc = re.sub(r"\(H는 \d+%로 아직 넘는다\)", f"(H는 {_pct(h)}로 아직 넘는다)", doc, count=1)
    doc = re.sub(r"'전체'\(수동 스캔 포함\)는 H에서도 [\d,]+으로", f"'전체'(수동 스캔 포함)는 H에서도 {h['total_peak']:,.0f}으로", doc, count=1)
    return cap_src, doc


def main() -> int:
    check = "--check" in sys.argv
    cap_src, doc = build()
    cap_path = os.path.join(ROOT, "backend", "services", "naver_capacity.py")
    doc_path = os.path.join(ROOT, "docs", "naver_capacity_300_playbook_2026_10_29.md")
    changed = []
    for path, new in ((cap_path, cap_src), (doc_path, doc)):
        old = io.open(path, encoding="utf-8", newline="").read().replace("\r\n", "\n")
        if old != new:
            changed.append(os.path.relpath(path, ROOT))
            if not check:
                io.open(path, "w", encoding="utf-8", newline="\n").write(new)
    if check:
        print("어긋남: " + ", ".join(changed) if changed else "일치")
        return 1 if changed else 0
    print("갱신: " + ", ".join(changed) if changed else "이미 최신(변경 없음)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
