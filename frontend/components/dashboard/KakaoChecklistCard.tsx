"use client";

/**
 * KakaoChecklistCard — 카카오맵 비즈니스 프로필 완성도 체크리스트
 *
 * 카카오맵 API 심사 없이 체크리스트 방식으로 완성도 점수를 산출합니다.
 * 사용자가 항목을 직접 체크하면 점수가 갱신되고 POST /api/kakao/checklist/{biz_id}로 저장됩니다.
 */

import { useState, useCallback } from "react";

// ---------------------------------------------------------------------------
// 타입
// ---------------------------------------------------------------------------

export interface KakaoChecklist {
  registered: boolean;       // 카카오맵 등록 여부         (30점)
  hours: boolean;            // 영업시간 입력               (15점)
  phone: boolean;            // 전화번호 등록               (15점)
  photos: boolean;           // 사진 3장 이상 등록          (15점)
  kakao_channel: boolean;    // 카카오톡 채널 연결          (15점)
  menu_info: boolean;        // 메뉴/서비스 정보 등록       (10점)
}

interface KakaoChecklistCardProps {
  bizId: string;
  initialChecklist?: Partial<KakaoChecklist>;
  initialScore?: number;
  kakaoRegistered?: boolean;
  authToken?: string;
}

// ---------------------------------------------------------------------------
// 체크리스트 항목 정의
// ---------------------------------------------------------------------------

const CHECKLIST_ITEMS: Array<{
  key: keyof KakaoChecklist;
  label: string;
  desc: string;
  weight: number;             // 점수 가중치
  priority: "high" | "medium" | "low";
  howtoUrl: string;           // 안내 링크
}> = [
  {
    key: "registered",
    label: "카카오맵 등록",
    desc: "카카오맵에 내 가게가 등록되어 있나요?",
    weight: 30,
    priority: "high",
    howtoUrl: "https://place.kakao.com",
  },
  {
    key: "hours",
    label: "영업시간 입력",
    desc: "카카오맵 프로필에 영업시간이 정확히 입력되어 있나요?",
    weight: 15,
    priority: "high",
    howtoUrl: "https://place.kakao.com",
  },
  {
    key: "phone",
    label: "전화번호 등록",
    desc: "카카오맵에 연락 가능한 전화번호가 등록되어 있나요?",
    weight: 15,
    priority: "high",
    howtoUrl: "https://place.kakao.com",
  },
  {
    key: "photos",
    label: "사진 3장 이상 등록",
    desc: "가게 내·외부 사진이 3장 이상 등록되어 있나요?",
    weight: 15,
    priority: "medium",
    howtoUrl: "https://place.kakao.com",
  },
  {
    key: "kakao_channel",
    label: "카카오톡 채널 연결",
    desc: "카카오톡 채널이 카카오맵 프로필에 연결되어 있나요?",
    weight: 15,
    priority: "medium",
    howtoUrl: "https://business.kakao.com/dashboard/",
  },
  {
    key: "menu_info",
    label: "메뉴/서비스 정보 등록",
    desc: "주요 메뉴나 서비스 정보가 카카오맵에 등록되어 있나요?",
    weight: 10,
    priority: "low",
    howtoUrl: "https://place.kakao.com",
  },
];

// ---------------------------------------------------------------------------
// 점수 계산
// ---------------------------------------------------------------------------

function calcScore(checklist: KakaoChecklist): number {
  return CHECKLIST_ITEMS.reduce((acc, item) => {
    return acc + (checklist[item.key] ? item.weight : 0);
  }, 0);
}

// ---------------------------------------------------------------------------
// 등급 & 메시지
// ---------------------------------------------------------------------------

function getGrade(score: number): { label: string; color: string; bg: string } {
  if (score <= 30) return { label: "등록 필요", color: "text-red-700",    bg: "bg-red-100 border-red-200" };
  if (score <= 60) return { label: "기본 설정",  color: "text-yellow-700", bg: "bg-yellow-100 border-yellow-200" };
  if (score <= 85) return { label: "거의 완성",  color: "text-blue-700",   bg: "bg-blue-100 border-blue-200" };
  return               { label: "최적화 완료", color: "text-green-700",  bg: "bg-green-100 border-green-200" };
}

function getScoreMessage(score: number): string {
  if (score <= 30) return "카카오맵 등록이 시급합니다";
  if (score <= 60) return "기본 정보를 더 채워보세요";
  if (score <= 85) return "거의 완성됐습니다";
  return "카카오맵 최적화 완료!";
}

// ---------------------------------------------------------------------------
// 우선순위 뱃지
// ---------------------------------------------------------------------------

function PriorityBadge({ priority }: { priority: "high" | "medium" | "low" }) {
  if (priority === "high")
    return <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 border border-red-200 shrink-0">필수</span>;
  if (priority === "medium")
    return <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-600 border border-yellow-200 shrink-0">권장</span>;
  return <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200 shrink-0">선택</span>;
}

// ---------------------------------------------------------------------------
// 메인 컴포넌트
// ---------------------------------------------------------------------------

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export default function KakaoChecklistCard({
  bizId,
  initialChecklist,
  initialScore,
  kakaoRegistered,
  authToken,
}: KakaoChecklistCardProps) {
  const [checklist, setChecklist] = useState<KakaoChecklist>({
    registered: kakaoRegistered ?? initialChecklist?.registered ?? false,
    hours:         initialChecklist?.hours         ?? false,
    phone:         initialChecklist?.phone         ?? false,
    photos:        initialChecklist?.photos        ?? false,
    kakao_channel: initialChecklist?.kakao_channel ?? false,
    menu_info:     initialChecklist?.menu_info     ?? false,
  });

  const [saving, setSaving]   = useState(false);
  const [saved,  setSaved]    = useState(false);
  const [error,  setError]    = useState("");

  const score = initialScore !== undefined && saved === false
    ? initialScore
    : calcScore(checklist);

  const grade = getGrade(score);

  const toggle = useCallback((key: keyof KakaoChecklist) => {
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
    setSaved(false);
    setError("");
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`${BACKEND_URL}/api/kakao/checklist/${bizId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ checklist, score }),
      });
      if (!res.ok) throw new Error("저장 실패");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("저장 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  };

  const completedCount = CHECKLIST_ITEMS.filter((item) => checklist[item.key]).length;
  const barWidth = Math.min(100, score);

  const barColor =
    score <= 30 ? "bg-red-400" :
    score <= 60 ? "bg-yellow-400" :
    score <= 85 ? "bg-blue-500" :
    "bg-green-500";

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-6 space-y-4">

      {/* 헤더 */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span
              className="text-xl font-black"
              style={{ color: "#3A1D1D" }}
              aria-label="카카오맵 아이콘"
            >
              K
            </span>
            <h2 className="text-base md:text-lg font-bold text-gray-900">카카오맵 완성도</h2>
          </div>
          <p className="text-sm text-gray-500 leading-relaxed">
            카카오맵 비즈니스 프로필을 체크하면 점수를 확인할 수 있습니다.
          </p>
        </div>

        {/* 점수 + 등급 뱃지 */}
        <div className="text-right shrink-0">
          <div className="text-3xl md:text-4xl font-extrabold" style={{ color: "#3C1E1E" }}>
            {score}
            <span className="text-base md:text-lg font-normal text-gray-400">점</span>
          </div>
          <span
            className={`inline-flex items-center text-sm font-semibold rounded-full px-2.5 py-0.5 mt-1 border ${grade.bg} ${grade.color}`}
          >
            {grade.label}
          </span>
        </div>
      </div>

      {/* 점수 진행 바 */}
      <div>
        <div className="flex items-center justify-between text-sm text-gray-500 mb-1.5">
          <span>{getScoreMessage(score)}</span>
          <span>{completedCount} / {CHECKLIST_ITEMS.length} 항목 완료</span>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${barColor}`}
            style={{ width: `${barWidth}%` }}
          />
        </div>
      </div>

      {/* 체크리스트 */}
      <div className="space-y-2">
        {CHECKLIST_ITEMS.map((item) => {
          const checked = checklist[item.key];
          return (
            <div
              key={item.key}
              className={`flex items-start gap-3 p-3 rounded-xl border transition-colors cursor-pointer select-none
                ${checked
                  ? "bg-green-50 border-green-200"
                  : item.priority === "high"
                    ? "bg-red-50 border-red-100 hover:bg-red-100"
                    : "bg-gray-50 border-gray-100 hover:bg-gray-100"
                }`}
              onClick={() => toggle(item.key)}
              role="checkbox"
              aria-checked={checked}
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") toggle(item.key); }}
            >
              {/* 체크박스 */}
              <div
                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors
                  ${checked ? "bg-green-500 border-green-500" : "bg-white border-gray-300"}`}
              >
                {checked && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
                  </svg>
                )}
              </div>

              {/* 텍스트 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <span className={`text-sm font-semibold ${checked ? "text-green-800 line-through decoration-green-400" : "text-gray-800"}`}>
                    {item.label}
                  </span>
                  {!checked && <PriorityBadge priority={item.priority} />}
                  <span className="text-xs text-gray-400 ml-auto shrink-0">+{item.weight}점</span>
                </div>
                <p className={`text-sm leading-relaxed ${checked ? "text-green-600" : "text-gray-500"}`}>
                  {item.desc}
                </p>
              </div>

              {/* 미완성 시 바로가기 링크 */}
              {!checked && (
                <a
                  href={item.howtoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-xs text-blue-600 hover:text-blue-800 underline mt-0.5 whitespace-nowrap"
                  onClick={(e) => e.stopPropagation()}
                >
                  바로가기
                </a>
              )}
            </div>
          );
        })}
      </div>

      {/* 저장 버튼 + 카카오비즈 링크 */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 text-center"
          style={{
            backgroundColor: saving ? "#E5C100" : "#FEE500",
            color: "#1A1A1A",
          }}
        >
          {saving ? "저장 중..." : saved ? "✓ 저장 완료!" : "체크리스트 저장"}
        </button>
        <a
          href="https://place.kakao.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors text-center"
        >
          <span>🗺</span>
          카카오맵에서 내 가게 관리하기
        </a>
      </div>

      {/* 오류 메시지 */}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      {/* 점수 안내 */}
      <p className="text-xs text-gray-400 leading-relaxed">
        카카오맵은 한국 최대 POI DB(지역 정보)로, 등록 완성도가 높을수록 카카오 AI 검색 및 카카오 내비 노출이 향상됩니다.
      </p>
    </div>
  );
}
