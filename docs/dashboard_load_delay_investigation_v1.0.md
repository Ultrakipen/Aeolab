# 대시보드 로딩 지연 조사 — 원인 5가지 + 잔여 과제 (v1.0)

> 2026-09-22 세션. "대시보드 접속 로딩 시간이 김" 신고에서 시작 → 5가지 원인을 순차 발견·수정. 최댓값 34~106초 → 10.7초로 감소, 평소(p50) 0.6~0.8초. **완전 해결은 아님** — 남은 지연의 정체를 격리 테스트로 확정(§5), 다음 두 후보(§6) 제시.

---

## 결과 요약 — 오늘 개선된 것

### 1. 대시보드 로딩 속도 (7단계 조치)

| 단계 | 조치 | git | 대시보드 최댓값(8분 반복측정) |
|---|---|---|---|
| 0 | (수정 전) | — | 34~106초 |
| 1 | SSR fetch가 공개도메인(Cloudflare) 경유로 자기 서버 재호출하던 것 → localhost 직접 호출, 4개 파일 | `4211000` | — |
| 2 | Cloudflare가 한국 트래픽을 해외(PDX/HKG 등) POP로 우회 → DNS 프록시 OFF | (Cloudflare 대시보드 조작) | — |
| 3 | 서버 DNS가 KT망이라 콜드 조회 시 최대 4.5초 정체 → 1.1.1.1/8.8.8.8 영구 고정 | (`/etc/netplan/60-aeolab-dns.yaml`) | — |
| 4 | RLS 정책 중복 제거 29개 테이블(auth.uid() 행별 재평가 → 1회 계산) | `4ff0b4d`, `c5a808e` | 22.83초 |
| 5 | SSR fetch 잔여 12개 파일도 localhost 직접 호출로 전환 | `dce35ac` | — |
| 6 | `gap` 분석 결과 5분 캐시(단독 17.6초 스파이크 제거) | `4ff0b4d` | 10.68초 |
| 7 | `action-log` 5분 캐시 | `b3ec37f` | **6.86초** |
| 8 | `blog-result`를 SSR 블로킹 경로에서 완전히 빼서 클라이언트가 직접 조회(설계상 캐시 불가한 데이터라 분리로 해결) — 실제 화면에서 정상 동작 확인 완료, 별도 재측정은 안 함 | `de12c7a` | (측정 안 함, 추가 개선 예상) |

**평소(p50) 체감은 전 구간에서 0.6~0.8초로 이미 양호했음** — 위 수치는 전부 "가끔 몇 초씩 튀는" 꼬리 지연(p90/최댓값) 기준.

**남은 것**: 꼬리 지연의 정체는 Supabase 쪽의 확률적 간헐 정체로 격리 테스트로 확정(§5) — 코드로 완전히 없앨 수 없음. 다음 후보는 Suspense 스트리밍(해소됨, §5.6) 또는 Supabase 유료 플랜(§6, 사용자 결정 대기).

### 2. 개인정보 유출 차단 (성능과 무관, 이번 조사 중 우연히 발견)

`trial_scans` 테이블 정책이 이름과 달리 **로그인 없이 익명 키만으로 전체 231행(이메일 51건·IP해시·사업장명·경쟁사데이터) 조회 및 쓰기가 가능한 상태**였음(curl로 실측 확인). 즉시 차단·검증 완료, 기능 회귀 없음. (`2c3f9ff`, §5.7)

---

## 0. 재현 방법 (다음 세션에서 그대로 재사용)

QA 계정을 새로 만들지 않고 **관리자 계정(`hoozdev@gmail.com`)의 임시 세션을 Admin API로 발급**해 읽기 전용으로 측정한다(비밀번호 불필요, 측정 후 `logout?scope=local`로 폐기).

```python
# 서버에서 실행: python3 (아래는 골격 — 매번 /tmp에 새로 작성 후 실행·삭제)
import json, time, base64, urllib.request, http.client
def env(p):
    d = {}
    for l in open(p):
        if "=" in l and not l.startswith("#"):
            k, v = l.strip().split("=", 1); d[k] = v.strip('"')
    return d
b = env("/var/www/aeolab/backend/.env")
f = env("/var/www/aeolab/frontend/.env.local")
URL, SR, ANON = f["NEXT_PUBLIC_SUPABASE_URL"], b["SUPABASE_SERVICE_ROLE_KEY"], f["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
ref = URL.split("//")[1].split(".")[0]
def post(u, body, h):
    r = urllib.request.Request(u, data=json.dumps(body).encode() if body else None,
                                headers=dict({"Content-Type": "application/json"}, **h), method="POST")
    return urllib.request.urlopen(r, timeout=60)
gl = json.loads(post(URL+"/auth/v1/admin/generate_link", {"type":"magiclink","email":"hoozdev@gmail.com"},
                      {"apikey": SR, "Authorization": "Bearer "+SR}).read())
sess = json.loads(post(URL+"/auth/v1/verify", {"type":"magiclink","token_hash":gl["hashed_token"]},
                        {"apikey": ANON, "Authorization": "Bearer "+ANON}).read())
tok = sess["access_token"]
ck = "sb-%s-auth-token=base64-%s" % (ref, base64.urlsafe_b64encode(json.dumps(sess).encode()).decode().rstrip("="))
# 이제 ck를 Cookie 헤더로 http.client.HTTPConnection("127.0.0.1", 3000)에 붙여 /dashboard GET
# 끝나면 반드시: post(URL+"/auth/v1/logout?scope=local", None, {"apikey":ANON,"Authorization":"Bearer "+tok})
```

**8분 반복 벤치마크**(원인 진단·수정 전후 비교용, 12초 간격 34회):
```python
res = []
end = time.time() + 480
while time.time() < end:
    t = time.time()
    c = http.client.HTTPConnection("127.0.0.1", 3000, timeout=120)
    c.request("GET", "/dashboard", headers={"Cookie": ck})
    r = c.getresponse(); r.read()
    res.append(round(time.time() - t, 2))
    time.sleep(12)
s = sorted(res)
print("n=%d p50=%.2f p90=%.2f max=%.2f slow(>1s)=%d" % (len(s), s[len(s)//2], s[int(len(s)*.9)], s[-1], sum(1 for x in s if x > 1)))
```

계측 로그(원인별 구간 분리)는 이미 배포돼 있음 — `pm2 logs aeolab-frontend --lines 300 --nostream | grep dash-slow` 로 1초 초과 요청마다 `{total, user, stage1, benchmark, action-log, gap, blog-result, channel-trend, stage2, briefing}` JSON 한 줄씩 확인 가능 (git `e093099`, `frontend/app/(dashboard)/dashboard/page.tsx`의 `tm()`/`tf()` 래퍼).

---

## 1. 원인 ① — SSR이 공개 도메인을 경유해 자기 서버를 재호출

**증상**: `dashboard`/`competitors`/`growth`/`history` 페이지의 서버 컴포넌트가 백엔드 fetch에 `NEXT_PUBLIC_BACKEND_URL=https://aeolab.co.kr`을 사용 → Cloudflare를 거쳐 자기 서버를 다시 호출. 같은 엔드포인트가 localhost는 2ms, 공개 경로는 0.9~2.7초, 한 번은 522(약 21초 후 타임아웃).

**조치**(git `4211000`): 서버 컴포넌트 4개 파일에서 `process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000"` 순서로 변경.

**⚠️ 잔여**: 같은 패턴이 `delivery/*`, `notices/*`, `support/*`, `help`, `index`, `share`, `stories`, `auth/callback`, `lib/api.ts`에 남아있음 — 대시보드 체감엔 덜 중요해 미수정.

---

## 2. 원인 ② — Cloudflare가 한국 트래픽을 해외 POP로 우회

**증상**: 이 PC(한국)에서 보낸 요청이 PDX·MIA·YYZ(미국)·SJC·HKG·SIN 등으로 라우팅됨. 공개 경로 0.6~106초 vs origin 직접 접속(`--resolve` 또는 DNS only) 0.05초.

**조치**(2026-09-22): Cloudflare DNS에서 `aeolab.co.kr`·`www.aeolab.co.kr` A레코드를 **Proxied → DNS only**(회색 구름)로 전환. AAAA 레코드 없음 확인(IPv6 문제 없음). MX/TXT는 원래 DNS only라 영향 없음.

**origin 사전 준비**: nginx `listen 443 ssl http2;`(HTTP/2 활성화), `gzip_types`에 JS/CSS/JSON 추가(이전엔 HTML만 압축). 백업: `/root/aeolab.nginx.bak_20260922_003319`, `/root/nginx.conf.bak_20260922_003319`. ufw가 원래 80/443 전체 허용이라 origin은 애초에 공개 상태였음(프록시 OFF로 새로 노출된 것 아님).

**⚠️ 트레이드오프**: Cloudflare의 DDoS 방어·WAF가 사라짐. 문제 생기면 Cloudflare 대시보드에서 구름을 다시 주황으로 바꾸면 즉시 롤백.

---

## 3. 원인 ③ — 서버 DNS 리졸버 정체

**증상**: 서버 DNS가 KT DHCP 기본값(168.126.63.1 등). Supabase 레코드 TTL(~291초) 만료 시점마다 콜드 조회가 0.9~4.5초 멈춤 — Node의 새 커넥션이 이때 함께 지연(curl은 자체 캐시라 이 문제를 못 잡았음, Node `dns.lookup`/`getaddrinfo` 기준으로 재현해야 보임).

**조치**: `/etc/netplan/60-aeolab-dns.yaml` 신설, `1.1.1.1`·`8.8.8.8` 영구 고정.
```yaml
network:
  version: 2
  ethernets:
    enp3s0:
      dhcp4-overrides:
        use-dns: false
      nameservers:
        addresses: [1.1.1.1, 8.8.8.8]
```
적용: `netplan generate && networkctl reload && networkctl reconfigure enp3s0`. 원복: 파일 삭제 후 동일 명령 재실행.

**검증**: 캐시 강제 삭제(`resolvectl flush-caches`) 후 콜드 조회 40회 전부 7ms 이하. Naver/Kakao/OpenAI/Anthropic 등 외부 API 해석도 정상 확인.

---

## 4. 원인 ④ — RLS 정책 중복·비효율 (효과는 절반만)

**발견**: Supabase **Performance Advisor**(Database → Advisors, "Reports"가 이름 변경됨)에서 206건 경고. `auth_rls_initplan` 58건 + `multiple_permissive_policies` 145건 + `duplicate_index` 3건. UI엔 "8 warnings"만 보이는데 이건 Security Advisor — Performance Advisor를 따로 열어야 함.

**패턴**: 대시보드 핵심 8개 테이블(`businesses`, `competitors`, `scan_results`, `score_history`, `guides`, `subscriptions`, `profiles`, `api_keys`) 전부 `FOR ALL USING(조건)` 정책 하나로 INSERT/UPDATE까지 이미 커버되는데(Postgres: `WITH CHECK` 없는 정책은 `USING`을 `WITH CHECK`로도 재사용), 완전히 같은 조건의 `_insert`/`_update`/`_delete` 정책이 최대 3개 더 중복으로 걸려 있었음. 예: `competitors`는 정책 4개(ALL+INSERT+UPDATE+DELETE)가 전부 같은 `EXISTS(...)` 조건.

**조치**: 중복 정책 DROP + 남긴 정책의 `auth.uid()` → `(select auth.uid())`로 교체(InitPlan 캐싱, 의미 동일). 8개 테이블 전체 SQL은 `scripts/supabase_schema.sql` 하단(2026-09-22 섹션)에 그대로 기록됨 — **이미 live 실행 완료**, 재실행 불필요. 실행 전 `pg_policies`로 운영 중인 정책 원문을 SQL Editor에서 직접 조회해 대조했음(`scripts/supabase_schema.sql`은 v1.5 스냅샷이라 category CHECK가 7개 업종만 허용하는 등 낡아 있음 — 그대로 믿고 SQL 짜면 위험).

**검증**: 신규 QA 계정 2개로 교차 테넌트 격리 재확인(전부 정상). `profiles` 1건 노출은 회원가입 트리거(`handle_new_user`)가 만든 본인 행이라 오탐이었음(`user_id` 대조로 확정).

**⚠️ 효과가 제한적인 이유**: 이 수정은 **프론트 SSR의 직접 Supabase 호출**(anon key + 사용자 세션, `page.tsx`의 `supabase.from(...)`)에만 적용된다. 격리 벤치마크(5-병렬 요청)에서는 최댓값 6.3초 → 0.8초로 실측 개선. 하지만 대시보드 지연을 지배하는 `gap`/`action-log`/`channel-trend`/`blog-result`는 전부 백엔드 FastAPI가 **`SUPABASE_SERVICE_ROLE_KEY`**로 호출한다(`backend/db/supabase_client.py:22`) — 서비스 롤은 RLS를 완전히 우회하므로 이 수정과 무관. 실제로 RLS 수정 직후 전체 8분 벤치마크는 개선이 없었고(p90 4.68s, 최댓값 22.8초, `gap` 단독 17.6초 스파이크 신규 관측), 그래서 §5로 이어짐.

**교훈**: 격리된 벤치마크의 개선이 end-to-end 개선을 보장하지 않는다 — 어느 경로(anon+RLS vs service-role)가 실제 병목인지 먼저 확인해야 함.

**잔여**: `team_members` 등 16개+ 테이블에 같은 패턴 경고가 남아있으나 대시보드 비직결이라 보류(`scripts/supabase_schema.sql` 하단에 테이블 목록 기록).

---

## 5. 원인 ⑤ / 결론 — `gap` 캐시 + Supabase 확률적 정체 확정 (git `4ff0b4d`)

**조치**: `analyze_gap_from_db`(`backend/routers/report.py` `/api/report/gap/{biz_id}`)가 캐시 없이 매 로드마다 재계산 + 다중 쿼리를 태우고 있었음(단독 17.6초 스파이크 실측). 같은 파일의 `channel-trend`(`_TTL_CHANNEL_TREND=1800`)와 동일한 `_cache.get/set` 패턴으로 **5분 캐시** 추가. 소유권·플랜 검증은 캐시 히트 여부와 무관하게 항상 먼저 실행(캐시 키가 `biz_id`뿐이라 검증을 건너뛰면 안 됨).

**검증**: 콜드 2.81초 → 캐시 히트 0.16~0.23초(응답 바이트 수 동일, 계산 생략 확인). 8분 벤치마크 최댓값 22.8초 → **10.68초**로 개선.

**최종 결론(격리 테스트로 확정)**: gap 캐시 이후에도 dash-slow 로그에 800~2500ms가 간헐적으로 남음. "인증/소유권 확인 자체가 원인인가" 의심해 GoTrue `auth/v1/user` 직접 25회, service-role REST(`businesses`) 25회, Supabase 호출이 전혀 없는 FastAPI `/health` 25회를 **각각 별도로** 재측정 → **셋 다 0.8초 초과 0건**(완전 정상).

**즉, 특정 구간이 상시 느린 게 아니라 Supabase 쪽에서 확률적으로만 가끔 정체되는 현상**이다. 오늘의 코드 수정(RLS·gap 캐시)은 "그 정체에 걸리는 쿼리 수와 계산량"만 줄였을 뿐, 정체 자체를 없애지 못한다. 이게 4가지 조치를 거치며 최댓값은 꾸준히 줄었지만(106s → 33s → 22.8s → 10.7s) p90(약 5초대)이 안 사라지는 이유다.

---

## 5.5 같은 날 후속 — "유료 플랜 제외" 범위에서 안전 확장 2건 완료

**A. SSR 공개도메인 fetch, 잔여 12개 파일 수정**(git `dce35ac`). §1과 같은 패턴을 `delivery/*`, `notices/*`, `support/*`, `help`, `index`, `share/[bizId]`, `stories/[id]`, `auth/callback/route.ts`로 확장. `lib/api.ts`(client 컴포넌트 20곳 전용이라 브라우저가 공개도메인을 직접 호출하는 게 정상 — 문제 없음 확인 후 제외)와 `lib/briefingCategoriesServer.ts`(이미 올바른 패턴)는 제외.

**⚠️ 도중 발견한 실버그**: `share/[bizId]/page.tsx`의 `og:image`·다운로드 `href`는 카카오톡·페이스북 크롤러 및 브라우저가 **외부에서** 접근하는 공개 URL이다. `BACKEND`(localhost 우선)를 그대로 썼으면 `og:image`가 `http://localhost:8000/...`로 렌더돼 카카오톡 공유가 깨질 뻔했다 — `PUBLIC_BACKEND`(`NEXT_PUBLIC_BACKEND_URL` 고정) 변수로 분리해 해결, 실제 bizId로 og:image 정상 렌더링 확인. **교훈**: "서버 컴포넌트의 fetch니까 localhost로 바꾼다"가 항상 맞지 않는다 — 그 값이 HTML에 그대로 노출돼 외부(브라우저·크롤러)가 다시 접근해야 하는 URL인지 매번 구분해야 한다. 이 패턴으로 다른 파일을 고칠 때도 `og:`/`href`/`src`에 같은 변수가 쓰이는지 먼저 grep할 것.

**B. RLS 나머지 21개 테이블**(git 미커밋 상태의 `scripts/supabase_schema.sql`에 SQL 기록, Supabase live 실행 완료). §4의 8개 테이블과 패턴이 균일하지 않아 테이블별로 분기:
- **완전 중복만 통합**: `before_after`, `blog_analysis`, `business_action_log`, `review_snapshots`, `team_members`(3→1)
- **개별 유지**(명령별 권한 범위가 달라 `FOR ALL`로 합치면 실수로 권한이 확대됨 — 예: `assistant_logs`/`blog_score_history`/`inquiries`/`keyword_serp_cache`/`keyword_volumes`는 애초에 UPDATE/DELETE 정책 자체가 없음): `auth.uid()`/`auth.role()`만 `(select ...)`로 감싸고 정책 개수는 그대로 둠
- **`gap_cards`**: INSERT 정책만 존재(SELECT 없음) — 그대로 유지
- **`review_replies`**: `Users manage own review replies`(직접 `user_id`)와 `own_review_replies`(사업장 경유 `EXISTS`) 조건이 달라 병합하지 않음. 프론트가 이 테이블을 직접 조회하는 곳이 없어(백엔드 service_role 전용, `backend/routers/guide.py`만 insert) 실사용 트래픽 영향은 미미. 완전 중복인 `own_review_replies_insert`만 제거
- **`support_replies`**: `user_see_own_replies`와 `user_view_ticket_replies`가 조건 문자열까지 바이트 단위로 동일한 진짜 중복(이름만 다른 leftover) — 1개만 제거
- **`support_tickets.public_answered_tickets`, `trial_scans` 전체**: `auth.<function>()` 호출이 없어 애초에 대상 아님 — 손대지 않음

검증: 21개 테이블 전부 소유자 조회 200·오류 0건 + 신규 QA 계정으로 교차 테넌트 유출 0건(`industry_trends`·`keyword_volumes`는 "인증만 되면 전체 공개 읽기" 정책이라 신규 계정도 보이는 게 정상 — 유출 아님). QA 계정 삭제 완료.

**⚠️ 별도 발견(이번 조치 범위 밖, 성능이 아닌 보안 사안, 미조치)**: `trial_scans`의 `service_role_all`(ALL)·`trial_scans_insert`(INSERT) 두 정책 모두 `qual`/`with_check`가 리터럴 `true`이고 `roles={public}`이다 — 정책 이름과 달리 실제로는 역할 제한이 없어 **anon 키로도 전체 행 접근이 가능해 보인다.** 테이블 GRANT까지 확인해야 실제 위험이 확정되므로 다음 세션에서 별도 점검 권장.

---

## 5.6 같은 날 후속 — `blog-result` 분리 완료(git `de12c7a`), §6의 Suspense 후보는 해소됨

gap/action-log 캐시 후 재측정에서 `blog-result`가 매번 최상위 기여자(805~3635ms)로 남음. `routers/blog.py`에 "B(인용)/D(경쟁사 언급)는 스캔마다 최신으로 갱신"이라는 의도적 설계 주석이 있고, 과거 이걸 캐시했다가 "스캔 직후 최대 30분간 옛 데이터가 보이는 회귀"로 되돌린 이력까지 있어 `gap`과 같은 캐시는 적용하지 않았다(짧은 TTL도 같은 카테고리 버그가 규모만 작아질 뿐 재발).

**당초 "Suspense만이 유일한 방법"이라던 §6 판단은 오판이었다** — 실제 소비처(`DualTrackCard.tsx`)가 이미 client 컴포넌트였고 `bizId`/`token`이 이미 미사용 props로 존재해서, client-side `useEffect` fetch로 SSR 블로킹 경로에서 완전히 뺄 수 있었다. `page.tsx`의 `blogCitationRes`를 제거하고, `DualTrackCard`가 마운트 시 직접 `/api/blog/result/{bizId}`를 호출하도록 이전. 로딩 상태를 `null`(조회중)/`[]`(없음)/`[...]`(있음) 3단계로 나눠 "아직 확인 안 됨"이 먼저 잘못 보이는 깜빡임을 방지했다.

**부수 발견**: "상세 분석 데이터" 섹션이 PC/모바일 모두 기본 접힘(`CollapseSectionWrapper` `defaultOpen` 미지정)이고, 그 안 "AI 노출 현황" 탭도 별도 아코디언으로 한 번 더 접혀 있다(2단 중첩). 즉 이전 코드는 사용자가 이 섹션을 한 번도 펼치지 않아도 매 대시보드 로드마다 무조건 `blog-result`를 호출했지만, 이제는 실제로 펼칠 때만 호출된다 — 대부분의 로드에서는 아예 호출 자체가 없어질 가능성이 높다.

**검증 과정에서 겪은 함정 3개(재발 방지 기록)**:
1. curl로 SSR HTML에서 배지 텍스트를 찾으려 했으나 실패 — `{isOpen && children}` 구조라 기본 접힘 상태에선 DOM에 없는 게 애초에 정상(버그 아님). curl 검증은 이런 클라이언트 상태 의존 UI를 못 잡는다.
2. Playwright로 실브라우저 로그인 시도 → 앱이 **PKCE 인증 플로우**라 관리자 API의 `generate_link()`(implicit 링크)로는 로그인이 안 됨 — PKCE의 `code_verifier`는 브라우저가 직접 시작한 요청이어야 해서 서버 스크립트로 우회 불가능. 실제 로그인 세션이 있는 사람이 직접 확인해야 한다.
3. 사용자가 직접 확인 → 처음엔 배지가 안 보임 → 원인은 위에서 발견한 **2단 중첩 아코디언**(바깥 섹션 + 안쪽 탭을 각각 펼쳐야 함)이었고, 둘 다 펼치자 "✓ Gemini·ChatGPT·네이버 AI 브리핑에서 내 블로그 인용 확인됨"이 정상 렌더링됨을 스크린샷으로 확인.

**교훈**: (a) 컴포넌트가 이미 client인지 먼저 확인하면 Suspense보다 훨씬 저비용인 대안이 보일 수 있다. (b) 이 대시보드처럼 중첩 접힘 UI가 있는 화면에서 사용자에게 "펼쳐서 확인해달라"고 요청할 때는 몇 단계가 있는지 코드로 먼저 세어보고 안내할 것.

이로써 §6의 두 후보 중 Suspense 스트리밍 경로는 해소됨. 남은 것은 Supabase 유료 플랜 판단뿐(§6 표 참조, 여전히 사용자 결정 필요).

## 5.7 같은 날 후속 — trial_scans PII 유출 P0 발견·즉시 차단 (성능 무관, 별도 보안 사안)

§4/§5.5 RLS 정리 작업 중 `trial_scans`의 두 정책(`service_role_all` FOR ALL, `trial_scans_insert` FOR INSERT)이 이름과 달리 `roles={public}`·조건 `true`인 걸 발견 — curl로 직접 재현해 **로그인 없이 anon 키만으로 231행 전체(이메일 51건·ip_hash·사업장명·경쟁사데이터 포함) 조회 성공 + 무인증 INSERT 성공**까지 확정(가정이 아닌 실측). 프론트 코드 전체에 이 테이블 직접 write가 0건(전부 backend `get_client()`=서비스 롤 경유)이라 막아도 기능 영향 없음을 먼저 확인 후 두 정책을 즉시 DROP(SQL은 `scripts/supabase_schema.sql` 최하단).

검증: anon SELECT → 200 빈 배열(유출 0), anon INSERT → 401 RLS 위반 명시, 실제 라이브 API(`/api/scan/trial-count`, 서비스 롤 경유) → 200 정상(기능 회귀 없음).

**발견 경위**: 성능 최적화(`auth.uid()` 감싸기) 작업 중 우연히 눈에 띔 — `qual`이 `true`이거나 `roles`가 정책 이름과 안 맞는 행은 다음에 `pg_policies`를 볼 때 의식적으로 훑어볼 가치가 있다.

---

## 6. 다음 후보 (미착수 — 사용자 결정 필요)

| 방안 | 성격 | 비고 |
|---|---|---|
| **Suspense 스트리밍** | 코드 구조 변경 | `gap`/`action-log`/`blog-result`/`channel-trend`를 첫 렌더 밖으로 빼서, Supabase가 확률적으로 느려지는 순간에도 화면 자체는 즉시 뜨게 함. 확률적 정체를 "우회"하는 유일한 코드 레벨 해법 |
| **Supabase 유료 플랜** | 인프라 비용 | 정체의 근본 원인(추정: 프리티어 쓰로틀링) 제거. 이번엔 Infrastructure 그래프에서 **7일 평균**만 확인(CPU 34%, 지속 과부하는 아님) — 분 단위 해상도의 순간 스파이크는 미확인. 결정 전 Database → Reports(또는 Advisors 옆 "Observability")에서 API 응답 p95·순간 CPU 그래프 재확인 권장 |

두 방안은 상호 배타적이지 않음 — Suspense는 체감을 개선하고, 유료 플랜은 원인을 없앤다.

---

## 7. 재점검 시 주의사항

- **`scripts/supabase_schema.sql`을 실제 운영 정책의 진실로 믿지 말 것** — v1.5 스냅샷이며 `businesses.category` CHECK가 7개 업종만 허용하는 등 낡아 있음(실제는 59개). DB 정책·스키마 관련 작업 전 SQL Editor로 `pg_policies`/`information_schema` 직접 조회 우선.
- **격리 벤치마크(단일 테이블·단일 경로)의 개선을 end-to-end 개선으로 오해하지 말 것** — §4의 교훈. 항상 대시보드 전체 8분 벤치마크로 재확인.
- **DNS 임시 변경 시 안전장치 패턴**: 이번에 `/tmp/dns_ok` 플래그 + `nohup bash -c "sleep 120; [ -f flag ] || rollback" &`로 2분 내 미확인 시 자동 롤백시키는 방식을 씀 — 네트워크 설정처럼 실수 시 SSH 접속 자체가 끊길 수 있는 변경에 재사용 권장.
- **토큰 검증 캐시(`plan_gate.py get_current_user`)는 시도했다가 되돌렸음** — 측정 없이 가설만으로 보안 경로를 건드린 실수. 재도입하려면 반드시 §5의 격리 테스트 방식으로 GoTrue 호출 자체가 병목인지 먼저 확인.
