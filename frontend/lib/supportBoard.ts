// /support-programs(소상공인 지원사업 공고) 화면 로직 — 순수 함수. 외부 import 없이 한 파일(시험이 단독 변환한다).
// 데이터는 백엔드가 하루 한 번 기업마당(중기부) 공개 API에서 받아 둔 스냅샷이다. 화면은 공고의 "자격 판단"을 하지 않는다.

export interface SupportItem {
  id: string;
  title: string;
  url: string;
  agency: string;
  exec_agency: string;
  field: string;
  sub_field: string;
  target: string;
  sbiz_target: boolean;
  regions: string[];
  period_raw: string;
  start: string | null;
  end: string | null;
  summary: string;
  contact: string;
  created: string;
  updated: string;
}

export interface EventItem {
  id: string;
  title: string;
  url: string;
  origin_url: string;
  area: string;
  type: string;
  field: string;
  org: string;
  period_raw: string;
  start: string | null;
  end: string | null;
  summary: string;
  sbiz_mention: boolean;
  registered: string;
}

export interface BizinfoView {
  available: boolean;
  generated_at?: string;
  support?: { source_total: number; items: SupportItem[] };
  events?: { source_total: number; items: EventItem[] };
}

// 기업마당은 전국 대상 공고에 모든 지역 해시태그를 붙인다 — 이 수 이상이면 "전국"으로 부른다
export const NATIONWIDE_MIN_REGIONS = 10;

export const REGION_OPTIONS = [
  "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종", "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주", "전남광주",
];

/** 한국 시간 기준 오늘 'YYYY-MM-DD' */
export function todayKst(now: Date = new Date()): string {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

function dayNumber(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}

/** end 까지 남은 일수(오늘=0, 어제 마감=-1). 날짜 형식이 아니면 null */
export function daysUntil(end: string | null | undefined, today: string): number | null {
  if (!end || !/^\d{4}-\d{2}-\d{2}$/.test(end) || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return null;
  return dayNumber(end) - dayNumber(today);
}

export function ddayLabel(end: string | null | undefined, today: string): string {
  const n = daysUntil(end, today);
  if (n === null) return "";
  if (n < 0) return "마감";
  if (n === 0) return "오늘 마감";
  return `D-${n}`;
}

export function regionLabel(regions: string[]): string {
  if (regions.length >= NATIONWIDE_MIN_REGIONS) return "전국";
  if (regions.length === 0) return "";
  if (regions.length <= 3) return regions.join("·");
  return `${regions.slice(0, 3).join("·")} 외 ${regions.length - 3}곳`;
}

export interface SupportFilter {
  region: string; // "" = 전체
  field: string; // "" = 전체
  sbizOnly: boolean; // 지원대상 필드가 '소상공인'인 공고만
  q: string;
}

/** 마감일이 지난 공고는 뺀다(스냅샷은 하루 한 번이라 그 사이 마감된 것이 있을 수 있다). today 가 비어 있으면(서버 렌더) 자르지 않는다. */
export function filterSupport(items: SupportItem[], f: SupportFilter, today: string): SupportItem[] {
  const q = f.q.trim().toLowerCase();
  return items.filter((it) => {
    if (today && it.end && it.end < today) return false;
    if (f.sbizOnly && !it.sbiz_target) return false;
    if (f.field && it.field !== f.field) return false;
    if (f.region) {
      const nationwide = it.regions.length >= NATIONWIDE_MIN_REGIONS;
      if (!nationwide && !it.regions.includes(f.region)) return false;
    }
    if (q) {
      const hay = `${it.title} ${it.summary} ${it.agency} ${it.exec_agency}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export type SupportSort = "deadline" | "latest";

/** deadline: 날짜가 있는 공고를 마감 임박순으로 앞에, 신청기간이 문구뿐인 공고는 뒤에 최근 갱신순. latest: 등록일 최신순 */
export function sortSupport(items: SupportItem[], mode: SupportSort): SupportItem[] {
  const arr = [...items];
  if (mode === "latest") {
    return arr.sort((a, b) => b.created.localeCompare(a.created) || a.title.localeCompare(b.title));
  }
  return arr.sort((a, b) => {
    if (a.end && b.end) return a.end.localeCompare(b.end) || a.title.localeCompare(b.title);
    if (a.end) return -1;
    if (b.end) return 1;
    return b.updated.localeCompare(a.updated) || a.title.localeCompare(b.title);
  });
}

export interface EventFilter {
  region: string;
  type: string;
  q: string;
}

export function filterEvents(items: EventItem[], f: EventFilter, today: string): EventItem[] {
  const q = f.q.trim().toLowerCase();
  return items.filter((it) => {
    if (today && it.end && it.end < today) return false;
    if (f.region && it.area !== f.region && it.area !== "전국") return false;
    if (f.type && !it.type.split("@").includes(f.type)) return false;
    if (q && !`${it.title} ${it.summary} ${it.org}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

/**
 * 앞으로 열릴 행사를 시작일이 가까운 순으로 먼저, 이미 시작해 진행 중인 행사(연간 교육 등)는 끝나는 날이 가까운 순으로 그 뒤,
 * '상시'처럼 날짜가 없는 행사는 맨 뒤. today 가 비어 있으면(서버 렌더) 시작일순으로만 놓는다.
 */
export function sortEvents(items: EventItem[], today: string = ""): EventItem[] {
  const group = (e: EventItem): number => {
    if (!e.start) return 2;
    return today && e.start < today ? 1 : 0;
  };
  return [...items].sort((a, b) => {
    const ga = group(a);
    const gb = group(b);
    if (ga !== gb) return ga - gb;
    if (ga === 1) return (a.end ?? "").localeCompare(b.end ?? "") || a.title.localeCompare(b.title);
    if (ga === 0) return (a.start ?? "").localeCompare(b.start ?? "") || a.title.localeCompare(b.title);
    return a.title.localeCompare(b.title);
  });
}

/** '2026-11-16T12:58:21+00:00' → '2026-11-16 21:58'(한국 시간). 형식이 다르면 빈 문자열 */
export function formatKst(iso: string | null | undefined): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const kst = new Date(t + 9 * 60 * 60 * 1000).toISOString();
  return `${kst.slice(0, 10)} ${kst.slice(11, 16)}`;
}

/** 행사 유형은 '교육@기타'처럼 @로 겹쳐 온다 — 선택지에는 낱개로 나눠 보여 준다 */
export function eventTypeOptions(items: EventItem[]): string[] {
  const set = new Set<string>();
  for (const it of items) for (const t of it.type.split("@")) if (t) set.add(t);
  return [...set].sort((a, b) => a.localeCompare(b));
}
