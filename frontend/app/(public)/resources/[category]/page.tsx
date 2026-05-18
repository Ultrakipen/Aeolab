import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { SiteFooter } from "@/components/common/SiteFooter";
import GuideChecklistClient from "./GuideChecklistClient";

/* ------------------------------------------------------------------ */
/*  정적 데이터                                                          */
/* ------------------------------------------------------------------ */

interface GuideData {
  label: string;
  description: string;
  checklist: string[];
  keywords: string[];
  top3: { title: string; desc: string }[];
}

const GUIDE_DATA: Record<string, GuideData> = {
  restaurant: {
    label: "음식점",
    description:
      "음식점은 네이버 AI 브리핑 ACTIVE 업종입니다. 스마트플레이스 완성도, 리뷰 수, 소식 빈도가 노출 핵심 요소입니다.",
    checklist: [
      "스마트플레이스 소개글 200자 이상 작성",
      "대표 메뉴 3개 이상 등록 (가격 포함)",
      "사진 10장 이상 업로드 (음식·내부·외관 포함)",
      "영업시간 정확히 입력 (브레이크 타임 포함)",
      "리뷰 답글 3개 이상 작성",
      "네이버 예약 연동 설정",
      "소식 2주 이내 최소 1건 작성",
      "카카오맵 정보 동기화 확인",
      "키워드 3개 설정 (예: 점심 특선, 주차 가능)",
      "톡톡 채팅방 메뉴 설정 (예약·문의 버튼)",
      "주차 정보 및 주요 교통편 입력",
      "정기 휴무일 명확히 표시",
    ],
    keywords: ["맛집", "배달", "점심특선", "회식", "주차 가능"],
    top3: [
      {
        title: "소개글 200자+ 작성",
        desc: "대표 메뉴·분위기·특징을 담은 소개글은 AI 브리핑 답변 생성의 핵심 소스입니다.",
      },
      {
        title: "리뷰 답글 꾸준히",
        desc: "리뷰 응답률이 높은 가게는 스마트플레이스 활성도 점수가 올라 AI 노출 우선순위가 높아집니다.",
      },
      {
        title: "소식 2주 이내 작성",
        desc: "최근 소식이 없으면 AI 브리핑에서 '현재 운영 여부 불분명' 판단으로 노출이 줄 수 있습니다.",
      },
    ],
  },

  cafe: {
    label: "카페",
    description:
      "카페는 네이버 AI 브리핑 ACTIVE 업종입니다. 시그니처 음료 사진, 좌석 환경 정보, 소식 주기가 방문 유도의 핵심입니다.",
    checklist: [
      "스마트플레이스 소개글 200자 이상 작성",
      "시그니처 음료 사진 3장 이상 업로드",
      "좌석 수 및 좌석 유형(창가·소파) 입력",
      "와이파이 제공 여부 입력",
      "반려동물 동반 가능 여부 명시",
      "사진 15장 이상 업로드 (음료·인테리어·외관 포함)",
      "소식 주 1회 이상 작성",
      "네이버 예약 또는 웨이팅 연동",
      "영업시간 및 라스트오더 정확히 입력",
      "주차 정보 입력 및 주변 교통편 안내",
    ],
    keywords: ["카페", "디저트", "작업하기 좋은", "분위기 좋은", "브런치"],
    top3: [
      {
        title: "시그니처 음료 사진",
        desc: "AI 브리핑은 이미지 태그 정보를 활용합니다. 시각적으로 완성도 높은 음료 사진이 키워드 연결에 유리합니다.",
      },
      {
        title: "좌석 환경 정보 완성",
        desc: "'작업하기 좋은 카페' 등의 쿼리에 노출되려면 와이파이·콘센트·좌석 수가 명시되어 있어야 합니다.",
      },
      {
        title: "소식 주 1회 이상",
        desc: "신메뉴·시즌 음료 소개를 정기적으로 올리면 '최근 활동 업소'로 분류되어 노출 가중치가 높아집니다.",
      },
    ],
  },

  bakery: {
    label: "베이커리",
    description:
      "베이커리는 네이버 AI 브리핑 ACTIVE 업종입니다. 당일 생산 품목 소식, 시그니처 빵 사진, 영업시간 정확도가 핵심입니다.",
    checklist: [
      "스마트플레이스 소개글 200자 이상 (주력 제품 포함)",
      "대표 빵 사진 5장 이상 업로드",
      "당일 생산 시간 및 품목 소식 등록",
      "영업시간·마감 시간 정확히 입력",
      "포장 가능 여부 및 주문 방법 명시",
      "사진 10장 이상 업로드 (제품·진열·매장 포함)",
      "소식 2주 이내 최소 1건 작성",
      "카카오맵 정보 동기화 확인",
      "키워드 3개 설정 (예: 수제 빵, 당일 생산)",
      "알레르기 유발 성분 안내 게시",
    ],
    keywords: ["베이커리", "수제 빵", "당일 생산", "케이크", "파티시에"],
    top3: [
      {
        title: "당일 생산 소식 등록",
        desc: "오늘 나온 빵 품목을 소식으로 올리면 '오늘 가볼 만한 베이커리' 쿼리에서 AI 브리핑 노출 가능성이 높아집니다.",
      },
      {
        title: "대표 제품 사진 완성",
        desc: "시그니처 빵 중심으로 고화질 사진을 올리면 이미지 검색 연계 노출에 유리합니다.",
      },
      {
        title: "영업시간·마감 시간 정확히",
        desc: "마감 직전 재고 소진으로 영업 여부가 달라지는 경우 소식이나 공지로 알려주면 리뷰 불만을 줄일 수 있습니다.",
      },
    ],
  },

  beauty: {
    label: "미용실·헤어",
    description:
      "미용실은 네이버 AI 브리핑 LIKELY 업종입니다. 시술 전후 사진, 예약 연동, 가격 정보 투명화가 검색 전환 핵심입니다.",
    checklist: [
      "스마트플레이스 소개글 200자 이상 (주요 시술 포함)",
      "시술 전후 비교 사진 3세트 이상 업로드",
      "디자이너 프로필 및 경력 소개 작성",
      "주요 시술 가격표 입력",
      "네이버 예약 연동 설정",
      "사진 15장 이상 업로드 (시술·내부·외관 포함)",
      "소식 2주 이내 최소 1건 작성",
      "키워드 3개 설정 (예: 펌, 염색, 클리닉)",
      "영업시간 정확히 입력 (정기 휴무일 포함)",
      "주차 정보 및 오시는 길 입력",
    ],
    keywords: ["미용실", "헤어샵", "펌", "염색", "커트"],
    top3: [
      {
        title: "시술 전후 사진",
        desc: "AI 브리핑에서 '헤어샵 추천' 쿼리 응답 시 시술 결과 사진이 있는 업소가 우선 인용되는 경향이 있습니다.",
      },
      {
        title: "가격 정보 투명화",
        desc: "주요 시술 가격을 공개하면 '가격 궁금해서 안 가는' 이탈을 줄이고 AI 검색 노출 완성도 점수가 올라갑니다.",
      },
      {
        title: "예약 연동 설정",
        desc: "네이버 예약이 연동된 업소는 AI 브리핑 답변에서 '바로 예약 가능' 배지가 붙어 클릭률이 높아집니다.",
      },
    ],
  },

  nail: {
    label: "네일샵",
    description:
      "네일샵은 네이버 AI 브리핑 LIKELY 업종입니다. 디자인 포트폴리오 사진과 예약 연동이 키워드 커버리지 확대의 핵심입니다.",
    checklist: [
      "스마트플레이스 소개글 200자 이상 (주요 시술 포함)",
      "네일 디자인 포트폴리오 사진 10장 이상 업로드",
      "시술별 가격표 입력",
      "네이버 예약 또는 카카오 채널 예약 연동",
      "시술 소요 시간 안내 작성",
      "사진 15장 이상 업로드 (디자인·매장·재료 포함)",
      "소식 2주 이내 최소 1건 작성 (신규 디자인 등)",
      "키워드 3개 설정 (예: 젤네일, 아트네일, 케어)",
      "영업시간 정확히 입력",
      "주차 정보 및 오시는 길 입력",
    ],
    keywords: ["네일샵", "젤네일", "아트네일", "네일 케어", "속눈썹"],
    top3: [
      {
        title: "디자인 포트폴리오 사진",
        desc: "'젤네일 예쁜 곳' 등 비주얼 쿼리에서 AI 브리핑이 사진이 많은 업소를 우선 인용합니다.",
      },
      {
        title: "시술 소요 시간 안내",
        desc: "방문 시간 예측이 가능한 업소는 예약 전환율이 높고 리뷰 만족도도 올라갑니다.",
      },
      {
        title: "신규 디자인 소식 등록",
        desc: "계절별 신규 디자인 소식을 올리면 키워드 다양성이 늘어나 더 많은 검색 쿼리에 노출될 수 있습니다.",
      },
    ],
  },

  fitness: {
    label: "헬스장·PT",
    description:
      "헬스장은 네이버 AI 브리핑 LIKELY 업종입니다. 트레이너 소개, 시설 사진, 체험 프로그램 안내가 등록 전환의 핵심입니다.",
    checklist: [
      "스마트플레이스 소개글 200자 이상 (주요 프로그램 포함)",
      "트레이너 프로필·자격증 정보 작성",
      "시설 내부 사진 10장 이상 업로드 (기구·샤워·휴게 포함)",
      "회원권 가격표 입력",
      "체험 PT 프로그램 안내 작성",
      "운영 시간 정확히 입력 (휴일 포함)",
      "소식 2주 이내 최소 1건 작성 (이벤트·팁 등)",
      "키워드 3개 설정 (예: 개인 PT, 헬스, 다이어트)",
      "주차 정보 및 오시는 길 입력",
      "카카오 채널 또는 네이버 예약 상담 연동",
    ],
    keywords: ["헬스장", "PT", "개인 트레이닝", "다이어트", "근력 운동"],
    top3: [
      {
        title: "트레이너 소개 작성",
        desc: "자격증·경력이 명시된 트레이너 정보는 AI 브리핑 '전문성' 판단 요소로 인용될 수 있습니다.",
      },
      {
        title: "시설 사진 풍부하게",
        desc: "기구 종류, 샤워실, 락커 등 시설 사진이 많을수록 방문 전 의사결정이 빨라지고 클릭이 증가합니다.",
      },
      {
        title: "체험 PT 프로그램 안내",
        desc: "진입 장벽을 낮추는 체험 프로그램이 있으면 '처음 가보는 헬스장' 쿼리 응답에 포함될 가능성이 높습니다.",
      },
    ],
  },

  accommodation: {
    label: "숙박",
    description:
      "숙박업은 네이버 AI 브리핑 ACTIVE 업종입니다. 객실 사진, 편의시설 정보, 주변 관광지 키워드 연결이 노출 핵심입니다.",
    checklist: [
      "스마트플레이스 소개글 200자 이상 (객실 유형·특징 포함)",
      "객실 내부 사진 10장 이상 업로드 (침실·욕실·전망 포함)",
      "편의시설 목록 완성 (주차·수영장·조식·와이파이 등)",
      "체크인·체크아웃 시간 정확히 입력",
      "네이버 예약 연동 설정",
      "주변 관광지 키워드 소개글에 포함",
      "소식 2주 이내 최소 1건 작성 (이벤트·시즌 패키지)",
      "키워드 3개 설정 (예: 오션뷰, 커플룸, 반려동물 동반)",
      "취소·환불 정책 명확히 게시",
      "오시는 길 및 주차 안내 상세히 작성",
    ],
    keywords: ["숙박", "펜션", "호텔", "오션뷰", "커플 여행"],
    top3: [
      {
        title: "객실 사진 충분히",
        desc: "침실·욕실·전망 사진이 풍부할수록 '어디서 자지?' 쿼리에서 AI 브리핑 인용 가능성이 높아집니다.",
      },
      {
        title: "편의시설 목록 완성",
        desc: "수영장·조식·반려동물 동반 여부가 명시되면 조건 검색 쿼리에 정확하게 매칭됩니다.",
      },
      {
        title: "주변 관광지 키워드 연결",
        desc: "소개글에 '○○해수욕장 5분', '○○산 등산로 인근' 등을 포함하면 지역 기반 여행 쿼리 노출이 늘어납니다.",
      },
    ],
  },

  pet: {
    label: "반려동물샵",
    description:
      "반려동물샵은 네이버 AI 브리핑 LIKELY 업종입니다. 서비스별 요금, 전후 사진, 자격증 정보가 신뢰도 핵심입니다.",
    checklist: [
      "스마트플레이스 소개글 200자 이상 (주요 서비스 포함)",
      "미용 전후 비교 사진 3세트 이상 업로드",
      "서비스별 요금표 입력 (미용·목욕·호텔 등)",
      "담당자 자격증·경력 정보 작성",
      "반려동물 종별 서비스 가능 범위 명시",
      "사진 10장 이상 업로드 (서비스·매장·동물 포함)",
      "소식 2주 이내 최소 1건 작성 (신규 서비스·이벤트)",
      "키워드 3개 설정 (예: 강아지 미용, 고양이 호텔)",
      "예약 방법 및 취소 정책 안내",
      "영업시간 정확히 입력 (정기 휴무일 포함)",
    ],
    keywords: ["강아지 미용", "고양이 호텔", "반려동물", "펫샵", "스파"],
    top3: [
      {
        title: "전후 비교 사진",
        desc: "미용 전후 사진은 '우리 강아지 미용 잘하는 곳' 쿼리 응답에서 AI 브리핑 인용 요소로 작용합니다.",
      },
      {
        title: "요금표 투명화",
        desc: "서비스별 가격이 공개된 업소는 '가격 물어봐야 하는' 불편함 없이 즉시 예약 결정으로 이어집니다.",
      },
      {
        title: "자격증 정보 게시",
        desc: "반려동물 관련 자격증이 명시된 업소는 AI 검색의 '신뢰도' 평가 요소에서 가산점을 받습니다.",
      },
    ],
  },

  education: {
    label: "교육·학원",
    description:
      "교육·학원은 네이버 AI 브리핑 INACTIVE 업종으로 ChatGPT·Gemini 중심 노출이 권장됩니다. 커리큘럼, 강사 소개, 수강 후기가 등록 전환 핵심입니다.",
    checklist: [
      "스마트플레이스 소개글 200자 이상 (수업 과목·대상 연령 포함)",
      "강사 프로필 및 자격증·경력 소개 작성",
      "커리큘럼 또는 수업 과정 안내 게시",
      "수강료 정보 입력 (과목별·수준별)",
      "원생 수강 후기 3개 이상 확보",
      "사진 10장 이상 업로드 (수업 장면·교재·시설)",
      "소식 2주 이내 최소 1건 작성 (개강·이벤트)",
      "키워드 3개 설정 (예: 영어학원, 수학 과외, 피아노)",
      "체험 수업 안내 작성 (있는 경우)",
      "상담 신청 방법 명확히 표시",
    ],
    keywords: ["학원", "과외", "영어 수업", "수학", "입시"],
    top3: [
      {
        title: "커리큘럼 상세 안내",
        desc: "수업 내용·난이도·대상이 명시되면 ChatGPT·Gemini의 '학원 추천' 답변에서 인용 가능성이 높아집니다.",
      },
      {
        title: "강사 소개·자격증",
        desc: "교육 분야는 전문성 신뢰가 핵심입니다. 강사 이력이 구체적일수록 AI 검색 권위 점수가 올라갑니다.",
      },
      {
        title: "수강 후기 확보",
        desc: "실제 수강생 후기는 AI 브리핑·글로벌 AI 모두 '인용할 만한 근거'로 활용합니다.",
      },
    ],
  },
};

const VALID_CATEGORIES = Object.keys(GUIDE_DATA);

/* ------------------------------------------------------------------ */
/*  generateStaticParams                                                */
/* ------------------------------------------------------------------ */

export async function generateStaticParams() {
  return VALID_CATEGORIES.map((category) => ({ category }));
}

/* ------------------------------------------------------------------ */
/*  generateMetadata                                                    */
/* ------------------------------------------------------------------ */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  const guide = GUIDE_DATA[category];
  if (!guide) return {};
  return {
    title: `${guide.label} AI 검색 노출 가이드 | AEOlab`,
    description: `${guide.label} 스마트플레이스·AI 검색 노출 10가지 체크리스트. 지금 바로 진단받기.`,
  };
}

/* ------------------------------------------------------------------ */
/*  페이지 컴포넌트                                                      */
/* ------------------------------------------------------------------ */

export default async function CategoryGuidePage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const guide = GUIDE_DATA[category];
  if (!guide) notFound();

  return (
    <main className="min-h-screen bg-white">
      {/* 헤더 */}
      <header className="border-b border-gray-100 px-4 md:px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-xl md:text-2xl font-bold text-blue-600">
            AEOlab
          </Link>
          <div className="flex items-center gap-3 md:gap-4">
            <Link
              href="/resources"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              가이드 목록
            </Link>
            <Link
              href="/trial"
              className="bg-blue-600 text-white text-sm md:text-base px-3 md:px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              무료 진단
            </Link>
          </div>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-4 md:px-6 py-8 md:py-12">
        {/* 브레드크럼 */}
        <nav className="text-sm text-gray-400 mb-4" aria-label="브레드크럼">
          <Link href="/resources" className="hover:text-gray-600">
            업종별 가이드
          </Link>
          <span className="mx-2">/</span>
          <span className="text-gray-700">{guide.label}</span>
        </nav>

        {/* 제목 */}
        <h1 className="text-2xl md:text-4xl font-bold text-gray-900 leading-tight break-keep mb-3">
          {guide.label} AI 검색 노출 가이드
        </h1>
        <p className="text-base md:text-lg text-gray-600 leading-relaxed break-keep mb-8">
          {guide.description}
        </p>

        {/* ── 섹션 1: 체크리스트 ── */}
        <section className="mb-10 md:mb-12">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-4 break-keep">
            1. AI 검색 노출 체크리스트
          </h2>
          <GuideChecklistClient checklist={guide.checklist} />
        </section>

        {/* ── 섹션 2: 키워드 태그 ── */}
        <section className="mb-10 md:mb-12">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-2 break-keep">
            2. 이 업종에서 자주 인용되는 키워드
          </h2>
          <p className="text-sm text-gray-500 mb-4 break-keep">
            AI 검색 응답에서 자주 등장하는 키워드입니다. 소개글과 소식에 자연스럽게 포함하세요.
          </p>
          <div className="flex flex-wrap gap-2">
            {guide.keywords.map((kw) => (
              <span
                key={kw}
                className="bg-blue-50 text-blue-700 text-sm font-medium px-3 py-1.5 rounded-full"
              >
                {kw}
              </span>
            ))}
          </div>
        </section>

        {/* ── 섹션 3: 개선 우선순위 TOP 3 ── */}
        <section className="mb-10 md:mb-12">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-4 break-keep">
            3. 개선 우선순위 TOP 3
          </h2>
          <div className="space-y-3">
            {guide.top3.map((item, idx) => (
              <div
                key={idx}
                className="flex gap-4 p-4 md:p-5 bg-gray-50 rounded-xl border border-gray-100"
              >
                <div className="shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-base">
                  {idx + 1}
                </div>
                <div>
                  <div className="font-bold text-gray-900 text-base md:text-lg break-keep mb-1">
                    {item.title}
                  </div>
                  <p className="text-sm md:text-base text-gray-600 leading-relaxed break-keep">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── 섹션 4: 다음 단계 CTA ── */}
        <section className="mb-10 md:mb-12">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-4 break-keep">
            4. 다음 단계
          </h2>
          <div className="bg-blue-50 rounded-xl p-6 md:p-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <div className="font-bold text-gray-900 text-base md:text-lg break-keep mb-1">
                체크리스트 완료 후, 실제 점수를 확인하세요
              </div>
              <p className="text-sm md:text-base text-gray-600 break-keep">
                AEOlab이 내 {guide.label} 사업장을 직접 분석해 부족한 항목과 개선 우선순위를 알려드립니다.
              </p>
            </div>
            <Link
              href="/trial"
              className="shrink-0 bg-blue-600 text-white font-medium text-sm md:text-base px-5 py-3 rounded-xl hover:bg-blue-700 transition-colors text-center"
            >
              AEOlab으로 지금 바로 진단 → 무료 체험
            </Link>
          </div>
        </section>

        {/* 면책 문구 */}
        <div className="border-t border-gray-100 pt-6">
          <p className="text-sm text-gray-400 leading-relaxed break-keep">
            이 가이드는 일반적인 권장 사항이며, 실제 노출 결과는 업종·지역·경쟁 강도에 따라 다를 수 있습니다.
          </p>
        </div>
      </article>

      <SiteFooter activePage="/resources" />
    </main>
  );
}
