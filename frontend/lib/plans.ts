/**
 * 요금제 정보 단일 소스 — page.tsx(홈 요약)와 pricing/page.tsx 공유
 * v3.1 가치 기반 리포지셔닝 (2026-04-01)
 *
 * 자동 스캔 실제 동작 (scheduler/jobs.py 기준):
 *   basic           : 7개 AI 풀스캔 주 1회(월) + 네이버·Gemini 핵심 지표 매일
 *   startup         : 7개 AI 풀스캔 주 1회(월) + 네이버·Gemini 핵심 지표 매일
 *   pro             : 7개 AI 풀스캔 주 3회(월·수·금) + 네이버·Gemini 핵심 지표 매일
 *   biz/enterprise  : 7개 AI 풀스캔 매일
 *
 * 요금 구조 (월 단위 통일):
 *   Basic      9,900원/월
 *   창업패키지 16,900원/월
 *   Pro        22,900원/월
 *   Biz        49,900원/월
 *
 * 기능 한도 (plan_gate.py PLAN_LIMITS 기준):
 *   경쟁사:      Basic 3 / 창업·Pro 10 / Biz 무제한
 *   가이드/월:   Basic 1 / 창업 5 / Pro 8 / Biz 20
 *   리뷰답변/월: Basic 10 / 창업 20 / Pro 50 / Biz 무제한
 *   히스토리:    Basic 30일 / 창업·Pro 90일 / Biz 무제한
 *   CSV:         창업·Pro·Biz (Basic 제외)
 *   PDF:         Pro·Biz (Basic·창업 제외)
 *   광고대응:    Pro·Biz
 *   창업분석:    창업·Biz
 */
export interface PlanInfo {
  name: string;
  price: string;
  period: string;
  amount: number;
  highlight: boolean;
  badge: string;
  description: string;
  valueTag: string;
  features: string[];
  cta: string;
  href: string;
  isPay: boolean;
}

export const PLANS: PlanInfo[] = [
  {
    name: "무료 체험",
    price: "0원",
    period: "",
    amount: 0,
    highlight: false,
    badge: "",
    description: "로그인 없이 1회 즉시 진단",
    valueTag: "",
    features: [
      "네이버 AI 브리핑 준비도 + 글로벌 AI 가시성 즉시 진단",
      "업종별 가중치 적용 듀얼트랙 점수",
      "성장 단계 확인 (시작→안정→성장→지배)",
      "지금 당장 없는 핵심 키워드 3개 확인",
      "스마트플레이스 FAQ 문구 즉시 복사·붙여넣기",
      "신용카드 불필요 · 자동 추적 없음",
    ],
    cta: "무료 체험",
    href: "/trial",
    isPay: false,
  },
  {
    name: "Basic",
    price: "9,900원",
    period: "/ 월",
    amount: 9900,
    highlight: true,
    badge: "가장 인기",
    description: "커피 한 잔으로 매주 AI 7개 자동 추적",
    valueTag: "광고 없이 AI 노출 첫 걸음",
    features: [
      "AI 7개 전체 스캔 매주 월요일 자동 시작 (Gemini 100회 포함)",
      "네이버 AI 브리핑 매일 자동 모니터링",
      "경쟁사 3곳이 나보다 AI에서 앞서는 이유를 매주 확인",
      "성장 단계 변화 30일 추적 — 시작→안정→성장 흐름 파악",
      "AI 개선 가이드 월 1회 — 이번 달 가장 중요한 행동 1가지",
      "리뷰 답변 초안 월 10회 — 키워드 포함 복사·붙여넣기",
      "수동 스캔 하루 2회 — 중요한 날 즉시 확인",
    ],
    cta: "1분 무료 회원가입",
    href: "/signup",
    isPay: true,
  },
  {
    name: "창업 패키지",
    price: "16,900원",
    period: "/ 월",
    amount: 16900,
    highlight: false,
    badge: "예비 창업자",
    description: "창업 전 AI 경쟁 지도 + Basic 전체 기능",
    valueTag: "이 지역에 경쟁자가 몇 명인지 먼저 확인",
    features: [
      "이 지역·업종에서 AI가 누구를 먼저 추천하는지 분석 (창업 특화)",
      "시장 진입 난이도 + 틈새 키워드 발굴 리포트",
      "경쟁사 10곳 분석 — Basic 대비 3배 경쟁 정보",
      "수동 스캔 하루 3회 — 오픈 전 집중 모니터링",
      "AI 개선 가이드 월 5회 — 업종 시장 흐름 반영",
      "리뷰 답변 초안 월 20회 — Basic 대비 2배",
      "엑셀(CSV) 데이터 내보내기",
      "90일 성장 추이 — 창업 준비부터 오픈 후까지 추적",
    ],
    cta: "시작하기",
    href: "/signup",
    isPay: true,
  },
  {
    name: "Pro",
    price: "22,900원",
    period: "/ 월",
    amount: 22900,
    highlight: false,
    badge: "ROI 최강",
    description: "주 3회 전체 AI 분석 + 성과 리포트",
    valueTag: "광고비 하루치로 한 달 AI 노출 전략",
    features: [
      "AI 7개 전체 스캔 주 3회 자동 (월·수·금) — 경쟁사 변화를 3일 안에 포착",
      "경쟁사 10곳 × 키워드 갭 비교 — 내가 없는 키워드를 경쟁사가 가져가는 순간 알림",
      "AI 개선 가이드 월 8회 — 업종별 맞춤 행동 계획 (Claude Sonnet 생성)",
      "리뷰 답변 초안 월 50회 — 부정 리뷰도 키워드로 역전 가능",
      "ChatGPT 광고 한국 도입 대응 가이드 (Pro 독점)",
      "AI 브리핑 직접 관리 4경로 — 즉시 복사·붙여넣기 문구 제공",
      "월별 AI 성과 리포트 PDF + 엑셀(CSV) 자동 생성",
      "90일 히스토리 + Before/After 비교 카드",
      "수동 스캔 하루 5회",
    ],
    cta: "시작하기",
    href: "/signup",
    isPay: true,
  },
  {
    name: "Biz",
    price: "49,900원",
    period: "/ 월",
    amount: 49900,
    highlight: false,
    badge: "다점포 · 대행사",
    description: "사업장 5개 × 매일 전체 AI 분석 + 팀 협업",
    valueTag: "사업장 1개당 월 9,980원 — 매일 자동 분석",
    features: [
      "사업장 5개 × AI 7개 매일 자동 분석 — 전 매장 현황 한눈에",
      "팀 계정 5명 — 직원·대행사와 함께 관리",
      "경쟁사 무제한 + 시장 전체 모니터링",
      "AI 개선 가이드 월 20회 (사업장 5개 합산)",
      "리뷰 답변 초안 무제한 — 리뷰 폭탄도 당일 대응",
      "창업 시장 분석 리포트 — 신규 지점 출점 전략",
      "외부 서비스 연동 API 키 발급",
      "히스토리 무제한 + 엑셀·PDF 무제한 생성",
      "수동 스캔 무제한",
    ],
    cta: "문의하기",
    href: "mailto:hello@aeolab.co.kr",
    isPay: false,
  },
];
