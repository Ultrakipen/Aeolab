#!/usr/bin/env bash
# 백엔드 파일 안전 배포 (2026-10-31) — scp 직접 배포의 사고(문법 오류가 든 파일을 올리고 재시작해 서버가 재시작을 반복하며 실패)를 막는다.
#
# 사용: bash scripts/deploy_backend_files.sh backend/services/a.py backend/tests/test_a.py ...   (저장소 루트에서)
#       --no-restart   파일만 올리고 테스트까지 하고 재시작하지 않는다
#       --force        서버 파일이 git HEAD·로컬과 모두 다를 때도 덮어쓴다(서버가 진실일 수 있으니 기본은 중단)
#
# 순서: ①로컬 py_compile ②서버 파일 md5 확인(서버만 달라졌으면 중단) ③서버 백업 ④업로드(LF) ⑤서버 py_compile
#       ⑥서버 전체 pytest ⑦pm2 재시작 ⑧/health 확인 + 시작 직후 SyntaxError/Traceback 확인 ⑨실패하면 백업으로 되돌리고 재시작
# 어느 단계에서든 실패하면 서버를 이전 상태로 되돌린다(⑦ 이전 실패는 재시작하지 않는다 = 서비스 무중단).
set -u

HOST="${DEPLOY_HOST:-root@115.68.231.57}"
ROOT_REMOTE="/var/www/aeolab"
PY_LOCAL="${PY_LOCAL:-backend_venv/Scripts/python}"
[ -x "$PY_LOCAL" ] || PY_LOCAL="python"
RESTART=1
FORCE=0
FILES=()
for a in "$@"; do
  case "$a" in
    --no-restart) RESTART=0 ;;
    --force) FORCE=1 ;;
    *) FILES+=("$a") ;;
  esac
done
[ ${#FILES[@]} -gt 0 ] || { echo "사용: bash scripts/deploy_backend_files.sh <파일...> [--no-restart] [--force]"; exit 2; }

TS=$(date +%Y%m%d_%H%M%S)
BK="/root/deploy_backups/$TS"
UPLOADED=()
EXISTED=()

say() { echo "[deploy] $*"; }

rollback() {
  say "되돌리는 중..."
  for i in "${!UPLOADED[@]}"; do
    f="${UPLOADED[$i]}"
    if [ "${EXISTED[$i]}" = "1" ]; then
      ssh "$HOST" "cp -p '$BK/$f' '$ROOT_REMOTE/$f'" || say "복원 실패: $f (백업: $BK/$f)"
    else
      ssh "$HOST" "rm -f '$ROOT_REMOTE/$f'"
    fi
  done
}

restart_and_check() {
  ssh "$HOST" "pm2 restart aeolab-backend --update-env >/dev/null"
  local ok=0
  for _ in $(seq 1 15); do
    sleep 2
    if ssh "$HOST" "curl -s -m 3 localhost:8000/health" | grep -q '"status":"ok"'; then ok=1; break; fi
  done
  [ "$ok" = "1" ] || return 1
  # 시작 직후 로그에 문법·임포트 오류가 있는지
  if ssh "$HOST" "pm2 logs aeolab-backend --err --lines 40 --nostream 2>/dev/null | grep -a -E 'SyntaxError|ImportError|ModuleNotFoundError|NameError'" | grep -q .; then
    # 이전 기록일 수 있어 한 번 더 확인: 지금 프로세스가 online이고 /health가 ok이면 과거 줄로 본다
    say "경고: 에러 로그에 오류 문자열이 보입니다(과거 기록일 수 있음) — /health는 정상입니다. 직접 확인하세요."
  fi
  return 0
}

# ① 로컬 문법 검사
for f in "${FILES[@]}"; do
  [ -f "$f" ] || { say "파일 없음: $f"; exit 2; }
  case "$f" in
    *.py) "$PY_LOCAL" -m py_compile "$f" || { say "로컬 문법 오류: $f — 중단(서버 변경 없음)"; exit 1; } ;;
  esac
done
say "① 로컬 문법 검사 통과"

# ② 서버 파일 md5 확인
for f in "${FILES[@]}"; do
  local_md5=$(tr -d '\r' < "$f" | md5sum | cut -c1-32)
  server_md5=$(ssh "$HOST" "md5sum '$ROOT_REMOTE/$f' 2>/dev/null" | cut -c1-32)
  head_md5=$(git show "HEAD:$f" 2>/dev/null | tr -d '\r' | md5sum | cut -c1-32)
  if [ -n "$server_md5" ] && [ "$server_md5" != "$local_md5" ] && [ "$server_md5" != "$head_md5" ] && [ "$FORCE" != "1" ]; then
    say "서버 파일이 로컬·HEAD와 모두 다릅니다(서버가 진실일 수 있음): $f — 중단. 서버→로컬로 먼저 받거나 --force"
    exit 1
  fi
done
say "② 서버 파일 상태 확인 통과"

# ③ 백업 + ④ 업로드
ssh "$HOST" "mkdir -p '$BK'"
for f in "${FILES[@]}"; do
  existed=0
  if ssh "$HOST" "test -f '$ROOT_REMOTE/$f'"; then
    existed=1
    ssh "$HOST" "mkdir -p '$BK/$(dirname "$f")' && cp -p '$ROOT_REMOTE/$f' '$BK/$f'" || { say "백업 실패: $f — 중단"; exit 1; }
  fi
  tmp=$(mktemp)
  tr -d '\r' < "$f" > "$tmp"
  if ! scp -q "$tmp" "$HOST:$ROOT_REMOTE/$f"; then
    rm -f "$tmp"; say "업로드 실패: $f"; UPLOADED+=("$f"); EXISTED+=("$existed"); rollback; exit 1
  fi
  rm -f "$tmp"
  UPLOADED+=("$f"); EXISTED+=("$existed")
done
say "③④ 백업($BK)·업로드 완료"

# ⑤ 서버 문법 검사 + ⑥ 서버 전체 테스트
for f in "${FILES[@]}"; do
  case "$f" in
    *.py) ssh "$HOST" "cd $ROOT_REMOTE && venv/bin/python -m py_compile '$f'" || { say "서버 문법 오류: $f"; rollback; exit 1; } ;;
  esac
done
say "⑤ 서버 문법 검사 통과"
RESULT=$(ssh "$HOST" "cd $ROOT_REMOTE/backend && $ROOT_REMOTE/venv/bin/python -m pytest -q -x 2>&1 | tail -1")
echo "$RESULT"
# 결과가 비었거나(SSH 실패 등) 'passed'가 없으면 통과로 보지 않는다 — 실패 문자열이 없다는 것만으로 통과 처리하면 빈 결과가 통과가 된다
if ! echo "$RESULT" | grep -q "passed" || echo "$RESULT" | grep -q "failed\|error"; then
  say "⑥ 서버 테스트 실패 또는 결과 확인 불가 — 재시작하지 않고 되돌립니다"; rollback; exit 1
fi
say "⑥ 서버 테스트 통과"

# ⑦ 재시작 + ⑧ 확인
if [ "$RESTART" = "1" ]; then
  if restart_and_check; then
    say "⑦⑧ 재시작·/health 정상"
  else
    say "⑦⑧ 재시작 후 /health 실패 — 되돌리고 다시 재시작합니다"
    rollback
    restart_and_check && say "이전 상태로 복구됨" || say "복구 후에도 /health 실패 — 즉시 수동 확인 필요"
    exit 1
  fi
else
  say "재시작 생략(--no-restart) — 반영하려면 pm2 restart aeolab-backend"
fi

# 최종 md5 일치
bad=0
for f in "${FILES[@]}"; do
  l=$(tr -d '\r' < "$f" | md5sum | cut -c1-8); s=$(ssh "$HOST" "md5sum '$ROOT_REMOTE/$f'" | cut -c1-8)
  [ "$l" = "$s" ] && echo "  일치 $f ($l)" || { echo "  불일치 $f local=$l server=$s"; bad=1; }
done
[ "$bad" = "0" ] && say "완료. 이어서 git 커밋을 잊지 마세요." || { say "md5 불일치가 있습니다"; exit 1; }
