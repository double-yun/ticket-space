'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import TopBar from '@/components/TopBar'
import LoadingSpinner from '@/components/LoadingSpinner'
import { Shield, Copy, Check, AlertTriangle, Eye, EyeOff, ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import { copyToClipboard } from '@/lib/copy-to-clipboard'

export default function RecoveryCodePage() {
  const router = useRouter()
  const { user, token, isLoading: authLoading } = useAuth()
  const [loading, setLoading] = useState(false)
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null)
  const [hasRecoveryCode, setHasRecoveryCode] = useState(false)
  const [showCode, setShowCode] = useState(false)
  const [copied, setCopied] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!user || !token) {
      router.push('/login')
      return
    }

    // 사용자가 이미 복구 코드를 가지고 있는지 확인 (User 모델에 recoveryCodeHash 필드 체크)
    // 실제로는 API를 호출해서 확인해야 하지만, 여기서는 간단히 처리
    checkRecoveryCodeStatus()
  }, [authLoading, user, token, router])

  const checkRecoveryCodeStatus = async () => {
    // TODO: API로 복구 코드 존재 여부 확인
    // 현재는 간단히 user 객체에서 확인
    setHasRecoveryCode(false) // 기본값: 없음으로 설정
  }

  const handleGenerateCode = async () => {
    if (!user || !token) return

    try {
      setLoading(true)
      const response = await fetch('/api/auth/generate-recovery', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: user.id,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setRecoveryCode(data.recoveryCode)
        setHasRecoveryCode(true)
        toast.success('복구 코드가 생성되었습니다.')
      } else {
        toast.error(data.error || '복구 코드 생성에 실패했습니다.')
      }
    } catch (error) {
      console.error('복구 코드 생성 실패:', error)
      toast.error('복구 코드 생성 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleCopyCode = async () => {
    if (!recoveryCode) return

    try {
      await copyToClipboard(recoveryCode)
      setCopied(true)
      toast.success('복구 코드가 복사되었습니다.')

      setTimeout(() => {
        setCopied(false)
      }, 2000)
    } catch (error) {
      console.error('복사 실패:', error)
      toast.error('복사에 실패했습니다.')
    }
  }

  const handleConfirm = () => {
    if (!confirmed) {
      toast.error('복구 코드를 안전하게 보관했는지 확인해주세요.')
      return
    }
    router.push('/profile')
  }

  if (authLoading || !user) {
    return (
      <div className="bg-gray-50 min-h-[var(--app-height)] flex justify-center items-center">
        <LoadingSpinner size={48} />
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-b from-emerald-50/30 via-white to-teal-50/30 min-h-[var(--app-height)] flex flex-col">
      <TopBar
        title="복구 코드 관리"
        leftButton={
          <button onClick={() => router.back()} className="p-2">
            <ArrowLeft size={24} className="text-gray-900" />
          </button>
        }
      />

      <main className="flex-1 overflow-y-auto px-4 py-6">
        {/* 경고 메시지 */}
        <div className="bg-amber-50/80 backdrop-blur-sm border border-amber-200/50 rounded-3xl p-5 mb-6">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <AlertTriangle className="text-amber-600" size={24} />
            </div>
            <div>
              <h3 className="font-bold text-amber-900 mb-2">중요 안내</h3>
              <p className="text-sm text-amber-800 leading-relaxed">
                복구 코드는 기기를 분실하거나 앱을 재설치했을 때 계정을 복구하는 유일한 수단입니다.
                복구 코드를 분실하면 계정을 복구할 수 없으니 안전한 곳에 보관하세요.
              </p>
            </div>
          </div>
        </div>

        {!hasRecoveryCode && !recoveryCode ? (
          // 복구 코드가 없을 때 - 생성 안내
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-sm border border-gray-100/50">
            <div className="flex justify-center mb-6">
              <div className="w-24 h-24 bg-emerald-500/10 backdrop-blur-xl border border-emerald-200/30 rounded-full flex items-center justify-center">
                <Shield size={48} className="text-emerald-600" strokeWidth={2} />
              </div>
            </div>

            <h2 className="text-2xl font-bold text-gray-900 text-center mb-3">
              복구 코드 생성
            </h2>
            <p className="text-gray-600 text-center mb-8 leading-relaxed">
              계정 보안을 위해 복구 코드를 생성하세요.<br />
              기기 분실 시 이 코드로 계정을 복구할 수 있습니다.
            </p>

            <button
              onClick={handleGenerateCode}
              disabled={loading}
              className="w-full bg-emerald-500/80 backdrop-blur-sm border border-emerald-300/30 text-white py-4 rounded-2xl font-bold shadow-sm transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '생성 중...' : '복구 코드 생성하기'}
            </button>
          </div>
        ) : recoveryCode ? (
          // 복구 코드가 방금 생성되었을 때
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-sm border border-gray-100/50">
            <div className="flex justify-center mb-6">
              <div className="w-24 h-24 bg-emerald-500/10 backdrop-blur-xl border border-emerald-200/30 rounded-full flex items-center justify-center">
                <Shield size={48} className="text-emerald-600" strokeWidth={2} />
              </div>
            </div>

            <h2 className="text-2xl font-bold text-gray-900 text-center mb-3">
              복구 코드가 생성되었습니다
            </h2>
            <p className="text-gray-600 text-center mb-6">
              이 코드는 다시 확인할 수 없습니다.<br />
              반드시 안전한 곳에 보관하세요.
            </p>

            {/* 복구 코드 표시 */}
            <div className="bg-gray-50 rounded-2xl p-6 mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-900">복구 코드 (12단어)</h3>
                <button
                  onClick={() => setShowCode(!showCode)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  {showCode ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>

              {showCode ? (
                <div className="font-mono text-sm text-gray-800 leading-relaxed break-all bg-white p-4 rounded-xl border border-gray-200">
                  {recoveryCode}
                </div>
              ) : (
                <div className="text-gray-400 text-center py-4">
                  눈 아이콘을 클릭하여 복구 코드를 확인하세요
                </div>
              )}
            </div>

            {/* 복사 버튼 */}
            <button
              onClick={handleCopyCode}
              disabled={!showCode}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-3.5 rounded-2xl font-semibold mb-6 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {copied ? (
                <>
                  <Check size={20} />
                  복사됨
                </>
              ) : (
                <>
                  <Copy size={20} />
                  복구 코드 복사
                </>
              )}
            </button>

            {/* 확인 체크박스 */}
            <label className="flex items-start gap-3 mb-6 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-1 w-5 h-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-sm text-gray-700">
                복구 코드를 안전한 곳에 보관했으며, 이 코드를 다시 확인할 수 없음을 이해했습니다.
              </span>
            </label>

            {/* 확인 버튼 */}
            <button
              onClick={handleConfirm}
              disabled={!confirmed}
              className="w-full bg-emerald-500/80 backdrop-blur-sm border border-emerald-300/30 text-white py-4 rounded-2xl font-bold shadow-sm transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              확인
            </button>

            {/* 보안 팁 */}
            <div className="mt-6 bg-blue-50/50 rounded-2xl p-4">
              <h4 className="font-semibold text-blue-900 mb-2 text-sm">보안 팁</h4>
              <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
                <li>복구 코드를 종이에 적어 안전한 곳에 보관하세요</li>
                <li>디지털 파일로 저장할 경우 암호화된 저장소를 사용하세요</li>
                <li>타인과 공유하지 마세요</li>
                <li>스크린샷은 클라우드 동기화를 끄고 촬영하세요</li>
              </ul>
            </div>
          </div>
        ) : (
          // 이미 복구 코드가 있을 때
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-sm border border-gray-100/50">
            <div className="flex justify-center mb-6">
              <div className="w-24 h-24 bg-emerald-500/10 backdrop-blur-xl border border-emerald-200/30 rounded-full flex items-center justify-center">
                <Shield size={48} className="text-emerald-600" strokeWidth={2} />
              </div>
            </div>

            <h2 className="text-2xl font-bold text-gray-900 text-center mb-3">
              복구 코드가 설정되어 있습니다
            </h2>
            <p className="text-gray-600 text-center mb-8">
              계정이 복구 코드로 보호되고 있습니다.<br />
              기기를 분실한 경우 로그인 화면에서 계정 복구를 진행하세요.
            </p>

            <div className="bg-emerald-50/50 rounded-2xl p-4 mb-6">
              <h4 className="font-semibold text-emerald-900 mb-2 text-sm">복구 방법</h4>
              <ol className="text-xs text-emerald-800 space-y-2 list-decimal list-inside">
                <li>로그인 화면에서 &quot;계정 복구&quot; 버튼 클릭</li>
                <li>전화번호 또는 이메일 입력</li>
                <li>12단어 복구 코드 입력</li>
                <li>새 기기에서 생체인증 설정</li>
              </ol>
            </div>

            <button
              onClick={() => router.push('/profile')}
              className="w-full bg-gray-800/80 backdrop-blur-sm border border-gray-600/30 text-white py-4 rounded-2xl font-bold shadow-sm transition-all duration-200 active:scale-[0.98]"
            >
              확인
            </button>
          </div>
        )}
      </main>
    </div>
  )
}