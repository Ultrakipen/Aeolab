/**
 * 네이버 지도·플레이스 주소에서 숫자 place_id를 추출한다 (무료 체험 "내 가게 주소 붙여넣기").
 * 백엔드 `routers/business.py::_extract_naver_place_id`와 같은 규칙 — 추출 실패 시 오추출 대신 null.
 *
 * 지원: map.naver.com/p/entry/place/{id}, map.naver.com/v5/entry/place/{id},
 *       m.place.naver.com/{업종}/{id}/home, place.naver.com/.../{id}
 * 미지원: naver.me 단축주소(리다이렉트 추적 필요), 검색 결과 주소
 */
export type PlaceUrlParse =
  | { status: "empty" }
  | { status: "ok"; placeId: string }
  | { status: "short"; placeId?: undefined }
  | { status: "invalid"; placeId?: undefined };

export function parseNaverPlaceUrl(raw: string): PlaceUrlParse {
  const s = (raw || "").trim();
  if (!s) return { status: "empty" };
  if (/naver\.me\//i.test(s)) return { status: "short" };
  if (!/naver\.com/i.test(s)) return { status: "invalid" };
  const m = s.match(/place\/(\d{5,15})/) || s.match(/\/(\d{6,15})(?:[/?#]|$)/);
  return m ? { status: "ok", placeId: m[1] } : { status: "invalid" };
}
