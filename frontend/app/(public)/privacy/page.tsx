import Link from "next/link";

export const metadata = {
  title: "개인정보처리방침 | AEOlab",
  description: "AEOlab 개인정보처리방침",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* 상단 네비게이션 */}
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-6"
        >
          ← 돌아가기
        </Link>

        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
          개인정보처리방침
        </h1>
        <p className="text-sm text-gray-500 mb-8">시행일: 2026년 4월 1일</p>

        <div className="prose prose-gray max-w-none space-y-8 text-sm md:text-base leading-relaxed text-gray-700">

          <section>
            <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-3">1. 개인정보의 처리 목적</h2>
            <p className="mb-2">AEOlab(이하 &ldquo;회사&rdquo;)은 다음의 목적을 위하여 개인정보를 처리합니다.</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>회원 가입 및 관리: 회원 식별, 서비스 이용 관리, 본인 확인</li>
              <li>서비스 제공: AI 검색 노출 분석, 경쟁사 비교, 개선 가이드 생성</li>
              <li>결제 처리: 구독 요금 청구 및 자동결제 관리</li>
              <li>알림 발송: 스캔 결과 알림, 구독 만료 안내 등 카카오 알림톡 발송</li>
              <li>고객 지원: 문의 응대 및 불편 사항 처리</li>
              <li>서비스 개선: 이용 현황 분석 및 서비스 품질 향상</li>
              <li>통계 분석 및 공개 리포트: 개인을 특정할 수 없도록 익명화·집계된 AI 검색 노출 통계를 업종별·지역별 공개 인덱스 리포트 형태로 활용 (5건 미만 집계 단위는 공개하지 않음)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-3">2. 처리하는 개인정보의 항목</h2>
            <div className="space-y-4">
              <div>
                <p className="font-medium text-gray-800 mb-1">필수 항목</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>이메일 주소 (로그인 ID)</li>
                  <li>사업장명, 사업 카테고리, 운영 지역</li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-gray-800 mb-1">선택 항목</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>전화번호 (카카오 알림톡 수신용)</li>
                  <li>사업장 웹사이트 URL</li>
                  <li>Google Place ID, 카카오 Place ID</li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-gray-800 mb-1">자동 수집 항목</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>서비스 이용 기록, 접속 로그</li>
                  <li>IP 주소 (무료 체험 스캔 횟수 제한용, 해시 처리 후 저장)</li>
                  <li>결제 수단 정보 (카드 번호 제외, 빌링키 형태로 토스페이먼츠 위탁 저장)</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-3">3. 개인정보의 처리 및 보유 기간</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>회원 정보: 회원 탈퇴 후 30일까지 (이후 즉시 파기)</li>
              <li>결제 정보: 관련 법령에 따라 5년 보관 (전자상거래법)</li>
              <li>스캔 결과 및 분석 데이터: 회원 탈퇴 후 30일까지</li>
              <li>로그인 기록: 3개월</li>
              <li>IP 해시 (무료 체험): 24시간 후 자동 삭제</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-3">4. 개인정보의 제3자 제공</h2>
            <p className="mb-2">회사는 원칙적으로 이용자의 개인정보를 외부에 제공하지 않습니다. 다만, 다음의 경우는 예외입니다.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse border border-gray-200 min-w-[400px]">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-200 px-3 py-2 text-left font-medium">제공받는 자</th>
                    <th className="border border-gray-200 px-3 py-2 text-left font-medium">제공 목적</th>
                    <th className="border border-gray-200 px-3 py-2 text-left font-medium">제공 항목</th>
                    <th className="border border-gray-200 px-3 py-2 text-left font-medium">보유 기간</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-200 px-3 py-2">카카오</td>
                    <td className="border border-gray-200 px-3 py-2">알림톡 발송</td>
                    <td className="border border-gray-200 px-3 py-2">전화번호</td>
                    <td className="border border-gray-200 px-3 py-2">발송 후 즉시 삭제</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="border border-gray-200 px-3 py-2">토스페이먼츠</td>
                    <td className="border border-gray-200 px-3 py-2">결제 처리</td>
                    <td className="border border-gray-200 px-3 py-2">이메일, 결제 정보</td>
                    <td className="border border-gray-200 px-3 py-2">5년 (법령 의거)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-3">5. 개인정보 처리 위탁</h2>
            <p className="mb-2">회사는 서비스 제공을 위해 다음과 같이 개인정보 처리 업무를 위탁합니다.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse border border-gray-200 min-w-[400px]">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-200 px-3 py-2 text-left font-medium">수탁 업체</th>
                    <th className="border border-gray-200 px-3 py-2 text-left font-medium">위탁 업무</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-200 px-3 py-2">Supabase Inc.</td>
                    <td className="border border-gray-200 px-3 py-2">데이터베이스 저장 및 인증 관리</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="border border-gray-200 px-3 py-2">iwinv (아이윈브이)</td>
                    <td className="border border-gray-200 px-3 py-2">서버 호스팅</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-200 px-3 py-2">토스페이먼츠</td>
                    <td className="border border-gray-200 px-3 py-2">결제 처리 및 빌링키 관리</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-3">6. 정보주체의 권리·의무 및 행사 방법</h2>
            <p className="mb-2">이용자는 언제든지 다음의 권리를 행사할 수 있습니다.</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>열람 요청:</strong> 본인의 개인정보 처리 현황 확인</li>
              <li><strong>수정 요청:</strong> 부정확한 개인정보의 정정</li>
              <li><strong>삭제 요청:</strong> 개인정보의 삭제 (단, 법령에 따른 보존 의무가 있는 경우 제외)</li>
              <li><strong>처리 정지 요청:</strong> 개인정보 처리의 일시 정지</li>
            </ul>
            <p className="mt-3">
              권리 행사는 서비스 내 &ldquo;설정&rdquo; 페이지에서 직접 하시거나,{" "}
              <a href="mailto:hoozdev@gmail.com" className="text-blue-600 hover:underline">hoozdev@gmail.com</a>으로
              이메일 요청 시 10일 이내 처리합니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-3">7. 개인정보의 파기</h2>
            <p className="mb-2">회사는 개인정보 보유 기간이 경과하거나 처리 목적이 달성된 경우 지체 없이 파기합니다.</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>전자적 파일:</strong> 복원 불가능한 방법으로 영구 삭제</li>
              <li><strong>서면 자료:</strong> 분쇄 또는 소각</li>
            </ul>
            <p className="mt-2">
              회원 탈퇴 신청 후 30일이 경과하면 모든 개인정보 및 서비스 데이터가 삭제됩니다.
              단, 법령에 따른 의무 보존 기간이 있는 결제 정보는 해당 기간 동안 분리 보관 후 파기됩니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-3">8. 개인정보 보호책임자</h2>
            <div className="bg-gray-50 rounded-lg p-4 space-y-1">
              <p><strong>성명:</strong> AEOlab 운영자</p>
              <p><strong>이메일:</strong> <a href="mailto:hoozdev@gmail.com" className="text-blue-600 hover:underline">hoozdev@gmail.com</a></p>
              <p className="text-sm text-gray-500 mt-2">
                개인정보 처리에 관한 문의, 불만, 피해 구제 등은 위 연락처로 문의해 주시기 바랍니다.
              </p>
            </div>
            <p className="mt-3 text-sm">
              또한 개인정보 침해 신고 및 상담은 아래 기관에 문의하실 수 있습니다.
            </p>
            <ul className="list-disc pl-5 mt-1 space-y-1 text-sm">
              <li>개인정보분쟁조정위원회: www.kopico.go.kr (1833-6972)</li>
              <li>개인정보침해신고센터: privacy.kisa.or.kr (118)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-3">9. 개인정보처리방침 변경</h2>
            <p>
              이 개인정보처리방침은 2026년 4월 1일부터 시행됩니다.
              내용 추가·삭제 또는 수정이 있을 경우에는 변경사항 시행 최소 7일 전 서비스 공지사항을 통해 고지합니다.
            </p>
          </section>

        </div>
      </div>
    </main>
  );
}
