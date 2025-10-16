import { WebPlugin } from '@capacitor/core'
import type { SecureKeyPlugin } from './SecureKeyPlugin'
import { arrayBufferToBase64, base64ToArrayBuffer } from '@/lib/crypto/base64'

const STORAGE_PREFIX = 'secure-key'

function getStorageKey(userId: string, type: 'public' | 'private') {
  return `${STORAGE_PREFIX}:${type}:${userId}`
}

function ensureCryptoSupport() {
  if (typeof window === 'undefined' || !window.isSecureContext || !window.crypto?.subtle) {
    throw new Error('이 브라우저에서는 PassKey 기능을 사용할 수 없습니다. 보안 브라우저 또는 최신 환경에서 다시 시도해주세요.')
  }
}

export class SecureKeyWeb extends WebPlugin implements SecureKeyPlugin {
  async generateKeyPair(options: { userId: string; promptMessage?: string }): Promise<{ publicKey: string }> {
    ensureCryptoSupport()
    const { userId } = options

    const existing = window.localStorage.getItem(getStorageKey(userId, 'private'))
    if (existing) {
      const publicKey = window.localStorage.getItem(getStorageKey(userId, 'public'))
      if (publicKey) {
        return { publicKey }
      }
      // 기존 프라이빗 키만 있는 경우 정리 후 새로 생성
      window.localStorage.removeItem(getStorageKey(userId, 'private'))
    }

    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: 'ECDSA',
        namedCurve: 'P-256',
      },
      true,
      ['sign', 'verify']
    )

    const publicKeyBuffer = await window.crypto.subtle.exportKey('spki', keyPair.publicKey)
    const privateKeyBuffer = await window.crypto.subtle.exportKey('pkcs8', keyPair.privateKey)

    const publicKeyBase64 = arrayBufferToBase64(publicKeyBuffer)
    const privateKeyBase64 = arrayBufferToBase64(privateKeyBuffer)

    window.localStorage.setItem(getStorageKey(userId, 'private'), privateKeyBase64)
    window.localStorage.setItem(getStorageKey(userId, 'public'), publicKeyBase64)

    return { publicKey: publicKeyBase64 }
  }

  async hasPrivateKey(options: { userId: string }): Promise<{ exists: boolean }> {
    if (typeof window === 'undefined') {
      return { exists: false }
    }
    const value = window.localStorage.getItem(getStorageKey(options.userId, 'private'))
    return { exists: !!value }
  }

  async signData(options: {
    userId: string
    data: string
    promptMessage?: string
  }): Promise<{ signature: string }> {
    ensureCryptoSupport()
    const privateKeyBase64 = window.localStorage.getItem(getStorageKey(options.userId, 'private'))
    if (!privateKeyBase64) {
      throw new Error('이 기기에서 PassKey를 찾을 수 없습니다. PassKey를 다시 등록해주세요.')
    }

    const privateKeyBuffer = base64ToArrayBuffer(privateKeyBase64)
    const privateKey = await window.crypto.subtle.importKey(
      'pkcs8',
      privateKeyBuffer,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign']
    )

    const encoder = new TextEncoder()
    const dataBuffer = encoder.encode(options.data)
    const signatureBuffer = await window.crypto.subtle.sign(
      { name: 'ECDSA', hash: { name: 'SHA-256' } },
      privateKey,
      dataBuffer
    )

    return { signature: arrayBufferToBase64(signatureBuffer) }
  }

  async getPublicKey(options: { userId: string }): Promise<{ publicKey: string | null }> {
    if (typeof window === 'undefined') {
      return { publicKey: null }
    }
    const value = window.localStorage.getItem(getStorageKey(options.userId, 'public'))
    return { publicKey: value ?? null }
  }

  async isBiometricAvailable(): Promise<{
    available: boolean
    biometryType: 'fingerprint' | 'face' | 'none'
  }> {
    if (typeof window === 'undefined') {
      return { available: false, biometryType: 'none' }
    }
    const supported = !!(window.isSecureContext && window.crypto?.subtle)
    return { available: supported, biometryType: 'none' }
  }

  async getDeviceInfo(): Promise<{ deviceInfo: string }> {
    if (typeof navigator === 'undefined') {
      return { deviceInfo: 'Web' }
    }
    const userAgent = navigator.userAgent
    const platform = navigator.platform
    return {
      deviceInfo: `Web - ${platform} - ${userAgent}`
    }
  }
}
