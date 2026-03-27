export interface CategoryOption {
  value: string;
  label: string;
}

export interface CategoryGroup {
  group: string;
  options: CategoryOption[];
}

export const CATEGORY_GROUPS: CategoryGroup[] = [
  {
    group: "음식·식음료",
    options: [
      { value: "restaurant",    label: "음식점 (한식·중식·일식·양식)" },
      { value: "cafe",          label: "카페·디저트" },
      { value: "chicken",       label: "치킨·피자·패스트푸드" },
      { value: "bbq",           label: "고기집·구이·삼겹살" },
      { value: "seafood",       label: "해산물·횟집·조개구이" },
      { value: "bakery",        label: "베이커리·제과점" },
      { value: "bar",           label: "술집·바·포차·이자카야" },
      { value: "snack",         label: "분식·김밥·국밥" },
      { value: "delivery",      label: "배달전문·도시락" },
      { value: "health_food",   label: "건강식·샐러드·채식" },
    ],
  },
  {
    group: "의료·건강",
    options: [
      { value: "hospital",      label: "병원·내과·외과·의원" },
      { value: "dental",        label: "치과·교정" },
      { value: "oriental",      label: "한의원·한방병원" },
      { value: "pharmacy",      label: "약국" },
      { value: "skincare",      label: "피부과·성형외과" },
      { value: "eye",           label: "안과·안경원·렌즈" },
      { value: "mental",        label: "정신건강의학과·심리상담" },
      { value: "rehab",         label: "물리치료·재활·도수치료" },
      { value: "checkup",       label: "건강검진센터" },
      { value: "fitness",       label: "헬스장·피트니스센터" },
      { value: "yoga",          label: "요가·필라테스·PT" },
      { value: "swimming",      label: "수영장·수영강습" },
    ],
  },
  {
    group: "교육·보육",
    options: [
      { value: "academy",       label: "학원·교습소 (일반)" },
      { value: "language",      label: "외국어·영어학원" },
      { value: "coding",        label: "코딩·SW·로봇 교육" },
      { value: "daycare",       label: "어린이집·유치원" },
      { value: "tutoring",      label: "과외·개인교습" },
      { value: "music_edu",     label: "음악·피아노·보컬 학원" },
      { value: "art_studio",    label: "미술학원·미술교실" },
      { value: "art_edu",       label: "미술·공예 학원" },
      { value: "sports_edu",    label: "태권도·검도·스포츠 학원" },
      { value: "driving",       label: "자동차운전학원" },
    ],
  },
  {
    group: "전문직·서비스",
    options: [
      { value: "law",           label: "법률·법무사" },
      { value: "tax",           label: "세무·회계·노무" },
      { value: "realestate",    label: "부동산·공인중개사" },
      { value: "architecture",  label: "건축·설계·측량" },
      { value: "insurance",     label: "보험·금융" },
      { value: "it",            label: "IT·개발·앱·웹" },
      { value: "design",        label: "디자인·인쇄·출판" },
      { value: "marketing",     label: "광고·마케팅·SNS 관리" },
      { value: "photo",         label: "사진관·증명사진·프로필" },
      { value: "photo_wedding", label: "웨딩 스튜디오·스드메" },
      { value: "video",         label: "영상제작·유튜브·광고영상" },
      { value: "consulting",    label: "컨설팅·경영·HR" },
      { value: "translation",   label: "번역·통역" },
      { value: "funeral",       label: "장례·상조" },
    ],
  },
  {
    group: "뷰티·패션",
    options: [
      { value: "beauty",        label: "미용실·헤어샵" },
      { value: "nail",          label: "네일·속눈썹·왁싱" },
      { value: "makeup",        label: "메이크업·반영구·문신" },
      { value: "spa",           label: "마사지·스파·피부관리" },
      { value: "clothing",      label: "의류·패션·잡화" },
      { value: "shoes",         label: "신발·가방·액세서리" },
      { value: "eyewear",       label: "안경·선글라스" },
      { value: "sportswear",    label: "스포츠웨어·아웃도어" },
    ],
  },
  {
    group: "쇼핑·유통",
    options: [
      { value: "shop",          label: "쇼핑몰·편의점·마트" },
      { value: "grocery",       label: "식자재·농수산물·정육점" },
      { value: "electronics",   label: "전자제품·가전·통신기기" },
      { value: "furniture",     label: "가구·침구·소품" },
      { value: "stationery",    label: "문구·완구·팬시" },
      { value: "book",          label: "서점·중고책·도서" },
      { value: "instrument",    label: "악기·취미용품" },
      { value: "supplement",    label: "건강식품·영양제" },
      { value: "baby",          label: "유아용품·임산부" },
    ],
  },
  {
    group: "생활서비스",
    options: [
      { value: "interior",      label: "인테리어·리모델링" },
      { value: "auto",          label: "자동차 정비·세차·타이어" },
      { value: "auto_trade",    label: "중고차·자동차 매매" },
      { value: "laundry",       label: "세탁소·수선·리폼" },
      { value: "pet",           label: "반려동물 용품·미용" },
      { value: "vet",           label: "동물병원·수의원" },
      { value: "cleaning",      label: "청소·가사 대행" },
      { value: "moving",        label: "이사·용달·보관" },
      { value: "repair",        label: "전자제품·가전 수리·AS" },
      { value: "locksmith",     label: "열쇠·자물쇠·방범" },
      { value: "flower",        label: "꽃집·화원·조화" },
      { value: "funeral_supp",  label: "장례용품·납골당" },
    ],
  },
  {
    group: "음악·공연",
    options: [
      { value: "music_live",    label: "라이브 클럽·공연장·뮤직바" },
      { value: "music_cafe",    label: "뮤직카페·노래주점" },
      { value: "recording",     label: "녹음실·음악 프로덕션·작곡" },
      { value: "perform_plan",  label: "공연기획·매니지먼트·에이전시" },
      { value: "instrument_lesson", label: "악기 레슨·개인 교습" },
      { value: "karaoke_pro",   label: "코인노래방·프리미엄 노래방" },
    ],
  },
  {
    group: "이벤트·행사·웨딩",
    options: [
      { value: "wedding_hall",  label: "웨딩홀·예식장·스몰웨딩" },
      { value: "wedding_plan",  label: "웨딩 플래너·웨딩 컨설팅" },
      { value: "event_plan",    label: "이벤트·행사 기획·진행" },
      { value: "party_room",    label: "파티룸·행사장·대관" },
      { value: "catering",      label: "케이터링·출장 뷔페" },
      { value: "photo_event",   label: "이벤트 사진·영상 촬영" },
      { value: "flower_event",  label: "플라워·꽃 장식·부케" },
      { value: "mc_dj",         label: "MC·DJ·밴드 섭외" },
    ],
  },
  {
    group: "숙박·여가",
    options: [
      { value: "accommodation", label: "숙박·펜션·모텔·호텔" },
      { value: "guesthouse",    label: "게스트하우스·에어비앤비" },
      { value: "camping",       label: "캠핑·글램핑" },
      { value: "travel",        label: "여행사·렌터카" },
      { value: "sports",        label: "스포츠·레저·골프·볼링" },
      { value: "jjimjil",       label: "찜질방·사우나·목욕탕" },
      { value: "entertainment", label: "노래방·PC방·오락실" },
      { value: "kids",          label: "키즈카페·체험공간" },
      { value: "study_cafe",    label: "독서실·스터디카페" },
      { value: "workshop",      label: "공방·클래스·원데이 체험" },
      { value: "culture",       label: "공연·전시·갤러리" },
    ],
  },
  {
    group: "기타",
    options: [
      { value: "agriculture",   label: "농업·축산·어업" },
      { value: "manufacturing", label: "제조·가공·공장" },
      { value: "nonprofit",     label: "비영리·종교·협동조합" },
      { value: "other",         label: "기타 (위에 없는 경우)" },
    ],
  },
];

/** 평면 배열 (select option 렌더링용) */
export const CATEGORIES: CategoryOption[] = CATEGORY_GROUPS.flatMap((g) => g.options);

/** value → label 빠른 조회 */
export const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.value, c.label])
);
