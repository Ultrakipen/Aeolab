"use client";

/**
 * D.I.A. 5요소 점수 시각화 (Diversity·Information·Authority·Timeliness·Originality).
 * 백엔드 services/content_validator.py:validate_intro_dia 응답을 그대로 받아 표시.
 */

import Link from "next/link";

interface DiaSection {
  score: number;
}

interface DiaDiversity extends DiaSection {
  included: number;
  total: number;
  ratio: number;
  matched?: string[];
}

interface DiaInformation extends DiaSection {
  specific_count: number;
  has_qa_structure?: boolean;  // 백엔드 v1.1+ (옵셔널)
}

interface DiaAuthority extends DiaSection {
  matches: string[];
}

interface DiaTimeliness extends DiaSection {
  has_marker: boolean;
}

interface DiaOriginality extends DiaSection {
  differentiators: string[];
  vague_count: number;
  vague_examples: string[];
}

export interface DiaScore {
  score: number;
  diversity: DiaDiversity;
  information: DiaInformation;
  authority: DiaAuthority;
  timeliness: DiaTimeliness;
  originality: DiaOriginality;
}

const ROWS: Array<{
  key: keyof Omit<DiaScore, "score">;
  label: string;
  maxScore: number;
  hint: (d: DiaScore) => string;
}> = [
  {
    key: "diversity",
    label: "D · 다양성",
    maxScore: 25,
    hint: (d) =>
      `LSI 연관 키워드 ${d.diversity.included}/${d.diversity.total} 포함${
        d.diversity.included < 4 ? " — 4개 이상 권장" : ""
      }`,
  },
  {
    key: "information",
    label: "I · 정보 충실성",
    maxScore: 25,
    hint: (d) => {
      const base = `구체 수치 ${d.information.specific_count}개 (가격·시간·위치 등)${
        d.information.specific_count < 5 ? " — 5개 이상 권장" : ""
      }`;
      // has_qa_structure는 백엔드 v1.1에서 추가됨 (옵셔널 처리)
      const qa = d.information.has_qa_structure;
      return qa ? base + " · Q&A 구조 감지 (+5점)" : base;
    },
  },
  {
    key: "authority",
    label: "A · 권위",
    maxScore: 15,
    hint: (d) =>
      d.authority.matches.length > 0
        ? `매칭: ${d.authority.matches.slice(0, 3).join(", ")}`
        : "경력·자격·수상·인기메뉴 1개 이상 권장",
  },
  {
    key: "timeliness",
    label: "T · 적시성",
    maxScore: 15,
    hint: (d) =>
      d.timeliness.has_marker
        ? "[YYYY년 M월] 적시성 마커 확인"
        : "본문 끝에 [YYYY년 M월 기준] 표기 권장",
  },
  {
    key: "originality",
    label: "O · 독창성",
    maxScore: 20,
    hint: (d) => {
      const parts: string[] = [];
      if (d.originality.differentiators.length > 0) {
        parts.push(`차별점: ${d.originality.differentiators.join(", ")}`);
      } else {
        parts.push("시그니처·전용·차별점 1개 권장");
      }
      if (d.originality.vague_examples.length > 0) {
        parts.push(`추상 표현 감점: ${d.originality.vague_examples.join(", ")}`);
      }
      return parts.join(" · ");
    },
  },
];

function scoreColor(score: number, max: number) {
  const ratio = score / max;
  if (ratio >= 0.8) return { bar: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50" };
  if (ratio >= 0.5) return { bar: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50" };
  return { bar: "bg-red-500", text: "text-red-700", bg: "bg-red-50" };
}

export function diaScoreLabel(score: number, max: number = 100): string {
  const ratio = score / max;
  if (ratio >= 0.8) return "양호";
  if (ratio >= 0.5) return "보통";
  return "개선 필요";
}

export default function DiaScoreBadge({ dia, onRegenerate }: { dia: DiaScore; onRegenerate?: () => void }) {
  const totalColor = scoreColor(dia.score, 100);

  return (
    <section
      aria-labelledby="dia-score-title"
      className="rounded-xl border border-gray-200 bg-white overflow-hidden"
    >
      <div
        className={`flex items-center justify-between gap-3 px-4 py-3 md:px-5 md:py-4 border-b border-gray-100 ${totalColor.bg}`}
      >
        <div>
          <h4 id="dia-score-title" className="text-base md:text-lg font-bold text-gray-900">
            네이버 고품질 콘텐츠 기준 5요소 점수
          </h4>
          <p className="text-sm text-gray-600 mt-0.5">
            AI 브리핑 인용 가능성 — 정규식 기반 사후 검증 (AI 호출 0회)
          </p>
        </div>
        <div className={`text-xl md:text-2xl font-extrabold ${totalColor.text}`}>
          {diaScoreLabel(dia.score)}
        </div>
      </div>

      <ul className="divide-y divide-gray-100">
        {ROWS.map((row) => {
          const section = dia[row.key] as DiaSection;
          const color = scoreColor(section.score, row.maxScore);
          const pct = Math.min(100, (section.score / row.maxScore) * 100);
          return (
            <li key={row.key} className="px-4 py-3 md:px-5 md:py-4">
              <div className="flex items-center justify-between gap-3 mb-2">
                <span className="text-sm md:text-base font-semibold text-gray-900">
                  {row.label}
                </span>
                <span className={`text-sm md:text-base font-bold ${color.text}`}>
                  {diaScoreLabel(section.score, row.maxScore)}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden mb-1.5">
                <div
                  className={`h-full ${color.bar} transition-all`}
                  style={{ width: `${pct}%` }}
                  role="progressbar"
                  aria-valuenow={section.score}
                  aria-valuemin={0}
                  aria-valuemax={row.maxScore}
                  aria-label={`${row.label} ${diaScoreLabel(section.score, row.maxScore)}`}
                />
              </div>
              <p className="text-sm text-gray-600 leading-snug">{row.hint(dia)}</p>
            </li>
          );
        })}
      </ul>

      <div className="px-4 py-3 md:px-5 md:py-4 bg-gray-50 space-y-2">
        <p className="text-sm text-gray-500 leading-snug">
          콘텐츠 품질이 &quot;개선 필요&quot;로 나오면 다시 생성 또는 부족 요소 수동 보완을 권장합니다.
          실제 네이버 AI 브리핑 노출은 측정 시점·경쟁사·키워드 조합에 따라 달라질 수 있습니다.
        </p>
        {dia.score < 70 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {onRegenerate && (
              <button
                onClick={onRegenerate}
                className="inline-flex items-center rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
              >
                소개글 다시 생성
              </button>
            )}
            <Link
              href="/guide/ai-info-tab#dia-score"
              className="inline-flex items-center rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              콘텐츠 품질 개선 가이드 →
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
