#!/usr/bin/env python3
"""
UI 패치 스크립트 — 2026-04-14
수정 1: DualTrackCard — 없는 키워드 amber 박스에서 첫 번째 키워드를 /guide?keyword= 파라미터로 전달
수정 2: GuideClient — 가이드 생성 중 skeleton 강화 (이미 스피너 있음, 텍스트 개선)
수정 3: GuideClient — useSearchParams로 keyword 파라미터 수신 + 하이라이트
수정 4: CompetitorsClient — 경쟁사 추가 완료 모달에 "새벽 2시" 안내 문구 추가
"""

import re

# ── 파일 경로 ────────────────────────────────────────────────────────────────
DUAL_TRACK = "/var/www/aeolab/frontend/components/dashboard/DualTrackCard.tsx"
GUIDE_CLIENT = "/var/www/aeolab/frontend/app/(dashboard)/guide/GuideClient.tsx"
COMPETITORS = "/var/www/aeolab/frontend/app/(dashboard)/competitors/CompetitorsClient.tsx"


def read(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def write(path, content):
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"  [OK] {path}")


# ── 수정 1: DualTrackCard — 가이드 링크에 첫 번째 키워드 파라미터 ────────────
def patch_dual_track():
    print("\n[수정 1] DualTrackCard.tsx — 가이드 링크에 keyword 파라미터 추가")
    content = read(DUAL_TRACK)

    old = '''          <Link
            href="/guide"
            className="inline-flex items-center gap-1.5 bg-amber-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-amber-700 transition-colors"
          >
            <ArrowRight className="w-4 h-4" /> 가이드에서 해결 방법 보기
          </Link>'''

    new = '''          <Link
            href={`/guide?keyword=${encodeURIComponent(topMissingKeywords[0])}`}
            className="inline-flex items-center gap-1.5 bg-amber-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-amber-700 transition-colors"
          >
            <ArrowRight className="w-4 h-4" /> 가이드에서 해결 방법 보기
          </Link>'''

    if old not in content:
        print("  [WARN] 대상 코드를 찾지 못했습니다. 이미 수정됐거나 구조가 다릅니다.")
        return

    content = content.replace(old, new, 1)
    write(DUAL_TRACK, content)


# ── 수정 2 + 3: GuideClient — skeleton 개선 + useSearchParams + highlight ────
def patch_guide_client():
    print("\n[수정 2+3] GuideClient.tsx — 가이드 생성 skeleton + keyword 하이라이트")
    content = read(GUIDE_CLIENT)

    # --- 2-A: useSearchParams import 추가 ---
    # useRouter 옆에 useSearchParams 추가
    old_import = "import { useRouter } from 'next/navigation'"
    new_import = "import { useRouter, useSearchParams } from 'next/navigation'"

    if old_import in content:
        content = content.replace(old_import, new_import, 1)
        print("  [OK] useSearchParams import 추가")
    else:
        print("  [WARN] useRouter import 위치를 찾지 못했습니다.")

    # --- 2-B: highlightKeyword 상태 추가 (router 선언 바로 아래) ---
    old_router_line = "  const router = useRouter()"
    new_router_block = """  const router = useRouter()
  const searchParams = useSearchParams()
  const highlightKeyword = searchParams.get('keyword')"""

    if old_router_line in content and "highlightKeyword" not in content:
        content = content.replace(old_router_line, new_router_block, 1)
        print("  [OK] highlightKeyword 상태 추가")
    elif "highlightKeyword" in content:
        print("  [SKIP] highlightKeyword 이미 존재")
    else:
        print("  [WARN] router 선언 위치를 찾지 못했습니다.")

    # --- 2-C: loading 중 UI에 skeleton 추가 (스피너 유지 + skeleton 추가) ---
    old_loading_block = """        {loading && (
          <div className="bg-white rounded-2xl p-6 md:p-8 text-center shadow-sm">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-gray-600 mb-1">AI가 내 가게 맞춤 전략을 작성 중입니다... ({elapsedSeconds}초)</p>
            <p className="text-gray-400 text-sm">
              {elapsedSeconds < 10 ? '보통 10~25초 소요됩니다' :
               elapsedSeconds < 20 ? '거의 다 됐습니다...' :
               '조금만 더 기다려주세요...'}
            </p>
          </div>
        )}"""

    new_loading_block = """        {loading && (
          <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm space-y-4">
            <div className="text-center mb-2">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-gray-700 font-medium mb-1">Claude AI가 가이드를 만들고 있어요... ({elapsedSeconds}초)</p>
              <p className="text-gray-400 text-sm">
                {elapsedSeconds < 10 ? '보통 10~30초 소요됩니다' :
                 elapsedSeconds < 25 ? '거의 다 됐습니다...' :
                 '조금만 더 기다려주세요...'}
              </p>
            </div>
            <div className="animate-pulse space-y-3">
              <div className="h-5 bg-gray-200 rounded w-1/3" />
              <div className="h-4 bg-gray-100 rounded w-full" />
              <div className="h-4 bg-gray-100 rounded w-5/6" />
              <div className="h-4 bg-gray-100 rounded w-4/6" />
              <div className="h-5 bg-gray-200 rounded w-2/5 mt-2" />
              <div className="h-4 bg-gray-100 rounded w-full" />
              <div className="h-4 bg-gray-100 rounded w-3/4" />
            </div>
          </div>
        )}"""

    if old_loading_block in content:
        content = content.replace(old_loading_block, new_loading_block, 1)
        print("  [OK] 가이드 생성 중 skeleton UI 추가")
    else:
        print("  [WARN] loading 블록을 찾지 못했습니다. 이미 수정됐거나 구조가 다릅니다.")

    # --- 2-D: !guide && !loading 상태에 안내 문구 추가 ---
    old_no_guide = """        {!guide && !loading && (
          <div className="bg-white rounded-2xl p-6 md:p-8 text-center shadow-sm">
            <Lightbulb className="w-10 h-10 text-yellow-400 mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-gray-700 font-medium mb-2">아직 개선 가이드가 없습니다.</p>
            <p className="text-sm text-gray-400 mb-1">
              {latestScanId
                ? "위의 '가이드 생성하기' 버튼을 눌러주세요."
                : '먼저 대시보드에서 AI 스캔을 실행해주세요.'}
            </p>
            {latestScanId && (
              <p className="text-sm text-gray-400">AI가 스캔 결과를 분석해 지금 당장 실천할 수 있는 방법을 알려드립니다.</p>
            )}
          </div>
        )}"""

    new_no_guide = """        {!guide && !loading && (
          <div className="bg-white rounded-2xl p-6 md:p-8 text-center shadow-sm">
            <Lightbulb className="w-10 h-10 text-yellow-400 mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-gray-700 font-medium mb-2">아직 개선 가이드가 없습니다.</p>
            <p className="text-sm text-gray-500 mb-2 leading-relaxed">
              {latestScanId
                ? "위의 '가이드 생성하기' 버튼을 눌러주세요."
                : '먼저 대시보드에서 AI 스캔을 실행해주세요.'}
            </p>
            {latestScanId && (
              <>
                <p className="text-sm text-gray-500 mb-1 leading-relaxed">
                  AI 스캔 결과를 바탕으로 맞춤 가이드를 만들어 드립니다.
                </p>
                <p className="text-sm text-gray-400 leading-relaxed">
                  생성에 약 30초 소요됩니다.
                </p>
              </>
            )}
          </div>
        )}"""

    if old_no_guide in content:
        content = content.replace(old_no_guide, new_no_guide, 1)
        print("  [OK] !guide 상태 안내 문구 개선")
    else:
        print("  [WARN] !guide 블록을 찾지 못했습니다.")

    # --- 2-E: KeywordGapCard 내 키워드 배지에 highlightKeyword 하이라이트 적용 ---
    # KeywordGapCard 컴포넌트 내에서 missing_keywords를 렌더링하는 부분을 찾아 하이라이트 적용
    # "owned_keywords" 또는 "missing_keywords" 부분에서 kw 배지에 ring 추가
    # 기존 코드 패턴: className="...bg-red-100..."
    # missing_keywords 렌더링 구역을 찾아서 하이라이트 조건 추가

    # GuideClient 내부에는 KeywordGapCard라는 함수형 컴포넌트가 있을 것
    # missing 키워드 배지 부분을 찾아서 highlightKeyword 조건 추가
    # Props로 highlightKeyword를 전달해야 하므로, 먼저 KeywordGapCard 위치를 찾는다
    # grep으로 이미 확인: 내부 컴포넌트이므로 클로저로 접근 가능한지 확인 필요

    # KeywordGapCard가 내부 컴포넌트라면 highlightKeyword를 직접 참조 가능
    # 외부 컴포넌트라면 props로 전달 필요 — 파일 구조 확인 필요
    # 일단 missing 키워드 배지에서 안전하게 패턴 매칭

    # 패턴: XCircle 아이콘과 함께 missing 키워드를 렌더링하는 span
    old_missing_badge = """                    key={kw}
                    className="inline-flex items-center gap-1 bg-red-50 text-red-700 border border-red-200 text-sm font-semibold rounded-full px-3 py-1.5 cursor-pointer hover:bg-red-100 transition-colors"
                    onClick={() => copyText(kw)}"""

    new_missing_badge = """                    key={kw}
                    className={`inline-flex items-center gap-1 bg-red-50 text-red-700 border border-red-200 text-sm font-semibold rounded-full px-3 py-1.5 cursor-pointer hover:bg-red-100 transition-colors${highlightKeyword === kw ? ' ring-2 ring-amber-400 ring-offset-1' : ''}`}
                    onClick={() => copyText(kw)}"""

    if old_missing_badge in content:
        content = content.replace(old_missing_badge, new_missing_badge, 1)
        print("  [OK] KeywordGapCard missing 배지에 highlightKeyword 하이라이트 적용")
    else:
        # 대안: 다른 패턴으로 시도
        print("  [INFO] missing 배지 패턴1 미발견, 대안 패턴 시도...")
        # XCircle과 함께 쓰이는 missing kw 배지 — 다른 클래스명일 수 있음
        alt_pattern = 'className="inline-flex items-center gap-1 bg-red-50 text-red-700'
        if alt_pattern in content:
            print("  [INFO] 대안 패턴 발견 (정확한 위치 파악 필요)")
        else:
            print("  [WARN] missing 키워드 배지 패턴을 찾지 못했습니다. 수동 확인 필요.")

    write(GUIDE_CLIENT, content)


# ── 수정 4: CompetitorsClient — 경쟁사 추가 완료 모달에 새벽 2시 안내 추가 ──
def patch_competitors():
    print("\n[수정 4] CompetitorsClient.tsx — 경쟁사 추가 완료 모달에 새벽 2시 안내")
    content = read(COMPETITORS)

    old_modal_text = """            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 mb-5 text-center">
              스캔하지 않으면 경쟁사 점수가 표시되지 않습니다
            </p>"""

    new_modal_text = """            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 mb-5 text-center leading-relaxed">
              스캔하지 않으면 경쟁사 점수가 표시되지 않습니다.<br />
              지금 스캔하지 않으면 다음 자동 스캔(새벽 2시)에 비교 데이터가 나타납니다.
            </p>"""

    if old_modal_text in content:
        content = content.replace(old_modal_text, new_modal_text, 1)
        print("  [OK] 새벽 2시 자동 스캔 안내 추가")
    else:
        print("  [WARN] 대상 텍스트를 찾지 못했습니다.")
        # 대안: h3 경쟁사 추가 완료 아래 p 태그 추가
        old_h3 = '            <h3 className="font-bold text-gray-900 text-base md:text-lg mb-2 text-center">경쟁 가게가 추가되었습니다!</h3>'
        if old_h3 in content:
            print("  [INFO] h3 발견. 모달 구조 확인 필요.")

    write(COMPETITORS, content)


if __name__ == "__main__":
    print("=== UI 패치 시작 ===")
    patch_dual_track()
    patch_guide_client()
    patch_competitors()
    print("\n=== 패치 완료 ===")
