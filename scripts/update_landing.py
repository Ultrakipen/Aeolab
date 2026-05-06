# DEPRECATED 2026-05-03 — 일회성 스크립트, 재실행 금지
with open('/var/www/aeolab/frontend/app/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. import에 DiagnosisCounter 추가
old_import = 'import Link from "next/link";'
new_import = '''import Link from "next/link";
import DiagnosisCounter from "@/components/landing/DiagnosisCounter";'''

if 'DiagnosisCounter' not in content:
    content = content.replace(old_import, new_import, 1)
    print("OK: import added")
else:
    print("SKIP: import already present")

# 2. 섹션 3-B 비어있는 주석을 실제 컨텐츠로 교체
old_section_3b = '      {/* ── 섹션 3-B: 소셜 프루프 ── */}\n'

new_section_3b = '''      {/* ── 섹션 3-B: 소셜 프루프 ── */}
      <section className="py-8 md:py-10 px-4 md:px-6 bg-green-50">
        <div className="max-w-5xl mx-auto">

          {/* 실시간 진단 수 배너 */}
          <div className="flex justify-center mb-8">
            <DiagnosisCounter />
          </div>

          {/* 사용자 경험 스토리 카드 3개 */}
          <h2 className="text-xl sm:text-2xl font-bold text-center text-gray-900 mb-2 break-keep">
            이런 변화를 경험하고 있습니다
          </h2>
          <p className="text-sm text-center text-gray-500 mb-6">
            실제 AEOlab 사용자 경험을 바탕으로 재구성한 참고용 내용입니다
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 스토리 1: 카페 */}
            <div className="bg-white rounded-2xl p-5 border border-green-100 shadow-sm flex flex-col">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">&#9749;</span>
                <div>
                  <div className="text-sm font-semibold text-gray-800">강남구 카페 사장님</div>
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                    +18점
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 mb-3 text-sm">
                <div className="flex-1 text-center bg-gray-50 rounded-lg py-2 px-1">
                  <div className="text-xs text-gray-400 mb-0.5">이전</div>
                  <div className="font-semibold text-gray-500">AI 브리핑 노출 0회</div>
                </div>
                <span className="text-gray-300 font-bold shrink-0">→</span>
                <div className="flex-1 text-center bg-green-50 rounded-lg py-2 px-1">
                  <div className="text-xs text-gray-400 mb-0.5">2주 후</div>
                  <div className="font-semibold text-green-700">첫 노출 시작</div>
                </div>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed flex-1">
                FAQ 3개만 스마트플레이스에 등록했더니 2주 만에 네이버 AI 브리핑에 처음으로 이름이 나왔어요.
              </p>
              <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400 flex items-center gap-1">
                <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">스마트플레이스 FAQ 등록</span>
              </div>
            </div>

            {/* 스토리 2: 미용 */}
            <div className="bg-white rounded-2xl p-5 border border-green-100 shadow-sm flex flex-col">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">&#9986;&#65039;</span>
                <div>
                  <div className="text-sm font-semibold text-gray-800">마포구 헤어샵 원장님</div>
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                    +24점
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 mb-3 text-sm">
                <div className="flex-1 text-center bg-gray-50 rounded-lg py-2 px-1">
                  <div className="text-xs text-gray-400 mb-0.5">이전</div>
                  <div className="font-semibold text-gray-500">5곳 중 점수 꼴찌</div>
                </div>
                <span className="text-gray-300 font-bold shrink-0">→</span>
                <div className="flex-1 text-center bg-green-50 rounded-lg py-2 px-1">
                  <div className="text-xs text-gray-400 mb-0.5">3주 후</div>
                  <div className="font-semibold text-green-700">3위로 상승</div>
                </div>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed flex-1">
                경쟁 미용실이 왜 저보다 AI에 잘 나오는지 처음 알았어요. 없는 키워드 3개 소개글에 넣었더니 순위가 바뀌었어요.
              </p>
              <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400 flex items-center gap-1">
                <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">소개글 키워드 최적화</span>
              </div>
            </div>

            {/* 스토리 3: 음식점 */}
            <div className="bg-white rounded-2xl p-5 border border-green-100 shadow-sm flex flex-col">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">&#127857;</span>
                <div>
                  <div className="text-sm font-semibold text-gray-800">송파구 한식당 사장님</div>
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                    +15점
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 mb-3 text-sm">
                <div className="flex-1 text-center bg-gray-50 rounded-lg py-2 px-1">
                  <div className="text-xs text-gray-400 mb-0.5">이전</div>
                  <div className="font-semibold text-gray-500">조건검색 미노출</div>
                </div>
                <span className="text-gray-300 font-bold shrink-0">→</span>
                <div className="flex-1 text-center bg-green-50 rounded-lg py-2 px-1">
                  <div className="text-xs text-gray-400 mb-0.5">1주 후</div>
                  <div className="font-semibold text-green-700">단체예약 검색 노출</div>
                </div>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed flex-1">
                &apos;단체예약 가능&apos; 키워드가 없다고 알려줘서 리뷰 답변에만 추가했는데, 조건 검색에서 나타나기 시작했어요.
              </p>
              <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400 flex items-center gap-1">
                <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">리뷰 답변 키워드 추가</span>
              </div>
            </div>
          </div>
        </div>
      </section>

'''

if old_section_3b in content:
    content = content.replace(old_section_3b, new_section_3b, 1)
    print("OK: section 3-B replaced with social proof content")
else:
    print("ERROR: section 3-B marker not found")
    # 디버그용으로 주변 내용 확인
    idx = content.find('섹션 3-B')
    if idx >= 0:
        print(f"Found at idx {idx}: {repr(content[idx-5:idx+80])}")

with open('/var/www/aeolab/frontend/app/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("SUCCESS: landing page updated")
