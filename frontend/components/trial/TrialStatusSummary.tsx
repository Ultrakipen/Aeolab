import type { ReactNode } from "react";
import { Check, AlertTriangle, X, Minus, Sparkles, Bot, FileText, PenLine } from "lucide-react";

interface TrialStatusSummaryProps {
  businessName: string;
  score: number;
  track1: number;
  track2: number;
  inBriefing: boolean | null;
  isSmartPlace: boolean;
  chatgptMentioned: boolean | undefined;
  chatgptSampleSize: number;
  blogCount: number;
  hasFaq: boolean;
  userGroup: string;
  gsLabel: string;
  categoryLabel: string;
  region: string;
}

function StatusRow({
  icon,
  iconBg,
  label,
  status,
  statusColor,
  value,
}: {
  icon: ReactNode;
  iconBg: string;
  label: string;
  status: "ok" | "warn" | "no" | "na";
  statusColor: string;
  value: string;
}) {
  const badgeMap = {
    ok:   { symbol: <Check className="w-3.5 h-3.5" />,         bg: "bg-green-500" },
    warn: { symbol: <AlertTriangle className="w-3.5 h-3.5" />, bg: "bg-yellow-400" },
    no:   { symbol: <X className="w-3.5 h-3.5" />,             bg: "bg-red-500" },
    na:   { symbol: <Minus className="w-3.5 h-3.5" />,         bg: "bg-gray-400" },
  };
  const badge = badgeMap[status];

  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-100 last:border-b-0">
      <div className="relative shrink-0">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg}`}>
          {icon}
        </div>
        <span className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-white ring-2 ring-white ${badge.bg}`}>
          {badge.symbol}
        </span>
      </div>
      <span className="text-sm font-semibold text-gray-800 flex-1 min-w-0 leading-tight">
        {label}
      </span>
      <span className={`text-sm font-bold shrink-0 ${statusColor}`}>{value}</span>
    </div>
  );
}

function getContextSentence(score: number, userGroup: string): {
  text: string;
  sub: string;
  bg: string;
  textColor: string;
  subColor: string;
} {
  if (userGroup === "INACTIVE" || userGroup === "franchise") {
    return {
      text: "네이버 AI 브리핑 대상이 아닌 업종입니다",
      sub: "ChatGPT·Gemini·Google AI 최적화로 글로벌 AI 노출을 높이는 것이 핵심입니다",
      bg: "bg-amber-50 border-amber-200",
      textColor: "text-amber-800",
      subColor: "text-amber-700",
    };
  }
  if (userGroup === "LIKELY") {
    return {
      text: "AI 탭 확장 예정 업종 — 지금은 ChatGPT·Gemini 최적화가 핵심",
      sub: "네이버 AI 브리핑 공식 대상 업종이 아닙니다. 스마트플레이스는 네이버 플레이스 노출에 도움이 됩니다.",
      bg: "bg-blue-50 border-blue-200",
      textColor: "text-blue-800",
      subColor: "text-blue-700",
    };
  }
  if (score >= 70) {
    return {
      text: "AI 검색에서 내 가게를 잘 찾을 수 있는 수준입니다",
      sub: "네이버 AI 브리핑 노출 안정권 — 지속 유지 관리가 중요합니다",
      bg: "bg-green-50 border-green-200",
      textColor: "text-green-800",
      subColor: "text-green-700",
    };
  }
  if (score >= 40) {
    return {
      text: "일부 AI에서 노출되지만 아직 개선이 필요합니다",
      sub: "ChatGPT·Gemini에서 내 가게를 잘 모르는 상태 — 콘텐츠 보완으로 노출 확률을 높일 수 있습니다",
      bg: "bg-amber-50 border-amber-200",
      textColor: "text-amber-800",
      subColor: "text-amber-700",
    };
  }
  return {
    text: "지금 AI가 내 가게를 거의 인식하지 못합니다",
    sub: "스마트플레이스 등록·소개글 작성부터 시작하면 점수가 빠르게 오릅니다",
    bg: "bg-red-50 border-red-200",
    textColor: "text-red-800",
    subColor: "text-red-700",
  };
}

function getConclusion(params: {
  inBriefing: boolean | null;
  isSmartPlace: boolean;
  hasFaq: boolean;
  userGroup: string;
}): string {
  const { inBriefing, isSmartPlace, hasFaq, userGroup } = params;

  if (inBriefing === true) {
    return "현재 네이버 AI 브리핑에 노출 중입니다. 유지·강화하세요.";
  }
  if (userGroup === "INACTIVE" || userGroup === "franchise") {
    return "ChatGPT·Gemini 최적화에 집중하세요.";
  }
  if (userGroup === "LIKELY") {
    return "스마트플레이스 등록·소개글 작성이 네이버 플레이스와 ChatGPT·Gemini 노출 향상의 핵심입니다.";
  }
  if (!isSmartPlace) {
    return "스마트플레이스 등록이 네이버 AI 브리핑 노출의 첫 단계입니다.";
  }
  if (isSmartPlace && !hasFaq) {
    return "소개글 Q&A 추가만으로 AI 브리핑 인용 후보가 될 수 있습니다.";
  }
  return "소개글 Q&A + 키워드 추가로 점수를 높일 수 있습니다.";
}

export default function TrialStatusSummary({
  businessName,
  score,
  track1,
  track2,
  inBriefing,
  isSmartPlace,
  chatgptMentioned,
  chatgptSampleSize,
  blogCount,
  hasFaq,
  userGroup,
  gsLabel,
  categoryLabel,
  region,
}: TrialStatusSummaryProps) {
  const scoreColor =
    score >= 70 ? "text-green-600" : score >= 40 ? "text-blue-600" : "text-red-500";
  const stageBadgeColor =
    score >= 70
      ? "bg-green-100 text-green-700"
      : score >= 40
        ? "bg-amber-100 text-amber-700"
        : "bg-red-100 text-red-700";

  const ctx = getContextSentence(score, userGroup);

  // 네이버 AI 브리핑 상태
  let briefingStatus: "ok" | "warn" | "no" | "na";
  let briefingValue: string;
  let briefingStatusColor: string;

  if (userGroup === "INACTIVE" || userGroup === "franchise") {
    briefingStatus = "na";
    briefingValue = userGroup === "franchise" ? "프랜차이즈 제외" : "비대상 업종";
    briefingStatusColor = "text-gray-400";
  } else if (userGroup === "LIKELY") {
    briefingStatus = "na";
    briefingValue = "확장 예정";
    briefingStatusColor = "text-blue-500";
  } else if (inBriefing === true) {
    briefingStatus = "ok";
    briefingValue = "노출 중";
    briefingStatusColor = "text-green-600";
  } else if (inBriefing === false) {
    briefingStatus = "no";
    briefingValue = "미노출";
    briefingStatusColor = "text-red-500";
  } else {
    briefingStatus = "na";
    briefingValue = "무료 체험 미포함";
    briefingStatusColor = "text-blue-600";
  }

  // ChatGPT 상태
  const chatgptStatus: "ok" | "no" = chatgptMentioned === true ? "ok" : "no";
  const chatgptValue = chatgptMentioned === true ? "언급됨" : "미언급";
  const chatgptStatusColor = chatgptMentioned === true ? "text-green-600" : "text-red-500";

  // 블로그 후기 상태
  const blogStatus: "ok" | "warn" | "no" =
    blogCount >= 10 ? "ok" : blogCount >= 3 ? "warn" : "no";
  const blogValue = `${blogCount}건`;
  const blogStatusColor =
    blogCount >= 10 ? "text-green-600" : blogCount >= 3 ? "text-yellow-600" : "text-red-500";

  // 소개글 Q&A 상태
  let faqStatus: "ok" | "no" | "na";
  let faqValue: string;
  let faqStatusColor: string;

  if (!isSmartPlace) {
    faqStatus = "na";
    faqValue = "스마트플레이스 미등록";
    faqStatusColor = "text-gray-400";
  } else if (hasFaq) {
    faqStatus = "ok";
    faqValue = "있음";
    faqStatusColor = "text-green-600";
  } else {
    faqStatus = "no";
    faqValue = "없음";
    faqStatusColor = "text-red-500";
  }

  const conclusion = getConclusion({ inBriefing, isSmartPlace, hasFaq, userGroup });

  return (
    <div className="bg-slate-50 border border-gray-200 rounded-xl shadow-sm mb-4 overflow-hidden">

      {/* ── 체감 문장 배너 ── */}
      <div className={`px-5 py-3 border-b ${ctx.bg}`}>
        <p className={`text-sm font-bold ${ctx.textColor} leading-snug`}>{ctx.text}</p>
        <p className={`text-sm ${ctx.subColor} mt-0.5 leading-relaxed`}>{ctx.sub}</p>
      </div>

      {/* PC: 2열 그리드 / 모바일: 1열 */}
      <div className="md:grid md:grid-cols-2 md:gap-0">
        {/* 좌측: 총점 + 성장단계 */}
        <div className="px-5 pt-4 pb-4 md:pb-5 border-b border-gray-100 md:border-b-0 md:border-r">
          <p className="text-sm font-semibold text-gray-700 mb-1">
            {businessName} AI 검색 현황
          </p>
          {categoryLabel && region && (
            <p className="text-sm text-gray-400 mb-2">
              {categoryLabel} · {region}
            </p>
          )}

          {/* 점수 */}
          <div className="flex items-end gap-3 mb-1 flex-wrap">
            <div className="flex items-end gap-1.5">
              <p className={`text-base font-bold mb-1 ${scoreColor}`}>
                {score >= 70 ? "잘 노출되고 있습니다" : score >= 40 ? "일부 AI에서 노출 중" : "아직 노출이 어려운 상태"}
              </p>
            </div>
          </div>
          <div className="flex items-end gap-3 mb-1 flex-wrap">
            <div className="flex items-end gap-1.5">
              <span className={`text-4xl font-black leading-none ${scoreColor}`}>
                {score}
              </span>
              <span className="text-lg text-gray-400 font-normal mb-1">/ 100</span>
            </div>
          </div>

          <div className="mb-3">
            <span className={`inline-block text-sm font-semibold rounded-full px-3 py-1 ${stageBadgeColor}`}>
              {gsLabel}
            </span>
          </div>

          {/* 트랙 분리 점수 + 점수 근거 링크 */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex gap-4 text-sm">
              <div>
                <span className="text-gray-400">네이버</span>
                <span className="ml-1.5 font-bold text-blue-700">{track1}점</span>
              </div>
              <div>
                <span className="text-gray-400">글로벌 AI</span>
                <span className="ml-1.5 font-bold text-gray-600">{track2}점</span>
              </div>
            </div>
            <a
              href="#score-breakdown"
              className="text-sm text-blue-500 underline underline-offset-2 hover:text-blue-700 transition-colors"
            >
              점수 계산 방법 ↓
            </a>
          </div>
        </div>

        {/* 우측: 4개 지표 */}
        <div className="px-5 pt-4 pb-2 md:pt-5">
          <p className="text-sm font-bold text-gray-700 mb-2">지금 어떤 AI가 내 가게를 알고 있나요?</p>
          <div>
            <StatusRow
              icon={<Sparkles className="w-5 h-5 text-green-600" />}
              iconBg="bg-green-50"
              label="네이버 AI 브리핑"
              status={briefingStatus}
              statusColor={briefingStatusColor}
              value={briefingValue}
            />
            <StatusRow
              icon={<Bot className="w-5 h-5 text-purple-600" />}
              iconBg="bg-purple-50"
              label="ChatGPT에서 내 가게 인식"
              status={chatgptStatus}
              statusColor={chatgptStatusColor}
              value={chatgptValue}
            />
            <StatusRow
              icon={<FileText className="w-5 h-5 text-blue-600" />}
              iconBg="bg-blue-50"
              label="블로그 후기 수"
              status={blogStatus}
              statusColor={blogStatusColor}
              value={blogValue}
            />
            <StatusRow
              icon={<PenLine className="w-5 h-5 text-orange-500" />}
              iconBg="bg-orange-50"
              label="소개글 Q&A 여부"
              status={faqStatus}
              statusColor={faqStatusColor}
              value={faqValue}
            />
          </div>
        </div>
      </div>

      {/* 한 줄 결론 */}
      <div className="px-5 pb-4 pt-3 border-t border-gray-100">
        <div className="bg-blue-50 rounded-xl px-4 py-3">
          <p className="text-sm font-semibold text-blue-800 leading-relaxed">
            {conclusion}
          </p>
        </div>
      </div>
    </div>
  );
}
