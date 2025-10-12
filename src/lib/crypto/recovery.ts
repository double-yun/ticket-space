import { createHash, randomBytes } from 'crypto'

/**
 * BIP39 단어 목록 (한국어 - 일부만 포함, 실제로는 2048개 필요)
 * 실제 프로덕션에서는 @scure/bip39 라이브러리 사용 권장
 */
const WORDLIST_KR = [
  '가격', '가능', '가득', '가로', '가방', '가상', '가슴', '가운데', '가장', '가정',
  '각각', '간격', '간단', '간섭', '감각', '감기', '감동', '감사', '감소', '감옥',
  '값', '갑자기', '강남', '강력', '강물', '강아지', '강의', '강제', '같이', '개구리',
  '개발', '개선', '개인', '개최', '거기', '거래', '거리', '거실', '거울', '거짓',
  // ... 실제로는 2048개의 단어가 필요합니다
  // 여기서는 간단한 구현을 위해 제한된 단어만 사용
]

// 영어 단어 목록 (간소화 버전)
const WORDLIST_EN = [
  'abandon', 'ability', 'able', 'about', 'above', 'absent', 'absorb', 'abstract', 'absurd', 'abuse',
  'access', 'accident', 'account', 'accuse', 'achieve', 'acid', 'acoustic', 'acquire', 'across', 'act',
  'action', 'actor', 'actress', 'actual', 'adapt', 'add', 'addict', 'address', 'adjust', 'admit',
  'adult', 'advance', 'advice', 'aerobic', 'affair', 'afford', 'afraid', 'again', 'age', 'agent',
  'agree', 'ahead', 'aim', 'air', 'airport', 'aisle', 'alarm', 'album', 'alcohol', 'alert',
  // ... 실제로는 2048개
]

/**
 * 12단어 복구 코드 생성
 * @returns 12단어로 구성된 복구 코드 문자열
 */
export function generateRecoveryCode(): string {
  // 128비트(16바이트)의 랜덤 엔트로피 생성
  const entropy = randomBytes(16)

  // 간단한 구현: 각 바이트를 단어 인덱스로 변환
  const words: string[] = []
  const wordlist = WORDLIST_EN // 영어 사용

  for (let i = 0; i < 12; i++) {
    // entropy에서 11비트씩 추출하여 인덱스로 사용 (실제 BIP39 방식)
    // 여기서는 간소화하여 랜덤 바이트를 사용
    const index = entropy[i % 16] % wordlist.length
    words.push(wordlist[index])
  }

  return words.join(' ')
}

/**
 * 복구 코드를 SHA-256 해시로 변환
 * @param recoveryCode - 복구 코드 문자열
 * @returns SHA-256 해시 (hex)
 */
export function hashRecoveryCode(recoveryCode: string): string {
  return createHash('sha256')
    .update(recoveryCode.trim().toLowerCase())
    .digest('hex')
}

/**
 * 복구 코드 검증
 * @param inputCode - 사용자가 입력한 복구 코드
 * @param storedHash - DB에 저장된 해시
 * @returns 검증 성공 여부
 */
export function verifyRecoveryCode(inputCode: string, storedHash: string): boolean {
  const inputHash = hashRecoveryCode(inputCode)
  return inputHash === storedHash
}

/**
 * 복구 코드 유효성 검증 (형식 검증)
 * @param recoveryCode - 검증할 복구 코드
 * @returns 유효성 여부
 */
export function isValidRecoveryCodeFormat(recoveryCode: string): boolean {
  const words = recoveryCode.trim().toLowerCase().split(/\s+/)

  // 12단어인지 확인
  if (words.length !== 12) {
    return false
  }

  // 각 단어가 단어 목록에 있는지 확인 (선택사항)
  // 실제 구현에서는 BIP39 단어 목록과 비교
  return words.every(word => word.length > 0)
}