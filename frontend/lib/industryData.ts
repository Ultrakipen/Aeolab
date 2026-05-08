export type BriefingStatus = 'ok' | 'soon' | 'no';

export interface IndustryData {
  btype: BriefingStatus;
  badge: string;
  t1: number;
  t2: number;
  r1: string;
  r2: string;
  growth: string;
  gtxt: string;
  gsub: string;
  missingKws: string[];
  ownedKws: string[];
  kakaoMsg: string;
}

export const INDUSTRY_DATA: Record<string, IndustryData> = {
  restaurant: {
    btype: 'ok',
    badge: 'AI브리핑 정식 대상',
    t1: 38, t2: 22,
    r1: '업종 6위', r2: '업종 8위',
    growth: '🌱', gtxt: '생존 단계',
    gsub: '경쟁사 대비 기초 정보 보강이 우선입니다',
    missingKws: ['주차 가능', '단체석', '포장 가능'],
    ownedKws: ['한식', '점심특선'],
    kakaoMsg: '이번 주 AI 노출: 23% → 31% (↑8%p)',
  },
  cafe: {
    btype: 'ok',
    badge: 'AI브리핑 정식 대상',
    t1: 42, t2: 25,
    r1: '업종 5위', r2: '업종 7위',
    growth: '🌱', gtxt: '생존 단계',
    gsub: '카카오·반려동물 정보 등록이 노출을 높입니다',
    missingKws: ['반려동물', '주차 가능', 'WiFi'],
    ownedKws: ['아메리카노', '디저트'],
    kakaoMsg: 'ChatGPT가 내 카페를 3번 언급했습니다',
  },
  bakery: {
    btype: 'ok',
    badge: 'AI브리핑 정식 대상',
    t1: 35, t2: 20,
    r1: '업종 7위', r2: '업종 9위',
    growth: '🌱', gtxt: '생존 단계',
    gsub: '소개글에 주력 제품명 보강이 필요합니다',
    missingKws: ['수제 케이크', '맞춤 주문', '선물 포장'],
    ownedKws: ['식빵', '바게트'],
    kakaoMsg: '경쟁 빵집이 AI 순위 2계단 상승했습니다',
  },
  bar: {
    btype: 'ok',
    badge: 'AI브리핑 정식 대상',
    t1: 31, t2: 18,
    r1: '업종 8위', r2: '업종 10위',
    growth: '🌱', gtxt: '생존 단계',
    gsub: '영업시간·안주 메뉴 등록이 노출 핵심입니다',
    missingKws: ['포장마차', '혼술 가능', '안주 종류'],
    ownedKws: ['맥주', '소주'],
    kakaoMsg: '이번 달 할 일: 메뉴 설명에 혼술 가능 추가',
  },
  accommodation: {
    btype: 'ok',
    badge: 'AI브리핑 정식 대상',
    t1: 52, t2: 19,
    r1: '업종 4위', r2: '업종 11위',
    growth: '⚔️', gtxt: '경쟁 우위 단계',
    gsub: '조식·키즈 정보 보강으로 상위권 진입 가능합니다',
    missingKws: ['조식 포함', '키즈풀', '반려동물'],
    ownedKws: ['더블룸', '조식'],
    kakaoMsg: '이번 주 숙박 예약 키워드 순위 2위로 상승',
  },
  beauty: {
    btype: 'soon',
    badge: '확대 예정 업종',
    t1: 0, t2: 31,
    r1: '미적용', r2: '업종 5위',
    growth: '🌱', gtxt: '생존 단계',
    gsub: 'ChatGPT·Gemini·Google AI 노출 개선으로 가치를 드립니다',
    missingKws: ['헤어 컬러', '펌 전문', '예약 방법'],
    ownedKws: ['커트', '염색'],
    kakaoMsg: 'ChatGPT가 내 미용실을 2번 언급했습니다',
  },
  nail: {
    btype: 'soon',
    badge: '확대 예정 업종',
    t1: 0, t2: 28,
    r1: '미적용', r2: '업종 6위',
    growth: '🌱', gtxt: '생존 단계',
    gsub: 'ChatGPT·Gemini·Google AI 노출 개선으로 가치를 드립니다',
    missingKws: ['네일아트', '젤네일', '예약 가능'],
    ownedKws: ['매니큐어'],
    kakaoMsg: 'Gemini가 내 네일샵을 추천 목록에 올렸습니다',
  },
  medical: {
    btype: 'no',
    badge: '글로벌 AI 채널 대상',
    t1: 0, t2: 44,
    r1: '미적용', r2: '업종 4위',
    growth: '⚔️', gtxt: '경쟁 우위 단계',
    gsub: 'ChatGPT·Gemini·Google AI 채널에서 높은 노출도입니다',
    missingKws: ['비수술 치료', '도수치료', '예약 방법'],
    ownedKws: ['내과', '가정의학과'],
    kakaoMsg: 'Google AI에서 내 병원이 3번 언급됐습니다',
  },
  education: {
    btype: 'no',
    badge: '글로벌 AI 채널 대상',
    t1: 0, t2: 38,
    r1: '미적용', r2: '업종 5위',
    growth: '🌱', gtxt: '생존 단계',
    gsub: 'ChatGPT·Gemini·Google AI 채널에서 개선 여지가 있습니다',
    missingKws: ['원어민 강사', '토플 대비', '소수 정원'],
    ownedKws: ['영어', '수학'],
    kakaoMsg: '이번 달 할 일: 강사 소개 소개글 업데이트',
  },
  fitness: {
    btype: 'no',
    badge: '글로벌 AI 채널 대상',
    t1: 0, t2: 35,
    r1: '미적용', r2: '업종 6위',
    growth: '🌱', gtxt: '생존 단계',
    gsub: 'ChatGPT·Gemini·Google AI 채널에서 개선 여지가 있습니다',
    missingKws: ['1:1 PT', '여성 전용', '주차 가능'],
    ownedKws: ['헬스', '요가'],
    kakaoMsg: 'ChatGPT가 내 헬스장을 1번 언급했습니다',
  },
  other: {
    btype: 'no',
    badge: '글로벌 AI 채널 대상',
    t1: 0, t2: 30,
    r1: '미적용', r2: '업종 평균',
    growth: '🌱', gtxt: '생존 단계',
    gsub: 'ChatGPT·Gemini·Google AI 노출 개선으로 가치를 드립니다',
    missingKws: ['업종 키워드', '지역명', '서비스 특징'],
    ownedKws: ['상호명'],
    kakaoMsg: 'ChatGPT에서 내 가게 언급 횟수가 늘고 있습니다',
  },
};

export const BRIEFING_STATUS_CONFIG: Record<BriefingStatus, {
  dot: string;
  label: string;
  bannerBg: string;
  bannerBorder: string;
  bannerText: string;
}> = {
  ok: {
    dot: '#00B96B',
    label: 'AI브리핑 정식 대상',
    bannerBg: '#E4F9EF',
    bannerBorder: '#A7F3D0',
    bannerText: '#065F46',
  },
  soon: {
    dot: '#F59E0B',
    label: 'AI브리핑 확대 예정',
    bannerBg: '#FEF3C7',
    bannerBorder: '#FDE68A',
    bannerText: '#92400E',
  },
  no: {
    dot: '#F43F5E',
    label: '글로벌 AI 채널 대상',
    bannerBg: '#FFF0F3',
    bannerBorder: '#FECACA',
    bannerText: '#9F1239',
  },
};

export const TILE_DEFINITIONS = [
  { key: 'restaurant',    label: '음식점',   emoji: '🍽️' },
  { key: 'cafe',          label: '카페',     emoji: '☕' },
  { key: 'bakery',        label: '베이커리', emoji: '🥐' },
  { key: 'bar',           label: '바·술집',  emoji: '🍺' },
  { key: 'accommodation', label: '숙박',     emoji: '🏨' },
  { key: 'beauty',        label: '미용·뷰티', emoji: '✂️' },
  { key: 'medical',       label: '병원',     emoji: '🏥' },
  { key: 'education',     label: '학원',     emoji: '📚' },
  { key: 'fitness',       label: '헬스',     emoji: '💪' },
  { key: 'other',         label: '기타',     emoji: '⊕' },
];
