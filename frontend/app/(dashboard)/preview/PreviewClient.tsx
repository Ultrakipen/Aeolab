"use client";

import { useState } from "react";
import Link from "next/link";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  Lock,
  CheckCircle2,
  TrendingUp,
  BarChart3,
  FileText,
  Users,
  Key,
  Zap,
  Star,
  MapPin,
  Globe,
  MessageSquare,
  Lightbulb,
  Download,
  Shield,
  Rocket,
  ChevronRight,
  Crown,
  AlertTriangle,
  XCircle,
  Copy,
  FileSpreadsheet,
  ClipboardList,
} from "lucide-react";
import type { ScanResult } from "@/types";

// ── 플랜 메타데이터 ──────────────────────────────────────────────
const PLAN_RANK: Record<string, number> = {
  free: 0,
  basic: 1,
  startup: 1.5,
  pro: 2,
  biz: 3,
  enterprise: 4,
};

const PLAN_LABEL: Record<string, string> = {
  free: "무료 체험",
  basic: "Basic",
  startup: "창업패키지",
  pro: "Pro",
  biz: "Biz",
  enterprise: "Enterprise",
};

const PLAN_PRICE: Record<string, string> = {
  free: "무료",
  basic: "9,900원/월",
  startup: "16,900원/월",
  pro: "22,900원/월",
  biz: "49,900원/월",
  enterprise: "200,000원/월",
};

const PLAN_COLOR: Record<
  string,
  { tab: string; active: string; badge: string; btn: string; border: string }
> = {
  free: {
    tab: "text-gray-600 hover:text-gray-800",
    active: "border-b-2 border-gray-700 text-gray-800 font-semibold",
    badge: "bg-gray-100 text-gray-700",
    btn: "bg-gray-700 hover:bg-gray-800 text-white",
    border: "border-gray-200",
  },
  basic: {
    tab: "text-blue-600 hover:text-blue-700",
    active: "border-b-2 border-blue-600 text-blue-700 font-semibold",
    badge: "bg-blue-100 text-blue-700",
    btn: "bg-blue-600 hover:bg-blue-700 text-white",
    border: "border-blue-200",
  },
  startup: {
    tab: "text-orange-600 hover:text-orange-700",
    active: "border-b-2 border-orange-500 text-orange-700 font-semibold",
    badge: "bg-orange-100 text-orange-700",
    btn: "bg-orange-500 hover:bg-orange-600 text-white",
    border: "border-orange-200",
  },
  pro: {
    tab: "text-indigo-600 hover:text-indigo-700",
    active: "border-b-2 border-indigo-600 text-indigo-700 font-semibold",
    badge: "bg-indigo-100 text-indigo-700",
    btn: "bg-indigo-600 hover:bg-indigo-700 text-white",
    border: "border-indigo-200",
  },
  biz: {
    tab: "text-emerald-600 hover:text-emerald-700",
    active: "border-b-2 border-emerald-600 text-emerald-700 font-semibold",
    badge: "bg-emerald-100 text-emerald-700",
    btn: "bg-emerald-600 hover:bg-emerald-700 text-white",
    border: "border-emerald-200",
  },
};

const TABS = ["free", "basic", "startup", "pro", "biz"] as const;
type TabKey = (typeof TABS)[number];

// ── 업종별 mock 데이터 ─────────────────────────────────────────────
const INDUSTRY_DATA = {
  cafe: {
    label: "카페",
    bizName: "강남 ○○카페",
    region: "강남구",
    keywords: ["강남 조용한 카페", "혼자 공부 카페", "반려견 카페"],
    competitors: ["△△커피 역삼", "□□브런치 선릉", "◇◇라떼 강남", "★★카페 삼성"],
    missingKeyword: "혼자 공부 카페",
    reviewText: "분위기 너무 좋아요! 또 오고 싶어요 :)",
    reviewReply:
      "감사합니다! 조용하고 편안한 공간이 마음에 드셨다니 기쁩니다. 공부나 작업하시기에도 좋은 환경을 계속 유지하겠습니다. 다음에 또 방문해주세요 :)",
    competitorCount: 247,
  },
  restaurant: {
    label: "음식점",
    bizName: "마포 ○○식당",
    region: "마포구",
    keywords: ["마포 혼밥 가능 식당", "1인 점심 마포", "마포 국밥 맛집"],
    competitors: ["△△설렁탕 합정", "□□한식 홍대", "◇◇백반 상암", "★★밥집 망원"],
    missingKeyword: "혼밥 가능 식당",
    reviewText: "음식이 정말 맛있어요. 양도 많고 가성비 최고!",
    reviewReply:
      "감사합니다! 정성껏 만든 음식이 맛있으셨다니 정말 보람됩니다. 혼밥도 편안하게 즐기실 수 있도록 항상 신경 쓰겠습니다. 다음에 또 오세요!",
    competitorCount: 312,
  },
  beauty: {
    label: "미용실",
    bizName: "홍대 ○○헤어",
    region: "마포구",
    keywords: ["홍대 남자 커트", "예약 없이 가능 미용실", "홍대 염색 잘하는 곳"],
    competitors: ["△△살롱 상수", "□□헤어 연남", "◇◇스튜디오 합정", "★★커트 홍대입구"],
    missingKeyword: "예약 없이 가능 미용실",
    reviewText: "원하는 스타일 딱 나왔어요! 실력 있으세요",
    reviewReply:
      "감사합니다! 원하시는 스타일로 완성되어서 저도 기쁩니다. 예약 없이도 편하게 오실 수 있으니 다음에 또 방문해주세요!",
    competitorCount: 183,
  },
  clinic: {
    label: "병원/의원",
    bizName: "강서 ○○의원",
    region: "강서구",
    keywords: ["강서 토요일 진료", "당일 예약 가능 내과", "강서 가족 주치의"],
    competitors: ["△△내과 발산", "□□의원 마곡", "◇◇클리닉 화곡", "★★가정의학과 등촌"],
    missingKeyword: "토요일 진료 가능",
    reviewText: "선생님이 친절하게 설명해주셔서 좋았어요",
    reviewReply:
      "내원해주셔서 감사합니다. 불편하신 점 없이 진료받으셨다니 다행입니다. 토요일에도 진료하고 있으니 필요하실 때 편하게 방문해주세요.",
    competitorCount: 98,
  },
};
type IndustryKey = keyof typeof INDUSTRY_DATA;

// ── 예시 데이터 ────────────────────────────────────────────────
const DEMO_TRACK1 = 38;
const DEMO_TRACK2 = 22;
const DEMO_UNIFIED = 32;
const DEMO_NAVER_WEIGHT = 0.65;
const DEMO_GLOBAL_WEIGHT = 0.35;
const DEMO_STAGE = "stability";
const DEMO_STAGE_LABEL = "안정 단계";

const TREND_DATA = [
  { day: "1월초", score: 22 },
  { day: "1월말", score: 25 },
  { day: "2월초", score: 27 },
  { day: "2월말", score: 29 },
  { day: "3월초", score: 31 },
  { day: "3월중", score: 33 },
  { day: "3월말", score: 35 },
  { day: "4월초", score: 37 },
  { day: "4월중", score: 38 },
  { day: "현재", score: 38 },
];

// ── 공통 UI 컴포넌트 ─────────────────────────────────────────────

function ImpactCard({
  lines,
  color,
}: {
  lines: { icon: string; text: string }[];
  color: "blue" | "orange" | "indigo" | "emerald" | "red";
}) {
  const colors = {
    blue: "bg-blue-600 text-white",
    orange: "bg-orange-500 text-white",
    indigo: "bg-indigo-600 text-white",
    emerald: "bg-emerald-600 text-white",
    red: "bg-red-50 border border-red-200 text-red-800",
  };
  return (
    <div className={`rounded-xl p-4 space-y-2 ${colors[color]}`}>
      {lines.map((line, i) => (
        <div key={i} className="flex items-start gap-2.5">
          <span className="text-lg leading-none shrink-0">{line.icon}</span>
          <p className="text-sm font-medium leading-snug">{line.text}</p>
        </div>
      ))}
    </div>
  );
}

function FeatureRow({
  label,
  available,
  note,
}: {
  label: string;
  available: boolean;
  note?: string;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0">
      {available ? (
        <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
      ) : (
        <XCircle className="w-5 h-5 text-gray-300 shrink-0 mt-0.5" />
      )}
      <div className="flex-1 min-w-0">
        <span
          className={`text-sm font-medium leading-snug ${
            available ? "text-gray-800" : "text-gray-400"
          }`}
        >
          {label}
        </span>
        {note && (
          <span className="ml-1.5 text-xs text-gray-400 font-normal">({note})</span>
        )}
      </div>
      {!available && (
        <span className="shrink-0 flex items-center gap-1 text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
          <Lock className="w-3 h-3" /> 잠금
        </span>
      )}
    </div>
  );
}

function LockedBlock({ requiredPlan }: { requiredPlan: string }) {
  return (
    <div className="relative rounded-xl overflow-hidden border border-dashed border-gray-300 bg-gray-50">
      <div className="blur-sm pointer-events-none select-none p-4 space-y-2">
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-3 bg-gray-200 rounded w-1/2" />
        <div className="h-3 bg-gray-200 rounded w-2/3" />
        <div className="h-8 bg-gray-200 rounded mt-2" />
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-white/60 backdrop-blur-[1px]">
        <Lock className="w-6 h-6 text-gray-400" />
        <p className="text-sm font-semibold text-gray-600">
          {PLAN_LABEL[requiredPlan]} 이상에서 사용 가능
        </p>
        <Link
          href="/pricing"
          className="text-xs text-blue-600 hover:text-blue-700 underline"
        >
          요금제 보기
        </Link>
      </div>
    </div>
  );
}

function ScoreBarDemo({
  label,
  score,
  color,
  weight,
}: {
  label: string;
  score: number;
  color: string;
  weight: number;
}) {
  return (
    <div className="bg-gray-50 rounded-xl p-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-semibold text-gray-700">{label}</span>
        <span className="text-lg font-bold text-gray-800">{score}점</span>
      </div>
      <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden mb-1">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${Math.min(100, score)}%` }}
        />
      </div>
      <span className="text-xs text-gray-400">최종 점수의 {Math.round(weight * 100)}%</span>
    </div>
  );
}

function SectionTitle({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-start gap-2.5 mb-3">
      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <h3 className="text-base font-bold text-gray-800 leading-snug">{title}</h3>
        {subtitle && <p className="text-sm text-gray-500 leading-snug">{subtitle}</p>}
      </div>
    </div>
  );
}

// ── AI 플랫폼 결과표 컴포넌트 ─────────────────────────────────────

const PLATFORM_RESULTS_DEMO = [
  { platform: "Gemini", exposed: true, keywords: "강남 카페, 분위기 좋은 카페" },
  { platform: "ChatGPT", exposed: false, keywords: "—" },
  { platform: "Perplexity", exposed: true, keywords: "조용한 카페" },
  { platform: "네이버 AI", exposed: true, keywords: "강남역 카페" },
  { platform: "Grok", exposed: false, keywords: "—" },
  { platform: "Claude", exposed: true, keywords: "카페 추천" },
  { platform: "Google AI", exposed: false, keywords: "—" },
];

function PlatformResultTable({ showAll }: { showAll: boolean }) {
  const rows = showAll
    ? PLATFORM_RESULTS_DEMO
    : PLATFORM_RESULTS_DEMO.slice(0, 1);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[360px] text-sm">
        <thead>
          <tr className="bg-gray-50 text-left">
            <th className="py-2 px-3 text-xs font-semibold text-gray-500 w-28">AI 플랫폼</th>
            <th className="py-2 px-3 text-xs font-semibold text-gray-500 w-24">노출 여부</th>
            <th className="py-2 px-3 text-xs font-semibold text-gray-500">노출 키워드</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row) => (
            <tr key={row.platform}>
              <td className="py-2 px-3 font-medium text-gray-700">{row.platform}</td>
              <td className="py-2 px-3">
                {row.exposed ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 rounded-full px-2 py-0.5">
                    <CheckCircle2 className="w-3 h-3" /> 노출
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
                    <XCircle className="w-3 h-3" /> 미노출
                  </span>
                )}
              </td>
              <td className="py-2 px-3 text-gray-500">{row.keywords}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!showAll && (
        <div className="relative mt-1">
          <div className="space-y-1 blur-[2px] pointer-events-none select-none px-3 py-2">
            {PLATFORM_RESULTS_DEMO.slice(1).map((row) => (
              <div key={row.platform} className="flex gap-3">
                <div className="h-3 bg-gray-200 rounded w-20" />
                <div className="h-3 bg-gray-200 rounded w-16" />
                <div className="h-3 bg-gray-200 rounded w-32" />
              </div>
            ))}
          </div>
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 gap-1.5 rounded">
            <Lock className="w-4 h-4 text-gray-400" />
            <span className="text-xs font-medium text-gray-500">Basic 이상에서 전체 공개 (7개 AI)</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 각 탭 컨텐츠 ─────────────────────────────────────────────────

function FreeTab({
  scan,
  isCurrentPlan,
  industry,
}: {
  scan: ScanResult | null;
  isCurrentPlan: boolean;
  industry: IndustryKey;
}) {
  const d = INDUSTRY_DATA[industry];
  const track1 = scan?.track1_score ?? DEMO_TRACK1;
  const stageLabel = scan?.growth_stage_label ?? DEMO_STAGE_LABEL;
  const stage = scan?.growth_stage ?? DEMO_STAGE;

  const STAGE_COLOR: Record<string, string> = {
    survival: "bg-red-100 text-red-700",
    stability: "bg-yellow-100 text-yellow-700",
    growth: "bg-blue-100 text-blue-700",
    dominance: "bg-green-100 text-green-700",
  };

  return (
    <div className="space-y-5">
      {/* 임팩트 카드 */}
      <ImpactCard
        color="red"
        lines={[
          {
            icon: "⚠️",
            text: `지금 ${d.bizName}이 ChatGPT·Perplexity에서 어떻게 보이는지 모르고 있습니다`,
          },
          {
            icon: "📍",
            text: "경쟁사는 이미 AI 브리핑에 노출되어 손님을 가져가고 있을 수 있습니다",
          },
        ]}
      />

      {/* ① 설명 배너 */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
        <p className="text-sm font-semibold text-gray-700 mb-1">
          무료 체험 — Gemini AI 1회 스캔
        </p>
        <p className="text-sm text-gray-500 leading-relaxed">
          로그인 없이 지금 바로 내 가게의 AI 검색 노출 준비도를 확인합니다.
          성장 단계와 핵심 키워드 3개를 즉시 확인할 수 있습니다.
        </p>
      </div>

      {/* ② 결과 미리보기 — 점수 */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <SectionTitle
          icon={<BarChart3 className="w-4 h-4 text-gray-500" />}
          title="네이버 AI 브리핑 준비도"
          subtitle="Gemini 10회 샘플링 기반 즉시 진단"
        />
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <span className="text-sm font-medium text-gray-700">준비 점수</span>
          <span className="text-2xl font-extrabold text-indigo-600">{track1}점</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">성장 단계</span>
          <span
            className={`text-sm font-semibold rounded-full px-2.5 py-0.5 ${
              STAGE_COLOR[stage] ?? STAGE_COLOR.stability
            }`}
          >
            {stageLabel}
          </span>
        </div>
      </div>

      {/* ② 결과 미리보기 — AI 플랫폼 결과표 */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <SectionTitle
          icon={<Globe className="w-4 h-4 text-gray-500" />}
          title="AI 플랫폼별 노출 여부"
          subtitle="Gemini 결과 공개 · 나머지 6개는 Basic 이상"
        />
        <PlatformResultTable showAll={false} />
      </div>

      {/* ② 결과 미리보기 — 개선 방향 1개 공개 + 잠금 */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
        <SectionTitle
          icon={<Lightbulb className="w-4 h-4 text-amber-500" />}
          title="개선 방향 미리보기"
          subtitle="1개 무료 공개 · 나머지는 Basic 이상"
        />
        <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
          <p className="text-sm font-semibold text-amber-800 mb-0.5">
            스마트플레이스 FAQ 등록
          </p>
          <p className="text-sm text-amber-700 leading-relaxed">
            주차 가능 여부, 단체 예약 가능 여부를 FAQ에 등록하면 AI 브리핑 노출 확률이 즉시 높아집니다.
          </p>
        </div>
        <div className="relative rounded-lg overflow-hidden border border-dashed border-gray-300">
          <div className="blur-[2px] p-3 space-y-1.5 pointer-events-none select-none">
            <div className="h-3 bg-gray-200 rounded w-2/3" />
            <div className="h-3 bg-gray-200 rounded w-1/2" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 gap-1.5">
            <Lock className="w-4 h-4 text-gray-400" />
            <span className="text-xs font-medium text-gray-500">Basic 이상에서 전체 공개</span>
          </div>
        </div>
      </div>

      {/* ③ 기능 목록 */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <SectionTitle
          icon={<Star className="w-4 h-4 text-gray-500" />}
          title="무료 체험 포함 내용"
        />
        <div className="divide-y divide-gray-50">
          <FeatureRow label="Gemini AI 1회 스캔" available={true} />
          <FeatureRow label="네이버 AI 브리핑 준비도 점수" available={true} />
          <FeatureRow label="성장 단계 진단" available={true} />
          <FeatureRow label="개선 방향 1개 공개" available={true} />
          <FeatureRow label="AI 7개 전체 결과" available={false} />
          <FeatureRow label="경쟁사 비교" available={false} />
          <FeatureRow label="자동 스캔" available={false} />
          <FeatureRow label="리뷰 답변 초안" available={false} />
        </div>
      </div>

      {/* ④ CTA */}
      <div className="rounded-xl bg-blue-600 p-5 text-white text-center space-y-2">
        <p className="text-base font-bold">전체 분석 + 매주 자동 업데이트</p>
        <p className="text-sm opacity-90">월 9,900원으로 매주 AI 7개 자동 추적</p>
        <Link
          href="/signup?plan=basic"
          className="inline-flex items-center gap-1.5 mt-1 bg-white text-blue-600 text-sm font-bold rounded-lg px-5 py-2.5 hover:bg-blue-50 transition-colors"
        >
          Basic 시작하기 <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {isCurrentPlan && (
        <p className="text-center text-sm text-gray-500">
          현재 무료 체험 상태입니다.{" "}
          <Link href="/trial" className="text-blue-600 hover:underline">
            지금 체험하기 →
          </Link>
        </p>
      )}
    </div>
  );
}

function BasicTab({
  scan,
  isCurrentPlan,
  isAlreadyOwned,
  industry,
}: {
  scan: ScanResult | null;
  isCurrentPlan: boolean;
  isAlreadyOwned: boolean;
  industry: IndustryKey;
}) {
  const [copied, setCopied] = useState(false);
  const d = INDUSTRY_DATA[industry];
  const track1 = scan?.track1_score ?? DEMO_TRACK1;
  const track2 = scan?.track2_score ?? DEMO_TRACK2;
  const unified = scan?.unified_score ?? scan?.total_score ?? DEMO_UNIFIED;
  const naverWeight = scan?.naver_weight ?? DEMO_NAVER_WEIGHT;
  const globalWeight = scan?.global_weight ?? DEMO_GLOBAL_WEIGHT;

  function handleCopy() {
    navigator.clipboard.writeText(d.reviewReply);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-5">
      {/* 임팩트 카드 */}
      <ImpactCard
        color="blue"
        lines={[
          {
            icon: "📊",
            text: `매주 월요일 AI 7개가 ${d.bizName}을 얼마나 추천하는지 자동으로 추적합니다`,
          },
          {
            icon: "🎯",
            text: `"${d.missingKeyword}" 키워드로 검색하는 손님이 지금 경쟁사 가게로 가고 있습니다`,
          },
          {
            icon: "💬",
            text: "리뷰 답변 하나하나에 핵심 키워드를 자연스럽게 심어 AI 노출을 높입니다",
          },
        ]}
      />

      {/* ① 설명 */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm font-semibold text-blue-800 mb-1">
          Basic — 9,900원/월
        </p>
        <p className="text-sm text-blue-700 leading-relaxed">
          매주 월요일 AI 7개 자동 스캔 + 경쟁사 3곳 비교. 커피 한 잔 값으로 내 가게가 AI에서
          어떻게 보이는지 매주 자동으로 추적합니다.
        </p>
      </div>

      {/* ② 결과 미리보기 — 듀얼트랙 점수 */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <SectionTitle
            icon={<BarChart3 className="w-4 h-4 text-indigo-500" />}
            title="듀얼트랙 AI 가시성 점수"
            subtitle="네이버 브리핑 + 글로벌 AI 통합 분석"
          />
          <div className="text-right shrink-0">
            <div className="text-2xl font-extrabold text-indigo-600">
              {Math.round(unified)}
              <span className="text-sm font-normal text-gray-400">점</span>
            </div>
            <span className="text-xs text-gray-400">통합 점수</span>
          </div>
        </div>
        <ScoreBarDemo
          label="네이버 AI 브리핑 점수"
          score={Math.round(track1)}
          color="bg-green-500"
          weight={naverWeight}
        />
        <ScoreBarDemo
          label="글로벌 AI 노출 점수"
          score={Math.round(track2)}
          color="bg-blue-500"
          weight={globalWeight}
        />
        {!scan && (
          <p className="text-xs text-gray-400 text-center">
            * 예시 데이터입니다. 실제 스캔 후 내 사업장 점수로 표시됩니다.
          </p>
        )}
      </div>

      {/* ② 결과 미리보기 — AI 플랫폼 전체 결과표 */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <SectionTitle
          icon={<Globe className="w-4 h-4 text-blue-500" />}
          title="AI 플랫폼별 노출 결과표"
          subtitle="7개 AI 전체 노출 현황 · 매주 자동 업데이트"
        />
        <PlatformResultTable showAll={true} />
        <p className="text-xs text-gray-400 mt-2">* 예시 데이터입니다.</p>
      </div>

      {/* ② 결과 미리보기 — 리뷰 답변 초안 */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <SectionTitle
          icon={<MessageSquare className="w-4 h-4 text-blue-500" />}
          title="리뷰 답변 초안 미리보기"
          subtitle="AI가 키워드를 포함한 답변을 자동 생성"
        />
        <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
          <p className="text-xs font-semibold text-gray-500 mb-1.5">고객 리뷰</p>
          <p className="text-sm text-gray-700 font-medium mb-3">"{d.reviewText}"</p>
          <p className="text-xs font-semibold text-gray-500 mb-1.5">AI 생성 답변 초안</p>
          <p className="text-sm text-gray-700 leading-relaxed">{d.reviewReply}</p>
          <button
            onClick={handleCopy}
            className="mt-2.5 inline-flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg px-3 py-1.5 font-medium transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
            {copied ? "복사됨!" : "복사"}
          </button>
        </div>
        <div className="relative rounded-lg overflow-hidden border border-dashed border-gray-300">
          <div className="blur-[2px] p-3 space-y-2 pointer-events-none select-none">
            <p className="text-xs text-gray-400">부정 리뷰 답변 초안</p>
            <div className="h-3 bg-gray-200 rounded w-full" />
            <div className="h-3 bg-gray-200 rounded w-4/5" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 gap-1.5">
            <Lock className="w-4 h-4 text-gray-400" />
            <span className="text-xs font-medium text-gray-500">월 10회 제공 · Basic 포함</span>
          </div>
        </div>
      </div>

      {/* ② 결과 미리보기 — 30일 추세 차트 */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <SectionTitle
          icon={<TrendingUp className="w-4 h-4 text-blue-500" />}
          title="30일 점수 추세"
          subtitle="매주 자동 스캔으로 성장 궤적 추적"
        />
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={TREND_DATA} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <XAxis
                dataKey="day"
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={[10, 50]}
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#6366f1"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "#6366f1" }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-gray-400 text-center mt-1">* 예시 데이터</p>
      </div>

      {/* ② 결과 미리보기 — 경쟁사 비교 (최대 3개) */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <SectionTitle
          icon={<TrendingUp className="w-4 h-4 text-blue-500" />}
          title="경쟁사 비교 (최대 3개)"
          subtitle="내 가게 vs 인근 경쟁사 점수 비교"
        />
        <div className="space-y-2">
          {[d.bizName, d.competitors[0], d.competitors[1]].map((name, i) => {
            const scores = [Math.round(unified), 54, 41];
            const isMe = i === 0;
            return (
              <div key={name} className="flex items-center gap-3">
                <span
                  className={`text-sm font-medium w-24 shrink-0 truncate ${
                    isMe ? "text-indigo-700 font-bold" : "text-gray-600"
                  }`}
                >
                  {name}
                </span>
                <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${isMe ? "bg-indigo-500" : "bg-gray-400"}`}
                    style={{ width: `${scores[i]}%` }}
                  />
                </div>
                <span
                  className={`text-sm font-bold w-10 text-right shrink-0 ${
                    isMe ? "text-indigo-700" : "text-gray-500"
                  }`}
                >
                  {scores[i]}점
                </span>
              </div>
            );
          })}
          <p className="text-xs text-gray-400 mt-1">* 예시 데이터</p>
        </div>
        <div className="mt-3 pt-3 border-t border-gray-100">
          <LockedBlock requiredPlan="startup" />
          <p className="text-xs text-gray-400 text-center mt-1.5">
            경쟁사 5~10개는 창업패키지 / Pro 이상
          </p>
        </div>
      </div>

      {/* ③ 기능 목록 */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <SectionTitle
          icon={<Star className="w-4 h-4 text-blue-500" />}
          title="Basic 포함 기능"
        />
        <div className="divide-y divide-gray-50">
          <FeatureRow label="매주 월요일 AI 7개 자동 스캔" available={true} />
          <FeatureRow label="경쟁사 비교" available={true} note="최대 3곳" />
          <FeatureRow label="AI 개선 가이드" available={true} note="월 5회" />
          <FeatureRow label="리뷰 답변 초안 생성" available={true} note="월 10회" />
          <FeatureRow label="30일 성장 추세 그래프" available={true} />
          <FeatureRow label="스마트플레이스 AI 검색 최적화 자동 생성" available={true} />
          <FeatureRow label="수동 스캔" available={true} note="하루 2회" />
          <FeatureRow label="CSV 내보내기" available={false} />
          <FeatureRow label="PDF 리포트" available={false} />
          <FeatureRow label="팀 계정" available={false} />
          <FeatureRow label="API 키" available={false} />
        </div>
      </div>

      {/* ④ CTA */}
      {isAlreadyOwned ? (
        <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 text-center">
          <CheckCircle2 className="w-6 h-6 text-blue-500 mx-auto mb-1.5" />
          <p className="text-sm font-semibold text-blue-700">
            {isCurrentPlan ? "현재 이용 중인 플랜입니다" : "사장님의 플랜에 이미 포함되어 있습니다"}
          </p>
        </div>
      ) : (
        <div className="rounded-xl bg-blue-600 p-5 text-white text-center space-y-2">
          <p className="text-base font-bold">Basic 시작하기</p>
          <p className="text-sm opacity-90">월 9,900원 · 언제든 해지 가능</p>
          <Link
            href="/signup?plan=basic"
            className="inline-flex items-center gap-1.5 mt-1 bg-white text-blue-600 text-sm font-bold rounded-lg px-5 py-2.5 hover:bg-blue-50 transition-colors"
          >
            1분 무료 회원가입 <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      )}
    </div>
  );
}

function StartupTab({
  scan,
  isCurrentPlan,
  isAlreadyOwned,
  industry,
}: {
  scan: ScanResult | null;
  isCurrentPlan: boolean;
  isAlreadyOwned: boolean;
  industry: IndustryKey;
}) {
  const d = INDUSTRY_DATA[industry];

  return (
    <div className="space-y-5">
      {/* 임팩트 카드 */}
      <ImpactCard
        color="orange"
        lines={[
          {
            icon: "🏪",
            text: `${d.region} ${d.label} 업종 경쟁자 ${d.competitorCount}개 중 AI에서 상위 노출되는 곳이 어디인지 알 수 있습니다`,
          },
          {
            icon: "📍",
            text: "입지 선정 전에 AI가 어떤 위치를 먼저 추천하는지 확인하면 창업 실패 확률이 낮아집니다",
          },
          {
            icon: "🔑",
            text: `아직 경쟁이 적은 틈새 키워드 "${d.keywords[0]}"로 오픈 첫 달부터 AI 노출 선점 가능합니다`,
          },
        ]}
      />

      {/* ① 설명 */}
      <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
        <p className="text-sm font-semibold text-orange-800 mb-1">
          창업패키지 — 16,900원/월
        </p>
        <p className="text-sm text-orange-700 leading-relaxed">
          오픈 전 이 지역·업종에 경쟁자가 몇 명인지, AI가 누구를 먼저 추천하는지 분석합니다.
          창업 실패를 줄이는 데이터 기반 입지·포지셔닝 분석.
        </p>
      </div>

      {/* ② 결과 미리보기 — 경쟁 강도 현황 */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <SectionTitle
          icon={<Rocket className="w-4 h-4 text-orange-500" />}
          title="업종·지역 경쟁 강도 분석"
          subtitle={`${d.region} ${d.label} 업종 경쟁 현황 (예시)`}
        />
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-orange-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-extrabold text-orange-600">{d.competitorCount}</p>
            <p className="text-xs text-orange-700 mt-0.5">등록 사업자 수</p>
          </div>
          <div className="bg-red-50 rounded-lg p-3 text-center">
            <p className="text-lg font-extrabold text-red-600">★★★★☆</p>
            <p className="text-xs text-red-700 mt-0.5">진입 난이도 높음</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-extrabold text-blue-600">71점</p>
            <p className="text-xs text-blue-700 mt-0.5">상위 10% 평균</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-lg font-extrabold text-gray-500">?점</p>
            <p className="text-xs text-gray-500 mt-0.5">내 예상 (스캔 후)</p>
          </div>
        </div>
        <p className="text-xs text-gray-400">* 예시 데이터입니다.</p>
      </div>

      {/* ② 결과 미리보기 — 틈새 키워드 */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <SectionTitle
          icon={<Lightbulb className="w-4 h-4 text-orange-500" />}
          title="틈새 키워드 발굴"
          subtitle="경쟁이 낮고 노출 기회가 높은 키워드"
        />
        <div className="space-y-2">
          {d.keywords.map((kw, i) => (
            <div
              key={kw}
              className="flex items-center gap-2 p-2.5 bg-emerald-50 rounded-lg border border-emerald-100"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold text-gray-800">"{kw}"</span>
                <span className="ml-2 text-xs font-medium text-emerald-600">
                  {i === 0 ? "경쟁도 낮음" : i === 1 ? "노출 기회 높음" : "신규 수요 발생 중"}
                </span>
              </div>
            </div>
          ))}
          <div className="relative rounded-lg overflow-hidden border border-dashed border-gray-300">
            <div className="blur-[2px] p-2.5 space-y-1 pointer-events-none select-none">
              <div className="h-4 bg-gray-200 rounded w-3/5" />
              <div className="h-4 bg-gray-200 rounded w-2/3" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center bg-white/70 gap-1.5">
              <Lock className="w-4 h-4 text-gray-400" />
              <span className="text-xs font-medium text-gray-500">더보기 (창업패키지 전용)</span>
            </div>
          </div>
        </div>
      </div>

      {/* ② 결과 미리보기 — 창업 시장 분석 리포트 */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <SectionTitle
          icon={<FileText className="w-4 h-4 text-orange-500" />}
          title="창업 시장 분석 리포트"
          subtitle="AI가 누구를 먼저 추천하는지 경쟁 지도"
        />
        <div className="space-y-3">
          <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3">
            <p className="text-xs font-semibold text-emerald-700 mb-1.5">
              현재 AI 노출 상위 업체 (예시)
            </p>
            <div className="space-y-1.5">
              {d.competitors.slice(0, 3).map((name, i) => (
                <div key={name} className="flex items-center gap-2">
                  <span className="text-xs font-bold text-emerald-600 w-4">{i + 1}</span>
                  <span className="text-sm text-gray-700 flex-1">{name}</span>
                  <span className="text-sm font-bold text-emerald-700">
                    {[71, 65, 58][i]}점
                  </span>
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs text-gray-400">* 예시 데이터입니다.</p>
        </div>
      </div>

      {/* ③ 기능 목록 */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <SectionTitle
          icon={<Star className="w-4 h-4 text-orange-500" />}
          title="창업패키지 포함 기능"
        />
        <div className="divide-y divide-gray-50">
          <FeatureRow label="창업 시장 분석 리포트 (업종·지역 경쟁 강도)" available={true} />
          <FeatureRow label="시장 진입 난이도 + 틈새 키워드 발굴" available={true} />
          <FeatureRow label="경쟁사 비교" available={true} note="최대 5개" />
          <FeatureRow label="매주 월요일 AI 7개 자동 스캔" available={true} />
          <FeatureRow label="AI 개선 가이드" available={true} note="월 5회" />
          <FeatureRow label="리뷰 답변 초안 생성" available={true} note="월 20회" />
          <FeatureRow label="CSV 내보내기" available={true} />
          <FeatureRow label="90일 성장 추이" available={true} />
          <FeatureRow label="수동 스캔" available={true} note="하루 3회" />
          <FeatureRow label="PDF 리포트" available={false} />
          <FeatureRow label="ChatGPT 광고 대응 가이드" available={false} />
          <FeatureRow label="팀 계정" available={false} />
          <FeatureRow label="API 키" available={false} />
        </div>
      </div>

      {/* ④ CTA */}
      {isAlreadyOwned ? (
        <div className="rounded-xl bg-orange-50 border border-orange-200 p-4 text-center">
          <CheckCircle2 className="w-6 h-6 text-orange-500 mx-auto mb-1.5" />
          <p className="text-sm font-semibold text-orange-700">
            {isCurrentPlan ? "현재 이용 중인 플랜입니다" : "사장님의 플랜에 이미 포함되어 있습니다"}
          </p>
          <Link href="/startup" className="text-sm text-orange-600 hover:underline mt-1 block">
            창업 시장 분석 바로가기 →
          </Link>
        </div>
      ) : (
        <div className="rounded-xl bg-orange-500 p-5 text-white text-center space-y-2">
          <p className="text-base font-bold">창업패키지 시작하기</p>
          <p className="text-sm opacity-90">월 16,900원 · 창업 준비부터 오픈 후까지</p>
          <Link
            href="/signup?plan=startup"
            className="inline-flex items-center gap-1.5 mt-1 bg-white text-orange-600 text-sm font-bold rounded-lg px-5 py-2.5 hover:bg-orange-50 transition-colors"
          >
            시작하기 <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      )}
    </div>
  );
}

function ProTab({
  scan,
  isCurrentPlan,
  isAlreadyOwned,
  industry,
}: {
  scan: ScanResult | null;
  isCurrentPlan: boolean;
  isAlreadyOwned: boolean;
  industry: IndustryKey;
}) {
  const [guideCopied, setGuideCopied] = useState<number | null>(null);
  const d = INDUSTRY_DATA[industry];
  const track1 = scan?.track1_score ?? DEMO_TRACK1;
  const track2 = scan?.track2_score ?? DEMO_TRACK2;

  const GUIDE_ACTIONS = [
    `스마트플레이스 FAQ에 "${d.missingKeyword} 가능한가요?" 등록`,
    `소식 탭에 "${d.keywords[1] ?? d.keywords[0]}" 관련 포스팅`,
  ];

  function handleGuideCopy(idx: number, text: string) {
    navigator.clipboard.writeText(text);
    setGuideCopied(idx);
    setTimeout(() => setGuideCopied(null), 2000);
  }

  return (
    <div className="space-y-5">
      {/* 임팩트 카드 */}
      <ImpactCard
        color="indigo"
        lines={[
          {
            icon: "⏱️",
            text: "경쟁사가 AI 브리핑에서 앞서기 시작하면 3일 안에 알 수 있습니다 (주 3회 자동 스캔)",
          },
          {
            icon: "🛡️",
            text: "ChatGPT 광고가 한국에 도입되면 유기 노출 자산이 있는 가게가 광고비 없이 버팁니다",
          },
          {
            icon: "📄",
            text: "PDF 리포트로 가게 성장을 수치로 증명 — 임대료 협상·금융 지원 자료로 활용 가능",
          },
        ]}
      />

      {/* ① 설명 */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-sm font-semibold text-indigo-800">Pro — 22,900원/월</p>
          <span className="text-xs bg-indigo-100 text-indigo-700 rounded-full px-2 py-0.5 font-medium">
            ROI 최강
          </span>
        </div>
        <p className="text-sm text-indigo-700 leading-relaxed">
          월·수·금 주 3회 전체 AI 분석 + 경쟁사 10곳 비교. 경쟁사 변화를 3일 안에 포착하고
          ChatGPT 광고 대응까지 선제 준비합니다.
        </p>
      </div>

      {/* ② 결과 미리보기 — AI 개선 가이드 */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <SectionTitle
          icon={<ClipboardList className="w-4 h-4 text-indigo-500" />}
          title="이번 달 AI 개선 가이드"
          subtitle={`${d.label} 업종 · 안정 단계 맞춤 액션 플랜`}
        />
        <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-indigo-600 bg-indigo-100 rounded-full px-2 py-0.5">
              핵심 목표
            </span>
            <span className="text-sm font-semibold text-indigo-800">
              "{d.missingKeyword}" 키워드 AI 노출 달성
            </span>
          </div>
          <div className="pt-1 space-y-1.5">
            <p className="text-xs font-semibold text-gray-500">이번 주 할 것</p>
            {GUIDE_ACTIONS.map((action, i) => (
              <div
                key={i}
                className="flex items-start gap-2 p-2 bg-white rounded-lg border border-indigo-100"
              >
                <span className="text-xs font-bold text-indigo-600 mt-0.5 shrink-0">{i + 1}.</span>
                <span className="text-sm text-gray-700 flex-1 leading-snug">{action}</span>
                <button
                  onClick={() => handleGuideCopy(i, action)}
                  className="shrink-0 text-xs text-indigo-500 hover:text-indigo-700 flex items-center gap-0.5"
                >
                  <Copy className="w-3 h-3" />
                  {guideCopied === i ? "복사됨" : "복사"}
                </button>
              </div>
            ))}
          </div>
          <div className="pt-1">
            <p className="text-xs font-semibold text-red-500 mb-1">하지 말 것</p>
            <div className="flex items-center gap-2 text-sm text-red-600">
              <XCircle className="w-4 h-4 shrink-0" />
              리뷰 이벤트 (네이버 정책 위반)
            </div>
          </div>
        </div>
        <p className="text-xs text-gray-400">* 예시 데이터입니다. 월 8회 제공.</p>
      </div>

      {/* ② 결과 미리보기 — 경쟁사 10곳 비교 */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <SectionTitle
          icon={<BarChart3 className="w-4 h-4 text-indigo-500" />}
          title="경쟁사 10곳 비교 분석"
          subtitle="키워드 갭 + 순위 변화 3일 주기 업데이트"
        />
        <div className="space-y-1.5">
          {[d.bizName, ...d.competitors].slice(0, 5).map((name, i) => {
            const scores = [Math.round((track1 + track2) / 2), 68, 61, 54, 47];
            const isMe = i === 0;
            return (
              <div key={name} className="flex items-center gap-3">
                <span
                  className={`text-sm font-medium w-24 shrink-0 truncate ${
                    isMe ? "text-indigo-700 font-bold" : "text-gray-600"
                  }`}
                >
                  {name}
                </span>
                <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${isMe ? "bg-indigo-500" : "bg-gray-300"}`}
                    style={{ width: `${scores[i]}%` }}
                  />
                </div>
                <span
                  className={`text-sm font-bold w-10 text-right shrink-0 ${
                    isMe ? "text-indigo-700" : "text-gray-500"
                  }`}
                >
                  {scores[i]}점
                </span>
              </div>
            );
          })}
          <p className="text-xs text-gray-400">+ 5곳 더 (최대 10개) · 예시 데이터</p>
        </div>
      </div>

      {/* ② 결과 미리보기 — PDF 리포트 */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <SectionTitle
          icon={<FileText className="w-4 h-4 text-indigo-500" />}
          title="PDF 리포트 다운로드"
          subtitle="월 1회 자동 생성 · 공유·보관 가능"
        />
        <div className="border border-dashed border-indigo-200 rounded-xl p-4 bg-indigo-50">
          <div className="flex items-start gap-3">
            <div className="w-16 h-20 bg-white border border-indigo-100 rounded-lg shadow-sm flex flex-col items-center justify-center gap-1 shrink-0">
              <FileText className="w-6 h-6 text-indigo-400" />
              <span className="text-xs text-indigo-400 font-medium">PDF</span>
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <p className="text-sm font-bold text-gray-800">AEOlab AI 분석 리포트</p>
              <p className="text-sm text-gray-600">{d.bizName}</p>
              <p className="text-sm text-gray-500">2026년 4월</p>
              <p className="text-sm font-semibold text-indigo-600">
                AI 가시성 점수: {Math.round((track1 + track2) / 2)}점
              </p>
              <button
                className="inline-flex items-center gap-1.5 mt-1 text-xs text-white bg-indigo-500 hover:bg-indigo-600 rounded-lg px-3 py-1.5 font-medium transition-colors opacity-70 cursor-default"
                disabled
              >
                <Download className="w-3.5 h-3.5" />
                다운로드 (Pro 전용)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ② 결과 미리보기 — Before/After 히스토리 */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <SectionTitle
          icon={<TrendingUp className="w-4 h-4 text-indigo-500" />}
          title="Before/After 성장 히스토리"
          subtitle="스크린샷 + 점수 변화 타임라인"
        />
        <div className="flex items-center gap-1 overflow-x-auto py-2">
          {[
            { month: "1월", score: 22, change: null },
            { month: "2월", score: 28, change: +6 },
            { month: "3월", score: 34, change: +6 },
            { month: "4월", score: 38, change: +4 },
          ].map((item, i) => (
            <div key={item.month} className="flex items-center gap-1 shrink-0">
              <div className="text-center bg-indigo-50 border border-indigo-100 rounded-lg p-2.5 min-w-[64px]">
                <p className="text-xs text-gray-500 mb-0.5">{item.month}</p>
                <p className="text-base font-extrabold text-indigo-700">{item.score}점</p>
                {item.change !== null && (
                  <p className="text-xs font-semibold text-green-600">+{item.change}</p>
                )}
              </div>
              {i < 3 && <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />}
            </div>
          ))}
          <span className="ml-1 text-xs text-indigo-500 font-semibold shrink-0">↑ 성장 중</span>
        </div>
        <p className="text-xs text-gray-400 mt-1">* 예시 데이터</p>
      </div>

      {/* ② 결과 미리보기 — ChatGPT 광고 대응 가이드 */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <SectionTitle
          icon={<Shield className="w-4 h-4 text-indigo-500" />}
          title="ChatGPT 광고 대응 전략"
          subtitle="AI 광고 도입 전 유기 노출 자산 선점"
        />
        <div className="space-y-2.5">
          {[
            {
              step: "1단계",
              title: "FAQ 5개 등록 — 지금 당장",
              desc: `"${d.missingKeyword} 어디가 좋아요?" 같은 질문에 내 가게가 직접 답변하면 ChatGPT가 인용 확률이 높아집니다.`,
              badge: "즉시 가능",
              badgeColor: "bg-green-100 text-green-700",
            },
            {
              step: "2단계",
              title: "소개글에 핵심 키워드 3개 포함",
              desc: "AI는 구조화된 텍스트를 먼저 인용합니다. 소개글에 지역명 + 업종 특성 + 차별점을 명시하세요.",
              badge: "30분 작업",
              badgeColor: "bg-blue-100 text-blue-700",
            },
            {
              step: "3단계",
              title: "경쟁사 광고 시작 시 즉시 대응",
              desc: "Pro 플랜은 경쟁사 AI 노출 점수가 급등하면 알림으로 감지합니다. 광고 대응 전에 유기 노출로 먼저 자리 잡습니다.",
              badge: "Pro 전용 모니터링",
              badgeColor: "bg-indigo-100 text-indigo-700",
            },
          ].map((item) => (
            <div
              key={item.step}
              className="flex gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100"
            >
              <div className="shrink-0 text-center">
                <span className="text-xs font-bold text-gray-500">{item.step}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <p className="text-sm font-bold text-gray-800">{item.title}</p>
                  <span
                    className={`text-xs font-medium rounded-full px-2 py-0.5 ${item.badgeColor}`}
                  >
                    {item.badge}
                  </span>
                </div>
                <p className="text-sm text-gray-600 leading-snug">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400">
          * ChatGPT 한국 광고 도입 시 위 전략으로 대응하는 맞춤 가이드를 매달 제공합니다.
        </p>
      </div>

      {/* ③ 기능 목록 */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <SectionTitle
          icon={<Star className="w-4 h-4 text-indigo-500" />}
          title="Pro 포함 기능"
        />
        <div className="divide-y divide-gray-50">
          <FeatureRow label="월·수·금 주 3회 AI 7개 자동 스캔" available={true} />
          <FeatureRow label="경쟁사 비교" available={true} note="최대 10개" />
          <FeatureRow label="AI 개선 가이드" available={true} note="월 8회" />
          <FeatureRow label="리뷰 답변 초안 생성" available={true} note="월 50회" />
          <FeatureRow label="CSV 내보내기" available={true} />
          <FeatureRow label="PDF 리포트 다운로드" available={true} />
          <FeatureRow label="ChatGPT 광고 대응 가이드" available={true} />
          <FeatureRow label="90일 히스토리 + Before/After 카드" available={true} />
          <FeatureRow label="수동 스캔" available={true} note="하루 5회" />
          <FeatureRow label="팀 계정" available={false} />
          <FeatureRow label="API 키" available={false} />
        </div>
      </div>

      {/* ④ CTA */}
      {isAlreadyOwned ? (
        <div className="rounded-xl bg-indigo-50 border border-indigo-200 p-4 text-center">
          <CheckCircle2 className="w-6 h-6 text-indigo-500 mx-auto mb-1.5" />
          <p className="text-sm font-semibold text-indigo-700">
            {isCurrentPlan ? "현재 이용 중인 플랜입니다" : "사장님의 플랜에 이미 포함되어 있습니다"}
          </p>
          <Link href="/ad-defense" className="text-sm text-indigo-600 hover:underline mt-1 block">
            광고 대응 가이드 바로가기 →
          </Link>
        </div>
      ) : (
        <div className="rounded-xl bg-indigo-600 p-5 text-white text-center space-y-2">
          <p className="text-base font-bold">Pro 시작하기</p>
          <p className="text-sm opacity-90">
            월 22,900원 · 광고비 하루치로 한 달 AI 노출 전략
          </p>
          <Link
            href="/signup?plan=pro"
            className="inline-flex items-center gap-1.5 mt-1 bg-white text-indigo-600 text-sm font-bold rounded-lg px-5 py-2.5 hover:bg-indigo-50 transition-colors"
          >
            시작하기 <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      )}
    </div>
  );
}

function BizTab({
  isCurrentPlan,
  isAlreadyOwned,
  industry,
}: {
  isCurrentPlan: boolean;
  isAlreadyOwned: boolean;
  industry: IndustryKey;
}) {
  const d = INDUSTRY_DATA[industry];

  const BIZ_STORES = [
    { name: `${d.bizName} 1호점`, score: 38, change: +3 },
    { name: `${d.bizName} 2호점`, score: 52, change: +5 },
    { name: `${d.bizName} 3호점`, score: 29, change: -2 },
  ];

  return (
    <div className="space-y-5">
      {/* 임팩트 카드 */}
      <ImpactCard
        color="emerald"
        lines={[
          {
            icon: "🏢",
            text: "지점이 2개 이상이면 Basic 2개보다 Biz 1개가 월 30,100원 저렴합니다",
          },
          {
            icon: "📊",
            text: "어느 지점이 AI에서 뒤처지는지 매일 아침 한눈에 파악해 즉시 조치할 수 있습니다",
          },
          {
            icon: "🔧",
            text: "컨설턴트라면 고객사 AI 노출 성과를 수치로 보고서화해 계약 갱신 근거로 씁니다",
          },
        ]}
      />

      {/* ① 설명 */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-sm font-semibold text-emerald-800">Biz — 49,900원/월</p>
          <Crown className="w-4 h-4 text-emerald-600" />
        </div>
        <p className="text-sm text-emerald-700 leading-relaxed">
          사업장 5개 × 매일 전체 AI 분석. 다점포 사업자·컨설턴트를 위한 플랜.
          수동 스캔·경쟁사·리뷰 답변 3가지 무제한 제공.
        </p>
      </div>

      {/* ② 결과 미리보기 — 사업장 5개 대시보드 */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <SectionTitle
          icon={<MapPin className="w-4 h-4 text-emerald-500" />}
          title="사업장 5개 통합 대시보드"
          subtitle="여러 지점을 한 눈에 관리"
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[320px] text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="py-2 px-3 text-xs font-semibold text-gray-500 text-left">사업장</th>
                <th className="py-2 px-3 text-xs font-semibold text-gray-500 text-center">오늘 점수</th>
                <th className="py-2 px-3 text-xs font-semibold text-gray-500 text-center">변화</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {BIZ_STORES.map((store) => (
                <tr key={store.name}>
                  <td className="py-2 px-3 font-medium text-gray-700">{store.name}</td>
                  <td className="py-2 px-3 text-center font-bold text-emerald-700">{store.score}점</td>
                  <td className="py-2 px-3 text-center">
                    <span
                      className={`text-xs font-bold ${
                        store.change > 0
                          ? "text-green-600"
                          : store.change < 0
                          ? "text-red-500"
                          : "text-gray-400"
                      }`}
                    >
                      {store.change > 0 ? "+" : ""}{store.change}
                    </span>
                  </td>
                </tr>
              ))}
              <tr>
                <td className="py-2 px-3 text-sm text-gray-400 italic" colSpan={3}>
                  + 2개 더 등록 가능 (최대 5개)
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-400 mt-2">* 예시 데이터입니다.</p>
      </div>

      {/* ② 결과 미리보기 — 엑셀 내보내기 */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <SectionTitle
          icon={<FileSpreadsheet className="w-4 h-4 text-emerald-500" />}
          title="엑셀 내보내기"
          subtitle="30일 스캔 데이터 CSV · 무제한 다운로드"
        />
        <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-100 rounded-lg">
          <FileSpreadsheet className="w-8 h-8 text-emerald-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-800">aeolab_스캔데이터_2026-04.csv</p>
            <p className="text-xs text-gray-500 mt-0.5">7개 AI 플랫폼 × 30일 데이터</p>
          </div>
          <button
            className="shrink-0 inline-flex items-center gap-1.5 text-xs text-white bg-emerald-500 rounded-lg px-3 py-1.5 font-medium opacity-70 cursor-default"
            disabled
          >
            <Download className="w-3.5 h-3.5" />
            다운로드
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">Biz 플랜 전용 · 무제한 제공</p>
      </div>

      {/* ② 결과 미리보기 — 팀 계정 */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <SectionTitle
          icon={<Users className="w-4 h-4 text-emerald-500" />}
          title="팀 계정 5명 관리"
          subtitle="직원·대행사와 함께 관리 및 공유"
        />
        <div className="grid grid-cols-3 gap-2">
          {["관리자", "직원 1", "직원 2"].map((role, i) => (
            <div
              key={role}
              className="bg-emerald-50 rounded-lg p-3 text-center border border-emerald-100"
            >
              <div className="w-8 h-8 bg-emerald-200 rounded-full flex items-center justify-center mx-auto mb-1.5">
                <Users className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-xs font-semibold text-emerald-700">{role}</p>
              <p className="text-xs text-emerald-500 mt-0.5">
                {i === 0 ? "전체 관리" : "조회만"}
              </p>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2">+ 최대 5명까지 초대 가능</p>
      </div>

      {/* ② 결과 미리보기 — API 키 */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <SectionTitle
          icon={<Key className="w-4 h-4 text-emerald-500" />}
          title="Public API 키 발급"
          subtitle="외부 서비스·자체 시스템 연동"
        />
        <div className="bg-gray-900 rounded-lg p-3 font-mono">
          <p className="text-xs text-green-400">// API 키 예시</p>
          <p className="text-xs text-gray-300 mt-1">
            <span className="text-blue-300">Authorization</span>:{" "}
            <span className="text-yellow-300">Bearer ael_••••••••••••••••</span>
          </p>
        </div>
        <p className="text-xs text-gray-500 mt-2">최대 5개 발급 · SHA256 해시 저장</p>
      </div>

      {/* ② 결과 미리보기 — 무제한 항목 강조 */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <SectionTitle
          icon={<Zap className="w-4 h-4 text-emerald-500" />}
          title="3가지 무제한"
          subtitle="한도 걱정 없이 운영"
        />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { icon: <BarChart3 className="w-5 h-5" />, label: "수동 스캔", sub: "횟수 무제한" },
            { icon: <TrendingUp className="w-5 h-5" />, label: "경쟁사", sub: "등록 무제한" },
            { icon: <MessageSquare className="w-5 h-5" />, label: "리뷰 답변", sub: "월 무제한" },
          ].map((item) => (
            <div
              key={item.label}
              className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-center"
            >
              <div className="text-emerald-600 flex justify-center mb-1">{item.icon}</div>
              <p className="text-sm font-bold text-emerald-800">{item.label}</p>
              <p className="text-xs text-emerald-600">{item.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ③ 기능 목록 */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <SectionTitle
          icon={<Star className="w-4 h-4 text-emerald-500" />}
          title="Biz 포함 기능 (Pro 전체 포함)"
        />
        <div className="divide-y divide-gray-50">
          <FeatureRow label="수동 스캔 무제한" available={true} />
          <FeatureRow label="경쟁사 무제한" available={true} />
          <FeatureRow label="리뷰 답변 초안 무제한" available={true} />
          <FeatureRow label="사업장 5개 × AI 7개 매일 자동 스캔" available={true} />
          <FeatureRow label="팀 계정 5명" available={true} />
          <FeatureRow label="AI 개선 가이드" available={true} note="월 20회" />
          <FeatureRow label="창업·신규 지점 시장 분석 리포트" available={true} />
          <FeatureRow label="Public API 키 발급 (최대 5개)" available={true} />
          <FeatureRow label="히스토리 무제한 + 엑셀·PDF 무제한" available={true} />
          <FeatureRow label="ChatGPT 광고 대응 가이드" available={true} />
        </div>
      </div>

      {/* ④ CTA */}
      {isAlreadyOwned ? (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-center">
          <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1.5" />
          <p className="text-sm font-semibold text-emerald-700">
            {isCurrentPlan ? "현재 이용 중인 플랜입니다" : "사장님의 플랜에 이미 포함되어 있습니다"}
          </p>
          <Link
            href="/settings/team"
            className="text-sm text-emerald-600 hover:underline mt-1 block"
          >
            팀 관리 바로가기 →
          </Link>
        </div>
      ) : (
        <div className="rounded-xl bg-emerald-600 p-5 text-white text-center space-y-2">
          <p className="text-base font-bold">Biz 문의하기</p>
          <p className="text-sm opacity-90">
            사업장 1개당 9,980원 · 다점포·컨설턴트 최적화
          </p>
          <a
            href="mailto:hello@aeolab.co.kr"
            className="inline-flex items-center gap-1.5 mt-1 bg-white text-emerald-600 text-sm font-bold rounded-lg px-5 py-2.5 hover:bg-emerald-50 transition-colors"
          >
            이메일 문의 <ChevronRight className="w-4 h-4" />
          </a>
        </div>
      )}
    </div>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────

interface Props {
  currentPlan: string;
  businessData: { id: string; name: string; category: string; region: string } | null;
  latestScan: ScanResult | null;
}

export default function PreviewClient({ currentPlan, businessData, latestScan }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>("basic");
  const [industry, setIndustry] = useState<IndustryKey>("cafe");

  const currentRank = PLAN_RANK[currentPlan] ?? 0;

  function isCurrentPlan(tab: TabKey) {
    return currentPlan === tab;
  }

  function isAlreadyOwned(tab: TabKey) {
    return currentRank >= (PLAN_RANK[tab] ?? 0);
  }

  const tabLabels: Record<TabKey, string> = {
    free: "무료체험",
    basic: "Basic",
    startup: "창업패키지",
    pro: "Pro",
    biz: "Biz",
  };

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      {/* 헤더 */}
      <div className="mb-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-1">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">요금제별 미리보기</h1>
          <span
            className={`inline-flex items-center gap-1.5 text-sm font-semibold rounded-full px-3 py-1 ${
              PLAN_COLOR[currentPlan]?.badge ?? "bg-gray-100 text-gray-700"
            }`}
          >
            <Star className="w-3.5 h-3.5" />
            현재: {PLAN_LABEL[currentPlan] ?? "무료 체험"}
            {PLAN_PRICE[currentPlan] && currentPlan !== "free" && (
              <span className="font-normal opacity-75 ml-0.5">
                · {PLAN_PRICE[currentPlan]}
              </span>
            )}
          </span>
        </div>
        <p className="text-sm text-gray-500 leading-relaxed">
          {businessData
            ? `${businessData.name}의 데이터를 기준으로 각 요금제 화면을 미리 확인합니다.`
            : "각 요금제에서 볼 수 있는 기능을 미리 확인하세요. 사업장을 등록하면 실제 데이터로 표시됩니다."}
        </p>
      </div>

      {/* 업종 선택 드롭다운 */}
      <div className="flex items-center gap-2 mb-4 p-3 bg-gray-50 rounded-xl border border-gray-200">
        <span className="text-sm font-medium text-gray-600 shrink-0">업종 선택:</span>
        <select
          value={industry}
          onChange={(e) => setIndustry(e.target.value as IndustryKey)}
          className="flex-1 text-sm font-semibold text-gray-800 bg-transparent border-0 outline-none cursor-pointer"
        >
          {Object.entries(INDUSTRY_DATA).map(([key, val]) => (
            <option key={key} value={key}>
              {val.label}
            </option>
          ))}
        </select>
        <span className="text-xs text-gray-400 shrink-0 hidden sm:block">선택하면 미리보기가 바뀝니다</span>
      </div>

      {/* 탭 네비게이션 */}
      <div className="bg-white border border-gray-200 rounded-xl mb-5 overflow-hidden">
        <div className="flex overflow-x-auto scrollbar-hide border-b border-gray-100">
          {TABS.map((tab) => {
            const isActive = activeTab === tab;
            const owned = isAlreadyOwned(tab);
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-shrink-0 flex flex-col items-center gap-0.5 px-4 py-3 text-sm transition-colors relative ${
                  isActive
                    ? PLAN_COLOR[tab]?.active ?? "border-b-2 border-gray-700 font-semibold"
                    : PLAN_COLOR[tab]?.tab ?? "text-gray-500 hover:text-gray-700"
                }`}
              >
                <span>{tabLabels[tab]}</span>
                {owned && !isActive && (
                  <span className="text-xs text-green-500 font-medium leading-none">보유</span>
                )}
                {isCurrentPlan(tab) && (
                  <span className="text-xs text-blue-500 font-medium leading-none">현재</span>
                )}
              </button>
            );
          })}
        </div>

        {/* 탭 컨텐츠 */}
        <div className="p-4 md:p-5">
          {activeTab === "free" && (
            <FreeTab
              scan={latestScan}
              isCurrentPlan={isCurrentPlan("free")}
              industry={industry}
            />
          )}
          {activeTab === "basic" && (
            <BasicTab
              scan={latestScan}
              isCurrentPlan={isCurrentPlan("basic")}
              isAlreadyOwned={isAlreadyOwned("basic")}
              industry={industry}
            />
          )}
          {activeTab === "startup" && (
            <StartupTab
              scan={latestScan}
              isCurrentPlan={isCurrentPlan("startup")}
              isAlreadyOwned={isAlreadyOwned("startup")}
              industry={industry}
            />
          )}
          {activeTab === "pro" && (
            <ProTab
              scan={latestScan}
              isCurrentPlan={isCurrentPlan("pro")}
              isAlreadyOwned={isAlreadyOwned("pro")}
              industry={industry}
            />
          )}
          {activeTab === "biz" && (
            <BizTab
              isCurrentPlan={isCurrentPlan("biz")}
              isAlreadyOwned={isAlreadyOwned("biz")}
              industry={industry}
            />
          )}
        </div>
      </div>

      {/* 하단: 전체 요금제 비교 링크 */}
      <div className="text-center py-2">
        <Link
          href="/pricing"
          className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          전체 요금제 상세 비교 보기 <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
