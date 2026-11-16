// 지원사업 화면 로직 시험 — 실행: cd frontend && npm run test:calc (calc.test.mjs 와 함께 실행)
// 기대값은 손으로 센 값이다(코드의 식을 복사하지 않는다).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const src = fs.readFileSync(new URL("../lib/supportBoard.ts", import.meta.url), "utf8");
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const tmp = path.join(os.tmpdir(), `aeolab_support_${process.pid}.mjs`);
fs.writeFileSync(tmp, js);
const S = await import(pathToFileURL(tmp).href);
process.on("exit", () => {
  try {
    fs.unlinkSync(tmp);
  } catch {
    /* 임시 파일 정리 실패는 무시 */
  }
});

const item = (o) => ({
  id: "PBLN_1", title: "공고", url: "u", agency: "경기도", exec_agency: "", field: "경영", sub_field: "", target: "소상공인",
  sbiz_target: true, regions: ["경기"], period_raw: "", start: null, end: null, summary: "", contact: "", created: "2026-11-01", updated: "2026-11-01", ...o,
});

test("한국 시간 오늘: UTC 15:00 이후는 다음 날(11-16 15:00Z = 11-17 00:00 KST)", () => {
  assert.equal(S.todayKst(new Date("2026-11-16T14:59:00Z")), "2026-11-16");
  assert.equal(S.todayKst(new Date("2026-11-16T15:00:00Z")), "2026-11-17");
});

test("남은 일수·D-day: 같은 날 0, 하루 뒤 1, 월 경계, 윤년, 지남", () => {
  assert.equal(S.daysUntil("2026-11-23", "2026-11-16"), 7);
  assert.equal(S.daysUntil("2026-12-01", "2026-11-30"), 1);
  assert.equal(S.daysUntil("2028-03-01", "2028-02-28"), 2); // 2028 은 윤년(2/29 있음)
  assert.equal(S.daysUntil("2026-03-01", "2026-02-28"), 1); // 평년
  assert.equal(S.ddayLabel("2026-11-16", "2026-11-16"), "오늘 마감");
  assert.equal(S.ddayLabel("2026-11-15", "2026-11-16"), "마감");
  assert.equal(S.ddayLabel("2026-11-19", "2026-11-16"), "D-3");
  assert.equal(S.ddayLabel(null, "2026-11-16"), "");
  assert.equal(S.daysUntil("예산 소진시까지", "2026-11-16"), null);
});

test("지역 표기: 10곳 이상 전국, 1~3곳 나열, 4~9곳 외 N곳, 없으면 빈 문자열", () => {
  const all = ["서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종", "경기", "강원"];
  assert.equal(S.regionLabel(all), "전국");
  assert.equal(S.regionLabel(["경기"]), "경기");
  assert.equal(S.regionLabel(["서울", "경기", "인천"]), "서울·경기·인천");
  assert.equal(S.regionLabel(["서울", "경기", "인천", "부산", "대구"]), "서울·경기·인천 외 2곳");
  assert.equal(S.regionLabel([]), "");
});

test("지원사업 필터: 마감 지난 공고 제외(오늘 마감은 포함), 서버 렌더(today 빈 값)에서는 자르지 않음", () => {
  const items = [item({ id: "a", end: "2026-11-15" }), item({ id: "b", end: "2026-11-16" }), item({ id: "c" })];
  const f = { region: "", field: "", sbizOnly: false, q: "" };
  assert.deepEqual(S.filterSupport(items, f, "2026-11-16").map((i) => i.id), ["b", "c"]);
  assert.deepEqual(S.filterSupport(items, f, "").map((i) => i.id), ["a", "b", "c"]);
});

test("지원사업 필터: 지역(전국 공고 포함), 분야, 소상공인 지정 공고만, 검색어", () => {
  const nationwide = ["서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종", "경기", "강원"];
  const items = [
    item({ id: "gg", regions: ["경기"], title: "경기 소상공인 지원" }),
    item({ id: "seoul", regions: ["서울"], field: "금융", agency: "서울특별시" }),
    item({ id: "nat", regions: nationwide, sbiz_target: false, target: "중소기업", field: "금융", agency: "중소벤처기업부" }),
  ];
  const base = { region: "", field: "", sbizOnly: false, q: "" };
  assert.deepEqual(S.filterSupport(items, { ...base, region: "경기" }, "2026-11-16").map((i) => i.id), ["gg", "nat"]);
  assert.deepEqual(S.filterSupport(items, { ...base, field: "금융" }, "2026-11-16").map((i) => i.id), ["seoul", "nat"]);
  assert.deepEqual(S.filterSupport(items, { ...base, sbizOnly: true }, "2026-11-16").map((i) => i.id), ["gg", "seoul"]);
  assert.deepEqual(S.filterSupport(items, { ...base, q: "  경기 " }, "2026-11-16").map((i) => i.id), ["gg"]);
});

test("지원사업 정렬: 마감 임박순(날짜 있는 것 먼저, 없는 것은 갱신 최신순), 최신 등록순", () => {
  const items = [
    item({ id: "t1", updated: "2026-11-10", title: "ㄱ" }),
    item({ id: "d2", end: "2026-12-01", title: "ㄴ" }),
    item({ id: "d1", end: "2026-11-20", title: "ㄷ" }),
    item({ id: "t2", updated: "2026-11-15", title: "ㄹ" }),
  ];
  assert.deepEqual(S.sortSupport(items, "deadline").map((i) => i.id), ["d1", "d2", "t2", "t1"]);
  const created = [item({ id: "x", created: "2026-11-01" }), item({ id: "y", created: "2026-11-09" })];
  assert.deepEqual(S.sortSupport(created, "latest").map((i) => i.id), ["y", "x"]);
});

test("행사: 끝난 것 제외·지역(전국 포함)·유형(@ 분리)·시작일순('상시'는 뒤)", () => {
  const ev = (o) => ({ id: "E", title: "행사", url: "", origin_url: "", area: "서울", type: "교육", field: "", org: "", period_raw: "", start: null, end: null, summary: "", sbiz_mention: false, registered: "", ...o });
  const items = [
    ev({ id: "old", start: "2026-11-01", end: "2026-11-10" }),
    ev({ id: "seoul", start: "2026-11-25", end: "2026-11-25", type: "교육@기타" }),
    ev({ id: "nat", area: "전국", start: "2026-11-18", end: "2026-11-19", type: "세미나/포럼" }),
    ev({ id: "busan", area: "부산", start: "2026-11-20", end: "2026-11-20" }),
    ev({ id: "always", period_raw: "상시" }),
    ev({ id: "yearly", start: "2026-01-01", end: "2026-12-31" }),
  ];
  const f = { region: "", type: "", q: "" };
  const ids = (arr) => arr.map((i) => i.id);
  // 앞으로 열릴 행사(시작일순) → 이미 시작한 진행 중 행사(끝나는 날순) → 날짜 없는 '상시'
  assert.deepEqual(ids(S.sortEvents(S.filterEvents(items, f, "2026-11-16"), "2026-11-16")), ["nat", "busan", "seoul", "yearly", "always"]);
  // 오늘 값이 없으면(서버 렌더) 시작일순
  assert.deepEqual(ids(S.sortEvents(S.filterEvents(items, f, ""))), ["yearly", "old", "nat", "busan", "seoul", "always"]);
  assert.deepEqual(ids(S.filterEvents(items, { ...f, region: "서울" }, "2026-11-16")), ["seoul", "nat", "always", "yearly"]);
  assert.deepEqual(ids(S.filterEvents(items, { ...f, type: "기타" }, "2026-11-16")), ["seoul"]);
  assert.deepEqual(S.eventTypeOptions(items), ["교육", "기타", "세미나/포럼"]);
});

test("갱신 시각: UTC → 한국 시간 표기", () => {
  assert.equal(S.formatKst("2026-11-16T12:58:21+00:00"), "2026-11-16 21:58");
  assert.equal(S.formatKst("2026-11-16T15:30:00+00:00"), "2026-11-17 00:30");
  assert.equal(S.formatKst("이상한값"), "");
  assert.equal(S.formatKst(undefined), "");
});
