"use client";

import { Camera, Lock, CheckCircle2 } from "lucide-react";

interface Props {
  businessName?: string;
}

const MOCK_SCREENSHOTS = [
  {
    key: "naver",
    label: "네이버 AI 브리핑",
    headerBg: "bg-[#03C75A]",
    queryLabel: "지역 + 업종 검색 결과",
    lines: [
      { w: "w-3/4", color: "bg-gray-300" },
      { w: "w-full", color: "bg-green-200" },
      { w: "w-5/6", color: "bg-gray-300" },
      { w: "w-2/3", color: "bg-gray-200" },
    ],
    captionColor: "bg-green-50 border-green-200",
  },
  {
    key: "chatgpt",
    label: "ChatGPT",
    headerBg: "bg-gray-800",
    queryLabel: "업종 맛집·추천 질의 응답",
    lines: [
      { w: "w-full", color: "bg-gray-300" },
      { w: "w-4/5", color: "bg-blue-200" },
      { w: "w-full", color: "bg-gray-200" },
      { w: "w-3/4", color: "bg-gray-300" },
    ],
    captionColor: "bg-blue-50 border-blue-200",
  },
];

export default function SubscriptionScreenshotPreview({
  businessName = "내 가게",
}: Props) {
  return (
    <section className="bg-white border-2 border-blue-200 rounded-xl p-4 md:p-6 mb-4 shadow-sm">
      {/* 헤더 */}
      <div className="flex items-center gap-2 mb-1">
        <Camera className="w-5 h-5 text-blue-600 shrink-0" />
        <p className="text-base md:text-lg font-bold text-gray-900">
          구독하면 이런 화면도 볼 수 있어요
        </p>
      </div>
      <p className="text-sm text-gray-500 mb-4 ml-7 leading-relaxed break-keep">
        AI가 내 가게를 어떤 질문에서 언급하는지 실제 검색 화면으로 확인
      </p>

      {/* 스크린샷 미리보기 카드 2종 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {MOCK_SCREENSHOTS.map((s) => (
          <div
            key={s.key}
            className="overflow-hidden rounded-xl border border-gray-200 bg-white"
          >
            {/* 플랫폼 헤더 */}
            <div className={`${s.headerBg} px-3 py-2 flex items-center justify-between gap-2`}>
              <span className="text-sm font-bold text-white shrink-0">{s.label}</span>
              <span className="text-xs text-white/70 truncate">{s.queryLabel}</span>
            </div>

            {/* 블러 처리된 콘텐츠 */}
            <div className="relative h-28 bg-gray-50 overflow-hidden">
              <div className="absolute inset-0 p-3 blur-sm select-none pointer-events-none">
                {s.lines.map((l, i) => (
                  <div key={i} className={`h-2.5 ${l.color} rounded mb-2 ${l.w}`} />
                ))}
              </div>
              {/* 잠금 오버레이 */}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-white/60 backdrop-blur-[1px]">
                <Lock className="w-5 h-5 text-gray-500" />
                <span className="text-sm font-semibold text-gray-600">구독 후 실제 화면 확인</span>
              </div>
            </div>

            {/* 하단 안내 */}
            <div className={`px-3 py-2 flex items-center gap-1.5 border-t ${s.captionColor}`}>
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
              <span className="text-sm text-gray-600 break-keep">
                <span className="font-semibold">&ldquo;{businessName}&rdquo;</span> 언급 여부 + 인용 문장 캡처
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
