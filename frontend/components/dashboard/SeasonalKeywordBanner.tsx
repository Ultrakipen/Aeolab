"use client";

import { CalendarDays } from "lucide-react";

const SEASONAL_KEYWORDS: Record<number, string[]> = {
  1: ["설날 맛집", "겨울 보양식", "신년 이벤트"],
  2: ["발렌타인데이", "봄맞이", "2월 이벤트"],
  3: ["봄나들이 맛집", "개학 특수", "졸업 기념"],
  4: ["벚꽃 명소", "봄 피크닉", "어린이날 준비"],
  5: ["어버이날 선물", "가정의달", "5월 이벤트"],
  6: ["여름 시작", "초복", "여름 음료"],
  7: ["여름 휴가", "중복", "바캉스 맛집"],
  8: ["말복", "여름 끝", "개학 특수"],
  9: ["추석 선물", "가을 나들이", "단풍 명소"],
  10: ["핼러윈", "가을 맛집", "10월 이벤트"],
  11: ["수능 특수", "빼빼로데이", "연말 모임"],
  12: ["크리스마스", "연말 파티", "신년 예약"],
};

const MONTH_LABELS: Record<number, string> = {
  1: "1월", 2: "2월", 3: "3월", 4: "4월",
  5: "5월", 6: "6월", 7: "7월", 8: "8월",
  9: "9월", 10: "10월", 11: "11월", 12: "12월",
};

export default function SeasonalKeywordBanner() {
  const currentMonth = new Date().getMonth() + 1;
  const keywords = SEASONAL_KEYWORDS[currentMonth] ?? [];
  const monthLabel = MONTH_LABELS[currentMonth];

  if (keywords.length === 0) return null;

  return (
    <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
      {/* 헤더 */}
      <div className="flex items-center gap-2 mb-3">
        <CalendarDays className="w-4 h-4 text-amber-600 shrink-0" />
        <span className="text-sm font-bold text-amber-800">
          {monthLabel} 시즌 키워드
        </span>
      </div>

      {/* 키워드 태그 */}
      <div className="flex flex-wrap gap-2 mb-3">
        {keywords.map((kw) => (
          <span
            key={kw}
            className="inline-flex items-center px-3 py-1.5 bg-white text-amber-700 text-sm font-medium rounded-full border border-amber-200"
          >
            {kw}
          </span>
        ))}
      </div>

      {/* 안내문 */}
      <p className="text-sm text-amber-700">
        이 키워드들을 소식·소개글에 활용해보세요.
        <span className="text-amber-500 ml-1">
          시즌 검색량 높을 때 노출 효과 극대화
        </span>
      </p>
    </div>
  );
}
