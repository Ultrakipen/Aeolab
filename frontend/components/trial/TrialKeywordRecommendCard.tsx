"use client";

import { useState } from "react";
import { Bookmark, Check } from "lucide-react";

interface KeywordMetaEntry {
  subcategory: string;
  weight: number;
}

interface Props {
  missingKws: string[];
  faqText?: string | null;
  categoryLabel: string;
  dismissed: string[];
  onDismiss: (kw: string) => void;
  keywordMeta?: Record<string, KeywordMetaEntry>;
  userGroup?: string;
  introAnalyzed?: boolean;
  isPaidUser?: boolean;
}

// 백엔드 keyword_taxonomy 서브카테고리 키 → 사용자 노출 한글 라벨
const SUBCAT_LABEL: Record<string, string> = {
  접근편의: "접근·편의",
  단체모임: "단체·모임",
  분위기상황: "분위기·상황",
  동반자조건: "동반자 조건",
  메뉴특장점: "메뉴 특장점",
  운영정보: "운영 정보",
  ai_tab_context: "AI 검색 맥락",
  전문시술: "전문 시술",
  운영조건: "운영 조건",
  진료전문성: "진료 전문성",
  facility: "시설",
  room: "객실",
  dining: "식음",
  activity: "액티비티",
  value: "가성비",
  situation: "상황",
  service: "서비스",
  access: "접근",
  촬영목적: "촬영 목적",
  포트폴리오: "포트폴리오",
  수정가능횟수: "수정·납품",
  가격: "가격",
};

export default function TrialKeywordRecommendCard({ missingKws, faqText, categoryLabel, dismissed, onDismiss, keywordMeta, userGroup, introAnalyzed = false, isPaidUser = false }: Props) {
  const [copied, setCopied] = useState<string | null>(null);

  const visible = missingKws.filter(k => !dismissed.includes(k));

  const handleCopy = async (kw: string) => {
    // 키워드별 동적 FAQ 텍스트 생성 (faqText는 첫 번째 키워드 전용이라 여기선 사용 안 함)
    const text = `Q. ${kw} 관련해서 어떤 점이 좋나요?\nA. 저희 가게의 ${kw}에 대해 궁금하신 점은 편하게 문의해 주세요. 자세한 내용은 네이버 채팅 또는 방문으로 안내해 드립니다.`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kw);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // clipboard API 실패 시 execCommand fallback
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setCopied(kw);
        setTimeout(() => setCopied(null), 2000);
      } catch {
        // 최후 fallback: 버튼 텍스트로 안내
        setCopied(kw + "__fail");
        setTimeout(() => setCopied(null), 2500);
      }
    }
  };

  if (visible.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4 mb-4 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <Bookmark className="w-4 h-4 text-gray-500 shrink-0" />
          <p className="text-sm font-bold text-gray-800">소개글에 추가하면 좋은 키워드</p>
        </div>
        <p className="text-sm text-emerald-700 font-semibold flex items-center gap-1.5"><Check className="w-4 h-4" aria-hidden="true" /> 제안된 키워드를 모두 확인했습니다.</p>
        <p className="text-sm text-gray-400 mt-1">Basic 플랜에서 전체 키워드 목록과 월별 변화를 추적할 수 있습니다.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 mb-4 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <Bookmark className="w-4 h-4 text-gray-500 shrink-0" />
        <p className="text-sm font-bold text-gray-800">소개글에 추가하면 좋은 키워드</p>
      </div>
      {/* 분석 기준 배지 */}
      {introAnalyzed ? (
        <div className="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-0.5 mb-2">
          <span className="text-emerald-600 text-xs">✓</span>
          <span className="text-xs font-medium text-emerald-700">소개글 분석 완료</span>
        </div>
      ) : (
        <div className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5 mb-2">
          <span className="text-xs">⚠</span>
          <span className="text-xs font-medium text-amber-700">업종 표준 기준 추천</span>
        </div>
      )}
      <p className="text-sm text-gray-600 mb-1 leading-relaxed font-medium">
        AI가 {categoryLabel}을 검색할 때 자주 쓰는 업종 표준 키워드입니다.
      </p>
      <p className="text-sm text-gray-500 mb-2 leading-relaxed">
        소개글·리뷰에 아직 없는 키워드만 표시합니다. 내 가게에 해당되는 것만 골라 소개글에 추가하세요 — 모두 추가할 필요는 없습니다.
      </p>
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 mb-3 space-y-1.5">
        {introAnalyzed ? (
          <>
            <p className="text-sm text-amber-800 leading-relaxed font-medium">
              내 소개글을 직접 분석해 <span className="font-semibold">아직 없는 키워드만</span> 추려냈습니다.
            </p>
            <p className="text-sm text-amber-700 leading-relaxed">
              내 가게 특성과 맞는 것만 골라 소개글에 자연스럽게 추가하세요. 모두 넣을 필요는 없습니다.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-amber-800 leading-relaxed font-medium">
              업종 전체 평균 기준으로 추린 키워드입니다 — 내 소개글을 직접 분석하지 않았습니다.
            </p>
            <p className="text-sm text-amber-700 leading-relaxed">
              내 가게 특성과 다른 항목은 무시하세요.
              {!isPaidUser && (
                <span className="block mt-1 text-blue-700 font-medium">
                  💡 소개글 직접 분석은 Basic 플랜부터 지원됩니다.
                </span>
              )}
            </p>
          </>
        )}
      </div>

      <div className="space-y-2">
        {visible.slice(0, 3).map((kw, idx) => {
          const meta = keywordMeta?.[kw];
          const subLabel = meta ? (SUBCAT_LABEL[meta.subcategory] ?? meta.subcategory) : null;
          const weightPct = meta ? Math.round((meta.weight ?? 0) * 100) : null;
          return (
            <div key={kw} className="bg-blue-50 rounded-xl px-3 py-2 border border-blue-100">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-blue-800 flex-1">{kw}</span>
                <button
                  onClick={() => handleCopy(kw)}
                  className="text-sm bg-blue-600 text-white px-2.5 py-1 rounded-lg hover:bg-blue-700 transition-colors shrink-0"
                >
                  {copied === kw ? <><Check className="w-4 h-4" aria-hidden="true" /> 복사됨</> : copied === kw + "__fail" ? "직접 복사하세요" : "문구 복사"}
                </button>
              </div>
              {/* 추천 근거: 어느 서브카테고리·비중에서 왔는지 표시 */}
              {subLabel && weightPct !== null && (
                <p className="text-sm text-blue-700 mt-1">
                  {categoryLabel} &lsquo;{subLabel}&rsquo; 영역 (점수 비중 {weightPct}%)
                </p>
              )}
              {idx === 0 && (
                <p className="text-sm text-gray-500 mt-1.5 leading-relaxed break-keep">
                  {userGroup === "ACTIVE"
                    ? "소개글 Q&A 형식으로 추가하면 AI 브리핑 인용 후보가 됩니다. 복사 후 실제 가게 특징에 맞게 수정하세요."
                    : "소개글에 키워드를 자연스럽게 포함하면 ChatGPT·Gemini 검색에서 발견될 가능성이 높아집니다. 복사 후 실제 가게 특징에 맞게 수정하세요."}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {isPaidUser ? (
        <p className="text-sm text-gray-500 mt-2.5 leading-relaxed">
          키워드 전체 목록과 월별 변화 추적은 대시보드 → 갭 분석에서 확인하세요.
        </p>
      ) : (
        <p className="text-sm text-gray-400 mt-2.5 leading-relaxed">
          키워드 전체 목록 + 월별 변화 추적 + 소개글 직접 분석은 Basic 플랜에서 제공합니다.
        </p>
      )}
    </div>
  );
}
