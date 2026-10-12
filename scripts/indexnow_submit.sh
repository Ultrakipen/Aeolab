#!/usr/bin/env bash
# IndexNow(Bing·네이버·Yandex) 즉시 색인 알림 — sitemap.xml의 전체 URL을 한 번에 제출.
# 키 파일: frontend/public/846fd6a8840d3b05e7ea6385024df3ad.txt (https://aeolab.co.kr/<key>.txt 로 서빙됨)
# 사용: bash scripts/indexnow_submit.sh   (새 글·대규모 개편 배포 후 실행)
set -euo pipefail
HOST="aeolab.co.kr"
KEY="846fd6a8840d3b05e7ea6385024df3ad"
URLS=$(curl -s "https://$HOST/sitemap.xml" | grep -o '<loc>[^<]*' | sed 's/<loc>//' \
  | grep -v -E '/(login|signup)$' | python -c 'import sys,json;print(json.dumps([l.strip() for l in sys.stdin if l.strip()]))')
BODY=$(python -c "import json,sys;print(json.dumps({'host':'$HOST','key':'$KEY','keyLocation':'https://$HOST/$KEY.txt','urlList':json.loads(sys.argv[1])}))" "$URLS")
for EP in "https://api.indexnow.org/indexnow" "https://searchadvisor.naver.com/indexnow"; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$EP" -H "Content-Type: application/json; charset=utf-8" -d "$BODY")
  echo "$EP -> HTTP $CODE"
done
