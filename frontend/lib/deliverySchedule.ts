// 대행 서비스 제공 주기 단일 소스 (2026-09-30 토스페이먼츠 단건결제 심사 요청으로 신설)
// 랜딩 카드·/delivery·/delivery/new·이용약관 제5조의2가 모두 이 값을 참조한다.
// 완료 기한 수치(5·7영업일)는 운영 약속이므로 변경 시 이 파일과 운영 매뉴얼을 함께 수정할 것.

export interface DeliverySchedule {
  /** 결제 후 착수 시점 */
  start: string;
  /** 자료 제출 후 작업 완료 기한 */
  complete: string;
  /** 패키지별 추가 제공 일정 */
  extras: string[];
}

export const DELIVERY_FREQUENCY = "1회성 제공 (정기 반복 서비스 아님)";

export const DELIVERY_START = "결제 후 영업일 1~2일 내 담당자가 카카오톡으로 연락 후 작업 시작";

export const DELIVERY_NAVER_REVIEW_NOTE =
  "네이버 스마트플레이스 등록 심사 기간(통상 최대 5영업일, 네이버 사정에 따라 변동)은 작업 완료 기한에 포함되지 않습니다.";

export const DELIVERY_SCHEDULE: Record<string, DeliverySchedule> = {
  smartplace_register: {
    start: DELIVERY_START,
    complete: "자료 제출 후 영업일 5일 이내 작업 완료",
    extras: [DELIVERY_NAVER_REVIEW_NOTE],
  },
  ai_optimization: {
    start: DELIVERY_START,
    complete: "자료 제출 후 영업일 5일 이내 작업 완료",
    extras: [],
  },
  comprehensive: {
    start: DELIVERY_START,
    complete: "자료 제출 후 영업일 7일 이내 작업 완료",
    extras: [
      DELIVERY_NAVER_REVIEW_NOTE,
      "1:1 화상 코칭 60분: 카카오톡으로 일정 협의 후 예약 진행",
      "30일 재진단 보고서: 작업 완료일로부터 30일 후 제공",
    ],
  },
};
