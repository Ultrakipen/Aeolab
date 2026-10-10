/**
 * 요금제 정보 단일 소스 — page.tsx(홈 요약)와 pricing/page.tsx 공유
 * v3.2 소상공인 공감 중심 재설계 (2026-04-02)
 *
 * 자동 스캔 실제 동작 (scheduler/jobs.py 기준):
 *   basic           : Gemini 50회 + ChatGPT 50회 + 네이버 3종 주 2회(월·목) 자동 스캔 (2026-07-15 차별화)
 *   startup         : Gemini 50회 + ChatGPT 50회 + 네이버 3종 주 1회(월요일) 자동 스캔 (A안 50/50 적용)
 *   pro             : 4종 AI 풀스캔 주 3회(월·수·금) + 나머지 날 경량 스캔
 *   biz             : 4종 AI 풀스캔 매일
 *
 * 요금 구조:
 *   Basic      17,900원/월
 *   Pro        29,900원/월
 *   Biz        79,500원/월  ← 수동 스캔 10회/일, 5사업장
 *   창업패키지 23,900원/월  ← 특수 목적 플랜 (마지막 배치)
 *
 * v3.9 (2026-10-07): 카드 문구를 일상어로 재작성 + 핵심(highlights)/전체(moreFeatures) 2단 구조로 변경.
 *   기능·한도 수치는 그대로(위 "기능 한도" 기준), 표현만 변경. features/killerFeature/valueTag 필드 제거.
 *
 * v3.8 (2026-09-30): 가격 재조정 — Basic 17,900 / 창업 23,900 / Pro 29,900 / Biz 79,500(문의). 첫 달 50% = 8,950원. 연간=10개월치.
 *
 * 기능 한도 (plan_gate.py PLAN_LIMITS 기준):
 *   경쟁사:         Basic 3 / 창업 5 / Pro 5 / Biz 무제한
 *   가이드/월:      Basic 3 / 창업 5 / Pro 10 / Biz 20
 *   리뷰답변/월:    Basic 50회 / 창업 무제한 / Pro 무제한 / Biz 무제한
 *   소개글+FAQ/월:  Basic 10건 / 창업 20건 / Pro 30건 / Biz 60건  ← 남용 방지, DEV_MODE=true 시 우회
 *   히스토리:       Basic 60일 / 창업·Pro 90일 / Biz 무제한
 *   CSV:            Basic·창업·Pro·Biz (전 플랜 포함)
 *   PDF:            Pro·Biz (Basic·창업 제외)
 *   광고대응:       Pro·Biz
 *   창업분석:       창업·Biz
 *
 * v3.7 변경 요약 (2026-07-15):
 *   - Basic 자동 스캔 주 1회→주 2회(월·목) — 창업패키지(당시 12,900원)가 모든 항목에서 Basic(당시 11,900원)보다
 *     같거나 우위였던 "strictly dominated" 문제 해소. Basic="이미 운영 중인 가게, 더 자주 감시" /
 *     창업패키지="예비 창업자, 더 많은 AI 도구+시장분석"으로 포지셔닝 분리 (docs/subscription_plan_differentiation_v1.0.md)
 *
 * v3.6 변경 요약 (2026-07-14):
 *   - 가격: Basic 11,900 / Pro 23,900 / Biz 49,900 / 창업 12,900 (Basic·Pro 인상, 구독자 0명 시점 반영)
 *
 * v3.5 변경 요약 (2026-04-22):
 *   - 가격: Basic 9,900 / Pro 18,900 / Biz 49,900 / 창업 12,900
 *   - Basic: 주 1회(월요일) 자동 풀스캔, 리뷰 답변 월 50회, FAQ 10건, CSV 포함, 경쟁사 3곳, 60일 히스토리
 *   - Pro: 주 3회(월·수·금) 자동 풀스캔, 사업장 2개
 *   - Biz: 매일 풀스캔, 사업장 5개
 */
export interface PlanFeature {
  title: string; // 굵게 보이는 한 줄 (일상어)
  desc: string;  // 한 줄 설명
}

export interface PlanInfo {
  name: string;
  price: string;
  period: string;
  amount: number;
  highlight: boolean;
  badge: string;
  description: string;         // 카드 상단 한 줄 소개 (쉬운 말)
  highlights: PlanFeature[];   // 카드에 항상 보이는 핵심 항목
  moreFeatures: PlanFeature[]; // "이 플랜의 모든 기능 보기"를 눌러야 보이는 전체 목록
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
    highlights: [
      { title: "AI 노출 기초 진단 1회", desc: "ChatGPT + 네이버 AI 브리핑 확인" },
      { title: "성장 단계 진단 + 없는 핵심 키워드 3개", desc: "스마트플레이스 소개글 Q&A 문구 즉시 복사" },
    ],
    moreFeatures: [],
    cta: "무료 체험 시작",
    href: "/trial",
    isPay: false,
  },
  {
    name: "Basic",
    price: "17,900원",
    period: "/ 월",
    amount: 17900,
    highlight: true,
    badge: "처음이라면 여기부터",
    description: "내 가게가 AI 검색에 나오는지 알아서 확인해 드려요",
    highlights: [
      { title: "일주일에 2번 자동 확인", desc: "월·목요일마다 네이버·ChatGPT·구글 AI에 내 가게가 나오는지 확인해요" },
      { title: "\"이렇게 고치세요\" 안내서 월 3번", desc: "무엇부터 고칠지 순서대로 알려드려요" },
      { title: "소개글·소식 문구 월 10건", desc: "복사해서 스마트플레이스에 바로 붙여넣으세요" },
      { title: "근처 가게 3곳과 비교", desc: "저쪽엔 있고 내 가게엔 없는 검색어를 알려드려요" },
    ],
    moreFeatures: [
      { title: "원할 때 바로 확인, 하루 2번", desc: "스마트플레이스를 고친 뒤 네이버에서 달라졌는지 빨리 볼 수 있어요" },
      { title: "리뷰 답글 초안 월 50번", desc: "손님 리뷰에 쓸 답글을 대신 써드려요" },
      { title: "블로그 점검", desc: "홍보 글과 정보 글 비율을 보고, 더 잘 찾히는 제목을 제안해요" },
      { title: "스마트플레이스 자동 점검", desc: "소개글·FAQ·소식 중 빠진 곳을 찾아드려요" },
      { title: "부족한 검색어 복사", desc: "버튼 한 번으로 복사해 스마트플레이스에 붙여넣어요" },
      { title: "내 가게 성장 단계", desc: "시작 · 성장 · 빠른 성장 · 지역 1등 중 어디쯤인지 알려드려요" },
      { title: "엑셀 파일 내려받기 · 변화 기록 60일 보관", desc: "파일로 저장하고 최근 60일 변화를 볼 수 있어요" },
    ],
    cta: "무료 회원가입",
    href: "/signup",
    isPay: true,
  },
  {
    name: "Pro",
    price: "29,900원",
    period: "/ 월",
    amount: 29900,
    highlight: false,
    badge: "성장 중인 가게",
    description: "옆 가게의 움직임을 놓치지 않고, 고친 효과까지 확인해요",
    highlights: [
      { title: "일주일에 3번 자동 확인", desc: "월·수·금마다 확인해서 변화를 빨리 알아요" },
      { title: "근처 가게 5곳 변화 알림", desc: "옆 가게가 소식·FAQ를 올리거나 리뷰·사진이 크게 늘면 매주 월요일에 알려드려요" },
      { title: "고친 뒤 7일 후 효과 확인", desc: "내가 한 일이 AI 검색에 반영됐는지 자동으로 다시 봐요" },
      { title: "안내서 월 10번 · 리뷰 답글 무제한", desc: "가게 2곳까지, PDF 리포트와 ChatGPT 광고 대비 안내도 포함" },
    ],
    moreFeatures: [
      { title: "Basic의 모든 기능", desc: "블로그 점검, 스마트플레이스 자동 점검, 성장 단계 등" },
      { title: "원할 때 바로 확인, 하루 5번", desc: "고친 뒤 ChatGPT·네이버 결과를 바로 확인" },
      { title: "근처 가게 5곳 검색어 비교", desc: "아무도 안 쓰는 검색어를 바로 찾아요" },
      { title: "어떤 질문에서 빠지는지", desc: "손님이 이렇게 물어볼 때 내 가게가 안 나오는지 알려드려요" },
      { title: "리뷰 답글 초안 무제한", desc: "리뷰가 많아도 그날 바로 답글을 준비할 수 있어요" },
      { title: "ChatGPT 광고 대비 안내", desc: "광고가 붙기 시작할 때 어떻게 대응할지 알려드려요" },
      { title: "PDF·엑셀 내려받기 · 변화 기록 90일 보관", desc: "리포트를 저장하고 최근 90일 변화를 볼 수 있어요" },
      { title: "가게 2곳까지 등록", desc: "지점이 둘일 때도 한 계정으로 관리해요" },
    ],
    cta: "시작하기",
    href: "/signup",
    isPay: true,
  },
  // Biz 플랜은 다점포·대행사 대상 이메일 영업 전용 (isPay: false = 토스 결제 불가)
  // 영업 완료 후 별도 결제 링크 제공. webhook.py에 34900이 있는 것은 백엔드 유연성 유지용.
  {
    name: "Biz",
    price: "79,500원",
    period: "/ 월",
    amount: 79500,
    highlight: false,
    badge: "다점포 · 대행사",
    description: "가게 5곳을 매일 자동 확인 · 비교할 가게 수 제한 없음 · 안내서 월 20번",
    highlights: [
      { title: "가게 5곳을 매일 자동 확인", desc: "전 매장 현황을 한눈에 봐요" },
      { title: "비교할 근처 가게 제한 없음", desc: "몇 곳이든 시장 전체를 살펴봐요" },
      { title: "안내서 월 20번", desc: "가게별 맞춤 행동 계획을 받아요" },
    ],
    moreFeatures: [
      { title: "원할 때 바로 확인, 하루 10번", desc: "가게당 2번씩 바로 확인할 수 있어요" },
      { title: "리뷰 답글 초안 무제한", desc: "리뷰가 몰려도 그날 바로 대응해요" },
      { title: "창업·신규 지점 출점 전략 시장 분석 리포트", desc: "새 지점을 낼 때 참고할 시장 자료예요" },
      { title: "ChatGPT 광고 대비 안내", desc: "Pro에 포함된 모든 기능이 들어 있어요" },
      { title: "변화 기록 무제한 · 엑셀·PDF 무제한", desc: "기록을 계속 보관하고 파일로 저장해요" },
    ],
    cta: "문의하기",
    href: "mailto:support@aeolab.co.kr",
    isPay: false,
  },
  {
    name: "창업패키지",
    price: "23,900원",
    period: "/ 월",
    amount: 23900,  // PLAN_PRICES.startup과 동기화
    highlight: false,
    badge: "예비 창업자 전용",
    description: "가게를 열기 전에 그 동네 사정을 먼저 알아봐요",
    highlights: [
      { title: "그 동네 같은 가게가 몇 곳인지", desc: "국세청 사업자 자료로 가게 수와 문 닫은 비율을 보여드려요" },
      { title: "경쟁 가게가 놓친 부분 찾기", desc: "소개글·소식이 비어 있는 가게를 알려드려 내 가게의 차별점을 잡아요" },
      { title: "일주일에 1번 자동 확인", desc: "매주 월요일, 오픈 준비에 집중할 수 있게 가볍게 확인해요" },
      { title: "안내서 월 5번 · 리뷰 답글 무제한", desc: "근처 가게 5곳과 비교, 90일 변화 기록" },
    ],
    moreFeatures: [
      { title: "시장 규모와 가게 밀도", desc: "국세청 사업자 자료로 그 동네에 같은 업종이 얼마나 있는지 보여드려요" },
      { title: "문 닫은 가게 비율", desc: "업종별로 얼마나 오래 버티는지 참고할 수 있어요" },
      { title: "경쟁 강도 진단", desc: "들어가기 쉬운지 어려운지, 어떻게 달라 보일지 알려드려요" },
      { title: "경쟁 가게 준비 상태", desc: "소개글·소식이 빠진 가게로 차별점을 찾아요" },
      { title: "원할 때 바로 확인, 하루 3번", desc: "오픈 후에도 비교·안내서·리뷰 답글 한도는 Basic 이상이에요" },
      { title: "엑셀 내려받기 · 90일 성장 추이", desc: "창업 준비부터 오픈 후까지 이어서 볼 수 있어요" },
    ],
    cta: "시작하기",
    href: "/signup",
    isPay: true,
  },
];

// 가격 단일 소스 — backend/config/prices.py PLAN_PRICES와 일치해야 함
// AdminDashboard MRR 계산, layout.tsx JSON-LD AggregateOffer 등에서 import해서 사용
export const PLAN_PRICES: Record<string, number> = {
  basic:      17900,
  startup:    23900,
  pro:        29900,
  biz:        79500,
  enterprise: 200000,  // 영업 전용 (PLAN_LIMITS·결제 흐름 미정의)
};

export const FIRST_MONTH_DISCOUNT_PRICES: Record<string, number> = {
  basic: 8950,
};

