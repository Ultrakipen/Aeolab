"use client";

import { useState } from "react";
import Link from "next/link";
import { SiteFooter } from "@/components/common/SiteFooter";

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
  { value: "tutoring",      label: "과외/튜터링" },
  { value: "music",         label: "음악학원" },
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

// ── 업종별 목업 데이터 ────────────────────────────────────────────────
function getMock(category: string, region: string) {
  const benchmarks: Record<string, { avg: number; rank: string }> = {
    restaurant: { avg: 51, rank: "상위 40%" },
    cafe:       { avg: 47, rank: "상위 45%" },
    beauty:     { avg: 43, rank: "상위 45%" },
    academy:    { avg: 38, rank: "상위 50%" },
    clinic:     { avg: 50, rank: "상위 40%" },
    photo:      { avg: 42, rank: "상위 50%" },
    music:      { avg: 40, rank: "상위 50%" },
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
      { icon: "🔍", label: "AI 검색 노출 개선 방법",   tip: "Gemini·ChatGPT 각 50회 (총 100회) 반복 측정으로 정확한 노출 확률(%)을 산출하고 매일 자동 추적합니다." },
      { icon: "📊", label: "경쟁사 6개 차원 갭 분석",  tip: "1위 경쟁사 대비 어느 항목이 몇 점 뒤처지는지 정확히 보여줍니다." },
      { icon: "🗺️", label: "업종 시장 순위 확인",      tip: "내 가게가 지역 업종 내 몇 위인지, 상위 몇 %인지 수치로 확인합니다." },
      { icon: "📋", label: "스마트플레이스 소개글 + 블로그 자동 생성", tip: "AI 최적화 소개글과 블로그 포스트 초안을 자동 생성 — 복사 후 스마트플레이스에 붙여넣기만 하면 됩니다. 홈페이지 없어도 OK." },
      { icon: "📢", label: "온라인 언급 늘리기",        tip: "어느 플랫폼에서 언급이 많고 적은지, 경쟁사와 비교해 구체적 행동 가이드를 제공합니다." },
      { icon: "✅", label: "실행 체크리스트 + 재스캔",  tip: "개선 항목을 체크리스트로 진행하고, 완료 후 재스캔으로 효과를 바로 확인합니다." },
    ],
    smartPlaceChecklist: [
      { item: "대표 사진 5장 이상",        impact: "high",   reason: "첫인상 결정 — 사진 없으면 클릭 즉시 이탈" },
      { item: "영업시간 (오늘 운영 여부)",  impact: "high",   reason: "\"지금 문 열었나?\" — 미등록 시 경쟁 가게로 이동" },
      { item: "메뉴·가격 정보",            impact: "high",   reason: "\"얼마야?\" — 가격 모르면 방문 결정 못 함" },
      { item: "전화번호·예약 방법",        impact: "medium", reason: "바로 전화/예약 가능해야 선택 확정" },
      { item: "주소·주차 안내",            impact: "medium", reason: "\"어떻게 가나?\" — 네이버 지도 연동 필수" },
      { item: "가게 소개 (키워드 포함)",   impact: "medium", reason: "AI·검색엔진이 이 글을 읽고 추천 여부 결정" },
      { item: "소개글 Q&A 섹션",          impact: "high",   reason: "소개글 안 Q&A는 AI 브리핑 인용 후보 텍스트 — 없으면 AI 추천 가능성 낮음" },
      { item: "최근 리뷰 답글",            impact: "low",    reason: "사업주 활동성 신호 — AI가 운영 중으로 인식" },
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
        reason: "소개글에 가격·예약·프로세스 정보가 구조화되지 않아 ChatGPT·네이버 AI가 \"창원 웨딩스냅 추천\"을 물어봐도 홍스튜디오를 인용 후보로 선택하기 어렵습니다. 사진 100장, 리뷰 16건이 있어도 소개글 Q&A 섹션 없이는 AI 추천 가능성이 낮습니다.",
        impact: "소개글에 Q&A 3~5개 추가만으로 AI 인용 후보 진입 가능 — 경쟁 스튜디오 중 선점 기회",
      },
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
        reason: "스마트플레이스 소개글에 키워드가 부족하고 연결된 블로그 포스트가 없어 ChatGPT·Google AI가 가게 정보를 찾기 어렵습니다.",
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
    academy: {
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
    clinic: {
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

// ── 유틸 ─────────────────────────────────────────────────────────────
const gradeColor = (g: string) =>
  ({ A: "text-green-500", B: "text-blue-500", C: "text-yellow-500", D: "text-orange-500", F: "text-red-500" }[g] ?? "text-gray-500");

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
  const stageColor: Record<string, string> = {
    survival:  "bg-red-50 border-red-200 text-red-800",
    stability: "bg-yellow-50 border-yellow-200 text-yellow-800",
    growth:    "bg-blue-50 border-blue-200 text-blue-800",
    dominance: "bg-green-50 border-green-200 text-green-800",
  };
  const stageColorClass = stageColor[gs.stage] ?? "bg-gray-50 border-gray-200 text-gray-800";

  // 실제 사업장 여부 (photo/music은 창원시 실제 사업장 데이터)
  const isRealBiz = category === "photo" || category === "music";

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

      <div className="max-w-6xl mx-auto py-4 md:py-8 px-4 md:px-8 space-y-4 md:space-y-5">

        {/* ── 실제 사업장 강조 배너 (photo/music 선택 시) ──── */}
        {isRealBiz && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
            <p className="text-sm md:text-base font-semibold text-blue-800">
              실제 사업장 진단 예시
            </p>
            <p className="text-sm text-blue-700 mt-0.5 leading-relaxed">
              창원시 홍스튜디오, 홍뮤직스튜디오작곡교습소의 실제 스마트플레이스 데이터를 기반으로 합니다.
              리뷰 수·블로그 언급·소개글 Q&A 섹션 여부 등 실제로 수집된 정보입니다.
            </p>
          </div>
        )}

        {/* ── 업종·지역 선택기 (전체 너비) ──────────────── */}
        <div className="bg-white rounded-2xl shadow-sm px-4 md:px-6 py-4 md:py-5">
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

        {/* ── 2컬럼 레이아웃 (PC) / 단일컬럼 (모바일) ───── */}
        <div className="flex flex-col md:grid md:grid-cols-[1fr_380px] md:gap-6 gap-4">

          {/* ══════════════════════════════════════════════
              오른쪽 사이드바 — 모바일에서 order-first로 먼저 노출
          ══════════════════════════════════════════════ */}
          <div className="order-first md:order-last space-y-4 md:space-y-5">

            {/* 핵심 메시지 */}
            <div className="rounded-2xl px-4 md:px-5 py-4 md:py-5 bg-blue-600">
              <p className="text-white/70 text-sm mb-1">
                {m.businessName} · {isRealBiz ? "창원시 (실제 데이터)" : `${m.region} (예시)`}
              </p>
              <p className="text-white font-bold text-base md:text-lg leading-snug mb-3">
                {m.aiExcerptFail
                  ? "AI에 노출되지 않고 있습니다. 경쟁 가게에 밀리는 중입니다."
                  : "손님에게 일부는 보이지만 경쟁 가게에 밀리고 있습니다"}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "AI 검색 노출",  ok: !m.aiExcerptFail,      desc: m.aiExcerptFail ? "AI 미노출 상태" : "AI 답변에 등장" },
                  { label: "네이버 지도",   ok: m.naverRank !== null,  desc: `지역 검색 ${m.naverRank}위` },
                  { label: "카카오맵",      ok: m.isOnKakao,           desc: `카카오 ${m.kakaoRank}위` },
                  { label: "블로그 후기",   ok: m.blogMentions > 5,    desc: `${m.blogMentions}건` },
                ].map((item) => (
                  <div key={item.label} className={`rounded-xl px-3 py-2.5 flex items-center gap-2 ${item.ok ? "bg-white/20" : "bg-black/20"}`}>
                    <span className={`text-base shrink-0 ${item.ok ? "text-white" : "text-white/40"}`}>
                      {item.ok ? "✓" : "✕"}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white/90 leading-tight">{item.label}</p>
                      <p className={`text-sm leading-tight mt-0.5 ${item.ok ? "text-white/70" : "text-white/40"}`}>{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 종합 점수 */}
            <div className="bg-white rounded-2xl shadow-sm px-4 md:px-5 py-4 md:py-5">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm md:text-base font-semibold text-gray-700">AI 노출 종합 점수</p>
                <p className="text-sm text-gray-500">100점 만점</p>
              </div>
              <div className="flex items-end gap-3 mb-3">
                <span className={`text-5xl md:text-6xl font-black ${gradeColor(m.grade)}`}>{m.grade}</span>
                <span className="text-3xl md:text-4xl font-bold text-gray-900 mb-1">{m.totalScore}점</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3 mb-3">
                <div className="h-3 rounded-full bg-yellow-400 transition-all" style={{ width: `${m.totalScore}%` }} />
              </div>
              <p className="text-sm md:text-base text-gray-500 leading-relaxed">
                {isRealBiz ? "창원시" : m.region} {CATEGORIES.find(c => c.value === category)?.label} 평균 <strong>{m.benchmark.avg}점</strong> · <strong>{m.benchmark.rank}</strong>
              </p>
              <p className="text-sm text-gray-500 mt-0.5">개선 여지가 있습니다</p>
            </div>

            {/* 현재 성장 단계 */}
            <div className={`rounded-2xl border px-4 md:px-5 py-4 md:py-5 ${stageColorClass}`}>
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📈</span>
                  <span className="text-base md:text-lg font-bold">현재 단계: {gs.stage_label}</span>
                </div>
                <span className="text-sm opacity-70 font-medium">{gs.score_range}</span>
              </div>
              <p className="text-sm md:text-base mb-3 leading-relaxed">{gs.focus_message}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2 gap-2">
                <div className="bg-white bg-opacity-60 rounded-xl p-3">
                  <div className="text-sm md:text-base font-semibold mb-1">이번 주 집중할 것</div>
                  <p className="text-sm leading-relaxed">{gs.this_week_action}</p>
                </div>
                <div className="bg-white bg-opacity-40 rounded-xl p-3">
                  <div className="text-sm md:text-base font-semibold mb-1 opacity-70">지금 하지 말아야 할 것</div>
                  <p className="text-sm leading-relaxed opacity-80">{gs.do_not_do}</p>
                </div>
              </div>
              {gs.estimated_weeks_to_next && (
                <p className="text-sm opacity-60 mt-2 leading-relaxed">다음 단계까지 약 {gs.estimated_weeks_to_next}주 예상 · 구독 시 실제 데이터 기반으로 측정</p>
              )}
            </div>

            {/* 채널 분리 점수 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-2xl shadow-sm px-3 md:px-4 py-4">
                <p className="text-sm font-semibold text-gray-600 mb-0.5">네이버 AI 채널</p>
                <p className="text-sm text-gray-500 mb-2 leading-tight">네이버 브리핑 · 카카오맵</p>
                <div className={`text-2xl md:text-3xl font-black mb-1 ${m.naverChannelScore >= 70 ? "text-green-500" : m.naverChannelScore >= 40 ? "text-amber-500" : "text-red-400"}`}>
                  {m.naverChannelScore}점
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
                  <div className="h-2 rounded-full bg-amber-500" style={{ width: `${m.naverChannelScore}%` }} />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-sm"><span className="text-green-500">✓</span><span className="text-gray-600">스마트플레이스</span></div>
                  <div className="flex items-center gap-1.5 text-sm"><span className="text-green-500">✓</span><span className="text-gray-600">카카오맵</span></div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm px-3 md:px-4 py-4 relative overflow-hidden">
                <p className="text-sm font-semibold text-gray-600 mb-0.5">ChatGPT·Google AI</p>
                <p className="text-sm text-gray-500 mb-2 leading-tight">요즘 손님들이 많이 쓰는 AI</p>
                <div className="select-none pointer-events-none blur-sm">
                  <div className="text-2xl md:text-3xl font-black text-blue-500 mb-1">??점</div>
                  <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
                    <div className="h-2 rounded-full bg-blue-400" style={{ width: "45%" }} />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-sm"><span className="text-gray-500">○</span><span className="text-gray-500">ChatGPT 노출</span></div>
                    <div className="flex items-center gap-1.5 text-sm"><span className="text-gray-500">○</span><span className="text-gray-500">Google AI 노출</span></div>
                  </div>
                </div>
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-[1px]">
                  <span className="text-2xl mb-1">🔒</span>
                  <Link href="/trial" className="text-sm font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl px-3 py-2 transition-colors text-center">
                    내 가게로<br className="md:hidden" /> 확인하기
                  </Link>
                </div>
              </div>
            </div>

            {/* 채널 교육 배너 */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 md:py-4">
              <p className="text-sm md:text-base font-semibold text-amber-800 mb-1.5">요즘 손님들이 ChatGPT에 맛집 물어보는 거 아시죠?</p>
              <p className="text-sm text-amber-700 leading-relaxed">
                네이버 스마트플레이스만 관리하면 ChatGPT에서는 내 가게가 안 나옵니다.
                <strong> 네이버는 해외 AI의 접근을 막기 때문</strong>입니다.
                ChatGPT·Google AI 노출엔 <strong>Google 비즈니스 프로필</strong>과
                <strong> AI 검색 최적화 정보</strong>가 필요합니다.
              </p>
            </div>

            {/* 지금 당장 할 수 있는 1가지 */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 md:px-5 py-4">
              <p className="text-sm font-bold text-amber-700 mb-1">지금 당장 무료로 할 수 있는 1가지</p>
              <p className="text-sm md:text-base font-bold text-gray-900 mb-1">Google 비즈니스 프로필 등록</p>
              <p className="text-sm text-gray-500 mb-3 leading-relaxed">ChatGPT·Google AI는 구글 데이터를 기반으로 가게를 추천합니다. 무료 등록만으로 해외 AI 노출 가능성이 크게 높아집니다. (10분 소요)</p>
              <a
                href="https://business.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between bg-amber-500 text-white rounded-xl px-4 py-2.5 hover:bg-amber-600 transition-colors"
              >
                <span className="text-sm font-bold">Google 비즈니스 프로필 무료 등록 →</span>
                <span className="text-sm opacity-80">무료</span>
              </a>
            </div>

            {/* 지금 가장 약한 부분 */}
            <div className="bg-red-50 border border-red-200 rounded-2xl px-4 md:px-5 py-4">
              <p className="text-sm font-bold text-red-600 mb-1">지금 가장 약한 부분 ({m.weakItem.score}점)</p>
              <p className="text-sm md:text-base font-bold text-gray-900 mb-1.5">{m.weakItem.icon} {m.weakItem.label}</p>
              <p className="text-sm text-gray-600 leading-relaxed mb-2">{m.weakItem.reason}</p>
              <div className="w-full bg-red-100 rounded-full h-2.5 mb-1.5">
                <div className="h-2.5 rounded-full bg-red-400" style={{ width: `${m.weakItem.score}%` }} />
              </div>
              <p className="text-sm text-red-500 leading-relaxed">{m.weakItem.impact}</p>
            </div>

          </div>
          {/* ── 오른쪽 사이드바 끝 ── */}


          {/* ══════════════════════════════════════════════
              왼쪽 메인 콘텐츠 — 상세 분석
          ══════════════════════════════════════════════ */}
          <div className="order-last md:order-first space-y-4 md:space-y-5">

            {/* 손님이 가게를 찾는 과정 */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 md:px-6 py-3 md:py-4 border-b border-gray-100">
                <p className="text-base md:text-lg font-bold text-gray-800">손님이 가게를 찾는 과정</p>
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
                  {m.aiExcerptFail ? (
                    <>
                      <div className="bg-red-50 rounded-xl px-4 py-3 border-l-4 border-red-400 mb-2">
                        <p className="text-sm md:text-base font-semibold text-red-700 mb-1.5">
                          AI가 {m.businessName}를 추천하지 않았습니다
                        </p>
                        <p className="text-sm text-gray-700 leading-relaxed">
                          "{m.query}"으로 Gemini·ChatGPT에 각 50회 질의한 결과,
                          <strong className="text-red-600"> AI 노출 확률 {m.geminiRate}%</strong>입니다.
                          소개글·소식에 구조화된 정보가 없어 AI가 인용할 후보 텍스트를 찾기 어렵습니다.
                        </p>
                      </div>
                      <div className="bg-blue-50 rounded-xl px-4 py-3 border border-blue-100">
                        <p className="text-sm font-semibold text-blue-700 mb-1">소개글 Q&A 섹션 추가 시 기대 효과</p>
                        <p className="text-sm text-blue-600 leading-relaxed">
                          AI는 "Q: 가격이 얼마인가요? A: ..." 형태의 구조화 정보를 인용 후보로 선호합니다.
                          소개글에 Q&A 3~5개를 추가하면 AI 브리핑 후보군 진입 가능성이 올라갑니다.
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="bg-green-50 rounded-xl px-4 py-3 border-l-4 border-green-400 mb-2">
                        <p className="text-sm md:text-base font-semibold text-green-700 mb-1">AI가 "{m.businessName}" 을(를) 추천했습니다</p>
                        <p className="text-sm text-gray-600 leading-relaxed">"{m.aiExcerpt.slice(0, 100)}..."</p>
                        <p className="text-sm font-semibold text-green-700 mt-1.5">
                          Gemini AI 노출 확률: <span className="text-green-800">{m.geminiRate}%</span>
                        </p>
                      </div>
                      <p className="text-sm text-gray-500 leading-relaxed">무료 체험은 ChatGPT 1회 간이 진단입니다. Basic 자동: Gemini·ChatGPT 각 50회 / Full 스캔: 각 100회 측정 (± 오차 범위 표시).</p>
                    </>
                  )}
                  <p className="mt-2 text-xs text-gray-400 leading-relaxed">
                    ChatGPT 측정은 AI 학습 데이터 기반이며 실시간 웹 검색 결과와 다를 수 있습니다.
                    측정 시점·기기·로그인 상태에 따라 달라질 수 있습니다.
                  </p>
                </div>
              </div>
            </div>

            {/* 항목별 분석 */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 md:px-6 py-3 md:py-4 border-b border-gray-100">
                <p className="text-base md:text-lg font-bold text-gray-800">항목별 점수 전체 보기</p>
                <p className="text-sm text-gray-500 mt-0.5">각 항목이 왜 이 점수인지 설명합니다</p>
              </div>
              <div className="divide-y divide-gray-50">
                {Object.entries(m.breakdown).map(([key, item]) => (
                  <div key={key} className="px-4 md:px-6 py-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{item.icon}</span>
                        <span className="text-sm md:text-base font-semibold text-gray-800">{item.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-base md:text-lg font-bold ${item.score >= 70 ? "text-green-600" : item.score >= 40 ? "text-yellow-600" : "text-red-500"}`}>
                          {item.score}점
                        </span>
                        {key === "exposure_freq" && (
                          <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${m.geminiRate === 0 ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-700"}`}>
                            Gemini {m.geminiRate}%
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
                      <div
                        className={`h-2 rounded-full ${item.score >= 70 ? "bg-green-500" : item.score >= 40 ? "bg-yellow-400" : "bg-red-400"}`}
                        style={{ width: `${item.score}%` }}
                      />
                    </div>
                    <p className="text-sm text-gray-500 leading-relaxed">{item.what}</p>
                    <p className={`text-sm mt-1 font-medium leading-relaxed ${item.isLow ? "text-red-500" : "text-green-600"}`}>
                      {item.isLow ? `⚠ ${item.stateMsg}` : `✓ ${item.stateMsg}`}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* 스마트플레이스 체크리스트 */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 md:px-6 py-3 md:py-4 border-b border-gray-100">
                <p className="text-base md:text-lg font-bold text-gray-800">손님이 클릭했을 때 보이는 정보 체크리스트</p>
                <p className="text-sm text-gray-500 mt-0.5">이 정보들이 모두 등록되어 있어야 선택받을 수 있습니다</p>
              </div>
              <div className="divide-y divide-gray-50">
                {m.smartPlaceChecklist.map((item, i) => (
                  <div key={i} className="px-4 md:px-6 py-3 flex items-start gap-3">
                    <span className="mt-0.5 w-5 h-5 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-sm shrink-0">?</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm md:text-base font-semibold text-gray-800">{item.item}</span>
                        <span className={`text-sm px-2 py-0.5 rounded-full font-medium ${
                          item.impact === "high" ? "bg-red-100 text-red-600" :
                          item.impact === "medium" ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-500"
                        }`}>
                          {item.impact === "high" ? "필수" : item.impact === "medium" ? "중요" : "권장"}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">{item.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-4 md:px-6 py-3 bg-blue-50 border-t border-blue-100">
                <p className="text-sm md:text-base text-blue-700 leading-relaxed">구독하면 위 항목들이 실제로 등록되어 있는지 자동으로 점검하고 빠진 항목을 알려드립니다.</p>
              </div>
            </div>

            {/* 구독하면 달라지는 것 */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 md:px-6 py-3 md:py-4 border-b border-gray-100">
                <p className="text-base md:text-lg font-bold text-gray-800">구독하면 이런 정보를 드립니다</p>
              </div>
              <div className="px-4 md:px-6 pt-4 pb-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-sm font-bold text-gray-500 mb-2">지금 (무료 체험)</p>
                    <ul className="space-y-1.5 text-sm text-gray-500">
                      <li>· AI 1개 (ChatGPT)</li>
                      <li>· 검색 1회</li>
                      <li>· 노출 여부만 확인</li>
                      <li>· 점수 추이 없음</li>
                    </ul>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                    <p className="text-sm font-bold text-blue-700 mb-2">구독 후 (Basic 기준)</p>
                    <ul className="space-y-1.5 text-sm text-blue-700">
                      <li>· Gemini+네이버 자동 스캔 매일</li>
                      <li>· 네이버·ChatGPT·Google AI 풀스캔 주 1회 (월요일)</li>
                      <li>· Gemini·ChatGPT 각 50회(총 100회) → 노출 확률(%) + ± 오차 범위</li>
                      <li>· 경쟁사 3개 순위 비교 + 키워드·소개글 텍스트 매주 자동 수집</li>
                      <li>· 경쟁사 6개 차원 갭 분석</li>
                      <li>· 업종 시장 순위·분포 확인</li>
                      <li>· Claude AI 맞춤 개선 가이드</li>
                      <li>· 체크리스트 완료 후 7일간 점수 변화 자동 기록</li>
                    </ul>
                  </div>
                </div>
                <div className="bg-blue-50 rounded-xl px-4 py-4 mb-4">
                  <p className="text-sm md:text-base font-bold text-blue-800 mb-2.5">어떻게 개선하나요? — 4단계 분석 흐름</p>
                  <div className="space-y-2 text-sm md:text-base text-blue-700">
                    <p>📊 <strong>① 내 가게 진단</strong> — 6개 차원 점수 + 채널별 분리 진단</p>
                    <p>🗺️ <strong>② 시장 현황 파악</strong> — 업종·지역 내 순위, 경쟁사 분포</p>
                    <p>🔍 <strong>③ 경쟁사 갭 분석</strong> — 1위 대비 어디서 밀리는지 정확히</p>
                    <p>✅ <strong>④ 맞춤 액션플랜</strong> — Claude AI 가이드 + 체크리스트</p>
                  </div>
                </div>
              </div>
            </div>

          </div>
          {/* ── 왼쪽 메인 콘텐츠 끝 ── */}

        </div>
        {/* ── 2컬럼 레이아웃 끝 ── */}

        {/* ── CTA (전체 너비) ──────────────────────────── */}
        <div className="rounded-2xl overflow-hidden bg-blue-600">
          <div className="px-5 md:px-8 pt-6 pb-5">
            <p className="font-bold text-white text-xl md:text-2xl leading-snug mb-1.5">내 가게는 몇 점일까요?</p>
            {isRealBiz ? (
              <p className="text-sm md:text-base text-white/85 mb-5 leading-relaxed">
                지금 {m.businessName}의 AI 노출 점수는 {m.totalScore}점입니다.<br />
                소개글에 Q&A 5개 추가 후 7일 뒤 점수가 얼마나 올랐는지 자동으로 확인하고 싶다면?
              </p>
            ) : (
              <p className="text-sm md:text-base text-white/75 mb-5">
                업종·지역을 입력하면 1분 안에 무료로 진단해드립니다. 회원가입 없이 바로 확인하세요.
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
            <p className="text-sm md:text-base font-bold text-white/60 mb-3 uppercase tracking-wide">가입 후 이렇게 진행됩니다</p>
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
