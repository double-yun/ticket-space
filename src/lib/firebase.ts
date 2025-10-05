import { initializeApp } from 'firebase/app'
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult } from 'firebase/auth'

const firebaseConfig = {
  apiKey: "AIzaSyAzXYbwyRgRX4fnRU477fFpG6Sm1_2XCbY",
  authDomain: "graduation-project-bc4df.firebaseapp.com",
  projectId: "graduation-project-bc4df",
  storageBucket: "graduation-project-bc4df.firebasestorage.app",
  messagingSenderId: "886439395629",
  appId: "1:886439395629:web:c9a90c8ee71bac85c513a4",
  measurementId: "G-H4ZDD7WKQ4"
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
