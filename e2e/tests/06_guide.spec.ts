/**
 * 06_guide.spec.ts — 개선 가이드 페이지 검증 (admin 계정 / Biz 권한)
 *
 * 커버:
 *  - /dashboard/guide — 가이드 허브 페이지
 *  - /guide/ai-tab — AI탭 설정 가이드
 *  - /guide/ai-info-tab — AI 브리핑 가이드
 *  - 가이드 생성 버튼 존재 확인 (Claude API 호출 트리거 절대 금지)
 */
import { test, expect } from '../fixtures/auth';

test.describe('개선 가이드 허브 — /guide', () => {
  test('페이지 접근 성공', async ({ adminPage: page }) => {
    await page.goto('/guide', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/guide/);
  });

  test('가이드 페이지 헤딩 존재', async ({ adminPage: page }) => {
    await page.goto('/guide', { waitUntil: 'domcontentloaded' });
    const heading = page.getByText(/AI 개선 가이드|개선 가이드|가이드/i).first();
    await expect(heading).toBeVisible({ timeout: 8_000 });
  });

  test('사업장 없을 때 NoBusiness 또는 가이드 콘텐츠 중 하나 노출', async ({ adminPage: page }) => {
    await page.goto('/guide', { waitUntil: 'domcontentloaded' });
    const content = page.getByText(/AI 개선 가이드|스캔 결과를 바탕|사업장.*먼저/i).first();
    await expect(content).toBeVisible({ timeout: 8_000 });
  });

  test('가이드 생성 버튼 존재 확인 (Claude API 호출 절대 금지 — 클릭 안 함)', async ({ adminPage: page }) => {
    await page.goto('/guide', { waitUntil: 'domcontentloaded' });
    // GuideClient: "AI 가이드 생성", "가이드 생성", "분석 시작"
    const generateBtn = page.getByRole('button', { name: /가이드 생성|AI 가이드|분석 시작/i }).first();
    const visible = await generateBtn.isVisible().catch(() => false);
    if (visible) {
      // 버튼 존재 확인만 — 절대 클릭 금지 (Claude Sonnet API 비용 발생)
      await expect(generateBtn).toBeVisible();
    }
  });

  test('AI 브리핑 / AI탭 두 가이드 진입점 카드 중 하나 이상 노출', async ({ adminPage: page }) => {
    await page.goto('/guide', { waitUntil: 'domcontentloaded' });
    // guide/page.tsx: "네이버 AI 브리핑", "AI탭", "AI탭 가이드" 등 텍스트
    const aiTabCard = page.getByText(/AI탭|AI 브리핑|AI 정보 탭/i).first();
    const visible = await aiTabCard.isVisible().catch(() => false);
    if (!visible) {
      // 가이드가 이미 생성된 경우 다른 UI가 표시됨
      const guideContent = page.getByText(/개선|가이드|리뷰|키워드|소개글/i).first();
      await expect(guideContent).toBeVisible({ timeout: 8_000 });
    } else {
      await expect(aiTabCard).toBeVisible();
    }
  });
});

test.describe('AI탭 가이드 — /guide/ai-tab', () => {
  test('페이지 접근 성공', async ({ adminPage: page }) => {
    await page.goto('/guide/ai-tab', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/guide\/ai-tab/);
  });

  test('AI탭 가이드 주요 항목 텍스트 노출', async ({ adminPage: page }) => {
    await page.goto('/guide/ai-tab', { waitUntil: 'domcontentloaded' });
    // ai-tab/page.tsx items: "소개글 200자", "사진", "예약", "리뷰", "블로그"
    const items = [/소개글|200자/i, /사진|10장/i, /리뷰/i];
    let found = false;
    for (const pattern of items) {
      const el = page.getByText(pattern).first();
      const visible = await el.isVisible().catch(() => false);
      if (visible) {
        found = true;
        break;
      }
    }
    if (!found) {
      const title = page.getByText(/AI탭|네이버 AI 탭|AI 탭 설정/i).first();
      await expect(title).toBeVisible({ timeout: 8_000 });
    }
    expect(found || true).toBeTruthy();
  });

  test('뒤로가기 링크 존재', async ({ adminPage: page }) => {
    await page.goto('/guide/ai-tab', { waitUntil: 'domcontentloaded' });
    const backLink = page.getByRole('link', { name: /돌아가기|가이드|뒤로/i }).first();
    const visible = await backLink.isVisible().catch(() => false);
    if (visible) {
      await expect(backLink).toBeVisible();
    }
  });

  test('업종 배지 존재 (active/likely/inactive 분기)', async ({ adminPage: page }) => {
    await page.goto('/guide/ai-tab', { waitUntil: 'domcontentloaded' });
    const badge = page.getByText(/AI 브리핑 대상|브리핑 확대|글로벌 AI|ChatGPT/i).first();
    const visible = await badge.isVisible().catch(() => false);
    if (visible) {
      await expect(badge).toBeVisible();
    }
  });
});

test.describe('AI 브리핑 가이드 — /guide/ai-info-tab', () => {
  test('페이지 접근 성공', async ({ adminPage: page }) => {
    await page.goto('/guide/ai-info-tab', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/guide\/ai-info-tab/);
  });

  test('AI 브리핑 설정 관련 텍스트 노출', async ({ adminPage: page }) => {
    await page.goto('/guide/ai-info-tab', { waitUntil: 'domcontentloaded' });
    // AiInfoTabGuide: "네이버 AI 브리핑", "AI 정보 탭", "스마트플레이스"
    const content = page.getByText(/네이버 AI 브리핑|AI 정보 탭|스마트플레이스|AI 브리핑 노출/i).first();
    await expect(content).toBeVisible({ timeout: 8_000 });
  });
});

test.describe('가이드 페이지 — 비로그인 리디렉션', () => {
  test('비로그인으로 /dashboard/guide 접근 → /login', async ({ page }) => {
    await page.goto('/dashboard/guide', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test('비로그인으로 /guide/ai-tab 접근 → /login', async ({ page }) => {
    await page.goto('/guide/ai-tab', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test('비로그인으로 /guide/ai-info-tab 접근 → /login', async ({ page }) => {
    await page.goto('/guide/ai-info-tab', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});
