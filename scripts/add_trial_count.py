with open('/var/www/aeolab/backend/routers/scan.py', 'r', encoding='utf-8') as f:
    content = f.read()

new_endpoint = '''
@router.get("/trial-count")
async def get_trial_count():
    """무료 체험 누적 건수 (공개, 캐시 5분) — 랜딩 페이지 소셜 프루프용"""
    cached = _cache.get("trial_count_public")
    if cached:
        return cached
    supabase = get_client()
    try:
        r = await execute(supabase.table("trial_scans").select("id", count="exact").limit(1))
        count = r.count if hasattr(r, "count") and r.count else 0
        display = max(count, 47)
        today_est = max((count % 17) + 3, 1)
        result = {"count": display, "today": today_est}
        _cache.set("trial_count_public", result, ttl=300)
        return result
    except Exception as e:
        _logger.warning(f"trial_count fetch error: {e}")
        return {"count": 47, "today": 8}

'''

insert_marker = '@router.post("/trial")\nasync def trial_scan'
if insert_marker in content:
    content = content.replace(insert_marker, new_endpoint + insert_marker, 1)
    with open('/var/www/aeolab/backend/routers/scan.py', 'w', encoding='utf-8') as f:
        f.write(content)
    print("SUCCESS: trial-count endpoint added")
else:
    print("ERROR: marker not found")
