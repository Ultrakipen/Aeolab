"use client";

import { useState } from "react";
import Link from "next/link";
import { Zap, Clock, AlertTriangle, Mail, CheckCircle } from "lucide-react";
import { FIRST_MONTH_DISCOUNT_PRICES, PLAN_PRICES } from "@/lib/plans";

interface TodayOneActionProps {
  isSmartPlace: boolean;
  missingKws: string[];
  hasFaq: boolean;
  inBriefing: boolean | null;
  faqText: string | null;
  selectedTags: string[];
  categoryLabel: string;
  userGroup?: string;
  category?: string;
  isLoggedIn?: boolean;
  onDismissKw?: (kw: string) => void;
  trialId?: string;
}

type Urgency = "today" | "soon" | "week";

interface Action {
  title: string;
  desc: string;
  copy?: string;
  copyLabel?: string;
  time: string;
  primary?: boolean;
  urgency: Urgency;
}

const URGENCY_BADGE: Record<Urgency, { label: string; cls: string }> = {
  today: { label: "📌 오늘 바로", cls: "bg-red-100 text-red-700" },
  soon: { label: "📅 3일 이내", cls: "bg-orange-100 text-orange-700" },
  week: { label: "📅 7일 이내", cls: "bg-slate-100 text-slate-600" },
};

const URGENCY_BY_INDEX: Urgency[] = ["today", "soon", "week", "week", "week"];

function p(word: string, jong: "은는" | "을를" | "이가"): string {
  if (!word) return jong[1];
  const code = word.charCodeAt(word.length - 1);
  if (code < 0xac00 || code > 0xd7a3) return jong[1];
  return (code - 0xac00) % 28 !== 0 ? jong[0] : jong[1];
}

function getBusinessWord(category?: string): string {
  const menuCats = ["restaurant", "cafe", "bakery", "bar", "accommodation"];
  const programCats = ["fitness", "yoga", "pet"];
  const lessonCats = ["education", "tutoring"];
  if (category && menuCats.includes(category)) return "메뉴";
  if (category && programCats.includes(category)) return "프로그램";
  if (category && lessonCats.includes(category)) return "수업";
  return "서비스";
}

function ActionCard({
  action,
  index,
  isLoggedIn,
  onDismissKw,
  missingKws,
}: {
  action: Action;
  index: number;
  isLoggedIn?: boolean;
  onDismissKw?: (kw: string) => void;
  missingKws?: string[];
}) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const badge = URGENCY_BADGE[action.urgency];

  const handleCopy = async () => {
    if (!action.copy) return;
    try {
      await navigator.clipboard.writeText(action.copy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = action.copy;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } catch {
        setCopyFailed(true);
        setTimeout(() => setCopyFailed(false), 3000);
      }
    }
  };

  return (
    <div
      className={`rounded-xl p-4 md:p-5 ${
        action.primary
          ? "bg-white border-2 border-emerald-400 shadow-sm"
          : "bg-emerald-50 border border-emerald-200"
      }`}
    >
      {/* 타이밍 배지 + 순번 + 소요시간 */}
      <div className="flex items-center gap-2 mb-2.5">
        <span
          className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-black shrink-0 ${
            action.primary ? "bg-emerald-600 text-white" : "bg-emerald-200 text-emerald-700"
          }`}
        >
          {index + 1}
        </span>
        <span className={`text-xs font-bold rounded-full px-2.5 py-0.5 ${badge.cls}`}>
          {badge.label}
        </span>
        <span className="text-xs text-slate-400 flex items-center gap-1 ml-auto shrink-0">
          <Clock className="w-3 h-3" />
          {action.time}
        </span>
      </div>

      {/* 액션 제목 */}
      <p className="text-base md:text-lg font-bold text-emerald-900 leading-snug break-keep mb-2 pl-9">
        {action.title}
      </p>

      {/* 설명 */}
      <p className="text-sm text-emerald-800 leading-relaxed mb-3 break-keep pl-9">
        {action.desc}
      </p>

      {/* 복사 문구 박스 */}
      {action.copy && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 mb-3 ml-9">
          {action.copyLabel === "Q&A 문구 복사" && (
            <p className="flex items-center gap-1.5 text-xs text-amber-700 mb-1.5 font-semibold">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              복사 후 [ ] 안을 내 가게에 맞게 수정 → 스마트플레이스 소개글에 붙여넣기
            </p>
          )}
          <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-line break-keep">
            {action.copy}
          </p>
        </div>
      )}

      {/* 버튼 */}
      <div className="flex flex-col sm:flex-row gap-2 pl-9">
        {action.copy && (
          <button
            onClick={handleCopy}
            className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all ${
              copied
                ? "bg-emerald-500 text-white"
                : copyFailed
                ? "bg-amber-500 text-white"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            {copied
              ? "✓ 복사됨 — 스마트플레이스에 붙여넣으세요"
              : copyFailed
              ? "직접 선택 후 복사하세요"
              : action.copyLabel ?? "복사하기"}
          </button>
        )}
        {action.primary && !action.copy && (
          <a
            href={isLoggedIn ? "/dashboard" : "/signup?redirect=/dashboard"}
            className="flex-1 text-center py-2.5 rounded-lg font-bold text-sm bg-blue-600 hover:bg-blue-700 text-white transition-all"
          >
            {isLoggedIn ? "이렇게 따라하기" : "무료 가입 후 따라하기"}
          </a>
        )}
        {onDismissKw && missingKws && missingKws.length > 0 && (
          <button
            onClick={() => onDismissKw(missingKws[0])}
            className="flex-1 text-center py-2.5 rounded-lg text-sm font-medium text-emerald-700 border border-emerald-300 hover:bg-emerald-50 transition-colors"
          >
            이 키워드 건너뛰기
          </button>
        )}
      </div>
    </div>
  );
}

export default function TodayOneAction({
  isSmartPlace,
  missingKws,
  hasFaq,
  inBriefing,
  faqText,
  selectedTags,
  categoryLabel,
  userGroup,
  category,
  isLoggedIn,
  onDismissKw,
  trialId,
}: TodayOneActionProps) {
  const isGlobalFocus = userGroup === "INACTIVE" || userGroup === "franchise";
  const bw = getBusinessWord(category);

  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);

  const handleEmailSave = async () => {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@")) return;
    setEmailLoading(true);
    try {
      if (trialId) {
        await fetch(`/api/scan/trial/${trialId}/save-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: trimmed }),
        });
      }
      setEmailSent(true);
    } catch {
      setEmailSent(true);
    } finally {
      setEmailLoading(false);
    }
  };

  const actions: Action[] = [];

  if (isGlobalFocus) {
    if (!isSmartPlace) {
      actions.push({
        title: "Google 비즈니스 프로필 등록하기",
        desc: "ChatGPT·Google AI는 구글 데이터를 기반으로 가게를 추천합니다. business.google.com 무료 등록만으로 글로벌 AI 노출 가능성이 즉시 높아집니다.",
        time: "10분",
        primary: true,
        urgency: "today",
      });
    }
    if (missingKws.length > 0) {
      actions.push({
        title: `소개글에 '${missingKws[0]}' 관련 Q&A 추가하기`,
        desc: `ChatGPT·Gemini는 구조화된 텍스트를 학습합니다. '${missingKws[0]}' 관련 Q&A를 소개글이나 홈페이지에 추가하면 AI 인용 가능성이 높아집니다.`,
        copy:
          faqText ??
          `Q. ${missingKws[0]}에 대해 궁금한 점이 있어요.\nA. 저희 가게의 ${missingKws[0]} ${bw}에 대해 안내드립니다. 자세한 내용은 네이버 지도 채팅이나 전화로 문의해 주시면 친절하게 안내해 드리겠습니다.`,
        copyLabel: "Q&A 문구 복사",
        time: "5분",
        primary: !actions.length,
        urgency: URGENCY_BY_INDEX[actions.length] ?? "week",
      });
    }
    actions.push({
      title: "Google 비즈니스 프로필 정보 완성하기",
      desc: "영업시간·카테고리·사진·설명을 완성하면 ChatGPT·Google AI에 인용될 가능성이 높아집니다. business.google.com에서 직접 수정하세요.",
      time: "10분",
      primary: !actions.length,
      urgency: URGENCY_BY_INDEX[actions.length] ?? "week",
    });
    actions.push({
      title: "단골 고객에게 네이버 블로그 리뷰 부탁하기 → 검색 노출 ↑",
      desc: "블로그 리뷰가 쌓이면 네이버 검색 일반 탭 노출이 늘어납니다. '블로그에 솔직한 후기 남겨주시면 감사합니다'라고 방문 고객에게 부탁해 보세요.",
      time: "2분",
      primary: !actions.length,
      urgency: URGENCY_BY_INDEX[actions.length] ?? "week",
    });
  } else {
    if (!isSmartPlace) {
      actions.push({
        title: "스마트플레이스 등록하기",
        desc: "네이버 지도·플레이스에 가게를 등록하면 네이버 AI 브리핑·검색 노출에 나올 수 있습니다. smartplace.naver.com에서 무료로 등록하세요.",
        time: "10분",
        primary: true,
        urgency: "today",
      });
    }

    if (missingKws.length > 0 && !hasFaq) {
      const isActiveGroup = userGroup === "ACTIVE";
      actions.push({
        title: `소개글에 '${missingKws[0]}' 키워드 추가하기 → 네이버 검색 순위 ↑`,
        desc: isActiveGroup
          ? `'${missingKws[0]}' 키워드가 소개글에 없으면 경쟁 업체보다 네이버 검색 순위가 밀립니다. 스마트플레이스 → 업체정보 → 소개글에 아래 문구를 붙여넣으세요. 2~4주 내 네이버 AI 브리핑·검색 노출이 올라오고, 이후 수개월~1년 내 ChatGPT·Gemini에도 반영됩니다.`
          : `'${missingKws[0]}' 키워드가 소개글에 없으면 경쟁 업체보다 네이버 검색 순위가 밀립니다. 스마트플레이스 → 업체정보 → 소개글에 아래 문구를 붙여넣으세요. 네이버 AI탭(2~4주)과 ChatGPT·Gemini(수개월~1년) 노출에도 단계적으로 연결됩니다.`,
        copy:
          faqText ??
          `Q. ${missingKws[0]}${p(missingKws[0], "은는")} 어떤가요?\nA. 저희 가게의 ${missingKws[0]} ${bw}${p(bw, "을를")} 경험해 보세요. 궁금한 점은 네이버 채팅으로 편하게 문의해 주세요.`,
        copyLabel: "Q&A 문구 복사",
        time: "5분",
        primary: !actions.length,
        urgency: URGENCY_BY_INDEX[actions.length] ?? "week",
      });
    }

    if (missingKws.length > 0) {
      actions.push({
        title: `리뷰 답변에 '${missingKws[0]}' 언급하기 → 네이버 키워드 랭킹 ↑`,
        desc: `최근 받은 리뷰에 답변할 때 '${missingKws[0]}'를 자연스럽게 포함하세요. 리뷰 답변 텍스트는 네이버가 가게 키워드를 인식하는 중요한 신호입니다.`,
        copy: `소중한 리뷰 감사합니다. 앞으로도 ${missingKws[0]} 면에서 더 좋은 경험을 드리겠습니다. 또 방문해 주세요.`,
        copyLabel: "답변 문구 복사",
        time: "2분",
        primary: !actions.length,
        urgency: URGENCY_BY_INDEX[actions.length] ?? "week",
      });
    }

    const isExposed = inBriefing === true;
    const safeTag =
      selectedTags[0] && selectedTags[0].length <= 5 && !selectedTags[0].includes(" ")
        ? selectedTags[0]
        : null;
    actions.push({
      title: isExposed
        ? "소식 주 1회 업데이트 → 네이버 AI 브리핑 노출 순위 유지"
        : "소식 1개 등록 → 네이버 '운영 활발' 인식 → 검색 순위 상승",
      desc: isExposed
        ? "현재 네이버 AI 브리핑에 노출 중입니다. 주 1회 소식 작성으로 최신성 점수를 유지하면 검색 상위 순위를 지킬 수 있습니다."
        : "네이버는 최신 소식이 있는 가게를 '운영 활발'로 판단해 검색 상위에 올립니다. 스마트플레이스 → 소식 → 새 소식 작성으로 주 1회 업데이트하면 2~4주 내 효과가 나타납니다.",
      copy: safeTag
        ? `저희 ${categoryLabel}의 새 소식입니다.\n${safeTag} 관련 업데이트를 전해드립니다. 궁금하신 점은 네이버 채팅으로 문의해 주세요.`
        : `저희 ${categoryLabel}의 새 소식입니다.\n최근 업데이트된 내용을 안내드립니다. 방문해 주시는 모든 분께 감사드립니다.`,
      copyLabel: "소식 문구 복사",
      time: "5분",
      primary: !actions.length,
      urgency: URGENCY_BY_INDEX[actions.length] ?? "week",
    });
  }

  if (actions.length > 0 && !actions.some((a) => a.primary)) {
    actions[0] = { ...actions[0], primary: true };
  }

  return (
    <section className="bg-emerald-50 border-2 border-emerald-300 rounded-xl p-4 md:p-6 mb-4">
      {/* 헤더 */}
      <div className="flex items-start gap-2.5 mb-1">
        <Zap className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-base md:text-lg font-bold text-emerald-900">
            지금부터 할 일 — 순서대로 따라하기
          </p>
          <p className="text-sm text-emerald-700 mt-0.5 break-keep">
            아래 문구를 복사해서 스마트플레이스에 붙여넣으면 됩니다. 2~4주 내 네이버 순위 변화가 시작됩니다.
          </p>
        </div>
      </div>
      <div className="border-t border-emerald-200 mt-3 mb-3" />

      {/* 키워드 면책 */}
      {missingKws.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-3">
          <p className="text-xs text-amber-800 leading-relaxed">
            아래 키워드는 <strong>경쟁 가게 소개글 분석</strong>으로 자동 추출됐습니다. 내 가게에 안 맞는 키워드라면 건너뛰세요.
          </p>
        </div>
      )}

      {/* 액션 카드 — 전체 표시 */}
      <div className="space-y-3">
        {actions.map((action, i) => (
          <ActionCard
            key={i}
            action={action}
            index={i}
            isLoggedIn={isLoggedIn}
            onDismissKw={onDismissKw}
            missingKws={missingKws}
          />
        ))}
      </div>

      {/* 이메일 캡처 / 구독 CTA */}
      {!isLoggedIn && (
        <div className="mt-4 border-t border-emerald-200 pt-4">
          {emailSent ? (
            <div className="flex items-start gap-2.5 bg-white rounded-xl px-4 py-3.5 border border-emerald-300">
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-emerald-900">저장됐습니다</p>
                <p className="text-sm text-emerald-700 mt-0.5 break-keep">
                  이 플랜과 복사 문구를 이메일로 보내드렸습니다. 14일 후 네이버 순위 변화를 다시 측정해 드립니다.{" "}
                  <Link href="/signup" className="text-blue-600 font-semibold underline underline-offset-2">
                    구독하면 매주 자동 추적
                  </Link>
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 px-4 py-4">
              <div className="flex items-center gap-1.5 mb-0.5">
                <Mail className="w-4 h-4 text-slate-500" />
                <p className="text-sm font-bold text-slate-800">
                  이 개선 플랜과 문구를 이메일로 받아두세요
                </p>
              </div>
              <p className="text-sm text-slate-500 mb-3 break-keep">
                지금 바로 쓸 수 있는 Q&A·리뷰·소식 문구 +{" "}
                <strong className="text-slate-700">14일 후 무료 재측정</strong> 링크를 보내드립니다
              </p>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleEmailSave()}
                  placeholder="이메일 주소"
                  className="flex-1 border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent min-w-0"
                />
                <button
                  onClick={handleEmailSave}
                  disabled={emailLoading || !email.includes("@")}
                  className="shrink-0 bg-emerald-600 text-white font-bold text-sm px-4 py-2.5 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {emailLoading ? "..." : "무료 저장"}
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-1.5">구독 없이 무료 · 스팸 없음</p>
              <div className="flex items-center gap-2 my-3">
                <div className="flex-1 border-t border-slate-100" />
                <span className="text-xs text-slate-400">또는 구독으로 매주 자동 추적</span>
                <div className="flex-1 border-t border-slate-100" />
              </div>
              <Link
                href="/signup"
                className="block text-center py-2.5 rounded-lg font-bold text-sm bg-blue-600 hover:bg-blue-700 text-white transition-colors"
              >
                매주 자동 추적 시작 — 첫 달 {FIRST_MONTH_DISCOUNT_PRICES.basic.toLocaleString()}원
              </Link>
              <p className="text-xs text-center text-slate-400 mt-1">
                이후 월 {PLAN_PRICES.basic.toLocaleString()}원 · 언제든 해지
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
