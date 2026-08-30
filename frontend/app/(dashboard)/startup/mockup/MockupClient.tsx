"use client";
import { useState } from "react";
import { StartupReportView, type StartupReport } from "../StartupReportView";

// 실제 API 호출 없이 결과 화면 레이아웃만 확인하기 위한 목업 시나리오 3종.
// 실제 서비스에서 나올 수 있는 상태 분기(0건/표본부족/충분)를 그대로 반영 — 화면 확인 후 삭제하거나
// 관리자 전용으로만 남겨둘 것. 실사용자에게는 절대 노출 금지(CLAUDE.md 실측 데이터 원칙).
const SCENARIOS: Record<string, StartupReport> = {
  no_data: {
    category: "cafe",
    region: "서울 강남",
    competitor_count: 0,
    avg_competitor_score: 0,
    competition_level: "데이터 수집 중",
    competition_level_color: "gray",
    competition_level_score: 0,
    is_estimated: true,
    top_competitors: [],
    timing: {
      timing_label: "데이터 수집 중",
      timing_color: "gray",
      opportunity_score: 50,
      reasoning: "서울 강남 카페 업종의 등록 사업장 데이터가 아직 없습니다. 서비스 이용자가 늘면 더 정확한 분석이 가능합니다.",
      is_estimated: true,
    },
    real_market: {
      available: true,
      total_count: 812,
      samples: [
        { name: "강남 로스터리", address: "서울 강남구 논현동 123-4", naver_place_url: "https://map.naver.com/v5/entry/place/1111111" },
        { name: "청담 브런치카페", address: "서울 강남구 청담동 45-6", naver_place_url: "" },
        { name: "역삼 스페셜티커피", address: "서울 강남구 역삼동 78-9", naver_place_url: "https://map.naver.com/v5/entry/place/2222222" },
      ],
    },
    strategy: {
      entry_strategy: "AEOlab에 등록된 경쟁 사업장은 없지만, 카카오맵 실측 기준 이 지역엔 이미 800개 이상의 카페가 있어 실제로는 경쟁이 매우 치열한 상권입니다. 스마트플레이스 완성도와 리뷰 관리가 AI 검색 노출의 기본입니다. 개업 초기부터 사업장 정보를 꾸준히 등록·관리하면 AI 검색 노출을 선점할 수 있습니다.",
      key_actions: [
        "네이버 스마트플레이스에 메뉴·영업시간·사진을 빠짐없이 등록",
        "개업 초기 리뷰 확보를 위한 오픈 이벤트 기획",
        "블로그 리뷰 유입을 위한 인플루언서·체험단 협업 검토",
      ],
      ai_optimization_tips: [
        "가게 소개글에 지역명+업종 키워드를 자연스럽게 포함",
        "톡톡 채팅방 메뉴를 활용해 자주 묻는 질문에 미리 답변 등록",
        "정기적인 스캔으로 AI 노출 변화를 추적하며 개선",
      ],
      risk_factors: [
        "데이터가 부족한 상태에서 섣불리 '경쟁이 없다'고 판단하지 말 것",
        "실제 상권 조사(유동인구·임대료 등)는 별도로 필요",
      ],
      estimated_time_to_visibility: "2~4주 (AEOlab 등록 후 기준)",
    },
    search_trend: { available: false, trend_direction: "stable", trend_delta: 0, trend_data: [], keywords_used: [] },
  },
  estimated: {
    category: "restaurant",
    region: "부산 해운대",
    competitor_count: 2,
    avg_competitor_score: 38.5,
    competition_level: "보통",
    competition_level_color: "yellow",
    competition_level_score: 3,
    is_estimated: true,
    top_competitors: [
      { name: "해운대 맛집 A", score: 45, exposure_freq: 18 },
      { name: "해운대 맛집 B", score: 32, exposure_freq: 6 },
    ],
    timing: {
      timing_label: "기회 있음 — 선점 가능",
      timing_color: "emerald",
      opportunity_score: 85,
      reasoning: "부산 해운대 음식점 업종에 등록된 경쟁 사업장이 2개로 매우 적습니다. 지금 시작하면 AI 노출을 선점할 수 있습니다.",
      is_estimated: true,
    },
    real_market: {
      available: true,
      total_count: 214,
      samples: [
        { name: "해운대 조개구이", address: "부산 해운대구 중동 12-3", naver_place_url: "https://map.naver.com/v5/entry/place/3333333" },
        { name: "달맞이 이자카야", address: "부산 해운대구 중동 55-1", naver_place_url: "" },
      ],
    },
    strategy: {
      entry_strategy: "등록 경쟁사가 2곳뿐이라 표본은 적지만, 두 곳 모두 AI 노출 수준이 낮아 스마트플레이스 완성도와 리뷰 품질에서 우위를 점하기 쉬운 상황입니다. 개업 초기 3개월 내 집중 투자로 지역 대표 노출을 노려볼 만합니다.",
      key_actions: [
        "경쟁사 대비 리뷰 응답률·최신성에서 차별화",
        "네이버 예약·주문 기능 활성화로 스마트플레이스 완성도 확보",
        "지역 특화 키워드(해운대+업종)로 블로그 콘텐츠 발행",
      ],
      ai_optimization_tips: [
        "AI 브리핑 노출 대상 업종이므로 스마트플레이스 완성도를 최우선으로 관리",
        "리뷰 최신성 유지를 위해 월 단위 리뷰 확보 목표 설정",
        "경쟁사 노출 빈도(가끔 노출)를 뛰어넘는 것을 단기 목표로 설정",
      ],
      risk_factors: [
        "표본이 2곳뿐이라 시장 전체 경쟁 강도를 완전히 대변하지 않음",
        "실제 상권의 비가입 경쟁사는 이 분석에 포함되지 않음",
      ],
      estimated_time_to_visibility: "1~2개월 (AI 브리핑 플레이스형 대상 업종 기준)",
    },
    search_trend: {
      available: true,
      trend_direction: "rising",
      trend_delta: 12.4,
      trend_data: [
        { period: "6월", ratio: 62 },
        { period: "7월", ratio: 70 },
        { period: "8월", ratio: 78 },
      ],
      keywords_used: ["해운대 맛집", "해운대 음식점"],
    },
  },
  full: {
    category: "beauty",
    region: "대구 수성구",
    competitor_count: 14,
    avg_competitor_score: 61.2,
    competition_level: "치열",
    competition_level_color: "orange",
    competition_level_score: 2,
    is_estimated: false,
    top_competitors: [
      { name: "수성 뷰티샵 A", score: 74, exposure_freq: 42 },
      { name: "수성 뷰티샵 B", score: 68, exposure_freq: 35 },
      { name: "수성 뷰티샵 C", score: 63, exposure_freq: 22 },
      { name: "수성 뷰티샵 D", score: 55, exposure_freq: 14 },
      { name: "수성 뷰티샵 E", score: 49, exposure_freq: 8 },
    ],
    timing: {
      timing_label: "안정적 — 꾸준한 성장 가능",
      timing_color: "blue",
      opportunity_score: 60,
      reasoning: "대구 수성구 미용 업종은 안정적인 시장입니다. 평균적인 AI 노출 수준이며 꾸준한 관리로 경쟁력을 높일 수 있습니다.",
      is_estimated: false,
    },
    strategy: {
      entry_strategy: "이미 14곳의 경쟁사가 등록돼 있고 평균 노출 수준도 높은 편이라, 진입 초기부터 명확한 차별화 포인트(전문 시술·가격대·타깃 고객층)가 필요합니다. 상위 경쟁사들은 노출 빈도가 높으므로 틈새 키워드 전략이 유효합니다.",
      key_actions: [
        "상위 경쟁사가 다루지 않는 세부 시술 키워드로 차별화",
        "리뷰 감정 분석으로 경쟁사 약점(가격·대기시간 등) 파악 후 보완",
        "예약 전환율을 높이는 스마트플레이스 소개글 개선",
      ],
      ai_optimization_tips: [
        "이 업종은 AI 브리핑(플레이스형) 확대 예정 업종 — 스마트플레이스 완성도를 지금부터 준비",
        "블로그 C-rank 확보를 위한 시술 후기 콘텐츠 축적",
        "경쟁사 대비 리뷰 최신성에서 우위 확보",
      ],
      risk_factors: [
        "경쟁 강도가 높아 초기 3~6개월은 가시적 성과가 늦을 수 있음",
        "가격 경쟁만으로는 차별화가 어려움 — 전문성 어필 필요",
      ],
      estimated_time_to_visibility: "3~6개월 (경쟁 밀집 업종 기준)",
    },
    search_trend: {
      available: true,
      trend_direction: "stable",
      trend_delta: 1.8,
      trend_data: [
        { period: "6월", ratio: 55 },
        { period: "7월", ratio: 56 },
        { period: "8월", ratio: 56 },
      ],
      keywords_used: ["수성구 미용실", "수성구 헤어샵"],
    },
  },
};

const SCENARIO_LABELS: Record<string, string> = {
  no_data: "① 등록 사업장 0건",
  estimated: "② 표본 적음 (추정치)",
  full: "③ 표본 충분",
};

export function MockupClient() {
  const [scenario, setScenario] = useState<keyof typeof SCENARIOS>("estimated");

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 mb-6">
        <p className="text-sm font-bold text-amber-800 mb-1">⚠ 목업 페이지 — 실제 데이터 아님</p>
        <p className="text-sm text-amber-700 leading-relaxed">
          화면 레이아웃 확인 전용입니다. 아래 수치·문구는 모두 가상 예시이며, 실제 스캔·Claude AI 호출 없이 하드코딩된 값입니다.
          관리자 계정에서만 접근 가능합니다.
        </p>
      </div>

      <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">창업 시장 분석 (목업)</h1>
      <p className="text-sm text-gray-500 mb-4">아래 버튼으로 시나리오별 결과 화면을 확인하세요.</p>

      <div className="flex flex-wrap gap-2 mb-6">
        {Object.keys(SCENARIOS).map((key) => (
          <button
            key={key}
            onClick={() => setScenario(key)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-colors min-h-[44px] ${
              scenario === key
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
            }`}
          >
            {SCENARIO_LABELS[key]}
          </button>
        ))}
      </div>

      <StartupReportView report={SCENARIOS[scenario]} />
    </div>
  );
}
