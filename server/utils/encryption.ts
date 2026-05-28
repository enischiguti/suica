import { Buffer } from 'node:buffer'
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

export function encryptToken(plaintext: string): string {
  const key = Buffer.from(useRuntimeConfig().encryptionKey, 'hex')
  const iv = randomBytes(16)
  const cipher = createCipheriv('aes-256-cbc', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`
}

export function decryptToken(ciphertext: string): string {
  const key = Buffer.from(useRuntimeConfig().encryptionKey, 'hex')
  const parts = ciphertext.split(':')
  if (parts.length !== 2) {
    throw new Error('Invalid ciphertext format')
  }
  const ivHex = parts[0]
  const encryptedHex = parts[1]
  if (!ivHex || !encryptedHex) {
    throw new Error('Invalid ciphertext format')
  }
  const iv = Buffer.from(ivHex, 'hex')
  const encryptedBuffer = Buffer.from(encryptedHex, 'hex')
  const decipher = createDecipheriv('aes-256-cbc', key, iv)
  const decrypted = Buffer.concat([decipher.update(encryptedBuffer), decipher.final()])
  return decrypted.toString('utf8')
}
