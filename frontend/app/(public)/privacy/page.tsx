import Link from 'next/link'

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Link href="/" className="text-blue-600 font-bold text-lg">AEOlab</Link>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">개인정보처리방침</h1>
          <p className="text-sm text-gray-400 mb-8">최종 업데이트: 2026년 7월 16일</p>

          <div className="prose prose-sm text-gray-700 space-y-6">
            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-2">1. 수집하는 개인정보</h2>
              <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-gray-600">항목</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-600">목적</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-600">보유기간</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="px-4 py-2">이메일</td>
                    <td className="px-4 py-2">회원 식별, 로그인</td>
                    <td className="px-4 py-2">회원 탈퇴 시까지</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2">사업장 정보 (상호명, 주소, 업종)</td>
                    <td className="px-4 py-2">AI 스캔 분석</td>
                    <td className="px-4 py-2">회원 탈퇴 시까지</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2">전화번호</td>
                    <td className="px-4 py-2">카카오 알림톡 발송</td>
                    <td className="px-4 py-2">동의 철회 시까지</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2">결제 정보 (빌링키)</td>
                    <td className="px-4 py-2">구독 자동결제</td>
                    <td className="px-4 py-2">구독 해지 후 5년</td>
                  </tr>
                </tbody>
              </table>
            </section>

            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-2">2. 개인정보의 처리 목적</h2>
              <ul className="list-disc list-inside space-y-1">
                <li>서비스 회원가입 및 관리</li>
                <li>AI 검색 노출 분석 서비스 제공</li>
                <li>구독 결제 및 정산</li>
                <li>서비스 이용 관련 알림 발송 (이메일, 카카오 알림톡)</li>
                <li>서비스 개선을 위한 통계 분석</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-2">3. 개인정보의 제3자 제공</h2>
              <p>서비스는 원칙적으로 이용자의 개인정보를 외부에 제공하지 않습니다. 단, 다음의 경우는 예외입니다.</p>
              <ul className="list-disc list-inside space-y-1 mt-2">
                <li>이용자가 사전에 동의한 경우</li>
                <li>법령의 규정에 의한 경우</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-2">4. 개인정보 처리 위탁</h2>
              <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-gray-600">수탁업체</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-600">위탁 업무</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="px-4 py-2">Supabase</td>
                    <td className="px-4 py-2">데이터베이스 및 인증 관리</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2">토스페이먼츠</td>
                    <td className="px-4 py-2">결제 처리</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2">카카오</td>
                    <td className="px-4 py-2">알림톡 발송</td>
                  </tr>
                </tbody>
              </table>
            </section>

            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-2">5. 이용자의 권리</h2>
              <p>이용자는 언제든지 다음의 권리를 행사할 수 있습니다.</p>
              <ul className="list-disc list-inside space-y-1 mt-2">
                <li>개인정보 열람 요청</li>
                <li>개인정보 정정·삭제 요청</li>
                <li>개인정보 처리 정지 요청</li>
                <li>회원 탈퇴 (설정 페이지에서 직접 처리)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-2">6. 개인정보 보호책임자</h2>
              <p>개인정보 관련 문의는 아래로 연락해주세요.</p>
              <div className="mt-2 bg-gray-50 rounded-lg p-3 text-sm">
                <p>이메일: <a href="mailto:privacy@aeolab.co.kr" className="text-blue-500 hover:underline">privacy@aeolab.co.kr</a></p>
              </div>
            </section>

            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-2">7. 개인정보처리방침 변경</h2>
              <p>본 방침은 법령 또는 서비스 변경에 따라 개정될 수 있으며, 변경 시 서비스 내 공지 및 이메일로 안내합니다.</p>
            </section>
          </div>
        </div>

        <p className="text-center text-sm text-gray-400 mt-6">
          문의: <a href="mailto:privacy@aeolab.co.kr" className="text-blue-500 hover:underline">privacy@aeolab.co.kr</a>
        </p>
      </div>
    </main>
  )
}
