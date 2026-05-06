"""
AI 브리핑 직접 관리 경로 엔진 (Direct Briefing Path Engine)
모델 엔진 v3.0

핵심 인사이트:
  네이버 AI 브리핑은 고객 리뷰뿐 아니라 사장님이 직접 쓰는
  3가지 텍스트(리뷰 답변 / 소식 / 소개글)도 인용 후보로 사용합니다.

  고객 리뷰는 기다려야 하지만, 이 3가지는 오늘 당장 할 수 있습니다.

[2026-05-01] 스마트플레이스 사장님 Q&A 탭(/qna) 폐기:
  과거 별도 'Q&A 탭'으로 존재하던 사장님 작성 Q&A는 폐기되었으며,
  소개글 안의 Q&A 섹션으로 통합되었습니다. 톡톡 채팅방 메뉴는 챗봇 UI 한정.

경로별 AI 브리핑 영향도:
  A. 리뷰 답변  : 답변에 키워드 포함 → 인용 후보 신호 강화
  B. 소개글 Q&A : 소개글 안에 Q&A 섹션 포함 → 사장님 직접 작성 인용 후보
  C. 소식(공지) : 주 1회 업데이트 → 최신성 점수 + 키워드 커버리지
  D. 소개글 본문: 한 번 설정 → 영구적 키워드 기반 데이터
"""

import re
import logging
import urllib.parse
from datetime import datetime
from typing import Optional
from services.keyword_taxonomy import get_industry_keywords, normalize_category

_logger = logging.getLogger("aeolab")

# 경로별 스마트플레이스 백오피스 딥링크 경로 — naver_place_id 기반 동적 생성
# 정답 형식: https://smartplace.naver.com/bizes/{naver_place_id}/{path}
# [2026-05-01] 스마트플레이스 사장님 Q&A 탭(/qna) 폐기 — `faq` 키 제거.
# Q&A류 콘텐츠는 소개글의 Q&A 섹션 또는 톡톡 채팅방 메뉴로 전환.
_SMARTPLACE_PATHS = {
    "review_response": "reviews",
    "post":            "posts",
    "intro":           "profile",
}
_SMARTPLACE_DASHBOARD = "https://smartplace.naver.com/"
_TALKTALK_PARTNER_DASHBOARD = "https://partner.talk.naver.com/"


def _build_smartplace_url(path_key: str, naver_place_id: str | None) -> str:
    """사장님 백오피스 딥링크 생성. naver_place_id 없으면 대시보드 폴백.

    [2026-05-01] `faq` 키는 제거됨 (스마트플레이스 Q&A 탭 폐기). 호출 시 대시보드 반환.
    """
    path = _SMARTPLACE_PATHS.get(path_key)
    if not path:
        return _SMARTPLACE_DASHBOARD
    if not naver_place_id or not str(naver_place_id).strip():
        return _SMARTPLACE_DASHBOARD
    return f"https://smartplace.naver.com/bizes/{str(naver_place_id).strip()}/{path}"

# 경로별 실행 단계
# [2026-05-01] 스마트플레이스 사장님 Q&A 탭 폐기 대응:
#   - 기존 "faq" 키 제거 → "intro_qa" (소개글 Q&A 섹션) + "talktalk_menu" (톡톡 채팅방 메뉴)로 분리
#   - "직접 인용합니다" 단정 표현 → "인용 후보입니다" 톤다운 (정직성 원칙)
_ACTION_STEPS = {
    "review_response": [
        "1. smartplace.naver.com 접속 → '리뷰 관리' 탭",
        "2. 미답변 리뷰 목록 확인",
        "3. 아래 '준비된 답변 초안' 복사 → 답변 등록",
        "4. 답변에 목표 키워드가 자연스럽게 포함되어 있는지 확인",
    ],
    "intro_qa": [
        "1. smartplace.naver.com 접속 → '업체정보' → '소개글' 항목",
        "2. 소개글 본문 끝에 '[자주 묻는 질문]' 섹션 추가",
        "3. 아래 Q&A를 'Q. 질문 / A. 답변' 형식으로 5개 붙여넣기",
        "4. 저장 — 소개글의 Q&A 섹션은 AI 브리핑 인용 후보 텍스트입니다",
    ],
    "talktalk_menu": [
        "1. partner.talk.naver.com 접속 → '채팅방 메뉴 관리' 메뉴",
        "2. 유형 선택 (아이콘 2단 6개 권장 / 아이콘 1단 3개 / 텍스트 최대 12개)",
        "3. 메뉴별로 메뉴명(6자 이내) + 클릭 동작('메시지 전송' 또는 'URL 실행') 입력",
        "4. 저장 — 톡톡 챗봇 안에서 고객 응대를 자동화합니다 (AI 브리핑 인용과는 별개)",
    ],
    "post": [
        "1. smartplace.naver.com 접속 → '소식' 탭",
        "2. '소식 작성' 버튼 클릭",
        "3. 아래 소식 초안 붙여넣기 (사진 1장 추가 권장)",
        "4. 발행 — 주 1회 이상 업데이트 시 AI 브리핑 최신성 점수 유지",
    ],
    "intro": [
        "1. smartplace.naver.com 접속 → '기본 정보' 탭",
        "2. '소개글' 항목 찾기",
        "3. 아래 소개글로 교체 (최대 500자)",
        "4. 저장 — 한 번만 하면 됩니다",
    ],
}


def _compat_chat_menus(raw) -> list[dict]:
    """talktalk_faq_draft 하위 호환 변환.

    구형 string[] → chat_menus[].link_type 표준 형식으로 정규화.
    새 형식은 그대로 반환.
    """
    if not raw:
        return []
    if isinstance(raw, list):
        # 구형: ["메뉴1", "메뉴2", ...] 또는 [{"name": ..., "link_type": ...}, ...]
        result = []
        for item in raw:
            if isinstance(item, str):
                result.append({"name": item, "link_type": "message", "value": item})
            elif isinstance(item, dict):
                if "link_type" not in item:
                    item = {**item, "link_type": "message"}
                result.append(item)
        return result
    if isinstance(raw, dict):
        menus = raw.get("chat_menus") or []
        return _compat_chat_menus(menus)
    return []


# 업종별 FAQ 답변 템플릿 — 실제 질문에 직접 답하는 형태
# [직접 입력] 또는 [예: ...] 플레이스홀더는 사장님이 직접 채워야 할 부분
_FAQ_TEMPLATES: dict[str, list[dict[str, str]]] = {
    "restaurant": [
        {
            "q": "주차는 가능한가요?",
            "a": "네, 건물 전용 주차장을 운영하여 식사 시간 동안 무료로 이용하실 수 있습니다. 주차장 입구는 [위치]에 있으며, 혼잡한 주말에도 대부분 자리가 있습니다. 만차 시 도보 3분 거리 공영주차장을 안내해 드립니다.",
            "keyword": "주차",
        },
        {
            "q": "예약 없이 방문해도 되나요?",
            "a": "소규모 방문은 당일 방문도 가능하지만, 2인 이상이거나 주말·저녁에는 자리가 없을 수 있습니다. 네이버 예약이나 전화([전화번호])로 미리 예약하시면 원하는 시간에 편하게 자리를 보장받을 수 있습니다.",
            "keyword": "예약",
        },
        {
            "q": "단체 모임이나 회식 가능한가요?",
            "a": "단체 모임을 특별히 환영합니다. 10인 이상 단체는 전용 공간 예약이 가능하며 메뉴 사전 조율과 단체 할인도 도와드립니다. 기업 회식·가족 모임·생일 파티 등 다양한 행사에 적합합니다. 최소 3일 전 예약을 권장드립니다.",
            "keyword": "단체",
        },
        {
            "q": "대표 메뉴가 뭔가요?",
            "a": "저희 대표 메뉴는 [대표 메뉴명]입니다. [특징, 예: 직접 만든 소스와 당일 들어온 신선한 재료만 사용합니다]. 처음 오시는 분께는 [추천 조합]을 가장 많이 권해드립니다.",
            "keyword": "메뉴",
        },
        {
            "q": "포장이나 배달도 되나요?",
            "a": "포장과 배달 모두 가능합니다. 방문 포장은 [준비 시간, 예: 10~15분] 전 연락 주시면 바로 준비해 드립니다. 배달은 [배달 앱명]을 통해 [배달 반경, 예: 3km] 이내로 운영합니다.",
            "keyword": "포장",
        },
    ],
    "cafe": [
        {
            "q": "콘센트·와이파이가 있나요?",
            "a": "모든 테이블에서 무료 와이파이(비밀번호는 주문 시 안내)를 이용하실 수 있습니다. 콘센트는 [위치, 예: 창가 좌석 전체와 2층]에 있어 노트북·태블릿 충전이 편리합니다.",
            "keyword": "와이파이",
        },
        {
            "q": "공부하거나 오래 앉아 있어도 되나요?",
            "a": "공부·재택근무·스터디 모임 환영합니다. 다만 피크 시간대(주말 오후 1~5시)에는 [최소 주문 정책, 예: 2시간마다 1인 1음료]를 부탁드립니다. 조용한 분위기를 위해 통화는 짧게 부탁드립니다.",
            "keyword": "공부",
        },
        {
            "q": "시그니처 음료가 뭔가요?",
            "a": "저희 대표 음료는 [시그니처 음료명]으로, [특징, 예: 직접 볶은 원두와 국내산 재료만 사용]합니다. 처음 오시는 분께 가장 많이 추천드리는 메뉴이며, 온·아이스 모두 가능합니다.",
            "keyword": "시그니처",
        },
        {
            "q": "반려견 동반 입장 가능한가요?",
            "a": "[소형 반려견(5kg 이하)]은 테라스 좌석 한정으로 동반 가능합니다. 목줄 착용 필수이며, 이동장 지참을 권장합니다. 실내는 알레르기 고객을 위해 반려동물 동반이 어렵습니다.",
            "keyword": "반려견",
        },
        {
            "q": "대관이나 단체 예약이 가능한가요?",
            "a": "[최소 인원, 예: 10인 이상] 단체 및 소규모 모임 대관을 운영합니다. 생일파티·스터디·미팅 등 다양하게 이용 가능합니다. 대관 문의는 전화 또는 인스타그램 DM으로 주세요.",
            "keyword": "대관",
        },
    ],
    "beauty": [
        {
            "q": "예약 없이 방문 가능한가요?",
            "a": "당일 워크인도 가능하지만 자리가 없을 수 있습니다. 네이버 예약이나 전화([전화번호])로 미리 예약하시면 원하는 시간대와 원하는 디자이너를 직접 선택하실 수 있습니다. 특히 주말과 공휴일 전날은 조기 마감되는 경우가 많습니다.",
            "keyword": "예약",
        },
        {
            "q": "처음인데 어떤 스타일이 어울릴지 모르겠어요.",
            "a": "걱정하지 않으셔도 됩니다. 예약 후 방문하시면 10~15분 무료 컨설팅을 진행합니다. 얼굴형·피부톤·라이프스타일에 맞춘 스타일을 제안드리며, 레퍼런스 사진을 미리 준비해 오셔도 좋습니다.",
            "keyword": "컨설팅",
        },
        {
            "q": "염색 시술 비용이 어떻게 되나요?",
            "a": "시술 범위와 발색 정도에 따라 다르며, [전체 염색 가격대, 예: 50,000원~], [부분 염색, 예: 30,000원~]으로 운영합니다. 모발 상태에 따라 추가 케어가 필요할 수 있어 방문 전 전화 상담을 권장드립니다.",
            "keyword": "염색",
        },
        {
            "q": "남성 커트도 가능한가요?",
            "a": "남성 커트 전문으로 받아드립니다. 남성 전문 디자이너가 상주하며, [가격, 예: 남성 커트 20,000원~]입니다. 투블럭·테이퍼·가르마 펌 등 최신 트렌드도 가능합니다.",
            "keyword": "남성",
        },
        {
            "q": "손상된 모발도 시술 가능한가요?",
            "a": "가능합니다. 심하게 손상된 경우 추가 케어 시술을 먼저 권장드릴 수 있습니다. 방문 전 전화나 카카오톡으로 현재 모발 상태를 공유해 주시면 적합한 시술 방법을 미리 안내해 드립니다.",
            "keyword": "손상",
        },
    ],
    "clinic": [
        {
            "q": "예약 없이 방문 가능한가요?",
            "a": "당일 접수도 가능하지만 대기 시간이 길 수 있습니다. 네이버 예약 또는 전화([전화번호])로 미리 예약하시면 불필요한 대기 없이 진료받으실 수 있습니다. 오전 10시~12시, 오후 5시~7시는 특히 혼잡합니다.",
            "keyword": "예약",
        },
        {
            "q": "야간 진료나 주말 진료도 하시나요?",
            "a": "[진료 시간, 예: 평일 오전 9시~오후 7시, 토요일 오전 9시~오후 2시] 운영합니다. 공휴일 진료 여부는 네이버 스마트플레이스에서 실시간 확인하실 수 있습니다.",
            "keyword": "진료시간",
        },
        {
            "q": "건강보험 적용이 되나요?",
            "a": "일반 진료·처방은 건강보험이 적용됩니다. 영양수액·미용 목적 시술은 비급여로 운영되며, 항목별 비용은 방문 전 전화 문의 주시면 상세히 안내드립니다.",
            "keyword": "건강보험",
        },
        {
            "q": "어린이도 진료 가능한가요?",
            "a": "[가능 연령, 예: 만 1세 이상 소아 진료 가능합니다]. 성인과 소아 진료를 함께 운영하며, 아이가 편안하게 기다릴 수 있도록 키즈 코너도 마련되어 있습니다.",
            "keyword": "어린이",
        },
        {
            "q": "진료 후 처방전을 바로 받을 수 있나요?",
            "a": "진료 후 즉시 처방전 발급이 가능합니다. 건물 내 또는 도보 2분 거리에 약국이 있어 처방전 수령 후 바로 조제가 가능합니다.",
            "keyword": "처방전",
        },
    ],
    "academy": [
        {
            "q": "처음인데 체험 수업이나 무료 상담이 가능한가요?",
            "a": "등록 전 1회 무료 체험 수업을 제공합니다. 약 50분 동안 실제 수업 방식을 경험해 보신 후 결정하실 수 있습니다. 전화([전화번호]) 또는 네이버 예약으로 신청해 주세요.",
            "keyword": "체험",
        },
        {
            "q": "수업 레벨은 어떻게 되나요?",
            "a": "[입문·기초·중급·고급 4단계]로 운영합니다. 처음 등록 시 15~20분 레벨 테스트로 현재 수준에 맞는 반을 배정해 드립니다. 기존 학원 경험이 있으시면 바로 중급부터 시작도 가능합니다.",
            "keyword": "레벨",
        },
        {
            "q": "수업 중에 그만두면 환불이 되나요?",
            "a": "학원법에 따라 투명하게 운영합니다. [수강 1/3 미만 시 전액 환불, 1/3~1/2 시 50% 환불]이며, 환불 신청 후 영업일 3일 이내에 처리됩니다.",
            "keyword": "환불",
        },
        {
            "q": "수업 빠지면 보강이 가능한가요?",
            "a": "결석 시 당월 내 보강 수업 1회 제공합니다. 사전에 연락 주시면 다른 시간대 수업 합류나 온라인 수업으로 대체도 가능합니다.",
            "keyword": "보강",
        },
        {
            "q": "성인도 수강 가능한가요?",
            "a": "물론입니다. 10대부터 60대 이상까지 다양한 연령층이 함께 수강합니다. 성인반은 취미와 실력 향상을 동시에 추구하는 방향으로 진행하며 부담 없이 즐길 수 있습니다.",
            "keyword": "성인",
        },
    ],
    "fitness": [
        {
            "q": "처음인데 1일 체험이나 시설 투어가 가능한가요?",
            "a": "등록 전 1일 체험([가격, 예: 10,000원])으로 시설 전체를 이용해 보실 수 있습니다. 체험 당일 트레이너가 30분 무료 상담도 진행합니다. 방문 전 전화([전화번호])로 연락 주세요.",
            "keyword": "체험",
        },
        {
            "q": "1:1 개인 PT도 가능한가요?",
            "a": "1:1 개인 PT를 운영합니다. [PT 10회 OO원, 20회 OO원]이며, 체형 분석과 목표에 맞는 맞춤 프로그램을 제공합니다. 다이어트·근력 강화·재활 목적 모두 가능합니다.",
            "keyword": "PT",
        },
        {
            "q": "운동을 완전 처음 시작하는데 어렵지 않을까요?",
            "a": "전혀 어렵지 않습니다. 초보자도 안전하게 시작할 수 있도록 입문자 전용 기초 프로그램을 운영합니다. 처음엔 기구 사용법부터 차근차근 알려드리며, 혼자서도 운동할 수 있도록 도와드립니다.",
            "keyword": "초보",
        },
        {
            "q": "샤워 시설이 잘 되어 있나요?",
            "a": "남녀 구분된 샤워실과 탈의실이 있으며, 드라이어는 구비되어 있습니다. 수건은 [개인 지참 또는 유료 대여 가능]합니다.",
            "keyword": "샤워",
        },
        {
            "q": "회원권 종류가 어떻게 되나요?",
            "a": "[1개월·3개월·6개월·12개월] 권종으로 운영합니다. 장기 결제 시 최대 30% 할인이 적용됩니다. 학생·경로 할인도 있으니 방문 시 문의해 주세요.",
            "keyword": "회원권",
        },
    ],
    "pet": [
        {
            "q": "예약 없이 방문 가능한가요?",
            "a": "당일 예약은 전화([전화번호])로 가능합니다. 다만 주말과 공휴일은 예약이 꽉 차는 경우가 많아 최소 2~3일 전 예약을 권장합니다. 네이버 예약으로도 편하게 잡으실 수 있습니다.",
            "keyword": "예약",
        },
        {
            "q": "처음 미용인데 겁먹은 아이도 괜찮을까요?",
            "a": "미용에 예민한 반려동물은 첫 방문 시 충분히 친해지는 시간을 먼저 갖습니다. 강제로 진행하지 않으며, 스트레스 최소화를 최우선으로 합니다. 보호자 분이 함께 옆에 계셔도 됩니다.",
            "keyword": "예민",
        },
        {
            "q": "미용이 끝나면 어떻게 알려주시나요?",
            "a": "미용이 완료되면 문자 또는 카카오톡으로 바로 알려드립니다. 원하시면 미용 완료 사진도 함께 보내드립니다. 픽업 시간은 여유 있게 설정해 주시면 더욱 꼼꼼히 마무리해 드립니다.",
            "keyword": "알림",
        },
        {
            "q": "대형견도 미용 가능한가요?",
            "a": "[대형견(30kg 미만)은 예약 후 가능합니다]. 대형견은 전용 미용 테이블과 장비를 사용하며, 안전을 위해 2인이 함께 진행합니다. 30kg 이상은 방문 전 전화 상담이 필요합니다.",
            "keyword": "대형견",
        },
        {
            "q": "목욕만 따로 가능한가요?",
            "a": "목욕·드라이 단독 시술도 가능합니다. [소형견 기준 목욕 20,000원~]이며, 귀 청소·발톱 정리도 추가 가능합니다. 미용 없이 청결만 유지하고 싶은 분들께 인기가 많습니다.",
            "keyword": "목욕",
        },
    ],
    "music": [
        {
            "q": "음악을 완전 처음 배우는데 시작할 수 있을까요?",
            "a": "물론입니다. 악보를 전혀 못 읽어도, 악기 경험이 없어도 시작 가능합니다. 기초 음악 이론과 청음부터 시작하는 커리큘럼을 운영하며, 첫 수업에서 간단한 곡을 직접 만들어 보실 수 있습니다.",
            "keyword": "기초",
        },
        {
            "q": "성인 취미로 배우기에도 적합한가요?",
            "a": "물론입니다. 10대부터 50대 이상까지 다양한 분들이 수강합니다. 입시나 전공 목적이 아닌 취미 수업도 충분히 운영하며, 본인 속도에 맞춰 즐겁게 배울 수 있도록 커리큘럼을 개별 조정해 드립니다.",
            "keyword": "취미",
        },
        {
            "q": "1:1 수업과 그룹 수업 중 어느 것이 더 나은가요?",
            "a": "목적에 따라 다릅니다. 빠른 실력 향상을 원하신다면 1:1 레슨이 효과적이고, 동료들과 함께 즐기며 배우고 싶다면 그룹 수업이 좋습니다. 처음에는 1:1로 기초를 잡은 후 그룹으로 전환하는 분들도 많습니다.",
            "keyword": "1:1",
        },
        {
            "q": "내가 만든 곡을 실제로 녹음할 수 있나요?",
            "a": "[자체 녹음실에서 직접 만든 곡을 녹음할 수 있습니다]. 프로페셔널 장비와 방음 시설을 갖추고 있어 고품질 데모 음원 제작이 가능합니다. 완성된 음원은 SNS나 포트폴리오에 바로 활용하실 수 있습니다.",
            "keyword": "녹음",
        },
        {
            "q": "수업료가 어느 정도 되나요?",
            "a": "[1:1 레슨은 월 OO원, 그룹 수업은 월 OO원]입니다. 첫 달은 체험 할인가로 진행합니다. 입시·취미·프로 데뷔 준비 등 목적에 따라 커리큘럼과 비용이 달라지므로 무료 상담 후 결정하실 수 있습니다.",
            "keyword": "수업료",
        },
    ],
    "default": [
        {
            "q": "영업시간이 어떻게 되나요?",
            "a": "[평일 오전 9시~오후 6시] 운영합니다. 주말·공휴일 운영 여부는 네이버 스마트플레이스에서 실시간 확인하시거나 전화([전화번호])로 문의해 주세요. 영업 시간 변동 시 사전에 공지합니다.",
            "keyword": "영업시간",
        },
        {
            "q": "주차는 가능한가요?",
            "a": "[건물 앞 무료 주차 이용 가능]합니다. 주차 공간이 부족할 경우 인근 공영주차장을 안내해 드립니다. 방문 전 전화주시면 상세히 안내해 드립니다.",
            "keyword": "주차",
        },
        {
            "q": "처음 방문인데 어떻게 이용하면 되나요?",
            "a": "처음 방문하시는 분들을 위해 방문 즉시 직원이 자세하게 안내해 드립니다. 궁금한 점은 전화 또는 카카오톡 채널로 미리 문의하셔도 됩니다. 첫 방문 혜택도 있으니 꼭 말씀해 주세요.",
            "keyword": "처음",
        },
        {
            "q": "예약이 필요한가요?",
            "a": "예약 우선으로 운영하지만 당일 워크인도 가능합니다. 원하는 시간과 서비스를 확실하게 이용하시려면 네이버 예약 또는 전화([전화번호])로 미리 예약하시는 것을 권장드립니다.",
            "keyword": "예약",
        },
    ],
    # 폼 25개 업종 추가 (2026-04-23) — 신규 4종 FAQ 템플릿
    "pharmacy": [
        {
            "q": "처방전 없이 살 수 있는 약은 어떤 게 있나요?",
            "a": "감기약·진통제·소화제·연고 등 일반의약품은 처방전 없이 구입 가능합니다. 증상을 말씀해 주시면 약사가 직접 적합한 약을 안내해 드립니다. 복용 중인 다른 약이 있다면 함께 알려 주세요.",
            "keyword": "일반의약품",
        },
        {
            "q": "심야·휴일에도 영업하시나요?",
            "a": "[평일 오전 9시~밤 10시], [주말은 오전 10시~오후 8시] 영업합니다. 공휴일과 심야 운영 여부는 네이버 스마트플레이스에서 실시간 확인하실 수 있습니다.",
            "keyword": "심야",
        },
        {
            "q": "복약 지도는 따로 비용이 드나요?",
            "a": "복약 지도와 약사 상담은 무료입니다. 약 복용법·부작용·다른 약과의 상호작용 등 궁금한 점을 자세히 설명해 드립니다. 처방전 조제 시 자동 진행됩니다.",
            "keyword": "복약지도",
        },
        {
            "q": "건강기능식품·영양제도 추천받을 수 있나요?",
            "a": "비타민·오메가3·프로바이오틱스 등 다양한 건강기능식품을 취급하며, 약사가 직접 체질·연령·복용 중인 약과 상호작용을 고려해 추천해 드립니다. 무료 상담 가능합니다.",
            "keyword": "영양제",
        },
        {
            "q": "약 배달이나 예약 픽업도 되나요?",
            "a": "[처방전 사진을 카카오톡으로 보내주시면 미리 조제해 두어 픽업 시간을 단축]해 드립니다. 일부 일반의약품은 [배달 가능], 자세한 사항은 전화([전화번호])로 문의 주세요.",
            "keyword": "픽업",
        },
    ],
    "realestate": [
        {
            "q": "어떤 종류의 매물을 주로 다루시나요?",
            "a": "[아파트 매매·전세·월세, 오피스텔, 원룸, 상가] 등을 전문으로 합니다. 특히 [지역 단지] 위주로 매물 보유가 많습니다. 원하는 조건을 말씀해 주시면 맞춤 매물을 빠르게 찾아드립니다.",
            "keyword": "매물",
        },
        {
            "q": "중개 수수료는 어떻게 되나요?",
            "a": "법정 요율 기준으로 받으며, 거래 금액에 따라 다릅니다. 자세한 수수료는 매물 확인 후 정확하게 안내해 드리며, 협의도 가능합니다. 계약 전 서면으로 명확히 알려드립니다.",
            "keyword": "수수료",
        },
        {
            "q": "주말·저녁에도 매물 보러 갈 수 있나요?",
            "a": "주말과 평일 저녁 모두 가능합니다. 직장인 분들을 위해 야간·주말 현장 동행을 자주 진행하고 있습니다. 사전에 전화([전화번호])로 시간 약속하시면 됩니다.",
            "keyword": "주말",
        },
        {
            "q": "대출이나 법무 상담도 도와주시나요?",
            "a": "거래 전 과정에서 [대출 상담사·법무사 연계]가 가능합니다. 처음 거래하시는 분도 안심하고 진행하실 수 있도록 모든 과정을 함께 챙겨 드립니다.",
            "keyword": "대출",
        },
        {
            "q": "이 지역 학군이나 시세는 어떻게 되나요?",
            "a": "지역 토박이 공인중개사로서 [학군·교통·생활 인프라·시세 추이]를 정확히 안내해 드립니다. 매수·매도 결정에 필요한 정보를 객관적인 데이터와 함께 설명드립니다.",
            "keyword": "학군",
        },
    ],
    "interior": [
        {
            "q": "견적은 어떻게 받을 수 있나요?",
            "a": "전화([전화번호]) 또는 카카오톡으로 평수·시공 범위·예산을 알려주시면 1차 견적을 무료로 안내해 드립니다. 정확한 견적은 [현장 무료 방문] 후 제공하며, 추가 비용 없이 진행됩니다.",
            "keyword": "견적",
        },
        {
            "q": "공사 기간은 얼마나 걸리나요?",
            "a": "[전체 리모델링은 3~5주, 부분 시공(욕실·주방)은 1~2주] 정도 소요됩니다. 정확한 기간은 평수와 시공 범위에 따라 달라지며, 견적 시 일정표와 함께 안내해 드립니다.",
            "keyword": "공사기간",
        },
        {
            "q": "AS는 얼마나 보장되나요?",
            "a": "시공 완료 후 [1년 무상 AS]를 보장합니다. 시공 중 사용한 자재·시공 부위 모두 포함되며, 발생 시 영업일 [3일 이내] 방문 처리해 드립니다.",
            "keyword": "AS",
        },
        {
            "q": "친환경 자재로도 시공 가능한가요?",
            "a": "[E0 등급 친환경 합판·저VOC 페인트·친환경 본드] 등 자재로 시공 가능합니다. 어린이·반려동물·임산부가 있는 가정에서 많이 선택하시며, 자재별 비용 차이는 견적 시 안내해 드립니다.",
            "keyword": "친환경",
        },
        {
            "q": "시공 사례나 포트폴리오를 볼 수 있나요?",
            "a": "[홈페이지·인스타그램·블로그]에 [실제 시공 사례 50건 이상]을 공개하고 있습니다. 원하시는 컨셉(모던·내추럴·북유럽 등)이 있으시면 비슷한 사례 위주로 미리 보내드립니다.",
            "keyword": "포트폴리오",
        },
    ],
    "auto": [
        {
            "q": "수리 견적은 어떻게 받나요?",
            "a": "차량을 직접 가지고 오시면 [무료 점검 후 견적]을 즉시 안내해 드립니다. 사진이나 영상으로 미리 카카오톡 보내 주시면 대략적인 견적도 가능합니다. 견적 후 정비 진행 여부를 결정하셔도 됩니다.",
            "keyword": "견적",
        },
        {
            "q": "수입차도 정비 가능한가요?",
            "a": "[BMW·벤츠·아우디 등 주요 수입차 정비] 가능합니다. 정품 부품 사용을 원칙으로 하며, [딜러 대비 30~50% 저렴한 가격]에 동급 품질로 진행해 드립니다. 차종을 미리 알려주시면 부품 준비가 빠릅니다.",
            "keyword": "수입차",
        },
        {
            "q": "당일 수리 가능한가요?",
            "a": "[엔진오일 교체·타이어 교체·간단한 정비]는 당일 가능합니다. 사고 수리·미션 정비 등 큰 작업은 [부품 수급에 따라 1~3일] 걸립니다. 사전 예약하시면 대기 없이 바로 진행 가능합니다.",
            "keyword": "당일",
        },
        {
            "q": "보험 처리도 도와주시나요?",
            "a": "[모든 보험사 사고 수리 처리 대행 가능]합니다. 보험사 견적 비교·자기부담금 안내·렌터카 연계까지 한 번에 도와드립니다. 사고 직후 전화([전화번호])로 연락 주시면 출장 견인도 가능합니다.",
            "keyword": "보험",
        },
        {
            "q": "정비 후 보증은 어떻게 되나요?",
            "a": "수리 부위에 한해 [부품 1년·공임 6개월] 무상 보증을 제공합니다. 같은 문제 재발 시 무료 재정비해 드립니다. 보증 내용은 영수증·정비 명세서에 명확히 기재됩니다.",
            "keyword": "보증",
        },
    ],
}


def _map_category_to_faq_key(category: str) -> str:
    """업종명을 FAQ 템플릿 키로 변환 (한글 업종명 포함)."""
    if not category:
        return "default"
    cat = category.lower().strip()
    # 약국 (clinic보다 먼저 — '약국' 매칭 우선)
    if any(k in cat for k in ["약국", "약사", "pharmacy"]):
        return "pharmacy"
    # 부동산
    if any(k in cat for k in ["부동산", "공인중개사", "매매", "임대", "전세", "realestate"]):
        return "realestate"
    # 인테리어·시공
    if any(k in cat for k in ["인테리어", "리모델링", "시공", "interior"]):
        return "interior"
    # 자동차 정비
    if any(k in cat for k in ["자동차", "정비소", "카센터", "auto", "정비"]) and "병원" not in cat:
        return "auto"
    if any(k in cat for k in ["음식", "식당", "한식", "중식", "일식", "치킨", "피자", "분식", "고기", "삼겹", "주점", "술집", "포차", "bar", "restaurant", "food"]):
        return "restaurant"
    if any(k in cat for k in ["카페", "커피", "베이커리", "디저트", "빵집", "cafe", "coffee", "bakery", "dessert"]):
        return "cafe"
    if any(k in cat for k in ["미용", "헤어", "네일", "피부", "뷰티", "살롱", "beauty", "hair", "salon", "nail", "skin"]):
        return "beauty"
    if any(k in cat for k in ["병원", "의원", "치과", "한의원", "clinic", "hospital", "medical", "dental"]):
        return "clinic"
    if any(k in cat for k in ["음악", "악기", "작곡", "편곡", "피아노", "기타", "드럼", "보컬", "보이스", "음악학원", "music", "vocal", "piano", "guitar", "recording", "녹음"]):
        return "music"
    if any(k in cat for k in ["학원", "교습소", "과외", "교육", "academy", "education", "tutoring"]):
        return "academy"
    if any(k in cat for k in ["헬스", "필라테스", "요가", "체육관", "fitness", "gym", "pilates", "yoga"]):
        return "fitness"
    if any(k in cat for k in ["반려", "펫", "동물병원", "pet", "grooming", "vet"]):
        return "pet"
    return "default"


# 업종별 FAQ 질문 목록 (소개글 Q&A 섹션 + 톡톡 채팅방 메뉴 콘텐츠 소스)
# [2026-05-01] 스마트플레이스 사장님 Q&A 탭 폐기 — 사용처를 소개글/톡톡으로 전환
# 실제 고객이 물어보는 자연스러운 말투로 작성
_FAQ_QUESTIONS: dict[str, list[str]] = {
    "photo": [
        "돌스냅 비용이 얼마예요?",
        "야외 촬영도 가능한가요?",
        "촬영 후 사진 보정은 얼마나 걸려요?",
        "웨딩스냅 예약은 어떻게 하나요?",
        "돌잔치 당일 스냅도 가능한가요?",
    ],
    "restaurant": [
        "주차는 가능한가요?",
        "단체 예약 받으시나요?",
        "포장이나 배달도 되나요?",
        "예약 없이 방문해도 되나요?",
        "생일 파티나 회식 이용 가능한가요?",
    ],
    "cafe": [
        "주차 공간이 있나요?",
        "노트북 작업하기 좋은가요?",
        "반려견 동반 가능한가요?",
        "단체석이나 룸 예약 되나요?",
        "디저트 종류가 어떻게 되나요?",
    ],
    "beauty": [
        "예약 없이 방문해도 되나요?",
        "염색 비용이 얼마 정도 되나요?",
        "주차는 가능한가요?",
        "어린이 커트도 가능한가요?",
        "당일 예약도 가능한가요?",
    ],
    "clinic": [
        "예약 없이 방문 가능한가요?",
        "주차 공간이 있나요?",
        "야간 진료나 주말 진료 하시나요?",
        "건강보험 적용이 되나요?",
        "진료 대기 시간이 얼마나 되나요?",
    ],
    "academy": [
        "체험 수업이나 무료 상담이 가능한가요?",
        "수업 레벨이 어떻게 나뉘나요?",
        "중간에 등록해도 따라갈 수 있나요?",
        "교재비나 재료비가 따로 있나요?",
        "휴강이 생기면 보충 수업이 있나요?",
    ],
    "fitness": [
        "1일 체험권이 있나요?",
        "개인 PT도 가능한가요?",
        "샤워 시설이 있나요?",
        "주차는 가능한가요?",
        "등록 전 시설 둘러볼 수 있나요?",
    ],
    "pet": [
        "예약 없이 방문해도 되나요?",
        "모든 견종 미용 가능한가요?",
        "미용 시간이 얼마나 걸리나요?",
        "대형견도 가능한가요?",
        "픽업 서비스가 있나요?",
    ],
    "shopping": [
        "반품/교환은 어떻게 하나요?",
        "배송은 얼마나 걸리나요?",
        "사이즈 교환이 가능한가요?",
        "재입고 알림을 받을 수 있나요?",
    ],
    "_default": [
        "영업시간이 어떻게 되나요?",
        "주차는 가능한가요?",
        "예약 없이 방문해도 되나요?",
    ],
}

# 업종별 카테고리 정규화 맵 (FAQ 질문 분류용)
_CATEGORY_TO_FAQ_KEY: dict[str, str] = {
    "restaurant": "restaurant",
    "food": "restaurant",
    "korean": "restaurant",
    "japanese": "restaurant",
    "chinese": "restaurant",
    "cafe": "cafe",
    "coffee": "cafe",
    "dessert": "cafe",
    "beauty": "beauty",
    "hair": "beauty",
    "salon": "beauty",
    "nail": "beauty",
    "skin": "beauty",
    "clinic": "clinic",
    "medical": "clinic",
    "dental": "clinic",
    "pharmacy": "clinic",
    "academy": "academy",
    "education": "academy",
    "tutoring": "academy",
    "fitness": "fitness",
    "gym": "fitness",
    "pilates": "fitness",
    "yoga": "fitness",
    "pet": "pet",
    "grooming": "pet",
    "vet": "pet",
    "shopping": "shopping",
    "online": "shopping",
    "fashion": "shopping",
    "photo": "photo",
    "studio": "photo",
    "photography": "photo",
    # 폼 25개 업종 추가 (2026-04-23) — _FAQ_QUESTIONS는 default fallback 사용 (별도 등록 시 추가)
    "bakery": "cafe",
    "bar": "restaurant",
    "pharmacy": "_default",
    "realestate": "_default",
    "interior": "_default",
    "auto": "_default",
    "cleaning": "_default",
    "other": "_default",
}


def _normalize_to_faq_key(category: str) -> str:
    """카테고리 문자열을 FAQ 질문 목록 키로 정규화."""
    if not category:
        return "_default"
    cat_lower = category.lower().strip()
    return _CATEGORY_TO_FAQ_KEY.get(cat_lower, "_default")



def _extract_region_short(region: str) -> str:
    """구/동 단위 지역명 추출.
    '서울특별시 마포구 합정동' → '마포구'
    두 번째 단어가 구/군/시로 끝나면 그것을 반환, 아니면 첫 번째 단어 fallback.
    """
    if not region:
        return ""
    parts = region.split()
    if len(parts) >= 2:
        second = parts[1]
        if any(second.endswith(suffix) for suffix in ["구", "군", "시"]):
            return second
    return parts[0] if parts else region

def _clean_keyword(kw: str) -> str:
    """
    키워드 끝의 조사/어미 제거.
    rstrip 대신 re.sub 사용 — rstrip은 문자 집합 기반이라 '이' 등 단일 자모도 소거됨.
    """
    return re.sub(r"(이며|이고|있음|입니다|이오니|합니다)$", "", kw).strip()


def _make_review_response_content(
    target_keywords: list[str],
    business_name: str,
    category: str,
    review_excerpts: list[str] | None = None,
) -> str:
    """
    목표 키워드를 자연스럽게 포함한 리뷰 답변 초안 생성.

    네이버 AI 브리핑은 사장님 답변에서도 키워드를 수집합니다.
    답변에 키워드를 심는 것은 합법적인 AI 신호 강화 방법입니다.

    Args:
        target_keywords: 목표 키워드 목록
        business_name: 사업장명
        category: 업종 코드
        review_excerpts: 실제 리뷰 발췌문 목록 (있으면 개인화된 답변 생성, 없으면 키워드 기반 fallback)
    """
    category_ko = _to_ko_category(category)

    # 실제 리뷰 발췌문이 있으면 개인화된 답변 생성
    if review_excerpts:
        # 가장 첫 번째 리뷰 발췌문에서 핵심 언급 내용 추출 (최대 30자)
        first_review = review_excerpts[0].strip()[:60] if review_excerpts[0].strip() else ""
        # 리뷰 내용에서 긍정적 표현 감지
        positive_words = ["맛있", "좋았", "친절", "빠르", "깔끔", "추천", "만족", "예뻤", "편했"]
        is_positive = any(w in first_review for w in positive_words)

        kw1 = _clean_keyword(target_keywords[0]) if target_keywords else ""
        kw_sentence = (
            f"저희 {business_name}은 {kw1} 서비스를 운영하고 있으니 다음에도 편하게 방문해 주세요."
            if kw1 else f"다음에 또 방문해 주시면 더 좋은 서비스로 맞이하겠습니다."
        )

        if is_positive and first_review:
            opening = f"고객님께서 '{first_review[:30]}' 부분을 좋게 봐주셨군요, 정말 감사합니다! "
        else:
            opening = "소중한 리뷰 남겨주셔서 정말 감사합니다! "

        return (
            f"{opening}"
            f"{kw_sentence} "
            f"앞으로도 더 좋은 {category_ko} 서비스로 보답하겠습니다. "
            f"다음 방문도 기다리고 있겠습니다."
        )

    # fallback: 키워드 기반 일반 답변
    if not target_keywords:
        return (
            f"방문해 주셔서 진심으로 감사합니다! "
            f"{business_name}에서 좋은 경험을 하셨다니 기쁩니다. "
            f"다음에 또 방문해 주시면 더 좋은 서비스로 맞이하겠습니다."
        )

    kw1 = _clean_keyword(target_keywords[0])
    kw2 = _clean_keyword(target_keywords[1]) if len(target_keywords) > 1 else ""

    if kw2:
        kw_sentence = (
            f"저희 {business_name}은 {kw1}과 {kw2} 서비스를 함께 운영하고 있어 "
            f"다양한 상황에서 편리하게 방문하실 수 있습니다."
        )
    else:
        kw_sentence = f"저희 {business_name}은 {kw1} 서비스를 운영하고 있으니 다음에도 편하게 방문해 주세요."

    return (
        f"소중한 리뷰 남겨주셔서 정말 감사합니다! "
        f"{kw_sentence} "
        f"앞으로도 더 좋은 {category_ko} 서비스로 보답하겠습니다. "
        f"다음 방문도 기다리고 있겠습니다."
    )


def _make_faq_pair(question: str, business_name: str, target_keyword: str, category: str = "") -> str:
    """
    단일 Q&A 쌍 생성.
    업종별 템플릿에서 질문에 맞는 답변을 찾아 반환.
    없으면 [직접 입력] 플레이스홀더가 포함된 fallback 답변 사용.
    """
    faq_key = _map_category_to_faq_key(category)
    templates = _FAQ_TEMPLATES.get(faq_key, _FAQ_TEMPLATES["default"])

    # 완전 일치 우선 매칭
    matched_answer: str | None = None
    for tmpl in templates:
        if tmpl["q"] == question:
            matched_answer = tmpl["a"]
            break

    # 키워드 부분 일치 fallback 매칭
    if matched_answer is None:
        for tmpl in templates:
            kw = tmpl.get("keyword", "")
            if kw and kw in question:
                matched_answer = tmpl["a"]
                break

    if matched_answer:
        return f"Q: {question}\nA: {matched_answer}"

    # 매칭 실패 시 — 즉답형(첫 문장 30~60자) 가이드 + [직접 입력] 플레이스홀더
    # 리드젠랩 AEO 가이드: "검색 쿼리에 대한 명확한 답변을 첫 번째 문단에 배치"
    kw_clean = _clean_keyword(target_keyword) if target_keyword else ""
    if kw_clean:
        answer = (
            f"네, {business_name}에서 {kw_clean} 가능합니다. "
            f"[첫 문장 30~60자 즉답형 권장 — 위 문장을 유지하거나 더 구체적으로 수정하세요.] "
            f"[구체 조건·가격·시간을 한 문단 추가: 예 \"평일 OO시~OO시, 가격 OO원, 사전 예약 시 OO원 할인\".]"
        )
    else:
        answer = (
            "[첫 문장은 30~60자 즉답형으로 작성하세요. 예: \"네, 가능합니다. 평일 OO시까지 운영합니다.\"] "
            "[두 번째 문단에 구체 조건·가격·시간을 명시하세요. AI 브리핑은 첫 문장을 우선 인용합니다.]"
        )
    return f"Q: {question}\nA: {answer}"


def _make_faq_content(
    target_keywords: list[str],
    business_name: str,
    category: str,
    region: str,
    competitor_keyword_sources: dict[str, list[str]] | None = None,
) -> str:
    """
    업종별 FAQ Q&A 3쌍 생성.

    [2026-05-01] 스마트플레이스 사장님 Q&A 탭 폐기 — 사용처 변경됨:
    - 1순위: 소개글 안의 '자주 묻는 질문' 섹션 (AI 브리핑 인용 후보)
    - 2순위: 톡톡 채팅방 메뉴의 메시지 내용

    - competitor_keyword_sources가 있으면 경쟁사 공통 키워드를 첫 번째 FAQ로 배치
    - 업종별 _FAQ_TEMPLATES에서 실제 답변이 있는 Q&A를 우선 반환
    - 템플릿 없는 업종은 _FAQ_QUESTIONS 질문 목록 + _make_faq_pair fallback 사용
    - 소개글 Q&A 섹션은 AI 브리핑 인용 후보 텍스트 (직접 인용 보장 아님)
    """
    # 경쟁사 공통 키워드 추출 — 2개 이상 경쟁사가 공유한 키워드 우선
    competitor_common_kw: str | None = None
    try:
        if competitor_keyword_sources and isinstance(competitor_keyword_sources, dict):
            from collections import Counter
            _all_kws: list[str] = []
            for kws_list in competitor_keyword_sources.values():
                if isinstance(kws_list, list):
                    _all_kws.extend(kws_list)
            if _all_kws:
                _counts = Counter(_all_kws)
                _common = [kw for kw, cnt in _counts.most_common() if cnt >= 2]
                competitor_common_kw = _common[0] if _common else _all_kws[0]
    except Exception as e:
        _logger.warning("briefing competitor_common_kw 추출 실패: %s", e)

    tmpl_key = _map_category_to_faq_key(category)
    templates = _FAQ_TEMPLATES.get(tmpl_key, _FAQ_TEMPLATES["default"])

    lines: list[str] = []

    # 경쟁사 공통 키워드가 있으면 첫 번째 FAQ로 삽입
    if competitor_common_kw:
        kw_clean = _clean_keyword(competitor_common_kw)
        lines.append(
            f"Q: {kw_clean}도 가능한가요?\n"
            f"A: 네, {business_name}에서 {kw_clean} 가능합니다. "
            f"자세한 내용은 전화 또는 네이버 예약으로 문의해 주세요."
        )

    # 업종별 템플릿이 있으면 상위 Q&A를 반환 (가장 실질적인 답변)
    remaining = 3 - len(lines)
    if templates and remaining > 0:
        for tmpl in templates[:remaining]:
            lines.append(f"Q: {tmpl['q']}\nA: {tmpl['a']}")
        return "\n\n".join(lines)

    # 템플릿 없는 경우: 기존 질문 목록 + _make_faq_pair fallback
    faq_key = _normalize_to_faq_key(category)
    questions = _FAQ_QUESTIONS.get(faq_key, _FAQ_QUESTIONS["_default"])
    selected_questions = questions[:remaining]
    kws = (target_keywords or []) + ([""] * 3)

    for i, question in enumerate(selected_questions):
        kw = kws[i] if i < len(kws) else ""
        lines.append(_make_faq_pair(question, business_name, kw, category))

    return "\n\n".join(lines)


def _make_post_content(
    target_keywords: list[str],
    business_name: str,
    category: str,
    region: str,
) -> str:
    """
    목표 키워드를 포함한 스마트플레이스 소식 초안 생성.

    소식은 주 1회 업데이트 시 AI 브리핑 최신성 점수가 유지됩니다.
    200~300자 단문으로, 사장님이 5분 안에 작성·발행 가능한 분량.
    """
    category_ko = _to_ko_category(category)
    region_short = _extract_region_short(region)

    if not target_keywords:
        return (
            f"{business_name} 소식\n\n"
            f"{region_short} {category_ko}을 찾으시나요? "
            f"{business_name}에서 편안한 시간 보내세요.\n\n"
            f"문의 및 예약: 네이버 예약 또는 전화"
        )

    kw1_clean = _clean_keyword(target_keywords[0])
    kw_phrase = " · ".join(_clean_keyword(kw) for kw in target_keywords[:2])

    return (
        f"{business_name} 안내\n\n"
        f"{region_short}에서 {kw_phrase}을 찾고 계신가요?\n\n"
        f"{business_name}에서는 {kw1_clean} 서비스를 운영하고 있어 "
        f"다양한 상황에서 편리하게 이용하실 수 있습니다.\n\n"
        f"방문 전 네이버 예약 또는 전화로 미리 확인해 주세요.\n\n"
        f"#{region_short}{category_ko} #{kw1_clean.replace(' ', '')}"
    )


_CATEGORY_KO: dict[str, str] = {
    "restaurant": "음식점·카페", "cafe": "카페", "food": "음식점",
    "beauty": "미용실", "hair": "미용실", "salon": "뷰티살롱",
    "clinic": "병원", "medical": "의원",
    "academy": "학원", "education": "교육",
    "legal": "법률사무소", "lawyer": "변호사", "tax": "세무사",
    "shopping": "쇼핑몰", "online": "온라인몰",
    "fitness": "헬스·필라테스", "gym": "헬스장", "pilates": "필라테스",
    "pet": "반려동물", "grooming": "펫미용",
    "photo": "사진관·스튜디오", "studio": "스튜디오",
}


def _to_ko_category(category: str) -> str:
    return _CATEGORY_KO.get(category.lower(), category)


def _find_lsi_cluster(target_keyword: str, category: str) -> list[str]:
    """
    LSI(의미적 클러스터) 키워드 추출 — 같은 카테고리(접근편의/단체모임 등) 내 연관 키워드.

    리드젠랩 가이드: "LSI 키워드를 활용해 주제의 깊이와 전문성을 보여줍니다"
    D.I.A. 주제 적합도 신호 강화.

    target_keyword가 어느 의미 그룹(접근편의/단체모임/...)에 속하는지 찾아
    같은 그룹의 다른 키워드 최대 2개를 반환. 매칭 실패 시 빈 리스트.
    """
    if not target_keyword or not category:
        return []
    try:
        taxonomy = get_industry_keywords(category)
    except Exception:
        return []

    target_clean = _clean_keyword(target_keyword)
    if not target_clean:
        return []

    for cat_data in taxonomy.values():
        if not isinstance(cat_data, dict):
            continue
        kws = cat_data.get("keywords") or []
        if not isinstance(kws, list):
            continue
        # 부분 일치 — target_keyword가 그룹 키워드의 일부거나 그 반대
        matched = False
        for kw in kws:
            if target_clean in kw or kw in target_clean:
                matched = True
                break
        if matched:
            siblings = [kw for kw in kws if (target_clean not in kw and kw not in target_clean)]
            return siblings[:2]
    return []


def _make_intro_content(
    target_keywords: list[str],
    business_name: str,
    category: str,
    region: str,
    existing_keywords: list[str],
) -> str:
    """
    목표 키워드를 포함한 스마트플레이스 소개글 개선안 생성.

    소개글은 네이버 AI가 사업장의 핵심 정보를 파악하는 기반 텍스트입니다.
    한 번 잘 써두면 영구적으로 AI 브리핑 키워드 기반이 됩니다.

    LSI 묶음 (D.I.A. 주제 적합도 신호):
      target_keywords[0]이 속한 의미 그룹의 연관 키워드 2개를 자연 문장에 추가.
    """
    clean_target = [_clean_keyword(kw) for kw in target_keywords[:3]]
    clean_existing = [_clean_keyword(kw) for kw in (existing_keywords or [])[:3]]
    all_kws = clean_existing + [kw for kw in clean_target if kw not in clean_existing]
    kw_str = ", ".join(all_kws[:5]) if all_kws else category

    region_short = _extract_region_short(region)
    category_ko = _to_ko_category(category)

    # LSI 묶음: 첫 목표 키워드의 연관 키워드 추출
    lsi_keywords: list[str] = []
    if clean_target:
        lsi_keywords = _find_lsi_cluster(clean_target[0], category)
    lsi_sentence = ""
    if lsi_keywords:
        lsi_sentence = (
            f"{', '.join(lsi_keywords)} 등 함께 자주 찾으시는 조건도 같은 공간에서 충족됩니다.\n\n"
        )

    return (
        f"{region_short} {category_ko} {business_name}입니다.\n\n"
        f"저희 가게는 {kw_str} 등 다양한 상황에 맞춰 편리하게 이용하실 수 있습니다.\n\n"
        f"{lsi_sentence}"
        f"{region_short}에서 {category_ko}을 찾으신다면 {business_name}을 추천드립니다. "
        f"네이버 예약으로 간편하게 방문 예약하세요."
    )


def build_direct_briefing_paths(
    biz: dict,
    missing_keywords: list[str],
    competitor_only_keywords: list[str],
    existing_keywords: list[str],
    review_excerpts: list[str] | None = None,
    competitor_keyword_sources: dict[str, list[str]] | None = None,
) -> list[dict]:
    """
    소상공인이 오늘 당장 실행할 수 있는 AI 브리핑 직접 관리 경로 4개 생성.

    Args:
        biz: 사업장 정보
        missing_keywords: 아직 없는 키워드 (전체)
        competitor_only_keywords: 경쟁사엔 있고 내겐 없는 키워드 (긴급)
        existing_keywords: 이미 보유한 키워드
        review_excerpts: 실제 리뷰 발췌문 목록 (경로 A 답변 개인화에 사용)

    Returns:
        경로별 dict 목록 (urgency 순으로 정렬)
    """
    name = biz.get("name", "우리 가게")
    category = biz.get("category", "")
    region = biz.get("region", "")
    naver_place_id = biz.get("naver_place_id", "")

    # 긴급 키워드 우선, 없으면 missing 상위 3개
    urgent = competitor_only_keywords[:3] if competitor_only_keywords else missing_keywords[:3]
    top2 = urgent[:2]

    def smartplace_url(path_key: str) -> str:
        return _build_smartplace_url(path_key, naver_place_id)

    paths = []

    # 경로 B: 소개글 Q&A 섹션 — 사장님이 직접 작성하는 인용 후보 텍스트 (즉시)
    # [2026-05-01] 스마트플레이스 사장님 Q&A 탭 폐기 — 소개글 안 Q&A 섹션으로 전환
    paths.append({
        "path_id": "intro_qa",
        "path_name": "소개글에 Q&A 섹션 추가",
        "urgency": "do_now",
        "urgency_label": "지금 당장",
        "reason": (
            "소개글의 Q&A 섹션은 AI 브리핑 인용 후보 텍스트입니다. "
            f"'{top2[0] if top2 else ''}' 관련 질문을 자연스럽게 포함하면 "
            "해당 조건 검색에 내 가게가 노출될 가능성이 올라갑니다."
        ),
        "target_keywords": top2,
        "ready_content": _make_faq_content(top2, name, category, region, competitor_keyword_sources),
        "action_url": smartplace_url("intro"),
        "action_steps": _ACTION_STEPS["intro_qa"],
        "estimated_time": "5분",
        "impact": "소개글 Q&A 섹션 — AI 브리핑 인용 후보 경로",
    })

    # 경로 A: 리뷰 답변 (즉시, 효과 높음)
    paths.append({
        "path_id": "review_response",
        "path_name": "미답변 리뷰에 키워드 담아 답변",
        "urgency": "do_now",
        "urgency_label": "지금 당장",
        "reason": (
            "사장님 답변에도 키워드를 포함하면 AI 브리핑 신호가 강화됩니다. "
            "미답변 리뷰가 있을 경우 오늘 답변하면서 목표 키워드를 자연스럽게 포함하세요."
        ),
        "target_keywords": top2,
        "ready_content": _make_review_response_content(top2, name, category, review_excerpts),
        "action_url": smartplace_url("review_response"),
        "action_steps": _ACTION_STEPS["review_response"],
        "estimated_time": "3분",
        "impact": "리뷰 답변율 100% → AI 브리핑 가중치 상승",
    })

    # 경로 C: 소식 업데이트 (이번 주)
    paths.append({
        "path_id": "post",
        "path_name": "스마트플레이스 소식 업데이트",
        "urgency": "this_week",
        "urgency_label": "이번 주",
        "reason": (
            "소식을 7일 이상 업데이트하지 않으면 AI 브리핑 최신성 점수가 떨어집니다. "
            "이번 주 소식에 목표 키워드를 포함하면 두 가지를 동시에 해결합니다."
        ),
        "target_keywords": top2,
        "ready_content": _make_post_content(top2, name, category, region),
        "action_url": smartplace_url("post"),
        "action_steps": _ACTION_STEPS["post"],
        "estimated_time": "5분",
        "impact": "최신성 점수 유지 + 키워드 커버리지 확장",
    })

    # 경로 D: 소개글 수정 (이번 달, 한 번만)
    paths.append({
        "path_id": "intro",
        "path_name": "스마트플레이스 소개글 키워드 보강",
        "urgency": "this_month",
        "urgency_label": "이번 달 중",
        "reason": (
            "소개글은 한 번 잘 써두면 영구적으로 AI 브리핑 키워드 기반이 됩니다. "
            "현재 소개글에 목표 키워드가 빠져 있다면 지금이 수정할 때입니다."
        ),
        "target_keywords": missing_keywords[:4],
        "ready_content": _make_intro_content(
            missing_keywords[:3], name, category, region, existing_keywords
        ),
        "action_url": smartplace_url("intro"),
        "action_steps": _ACTION_STEPS["intro"],
        "estimated_time": "10분",
        "impact": "영구 키워드 기반 — 한 번 하면 계속 효과",
    })

    return paths


# 업종 코드 → 한국어 표현 (리스트 블로그·커뮤니티 초안용)
_CATEGORY_KO_MAP: dict[str, str] = {
    "restaurant": "맛집",
    "food": "맛집",
    "cafe": "카페",
    "coffee": "카페",
    "beauty": "미용실",
    "hair": "미용실",
    "salon": "뷰티살롱",
    "nail": "네일샵",
    "skin": "피부관리",
    "clinic": "병원",
    "medical": "의원",
    "dental": "치과",
    "pharmacy": "약국",
    "academy": "학원",
    "education": "교육",
    "fitness": "헬스·필라테스",
    "gym": "헬스장",
    "pilates": "필라테스",
    "yoga": "요가",
    "pet": "반려동물 미용",
    "grooming": "펫미용",
    "vet": "동물병원",
    "legal": "법률사무소",
    "lawyer": "변호사",
    "tax": "세무사",
    "shopping": "쇼핑몰",
    "photo": "사진관",
    "studio": "스튜디오",
}


def _to_ko_category_map(category: str) -> str:
    """_CATEGORY_KO_MAP 기반 업종 한국어 변환 (없으면 _to_ko_category fallback)."""
    if not category:
        return "업체"
    cat_lower = category.lower().strip()
    return _CATEGORY_KO_MAP.get(cat_lower, _to_ko_category(cat_lower) or category)


def _make_list_content_draft(
    business_name: str,
    region: str,
    category: str,
    keywords: list[str],
) -> dict:
    """
    지역 TOP5 리스트 블로그 초안 생성.

    ChatGPT·Gemini는 리스트형 블로그 글을 신뢰 높은 정보로 인식합니다.
    사장님이 자기 업체를 1위로 올려서 발행하면 AI 브리핑 신뢰 점수가 상승합니다.

    Args:
        business_name: 사업장명
        region: 지역명 (예: '서울특별시 마포구')
        category: 업종 코드 (예: 'restaurant')
        keywords: 목표 키워드 목록

    Returns:
        경로 dict (path, title, why, time_needed, urgency, blog_title, blog_draft 포함)
    """
    region_short = _extract_region_short(region) or region
    category_ko = _to_ko_category_map(category)

    # 키워드 fallback
    kw_list = [_clean_keyword(kw) for kw in keywords if kw]
    keyword1 = kw_list[0] if kw_list else f"{category_ko} 서비스"
    keyword2 = kw_list[1] if len(kw_list) > 1 else keyword1
    kw_tag = keyword1.replace(" ", "")

    # D.I.A. 적시성 신호 — 발행 시점 명시 (리드젠랩 가이드 기준)
    now = datetime.now()
    date_tag = f"{now.year}년 {now.month}월"

    blog_title = f"[{date_tag} 업데이트] {region_short} {category_ko} | {business_name} 소개"

    blog_draft = (
        f"[제목] [{date_tag} 업데이트] {region_short} {category_ko} — {business_name} 소개\n\n"
        f"[도입부] 안녕하세요, {business_name} 운영하고 있습니다.\n"
        f"{region_short}에서 {category_ko}를 찾고 계신 분들께 저희 가게를 {date_tag} 기준으로 소개드립니다.\n\n"
        f"[소개] {business_name}\n"
        f"· 위치: {region_short}\n"
        f"· 특징: {keyword1} · {keyword2} 전문\n"
        f"· 이용 안내: 네이버 예약 또는 전화로 간편하게 예약하실 수 있습니다\n"
        f"· 정보 기준일: {now.strftime('%Y.%m.%d')}\n\n"
        f"[마무리] {region_short}에서 {category_ko}로 고민 중이시라면 {business_name}을 방문해 주세요.\n"
        f"태그: #{region_short}{category_ko} #{kw_tag} #{business_name.replace(' ', '')} #{now.year}년최신"
    )

    return {
        "path_id": "list_content",
        "label": "사업주 블로그 가게 소개 글 초안",
        "urgency": "this_week",
        "urgency_label": "이번 주",
        "time_required": "30분",
        "what_to_do": f"'{blog_title}' 제목으로 사업주 블로그에 우리 가게 소개 글을 발행하세요",
        "effect": "사업주 블로그에서 업종·지역·키워드를 포함한 소개 글이 있으면 ChatGPT·Gemini가 신뢰 높은 정보로 인식합니다",
        "ready_text": f"제목: {blog_title}\n\n본문:\n{blog_draft}",
    }


def _make_community_drafts(
    business_name: str,
    region: str,
    category: str,
    keywords: list[str],
) -> dict:
    """
    맘카페·지식인 커뮤니티 언급 초안 생성.

    맘카페·지역카페·네이버 지식인 언급이 ChatGPT 신뢰도 점수를 높입니다.
    실제 이용 후기처럼 자연스러운 말투로 작성되어 있어 바로 붙여넣기 가능합니다.

    Args:
        business_name: 사업장명
        region: 지역명
        category: 업종 코드
        keywords: 목표 키워드 목록

    Returns:
        경로 dict (path, title, why, time_needed, urgency, drafts 포함)
    """
    region_short = _extract_region_short(region) or region
    category_ko = _to_ko_category_map(category)

    # 키워드 fallback
    kw_list = [_clean_keyword(kw) for kw in keywords if kw]
    keyword1 = kw_list[0] if kw_list else f"{category_ko} 서비스"
    keyword2 = kw_list[1] if len(kw_list) > 1 else keyword1

    cafe_text = (
        f"안녕하세요~ {region_short}에서 {category_ko} 운영 중인 {business_name} 사장입니다!\n"
        f"저희 가게는 {keyword1} · {keyword2} 서비스를 제공하고 있어요.\n"
        f"{region_short}에서 {category_ko} 찾고 계신 분들께 안내드립니다 :)\n"
        f"네이버 예약으로 간편하게 방문하실 수 있습니다."
    )

    jiskin_text = (
        f"안녕하세요, {business_name} 운영자입니다.\n"
        f"{region_short}에서 {category_ko}를 찾으신다면 저희 가게를 추천드립니다.\n"
        f"{keyword1} · {keyword2} 전문으로 운영하고 있으며, {region_short} 위치라 접근하기 편합니다.\n"
        f"궁금한 점은 네이버 예약 또는 전화로 문의해 주세요."
    )

    ready_text = (
        f"## 맘카페 / 지역카페\n{cafe_text}\n\n"
        f"## 네이버 지식인\n{jiskin_text}"
    )

    return {
        "path_id": "community",
        "label": "사업장 소개 글 초안 (사업주 신분 공개)",
        "urgency": "this_week",
        "urgency_label": "이번 주",
        "time_required": "15분",
        "what_to_do": f"사업주 신분을 밝히고 아래 초안을 참고해 맘카페·지식인에 올려주세요 (직접 쓴 글처럼 꾸미지 마세요)",
        "effect": "사업주가 직접 가게를 소개하는 커뮤니티 글이 쌓이면 ChatGPT 신뢰도 점수에 긍정적으로 반영됩니다",
        "ready_text": ready_text,
    }


def build_briefing_paths(
    biz: dict,
    missing_keywords: list[str],
    competitor_only_keywords: list[str],
    existing_keywords: list[str],
    review_excerpts: list[str] | None = None,
    competitor_keyword_sources: dict[str, list[str]] | None = None,
) -> dict:
    """
    AI 브리핑 직접 관리 전체 패키지 생성.

    기존 4개 경로(A~D) + 리스트 블로그 + 커뮤니티 초안 + 네이버 지도 URL 포함.

    Args:
        biz: 사업장 정보
        missing_keywords: 아직 없는 키워드
        competitor_only_keywords: 경쟁사엔 있고 내겐 없는 키워드
        existing_keywords: 이미 보유한 키워드
        review_excerpts: 실제 리뷰 발췌문 목록

    Returns:
        {
            "paths": [...],         # 경로 A~D + 리스트 블로그 + 커뮤니티
            "summary": str,         # 전체 요약 메시지
            "naver_map_url": str,   # 네이버 지도 검색 URL
        }
    """
    name = biz.get("name", "우리 가게")
    category = biz.get("category", "")
    region = biz.get("region", "")

    # 기존 경로 A~D 생성
    paths = build_direct_briefing_paths(
        biz=biz,
        missing_keywords=missing_keywords,
        competitor_only_keywords=competitor_only_keywords,
        existing_keywords=existing_keywords,
        review_excerpts=review_excerpts,
        competitor_keyword_sources=competitor_keyword_sources,
    )

    # 경로 E: 리스트 블로그
    all_missing = competitor_only_keywords[:3] if competitor_only_keywords else missing_keywords[:3]
    paths.append(_make_list_content_draft(name, region, category, all_missing))

    # 경로 F: 커뮤니티 초안
    paths.append(_make_community_drafts(name, region, category, all_missing))

    # 커버리지 계산 (summary용)
    total_kws = len(existing_keywords) + len(missing_keywords)
    coverage_rate = (len(existing_keywords) / total_kws) if total_kws > 0 else 0.0
    top_kw = (competitor_only_keywords + missing_keywords)[:1]
    top_kw_str = top_kw[0] if top_kw else None

    summary = build_briefing_summary(
        paths=paths,
        coverage_rate=coverage_rate,
        top_priority_keyword=top_kw_str,
    )

    # 네이버 지도 검색 URL
    naver_map_url = (
        f"https://map.naver.com/v5/search/{urllib.parse.quote(f'{region} {name}')}"
    )

    return {
        "paths": paths,
        "summary": summary,
        "naver_map_url": naver_map_url,
    }


def build_briefing_summary(
    paths: list[dict],
    coverage_rate: float,
    top_priority_keyword: str | None,
) -> str:
    """
    AI 브리핑 직접 관리 경로 전체 요약 메시지 생성.
    대시보드 상단 안내 문구로 사용.
    """
    do_now_count = sum(1 for p in paths if p.get("urgency") == "do_now")
    coverage_pct = round(coverage_rate * 100)

    if coverage_pct < 20:
        state = "아직 AI 브리핑에 내 가게가 잘 나오지 않습니다"
    elif coverage_pct < 50:
        state = "AI 브리핑에 일부 조건 검색에서 나오고 있습니다"
    else:
        state = "AI 브리핑에 다양한 조건 검색에서 노출되고 있습니다"

    kw_msg = (
        f" '{_clean_keyword(top_priority_keyword)}' 키워드를 먼저 확보하는 것이 가장 급합니다."
        if top_priority_keyword else ""
    )

    return (
        f"{state}.{kw_msg} "
        f"지금 당장 할 수 있는 {do_now_count}가지 방법이 있습니다 — "
        f"고객 없이, 오늘 10분 안에 AI 브리핑 신호를 강화할 수 있습니다."
    )


def simulate_ai_tab_answer(biz: dict, scan_result: dict | None = None) -> dict:
    """
    AI탭이 생성할 가능성이 높은 답변을 추정. AI 호출 0회.
    등록 정보 + 리뷰 키워드 빈도 기반 추정.

    Args:
        biz: businesses 테이블 행 (name, category, region, keywords 등)
        scan_result: scan_results 테이블 최신 행 (옵션, 현재 미사용 — 향후 확장용)

    Returns:
        simulated_answer: 예상 AI탭 답변 문장
        matched_contexts: 등록 키워드와 일치하는 ai_tab_context 키워드
        missing_contexts: 상위 6개 ai_tab_context 중 미보유 키워드
        preview_only: True (항상)
        disclaimer: 면책 문구
    """
    from services.keyword_taxonomy import KEYWORD_TAXONOMY, normalize_category

    category = biz.get("category", "restaurant")
    biz_name = biz.get("name", "이 업소")
    region = biz.get("region", "")
    keywords: list = biz.get("keywords") or []

    # normalize category → taxonomy key
    tax_key = normalize_category(category)
    industry_data = KEYWORD_TAXONOMY.get(tax_key, {})
    ai_tab_kws: list[str] = industry_data.get("ai_tab_context", {}).get("keywords", [])

    # 등록 키워드와 ai_tab_context 키워드 교집합 (공백 제거 부분 매칭)
    kw_nospace_list = [str(k).replace(" ", "").lower() for k in keywords if k]
    matched: list[str] = []
    for ai_kw in ai_tab_kws:
        ai_kw_ns = ai_kw.replace(" ", "").lower()
        if any(ai_kw_ns in kw_ns or kw_ns in ai_kw_ns for kw_ns in kw_nospace_list if len(kw_ns) >= 2):
            matched.append(ai_kw)

    # 상위 6개 ai_tab_context 키워드 중 미보유 목록
    matched_set = {m.replace(" ", "").lower() for m in matched}
    missing: list[str] = [
        kw for kw in ai_tab_kws[:6]
        if kw.replace(" ", "").lower() not in matched_set
    ]

    # 단순 답변 문장 조합 (AI 호출 없이 — 지역 + 업소명 + 상위 3개 매칭 컨텍스트)
    region_short = _extract_region_short(region) if region else ""
    name_part = f"{region_short} {biz_name}".strip()
    parts = [name_part]
    if matched:
        parts.append(", ".join(matched[:3]))
    simulated = ". ".join(parts) + "."

    return {
        "simulated_answer": simulated,
        "matched_contexts": matched[:5],
        "missing_contexts": missing[:5],
        "preview_only": True,
        "disclaimer": "예시 답변은 등록 정보·키워드를 조합한 추정이며 실제 AI탭 답변과 다를 수 있습니다.",
    }
