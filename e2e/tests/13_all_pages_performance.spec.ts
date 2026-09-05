/**
 * 13_all_pages_performance.spec.ts — 10_performance.spec.ts가 다루지 않는
 * 나머지 전체 페이지(공개 26 + 대시보드 21 + 동적 샘플 2) 성능 계측.
 *
 * 10_performance.spec.ts와 동일한 계측 방식(Native Performance API, 절대
 * pass/fail 기준 없음). 관리자(/admin/*) 페이지는 기존 관행대로 제외.
 * 동적 라우트 중 실데이터가 없는 것(stories/[id], share/[bizId],
 * keywords/[slug], delivery/orders/[id], notices/[id], support/tickets/[id])은
 * 샘플을 만들 실사용 데이터가 없어 제외.
 */

import { test, expect } from '../fixtures/auth';

type PerfEntry = {
  page: string;
  url: string;
  ttfb_ms: number;
  dclms: number;
  load_ms: number;
  fcp_ms: number | null;
  note: string;
};

async function measurePerf(
  page: import('@playwright/test').Page,
  label: string,
): Promise<PerfEntry> {
  const timing = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    const paintEntries = performance.getEntriesByType('paint');
    const fcp = paintEntries.find((e) => e.name === 'first-contentful-paint');
    if (!nav) return { ttfb: -1, dcl: -1, load: -1, fcp: null as number | null };
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
  if (timing.ttfb > 2000) entry.note += ' [TTFB>2s]';
  if (timing.dcl > 5000) entry.note += ' [DCL>5s]';
  if (timing.load > 8000) entry.note += ' [Load>8s]';

  console.log(
    `[perf2] ${label.padEnd(28)} TTFB:${String(entry.ttfb_ms).padStart(5)}ms` +
    ` DCL:${String(entry.dclms).padStart(5)}ms` +
    ` Load:${String(entry.load_ms).padStart(5)}ms` +
    ` FCP:${entry.fcp_ms != null ? String(entry.fcp_ms).padStart(5) + 'ms' : '  N/A'}` +
    (entry.note ? ` ${entry.note}` : ''),
  );

  test.info().attach(`perf2-${label.replace(/\//g, '_')}.json`, {
    body: JSON.stringify(entry, null, 2),
    contentType: 'application/json',
  });
  return entry;
}

// ───────────────────────────────────────────────
// 비로그인 공개 페이지 (26개 — 동적 샘플 2개 포함)
// ───────────────────────────────────────────────

const publicPages2 = [
  { path: '/blog', label: 'blog' },
  { path: '/blog/2026-small-business-ai-guide', label: 'blog/[slug]' },
  { path: '/demo', label: 'demo' },
  { path: '/guide/channels', label: 'guide/channels' },
  { path: '/guide/channels/restaurant', label: 'guide/channels/[category]' },
  { path: '/guide/chatgpt-search', label: 'guide/chatgpt-search' },
  { path: '/help', label: 'help' },
  { path: '/index', label: 'index' },
  { path: '/ranking', label: 'ranking' },
  { path: '/share/growth', label: 'share/growth' },
  { path: '/showcase', label: 'showcase' },
  { path: '/stories', label: 'stories' },
  { path: '/terms', label: 'terms' },
  { path: '/tools/ad-cost-calculator', label: 'tools/ad-cost-calculator' },
  { path: '/tools/keyword', label: 'tools/keyword' },
  { path: '/trial/claimed', label: 'trial/claimed' },
  { path: '/quick', label: 'quick' },
  { path: '/plans-preview', label: 'plans-preview' },
  { path: '/privacy', label: 'privacy' },
  { path: '/score-guide', label: 'score-guide' },
  { path: '/login', label: 'login' },
  { path: '/signup', label: 'signup' },
  { path: '/reset-password', label: 'reset-password' },
  { path: '/auth/update-password', label: 'auth/update-password' },
  { path: '/payment/success', label: 'payment/success' },
  { path: '/payment/fail', label: 'payment/fail' },
  { path: '/payment/card-update', label: 'payment/card-update' },
];

test.describe('성능 베이스라인2 — 공개 페이지 나머지 전체', () => {
  const results: PerfEntry[] = [];

  for (const { path, label } of publicPages2) {
    test(`페이지 성능 계측2: ${label} (${path})`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'load' });
      const entry = await measurePerf(page, label);
      results.push(entry);
      expect(entry.ttfb_ms).toBeGreaterThanOrEqual(-1);
    });
  }

  test('공개 페이지2 성능 요약 리포트 출력', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    console.log('\n[perf2] ===== 공개 페이지(나머지) 성능 베이스라인 =====');
    console.log('[perf2] page                         | TTFB  | DCL   | Load  | FCP');
    console.log('[perf2] ' + '-'.repeat(70));
    for (const r of results) {
      console.log(
        `[perf2] ${r.page.padEnd(28)}| ${String(r.ttfb_ms).padStart(5)} | ${String(r.dclms).padStart(5)} | ${String(r.load_ms).padStart(5)} | ${r.fcp_ms != null ? String(r.fcp_ms) : 'N/A'}`,
      );
    }
    console.log('[perf2] ================================================\n');
    test.info().attach('perf2-public-summary.json', {
      body: JSON.stringify(results, null, 2),
      contentType: 'application/json',
    });
    expect(true).toBeTruthy();
  });
});

// ───────────────────────────────────────────────
// 로그인 필요 대시보드 페이지 (21개)
// ───────────────────────────────────────────────

const dashboardPages2 = [
  { path: '/ad-defense', label: 'ad-defense' },
  { path: '/blog-analysis', label: 'blog-analysis' },
  { path: '/delivery', label: 'delivery' },
  { path: '/delivery/new', label: 'delivery/new' },
  { path: '/delivery/orders', label: 'delivery/orders' },
  { path: '/delivery/payment-confirm', label: 'delivery/payment-confirm' },
  { path: '/guide/ai-info-tab', label: 'guide/ai-info-tab' },
  { path: '/guide/ai-tab', label: 'guide/ai-tab' },
  { path: '/guide/score-model-v3-1', label: 'guide/score-model-v3-1' },
  { path: '/guide/blog-strategy', label: 'guide/blog-strategy' },
  { path: '/notices', label: 'notices' },
  { path: '/preview', label: 'preview' },
  { path: '/review-inbox', label: 'review-inbox' },
  { path: '/schema', label: 'schema' },
  { path: '/startup', label: 'startup' },
  { path: '/startup/mockup', label: 'startup/mockup' },
  { path: '/support/tickets', label: 'support/tickets' },
  { path: '/support/tickets/new', label: 'support/tickets/new' },
  { path: '/settings/api-keys', label: 'settings/api-keys' },
  { path: '/settings/team', label: 'settings/team' },
  { path: '/onboarding', label: 'onboarding' },
];

test.describe('성능 베이스라인2 — 대시보드 페이지 나머지 전체', () => {
  const results: PerfEntry[] = [];

  for (const { path, label } of dashboardPages2) {
    test(`페이지 성능 계측2: ${label} (${path})`, async ({ adminPage: page }) => {
      await page.goto(path, { waitUntil: 'load' });
      const entry = await measurePerf(page, label);
      results.push(entry);
      expect(entry.ttfb_ms).toBeGreaterThanOrEqual(-1);
    });
  }

  test('대시보드 페이지2 성능 요약 리포트 출력', async ({ adminPage: page }) => {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    console.log('\n[perf2] ===== 대시보드 페이지(나머지) 성능 베이스라인 =====');
    console.log('[perf2] page                         | TTFB  | DCL   | Load  | FCP');
    console.log('[perf2] ' + '-'.repeat(70));
    for (const r of results) {
      console.log(
        `[perf2] ${r.page.padEnd(28)}| ${String(r.ttfb_ms).padStart(5)} | ${String(r.dclms).padStart(5)} | ${String(r.load_ms).padStart(5)} | ${r.fcp_ms != null ? String(r.fcp_ms) : 'N/A'}`,
      );
    }
    console.log('[perf2] ================================================\n');
    test.info().attach('perf2-dashboard-summary.json', {
      body: JSON.stringify(results, null, 2),
      contentType: 'application/json',
    });
    expect(true).toBeTruthy();
  });
});
