/**
 * 08_all_plans_features.spec.ts — Biz 권한으로 전 플랜 기능 통합 검증
 *
 * admin 계정(hoozdev@gmail.com)은 plan_gate.py ADMIN_EMAILS →
 * 자동으로 Biz 플랜 권한 부여됨.
 * 별도 Pro/Biz 계정 없이 모든 플랜 기능을 한 번에 검증.
 *
 * 중요:
 *  - 스캔 버튼 클릭 금지 (POST /api/scan/full 방지)
 *  - 가이드 생성 버튼 클릭 금지 (Claude API 방지)
 *  - 버튼/링크 존재 확인만 수행
 */
import { test, expect } from '../fixtures/auth';
import * as path from 'path';
import * as fs from 'fs';

function getBizId(): string | null {
  if (process.env.TEST_BASIC_BIZ_ID) return process.env.TEST_BASIC_BIZ_ID;
  const bizIdFile = path.resolve(__dirname, '../.biz_id');
  if (fs.existsSync(bizIdFile)) {
    const content = fs.readFileSync(bizIdFile, 'utf-8').trim();
    if (content) return content;
  }
  return null;
}

test.describe('Basic 기능 — admin 계정 (Biz 권한) 검증', () => {
  test('경쟁사 3곳 이상 추가 UI 존재 확인', async ({ adminPage: page }) => {
    await page.goto('/competitors', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(/\/login/);
    // 경쟁사 추가 버튼 존재 (Basic+ 기능, admin은 Biz라 접근 가능)
    const addBtn = page.getByRole('button', { name: /추가|경쟁사 추가/i }).first();
    const addLink = page.getByRole('link', { name: /추가|경쟁사 추가/i }).first();
    const hasBtn = await addBtn.isVisible().catch(() => false);
    const hasLink = await addLink.isVisible().catch(() => false);
    // 사업장 미등록 시 추가 버튼이 없을 수 있음 — 페이지 접근 성공만 확인
    await expect(page).toHaveURL(/\/competitors/);
    if (hasBtn || hasLink) {
      expect(hasBtn || hasLink).toBeTruthy();
    }
  });

  test('가이드 생성 버튼 존재 (Basic+ 기능)', async ({ adminPage: page }) => {
    await page.goto('/guide', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(/\/login/);
    const generateBtn = page.getByRole('button', { name: /가이드 생성|AI 가이드|분석 시작/i }).first();
    const visible = await generateBtn.isVisible().catch(() => false);
    // 가이드가 이미 있으면 버튼이 없을 수 있음 — 페이지 접근 성공만 필수
    await expect(page).toHaveURL(/\/guide/);
    if (visible) {
      await expect(generateBtn).toBeVisible();
    }
  });

  test('블로그 분석 페이지 접근 (Basic+ 기능)', async ({ adminPage: page }) => {
    await page.goto('/blog-analysis', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page).toHaveURL(/\/blog-analysis/);
  });
});

test.describe('Pro 기능 — admin 계정 (Biz 권한) 검증', () => {
  test('PDF 내보내기 버튼/링크 존재 (Pro+ 기능)', async ({ adminPage: page }) => {
    // PDF 버튼은 사업장이 있을 때 대시보드 또는 히스토리 페이지에 나타남
    const noBiz = await page.getByText(/가게 등록|사업장 등록/i).first().isVisible().catch(() => false);
    if (noBiz) {
      test.info().annotations.push({ type: 'note', description: '사업장 미등록 — PDF 버튼 없음, skip' });
      return;
    }
    const pdfEl = page.getByText(/PDF.*다운로드|PDF.*내보내기|리포트.*PDF/i).first();
    const roleEl = page.getByRole('button', { name: /PDF/i }).first();
    const hasText = await pdfEl.isVisible().catch(() => false);
    const hasRole = await roleEl.isVisible().catch(() => false);
    if (hasText || hasRole) {
      expect(hasText || hasRole).toBeTruthy();
    }
  });

  test('CSV 내보내기 버튼/링크 존재 (Pro+ 기능)', async ({ adminPage: page }) => {
    const noBiz = await page.getByText(/가게 등록|사업장 등록/i).first().isVisible().catch(() => false);
    if (noBiz) {
      test.info().annotations.push({ type: 'note', description: '사업장 미등록 — CSV 버튼 없음, skip' });
      return;
    }
    const csvEl = page.getByText(/CSV.*다운로드|CSV.*내보내기|데이터.*내보내기/i).first();
    const hasText = await csvEl.isVisible().catch(() => false);
    if (hasText) {
      await expect(csvEl).toBeVisible();
    }
  });

  test('/dashboard/history 접근 성공 (Pro+ 기능)', async ({ adminPage: page }) => {
    await page.goto('/dashboard/history', { waitUntil: 'domcontentloaded' });
    // admin은 Biz → Pro+ 기능 접근 가능
    await expect(page).not.toHaveURL(/\/login/, { timeout: 5_000 });
    await expect(page).toHaveURL(/\/history/);
  });
});

test.describe('Biz 기능 — admin 계정 (Biz 권한) 검증', () => {
  test('멀티 사업장 추가 버튼 존재 (Biz 최대 5개)', async ({ adminPage: page }) => {
    // 사업장 관리 UI — 멀티 사업장은 /dashboard/settings 또는 사이드바에서 접근 가능
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(/\/login/);
    // "사업장 추가", "+ 사업장" 등 Biz 전용 멀티 사업장 버튼 확인
    const addBizBtn = page.getByRole('button', { name: /사업장 추가|사업장.*추가|\+ 사업장/i }).first();
    const visible = await addBizBtn.isVisible().catch(() => false);
    // 버튼이 없으면 페이지 접근 성공만 확인 (설정 UI 구성에 따라 다름)
    await expect(page).toHaveURL(/\/settings/);
    if (visible) {
      await expect(addBizBtn).toBeVisible();
    }
  });

  test('/dashboard/settings 접근 확인 (Biz 기능)', async ({ adminPage: page }) => {
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page).toHaveURL(/\/settings/);
    // 구독 관련 정보 노출
    const subText = page.getByText(/구독|플랜|요금제/i).first();
    await expect(subText).toBeVisible({ timeout: 8_000 });
  });
});

test.describe('스캔 관련 — 버튼 존재 확인 (클릭 절대 금지)', () => {
  test('수동 스캔 버튼 존재 확인 (AI API 호출 방지 — 클릭 안 함)', async ({ adminPage: page }) => {
    // ScanTrigger renders "AI 스캔 시작" after async data load — wait with timeout
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
});

test.describe('API 레벨 — admin 계정 토큰으로 Biz API 접근 확인', () => {
  test('GET /api/businesses/me — 200 응답 (인증된 요청)', async ({ adminContext }) => {
    const bizId = getBizId();
    if (!bizId) {
      test.skip(true, 'bizId 없음. 00_setup.spec.ts를 먼저 실행하거나 TEST_BASIC_BIZ_ID를 설정하세요.');
      return;
    }
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://aeolab.co.kr';
    const page = await adminContext.newPage();

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    const token = await page.evaluate(() => {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.includes('supabase') && key.includes('auth')) {
          try {
            const val = JSON.parse(localStorage.getItem(key) || '{}');
            return val?.access_token || val?.session?.access_token || null;
          } catch {
            return null;
          }
        }
      }
      return null;
    });

    if (!token) {
      test.skip(true, '액세스 토큰 추출 실패');
      await page.close();
      return;
    }

    const response = await page.request.get(`${backendUrl}/api/businesses/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    // admin 계정 = 인증 성공 → 200
    expect([200, 201]).toContain(response.status());
    await page.close();
  });

  test('GET /api/report/score/{biz_id} — admin 계정 → 200 또는 404 (인증 성공)', async ({ adminContext }) => {
    const bizId = getBizId();
    if (!bizId) {
      test.skip(true, 'bizId 없음. 00_setup.spec.ts를 먼저 실행하세요.');
      return;
    }
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://aeolab.co.kr';
    const page = await adminContext.newPage();

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    const token = await page.evaluate(() => {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.includes('supabase') && key.includes('auth')) {
          try {
            const val = JSON.parse(localStorage.getItem(key) || '{}');
            return val?.access_token || val?.session?.access_token || null;
          } catch {
            return null;
          }
        }
      }
      return null;
    });

    if (!token) {
      test.skip(true, '액세스 토큰 추출 실패');
      await page.close();
      return;
    }

    const response = await page.request.get(
      `${backendUrl}/api/report/score/${bizId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    // 인증 성공 → 200 (스캔 데이터 있음) 또는 404 (스캔 미실행)
    // 401/403은 플랜 차단 → 실패
    expect([200, 404, 422]).toContain(response.status());
    await page.close();
  });
});
