// 반경 300m 업종 분포 화면 계산 시험 — 실행: cd frontend && npm run test:calc
// 기대값은 손으로 센 값이다(코드의 식을 복사하지 않는다).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const src = fs.readFileSync(new URL("../lib/areaNearby.ts", import.meta.url), "utf8");
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const tmp = path.join(os.tmpdir(), `aeolab_nearby_${process.pid}.mjs`);
fs.writeFileSync(tmp, js);
const N = await import(pathToFileURL(tmp).href);
process.on("exit", () => {
  try {
    fs.unlinkSync(tmp);
  } catch {
    /* 임시 파일 정리 실패는 무시 */
  }
});

const g = (lcls, mcls, scls, count) => ({ lcls, mcls, scls, count });
const SAMPLE = [g("음식", "한식", "백반/한정식", 27), g("음식", "비알코올", "카페", 27), g("소매", "종합 소매", "편의점", 20), g("음식", "한식", "치킨", 5), g("서비스", "이용·미용", "미용실", 20)];

test("대분류 묶음: 합계·많은 순·같으면 이름순", () => {
  const r = N.groupByLarge(SAMPLE);
  assert.deepEqual(r.map((x) => [x.lcls, x.count]), [["음식", 59], ["서비스", 20], ["소매", 20]]); // 20 동률은 가나다순(서비스<소매)
  assert.deepEqual(r[0].items.map((x) => x.scls), ["백반/한정식", "카페", "치킨"]); // 27 동률은 가나다순(백<카)
});

test("비중: 20/80=25.0, 1/3=33.3, 분모 0은 null", () => {
  assert.equal(N.sharePct(20, 80), 25);
  assert.equal(N.sharePct(1, 3), 33.3);
  assert.equal(N.sharePct(5, 0), null);
  assert.equal(N.sharePct(0, 10), 0);
});

test("업종 검색: 공백 무시·대중소 어느 쪽이든·없으면 빈 배열", () => {
  assert.equal(N.filterGroups(SAMPLE, "").length, 5);
  assert.deepEqual(N.filterGroups(SAMPLE, "치 킨").map((x) => x.scls), ["치킨"]);
  assert.equal(N.filterGroups(SAMPLE, "한식").length, 2); // 중분류 일치
  assert.equal(N.filterGroups(SAMPLE, "음식").length, 3); // 대분류 일치
  assert.equal(N.filterGroups(SAMPLE, "없는업종").length, 0);
});

test("기준월 표기", () => {
  assert.equal(N.formatStdrYm("202609"), "2026년 9월");
  assert.equal(N.formatStdrYm("202601"), "2026년 1월");
  assert.equal(N.formatStdrYm(null), "");
  assert.equal(N.formatStdrYm("2026"), "");
});
