import asyncio, sys
sys.path.insert(0, '/var/www/aeolab/backend')
import os; os.chdir('/var/www/aeolab/backend')
from dotenv import load_dotenv
load_dotenv('/var/www/aeolab/backend/.env')
from routers.competitor import _search_kakao, _search_google, _search_naver

async def test():
    kakao, google, naver = await asyncio.gather(
        _search_kakao('카페', '창원시'),
        _search_google('카페', '창원시'),
        _search_naver('카페', '창원시'),
    )
    print('카카오: {}개'.format(len(kakao)))
    print('Google: {}개'.format(len(google)))
    print('네이버: {}개'.format(len(naver)))
    # 중복 제거
    seen = set()
    merged = []
    for item in [*kakao, *google, *naver]:
        if item['name'] not in seen:
            seen.add(item['name'])
            merged.append(item)
    print('통합 결과: {}개'.format(len(merged)))
    for r in merged[:5]:
        addr = r['address'][:30] if r.get('address') else ''
        print('  [{}] {} | {}'.format(r['source'], r['name'], addr))

asyncio.run(test())
