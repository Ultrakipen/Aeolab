#!/usr/bin/env node
/**
 * 네이버 서치어드바이저 IndexNow 제출 스크립트.
 * 라이브 사이트맵(https://aeolab.co.kr/sitemap.xml)의 URL 전체를 읽어
 * 네이버 IndexNow 엔드포인트로 일괄 제출한다 — 신규/수정 페이지를 크롤 대기 없이 즉시 통보.
 *
 * 사용법: node scripts/naver_indexnow_ping.mjs
 * 실행 시점: 배포 후(sitemap.ts 변경분이 반영된 뒤) 수동 실행 권장. 자동 크론 아님.
 * 키 파일: public/846fd6a8840d3b05e7ea6385024df3ad.txt (IndexNow 소유권 검증용, 절대 삭제 금지)
 */

const SITE_URL = "https://aeolab.co.kr";
const INDEXNOW_KEY = "846fd6a8840d3b05e7ea6385024df3ad";
const KEY_LOCATION = `${SITE_URL}/${INDEXNOW_KEY}.txt`;
const INDEXNOW_ENDPOINT = "https://searchadvisor.naver.com/indexnow";

async function main() {
  const sitemapRes = await fetch(`${SITE_URL}/sitemap.xml`);
  if (!sitemapRes.ok) {
    console.error(`사이트맵 조회 실패: HTTP ${sitemapRes.status}`);
    process.exit(1);
  }
  const sitemapXml = await sitemapRes.text();
  const urlList = [...sitemapXml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);

  if (urlList.length === 0) {
    console.error("사이트맵에서 URL을 찾지 못함 — 중단");
    process.exit(1);
  }

  console.log(`제출 대상 URL ${urlList.length}건`);

  const res = await fetch(INDEXNOW_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host: "aeolab.co.kr",
      key: INDEXNOW_KEY,
      keyLocation: KEY_LOCATION,
      urlList,
    }),
  });

  console.log(`IndexNow 응답: HTTP ${res.status}`);
  const body = await res.text();
  if (body) console.log(body);

  if (res.status !== 200 && res.status !== 202) {
    console.error("제출 실패");
    process.exit(1);
  }
  console.log("제출 완료");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
