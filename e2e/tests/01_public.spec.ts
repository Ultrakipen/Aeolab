/**
 * 01_public.spec.ts — 비로그인 공개 페이지 렌더링 검증
 *
 * 커버 범위:
 *  - 랜딩 페이지 (/) 주요 섹션
 *  - /pricing 요금제 카드
 *  - /trial 무료 체험 진입점
 *  - /guide/ai-tab 가이드 (로그인 없이 리디렉션되면 skip)
 */
import { test, expect } from '@playwright/test';

test.describe('랜딩 페이지 (/)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
  });

  test('페이지 타이틀 또는 AEOlab 로고 노출', async ({ page }) => {
    // 헤더 로고 ("AEO" + "lab" 두 span 구성)
    const logo = page.locator('header').getByText('AEO');
    await expect(logo).toBeVisible();
  });

  test('Hero 섹션 — CTA 버튼 존재', async ({ page }) => {
    // HeroSection 내 "무료 체험" 또는 "무료로 시작" 텍스트 버튼
    const cta = page.getByRole('link', { name: /무료.*(체험|시작)/i }).first();
    await expect(cta).toBeVisible();
  });

  test('Header — 로그인 링크 존재', async ({ page }) => {
    const loginLink = page.getByRole('link', { name: /로그인/i }).first();
    await expect(loginLink).toBeVisible();
  });

  test('Header — 무료 체험 링크 존재', async ({ page }) => {
    const trialLink = page.getByRole('link', { name: /무료 체험/i }).first();
    await expect(trialLink).toBeVisible();
  });

  test('Footer 존재', async ({ page }) => {
    // SiteFooter — "AEOlab" 텍스트 또는 copyright
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
  });
});

test.describe('요금제 페이지 (/pricing)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/pricing', { waitUntil: 'domcontentloaded' });
  });

  test('페이지 로드 성공', async ({ page }) => {
    await expect(page).toHaveURL(/\/pricing/);
  });

  test('요금제 타이틀 텍스트 존재', async ({ page }) => {
    const heading = page.getByRole('heading', { name: /요금제/i }).first();
    await expect(heading).toBeVisible();
  });

  test('Basic 플랜 카드 노출', async ({ page }) => {
    // plans.ts: PLANS 배열에 "Basic" 이름 존재
    const basicCard = page.getByText('Basic').first();
    await expect(basicCard).toBeVisible();
  });

  test('Pro 플랜 카드 노출', async ({ page }) => {
    const proCard = page.getByText('Pro').first();
    await expect(proCard).toBeVisible();
  });

  test('Biz 플랜 카드 노출', async ({ page }) => {
    const bizCard = page.getByText('Biz').first();
    await expect(bizCard).toBeVisible();
  });

  test('가격 단위 "원" 텍스트 포함', async ({ page }) => {
    // 요금제 가격이 "9,900원" 형태로 노출되는지 확인
    const priceText = page.getByText(/원\/월|월.*원|9,900|18,900|49,900/i).first();
    await expect(priceText).toBeVisible();
  });

  test('무료 체험 링크 존재', async ({ page }) => {
    const trialLink = page.getByRole('link', { name: /무료 체험/i }).first();
    await expect(trialLink).toBeVisible();
  });
});

test.describe('무료 체험 진입 페이지 (/trial)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/trial', { waitUntil: 'domcontentloaded' });
  });

  test('페이지 로드 성공 — URL 유지', async ({ page }) => {
    await expect(page).toHaveURL(/\/trial/);
  });

  test('AEOlab 헤더 로고 노출', async ({ page }) => {
    const header = page.locator('header');
    await expect(header).toBeVisible();
    await expect(header.getByText(/AEOlab/i)).toBeVisible();
  });

  test('"무료 AI 노출 진단" 부제 텍스트 노출', async ({ page }) => {
    const subtitle = page.getByText(/무료 AI 노출 진단/i).first();
    await expect(subtitle).toBeVisible();
  });

  test('업종 선택 카테고리 UI 노출 (category step)', async ({ page }) => {
    // TrialInputStep — category step: 업종 버튼들이 나열됨
    // "음식점", "카페", "미용" 등 카테고리 중 하나 이상 존재
    const categoryBtn = page.getByText(/음식점|카페|미용|베이커리/i).first();
    await expect(categoryBtn).toBeVisible();
  });

  test('"무료 진단으로 얻는 것" 섹션 존재', async ({ page }) => {
    const section = page.getByText(/무료 진단으로 얻는 것/i).first();
    await expect(section).toBeVisible();
  });
});

test.describe('AI탭 가이드 페이지 (/guide/ai-tab)', () => {
  test('페이지 접근 — 로그인 페이지로 리디렉션되거나 가이드 콘텐츠 노출', async ({ page }) => {
    await page.goto('/guide/ai-tab', { waitUntil: 'domcontentloaded' });
    const url = page.url();
    // 로그인 리디렉션 또는 가이드 페이지 둘 다 허용
    const isLogin = url.includes('/login');
    const isGuide = url.includes('/guide');
    expect(isLogin || isGuide).toBeTruthy();
  });
});

test.describe('모바일 뷰 — 랜딩 페이지 기본 가독성', () => {
  // 모바일 뷰포트는 playwright.config.ts projects: Pixel 5 에서 별도 실행됨
  // 여기서는 최소 콘텐츠 존재만 확인
  test('랜딩 페이지 모바일 로드', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    // 페이지가 빈 화면이 아닌지 확인
    const body = page.locator('body');
    await expect(body).not.toBeEmpty();
  });
});
