import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';

/**
 * AEOlab E2E 테스트 설정
 *
 * 대상: https://aeolab.co.kr (실서버)
 * 원칙:
 *  - AI API 스캔 트리거 금지 (POST /api/scan/full, /api/scan/trial)
 *  - 읽기 전용 + 플랜 게이트 차단 검증 위주
 *  - 테스트 계정은 환경변수로 분리 (.env.test 로드)
 */

// dotenv 로드 (.env.test 우선, 없으면 .env.test.example)
const envPath = path.resolve(__dirname, '.env.test');

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 2 : 1,
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
  ],
  use: {
    baseURL: process.env.TEST_BASE_URL || 'https://aeolab.co.kr',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    // 실서버 응답 대기 여유
    navigationTimeout: 20_000,
    actionTimeout: 10_000,
  },
  projects: [
    {
      name: 'Desktop Chrome',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
  // 인증 상태 저장 디렉토리
  outputDir: 'test-results',
});
