#!/usr/bin/env bash
# /area(우리 동네 상권) + /tools(사장님 계산기) 프런트 배포 (2026-11-16)
#
# **반드시 백엔드를 먼저 배포한 뒤 실행한다**(허브가 빌드 때 GET /api/area/meta 를 호출 — 서버 백엔드가 옛 코드면 빌드 실패):
#   bash scripts/deploy_backend_files.sh backend/main.py backend/routers/area.py backend/services/area_data.py \
#        backend/services/area_snapshot.py backend/services/area_regions.json backend/scripts/area_collect.py \
#        backend/tests/test_area_snapshot.py
#
# 사용: bash scripts/deploy_area_tools_frontend.sh [--dry-run] [--env-lines <파일>]
#   --dry-run          서버에 접속하지 않고 로컬 검사·묶음 만들기·CR 검사까지만 한다(무엇을 올릴지 확인용)
#   --env-lines <파일> NEXT_PUBLIC_SBIZ365_URL_*='…' / NEXT_PUBLIC_SBIZ365_EXPIRES='…' 줄이 든 파일(키가 들어 있으니 저장소 밖에 둘 것).
#                      서버 frontend/.env.local 에 없는 줄만 덧붙인다(백업 후, 권한 600 유지). 값은 화면에 출력하지 않는다.
#
# 순서: ①로컬 검사(타입·계산 시험) ②서버 백엔드 /api/area/meta 200 확인 ③수정되는 기존 파일의 서버 md5 = git HEAD 확인(다르면 중단)
#       ④줄바꿈(CR) 제거해 묶음 만들기 ⑤서버 백업 ⑥업로드 ⑦(선택)env 추가 ⑧서버 npm run build ⑨pm2 재시작 ⑩주소별 응답·로그 확인
# 빌드나 확인이 실패하면 백업으로 되돌리고 다시 빌드·재시작한다(서버 프런트가 깨진 .next 로 남지 않게).
set -u

HOST="${DEPLOY_HOST:-root@115.68.231.57}"
ROOT_REMOTE="/var/www/aeolab"
DRY=0
ENVFILE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY=1 ;;
    --env-lines) shift; ENVFILE="${1:-}" ;;
    *) echo "알 수 없는 옵션: $1"; exit 2 ;;
  esac
  shift
done

# 서버에 이미 있고 이번에 내용이 바뀌는 파일(서버 md5 가 git HEAD 와 같아야 덮어쓴다)
MODIFIED=(
  frontend/app/page.tsx
  frontend/app/sitemap.ts
  frontend/components/common/SiteFooter.tsx
  frontend/next.config.ts
  frontend/package.json
  frontend/lib/analytics.ts
)
# 서버에 없는 새 파일·폴더
NEWPATHS=(
  "frontend/app/(public)/area"
  "frontend/app/(public)/tools/_components"
  "frontend/app/(public)/tools/break-even"
  "frontend/app/(public)/tools/delivery-settlement"
  "frontend/app/(public)/tools/labor-cost"
  "frontend/app/(public)/tools/vat"
  "frontend/app/(public)/tools/page.tsx"
  frontend/lib/area.ts
  frontend/lib/calc
  frontend/lib/useClientValue.ts
  frontend/tests/calc.test.mjs
)

TS=$(date +%Y%m%d_%H%M%S)
BK="/root/deploy_backups/frontend_$TS"
STAGE=$(mktemp -d)
BUILD_STARTED=0
say() { echo "[deploy-fe] $*"; }
cleanup() { rm -rf "$STAGE"; }
trap cleanup EXIT

# 되돌리기: 수정 파일 복원 + 새 파일 삭제 + .env.local 복원 → (빌드를 시작했다면) 다시 빌드하고 재시작
rollback() {
  say "되돌리는 중... (백업: $BK)"
  ssh "$HOST" "cd $ROOT_REMOTE && for f in ${MODIFIED[*]}; do [ -f '$BK/'\$f ] && cp -p '$BK/'\$f \$f; done; \
    [ -f '$BK/frontend/.env.local' ] && cp -p '$BK/frontend/.env.local' frontend/.env.local; \
    while IFS= read -r p; do [ -n \"\$p\" ] && rm -rf \"\$p\"; done < '$BK/new_paths.txt'" \
    || say "복원 명령 일부 실패 — 백업 폴더에서 수동 복원 필요"
  if [ "$BUILD_STARTED" = "1" ]; then
    say "옛 코드로 다시 빌드·재시작합니다(1~2분)"
    ssh "$HOST" "cd $ROOT_REMOTE/frontend && npm run build 2>&1 | tail -3 && pm2 restart aeolab-frontend >/dev/null" || say "재빌드 실패 — 즉시 수동 확인 필요"
  fi
}

# ① 로컬 검사
say "① 로컬 검사(타입·계산 시험)"
( cd frontend && npx tsc --noEmit ) || { say "타입 오류 — 중단(서버 변경 없음)"; exit 1; }
( cd frontend && npm run test:calc --silent >/dev/null 2>&1 ) || { say "계산 시험 실패 — 중단(서버 변경 없음)"; exit 1; }
for f in "${MODIFIED[@]}"; do [ -f "$f" ] || { say "파일 없음: $f"; exit 2; }; done
for p in "${NEWPATHS[@]}"; do [ -e "$p" ] || { say "경로 없음: $p"; exit 2; }; done

# ④ 줄바꿈 제거한 묶음(서버는 LF) — 서버 상태와 무관하므로 dry-run 에서도 만든다
say "④ 업로드 묶음 만들기(CR 제거)"
stage_file() { mkdir -p "$STAGE/$(dirname "$1")"; tr -d '\r' < "$1" > "$STAGE/$1"; }
for f in "${MODIFIED[@]}"; do stage_file "$f"; done
for p in "${NEWPATHS[@]}"; do
  if [ -d "$p" ]; then
    while IFS= read -r -d '' f; do stage_file "$f"; done < <(find "$p" -type f -print0)
  else
    stage_file "$p"
  fi
done
COUNT=$(find "$STAGE" -type f | wc -l)
say "   묶음 파일 $COUNT개 (수정 ${#MODIFIED[@]}개 + 새 파일)"

# env 줄 검증(값 비출력): 허용 이름·소상공인365 호스트·작은따옴표 형식만
if [ -n "$ENVFILE" ]; then
  [ -f "$ENVFILE" ] || { say "env 파일 없음: $ENVFILE"; exit 2; }
  bad=$(grep -vE "^NEXT_PUBLIC_SBIZ365_(URL_[A-Z_]+='https://bigdata\.sbiz\.or\.kr/[^']+'|EXPIRES='[0-9]{4}-[0-9]{2}-[0-9]{2}')$" "$ENVFILE" | wc -l)
  [ "$bad" = "0" ] || { say "env 파일에 허용되지 않은 줄이 $bad개 있습니다 — 중단"; exit 2; }
  say "   env 줄 $(wc -l < "$ENVFILE")개 형식 확인(값은 출력하지 않음)"
fi

if [ "$DRY" = "1" ]; then
  say "dry-run 종료 — 올릴 파일 목록:"
  ( cd "$STAGE" && find . -type f | sed 's|^\./||' | sort )
  exit 0
fi

# ② 서버 백엔드 확인
say "② 서버 백엔드 /api/area/meta 확인"
code=$(ssh "$HOST" "curl -s -o /dev/null -w '%{http_code}' -m 5 localhost:8000/api/area/meta")
[ "$code" = "200" ] || { say "서버 백엔드에 /api/area/meta 가 없습니다(HTTP $code) — 백엔드를 먼저 배포하세요. 중단(서버 변경 없음)"; exit 1; }

# ③ 서버 md5 확인
say "③ 수정될 서버 파일 md5 = git HEAD 확인"
for f in "${MODIFIED[@]}"; do
  s=$(ssh "$HOST" "md5sum '$ROOT_REMOTE/$f' 2>/dev/null" | cut -c1-32)
  h=$(git show "HEAD:$f" 2>/dev/null | tr -d '\r' | md5sum | cut -c1-32)
  [ -n "$s" ] && [ "$s" = "$h" ] || { say "서버 파일이 git HEAD 와 다릅니다(서버가 진실일 수 있음): $f — 중단(서버 변경 없음). 서버→로컬로 먼저 받으세요."; exit 1; }
done

# ⑤ 백업
say "⑤ 서버 백업 ($BK)"
ssh "$HOST" "mkdir -p '$BK/frontend/lib' '$BK/frontend/app' '$BK/frontend/components/common' && cd $ROOT_REMOTE && for f in ${MODIFIED[*]}; do mkdir -p \"$BK/\$(dirname \$f)\"; cp -p \$f \"$BK/\$f\"; done; cp -p frontend/.env.local '$BK/frontend/.env.local'" || { say "백업 실패 — 중단(서버 변경 없음)"; exit 1; }
printf '%s\n' "${NEWPATHS[@]}" | ssh "$HOST" "cat > '$BK/new_paths.txt'"

# ⑥ 업로드
say "⑥ 업로드"
if ! tar -C "$STAGE" -cf - . | ssh "$HOST" "tar -C $ROOT_REMOTE -xf -"; then say "업로드 실패"; rollback; exit 1; fi

# ⑦ env 추가(선택)
if [ -n "$ENVFILE" ]; then
  say "⑦ 서버 .env.local 에 소상공인365 변수 추가(없는 줄만)"
  RT="/tmp/sbiz_env_$TS"
  scp -q "$ENVFILE" "$HOST:$RT" && ssh "$HOST" "chmod 600 '$RT'; cd $ROOT_REMOTE/frontend; [ -z \"\$(tail -c1 .env.local)\" ] || echo >> .env.local; \
    while IFS= read -r line; do name=\"\${line%%=*}\"; grep -q \"^\$name=\" .env.local || echo \"\$line\" >> .env.local; done < '$RT'; \
    chmod 600 .env.local; rm -f '$RT'" || { say "env 추가 실패"; rollback; exit 1; }
fi

# ⑧ 빌드
say "⑧ 서버 빌드(1~3분)"
BUILD_STARTED=1
# 성공 판정은 출력 문구가 아니라 빌드 종료 코드로 한다(11-16: 'Compiled successfully'는 출력 앞쪽에 있어 tail 로는 못 찾아
# 성공한 빌드를 실패로 보고 롤백한 사고가 있었다). 1줄=종료 코드, 2줄=성공 문구 개수, 이후=끝 12줄.
BUILD_OUT=$(ssh "$HOST" "cd $ROOT_REMOTE/frontend && npm run build > /tmp/fe_build_$TS.log 2>&1; echo \"BUILD_EXIT=\$?\"; grep -c 'Compiled successfully' /tmp/fe_build_$TS.log; tail -12 /tmp/fe_build_$TS.log")
printf '%s\n' "$BUILD_OUT" > "/tmp/fe_build_$TS.log"
if [ "$(printf '%s\n' "$BUILD_OUT" | sed -n 1p)" != "BUILD_EXIT=0" ] || [ "$(printf '%s\n' "$BUILD_OUT" | sed -n 2p)" -lt 1 ] 2>/dev/null; then
  say "빌드 실패(종료 코드·성공 문구 확인) — 로그: /tmp/fe_build_$TS.log (서버 로그 /tmp/fe_build_$TS.log)"; printf '%s\n' "$BUILD_OUT" | tail -15; rollback; exit 1
fi

# ⑨ 재시작
say "⑨ pm2 재시작"
ssh "$HOST" "pm2 restart aeolab-frontend >/dev/null"
sleep 8

# ⑩ 확인
say "⑩ 주소별 응답 확인(서버 내부 3000)"
fail=0
check() { # 경로 기대코드
  c=$(ssh "$HOST" "curl -s -o /dev/null -w '%{http_code}' -m 20 'localhost:3000$1'")
  [ "$c" = "$2" ] && echo "  OK   $1 -> $c" || { echo "  FAIL $1 -> $c (기대 $2)"; fail=1; }
}
check "/" 200
check "/area" 200
check "/tools" 200
check "/tools/break-even" 200
check "/tools/delivery-settlement" 200
check "/tools/labor-cost" 200
check "/tools/vat" 200
check "/area/%EC%84%9C%EC%9A%B8-%EA%B0%95%EB%82%A8%EA%B5%AC/restaurant" 200
check "/area/%EC%84%9C%EC%9A%B8-%EA%B0%95%EB%82%A8%EA%B5%AC/yoga" 404
errs=$(ssh "$HOST" "pm2 logs aeolab-frontend --err --lines 30 --nostream 2>/dev/null | grep -a -ciE 'error|unhandled' ")
say "   pm2 에러 로그의 error 줄 수(과거 기록 포함 가능): ${errs:-?}"
if [ "$fail" != "0" ]; then say "응답 확인 실패 — 되돌립니다"; rollback; exit 1; fi

bad=0
for f in "${MODIFIED[@]}"; do
  l=$(tr -d '\r' < "$f" | md5sum | cut -c1-8); s=$(ssh "$HOST" "md5sum '$ROOT_REMOTE/$f'" | cut -c1-8)
  [ "$l" = "$s" ] && echo "  일치 $f ($l)" || { echo "  불일치 $f local=$l server=$s"; bad=1; }
done
[ "$bad" = "0" ] && say "완료. 이어서 ①수집 시험(문서 §6) ②git 커밋을 잊지 마세요. 되돌리려면 백업: $BK" || { say "md5 불일치가 있습니다"; exit 1; }
