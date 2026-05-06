filepath = "/var/www/aeolab/frontend/app/(dashboard)/competitors/CompetitorsClient.tsx"
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# ─── 작업 6: 경쟁사 페이지 최상단 사용법 안내 배너 추가 ───
# PC 레이아웃 시작 전에 배너 삽입 (플랜 업그레이드 배너 위)
old_pc_start = """      {/* ──────────────────────────────────
          PC 레이아웃 (md 이상)
      ────────────────────────────────── */}
      <div className="hidden md:grid md:grid-cols-5 gap-6">
        {/* 플랜 업그레이드 배너 */}"""
new_pc_start = """      {/* ─── 경쟁사 페이지 사용법 안내 배너 ─── */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 text-sm text-blue-800">
        <p className="font-bold mb-1">경쟁사 페이지 사용법</p>
        <ol className="list-decimal list-inside space-y-1 text-blue-700">
          <li><strong>경쟁사 추가</strong> — 카카오맵 검색 또는 직접 입력으로 같은 업종 경쟁 가게 등록</li>
          <li><strong>비교 분석</strong> — 다음 자동 스캔(새벽 2시) 후 AI 노출 점수 비교 결과 표시</li>
          <li><strong>격차 확인</strong> — 내 가게가 부족한 키워드·점수 차이를 확인하고 가이드에서 개선</li>
        </ol>
      </div>

      {/* ──────────────────────────────────
          PC 레이아웃 (md 이상)
      ────────────────────────────────── */}
      <div className="hidden md:grid md:grid-cols-5 gap-6">
        {/* 플랜 업그레이드 배너 */}"""

if old_pc_start in content:
    content = content.replace(old_pc_start, new_pc_start)
    print("작업6: 사용법 안내 배너 추가 성공")
else:
    print("작업6: PC 레이아웃 패턴 미발견")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("CompetitorsClient.tsx 저장 완료")
