/**
 * HS256 (HMAC-SHA256) 認証ルート
 */

import { Hono } from 'hono'
import { generateAccessToken, generateRefreshToken, type JWTConfig } from '../utils/jwt'
import { hs256Auth, hs256RefreshAuth } from '../middleware/jwt-verify'

type Bindings = {
  JWT_HS256_SECRET: string
  TEST_USER_EMAIL: string
  TEST_USER_PASSWORD: string
}

const hs256 = new Hono<{ Bindings: Bindings }>()

/**
 * POST /auth/hs256/login
 * ログイン処理 - ユーザー認証後にJWTを発行
 */
hs256.post('/login', async (c) => {
  const body = await c.req.json<{ email: string; password: string }>()
  const { email, password } = body

  // テストユーザーの認証（実際のアプリではDBと照合）
  if (email !== c.env.TEST_USER_EMAIL || password !== c.env.TEST_USER_PASSWORD) {
    return c.json({ error: 'Invalid credentials' }, 401)
  }

  const config: JWTConfig = {
    algorithm: 'HS256',
    secret: c.env.JWT_HS256_SECRET,
  }

  const payload = {
    sub: 'user-1',
    email,
  }

  const accessToken = await generateAccessToken(payload, config)
  const refreshToken = await generateRefreshToken(payload, config)

  return c.json({
    message: 'Login successful',
    algorithm: 'HS256',
    accessToken,
    refreshToken,
    expiresIn: '15m',
  })
})

/**
 * POST /auth/hs256/refresh
 * リフレッシュトークンを使用して新しいアクセストークンを発行
 */
hs256.post('/refresh', hs256RefreshAuth((c) => c.env.JWT_HS256_SECRET), async (c) => {
  const jwtPayload = c.get('jwtPayload')

  const config: JWTConfig = {
    algorithm: 'HS256',
    secret: c.env.JWT_HS256_SECRET,
  }

  const payload = {
    sub: jwtPayload.sub,
    email: jwtPayload.email,
  }

  const accessToken = await generateAccessToken(payload, config)
  const refreshToken = await generateRefreshToken(payload, config)

  return c.json({
    message: 'Token refreshed',
    algorithm: 'HS256',
    accessToken,
    refreshToken,
    expiresIn: '15m',
  })
})

/**
 * GET /auth/hs256/verify
 * トークンの検証結果を返す
 */
hs256.get('/verify', hs256Auth((c) => c.env.JWT_HS256_SECRET), async (c) => {
  const jwtPayload = c.get('jwtPayload')

  return c.json({
    valid: true,
    algorithm: 'HS256',
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
 * GET /auth/hs256/protected
 * 保護されたリソースへのアクセス
 */
hs256.get('/protected', hs256Auth((c) => c.env.JWT_HS256_SECRET), async (c) => {
  const jwtPayload = c.get('jwtPayload')

  return c.json({
    message: 'Access granted to protected resource',
    algorithm: 'HS256',
    user: {
      id: jwtPayload.sub,
      email: jwtPayload.email,
    },
    data: {
      secretInfo: 'This is protected data only accessible with a valid HS256 JWT',
      timestamp: new Date().toISOString(),
    },
  })
})

export default hs256
