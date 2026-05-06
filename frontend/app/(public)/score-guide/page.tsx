import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "점수 계산 방식 | AEOlab",
  description:
    "AEOlab AI 가시성 점수가 어떻게 계산되는지 알아보세요. 업종별 네이버/글로벌 AI 비율, 6개 세부 항목, 등급 기준을 설명합니다.",
};

export default function ScoreGuidePage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* 1. 헤더 */}
      <div className="mb-6">
        <div className="flex items-center justify-between gap-2 flex-wrap mb-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-blue-500 hover:text-blue-700 hover:underline"
          >
            ← 홈으로 돌아가기
          </Link>
          <Link
            href="/how-it-works"
            className="inline-flex items-center gap-1 text-sm md:text-base text-blue-600 hover:underline font-medium"
          >
            전체 동작 원리 매뉴얼 →
          </Link>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mt-2">
          AEOlab AI 가시성 점수란?
        </h1>
      </div>

      {/* 2. 30초 핵심 요약 — 이탈 전 반드시 읽히는 카드 */}
      <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200 rounded-2xl p-5 mb-4">
        <p className="text-sm font-bold text-indigo-700 uppercase tracking-wide mb-3">⚡ 30초 핵심 요약</p>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <span className="shrink-0 w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">1</span>
            <p className="text-sm md:text-base text-gray-800 leading-relaxed">
              <strong>점수 = 네이버 채널 × 업종 비율 + 글로벌 AI × 업종 비율</strong><br />
              <span className="text-gray-500">음식점·카페는 네이버 70%, 법률·교육·온라인몰은 글로벌 AI 60~90%</span>
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="shrink-0 w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">2</span>
            <p className="text-sm md:text-base text-gray-800 leading-relaxed">
              <strong>성장 단계(시작/성장 중/빠른 성장/지역 1등)는 네이버 채널 점수만으로 결정</strong><br />
              <span className="text-gray-500">통합 점수와 다를 수 있음 — 업종별 비율 차이를 보정하기 위해</span>
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="shrink-0 w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">3</span>
            <p className="text-sm md:text-base text-gray-800 leading-relaxed">
              <strong>지금 가장 빠른 점수 향상 → 스마트플레이스 소개글 + 소식 탭</strong><br />
              <span className="text-gray-500">두 항목만 완성해도 최대 +45점 가능 (소식 25점 + 소개글 20점)</span>
            </p>
          </div>
        </div>
        <p className="text-xs text-indigo-400 mt-4">아래 전체 설명은 더 자세히 알고 싶은 분을 위한 내용입니다.</p>
      </div>

      {/* 3. 개요 카드 */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
        <p className="text-sm md:text-base text-gray-700 leading-relaxed">
          AI가 가게를 추천할 때 얼마나 잘 준비돼 있는지를{" "}
          <strong>0~100점</strong>으로 측정합니다. 점수가 높을수록 네이버 AI
          브리핑·ChatGPT·Google AI에 가게 이름이 더 자주 노출됩니다.
        </p>
      </div>

      {/* v3.1 안내 박스 (향후 적용 예정) */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 md:p-5 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <h2 className="text-base md:text-lg font-bold text-amber-900">
            v3.1 점수 모델 — 향후 적용 예정
          </h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-200 text-amber-800 font-medium">
            베타 5명+ 측정 후 활성화
          </span>
        </div>
        <p className="text-sm md:text-base text-amber-800 leading-relaxed mb-2">
          업종 그룹(네이버 브리핑 대상 / 확대 예정 / 글로벌 AI 중심)에 따라 Track1 6항목의 비중을 자동 재분배합니다.
          AI 브리핑 비대상 업종(예: 학원·법무)이라도 점수상 불이익이 없도록 키워드 검색·스마트플레이스 비중을 자동 상향합니다.
          현재는 v3.0 기준(아래 표)이 적용 중입니다.
        </p>
        <p className="text-sm md:text-base text-amber-700 leading-relaxed">
          v3.1 상세 가중치 표:{" "}
          <a href="/how-it-works#step2" className="underline font-medium">매뉴얼 §2단계</a> 참고.
        </p>
      </div>

      {/* 3. 통합 점수 계산 방식 */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 mb-4">
        <h2 className="text-base md:text-lg font-bold text-blue-900 mb-3">
          통합 점수 계산 방식
        </h2>
        <div className="bg-white rounded-xl border border-blue-100 p-4 mb-3">
          <p className="text-sm md:text-base font-mono text-blue-800 text-center leading-relaxed">
            통합 점수 ={" "}
            <span className="font-bold">네이버 AI 채널 점수</span> × 업종 비율%
            <br />+ <span className="font-bold">글로벌 AI 채널 점수</span> ×
            업종 비율%
          </p>
        </div>
        <p className="text-sm md:text-base text-blue-700 leading-relaxed">
          업종에 따라 네이버와 글로벌 AI 채널의 비중이 다릅니다. 즉시 방문이
          많은 음식점·카페는 네이버 비중이 높고, 교육·법률·온라인몰은 글로벌 AI
          비중이 높습니다.
        </p>
      </div>

      {/* 4. Track 1 — 네이버 AI 채널 */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <h2 className="text-base md:text-lg font-bold text-gray-900">
            Track 1 — 네이버 AI 채널
          </h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
            현재 적용 중 (v3.0)
          </span>
        </div>
        <p className="text-sm text-gray-500 mb-3">
          네이버 생태계 내 AI 검색 최적화 지표 (5개 항목)
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[480px]">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left py-2.5 px-3 font-semibold text-gray-700 border-b border-gray-200">
                  항목
                </th>
                <th className="text-center py-2.5 px-3 font-semibold text-gray-700 border-b border-gray-200 w-16">
                  비중
                </th>
                <th className="text-left py-2.5 px-3 font-semibold text-gray-700 border-b border-gray-200">
                  설명
                </th>
              </tr>
            </thead>
            <tbody>
              {[
                {
                  item: "키워드 커버리지",
                  weight: "35%",
                  desc: "리뷰·블로그에서 업종 핵심 키워드가 얼마나 언급됐는지",
                },
                {
                  item: "리뷰 품질",
                  weight: "25%",
                  desc: "리뷰 수·평점·최신성·키워드 다양성",
                },
                {
                  item: "스마트플레이스 완성도",
                  weight: "15%",
                  desc: "FAQ·소개글·소식·부가정보 완성도",
                },
                {
                  item: "네이버 AI 브리핑 노출",
                  weight: "15%",
                  desc: "실제 네이버 AI 브리핑에 가게가 인용됐는지",
                },
                {
                  item: "카카오맵 완성도",
                  weight: "10%",
                  desc: "카카오맵 정보 완성도 (사용자 체크리스트 기반)",
                },
              ].map((row, i) => (
                <tr
                  key={i}
                  className="border-b border-gray-100 last:border-0 hover:bg-gray-50"
                >
                  <td className="py-2.5 px-3 font-medium text-gray-800">
                    {row.item}
                  </td>
                  <td className="py-2.5 px-3 text-center font-bold text-blue-600">
                    {row.weight}
                  </td>
                  <td className="py-2.5 px-3 text-gray-600">{row.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4-1. Track 1 v3.1 예정 가중치 표 */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-4">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <h2 className="text-base md:text-lg font-bold text-amber-900">
            Track 1 — 그룹별 가중치 (v3.1 활성화 시 적용 예정)
          </h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-200 text-amber-800 font-medium">
            현재 미적용
          </span>
        </div>
        <p className="text-sm text-amber-700 mb-3">
          베타 사용자 5명+ 측정 데이터 확보 후 활성화. 환경변수 <code className="bg-amber-100 px-1 rounded text-xs">SCORE_MODEL_VERSION=v3_1</code> 로 토글.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[520px]">
            <thead>
              <tr className="bg-amber-100">
                <th className="text-left py-2.5 px-3 font-semibold text-amber-900 border-b border-amber-200">항목</th>
                <th className="text-center py-2.5 px-3 font-semibold text-amber-900 border-b border-amber-200 w-20">네이버 대상</th>
                <th className="text-center py-2.5 px-3 font-semibold text-amber-900 border-b border-amber-200 w-20">확대 예정</th>
                <th className="text-center py-2.5 px-3 font-semibold text-amber-900 border-b border-amber-200 w-24">글로벌 중심</th>
              </tr>
            </thead>
            <tbody>
              {[
                { item: "키워드 순위", active: "25%", likely: "30%", inactive: "35%" },
                { item: "리뷰 품질",   active: "15%", likely: "17%", inactive: "20%" },
                { item: "스마트플레이스 완성도", active: "15%", likely: "18%", inactive: "20%" },
                { item: "카카오맵 완성도",      active: "10%", likely: "10%", inactive: "10%" },
                { item: "블로그 크랭크",        active: "10%", likely: "10%", inactive: "15%" },
                { item: "AI 브리핑 노출",       active: "25%", likely: "15%", inactive: "0%" },
              ].map((row, i) => (
                <tr key={i} className="border-b border-amber-100 last:border-0 hover:bg-amber-50/60">
                  <td className="py-2.5 px-3 font-medium text-gray-800">{row.item}</td>
                  <td className="py-2.5 px-3 text-center font-bold text-green-700">{row.active}</td>
                  <td className="py-2.5 px-3 text-center font-bold text-blue-700">{row.likely}</td>
                  <td className="py-2.5 px-3 text-center font-bold text-gray-600">{row.inactive}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-amber-600 mt-2">네이버 대상: 음식점·카페·베이커리·바·숙박 / 확대 예정: 뷰티·네일·피트니스·요가·반려동물·약국 / 글로벌 중심: 그 외</p>
      </div>

      {/* 5. Track 2 — 글로벌 AI 채널 */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
        <h2 className="text-base md:text-lg font-bold text-gray-900 mb-1">
          Track 2 — 글로벌 AI 채널
        </h2>
        <p className="text-sm text-gray-500 mb-3">
          ChatGPT·Gemini·Google AI 등 글로벌 AI 검색 최적화 지표 (4개 항목)
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[480px]">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left py-2.5 px-3 font-semibold text-gray-700 border-b border-gray-200">
                  항목
                </th>
                <th className="text-center py-2.5 px-3 font-semibold text-gray-700 border-b border-gray-200 w-16">
                  비중
                </th>
                <th className="text-left py-2.5 px-3 font-semibold text-gray-700 border-b border-gray-200">
                  설명
                </th>
              </tr>
            </thead>
            <tbody>
              {[
                {
                  item: "AI 노출 빈도",
                  weight: "40%",
                  desc: "Gemini·ChatGPT 각 50회 (총 100회) + Google AI 반복 측정",
                },
                {
                  item: "웹사이트 SEO",
                  weight: "30%",
                  desc: "JSON-LD 구조화 데이터 + Open Graph + 웹사이트 최적화",
                },
                {
                  item: "온라인 언급",
                  weight: "20%",
                  desc: "네이버 블로그·뉴스·미디어 언급 수",
                },
                {
                  item: "Google AI Overview",
                  weight: "10%",
                  desc: "구글 AI 검색 결과 노출 여부",
                },
              ].map((row, i) => (
                <tr
                  key={i}
                  className="border-b border-gray-100 last:border-0 hover:bg-gray-50"
                >
                  <td className="py-2.5 px-3 font-medium text-gray-800">
                    {row.item}
                  </td>
                  <td className="py-2.5 px-3 text-center font-bold text-purple-600">
                    {row.weight}
                  </td>
                  <td className="py-2.5 px-3 text-gray-600">{row.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. 업종별 네이버/글로벌 비율 */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
        <h2 className="text-base md:text-lg font-bold text-gray-900 mb-1">
          업종별 네이버 / 글로벌 비율
        </h2>
        <p className="text-sm text-gray-500 mb-3">
          업종 특성에 따라 두 채널의 가중치가 다르게 적용됩니다.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[480px]">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left py-2.5 px-3 font-semibold text-gray-700 border-b border-gray-200">
                  업종
                </th>
                <th className="text-center py-2.5 px-3 font-semibold text-blue-600 border-b border-gray-200 w-20">
                  네이버
                </th>
                <th className="text-center py-2.5 px-3 font-semibold text-purple-600 border-b border-gray-200 w-20">
                  글로벌
                </th>
                <th className="text-left py-2.5 px-3 font-semibold text-gray-700 border-b border-gray-200">
                  이유
                </th>
              </tr>
            </thead>
            <tbody>
              {[
                {
                  category: "음식점",
                  naver: 70,
                  global: 30,
                  reason: "즉시방문형, 30~50대 고객",
                  naverDominant: true,
                },
                {
                  category: "카페",
                  naver: 65,
                  global: 35,
                  reason: "분위기 탐색 AI 증가",
                  naverDominant: true,
                },
                {
                  category: "뷰티·미용·네일",
                  naver: 65,
                  global: 35,
                  reason: "당일예약 네이버, 전문시술 AI 리서치",
                  naverDominant: true,
                },
                {
                  category: "약국",
                  naver: 70,
                  global: 30,
                  reason: "지역 기반 즉시방문형",
                  naverDominant: true,
                },
                {
                  category: "헬스·필라테스·요가",
                  naver: 60,
                  global: 40,
                  reason: "10~20대 고객 비중 높음",
                  naverDominant: true,
                },
                {
                  category: "반려동물",
                  naver: 65,
                  global: 35,
                  reason: "동물병원·펫샵 AI 검색 증가",
                  naverDominant: true,
                },
                {
                  category: "의원·병원·치과",
                  naver: 55,
                  global: 45,
                  reason: "증상 검색 = ChatGPT 비중 증가",
                  naverDominant: true,
                },
                {
                  category: "인테리어",
                  naver: 55,
                  global: 45,
                  reason: "포트폴리오 탐색 AI 비중 증가",
                  naverDominant: true,
                },
                {
                  category: "부동산",
                  naver: 65,
                  global: 35,
                  reason: "지역·매물 검색 네이버 강세",
                  naverDominant: true,
                },
                {
                  category: "자동차 정비",
                  naver: 65,
                  global: 35,
                  reason: "지역 + 차종 검색 네이버 강세",
                  naverDominant: true,
                },
                {
                  category: "사진·영상 스튜디오",
                  naver: 65,
                  global: 35,
                  reason: "지역 기반 네이버 강세",
                  naverDominant: true,
                },
                {
                  category: "교육·학원",
                  naver: 40,
                  global: 60,
                  reason: "10대 AI 네이티브 세대",
                  naverDominant: false,
                },
                {
                  category: "법률·세무·회계",
                  naver: 20,
                  global: 80,
                  reason: "ChatGPT·Gemini 주전장",
                  naverDominant: false,
                },
                {
                  category: "쇼핑·패션·온라인몰",
                  naver: 10,
                  global: 90,
                  reason: "온라인 = 글로벌 AI 압도적",
                  naverDominant: false,
                },
                {
                  category: "숙박·청소·기타",
                  naver: 60,
                  global: 40,
                  reason: "기본값",
                  naverDominant: true,
                },
              ].map((row, i) => (
                <tr
                  key={i}
                  className="border-b border-gray-100 last:border-0 hover:bg-gray-50"
                >
                  <td className="py-2.5 px-3 font-medium text-gray-800">
                    {row.category}
                  </td>
                  <td
                    className={`py-2.5 px-3 text-center font-bold ${
                      row.naverDominant ? "text-blue-600" : "text-gray-400"
                    }`}
                  >
                    {row.naver}%
                  </td>
                  <td
                    className={`py-2.5 px-3 text-center font-bold ${
                      !row.naverDominant ? "text-purple-600" : "text-gray-400"
                    }`}
                  >
                    {row.global}%
                  </td>
                  <td className="py-2.5 px-3 text-gray-500">{row.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 7. 등급 기준 */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
        <h2 className="text-base md:text-lg font-bold text-gray-900 mb-3">
          등급 기준
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
          {[
            {
              grade: "A",
              range: "80점 이상",
              label: "AI 검색 최상위 노출",
              rank: "상위 20%",
              bg: "bg-emerald-50 border-emerald-200",
              textGrade: "text-emerald-700",
              textRange: "text-emerald-600",
            },
            {
              grade: "B",
              range: "60~79점",
              label: "AI 검색 양호",
              rank: "상위 40%",
              bg: "bg-blue-50 border-blue-200",
              textGrade: "text-blue-700",
              textRange: "text-blue-600",
            },
            {
              grade: "C",
              range: "40~59점",
              label: "AI 검색 개선 필요",
              rank: "중간 40%",
              bg: "bg-amber-50 border-amber-200",
              textGrade: "text-amber-700",
              textRange: "text-amber-600",
            },
            {
              grade: "D",
              range: "20~39점",
              label: "AI 검색 미흡",
              rank: "하위 20%",
              bg: "bg-orange-50 border-orange-200",
              textGrade: "text-orange-700",
              textRange: "text-orange-600",
            },
            {
              grade: "F",
              range: "20점 미만",
              label: "AI 검색 거의 불가",
              rank: "최하위",
              bg: "bg-red-50 border-red-200",
              textGrade: "text-red-700",
              textRange: "text-red-600",
            },
          ].map((g, i) => (
            <div
              key={i}
              className={`rounded-xl border p-4 text-center ${g.bg}`}
            >
              <div className={`text-3xl font-black mb-1 ${g.textGrade}`}>
                {g.grade}
              </div>
              <div className={`text-sm font-bold mb-1 ${g.textRange}`}>
                {g.range}
              </div>
              <div className="text-xs text-gray-600 mb-1">{g.label}</div>
              <div className="text-xs text-gray-400">{g.rank}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 8. 성장 단계 */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
        <h2 className="text-base md:text-lg font-bold text-gray-900 mb-1">
          성장 단계
        </h2>
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 mb-4">
          <p className="text-sm text-amber-800">
            <strong>주의:</strong> 성장 단계는 통합 점수가 아닌{" "}
            <strong>네이버 AI 채널 점수(Track 1) 기준</strong>으로 결정됩니다.
            업종별 비율 차이로 인한 오판을 방지하기 위해서입니다.
          </p>
        </div>
        <div className="space-y-3">
          {[
            {
              stage: "시작 단계",
              range: "30점 미만",
              desc: "네이버 AI 채널 최적화 기초 작업이 필요합니다",
              color: "bg-red-100",
              textColor: "text-red-700",
              pct: 25,
              barColor: "bg-red-400",
            },
            {
              stage: "성장 중",
              range: "30~54점",
              desc: "기본 최적화가 시작됐습니다. 키워드와 리뷰를 강화하세요",
              color: "bg-amber-100",
              textColor: "text-amber-700",
              pct: 50,
              barColor: "bg-amber-400",
            },
            {
              stage: "빠른 성장",
              range: "55~74점",
              desc: "AI 브리핑 노출이 시작되는 구간입니다. 꾸준히 유지하세요",
              color: "bg-blue-100",
              textColor: "text-blue-700",
              pct: 75,
              barColor: "bg-blue-500",
            },
            {
              stage: "지역 1등",
              range: "75점 이상",
              desc: "지역 내 AI 검색 상위권입니다. 경쟁사와의 격차를 유지하세요",
              color: "bg-emerald-100",
              textColor: "text-emerald-700",
              pct: 100,
              barColor: "bg-emerald-500",
            },
          ].map((s, i) => (
            <div key={i} className={`rounded-xl p-4 ${s.color}`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-sm font-bold ${s.textColor}`}>
                  {s.stage}
                </span>
                <span className={`text-sm font-semibold ${s.textColor}`}>
                  {s.range}
                </span>
              </div>
              <div className="w-full bg-white/60 rounded-full h-2 mb-2">
                <div
                  className={`${s.barColor} h-2 rounded-full`}
                  style={{ width: `${s.pct}%` }}
                />
              </div>
              <p className="text-sm text-gray-700">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 9. 하단 CTA */}
      <div className="bg-blue-600 rounded-2xl p-6 text-center">
        <p className="text-base md:text-lg font-bold text-white mb-1">
          내 가게의 AI 가시성 점수가 궁금하신가요?
        </p>
        <p className="text-sm text-blue-200 mb-4">
          지금 바로 네이버·ChatGPT·Google AI 노출 현황을 확인하세요.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 bg-white text-blue-600 font-bold px-6 py-3 rounded-xl hover:bg-blue-50 transition-colors text-sm md:text-base"
        >
          지금 내 가게 점수 확인하기 →
        </Link>
      </div>
    </div>
  );
}
