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

    // 챌린지를 UTF-8 바이트로 변환 (해싱 안 함 - iOS/Android에서 이미 해싱됨)
    const messageBuffer = Buffer.from(challenge, 'utf8')

    // 공개키를 SPKI 형식으로 PEM 변환
    const publicKeyPem = `-----BEGIN PUBLIC KEY-----\n${publicKeyBuffer.toString('base64').match(/.{1,64}/g)?.join('\n')}\n-----END PUBLIC KEY-----`

    const publicKeyObject = crypto.createPublicKey({
      key: publicKeyPem,
      format: 'pem',
      type: 'spki'
    })

    // ECDSA 서명 검증 (DER 형식, SHA256 알고리즘)
    const isValid = crypto.verify(
      'sha256', // iOS/Android가 SHA256 해싱하므로 알고리즘 지정
      messageBuffer,
      {
        key: publicKeyObject,
        dsaEncoding: 'der' // DER (ASN.1) 형식 - iOS/Android와 일치
      },
      signatureBuffer
    )

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