with open('/var/www/aeolab/frontend/app/(public)/trial/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. 인라인 "무료 가입하기 →" 버튼 아래에 가격 텍스트 추가
old_inline_cta = '''                  <a href="/signup" className="inline-block px-4 py-1.5 bg-blue-600 text-white text-sm font-semibold rounded-full hover:bg-blue-700">
                    무료 가입하기 →
                  </a>
                </div>'''

new_inline_cta = '''                  <a href="/signup" className="inline-block px-4 py-1.5 bg-blue-600 text-white text-sm font-semibold rounded-full hover:bg-blue-700">
                    무료 가입하기 →
                  </a>
                  <p className="text-xs text-gray-400 mt-1.5">Basic 월 9,900원부터 · 언제든 해지 가능</p>
                </div>'''

if old_inline_cta in content:
    content = content.replace(old_inline_cta, new_inline_cta, 1)
    print("OK: inline CTA price text added")
else:
    print("WARNING: inline CTA marker not found, skipping")

with open('/var/www/aeolab/frontend/app/(public)/trial/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("SUCCESS: trial page updated")
