filepath = "/var/www/aeolab/frontend/app/(dashboard)/blog/BlogClient.tsx"
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# ─── 작업 5: 복사 버튼에 disabled 처리 추가 ───
# top_recommendation이 없으면 disabled
old_copy_btn = """                  <button
                    onClick={() => copyToClipboard(result.top_recommendation ?? "", setCopied)}
                    className="shrink-0 inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors w-full sm:w-auto justify-center"
                  >
                    {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? "복사됨" : "복사"}
                  </button>"""
new_copy_btn = """                  <button
                    onClick={() => result.top_recommendation && copyToClipboard(result.top_recommendation, setCopied)}
                    disabled={!result.top_recommendation}
                    className="shrink-0 inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors w-full sm:w-auto justify-center"
                  >
                    {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? "복사됨" : !result.top_recommendation ? "복사할 내용 없음" : "복사"}
                  </button>"""

if old_copy_btn in content:
    content = content.replace(old_copy_btn, new_copy_btn)
    print("작업5: BlogClient 복사 버튼 disabled 추가 성공")
else:
    print("작업5: 복사 버튼 패턴 미발견")

# copyToClipboard 함수에 빈 문자열 가드 추가
old_copy_fn = """function copyToClipboard(text: string, setCopied: (v: boolean) => void) {
  navigator.clipboard.writeText(text).then(() => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  });
}"""
new_copy_fn = """function copyToClipboard(text: string, setCopied: (v: boolean) => void) {
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  });
}"""

if old_copy_fn in content:
    content = content.replace(old_copy_fn, new_copy_fn)
    print("작업5: copyToClipboard 빈 문자열 가드 추가 성공")
else:
    print("작업5: copyToClipboard 함수 패턴 미발견")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("BlogClient.tsx 저장 완료")
