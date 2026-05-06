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
  const items: CheckItem[] = [
    {
      label: "Google 비즈니스 프로필 등록",
      done: googlePlaceRegistered,
      actionLabel: "Google 비즈니스 등록 →",
      actionHref: "https://business.google.com",
      actionExternal: true,
    },
    {
      label: "독립 웹사이트 보유 (AI 크롤링 가능)",
      done: hasWebsite,
      actionLabel: "웹사이트 없이 AI 노출하는 법 →",
      actionHref: "/how-it-works#track2",
    },
    {
      label: "AI 검색 구조화 데이터(JSON-LD) 설치",
      done: websiteSeoScore >= 40,
      actionLabel: "JSON-LD 자동 생성 →",
      actionHref: "/schema",
    },
    {
      label: "ChatGPT에서 사업장 노출 확인됨",
      done: hasScanned && chatgptMentioned,
      actionLabel: hasScanned ? "스캔 다시 실행" : "첫 스캔 시작",
      actionHref: "#scan",
    },
    {
      label: "Gemini에서 사업장 노출 확인됨",
      done: hasScanned && geminiMentioned,
      actionLabel: hasScanned ? "스캔 다시 실행" : "첫 스캔 시작",
      actionHref: "#scan",
    },
  ];

  const doneCount = items.filter((i) => i.done).length;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-gray-900">
          글로벌 AI 노출 체크리스트
        </h3>
        <span className="text-sm font-semibold text-blue-600">
          {doneCount} / {items.length} 완료
        </span>
      </div>

      {/* 진행률 바 */}
      <div className="w-full bg-gray-100 rounded-full h-2 mb-4">
        <div
          className="bg-blue-500 h-2 rounded-full transition-all"
          style={{ width: `${(doneCount / items.length) * 100}%` }}
        />
      </div>

      <ul className="space-y-3">
        {items.map((item) => (
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
                  className="shrink-0 text-xs text-blue-600 hover:underline whitespace-nowrap"
                >
                  {item.actionLabel}
                </a>
              ) : (
                <Link
                  href={item.actionHref}
                  className="shrink-0 text-xs text-blue-600 hover:underline whitespace-nowrap"
                >
                  {item.actionLabel}
                </Link>
              )
            )}
          </li>
        ))}
      </ul>

      {doneCount === items.length && (
        <p className="mt-4 text-sm text-green-700 font-semibold text-center">
          글로벌 AI 노출 기반을 모두 갖췄습니다!
        </p>
      )}

      <p className="mt-3 text-xs text-gray-400 leading-relaxed">
        ChatGPT 측정은 AI 학습 데이터 기반이며 실시간 웹 검색 결과와 다를 수 있습니다.
        측정 시점·기기·로그인 상태에 따라 결과가 달라질 수 있습니다.
      </p>
    </div>
  );
}
