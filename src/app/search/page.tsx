'use client'

import { useRouter, usePathname } from 'next/navigation'

export default function SearchPage() {
  const router = useRouter()
  const pathname = usePathname()

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* 상단바 */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <h1 className="text-xl font-bold text-center">검색</h1>
      </div>

      <div className="pb-20 px-4 pt-6">
        <div className="text-center py-20">
          <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg">
            <span className="text-white text-5xl">🔍</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">티켓 검색</h2>
          <p className="text-gray-600 mb-8">원하는 티켓을 검색해보세요</p>

          {/* 검색 입력창 */}
          <div className="bg-white rounded-2xl p-4 shadow-sm mb-6">
            <div className="flex items-center space-x-3 bg-gray-100 rounded-xl px-4 py-3">
              <span className="text-gray-500 text-lg">🔍</span>
              <input
                type="text"
                placeholder="이벤트명, 아티스트, 장소 검색..."
                className="flex-1 bg-transparent outline-none text-gray-800"
              />
            </div>
          </div>

          {/* 인기 검색어 */}
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 text-left">🔥 인기 검색어</h3>
            <div className="flex flex-wrap gap-2">
              {['IU 콘서트', '뮤지컬', '야구 경기', '전시회', '페스티벌'].map((keyword, index) => (
                <span key={index} className="bg-gray-100 text-gray-800 px-3 py-2 rounded-xl text-sm font-medium">
                  {keyword}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 하단 네비게이션 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200">
        <div className="flex">
          <button onClick={() => router.push('/')} className="flex-1 flex flex-col items-center py-3 text-gray-500">
            <span className="text-lg">🏠</span>
            <span className="text-xs mt-1">홈</span>
          </button>
          <button onClick={() => router.push('/search')} className="flex-1 flex flex-col items-center py-3 text-blue-600">
            <span className="text-lg">🔍</span>
            <span className="text-xs mt-1">검색</span>
          </button>
          <button onClick={() => router.push('/my-tickets')} className="flex-1 flex flex-col items-center py-3 text-gray-500">
            <span className="text-lg">🎫</span>
            <span className="text-xs mt-1">내 티켓</span>
          </button>
          <button onClick={() => router.push('/profile')} className="flex-1 flex flex-col items-center py-3 text-gray-500">
            <span className="text-lg">👤</span>
            <span className="text-xs mt-1">프로필</span>
          </button>
        </div>
      </div>
    </div>
  )
}