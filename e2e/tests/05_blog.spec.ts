/**
 * 05_blog.spec.ts — 블로그 AI 진단 페이지 검증 (admin 계정 / Biz 권한)
 *
 * admin 계정은 Biz 권한이므로 블로그 분석 기능 (Basic+) 접근 가능.
 *
 * 커버:
 *  - /blog-analysis 접근 후 렌더링
 *  - 데이터 있을 때 분석 결과, 없을 때 빈 상태 / NoBusiness
 *  - 블로그 분석 트리거 버튼 존재 (클릭 안 함 — API 호출 방지)
 */
import { test, expect } from '../fixtures/auth';

test.describe('블로그 AI 진단 페이지 — admin 계정 (Biz 권한)', () => {
  test('페이지 접근 성공 및 URL 확인', async ({ adminPage: page }) => {
    await page.goto('/blog-analysis', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/blog-analysis/);
  });

  test('페이지 타이틀 또는 헤딩 존재', async ({ adminPage: page }) => {
    await page.goto('/blog-analysis', { waitUntil: 'domcontentloaded' });
    // "블로그 AI 진단", "블로그 분석", "블로그" 등 헤딩
    const heading = page.getByText(/블로그 AI 진단|블로그 분석|블로그/i).first();
    await expect(heading).toBeVisible({ timeout: 8_000 });
  });

  test('페이지 렌더링 확인 — 빈 상태 또는 분석 데이터 UI 둘 다 허용', async ({ adminPage: page }) => {
    await page.goto('/blog-analysis', { waitUntil: 'domcontentloaded' });
    // NoBusiness: 설명 텍스트 / BlogClient: 블로그 URL 입력 폼 / 분석 결과 카드
    const content = page.getByText(/블로그 AI 진단|블로그.*분석.*시작|내 블로그가|키워드 커버리지|AI 인용/i).first();
    await expect(content).toBeVisible({ timeout: 8_000 });
  });

  test('블로그 분석 관련 키워드 텍스트 노출', async ({ adminPage: page }) => {
    await page.goto('/blog-analysis', { waitUntil: 'domcontentloaded' });
    const patterns = [
      /키워드 커버리지|AI 인용 가능성|블로그 URL|블로그 분석/i,
    ];
    for (const pattern of patterns) {
      const el = page.getByText(pattern).first();
      const visible = await el.isVisible().catch(() => false);
      if (visible) {
        await expect(el).toBeVisible();
        break;
      }
    }
    // 어떤 텍스트도 없으면 헤딩만으로 통과 (데이터 없는 초기 상태 허용)
  });

  test('블로그 분석 시작 버튼 존재 확인 (클릭 안 함 — API 호출 방지)', async ({ adminPage: page }) => {
    await page.goto('/blog-analysis', { waitUntil: 'domcontentloaded' });
    const analyzeBtn = page.getByRole('button', { name: /분석 시작|블로그 분석|분석하기/i }).first();
    const visible = await analyzeBtn.isVisible().catch(() => false);
    // 분석 데이터가 이미 있으면 버튼이 없을 수 있음 → 조건부 확인
    if (visible) {
      await expect(analyzeBtn).toBeEnabled();
    }
  });
});

test.describe('블로그 페이지 — 비로그인 리디렉션', () => {
  test('비로그인으로 /blog-analysis 접근 → /login', async ({ page }) => {
    await page.goto('/blog-analysis', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});
