import Link from 'next/link'

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Link href="/" className="text-blue-600 font-bold text-lg">AEOlab</Link>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">이용약관</h1>
          <p className="text-sm text-gray-400 mb-8">최종 업데이트: 2026년 7월 16일</p>

          <div className="prose prose-sm text-gray-700 space-y-6">
            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-2">제1조 (목적)</h2>
              <p>본 약관은 AEOlab(이하 "서비스")이 제공하는 AI 검색 노출 분석 서비스의 이용 조건 및 절차, 이용자와 서비스 간의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.</p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-2">제2조 (서비스의 내용)</h2>
              <p>서비스는 다음과 같은 기능을 제공합니다.</p>
              <ul className="list-disc list-inside space-y-1 mt-2">
                <li>AI 검색 플랫폼(Gemini, ChatGPT, Perplexity 등)에서의 사업장 노출 현황 분석</li>
                <li>AI Visibility Score 산출 및 경쟁사 비교</li>
                <li>AI 노출 개선 가이드 제공</li>
                <li>Schema JSON-LD 자동 생성</li>
                <li>Before/After 스크린샷 히스토리 관리</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-2">제3조 (회원가입 및 계정)</h2>
              <p>이용자는 이메일과 비밀번호를 통해 회원가입할 수 있으며, 가입 시 이메일 인증이 필요합니다. 이용자는 자신의 계정 정보를 안전하게 관리할 의무가 있습니다.</p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-2">제4조 (구독 및 결제)</h2>
              <p>유료 플랜은 월정액 자동결제 방식으로 운영됩니다. 결제는 토스페이먼츠를 통해 처리되며, 구독 해지 시 다음 결제일까지 서비스를 이용할 수 있습니다.</p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-2">제5조 (환불 정책)</h2>
              <p>결제 후 7일 이내 서비스를 이용하지 않은 경우 전액 환불이 가능합니다. 이용 이력이 있는 경우 환불이 제한될 수 있습니다. 자세한 사항은 고객센터로 문의해주세요.</p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-2">제6조 (서비스 제한)</h2>
              <p>다음의 경우 서비스 이용이 제한될 수 있습니다.</p>
              <ul className="list-disc list-inside space-y-1 mt-2">
                <li>타인의 사업장 정보를 무단으로 등록하는 경우</li>
                <li>서비스의 정상적인 운영을 방해하는 경우</li>
                <li>관계 법령을 위반하는 경우</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-2">제7조 (면책사항)</h2>
              <p>서비스는 AI 검색 플랫폼의 정책 변경, 서버 장애 등 불가항력적 사유로 인한 서비스 중단에 대해 책임을 지지 않습니다. AI 스캔 결과는 참고용이며 실제 노출 결과와 다를 수 있습니다.</p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-2">제8조 (약관 변경)</h2>
              <p>서비스는 약관을 변경할 수 있으며, 변경 시 이메일 또는 서비스 내 공지를 통해 7일 전에 안내합니다.</p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-2">제9조 (준거법)</h2>
              <p>본 약관은 대한민국 법률에 따라 해석되며, 분쟁 발생 시 서울중앙지방법원을 관할 법원으로 합니다.</p>
            </section>
          </div>
        </div>

        <p className="text-center text-sm text-gray-400 mt-6">
          문의: <a href="mailto:help@aeolab.co.kr" className="text-blue-500 hover:underline">help@aeolab.co.kr</a>
        </p>
      </div>
    </main>
  )
}
