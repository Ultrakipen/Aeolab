/**
 * 59개 업종별 AI 노출 채널 가이드 데이터
 * category_channel_matrix_v1.0.md 기준 — M2-4 SSG 페이지 단일 소스
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
  // ── Group A: 양면 ACTIVE (5개) ──────────────────────────────────────────
  {
    value: "restaurant", label: "음식점", group: "A",
    briefing: "active", naverRatio: 70, globalRatio: 30,
    keyActions: ["메뉴 사진 10장 이상 등록", "룸·좌석 정보 + 주차 정보 명시", "네이버 예약 연동", "운영시간·휴무일 최신 업데이트", "외부 블로그 후기 5건 이상 확보"],
    note: "예약 연동 시 AI탭에 예약 버튼 즉시 노출 → 전환 효과 최상",
  },
  {
    value: "cafe", label: "카페", group: "A",
    briefing: "active", naverRatio: 65, globalRatio: 35,
    keyActions: ["분위기·인테리어 사진 등록", "메뉴판 사진 (가격 포함)", "좌석/공간 유형 명시 (반려견·아이 동반 가능 여부)", "운영시간·정기휴무 업데이트", "소개글 D.I.A. 70점 이상 작성"],
  },
  {
    value: "bakery", label: "베이커리", group: "A",
    briefing: "active", naverRatio: 65, globalRatio: 35,
    keyActions: ["빵 종류 사진 다양하게 등록", "일일 입고 시간 명시", "포장/매장 구분 안내", "운영시간·조기 품절 안내", "인기 메뉴 소개글 강조"],
  },
  {
    value: "bar", label: "술집", group: "A",
    briefing: "active", naverRatio: 70, globalRatio: 30,
    keyActions: ["메뉴·주류 사진 등록", "분위기·룸 사진 등록", "운영시간 (심야 여부) 명시", "예약 연동 설정", "외부 블로그 후기 확보"],
  },
  {
    value: "accommodation", label: "숙박", group: "A",
    briefing: "active", naverRatio: 60, globalRatio: 40,
    keyActions: ["객실 사진 (내부·뷰) 충실히 등록", "시설·편의사항 상세 기재", "다이닝·조식 정보 명시", "액티비티·체험 프로그램 안내", "예약 연동 (네이버 예약·야놀자 등) 설정"],
  },

  // ── Group B: AI탭 우선, AI 브리핑 확대 대기 (12개) ────────────────────
  {
    value: "beauty", label: "미용실", group: "B",
    briefing: "likely", naverRatio: 65, globalRatio: 35,
    keyActions: ["시술 Before/After 사진 등록", "자격증·수상 이력 명시", "가격대 공개", "네이버 예약 연동", "외부 블로그 후기 5건 이상 확보"],
  },
  {
    value: "nail", label: "네일샵", group: "B",
    briefing: "likely", naverRatio: 60, globalRatio: 40,
    keyActions: ["네일 디자인 포트폴리오 사진 등록", "가격대 명시 (젤·아트 등 유형별)", "예약 시스템 연동", "운영시간 업데이트", "후기 답변 성실히 작성"],
  },
  {
    value: "skincare", label: "피부관리실", group: "B",
    briefing: "likely", naverRatio: 60, globalRatio: 40,
    keyActions: ["시술 종류별 효과 사진 등록", "관리사 자격 명시", "가격·패키지 공개", "예약 연동 설정", "후기 및 재방문율 강조"],
  },
  {
    value: "massage", label: "마사지", group: "B",
    briefing: "likely", naverRatio: 60, globalRatio: 40,
    keyActions: ["마사지 종류별 사진 및 설명 등록", "가격표 공개", "예약 가능 방법 안내", "운영시간·야간 영업 여부 명시", "인테리어·분위기 사진 추가"],
  },
  {
    value: "spa", label: "스파", group: "B",
    briefing: "likely", naverRatio: 60, globalRatio: 40,
    keyActions: ["시설·공간 사진 충실히 등록", "프로그램·코스 메뉴 상세 기재", "가격 공개", "예약 연동 설정", "부대시설 (사우나·풀 등) 안내"],
  },
  {
    value: "pet", label: "반려동물", group: "B",
    briefing: "likely", naverRatio: 65, globalRatio: 35,
    keyActions: ["시설·케어 공간 사진 등록", "서비스 종류별 가격 공개", "예약 시스템 연동", "수의사·훈련사 자격 명시", "반려동물 전용 환경 강조"],
  },
  {
    value: "fitness", label: "헬스장", group: "B",
    briefing: "likely", naverRatio: 60, globalRatio: 40,
    keyActions: ["시설·기구 사진 등록", "프로그램·GX 수업 안내", "가격·월정액 공개", "예약 연동 (PT·수업)", "트레이너 자격·경력 명시"],
  },
  {
    value: "yoga", label: "요가·필라테스", group: "B",
    briefing: "likely", naverRatio: 55, globalRatio: 45,
    keyActions: ["수업 종류 및 강의 사진 등록", "강사 경력·자격 명시", "가격·패키지 공개", "예약 시스템 연동", "후기 및 체험 수업 안내"],
  },
  {
    value: "pharmacy", label: "약국", group: "B",
    briefing: "likely", naverRatio: 70, globalRatio: 30,
    keyActions: ["운영시간·야간 영업 여부 명시", "야간·공휴일 운영 정보 강조", "위치 및 접근성 상세 기재", "상담 가능 분야 안내", "처방전 조제 가능 여부 명시"],
  },
  {
    value: "dance", label: "댄스", group: "B",
    briefing: "likely", naverRatio: 55, globalRatio: 45,
    keyActions: ["수업 종류 (방송댄스·힙합 등) 사진 등록", "강사 경력 명시", "가격·수강권 종류 공개", "예약·체험 수업 안내", "발표회·공연 정보 업로드"],
  },
  {
    value: "ballet", label: "발레", group: "B",
    briefing: "likely", naverRatio: 55, globalRatio: 45,
    keyActions: ["수업 사진·발표회 영상 등록", "강사 경력·전공 명시", "가격·클래스 종류 공개", "예약 연동", "연령대별 커리큘럼 안내"],
  },
  {
    value: "semi_permanent", label: "반영구화장", group: "B",
    briefing: "likely", naverRatio: 60, globalRatio: 40,
    keyActions: ["시술 Before/After 포트폴리오 등록", "시술사 자격·경력 명시", "가격 공개 (시술별)", "예약 시스템 연동", "후기·재방문 고객 사례 강조"],
  },

  // ── Group C: AI탭 중심, 콘텐츠 매핑 완료 (10개) ───────────────────────
  {
    value: "medical", label: "병원·의원", group: "C",
    briefing: "inactive", naverRatio: 55, globalRatio: 45,
    keyActions: ["진료시간·진료 분야 상세 기재", "전문 분야 자세히 명시", "예약 방법 안내", "후기 답변 성실히 작성", "의사 경력·학력 공개"],
    note: "금융·헬스케어 특화 AI 브리핑 도입 시 LIKELY 즉시 승급 후보",
  },
  {
    value: "dental", label: "치과", group: "C",
    briefing: "inactive", naverRatio: 55, globalRatio: 45,
    keyActions: ["진료시간 명시", "시술 분야 (임플란트·교정 등) 상세 기재", "예약 연동", "후기·치료 사례 사진 등록", "가격대 공개"],
    note: "금융·헬스케어 특화 AI 브리핑 도입 시 LIKELY 즉시 승급 후보",
  },
  {
    value: "oriental_medicine", label: "한의원", group: "C",
    briefing: "inactive", naverRatio: 55, globalRatio: 45,
    keyActions: ["진료시간 명시", "한방 진료 분야 상세 기재", "예약 연동", "후기 답변 작성", "한약 가격·효능 안내"],
  },
  {
    value: "legal", label: "법률", group: "C",
    briefing: "inactive", naverRatio: 20, globalRatio: 80,
    keyActions: ["전문 분야 (이혼·형사·부동산 등) 명시", "경력·수상 이력 공개", "상담 방식 (유선·방문·온라인) 안내", "후기 및 성공 사례 (익명) 등록", "초기 무료 상담 여부 명시"],
    note: "글로벌 AI(ChatGPT·Gemini) 비중이 더 높음. ChatGPT 최적화 병행 권장",
  },
  {
    value: "accounting", label: "세무·회계", group: "C",
    briefing: "inactive", naverRatio: 25, globalRatio: 75,
    keyActions: ["전문 분야 (법인세·부가세·절세 등) 명시", "경력·자격 공개", "상담 방식 안내", "후기 등록", "초기 무료 상담·온라인 상담 여부 명시"],
  },
  {
    value: "education", label: "학원", group: "C",
    briefing: "inactive", naverRatio: 40, globalRatio: 60,
    keyActions: ["커리큘럼·강의 계획 상세 기재", "강사 경력·자격 명시", "가격·수강권 공개", "시간표 안내", "합격률·성과 데이터 공개"],
  },
  {
    value: "tutoring", label: "과외", group: "C",
    briefing: "inactive", naverRatio: 40, globalRatio: 60,
    keyActions: ["과목별 전문성 명시", "강사 경력·학력 공개", "가격·시간 조정 가능 여부 안내", "수업 방식 (온라인·방문) 안내", "후기 등록"],
  },
  {
    value: "realestate", label: "부동산", group: "C",
    briefing: "inactive", naverRatio: 65, globalRatio: 35,
    keyActions: ["취급 매물 종류 명시 (매매·전세·월세)", "지역 전문 공인중개사 경력 강조", "경력·실적 공개", "후기 등록", "운영시간·연락처 최신화"],
  },
  {
    value: "interior", label: "인테리어", group: "C",
    briefing: "inactive", naverRatio: 55, globalRatio: 45,
    keyActions: ["시공 분야 (주거·상업·오피스) 명시", "공간 유형별 포트폴리오 사진 등록", "견적 방식 안내", "A/S 정책 명시", "완공 전후 사진 등록"],
  },
  {
    value: "fashion", label: "패션", group: "C",
    briefing: "inactive", naverRatio: 30, globalRatio: 70,
    keyActions: ["브랜드·스타일 컨셉 명확히 표현", "상품 구색 사진 다양하게 등록", "온라인 쇼핑 경험 (배송·반품 정책) 안내", "운영 정보 (영업시간·재고) 최신화", "가격 혜택·정기 세일 안내"],
  },

  // ── Group D: AI탭 가능, 콘텐츠 매핑 추가 중 ────────────────────────────
  {
    value: "photo", label: "사진스튜디오", group: "D",
    briefing: "inactive", naverRatio: 65, globalRatio: 35,
    keyActions: ["촬영 분야별 포트폴리오 사진 등록", "가격·패키지 공개", "예약 시스템 연동", "운영시간 명시", "후기 및 납품 사례 등록"],
  },
  {
    value: "video", label: "영상제작", group: "D",
    briefing: "inactive", naverRatio: 55, globalRatio: 45,
    keyActions: ["영상 유형별 포트폴리오 공개", "가격 및 제작 기간 안내", "예약·문의 방법 명시", "촬영 일정 안내", "후기 및 납품 영상 샘플 등록"],
  },
  {
    value: "design", label: "디자인", group: "D",
    briefing: "inactive", naverRatio: 35, globalRatio: 65,
    keyActions: ["디자인 분야별 포트폴리오 사진 등록", "가격·수정 횟수 안내", "작업 일정·납기 안내", "고객 후기 등록", "작업 프로세스 공개"],
  },
  {
    value: "auto", label: "카센터·정비", group: "D",
    briefing: "inactive", naverRatio: 50, globalRatio: 50,
    keyActions: ["주요 서비스 (엔진오일·타이어 등) 및 가격 공개", "운영시간 명시", "예약 방법 안내", "후기 답변 성실히 작성", "자격·경력 명시"],
  },
  {
    value: "cleaning", label: "청소", group: "D",
    briefing: "inactive", naverRatio: 45, globalRatio: 55,
    keyActions: ["청소 종류 (입주·정기·특수) 및 가격 공개", "출장 서비스 안내", "예약 방법 명시", "후기 등록", "무료 견적 제공 여부 안내"],
  },
  {
    value: "shopping", label: "쇼핑몰", group: "D",
    briefing: "inactive", naverRatio: 10, globalRatio: 90,
    keyActions: ["상품 구색 다양하게 등록", "가격 경쟁력 및 적립 혜택 안내", "배송 정책 명시", "후기·평점 관리", "AI 쇼핑 Schema.org 구조화 적용"],
    note: "글로벌 AI 비중이 압도적으로 높음. AI 쇼핑 구조화 데이터 작성 우선",
  },
  {
    value: "optics", label: "안경원", group: "D",
    briefing: "inactive", naverRatio: 50, globalRatio: 50,
    keyActions: ["안경·렌즈 종류 및 가격 공개", "시력 검사 서비스 안내", "운영시간·주차 명시", "후기 등록", "제작 소요 시간 안내"],
  },
  {
    value: "martial_arts", label: "태권도·무술", group: "D",
    briefing: "inactive", naverRatio: 45, globalRatio: 55,
    keyActions: ["종목별 수업 사진·영상 등록", "관장·사범 자격 명시", "가격·수강권 공개", "시간표 안내", "연령대·레벨별 반 구성 안내"],
  },
  {
    value: "climbing", label: "클라이밍·볼더링", group: "D",
    briefing: "inactive", naverRatio: 40, globalRatio: 60,
    keyActions: ["시설·벽면 난이도 사진 등록", "가격·이용권 공개", "운영시간 명시", "강습 프로그램 안내", "초보자 안전 강습 강조"],
  },
  {
    value: "art_class", label: "미술학원", group: "D",
    briefing: "inactive", naverRatio: 35, globalRatio: 65,
    keyActions: ["수업 종류·학생 작품 사진 등록", "강사 경력 명시", "가격·반 구성 공개", "수업 시간 안내", "전시·발표회 등 결과물 공개"],
  },
  {
    value: "childcare", label: "어린이집·유치원", group: "D",
    briefing: "inactive", naverRatio: 55, globalRatio: 45,
    keyActions: ["시설·놀이공간 사진 등록", "보육 시간·프로그램 안내", "비용·보조금 정보 공개", "식단·안전 관리 안내", "부모 참관 가능 여부 명시"],
  },
  {
    value: "car_wash", label: "세차장", group: "D",
    briefing: "inactive", naverRatio: 50, globalRatio: 50,
    keyActions: ["세차 종류·코스 및 가격 공개", "예약 방법 안내", "운영시간 명시", "시설 사진 등록", "추가 옵션 (광택·코팅 등) 안내"],
  },
  {
    value: "electronics_repair", label: "핸드폰·가전수리", group: "D",
    briefing: "inactive", naverRatio: 50, globalRatio: 50,
    keyActions: ["수리 가능 기종·부품 종류 공개", "가격표 명시 (액정·배터리 등)", "운영시간 명시", "출장 수리 가능 여부 안내", "후기 등록"],
  },
  {
    value: "footwear", label: "신발", group: "D",
    briefing: "inactive", naverRatio: 35, globalRatio: 65,
    keyActions: ["브랜드·신발 종류 다양하게 등록", "가격 및 할인 정보 공개", "사이즈 안내", "매장 위치·운영시간 명시", "무료 배송·반품 정책 안내"],
  },
  {
    value: "stationery", label: "문구·사무용품", group: "D",
    briefing: "inactive", naverRatio: 40, globalRatio: 60,
    keyActions: ["상품 종류 다양하게 등록", "가격·할인 안내", "운영시간 명시", "결제 방법 안내", "위치 접근성 강조"],
  },
  {
    value: "norebang", label: "노래방", group: "D",
    briefing: "inactive", naverRatio: 60, globalRatio: 40,
    keyActions: ["룸 종류·시설 사진 등록", "시간당 가격 공개", "음식·주류 판매 여부 안내", "운영시간 (24시간 여부) 명시", "예약 방법 안내"],
  },
  {
    value: "billiards", label: "당구장", group: "D",
    briefing: "inactive", naverRatio: 55, globalRatio: 45,
    keyActions: ["테이블 수·종류 사진 등록", "시간당 가격·월정액 공개", "운영시간 (24시간 여부) 명시", "음식·음료 제공 여부 안내", "분위기 사진 등록"],
  },
  {
    value: "flower", label: "꽃집·화원", group: "D",
    briefing: "inactive", naverRatio: 50, globalRatio: 50,
    keyActions: ["꽃 종류·부케 사진 등록", "가격 및 맞춤 제작 안내", "당일 배달 가능 여부 명시", "예약·주문 방법 안내", "운영시간 명시"],
  },
  {
    value: "laundry", label: "세탁소", group: "D",
    briefing: "inactive", naverRatio: 50, globalRatio: 50,
    keyActions: ["세탁 종류 및 가격 공개", "운영시간 명시", "수거·배달 서비스 안내", "특수 세탁 가능 품목 안내", "소요 기간 명시"],
  },
  {
    value: "clothing", label: "의류", group: "D",
    briefing: "inactive", naverRatio: 30, globalRatio: 70,
    keyActions: ["의류 종류·스타일 사진 등록", "가격 및 사이즈 안내", "온라인 주문·배송 정책 공개", "매장 위치·운영시간 명시", "정기 세일·이벤트 안내"],
  },
  {
    value: "kids", label: "키즈카페", group: "D",
    briefing: "inactive", naverRatio: 50, globalRatio: 50,
    keyActions: ["놀이시설 사진 등록", "이용 가능 연령·가격 공개", "예약 방법 안내", "안전 관리·위생 정책 명시", "생일파티 패키지 안내"],
  },
  {
    value: "study", label: "스터디카페", group: "D",
    briefing: "inactive", naverRatio: 40, globalRatio: 60,
    keyActions: ["좌석 종류·시설 사진 등록", "가격·이용권 종류 공개", "운영시간 (24시간 여부) 명시", "부대시설 (프린터·커피 등) 안내", "위치·접근성 강조"],
  },
  {
    value: "workshop", label: "공방·공예", group: "D",
    briefing: "inactive", naverRatio: 35, globalRatio: 65,
    keyActions: ["체험 분야별 사진·결과물 등록", "강사 경력 명시", "가격·인원 안내", "예약·일정 안내", "원데이·정기 클래스 구분 안내"],
  },
  {
    value: "music_class", label: "음악교실", group: "D",
    briefing: "inactive", naverRatio: 45, globalRatio: 55,
    keyActions: ["악기 종류·수업 사진 등록", "강사 경력·자격 명시", "가격·레슨 종류 공개", "수업 시간 안내", "발표회·연주회 사례 공개"],
  },
  {
    value: "music_lesson", label: "악기레슨", group: "D",
    briefing: "inactive", naverRatio: 45, globalRatio: 55,
    keyActions: ["레슨 가능 악기 종류 명시", "강사 경력 공개", "1:1/그룹 레슨 가격 안내", "수업 시간 및 방문 레슨 가능 여부 명시", "초보자·입시반 구분 안내"],
  },
  {
    value: "cooking", label: "요리교실·쿠킹", group: "D",
    briefing: "inactive", naverRatio: 45, globalRatio: 55,
    keyActions: ["요리 종류·수업 사진 등록", "강사 경력 명시", "가격·재료비 포함 여부 공개", "수업 일정·예약 안내", "초보자 환영 여부 명시"],
  },
  {
    value: "experience", label: "체험공간", group: "D",
    briefing: "inactive", naverRatio: 40, globalRatio: 60,
    keyActions: ["체험 종류별 사진·영상 등록", "가격·인원 안내", "예약 방법 명시", "최소 인원·소요 시간 안내", "후기 및 결과물 사진 등록"],
  },
  {
    value: "golf", label: "골프연습장", group: "D",
    briefing: "inactive", naverRatio: 45, globalRatio: 55,
    keyActions: ["시설·부스 사진 등록", "이용 가격·요금제 공개", "운영시간 명시", "레슨 프로그램 안내", "스크린·탄도 분석 장비 안내"],
  },
  {
    value: "swim", label: "수영·아쿠아", group: "D",
    briefing: "inactive", naverRatio: 40, globalRatio: 60,
    keyActions: ["수영장 시설 사진 등록", "강습 종류·가격 공개", "운영시간·자유수영 시간 명시", "레벨별 강습반 안내", "초보자 프로그램 강조"],
  },
  {
    value: "jjimjil", label: "찜질방·사우나", group: "D",
    briefing: "inactive", naverRatio: 55, globalRatio: 45,
    keyActions: ["시설·공간 사진 등록", "이용 가격·코스 공개", "운영시간 명시", "가족실·커플실 유무 안내", "한증막·황토방 등 특화 시설 강조"],
  },
  {
    value: "escape", label: "방탈출", group: "D",
    briefing: "inactive", naverRatio: 40, globalRatio: 60,
    keyActions: ["테마·공간 사진 등록", "이용 가격·인원 안내", "예약 방법 명시", "난이도·테마 종류 안내", "생일파티·단체 예약 패키지 안내"],
  },

  // ── Group E: 글로벌 AI 중심 (1개) ───────────────────────────────────────
  {
    value: "other", label: "기타", group: "E",
    briefing: "inactive", naverRatio: 0, globalRatio: 100,
    keyActions: ["사업장 정보 정확히 입력 (이름·주소·전화)", "구글 비즈니스 프로필 등록·최적화", "ChatGPT·Gemini가 인용할 소개글 작성", "Schema.org 구조화 데이터 적용", "외부 블로그·SNS 언급 확대"],
    note: "'플레이스형' 네이버 AI 브리핑 대상 외 업종. 블로그·콘텐츠로 '정보형 AI 브리핑' 노출 가능하며, ChatGPT·Gemini·Google AI 최적화에도 집중",
  },
]

/** value → ChannelGuideEntry */
export const CHANNEL_GUIDE_MAP: Record<string, ChannelGuideEntry> = Object.fromEntries(
  CHANNEL_GUIDE.map((e) => [e.value, e])
)

export const GROUP_LABELS: Record<ChannelGroup, string> = {
  A: "양면 ACTIVE",
  B: "AI탭 우선",
  C: "AI탭 중심",
  D: "AI탭 가능",
  E: "글로벌 AI 중심",
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
