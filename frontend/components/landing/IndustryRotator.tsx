"use client";

import { useState, useEffect } from "react";

interface Industry {
  emoji: string;
  label: string;
  query: string;
  keyword: string;
  result: string;
  chatgptAdvice: string;
  aeolabAnswer: string;
}

const INDUSTRIES: Industry[] = [
  {
    emoji: "☕",
    label: "카페 사장님",
    query: "'창원 브런치 카페 추천해줘'",
    keyword: "브런치·주차 가능·콘센트",
    result: "창원 내 카페 3~5곳을 추천하지만 내 가게가 나올지는 매번 달라요",
    chatgptAdvice: "리뷰 10개 확보, 정보형 블로그 작성, 구글지도 등록...",
    aeolabAnswer: "지역 내 경쟁사 5개 대비 \"브런치·콘센트\" 키워드 없음 → FAQ 문구 바로 생성",
  },
  {
    emoji: "🍽️",
    label: "식당 사장님",
    query: "'부산 서면 회식 장소 추천해줘'",
    keyword: "단체석·주차·한식",
    result: "서면 단체 식당을 추천하지만 내 가게 이름이 포함될지 알 수 없어요",
    chatgptAdvice: "스마트플레이스 완성, 키워드 포함 리뷰 유도...",
    aeolabAnswer: "지역 내 경쟁사 7개 대비 \"단체석·돌잔치\" 키워드 없음 → 소개글 수정 문구 제공",
  },
  {
    emoji: "✂️",
    label: "미용실 원장님",
    query: "'수원 영통 여성 헤어샵 추천해줘'",
    keyword: "여성 커트·염색·웨이브",
    result: "영통 헤어샵 목록을 나열하지만 내 샵이 거기 있을지 모르죠",
    chatgptAdvice: "블로그 정보형 글 5개, 맘카페 언급 확보...",
    aeolabAnswer: "지역 내 경쟁사 4개 대비 \"웨이브·탈색\" 키워드 없음 → 리뷰 유도 문구 생성",
  },
  {
    emoji: "💆",
    label: "피부관리실 원장님",
    query: "'분당 수내동 피부관리실 추천해줘'",
    keyword: "리프팅·모공·수분",
    result: "수내동 주변 피부샵을 추천하지만 내 샵의 실제 데이터는 없어요",
    chatgptAdvice: "인스타그램 등록, 카카오맵 정보 완성...",
    aeolabAnswer: "지역 내 경쟁사 6개 대비 \"리프팅·모공\" 키워드 없음 → 소개글 Q&A 문구 제공",
  },
  {
    emoji: "🏋️",
    label: "헬스장 사장님",
    query: "'서울 마포구 24시 헬스장 추천해줘'",
    keyword: "24시간·PT·개인 락커",
    result: "마포구 유명 체인을 먼저 추천하고 내 헬스장은 뒤로 밀려요",
    chatgptAdvice: "구글지도 등록, 지역 커뮤니티 언급 늘리기...",
    aeolabAnswer: "지역 내 경쟁사 8개 대비 \"24시간·여성전용\" 키워드 없음 → 소개글 수정 문구 제공",
  },
  {
    emoji: "🐾",
    label: "동물병원 원장님",
    query: "'인천 연수구 고양이 동물병원 추천해줘'",
    keyword: "고양이 전문·야간진료·예방접종",
    result: "연수구 동물병원 목록을 보여주지만 내 병원이 포함될지 몰라요",
    chatgptAdvice: "전문 키워드 강화, 정보형 블로그 작성...",
    aeolabAnswer: "지역 내 경쟁사 3개 대비 \"고양이 전문·야간진료\" 키워드 없음 → FAQ 문구 5개 자동 생성",
  },
  {
    emoji: "📚",
    label: "학원 원장님",
    query: "'대전 둔산동 초등수학 학원 추천해줘'",
    keyword: "초등·수학·소수정예",
    result: "둔산동 브랜드 학원이 먼저 나오고 내 학원은 노출이 안 돼요",
    chatgptAdvice: "지역 + 서비스 키워드 강화, 후기형 블로그...",
    aeolabAnswer: "지역 내 경쟁사 5개 대비 \"소수정예·개인맞춤\" 키워드 없음 → 소개글 문구 제공",
  },
  {
    emoji: "🦷",
    label: "치과 원장님",
    query: "'광주 상무지구 임플란트 치과 추천해줘'",
    keyword: "임플란트·야간진료·어린이치과",
    result: "상무지구 치과 광고성 답변만 나오고 내 치과 정보는 없어요",
    chatgptAdvice: "웹 전체 존재감 확보, 외부 언급 늘리기...",
    aeolabAnswer: "지역 내 경쟁사 9개 대비 \"야간진료·어린이\" 키워드 없음 → FAQ 문구 즉시 생성",
  },
];

export default function IndustryRotator() {
  const [current, setCurrent] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    setCurrent(Math.floor(Math.random() * INDUSTRIES.length));
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setCurrent((c) => (c + 1) % INDUSTRIES.length);
        setFade(true);
      }, 300);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const handlePrev = () => {
    setFade(false);
    setTimeout(() => {
      setCurrent((c) => (c - 1 + INDUSTRIES.length) % INDUSTRIES.length);
      setFade(true);
    }, 200);
  };

  const handleNext = () => {
    setFade(false);
    setTimeout(() => {
      setCurrent((c) => (c + 1) % INDUSTRIES.length);
      setFade(true);
    }, 200);
  };

  const industry = INDUSTRIES[current];

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-100 p-4 md:p-6">
      {/* 상단 레이블 */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold bg-gray-100 text-gray-500 px-3 py-1 rounded-full">
          업종별 AI 검색 현실
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrev}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-colors text-sm"
            aria-label="이전 업종"
          >
            ←
          </button>
          <button
            onClick={handleNext}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-colors text-sm"
            aria-label="다음 업종"
          >
            →
          </button>
        </div>
      </div>

      {/* 콘텐츠 — 페이드 전환 */}
      <div
        className="transition-opacity duration-300"
        style={{ opacity: fade ? 1 : 0 }}
      >
        {/* 업종 제목 */}
        <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 text-center">
          {industry.emoji} {industry.label}이라면?
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* ChatGPT 한계 */}
          <div className="bg-white/80 rounded-xl p-4 border border-amber-100">
            <div className="text-xs font-semibold text-gray-500 mb-2">
              손님이 ChatGPT에 물어보면
            </div>
            <div className="bg-gray-50 rounded-lg px-3 py-2.5 mb-3 text-sm text-gray-700 font-medium border border-gray-100">
              {industry.query}
            </div>
            <div className="flex items-start gap-1.5 text-sm text-amber-700">
              <span className="shrink-0 mt-0.5">⚠️</span>
              <span className="leading-relaxed">{industry.result}</span>
            </div>
          </div>

          {/* AEOlab 해결 */}
          <div className="flex-1">
            <div className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">AEOlab이라면</div>
            <div className="space-y-2">
              <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
                <div className="text-xs text-amber-700 font-semibold mb-1">ChatGPT 조언</div>
                <div className="text-sm text-gray-600">{industry.chatgptAdvice}</div>
                <div className="text-xs text-amber-600 mt-1">→ 맞는 말, 그런데 내 가게 상황은 모름</div>
              </div>
              <div className="bg-blue-50 rounded-xl p-3 border border-blue-200">
                <div className="text-xs text-blue-700 font-semibold mb-1">AEOlab 측정 결과</div>
                <div className="text-sm font-semibold text-blue-800">{industry.aeolabAnswer}</div>
                <div className="text-xs text-blue-600 mt-1">→ 지금 바로 붙여넣기 가능한 문구 제공</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 하단 점 인디케이터 */}
      <div className="flex justify-center gap-1.5 mt-4">
        {INDUSTRIES.map((_, i) => (
          <button
            key={i}
            onClick={() => {
              setFade(false);
              setTimeout(() => {
                setCurrent(i);
                setFade(true);
              }, 200);
            }}
            className={`rounded-full transition-all duration-200 ${
              i === current
                ? "w-4 h-2 bg-blue-500"
                : "w-2 h-2 bg-gray-300 hover:bg-gray-400"
            }`}
            aria-label={`${INDUSTRIES[i].label}로 이동`}
          />
        ))}
      </div>
    </div>
  );
}
