import os

replacements = [
    ('베타 서비스 확장 중 (네이버 공식)', '2026-06 전체 사용자 확대 (공식 발표)'),
    ('베타 서비스 확장 중 — 네이버 공식', '2026-06 전체 사용자 확대 (공식 발표)'),
    ('베타 서비스 확장 중', '2026-06 전체 사용자 확대 예정'),
    ('상반기 전체 확대 예정 (네이버 공식)', '2026-06 전체 확대 (공식 발표)'),
    ('전체 이용자 확대 예정', '2026-06 전체 사용자 확대'),
    ('2026 AI탭 베타 공개·확대 진행 중', '2026-06 전체 사용자 확대 (2026-05-28 공식 발표)'),
]

root_dir = r'c:\app_build\aeolab\frontend'
changed_files = []

for root, dirs, files in os.walk(root_dir):
    dirs[:] = [d for d in dirs if d != 'node_modules']
    for fname in files:
        if not fname.endswith(('.tsx', '.ts')):
            continue
        fpath = os.path.join(root, fname)
        try:
            with open(fpath, 'r', encoding='utf-8') as f:
                content = f.read()
            new_content = content
            for old, new in replacements:
                new_content = new_content.replace(old, new)
            if new_content != content:
                with open(fpath, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                changed_files.append(fpath)
        except Exception as e:
            print(f'ERROR {fpath}: {e}')

print(f'변경된 파일 수: {len(changed_files)}')
for f in changed_files:
    print(' -', f)
