'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Capacitor } from '@capacitor/core'
import TopBar from '@/components/TopBar'
import LoadingSpinner from '@/components/LoadingSpinner'
import { Shield, ArrowLeft, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'

export default function AccountRecoveryPage() {
  const router = useRouter()
  const [step, setStep] = useState<'identifier' | 'recovery-code' | 'success'>('identifier')
  const [loading, setLoading] = useState(false)

  // Step 1: 식별자 입력
  const [phoneNumber, setPhoneNumber] = useState('')
  const [email, setEmail] = useState('')

  // Step 2: 복구 코드 입력
  const [recoveryCode, setRecoveryCode] = useState('')

  const handleIdentifierSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!phoneNumber && !email) {
      toast.error('전화번호 또는 이메일을 입력해주세요.')
      return
    }

    setStep('recovery-code')
  }

  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!recoveryCode.trim()) {
      toast.error('복구 코드를 입력해주세요.')
      return
    }

    // 12단어 형식 체크
    const words = recoveryCode.trim().split(/\s+/)
    if (words.length !== 12) {
      toast.error('복구 코드는 12개의 단어로 구성되어야 합니다.')
      return
    }

    try {
      setLoading(true)

      // 네이티브 플랫폼에서는 새 키 페어 생성 필요
      let newPublicKey = null
      let deviceInfo = 'Web Browser'

      if (Capacitor.isNativePlatform()) {
        const { generateKeyPair, getDeviceInfo, checkBiometricAvailability } = await import(
          '@/lib/crypto/key-manager'
        )

        const biometric = await checkBiometricAvailability()
        if (!biometric.available) {
          toast.error('기기에 생체 인증 또는 화면 잠금(PIN/비밀번호)을 설정해주세요.')
          setLoading(false)
          return
        }

        // 임시 식별자로 키 생성 (나중에 실제 userId로 교체될 예정)
        const tempIdentifier = `recovery_${Date.now()}`
        newPublicKey = await generateKeyPair(tempIdentifier)
        deviceInfo = await getDeviceInfo()
      }

      // 계정 복구 API 호출
      const response = await fetch('/api/auth/recover', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber: phoneNumber || undefined,
          email: email || undefined,
          recoveryCode: recoveryCode.trim(),
          newPublicKey,
          deviceInfo,
        }),
      })

      const data = await response.json()

      if (data.success) {
        // 네이티브 환경에서 키 페어를 userId로 재생성
        if (Capacitor.isNativePlatform() && data.userId) {
          const { generateKeyPair } = await import('@/lib/crypto/key-manager')
          await generateKeyPair(data.userId)
        }

        setStep('success')
        toast.success('계정이 성공적으로 복구되었습니다!')

        // 3초 후 로그인 페이지로 이동
        setTimeout(() => {
          router.push('/login')
        }, 3000)
      } else {
        toast.error(data.error || '계정 복구에 실패했습니다.')
      }
    } catch (error) {
      console.error('계정 복구 실패:', error)
      toast.error('계정 복구 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-gradient-to-b from-blue-50/30 via-white to-purple-50/30 min-h-[var(--app-height)] flex flex-col">
      <TopBar
        title="계정 복구"
        leftButton={
          <button onClick={() => router.back()} className="p-2">
            <ArrowLeft size={24} className="text-gray-900" />
          </button>
        }
      />

      <main className="flex-1 overflow-y-auto px-4 py-6">
        {step === 'identifier' && (
          <div className="max-w-md mx-auto">
            {/* 경고 메시지 */}
            <div className="bg-amber-50/80 backdrop-blur-sm border border-amber-200/50 rounded-3xl p-5 mb-6">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <AlertTriangle className="text-amber-600" size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-amber-900 mb-2">중요 안내</h3>
                  <p className="text-sm text-amber-800 leading-relaxed">
                    계정 복구 후 기존에 구매한 티켓은 사용할 수 없습니다.
                    이는 티켓 양도를 방지하기 위한 보안 정책입니다.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-sm border border-gray-100/50">
              <div className="flex justify-center mb-6">
                <div className="w-24 h-24 bg-blue-500/10 backdrop-blur-xl border border-blue-200/30 rounded-full flex items-center justify-center">
                  <Shield size={48} className="text-blue-600" strokeWidth={2} />
                </div>
              </div>

              <h2 className="text-2xl font-bold text-gray-900 text-center mb-3">계정 찾기</h2>
              <p className="text-gray-600 text-center mb-8">
                계정 생성 시 등록한 정보를 입력하세요
              </p>

              <form onSubmit={handleIdentifierSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    전화번호
                  </label>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="010-1234-5678"
                    className="w-full px-4 py-3.5 rounded-2xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                  />
                </div>

                <div className="text-center text-sm text-gray-500 font-semibold">또는</div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    이메일
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="example@email.com"
                    className="w-full px-4 py-3.5 rounded-2xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-blue-500/80 backdrop-blur-sm border border-blue-300/30 text-white py-4 rounded-2xl font-bold shadow-sm transition-all duration-200 active:scale-[0.98] mt-6"
                >
                  다음
                </button>
              </form>
            </div>
          </div>
        )}

        {step === 'recovery-code' && (
          <div className="max-w-md mx-auto">
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-sm border border-gray-100/50">
              <div className="flex justify-center mb-6">
                <div className="w-24 h-24 bg-emerald-500/10 backdrop-blur-xl border border-emerald-200/30 rounded-full flex items-center justify-center">
                  <Shield size={48} className="text-emerald-600" strokeWidth={2} />
                </div>
              </div>

              <h2 className="text-2xl font-bold text-gray-900 text-center mb-3">복구 코드 입력</h2>
              <p className="text-gray-600 text-center mb-8">
                12개의 단어를 공백으로 구분하여 입력하세요
              </p>

              <form onSubmit={handleRecoverySubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    복구 코드 (12단어)
                  </label>
                  <textarea
                    value={recoveryCode}
                    onChange={(e) => setRecoveryCode(e.target.value)}
                    placeholder="apple banana cherry... (12개 단어)"
                    rows={4}
                    className="w-full px-4 py-3.5 rounded-2xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all font-mono text-sm resize-none"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    단어 수: {recoveryCode.trim() ? recoveryCode.trim().split(/\s+/).length : 0} / 12
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setStep('identifier')}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-4 rounded-2xl font-bold transition-all duration-200 active:scale-[0.98]"
                  >
                    이전
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-emerald-500/80 backdrop-blur-sm border border-emerald-300/30 text-white py-4 rounded-2xl font-bold shadow-sm transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <LoadingSpinner size={20} color="inherit" />
                        복구 중...
                      </span>
                    ) : (
                      '계정 복구'
                    )}
                  </button>
                </div>
              </form>

              <div className="mt-6 bg-blue-50/50 rounded-2xl p-4">
                <h4 className="font-semibold text-blue-900 mb-2 text-sm">복구 후 안내</h4>
                <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
                  <li>새 기기에서 생체인증이 설정됩니다</li>
                  <li>기존 구매 티켓은 보안상 사용 불가능합니다</li>
                  <li>새로 티켓을 구매하실 수 있습니다</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {step === 'success' && (
          <div className="max-w-md mx-auto">
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-sm border border-gray-100/50 text-center">
              <div className="flex justify-center mb-6">
                <div className="w-24 h-24 bg-emerald-500/10 backdrop-blur-xl border border-emerald-200/30 rounded-full flex items-center justify-center">
                  <Shield size={48} className="text-emerald-600" strokeWidth={2} />
                </div>
              </div>

              <h2 className="text-2xl font-bold text-gray-900 mb-3">복구 완료!</h2>
              <p className="text-gray-600 mb-8">
                계정이 성공적으로 복구되었습니다.
                <br />
                잠시 후 로그인 페이지로 이동합니다.
              </p>

              <div className="bg-emerald-50/50 rounded-2xl p-4 mb-6">
                <p className="text-sm text-emerald-800">
                  이제 새 기기에서 생체인증으로 로그인할 수 있습니다.
                </p>
              </div>

              <button
                onClick={() => router.push('/login')}
                className="w-full bg-emerald-500/80 backdrop-blur-sm border border-emerald-300/30 text-white py-4 rounded-2xl font-bold shadow-sm transition-all duration-200 active:scale-[0.98]"
              >
                로그인하기
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}