/**
 * 요금제 정보 단일 소스 — page.tsx(홈 요약)와 pricing/page.tsx 공유
 * v3.2 소상공인 공감 중심 재설계 (2026-04-02)
 *
 * 자동 스캔 실제 동작 (scheduler/jobs.py 기준):
 *   basic           : 7개 AI 풀스캔 주 1회(월) + 네이버·Gemini 핵심 지표 매일
 *   startup         : 7개 AI 풀스캔 주 1회(월) + 네이버·Gemini 핵심 지표 매일
 *   pro             : 7개 AI 풀스캔 주 3회(월·수·금) + 네이버·Gemini 핵심 지표 매일
 *   biz/enterprise  : 7개 AI 풀스캔 매일
 *
 * 요금 구조 (월 단위 통일, 변경 없음):
 *   Basic      9,900원/월
 *   Pro        22,900원/월
 *   Biz        49,900원/월
 *   창업패키지 16,900원/월  ← 특수 목적 플랜 (마지막 배치)
 *
 * 기능 한도 (plan_gate.py PLAN_LIMITS 기준):
 *   경쟁사:      Basic 3 / 창업 5 / Pro 10 / Biz 무제한
 *   가이드/월:   Basic 5 / 창업 5 / Pro 8 / Biz 20
 *   리뷰답변/월: Basic 10 / 창업 20 / Pro 50 / Biz 무제한
 *   히스토리:    Basic 30일 / 창업·Pro 90일 / Biz 무제한
 *   CSV:         창업·Pro·Biz (Basic 제외)
 *   PDF:         Pro·Biz (Basic·창업 제외)
 *   광고대응:    Pro·Biz
 *   창업분석:    창업·Biz
 *
 * v3.2 변경 요약:
 *   - PLANS 배열 순서 변경: 무료→Basic→Pro→Biz→창업패키지 (창업을 특수목적으로 분리)
 *   - 창업 패키지 경쟁사 10개→5개 (Pro와 차별화)
 *   - Pro 킬러 기능 강조: 주 3회 자동 + 경쟁사 10개 + PDF
 *
 * v3.3 변경 요약 (2026-04-03):
 *   - Biz 플랜 스펙 명확화: 수동 스캔 무제한, 경쟁사 무제한, 리뷰 답변 무제한
 *   - Biz killerFeature: "5개 사업장 매일 자동 분석 + 수동·경쟁사·리뷰답변 3가지 무제한"
 *   - Biz valueTag: "다점포·컨설턴트 최적화 — 사업장 1개당 9,980원"
 *   - Biz features 순서: 무제한 항목 앞배치로 강점 즉시 인지
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
  killerFeature: string; // 가장 강조할 기능 1가지
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
    description: "로그인 없이 지금 바로 내 가게 AI 진단",
    valueTag: "",
    killerFeature: "네이버 AI 브리핑 준비도 즉시 확인",
    features: [
      "네이버 AI 브리핑 준비도 즉시 진단",
      "네이버 채널·글로벌 AI 채널 분리 점수 확인",
      "성장 단계 확인 (시작→성장→빠른 성장→지역 1등)",
      "지금 내 가게에 없는 핵심 키워드 3개",
      "스마트플레이스 FAQ 문구 즉시 복사",
      "신용카드 불필요 · 1분 완성",
    ],
    cta: "무료 체험 시작",
    href: "/trial",
    isPay: false,
  },
  {
    name: "Basic",
    price: "9,900원",
    period: "/ 월",
    amount: 9900,
    highlight: true,
    badge: "소상공인 첫 시작",
    description: "커피 한 잔 값으로 매주 AI 7개 자동 추적",
    valueTag: "광고 없이 AI 노출 첫 걸음",
    killerFeature: "매주 월요일 AI 7개 자동 스캔 — 내가 잊어도 알아서",
    features: [
      "매주 월요일 AI 7개 자동 스캔 — 내가 안 켜도 알아서 분석",
      "경쟁사 3곳이 나보다 AI에서 앞서는 이유를 매주 확인",
      "성장 단계 30일 변화 추적 — 시작→안정→성장 흐름 파악",
      "AI 개선 가이드 월 5회 — 이번 달 가장 중요한 행동 3가지",
      "리뷰 답변 초안 월 10회 — 키워드 포함 복사·붙여넣기",
      "수동 스캔 하루 2회 — 중요한 날 즉시 확인",
      "스마트플레이스 AI 검색 최적화 코드 자동 생성",
    ],
    cta: "1분 무료 회원가입",
    href: "/signup",
    isPay: true,
  },
  {
    name: "Pro",
    price: "22,900원",
    period: "/ 월",
    amount: 22900,
    highlight: false,
    badge: "성장 중인 가게",
    description: "주 3회 전체 AI 분석 + 경쟁사 10곳 비교",
    valueTag: "광고비 하루치로 한 달 AI 노출 전략",
    killerFeature: "월·수·금 주 3회 자동 스캔 — 경쟁사 변화 3일 안에 포착",
    features: [
      "월·수·금 주 3회 AI 7개 자동 스캔 — 경쟁사 변화를 3일 안에 포착",
      "경쟁사 10곳 × 키워드 갭 비교 — 경쟁사가 가져가는 키워드 즉시 확인",
      "AI 개선 가이드 월 8회 — 업종 맞춤 행동 계획 (Claude Sonnet 생성)",
      "리뷰 답변 초안 월 50회 — 부정 리뷰도 키워드로 역전",
      "월별 AI 성과 PDF + 엑셀(CSV) — 사장님·직원 모두 보기 좋은 보고서",
      "AI 브리핑 직접 관리 4경로 — 즉시 복사·붙여넣기 문구",
      "ChatGPT 광고 대응 가이드 — AI 광고 시대 선제 대응",
      "90일 히스토리 + Before/After 비교 카드",
      "수동 스캔 하루 5회",
    ],
    cta: "시작하기",
    href: "/signup",
    isPay: true,
  },
  // Biz 플랜은 다점포·대행사 대상 이메일 영업 전용 (isPay: false = 토스 결제 불가)
  // 영업 완료 후 별도 결제 링크 제공. webhook.py에 49900이 있는 것은 백엔드 유연성 유지용.
  {
    name: "Biz",
    price: "49,900원",
    period: "/ 월",
    amount: 49900,
    highlight: false,
    badge: "다점포 · 대행사",
    description: "사업장 5개 × 매일 전체 AI 분석 + 3가지 무제한",
    valueTag: "다점포·컨설턴트 최적화 — 사업장 1개당 9,980원",
    killerFeature: "5개 사업장 매일 자동 분석 + 수동·경쟁사·리뷰답변 3가지 무제한",
    features: [
      "수동 스캔 무제한 — 언제든 원할 때 즉시 Gemini+네이버 퀵 스캔",
      "경쟁사 무제한 — 몇 곳이든 한눈에 시장 전체 모니터링",
      "리뷰 답변 초안 무제한 — 리뷰 폭탄도 키워드 포함 당일 대응",
      "사업장 5개 × AI 7개 매일 자동 풀스캔 — 전 매장 현황 한눈에",
      "팀 계정 5명 — 직원·대행사와 함께 관리 및 공유",
      "AI 개선 가이드 월 20회 — 사업장별 맞춤 행동 계획",
      "창업·신규 지점 출점 전략 시장 분석 리포트",
      "외부 서비스 연동 API 키 발급",
      "히스토리 무제한 + 엑셀·PDF 무제한",
    ],
    cta: "문의하기",
    href: "mailto:hello@aeolab.co.kr",
    isPay: false,
  },
  {
    name: "창업 패키지",
    price: "16,900원",
    period: "/ 월",
    amount: 16900,
    highlight: false,
    badge: "예비 창업자 전용",
    description: "오픈 전 AI 경쟁 지도 + Basic 핵심 기능",
    valueTag: "이 지역에 경쟁자가 몇 명인지 먼저 확인",
    killerFeature: "창업 전 이 업종·지역 경쟁 강도 + 틈새 키워드 분석",
    features: [
      "AI가 이 지역·업종에서 누구를 먼저 추천하는지 분석 (창업 특화)",
      "시장 진입 난이도 + 틈새 키워드 발굴 리포트",
      "경쟁사 5곳 분석 — 오픈 전 경쟁 환경 파악",
      "수동 스캔 하루 3회 — 오픈 준비 집중 모니터링",
      "AI 개선 가이드 월 5회 — 업종 시장 흐름 반영",
      "리뷰 답변 초안 월 20회",
      "엑셀(CSV) 데이터 내보내기",
      "90일 성장 추이 — 창업 준비부터 오픈 후까지",
    ],
    cta: "시작하기",
    href: "/signup",
    isPay: true,
  },
];
