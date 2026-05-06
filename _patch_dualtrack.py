import sys

fpath = '/var/www/aeolab/frontend/components/dashboard/DualTrackCard.tsx'
with open(fpath, 'r', encoding='utf-8') as f:
    content = f.read()

# --- 수정 1: Track1 sublabel ---
old1 = 'sublabel="스마트플레이스 완성도·리뷰 키워드·FAQ 등록 여부"'
new1 = 'sublabel="이 점수가 낮으면 네이버 AI가 내 가게를 잘 모릅니다"'
if old1 not in content:
    print('ERROR: Track1 sublabel not found', file=sys.stderr)
    sys.exit(1)
content = content.replace(old1, new1)
print('Track1 sublabel replaced')

# --- 수정 2: Track2 sublabel ---
old2 = 'sublabel="ChatGPT·Gemini·Perplexity 노출 + 웹사이트 구조화"'
new2 = 'sublabel="이 점수가 낮으면 ChatGPT·구글 AI에서 내 가게가 안 나옵니다"'
if old2 not in content:
    print('ERROR: Track2 sublabel not found', file=sys.stderr)
    sys.exit(1)
content = content.replace(old2, new2)
print('Track2 sublabel replaced')

# --- 수정 3: benchmarkAvg div - text-xs → text-sm font-semibold + 배경 박스 ---
old3 = '            <div className="text-xs mt-1">'
new3 = '            <div className={`mt-1 px-2 py-1 rounded-lg text-sm font-semibold ${\n              unifiedScore >= benchmarkAvg\n                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"\n                : "bg-red-50 text-red-600 border border-red-200"\n            }`}>'
if old3 not in content:
    print('ERROR: benchmarkAvg div not found', file=sys.stderr)
    sys.exit(1)
content = content.replace(old3, new3, 1)
print('benchmarkAvg div replaced')

# --- 수정 4: 기존 <span> 태그 제거 (div로 대체되었으므로 span wrapper 제거) ---
old4 = '              <span className={unifiedScore >= benchmarkAvg ? "text-green-600 font-semibold" : "text-amber-600 font-semibold"}>\n                {unifiedScore >= benchmarkAvg\n                  ? `\u25b2 업종 평균보다 ${Math.round(unifiedScore - benchmarkAvg)}점 높음`\n                  : `\u25bc 업종 평균보다 ${Math.round(benchmarkAvg - unifiedScore)}점 낮음`}\n              </span>'
new4 = '              {unifiedScore >= benchmarkAvg\n                ? `\u25b2 업종 평균보다 ${Math.round(unifiedScore - benchmarkAvg)}점 높음`\n                : `\u25bc 업종 평균보다 ${Math.round(benchmarkAvg - unifiedScore)}점 낮음`}'
if old4 not in content:
    print('ERROR: span wrapper not found', file=sys.stderr)
    sys.exit(1)
content = content.replace(old4, new4, 1)
print('span wrapper removed')

with open(fpath, 'w', encoding='utf-8') as f:
    f.write(content)
print('File written successfully')
