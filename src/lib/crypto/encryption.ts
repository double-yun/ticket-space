import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

/**
 * AES-256-GCM으로 데이터 암호화
 * @param plaintext - 암호화할 평문
 * @param key - 32바이트 암호화 키 (hex 문자열)
 * @returns Base64 인코딩된 암호문 (IV + AuthTag + Ciphertext)
 */
export function encrypt(plaintext: string, key: string): string {
  // 키를 Buffer로 변환 (32바이트 = 256비트)
  const keyBuffer = Buffer.from(key, 'hex')

  if (keyBuffer.length !== 32) {
    throw new Error('Encryption key must be 32 bytes (256 bits)')
  }

  // 12바이트 IV 생성 (GCM 권장 크기)
  const iv = randomBytes(12)

  // Cipher 생성
  const cipher = createCipheriv('aes-256-gcm', keyBuffer, iv)

  // 암호화
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final()
  ])

  // Auth Tag 가져오기 (16바이트)
  const authTag = cipher.getAuthTag()

  // IV(12) + AuthTag(16) + Ciphertext를 결합하여 Base64로 인코딩
  const combined = Buffer.concat([iv, authTag, encrypted])

  return combined.toString('base64')
}

/**
 * AES-256-GCM으로 데이터 복호화
 * @param ciphertext - Base64 인코딩된 암호문
 * @param key - 32바이트 암호화 키 (hex 문자열)
 * @returns 복호화된 평문
 */
export function decrypt(ciphertext: string, key: string): string {
  // 키를 Buffer로 변환
  const keyBuffer = Buffer.from(key, 'hex')

  if (keyBuffer.length !== 32) {
    throw new Error('Decryption key must be 32 bytes (256 bits)')
  }

  // Base64 디코딩
  const combined = Buffer.from(ciphertext, 'base64')

  // IV, AuthTag, Ciphertext 분리
  const iv = combined.subarray(0, 12)
  const authTag = combined.subarray(12, 28)
  const encrypted = combined.subarray(28)

  // Decipher 생성
  const decipher = createDecipheriv('aes-256-gcm', keyBuffer, iv)
  decipher.setAuthTag(authTag)

  // 복호화
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final()
  ])

  return decrypted.toString('utf8')
}

/**
 * 32바이트 암호화 키 생성 (개발/테스트용)
 * @returns Hex 문자열 (64자)
 */
export function generateEncryptionKey(): string {
  return randomBytes(32).toString('hex')
}

/**
 * 환경변수에서 암호화 키 가져오기
 * @returns 암호화 키
 * @throws 키가 설정되지 않았거나 유효하지 않으면 에러
 */
export function getEncryptionKey(): string {
  const key = process.env.TICKET_ENCRYPTION_KEY

  if (!key) {
    throw new Error('TICKET_ENCRYPTION_KEY environment variable is not set')
  }

  // 키 형식 검증 (64자 hex 문자열)
  if (!/^[0-9a-f]{64}$/i.test(key)) {
    throw new Error('TICKET_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)')
  }

  return key
}