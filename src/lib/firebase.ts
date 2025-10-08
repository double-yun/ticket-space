import { initializeApp } from 'firebase/app'
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult } from 'firebase/auth'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)

// reCAPTCHA 설정
export const setupRecaptcha = (containerId: string): RecaptchaVerifier => {
  return new RecaptchaVerifier(auth, containerId, {
    size: 'invisible',
    callback: () => {
      // reCAPTCHA 완료
    },
    'expired-callback': () => {
      // reCAPTCHA 만료
    }
  })
}

// SMS 인증 코드 전송
export const sendSMSVerification = async (phoneNumber: string, recaptchaVerifier: RecaptchaVerifier): Promise<ConfirmationResult> => {
  try {
    const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier)
    return confirmationResult
  } catch (error) {
    console.error('SMS 전송 실패:', error)
    throw error
  }
}

// 인증 코드 확인
export const verifySMSCode = async (
  confirmationResult: ConfirmationResult,
  code: string
): Promise<{ phoneNumber: string; uid: string }> => {
  try {
    const result = await confirmationResult.confirm(code)
    // Firebase 사용자 정보 (우리는 인증만 사용)
    return {
      phoneNumber: result.user.phoneNumber,
      uid: result.user.uid
    }
  } catch (error) {
    console.error('코드 확인 실패:', error)
    throw error
  }
}
