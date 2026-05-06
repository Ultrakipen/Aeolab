"use client";

import Link from "next/link";
import { MessageCircle, Search, BarChart2, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface CompareRow {
  question: string;
  chatgptAnswer: string;
  aeolabAnswer: string;
  ChatgptIcon: LucideIcon;
  AeolabIcon: LucideIcon;
}

const COMPARE_ROWS: CompareRow[] = [
  {
    question: "내 가게 네이버 AI 브리핑에 나오나요?",
    ChatgptIcon: MessageCircle,
    chatgptAnswer: "소개글 Q&A를 추가하면 노출될 수 있어요",
    AeolabIcon: Search,
    aeolabAnswer: "지금 이 순간 100번 중 N번 언급되는지 직접 확인",
  },
  {
    question: "경쟁 가게보다 내가 뒤처진 이유가 뭔가요?",
    ChatgptIcon: MessageCircle,
    chatgptAnswer: "리뷰 수와 키워드를 늘리세요",
    AeolabIcon: BarChart2,
    aeolabAnswer: "경쟁사에 있는 키워드 중 내 가게에 없는 것을 찾아 보여줍니다",
  },
  {
    question: "소개글 Q&A를 추가하면 얼마나 효과가 있나요?",
    ChatgptIcon: MessageCircle,
    chatgptAnswer: "노출이 늘어날 수 있어요",
    AeolabIcon: TrendingUp,
    aeolabAnswer: "등록 시점과 7일 후 점수를 자동 비교해 변화량을 기록합니다",
  },
];

export default function ChatGPTCompareSection() {
  return (
    <div className="bg-gradient-to-b from-gray-50 to-white border border-gray-200 rounded-2xl p-5 md:p-8 mb-6">
      {/* 헤더 */}
      <div className="text-center mb-6">
        <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
          ChatGPT vs AEOlab
        </p>
        <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">
          ChatGPT한테 이미 물어봤나요?
        </h2>
        <p className="text-sm md:text-base text-gray-500">
          이런 답이 돌아왔을 겁니다
        </p>
      </div>

      {/* 비교 행들 */}
      <div className="space-y-4 mb-6">
        {COMPARE_ROWS.map((row, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {/* 질문 */}
            <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-700">
                Q. &ldquo;{row.question}&rdquo;
              </p>
            </div>
            {/* 답변 비교 — PC: 2열, 모바일: 세로 스택 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
              {/* ChatGPT 답변 */}
              <div className="p-4 flex gap-3 items-start">
                <row.ChatgptIcon size={18} strokeWidth={1.8} className="shrink-0 mt-0.5 text-gray-400" aria-hidden />
                <div>
                  <p className="text-sm font-semibold text-gray-500 mb-1">ChatGPT 답변</p>
                  <p className="text-sm text-gray-600 leading-relaxed">&ldquo;{row.chatgptAnswer}&rdquo;</p>
                  <p className="text-sm text-gray-500 mt-1.5">모든 가게에게 동일한 답변</p>
                </div>
              </div>
              {/* AEOlab 답변 */}
              <div className="p-4 flex gap-3 items-start bg-blue-50 sm:bg-white">
                <row.AeolabIcon size={18} strokeWidth={1.8} className="shrink-0 mt-0.5 text-blue-500" aria-hidden />
                <div>
                  <p className="text-sm font-semibold text-blue-600 mb-1">AEOlab이 하는 것</p>
                  <p className="text-sm text-gray-800 font-medium leading-relaxed">{row.aeolabAnswer}</p>
                  <p className="text-sm text-blue-500 mt-1.5">내 가게만의 실제 측정</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="text-center">
        <Link
          href="/trial"
          className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-base px-8 py-3.5 rounded-xl transition-colors shadow-md"
        >
          지금 무료로 측정하기
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
        <p className="text-sm text-gray-500 mt-2">가입 없이 즉시 체험 · 1분 소요</p>
      </div>
    </div>
  );
}
