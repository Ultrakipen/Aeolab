/**
 * 인증 Fixture — admin 단일 계정으로 전 플랜 기능 테스트
 *
 * 핵심 사실:
 *  - hoozdev@gmail.com = ADMIN_EMAILS 하드코딩 → Biz 플랜 권한 자동 부여
 *  - 별도 Pro/Biz 계정 불필요. adminPage 하나로 전 플랜 기능 검증 가능.
 *
 * 사용:
 *   import { test, expect } from '../fixtures/auth';
 *   test('대시보드 접근', async ({ adminPage }) => { ... });
 *
 * 환경변수 (.env.test):
 *   TEST_ADMIN_EMAIL    (기본: hoozdev@gmail.com)
 *   TEST_ADMIN_PASSWORD (필수)
 *   TEST_BASIC_BIZ_ID   (선택 — 00_setup.spec.ts 가 .biz_id 파일로도 대체 가능)
 */
import { test as base, Page, BrowserContext } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

// .env.test 로드 (없으면 무시)
const envTestPath = path.resolve(__dirname, '../.env.test');
if (fs.existsSync(envTestPath)) {
  const lines = fs.readFileSync(envTestPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim();
    if (key && !(key in process.env)) {
      process.env[key] = val;
    }
  }
}

// .biz_id 파일에서 biz_id 읽기 (00_setup.spec.ts 가 생성)
function readBizIdFile(): string | null {
  const bizIdPath = path.resolve(__dirname, '../.biz_id');
  if (fs.existsSync(bizIdPath)) {
    const content = fs.readFileSync(bizIdPath, 'utf-8').trim();
    if (content) return content;
  }
  return null;
}

type AuthFixtures = {
  /** admin 계정 (hoozdev@gmail.com) 로그인 상태 Page — Biz 권한 */
  adminPage: Page;
  /** admin 계정 BrowserContext (다중 페이지 필요 시) */
  adminContext: BrowserContext;
  /** 사업장 ID — 환경변수 또는 .biz_id 파일에서 읽음 */
  bizId: string;
};

/**
 * Supabase Auth 로그인 수행 헬퍼
 * login 페이지에서 이메일+비밀번호 입력 후 대시보드 이동 대기
 */
async function loginWithCredentials(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto('/login', { waitUntil: 'networkidle' });
  // React 마운트 완전 대기 후 입력
  await page.waitForSelector('input[type="email"]', { state: 'visible' });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  // 사업장 없으면 /onboarding, 있으면 /dashboard
  await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 20_000 });
  await page.waitForLoadState('domcontentloaded');
  // onboarding 상태면 대시보드 강제 이동 (테스트용)
  if (page.url().includes('/onboarding')) {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  }
}

/**
 * 로그인된 page context에서 Supabase JWT 액세스 토큰 추출
 * Supabase는 `sb-<ref>-auth-token` 키로 localStorage에 세션을 저장함
 */
async function extractSupabaseToken(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    // Supabase v2: sb-<ref>-auth-token ("supabase" 없음) — JWT로 식별
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      try {
        const val = JSON.parse(localStorage.getItem(key) || '{}');
        const token = val?.access_token || val?.session?.access_token;
        if (token && typeof token === 'string' && token.startsWith('eyJ')) {
          return token;
        }
      } catch {
        // JSON 아님 — skip
      }
    }
    return null;
  });
}

export const test = base.extend<AuthFixtures>({
  // admin 계정 로그인 상태 Page (Biz 권한)
  adminPage: async ({ browser }, use) => {
    const email = process.env.TEST_ADMIN_EMAIL || process.env.TEST_BASIC_EMAIL || 'hoozdev@gmail.com';
    const password = process.env.TEST_ADMIN_PASSWORD || process.env.TEST_BASIC_PASSWORD;
    if (!password) {
      test.skip(true, 'TEST_ADMIN_PASSWORD 환경변수가 설정되지 않았습니다. .env.test 파일을 확인하세요.');
      await use(null as unknown as Page);
      return;
    }
    const context = await browser.newContext({ locale: 'ko-KR' });
    const page = await context.newPage();
    await loginWithCredentials(page, email, password);
    await use(page);
    await context.close();
  },

  // admin 계정 BrowserContext (다중 페이지 시나리오용)
  adminContext: async ({ browser }, use) => {
    const email = process.env.TEST_ADMIN_EMAIL || process.env.TEST_BASIC_EMAIL || 'hoozdev@gmail.com';
    const password = process.env.TEST_ADMIN_PASSWORD || process.env.TEST_BASIC_PASSWORD;
    if (!password) {
      test.skip(true, 'TEST_ADMIN_PASSWORD 환경변수가 설정되지 않았습니다.');
      await use(null as unknown as BrowserContext);
      return;
    }
    const context = await browser.newContext({ locale: 'ko-KR' });
    const page = await context.newPage();
    await loginWithCredentials(page, email, password);
    await use(context);
    await context.close();
  },

  // 사업장 ID — 환경변수 → .biz_id 파일 → API 생성 순으로 조달
  bizId: async ({ browser }, use) => {
    // 1순위: 환경변수
    const envBizId = process.env.TEST_BASIC_BIZ_ID;
    if (envBizId) {
      await use(envBizId);
      return;
    }

    // 2순위: .biz_id 파일 (00_setup.spec.ts 생성)
    const fileBizId = readBizIdFile();
    if (fileBizId) {
      await use(fileBizId);
      return;
    }

    // 3순위: API로 사업장 생성 (로그인 후)
    const email = process.env.TEST_ADMIN_EMAIL || process.env.TEST_BASIC_EMAIL || 'hoozdev@gmail.com';
    const password = process.env.TEST_ADMIN_PASSWORD || process.env.TEST_BASIC_PASSWORD;
    if (!password) {
      test.skip(true, 'bizId를 조달할 수 없습니다. TEST_ADMIN_PASSWORD 환경변수를 설정하세요.');
      await use('');
      return;
    }

    const context = await browser.newContext({ locale: 'ko-KR' });
    const page = await context.newPage();
    try {
      await loginWithCredentials(page, email, password);

      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://aeolab.co.kr';
      const token = await extractSupabaseToken(page);
      if (!token) {
        test.skip(true, '액세스 토큰 추출 실패 — bizId를 조달할 수 없습니다.');
        await use('');
        return;
      }

      // 기존 사업장 조회
      const listRes = await page.request.get(`${backendUrl}/api/businesses/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (listRes.ok()) {
        const data = await listRes.json();
        const businesses = Array.isArray(data) ? data : data?.businesses || [];
        if (businesses.length > 0) {
          const id = businesses[0].id as string;
          // 파일에도 저장
          fs.writeFileSync(path.resolve(__dirname, '../.biz_id'), id, 'utf-8');
          await use(id);
          return;
        }
      }

      // 사업장 없으면 생성
      const createRes = await page.request.post(`${backendUrl}/api/businesses`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        data: {
          name: '테스트 사업장',
          category: 'restaurant',
          region: '서울',
          address: '서울 강남구 테헤란로 1',
          keywords: ['테스트 맛집', '강남 음식점'],
        },
      });
      if (createRes.ok()) {
        const created = await createRes.json();
        const id = (created.id || created?.business?.id || '') as string;
        if (id) {
          fs.writeFileSync(path.resolve(__dirname, '../.biz_id'), id, 'utf-8');
          await use(id);
          return;
        }
      }

      test.skip(true, '사업장 생성 실패 — bizId를 조달할 수 없습니다.');
      await use('');
    } finally {
      await context.close();
    }
  },
});

export { expect } from '@playwright/test';
export { extractSupabaseToken };
