/**
 * RS256 (RSA-SHA256) 認証ルート
 */

import { Hono } from 'hono'
import { generateAccessToken, generateRefreshToken, type JWTConfig } from '../utils/jwt'
import { rs256Auth, rs256RefreshAuth } from '../middleware/jwt-verify'

type Bindings = {
  JWT_RS256_PRIVATE_KEY: string
  JWT_RS256_PUBLIC_KEY: string
  TEST_USER_EMAIL: string
  TEST_USER_PASSWORD: string
}

const rs256 = new Hono<{ Bindings: Bindings }>()

/**
 * POST /auth/rs256/login
 * ログイン処理 - ユーザー認証後にJWTを発行
 */
rs256.post('/login', async (c) => {
  const body = await c.req.json<{ email: string; password: string }>()
  const { email, password } = body

  // テストユーザーの認証（実際のアプリではDBと照合）
  if (email !== c.env.TEST_USER_EMAIL || password !== c.env.TEST_USER_PASSWORD) {
    return c.json({ error: 'Invalid credentials' }, 401)
  }

  const config: JWTConfig = {
    algorithm: 'RS256',
    privateKey: c.env.JWT_RS256_PRIVATE_KEY,
    publicKey: c.env.JWT_RS256_PUBLIC_KEY,
  }

  const payload = {
    sub: 'user-1',
    email,
  }

  const accessToken = await generateAccessToken(payload, config)
  const refreshToken = await generateRefreshToken(payload, config)

  return c.json({
    message: 'Login successful',
    algorithm: 'RS256',
    accessToken,
    refreshToken,
    expiresIn: '15m',
  })
})

/**
 * POST /auth/rs256/refresh
 * リフレッシュトークンを使用して新しいアクセストークンを発行
 */
rs256.post('/refresh', rs256RefreshAuth((c) => c.env.JWT_RS256_PUBLIC_KEY), async (c) => {
  const jwtPayload = c.get('jwtPayload')

  const config: JWTConfig = {
    algorithm: 'RS256',
    privateKey: c.env.JWT_RS256_PRIVATE_KEY,
    publicKey: c.env.JWT_RS256_PUBLIC_KEY,
  }

  const payload = {
    sub: jwtPayload.sub,
    email: jwtPayload.email,
  }

  const accessToken = await generateAccessToken(payload, config)
  const refreshToken = await generateRefreshToken(payload, config)

  return c.json({
    message: 'Token refreshed',
    algorithm: 'RS256',
    accessToken,
    refreshToken,
    expiresIn: '15m',
  })
})

/**
 * GET /auth/rs256/verify
 * トークンの検証結果を返す
 */
rs256.get('/verify', rs256Auth((c) => c.env.JWT_RS256_PUBLIC_KEY), async (c) => {
  const jwtPayload = c.get('jwtPayload')

  return c.json({
    valid: true,
    algorithm: 'RS256',
    payload: {
      sub: jwtPayload.sub,
      email: jwtPayload.email,
      type: jwtPayload.type,
      iat: jwtPayload.iat,
      exp: jwtPayload.exp,
    },
  })
})

/**
 * GET /auth/rs256/protected
 * 保護されたリソースへのアクセス
 */
rs256.get('/protected', rs256Auth((c) => c.env.JWT_RS256_PUBLIC_KEY), async (c) => {
  const jwtPayload = c.get('jwtPayload')

  return c.json({
    message: 'Access granted to protected resource',
    algorithm: 'RS256',
    user: {
      id: jwtPayload.sub,
      email: jwtPayload.email,
    },
    data: {
      secretInfo: 'This is protected data only accessible with a valid RS256 JWT',
      timestamp: new Date().toISOString(),
    },
  })
})

export default rs256
