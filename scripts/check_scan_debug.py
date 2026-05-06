import sys, json
sys.path.insert(0, '/var/www/aeolab/backend')
from dotenv import load_dotenv
load_dotenv('/var/www/aeolab/backend/.env')
from db.supabase_client import get_client
sb = get_client()

biz_ids = [
    '67cbd65c-9aec-43cd-be59-9507715cbe5b',
    '3492607f-a115-4fb2-9c2d-1a70f3e58af0',
    '515bfbf8-a289-486b-8cdc-195f17e928d5',
    'df4324d8-d416-4743-bc37-61edcd6a4feb',
    '4017f136-c258-412a-96da-9944c66f9682',
]

print('=== 사업장 상세 정보 ===')
for biz_id in biz_ids:
    biz_r = sb.table('businesses').select(
        'id,name,category,region,review_count,avg_rating,has_faq,has_recent_post,has_intro,has_schema,kakao_place_id,google_place_id,keywords'
    ).eq('id', biz_id).execute()
    if biz_r.data:
        print(biz_r.data[0])

print()
print('=== 스캔결과 확인 ===')
for biz_id in biz_ids:
    r = sb.table('scan_results').select(
        'id,business_id,scanned_at,track1_score,track2_score,unified_score,keyword_coverage,total_score,growth_stage,naver_result,gemini_result,top_missing_keywords,score_breakdown'
    ).eq('business_id', biz_id).order('scanned_at', desc=True).limit(2).execute()
    if r.data:
        print('=== biz %s 스캔결과 %d개 ===' % (biz_id[:8], len(r.data)))
        for row in r.data:
            naver = row.get('naver_result') or {}
            gemini = row.get('gemini_result') or {}
            breakdown = row.get('score_breakdown') or {}
            print('  scanned_at=%s' % row['scanned_at'])
            print('  track1=%s track2=%s unified=%s total=%s' % (
                row['track1_score'], row['track2_score'], row['unified_score'], row['total_score']))
            print('  growth_stage=%s keyword_coverage=%s' % (row['growth_stage'], row['keyword_coverage']))
            print('  top_missing=%s' % row['top_missing_keywords'])
            print('  naver mentioned=%s in_briefing=%s review_count=%s' % (
                naver.get('mentioned'), naver.get('in_briefing'), naver.get('review_count')))
            print('  gemini exposure_freq=%s mentioned=%s' % (gemini.get('exposure_freq'), gemini.get('mentioned')))
            print('  score_breakdown=%s' % json.dumps(breakdown, ensure_ascii=False) if breakdown else '  score_breakdown=없음')
    else:
        print('=== biz %s 스캔결과 없음 ===' % biz_id[:8])

print()
print('=== score_history 확인 ===')
for biz_id in biz_ids:
    r = sb.table('score_history').select('*').eq('business_id', biz_id).order('score_date', desc=True).limit(3).execute()
    if r.data:
        print('score_history biz %s: %d개' % (biz_id[:8], len(r.data)))
        for row in r.data:
            print('  ', row)
    else:
        print('score_history biz %s: 없음' % biz_id[:8])
