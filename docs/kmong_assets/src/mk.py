import io, pathlib
OUT = pathlib.Path(__file__).resolve().parent
EXTRA = '''<style>
.mask { position: relative; margin-top: 12px; }
.mask .blur { filter: blur(6px); user-select: none; pointer-events: none; }
.mask .lock { position: absolute; left: 50%; top: 50%; transform: translate(-50%,-50%); background: #14205c; color: #fff; font-size: 21px; font-weight: 800; padding: 9px 20px; border-radius: 999px; white-space: nowrap; box-shadow: 0 4px 14px rgba(20,32,92,.3); }
.mask table, .mask .doc { margin-top: 0; }
.give { background:#eef3ff; border-radius: 12px; padding: 12px 16px; font-size: 21px; font-weight: 700; color:#2b3f9e; line-height: 1.5; margin-top: 12px; }
.give b { color:#14205c; }
</style>'''
HEAD = '<!doctype html><html lang="ko"><head><meta charset="utf-8"><link rel="stylesheet" href="report.css">' + EXTRA + '</head><body><div class="frame">'
FOOT = '<div class="foot2">※ 전달 형태를 보여 드리는 <b>샘플</b>입니다. 가게 이름·순위·문구는 모두 가상이며, 실제 보고서는 주문하신 가게의 진단 결과에 따라 달라집니다. 흐리게 처리된 부분은 구매 후 보고서에 담겨 전달됩니다.</div>'
N = 4


def page(n, label, body):
    cap = '<div class="cap"><div class="k">결과 보고서(PDF) 샘플 · %d/%d · %s</div><div class="ex">샘플 · 가상의 가게</div></div>' % (n, N, label)
    return HEAD + cap + '<div class="paper">' + body + '<div class="pg">%d / %d</div></div>' % (n, N) + FOOT + '</div></body></html>'


def w(name, html):
    io.open(OUT / name, 'w', encoding='utf-8', newline='\n').write(html)


def dots(n, me=False):
    return '<span class="lv%s">' % (' me' if me else '') + ''.join('<i class="on"></i>' if i < n else '<i></i>' for i in range(5)) + '</span>'


def lock(inner, label='구매 후 제공'):
    return '<div class="mask"><div class="blur">%s</div><div class="lock">%s</div></div>' % (inner, label)


# ---------------- 1: 요약 + 포털 검색
b1 = '''
<div class="top"><div><div class="tt">AI 검색 노출 진단 보고서</div><div class="ss">나의 가게 · 홈페이지 · 블로그 · 경쟁 가게 · 구글·제미나이·GPT</div></div><div class="dt">진단 기준일<br>2026. 00. 00.</div></div>
<div class="info"><div><div class="l">가게 이름</div><div class="v">○○ 파스타 (가상)</div></div><div><div class="l">업종 · 지역</div><div class="v">음식점 · 창원 성산구</div></div><div><div class="l">비교 경쟁 가게</div><div class="v">근처 3곳</div></div></div>

<div class="h2">보고서 구성</div>
<div class="chips"><span class="c nu">1 요약·포털 검색</span><span class="c nu">2 나의 가게·블로그</span><span class="c nu">3 경쟁 가게·AI 도구 노출</span><span class="c nu">4 받게 되는 자료</span></div>

<div class="h2">한눈에 보기</div>
<div class="d">단계는 보강 단계 → 개선 중 → 양호 순입니다. 점수 숫자 대신 단계로 표시합니다.</div>
<table>
<tr><th>항목</th><th>단계</th><th>핵심 진단</th></tr>
<tr><td class="b">포털 검색 순위</td><td><span class="st s2">개선 중</span></td><td>대표 검색어 1개는 첫 화면, 나머지 3개는 첫 화면 밖</td></tr>
<tr><td class="b">나의 가게 정보</td><td><span class="st s2">개선 중</span></td><td>소개글은 있으나 소식·FAQ·채팅방 메뉴가 비어 있음</td></tr>
<tr><td class="b">블로그</td><td><span class="st s1">보강 단계</span></td><td>최근 글이 오래되고 홍보 위주, 지역·메뉴 검색어 부족</td></tr>
<tr><td class="b">경쟁 가게 비교</td><td><span class="st s2">개선 중</span></td><td>리뷰·평점은 앞서 있고 검색어·블로그 언급은 뒤처짐</td></tr>
<tr><td class="b">AI 도구 노출</td><td><span class="st s0">확인 전</span></td><td>이번 측정에서는 확인되지 않음 (검색을 켠 화면에서는 다를 수 있음)</td></tr>
<tr><td class="b">홈페이지</td><td><span class="st s1">보강 단계</span></td><td>AI가 읽기 쉬운 가게 정보 코드가 없음</td></tr>
</table>

<div class="h2">포털 검색 순위와 AI 브리핑</div>
<div class="h3">대표 검색어별 포털 지도 순위</div>
<table>
<tr><th>검색어</th><th>순위</th><th>진단</th></tr>
<tr><td class="b">성산구 파스타</td><td><span class="st s3">3번째</span></td><td>첫 화면 안에 노출되고 있습니다.</td></tr>
<tr><td class="b">상남동 맛집</td><td><span class="st s1">첫 화면 밖</span></td><td>첫 화면 밖일 뿐 포털에 없다는 뜻은 아닙니다.</td></tr>
<tr><td class="b">창원 점심</td><td><span class="st s1">첫 화면 밖</span></td><td>첫 화면에서 보이지 않습니다.</td></tr>
<tr><td class="b">창원 브런치</td><td><span class="st s0">확인 전</span></td><td>이번 측정에서 확인하지 못했습니다.</td></tr>
</table>
<div class="h3">포털 AI 브리핑</div>
<div class="d">음식점은 포털 AI 브리핑 대상 업종입니다. 이번 측정에서는 노출이 확인되지 않았습니다. 프랜차이즈는 대상에서 제외됩니다. 노출 조건은 포털이 자주 바꿉니다.</div>
<div class="h3">추천 검색어 (업종·지역 기준)</div>
<div class="chips"><span class="c nu">성산구 파스타</span><span class="c nu">상남동 데이트 맛집</span></div>
<div class="give"><b>구매 후 제공</b> · 추천 검색어 전체 목록과 검색어별 해석·개선 방향</div>
'''
w('09_report_1.html', page(1, '요약·포털 검색', b1))

# ---------------- 2: 나의 가게 + 블로그
b2 = '''
<div class="h2">나의 가게 정보 점검</div>
<div class="d">소개글·소식·FAQ·채팅방 메뉴 중 빠진 곳을 확인합니다.</div>
<table>
<tr><th>항목</th><th>상태</th><th>진단</th><th>함께 제공</th></tr>
<tr><td class="b">소개글</td><td><span class="st s2">개선 중</span></td><td>작성되어 있으나 대표 메뉴·지역 검색어가 없음</td><td class="fx">소개글 초안</td></tr>
<tr><td class="b">소식</td><td><span class="st s1">보강 단계</span></td><td>최근 작성일이 오래됨</td><td class="fx">소식 초안</td></tr>
<tr><td class="b">FAQ</td><td><span class="st s1">보강 단계</span></td><td>등록된 질문 없음</td><td class="fx">FAQ 초안</td></tr>
<tr><td class="b">채팅방 메뉴</td><td><span class="st s1">보강 단계</span></td><td>메뉴 미설정</td><td class="fx">메뉴 초안</td></tr>
<tr><td class="b">리뷰 응대</td><td><span class="st s2">개선 중</span></td><td>아쉬운 리뷰에 응대 문구가 없음</td><td class="fx">응대 문구 초안</td></tr>
</table>
<div class="h3">소개글 초안 (일부 미리보기)</div>
<div class="doc"><span class="lb">소개글 초안</span><br>창원 성산구에서 <em>[대표 메뉴]</em>를 만드는 ○○ 파스타입니다. <em>[영업시간]</em>에 문을 열고,</div>
''' + lock('<div class="doc" style="margin-top:0">점심·저녁 모두 <em>[확인된 메뉴 구성]</em>으로 찾아주세요. 주소와 연락처는 아래 안내를 참고해 주세요. 방문해 주시는 분들께 편안한 식사 시간이 되도록 준비하겠습니다.</div>') + '''
<div class="note">※ [ ]에는 사장님이 확인한 실제 내용을 넣습니다. 가격·시설 등 확인되지 않은 정보는 초안에 넣지 않습니다. 나의 가게 정보의 직접 입력·수정은 포함되지 않습니다.</div>

<div class="h2">블로그 진단</div>
<div class="row3">
<div class="mini"><div class="l">최근 글 작성</div><div class="v">3주 전</div><div class="s">최신성 보강 필요</div></div>
<div class="mini"><div class="l">글 성격</div><div class="v">홍보 위주</div><div class="bar"><i style="width:70%;background:#e0873a"></i><i style="width:30%;background:#4a63c9"></i></div><div class="s" style="color:#6a768d;font-size:18px">홍보형 70% · 정보형 30%</div></div>
<div class="mini"><div class="l">발행 주기</div><div class="v">불규칙</div><div class="s">월 2회 이상 권장</div></div>
</div>
<div class="h3">키워드 커버리지</div>
<div class="d">블로그 제목·본문에서 확인된 검색어와 아직 없는 검색어</div>
<div class="chips"><span class="c ok">✓ 성산구 파스타</span><span class="c ok">✓ 창원 맛집 추천</span><span class="c miss">없음 · 상남동 데이트 맛집</span><span class="c miss">없음 · 창원 점심 맛집</span><span class="c miss">없음 · 창원 브런치</span></div>
<div class="h3">제목 개선안 (일부 미리보기)</div>
<table>
<tr><th>현재 제목</th><th>제안 제목</th></tr>
<tr><td>오늘의 점심 ㅎㅎ</td><td class="fx">성산구 파스타 맛집 추천 | 점심 메뉴 후기</td></tr>
</table>
''' + lock('<table><tr><td>신메뉴 출시!</td><td class="fx">창원 파스타 신메뉴 소개 | 재료와 맛 정리</td></tr><tr><td>주말 영업 안내</td><td class="fx">성산구 주말 점심 | ○○ 파스타 영업 안내</td></tr></table>') + '''
<div class="give"><b>구매 후 제공</b> · 제목 수정안 전체, 검색어를 반영한 다음 글 주제와 글 형식</div>
'''
w('10_report_2.html', page(2, '나의 가게·블로그', b2))

# ---------------- 3: 경쟁 가게 + AI 도구 노출
b3 = '''
<div class="h2">경쟁 가게 비교</div>
<div class="d">근처 경쟁 가게 3곳과 항목별로 비교했습니다. 점 개수는 비교용 상대 수준입니다 (많을수록 충실).</div>
<table>
<tr><th></th><th style="color:#a35a00">내 가게</th><th>경쟁 A</th><th>경쟁 B</th><th>경쟁 C</th></tr>
<tr><td class="b">현재 단계</td><td><span class="st s1">보강 단계</span></td><td><span class="st s3">양호</span></td><td><span class="st s2">개선 중</span></td><td><span class="st s2">개선 중</span></td></tr>
<tr><td class="b">검색어 보유</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td></tr>
<tr><td class="b">소개글·소식 최신성</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td></tr>
<tr><td class="b">리뷰·평점</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td></tr>
<tr><td class="b">블로그 언급</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td></tr>
<tr><td class="b">홈페이지</td><td class="chk n">✕</td><td class="chk y">✓</td><td class="chk n">✕</td><td class="chk y">✓</td></tr>
</table>
<div class="two"><div class="box good"><b>내 가게가 앞서 있어요</b>리뷰·평점</div><div class="box gap"><b>경쟁 가게가 앞서 있어요</b>검색어 보유 · 블로그 언급</div></div>

<div class="h3">검색어 격차 — 경쟁 가게에는 있고 내 가게에는 없는 검색어</div>
<table>
<tr><th>검색어</th><th>보유 가게</th><th>반영 위치 제안</th></tr>
<tr><td class="b">상남동 데이트 맛집</td><td>경쟁 A·B</td><td class="fx">소개글 첫 문장 + 블로그 1번 주제</td></tr>
</table>
''' % (dots(2, True), dots(4), dots(3), dots(2),
       dots(3, True), dots(4), dots(3), dots(1),
       dots(4, True), dots(3), dots(2), dots(3),
       dots(1, True), dots(5), dots(2), dots(3)) + lock('<table><tr><td class="b">창원 점심 맛집</td><td>경쟁 A·C</td><td class="fx">점심 메뉴 소식 + FAQ</td></tr><tr><td class="b">창원 브런치</td><td>경쟁 A</td><td class="fx">블로그 3번 주제</td></tr><tr><td class="b">성산구 단품 파스타</td><td>경쟁 B</td><td class="fx">소개글 메뉴 설명</td></tr></table>') + '''

<div class="h2">AI 도구 질의와 노출</div>
<div class="d">가게 이름을 넣지 않고 "추천해 줘" 질문을 반복해, AI가 내 가게를 스스로 추천하는지 확인합니다.</div>
<table>
<tr><th>질문 (ChatGPT)</th><th>내 가게 언급</th><th>함께 나온 가게</th></tr>
<tr><td class="b">성산구 파스타 맛집 추천해 줘</td><td><span class="st s0">확인되지 않음</span></td><td>경쟁 A · 경쟁 B</td></tr>
<tr><td class="b">창원 점심 파스타 어디가 좋아?</td><td><span class="st s0">확인되지 않음</span></td><td>경쟁 A</td></tr>
<tr><td class="b">상남동 데이트 식사 장소 추천</td><td><span class="st s0">확인되지 않음</span></td><td>경쟁 B · 경쟁 C</td></tr>
</table>
<div class="note">※ 이 측정은 AI의 학습 기억을 바탕으로 하며 실시간 검색 결과와 다를 수 있습니다. 이번 측정에서 확인되지 않았다고 해서 검색을 켠 화면에서도 나오지 않는다는 뜻은 아닙니다. 제미나이는 참고용입니다.</div>
<table>
<tr><th>구글·채널 점검</th><th>결과</th></tr>
<tr><td class="b">구글 AI 개요</td><td><span class="st s0">확인 전</span> 이번 측정에서 노출 확인되지 않음</td></tr>
<tr><td class="b">구글 지도 등록</td><td><span class="st s3">등록됨</span> 평점 표시 확인</td></tr>
<tr><td class="b">주소 표기 (포털↔구글)</td><td><span class="st s1">표기 차이</span> 같은 가게로 인식되도록 맞추는 것을 권장</td></tr>
<tr><td class="b">홈페이지 가게 정보 코드</td><td><span class="st s1">없음</span> 공유 미리보기·모바일 대응은 양호</td></tr>
</table>
'''
w('11_report_3.html', page(3, '경쟁 가게·AI 도구 노출', b3))

# ---------------- 4: 받게 되는 자료
b4 = '''
<div class="h2">구매 후 받게 되는 자료</div>
<div class="d">위 진단 결과에 맞춰, 아래 자료가 보고서에 함께 담깁니다.</div>
<table>
<tr><th>자료</th><th>내용</th></tr>
<tr><td class="b">개선 안내서</td><td>무엇부터 고칠지 우선순위와 적용 위치를 정리</td></tr>
<tr><td class="b">붙여넣는 문구 초안</td><td>소개글 · 소식 · FAQ · 채팅방 메뉴</td></tr>
<tr><td class="b">리뷰 응대 문구 초안</td><td>좋은 리뷰 · 아쉬운 리뷰 상황별</td></tr>
<tr><td class="b">블로그 개선안</td><td>제목 수정안 · 검색어를 반영한 글 주제와 형식</td></tr>
<tr><td class="b">검색어 반영 위치</td><td>경쟁 가게에만 있는 검색어를 어디에 쓸지 정리</td></tr>
<tr><td class="b">홈페이지 자료 (있는 경우)</td><td>AI가 읽기 쉬운 가게 정보 코드와 엑셀 파일</td></tr>
</table>

<div class="h3">개선 안내서 미리보기</div>
''' + lock('<table><tr><th>순서</th><th>할 일</th><th>적용 위치</th><th>난이도</th></tr><tr><td class="b">1</td><td>소개글을 초안으로 교체 (대표 메뉴·지역 검색어)</td><td>포털 지도 소개글</td><td><span class="st s3">쉬움</span></td></tr><tr><td class="b">2</td><td>블로그 기존 제목 수정</td><td>블로그</td><td><span class="st s3">쉬움</span></td></tr><tr><td class="b">3</td><td>소식 첫 글 등록</td><td>포털 지도 소식</td><td><span class="st s3">쉬움</span></td></tr><tr><td class="b">4</td><td>FAQ·채팅방 메뉴 등록</td><td>포털 지도</td><td><span class="st s2">보통</span></td></tr><tr><td class="b">5</td><td>블로그 새 글 작성</td><td>블로그</td><td><span class="st s2">보통</span></td></tr></table>', '구매 후 보고서에서 확인') + '''

<div class="h2">진행 방식</div>
<table>
<tr><th>단계</th><th>내용</th></tr>
<tr><td class="b">1</td><td>대화창으로 가게 정보를 받습니다</td></tr>
<tr><td class="b">2</td><td>점검과 분석을 진행합니다 (영업일 2일 이내)</td></tr>
<tr><td class="b">3</td><td>결과 보고서를 전달하고, 수정과 추가 질문은 대화창에서 2회까지 지원합니다</td></tr>
</table>

<div class="h3">지원 범위</div>
<table>
<tr><th>포함</th><th>불포함</th></tr>
<tr><td>진단 결과, 개선 안내서, 붙여넣는 문구 초안, 수정 2회, 대화창 추가 질문</td><td>노출·순위·매출 상승 약속, 나의 가게 정보 직접 입력·수정, 홈페이지 직접 수정</td></tr>
</table>
<div class="note">※ 개선 효과는 가게 상황과 포털·AI 도구의 변화에 따라 달라지며, 결과를 약속하지 않습니다. 측정 결과는 시점·기기·로그인 상태에 따라 달라질 수 있습니다.</div>
'''
w('12_report_4.html', page(4, '받게 되는 자료', b4))
print('ok')
