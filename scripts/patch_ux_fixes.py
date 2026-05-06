#!/usr/bin/env python3
# DEPRECATED 2026-05-03 — 일회성 스크립트, 재실행 금지
"""
UX 개선 패치 스크립트 — 4개 파일 수정
1. GuideClient.tsx — BriefingPathsSection 상단에 FAQ 등록 안내 배너 추가
2. pricing/page.tsx — "14일" 문구 확인 (없음 확인됨), Biz mailto → ContactModal 이미 구현됨 (변경 없음)
3. CompetitorsClient.tsx — 탭 버튼에 1줄 설명 추가
4. onboarding/page.tsx — naver_place_id 필드 안내 문구 추가
"""
import re

# ── 1. GuideClient.tsx — BriefingPathsSection 상단 FAQ 배너 삽입 ──
GUIDE_PATH = "/var/www/aeolab/frontend/app/(dashboard)/guide/GuideClient.tsx"

with open(GUIDE_PATH, "r", encoding="utf-8") as f:
    guide_src = f.read()

FAQ_BANNER = '''<div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-3">
        <span className="text-xl">📍</span>
        <div>
          <p className="text-sm font-semibold text-blue-800">스마트플레이스 FAQ 등록 방법</p>
          <p className="text-xs text-blue-600">스마트플레이스 관리자 → 비즈니스 정보 → Q&A 탭에서 등록하세요</p>
        </div>
        <a href="https://smartplace.naver.com" target="_blank" rel="noopener noreferrer"
           className="ml-auto text-xs font-medium text-blue-700 underline whitespace-nowrap">바로 가기 →</a>
      </div>
      '''

# BriefingPathsSection의 return 첫 번째 <div> 안, flex 헤더 앞에 삽입
OLD_BRIEFING = '''  return (
    <div className="bg-white rounded-2xl p-4 md:p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1">'''

NEW_BRIEFING = '''  return (
    <div className="bg-white rounded-2xl p-4 md:p-5 shadow-sm">
      ''' + FAQ_BANNER + '''<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1">'''

if OLD_BRIEFING in guide_src:
    guide_src = guide_src.replace(OLD_BRIEFING, NEW_BRIEFING, 1)
    with open(GUIDE_PATH, "w", encoding="utf-8") as f:
        f.write(guide_src)
    print("[1] GuideClient.tsx — BriefingPathsSection FAQ 배너 삽입 완료")
else:
    print("[1] GuideClient.tsx — 타겟 문자열을 찾을 수 없음. 수동 확인 필요")

# ── 3. CompetitorsClient.tsx — 탭 버튼 1줄 설명 추가 ──
COMP_PATH = "/var/www/aeolab/frontend/app/(dashboard)/competitors/CompetitorsClient.tsx"

with open(COMP_PATH, "r", encoding="utf-8") as f:
    comp_src = f.read()

# 검색으로 추가 탭 버튼 — 기존 텍스트 뒤에 설명 추가
OLD_SEARCH_BTN = '''              <Search className="w-3.5 h-3.5" />지역 검색
            </button>'''

NEW_SEARCH_BTN = '''              <Search className="w-3.5 h-3.5" />지역 검색
              <span className="block text-xs font-normal text-gray-400 leading-tight">카카오맵 근처 동종업체</span>
            </button>'''

# 직접 입력 탭 버튼 — 기존 텍스트 뒤에 설명 추가
OLD_MANUAL_BTN = '''              <Plus className="w-3.5 h-3.5" />직접 입력
            </button>'''

NEW_MANUAL_BTN = '''              <Plus className="w-3.5 h-3.5" />직접 입력
              <span className="block text-xs font-normal text-gray-400 leading-tight">이름·주소 직접 입력</span>
            </button>'''

changed = False
if OLD_SEARCH_BTN in comp_src:
    comp_src = comp_src.replace(OLD_SEARCH_BTN, NEW_SEARCH_BTN, 1)
    changed = True
    print("[3a] CompetitorsClient.tsx — 지역 검색 탭 설명 추가 완료")
else:
    print("[3a] CompetitorsClient.tsx — 검색 탭 타겟 문자열을 찾을 수 없음")

if OLD_MANUAL_BTN in comp_src:
    comp_src = comp_src.replace(OLD_MANUAL_BTN, NEW_MANUAL_BTN, 1)
    changed = True
    print("[3b] CompetitorsClient.tsx — 직접 입력 탭 설명 추가 완료")
else:
    print("[3b] CompetitorsClient.tsx — 직접 입력 탭 타겟 문자열을 찾을 수 없음")

# AEOlab 추천 섹션 헤더 — 이미 설명 있음(text-xs text-gray-400 "동종업계에서 AI 노출 상위 가게")
# 추가로 탭처럼 보이는 업종추천 섹션 헤더 없음 → suggestion은 별도 섹션으로 이미 분리돼 있음
# "AEOlab 추천" 섹션 title 아래 subtitle 보강
OLD_SUGGEST_HEADER = '''              <div className="text-sm font-bold text-gray-800">AEOlab 추천 경쟁 가게</div>
              <div className="text-xs text-gray-400">동종업계에서 AI 노출 상위 가게</div>'''

NEW_SUGGEST_HEADER = '''              <div className="text-sm font-bold text-gray-800">AEOlab 추천 경쟁 가게</div>
              <div className="text-xs text-gray-400">업종 추천 — AEOlab이 같은 업종 가게 추천</div>'''

if OLD_SUGGEST_HEADER in comp_src:
    comp_src = comp_src.replace(OLD_SUGGEST_HEADER, NEW_SUGGEST_HEADER, 1)
    changed = True
    print("[3c] CompetitorsClient.tsx — AEOlab 추천 섹션 설명 보강 완료")
else:
    print("[3c] CompetitorsClient.tsx — 추천 섹션 타겟 문자열을 찾을 수 없음")

if changed:
    with open(COMP_PATH, "w", encoding="utf-8") as f:
        f.write(comp_src)
    print("[3] CompetitorsClient.tsx — 저장 완료")

# ── 4. onboarding/page.tsx — naver_place_id 필드 안내 문구 추가 ──
ONBOARDING_PATH = "/var/www/aeolab/frontend/app/(dashboard)/onboarding/page.tsx"

with open(ONBOARDING_PATH, "r", encoding="utf-8") as f:
    onb_src = f.read()

OLD_NAVER_HINT = '''                <p className="text-xs text-gray-400 mt-1">map.naver.com/v5/entry/place/<strong>123456789</strong> 에서 숫자 부분</p>'''

NEW_NAVER_HINT = '''                <p className="text-xs text-gray-400 mt-1">map.naver.com/v5/entry/place/<strong>123456789</strong> 에서 숫자 부분</p>
                <p className="text-xs text-gray-400 mt-1">💡 위에서 카카오·네이버 자동검색을 사용하면 자동으로 입력됩니다</p>'''

if OLD_NAVER_HINT in onb_src:
    onb_src = onb_src.replace(OLD_NAVER_HINT, NEW_NAVER_HINT, 1)
    with open(ONBOARDING_PATH, "w", encoding="utf-8") as f:
        f.write(onb_src)
    print("[4] onboarding/page.tsx — naver_place_id 안내 문구 추가 완료")
else:
    print("[4] onboarding/page.tsx — 타겟 문자열을 찾을 수 없음. 수동 확인 필요")

print("\n모든 패치 완료")
