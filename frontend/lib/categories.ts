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
// 25개 평면 업종 (RegisterBusinessForm과 동일 — 단일 진실 소스)
// trial 페이지·등록 폼 양쪽에서 동일 코드 사용
// ─────────────────────────────────────────────────────────────────────────────

export interface FlatCategory {
  value: string;
  label: string;
  /** 그룹 매핑 — 벤치마크/tags 조회용 */
  group: string;
  /** UI 그룹 헤더 표시용 */
  groupLabel: string;
}

export const FLAT_CATEGORY_GROUPS: { groupLabel: string; items: FlatCategory[] }[] = [
  {
    groupLabel: "음식·음료",
    items: [
      { value: "restaurant", label: "음식점",   group: "food", groupLabel: "음식·음료" },
      { value: "cafe",       label: "카페",      group: "food", groupLabel: "음식·음료" },
      { value: "bakery",     label: "베이커리",  group: "food", groupLabel: "음식·음료" },
      { value: "bar",        label: "술집·바",   group: "food", groupLabel: "음식·음료" },
    ],
  },
  {
    groupLabel: "뷰티·건강",
    items: [
      { value: "beauty",   label: "미용·헤어",     group: "beauty",  groupLabel: "뷰티·건강" },
      { value: "nail",     label: "네일·피부",     group: "beauty",  groupLabel: "뷰티·건강" },
      { value: "medical",  label: "병원·의원",     group: "health",  groupLabel: "뷰티·건강" },
      { value: "pharmacy", label: "약국",          group: "health",  groupLabel: "뷰티·건강" },
      { value: "fitness",  label: "헬스·피트니스", group: "health",  groupLabel: "뷰티·건강" },
      { value: "yoga",     label: "요가·필라테스", group: "health",  groupLabel: "뷰티·건강" },
    ],
  },
  {
    groupLabel: "반려동물",
    items: [
      { value: "pet", label: "반려동물", group: "living", groupLabel: "반려동물" },
    ],
  },
  {
    groupLabel: "교육",
    items: [
      { value: "education", label: "학원·교육",   group: "education", groupLabel: "교육" },
      { value: "tutoring",  label: "과외·튜터링", group: "education", groupLabel: "교육" },
    ],
  },
  {
    groupLabel: "전문직·서비스",
    items: [
      { value: "legal",      label: "법률·세무",   group: "professional", groupLabel: "전문직·서비스" },
      { value: "realestate", label: "부동산",      group: "professional", groupLabel: "전문직·서비스" },
      { value: "interior",   label: "인테리어",    group: "living",       groupLabel: "전문직·서비스" },
      { value: "auto",       label: "자동차·정비", group: "living",       groupLabel: "전문직·서비스" },
      { value: "cleaning",   label: "청소·세탁",   group: "living",       groupLabel: "전문직·서비스" },
    ],
  },
  {
    groupLabel: "쇼핑",
    items: [
      { value: "shopping", label: "쇼핑몰",     group: "shopping", groupLabel: "쇼핑" },
      { value: "fashion",  label: "의류·패션",  group: "beauty",   groupLabel: "쇼핑" },
    ],
  },
  {
    groupLabel: "사진·영상·디자인",
    items: [
      { value: "photo",  label: "사진·영상",    group: "photo",  groupLabel: "사진·영상·디자인" },
      { value: "video",  label: "영상·드론",    group: "video",  groupLabel: "사진·영상·디자인" },
      { value: "design", label: "디자인·인쇄",  group: "design", groupLabel: "사진·영상·디자인" },
    ],
  },
  {
    groupLabel: "숙박",
    items: [
      { value: "accommodation", label: "숙박·펜션", group: "accommodation", groupLabel: "숙박" },
    ],
  },
  {
    groupLabel: "기타",
    items: [
      { value: "other", label: "기타", group: "professional", groupLabel: "기타" },
    ],
  },
];

/** 평면 25개 — 펼친 배열 */
export const FLAT_CATEGORIES: FlatCategory[] = FLAT_CATEGORY_GROUPS.flatMap((g) => g.items);

/** value → FlatCategory */
export const FLAT_CATEGORY_MAP: Record<string, FlatCategory> = Object.fromEntries(
  FLAT_CATEGORIES.map((c) => [c.value, c])
);

/** 평면 value → 그룹 value (벤치마크/tags 조회용) */
export function flatToGroup(value: string): string {
  return FLAT_CATEGORY_MAP[value]?.group ?? value;
}

/** 평면 value → 해당 그룹의 tags */
export function tagsForFlat(value: string): string[] {
  const groupKey = flatToGroup(value);
  return CATEGORY_MAP[groupKey]?.tags ?? [];
}
