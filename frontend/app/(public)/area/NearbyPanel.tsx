"use client";

import { useId, useMemo, useState } from "react";
import { LocateFixed, Search } from "lucide-react";
import {
  filterGroups,
  formatStdrYm,
  groupByLarge,
  sharePct,
  type NearbyPlace,
  type NearbyResult,
} from "@/lib/areaNearby";

// 내 가게 중심 반경 300m 업종 분포. 가게 이름·주소를 찾아 후보에서 고르면(또는 현재 위치) 반경 안 업소를 업종별로 세어 보여 준다.
// 좌표·검색어는 저장하지 않는다. 개별 가게 이름은 서버가 보내지 않는다.
type Status = "idle" | "searching" | "picking" | "loading" | "done" | "error";

async function getJson<T>(url: string): Promise<{ ok: boolean; status: number; data: T | null }> {
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    const data = res.ok ? ((await res.json()) as T) : null;
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

export default function NearbyPanel() {
  const inputId = useId();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [places, setPlaces] = useState<NearbyPlace[]>([]);
  const [picked, setPicked] = useState<NearbyPlace | null>(null);
  const [result, setResult] = useState<NearbyResult | null>(null);
  const [mine, setMine] = useState(""); // 내 업종(소분류 키 "대|중|소")
  const [filter, setFilter] = useState("");

  const loadNearby = async (lon: number, lat: number) => {
    setStatus("loading");
    setMessage("");
    const r = await getJson<NearbyResult>(`/api/area/nearby?lon=${lon}&lat=${lat}`);
    if (!r.ok || !r.data) {
      setStatus("error");
      setMessage(
        r.status === 429
          ? "요청이 너무 잦아요. 1분쯤 뒤에 다시 시도해 주세요."
          : "업소 정보를 불러오지 못했어요. 잠시 뒤에 다시 시도해 주세요."
      );
      return;
    }
    if (!r.data.available) {
      setStatus("error");
      setResult(null);
      setMessage(
        r.data.reason === "daily_limit"
          ? "오늘 조회할 수 있는 횟수를 모두 썼어요. 내일 다시 이용해 주세요."
          : r.data.reason === "ip_limit"
          ? "오늘 새로 조회할 수 있는 장소 수를 넘었어요. 이미 조회한 장소는 다시 볼 수 있고, 새 장소는 내일 조회해 주세요."
          : "공공데이터 응답이 없어 지금은 집계할 수 없어요. 잠시 뒤에 다시 시도해 주세요. (0곳이라는 뜻이 아니에요)"
      );
      return;
    }
    setResult(r.data);
    setMine("");
    setFilter("");
    setStatus("done");
  };

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = q.trim();
    if (text.length < 2) {
      setMessage("가게 이름이나 주소를 두 글자 이상 입력해 주세요.");
      return;
    }
    setStatus("searching");
    setMessage("");
    setResult(null);
    setPicked(null);
    const r = await getJson<{ places: NearbyPlace[] }>(`/api/area/locate?q=${encodeURIComponent(text)}`);
    if (!r.ok || !r.data) {
      setStatus("error");
      setMessage(
        r.status === 429
          ? "요청이 너무 잦아요. 1분쯤 뒤에 다시 시도해 주세요."
          : "위치를 찾지 못했어요. 잠시 뒤에 다시 시도해 주세요."
      );
      return;
    }
    if (r.data.places.length === 0) {
      setStatus("error");
      setMessage("찾는 장소가 없어요. 도로명 주소나 건물 이름으로 다시 검색해 보세요.");
      return;
    }
    setPlaces(r.data.places);
    if (r.data.places.length === 1) {
      setPicked(r.data.places[0]);
      await loadNearby(r.data.places[0].lon, r.data.places[0].lat);
    } else {
      setStatus("picking");
    }
  };

  const choose = async (p: NearbyPlace) => {
    setPicked(p);
    await loadNearby(p.lon, p.lat);
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setStatus("error");
      setMessage("이 브라우저에서는 현재 위치를 쓸 수 없어요. 주소로 검색해 주세요.");
      return;
    }
    setStatus("searching");
    setMessage("");
    setResult(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPicked({ label: "현재 위치", address: "", lon: pos.coords.longitude, lat: pos.coords.latitude });
        void loadNearby(pos.coords.longitude, pos.coords.latitude);
      },
      () => {
        setStatus("error");
        setMessage("위치 사용이 허용되지 않았어요. 주소로 검색해 주세요.");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  };

  const ready = result && result.available ? result : null;
  const large = useMemo(() => (ready ? groupByLarge(ready.groups) : []), [ready]);
  const visible = useMemo(() => (ready ? filterGroups(ready.groups, filter) : []), [ready, filter]);
  const mineGroup = ready?.groups.find((g) => `${g.lcls}|${g.mcls}|${g.scls}` === mine) ?? null;
  const busy = status === "searching" || status === "loading";

  return (
    <section aria-labelledby="nearby-title" className="rounded-2xl border border-blue-200 bg-white p-4 shadow-sm md:p-6">
      <h2 id="nearby-title" className="text-xl font-bold text-gray-900 md:text-2xl">
        우리 가게 반경 300m, 어떤 가게가 몇 곳 있을까
      </h2>
      <p className="mt-2 break-keep text-sm leading-relaxed text-gray-600 md:text-base">
        가게 이름이나 주소를 넣으면 그 자리를 중심으로 걸어서 4~5분 거리(반지름 300m)에 있는 업소를 업종별로 세어 드려요.
      </p>

      <form onSubmit={search} className="mt-4 flex flex-col gap-3 md:flex-row">
        <div className="flex-1">
          <label htmlFor={inputId} className="mb-1 block text-sm font-medium text-gray-800">
            가게 이름 또는 주소
          </label>
          <input
            id={inputId}
            type="text"
            value={q}
            maxLength={60}
            autoComplete="off"
            enterKeyHint="search"
            placeholder="예: 도로명 주소(번지까지) 또는 가게 이름"
            onChange={(e) => setQ(e.target.value)}
            className="min-h-[48px] w-full rounded-lg border border-gray-300 bg-white px-3 text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-2 md:items-end">
          <button
            type="submit"
            disabled={busy}
            className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-5 text-base font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400 md:flex-none"
          >
            <Search className="h-5 w-5" aria-hidden="true" />
            찾기
          </button>
          <button
            type="button"
            onClick={useMyLocation}
            disabled={busy}
            className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 text-base font-medium text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-500 md:flex-none"
          >
            <LocateFixed className="h-5 w-5" aria-hidden="true" />
            내 위치로
          </button>
        </div>
      </form>

      <div role="status" aria-live="polite" className="mt-3 min-h-[1.5rem] text-sm text-gray-700">
        {busy ? "찾는 중이에요…" : null}
        {status === "error" && message ? <span className="text-red-700">{message}</span> : null}
        {status === "idle" && message ? <span className="text-red-700">{message}</span> : null}
      </div>

      {status === "picking" ? (
        <div className="mt-1">
          <p className="text-sm font-medium text-gray-800">어느 곳인가요? 눌러서 선택해 주세요.</p>
          <ul className="mt-2 space-y-2">
            {places.map((p, i) => (
              <li key={`${p.lon}-${p.lat}-${i}`}>
                <button
                  type="button"
                  onClick={() => choose(p)}
                  className="block min-h-[48px] w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-left hover:border-blue-500 hover:bg-blue-50"
                >
                  <span className="block text-base font-semibold text-gray-900">{p.label}</span>
                  {p.address && p.address !== p.label ? <span className="block text-sm text-gray-600">{p.address}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {ready ? (
        <div className="mt-5 space-y-5">
          <div className="rounded-xl bg-blue-50 p-4">
            <p className="text-sm text-gray-700">
              {picked?.label ? <strong className="text-gray-900">{picked.label}</strong> : null} 중심 반경 {ready.radius_m}m
              {formatStdrYm(ready.stdr_ym) ? ` · ${formatStdrYm(ready.stdr_ym)} 기준` : ""}
            </p>
            <p className="mt-1 text-2xl font-bold text-gray-900 md:text-3xl">
              등록된 업소 {ready.counted.toLocaleString("ko-KR")}곳
            </p>
            {!ready.complete ? (
              <p className="mt-2 break-keep text-sm leading-relaxed text-amber-800">
                공공데이터에는 {ready.total.toLocaleString("ko-KR")}곳이 있다고 나오지만 일부만 받아 와서 실제보다 적게 집계됐을 수 있어요.
              </p>
            ) : null}
          </div>

          <div>
            <label htmlFor="nearby-mine" className="mb-1 block text-base font-bold text-gray-900">
              내 업종은 몇 곳일까요?
            </label>
            <select
              id="nearby-mine"
              value={mine}
              onChange={(e) => setMine(e.target.value)}
              className="min-h-[48px] w-full rounded-lg border border-gray-300 bg-white px-3 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 md:max-w-md"
            >
              <option value="">업종을 골라 주세요</option>
              {large.map((l) => (
                <optgroup key={l.lcls} label={`${l.lcls} (${l.count}곳)`}>
                  {l.items.map((g) => (
                    <option key={`${g.lcls}|${g.mcls}|${g.scls}`} value={`${g.lcls}|${g.mcls}|${g.scls}`}>
                      {g.scls} — {g.count}곳
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {mineGroup ? (
              <p className="mt-3 break-keep rounded-lg border border-gray-200 bg-gray-50 p-3 text-base leading-relaxed text-gray-900">
                반경 {ready.radius_m}m 안에 <strong>{mineGroup.scls}</strong>이(가) <strong>{mineGroup.count}곳</strong> 등록돼 있어요
                {sharePct(mineGroup.count, ready.counted) !== null ? ` (전체 업소의 ${sharePct(mineGroup.count, ready.counted)}%)` : ""}.
              </p>
            ) : null}
          </div>

          <div>
            <h3 className="text-base font-bold text-gray-900">큰 갈래별 업소 수</h3>
            <ul className="mt-2 space-y-2">
              {large.slice(0, 8).map((l) => {
                const pct = sharePct(l.count, ready.counted) ?? 0;
                return (
                  <li key={l.lcls}>
                    <div className="flex items-baseline justify-between gap-3 text-sm text-gray-800">
                      <span className="font-medium">{l.lcls}</span>
                      <span>
                        {l.count.toLocaleString("ko-KR")}곳 · {pct}%
                      </span>
                    </div>
                    <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-gray-100" aria-hidden="true">
                      <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.max(pct, 1)}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
            {large.length > 8 ? <p className="mt-2 text-sm text-gray-600">그 밖의 {large.length - 8}개 갈래는 아래 목록에서 볼 수 있어요.</p> : null}
          </div>

          <div>
            <h3 className="text-base font-bold text-gray-900">업종별 업소 수 전체 보기</h3>
            <label htmlFor="nearby-filter" className="sr-only">
              업종 이름으로 찾기
            </label>
            <input
              id="nearby-filter"
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="업종 이름으로 찾기 (예: 치킨, 미용, 학원)"
              className="mt-2 min-h-[48px] w-full rounded-lg border border-gray-300 bg-white px-3 text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 md:max-w-md"
            />
            <div className="mt-3 max-h-96 overflow-y-auto rounded-lg border border-gray-200">
              {visible.length === 0 ? (
                <p className="p-4 text-sm text-gray-600">일치하는 업종이 없어요.</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">반경 안 업종별 업소 수</caption>
                  <thead className="sticky top-0 bg-gray-50 text-gray-700">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-semibold">업종</th>
                      <th scope="col" className="px-3 py-2 text-right font-semibold">업소 수</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {visible.map((g) => (
                      <tr key={`${g.lcls}|${g.mcls}|${g.scls}`}>
                        <td className="px-3 py-2.5 text-gray-900">
                          <span className="font-medium">{g.scls}</span>
                          <span className="block text-gray-600">{g.lcls} · {g.mcls}</span>
                        </td>
                        <td className="px-3 py-2.5 text-right font-medium text-gray-900">{g.count.toLocaleString("ko-KR")}곳</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-gray-700 break-keep">
            <li>소상공인시장진흥공단 상가(상권)정보의 <strong>등록 업소</strong> 수예요. 실제 영업 중인지, 매출이 얼마인지는 알 수 없어요.</li>
            <li>중심에서 반지름 300m의 원 안(직선거리)이라 걸어서 가는 거리·도로 사정과는 달라요. 기준월은 공공데이터가 갱신되는 시점에 따라 두어 달 늦을 수 있어요.</li>
            <li>이 데이터에는 폐업 정보가 없어서 반경 300m의 폐업 현황은 보여 드릴 수 없어요. 구·시 단위 누적 폐업은 아래 지역 선택에서 볼 수 있어요.</li>
            <li>개별 가게 이름은 보여 드리지 않고, 검색한 주소와 위치는 저장하지 않아요.</li>
          </ul>
        </div>
      ) : null}
    </section>
  );
}
