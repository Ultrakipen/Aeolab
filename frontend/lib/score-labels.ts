export const SCORE_LABELS: Record<string, string> = {
  // v3.0 항목
  exposure_freq:             "AI 검색 노출",
  review_quality:            "리뷰 평판",
  schema_score:              "온라인 정보 정리",
  online_mentions:           "온라인 언급 수",
  info_completeness:         "기본 정보 완성도",
  content_freshness:         "최근 활동",
  keyword_gap_score:         "키워드 커버리지",
  smart_place_completeness:  "스마트플레이스 완성도",
  naver_exposure_confirmed:  "네이버 AI 노출 확인",
  track1_score:              "네이버 AI 준비 점수",
  track2_score:              "글로벌 AI 준비 점수",
  unified_score:             "통합 AI 노출 점수",
  // v3.1 신규 항목
  keyword_search_rank:       "네이버 키워드 검색 노출",
  blog_crank:                "블로그 생태계 (C-rank 추정)",
  local_map_score:           "지도/플레이스 + 카카오맵",
  ai_briefing_score:         "AI 브리핑 인용",
};

export const SCORE_LABEL_DETAIL: Record<string, { label: string; description: string }> = {
  keyword_search_rank:      { label: "네이버 키워드 검색 노출", description: "키워드별 네이버 검색 순위를 Playwright로 직접 측정합니다" },
  review_quality:           { label: "리뷰 품질", description: "리뷰수·평점·최신성·영수증 리뷰 비중" },
  smart_place_completeness: { label: "스마트플레이스 완성도", description: "등록(40)+소식(20)+소개글(20) 기반, 키워드 매칭 흡수 포함" },
  blog_crank:               { label: "블로그 생태계 (C-rank 추정)", description: "블로그 발행 빈도·외부 인용·업체명 매칭으로 C-rank를 추정합니다" },
  local_map_score:          { label: "지도/플레이스 + 카카오맵", description: "네이버 지도 등록 여부 + 카카오맵 리뷰 수·평점 통합 점수입니다" },
  ai_briefing_score:        { label: "AI 브리핑 인용", description: "실제 네이버 AI 브리핑에 인용 후보로 노출됐는지 확인합니다" },
};
