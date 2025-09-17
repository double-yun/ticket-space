import { initializeApp } from 'firebase/app'
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth'

const firebaseConfig = {
  apiKey: "AIzaSyBMHx2gEnOtigCEYHxyxUyT2TnSwrbwjus",
  authDomain: "graduation-project-c432b.firebaseapp.com",
  projectId: "graduation-project-c432b",
  storageBucket: "graduation-project-c432b.firebasestorage.app",
  messagingSenderId: "217800211014",
  appId: "1:217800211014:web:ebf98f770754180778e847",
  measurementId: "G-H4ZDD7WKQ4"
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)

// reCAPTCHA 설정
export const setupRecaptcha = (containerId: string) => {
  return new RecaptchaVerifier(auth, containerId, {
    size: 'normal',
    callback: () => {
      // reCAPTCHA 완료
    },
    'expired-callback': () => {
      // reCAPTCHA 만료
    }
  })
}

// SMS 인증 코드 전송
export const sendSMSVerification = async (phoneNumber: string, recaptchaVerifier: RecaptchaVerifier) => {
  try {
    const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier)
    return confirmationResult
  } catch (error) {
    console.error('SMS 전송 실패:', error)
    throw error
  }
}

// 인증 코드 확인
export const verifySMSCode = async (confirmationResult: any, code: string) => {
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