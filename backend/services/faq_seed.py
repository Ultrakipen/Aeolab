"""
FAQ seed 데이터 — AEOlab 핵심 30개 항목

실행 방법:
    python -m services.faq_seed

Supabase `faqs` 테이블에 upsert (question 기준 중복 삽입 방지).
기존 is_active=True 레코드가 있으면 skip. 없으면 insert.

테이블 스키마 (참조):
    CREATE TABLE faqs (
        id SERIAL PRIMARY KEY,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'general',  -- general | pricing | scan | guide
        order_num INT NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );
"""

import asyncio
import logging
import sys

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
_logger = logging.getLogger("faq_seed")

FAQ_DATA = [
    # ── 서비스 이용 (general) ────────────────────────────────────────────
    {
        "category": "general",
        "order_num": 10,
        "question": "AEOlab은 어떤 서비스인가요?",
        "answer": (
            "AEOlab은 네이버 AI 브리핑·ChatGPT·Gemini·Google AI Overview 4개 채널에서 "
            "내 사업장이 얼마나 노출되는지 자동으로 진단하고 개선 가이드를 제공하는 서비스입니다."
        ),
    },
    {
        "category": "general",
        "order_num": 11,
        "question": "가입 없이 먼저 체험해볼 수 있나요?",
        "answer": (
            "네, 상단 '무료 진단' 버튼을 눌러 비로그인 상태로 1회 체험 스캔이 가능합니다. "
            "더 자세한 분석과 지속 관리는 구독 플랜에서 이용하실 수 있습니다."
        ),
    },
    {
        "category": "general",
        "order_num": 12,
        "question": "지원하는 업종이 어떻게 되나요?",
        "answer": (
            "음식점·카페·베이커리·바·미용·네일·의료·약국·피트니스·요가·반려동물·교육·"
            "과외·법률·부동산·인테리어·자동차·청소·쇼핑·패션·사진·영상·디자인·숙박·기타 "
            "등 25개 업종을 지원합니다."
        ),
    },
    {
        "category": "general",
        "order_num": 13,
        "question": "모바일에서도 사용할 수 있나요?",
        "answer": (
            "네, PC와 모바일 모두 최적화된 화면으로 이용하실 수 있습니다. "
            "대시보드·스캔 결과·개선 가이드를 스마트폰에서도 편리하게 확인할 수 있습니다."
        ),
    },
    {
        "category": "general",
        "order_num": 14,
        "question": "여러 사업장을 등록할 수 있나요?",
        "answer": (
            "Biz 플랜 이상에서 멀티 사업장 관리가 가능합니다. "
            "Basic·창업패키지·Pro 플랜은 사업장 1개 기준입니다."
        ),
    },
    {
        "category": "general",
        "order_num": 15,
        "question": "팀원을 추가할 수 있나요?",
        "answer": (
            "Biz 플랜은 팀 계정 5명, Enterprise 플랜은 최대 20명까지 지원합니다. "
            "대시보드 > 설정 > 팀 관리에서 초대할 수 있습니다."
        ),
    },
    {
        "category": "general",
        "order_num": 16,
        "question": "데이터는 얼마나 안전하게 보관되나요?",
        "answer": (
            "모든 데이터는 Supabase(PostgreSQL) 클라우드에 암호화 저장됩니다. "
            "사용자 인증은 Supabase Auth를 통해 관리되며, 타인의 사업장 데이터에는 접근할 수 없습니다."
        ),
    },
    # ── 요금제 (pricing) ─────────────────────────────────────────────────
    {
        "category": "pricing",
        "order_num": 20,
        "question": "요금제 종류가 어떻게 되나요?",
        "answer": (
            "Basic(월 11,900원)·창업패키지(12,900원)·Pro(23,900원)·Biz(49,900원)·"
            "Enterprise(20만원) 5가지 플랜이 있습니다. 요금제 페이지에서 상세 비교를 확인하세요."
        ),
    },
    {
        "category": "pricing",
        "order_num": 21,
        "question": "첫 달 할인이 있나요?",
        "answer": (
            "Basic 플랜 신규 가입 시 첫 달 50% 할인(5,950원)이 적용됩니다. "
            "이후 월부터는 정상가 11,900원으로 자동 결제됩니다."
        ),
    },
    {
        "category": "pricing",
        "order_num": 22,
        "question": "언제든지 해지할 수 있나요?",
        "answer": (
            "네, 대시보드 > 설정 > 구독 관리에서 언제든지 해지할 수 있습니다. "
            "해지 후에도 현재 결제 기간 만료일까지는 서비스를 계속 이용하실 수 있습니다."
        ),
    },
    {
        "category": "pricing",
        "order_num": 23,
        "question": "무료 플랜이 있나요?",
        "answer": (
            "무료 플랜은 없으나, 비로그인 상태에서 1회 무료 체험 진단을 이용하실 수 있습니다. "
            "가입 후에는 구독 플랜을 선택해야 지속적인 모니터링이 가능합니다."
        ),
    },
    {
        "category": "pricing",
        "order_num": 24,
        "question": "결제 수단은 무엇인가요?",
        "answer": (
            "신용카드·체크카드로 결제할 수 있습니다(토스페이먼츠 빌링키 자동결제). "
            "카드 등록 후 매월 같은 날짜에 자동으로 결제됩니다."
        ),
    },
    {
        "category": "pricing",
        "order_num": 25,
        "question": "창업패키지 플랜은 무엇이 다른가요?",
        "answer": (
            "창업패키지는 예비 창업자를 위한 플랜으로, 업종 시장 분석·경쟁사 벤치마킹·"
            "창업 타이밍 지수·창업 리포트 기능이 포함됩니다. 현재 업종별 시장 상황을 먼저 파악하고 싶다면 추천합니다."
        ),
    },
    {
        "category": "pricing",
        "order_num": 26,
        "question": "영수증이나 세금계산서를 받을 수 있나요?",
        "answer": (
            "결제 후 이메일로 영수증이 자동 발송됩니다. "
            "세금계산서가 필요하신 경우 support@aeolab.co.kr로 문의해주세요."
        ),
    },
    # ── 스캔 (scan) ──────────────────────────────────────────────────────
    {
        "category": "scan",
        "order_num": 30,
        "question": "AI 스캔은 어떻게 작동하나요?",
        "answer": (
            "Gemini·ChatGPT·네이버 AI 브리핑·Google AI Overview 4채널에서 "
            "사업장 관련 키워드로 실제 쿼리를 보내 노출 여부를 측정합니다. "
            "결과는 점수와 채널별 상세 내역으로 제공됩니다."
        ),
    },
    {
        "category": "scan",
        "order_num": 31,
        "question": "스캔 결과가 나오는 데 얼마나 걸리나요?",
        "answer": (
            "기본 스캔은 약 2~5분, 전체 4채널 전체 스캔은 약 5~10분 소요됩니다. "
            "진행 상황은 실시간 프로그레스바로 확인할 수 있습니다."
        ),
    },
    {
        "category": "scan",
        "order_num": 32,
        "question": "스캔 결과가 실제 검색 결과와 다를 수 있나요?",
        "answer": (
            "네, 가능합니다. AI 검색 결과는 측정 시점·기기·로그인 상태·지역에 따라 달라질 수 있습니다. "
            "ChatGPT 측정은 AI 학습 데이터 기반이며 실시간 웹 검색 결과와 다를 수 있습니다."
        ),
    },
    {
        "category": "scan",
        "order_num": 33,
        "question": "얼마나 자주 스캔하면 좋나요?",
        "answer": (
            "Basic 플랜은 월 1회, Pro 이상은 주 1회 스캔을 권장합니다. "
            "스마트플레이스 정보·키워드·콘텐츠를 업데이트한 직후 즉시 재스캔하면 변화를 확인할 수 있습니다."
        ),
    },
    {
        "category": "scan",
        "order_num": 34,
        "question": "경쟁사도 분석할 수 있나요?",
        "answer": (
            "네, 대시보드 > 경쟁사 관리에서 최대 5개(Pro 이상)까지 경쟁사를 등록하고 "
            "AI 노출 점수를 비교할 수 있습니다. 어떤 키워드에서 경쟁사가 앞서는지도 파악할 수 있습니다."
        ),
    },
    {
        "category": "scan",
        "order_num": 35,
        "question": "점수(AI Visibility Score)는 어떻게 계산되나요?",
        "answer": (
            "네이버 중심 Track1(스마트플레이스 완성도·리뷰·키워드)과 "
            "글로벌 AI 중심 Track2(Gemini·ChatGPT·Google AI 노출)를 업종별 가중치로 합산합니다. "
            "음식점·카페는 네이버 비중이 높고, 법률·전문직은 글로벌 AI 비중이 높습니다."
        ),
    },
    {
        "category": "scan",
        "order_num": 36,
        "question": "네이버 AI 브리핑과 AI탭은 무엇이 다른가요?",
        "answer": (
            "AI 브리핑(플레이스형)은 음식점·카페·숙박 등 일부 업종에만 노출되지만, "
            "블로그·콘텐츠가 출처로 채택되는 '정보형 AI 브리핑'은 업종 제한 없이 노출될 수 있습니다. "
            "네이버 AI탭은 2026년 4월부터 모든 업종에서 검색결과에 노출됩니다. "
            "채널 모두 스마트플레이스 정보·리뷰·사진·콘텐츠 품질이 핵심입니다."
        ),
    },
    # ── 개선 가이드 (guide) ──────────────────────────────────────────────
    {
        "category": "guide",
        "order_num": 40,
        "question": "AI 개선 가이드는 어떤 내용인가요?",
        "answer": (
            "스캔 결과와 경쟁사 분석을 바탕으로 Claude AI가 업종·지역·현재 점수에 맞는 "
            "맞춤 개선 방안을 제공합니다. 스마트플레이스 최적화·키워드·콘텐츠·리뷰 전략이 포함됩니다."
        ),
    },
    {
        "category": "guide",
        "order_num": 41,
        "question": "개선 가이드를 얼마나 자주 받을 수 있나요?",
        "answer": (
            "스캔할 때마다 새로운 가이드를 생성할 수 있습니다. "
            "이전 가이드 이력도 대시보드 > 개선 가이드 탭에서 확인할 수 있습니다."
        ),
    },
    {
        "category": "guide",
        "order_num": 42,
        "question": "스마트플레이스 소개글을 AI가 작성해주나요?",
        "answer": (
            "네, Pro 이상 플랜에서 AI 소개글 초안 자동 생성 기능을 이용할 수 있습니다. "
            "사업장 정보와 키워드를 기반으로 네이버 AI 브리핑·AI탭 노출에 최적화된 소개글을 작성합니다."
        ),
    },
    {
        "category": "guide",
        "order_num": 43,
        "question": "키워드 갭 분석이 무엇인가요?",
        "answer": (
            "내 사업장이 노출되는 키워드와 경쟁사가 노출되는 키워드를 비교해서 "
            "내가 빠진 키워드, 선점할 수 있는 키워드를 알려주는 기능입니다. "
            "Basic 이상에서 이용할 수 있습니다."
        ),
    },
    {
        "category": "guide",
        "order_num": 44,
        "question": "JSON-LD 스키마 생성 기능이 무엇인가요?",
        "answer": (
            "구글 등 AI 검색이 사업장 정보를 더 정확하게 인식하도록 돕는 "
            "구조화 데이터(JSON-LD) 코드를 자동으로 생성해줍니다. "
            "생성된 코드를 홈페이지 HTML에 붙여넣으면 됩니다."
        ),
    },
    {
        "category": "guide",
        "order_num": 45,
        "question": "Before/After 히스토리는 어떻게 확인하나요?",
        "answer": (
            "대시보드 > 히스토리 탭에서 스캔 전후 점수 변화와 스크린샷을 비교할 수 있습니다. "
            "개선 조치 효과를 시각적으로 확인하는 데 활용하세요."
        ),
    },
    {
        "category": "guide",
        "order_num": 46,
        "question": "리뷰 감정 분석이란 무엇인가요?",
        "answer": (
            "네이버 플레이스 리뷰에서 긍정·부정 키워드와 고객 감정을 자동으로 분석합니다. "
            "어떤 점이 좋은 평가를 받고, 어떤 점을 개선해야 하는지 파악할 수 있습니다. "
            "Basic 이상에서 이용 가능합니다."
        ),
    },
    {
        "category": "guide",
        "order_num": 47,
        "question": "톡톡 채팅방 메뉴(FAQ)는 어떻게 최적화하나요?",
        "answer": (
            "대시보드 > 개선 가이드 > 톡톡 채팅방 메뉴에서 "
            "AI가 업종·자주 묻는 질문 패턴에 맞는 채팅방 메뉴 초안을 제공합니다. "
            "partner.talk.naver.com에서 직접 설정하면 됩니다."
        ),
    },
    {
        "category": "guide",
        "order_num": 48,
        "question": "대행 서비스를 이용할 수 있나요?",
        "answer": (
            "스마트플레이스 최적화 대행(49,000원)·콘텐츠 제작 패키지(79,000원)·"
            "AI 검색 종합 관리(119,000원) 3가지 서비스를 제공합니다. "
            "대시보드 > 대행 서비스에서 신청할 수 있습니다."
        ),
    },
]


async def run_seed() -> None:
    """faqs 테이블에 FAQ 30개를 upsert한다."""
    # 로컬 venv 환경에서만 실행 — 서버 임포트 경로 설정
    import os
    import sys
    # 프로젝트 루트에서 실행 시 backend/ 하위 경로 자동 추가
    _here = os.path.dirname(os.path.abspath(__file__))
    _root = os.path.dirname(_here)
    if _root not in sys.path:
        sys.path.insert(0, _root)

    from db.supabase_client import get_client, execute  # noqa: E402 (dynamic import)

    supabase = get_client()

    # 기존 레코드 조회 (question 기준)
    existing_res = await execute(
        supabase.table("faqs").select("question").eq("is_active", True)
    )
    existing_questions = {row["question"] for row in (existing_res.data or [])}

    inserted = 0
    skipped = 0
    for item in FAQ_DATA:
        if item["question"] in existing_questions:
            skipped += 1
            continue
        try:
            await execute(
                supabase.table("faqs").insert({
                    "question": item["question"],
                    "answer": item["answer"],
                    "category": item["category"],
                    "order_num": item["order_num"],
                    "is_active": True,
                })
            )
            inserted += 1
            _logger.info("inserted: %s", item["question"][:40])
        except Exception as exc:
            _logger.warning("insert failed for %r: %s", item["question"][:40], exc)

    _logger.info("Done — inserted=%d, skipped=%d (already exists)", inserted, skipped)


if __name__ == "__main__":
    asyncio.run(run_seed())
