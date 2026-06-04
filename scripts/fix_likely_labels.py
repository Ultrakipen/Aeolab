import os

# LIKELY 업종 "확대 검토 중" → "연내 확대 예정 (네이버 공식)" 일괄 수정
# 근거: 네이버 최수연 대표 컨퍼런스콜 2026-02-06 공식 예고 (미용·명소 포함 연내 두 자릿수 업종 목표)

replacements = [
    # 라벨/배지 (짧은 형태)
    ('확대 검토 중)', '연내 확대 예정 (네이버 공식))'),
    # 이 패턴이 위에서 처리되지 않는 경우를 위해 추가
    ('"확대 검토 중"', '"연내 확대 예정"'),
    ('>확대 검토 중<', '>연내 확대 예정<'),
    # 문장 내 (긴 형태)
    ('AI 브리핑 업종 확대 검토 중', 'AI 브리핑 연내 확대 예정 (네이버 공식)'),
    ('AI 브리핑 확대 검토 중', 'AI 브리핑 연내 확대 예정'),
    ('업종 확대는 검토 중이며', '업종 확대는 연내 예정이며 (네이버 공식)'),
    ('현재 확대 검토 중입니다', '연내 확대 예정입니다 (네이버 공식)'),
]

target_files = [
    r'c:\app_build\aeolab\frontend\app\(public)\trial\components\TrialResultStep.tsx',
    r'c:\app_build\aeolab\frontend\components\dashboard\DualTrackCard.tsx',
    r'c:\app_build\aeolab\frontend\components\trial\NaverTrackCard.tsx',
]

for fpath in target_files:
    try:
        with open(fpath, 'r', encoding='utf-8') as f:
            content = f.read()
        new_content = content
        for old, new in replacements:
            new_content = new_content.replace(old, new)
        if new_content != content:
            with open(fpath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f'Updated: {fpath}')
        else:
            print(f'No change: {fpath}')
    except Exception as e:
        print(f'ERROR {fpath}: {e}')
