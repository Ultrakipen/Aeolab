"""
AEOlab 에이전트 자동 라우터
UserPromptSubmit 훅에서 실행 — 요청 내용을 분석하여 적절한 에이전트 힌트를 출력
"""
import sys
import json
import os
import io

# Windows 인코딩 강제 UTF-8
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")
    sys.stdin = io.TextIOWrapper(sys.stdin.buffer, encoding="utf-8", errors="replace")

# 에이전트 라우팅 규칙
ROUTING_RULES = [
    {
        "agent": "next-feature",
        "label": "새 기능 설계",
        "keywords": [
            "새 기능", "새로운 기능", "기능 추가", "구현하고 싶", "만들고 싶",
            "설계", "기획", "구현 범위", "어떻게 만들", "추가하려고",
            "next feature", "new feature",
        ],
        "priority": 10,  # 높을수록 먼저 체크
    },
    {
        "agent": "deploy",
        "label": "서버 배포",
        "keywords": [
            "배포", "서버 반영", "서버에 올려", "scp", "pm2", "재시작",
            "업로드", "빌드", "올려줘", "deploy", "반영해줘",
            "서버에 적용", "서버 업로드",
        ],
        "priority": 9,
    },
    {
        "agent": "code-review",
        "label": "코드 검토",
        "keywords": [
            "코드 검토", "리뷰", "점검", "버그 확인", "보안 검토",
            "배포 전 확인", "review", "check", "검증", "확인해줘",
        ],
        "priority": 8,
    },
    {
        "agent": "scan-engine",
        "label": "스캔 엔진 / 스코어 모델",
        "keywords": [
            "스캔 엔진", "score_engine", "gap_analyzer", "keyword_gap",
            "듀얼트랙", "dual track", "GrowthStage", "성장 단계",
            "AI 스캐너", "브리핑 엔진", "briefing_engine", "keyword_taxonomy",
            "track1", "track2", "unified_score", "naver_weight",
            "gemini_scanner", "multi_scanner", "guide_generator",
        ],
        "priority": 7,
    },
    {
        "agent": "db-migrate",
        "label": "DB 마이그레이션",
        "keywords": [
            "테이블", "컬럼 추가", "마이그레이션", "supabase sql",
            "schema.sql", "인덱스", "ALTER TABLE", "CREATE TABLE",
            "DB 변경", "데이터베이스", "migration",
        ],
        "priority": 6,
    },
    {
        "agent": "backend-dev",
        "label": "백엔드 개발",
        "keywords": [
            "백엔드", "FastAPI", "라우터", "router", "서비스 로직",
            "API 엔드포인트", "Pydantic", "스케줄러", "scheduler",
            "routers/", "models/", "middleware/",
            "plan_gate", "webhook", "엔드포인트", "백엔드 수정",
            "main.py", "jobs.py", "rate_limit",
        ],
        "priority": 5,
    },
    {
        "agent": "frontend-dev",
        "label": "프론트엔드 개발",
        "keywords": [
            "프론트엔드", "Next.js", "컴포넌트", "component", "페이지",
            "tsx", "CSS", "반응형", "모바일", "UI", "화면",
            "Tailwind", "shadcn", "Recharts", "차트", "대시보드 UI",
            "버튼", "폼", "레이아웃", "스타일",
        ],
        "priority": 5,
    },
]


def detect_agents(prompt: str) -> list[dict]:
    """프롬프트에서 관련 에이전트를 감지하여 우선순위 순으로 반환"""
    prompt_lower = prompt.lower()
    matched = []

    for rule in sorted(ROUTING_RULES, key=lambda r: r["priority"], reverse=True):
        for kw in rule["keywords"]:
            if kw.lower() in prompt_lower:
                # 중복 추가 방지
                if not any(m["agent"] == rule["agent"] for m in matched):
                    matched.append({
                        "agent": rule["agent"],
                        "label": rule["label"],
                        "matched_keyword": kw,
                    })
                break

    return matched


def main():
    # UserPromptSubmit 훅: stdin으로 JSON 수신
    try:
        raw = sys.stdin.read()
        data = json.loads(raw) if raw.strip() else {}
        prompt = data.get("prompt", "")
    except Exception:
        prompt = ""

    if not prompt:
        return

    matched = detect_agents(prompt)

    if not matched:
        return

    # 에이전트 힌트 출력 (Claude가 context로 읽음)
    print("\n" + "-" * 50)
    print("[에이전트 라우터] 요청 분석 결과:")

    if len(matched) == 1:
        m = matched[0]
        print(f"   -> {m['agent']} 에이전트 사용 ({m['label']})")
        print(f"      감지 키워드: '{m['matched_keyword']}'")
    else:
        print(f"   -> {len(matched)}개 에이전트 관련 작업 감지:")
        for i, m in enumerate(matched, 1):
            print(f"   {i}. {m['agent']} ({m['label']}) -- '{m['matched_keyword']}'")
        if len(matched) >= 2:
            print("   ※ 독립 작업이면 병렬 실행 권장")

    print("-" * 50 + "\n")


if __name__ == "__main__":
    main()
