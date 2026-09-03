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

test.describe('/keywords 공개 페이지', () => {
  /**
   * /keywords 는 공개(public) 페이지.
   * 비로그인 접근 시 로드 성공 또는 로그인 리디렉션이 모두 허용된다.
   * 로드 성공 케이스에서 헤더(로고) 노출 여부를 추가 확인.
   */
  test('페이지 로드 성공 또는 로그인 리디렉션', async ({ page }) => {
    await page.goto('/keywords', { waitUntil: 'domcontentloaded' });
    const url = page.url();
    const isKeywords = url.includes('/keywords');
    const isLogin = url.includes('/login');
    expect(isKeywords || isLogin, `예상치 못한 URL: ${url}`).toBeTruthy();
  });

  test('로드 성공 시 헤더(AEOlab 로고) 노출', async ({ page }) => {
    await page.goto('/keywords', { waitUntil: 'domcontentloaded' });
    const url = page.url();
    if (url.includes('/login')) {
      // 로그인 리디렉션 케이스 — 헤더 검증 불필요
      console.log('[01_public] /keywords → /login 리디렉션, 헤더 검증 skip');
      return;
    }
    // 비로그인 접근 가능한 경우 헤더 또는 페이지 로고 확인
    const logoOrHeader = page.getByText(/AEOlab|AEO/i).first();
    await expect(logoOrHeader).toBeVisible({ timeout: 8_000 });
  });
});

test.describe('점수표시 원칙 회귀 검증', () => {
  /**
   * CLAUDE.md "점수 표시 원칙": AI Visibility 점수 숫자는 사용자에게 직접 노출하지 않는다.
   * "72점", "85점" 같은 패턴이 랜딩 페이지에 노출되면 원칙 위반 회귀.
   *
   * 주의: 가격("11,900원"), 리뷰 별점("4.8점"), 경험 연수("10년") 등은
   * 이 패턴(\d{2,3}점)에 걸리지 않거나 별도로 false positive 여부를 확인해야 함.
   * 현재는 두 자리 이상 정수 + "점" 패턴만 체크한다.
   */
  test('랜딩(/) — AI Visibility "N점" 형식 숫자 점수 미노출', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const bodyText = await page.locator('body').textContent() ?? '';
    // \d{2,}점 : 두 자리 이상 숫자 + "점" — AI 점수(0~100) 노출 회귀 감지
    const scorePattern = /\d{2,}점/;
    const hasScoreNumber = scorePattern.test(bodyText);
    expect(
      hasScoreNumber,
      `랜딩 페이지에 "N점" 형식의 점수가 노출됨 — 점수표시 원칙 위반 의심\n해당 텍스트: ${(bodyText.match(/\S{0,10}\d{2,}점\S{0,10}/g) || []).join(', ')}`
    ).toBeFalsy();
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
