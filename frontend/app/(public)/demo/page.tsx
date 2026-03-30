"use client";

import { useState } from "react";
import Link from "next/link";

// ── 업종 / 지역 선택지 ────────────────────────────────────────────────
const CATEGORIES = [
  { value: "restaurant", label: "음식점",      emoji: "🍽️" },
  { value: "cafe",       label: "카페",        emoji: "☕" },
  { value: "beauty",     label: "미용실",      emoji: "💇" },
  { value: "academy",    label: "학원",        emoji: "📚" },
  { value: "clinic",     label: "병원·한의원", emoji: "🏥" },
];

const REGIONS = ["강남구", "홍대·마포", "수원시", "부산 해운대", "대구 중구"];

// ── 업종별 목업 데이터 ────────────────────────────────────────────────
function getMock(category: string, region: string) {
  const benchmarks: Record<string, { avg: number; rank: string }> = {
    restaurant: { avg: 58, rank: "상위 30%" },
    cafe:       { avg: 51, rank: "상위 40%" },
    beauty:     { avg: 48, rank: "상위 35%" },
    academy:    { avg: 53, rank: "상위 45%" },
    clinic:     { avg: 59, rank: "상위 30%" },
  };

  const base = {
    region,
    selectionScore: 55,
    aiMentioned: true,
    isSmartPlace: true,
    isOnKakao: true,
    benchmark: benchmarks[category] ?? benchmarks.restaurant,
    lockedTips: [
      { icon: "🔍", label: "AI 검색 노출 개선 방법",   tip: "100회 반복 검색으로 정확한 노출 확률(%)을 측정합니다." },
      { icon: "⭐", label: "리뷰 평판 개선 방법",       tip: "리뷰 키워드 분석으로 어떤 단어가 AI 추천에 영향을 주는지 확인합니다." },
      { icon: "📋", label: "온라인 정보 정리 방법",     tip: "홈페이지·네이버플레이스·카카오맵에 빠진 정보를 자동으로 찾아드립니다." },
      { icon: "📢", label: "온라인 언급 늘리기",        tip: "어느 플랫폼에서 언급이 많고 적은지, 경쟁사와 비교해 드립니다." },
      { icon: "📍", label: "기본 정보 완성도 높이기",   tip: "어떤 정보가 빠져 있는지 항목별로 체크리스트를 제공합니다." },
      { icon: "🗓️", label: "최근 활동 유지 전략",      tip: "리뷰 요청 타이밍과 콘텐츠 업데이트 주기를 가이드로 제공합니다." },
    ],
    smartPlaceChecklist: [
      { item: "대표 사진 5장 이상",        impact: "high",   reason: "첫인상 결정 — 사진 없으면 클릭 즉시 이탈" },
      { item: "영업시간 (오늘 운영 여부)",  impact: "high",   reason: "\"지금 문 열었나?\" — 미등록 시 경쟁 가게로 이동" },
      { item: "메뉴·가격 정보",            impact: "high",   reason: "\"얼마야?\" — 가격 모르면 방문 결정 못 함" },
      { item: "전화번호·예약 방법",        impact: "medium", reason: "바로 전화/예약 가능해야 선택 확정" },
      { item: "주소·주차 안내",            impact: "medium", reason: "\"어떻게 가나?\" — 네이버 지도 연동 필수" },
      { item: "가게 소개 (키워드 포함)",   impact: "medium", reason: "AI·검색엔진이 이 글을 읽고 추천 여부 결정" },
      { item: "최근 리뷰 답글",            impact: "low",    reason: "사업주 활동성 신호 — AI가 운영 중으로 인식" },
    ],
  };

  const templates: Record<string, object> = {
    restaurant: {
      businessName: `${region} 왕갈비 한우마당`,
      query: `${region} 한우 맛집 추천`,
      aiExcerpt: `${region}에서 한우를 찾는다면 '${region} 왕갈비 한우마당'이 자주 언급됩니다. 신선한 국내산 한우와 넓은 주차공간으로 가족 외식에 적합합니다.`,
      naverRank: 3, blogMentions: 24,
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
        reason: "스마트플레이스가 있지만 독립 웹사이트가 없어 ChatGPT·Google AI가 가게 정보를 찾기 어렵습니다.",
        impact: "이 항목만 개선해도 종합 점수 10~15점 상승 가능" },
      breakdown: {
        exposure_freq:     { label: "AI 검색 노출",     icon: "🔍", score: 58, what: "손님이 AI에 '맛집 추천해줘' 라고 물어봤을 때 내 가게가 답변에 나오는 빈도입니다.", stateMsg: "이번 1회 검색에서 AI가 내 가게를 언급했습니다.", isLow: false },
        review_quality:    { label: "리뷰 평판",        icon: "⭐", score: 72, what: "네이버·카카오맵에 등록된 리뷰 수와 평점입니다.", stateMsg: "리뷰와 평점이 충분해 AI가 신뢰할 수 있는 가게로 인식합니다.", isLow: false },
        schema_score:      { label: "온라인 정보 정리", icon: "📋", score: 45, what: "영업시간·전화번호·위치·메뉴가 인터넷에 얼마나 잘 정리돼 있는지입니다.", stateMsg: "스마트플레이스는 있으나 독립 웹사이트가 없어 글로벌 AI에서 정보를 찾기 어렵습니다.", isLow: true },
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
        impact: "SNS·블로그 업데이트만으로 이 항목 15점 이상 개선 가능" },
      breakdown: {
        exposure_freq:     { label: "AI 검색 노출",     icon: "🔍", score: 51, what: "손님이 AI에 '카페 추천해줘' 라고 물어봤을 때 내 가게가 답변에 나오는 빈도입니다.", stateMsg: "이번 1회 검색에서 AI가 내 카페를 언급했습니다.", isLow: false },
        review_quality:    { label: "리뷰 평판",        icon: "⭐", score: 65, what: "카카오맵·네이버에 등록된 리뷰 수와 평점입니다.", stateMsg: "평점은 양호하지만 경쟁 카페보다 건수가 부족합니다.", isLow: false },
        schema_score:      { label: "온라인 정보 정리", icon: "📋", score: 50, what: "영업시간·메뉴·주소가 인터넷에 얼마나 잘 정리돼 있는지입니다.", stateMsg: "스마트플레이스 등록은 됐으나 메뉴 정보가 부족합니다.", isLow: true },
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
        impact: "블로그 후기 키워드 최적화만으로 6개월 내 상위 2위 진입 가능" },
      breakdown: {
        exposure_freq:     { label: "AI 검색 노출",     icon: "🔍", score: 35, what: "손님이 AI에 '미용실 추천해줘' 라고 물어봤을 때 내 가게가 답변에 나오는 빈도입니다.", stateMsg: "이번 1회 검색에서 AI가 내 미용실을 언급하지 않았습니다.", isLow: true },
        review_quality:    { label: "리뷰 평판",        icon: "⭐", score: 68, what: "네이버·카카오맵에 등록된 리뷰 수와 평점입니다.", stateMsg: "평점은 좋지만 리뷰 수가 경쟁사 대비 적습니다.", isLow: false },
        schema_score:      { label: "온라인 정보 정리", icon: "📋", score: 48, what: "영업시간·시술 메뉴·가격이 인터넷에 얼마나 잘 정리돼 있는지입니다.", stateMsg: "스마트플레이스 등록은 됐으나 시술 메뉴와 가격이 없습니다.", isLow: true },
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
        impact: "학부모 후기 10건 추가 시 AI 추천 확률 약 20% 상승 예상" },
      breakdown: {
        exposure_freq:     { label: "AI 검색 노출",     icon: "🔍", score: 55, what: "학부모가 AI에 '영어학원 추천해줘' 라고 물어봤을 때 내 학원이 답변에 나오는 빈도입니다.", stateMsg: "이번 1회 검색에서 AI가 내 학원을 언급했습니다.", isLow: false },
        review_quality:    { label: "리뷰 평판",        icon: "⭐", score: 63, what: "네이버·카카오맵에 등록된 학부모 리뷰 수와 평점입니다.", stateMsg: "평점이 양호하지만 후기 수가 더 필요합니다.", isLow: false },
        schema_score:      { label: "온라인 정보 정리", icon: "📋", score: 52, what: "커리큘럼·수업료·영업시간이 인터넷에 얼마나 잘 정리돼 있는지입니다.", stateMsg: "기본 정보는 있으나 수업 커리큘럼 정보가 부족합니다.", isLow: true },
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
        impact: "영수증 리뷰 20건 달성 시 리뷰 평판 점수 20점 이상 상승 가능" },
      breakdown: {
        exposure_freq:     { label: "AI 검색 노출",     icon: "🔍", score: 62, what: "환자가 AI에 '한의원 추천해줘' 라고 물어봤을 때 내 병원이 답변에 나오는 빈도입니다.", stateMsg: "이번 1회 검색에서 AI가 내 한의원을 언급했습니다.", isLow: false },
        review_quality:    { label: "리뷰 평판",        icon: "⭐", score: 42, what: "네이버·카카오맵에 등록된 리뷰 수와 영수증 리뷰 비율입니다.", stateMsg: "리뷰 수가 적고 영수증 리뷰(방문 인증)가 없어 AI 신뢰도가 낮습니다.", isLow: true },
        schema_score:      { label: "온라인 정보 정리", icon: "📋", score: 58, what: "진료 항목·예약방법·위치가 인터넷에 얼마나 잘 정리돼 있는지입니다.", stateMsg: "기본 정보는 있으나 진료 항목 상세 정보가 부족합니다.", isLow: false },
        online_mentions:   { label: "온라인 언급 수",   icon: "📢", score: 65, what: "블로그·건강 카페에서 내 병원이 언급된 횟수입니다.", stateMsg: "블로그 15건 — 평균 수준입니다.", isLow: false },
        info_completeness: { label: "기본 정보 완성도", icon: "📍", score: 82, what: "전화번호·주소·진료시간·예약 방법 등 기본 정보 등록 여부입니다.", stateMsg: "기본 정보가 모두 잘 등록되어 있습니다.", isLow: false },
        content_freshness: { label: "최근 활동",        icon: "🗓️", score: 60, what: "가장 최근 리뷰나 게시글이 얼마나 최근인지입니다.", stateMsg: "최근 1개월 내 새 리뷰가 있어 운영 중으로 인식됩니다.", isLow: false },
      },
    },
  };

  return { ...base, ...(templates[category] ?? templates.restaurant) };
}

// ── 유틸 ─────────────────────────────────────────────────────────────
const gradeColor = (g: string) =>
  ({ A: "text-green-500", B: "text-blue-500", C: "text-yellow-500", D: "text-orange-500", F: "text-red-500" }[g] ?? "text-gray-500");

// ── 타입 ─────────────────────────────────────────────────────────────
type BreakdownItem = { label: string; icon: string; score: number; what: string; stateMsg: string; isLow: boolean };
type Mock = ReturnType<typeof getMock>;

export default function DemoPage() {
  const [category, setCategory] = useState("restaurant");
  const [region, setRegion]     = useState("수원시");
  const m = getMock(category, region) as Mock & {
    businessName: string; query: string; aiExcerpt: string;
    naverRank: number; blogMentions: number;
    topCompetitorName: string; topCompetitorBlogCount: number;
    naverCompetitors: { rank: number; name: string; address: string; isMe: boolean }[];
    topBlogs: { title: string; desc: string; dateLabel: string; isOld: boolean }[];
    kakaoRank: number;
    kakaoCompetitors: { rank: number; name: string; isMe: boolean }[];
    totalScore: number; grade: string; naverChannelScore: number;
    weakItem: { label: string; score: number; icon: string; reason: string; impact: string };
    breakdown: Record<string, BreakdownItem>;
    benchmark: { avg: number; rank: string };
  };

  return (
    <main className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-100 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-blue-600">AEOlab</Link>
          <div className="flex items-center gap-3">
            <span className="text-xs bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full font-medium">샘플 결과 화면</span>
            <Link href="/trial" className="text-sm bg-blue-600 text-white px-4 py-1.5 rounded-lg font-medium hover:bg-blue-700 transition-colors">
              내 가게 무료 진단 →
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto py-6 px-4 space-y-4">

        {/* ── 업종·지역 선택기 ─────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm px-5 py-4">
          <p className="text-xs font-semibold text-gray-500 mb-3">내 업종과 지역을 선택하면 비슷한 예시를 보여드립니다</p>

          <div className="mb-3">
            <p className="text-xs text-gray-400 mb-2">업종</p>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setCategory(c.value)}
                  className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                    category === c.value
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
                  }`}
                >
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-gray-400 mb-2">지역</p>
            <div className="flex flex-wrap gap-2">
              {REGIONS.map((r) => (
                <button
                  key={r}
                  onClick={() => setRegion(r)}
                  className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
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

          <p className="text-xs text-gray-300 mt-3">※ 아래 내용은 예시 데이터입니다. 실제 결과는 내 가게 진단 후 확인하세요.</p>
        </div>

        {/* ── 핵심 메시지 ──────────────────────────────────── */}
        <div className="rounded-2xl px-5 py-5 bg-blue-600">
          <p className="text-white/70 text-xs mb-1">{m.businessName} · {m.region} (예시)</p>
          <p className="text-white font-bold text-lg leading-snug mb-3">
            손님에게 일부는 보이지만 경쟁 가게에 밀리고 있습니다
          </p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "AI 검색 노출",  ok: m.aiMentioned,         desc: "AI 답변에 등장" },
              { label: "네이버 지도",   ok: m.naverRank !== null,  desc: `지역 검색 ${m.naverRank}위` },
              { label: "카카오맵",      ok: m.isOnKakao,           desc: `카카오 ${m.kakaoRank}위` },
              { label: "블로그 후기",   ok: m.blogMentions > 5,    desc: `${m.blogMentions}건` },
            ].map((item) => (
              <div key={item.label} className={`rounded-xl px-3 py-2 flex items-center gap-2 ${item.ok ? "bg-white/20" : "bg-black/20"}`}>
                <span className={`text-sm shrink-0 ${item.ok ? "text-white" : "text-white/40"}`}>
                  {item.ok ? "✓" : "✕"}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white/90 leading-tight">{item.label}</p>
                  <p className={`text-xs leading-tight ${item.ok ? "text-white/70" : "text-white/40"}`}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── 손님의 검색 여정 ──────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-800">손님이 가게를 찾는 과정</p>
            <p className="text-xs text-gray-400 mt-0.5">"{m.query}" 로 검색했을 때 예시</p>
          </div>

          {/* STEP 1: 네이버 */}
          <div className="px-5 py-3 border-b border-gray-50">
            <div className="flex items-center gap-2 mb-2.5">
              <span className="w-5 h-5 rounded-full bg-green-600 text-white text-xs font-bold flex items-center justify-center shrink-0">1</span>
              <p className="text-xs font-semibold text-gray-700">네이버 지도·플레이스에서 가게 목록을 봅니다</p>
            </div>
            <div className="space-y-1.5 ml-7">
              {m.naverCompetitors.map((comp) => (
                <div key={comp.rank} className={`flex items-start gap-2.5 rounded-xl px-3 py-2 ${comp.isMe ? "bg-blue-50 border border-blue-200" : "bg-gray-50"}`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                    comp.rank === 1 ? "bg-yellow-300 text-yellow-900" :
                    comp.rank === 2 ? "bg-gray-300 text-gray-700" :
                    comp.rank === 3 ? "bg-orange-200 text-orange-800" : "bg-white text-gray-400 border border-gray-200"
                  }`}>{comp.rank}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-sm font-medium ${comp.isMe ? "text-blue-700" : "text-gray-800"}`}>{comp.name}</span>
                      {comp.isMe && <span className="text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded-full">내 가게</span>}
                    </div>
                    <p className="text-xs text-gray-400 truncate">{comp.address}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 카카오 */}
          <div className="px-5 py-3 border-b border-gray-50">
            <div className="flex items-center gap-1.5 mb-2 ml-7">
              <span className="text-xs font-semibold text-gray-600">카카오맵에서도 같은 키워드로 검색하면:</span>
            </div>
            <div className="space-y-1.5 ml-7">
              {m.kakaoCompetitors.map((comp) => (
                <div key={comp.rank} className={`flex items-start gap-2.5 rounded-xl px-3 py-2 ${comp.isMe ? "bg-yellow-50 border border-yellow-200" : "bg-gray-50"}`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                    comp.rank === 1 ? "bg-yellow-300 text-yellow-900" :
                    comp.rank === 2 ? "bg-gray-300 text-gray-700" : "bg-white text-gray-400 border border-gray-200"
                  }`}>{comp.rank}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-sm font-medium ${comp.isMe ? "text-yellow-800" : "text-gray-800"}`}>{comp.name}</span>
                      {comp.isMe && <span className="text-xs bg-yellow-500 text-white px-1.5 py-0.5 rounded-full">내 가게</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* STEP 2: 블로그 */}
          <div className="px-5 py-3 border-b border-gray-50">
            <div className="flex items-center gap-2 mb-2.5">
              <span className="w-5 h-5 rounded-full bg-green-600 text-white text-xs font-bold flex items-center justify-center shrink-0">2</span>
              <p className="text-xs font-semibold text-gray-700">블로그 후기를 보고 어느 가게를 갈지 결정합니다</p>
            </div>
            <div className="ml-7">
              <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-3 mb-3">
                <p className="text-xs font-bold text-red-700 mb-2.5">후기가 더 많은 경쟁 가게를 선택할 가능성이 높습니다</p>
                <div className="mb-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-blue-700 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" /> 내 가게
                    </span>
                    <span className="text-xs font-bold text-blue-700">{m.blogMentions}건</span>
                  </div>
                  <div className="w-full bg-white rounded-full h-2.5">
                    <div className="h-2.5 rounded-full bg-blue-500" style={{ width: `${Math.round((m.blogMentions / m.topCompetitorBlogCount) * 100)}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-gray-500 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block" /> {m.topCompetitorName} (네이버 1위)
                    </span>
                    <span className="text-xs font-bold text-gray-600">{m.topCompetitorBlogCount}건</span>
                  </div>
                  <div className="w-full bg-white rounded-full h-2.5">
                    <div className="h-2.5 rounded-full bg-gray-400 w-full" />
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-red-100 flex items-center justify-between">
                  <p className="text-xs text-red-500">경쟁 1위보다 {m.topCompetitorBlogCount - m.blogMentions}건 적습니다.</p>
                  <Link href="/trial" className="text-xs font-semibold text-red-600 underline hover:text-red-700 shrink-0 ml-2">내 가게 직접 확인 →</Link>
                </div>
              </div>
              <div className="space-y-1.5">
                {m.topBlogs.map((blog, i) => (
                  <div key={i} className="flex items-start gap-2.5 bg-gray-50 rounded-xl px-3 py-2.5">
                    <span className="text-xs text-gray-400 mt-0.5 shrink-0 font-medium">후기</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 line-clamp-1">{blog.title}</p>
                      <p className="text-xs text-gray-400 line-clamp-1 mt-0.5">{blog.desc}</p>
                      <p className={`text-xs mt-0.5 font-medium ${blog.isOld ? "text-orange-400" : "text-gray-300"}`}>
                        {blog.dateLabel}{blog.isOld && " · 오래된 후기"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* STEP 3: AI */}
          <div className="px-5 py-3">
            <div className="flex items-center gap-2 mb-2.5">
              <span className="w-5 h-5 rounded-full bg-green-600 text-white text-xs font-bold flex items-center justify-center shrink-0">3</span>
              <p className="text-xs font-semibold text-gray-700">ChatGPT·Gemini에 "어디 좋아?" 라고 물어봅니다</p>
            </div>
            <div className="ml-7">
              <div className="bg-green-50 rounded-xl px-3 py-2.5 border-l-4 border-green-400 mb-2">
                <p className="text-xs font-semibold text-green-700 mb-1">✓ AI가 "{m.businessName}" 을(를) 추천했습니다</p>
                <p className="text-xs text-gray-600 leading-relaxed">"{m.aiExcerpt.slice(0, 100)}..."</p>
              </div>
              <p className="text-xs text-gray-400">이번 1회 검색 결과입니다. 구독하면 100회 중 몇 번 나오는지 확률(%)로 측정합니다.</p>
            </div>
          </div>
        </div>

        {/* ── 종합 점수 ────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm px-5 py-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-semibold text-gray-700">AI 노출 종합 점수</p>
            <p className="text-xs text-gray-400">100점 만점</p>
          </div>
          <div className="flex items-end gap-3 mb-3">
            <span className={`text-5xl font-black ${gradeColor(m.grade)}`}>{m.grade}</span>
            <span className="text-3xl font-bold text-gray-900 mb-1">{m.totalScore}점</span>
            <div className="mb-1.5">
              <p className="text-sm text-gray-500 leading-tight">{m.region} {CATEGORIES.find(c => c.value === category)?.label} 평균 <strong>{m.benchmark.avg}점</strong> · <strong>{m.benchmark.rank}</strong></p>
              <p className="text-xs text-gray-400">개선 여지가 있습니다</p>
            </div>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3">
            <div className="h-3 rounded-full bg-yellow-400 transition-all" style={{ width: `${m.totalScore}%` }} />
          </div>
        </div>

        {/* ── 채널 분리 점수 ───────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl shadow-sm px-4 py-4">
            <p className="text-xs font-semibold text-gray-600 mb-0.5">네이버 AI 채널</p>
            <p className="text-xs text-gray-400 mb-3">네이버 브리핑 · 카카오맵</p>
            <div className={`text-3xl font-black mb-1 ${m.naverChannelScore >= 70 ? "text-green-500" : m.naverChannelScore >= 40 ? "text-amber-500" : "text-red-400"}`}>
              {m.naverChannelScore}점
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
              <div className="h-2 rounded-full bg-amber-500" style={{ width: `${m.naverChannelScore}%` }} />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs"><span className="text-green-500">✓</span><span className="text-gray-600">스마트플레이스</span></div>
              <div className="flex items-center gap-1.5 text-xs"><span className="text-green-500">✓</span><span className="text-gray-600">카카오맵</span></div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm px-4 py-4 relative overflow-hidden">
            <p className="text-xs font-semibold text-gray-600 mb-0.5">ChatGPT·Google AI</p>
            <p className="text-xs text-gray-400 mb-3">요즘 손님들이 많이 쓰는 AI</p>
            <div className="select-none pointer-events-none blur-sm">
              <div className="text-3xl font-black text-blue-500 mb-1">??점</div>
              <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
                <div className="h-2 rounded-full bg-blue-400" style={{ width: "45%" }} />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs"><span className="text-gray-300">○</span><span className="text-gray-400">ChatGPT 노출</span></div>
                <div className="flex items-center gap-1.5 text-xs"><span className="text-gray-300">○</span><span className="text-gray-400">Google AI 검색 노출</span></div>
              </div>
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-[1px]">
              <span className="text-xl mb-1">🔒</span>
              <Link href="/trial" className="text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl px-3 py-2 transition-colors text-center">
                내 가게로 확인하기
              </Link>
            </div>
          </div>
        </div>

        {/* 채널 교육 배너 */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <p className="text-xs font-semibold text-amber-800 mb-1">요즘 손님들이 ChatGPT에 맛집 물어보는 거 아시죠?</p>
          <p className="text-xs text-amber-700 leading-relaxed">
            그런데 네이버 스마트플레이스만 관리하면 ChatGPT에서는 내 가게가 안 나옵니다.
            <strong> 네이버는 ChatGPT·Gemini 같은 해외 AI의 접근을 막고 있기 때문</strong>입니다.
            ChatGPT에서 노출되려면 <strong>Google 비즈니스 프로필</strong> 등록이 필요합니다.
          </p>
        </div>

        {/* ── 지금 당장 할 수 있는 1가지 ──────────────────── */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
          <p className="text-xs font-bold text-amber-700 mb-1">지금 당장 무료로 할 수 있는 1가지</p>
          <p className="text-sm font-bold text-gray-900 mb-0.5">Google 비즈니스 프로필 등록</p>
          <p className="text-xs text-gray-500 mb-3">ChatGPT·Google AI는 구글 데이터를 기반으로 가게를 추천합니다. 무료 등록만으로 해외 AI 노출 가능성이 크게 높아집니다. (10분 소요)</p>
          <a
            href="https://business.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between bg-amber-500 text-white rounded-xl px-4 py-2.5 hover:bg-amber-600 transition-colors"
          >
            <span className="text-sm font-bold">Google 비즈니스 프로필 무료 등록 →</span>
            <span className="text-xs opacity-80">무료</span>
          </a>
        </div>

        {/* ── 지금 가장 약한 부분 ──────────────────────────── */}
        <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4">
          <p className="text-xs font-bold text-red-600 mb-1">지금 가장 약한 부분 ({m.weakItem.score}점)</p>
          <p className="text-sm font-bold text-gray-900 mb-1">{m.weakItem.icon} {m.weakItem.label}</p>
          <p className="text-xs text-gray-600 leading-relaxed mb-2">{m.weakItem.reason}</p>
          <div className="w-full bg-red-100 rounded-full h-2 mb-1">
            <div className="h-2 rounded-full bg-red-400" style={{ width: `${m.weakItem.score}%` }} />
          </div>
          <p className="text-xs text-red-500">{m.weakItem.impact}</p>
        </div>

        {/* ── 항목별 분석 ──────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-800">항목별 점수 전체 보기</p>
            <p className="text-xs text-gray-400 mt-0.5">각 항목이 왜 이 점수인지 설명합니다</p>
          </div>
          <div className="divide-y divide-gray-50">
            {Object.entries(m.breakdown).map(([key, item]) => (
              <div key={key} className="px-5 py-4">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{item.icon}</span>
                    <span className="text-sm font-medium text-gray-800">{item.label}</span>
                  </div>
                  <span className={`text-sm font-bold ${item.score >= 70 ? "text-green-600" : item.score >= 40 ? "text-yellow-600" : "text-red-500"}`}>
                    {item.score}점
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5 mb-2">
                  <div
                    className={`h-1.5 rounded-full ${item.score >= 70 ? "bg-green-500" : item.score >= 40 ? "bg-yellow-400" : "bg-red-400"}`}
                    style={{ width: `${item.score}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">{item.what}</p>
                <p className={`text-xs mt-1 font-medium ${item.isLow ? "text-red-500" : "text-green-600"}`}>
                  {item.isLow ? `⚠ ${item.stateMsg}` : `✓ ${item.stateMsg}`}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* ── 구독하면 달라지는 것 ─────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-800">구독하면 이런 정보를 드립니다</p>
          </div>
          <div className="px-5 pt-4 pb-2">
            <div className="grid grid-cols-2 gap-2 text-xs mb-4">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="font-bold text-gray-500 mb-2">지금 (무료 체험)</p>
                <ul className="space-y-1.5 text-gray-500">
                  <li>· AI 1개 (Gemini만)</li>
                  <li>· 검색 1회</li>
                  <li>· 노출 여부만 확인</li>
                  <li>· 점수 추이 없음</li>
                </ul>
              </div>
              <div className="bg-blue-50 rounded-xl p-3 border border-blue-200">
                <p className="font-bold text-blue-700 mb-2">구독 후 (Basic 기준)</p>
                <ul className="space-y-1.5 text-blue-700">
                  <li>· Gemini+네이버 자동 스캔 매일</li>
                  <li>· 8개 AI 전체 스캔 주 1회</li>
                  <li>· 100회 반복 → 노출 확률(%)</li>
                  <li>· 경쟁사 3개 순위 비교</li>
                </ul>
              </div>
            </div>
            <div className="bg-blue-50 rounded-xl px-4 py-3 mb-4">
              <p className="text-xs font-bold text-blue-800 mb-2">어떻게 개선하나요?</p>
              <div className="space-y-1.5 text-xs text-blue-700">
                <p>🗺️ <strong>네이버 스마트플레이스 최적화</strong> — 지역 검색 상위 노출을 위한 키워드·사진·정보를 가이드로 알려드립니다.</p>
                <p>✍️ <strong>블로그 후기 늘리기</strong> — 어떤 키워드로 후기를 유도해야 AI가 더 자주 추천하는지 알려드립니다.</p>
                <p>🤖 <strong>AI 추천 확률 높이기</strong> — 100회 반복 검색으로 실제 노출 확률(%)을 측정하고 매일 추적합니다.</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── 스마트플레이스 체크리스트 ───────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-800">손님이 클릭했을 때 보이는 정보 체크리스트</p>
            <p className="text-xs text-gray-400 mt-0.5">이 정보들이 모두 등록되어 있어야 선택받을 수 있습니다</p>
          </div>
          <div className="divide-y divide-gray-50">
            {m.smartPlaceChecklist.map((item, i) => (
              <div key={i} className="px-5 py-3 flex items-start gap-3">
                <span className="mt-0.5 w-4 h-4 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center text-xs shrink-0">?</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-800">{item.item}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                      item.impact === "high" ? "bg-red-100 text-red-600" :
                      item.impact === "medium" ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-500"
                    }`}>
                      {item.impact === "high" ? "필수" : item.impact === "medium" ? "중요" : "권장"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{item.reason}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="px-5 py-3 bg-blue-50 border-t border-blue-100">
            <p className="text-xs text-blue-700">구독하면 위 항목들이 실제로 등록되어 있는지 자동으로 점검하고 빠진 항목을 알려드립니다.</p>
          </div>
        </div>

        {/* ── CTA ─────────────────────────────────────────── */}
        <div className="rounded-2xl overflow-hidden bg-blue-600">
          <div className="px-5 pt-5 pb-4">
            <p className="font-bold text-white text-lg leading-snug mb-1">내 가게는 몇 점일까요?</p>
            <p className="text-sm text-white/75 mb-4">
              업종·지역을 입력하면 1분 안에 무료로 진단해드립니다. 회원가입 없이 바로 확인하세요.
            </p>
            <Link
              href="/trial"
              className="block w-full bg-white text-blue-700 rounded-xl py-3.5 font-bold text-center hover:bg-blue-50 transition-colors text-sm mb-2"
            >
              내 가게 무료 진단하기 →
            </Link>
            <Link
              href="/signup"
              className="block w-full bg-blue-500 text-white rounded-xl py-2.5 font-medium text-center hover:bg-blue-400 transition-colors text-sm border border-white/20"
            >
              1분 무료 회원가입
            </Link>
            <p className="text-xs text-white/50 text-center mt-2">가입 후 Full 스캔 1회 무료 · 이후 월 9,900원 · 언제든 해지</p>
          </div>
          <div className="bg-black/20 px-5 py-4">
            <p className="text-xs font-bold text-white/60 mb-3 uppercase tracking-wide">가입 후 이렇게 진행됩니다</p>
            <div className="space-y-2.5">
              {[
                { step: "1", label: "1분 회원가입",             desc: "이메일 인증만으로 즉시 시작" },
                { step: "2", label: "가게 등록",                 desc: "방금 입력한 정보 그대로 사용" },
                { step: "3", label: "Full 스캔 1회 무료 제공",    desc: "8개 AI 동시 측정 · 100회 샘플링" },
                { step: "4", label: "이후 매일 자동 스캔",        desc: "Gemini+네이버 매일 / 8개 AI 주 1회" },
              ].map((s) => (
                <div key={s.step} className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-white/20 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{s.step}</span>
                  <div>
                    <p className="text-xs font-semibold text-white/90">{s.label}</p>
                    <p className="text-xs text-white/50">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <Link href="/" className="block w-full border border-gray-200 text-gray-400 py-3 rounded-xl hover:bg-gray-50 text-sm text-center">
          AEOlab 소개 보기
        </Link>

      </div>
    </main>
  );
}
