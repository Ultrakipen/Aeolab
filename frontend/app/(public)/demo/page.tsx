"use client";

import { useState } from "react";
import Link from "next/link";
import { SiteFooter } from "@/components/common/SiteFooter";
import { getBriefingEligibility } from "@/lib/userGroup";
import ResultSummaryHero from "@/components/common/ResultSummaryHero";
import { aiTabTile, briefingTile, rankTile, makeTile, type ChannelTile } from "@/lib/scoreLabels";

// ── 업종 / 지역 선택지 ────────────────────────────────────────────────
const CATEGORIES = [
  { value: "restaurant",    label: "음식점" },
  { value: "cafe",          label: "카페" },
  { value: "bakery",        label: "베이커리" },
  { value: "bar",           label: "주점/바" },
  { value: "beauty",        label: "미용실" },
  { value: "nail",          label: "네일샵" },
  { value: "medical",       label: "병원/의원" },
  { value: "pharmacy",      label: "약국" },
  { value: "fitness",       label: "헬스장" },
  { value: "yoga",          label: "요가/필라테스" },
  { value: "pet",           label: "반려동물" },
  { value: "education",     label: "학원/교육" },
  { value: "music",         label: "음악학원" },
  { value: "tutoring",      label: "과외/튜터링" },
  { value: "legal",         label: "법무사/변호사" },
  { value: "realestate",    label: "부동산" },
  { value: "interior",      label: "인테리어" },
  { value: "auto",          label: "자동차" },
  { value: "cleaning",      label: "청소/세탁" },
  { value: "shopping",      label: "쇼핑" },
  { value: "fashion",       label: "패션" },
  { value: "photo",         label: "사진" },
  { value: "video",         label: "영상" },
  { value: "design",        label: "디자인" },
  { value: "accommodation", label: "숙박" },
  { value: "other",         label: "기타" },
];

const REGIONS = ["창원시", "강남구", "홍대·마포", "수원시", "부산 해운대", "대구 중구"];

// 네이버 AI 브리핑 분류는 lib/userGroup.ts getBriefingEligibility 단일 소스 사용

// ── 업종별 목업 데이터 ────────────────────────────────────────────────
function getMock(category: string, region: string) {
  const benchmarks: Record<string, { avg: number; rank: string }> = {
    restaurant: { avg: 38, rank: "상위 45%" },
    cafe:       { avg: 38, rank: "상위 45%" },
    bakery:     { avg: 38, rank: "상위 45%" },
    bar:        { avg: 38, rank: "상위 45%" },
    beauty:     { avg: 42, rank: "상위 45%" },
    nail:       { avg: 42, rank: "상위 45%" },
    fitness:    { avg: 42, rank: "상위 45%" },
    yoga:       { avg: 42, rank: "상위 45%" },
    medical:    { avg: 45, rank: "상위 40%" },
    pharmacy:   { avg: 45, rank: "상위 40%" },
    legal:      { avg: 51, rank: "상위 35%" },
    realestate: { avg: 51, rank: "상위 35%" },
    education:  { avg: 44, rank: "상위 40%" },
    tutoring:   { avg: 44, rank: "상위 40%" },
    pet:        { avg: 40, rank: "상위 45%" },
    accommodation: { avg: 43, rank: "상위 40%" },
    photo:      { avg: 42, rank: "상위 45%" },
    music:      { avg: 40, rank: "상위 45%" },
  };

  const base = {
    region,
    selectionScore: 55,
    aiMentioned: true,
    isSmartPlace: true,
    isOnKakao: true,
    aiExcerptFail: false,
    geminiRate: 15,
    benchmark: benchmarks[category] ?? benchmarks.restaurant,
    lockedTips: [
      { icon: "🔍", label: "AI 검색 노출 개선 방법",   tip: "Gemini·ChatGPT 각 50회 (총 100회) 반복 측정으로 정확한 노출 확률(%)을 산출하고 플랜에 따라 주 1회(월요일)~매일 자동 추적합니다." },
      { icon: "📊", label: "경쟁사 6개 차원 갭 분석",  tip: "1위 경쟁사 대비 어느 항목이 얼마나 뒤처지는지 정확히 보여줍니다." },
      { icon: "🗺️", label: "업종 시장 순위 확인",      tip: "내 가게가 지역 업종 내 몇 위인지, 상위 몇 %인지 수치로 확인합니다." },
      { icon: "📋", label: "스마트플레이스 소개글 + 블로그 자동 생성", tip: "AI 최적화 소개글과 블로그 포스트 초안을 자동 생성 — 복사 후 스마트플레이스에 붙여넣기만 하면 됩니다. 홈페이지 없어도 OK." },
      { icon: "📢", label: "온라인 언급 늘리기",        tip: "어느 플랫폼에서 언급이 많고 적은지, 경쟁사와 비교해 구체적 행동 가이드를 제공합니다." },
      { icon: "✅", label: "실행 체크리스트 + 재스캔",  tip: "개선 항목을 체크리스트로 진행하고, 완료 후 재스캔으로 효과를 바로 확인합니다." },
    ],
    smartPlaceChecklist: [
      { item: "대표 사진 5장 이상",        impact: "high",   checked: null as null | boolean, reason: "첫인상 결정 — 사진 없으면 클릭 즉시 이탈" },
      { item: "영업시간 (오늘 운영 여부)",  impact: "high",   checked: null as null | boolean, reason: "\"지금 문 열었나?\" — 미등록 시 경쟁 가게로 이동" },
      { item: "메뉴·가격 정보",            impact: "high",   checked: null as null | boolean, reason: "\"얼마야?\" — 가격 모르면 방문 결정 못 함" },
      { item: "전화번호·예약 방법",        impact: "medium", checked: null as null | boolean, reason: "바로 전화/예약 가능해야 선택 확정" },
      { item: "주소·주차 안내",            impact: "medium", checked: null as null | boolean, reason: "\"어떻게 가나?\" — 네이버 지도 연동 필수" },
      { item: "가게 소개 (키워드 포함)",   impact: "medium", checked: null as null | boolean, reason: "AI·검색엔진이 이 글을 읽고 추천 여부 결정" },
      { item: "소개글 Q&A 섹션",          impact: "high",   checked: null as null | boolean, reason: "소개글 안 Q&A는 AI 브리핑 인용 후보 텍스트 — 없으면 AI 추천 가능성 낮음" },
      { item: "최근 리뷰 답글",            impact: "low",    checked: null as null | boolean, reason: "사업주 활동성 신호 — AI가 운영 중으로 인식" },
    ],
    growthStage: {
      stage: "stability",
      stage_label: "안정기",
      score_range: "30~55점",
      focus_message: "기본 등록은 됐습니다. 이제 리뷰 키워드 다양성을 확보할 때입니다. 경쟁사가 보유한 키워드를 내 리뷰에도 받아야 AI 브리핑에 나옵니다.",
      this_week_action: "이번 주 가장 부족한 키워드 1개를 정해 QR 카드를 테이블에 올려두세요",
      do_not_do: "리뷰 이벤트(할인·쿠폰 제공)는 네이버 정책 위반입니다. 자연스러운 부탁 방식만 사용하세요.",
      estimated_weeks_to_next: 6,
    },
  };

  const templates: Record<string, object> = {
    // ── 실제 사업장: 홍스튜디오 (창원시, 출장촬영/웨딩스냅) ──────────────
    photo: {
      businessName: "홍스튜디오",
      query: "창원 웨딩스냅 추천",
      aiExcerpt: "",
      aiExcerptFail: true,
      geminiRate: 0,
      naverRank: 4, blogMentions: 8,
      topCompetitorName: "창원스냅스튜디오", topCompetitorBlogCount: 45,
      naverCompetitors: [
        { rank: 1, name: "창원스냅스튜디오",     address: "창원시 성산구 중앙대로 12",         isMe: false },
        { rank: 2, name: "마산웨딩포토",          address: "창원시 마산회원구 3·15대로 88",     isMe: false },
        { rank: 3, name: "창원셀러브리티스냅",    address: "창원시 의창구 원이대로 45",         isMe: false },
        { rank: 4, name: "홍스튜디오",            address: "창원시 성산구 ○○로 ○○",           isMe: true },
        { rank: 5, name: "경남스냅촬영",          address: "창원시 마산합포구 ○○로",           isMe: false },
      ],
      topBlogs: [
        { title: "창원 웨딩스냅 홍스튜디오 후기", desc: "자연스러운 사진 스타일이 너무 좋았어요...", dateLabel: "2개월 전", isOld: false },
        { title: "돌스냅 추천 창원 홍스튜디오",   desc: "아이 돌잔치 스냅 정말 잘 찍어주셨어요...", dateLabel: "5개월 전", isOld: false },
        { title: "창원 출장촬영 업체 비교",        desc: "홍스튜디오도 비교 대상에 포함됐는데...", dateLabel: "11개월 전", isOld: true },
      ],
      kakaoRank: 4,
      kakaoCompetitors: [
        { rank: 1, name: "창원스냅스튜디오",     isMe: false },
        { rank: 2, name: "마산웨딩포토",          isMe: false },
        { rank: 3, name: "창원셀러브리티스냅",    isMe: false },
        { rank: 4, name: "홍스튜디오",            isMe: true },
      ],
      totalScore: 38, grade: "D", naverChannelScore: 32,
      weakItem: {
        label: "AI 검색 노출", score: 22, icon: "🔍",
        reason: "소개글에 가격·예약·프로세스 정보가 구조화되지 않아 네이버 AI가 \"창원 웨딩스냅 추천\"을 물어봐도 홍스튜디오를 인용 후보로 선택하기 어렵습니다. 소개글 Q&A 섹션 없이는 AI탭 노출 가능성이 낮습니다. ChatGPT·Gemini는 구글 비즈니스 프로필 등록이 핵심입니다.",
        impact: "소개글에 Q&A 3~5개 추가만으로 AI 인용 후보 진입 가능 — 경쟁 스튜디오 중 선점 기회",
      },
      smartPlaceChecklist: [
        { item: "대표 사진 5장 이상",        impact: "high",   checked: true,  reason: "사진 100장 이상 등록 — 강점" },
        { item: "영업시간 (오늘 운영 여부)",  impact: "high",   checked: true,  reason: "영업시간 정상 등록됨" },
        { item: "메뉴·가격 정보",            impact: "high",   checked: false, reason: "가격표·패키지 요금 정보 없음 — 방문 결정 어려움" },
        { item: "전화번호·예약 방법",        impact: "medium", checked: true,  reason: "연락처 등록됨" },
        { item: "주소·주차 안내",            impact: "medium", checked: true,  reason: "주소 등록됨" },
        { item: "가게 소개 (키워드 포함)",   impact: "medium", checked: true,  reason: "소개글 있음 — Q&A 섹션만 추가하면 됩니다" },
        { item: "소개글 Q&A 섹션",          impact: "high",   checked: false, reason: "Q&A 섹션 없음 — AI 브리핑 인용 후보 진입을 막는 핵심 누락 항목" },
        { item: "최근 리뷰 답글",            impact: "low",    checked: true,  reason: "최근 리뷰 답글 있음 — AI가 운영 중으로 인식" },
      ],
      breakdown: {
        exposure_freq:     { label: "AI 검색 노출",    icon: "🔍", score: 22, what: "손님이 AI에 \"창원 웨딩스냅 추천해줘\"라고 물었을 때 홍스튜디오가 답변에 나오는 빈도입니다.", stateMsg: "소개글 Q&A 섹션 없음 — AI가 가게 정보를 인용할 구조화 텍스트가 부족합니다.", isLow: true },
        review_quality:    { label: "리뷰 평판",       icon: "⭐", score: 72, what: "네이버·카카오맵 리뷰 수와 평점입니다.", stateMsg: "리뷰 16건·평점 4.8 — 품질은 좋지만 AI 추천에는 소개글 Q&A 섹션 보강이 더 효과적입니다.", isLow: false },
        schema_score:      { label: "온라인 정보 정리", icon: "📋", score: 45, what: "스마트플레이스 소개글·블로그에 촬영 종류·가격·프로세스가 얼마나 정리돼 있는지입니다.", stateMsg: "소개글은 있지만 Q&A 섹션 없고 블로그 연결이 부족합니다.", isLow: true },
        online_mentions:   { label: "온라인 언급 수",  icon: "📢", score: 28, what: "블로그·SNS에서 홍스튜디오가 언급된 횟수입니다.", stateMsg: "블로그 8건 — 경쟁 1위보다 37건 적습니다.", isLow: true },
        info_completeness: { label: "기본 정보 완성도", icon: "📍", score: 85, what: "영업시간·주소·메뉴·사진 등 기본 정보 등록 여부입니다.", stateMsg: "영업시간·사진 100장·서비스 등록 완료 — 기본 정보는 충실합니다.", isLow: false },
        content_freshness: { label: "최근 활동",       icon: "🗓️", score: 62, what: "가장 최근 리뷰가 얼마나 최근인지입니다.", stateMsg: "최근 리뷰가 있어 현재 운영 중임을 AI가 인식합니다.", isLow: false },
      },
      growthStage: {
        stage: "stability",
        stage_label: "안정기",
        score_range: "30~50점",
        focus_message: "기본 등록은 잘 되어 있습니다. 이제 소개글에 Q&A 섹션 추가가 최우선입니다. AI는 Q&A 형식 정보를 인용 후보로 선호하며, 소개글이 좋아도 Q&A 섹션 없이는 AI 브리핑 노출 가능성이 낮습니다.",
        this_week_action: "소개글 끝에 '자주 묻는 질문' Q&A 3개를 오늘 추가하세요 — \"가격은?\", \"예약 방법은?\", \"위치는?\"",
        do_not_do: "리뷰 이벤트(할인·쿠폰)는 네이버 정책 위반입니다. 자연스러운 방법으로 유도하세요.",
        estimated_weeks_to_next: 4,
      },
    },

    // ── 실제 사업장: 홍뮤직스튜디오작곡교습소 (창원시, 음악학원) ───────────
    music: {
      businessName: "홍뮤직스튜디오작곡교습소",
      query: "창원 작곡학원 추천",
      aiExcerpt: "",
      aiExcerptFail: true,
      geminiRate: 0,
      naverRank: 3, blogMentions: 15,
      topCompetitorName: "창원실용음악학원", topCompetitorBlogCount: 38,
      naverCompetitors: [
        { rank: 1, name: "창원실용음악학원",           address: "창원시 성산구 원이대로 22",     isMe: false },
        { rank: 2, name: "마산음악교습소",             address: "창원시 마산회원구 양덕로 7",    isMe: false },
        { rank: 3, name: "홍뮤직스튜디오작곡교습소",   address: "창원시 ○○구 ○○로",            isMe: true },
        { rank: 4, name: "경남작곡학원",               address: "창원시 의창구 ○○로",           isMe: false },
        { rank: 5, name: "창원녹음스튜디오",           address: "창원시 성산구 ○○로",           isMe: false },
      ],
      topBlogs: [
        { title: "창원 작곡학원 홍뮤직스튜디오 후기",  desc: "선생님이 정말 꼼꼼하게 지도해주셔서 3개월 만에...", dateLabel: "1개월 전",  isOld: false },
        { title: "창원 실용음악 배울 곳 추천",         desc: "홍뮤직스튜디오에서 작곡 배우고 있는데...", dateLabel: "4개월 전",  isOld: false },
        { title: "창원 녹음스튜디오 비교",             desc: "홍뮤직 포함 5곳 비교했는데 정보가 좀 오래됐어요...", dateLabel: "13개월 전", isOld: true },
      ],
      kakaoRank: 3,
      kakaoCompetitors: [
        { rank: 1, name: "창원실용음악학원",           isMe: false },
        { rank: 2, name: "마산음악교습소",             isMe: false },
        { rank: 3, name: "홍뮤직스튜디오작곡교습소",   isMe: true },
      ],
      totalScore: 45, grade: "D", naverChannelScore: 40,
      weakItem: {
        label: "AI 검색 노출", score: 25, icon: "🔍",
        reason: "소개글에 커리큘럼·비용·대상 정보가 구조화되지 않아 AI가 \"창원 작곡학원 추천\"을 물어봐도 홍뮤직스튜디오를 인용 후보로 선택하기 어렵습니다. 리뷰 48건·평점 4.8이 있어도 소개글 Q&A 섹션 없이는 AI 브리핑 노출 가능성이 낮습니다.",
        impact: "소개글에 \"수강 커리큘럼·녹음 비용·초보 가능 여부\" Q&A 5개만 추가하면 AI 조건 검색 후보 진입 가능",
      },
      smartPlaceChecklist: [
        { item: "대표 사진 5장 이상",        impact: "high",   checked: true,  reason: "사진 100장 이상 등록 — 강점" },
        { item: "영업시간 (오늘 운영 여부)",  impact: "high",   checked: true,  reason: "영업시간 정상 등록됨" },
        { item: "메뉴·가격 정보",            impact: "high",   checked: false, reason: "수강료·패키지 요금 정보 없음 — 등록 시 방문 결정률 상승" },
        { item: "전화번호·예약 방법",        impact: "medium", checked: true,  reason: "연락처 등록됨" },
        { item: "주소·주차 안내",            impact: "medium", checked: true,  reason: "주소 등록됨" },
        { item: "가게 소개 (키워드 포함)",   impact: "medium", checked: true,  reason: "소개글 있음 — Q&A 섹션 추가하면 AI 최적화 완성" },
        { item: "소개글 Q&A 섹션",          impact: "high",   checked: false, reason: "Q&A 섹션 없음 — AI 브리핑 인용 후보 진입을 막는 핵심 누락 항목" },
        { item: "최근 리뷰 답글",            impact: "low",    checked: true,  reason: "리뷰 48건 답글 있음 — AI가 운영 중으로 인식" },
      ],
      breakdown: {
        exposure_freq:     { label: "AI 검색 노출",    icon: "🔍", score: 25, what: "손님이 AI에 \"창원 작곡학원 추천해줘\"라고 물었을 때 나오는 빈도입니다.", stateMsg: "소개글 Q&A 섹션 없음 — 리뷰 48건이 있어도 AI가 인용할 구조화 텍스트가 부족합니다.", isLow: true },
        review_quality:    { label: "리뷰 평판",       icon: "⭐", score: 78, what: "네이버·카카오맵 리뷰 수와 평점입니다.", stateMsg: "리뷰 48건·평점 4.8 — 경쟁사 대비 가장 강한 항목입니다.", isLow: false },
        schema_score:      { label: "온라인 정보 정리", icon: "📋", score: 48, what: "스마트플레이스 소개글·블로그에 커리큘럼·비용·대상이 얼마나 정리돼 있는지입니다.", stateMsg: "소개글은 있지만 Q&A 섹션이 없어 AI가 커리큘럼·가격 정보를 찾기 어렵습니다.", isLow: true },
        online_mentions:   { label: "온라인 언급 수",  icon: "📢", score: 40, what: "블로그·카페에서 홍뮤직스튜디오가 언급된 횟수입니다.", stateMsg: "블로그 15건 — 경쟁 1위보다 23건 적습니다.", isLow: false },
        info_completeness: { label: "기본 정보 완성도", icon: "📍", score: 88, what: "영업시간·주소·메뉴·사진 등 기본 정보 등록 여부입니다.", stateMsg: "영업시간·사진 100장·서비스 등록 완료 — 기본 정보 최고 수준입니다.", isLow: false },
        content_freshness: { label: "최근 활동",       icon: "🗓️", score: 65, what: "가장 최근 리뷰가 얼마나 최근인지입니다.", stateMsg: "최근 리뷰가 있어 현재 운영 중임을 AI가 인식합니다.", isLow: false },
      },
      growthStage: {
        stage: "stability",
        stage_label: "안정기",
        score_range: "30~50점",
        focus_message: "기본 등록은 잘 되어 있습니다. 이제 소개글에 Q&A 섹션 추가가 최우선입니다. AI는 Q&A 형식 정보를 인용 후보로 선호하며, Q&A 섹션 없이는 AI 브리핑 노출 가능성이 낮습니다.",
        this_week_action: "소개글 끝에 '자주 묻는 질문' Q&A 3개를 오늘 추가하세요 — \"수강 가격은?\", \"초보도 가능한가요?\", \"녹음실 이용 방법은?\"",
        do_not_do: "리뷰 이벤트(할인·쿠폰)는 네이버 정책 위반입니다. 자연스러운 방법으로 유도하세요.",
        estimated_weeks_to_next: 4,
      },
    },

    // ── 기존 템플릿 유지 ────────────────────────────────────────────────
    restaurant: {
      businessName: `${region} 왕갈비 한우마당`,
      query: `${region} 한우 맛집 추천`,
      aiExcerpt: `${region}에서 한우를 찾는다면 '${region} 왕갈비 한우마당'이 자주 언급됩니다. 신선한 국내산 한우와 넓은 주차공간으로 가족 외식에 적합합니다.`,
      naverRank: 3, blogMentions: 24,
      geminiRate: 23,
      topCompetitorName: `${region} 한우촌`, topCompetitorBlogCount: 87,
      naverCompetitors: [
        { rank: 1, name: `${region} 한우촌`,          address: `${region} 행궁로 12`,   isMe: false },
        { rank: 2, name: `${region} 갈비골목`,         address: `${region} 정조로 45`,   isMe: false },
        { rank: 3, name: `${region} 왕갈비 한우마당`,  address: `${region} 화서문로 88`, isMe: true  },
        { rank: 4, name: `${region} 정통 한우 명가`,   address: `${region} 남문로 7`,    isMe: false },
        { rank: 5, name: `${region} 특미관`,           address: `${region} 북수동 113`,  isMe: false },
      ],
      topBlogs: [
        { title: `${region} 한우 맛집 솔직 후기`, desc: "가족끼리 갔는데 고기 질이 정말 좋았어요...", dateLabel: "2개월 전", isOld: false },
        { title: `[${region}] 한우마당 주차 넓고 가성비 좋음`, desc: "주차 걱정 없어서 자주 오게 되는 곳...", dateLabel: "4개월 전", isOld: false },
        { title: `${region} 한우 단체 회식 후기`, desc: "회사 회식으로 갔는데 직원들이 다 만족...", dateLabel: "7개월 전", isOld: true },
      ],
      kakaoRank: 2,
      kakaoCompetitors: [
        { rank: 1, name: `${region} 한우촌`,         isMe: false },
        { rank: 2, name: `${region} 왕갈비 한우마당`, isMe: true },
        { rank: 3, name: `${region} 갈비골목`,        isMe: false },
      ],
      totalScore: 62, grade: "C", naverChannelScore: 48,
      weakItem: { label: "온라인 정보 정리", score: 45, icon: "📋",
        reason: "스마트플레이스 소개글에 키워드가 부족하고 블로그 포스트가 없어 네이버 AI탭 인용 가능성이 낮습니다. ChatGPT·Gemini는 구글 비즈니스 프로필 등록이 핵심입니다.",
        impact: "스마트플레이스 소개글 최적화 + 블로그 포스트 1건으로 이 항목 개선 시작 가능" },
      breakdown: {
        exposure_freq:     { label: "AI 검색 노출",     icon: "🔍", score: 58, what: "손님이 AI에 '맛집 추천해줘' 라고 물어봤을 때 내 가게가 답변에 나오는 빈도입니다.", stateMsg: "이번 1회 검색에서 AI가 내 가게를 언급했습니다.", isLow: false },
        review_quality:    { label: "리뷰 평판",        icon: "⭐", score: 72, what: "네이버·카카오맵에 등록된 리뷰 수와 평점입니다.", stateMsg: "리뷰와 평점이 충분해 AI가 신뢰할 수 있는 가게로 인식합니다.", isLow: false },
        schema_score:      { label: "온라인 정보 정리", icon: "📋", score: 45, what: "스마트플레이스 소개글과 블로그 포스트에 영업시간·메뉴·특징 등이 얼마나 잘 정리돼 있는지입니다.", stateMsg: "스마트플레이스 소개글이 짧고 블로그 연결이 없어 글로벌 AI가 가게 정보를 충분히 학습하지 못했습니다.", isLow: true },
        online_mentions:   { label: "온라인 언급 수",   icon: "📢", score: 61, what: "블로그·SNS·카페 등에서 내 가게가 언급된 횟수입니다.", stateMsg: "블로그 언급 24건 — 경쟁 1위보다 63건 적습니다.", isLow: false },
        info_completeness: { label: "기본 정보 완성도", icon: "📍", score: 80, what: "전화번호·주소·영업시간·메뉴판 등 기본 정보가 얼마나 등록되어 있는지입니다.", stateMsg: "기본 정보가 모두 잘 등록되어 있습니다.", isLow: false },
        content_freshness: { label: "최근 활동",        icon: "🗓️", score: 55, what: "가장 최근 리뷰나 게시글이 얼마나 최근인지입니다.", stateMsg: "최근 30일 내 새 리뷰가 있어 AI가 현재 운영 중임을 인식합니다.", isLow: false },
      },
    },
    cafe: {
      businessName: `${region} 감성카페 온`,
      query: `${region} 분위기 좋은 카페 추천`,
      aiExcerpt: `${region}에서 감성 카페를 찾는다면 '${region} 감성카페 온'이 추천됩니다. 조용한 분위기와 수제 음료가 특징이며 작업하기 좋은 공간입니다.`,
      naverRank: 4, blogMentions: 18,
      geminiRate: 18,
      topCompetitorName: `${region} 카페 루나`, topCompetitorBlogCount: 112,
      naverCompetitors: [
        { rank: 1, name: `${region} 카페 루나`,      address: `${region} 홍익로 5`,    isMe: false },
        { rank: 2, name: `${region} 달달커피`,       address: `${region} 서교동 22`,   isMe: false },
        { rank: 3, name: `${region} 루프탑 88`,      address: `${region} 양화로 88`,   isMe: false },
        { rank: 4, name: `${region} 감성카페 온`,    address: `${region} 동교동 14`,   isMe: true  },
        { rank: 5, name: `${region} 노마드 스튜디오`, address: `${region} 연남동 7`,    isMe: false },
      ],
      topBlogs: [
        { title: `${region} 감성카페 온 방문기`, desc: "인테리어가 너무 예쁘고 음료도 맛있어요...", dateLabel: "1개월 전", isOld: false },
        { title: `[${region}] 혼카페하기 좋은 곳`, desc: "와이파이도 빠르고 콘센트도 많아요...", dateLabel: "5개월 전", isOld: false },
        { title: `${region} 작업카페 총정리`, desc: "온 카페도 포함됐는데 조금 오래된 정보...", dateLabel: "11개월 전", isOld: true },
      ],
      kakaoRank: 3,
      kakaoCompetitors: [
        { rank: 1, name: `${region} 카페 루나`,   isMe: false },
        { rank: 2, name: `${region} 달달커피`,    isMe: false },
        { rank: 3, name: `${region} 감성카페 온`, isMe: true },
      ],
      totalScore: 55, grade: "C", naverChannelScore: 42,
      weakItem: { label: "최근 활동", score: 38, icon: "🗓️",
        reason: "최근 3개월간 새 리뷰나 게시물이 없어 AI가 현재 운영 중인지 불확실하게 인식합니다.",
        impact: "스마트플레이스 '소식' 탭 업데이트만으로 이 항목 즉시 개선 시작 가능" },
      breakdown: {
        exposure_freq:     { label: "AI 검색 노출",     icon: "🔍", score: 51, what: "손님이 AI에 '카페 추천해줘' 라고 물어봤을 때 내 가게가 답변에 나오는 빈도입니다.", stateMsg: "이번 1회 검색에서 AI가 내 카페를 언급했습니다.", isLow: false },
        review_quality:    { label: "리뷰 평판",        icon: "⭐", score: 65, what: "카카오맵·네이버에 등록된 리뷰 수와 평점입니다.", stateMsg: "평점은 양호하지만 경쟁 카페보다 건수가 부족합니다.", isLow: false },
        schema_score:      { label: "온라인 정보 정리", icon: "📋", score: 50, what: "스마트플레이스 소개글과 블로그에 메뉴·분위기·위치 정보가 얼마나 잘 정리돼 있는지입니다.", stateMsg: "스마트플레이스 소개글이 있지만 메뉴 정보와 키워드가 부족합니다.", isLow: true },
        online_mentions:   { label: "온라인 언급 수",   icon: "📢", score: 55, what: "블로그·SNS에서 내 카페가 언급된 횟수입니다.", stateMsg: "블로그 18건 — 경쟁 1위 카페보다 94건 적습니다.", isLow: false },
        info_completeness: { label: "기본 정보 완성도", icon: "📍", score: 75, what: "전화번호·주소·영업시간·메뉴판 등 기본 정보 등록 여부입니다.", stateMsg: "대부분의 기본 정보가 등록되어 있습니다.", isLow: false },
        content_freshness: { label: "최근 활동",        icon: "🗓️", score: 38, what: "가장 최근 리뷰나 게시글이 얼마나 최근인지입니다.", stateMsg: "3개월 이상 새 리뷰·게시물이 없어 AI가 폐업 가능성으로 인식합니다.", isLow: true },
      },
    },
    beauty: {
      businessName: `${region} 헤어샵 블랑`,
      query: `${region} 잘하는 미용실 추천`,
      aiExcerpt: `${region}에서 미용실을 찾는다면 '${region} 헤어샵 블랑'이 언급됩니다. 꼼꼼한 상담과 트렌디한 스타일링으로 단골 고객이 많습니다.`,
      naverRank: 5, blogMentions: 12,
      geminiRate: 8,
      topCompetitorName: `${region} 살롱드파리`, topCompetitorBlogCount: 68,
      naverCompetitors: [
        { rank: 1, name: `${region} 살롱드파리`,  address: `${region} 가로수길 3`,  isMe: false },
        { rank: 2, name: `${region} 헤어클리닉`,  address: `${region} 신사동 14`,   isMe: false },
        { rank: 3, name: `${region} 모던커트`,    address: `${region} 압구정로 55`, isMe: false },
        { rank: 4, name: `${region} 뷰티스튜디오`, address: `${region} 청담동 7`,   isMe: false },
        { rank: 5, name: `${region} 헤어샵 블랑`, address: `${region} 논현동 23`,  isMe: true  },
      ],
      topBlogs: [
        { title: `${region} 미용실 후기 — 블랑 헤어샵`, desc: "원장님이 정말 꼼꼼하게 상담해주세요...", dateLabel: "3개월 전", isOld: false },
        { title: `[${region}] 염색 잘하는 미용실 찾았다`, desc: "블리치 후 톤다운인데 손상이 거의 없어요...", dateLabel: "6개월 전", isOld: false },
        { title: `${region} 미용실 추천 리스트`, desc: "블랑도 있는데 내용이 좀 오래됐네요...", dateLabel: "14개월 전", isOld: true },
      ],
      kakaoRank: 4,
      kakaoCompetitors: [
        { rank: 1, name: `${region} 살롱드파리`,  isMe: false },
        { rank: 2, name: `${region} 헤어클리닉`,  isMe: false },
        { rank: 3, name: `${region} 모던커트`,    isMe: false },
        { rank: 4, name: `${region} 헤어샵 블랑`, isMe: true },
      ],
      totalScore: 51, grade: "D", naverChannelScore: 40,
      weakItem: { label: "AI 검색 노출", score: 35, icon: "🔍",
        reason: "미용실 업종은 AI 검색 추천이 빠르게 확산 중입니다. 지금 선점하면 경쟁 우위를 가져갈 수 있습니다.",
        impact: "블로그 후기에 시술 키워드를 추가하면 AI 조건 검색 노출 시작 가능 — 현재 선점 기회" },
      breakdown: {
        exposure_freq:     { label: "AI 검색 노출",     icon: "🔍", score: 35, what: "손님이 AI에 '미용실 추천해줘' 라고 물어봤을 때 내 가게가 답변에 나오는 빈도입니다.", stateMsg: "이번 1회 검색에서 AI가 내 미용실을 언급하지 않았습니다.", isLow: true },
        review_quality:    { label: "리뷰 평판",        icon: "⭐", score: 68, what: "네이버·카카오맵에 등록된 리뷰 수와 평점입니다.", stateMsg: "평점은 좋지만 리뷰 수가 경쟁사 대비 적습니다.", isLow: false },
        schema_score:      { label: "온라인 정보 정리", icon: "📋", score: 48, what: "스마트플레이스 소개글과 블로그에 시술 메뉴·가격·특징이 얼마나 잘 정리돼 있는지입니다.", stateMsg: "스마트플레이스에 시술 메뉴와 가격이 없어 AI가 추천하기 어렵습니다.", isLow: true },
        online_mentions:   { label: "온라인 언급 수",   icon: "📢", score: 52, what: "블로그·인스타그램에서 내 가게가 언급된 횟수입니다.", stateMsg: "블로그 12건 — 경쟁 1위보다 56건 적습니다.", isLow: false },
        info_completeness: { label: "기본 정보 완성도", icon: "📍", score: 72, what: "전화번호·주소·영업시간·메뉴판 등 기본 정보 등록 여부입니다.", stateMsg: "기본 정보는 잘 등록되어 있습니다.", isLow: false },
        content_freshness: { label: "최근 활동",        icon: "🗓️", score: 58, what: "가장 최근 리뷰나 게시글이 얼마나 최근인지입니다.", stateMsg: "최근 2개월 내 새 리뷰가 있어 운영 중으로 인식됩니다.", isLow: false },
      },
    },
    education: {
      businessName: `${region} 영어학원 제일`,
      query: `${region} 영어학원 추천`,
      aiExcerpt: `${region}에서 영어학원을 찾는다면 '${region} 영어학원 제일'이 자주 추천됩니다. 원어민 강사와 소규모 수업으로 실력 향상에 집중합니다.`,
      naverRank: 3, blogMentions: 9,
      geminiRate: 21,
      topCompetitorName: `${region} 어학원`, topCompetitorBlogCount: 45,
      naverCompetitors: [
        { rank: 1, name: `${region} 어학원`,        address: `${region} 학원로 1`,   isMe: false },
        { rank: 2, name: `${region} 영어클럽`,      address: `${region} 교육로 22`,  isMe: false },
        { rank: 3, name: `${region} 영어학원 제일`, address: `${region} 성장로 7`,   isMe: true  },
        { rank: 4, name: `${region} 스마트영어`,    address: `${region} 독서로 14`,  isMe: false },
        { rank: 5, name: `${region} 리딩클래스`,    address: `${region} 지식로 3`,   isMe: false },
      ],
      topBlogs: [
        { title: `${region} 영어학원 후기 — 제일학원`, desc: "아이 영어 실력이 3개월 만에 확연히 늘었어요...", dateLabel: "2개월 전", isOld: false },
        { title: `[초등 영어] ${region} 학원 비교`, desc: "제일학원도 비교 대상에 포함했는데...", dateLabel: "5개월 전", isOld: false },
        { title: `${region} 영어학원 총정리`, desc: "제일학원 내용이 포함됐지만 구 정보...", dateLabel: "18개월 전", isOld: true },
      ],
      kakaoRank: 3,
      kakaoCompetitors: [
        { rank: 1, name: `${region} 어학원`,        isMe: false },
        { rank: 2, name: `${region} 영어클럽`,      isMe: false },
        { rank: 3, name: `${region} 영어학원 제일`, isMe: true },
      ],
      totalScore: 58, grade: "C", naverChannelScore: 44,
      weakItem: { label: "온라인 언급 수", score: 38, icon: "📢",
        reason: "블로그·카페에서 학원 후기가 부족해 AI가 신뢰도를 낮게 평가합니다. 학부모 후기가 핵심입니다.",
        impact: "학부모 후기가 쌓일수록 AI가 학원 정보를 신뢰할 수 있는 정보로 인식해 추천 빈도가 높아집니다" },
      breakdown: {
        exposure_freq:     { label: "AI 검색 노출",     icon: "🔍", score: 55, what: "학부모가 AI에 '영어학원 추천해줘' 라고 물어봤을 때 내 학원이 답변에 나오는 빈도입니다.", stateMsg: "이번 1회 검색에서 AI가 내 학원을 언급했습니다.", isLow: false },
        review_quality:    { label: "리뷰 평판",        icon: "⭐", score: 63, what: "네이버·카카오맵에 등록된 학부모 리뷰 수와 평점입니다.", stateMsg: "평점이 양호하지만 후기 수가 더 필요합니다.", isLow: false },
        schema_score:      { label: "온라인 정보 정리", icon: "📋", score: 52, what: "스마트플레이스 소개글과 블로그에 커리큘럼·수업료·특징이 얼마나 잘 정리돼 있는지입니다.", stateMsg: "기본 정보는 있으나 수업 커리큘럼과 특장점 설명이 부족합니다.", isLow: true },
        online_mentions:   { label: "온라인 언급 수",   icon: "📢", score: 38, what: "네이버 카페·블로그에서 내 학원이 언급된 횟수입니다.", stateMsg: "블로그 9건 — 경쟁 1위 학원보다 36건 적습니다.", isLow: true },
        info_completeness: { label: "기본 정보 완성도", icon: "📍", score: 78, what: "전화번호·주소·영업시간·커리큘럼 등 기본 정보 등록 여부입니다.", stateMsg: "기본 정보가 잘 등록되어 있습니다.", isLow: false },
        content_freshness: { label: "최근 활동",        icon: "🗓️", score: 60, what: "가장 최근 리뷰나 게시글이 얼마나 최근인지입니다.", stateMsg: "최근 2개월 내 후기가 있어 운영 중으로 인식됩니다.", isLow: false },
      },
    },
    medical: {
      businessName: `${region} 든든 한의원`,
      query: `${region} 한의원 추천`,
      aiExcerpt: `${region}에서 한의원을 찾는다면 '${region} 든든 한의원'이 추천됩니다. 허리 통증과 소화기 질환에 전문화되어 있으며 예약제로 운영됩니다.`,
      naverRank: 2, blogMentions: 15,
      geminiRate: 28,
      topCompetitorName: `${region} 으뜸 한의원`, topCompetitorBlogCount: 53,
      naverCompetitors: [
        { rank: 1, name: `${region} 으뜸 한의원`, address: `${region} 건강로 5`,   isMe: false },
        { rank: 2, name: `${region} 든든 한의원`, address: `${region} 치료로 12`,  isMe: true  },
        { rank: 3, name: `${region} 통증클리닉`,  address: `${region} 의료로 7`,   isMe: false },
        { rank: 4, name: `${region} 자연치료원`,  address: `${region} 한방로 33`,  isMe: false },
        { rank: 5, name: `${region} 웰빙한의원`,  address: `${region} 체력로 2`,   isMe: false },
      ],
      topBlogs: [
        { title: `${region} 한의원 후기 — 든든 방문`, desc: "오래된 허리 통증이 5회 치료 후 나아졌어요...", dateLabel: "1개월 전", isOld: false },
        { title: `[${region}] 소화불량 한의원 찾기`, desc: "든든 한의원 친절하고 효과 있었습니다...", dateLabel: "4개월 전", isOld: false },
        { title: `${region} 한의원 가격 비교`, desc: "든든 한의원 포함됐지만 최신 정보 아닐 수 있음...", dateLabel: "22개월 전", isOld: true },
      ],
      kakaoRank: 2,
      kakaoCompetitors: [
        { rank: 1, name: `${region} 으뜸 한의원`, isMe: false },
        { rank: 2, name: `${region} 든든 한의원`, isMe: true },
        { rank: 3, name: `${region} 통증클리닉`,  isMe: false },
      ],
      totalScore: 64, grade: "C", naverChannelScore: 52,
      weakItem: { label: "리뷰 평판", score: 42, icon: "⭐",
        reason: "리뷰 수가 경쟁 한의원 대비 적고 영수증 리뷰(방문 인증)가 없어 AI 신뢰도 점수가 낮습니다.",
        impact: "영수증 리뷰(방문 인증)가 쌓이면 AI가 실제 방문 경험이 있는 가게로 인식해 신뢰도 점수가 개선됩니다" },
      breakdown: {
        exposure_freq:     { label: "AI 검색 노출",     icon: "🔍", score: 62, what: "환자가 AI에 '한의원 추천해줘' 라고 물어봤을 때 내 병원이 답변에 나오는 빈도입니다.", stateMsg: "이번 1회 검색에서 AI가 내 한의원을 언급했습니다.", isLow: false },
        review_quality:    { label: "리뷰 평판",        icon: "⭐", score: 42, what: "네이버·카카오맵에 등록된 리뷰 수와 영수증 리뷰 비율입니다.", stateMsg: "리뷰 수가 적고 영수증 리뷰(방문 인증)가 없어 AI 신뢰도가 낮습니다.", isLow: true },
        schema_score:      { label: "온라인 정보 정리", icon: "📋", score: 58, what: "스마트플레이스 소개글과 블로그에 진료 항목·예약방법·전문 분야가 얼마나 잘 정리돼 있는지입니다.", stateMsg: "기본 정보는 있으나 진료 항목 상세 설명이 부족합니다.", isLow: false },
        online_mentions:   { label: "온라인 언급 수",   icon: "📢", score: 65, what: "블로그·건강 카페에서 내 병원이 언급된 횟수입니다.", stateMsg: "블로그 15건 — 평균 수준입니다.", isLow: false },
        info_completeness: { label: "기본 정보 완성도", icon: "📍", score: 82, what: "전화번호·주소·진료시간·예약 방법 등 기본 정보 등록 여부입니다.", stateMsg: "기본 정보가 모두 잘 등록되어 있습니다.", isLow: false },
        content_freshness: { label: "최근 활동",        icon: "🗓️", score: 60, what: "가장 최근 리뷰나 게시글이 얼마나 최근인지입니다.", stateMsg: "최근 1개월 내 새 리뷰가 있어 운영 중으로 인식됩니다.", isLow: false },
      },
    },
  };

  const tpl = templates[category] ?? templates.restaurant;
  return { ...base, ...tpl };
}

// ── 타입 ─────────────────────────────────────────────────────────────
type BreakdownItem = { label: string; icon: string; score: number; what: string; stateMsg: string; isLow: boolean };
type Mock = ReturnType<typeof getMock>;

export default function DemoPage() {
  const [category, setCategory] = useState("photo");
  const [region, setRegion]     = useState("창원시");
  const m = getMock(category, region) as Mock & {
    businessName: string; query: string; aiExcerpt: string; aiExcerptFail: boolean;
    naverRank: number; blogMentions: number;
    topCompetitorName: string; topCompetitorBlogCount: number;
    naverCompetitors: { rank: number; name: string; address: string; isMe: boolean }[];
    topBlogs: { title: string; desc: string; dateLabel: string; isOld: boolean }[];
    kakaoRank: number;
    kakaoCompetitors: { rank: number; name: string; isMe: boolean }[];
    totalScore: number; grade: string; naverChannelScore: number;
    weakItem: { label: string; score: number; icon: string; reason: string; impact: string };
    breakdown: Record<string, BreakdownItem>;
    geminiRate: number;
    benchmark: { avg: number; rank: string };
    growthStage: { stage: string; stage_label: string; score_range: string; focus_message: string; this_week_action: string; do_not_do: string; estimated_weeks_to_next?: number };
  };

  const gs = m.growthStage;

  // 실제 사업장 여부 (photo·music은 창원시 실제 사업장 데이터)
  const isRealBiz = category === "photo" || category === "music";

  // 네이버 AI 브리핑 노출 상태 (단일 소스 헬퍼 사용)
  const briefingStatus = getBriefingEligibility(category);

  // ── 종합 결론 히어로 (대시보드 HeroCard 구조 복제) ──────────────────────
  // 네이버 검색 타일: demo는 키워드 커버리지 대신 지역검색 순위(실측 신호)로 표시
  const naverSeoDemoTile: ChannelTile = m.naverRank
    ? makeTile("naver-seo", "네이버 검색", "good", "노출 중", `지역검색 ${m.naverRank}위`)
    : makeTile("naver-seo", "네이버 검색", "pending", "확인 필요", "검색 노출 미확인");
  // AI탭은 demo에서 측정하지 않음 → "준비 중" (정식 공개 후 측정)
  const heroTiles: ChannelTile[] = briefingStatus === "inactive"
    ? [naverSeoDemoTile, aiTabTile(null), rankTile({ myRank: m.naverRank, totalCompetitors: m.naverCompetitors.length })]
    : [naverSeoDemoTile, aiTabTile(null), briefingTile({ eligibility: briefingStatus, inBriefing: false })];
  const heroEvidence = `경쟁 ${m.naverCompetitors.length}곳 중 ${m.naverRank}위 · 블로그 ${m.blogMentions}건`;

  // ── 항목별 분석을 채널 구조로 재배치 (대시보드 채널 taxonomy) ────────────────
  // 6차원 데이터는 그대로 유지하고 렌더 그룹만 채널별로 묶는다.
  const NAVER_SEARCH_KEYS = ["review_quality", "info_completeness", "content_freshness"];
  const GLOBAL_KEYS = ["exposure_freq", "schema_score", "online_mentions"];
  const pickItems = (keys: string[]) =>
    keys.filter((k) => m.breakdown[k]).map((k) => [k, m.breakdown[k]] as [string, BreakdownItem]);
  const naverSearchItems = pickItems(NAVER_SEARCH_KEYS);
  const globalItems = pickItems(GLOBAL_KEYS);
  const briefingNote =
    briefingStatus === "active"
      ? "네이버 AI 브리핑 대상 업종 — 소개글 Q&A·소식·리뷰를 보강하면 브리핑 인용 후보에 진입합니다 (업데이트 후 2~4주)."
      : briefingStatus === "likely"
      ? "네이버 AI 브리핑 확대 예정 업종 — 지금 준비해두면 확대 시 바로 유리합니다."
      : "이 업종은 네이버 AI 브리핑 비대상입니다. 네이버 일반검색·AI탭 노출에 집중하세요.";

  type ChannelDef = { icon: string; label: string; border: string; items?: [string, BreakdownItem][]; note?: string };
  const channelDefs: Record<string, ChannelDef> = {
    briefing:    { icon: "✨", label: "네이버 AI 브리핑", border: "border-purple-400", note: briefingNote },
    naverSearch: { icon: "🔍", label: "네이버 일반검색", border: "border-green-400", items: naverSearchItems },
    aitab:       { icon: "🤖", label: "네이버 AI탭", border: "border-blue-400", note: "네이버 AI탭은 모든 업종 대상(2026-04 베타 오픈, 확대 중). 소개글·리뷰 키워드를 보강하면 AI탭 답변 후보에 들어갑니다." },
    global:      { icon: "🌐", label: "글로벌 AI (ChatGPT·Gemini)", border: "border-slate-400", items: globalItems },
  };
  // 업종그룹 순서분기 — 대시보드 InsightZone과 동일
  const channelOrder: string[] = briefingStatus === "inactive"
    ? ["naverSearch", "aitab", "global", "briefing"]
    : ["briefing", "naverSearch", "aitab", "global"];

  // 항목 1개 렌더 (기존 6차원 행 마크업 재사용)
  const renderBreakdownRow = ([key, item]: [string, BreakdownItem]) => (
    <div key={key} className="py-3 first:pt-0 last:pb-0 border-b border-gray-50 last:border-0">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${item.isLow ? "bg-amber-400" : "bg-green-500"}`} />
          <span className="text-sm md:text-base font-semibold text-gray-800">{item.icon} {item.label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold px-2.5 py-1 rounded-full ${item.isLow ? "bg-amber-50 text-amber-700" : "bg-green-50 text-green-700"}`}>
            {item.isLow ? "⚠ 개선 필요" : "✓ 양호"}
          </span>
          {key === "exposure_freq" && (
            <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${m.geminiRate === 0 ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"}`}>
              {m.geminiRate === 0 ? "AI 미노출" : `AI노출 ${m.geminiRate}%`}
            </span>
          )}
        </div>
      </div>
      {/* 바 그래프 (숫자 미표시) */}
      <div className="flex items-center gap-3 mb-2">
        <div className="flex-1 bg-gray-100 rounded-full h-2">
          <div
            className={`h-2 rounded-full ${item.isLow ? "bg-amber-400" : "bg-green-500"}`}
            style={{ width: `${item.score}%` }}
          />
        </div>
      </div>
      <p className="text-sm md:text-base text-gray-500 leading-relaxed">{item.what}</p>
      <p className={`text-sm md:text-base mt-1 font-medium leading-relaxed ${item.isLow ? "text-amber-600" : "text-green-600"}`}>
        {item.stateMsg}
      </p>
    </div>
  );

  return (
    <main className="min-h-screen bg-gray-50">

      {/* ── 헤더 ─────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-100 px-4 md:px-8 py-3 md:py-4 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-xl md:text-2xl font-bold text-blue-600">AEOlab</Link>
          <div className="flex items-center gap-2 md:gap-3">
            {isRealBiz ? (
              <span className="hidden sm:inline text-sm bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-medium">실제 사업장 진단 예시</span>
            ) : (
              <span className="hidden sm:inline text-sm bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full font-medium">샘플 결과 화면</span>
            )}
            <Link
              href="/trial"
              className="text-sm md:text-base bg-blue-600 text-white px-3 md:px-5 py-1.5 md:py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors whitespace-nowrap"
            >
              내 가게 무료 진단 →
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto py-5 md:py-8 px-4 md:px-8 space-y-5 md:space-y-6">

        {/* ── 실제 사업장 강조 배너 (photo 선택 시) ──────────── */}
        {isRealBiz && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
            <p className="text-sm md:text-base font-semibold text-blue-800">
              실제 사업장 진단 예시
            </p>
            <p className="text-sm text-blue-700 mt-0.5 leading-relaxed">
              {category === "photo"
                ? "홍스튜디오(창원 웨딩스냅)의 실제 스마트플레이스 데이터 기반입니다."
                : "홍뮤직스튜디오작곡교습소(창원 음악학원)의 실제 스마트플레이스 데이터 기반입니다."}
              {" "}리뷰 수·블로그 언급·소개글 Q&A 섹션 여부 등 실제로 수집된 정보입니다.
            </p>
          </div>
        )}

        {/* ── 소상공인 네이버 핵심 가치 제안 ── */}
        <div className="px-1">
          <p className="text-base md:text-xl font-bold text-gray-800 leading-snug">
            내 가게 네이버 플레이스 순위, 경쟁사와 비교해 정확히 확인하세요
          </p>
          <p className="text-sm md:text-base text-gray-500 mt-1.5 leading-relaxed">
            스마트플레이스 개선이 네이버 검색 상위 노출로 이어집니다. 어느 채널을, 얼마나 빠르게 올릴 수 있는지 채널별로 안내합니다.
          </p>
        </div>

        {/* ── 업종·지역 선택기 (전체 너비) ──────────────── */}
        <div className="bg-white rounded-xl shadow-sm px-4 md:px-6 py-4 md:py-5">
          <p className="text-sm md:text-base font-semibold text-gray-600 mb-3 md:mb-4">내 업종과 지역을 선택하면 비슷한 예시를 보여드립니다</p>

          <div className="mb-3 md:mb-4">
            <p className="text-sm font-medium text-gray-500 mb-2">업종</p>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setCategory(c.value)}
                  className={`text-sm md:text-base px-3 md:px-4 py-1.5 md:py-2 rounded-full border font-medium transition-colors ${
                    category === c.value
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
                  }`}
                >
                  {c.label}
                  {(c.value === "photo" || c.value === "music") && (
                    <span className="ml-1 text-sm text-blue-400 font-normal">실사례</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-500 mb-2">지역</p>
            <div className="flex flex-wrap gap-2">
              {REGIONS.map((r) => (
                <button
                  key={r}
                  onClick={() => setRegion(r)}
                  className={`text-sm md:text-base px-3 md:px-4 py-1.5 md:py-2 rounded-full border font-medium transition-colors ${
                    region === r
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <p className="text-sm text-gray-500 mt-3 leading-relaxed">
            {isRealBiz
              ? "※ 사진/영상 업종은 창원시 실제 사업장 데이터입니다. 다른 업종은 예시 데이터입니다."
              : "※ 아래 내용은 예시 데이터입니다. 실제 결과는 내 가게 진단 후 확인하세요."}
          </p>
        </div>

        {/* ── 네이버 AI 브리핑 비대상 업종 상단 안내 배너 ── */}
        {briefingStatus === "inactive" && (
          <div className="rounded-xl border border-slate-200 bg-white px-4 md:px-5 py-4 space-y-3">
            {/* 상단: 비대상 안내 */}
            <div className="flex items-start gap-3">
              <span className="text-xl shrink-0 mt-0.5">ℹ️</span>
              <div>
                <p className="text-base font-bold text-slate-800 mb-1">
                  {CATEGORIES.find(c => c.value === category)?.label} 업종은 현재 네이버 AI 브리핑 비대상입니다
                </p>
                <p className="text-sm md:text-base text-slate-600 leading-relaxed">
                  네이버 AI 브리핑은 음식점·카페 등 일부 업종만 대상입니다.
                  이 업종은 <strong className="text-slate-800">ChatGPT·Google AI</strong> 노출 개선이 더 효과적이며,
                  <strong className="text-slate-800"> 네이버 AI탭</strong>(모든 업종, 베타 확대 중)도 확인하세요.
                </p>
              </div>
            </div>
            {/* 하단: 네이버 검색 상위 노출 가능 안내 */}
            <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl px-3 py-3">
              <span className="text-xl shrink-0 mt-0.5">✅</span>
              <div>
                <p className="text-sm font-bold text-green-800 mb-1">
                  단, 스마트플레이스 정보 개선으로 네이버 지도·플레이스 검색 순위가 유리해질 수 있습니다
                </p>
                <p className="text-sm text-green-700 leading-relaxed">
                  AI 브리핑 비대상이어도 <strong>리뷰 수·평점·소개글·사진</strong>을 개선하면
                  네이버 지도·플레이스 키워드 검색에서 순위가 올라갈 가능성이 높아집니다.
                  이 개선은 네이버 AI탭·ChatGPT·Gemini 노출에도 긍정적으로 작용합니다.
                </p>
              </div>
            </div>
          </div>
        )}
        {briefingStatus === "likely" && (
          <div className="rounded-xl border-2 border-blue-200 bg-blue-50 px-4 md:px-5 py-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl shrink-0 mt-0.5">📡</span>
              <div>
                <p className="text-base font-bold text-blue-900 mb-1">
                  {CATEGORIES.find(c => c.value === category)?.label} 업종 — 네이버 AI 브리핑 확대 예정
                </p>
                <p className="text-sm md:text-base text-blue-800 leading-relaxed">
                  2026년 6월 전체 네이버 사용자 대상 확대 예정입니다.
                  지금 준비해두면 확대 시 바로 유리해집니다.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── 네이버 검색 현황 — 소상공인 핵심 채널 ─────────────────────── */}
        <div className="rounded-xl bg-white border border-gray-200 shadow-sm overflow-hidden">
          {/* 헤더 */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-green-50 border-b border-green-100">
            <div className="flex items-center gap-2">
              <span className="text-base">🔍</span>
              <span className="text-sm font-semibold text-green-800">네이버 검색 현황 — 소상공인 핵심 채널</span>
            </div>
            <span className="text-sm text-green-600 bg-green-100 rounded-full px-2.5 py-0.5 shrink-0 font-medium hidden sm:inline">
              {m.query} 기준
            </span>
          </div>

          {/* 본문 */}
          <div className="px-4 md:px-5 py-4 space-y-4">

            {/* ✅ 네이버 SEO 개선 가치 제안 — 최상단 강조 */}
            <div className="bg-green-50 border-2 border-green-300 rounded-xl px-4 py-3.5">
              <p className="text-base font-bold text-green-800 mb-1.5">✅ 이 서비스로 네이버 검색 순위를 올릴 수 있습니다</p>
              <p className="text-sm md:text-base text-green-700 leading-relaxed">
                스마트플레이스 <strong>소개글·리뷰·사진·소식</strong>을 개선하면 네이버 지도·플레이스 키워드 검색 순위가 올라갑니다.
                {briefingStatus !== "inactive" && " AI 브리핑 인용 후보 진입도 같은 방법으로 가능합니다."}
              </p>
            </div>

            {/* 네이버 플레이스 순위 + AI 브리핑 상태 2칸 그리드 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-xl px-4 py-3">
                <p className="text-sm text-gray-500 mb-1">네이버 플레이스 순위</p>
                <p className="text-2xl font-black leading-tight">
                  <span className={m.naverRank <= 3 ? "text-green-600" : "text-amber-600"}>{m.naverRank}위</span>
                  <span className="text-sm font-normal text-gray-400 ml-1">/ {m.naverCompetitors.length}개 업체</span>
                </p>
                <p className={`text-sm font-medium mt-1 ${m.naverRank <= 3 ? "text-green-600" : "text-amber-600"}`}>
                  {m.naverRank === 1 ? "✓ 지역 1위" : m.naverRank <= 3 ? "✓ 상위 노출" : "⚠ 순위 개선 가능"}
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl px-4 py-3">
                <p className="text-sm text-gray-500 mb-1">네이버 AI 브리핑</p>
                {briefingStatus === "active" ? (
                  <>
                    <p className="text-base font-bold text-purple-700">대상 업종 ✓</p>
                    <p className="text-sm text-purple-600 mt-1">소개글 개선 후 2~4주</p>
                  </>
                ) : briefingStatus === "likely" ? (
                  <>
                    <p className="text-base font-bold text-yellow-700">확대 예정</p>
                    <p className="text-sm text-yellow-600 mt-1">지금 준비하면 유리</p>
                  </>
                ) : (
                  <>
                    <p className="text-base font-bold text-gray-500">이 업종 해당 없음</p>
                    <p className="text-sm text-gray-400 mt-1">검색·AI탭에 집중</p>
                  </>
                )}
              </div>
            </div>

            {/* AI 채널별 개선 반영 기간 */}
            <div>
              <p className="text-sm font-semibold text-gray-600 mb-2">개선 후 손님에게 노출되는 기간 (공식 자료 기준)</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { ch: "네이버 AI 브리핑", period: "2~4주",      border: "border-purple-200", bg: "bg-purple-50", text: "text-purple-700", tip: "소개글 Q&A 추가 후 네이버 재수집" },
                  { ch: "네이버 AI탭",       period: "2~4주",      border: "border-blue-200",   bg: "bg-blue-50",   text: "text-blue-700",   tip: "소개글·리뷰 키워드 보강" },
                  { ch: "Gemini",            period: "수일~수주",   border: "border-indigo-200", bg: "bg-indigo-50", text: "text-indigo-700", tip: "구글 비즈니스 프로필 등록 시 빠름 / 미등록 시 수개월~1년" },
                  { ch: "ChatGPT",           period: "수개월~1년",  border: "border-orange-200", bg: "bg-orange-50", text: "text-orange-700", tip: "Bing Places 등록 시 빠름 · 웹콘텐츠 기반" },
                ].map((item) => (
                  <div key={item.ch} className={`rounded-xl border ${item.border} ${item.bg} px-3 py-2.5`}>
                    <div className={`flex items-center justify-between mb-0.5 ${item.text}`}>
                      <span className="text-sm font-semibold">{item.ch}</span>
                      <span className="text-sm font-bold shrink-0 ml-2">{item.period}</span>
                    </div>
                    <p className={`text-sm leading-relaxed break-keep ${item.text} opacity-75`}>{item.tip}</p>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* 푸터 */}
          <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-2">
            <p className="text-sm text-gray-400 leading-relaxed">
              측정 시점·기기·로그인 상태에 따라 달라질 수 있습니다.
            </p>
            <Link
              href="/trial"
              className="text-sm font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg px-3 py-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              내 가게 확인 →
            </Link>
          </div>
        </div>

        {/* ── 2컬럼 레이아웃 (PC) / 단일컬럼 (모바일) ───── */}
        <div className="flex flex-col md:grid md:grid-cols-[1fr_380px] md:gap-6 gap-5">

          {/* ══════════════════════════════════════════════
              오른쪽 사이드바 — 모바일에서 order-first로 먼저 노출
          ══════════════════════════════════════════════ */}
          <div className="order-first md:order-last space-y-5 md:space-y-5">

            {/* 종합 결론 — 대시보드 HeroCard 구조 복제 (성장단계+네이버 3채널 그리드+실측근거+오늘할일) */}
            <div>
              <p className="text-sm text-gray-500 mb-2 px-1">
                {m.businessName} · {isRealBiz ? "창원시 (실제 데이터)" : `${m.region} (예시)`}
              </p>
              <ResultSummaryHero
                stageScore={m.totalScore}
                inactive={briefingStatus === "inactive"}
                evidenceText={heroEvidence}
                tiles={heroTiles}
                todayAction={gs.this_week_action}
                todayActionLink="/trial"
              />
            </div>

            {/* 측정 근거 요약 */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="mb-2 text-sm font-medium text-slate-600">🔍 {isRealBiz ? "이렇게 측정했습니다" : "실제 스캔에서는 이렇게 측정합니다"}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2">
                <span className="text-sm text-slate-700">🤖 ChatGPT·Gemini 각 50회(총 100회) 질의</span>
                <span className="text-sm text-slate-700">📍 네이버 AI 브리핑 직접 확인</span>
                <span className="text-sm text-slate-700">📝 블로그 후기 {m.blogMentions}건 발견</span>
                <span className="text-sm text-slate-700">✅ 스마트플레이스 자동 점검</span>
              </div>
              <p className="text-sm text-slate-500">⏱ 스마트플레이스 개선 후 네이버 검색 순위 변화까지 보통 2~4주 소요됩니다.</p>
            </div>

            {/* 업종 평균 대비 내 위치 (교육용 보조 — 성장단계·채널·오늘할일은 위 종합결론 히어로에 표시) */}
            <div className="bg-white rounded-xl shadow-sm px-4 md:px-5 py-4 md:py-5">
              <p className="text-sm font-bold text-gray-700 mb-2">업종 평균 대비 내 위치</p>
              <p className="text-sm md:text-base text-gray-700 leading-relaxed mb-3">{gs.focus_message}</p>
              {/* 점수 바 (숫자 미표시 — 상대 위치만) */}
              <div className="mb-2">
                <div className="w-full bg-gray-100 rounded-full h-2.5 relative">
                  <div className="h-2.5 rounded-full bg-blue-400 transition-all" style={{ width: `${m.totalScore}%` }} />
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-gray-400 rounded-full"
                    style={{ left: `${m.benchmark.avg}%` }}
                    title={`${CATEGORIES.find(c => c.value === category)?.label} 업종 평균`}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-sm text-gray-400">시작</span>
                  <span className="text-sm text-gray-400">{CATEGORIES.find(c => c.value === category)?.label} 업종 평균</span>
                  <span className="text-sm text-gray-400">최적화</span>
                </div>
              </div>
              <p className="text-sm text-gray-400">
                내 가게 AI 검색 노출은 {isRealBiz ? "창원시" : m.region} {CATEGORIES.find(c => c.value === category)?.label} 업종 평균 {m.totalScore >= m.benchmark.avg ? "이상입니다" : "대비 개선 여지가 있습니다"}.
                <span className="ml-1 text-sm bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded">추정</span>
              </p>
              <p className="text-sm text-gray-400 mt-2">업종 평균은 참고용 추정치이며 실측 기반으로 계속 개선됩니다</p>
            </div>

            {/* Google 비즈니스 프로필 안내 — 컴팩트 버전 */}
            <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
              <p className="text-sm font-semibold text-gray-700 mb-1">ChatGPT·Google AI에도 노출되려면?</p>
              <p className="text-sm text-gray-500 leading-relaxed">
                네이버 스마트플레이스는 해외 AI가 읽을 수 없습니다.
                <a href="https://business.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 font-medium hover:underline ml-1">
                  Google 비즈니스 프로필 무료 등록 →
                </a>
                으로 ChatGPT·Google AI 노출 기반을 확보하세요.
              </p>
            </div>

            {/* 지금 가장 약한 부분 */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 md:px-5 py-4">
              <p className="text-sm font-bold text-amber-700 mb-1">지금 가장 개선 가능한 부분 — {m.weakItem.label}</p>
              <p className="text-sm md:text-base text-gray-600 leading-relaxed mb-2">{m.weakItem.reason}</p>
              <div className="w-full bg-amber-100 rounded-full h-2.5 mb-1.5">
                <div className="h-2.5 rounded-full bg-amber-400" style={{ width: `${m.weakItem.score}%` }} />
              </div>
              <p className="text-sm md:text-base text-amber-700 leading-relaxed">{m.weakItem.impact}</p>
            </div>

          </div>
          {/* ── 오른쪽 사이드바 끝 ── */}


          {/* ══════════════════════════════════════════════
              왼쪽 메인 콘텐츠 — 상세 분석
          ══════════════════════════════════════════════ */}
          <div className="order-last md:order-first space-y-5 md:space-y-5">

            {/* 손님이 가게를 찾는 과정 */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 md:px-6 py-3 md:py-4 border-b border-gray-100">
                <p className="text-base md:text-lg font-bold text-gray-800">손님은 이렇게 가게를 찾습니다</p>
                <p className="text-sm text-gray-500 mt-0.5">"{m.query}" 로 검색했을 때 예시</p>
              </div>

              {/* STEP 1: 네이버 */}
              <div className="px-4 md:px-6 py-4 border-b border-gray-50">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-6 h-6 rounded-full bg-green-600 text-white text-sm font-bold flex items-center justify-center shrink-0">1</span>
                  <p className="text-sm md:text-base font-semibold text-gray-700">네이버 지도·플레이스에서 가게 목록을 봅니다</p>
                </div>
                <div className="space-y-2 ml-8">
                  {m.naverCompetitors.map((comp) => (
                    <div key={comp.rank} className={`flex items-start gap-3 rounded-xl px-3 py-2.5 ${comp.isMe ? "bg-blue-50 border border-blue-200" : "bg-gray-50"}`}>
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold shrink-0 mt-0.5 ${
                        comp.rank === 1 ? "bg-yellow-300 text-yellow-900" :
                        comp.rank === 2 ? "bg-gray-300 text-gray-700" :
                        comp.rank === 3 ? "bg-orange-200 text-orange-800" : "bg-white text-gray-500 border border-gray-200"
                      }`}>{comp.rank}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-sm md:text-base font-medium ${comp.isMe ? "text-blue-700" : "text-gray-800"}`}>{comp.name}</span>
                          {comp.isMe && <span className="text-sm bg-blue-600 text-white px-1.5 py-0.5 rounded-full">내 가게</span>}
                        </div>
                        <p className="text-sm text-gray-500 truncate mt-0.5">{comp.address}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 카카오맵 */}
              <div className="px-4 md:px-6 py-4 border-b border-gray-50">
                <div className="flex items-center gap-2 mb-2.5 ml-8">
                  <span className="text-sm md:text-base font-semibold text-gray-600">카카오맵에서도 같은 키워드로 검색하면:</span>
                </div>
                <div className="space-y-2 ml-8">
                  {m.kakaoCompetitors.map((comp) => (
                    <div key={comp.rank} className={`flex items-start gap-3 rounded-xl px-3 py-2.5 ${comp.isMe ? "bg-yellow-50 border border-yellow-200" : "bg-gray-50"}`}>
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold shrink-0 mt-0.5 ${
                        comp.rank === 1 ? "bg-yellow-300 text-yellow-900" :
                        comp.rank === 2 ? "bg-gray-300 text-gray-700" : "bg-white text-gray-500 border border-gray-200"
                      }`}>{comp.rank}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-sm md:text-base font-medium ${comp.isMe ? "text-yellow-800" : "text-gray-800"}`}>{comp.name}</span>
                          {comp.isMe && <span className="text-sm bg-yellow-500 text-white px-1.5 py-0.5 rounded-full">내 가게</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* STEP 2: 블로그 */}
              <div className="px-4 md:px-6 py-4 border-b border-gray-50">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-6 h-6 rounded-full bg-green-600 text-white text-sm font-bold flex items-center justify-center shrink-0">2</span>
                  <p className="text-sm md:text-base font-semibold text-gray-700">블로그 후기를 보고 어느 가게를 갈지 결정합니다</p>
                </div>
                <div className="ml-8">
                  <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 mb-3">
                    <p className="text-sm md:text-base font-bold text-red-700 mb-3">후기가 더 많은 경쟁 가게를 선택할 가능성이 높습니다</p>
                    <div className="mb-2.5">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-blue-700 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> 내 가게
                        </span>
                        <span className="text-sm font-bold text-blue-700">{m.blogMentions}건</span>
                      </div>
                      <div className="w-full bg-white rounded-full h-3">
                        <div className="h-3 rounded-full bg-blue-500" style={{ width: `${Math.round((m.blogMentions / m.topCompetitorBlogCount) * 100)}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-gray-500 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-gray-400 inline-block" />
                          <span className="truncate max-w-[140px] md:max-w-[200px]">{m.topCompetitorName} (네이버 1위)</span>
                        </span>
                        <span className="text-sm font-bold text-gray-600 shrink-0">{m.topCompetitorBlogCount}건</span>
                      </div>
                      <div className="w-full bg-white rounded-full h-3">
                        <div className="h-3 rounded-full bg-gray-400 w-full" />
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-red-100 flex items-center justify-between gap-2">
                      <p className="text-sm text-red-500">경쟁 1위보다 {m.topCompetitorBlogCount - m.blogMentions}건 적습니다.</p>
                      <Link href="/trial" className="text-sm font-semibold text-red-600 underline hover:text-red-700 shrink-0">내 가게 확인 →</Link>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {m.topBlogs.map((blog, i) => (
                      <div key={i} className="flex items-start gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
                        <span className="text-sm text-gray-500 mt-1 shrink-0 font-medium">후기</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm md:text-base font-medium text-gray-800 line-clamp-1">{blog.title}</p>
                          <p className="text-sm text-gray-500 line-clamp-1 mt-0.5">{blog.desc}</p>
                          <p className={`text-sm mt-0.5 font-medium ${blog.isOld ? "text-orange-400" : "text-gray-500"}`}>
                            {blog.dateLabel}{blog.isOld && " · 오래된 후기"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* STEP 3: AI */}
              <div className="px-4 md:px-6 py-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-6 h-6 rounded-full bg-green-600 text-white text-sm font-bold flex items-center justify-center shrink-0">3</span>
                  <p className="text-sm md:text-base font-semibold text-gray-700">ChatGPT·Gemini에 "어디 좋아?" 라고 물어봅니다</p>
                </div>
                <div className="ml-8">
                  {/* AI 도구 특성 설명 */}
                  <div className="bg-gray-50 rounded-xl px-4 py-3 mb-3 border border-gray-100">
                    <p className="text-sm font-semibold text-gray-600 mb-2">각 AI 도구 특성</p>
                    <ul className="space-y-1.5">
                      <li className="flex items-start gap-2 text-sm text-gray-600">
                        <span className="shrink-0 font-medium text-gray-700 mt-px">ChatGPT</span>
                        <span>Bing 실시간 검색 기반 — Bing Places 등록 시 빠름, 웹콘텐츠 기반 수주~수개월</span>
                      </li>
                      <li className="flex items-start gap-2 text-sm text-gray-600">
                        <span className="shrink-0 font-medium text-gray-700 mt-px">Gemini</span>
                        <span>Google 비즈니스 프로필 + 실시간 검색 그라운딩 기반 (프로필 등록 후 수일~수주)</span>
                      </li>
                      <li className="flex items-start gap-2 text-sm text-gray-600">
                        <span className="shrink-0 font-medium text-gray-700 mt-px">네이버 AI 브리핑</span>
                        <span>스마트플레이스·리뷰·소식 기반 실시간 (업데이트 후 2~4주)</span>
                      </li>
                      <li className="flex items-start gap-2 text-sm text-gray-600">
                        <span className="shrink-0 font-medium text-gray-700 mt-px">네이버 AI탭</span>
                        <span>2026-04-27 베타 오픈, 모든 업종 대상 (베타 확대 중)</span>
                      </li>
                    </ul>
                  </div>

                  {m.aiExcerptFail ? (
                    <>
                      <div className="bg-red-50 rounded-xl px-4 py-3 border-l-4 border-red-400 mb-2">
                        <p className="text-sm md:text-base font-semibold text-red-700 mb-1.5">
                          AI가 {m.businessName}를 추천하지 않았습니다
                        </p>
                        <p className="text-sm md:text-base text-gray-700 leading-relaxed">
                          "{m.query}"으로 ChatGPT·Gemini에 각 50회 질의한 결과,
                          <strong className="text-red-600"> ChatGPT·Gemini 합산 AI 노출 확률 {m.geminiRate === 0 ? "이번 측정에서 AI에 미노출" : `${m.geminiRate}%`}</strong>입니다.
                          소개글·소식에 구조화된 정보가 없어 AI가 인용할 후보 텍스트를 찾기 어렵습니다.
                        </p>
                      </div>
                      <div className="bg-blue-50 rounded-xl px-4 py-3 border border-blue-100">
                        <p className="text-sm font-semibold text-blue-700 mb-1">소개글 Q&A 섹션 추가 시 기대 효과</p>
                        <p className="text-sm md:text-base text-blue-600 leading-relaxed">
                          AI는 "Q: 가격이 얼마인가요? A: ..." 형태의 구조화 정보를 인용 후보로 선호합니다.
                          소개글에 Q&A 3~5개를 추가하면 AI 브리핑 후보군 진입 가능성이 올라갑니다.
                        </p>
                      </div>
                      <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                        이 데모는 <span className="font-medium">Basic 구독 기준 (Gemini·ChatGPT 각 50회)</span>으로 측정한 샘플입니다.
                        무료 체험은 ChatGPT 5회 질의이며, 구독 후 정밀 측정이 진행됩니다.
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="bg-green-50 rounded-xl px-4 py-3 border-l-4 border-green-400 mb-2">
                        <p className="text-sm md:text-base font-semibold text-green-700 mb-1">AI가 "{m.businessName}" 을(를) 추천했습니다</p>
                        <p className="text-sm text-gray-600 leading-relaxed">"{m.aiExcerpt.slice(0, 100)}..."</p>
                        <p className="text-sm font-semibold text-green-700 mt-1.5">
                          ChatGPT·Gemini 합산 AI 노출 확률: <span className="text-green-800">{m.geminiRate}%</span>
                        </p>
                      </div>
                      <p className="text-sm text-gray-500 leading-relaxed">무료 체험은 ChatGPT 5회 질의입니다. Basic 구독: 주 1회(월요일) Gemini·ChatGPT 각 50회 자동 측정.</p>
                    </>
                  )}
                  <p className="mt-2 text-sm text-gray-400 leading-relaxed">
                    ChatGPT 측정은 AI 학습 데이터 기반이며 실시간 웹 검색 결과와 다를 수 있습니다.
                    측정 시점·기기·로그인 상태에 따라 달라질 수 있습니다.
                  </p>

                </div>
              </div>
            </div>

            {/* 항목별 분석 — 채널 구조로 재배치 (대시보드 채널 taxonomy와 일치) */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 md:px-6 py-3 md:py-4 border-b border-gray-100">
                <p className="text-base md:text-lg font-bold text-gray-800">채널별로 어디를 개선할지 확인하기</p>
                <p className="text-sm text-gray-500 mt-0.5">네이버·글로벌 AI 채널별로 약한 항목부터 개선하면 됩니다</p>
              </div>
              <div className="divide-y divide-gray-100">
                {channelOrder.map((cid) => {
                  const ch = channelDefs[cid];
                  return (
                    <div key={cid} className="px-4 md:px-6 py-4">
                      <div className={`flex items-center gap-2 pb-2 mb-3 border-b-2 ${ch.border}`}>
                        <span className="text-base" aria-hidden="true">{ch.icon}</span>
                        <span className="text-sm font-bold text-gray-700">{ch.label}</span>
                      </div>
                      {ch.items && ch.items.length > 0 ? (
                        <div>{ch.items.map(renderBreakdownRow)}</div>
                      ) : (
                        <p className="text-sm md:text-base text-gray-500 leading-relaxed">{ch.note}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 스마트플레이스 체크리스트 */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 md:px-6 py-3 md:py-4 border-b border-gray-100">
                <p className="text-base md:text-lg font-bold text-gray-800">손님이 처음 볼 때 꼭 있어야 할 정보</p>
                <p className="text-sm text-gray-500 mt-0.5">하나라도 빠지면 손님이 경쟁 가게로 넘어갑니다</p>
              </div>
              <div className="divide-y divide-gray-50">
                {m.smartPlaceChecklist.map((item, i) => (
                  <div key={i} className="px-4 md:px-6 py-3 flex items-start gap-3">
                    <span className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-sm shrink-0 font-bold ${
                      item.checked === true  ? "bg-green-100 text-green-600" :
                      item.checked === false ? "bg-red-100 text-red-500" :
                      "bg-gray-100 text-gray-500"
                    }`}>
                      {item.checked === true ? "✓" : item.checked === false ? "✗" : "?"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm md:text-base font-semibold ${item.checked === false ? "text-red-700" : "text-gray-800"}`}>{item.item}</span>
                        <span className={`text-sm px-2 py-0.5 rounded-full font-medium ${
                          item.impact === "high" ? "bg-red-100 text-red-600" :
                          item.impact === "medium" ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-500"
                        }`}>
                          {item.impact === "high" ? "필수" : item.impact === "medium" ? "중요" : "권장"}
                        </span>
                      </div>
                      <p className={`text-sm md:text-base mt-0.5 leading-relaxed ${item.checked === false ? "text-red-500 font-medium" : "text-gray-500"}`}>{item.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-4 md:px-6 py-3 bg-blue-50 border-t border-blue-100">
                <p className="text-sm md:text-base text-blue-700 leading-relaxed">구독하면 위 항목들이 실제로 등록되어 있는지 자동으로 점검하고 빠진 항목을 알려드립니다.</p>
              </div>
            </div>

            {/* 구독하면 달라지는 것 */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden ring-2 ring-blue-100">
              <div className="px-4 md:px-6 py-3 md:py-4 border-b border-gray-100">
                <p className="text-base md:text-lg font-bold text-gray-800">구독하면 이것이 달라집니다</p>
              </div>
              <div className="px-4 md:px-6 pt-4 pb-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-sm font-bold text-gray-500 mb-2">지금 (무료 체험)</p>
                    <ul className="space-y-1.5 text-sm text-gray-500">
                      <li>· ChatGPT 5회 AI 노출 확률(%) 측정</li>
                      <li>· 종합 점수 + 네이버/글로벌 분리 진단</li>
                      <li>· 스마트플레이스 항목별 점검</li>
                      <li>· 업종 평균 대비 내 위치 확인</li>
                      <li>· 오늘 할 1가지 개선 행동 제안</li>
                      <li>· 점수 추이 없음 (구독 시 60일 기록)</li>
                    </ul>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                    <p className="text-sm font-bold text-blue-700 mb-2">구독 시작 후 (Basic 기준)</p>
                    <ul className="space-y-1.5 text-sm text-blue-700">
                      <li>· 주 1회(월요일) 자동 스캔 — Gemini·ChatGPT 각 50회 + 네이버 AI 브리핑</li>
                      <li>· 수동 스캔 하루 2회 (원할 때 직접 실행)</li>
                      <li>· 경쟁사 3곳 추적 + 6개 차원 갭 분석</li>
                      <li>· 업종 시장 순위·분포 확인</li>
                      <li>· Claude AI 맞춤 개선 가이드 (월 3회)</li>
                      <li>· 키워드 순위 주 1회 자동 추적</li>
                      <li>· 점수 60일 추이 자동 기록</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

          </div>
          {/* ── 왼쪽 메인 콘텐츠 끝 ── */}

        </div>
        {/* ── 2컬럼 레이아웃 끝 ── */}

        {/* ── CTA (전체 너비) ──────────────────────────── */}
        <div className="rounded-xl overflow-hidden bg-blue-600">
          <div className="px-5 md:px-8 pt-6 pb-5">
            <p className="font-bold text-white text-xl md:text-2xl leading-snug mb-1.5">내 가게의 AI 노출은 어떤 상태일까요?</p>
            {isRealBiz ? (
              <p className="text-sm md:text-base text-white/85 mb-5 leading-relaxed">
                지금 {m.businessName}의 AI 노출 상태를 확인할 수 있습니다.<br />
                소개글에 Q&A 5개 추가 후 7일 뒤 노출이 얼마나 개선됐는지 자동으로 확인하고 싶다면?
              </p>
            ) : (
              <p className="text-sm md:text-base text-white/75 mb-5">
                업종과 지역만 입력하면 1분 안에 무료로 확인됩니다. 회원가입 없이 바로 시작하세요.
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <Link
                href="/trial"
                className="block bg-white text-blue-700 rounded-xl py-3.5 font-bold text-center hover:bg-blue-50 transition-colors text-sm md:text-base"
              >
                내 가게 무료 진단하기 →
              </Link>
              <Link
                href="/signup"
                className="block bg-blue-500 text-white rounded-xl py-3.5 font-semibold text-center hover:bg-blue-400 transition-colors text-sm md:text-base border border-white/20"
              >
                1분 무료 회원가입
              </Link>
            </div>
            <p className="text-sm text-white/50 text-center">Basic 월 9,900원부터 · 언제든 해지 가능</p>
          </div>
          <div className="bg-black/20 px-5 md:px-8 py-5">
            <p className="text-sm md:text-base font-bold text-white/60 mb-3 uppercase tracking-wide">시작하면 이렇게 됩니다</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { step: "1", label: "1분 회원가입",               desc: "이메일 인증만으로 즉시 시작" },
                { step: "2", label: "가게 등록",                   desc: "방금 입력한 정보 그대로 사용" },
                { step: "3", label: "Basic 구독 시작",              desc: "네이버·Google AI + Gemini·ChatGPT 각 50회 (총 100회) 자동 샘플링" },
                { step: "4", label: "경쟁사 데이터 자동 수집",     desc: "매주 월요일 05:00 경쟁사 키워드·소개글 텍스트 수집" },
                { step: "5", label: "Claude AI 맞춤 가이드",       desc: "경쟁사 격차 기반 우선순위 실행 가이드" },
                { step: "6", label: "7일 후 점수 자동 비교",        desc: "행동한 날짜 기준 -2일/+7일 변화 자동 기록" },
              ].map((s) => (
                <div key={s.step} className="flex items-start gap-3">
                  <span className="w-7 h-7 rounded-full bg-white/20 text-white text-sm font-bold flex items-center justify-center shrink-0 mt-0.5">{s.step}</span>
                  <div>
                    <p className="text-sm md:text-base font-semibold text-white/90 leading-snug">{s.label}</p>
                    <p className="text-sm text-white/60 mt-0.5 leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <Link href="/" className="block w-full border border-gray-200 text-gray-500 py-3 rounded-xl hover:bg-gray-50 text-sm md:text-base text-center">
          AEOlab 소개 보기
        </Link>

      </div>

      <SiteFooter activePage="/demo" />
    </main>
  );
}
