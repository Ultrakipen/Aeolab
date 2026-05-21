/**
 * 00_setup.spec.ts — 테스트 환경 최초 셋업 (1회 실행)
 *
 * 목적:
 *  1. admin 계정(hoozdev@gmail.com) 로그인 확인
 *  2. 사업장 존재 확인 또는 없으면 API로 생성
 *  3. 사업장 ID를 e2e/.biz_id 파일에 저장 → 다른 테스트에서 재사용
 *
 * 실행: npm run test:setup
 */
import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

// .env.test 로드
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
    if (key && !(key in process.env)) process.env[key] = val;
  }
}

const BIZ_ID_FILE = path.resolve(__dirname, '../.biz_id');
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://aeolab.co.kr';

/** Supabase 액세스 토큰 추출
 *  storageState() 로 localStorage + 쿠키 모두 탐색
 *  Supabase v2: sb-<ref>-auth-token 키, 쿠키에도 세션 저장 가능 */
async function getToken(page: import('@playwright/test').Page): Promise<string | null> {
  const state = await page.context().storageState();

  // 1) localStorage 탐색
  for (const origin of state.origins) {
    for (const item of origin.localStorage) {
      try {
        const parsed = JSON.parse(item.value);
        const token = parsed?.access_token || parsed?.session?.access_token;
        if (token && typeof token === 'string' && token.startsWith('eyJ')) return token;
      } catch { /* JSON 아님 */ }
    }
  }

  // 2) 쿠키 탐색 (Supabase SSR은 쿠키에도 저장)
  for (const cookie of state.cookies) {
    if (!cookie.name.startsWith('sb-')) continue;
    try {
      const decoded = decodeURIComponent(cookie.value);
      const parsed = JSON.parse(decoded);
      const token = parsed?.access_token || parsed?.session?.access_token;
      if (token && typeof token === 'string' && token.startsWith('eyJ')) return token;
    } catch {
      if (cookie.value.startsWith('eyJ')) return cookie.value;
    }
  }

  return null;
}

test.describe('셋업 — 테스트 계정 및 사업장 준비', () => {
  test('테스트 계정 로그인 확인', async ({ page }) => {
    const email = process.env.TEST_ADMIN_EMAIL || process.env.TEST_BASIC_EMAIL || 'hoozdev@gmail.com';
    const password = process.env.TEST_ADMIN_PASSWORD || process.env.TEST_BASIC_PASSWORD;

    if (!password) {
      test.skip(true, 'TEST_ADMIN_PASSWORD 환경변수가 없습니다. .env.test에 추가하세요.');
      return;
    }

    await page.goto('/login', { waitUntil: 'networkidle' });

    // React 마운트 대기
    await page.waitForSelector('input[type="email"]', { state: 'visible' });
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.locator('button[type="submit"]').click();

    // 로그인 후: 사업장 없으면 /onboarding, 있으면 /dashboard 로 이동
    await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 20_000 });
    await page.waitForLoadState('domcontentloaded');

    const finalUrl = page.url();
    const ok = finalUrl.includes('/dashboard') || finalUrl.includes('/onboarding');
    expect(ok, `로그인 후 예상치 못한 URL: ${finalUrl}`).toBeTruthy();
    console.log(`[setup] 로그인 성공: ${email} → ${finalUrl}`);
  });

  test('사업장 존재 확인 또는 생성 후 .biz_id 파일에 저장', async ({ page }) => {
    const email = process.env.TEST_ADMIN_EMAIL || process.env.TEST_BASIC_EMAIL || 'hoozdev@gmail.com';
    const password = process.env.TEST_ADMIN_PASSWORD || process.env.TEST_BASIC_PASSWORD;

    if (!password) {
      test.skip(true, 'TEST_ADMIN_PASSWORD 환경변수가 없습니다.');
      return;
    }

    // 환경변수에 이미 biz_id가 있으면 파일만 갱신 후 종료
    const envBizId = process.env.TEST_BASIC_BIZ_ID;
    if (envBizId) {
      fs.writeFileSync(BIZ_ID_FILE, envBizId, 'utf-8');
      console.log(`[setup] 환경변수 biz_id 사용: ${envBizId}`);
      return;
    }

    // 로그인 후 토큰 추출
    await page.goto('/login', { waitUntil: 'networkidle' });
    await page.waitForSelector('input[type="email"]', { state: 'visible' });
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 20_000 });
    await page.waitForLoadState('domcontentloaded');

    const token = await getToken(page);
    let bizId: string | null = null;

    if (token) {
      // 토큰 있으면 API 직접 호출
      const listRes = await page.request.get(`${BACKEND_URL}/api/businesses/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (listRes.ok()) {
        const data = await listRes.json();
        const businesses = Array.isArray(data) ? data : data?.businesses || [];
        if (businesses.length > 0) {
          bizId = businesses[0].id as string;
          console.log(`[setup] 기존 사업장 사용: ${bizId} (${businesses[0].name})`);
        }
      }

      if (!bizId) {
        console.log('[setup] 사업장 없음 → 테스트 사업장 생성 중...');
        const createRes = await page.request.post(`${BACKEND_URL}/api/businesses`, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          data: {
            name: '테스트 사업장',
            category: 'restaurant',
            region: '서울',
            address: '서울 강남구 테헤란로 1',
            keywords: ['테스트 맛집', '강남 음식점'],
          },
        });
        expect(createRes.ok(), `사업장 생성 실패: ${createRes.status()}`).toBeTruthy();
        const created = await createRes.json();
        bizId = (created.id || created?.business?.id || null) as string | null;
        console.log(`[setup] 사업장 생성 완료: ${bizId}`);
      }
    } else {
      // fallback: 네트워크 인터셉트로 dashboard 로드 중 biz_id 캡처
      console.log('[setup] 토큰 없음 → 네트워크 인터셉트 방식으로 biz_id 탐색');
      await page.route('**/api/businesses/me**', async (route) => {
        const response = await route.fetch();
        try {
          const json = await response.json();
          const businesses = Array.isArray(json) ? json : json?.businesses || [];
          if (businesses.length > 0 && !bizId) {
            bizId = businesses[0].id as string;
            console.log(`[setup] 인터셉트로 biz_id 획득: ${bizId}`);
          }
        } catch { /* ignore */ }
        await route.fulfill({ response });
      });
      await page.goto('/dashboard', { waitUntil: 'networkidle' });
      await page.unrouteAll();
    }

    expect(bizId, '사업장 ID를 획득할 수 없습니다.').toBeTruthy();

    // .biz_id 파일에 저장
    fs.writeFileSync(BIZ_ID_FILE, bizId as string, 'utf-8');
    console.log(`[setup] .biz_id 파일 저장 완료: ${BIZ_ID_FILE}`);

    // 저장 확인
    const saved = fs.readFileSync(BIZ_ID_FILE, 'utf-8').trim();
    expect(saved).toBe(bizId);
  });
});
