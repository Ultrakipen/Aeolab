interface BeforeAfterItem {
  id: string
  capture_type: string
  image_url: string
  created_at: string
}

interface BeforeAfterCardProps {
  items: BeforeAfterItem[]
  businessName: string
}

const TYPE_LABEL: Record<string, string> = {
  before: '가입 시점',
  after_30d: '30일 후',
  after_60d: '60일 후',
  after_90d: '90일 후',
}

export function BeforeAfterCard({ items, businessName }: BeforeAfterCardProps) {
  const before = items.find((i) => i.capture_type === 'before')
  const afters = items.filter((i) => i.capture_type.startsWith('after_'))

  if (!before) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <div className="text-sm font-medium text-gray-700 mb-2">Before / After 비교</div>
        <p className="text-sm text-gray-400">Before 스크린샷이 아직 준비되지 않았습니다.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm">
      <div className="text-sm font-medium text-gray-700 mb-4">
        {businessName} — Before / After 변화
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <div className="text-xs text-gray-500 mb-1 text-center">가입 시점 (Before)</div>
          <img
            src={before.image_url}
            alt="before"
            className="w-full rounded-lg border border-gray-200 object-cover aspect-video"
          />
          <div className="text-xs text-gray-400 text-center mt-1">
            {new Date(before.created_at).toLocaleDateString('ko-KR')}
          </div>
        </div>
        {afters.map((after) => (
          <div key={after.id}>
            <div className="text-xs text-blue-600 mb-1 text-center font-medium">
              {TYPE_LABEL[after.capture_type] ?? after.capture_type}
            </div>
            <img
              src={after.image_url}
              alt={after.capture_type}
              className="w-full rounded-lg border border-blue-200 object-cover aspect-video"
            />
            <div className="text-xs text-gray-400 text-center mt-1">
              {new Date(after.created_at).toLocaleDateString('ko-KR')}
            </div>
          </div>
        ))}
        {afters.length === 0 && (
          <div className="col-span-3 flex items-center justify-center bg-gray-50 rounded-lg h-24">
            <p className="text-xs text-gray-400 text-center px-4">
              가입 30일 후 After 스크린샷이<br />자동으로 생성됩니다.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
