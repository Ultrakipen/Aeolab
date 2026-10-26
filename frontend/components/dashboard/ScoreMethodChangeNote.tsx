import { Info } from "lucide-react";

/** 점수 계산 방식 변경 안내 — 변경일을 가로지르는 추이·기록 화면에만 표시(lib/scoreMethodChange.ts) */
export default function ScoreMethodChangeNote({ className = "" }: { className?: string }) {
  return (
    <p className={`flex items-start gap-2 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 break-keep ${className}`}>
      <Info className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" aria-hidden="true" />
      <span>
        2026년 10월 26일 이후 측정부터 점수 계산 방식이 바뀌었습니다. 키워드 검색 순위는 점수에 넣지 않고 따로 보여드리며,
        나머지 항목의 비중이 그만큼 커졌습니다. 이 날을 전후해 점수가 올라 보일 수 있지만 가게가 실제로 달라진 것과는 별개입니다.
      </span>
    </p>
  );
}
