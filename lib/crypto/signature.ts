import { createHash } from 'crypto'

/**
 * ECDSA P-256 서명 검증
 * @param challenge - 서명할 원본 메시지
 * @param signature - Base64 인코딩된 서명
 * @param publicKey - Base64 인코딩된 공개키
 */
export async function verifySignature(
  challenge: string,
  signature: string,
  publicKey: string
): Promise<boolean> {
  try {
    // Node.js crypto 모듈 사용
    const crypto = await import('crypto')

    // Base64 디코딩
    const signatureBuffer = Buffer.from(signature, 'base64')
    const publicKeyBuffer = Buffer.from(publicKey, 'base64')

    // 공개키 객체 생성 (SPKI 형식)
    const publicKeyObject = crypto.createPublicKey({
      key: publicKeyBuffer,
      format: 'der',
      type: 'spki'
    })

    // 서명 검증
    const verify = crypto.createVerify('SHA256')
    verify.update(challenge)
    verify.end()

    const isValid = verify.verify(publicKeyObject, signatureBuffer)
    return isValid
  } catch (error) {
    console.error('Signature verification error:', error)
    return false
  }
}

/**
 * 챌린지 생성 (UUID + timestamp)
 */
export function generateChallenge(): string {
  const timestamp = Date.now()
  const randomBytes = createHash('sha256')
    .update(`${timestamp}-${Math.random()}`)
    .digest('hex')
  return `${randomBytes}-${timestamp}`
}

/**
 * 챌린지 만료 확인
 */
export function isChallengeExpired(expiresAt: Date): boolean {
  return new Date() > expiresAt
}