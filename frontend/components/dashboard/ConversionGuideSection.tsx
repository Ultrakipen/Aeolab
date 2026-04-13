"use client";

// ConversionGuideSection.tsx
// 무료→유료 전환 섹션
// - 점수 낮은 항목 기반 무료 팁 2개 동적 노출
// - 나머지 방법은 잠금(blur) 처리 + Basic 플랜 CTA

import Link from "next/link";
import { useState } from "react";
import { Lock, CheckCircle2, Copy, Check } from "lucide-react";

interface Props {
  breakdown: Record<string, number>;
  businessName: string;
  topMissingKeywords: string[];
  reviewCount: number;
  plan: string; // 'free' | 'basic' | 'pro' | 'biz' | 'startup' | 'enterprise'
}

interface Tip {
  key: string;
  title: string;
  previewContent: React.ReactNode;
  actionLabel: string;
  actionHref: string;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 border border-blue-200 hover:border-blue-400 px-3 py-1.5 rounded-lg transition-colors mt-2"
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5" />
          복사됨
        </>
      ) : (
        <>
          <Copy className="w-3.5 h-3.5" />
          복사하기
        </>
      )}
    </button>
  );
}

// 잠금된 더미 항목 목록 (blur 처리)
const LOCKED_ITEMS = [
  { icon: "✨", label: "맞춤 FAQ 5개 문구 (바로 복사)" },
  { icon: "📋", label: "리뷰 유도 카카오 문자 3가지" },
  { icon: "📝", label: "AI 최적화 소개글 초안" },
  { icon: "🗓", label: "이번 주 소식 업데이트 템플릿" },
  { icon: "📊", label: "경쟁사 대비 내가 없는 키워드 분석" },
];

// 항목별 팁 생성 함수
function buildTips(
  breakdown: Record<string, number>,
  businessName: string,
  topMissingKeywords: string[]
): Tip[] {
  const tipPriority: Array<{
    key: string;
    threshold: number;
    buildTip: () => Tip;
  }> = [
    {
      key: "smart_place_completeness",
      threshold: 70,
      buildTip: () => ({
        key: "smart_place_completeness",
        title: "스마트플레이스 Q&A에 FAQ 1개 등록",
        previewContent: (
          <div>
            <p className="text-sm text-gray-600 mb-2">
              AI 브리핑이 가장 자주 직접 인용하는 콘텐츠가 바로 Q&A입니다.
              아래 예시 질문을 그대로 복사해서 등록해보세요.
            </p>
            <div className="bg-white border border-green-200 rounded-lg p-3 text-sm text-gray-700">
              <p className="font-medium mb-1">예시 질문</p>
              <p className="text-gray-600">&ldquo;예약은 어떻게 하나요?&rdquo;</p>
              <p className="text-gray-500 text-xs mt-1.5">
                → 전화 또는 카카오톡 채널로 예약 가능합니다. 당일 예약은 전화로 문의 주세요.
              </p>
            </div>
            <CopyButton text={`Q: 예약은 어떻게 하나요?\nA: 전화 또는 카카오톡 채널로 예약 가능합니다. 당일 예약은 전화로 문의 주세요.`} />
          </div>
        ),
        actionLabel: "스마트플레이스 관리자 바로가기 →",
        actionHref: "https://smartplace.naver.com",
      }),
    },
    {
      key: "review_quality",
      threshold: 40,
      buildTip: () => {
        const reviewMsg = `안녕하세요 😊 네이버에서 "${businessName}" 검색 후 별점과 한 줄 후기 남겨주시면 정말 감사드리겠습니다!`;
        return {
          key: "review_quality",
          title: "단골 손님 1명에게 리뷰 요청",
          previewContent: (
            <div>
              <p className="text-sm text-gray-600 mb-2">
                리뷰 1개는 AI 노출 점수에 즉시 반영됩니다.
                아래 문구를 카카오톡으로 보내보세요.
              </p>
              <div className="bg-white border border-green-200 rounded-lg p-3 text-sm text-gray-700 leading-relaxed">
                {reviewMsg}
              </div>
              <CopyButton text={reviewMsg} />
            </div>
          ),
          actionLabel: "리뷰 관리 가이드 보기 →",
          actionHref: "/guide",
        };
      },
    },
    {
      key: "keyword_gap_score",
      threshold: 50,
      buildTip: () => {
        const keywords =
          topMissingKeywords.length > 0
            ? topMissingKeywords.slice(0, 2)
            : ["맛집", "추천"];
        const exampleIntro = `${businessName}은(는) ${keywords.join(", ")} 키워드로 최적화된 공간입니다. ${keywords[0]} 하면 가장 먼저 생각나는 곳이 되도록 운영하고 있습니다.`;
        return {
          key: "keyword_gap_score",
          title: `소개글에 핵심 키워드 포함 (${keywords.join(", ")})`,
          previewContent: (
            <div>
              <p className="text-sm text-gray-600 mb-2">
                AI는 소개글에서 키워드를 읽어 브리핑 인용 여부를 결정합니다.
                아래 예시를 참고해 소개글에 키워드를 자연스럽게 포함해보세요.
              </p>
              <div className="bg-white border border-green-200 rounded-lg p-3 text-sm text-gray-700 leading-relaxed">
                {exampleIntro}
              </div>
              <CopyButton text={exampleIntro} />
            </div>
          ),
          actionLabel: "소개글 최적화 도구 →",
          actionHref: "/schema",
        };
      },
    },
    {
      key: "naver_exposure_confirmed",
      threshold: 60,
      buildTip: () => ({
        key: "naver_exposure_confirmed",
        title: "네이버 AI 브리핑에 내 가게가 나오는지 직접 확인",
        previewContent: (
          <div>
            <p className="text-sm text-gray-600 mb-2">
              네이버에서 직접 검색해 AI 브리핑(요약 박스)에 내 가게 이름이 나오는지 확인해보세요.
            </p>
            <div className="bg-white border border-green-200 rounded-lg p-3 text-sm text-gray-700">
              <p className="font-medium mb-1">확인 방법</p>
              <p className="text-gray-600">
                1. 네이버 검색 → &ldquo;{businessName} 주변 추천&rdquo; 입력
              </p>
              <p className="text-gray-600">
                2. 상단 AI 브리핑 요약 박스에 내 가게 이름 확인
              </p>
              <p className="text-gray-500 text-xs mt-1.5">
                브리핑에 나오지 않으면 FAQ 등록이 가장 빠른 해결책입니다.
              </p>
            </div>
            <a
              href={`https://search.naver.com/search.naver?query=${encodeURIComponent(businessName + " 추천")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 border border-blue-200 hover:border-blue-400 px-3 py-1.5 rounded-lg transition-colors mt-2 w-fit"
            >
              네이버 AI 브리핑 직접 확인 →
            </a>
          </div>
        ),
        actionLabel: "AI 노출 개선 가이드 →",
        actionHref: "/guide",
      }),
    },
  ];

  const selected: Tip[] = [];

  for (const { key, threshold, buildTip } of tipPriority) {
    if (selected.length >= 2) break;
    const score = breakdown[key] ?? 100;
    if (score < threshold) {
      selected.push(buildTip());
    }
  }

  // 부족한 경우 임계값 무관하게 낮은 항목으로 채움
  if (selected.length < 2) {
    for (const { key, buildTip } of tipPriority) {
      if (selected.length >= 2) break;
      if (selected.some((t) => t.key === key)) continue;
      selected.push(buildTip());
    }
  }

  return selected.slice(0, 2);
}

export default function ConversionGuideSection({
  breakdown,
  businessName,
  topMissingKeywords,
  reviewCount: _reviewCount,
  plan,
}: Props) {
  const isPaid = plan !== "free";
  const tips = buildTips(breakdown, businessName, topMissingKeywords);

  return (
    <div className="bg-gradient-to-b from-white to-blue-50 border border-blue-100 rounded-2xl p-4 md:p-6 shadow-sm">
      {/* 헤더 */}
      <div className="mb-5">
        <h2 className="text-base md:text-lg font-bold text-gray-900 mb-1">
          점수를 올리는 방법
        </h2>
        <p className="text-sm text-gray-500">
          지금 바로 할 수 있는 방법{" "}
          {tips.length}가지를 알려드립니다.
        </p>
      </div>

      {/* 무료 팁 카드 2개 */}
      <div className="space-y-4 mb-6">
        {tips.map((tip, idx) => (
          <div
            key={tip.key}
            className="bg-green-50 border border-green-200 rounded-xl p-4"
          >
            <div className="flex items-start gap-2.5 mb-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
              <p className="text-base font-semibold text-gray-900">
                방법 {idx + 1}. {tip.title}
              </p>
            </div>
            <div className="pl-7">{tip.previewContent}</div>
            <div className="pl-7 mt-3">
              <a
                href={tip.actionHref}
                target={tip.actionHref.startsWith("http") ? "_blank" : undefined}
                rel={tip.actionHref.startsWith("http") ? "noopener noreferrer" : undefined}
                className="text-sm text-green-700 hover:text-green-900 font-medium underline underline-offset-2"
              >
                {tip.actionLabel}
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* 잠금 섹션 */}
      <div className="relative">
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 overflow-hidden">
          {/* 잠금 오버레이 */}
          {!isPaid && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] rounded-xl z-10 flex flex-col items-center justify-center gap-3 px-4">
              <Lock className="w-6 h-6 text-gray-400" />
              <p className="text-sm font-semibold text-gray-600 text-center">
                Basic 플랜 이상에서 잠금 해제
              </p>
              <Link
                href="/pricing"
                className="w-full max-w-xs bg-blue-600 hover:bg-blue-700 text-white text-base font-bold px-5 py-3 rounded-xl text-center transition-colors"
              >
                Basic 플랜 시작하기 — 월 9,900원
              </Link>
              <p className="text-xs text-gray-400 text-center">
                가입 후 AI가 위 문구를 즉시 자동 생성합니다. 언제든 취소 가능.
              </p>
            </div>
          )}

          {/* 잠금된 항목 목록 (blur 처리) */}
          <div className={!isPaid ? "blur-sm select-none" : ""}>
            <p className="text-sm font-semibold text-gray-500 mb-3">
              더 많은 방법
            </p>
            <div className="space-y-3">
              {LOCKED_ITEMS.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-2.5 bg-white border border-gray-100 rounded-lg px-4 py-3"
                >
                  <span className="text-base shrink-0">{item.icon}</span>
                  <span className="text-sm text-gray-700 font-medium">
                    {businessName} {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 유료 사용자: 가이드 바로가기 */}
      {isPaid && (
        <div className="mt-4">
          <Link
            href="/guide"
            className="flex items-center justify-center gap-2 w-full bg-green-600 hover:bg-green-700 text-white text-base font-bold px-5 py-3 rounded-xl transition-colors"
          >
            AI 개선 가이드에서 맞춤 문구 바로 복사하기 →
          </Link>
          <p className="text-xs text-center text-gray-400 mt-2">
            AI 개선 가이드에서 복사해서 바로 쓸 수 있는 문구를 제공합니다.
          </p>
        </div>
      )}
    </div>
  );
}
