// 공개 문의 게시판 공통 상수·헬퍼 (백엔드: backend/routers/board.py)

export const BOARD_CATEGORIES = [
  { value: "general", label: "일반 문의" },
  { value: "suggest", label: "건의" },
  { value: "partner", label: "제휴·광고" },
  { value: "biz", label: "Biz 플랜" },
  { value: "other", label: "기타" },
] as const;

export const BOARD_CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  BOARD_CATEGORIES.map((c) => [c.value, c.label]),
);

export const BOARD_TITLE_MAX = 60;
export const BOARD_CONTENT_MAX = 3000;
export const BOARD_PW_MIN = 6;

export interface BoardItem {
  id: number;
  category: string;
  title: string;
  title_private: boolean;
  is_notice: boolean;
  status: "pending" | "answered";
  author_name: string;
  created_at: string;
}

export interface BoardOpened extends BoardItem {
  content: string;
  answer: string | null;
  answered_at?: string | null;
  can_edit?: boolean;
}

/** FastAPI 오류 응답(detail: 문자열 | {message} | [{msg}])을 사용자 문구로 변환 */
export function boardErrorMessage(data: unknown, fallback = "처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."): string {
  const detail = (data as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return "입력 내용을 확인해 주세요.";
  const msg = (detail as { message?: string } | undefined)?.message;
  return msg || fallback;
}

export function formatBoardDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("ko-KR", { year: "2-digit", month: "2-digit", day: "2-digit" });
}
