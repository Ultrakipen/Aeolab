export interface CategoryGroup {
  value: string;
  label: string;
  emoji: string;
  tags: string[];
}

/**
 * 13개 그룹 카테고리 — 백엔드 벤치마크 / 키워드 분류 / tags 정의용
 * (그룹 value: food, health, education, professional, beauty, shopping,
 *  living, culture, photo, video, design, it, accommodation)
 */
// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY_GROUPS — backend/services/keyword_taxonomy.py KEYWORD_TAXONOMY와 동기화 (v3.5)
// 각 group의 tags 배열은 backend taxonomy의 sub-category 키워드 중 핵심 6~10개를 추림.
// trial STEP 2 화면이 자동으로 keyword_taxonomy와 일치하게 됨 (tagsForFlat 함수 통해).
// ─────────────────────────────────────────────────────────────────────────────
export const CATEGORY_GROUPS: CategoryGroup[] = [
  {
    // backend taxonomy: restaurant
    value: "food",
    label: "음식·식음료",
    emoji: "🍽️",
    tags: [
      "주차 가능", "단체 예약 가능", "회식 장소", "프라이빗룸",
      "데이트 분위기", "반려견 동반 가능", "혼밥 가능",
      "가성비 좋음", "포장 가능", "심야 영업",
    ],
  },
  {
    // backend taxonomy: clinic
    value: "health",
    label: "의료·건강",
    emoji: "🏥",
    tags: [
      "주차 가능", "전문의 직접 진료", "장비 최신화",
      "친절한 설명", "대기 없음", "야간 진료",
      "주말 진료", "당일 예약 가능", "건강보험 적용",
    ],
  },
  {
    // backend taxonomy: academy
    value: "education",
    label: "교육·보육",
    emoji: "📚",
    tags: [
      "주차 가능", "셔틀버스 운행",
      "1:1 맞춤", "소수정예", "입시 전문", "전문 강사",
      "성인 가능", "주말 수업", "체험 수업 가능",
      "합격률 높음",
    ],
  },
  {
    // backend taxonomy: legal
    value: "professional",
    label: "전문직",
    emoji: "💼",
    tags: [
      "이혼 전문", "부동산 전문", "형사 전문", "노동법 전문",
      "경력 20년+", "전관 출신", "승소율 높음",
      "초기 무료 상담", "성공보수제", "온라인 상담 가능",
    ],
  },
  {
    // backend taxonomy: beauty
    value: "beauty",
    label: "뷰티·패션",
    emoji: "💅",
    tags: [
      "주차 가능", "당일 예약 가능", "365일 영업",
      "염색 전문", "탈모 케어", "두피 관리", "웨딩 전문", "남성 전문",
      "프라이빗 공간", "1:1 전담 관리",
    ],
  },
  {
    // backend taxonomy: shopping
    value: "shopping",
    label: "쇼핑·유통",
    emoji: "🛒",
    tags: [
      "당일 배송", "무료 배송", "새벽 배송", "해외 직구",
      "국내 제조", "친환경 인증", "수제 제작", "한정판",
      "최저가 보장", "ChatGPT 추천",
    ],
  },
  {
    // backend taxonomy: living
    value: "living",
    label: "생활서비스",
    emoji: "🔧",
    tags: [
      "이사 후", "봄맞이 청소", "특수 청소", "급하게",
      "당일 방문", "정기 서비스", "방역 포함", "무료 견적",
      "꼼꼼한", "전문가",
    ],
  },
  {
    // NOTE: culture, it 그룹은 현재 어떤 flat category도 참조하지 않음 (레거시 유지)
    // backend taxonomy: cafe (문화·여가는 cafe로 매핑)
    value: "culture",
    label: "문화·여가",
    emoji: "🎭",
    tags: [
      "감성 인테리어", "뷰 좋음", "루프탑 있음", "포토존",
      "노트북 가능", "콘센트 있음", "조용한 카페",
      "반려견 동반 가능", "데이트 장소", "단체 모임 가능",
    ],
  },
  {
    // backend taxonomy: photo
    value: "photo",
    label: "사진·영상",
    emoji: "📷",
    tags: [
      "웨딩스냅", "돌스냅", "행사촬영", "웨딩본식",
      "스냅촬영", "야외스냅", "프로필 사진", "본식 스냅",
      "보정 포함", "출장 촬영 가능",
    ],
  },
  {
    // backend taxonomy: video
    value: "video",
    label: "영상·드론",
    emoji: "🎬",
    tags: [
      "유튜브 영상", "광고 영상", "웨딩 영상", "기업 홍보 영상",
      "드론 촬영", "항공 촬영",
      "4K 촬영", "편집 포함", "당일 납품", "포트폴리오 공개",
    ],
  },
  {
    // backend taxonomy: design
    value: "design",
    label: "디자인·인쇄",
    emoji: "🎨",
    tags: [
      "로고 디자인", "브랜딩", "명함 디자인", "현수막", "포스터", "SNS 콘텐츠",
      "당일 제작", "무제한 수정", "견적 무료",
    ],
  },
  {
    // NOTE: culture, it 그룹은 현재 어떤 flat category도 참조하지 않음 (레거시 유지)
    // backend taxonomy: shopping (IT·웹은 shopping/온라인 키워드로 매핑)
    value: "it",
    label: "IT·웹·마케팅",
    emoji: "💻",
    tags: [
      "당일 배송", "무료 반품",
      "ChatGPT 추천", "AI 쇼핑 연동", "Schema 적용",
      "정기 구독 할인", "포인트 적립",
      "교환 환불 쉬움", "CS 빠른 응대", "인증 획득",
    ],
  },
  {
    // backend taxonomy: accommodation
    value: "accommodation",
    label: "숙박·이벤트",
    emoji: "🏨",
    tags: [
      "혼자 여행", "커플 여행", "가족 여행", "출장", "허니문",
      "조식 제공", "무료 주차", "수영장", "바베큐",
      "바다 뷰",
    ],
  },
];

/** value → CategoryGroup */
export const CATEGORY_MAP: Record<string, CategoryGroup> = Object.fromEntries(
  CATEGORY_GROUPS.map((g) => [g.value, g])
);

/** 하위 호환: value → label */
export const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORY_GROUPS.map((g) => [g.value, g.label])
);

// 구버전 호환용 (select 드롭다운 등에서 사용 중인 경우 대비)
export interface CategoryOption {
  value: string;
  label: string;
}
export const CATEGORIES: CategoryOption[] = CATEGORY_GROUPS.map((g) => ({
  value: g.value,
  label: g.label,
}));

// ─────────────────────────────────────────────────────────────────────────────
// 59개 평면 업종 (RegisterBusinessForm과 동일 — 단일 진실 소스)
// trial 페이지·등록 폼 양쪽에서 동일 코드 사용
// 기존 25개 + 신규 34개 (accommodation은 기존 25개와 공유) = 59 unique value
// ─────────────────────────────────────────────────────────────────────────────

export interface FlatCategory {
  value: string;
  label: string;
  /** 그룹 매핑 — 벤치마크/tags 조회용 */
  group: string;
  /** UI 그룹 헤더 표시용 */
  groupLabel: string;
  /** 업종 특화 태그 — 있으면 group 태그보다 우선 사용 */
  tags?: string[];
  /** "무엇을 파나요/하나요?" 종류 키워드 — trial 입력 단계 필수 선택 대상 */
  typeTags?: string[];
}

export const FLAT_CATEGORY_GROUPS: { groupLabel: string; items: FlatCategory[] }[] = [
  {
    groupLabel: "음식·음료",
    items: [
      { value: "restaurant", label: "음식점",    group: "food",          groupLabel: "음식·음료",
        typeTags: ["삼겹살", "흑돼지", "한식", "중식", "일식", "초밥", "파스타", "피자", "곱창", "냉면", "국밥", "치킨"] },
      { value: "cafe",       label: "카페",       group: "food",          groupLabel: "음식·음료",
        typeTags: ["커피전문", "스페셜티", "브런치", "디저트카페", "베이커리카페", "버블티", "스무디"] },
      { value: "bakery",     label: "베이커리",   group: "food",          groupLabel: "음식·음료",
        typeTags: ["소금빵", "크루아상", "케이크", "마카롱", "타르트", "식빵", "베이글"] },
      { value: "bar",        label: "술집",        group: "food",          groupLabel: "음식·음료",
        typeTags: ["이자카야", "와인바", "맥주바", "막걸리", "소주", "칵테일바", "포차"] },
      { value: "kids",       label: "키즈카페",   group: "kids",          groupLabel: "음식·음료",
        tags: ["볼풀장", "미끄럼틀", "영아 가능", "생일파티 가능", "단체 예약", "주차 가능", "수유실", "위생 관리"] },
    ],
  },
  {
    groupLabel: "뷰티",
    items: [
      { value: "beauty",   label: "미용실",        group: "beauty",  groupLabel: "뷰티",
        typeTags: ["헤어커트", "파마", "탈색", "염색", "클리닉파마", "매직"] },
      { value: "nail",     label: "네일샵",         group: "beauty",  groupLabel: "뷰티",
        tags: ["젤네일", "네일아트", "손발 세트", "당일 예약 가능", "1:1 전담", "주차 가능", "365일 영업", "네일 제거"] },
      { value: "skincare", label: "피부관리실",    group: "beauty",  groupLabel: "뷰티",
        tags: ["모공케어", "여드름 관리", "미백 관리", "RF 리프팅", "1:1 전담", "프라이빗룸", "당일 예약", "정기 관리"] },
      { value: "semi_permanent", label: "반영구화장", group: "beauty", groupLabel: "뷰티",
        tags: ["눈썹 문신", "아이라인", "입술 반영구", "헤어라인", "수정 가능", "자연스러운 결", "마취 크림", "전문 아티스트", "위생 철저", "포트폴리오 공개"] },
    ],
  },
  {
    groupLabel: "마사지·스파",
    items: [
      { value: "massage",  label: "마사지",        group: "health",  groupLabel: "마사지·스파",
        tags: ["스웨디시", "타이마사지", "딥티슈", "커플룸", "프라이빗룸", "당일 예약", "야간 영업", "정기권", "전신 마사지", "발 마사지"] },
      { value: "spa",      label: "스파",           group: "health",  groupLabel: "마사지·스파",
        tags: ["아로마테라피", "스팀사우나", "스파풀", "바디랩", "스톤테라피", "커플스파", "프라이빗룸", "당일 예약", "고급 케어", "힐링 코스"] },
      { value: "jjimjil",  label: "찜질방·사우나", group: "health",  groupLabel: "마사지·스파",
        tags: ["찜질방", "사우나", "한증막", "황토방", "스파풀", "가족실", "커플실", "24시간 운영"] },
    ],
  },
  {
    groupLabel: "운동·피트니스",
    items: [
      { value: "fitness",  label: "헬스장",         group: "health",  groupLabel: "운동·피트니스",
        tags: ["24시간 운영", "GX 수업 다양", "개인 PT 상담", "샤워실 완비", "체성분 측정", "주차 가능", "1개월 체험", "최신 기구"] },
      { value: "yoga",     label: "요가·필라테스", group: "health",  groupLabel: "운동·피트니스",
        tags: ["초보 환영", "소수정예", "임산부 클래스", "다이어트 특화", "필라테스 병행", "온라인 병행", "주차 가능", "첫 수업 무료"] },
      { value: "dance",    label: "댄스",            group: "health",  groupLabel: "운동·피트니스",
        tags: ["방송댄스", "힙합댄스", "재즈댄스", "비보이", "걸스힙합", "K-pop댄스", "어른 취미반", "소수정예", "초보 환영", "체험 수업"] },
      { value: "ballet",   label: "발레",            group: "health",  groupLabel: "운동·피트니스",
        tags: ["클래식 발레", "성인 발레", "어린이 발레", "취미반", "입시 전문", "발레리나 전문", "소수정예", "초보 환영", "체험 수업", "콩쿠르 준비"] },
      { value: "golf",     label: "골프연습장",     group: "health",  groupLabel: "운동·피트니스",
        tags: ["스크린골프", "실내골프", "레슨 가능", "개인 부스", "시뮬레이터", "탄도 분석", "24시간 운영", "초보 환영", "주차 가능"] },
      { value: "swim",        label: "수영·아쿠아",    group: "health",  groupLabel: "운동·피트니스",
        tags: ["수영강습", "아쿠아로빅", "성인 수영", "어린이 수영", "초보반", "소수정예", "워터파크", "온수풀", "연간 등록", "자유수영"] },
      { value: "martial_arts", label: "태권도·무술", group: "health", groupLabel: "운동·피트니스",
        tags: ["태권도", "유도", "검도", "합기도", "무에타이", "주짓수", "유소년반", "성인반", "단증 취득", "체험 수업"] },
      { value: "climbing",     label: "클라이밍·볼더링", group: "health", groupLabel: "운동·피트니스",
        tags: ["볼더링", "리드 클라이밍", "암벽 등반", "초보 강습", "장비 대여", "월정액", "자유 이용", "난이도 다양", "안전 강습", "주차 가능"] },
    ],
  },
  {
    groupLabel: "의료·건강",
    items: [
      { value: "dental",            label: "치과",          group: "health",  groupLabel: "의료·건강",
        tags: ["임플란트", "치아교정", "스케일링", "충치 치료", "라미네이트", "어린이치과", "무통마취", "당일 치료", "야간 진료", "주차 가능"] },
      { value: "oriental_medicine", label: "한의원",         group: "health",  groupLabel: "의료·건강",
        tags: ["침", "추나요법", "한약 처방", "허리 디스크", "한방 다이어트", "성장 클리닉", "산후조리", "면역력 강화", "당일 예약", "주차 가능"] },
      { value: "optics",            label: "안경원",         group: "health",  groupLabel: "의료·건강",
        tags: ["안경 맞춤", "렌즈 처방", "라식 상담", "도수 안경", "선글라스", "초고층 렌즈", "1시간 제작", "당일 수령", "무료 시력검사", "주차 가능"] },
      { value: "medical",  label: "병원·의원",     group: "health",  groupLabel: "의료·건강",
        typeTags: ["내과", "정형외과", "피부과", "한의원", "산부인과", "소아과", "이비인후과", "신경과"] },
      { value: "pharmacy", label: "약국",           group: "health",  groupLabel: "의료·건강",
        tags: ["처방전 조제", "상비약 구비", "야간 영업", "약 배달 가능", "건강기능식품", "당일 조제", "친절한 약사", "주차 가능"] },
    ],
  },
  {
    groupLabel: "반려동물",
    items: [
      { value: "pet", label: "반려동물", group: "pet", groupLabel: "반려동물",
        tags: ["강아지 미용", "고양이 전문", "펫호텔·유치원", "24시간 케어", "훈련사 상주", "소동물 전문", "반려견 산책", "수의사 협력"] },
    ],
  },
  {
    groupLabel: "교육·레슨",
    items: [
      { value: "education",    label: "학원",            group: "education", groupLabel: "교육·레슨",
        typeTags: ["수학", "영어", "과학", "코딩", "국어", "논술", "미술", "음악", "한국사"] },
      { value: "tutoring",     label: "과외",             group: "education", groupLabel: "교육·레슨",
        tags: ["1:1 맞춤 지도", "온라인 수업 가능", "내신 전문", "수능 전문", "초등 전문", "중등 전문", "고등 전문", "성적 보장"],
        typeTags: ["수학과외", "영어과외", "과학과외", "국어과외", "논술과외", "코딩과외"] },
      { value: "study",        label: "스터디카페",      group: "education", groupLabel: "교육·레슨",
        tags: ["1인 독립석", "24시간 운영", "월정액", "무제한 커피", "프린터 무료", "스터디룸", "빠른 와이파이", "주차 가능"] },
      { value: "music_class",   label: "음악교실",        group: "education", groupLabel: "교육·레슨",
        tags: ["피아노 교실", "바이올린 교실", "첼로 교실", "플루트 교실", "드럼 교실", "입시반", "취미반", "어린이 전용", "성인 가능", "그룹 레슨"] },
      { value: "music_lesson",  label: "악기레슨",        group: "education", groupLabel: "교육·레슨",
        tags: ["1:1 개인 레슨", "방문 레슨", "기타 레슨", "드럼 레슨", "보컬 레슨", "악기 구매 상담", "초보 환영", "성인 가능", "자격증 과정", "입시 준비"] },
      { value: "cooking",   label: "요리교실·쿠킹",  group: "education", groupLabel: "교육·레슨",
        tags: ["원데이 쿡킹", "베이킹 클래스", "한식 요리", "이탈리안 쿠킹", "소수정예", "재료비 포함", "초보 환영", "어린이 요리", "커플 클래스", "자격증 과정"] },
      { value: "art_class",  label: "미술학원",      group: "education", groupLabel: "교육·레슨",
        tags: ["어린이 미술", "입시 미술", "취미 미술", "수채화", "유화", "드로잉", "소묘·크로키", "1:1 지도", "소수정예", "전시 참가"] },
      { value: "childcare",  label: "어린이집·유치원", group: "education", groupLabel: "교육·레슨",
        tags: ["영유아 보육", "영어유치원", "친환경 급식", "방과후 교실", "CCTV 설치", "안전 놀이터", "보육료 지원", "소규모 반", "부모 참관 가능", "셔틀버스"] },
    ],
  },
  {
    groupLabel: "전문직·서비스",
    items: [
      { value: "legal",      label: "법률",          group: "professional", groupLabel: "전문직·서비스",
        typeTags: ["이혼", "형사", "부동산", "노동법", "상속", "교통사고"] },
      { value: "accounting", label: "세무·회계",    group: "professional", groupLabel: "전문직·서비스",
        tags: ["기장대행", "법인세 신고", "부가세 신고", "절세 컨설팅", "법인설립", "세무조사 대리", "초기 무료 상담", "온라인 상담"] },
      { value: "realestate", label: "부동산",        group: "professional", groupLabel: "전문직·서비스" },
      { value: "interior",   label: "인테리어",      group: "living",       groupLabel: "전문직·서비스" },
      { value: "auto",       label: "카센터·정비",  group: "living",       groupLabel: "전문직·서비스" },
      { value: "cleaning",          label: "청소",           group: "living",       groupLabel: "전문직·서비스" },
      { value: "car_wash",          label: "세차장",           group: "living", groupLabel: "전문직·서비스",
        tags: ["손 세차", "광택", "유리막 코팅", "내부 청소", "왁스 코팅", "정기권", "당일 가능", "기업 차량 가능", "도장 보호", "주차 여유"] },
      { value: "electronics_repair",label: "핸드폰·가전수리",  group: "living", groupLabel: "전문직·서비스",
        tags: ["아이폰 수리", "갤럭시 수리", "액정 교체", "배터리 교체", "충전 포트 수리", "당일 수리", "데이터 복구", "공식 부품", "가격 투명", "무상 AS"] },
    ],
  },
  {
    groupLabel: "쇼핑·생활",
    items: [
      { value: "shopping", label: "쇼핑몰",      group: "shopping", groupLabel: "쇼핑·생활" },
      { value: "fashion",  label: "패션",        group: "shopping", groupLabel: "쇼핑·생활",
        tags: ["편집샵", "트렌디 스타일", "인스타 인기", "시즌 신상", "온라인몰 연동", "한정판", "브랜드 공식", "스타일링 상담", "무료 반품", "당일 배송"] },
      { value: "clothing",  label: "의류",        group: "shopping", groupLabel: "쇼핑·생활",
        tags: ["남성 의류", "여성 의류", "아동 의류", "맞춤 제작", "수선 가능", "교복·단체복", "원단 직판", "친환경 소재", "당일 배송", "정기 세일"] },
      { value: "footwear",  label: "신발",          group: "shopping", groupLabel: "쇼핑·생활",
        tags: ["운동화", "구두", "부츠", "샌들", "브랜드 스니커즈", "사이즈 다양", "수제 구두", "신발 수선", "무료 배송", "반품 쉬움"] },
      { value: "stationery", label: "문구·사무용품", group: "shopping", groupLabel: "쇼핑·생활",
        tags: ["학용품", "필기구", "색연필·사인펜", "미술 재료", "복사 용지", "프린터 토너", "파일·바인더", "사무 소모품", "단체 주문", "학교 납품"] },
      { value: "flower",   label: "꽃집·화원",   group: "shopping", groupLabel: "쇼핑·생활",
        tags: ["꽃다발", "드라이플라워", "당일 배달", "맞춤 제작", "정기 구독", "프러포즈", "생일 선물", "개업 화환"] },
      { value: "laundry",  label: "세탁소",       group: "living",   groupLabel: "쇼핑·생활",
        tags: ["드라이클리닝", "이불 세탁", "수거 배달", "당일 완성", "명품 케어", "얼룩 제거", "가죽 세탁", "스팀 다림질"] },
    ],
  },
  {
    groupLabel: "사진·영상·디자인",
    items: [
      { value: "photo",  label: "사진스튜디오", group: "photo",  groupLabel: "사진·영상·디자인" },
      { value: "video",  label: "영상제작",      group: "video",  groupLabel: "사진·영상·디자인" },
      { value: "design", label: "디자인",         group: "design", groupLabel: "사진·영상·디자인" },
    ],
  },
  {
    groupLabel: "여가·오락",
    items: [
      { value: "norebang",  label: "노래방",  group: "culture", groupLabel: "여가·오락",
        tags: ["코인노래방", "개인 룸", "최신곡 업데이트", "24시간 운영", "대형 스크린", "방음 완비", "생일파티 가능", "음식 반입 가능", "탬버린 구비", "주차 가능"] },
      { value: "billiards", label: "당구장", group: "culture", groupLabel: "여가·오락",
        tags: ["3쿠션", "포켓볼", "볼 당구", "당구 레슨", "개인 큐 보관", "24시간 운영", "월정액", "초보 환영", "다인 테이블 완비", "주차 가능"] },
    ],
  },
  {
    groupLabel: "공방·공예",
    items: [
      { value: "workshop", label: "공방·공예", group: "culture", groupLabel: "공방·공예",
        tags: ["도자기 공방", "가죽공예", "캔들 만들기", "목공방", "비즈공예", "그림 클래스", "미술 원데이", "재료비 포함", "초보 환영", "커플 체험"] },
      { value: "escape",     label: "방탈출",     group: "culture", groupLabel: "공방·공예",
        tags: ["방탈출", "공포 테마", "미스터리 테마", "힐링 테마", "단체 예약", "커플 코스", "생일파티", "2인 이상", "예약 필수", "힌트 제공"] },
      { value: "experience", label: "체험공간",   group: "culture", groupLabel: "공방·공예",
        tags: ["원데이 체험", "가족 체험", "도예 체험", "향수 만들기", "초콜릿 공방", "천연 비누", "소규모", "재료비 포함", "예약 필수", "생일파티"] },
    ],
  },
  {
    groupLabel: "숙박",
    items: [
      { value: "accommodation", label: "숙박", group: "accommodation", groupLabel: "숙박" },
    ],
  },
  {
    groupLabel: "기타",
    items: [
      { value: "other", label: "기타", group: "professional", groupLabel: "기타" },
    ],
  },
];

/** 평면 59개 — 펼친 배열 */
export const FLAT_CATEGORIES: FlatCategory[] = FLAT_CATEGORY_GROUPS.flatMap((g) => g.items);

/** value → FlatCategory */
export const FLAT_CATEGORY_MAP: Record<string, FlatCategory> = Object.fromEntries(
  FLAT_CATEGORIES.map((c) => [c.value, c])
);

/** 평면 value → 그룹 value (벤치마크/tags 조회용) */
export function flatToGroup(value: string): string {
  return FLAT_CATEGORY_MAP[value]?.group ?? value;
}

/** 평면 value → 업종 특화 tags (있으면 우선) 또는 해당 그룹의 tags */
export function tagsForFlat(value: string): string[] {
  const flatCat = FLAT_CATEGORY_MAP[value];
  if (flatCat?.tags && flatCat.tags.length > 0) return flatCat.tags;
  const groupKey = flatToGroup(value);
  return CATEGORY_MAP[groupKey]?.tags ?? [];
}

/** 종류 키워드(typeTags)가 있는 업종 집합 — TrialInputStep에서 UI 분기용 */
export const CATEGORIES_WITH_TYPE_KEYWORDS = new Set([
  "restaurant", "cafe", "bakery", "bar",
  "education", "tutoring", "medical", "beauty", "legal",
]);

/**
 * 네이버/카카오 로컬 API의 raw category 문자열 → AEOlab 내부 카테고리 변환.
 * 전 진입 경로(홈, 대시보드, 체험)에서 공통 사용.
 */
export function mapNaverCategory(naverCat?: string): string {
  if (!naverCat) return "other";
  const c = naverCat.toLowerCase();

  // 음식·음료
  if (/한식|중식|일식|양식|분식|음식점|식당|국밥|돈까스|초밥|냉면|피자|버거|패스트푸드|맛집/.test(c)) return "restaurant";
  if (/치킨|닭갈비|닭/.test(c)) return "restaurant";
  if (/고기|갈비|삼겹살|육류/.test(c)) return "restaurant";
  if (/카페|커피|디저트카페/.test(c)) return "cafe";
  if (/베이커리|빵집|제과점|제빵/.test(c)) return "bakery";
  if (/주점|술집|호프|포차|이자카야/.test(c)) return "bar";
  if (/키즈카페|어린이카페/.test(c)) return "kids";

  // 뷰티·건강 (skincare/massage/spa를 beauty보다 먼저 체크)
  if (/피부관리|에스테틱|스킨케어|피부샵/.test(c)) return "skincare";
  if (/스파센터|테르메|워터스파|바데스파|온천스파/.test(c)) return "spa";
  if (/마사지|체형관리|안마/.test(c)) return "massage";
  if (/아로마|스파/.test(c)) return "spa";
  if (/반영구|눈썹문신|아이라인문신|입술문신/.test(c)) return "semi_permanent";
  if (/미용실|헤어|뷰티|미장원/.test(c)) return "beauty";
  if (/피부/.test(c)) return "skincare";
  if (/네일/.test(c)) return "nail";
  // 의료 세분화 — medical보다 먼저 체크
  if (/치과|치아교정|임플란트|스케일링/.test(c)) return "dental";
  if (/한의원|한방|침|추나/.test(c)) return "oriental_medicine";
  if (/안경원|안경점|렌즈|라식/.test(c)) return "optics";
  if (/병원|의원|클리닉|정형외과|내과|소아과/.test(c)) return "medical";
  if (/약국/.test(c)) return "pharmacy";
  // 운동 세분화 — fitness보다 먼저 체크
  if (/태권도|검도|유도|합기도|무에타이|주짓수|무술/.test(c)) return "martial_arts";
  if (/클라이밍|볼더링|암벽/.test(c)) return "climbing";
  if (/헬스|피트니스|pt샵|gym/.test(c)) return "fitness";
  if (/요가|필라테스/.test(c)) return "yoga";
  if (/발레|무용학원/.test(c)) return "ballet";
  if (/댄스|힙합학원|방송댄스/.test(c)) return "dance";
  if (/골프|스크린골프|골프연습장/.test(c)) return "golf";
  if (/수영|아쿠아|수영장/.test(c)) return "swim";
  if (/찜질방|사우나|한증막/.test(c)) return "jjimjil";

  // 반려동물
  if (/동물병원|펫|반려동물|애견|애묘/.test(c)) return "pet";

  // 교육 세분화 — education보다 먼저 체크
  if (/스터디카페|독서실|스터디룸/.test(c)) return "study";
  if (/과외/.test(c)) return "tutoring";
  if (/음악교실|음악학원|피아노학원|바이올린학원|첼로학원/.test(c)) return "music_class";
  if (/피아노레슨|기타레슨|드럼레슨|보컬레슨|악기레슨|개인레슨/.test(c)) return "music_lesson";
  if (/요리교실|쿠킹|베이킹클래스|요리학원|쿡클래스/.test(c)) return "cooking";
  if (/미술학원|미술교실|입시미술|어린이미술/.test(c)) return "art_class";
  if (/어린이집|유치원|보육원/.test(c)) return "childcare";
  if (/학원|교습소|영어|수학/.test(c)) return "education";

  // 전문직·서비스
  if (/세무|회계|세무사|공인회계사|기장/.test(c)) return "accounting";
  if (/법무사|변호사|법률/.test(c)) return "legal";
  if (/부동산|공인중개사/.test(c)) return "realestate";
  if (/인테리어|시공|리모델링/.test(c)) return "interior";
  // 서비스 세분화 — auto보다 먼저 체크
  if (/세차|코팅|광택·왁스/.test(c)) return "car_wash";
  if (/자동차|카센터|타이어|정비/.test(c)) return "auto";
  if (/핸드폰수리|스마트폰수리|액정교체|가전수리/.test(c)) return "electronics_repair";
  if (/세탁소|드라이클리닝|코인세탁/.test(c)) return "laundry";
  if (/청소/.test(c)) return "cleaning";

  // 쇼핑·생활 — fashion보다 먼저 체크
  if (/꽃집|화원|플라워/.test(c)) return "flower";
  if (/신발|구두|운동화|슬리퍼매장/.test(c)) return "footwear";
  if (/문구점|문구사|사무용품|학용품/.test(c)) return "stationery";
  if (/패션|편집샵|브랜드샵/.test(c)) return "fashion";
  if (/의류|옷가게|원단|교복|수선/.test(c)) return "clothing";
  if (/쇼핑|마트|편의점|슈퍼|백화점/.test(c)) return "shopping";

  // 사진·영상·디자인
  if (/사진관|스튜디오|포토/.test(c)) return "photo";
  if (/영상|비디오|드론/.test(c)) return "video";
  if (/디자인/.test(c)) return "design";

  // 여가·오락
  if (/노래방|코인노래방/.test(c)) return "norebang";
  if (/당구장|포켓볼|당구/.test(c)) return "billiards";

  // 공방·공예
  if (/방탈출|이스케이프룸/.test(c)) return "escape";
  if (/체험형|원데이체험|도예체험|향수만들기|체험공간/.test(c)) return "experience";
  if (/공방|원데이클래스|공예|아틀리에/.test(c)) return "workshop";

  // 숙박
  if (/숙박|호텔|모텔|펜션|게스트하우스|리조트/.test(c)) return "accommodation";

  return "other";
}
