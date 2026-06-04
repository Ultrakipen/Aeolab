import os

replacements = [
    ('(연내 확대 예정 (네이버 공식))', '(연내 확대 예정 — 네이버 공식)'),
    ('(AI탭 가능·AI 브리핑 연내 확대 예정 (네이버 공식))', '(AI탭 가능 · AI 브리핑 연내 확대 예정 — 네이버 공식)'),
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
            print(f'Fixed: {fpath}')
        else:
            print(f'No change: {fpath}')
    except Exception as e:
        print(f'ERROR: {e}')
