filepath = "/var/www/aeolab/frontend/app/(dashboard)/guide/GuideClient.tsx"
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Find the smartplace-faq fetch call and add body
# The pattern without body (after our generate function signature change)
target = "        ...(token ? { Authorization: `Bearer ${token}` } : {}),\n        },\n      })\n      if (!res.ok) {\n        const err = await res.json().catch(() => ({})) as { detail?: string }\n        throw new Error(err.detail || '생성 실패')"

replacement = "        ...(token ? { Authorization: `Bearer ${token}` } : {}),\n        },\n        body: JSON.stringify({ keywords }),\n      })\n      if (!res.ok) {\n        const err = await res.json().catch(() => ({})) as { detail?: string }\n        throw new Error(err.detail || '생성 실패')"

if target in content:
    content = content.replace(target, replacement, 1)  # replace only first occurrence
    print("API body 추가 성공")
else:
    print("패턴 미발견, 수동 확인 필요")
    # Show context
    idx = content.find("smartplace-faq")
    print(repr(content[idx:idx+400]))

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("저장 완료")
