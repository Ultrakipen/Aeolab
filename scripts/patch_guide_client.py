#!/usr/bin/env python3
"""
3가지 수정:
1. BriefingPathsSection - 복사 문구 잠금을 blur 대신 명확한 안내 박스로 교체
2. GuideTabView 탭 바 위에 안내 배너 추가
3. OnboardingProgressBar localStorage fallback 추가
"""

import sys

# ─── 수정 1: BriefingPathsSection blur → 명확한 잠금 박스 ───────────────────

GUIDE_PATH = "/var/www/aeolab/frontend/app/(dashboard)/guide/GuideClient.tsx"

OLD_READY_TEXT_BLOCK = """                  {path.ready_text && (
                    <div className="relative">
                      <div className={`bg-blue-50 rounded-lg p-3 ${isReadyTextLocked ? 'blur-sm select-none' : ''}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-blue-700">바로 붙여넣기 가능한 문구</span>
                          {!isReadyTextLocked && <CopyButton text={path.ready_text} label="문구 복사" />}
                        </div>
                        <p className="text-base text-blue-800 leading-relaxed whitespace-pre-wrap">{path.ready_text}</p>
                      </div>
                      {isReadyTextLocked && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/70 rounded-lg">
                          <div className="text-center px-4">
                            <p className="text-sm font-semibold text-gray-700">Pro 플랜에서 전체 복사 문구를 확인하세요</p>
                            <a href="/pricing" className="text-sm text-blue-600 hover:underline mt-1 inline-block">
                              업그레이드하기 →
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  )}"""

NEW_READY_TEXT_BLOCK = """                  {path.ready_text && (
                    isReadyTextLocked ? (
                      <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg text-center">
                        <p className="text-sm text-gray-500">복사 문구는 Pro 플랜에서 제공됩니다</p>
                        <a href="/pricing" className="mt-2 inline-block text-xs text-blue-600 underline hover:text-blue-800">
                          Pro로 업그레이드 →
                        </a>
                      </div>
                    ) : (
                      <div className="bg-blue-50 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-blue-700">바로 붙여넣기 가능한 문구</span>
                          <CopyButton text={path.ready_text} label="문구 복사" />
                        </div>
                        <p className="text-base text-blue-800 leading-relaxed whitespace-pre-wrap">{path.ready_text}</p>
                      </div>
                    )
                  )}"""

# ─── 수정 2: GuideTabView 탭 바 위에 안내 배너 추가 ────────────────────────

OLD_TAB_BAR = """      {/* 탭 바 */}
      <div className="flex gap-2 bg-gray-100 p-1 rounded-full w-fit">"""

NEW_TAB_BAR = """      {/* 안내 배너 */}
      <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
        <span className="text-lg mt-0.5">💡</span>
        <div>
          <p className="text-sm font-semibold text-amber-800">이 가이드는 AI 스캔 결과 기반으로 자동 생성됩니다</p>
          <p className="text-xs text-amber-600 mt-0.5">복사 버튼을 눌러 스마트플레이스에 바로 붙여넣기 하세요. 실천할수록 네이버 AI 브리핑 노출이 올라갑니다.</p>
        </div>
      </div>

      {/* 탭 바 */}
      <div className="flex gap-2 bg-gray-100 p-1 rounded-full w-fit">"""

# ─── 파일 읽기 및 수정 적용 ────────────────────────────────────────────────

with open(GUIDE_PATH, "r", encoding="utf-8") as f:
    content = f.read()

original = content

# 수정 1 적용
if OLD_READY_TEXT_BLOCK in content:
    content = content.replace(OLD_READY_TEXT_BLOCK, NEW_READY_TEXT_BLOCK, 1)
    print("[OK] 수정 1: BriefingPathsSection 복사 문구 잠금 방식 변경 완료")
else:
    print("[SKIP] 수정 1: 대상 블록을 찾지 못함 (이미 수정됐거나 구조 다름)")

# 수정 2 적용
if OLD_TAB_BAR in content:
    content = content.replace(OLD_TAB_BAR, NEW_TAB_BAR, 1)
    print("[OK] 수정 2: GuideTabView 안내 배너 추가 완료")
else:
    print("[SKIP] 수정 2: 탭 바 블록을 찾지 못함")

if content != original:
    with open(GUIDE_PATH, "w", encoding="utf-8") as f:
        f.write(content)
    print("[SAVED] GuideClient.tsx 저장 완료")
else:
    print("[NO CHANGE] GuideClient.tsx 변경 없음")

# ─── 수정 3: OnboardingProgressBar localStorage fallback ────────────────────

OPB_PATH = "/var/www/aeolab/frontend/components/dashboard/OnboardingProgressBar.tsx"

OLD_LOAD_FN = """    async function load() {
      try {
        const res = await fetch(`${BACKEND}/api/settings/onboarding-status`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });

        if (res.ok) {
          const data: OnboardingStatus = await res.json();
          setStatus(data);
        }
      } catch {
        // 조용히 실패
      }
    }"""

NEW_LOAD_FN = """    async function load() {
      const LS_KEY = `aeolab_onboarding_progress_${userId}`;
      try {
        const res = await fetch(`${BACKEND}/api/settings/onboarding-status`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });

        if (res.ok) {
          const data: OnboardingStatus = await res.json();
          setStatus(data);
          try {
            localStorage.setItem(LS_KEY, JSON.stringify(data));
          } catch {
            // localStorage 쓰기 실패 무시
          }
        } else {
          // API 실패 시 캐시 사용
          const cached = localStorage.getItem(LS_KEY);
          if (cached) {
            setStatus(JSON.parse(cached) as OnboardingStatus);
          }
        }
      } catch {
        // 네트워크 오류 시 캐시 사용
        try {
          const LS_KEY2 = `aeolab_onboarding_progress_${userId}`;
          const cached = localStorage.getItem(LS_KEY2);
          if (cached) {
            setStatus(JSON.parse(cached) as OnboardingStatus);
          }
        } catch {
          // 캐시도 실패하면 조용히 종료
        }
      }
    }"""

with open(OPB_PATH, "r", encoding="utf-8") as f:
    opb_content = f.read()

opb_original = opb_content

if OLD_LOAD_FN in opb_content:
    opb_content = opb_content.replace(OLD_LOAD_FN, NEW_LOAD_FN, 1)
    print("[OK] 수정 3: OnboardingProgressBar localStorage fallback 추가 완료")
else:
    print("[SKIP] 수정 3: load 함수 블록을 찾지 못함")

if opb_content != opb_original:
    with open(OPB_PATH, "w", encoding="utf-8") as f:
        f.write(opb_content)
    print("[SAVED] OnboardingProgressBar.tsx 저장 완료")
else:
    print("[NO CHANGE] OnboardingProgressBar.tsx 변경 없음")

print("\n모든 수정 완료.")
