/**
 * 09_accessibility.spec.ts — axe-core WCAG 2.1 AA 접근성 베이스라인 스캔
 *
 * 목적: 처음으로 접근성 베이스라인을 확보한다.
 *   - 즉시 fail 처리하지 않고 결과를 첨부(attach)해 보고한다.
 *   - 등급: critical → serious → moderate → minor 순
 *   - 메인 세션이 결과를 보고 사용자와 수정 범위를 논의한다.
 *
 * 대상:
 *   비로그인: /, /pricing, /how-it-works, /faq, /trial, /keywords
 *             + /demo, /terms, /privacy, /score-guide, /guide/chatgpt-search,
 *               /guide/channels, /guide/channels/restaurant(대표슬러그),
 *               /tools/keyword, /tools/ad-cost-calculator, /quick, /blog,
 *               /blog/naver-ai-briefing-guide(대표슬러그),
 *               /stories, /keywords/창원-맛집-ai-노출(대표슬러그)
 *   인증 플로우(비로그인): /login, /signup, /reset-password
 *   결제: /payment/success, /payment/fail(파라미터 없이 안내화면)
 *        /payment/card-update(로그인 필요)
 *   로그인: /dashboard, /guide, /competitors, /growth, /history, /settings, /support
 *           + /onboarding, /ad-defense, /schema, /startup, /review-inbox,
 *             /blog-analysis, /notices, /notices/[id](동적), /delivery
 */

import { test, expect } from '../fixtures/auth';
import AxeBuilder from '@axe-core/playwright';

/** 등급별 위반 집계 타입 */
type ImpactSummary = {
  critical: number;
  serious: number;
  moderate: number;
  minor: number;
  total: number;
};

/** axe 결과에서 등급별 위반 개수를 집계하고 첨부 */
async function runAxeAndReport(
  page: import('@playwright/test').Page,
  label: string,
): Promise<ImpactSummary> {
  const axeResults = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  const summary: ImpactSummary = { critical: 0, serious: 0, moderate: 0, minor: 0, total: 0 };
  for (const v of axeResults.violations) {
    const impact = (v.impact ?? 'minor') as keyof Omit<ImpactSummary, 'total'>;
    summary[impact] = (summary[impact] || 0) + v.nodes.length;
    summary.total += v.nodes.length;
  }

  // 상위 5개 위반 요약 (critical/serious 우선)
  const topViolations = [...axeResults.violations]
    .sort((a, b) => {
      const order: Record<string, number> = { critical: 0, serious: 1, moderate: 2, minor: 3 };
      return (order[a.impact ?? 'minor'] ?? 4) - (order[b.impact ?? 'minor'] ?? 4);
    })
    .slice(0, 5)
    .map((v) => ({
      rule: v.id,
      impact: v.impact,
      description: v.description,
      affectedNodes: v.nodes.length,
      // 첫 번째 노드의 타겟 요소
      exampleTarget: v.nodes[0]?.target?.join(', ') ?? '(unknown)',
      exampleHtml: v.nodes[0]?.html?.slice(0, 120) ?? '',
    }));

  const reportObj = {
    page: label,
    url: page.url(),
    summary,
    topViolations,
    allViolationRules: axeResults.violations.map((v) => `${v.id} [${v.impact}] (${v.nodes.length}건)`),
  };

  // Playwright 테스트 리포트에 JSON 첨부
  test.info().attach(`axe-${label.replace(/\//g, '_')}.json`, {
    body: JSON.stringify(reportObj, null, 2),
    contentType: 'application/json',
  });

  // 콘솔에도 요약 출력 (--reporter list 에서 즉시 확인 가능)
  console.log(
    `[axe] ${label} | critical:${summary.critical} serious:${summary.serious} moderate:${summary.moderate} minor:${summary.minor} total:${summary.total}`,
  );
  if (topViolations.length > 0) {
    for (const v of topViolations) {
      console.log(`  [${v.impact}] ${v.rule} — ${v.affectedNodes}건 — ${v.description.slice(0, 80)}`);
    }
  }

  return summary;
}

/** 공통 soft assertion — 베이스라인 확보 단계에서는 critical도 fail 처리하지 않음 */
function softAssert(summary: ImpactSummary, label: string) {
  if (summary.critical > 0) {
    console.warn(`[axe] ⚠️ ${label}: critical 위반 ${summary.critical}건 — 수정 우선순위 검토 필요`);
  }
  if (summary.serious > 0) {
    console.warn(`[axe] ⚠️ ${label}: serious 위반 ${summary.serious}건 — 수정 권장`);
  }
  expect(summary.total).toBeGreaterThanOrEqual(0); // 항상 통과 (집계 확인용)
}

// ───────────────────────────────────────────────
// 비로그인 공개 페이지 (기존 6개 + 신규 11개)
// ───────────────────────────────────────────────

test.describe('접근성 베이스라인 — 비로그인 공개 페이지', () => {
  const publicPages = [
    // 기존
    { path: '/', label: 'landing' },
    { path: '/pricing', label: 'pricing' },
    { path: '/how-it-works', label: 'how-it-works' },
    { path: '/faq', label: 'faq' },
    { path: '/trial', label: 'trial' },
    { path: '/keywords', label: 'keywords' },
    // 신규
    { path: '/demo', label: 'demo' },
    { path: '/terms', label: 'terms' },
    { path: '/privacy', label: 'privacy' },
    { path: '/score-guide', label: 'score-guide' },
    { path: '/guide/chatgpt-search', label: 'guide-chatgpt-search' },
    { path: '/guide/channels', label: 'guide-channels' },
    { path: '/tools/keyword', label: 'tools-keyword' },
    { path: '/tools/ad-cost-calculator', label: 'tools-ad-cost' },
    { path: '/quick', label: 'quick' },
    { path: '/blog', label: 'blog' },
    { path: '/stories', label: 'stories' },
  ];

  for (const { path, label } of publicPages) {
    test(`axe 스캔: ${label} (${path})`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      // 로그인 리디렉션이면 skip
      if (page.url().includes('/login')) {
        console.log(`[axe] ${label} → /login 리디렉션, 스캔 skip`);
        return;
      }
      await page.waitForLoadState('networkidle').catch(() => {});
      const summary = await runAxeAndReport(page, label);
      softAssert(summary, label);
    });
  }
});

// ───────────────────────────────────────────────
// 비로그인 공개 페이지 — 동적 라우트 대표 슬러그
// ───────────────────────────────────────────────

test.describe('접근성 베이스라인 — 비로그인 동적 라우트 (대표 슬러그)', () => {
  // /guide/channels/[category] — restaurant 슬러그 (CHANNEL_GUIDE에 항상 존재)
  test('axe 스캔: guide-channels-restaurant (/guide/channels/restaurant)', async ({ page }) => {
    await page.goto('/guide/channels/restaurant', { waitUntil: 'domcontentloaded' });
    if (page.url().includes('/login')) {
      console.log('[axe] guide-channels-restaurant → /login 리디렉션, 스캔 skip');
      return;
    }
    await page.waitForLoadState('networkidle').catch(() => {});
    const summary = await runAxeAndReport(page, 'guide-channels-restaurant');
    softAssert(summary, 'guide-channels-restaurant');
  });

  // /blog/[slug] — naver-ai-briefing-guide 슬러그 (blog-posts.ts에 항상 존재)
  test('axe 스캔: blog-slug (/blog/naver-ai-briefing-guide)', async ({ page }) => {
    await page.goto('/blog/naver-ai-briefing-guide', { waitUntil: 'domcontentloaded' });
    if (page.url().includes('/login')) {
      console.log('[axe] blog-slug → /login 리디렉션, 스캔 skip');
      return;
    }
    await page.waitForLoadState('networkidle').catch(() => {});
    const summary = await runAxeAndReport(page, 'blog-slug');
    softAssert(summary, 'blog-slug');
  });

  // /keywords/[slug] — 창원-맛집-ai-노출 슬러그 (keywords-data.ts에 항상 존재)
  test('axe 스캔: keywords-slug (/keywords/창원-맛집-ai-노출)', async ({ page }) => {
    await page.goto('/keywords/%EC%B0%BD%EC%9B%90-%EB%A7%9B%EC%A7%91-ai-%EB%85%B8%EC%B6%9C', { waitUntil: 'domcontentloaded' });
    if (page.url().includes('/login')) {
      console.log('[axe] keywords-slug → /login 리디렉션, 스캔 skip');
      return;
    }
    await page.waitForLoadState('networkidle').catch(() => {});
    const summary = await runAxeAndReport(page, 'keywords-slug');
    softAssert(summary, 'keywords-slug');
  });

  // /stories/[id] — 목록 페이지에서 첫 번째 링크를 찾아 스팟체크
  test('axe 스캔: stories-slug (/stories/[id] 첫 번째 항목)', async ({ page }) => {
    await page.goto('/stories', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});

    // 목록에서 개별 스토리 링크 탐색
    const storyLink = page.locator('a[href^="/stories/"]').first();
    const href = await storyLink.getAttribute('href').catch(() => null);
    if (!href) {
      console.log('[axe] stories-slug — 목록에서 링크를 찾지 못함, 스캔 skip');
      return;
    }

    await page.goto(href, { waitUntil: 'domcontentloaded' });
    if (page.url().includes('/login')) {
      console.log('[axe] stories-slug → /login 리디렉션, 스캔 skip');
      return;
    }
    await page.waitForLoadState('networkidle').catch(() => {});
    const summary = await runAxeAndReport(page, 'stories-slug');
    softAssert(summary, 'stories-slug');
  });
});

// ───────────────────────────────────────────────
// 인증 플로우 페이지 (비로그인 상태에서 스캔)
// ───────────────────────────────────────────────

test.describe('접근성 베이스라인 — 인증 플로우 페이지', () => {
  const authPages = [
    { path: '/login', label: 'login' },
    { path: '/signup', label: 'signup' },
    { path: '/reset-password', label: 'reset-password' },
  ];

  for (const { path, label } of authPages) {
    test(`axe 스캔: ${label} (${path})`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      // 이미 로그인 상태에서 리디렉션되면 skip
      if (page.url().includes('/dashboard') || page.url().includes('/onboarding')) {
        console.log(`[axe] ${label} → 이미 로그인 상태 리디렉션, 스캔 skip`);
        return;
      }
      await page.waitForLoadState('networkidle').catch(() => {});
      const summary = await runAxeAndReport(page, label);
      softAssert(summary, label);
    });
  }
});

// ───────────────────────────────────────────────
// 결제 페이지
// ───────────────────────────────────────────────

test.describe('접근성 베이스라인 — 결제 페이지', () => {
  // /payment/success, /payment/fail — 파라미터 없이 접속 시 안내/에러 화면이 뜨는 게 정상
  const publicPaymentPages = [
    { path: '/payment/success', label: 'payment-success' },
    { path: '/payment/fail', label: 'payment-fail' },
  ];

  for (const { path, label } of publicPaymentPages) {
    test(`axe 스캔: ${label} (${path})`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      if (page.url().includes('/login')) {
        console.log(`[axe] ${label} → /login 리디렉션, 스캔 skip`);
        return;
      }
      await page.waitForLoadState('networkidle').catch(() => {});
      const summary = await runAxeAndReport(page, label);
      softAssert(summary, label);
    });
  }

  // /payment/card-update — 로그인 필요
  test('axe 스캔: payment-card-update (/payment/card-update)', async ({ adminPage: page }) => {
    await page.goto('/payment/card-update', { waitUntil: 'domcontentloaded' });
    if (page.url().includes('/login')) {
      console.log('[axe] payment-card-update → /login 리디렉션, 인증 실패 — 스캔 skip');
      return;
    }
    await page.waitForLoadState('networkidle').catch(() => {});
    const summary = await runAxeAndReport(page, 'payment-card-update');
    softAssert(summary, 'payment-card-update');
  });
});

// ───────────────────────────────────────────────
// 로그인 필요 대시보드 페이지 (기존 7개 + 신규 8개)
// ───────────────────────────────────────────────

test.describe('접근성 베이스라인 — 로그인 필요 대시보드 페이지', () => {
  const dashboardPages = [
    // 기존
    { path: '/dashboard', label: 'dashboard' },
    { path: '/guide', label: 'guide' },
    { path: '/competitors', label: 'competitors' },
    { path: '/growth', label: 'growth' },
    { path: '/history', label: 'history' },
    { path: '/settings', label: 'settings' },
    { path: '/support', label: 'support' },
    // 신규
    { path: '/onboarding', label: 'onboarding' },
    { path: '/ad-defense', label: 'ad-defense' },
    { path: '/schema', label: 'schema' },
    { path: '/startup', label: 'startup' },
    { path: '/review-inbox', label: 'review-inbox' },
    { path: '/blog-analysis', label: 'blog-analysis' },
    { path: '/notices', label: 'notices' },
    { path: '/delivery', label: 'delivery' },
  ];

  for (const { path, label } of dashboardPages) {
    test(`axe 스캔: ${label} (${path})`, async ({ adminPage: page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      // 로그인 리디렉션이면 skip (인증 실패)
      if (page.url().includes('/login')) {
        console.log(`[axe] ${label} → /login 리디렉션, 인증 실패 — 스캔 skip`);
        return;
      }
      // 대시보드 페이지는 비동기 데이터 로딩(스캔 결과·경쟁사 목록 등)이 domcontentloaded 이후에도
      // 계속돼 스캔 타이밍에 따라 결과가 39건/0건으로 들쭉날쭉했음(2026-09-03 3회 반복 실행으로 확인).
      // networkidle까지 대기해 로딩 스켈레톤이 아닌 안정된 최종 상태를 스캔한다.
      await page.waitForLoadState('networkidle').catch(() => {});
      const summary = await runAxeAndReport(page, label);
      if (summary.critical > 0) {
        console.warn(`[axe] ⚠️ ${label}: critical 위반 ${summary.critical}건 — 수정 우선순위 검토 필요`);
      }
      expect(summary.total).toBeGreaterThanOrEqual(0);
    });
  }
});

// ───────────────────────────────────────────────
// 로그인 필요 — 동적 라우트 대표 슬러그
// ───────────────────────────────────────────────

test.describe('접근성 베이스라인 — 로그인 동적 라우트 (대표 슬러그)', () => {
  // /notices/[id] — 목록에서 첫 번째 공지 ID 스팟체크
  test('axe 스캔: notices-slug (/notices/[id] 첫 번째 항목)', async ({ adminPage: page }) => {
    await page.goto('/notices', { waitUntil: 'domcontentloaded' });
    if (page.url().includes('/login')) {
      console.log('[axe] notices-slug → /login 리디렉션, 스캔 skip');
      return;
    }
    await page.waitForLoadState('networkidle').catch(() => {});

    // 목록에서 개별 공지 링크 탐색
    const noticeLink = page.locator('a[href^="/notices/"]').first();
    const href = await noticeLink.getAttribute('href').catch(() => null);
    if (!href) {
      console.log('[axe] notices-slug — 목록에서 링크를 찾지 못함, 스캔 skip');
      return;
    }

    await page.goto(href, { waitUntil: 'domcontentloaded' });
    if (page.url().includes('/login')) {
      console.log('[axe] notices-slug → /login 리디렉션, 스캔 skip');
      return;
    }
    await page.waitForLoadState('networkidle').catch(() => {});
    const summary = await runAxeAndReport(page, 'notices-slug');
    softAssert(summary, 'notices-slug');
  });

  // /delivery/orders — 주문 목록 페이지
  test('axe 스캔: delivery-orders (/delivery/orders)', async ({ adminPage: page }) => {
    await page.goto('/delivery/orders', { waitUntil: 'domcontentloaded' });
    if (page.url().includes('/login')) {
      console.log('[axe] delivery-orders → /login 리디렉션, 스캔 skip');
      return;
    }
    await page.waitForLoadState('networkidle').catch(() => {});
    const summary = await runAxeAndReport(page, 'delivery-orders');
    softAssert(summary, 'delivery-orders');
  });

  // /support/tickets — 티켓 목록 페이지
  test('axe 스캔: support-tickets (/support/tickets)', async ({ adminPage: page }) => {
    await page.goto('/support/tickets', { waitUntil: 'domcontentloaded' });
    if (page.url().includes('/login')) {
      console.log('[axe] support-tickets → /login 리디렉션, 스캔 skip');
      return;
    }
    await page.waitForLoadState('networkidle').catch(() => {});
    const summary = await runAxeAndReport(page, 'support-tickets');
    softAssert(summary, 'support-tickets');
  });

  // /settings/team — 팀 계정 설정 (Biz+)
  test('axe 스캔: settings-team (/settings/team)', async ({ adminPage: page }) => {
    await page.goto('/settings/team', { waitUntil: 'domcontentloaded' });
    if (page.url().includes('/login')) {
      console.log('[axe] settings-team → /login 리디렉션, 스캔 skip');
      return;
    }
    await page.waitForLoadState('networkidle').catch(() => {});
    const summary = await runAxeAndReport(page, 'settings-team');
    softAssert(summary, 'settings-team');
  });

  // /settings/api-keys — API 키 관리 (Biz+)
  test('axe 스캔: settings-api-keys (/settings/api-keys)', async ({ adminPage: page }) => {
    await page.goto('/settings/api-keys', { waitUntil: 'domcontentloaded' });
    if (page.url().includes('/login')) {
      console.log('[axe] settings-api-keys → /login 리디렉션, 스캔 skip');
      return;
    }
    await page.waitForLoadState('networkidle').catch(() => {});
    const summary = await runAxeAndReport(page, 'settings-api-keys');
    softAssert(summary, 'settings-api-keys');
  });
});

// ───────────────────────────────────────────────
// 전체 결과 집계 (마지막 테스트에서 summary 파일 생성)
// ───────────────────────────────────────────────

test.describe('접근성 베이스라인 — 전체 집계 요약', () => {
  test('axe 스캔 완료 — 결과는 각 테스트 첨부파일에서 확인', async ({ page }) => {
    // 이 테스트는 실제 스캔을 하지 않고
    // 위 테스트들이 모두 생성한 첨부파일을 메인 세션에서 확인하라는 안내용
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    console.log('[axe] 전체 스캔 완료. 각 테스트의 첨부파일(axe-*.json)에서 상세 결과를 확인하세요.');
    console.log('[axe] 커버리지: 비로그인 17개 + 동적4개 + 인증3개 + 결제3개 + 대시보드 15개 + 동적5개 = 총 47개+');
    console.log('[axe] Playwright HTML 리포트: npx playwright show-report');
    expect(true).toBeTruthy();
  });
});
