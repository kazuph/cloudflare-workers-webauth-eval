/**
 * テストヘルパー
 */

import { env, SELF } from 'cloudflare:test'

export interface LoginResponse {
  message: string
  algorithm: string
  accessToken: string
  refreshToken: string
  expiresIn: string
}

export interface VerifyResponse {
  valid: boolean
  algorithm: string
  payload: {
    sub: string
    email: string
    type: string
    iat: number
    exp: number
  }
}

export interface ProtectedResponse {
  message: string
  algorithm: string
  user: {
    id: string
    email: string
  }
  data: {
    secretInfo: string
    timestamp: string
  }
}

export interface ErrorResponse {
  error: string
  message?: string
}

/**
 * ログインリクエストを送信
 */
export async function login(
  algorithm: 'hs256' | 'rs256' | 'es256',
  email: string,
  password: string
): Promise<Response> {
  return SELF.fetch(`http://localhost/auth/${algorithm}/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  })
}

/**
 * トークン検証リクエストを送信
 */
export async function verify(
  algorithm: 'hs256' | 'rs256' | 'es256',
  token: string
): Promise<Response> {
  const headers: Record<string, string> = {}
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  return SELF.fetch(`http://localhost/auth/${algorithm}/verify`, {
    method: 'GET',
    headers,
  })
}

/**
 * 保護されたリソースへのアクセス
 */
export async function accessProtected(
  algorithm: 'hs256' | 'rs256' | 'es256',
  token: string
): Promise<Response> {
  const headers: Record<string, string> = {}
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  return SELF.fetch(`http://localhost/auth/${algorithm}/protected`, {
    method: 'GET',
    headers,
  })
}

/**
 * トークンリフレッシュリクエストを送信
 */
export async function refresh(
  algorithm: 'hs256' | 'rs256' | 'es256',
  refreshToken: string
): Promise<Response> {
  const headers: Record<string, string> = {}
  if (refreshToken) {
    headers.Authorization = `Bearer ${refreshToken}`
  }
  return SELF.fetch(`http://localhost/auth/${algorithm}/refresh`, {
    method: 'POST',
    headers,
  })
}

/**
 * テスト用の認証情報
 */
export function getTestCredentials() {
  const testEnv = env as { TEST_USER_EMAIL: string; TEST_USER_PASSWORD: string }
  return {
    email: testEnv.TEST_USER_EMAIL,
    password: testEnv.TEST_USER_PASSWORD,
  }
}
