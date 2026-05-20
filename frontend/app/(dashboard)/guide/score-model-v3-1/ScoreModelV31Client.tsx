"use client";

import Link from "next/link";
import { getUserGroup } from "@/lib/userGroup";

// ─── 타입 ───────────────────────────────────────────────────────────────────────
type UserGroupType = "ACTIVE" | "LIKELY" | "INACTIVE" | "franchise" | null;

interface Props {
  userCategory: string | null;
  userGroup: UserGroupType;
}

// ─── 그룹별 변경 내용 ───────────────────────────────────────────────────────────
const GROUP_CONTENT = {
  ACTIVE: {
    label: "ACTIVE 업종 (음식점·카페·베이커리·바·숙박)",
    color: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950 dark:border-emerald-700",
    titleColor: "text-emerald-800 dark:text-emerald-200",
    badge: "bg-emerald-600 text-white",
    badgeText: "AI 브리핑 대상",
    changes: [
      "네이버 AI 브리핑 노출 가중치 강화 — 실제 브리핑 노출 사업장의 점수가 더 정확하게 반영됩니다.",
      "스마트플레이스 완성도 비중이 소폭 상향되어 사진·소개글·영업시간 등 기본 정보의 중요도가 커집니다.",
      "리뷰 수·응답률이 Track1 기여도에 더 직접 반영되도록 산식이 세분화됩니다.",
    ],
    impact: "AI 브리핑에 실제로 노출되고 있는 사장님은 점수 상승이 예상됩니다. 스마트플레이스를 완성하지 않은 경우 점수 하락이 있을 수 있습니다.",
  },
  LIKELY: {
    label: "LIKELY 업종 (미용·네일·피트니스·요가·반려·약국)",
    color: "bg-indigo-50 border-indigo-200 dark:bg-indigo-950 dark:border-indigo-700",
    titleColor: "text-indigo-800 dark:text-indigo-200",
    badge: "bg-indigo-600 text-white",
    badgeText: "AI탭 베타 대상",
    changes: [
      "네이버 AI탭(베타) 노출 기여도가 신규 추가됩니다 — 2026-04-27 전체 업종 베타 적용 기준.",
      "ChatGPT·Gemini 인용 신호가 Track2 비중에서 더 세분화 반영됩니다.",
      "네이버 지도 순위·리뷰 응답 가중치가 해당 업종 특성에 맞게 재조정됩니다.",
    ],
    impact: "네이버 AI탭 노출 최적화가 점수에 새로 반영되어 AI탭 최적화 사업장은 점수 상승이 예상됩니다.",
  },
  INACTIVE: {
    label: "INACTIVE 업종 (법무·세무·교육·쇼핑·인테리어 등)",
    color: "bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-700",
    titleColor: "text-amber-800 dark:text-amber-200",
    badge: "bg-amber-500 text-white",
    badgeText: "글로벌 AI 집중",
    changes: [
      "네이버 AI 브리핑 비중(Track1)이 0으로 조정됩니다 — 비대상 업종에 불필요한 가중치를 제거합니다.",
      "ChatGPT·Gemini·Google AI 인용(Track2) 비중이 대폭 상향되어 실제 노출 채널에 집중합니다.",
      "웹사이트 SEO·콘텐츠 구조화 가중치가 강화되어 글로벌 AI 학습 신호가 더 잘 반영됩니다.",
    ],
    impact: "글로벌 AI(ChatGPT·Gemini)에서 실제로 언급되고 있는 사업장은 점수 상승이 예상됩니다. 웹사이트·콘텐츠가 부족한 경우 점수 하락이 있을 수 있습니다.",
  },
  franchise: {
    label: "프랜차이즈 가맹점",
    color: "bg-purple-50 border-purple-200 dark:bg-purple-950 dark:border-purple-700",
    titleColor: "text-purple-800 dark:text-purple-200",
    badge: "bg-purple-600 text-white",
    badgeText: "프랜차이즈 맞춤",
    changes: [
      "네이버 AI 브리핑 비중이 제외됩니다(본사 정책에 따라 가맹점은 AI 브리핑 비대상).",
      "네이버 일반 검색·지도·블로그 UGC 가중치가 강화됩니다.",
      "ChatGPT·Gemini·Google AI 채널 비중이 상향 조정됩니다.",
    ],
    impact: "프랜차이즈 특성에 맞게 조정되어 가맹점이 관리 가능한 채널에 점수가 집중됩니다.",
  },
};

const FAQ_DATA = [
  {
    q: "점수가 떨어졌는데 사업장에 문제가 있나요?",
    a: "v3.1 점수 변동은 실제 노출 상태를 더 정확하게 반영하도록 가중치가 보정된 결과입니다. 내 사업장의 실제 AI 노출이나 네이버 지도 순위가 변한 것이 아닙니다. 변동 사유가 궁금하다면 대시보드의 '채널별 점수' 항목을 확인해 주세요.",
  },
  {
    q: "다시 v3.0으로 돌아갈 수 있나요?",
    a: "v3.0 점수는 히스토리에 별도 보관됩니다. 운영 중에는 v3.1 점수를 기준으로 개선 가이드가 생성되며, v3.0으로 롤백하는 기능은 제공하지 않습니다. 점수 변동에 의문이 있으면 Q&A 게시판에 문의해 주세요.",
  },
  {
    q: "내 업종 가중치를 더 자세히 보려면?",
    a: "대시보드의 '점수 상세' 섹션에서 Track1(네이버)·Track2(글로벌) 각 항목별 기여도를 확인할 수 있습니다. 업종별 가중치 비율(Naver/Global 비율)은 설계 문서(docs/model_engine_v3.0.md)에 공개되어 있으며, 추후 UI에서 직접 확인할 수 있도록 개선 예정입니다.",
  },
];

export function ScoreModelV31Client({ userCategory, userGroup }: Props) {
  // 해당 업종의 그룹 콘텐츠 (없으면 INACTIVE fallback)
  const groupKey = userGroup ?? "INACTIVE";
  const groupContent = GROUP_CONTENT[groupKey];

  const categoryLabel = userCategory
    ? `${userCategory} 업종`
    : "내 업종";

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      {/* 헤더 */}
      <div className="mb-6 md:mb-8">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <Link
            href="/guide"
            className="text-blue-600 dark:text-blue-400 text-sm hover:underline"
          >
            ← 가이드 허브
          </Link>
          <span className="text-gray-400">/</span>
          <span className="text-sm text-gray-500 dark:text-gray-400">점수 모델 v3.1</span>
        </div>
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100">
          점수 모델 v3.1 업그레이드 안내
        </h1>
        {userCategory && userGroup && (
          <div className="mt-2 inline-flex items-center gap-2">
            <span className={`text-sm font-semibold px-3 py-1 rounded-full ${groupContent.badge}`}>
              {categoryLabel} — {groupContent.label.split("(")[0].trim()}
            </span>
          </div>
        )}
        <p className="mt-3 text-gray-600 dark:text-gray-400 text-sm leading-relaxed break-keep">
          v3.1은 업종별 가중치를 정교화하여 사장님 업종 특성에 맞는 진단을 제공합니다.
          AI 브리핑 대상(ACTIVE)·AI탭 베타(LIKELY)·글로벌 AI 집중(INACTIVE) 세 그룹이
          각각 다른 가중치로 분리됩니다.
        </p>
      </div>

      {/* 변경 개요 */}
      <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-700 rounded-xl p-4 md:p-5 mb-6">
        <h2 className="text-base font-bold text-blue-800 dark:text-blue-200 mb-2">왜 업그레이드되었나?</h2>
        <p className="text-sm text-blue-700 dark:text-blue-300 leading-relaxed break-keep">
          v3.0은 업종 구분 없이 단일 가중치를 적용해 음식점과 법무사 사무소가 동일한 기준으로 평가되는 문제가 있었습니다.
          v3.1은 AI 브리핑 대상 여부, 프랜차이즈 여부, 글로벌 AI 노출 중요도에 따라
          9개 그룹으로 세분화하여 사장님 업종에 실제로 의미 있는 채널에 더 높은 가중치를 부여합니다.
        </p>
      </div>

      {/* 내 업종 변경 카드 (하이라이트) */}
      <div className={`rounded-xl border-2 p-4 md:p-6 mb-6 ${groupContent.color}`}>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <h2 className={`text-base md:text-lg font-bold ${groupContent.titleColor}`}>
            {groupContent.label}
          </h2>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${groupContent.badge}`}>
            {groupContent.badgeText}
          </span>
          {userGroup && <span className="text-xs text-gray-400">(내 업종)</span>}
        </div>
        <ul className="space-y-2 mb-4">
          {groupContent.changes.map((change, i) => (
            <li key={i} className="flex gap-2 text-sm">
              <span className={`flex-shrink-0 font-bold mt-0.5 ${groupContent.titleColor}`}>•</span>
              <span className="text-gray-700 dark:text-gray-300 leading-relaxed break-keep">{change}</span>
            </li>
          ))}
        </ul>
        <div className="bg-white dark:bg-gray-800 bg-opacity-60 rounded-lg p-3">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 break-keep">
            예상 영향: {groupContent.impact}
          </p>
        </div>
      </div>

      {/* 나머지 두 그룹 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {(["ACTIVE", "LIKELY", "INACTIVE"] as const)
          .filter((k) => k !== groupKey)
          .map((k) => {
            const c = GROUP_CONTENT[k];
            return (
              <div key={k} className={`rounded-xl border p-4 ${c.color}`}>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className={`text-sm font-bold ${c.titleColor}`}>{c.label}</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.badge}`}>{c.badgeText}</span>
                </div>
                <ul className="space-y-1">
                  {c.changes.slice(0, 2).map((ch, i) => (
                    <li key={i} className="text-xs text-gray-600 dark:text-gray-400 break-keep">
                      • {ch}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
      </div>

      {/* 안심 메시지 */}
      <div className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 md:p-5 mb-6">
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed break-keep">
          점수 변동은 일시적이며 실제 노출 상태와 일치하도록 보정된 결과입니다.
          활성화 시점에 카카오 알림톡으로 추가 안내드립니다.
        </p>
      </div>

      {/* FAQ */}
      <div className="mb-8">
        <h2 className="text-base md:text-lg font-bold text-gray-800 dark:text-gray-200 mb-3">자주 묻는 질문</h2>
        <div className="space-y-3">
          {FAQ_DATA.map((item, i) => (
            <details key={i} className="group bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
              <summary className="flex items-center justify-between p-4 cursor-pointer text-sm font-semibold text-gray-800 dark:text-gray-200 select-none list-none">
                <span className="break-keep pr-4">{item.q}</span>
                <span className="flex-shrink-0 text-gray-400 group-open:rotate-180 transition-transform duration-200">▼</span>
              </summary>
              <div className="px-4 pb-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed break-keep">
                  {item.a}
                </p>
              </div>
            </details>
          ))}
        </div>
      </div>

      {/* 하단 CTA */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/dashboard"
          className="flex-1 text-center py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-colors"
        >
          지금 내 점수 확인하기 →
        </Link>
        <Link
          href="/support"
          className="flex-1 text-center py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold rounded-xl text-sm transition-colors"
        >
          Q&A 게시판에 문의하기 →
        </Link>
      </div>
    </div>
  );
}
