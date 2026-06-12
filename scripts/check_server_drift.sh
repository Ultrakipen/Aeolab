#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# AEOlab 서버 라이브 ↔ 로컬 git-tracked 파일 drift 점검 (읽기 전용·안전)
#
# scp 직접 배포와 git이 어긋나 누적되는 drift를 조기에 잡는다.
# 줄바꿈(CRLF/LF) 차이는 정규화 후 비교하므로 "유령 drift"는 무시된다.
#
# 사용:  bash scripts/check_server_drift.sh
# 환경변수(선택): DRIFT_SRV=root@115.68.231.57  DRIFT_SRVDIR=/var/www/aeolab
#
# 출력:
#   [내용DRIFT] 서버 라이브 ≠ 로컬 (방향=서버최신/로컬최신 mtime 기준)
#   [서버에만]  git 추적인데 로컬에 없음(서버에서 직접 수정 후 미동기)
#   [로컬에만]  로컬엔 있는데 서버에 없음
# 권장: 주 1회 실행. [내용DRIFT] 0건이 정상.
# ─────────────────────────────────────────────────────────────────────────────
set -u

SRV=${DRIFT_SRV:-root@115.68.231.57}
SRVDIR=${DRIFT_SRVDIR:-/var/www/aeolab}

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || { echo "git 저장소가 아닙니다."; exit 1; }
cd "$ROOT" || exit 1

echo "[drift] 서버($SRV:$SRVDIR) 추적파일 md5 수집 (1 ssh)..."
# while 루프가 마지막 파일 부재 시 exit 1을 내지 않도록 if/fi 사용 (파이프 종료코드 오인 방지)
ssh -n "$SRV" "cd '$SRVDIR' && git ls-files 2>/dev/null | while IFS= read -r f; do if [ -f \"\$f\" ]; then printf '%s\t%s\n' \"\$(tr -d '\r' < \"\$f\" | md5sum | cut -d' ' -f1)\" \"\$f\"; fi; done" > /tmp/drift_srv.txt 2>/dev/null
if [ ! -s /tmp/drift_srv.txt ]; then echo "서버 접속 실패 또는 수집 0건 — SSH 연결을 확인하세요."; exit 1; fi

echo "[drift] 로컬 추적파일 md5 수집..."
git ls-files | while IFS= read -r f; do
  if [ -f "$f" ]; then printf '%s\t%s\n' "$(tr -d '\r' < "$f" | md5sum | cut -d' ' -f1)" "$f"; fi
done > /tmp/drift_loc.txt

echo ""
echo "===== DRIFT 리포트 ====="
DRIFT=$(awk -F'\t' '
  NR==FNR { s[$2]=$1; next }
  { l[$2]=$1
    if (!($2 in s))      print "  [로컬에만]  " $2
    else if (s[$2]!=$1)  print "  [내용DRIFT] " $2
  }
  END { for (p in s) if (!(p in l)) print "  [서버에만]  " p }
' /tmp/drift_srv.txt /tmp/drift_loc.txt | sort)

if [ -z "$DRIFT" ]; then
  echo "  ✅ drift 0건 — 서버 라이브 == 로컬 (git 추적 전체 일치)"
else
  echo "$DRIFT"
  N=$(printf '%s\n' "$DRIFT" | grep -c '\[내용DRIFT\]')
  echo ""
  echo "  ⚠ [내용DRIFT] ${N}건 — 서버/로컬 reconcile 필요."
  echo "    방향 판정:  ssh $SRV \"stat -c %y $SRVDIR/<파일>\"  vs  stat -c %y <파일>"
  echo "    원칙: 라이브가 정답이면 scp 서버→로컬, 로컬이 최신이면 scp 로컬→서버 후 빌드."
fi
echo "===== 끝 ====="
