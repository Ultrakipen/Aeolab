"""jobs.py에 check_action_rescans + detect_competitor_changes 잡 등록 + 함수 본문 추가"""
JOBS_PATH = "/var/www/aeolab/backend/scheduler/jobs.py"

with open(JOBS_PATH, "r", encoding="utf-8") as f:
    content = f.read()

# ── 1. scheduler.start() 바로 앞에 잡 등록 삽입 ───────────────────────────
NEW_JOBS = (
    "    # 행동 완료 7일 후 재스캔 (매일 새벽 3시)\n"
    "    scheduler.add_job(\n"
    '        check_action_rescans, "cron", hour=3, minute=0, id="action_rescans",\n'
    "        max_instances=1, misfire_grace_time=300,\n"
    "    )\n"
    "    # 경쟁사 변화 감지 (매주 월요일 새벽 4시)\n"
    "    scheduler.add_job(\n"
    '        detect_competitor_changes, "cron", day_of_week="mon", hour=4, minute=0,\n'
    '        id="competitor_changes", max_instances=1, misfire_grace_time=300,\n'
    "    )\n"
    "    "
)

MARKER = "    scheduler.start()"
assert MARKER in content, "ERROR: scheduler.start() marker not found"
content = content.replace(MARKER, NEW_JOBS + MARKER, 1)

# ── 2. 파일 끝에 두 함수 본문 추가 ──────────────────────────────────────────
NEW_FUNCS = """

async def check_action_rescans():
    \"\"\"행동 완료 7일 후 Gemini 단일 재스캔 → Before/After 결과 저장 (매일 03:00)\"\"\"
    from db.supabase_client import get_client
    from services.ai_scanner.gemini_scanner import GeminiScanner
    from datetime import datetime, timezone
    import asyncio as _aio

    try:
        supabase = get_client()
        now_iso = datetime.now(timezone.utc).isoformat()

        pending = (
            supabase.table("action_completions")
            .select(
                "id, business_id, keyword, action_type, "
                "before_score, before_mentioned"
            )
            .lte("rescan_at", now_iso)
            .eq("rescan_done", False)
            .limit(20)
            .execute()
            .data
        ) or []

        logger.info(f"[check_action_rescans] 처리 대상 {len(pending)}건")

        gemini = GeminiScanner()

        for action in pending:
            try:
                biz_id = action["business_id"]
                keyword = action["keyword"]
                action_id = action["id"]

                biz = (
                    supabase.table("businesses")
                    .select("name, region, category")
                    .eq("id", biz_id)
                    .maybe_single()
                    .execute()
                )
                if not biz.data:
                    logger.warning(f"[action_rescan] 사업장 없음 biz_id={biz_id}")
                    continue

                biz_name = biz.data["name"]
                region = biz.data.get("region", "")
                query = f"{region} {keyword}".strip() if region else keyword

                result = await gemini.single_check(query, biz_name)
                after_mentioned = bool(result.get("exposure_freq", 0) > 0)

                score_row = (
                    supabase.table("scan_results")
                    .select("unified_score, track1_score")
                    .eq("business_id", biz_id)
                    .order("scanned_at", desc=True)
                    .limit(1)
                    .maybe_single()
                    .execute()
                )
                after_score = None
                if score_row.data:
                    after_score = (
                        score_row.data.get("unified_score")
                        or score_row.data.get("track1_score")
                    )

                before_mentioned = action.get("before_mentioned")

                if before_mentioned is False and after_mentioned:
                    summary = (
                        f"'{keyword}' 키워드로 AI 브리핑에 노출되기 시작했습니다 ✓"
                    )
                elif before_mentioned and after_mentioned:
                    summary = "AI 브리핑 노출이 유지되고 있습니다"
                else:
                    summary = (
                        "아직 AI 브리핑에 반영되지 않았습니다. 조금 더 기다려주세요"
                    )

                supabase.table("action_completions").update(
                    {
                        "after_score": after_score,
                        "after_mentioned": after_mentioned,
                        "result_summary": summary,
                        "rescan_done": True,
                    }
                ).eq("id", action_id).execute()

                logger.info(
                    f"[action_rescan] 완료 — id={action_id}, "
                    f"before={before_mentioned}, after={after_mentioned}"
                )
                await _aio.sleep(2)

            except Exception as e:
                logger.warning(f"[action_rescan] 개별 처리 실패 id={action.get('id')}: {e}")

    except Exception as e:
        logger.error(f"check_action_rescans 실패: {e}")
        await send_slack_alert("check_action_rescans 실패", str(e), level="error")


async def detect_competitor_changes():
    \"\"\"경쟁사 플레이스 정보 변화 감지 → notifications 테이블 저장 (매주 월 04:00)\"\"\"
    from db.supabase_client import get_client
    from datetime import datetime, timezone

    try:
        supabase = get_client()

        rows = (
            supabase.table("competitors")
            .select(
                "id, business_id, name, "
                "has_faq, has_menu, has_recent_post, "
                "review_count, photo_count, "
                "prev_has_faq, prev_has_menu, prev_has_recent_post, "
                "prev_review_count, prev_photo_count"
            )
            .eq("is_active", True)
            .execute()
            .data
        ) or []

        logger.info(f"[detect_competitor_changes] 점검 대상 {len(rows)}개 경쟁사")

        for comp in rows:
            try:
                comp_id = comp["id"]
                changes = []

                def _chk_flag(key, prev_key, label):
                    cur = comp.get(key)
                    prev = comp.get(prev_key)
                    if cur is not None and prev is not None and cur != prev:
                        changes.append(f"{label} {'신규 등록' if cur else '삭제'}")

                def _chk_count(key, prev_key, label):
                    cur = comp.get(key) or 0
                    prev = comp.get(prev_key) or 0
                    diff = cur - prev
                    if abs(diff) >= 5:
                        changes.append(f"{label} {abs(diff)}개 {'증가' if diff > 0 else '감소'}")

                _chk_flag("has_faq", "prev_has_faq", "FAQ")
                _chk_flag("has_menu", "prev_has_menu", "메뉴")
                _chk_flag("has_recent_post", "prev_has_recent_post", "소식")
                _chk_count("review_count", "prev_review_count", "리뷰")
                _chk_count("photo_count", "prev_photo_count", "사진")

                now_iso = datetime.now(timezone.utc).isoformat()
                update_data = {
                    "prev_has_faq": comp.get("has_faq"),
                    "prev_has_menu": comp.get("has_menu"),
                    "prev_has_recent_post": comp.get("has_recent_post"),
                    "prev_review_count": comp.get("review_count") or 0,
                    "prev_photo_count": comp.get("photo_count") or 0,
                }

                if changes:
                    change_summary = ", ".join(changes)
                    update_data["change_summary"] = change_summary
                    update_data["change_detected_at"] = now_iso
                    logger.info(f"[competitor_change] {comp['name']}: {change_summary}")

                    biz_row = (
                        supabase.table("businesses")
                        .select("user_id")
                        .eq("id", comp["business_id"])
                        .maybe_single()
                        .execute()
                    )
                    if biz_row.data:
                        supabase.table("notifications").insert(
                            {
                                "user_id": biz_row.data["user_id"],
                                "type": "competitor_change",
                                "message": (
                                    f"경쟁사 '{comp['name']}'에 변화가 감지됐습니다: "
                                    f"{change_summary}"
                                ),
                                "is_read": False,
                            }
                        ).execute()

                supabase.table("competitors").update(update_data).eq("id", comp_id).execute()

            except Exception as e:
                logger.warning(f"[competitor_change] 개별 처리 실패 comp={comp.get('name')}: {e}")

    except Exception as e:
        logger.error(f"detect_competitor_changes 실패: {e}")
        await send_slack_alert("detect_competitor_changes 실패", str(e), level="error")
"""

content = content + NEW_FUNCS

with open(JOBS_PATH, "w", encoding="utf-8") as f:
    f.write(content)

print("jobs.py 수정 완료")
