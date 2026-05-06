/**
 * 요금제 정보 단일 소스 — page.tsx(홈 요약)와 pricing/page.tsx 공유
 * v3.2 소상공인 공감 중심 재설계 (2026-04-02)
 *
 * 자동 스캔 실제 동작 (scheduler/jobs.py 기준):
 *   basic/startup   : 네이버·Gemini 매일 경량 스캔 + 4종 AI 전체 월요일 1회 풀스캔
 *   pro             : 4종 AI 풀스캔 주 3회(월·수·금) + 나머지 날 경량 스캔
 *   biz             : 4종 AI 풀스캔 매일
 *
 * 요금 구조:
 *   Basic      9,900원/월
 *   Pro        18,900원/월
 *   Biz        49,900원/월  ← 수동 스캔 15회/일, 5사업장
 *   창업패키지 12,900원/월  ← 특수 목적 플랜 (마지막 배치)
 *
 * 기능 한도 (plan_gate.py PLAN_LIMITS 기준):
 *   경쟁사:      Basic 3 / 창업 5 / Pro 5 / Biz 무제한
 *   가이드/월:   Basic 3 / 창업 5 / Pro 10 / Biz 20
 *   리뷰답변/월: Basic 20회 / 창업 무제한 / Pro 무제한 / Biz 무제한
 *   히스토리:    Basic 60일 / 창업·Pro 90일 / Biz 무제한
 *   CSV:         Basic·창업·Pro·Biz (전 플랜 포함)
 *   PDF:         Pro·Biz (Basic·창업 제외)
 *   광고대응:    Pro·Biz
 *   창업분석:    창업·Biz
 *
 * v3.5 변경 요약 (2026-04-22):
 *   - 가격: Basic 9,900 / Pro 18,900 / Biz 49,900 / 창업 12,900
 *   - Basic: 주 1회(월요일) 자동 풀스캔, 리뷰 답변 무제한, FAQ 월 5건, CSV 포함, 경쟁사 3곳, 60일 히스토리
 *   - Pro: 주 3회(월·수·금) 자동 풀스캔, 사업장 2개
 *   - Biz: 매일 풀스캔, 사업장 5개
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
      "AI 노출 기초 진단 1회",
      "ChatGPT + 네이버 AI 브리핑 확인",
      "네이버 AI 브리핑 준비도 즉시 확인",
      "성장 단계 진단 + 없는 핵심 키워드 3개",
      "스마트플레이스 소개글 Q&A 문구 즉시 복사",
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
    description: "내 가게 AI 노출 주 1회 자동 감시 + 콘텐츠 도구 무제한",
    valueTag: "ChatGPT 절반도 안 되는 가격으로 ChatGPT가 못 하는 걸 합니다",
    killerFeature: "ChatGPT가 모르는 것 — 지금 내 가게가 네이버 AI에 나오는지 매주 자동 확인",
    features: [
      "주 1회 자동 AI 진단 (매주 월요일) — 내가 안 켜도 알아서 분석",
      "수동 스캔 하루 2회 — 소개글 Q&A 추가 후 AI가 바로 반영됐는지 즉시 확인",
      "리뷰 답변 초안 월 20회",
      "FAQ 생성 월 5회",
      "CSV 내보내기 포함",
      "60일 히스토리",
      "경쟁사 3곳 AI 노출 비교",
      "블로그 분석 — 홍보형/정보형 비율 + 개선 제목 제안",
      "스마트플레이스 자동 체크 — FAQ·소개글·소식 상태 진단",
      "즉시 쓸 수 있는 FAQ + 소개글 + 소식 초안 (복사 버튼)",
      "부족한 키워드 → 복사 버튼으로 스마트플레이스에 바로 붙여넣기",
      "성장 단계 진단 (시작/성장/빠른성장/지역1등)",
      "AI 개선 가이드 월 3회",
    ],
    cta: "1분 무료 회원가입",
    href: "/signup",
    isPay: true,
  },
  {
    name: "Pro",
    price: "18,900원",
    period: "/ 월",
    amount: 18900,
    highlight: false,
    badge: "성장 중인 가게",
    description: "경쟁사 움직임 즉시 포착 + 내 행동이 AI에 반영됐는지 증명",
    valueTag: "ChatGPT Plus보다 저렴, ChatGPT가 절대 못 하는 일을 매일",
    killerFeature: "매일 자동 감시 + 내 행동이 AI에 반영됐는지 7일 후 자동 증명",
    features: [
      "경쟁사가 FAQ·소식·키워드를 추가하면 즉시 알림",
      "내가 한 행동이 AI 브리핑에 반영됐는지 7일 후 자동 증명",
      "경쟁사 5곳 키워드 갭 — 아무도 안 쓰는 키워드 즉시 확인",
      "주 3회 자동 AI 풀스캔 (월·수·금) — 경쟁사 움직임 3일 안에 포착",
      "AI 언급 맥락 — 어떤 질문에서 내 가게가 빠지는지 확인",
      "리뷰 답변 초안 무제한",
      "ChatGPT 광고 대응 가이드",
      "PDF·CSV 내보내기, 90일 히스토리",
      "AI 개선 가이드 월 10회",
      "수동 스캔 하루 5회 (ChatGPT+네이버) — 개선 후 즉시 확인",
      "사업장 2개 등록 — 지점·다점포 관리 가능",
    ],
    cta: "시작하기",
    href: "/signup",
    isPay: true,
  },
  // Biz 플랜은 다점포·대행사 대상 이메일 영업 전용 (isPay: false = 토스 결제 불가)
  // 영업 완료 후 별도 결제 링크 제공. webhook.py에 34900이 있는 것은 백엔드 유연성 유지용.
  {
    name: "Biz",
    price: "49,900원",
    period: "/ 월",
    amount: 49900,
    highlight: false,
    badge: "다점포 · 대행사",
    description: "사업장 5개 × 매일 AI 풀스캔 — 5개 Basic보다 저렴",
    valueTag: "5개 Basic 개별 구독(44,500원)보다 저렴하고 기능은 훨씬 강력",
    killerFeature: "5개 사업장 매일 풀스캔 + 팀 계정 5명 + 경쟁사·리뷰답변 무제한",
    features: [
      "사업장 5개 × 매일 자동 AI 풀스캔 — 전 매장 현황 한눈에",
      "수동 스캔 하루 15회 — 사업장당 3회씩 즉시 확인 가능",
      "경쟁사 무제한 — 몇 곳이든 시장 전체 모니터링",
      "리뷰 답변 초안 무제한 — 리뷰 폭탄도 키워드 포함 당일 대응",
      "팀 계정 5명 — 직원·대행사와 함께 관리 및 공유",
      "AI 개선 가이드 월 20회 — 사업장별 맞춤 행동 계획",
      "창업·신규 지점 출점 전략 시장 분석 리포트",
      "ChatGPT 광고 대응 가이드 — Pro 포함 모든 기능",
      "외부 서비스 연동 API 키 발급 (최대 5개)",
      "히스토리 무제한 + 엑셀·PDF 무제한",
    ],
    cta: "문의하기",
    href: "mailto:hello@aeolab.co.kr",
    isPay: false,
  },
  {
    name: "창업 패키지",
    price: "12,900원",
    period: "/ 월",
    amount: 12900,
    highlight: false,
    badge: "예비 창업자 전용",
    description: "창업 전 이 지역 AI 경쟁 현황 — ChatGPT도 모르는 실제 데이터",
    valueTag: "이 지역, 이 업종, 아무도 안 쓰는 키워드가 있습니다",
    killerFeature: "이 지역·업종에서 AI가 먼저 추천하는 경쟁사 + 아무도 안 쓰는 키워드",
    features: [
      "이 지역·업종에서 AI가 먼저 추천하는 경쟁사 분석",
      "아무도 안 쓰는 틈새 키워드 발굴 — 오픈 전 선점 가능",
      "경쟁 강도 진단 — 진입 난이도와 차별화 전략",
      "오픈 후 Basic 기능 전체 포함",
      "수동 스캔 하루 3회, 경쟁사 5곳, 가이드 월 5회",
      "리뷰 답변 초안 무제한",
      "엑셀(CSV) 데이터 내보내기",
      "90일 성장 추이 — 창업 준비부터 오픈 후까지",
    ],
    cta: "시작하기",
    href: "/signup",
    isPay: true,
  },
];
