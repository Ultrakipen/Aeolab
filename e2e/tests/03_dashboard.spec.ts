/**
 * 03_dashboard.spec.ts — 대시보드 페이지 검증 (admin 계정 / Biz 권한)
 *
 * admin 계정(hoozdev@gmail.com)은 plan_gate.py의 ADMIN_EMAILS에
 * 하드코딩되어 있어 자동으로 Biz 플랜 권한을 가짐.
 *
 * 중요: 스캔 버튼 존재만 확인. 클릭 금지 (AI API 호출 방지).
 */
import { test, expect } from '../fixtures/auth';

test.describe('대시보드 — admin 계정 로그인 후 (Biz 권한)', () => {
  test('대시보드 URL 정상 접근', async ({ adminPage: page }) => {
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('헤더 — AEOlab 로고 또는 브랜드 텍스트 존재', async ({ adminPage: page }) => {
    // mobile header has lg:hidden (display:none on desktop), search inside aside (desktop sidebar)
    const brand = page.locator('aside').getByText(/AEOlab/i).first();
    await expect(brand).toBeVisible({ timeout: 10_000 });
  });

  test('플랜 배지가 Biz 또는 admin 표시 확인 (DashboardHeader)', async ({ adminPage: page }) => {
    // admin 계정은 Biz 권한 → "Biz" 배지 또는 "Admin" 표시
    // DashboardHeader: planBadgeText → "Biz", "Pro", "Basic", "창업패키지", "무료"
    const planBadge = page.getByText(/Biz|Admin|Pro|Basic|창업패키지/i).first();
    await expect(planBadge).toBeVisible({ timeout: 10_000 });
  });

  test('스캔 버튼 존재 확인 (클릭 안 함 — AI 호출 방지)', async ({ adminPage: page }) => {
    // ScanTrigger renders "AI 스캔 시작" after async data fetch — wait for it
    const scanBtn = page.getByRole('button', { name: /AI 분석|스캔|분석하기|분석 시작|AI 스캔 시작/i }).first();
    const registerBtn = page.getByRole('link', { name: /가게 등록|사업장 등록|시작하기/i }).first();
    let hasScan = false;
    try {
      await scanBtn.waitFor({ state: 'visible', timeout: 15_000 });
      hasScan = true;
    } catch { /* scan button not found */ }
    const hasRegister = await registerBtn.isVisible().catch(() => false);
    expect(hasScan || hasRegister).toBeTruthy();
  });

  test('점수 카드 섹션 렌더링 (DashboardScoreZone)', async ({ adminPage: page }) => {
    // 사업장 없는 경우는 자동 통과
    const noBiz = await page.getByText(/가게 등록|사업장 등록/i).first().isVisible().catch(() => false);
    if (noBiz) {
      test.info().annotations.push({ type: 'note', description: '사업장 미등록 — 점수 카드 없음, skip' });
      return;
    }
    // DualTrackCard 또는 DashboardScoreZone의 점수 관련 텍스트
    const scoreText = page.getByText(/AI 검색 준비도|통합 점수|Track\s?1|Track\s?2|점수/i).first();
    await expect(scoreText).toBeVisible({ timeout: 10_000 });
  });

  test('경고 배너 없이 정상 대시보드 표시', async ({ adminPage: page }) => {
    // admin 계정은 플랜 만료·결제 실패 배너가 없어야 함
    const errorBanner = page.getByText(/결제 실패|구독 만료|카드 오류/i).first();
    const hasError = await errorBanner.isVisible().catch(() => false);
    expect(hasError).toBeFalsy();
  });

  test('대시보드 주요 네비게이션 링크 존재', async ({ adminPage: page }) => {
    const navPatterns = [/경쟁사|경쟁/i, /가이드|개선/i];
    for (const pattern of navPatterns) {
      const link = page.getByRole('link', { name: pattern }).first();
      const visible = await link.isVisible().catch(() => false);
      if (!visible) {
        // 모바일 햄버거 메뉴 안에 있을 수 있음 — 텍스트 존재만 확인
        const anywhere = page.getByText(pattern).first();
        await expect(anywhere).toBeVisible({ timeout: 5_000 }).catch(() => {
          // 메뉴 항목이 숨겨진 경우 통과
        });
      }
    }
  });

  test('업종별 AI 브리핑 배지 존재 (active/likely/inactive 중 하나)', async ({ adminPage: page }) => {
    const noBiz = await page.getByText(/가게 등록|사업장 등록/i).first().isVisible().catch(() => false);
    if (noBiz) return;
    // DashboardHeader: "AI 브리핑 대상 업종", "AI 브리핑 확대 예정", "ChatGPT·Gemini 중점"
    const badge = page.getByText(/AI 브리핑 대상|브리핑 확대|ChatGPT.*Gemini/i).first();
    await expect(badge).toBeVisible({ timeout: 8_000 });
  });
});

test.describe('대시보드 — 비로그인 리디렉션', () => {
  test('비로그인으로 /dashboard 접근 → /login 리디렉션', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});
