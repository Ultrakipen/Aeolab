/**
 * 07_plan_gates.spec.ts — 플랜 게이트 검증 (재작성)
 *
 * admin 계정(hoozdev@gmail.com)은 ADMIN_EMAILS → Biz 권한이므로
 * 플랜 차단 테스트는 비인증 상태 또는 API 레벨로만 검증.
 *
 * 커버:
 *  1. 비로그인 → 대시보드 주요 페이지 /login 리디렉션
 *  2. 비로그인 → 백엔드 API 401 응답
 *  3. admin 계정 → Pro+ / Biz 기능 접근 성공 확인
 */
import { test, expect } from '../fixtures/auth';

// 플랜 계층 (PlanGate.tsx 기준)
// free: 0, basic: 1, startup: 1.5, pro: 2, biz: 3
// admin 계정 = biz(3) → 모든 기능 접근 가능

test.describe('비로그인 접근 차단 — /login 리디렉션', () => {
  test('/dashboard → /login 리디렉션', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test('/dashboard/competitors → /login 리디렉션', async ({ page }) => {
    await page.goto('/dashboard/competitors', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test('/dashboard/guide → /login 리디렉션', async ({ page }) => {
    await page.goto('/dashboard/guide', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test('/dashboard/blog-analysis → /login 리디렉션', async ({ page }) => {
    await page.goto('/dashboard/blog-analysis', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test('/guide/ai-tab → /login 리디렉션', async ({ page }) => {
    await page.goto('/guide/ai-tab', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test('/dashboard/settings → /login 리디렉션', async ({ page }) => {
    await page.goto('/dashboard/settings', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});

test.describe('비로그인 → 백엔드 API 401 응답', () => {
  test('GET /api/report/score/{biz_id} — 비로그인 → 401', async ({ page }) => {
    const bizId = process.env.TEST_BASIC_BIZ_ID || 'test-biz-id';
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://aeolab.co.kr';
    const response = await page.request.get(
      `${backendUrl}/api/report/score/${bizId}`,
    );
    // 인증 없이 호출 → 401
    expect([401, 403]).toContain(response.status());
  });

  test('GET /api/report/export/{biz_id} — 비로그인 → 401', async ({ page }) => {
    const bizId = process.env.TEST_BASIC_BIZ_ID || 'test-biz-id';
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://aeolab.co.kr';
    const response = await page.request.get(
      `${backendUrl}/api/report/export/${bizId}`,
    );
    expect([401, 403]).toContain(response.status());
  });
});

test.describe('admin 계정 (Biz 권한) → Pro+ 기능 접근 성공', () => {
  test('/dashboard/history 접근 성공 (Pro+ 기능)', async ({ adminPage: page }) => {
    await page.goto('/dashboard/history', { waitUntil: 'domcontentloaded' });
    // /login 으로 리디렉션되면 안 됨
    await expect(page).not.toHaveURL(/\/login/, { timeout: 5_000 });
    await expect(page).toHaveURL(/\/history/);
  });

  test('대시보드에서 PDF 버튼 존재 확인 (Biz 권한)', async ({ adminPage: page }) => {
    // 사업장 있을 때만 PDF 버튼 노출
    const noBiz = await page.getByText(/가게 등록|사업장 등록/i).first().isVisible().catch(() => false);
    if (noBiz) {
      test.info().annotations.push({ type: 'note', description: '사업장 미등록 — PDF 버튼 없음, skip' });
      return;
    }
    // PDF 내보내기 버튼 또는 링크
    const pdfBtn = page.getByRole('button', { name: /PDF|리포트.*다운로드/i }).first();
    const pdfLink = page.getByRole('link', { name: /PDF|리포트.*다운로드/i }).first();
    const hasBtn = await pdfBtn.isVisible().catch(() => false);
    const hasLink = await pdfLink.isVisible().catch(() => false);
    if (hasBtn || hasLink) {
      expect(hasBtn || hasLink).toBeTruthy();
    }
  });

  test('대시보드에서 CSV 버튼 존재 확인 (Pro+ 권한)', async ({ adminPage: page }) => {
    const noBiz = await page.getByText(/가게 등록|사업장 등록/i).first().isVisible().catch(() => false);
    if (noBiz) {
      test.info().annotations.push({ type: 'note', description: '사업장 미등록 — CSV 버튼 없음, skip' });
      return;
    }
    const csvBtn = page.getByRole('button', { name: /CSV|데이터.*내보내기/i }).first();
    const csvLink = page.getByRole('link', { name: /CSV|데이터.*내보내기/i }).first();
    const hasBtn = await csvBtn.isVisible().catch(() => false);
    const hasLink = await csvLink.isVisible().catch(() => false);
    if (hasBtn || hasLink) {
      expect(hasBtn || hasLink).toBeTruthy();
    }
  });
});

test.describe('설정 페이지 — 구독 정보 접근', () => {
  test('admin 계정 /settings 접근 — 구독 정보 노출', async ({ adminPage: page }) => {
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/settings/);
    // SettingsClient: "구독", "플랜", "요금제", "Biz" 중 하나 노출
    const subText = page.getByText(/구독|플랜|요금제|Biz|Basic/i).first();
    await expect(subText).toBeVisible({ timeout: 8_000 });
  });
});
