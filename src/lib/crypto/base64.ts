export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  if (typeof window === 'undefined') {
    return Buffer.from(buffer).toString('base64')
  }

  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i])
  }
  return window.btoa(binary)
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  if (typeof window === 'undefined') {
    return Buffer.from(base64, 'base64')
  }

  const binary = window.atob(base64)
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

export function base64UrlToBase64(value: string): string {
  return value.replace(/-/g, '+').replace(/_/g, '/')
}

export function sanitizeBase64(value: string): string {
  const base = value.replace(/\s+/g, '')
  const pad = base.length % 4
  if (pad === 2) return `${base}==`
  if (pad === 3) return `${base}=`
  if (pad === 1) return `${base.slice(0, -1)}===`
  return base
}
