"""네이버 사전 스캔(naver_prescan, GitHub Actions 야간 실행) 결과 재사용 판정.

야간 정기 스캔(jobs.daily_scan_all)과 수동 스캔(scan.py quick/full)이 같은 규칙으로 판단한다. 쓸 만하면 서버는
같은 네이버 AI 브리핑 접속을 다시 보내지 않는다(접속량 절감). 캡챠·오류·상한 건너뜀으로 끝난 사전 스캔은 쓸 수
없으므로 서버가 직접 측정한다 — 접속 실패를 '노출 안 됨'으로 저장하지 않기 위해서다(지침 8번, error ≠ false).
"""
from __future__ import annotations


def prescan_usable(prescan: "dict | None") -> bool:
    return bool(
        prescan
        and not prescan.get("captcha_detected")
        and not prescan.get("error")
        and not prescan.get("quota_skipped")
    )
