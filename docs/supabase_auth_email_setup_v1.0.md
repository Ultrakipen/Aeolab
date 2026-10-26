# Supabase 인증 메일 설정 (링크 주소 + 한국어 템플릿) — 2026-10-26

> 배경: 가입 인증 메일이 ① 영어 기본 문구로 오고 ② 인증 링크가 `localhost`로 열렸다(2026-10-26 실제 가입 시험).
> 이 설정은 **Supabase 대시보드에서 사용자가 직접** 한다(서버·코드에서는 바꿀 수 없음).
> 템플릿 원본: `docs/email_templates/` (`confirm_signup.html`, `reset_password.html`, `change_email.html`).

---

## 1. 링크가 localhost로 열리는 문제 — URL 설정

원인: Supabase의 **Site URL이 `http://localhost:3000`**으로 남아 있거나, 가입 화면이 요청한 복귀 주소(`https://aeolab.co.kr/auth/callback?...`)가 **Redirect URLs 허용 목록에 없어서** Supabase가 Site URL로 되돌려 보냄. 코드는 정상(`signup/page.tsx:56` `emailRedirectTo=${location.origin}/auth/callback?next=/onboarding`, `reset-password/page.tsx:22`, 서버 `NEXT_PUBLIC_APP_URL=https://aeolab.co.kr`).

대시보드 → **Authentication → URL Configuration**(메뉴 이름은 개편으로 다를 수 있음):

| 항목 | 값 |
|---|---|
| **Site URL** | `https://aeolab.co.kr` |
| **Redirect URLs** (추가) | `https://aeolab.co.kr/**` , `https://www.aeolab.co.kr/**` |
| (개발용 유지) | `http://localhost:3000/**` |

저장 후 **새로 가입 메일을 받아** 링크가 `aeolab.co.kr`로 돌아오는지 확인(이미 받은 메일의 링크는 바뀌지 않음).

---

## 2. 한국어 인증 메일 템플릿 적용

대시보드 → **Authentication → Emails → Templates**(또는 Email Templates). 템플릿별로 **Subject(제목)** 와 **Message body(본문 HTML)** 를 바꾼다. 본문은 해당 `.html` 파일 **전체**를 붙여넣는다.

| 템플릿 | Subject | 본문 파일 | 사용처 |
|---|---|---|---|
| **Confirm sign up** | `[AEOlab] 이메일 인증을 완료해 주세요` | `confirm_signup.html` | 회원가입 인증 |
| **Reset password** | `[AEOlab] 비밀번호 재설정 안내` | `reset_password.html` | 로그인 화면 ‘비밀번호 재설정’ |
| **Change email address** | `[AEOlab] 이메일 주소 변경을 확인해 주세요` | `change_email.html` | 설정 > 계정에서 이메일 변경(`AccountClient.tsx:69`) |

주의:
- **`{{ .ConfirmationURL }}` · `{{ .Email }}` · `{{ .NewEmail }}` 은 그대로 둔다**(Supabase가 채워 넣는 변수). 지우면 링크가 사라진다.
- 현재 코드에서 쓰지 않는 Magic Link / Invite / Reauthentication 템플릿은 건드리지 않아도 된다. 체험 후 가입 유도 메일은 백엔드가 직접 보내므로(`trial_conversion.py`) 이 설정과 무관.
- 템플릿 저장 후 **Preview**(있다면)로 모양 확인.

---

## 3. 적용 후 확인(시험)

1. **가입한 적 없는** 외부 주소(예: 새 Gmail)로 가입 → 메일 도착(스팸함 포함).
2. 제목이 `[AEOlab] 이메일 인증을 완료해 주세요`, 발신자 `Aeolab <contact@aeolab.co.kr>`.
3. 버튼을 누르면 `https://aeolab.co.kr/…`로 돌아와 온보딩으로 이동, 로그인 상태.
4. 같은 방식으로 **비밀번호 재설정**(로그인 화면 → 비밀번호 재설정) 메일과 링크 확인.
5. 휴대폰 메일 앱(Gmail·네이버 메일)에서 버튼이 보이고 눌리는지 확인.

참고 — 이미 인증을 마친 주소로 가입하면 Supabase가 보안상 **새 메일을 보내지 않는다**(가입 화면에 안내 문구 추가함, git `b6cab93`). 시험은 반드시 새 주소로.

---

## 4. 템플릿 설계 메모

- 표(table) 레이아웃 + 인라인 스타일(이메일 클라이언트 호환), 폭 560px·모바일 가변, 외부 이미지·웹폰트 없음(차단 방지), 본문 14~17px.
- `word-break:keep-all`로 한글 단어 중간 끊김 방지. 라이트 고정(`color-scheme: light only`).
- 버튼이 안 눌릴 때를 위한 **주소 복사 안내**와 링크 텍스트 병기.
- 문구는 확인된 사실만 사용: 인증 후 순서(사업장 등록 → 진단 → 개선점 확인), 만료·미요청 시 안내, 문의 `support@aeolab.co.kr`. 점수·수치·기능 약속 없음.
- 링크는 Supabase가 만든 `…supabase.co/auth/v1/verify?…` 주소를 거쳐 사이트로 돌아온다(표준 방식).
