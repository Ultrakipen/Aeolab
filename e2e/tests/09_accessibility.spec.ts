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
 *   로그인: /dashboard, /guide, /competitors, /growth, /history, /settings, /support
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

// ───────────────────────────────────────────────
// 비로그인 공개 페이지
// ───────────────────────────────────────────────

test.describe('접근성 베이스라인 — 비로그인 공개 페이지', () => {
  const publicPages = [
    { path: '/', label: 'landing' },
    { path: '/pricing', label: 'pricing' },
    { path: '/how-it-works', label: 'how-it-works' },
    { path: '/faq', label: 'faq' },
    { path: '/trial', label: 'trial' },
    { path: '/keywords', label: 'keywords' },
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
      // 베이스라인 확보 목적 — critical 위반이 있어도 soft assertion 처리
      // (즉시 fail이 아닌 "경고"로 기록)
      if (summary.critical > 0) {
        console.warn(`[axe] ⚠️ ${label}: critical 위반 ${summary.critical}건 발견 — 수정 우선순위 검토 필요`);
      }
      // 베이스라인 단계에서는 fail 하지 않음 — expect(summary.critical).toBe(0) 은 다음 단계
      expect(summary.total).toBeGreaterThanOrEqual(0); // 항상 통과 (집계 확인용)
    });
  }
});

// ───────────────────────────────────────────────
// 로그인 필요 대시보드 페이지
// ───────────────────────────────────────────────

test.describe('접근성 베이스라인 — 로그인 필요 대시보드 페이지', () => {
  const dashboardPages = [
    { path: '/dashboard', label: 'dashboard' },
    { path: '/guide', label: 'guide' },
    { path: '/competitors', label: 'competitors' },
    { path: '/growth', label: 'growth' },
    { path: '/history', label: 'history' },
    { path: '/settings', label: 'settings' },
    { path: '/support', label: 'support' },
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
// 전체 결과 집계 (마지막 테스트에서 summary 파일 생성)
// ───────────────────────────────────────────────

test.describe('접근성 베이스라인 — 전체 집계 요약', () => {
  test('axe 스캔 완료 — 결과는 각 테스트 첨부파일에서 확인', async ({ page }) => {
    // 이 테스트는 실제 스캔을 하지 않고
    // 위 테스트들이 모두 생성한 첨부파일을 메인 세션에서 확인하라는 안내용
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    console.log('[axe] 전체 스캔 완료. 각 테스트의 첨부파일(axe-*.json)에서 상세 결과를 확인하세요.');
    console.log('[axe] Playwright HTML 리포트: npx playwright show-report');
    expect(true).toBeTruthy();
  });
});
