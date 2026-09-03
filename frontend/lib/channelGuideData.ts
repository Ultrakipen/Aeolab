/**
 * 59개 업종별 AI 노출 채널 가이드 데이터
 * category_channel_matrix_v1.0.md 기준 — M2-4 SSG 페이지 단일 소스
 *
 * keyActions 작성 기준 (2026-09-03 전수 구체화): "N자 이상"·"N장 이상"·"N건 이상" 등
 * 실행 가능한 수치 기준을 포함한다. 사업장별 실제 보유 수치를 단정하는 게 아니라
 * "권장 행동 지침"이므로 CLAUDE.md의 AI 생성 콘텐츠 사실 지어내기 금지 원칙과는
 * 무관 — 이 문서는 사업장 개별 데이터가 아닌 업종 공통 가이드다.
 */

export type BriefingStatus = "active" | "likely" | "inactive"
export type ChannelGroup = "A" | "B" | "C" | "D" | "E"

export interface ChannelGuideEntry {
  value: string
  label: string
  group: ChannelGroup
  briefing: BriefingStatus
  naverRatio: number   // 0~100
  globalRatio: number  // 0~100
  keyActions: string[] // 5요소
  note?: string        // 부가 설명 (optional)
}

export const CHANNEL_GUIDE: ChannelGuideEntry[] = [
  // ── Group A: 외식·숙박업 (5개) ──────────────────────────────────────────
  {
    value: "restaurant", label: "음식점", group: "A",
    briefing: "active", naverRatio: 80, globalRatio: 20,
    keyActions: ["스마트플레이스 소개글 200자 이상 + 대표 메뉴 3개 이상(가격 포함) 등록", "메뉴·내부·외관 사진 10장 이상 등록", "네이버 예약 연동 + 톡톡 채팅방 메뉴 설정(예약·문의 버튼)", "영업시간(브레이크타임 포함)·정기 휴무일 정확히 입력", "리뷰 답글 3건 이상 작성 + 소식 2주 이내 1건 등록"],
    note: "예약 연동 시 AI탭에 예약 버튼 즉시 노출 → 전환 효과 최상",
  },
  {
    value: "cafe", label: "카페", group: "A",
    briefing: "active", naverRatio: 75, globalRatio: 25,
    keyActions: ["스마트플레이스 소개글 200자 이상 + 시그니처 음료 사진 3장 이상 등록", "음료·인테리어·외관 사진 15장 이상 업로드", "좌석 유형(창가·소파)·와이파이·반려동물 동반 여부 명시", "영업시간·라스트오더 정확히 입력", "소식 주 1회 이상 작성 (신메뉴·시즌 음료)"],
  },
  {
    value: "bakery", label: "베이커리", group: "A",
    briefing: "active", naverRatio: 60, globalRatio: 40,
    keyActions: ["스마트플레이스 소개글 200자 이상 (주력 제품 포함) 작성", "제품·진열·매장 사진 10장 이상 업로드", "당일 생산 시간·품목 소식 등록 (2주 이내 최소 1건)", "영업시간·마감 시간 정확히 입력", "포장 가능 여부·주문 방법 + 알레르기 유발 성분 안내"],
  },
  {
    value: "bar", label: "술집", group: "A",
    briefing: "active", naverRatio: 80, globalRatio: 20,
    keyActions: ["스마트플레이스 소개글 200자 이상 (대표 주류·안주 포함) 작성", "주류·안주·분위기 사진 10장 이상 업로드", "영업시간 정확히 입력 (라스트오더 포함)", "네이버 예약 또는 입장 안내 등록", "리뷰 답글 3건 이상 + 신메뉴·이벤트 소식 등록"],
  },
  {
    value: "accommodation", label: "숙박", group: "A",
    briefing: "active", naverRatio: 70, globalRatio: 30,
    keyActions: ["스마트플레이스 소개글 200자 이상 (객실 유형·특징 포함) + 주변 관광지 키워드 포함", "객실 내부 사진 10장 이상 업로드 (침실·욕실·전망 포함)", "편의시설 목록 완성 (주차·수영장·조식·와이파이 등)", "체크인·체크아웃 시간 + 취소·환불 정책 명확히 게시", "네이버 예약 연동 설정"],
  },

  // ── Group B: 네이버 우세형 — AI탭 우선, AI 브리핑 확대 대기 (12개) ────
  {
    value: "beauty", label: "미용실", group: "B",
    briefing: "likely", naverRatio: 70, globalRatio: 30,
    keyActions: ["스마트플레이스 소개글 200자 이상 (주요 시술 포함) 작성", "시술 전후 비교 사진 3세트 이상 + 매장 사진 15장 이상 업로드", "디자이너 프로필·경력 + 자격증·수상 이력 명시", "주요 시술 가격표 공개", "네이버 예약 연동 + 소식 2주 이내 1건 작성"],
  },
  {
    value: "nail", label: "네일샵", group: "B",
    briefing: "likely", naverRatio: 60, globalRatio: 40,
    keyActions: ["스마트플레이스 소개글 200자 이상 + 디자인 포트폴리오 사진 10장 이상 등록", "시술별 가격표 입력 (젤·아트 등 유형별)", "네이버 예약 또는 카카오 채널 예약 연동", "시술 소요 시간 안내 작성", "신규 디자인 소식 2주 이내 1건 작성"],
  },
  {
    value: "skincare", label: "피부관리실", group: "B",
    briefing: "likely", naverRatio: 70, globalRatio: 30,
    keyActions: ["스마트플레이스 소개글 200자 이상 (주요 관리 프로그램 포함) 작성", "시술 전후 비교 사진 3세트 이상 + 시설 사진 10장 이상 업로드", "관리사 자격증·경력 명시", "관리 프로그램별 가격표 공개", "예약 연동 + 소식 2주 이내 1건 작성"],
  },
  {
    value: "massage", label: "마사지", group: "B",
    briefing: "likely", naverRatio: 70, globalRatio: 30,
    keyActions: ["스마트플레이스 소개글 200자 이상 (마사지 종류 포함) 작성", "시설·룸 사진 10장 이상 업로드", "마사지 종류별·시간별 가격표 공개", "예약 방법 + 영업시간(심야 영업 여부) 정확히 입력", "리뷰 답글 3건 이상 작성"],
  },
  {
    value: "spa", label: "스파", group: "B",
    briefing: "likely", naverRatio: 65, globalRatio: 35,
    keyActions: ["스마트플레이스 소개글 200자 이상 (대표 프로그램 포함) 작성", "시설·부대시설(사우나·풀 등) 사진 10장 이상 업로드", "코스별 가격표 공개", "예약 연동 설정", "리뷰 답글 3건 이상 작성"],
  },
  {
    value: "pet", label: "반려동물", group: "B",
    briefing: "likely", naverRatio: 70, globalRatio: 30,
    keyActions: ["스마트플레이스 소개글 200자 이상 (주요 서비스 포함) 작성", "미용 전후 비교 사진 3세트 이상 + 매장 사진 10장 이상 업로드", "서비스별 요금표 입력 (미용·목욕·호텔 등)", "담당자 자격증·경력 정보 작성", "예약 방법·취소 정책 안내 + 영업시간(정기 휴무일 포함) 입력"],
  },
  {
    value: "fitness", label: "헬스장", group: "B",
    briefing: "likely", naverRatio: 65, globalRatio: 35,
    keyActions: ["스마트플레이스 소개글 200자 이상 + 시설 내부 사진 10장 이상 등록 (기구·샤워·휴게 포함)", "트레이너 프로필·자격증 정보 작성", "회원권 가격표 + 체험 PT 프로그램 안내", "운영시간 정확히 입력 (휴일 포함)", "카카오 채널 또는 네이버 예약 상담 연동"],
  },
  {
    value: "yoga", label: "요가·필라테스", group: "B",
    briefing: "likely", naverRatio: 65, globalRatio: 35,
    keyActions: ["스마트플레이스 소개글 200자 이상 (수업 종류 포함) 작성", "수업·시설 사진 10장 이상 업로드", "강사 경력·자격증 명시", "회원권 가격표 + 체험 수업 안내", "예약 연동 + 소식 2주 이내 1건 작성"],
  },
  {
    value: "pharmacy", label: "약국", group: "B",
    briefing: "likely", naverRatio: 75, globalRatio: 25,
    keyActions: ["스마트플레이스 소개글 200자 이상 (취급 분야 포함) 작성", "매장 사진 5장 이상 업로드", "영업시간(야간·공휴일 운영 여부) 정확히 입력", "상담 가능 분야·처방전 조제 가능 여부 명시", "위치·주차 정보 상세 기재"],
  },
  {
    value: "dance", label: "댄스", group: "B",
    briefing: "likely", naverRatio: 70, globalRatio: 30,
    keyActions: ["스마트플레이스 소개글 200자 이상 (수업 종류 포함) 작성", "수업·발표회 사진 10장 이상 업로드", "강사 경력 명시", "수강권 가격표 공개", "예약·체험 수업 안내 + 소식 2주 이내 1건 작성"],
  },
  {
    value: "ballet", label: "발레", group: "B",
    briefing: "likely", naverRatio: 70, globalRatio: 30,
    keyActions: ["스마트플레이스 소개글 200자 이상 (연령대별 커리큘럼 포함) 작성", "수업·발표회 사진 10장 이상 업로드", "강사 경력·전공 명시", "클래스별 가격표 공개", "예약 연동 + 콩쿠르·발표회 성과 소식 등록"],
  },
  {
    value: "semi_permanent", label: "반영구화장", group: "B",
    briefing: "likely", naverRatio: 70, globalRatio: 30,
    keyActions: ["스마트플레이스 소개글 200자 이상 (시술 종류 포함) 작성", "Before/After 사진 3세트 이상 + 매장 사진 10장 이상 업로드", "시술사 자격증·경력 명시", "시술별 가격표 공개", "예약 연동 + 소식 2주 이내 1건 작성"],
  },

  // ── Group C: 전문서비스업 — AI탭 중심, 콘텐츠 매핑 완료 (10개) ─────────
  {
    value: "medical", label: "병원·의원", group: "C",
    briefing: "inactive", naverRatio: 55, globalRatio: 45,
    keyActions: ["스마트플레이스 소개글 200자 이상 (진료 과목 포함) 작성", "병원 내부·장비 사진 5장 이상 업로드", "의료진 경력·학력 상세 공개", "진료시간(야간·주말 진료 여부) 정확히 입력", "예약 방법 안내 + 리뷰 답글 3건 이상 작성"],
    note: "금융·헬스케어 특화 AI 브리핑 도입 시 LIKELY 즉시 승급 후보",
  },
  {
    value: "dental", label: "치과", group: "C",
    briefing: "inactive", naverRatio: 60, globalRatio: 40,
    keyActions: ["스마트플레이스 소개글 200자 이상 (주력 진료 분야 포함) 작성", "치료 사례·시설 사진 5장 이상 업로드", "임플란트·교정 등 시술별 가격대 공개", "진료시간(야간 진료 여부) 정확히 입력", "예약 연동 + 리뷰 답글 3건 이상 작성"],
    note: "금융·헬스케어 특화 AI 브리핑 도입 시 LIKELY 즉시 승급 후보",
  },
  {
    value: "oriental_medicine", label: "한의원", group: "C",
    briefing: "inactive", naverRatio: 70, globalRatio: 30,
    keyActions: ["스마트플레이스 소개글 200자 이상 (주력 진료 분야 포함) 작성", "진료실·시설 사진 5장 이상 업로드", "한약·시술 가격대 공개", "진료시간 정확히 입력", "예약 연동 + 리뷰 답글 3건 이상 작성"],
  },
  {
    value: "legal", label: "법률", group: "C",
    briefing: "inactive", naverRatio: 20, globalRatio: 80,
    keyActions: ["스마트플레이스 소개글 200자 이상 (전문 분야 3개 이상 명시) 작성", "경력·수상 이력 구체적으로 공개 (승소 사례 포함)", "상담 방식(유선·방문·온라인)별 가능 시간 안내", "초기 무료 상담 여부·상담료 명시", "성공 사례(익명 처리) 3건 이상 등록"],
    note: "글로벌 AI(ChatGPT·Gemini) 비중이 더 높음. ChatGPT 최적화 병행 권장",
  },
  {
    value: "accounting", label: "세무·회계", group: "C",
    briefing: "inactive", naverRatio: 30, globalRatio: 70,
    keyActions: ["스마트플레이스 소개글 200자 이상 (전문 분야 3개 이상 명시) 작성", "경력·자격(세무사·회계사) 구체적으로 공개", "기장대행·신고 대행별 서비스 범위 안내", "초기 무료 상담 여부 명시", "고객 후기 3건 이상 등록"],
  },
  {
    value: "education", label: "학원", group: "C",
    briefing: "inactive", naverRatio: 40, globalRatio: 60,
    keyActions: ["스마트플레이스 소개글 200자 이상 (수업 과목·대상 연령 포함) 작성", "구글 비즈니스 프로필 등록 (business.google.com) — Gemini 노출에 특히 중요", "강사 프로필·자격증·경력 소개 + 커리큘럼 안내 게시", "수강료 정보(과목별·수준별) + 원생 수강 후기 3건 이상 확보", "체험 수업 안내 + 상담 신청 방법 명확히 표시"],
  },
  {
    value: "tutoring", label: "과외", group: "C",
    briefing: "inactive", naverRatio: 40, globalRatio: 60,
    keyActions: ["스마트플레이스 소개글 200자 이상 (전문 과목·대상 학년 포함) 작성", "강사 학력·경력 구체적으로 공개", "과목별·시간당 수업료 안내", "온라인·방문 수업 가능 여부 명시", "학부모·학생 후기 3건 이상 등록"],
  },
  {
    value: "realestate", label: "부동산", group: "C",
    briefing: "inactive", naverRatio: 70, globalRatio: 30,
    keyActions: ["스마트플레이스 소개글 200자 이상 (취급 매물·전문 지역 포함) 작성", "매물 사진 10장 이상 등록", "공인중개사 경력·중개 실적 구체적으로 공개", "영업시간·연락처 최신화", "고객 후기 3건 이상 등록"],
  },
  {
    value: "interior", label: "인테리어", group: "C",
    briefing: "inactive", naverRatio: 55, globalRatio: 45,
    keyActions: ["스마트플레이스 소개글 200자 이상 (시공 분야 포함) 작성", "시공 전후 포트폴리오 사진 10장 이상 등록", "견적 산정 방식 안내", "A/S 정책(하자보수 기간 등) 명시", "완공 사례 후기 3건 이상 등록"],
  },
  {
    value: "fashion", label: "패션", group: "C",
    briefing: "inactive", naverRatio: 60, globalRatio: 40,
    keyActions: ["스마트플레이스 소개글 200자 이상 (브랜드·스타일 컨셉 포함) 작성", "상품 사진 15장 이상 등록", "배송·반품 정책 명시", "영업시간·재고 확인 방법 안내", "정기 세일·신상품 소식 2주 이내 1건 등록"],
  },

  // ── Group D: 생활서비스업 — AI탭 가능, 콘텐츠 매핑 완료 (32개) ─────────
  {
    value: "photo", label: "사진스튜디오", group: "D",
    briefing: "inactive", naverRatio: 70, globalRatio: 30,
    keyActions: ["스마트플레이스 소개글 200자 이상 (촬영 분야 포함) 작성", "촬영 분야별 포트폴리오 사진 15장 이상 등록", "패키지별 가격표 공개", "예약 연동 설정", "납품 사례 후기 3건 이상 등록"],
  },
  {
    value: "video", label: "영상제작", group: "D",
    briefing: "inactive", naverRatio: 55, globalRatio: 45,
    keyActions: ["스마트플레이스 소개글 200자 이상 (영상 유형 포함) 작성", "제작 사례 포트폴리오 10편 이상 링크 등록", "유형별 제작 기간·가격대 안내", "예약·문의 방법 명시", "납품 후기 3건 이상 등록"],
  },
  {
    value: "design", label: "디자인", group: "D",
    briefing: "inactive", naverRatio: 35, globalRatio: 65,
    keyActions: ["스마트플레이스 소개글 200자 이상 (디자인 분야 포함) 작성", "작업 사례 포트폴리오 10건 이상 등록", "수정 횟수 포함 가격표 공개", "작업 일정·납기 안내", "고객 후기 3건 이상 등록"],
  },
  {
    value: "auto", label: "카센터·정비", group: "D",
    briefing: "inactive", naverRatio: 70, globalRatio: 30,
    keyActions: ["스마트플레이스 소개글 200자 이상 (주요 정비 항목 포함) 작성", "정비소 시설 사진 5장 이상 등록", "엔진오일·타이어 등 항목별 가격 공개", "영업시간·예약 방법 안내", "리뷰 답글 3건 이상 작성"],
  },
  {
    value: "cleaning", label: "청소", group: "D",
    briefing: "inactive", naverRatio: 60, globalRatio: 40,
    keyActions: ["스마트플레이스 소개글 200자 이상 (청소 종류 포함) 작성", "작업 전후 사진 10장 이상 등록", "입주·정기·특수 청소 유형별 가격 공개", "예약 방법·무료 견적 여부 안내", "고객 후기 3건 이상 등록"],
  },
  {
    value: "shopping", label: "쇼핑몰", group: "D",
    briefing: "inactive", naverRatio: 10, globalRatio: 90,
    keyActions: ["스마트플레이스 소개글 200자 이상 (주요 상품군 포함) 작성", "대표 상품 사진 15장 이상 등록", "배송·적립 혜택 정책 명시", "AI 쇼핑 Schema.org 상품 구조화 데이터 적용", "리뷰 답글 3건 이상 작성 + 평점 관리"],
    note: "글로벌 AI 비중이 압도적으로 높음. AI 쇼핑 구조화 데이터 작성 우선",
  },
  {
    value: "optics", label: "안경원", group: "D",
    briefing: "inactive", naverRatio: 75, globalRatio: 25,
    keyActions: ["스마트플레이스 소개글 200자 이상 (취급 브랜드 포함) 작성", "매장·상품 사진 10장 이상 등록", "안경·렌즈 가격대 공개", "무료 시력검사·제작 소요 시간 안내", "영업시간·주차 정보 명시"],
  },
  {
    value: "martial_arts", label: "태권도·무술", group: "D",
    briefing: "inactive", naverRatio: 70, globalRatio: 30,
    keyActions: ["스마트플레이스 소개글 200자 이상 (종목·대상 연령 포함) 작성", "수업·승급 심사 사진 10장 이상 등록", "관장·사범 자격증(단증) 공개", "수강권 가격표 + 시간표 안내", "체험 수업 안내 + 소식 2주 이내 1건 등록"],
  },
  {
    value: "climbing", label: "클라이밍·볼더링", group: "D",
    briefing: "inactive", naverRatio: 60, globalRatio: 40,
    keyActions: ["스마트플레이스 소개글 200자 이상 (난이도 구성 포함) 작성", "시설·벽면 사진 10장 이상 등록", "이용권 가격표(1일권·월정액) 공개", "장비 대여 여부·초보자 강습 안내", "영업시간 명시"],
  },
  {
    value: "art_class", label: "미술학원", group: "D",
    briefing: "inactive", naverRatio: 60, globalRatio: 40,
    keyActions: ["스마트플레이스 소개글 200자 이상 (수업 대상·과정 포함) 작성", "학생 작품·수업 사진 10장 이상 등록", "강사 경력 명시", "반별 수강료 공개", "전시·발표회 성과 소식 2주 이내 1건 등록"],
  },
  {
    value: "childcare", label: "어린이집·유치원", group: "D",
    briefing: "inactive", naverRatio: 75, globalRatio: 25,
    keyActions: ["스마트플레이스 소개글 200자 이상 (보육 프로그램 포함) 작성", "시설·놀이공간 사진 10장 이상 등록", "보육 시간·비용·보조금 정보 공개", "CCTV·안전 관리 방침 명시", "부모 참관 가능 여부·셔틀 운행 안내"],
  },
  {
    value: "car_wash", label: "세차장", group: "D",
    briefing: "inactive", naverRatio: 75, globalRatio: 25,
    keyActions: ["스마트플레이스 소개글 200자 이상 (코스 종류 포함) 작성", "시설 사진 5장 이상 등록", "코스별 가격표(광택·코팅 포함) 공개", "예약 방법·영업시간 안내", "리뷰 답글 3건 이상 작성"],
  },
  {
    value: "electronics_repair", label: "핸드폰·가전수리", group: "D",
    briefing: "inactive", naverRatio: 70, globalRatio: 30,
    keyActions: ["스마트플레이스 소개글 200자 이상 (수리 가능 기종 포함) 작성", "작업 사례 사진 5장 이상 등록", "액정·배터리 등 부품별 가격표 공개", "당일 수리·출장 수리 가능 여부 안내", "리뷰 답글 3건 이상 작성"],
  },
  {
    value: "footwear", label: "신발", group: "D",
    briefing: "inactive", naverRatio: 45, globalRatio: 55,
    keyActions: ["스마트플레이스 소개글 200자 이상 (취급 브랜드 포함) 작성", "상품 사진 15장 이상 등록", "가격·할인 정보 + 사이즈 재고 확인 방법 안내", "무료 배송·반품 정책 명시", "영업시간·위치 안내"],
  },
  {
    value: "stationery", label: "문구·사무용품", group: "D",
    briefing: "inactive", naverRatio: 60, globalRatio: 40,
    keyActions: ["스마트플레이스 소개글 200자 이상 (취급 품목 포함) 작성", "매장 사진 5장 이상 등록", "단체·학교 납품 가능 여부 안내", "결제 방법·영업시간 명시", "위치 접근성 강조"],
  },
  {
    value: "norebang", label: "노래방", group: "D",
    briefing: "inactive", naverRatio: 80, globalRatio: 20,
    keyActions: ["스마트플레이스 소개글 200자 이상 (룸 구성 포함) 작성", "룸 시설 사진 10장 이상 등록", "시간당 가격표(할인 시간대 포함) 공개", "24시간 운영 여부 명시", "음식·주류 반입 가능 여부 안내"],
  },
  {
    value: "billiards", label: "당구장", group: "D",
    briefing: "inactive", naverRatio: 75, globalRatio: 25,
    keyActions: ["스마트플레이스 소개글 200자 이상 (테이블 구성 포함) 작성", "테이블·시설 사진 5장 이상 등록", "시간당 가격·월정액 요금표 공개", "24시간 운영 여부 명시", "음식·음료 제공 여부 안내"],
  },
  {
    value: "flower", label: "꽃집·화원", group: "D",
    briefing: "inactive", naverRatio: 75, globalRatio: 25,
    keyActions: ["스마트플레이스 소개글 200자 이상 (주력 상품 포함) 작성", "부케·화환 사진 15장 이상 등록", "가격대·맞춤 제작 가능 여부 안내", "당일 배달 가능 지역·시간 명시", "예약·주문 방법 안내"],
  },
  {
    value: "laundry", label: "세탁소", group: "D",
    briefing: "inactive", naverRatio: 75, globalRatio: 25,
    keyActions: ["스마트플레이스 소개글 200자 이상 (취급 품목 포함) 작성", "매장 사진 5장 이상 등록", "품목별 가격표 공개", "수거·배달 서비스 + 소요 기간 안내", "특수 세탁(가죽·명품) 가능 품목 명시"],
  },
  {
    value: "clothing", label: "의류", group: "D",
    briefing: "inactive", naverRatio: 50, globalRatio: 50,
    keyActions: ["스마트플레이스 소개글 200자 이상 (취급 품목 포함) 작성", "상품 사진 15장 이상 등록", "사이즈·가격 정보 상세 안내", "온라인 주문·배송 정책 공개", "정기 세일·신상품 소식 2주 이내 1건 등록"],
  },
  {
    value: "kids", label: "키즈카페", group: "D",
    briefing: "inactive", naverRatio: 75, globalRatio: 25,
    keyActions: ["스마트플레이스 소개글 200자 이상 (놀이시설 구성 포함) 작성", "놀이시설 사진 10장 이상 등록", "이용 가능 연령·시간당 가격 공개", "예약 방법 + 안전·위생 관리 방침 명시", "생일파티 패키지 가격·구성 안내"],
  },
  {
    value: "study", label: "스터디카페", group: "D",
    briefing: "inactive", naverRatio: 70, globalRatio: 30,
    keyActions: ["스마트플레이스 소개글 200자 이상 (좌석 구성 포함) 작성", "좌석·시설 사진 10장 이상 등록", "이용권 가격표(시간권·정기권) 공개", "24시간 운영 여부 명시", "프린터·무제한 음료 등 부대시설 안내"],
  },
  {
    value: "workshop", label: "공방·공예", group: "D",
    briefing: "inactive", naverRatio: 55, globalRatio: 45,
    keyActions: ["스마트플레이스 소개글 200자 이상 (체험 분야 포함) 작성", "체험 결과물·수업 사진 10장 이상 등록", "강사 경력 명시", "1인당 가격·최소 인원 안내", "원데이·정기 클래스 구분 + 예약 방법 안내"],
  },
  {
    value: "music_class", label: "음악교실", group: "D",
    briefing: "inactive", naverRatio: 60, globalRatio: 40,
    keyActions: ["스마트플레이스 소개글 200자 이상 (악기·수업 대상 포함) 작성", "수업·발표회 사진 10장 이상 등록", "강사 경력·자격 명시", "레슨 종류별 가격표 공개", "발표회·연주회 성과 소식 2주 이내 1건 등록"],
  },
  {
    value: "music_lesson", label: "악기레슨", group: "D",
    briefing: "inactive", naverRatio: 55, globalRatio: 45,
    keyActions: ["스마트플레이스 소개글 200자 이상 (레슨 가능 악기 포함) 작성", "레슨·연주 사진 5장 이상 등록", "강사 경력 공개", "1:1·그룹 레슨별 가격표 안내", "방문 레슨 가능 여부·초보자 커리큘럼 명시"],
  },
  {
    value: "music_studio", label: "작곡·레코딩 스튜디오", group: "D",
    briefing: "inactive", naverRatio: 55, globalRatio: 45,
    keyActions: ["스마트플레이스 소개글 200자 이상 (작업 가능 장르 포함) 작성", "스튜디오·장비 사진 10장 이상 등록", "녹음·믹싱·마스터링별 요금표 공개", "예약 방법 명시", "작업물 포트폴리오 3건 이상 등록"],
  },
  {
    value: "cooking", label: "요리교실·쿠킹", group: "D",
    briefing: "inactive", naverRatio: 60, globalRatio: 40,
    keyActions: ["스마트플레이스 소개글 200자 이상 (수업 종류 포함) 작성", "수업·완성 요리 사진 10장 이상 등록", "강사 경력 명시", "1회 수강료(재료비 포함 여부) 공개", "초보자 환영 여부 + 소식 2주 이내 1건 등록"],
  },
  {
    value: "experience", label: "체험공간", group: "D",
    briefing: "inactive", naverRatio: 55, globalRatio: 45,
    keyActions: ["스마트플레이스 소개글 200자 이상 (체험 종류 포함) 작성", "체험 결과물·공간 사진 10장 이상 등록", "1인당 가격·최소 인원 안내", "예약 방법 + 소요 시간 명시", "생일파티·단체 예약 패키지 안내"],
  },
  {
    value: "golf", label: "골프연습장", group: "D",
    briefing: "inactive", naverRatio: 70, globalRatio: 30,
    keyActions: ["스마트플레이스 소개글 200자 이상 (시설 구성 포함) 작성", "타석·시뮬레이터 사진 10장 이상 등록", "이용 요금제(시간권·월정액) 공개", "레슨 프로그램·가격 안내", "24시간 운영 여부 명시"],
  },
  {
    value: "swim", label: "수영·아쿠아", group: "D",
    briefing: "inactive", naverRatio: 70, globalRatio: 30,
    keyActions: ["스마트플레이스 소개글 200자 이상 (강습 구성 포함) 작성", "수영장 시설 사진 10장 이상 등록", "강습 종류별 가격표 공개", "자유수영 시간·운영시간 명시", "레벨별 강습반·초보자 프로그램 안내"],
  },
  {
    value: "jjimjil", label: "찜질방·사우나", group: "D",
    briefing: "inactive", naverRatio: 75, globalRatio: 25,
    keyActions: ["스마트플레이스 소개글 200자 이상 (부대시설 포함) 작성", "시설 사진 10장 이상 등록", "이용 가격·코스(가족실·커플실 포함) 공개", "24시간 운영 여부 명시", "한증막·황토방 등 특화 시설 안내"],
  },
  {
    value: "escape", label: "방탈출", group: "D",
    briefing: "inactive", naverRatio: 60, globalRatio: 40,
    keyActions: ["스마트플레이스 소개글 200자 이상 (테마 구성 포함) 작성", "테마별 사진·티저 영상 5장 이상 등록", "테마별 가격·인원 안내", "난이도·소요 시간 명시", "생일파티·단체 예약 패키지 안내"],
  },

  // ── Group E: 업종 미분류 (1개) ───────────────────────────────────────
  {
    value: "other", label: "기타", group: "E",
    briefing: "inactive", naverRatio: 60, globalRatio: 40,
    keyActions: ["스마트플레이스 소개글 200자 이상 작성 + 이름·주소·전화·영업시간 정보 완성", "매장·상품·서비스 사진 10장 이상 등록", "구글 비즈니스 프로필 등록·최적화 (business.google.com)", "ChatGPT·Gemini가 인용할 수 있는 소개글 + Schema.org 구조화 데이터 적용", "외부 블로그·SNS 언급 확대 + 리뷰 답글 3건 이상 작성"],
    note: "'플레이스형' 네이버 AI 브리핑 대상 외 업종. 59개 세부 업종 중 어디에도 해당하지 않아 네이버·글로벌 채널 비중은 중립 기본값(60%/40%)을 적용합니다. 블로그·콘텐츠로 '정보형 AI 브리핑' 노출도 가능합니다.",
  },
]

/** value → ChannelGuideEntry */
export const CHANNEL_GUIDE_MAP: Record<string, ChannelGuideEntry> = Object.fromEntries(
  CHANNEL_GUIDE.map((e) => [e.value, e])
)

export const GROUP_LABELS: Record<ChannelGroup, string> = {
  A: "외식·숙박업",
  B: "네이버 우세형",
  C: "전문서비스업",
  D: "생활서비스업",
  E: "업종 미분류",
}

export const GROUP_COLORS: Record<ChannelGroup, string> = {
  A: "bg-emerald-100 text-emerald-800 border-emerald-200",
  B: "bg-blue-100 text-blue-800 border-blue-200",
  C: "bg-indigo-100 text-indigo-800 border-indigo-200",
  D: "bg-amber-100 text-amber-800 border-amber-200",
  E: "bg-gray-100 text-gray-700 border-gray-200",
}

export const BRIEFING_LABELS: Record<BriefingStatus, { label: string; color: string }> = {
  active:   { label: "AI 브리핑 대상", color: "bg-emerald-100 text-emerald-800" },
  likely:   { label: "AI 브리핑 확대 예정", color: "bg-blue-100 text-blue-800" },
  inactive: { label: "AI 브리핑 대상 외", color: "bg-gray-100 text-gray-600" },
}
