"use client";

import Link from "next/link";

interface CheckItem {
  label: string;
  done: boolean;
  actionLabel?: string;
  actionHref?: string;
  actionExternal?: boolean;
}

interface Props {
  hasWebsite: boolean;
  googlePlaceRegistered: boolean;
  websiteSeoScore: number;   // channel_scores.website_seo (0~100)
  chatgptMentioned: boolean;
  geminiMentioned: boolean;
  hasScanned: boolean;       // latestScan 존재 여부
}

export function GlobalAIChecklist({
  hasWebsite,
  googlePlaceRegistered,
  websiteSeoScore,
  chatgptMentioned,
  geminiMentioned,
  hasScanned,
}: Props) {
  // 섹션 1: Gemini 노출 준비 체크리스트 (3개 항목)
  const geminiItems: CheckItem[] = [
    {
      label: "Google 비즈니스 프로필 등록",
      done: googlePlaceRegistered,
      actionLabel: "Google 비즈니스 등록 →",
      actionHref: "https://business.google.com",
      actionExternal: true,
    },
    hasWebsite
      ? {
          label: "독립 웹사이트 보유 (AI 크롤링 가능)",
          done: true,
          actionLabel: "웹사이트 없이 AI 노출하는 법 →",
          actionHref: "/how-it-works#track2",
        }
      : {
          label: "네이버 블로그 운영 (웹사이트 대체 가능)",
          done: false,
          actionLabel: "블로그 전략 가이드 →",
          actionHref: "/guide/blog-strategy",
        },
    hasWebsite
      ? {
          label: "홈페이지 AI 인식 코드 설치 (JSON-LD)",
          done: websiteSeoScore >= 40,
          actionLabel: "AI 인식 코드 자동 생성 →",
          actionHref: "/schema",
        }
      : {
          label: "구글 비즈니스 프로필 소개·서비스 항목 완성",
          done: googlePlaceRegistered,
          actionLabel: "구글 비즈니스 등록 →",
          actionHref: "https://business.google.com",
          actionExternal: true,
        },
  ];

  const geminiDoneCount = geminiItems.filter((i) => i.done).length;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-5">
      {/* 섹션 1: Gemini 노출 준비 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-base font-bold text-gray-900">
              글로벌 AI 노출 체크리스트
            </h3>
            <p className="text-sm text-gray-500 mt-0.5">
              Gemini 노출 준비 (수주~수개월)
            </p>
          </div>
          <span className="text-sm font-semibold text-blue-600">
            {geminiDoneCount} / 3 완료
          </span>
        </div>

        {/* 진행률 바 */}
        <div className="w-full bg-gray-100 rounded-full h-2 mb-4">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all"
            style={{ width: `${(geminiDoneCount / 3) * 100}%` }}
          />
        </div>

        <ul className="space-y-3">
          {geminiItems.map((item) => (
            <li key={item.label} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`shrink-0 text-base ${item.done ? "text-green-500" : "text-gray-300"}`}>
                  {item.done ? "✅" : "⬜"}
                </span>
                <span
                  className={`text-sm break-keep ${
                    item.done ? "text-gray-500 line-through" : "text-gray-800"
                  }`}
                >
                  {item.label}
                </span>
              </div>
              {!item.done && item.actionLabel && item.actionHref && (
                item.actionExternal ? (
                  <a
                    href={item.actionHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-sm text-blue-600 hover:underline whitespace-nowrap"
                  >
                    {item.actionLabel}
                  </a>
                ) : (
                  <Link
                    href={item.actionHref}
                    className="shrink-0 text-sm text-blue-600 hover:underline whitespace-nowrap"
                  >
                    {item.actionLabel}
                  </Link>
                )
              )}
            </li>
          ))}
        </ul>

        {geminiDoneCount === 3 && (
          <p className="mt-4 text-sm text-green-700 font-semibold text-center">
            Gemini 노출을 위한 기반이 갖춰졌습니다. 수주~수개월 내 반영을 확인하세요.
          </p>
        )}
      </div>

      <div className="border-t border-gray-100" />

      {/* 섹션 2: ChatGPT 현황 안내 (체크리스트 아님) */}
      <div>
        <h4 className="text-sm font-bold text-gray-800 mb-2">
          ChatGPT 현황 안내
        </h4>

        {hasScanned && chatgptMentioned ? (
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 bg-green-50 border border-green-200 text-green-700 text-sm font-semibold px-3 py-1.5 rounded-lg">
              <span>✓</span>
              <span>현재 ChatGPT에 노출 중</span>
            </span>
          </div>
        ) : null}

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-1.5">
          <div className="flex items-start gap-2">
            <span className="text-amber-500 text-base shrink-0 mt-0.5">⚠</span>
            <p className="text-sm text-amber-800 leading-relaxed">
              ChatGPT는 학습 데이터(2024.06 컷오프) 기반으로 측정합니다.
            </p>
          </div>
          <p className="text-sm text-amber-700 leading-relaxed pl-6">
            지금 당장 개선할 수 있는 방법이 없으며, 한국 소상공인 평균 노출률은 <strong>1~3%</strong>입니다.
          </p>
          <p className="text-sm text-amber-700 leading-relaxed pl-6">
            미디어·블로그 언급이 장기적으로 누적되어야 반영됩니다 (수개월~1년+).
          </p>
        </div>
      </div>

      {/* 면책 문구 */}
      <p className="text-sm text-gray-500 leading-relaxed border-t border-gray-100 pt-3">
        ChatGPT 측정은 AI 학습 데이터 기반이며 실시간 웹 검색 결과와 다를 수 있습니다.
        측정 시점·기기·로그인 상태에 따라 결과가 달라질 수 있습니다.
      </p>
    </div>
  );
}
