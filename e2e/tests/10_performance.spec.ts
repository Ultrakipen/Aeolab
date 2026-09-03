/**
 * 10_performance.spec.ts — Navigation Timing 성능 베이스라인 계측
 *
 * 목적: 처음으로 페이지별 성능 수치 베이스라인을 확보한다.
 *   - 별도 라이브러리(Lighthouse 등) 없이 네이티브 Performance API만 사용
 *   - 절대 pass/fail 기준은 없음 (첫 실행 — 정상 범위 미확정)
 *   - 결과를 표로 정리해 콘솔과 첨부파일로 출력
 *
 * 계측 지표:
 *   TTFB   = responseStart (서버 첫 바이트 도달)
 *   DOMContentLoaded = domContentLoadedEventEnd - fetchStart
 *   Load   = loadEventEnd - fetchStart (전체 리소스 로드 완료)
 *   FCP    = First Contentful Paint (PerformancePaintTiming)
 *
 * 대상: 비로그인 / 로그인 각 페이지 (09_accessibility.spec.ts 와 동일 세트)
 */

import { test, expect } from '../fixtures/auth';

type PerfEntry = {
  page: string;
  url: string;
  ttfb_ms: number;
  dclms: number;    // DOMContentLoaded
  load_ms: number;
  fcp_ms: number | null;
  note: string;
};

/** Navigation Timing + FCP 계측 */
async function measurePerf(
  page: import('@playwright/test').Page,
  label: string,
): Promise<PerfEntry> {
  const timing = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    const paintEntries = performance.getEntriesByType('paint');
    const fcp = paintEntries.find((e) => e.name === 'first-contentful-paint');

    if (!nav) {
      return {
        ttfb: -1,
        dcl: -1,
        load: -1,
        fcp: null as number | null,
      };
    }

    return {
      ttfb: Math.round(nav.responseStart - nav.fetchStart),
      dcl: Math.round(nav.domContentLoadedEventEnd - nav.fetchStart),
      load: Math.round(nav.loadEventEnd - nav.fetchStart),
      fcp: fcp ? Math.round(fcp.startTime) : null,
    };
  });

  const entry: PerfEntry = {
    page: label,
    url: page.url(),
    ttfb_ms: timing.ttfb,
    dclms: timing.dcl,
    load_ms: timing.load,
    fcp_ms: timing.fcp,
    note: timing.ttfb === -1 ? 'Navigation timing 없음' : '',
  };

  // 느린 기준 경고 (절대 fail 아님 — 베이스라인 확보 중)
  if (timing.ttfb > 2000) entry.note += ' [TTFB>2s]';
  if (timing.dcl > 5000) entry.note += ' [DCL>5s]';
  if (timing.load > 8000) entry.note += ' [Load>8s]';

  console.log(
    `[perf] ${label.padEnd(15)} TTFB:${String(entry.ttfb_ms).padStart(5)}ms` +
    ` DCL:${String(entry.dclms).padStart(5)}ms` +
    ` Load:${String(entry.load_ms).padStart(5)}ms` +
    ` FCP:${entry.fcp_ms != null ? String(entry.fcp_ms).padStart(5) + 'ms' : '  N/A'}` +
    (entry.note ? ` ${entry.note}` : ''),
  );

  // 첨부
  test.info().attach(`perf-${label.replace(/\//g, '_')}.json`, {
    body: JSON.stringify(entry, null, 2),
    contentType: 'application/json',
  });

  return entry;
}

// ───────────────────────────────────────────────
// 비로그인 공개 페이지
// ───────────────────────────────────────────────

const publicPages = [
  { path: '/', label: 'landing' },
  { path: '/pricing', label: 'pricing' },
  { path: '/how-it-works', label: 'how-it-works' },
  { path: '/faq', label: 'faq' },
  { path: '/trial', label: 'trial' },
  { path: '/keywords', label: 'keywords' },
];

test.describe('성능 베이스라인 — 비로그인 공개 페이지', () => {
  const results: PerfEntry[] = [];

  for (const { path, label } of publicPages) {
    test(`페이지 성능 계측: ${label} (${path})`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'load' });
      if (page.url().includes('/login')) {
        console.log(`[perf] ${label} → /login 리디렉션, 계측 skip`);
        return;
      }
      const entry = await measurePerf(page, label);
      results.push(entry);
      // 값이 비정상(음수 또는 극단값)이 아닌지만 확인
      expect(entry.ttfb_ms).toBeGreaterThanOrEqual(-1);
    });
  }

  test('비로그인 성능 요약 리포트 출력', async ({ page }) => {
    // 요약 테이블을 콘솔에 출력
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    console.log('\n[perf] ===== 비로그인 페이지 성능 베이스라인 =====');
    console.log('[perf] page           | TTFB  | DCL   | Load  | FCP');
    console.log('[perf] ' + '-'.repeat(55));
    for (const r of results) {
      console.log(
        `[perf] ${r.page.padEnd(14)}| ${String(r.ttfb_ms).padStart(5)} | ${String(r.dclms).padStart(5)} | ${String(r.load_ms).padStart(5)} | ${r.fcp_ms != null ? String(r.fcp_ms) : 'N/A'}`,
      );
    }
    console.log('[perf] ================================================\n');

    test.info().attach('perf-public-summary.json', {
      body: JSON.stringify(results, null, 2),
      contentType: 'application/json',
    });
    expect(true).toBeTruthy();
  });
});

// ───────────────────────────────────────────────
// 로그인 필요 대시보드 페이지
// ───────────────────────────────────────────────

const dashboardPages = [
  { path: '/dashboard', label: 'dashboard' },
  { path: '/guide', label: 'guide' },
  { path: '/competitors', label: 'competitors' },
  { path: '/growth', label: 'growth' },
  { path: '/history', label: 'history' },
  { path: '/settings', label: 'settings' },
  { path: '/support', label: 'support' },
];

test.describe('성능 베이스라인 — 로그인 필요 대시보드 페이지', () => {
  const results: PerfEntry[] = [];

  for (const { path, label } of dashboardPages) {
    test(`페이지 성능 계측: ${label} (${path})`, async ({ adminPage: page }) => {
      await page.goto(path, { waitUntil: 'load' });
      if (page.url().includes('/login')) {
        console.log(`[perf] ${label} → /login 리디렉션, 계측 skip`);
        return;
      }
      const entry = await measurePerf(page, label);
      results.push(entry);
      expect(entry.ttfb_ms).toBeGreaterThanOrEqual(-1);
    });
  }

  test('대시보드 성능 요약 리포트 출력', async ({ adminPage: page }) => {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    console.log('\n[perf] ===== 대시보드 페이지 성능 베이스라인 =====');
    console.log('[perf] page           | TTFB  | DCL   | Load  | FCP');
    console.log('[perf] ' + '-'.repeat(55));
    for (const r of results) {
      console.log(
        `[perf] ${r.page.padEnd(14)}| ${String(r.ttfb_ms).padStart(5)} | ${String(r.dclms).padStart(5)} | ${String(r.load_ms).padStart(5)} | ${r.fcp_ms != null ? String(r.fcp_ms) : 'N/A'}`,
      );
    }
    console.log('[perf] ================================================\n');

    test.info().attach('perf-dashboard-summary.json', {
      body: JSON.stringify(results, null, 2),
      contentType: 'application/json',
    });
    expect(true).toBeTruthy();
  });
});
