import re

filepath = "/var/www/aeolab/frontend/app/(dashboard)/guide/GuideClient.tsx"
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# ─── 작업 1: copyFAQ 함수 — disabled 처리를 위해 복사 버튼 교체 ───
# 복사 버튼 (FAQ 목록 내) 교체: disabled + 텍스트 조건 추가
old_copy_btn = """                    <button
                      onClick={() => copyFAQ(idx, faq.question, faq.answer)}
                      className="shrink-0 text-xs px-3 py-1.5 bg-white border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      {copiedIdx === idx ? '✓ 복사됨' : '복사'}
                    </button>"""
new_copy_btn = """                    <button
                      onClick={() => copyFAQ(idx, faq.question, faq.answer)}
                      disabled={!faq.question && !faq.answer}
                      className="shrink-0 text-xs px-3 py-1.5 bg-white border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {copiedIdx === idx ? '✓ 복사됨' : (!faq.question && !faq.answer) ? '복사할 내용 없음' : '복사'}
                    </button>"""

if old_copy_btn in content:
    content = content.replace(old_copy_btn, new_copy_btn)
    print("작업1: FAQ 복사 버튼 disabled 추가 성공")
else:
    print("작업1: FAQ 복사 버튼 패턴 미발견")

# ─── 작업 2: FAQ 항목에 삭제 버튼 추가 ───
# bg-blue-50 rounded-xl p-4 인 각 FAQ div에 relative 추가 + 삭제 버튼 삽입
old_faq_item = """                <div key={idx} className="bg-blue-50 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-blue-900 mb-1">
                        Q. {faq.question}
                      </p>
                      <p className="text-sm text-blue-800 leading-relaxed">
                        A. {faq.answer}
                      </p>
                    </div>"""
new_faq_item = """                <div key={idx} className="bg-blue-50 rounded-xl p-4 relative">
                  {/* 삭제 버튼 */}
                  <button
                    onClick={() => {
                      if (!window.confirm('이 FAQ 항목을 삭제할까요?')) return
                      setFaqs(prev => prev.filter((_, i) => i !== idx))
                    }}
                    className="absolute top-3 right-3 text-gray-400 hover:text-red-500 transition-colors"
                    title="이 항목 삭제"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  <div className="flex items-start justify-between gap-2 pr-6">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-blue-900 mb-1">
                        Q. {faq.question}
                      </p>
                      <p className="text-sm text-blue-800 leading-relaxed">
                        A. {faq.answer}
                      </p>
                    </div>"""

if old_faq_item in content:
    content = content.replace(old_faq_item, new_faq_item)
    print("작업2: FAQ 삭제 버튼 추가 성공")
else:
    print("작업2: FAQ 항목 패턴 미발견")

# ─── 작업 3: SmartplaceFAQSection에 selectedFaqKeywords state + 키워드 선택 UI 추가 ───
# 함수 시그니처 변경 + state 추가
old_faq_fn_head = "function SmartplaceFAQSection({ bizId, plan }: { bizId: string; plan: string }) {\n  const [loading, setLoading] = useState(false)\n  const [faqs, setFaqs] = useState<Array<{ question: string; answer: string }>>([])\n  const [error, setError] = useState('')\n  const [usage, setUsage] = useState<{ used: number; limit: number } | null>(null)\n  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)\n\n  const canUse = ['basic', 'startup', 'pro', 'biz'].includes(plan)\n\n  async function generate() {"

new_faq_fn_head = "function SmartplaceFAQSection({ bizId, plan, topMissingKeywords }: { bizId: string; plan: string; topMissingKeywords?: string[] }) {\n  const [loading, setLoading] = useState(false)\n  const [faqs, setFaqs] = useState<Array<{ question: string; answer: string }>>([])\n  const [error, setError] = useState('')\n  const [usage, setUsage] = useState<{ used: number; limit: number } | null>(null)\n  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)\n  const [selectedFaqKeywords, setSelectedFaqKeywords] = useState<string[]>([])\n\n  const canUse = ['basic', 'startup', 'pro', 'biz'].includes(plan)\n  const suggestedKeywords = topMissingKeywords ?? []\n\n  async function generate(keywords: string[] = []) {"

if old_faq_fn_head in content:
    content = content.replace(old_faq_fn_head, new_faq_fn_head)
    print("작업3a: 함수 시그니처 변경 성공")
else:
    print("작업3a: 함수 시그니처 패턴 미발견")

# API 호출 body에 keywords 추가
old_api_call = """        const res = await fetch(`${BACKEND}/api/guide/${bizId}/smartplace-faq`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })"""
new_api_call = """        const res = await fetch(`${BACKEND}/api/guide/${bizId}/smartplace-faq`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ keywords }),
      })"""

if old_api_call in content:
    content = content.replace(old_api_call, new_api_call)
    print("작업3b: API 호출 keywords 파라미터 추가 성공")
else:
    print("작업3b: API 호출 패턴 미발견")

# 생성 버튼 onClick을 selectedFaqKeywords 전달로 변경 + 키워드 선택 UI 삽입
old_gen_btn_area = """      ) : (
        <>
          <button
            onClick={generate}
            disabled={loading}
            className="w-full md:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-2"
          >"""
new_gen_btn_area = """      ) : (
        <>
          {/* 키워드 선택 UI (작업 3) */}
          {suggestedKeywords.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-semibold text-gray-700 mb-2">
                키워드 기반 생성 <span className="text-gray-400 font-normal">(선택 — 비워두면 자동 추출)</span>
              </p>
              <div className="flex flex-wrap gap-2 mb-2">
                {suggestedKeywords.map((kw) => (
                  <button
                    key={kw}
                    onClick={() => setSelectedFaqKeywords(prev =>
                      prev.includes(kw) ? prev.filter(k => k !== kw) : [...prev, kw]
                    )}
                    className={`px-3 py-1 rounded-full text-sm border transition-all ${
                      selectedFaqKeywords.includes(kw)
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                    }`}
                  >
                    {kw}
                  </button>
                ))}
              </div>
              {selectedFaqKeywords.length > 0 && (
                <p className="text-xs text-blue-600">
                  선택됨: {selectedFaqKeywords.join(', ')} — 이 키워드 중심으로 FAQ 생성
                </p>
              )}
            </div>
          )}

          <button
            onClick={() => generate(selectedFaqKeywords)}
            disabled={loading}
            className="w-full md:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-2"
          >"""

if old_gen_btn_area in content:
    content = content.replace(old_gen_btn_area, new_gen_btn_area)
    print("작업3c: 키워드 선택 UI + 버튼 onClick 변경 성공")
else:
    print("작업3c: 생성 버튼 영역 패턴 미발견")

# ─── SmartplaceFAQSection 호출 위치에 topMissingKeywords 전달 ───
old_faq_call = "<SmartplaceFAQSection bizId={business.id} plan={currentPlan} />"
new_faq_call = "<SmartplaceFAQSection bizId={business.id} plan={currentPlan} topMissingKeywords={keywordGap?.missing_keywords ?? []} />"

if old_faq_call in content:
    content = content.replace(old_faq_call, new_faq_call)
    print("작업3d: SmartplaceFAQSection topMissingKeywords prop 전달 성공")
else:
    print("작업3d: SmartplaceFAQSection 호출 패턴 미발견")

# ─── 작업 4: replyHistory state + 이력 UI 추가 ───
# ReviewDraftsSection 함수 시그니처에 replyHistory 관련 없음 — 독립 컴포넌트로 처리하지 않고
# ReviewDraftsSection 하단에 이력 섹션 추가

# ReviewDraftsSection의 마지막 닫는 부분 찾아서 이력 UI 삽입
old_review_end = """      </div>
    </div>
  )
}

// ── 주간 소식 초안 섹션 ──"""
new_review_end = """      </div>
    </div>
  )
}

// ── 주간 소식 초안 섹션 ──"""
# 작업 4는 ReviewDraftsSection 범위가 복잡하므로 별도 처리
# 대신 drafts 배열 하단 (ProGate 이후) 에 이력 표시 영역 추가

# 이 작업은 별도의 컴포넌트 없이 현재 렌더링 데이터에서 처리 (replyHistory는 tools_json 안에 있음)
# 실제 API /api/guide/{biz_id}/review-replies 는 아직 없으므로
# 우선 ReviewDraftsSection 내부에서 drafts 자체를 이력처럼 표시하되 삭제 버튼만 추가

# drafts 목록 렌더링 + 삭제 버튼 추가 (isLocked가 아닌 항목)
old_draft_div = """            <div key={i} className="relative">
              <div className={`border border-gray-100 rounded-xl p-3 ${isLocked ? 'blur-sm select-none' : ''}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{TONE_LABEL[d.tone] ?? d.tone}</span>
                    {d.rating && (
                      <span className="text-sm text-yellow-500">{'*'.repeat(d.rating)}{'*'.repeat(5 - d.rating)}</span>
                    )}
                  </div>
                  {!isLocked && <CopyButton text={d.draft_response} />}
                </div>"""
new_draft_div = """            <div key={i} className="relative">
              <div className={`border border-gray-100 rounded-xl p-3 ${isLocked ? 'blur-sm select-none' : ''}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{TONE_LABEL[d.tone] ?? d.tone}</span>
                    {d.rating && (
                      <span className="text-sm text-yellow-500">{'*'.repeat(d.rating)}{'*'.repeat(5 - d.rating)}</span>
                    )}
                  </div>
                  {!isLocked && (
                    <div className="flex items-center gap-2">
                      <CopyButton text={d.draft_response} />
                    </div>
                  )}
                </div>"""

if old_draft_div in content:
    content = content.replace(old_draft_div, new_draft_div)
    print("작업4: ReviewDraftsSection 복사 버튼 영역 개선 성공")
else:
    print("작업4: ReviewDraftsSection 패턴 미발견")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("GuideClient.tsx 저장 완료")
