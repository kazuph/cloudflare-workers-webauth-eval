/**
 * JWT認証評価用API
 * HS256, RS256, ES256 の各アルゴリズムに対応
 * D1によるリクエストログ記録
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { getJWKS } from './utils/jwt'
import { requestLogger, getRecentLogs, getLogStats, clearLogs } from './middleware/request-logger'
import hs256 from './routes/hs256'
import rs256 from './routes/rs256'
import es256 from './routes/es256'
import password from './routes/password'

type Bindings = {
  JWT_HS256_SECRET: string
  JWT_RS256_PRIVATE_KEY: string
  JWT_RS256_PUBLIC_KEY: string
  JWT_ES256_PRIVATE_KEY: string
  JWT_ES256_PUBLIC_KEY: string
  TEST_USER_EMAIL: string
  TEST_USER_PASSWORD: string
  DB: D1Database
}

type Variables = {
  requestId: string
  jwtPayload?: { sub?: string; type?: string }
}

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// ミドルウェア
app.use('*', logger())
app.use('*', cors())
app.use('*', requestLogger())

// ルートエンドポイント
app.get('/', (c) => {
  return c.json({
    name: 'JWT Auth Evaluation API',
    version: '1.0.0',
    description: 'JWT authentication API supporting HS256, RS256, and ES256 algorithms',
    endpoints: {
      auth: {
        hs256: '/auth/hs256/*',
        rs256: '/auth/rs256/*',
        es256: '/auth/es256/*',
      },
      meta: {
        health: '/health',
        algorithms: '/algorithms',
        jwks: '/.well-known/jwks.json',
        logs: '/logs',
        logsStats: '/logs/stats',
      },
    },
  })
})

// ヘルスチェック
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
  })
})

// サポートするアルゴリズム一覧
app.get('/algorithms', (c) => {
  return c.json({
    supported: [
      {
        algorithm: 'HS256',
        type: 'symmetric',
        description: 'HMAC with SHA-256',
        endpoints: {
          login: 'POST /auth/hs256/login',
          refresh: 'POST /auth/hs256/refresh',
          verify: 'GET /auth/hs256/verify',
          protected: 'GET /auth/hs256/protected',
        },
      },
      {
        algorithm: 'RS256',
        type: 'asymmetric',
        description: 'RSA with SHA-256',
        endpoints: {
          login: 'POST /auth/rs256/login',
          refresh: 'POST /auth/rs256/refresh',
          verify: 'GET /auth/rs256/verify',
          protected: 'GET /auth/rs256/protected',
        },
      },
      {
        algorithm: 'ES256',
        type: 'asymmetric',
        description: 'ECDSA with P-256 and SHA-256',
        endpoints: {
          login: 'POST /auth/es256/login',
          refresh: 'POST /auth/es256/refresh',
          verify: 'GET /auth/es256/verify',
          protected: 'GET /auth/es256/protected',
        },
      },
    ],
  })
})

// JWKS エンドポイント（公開鍵を公開）
app.get('/.well-known/jwks.json', async (c) => {
  const publicKeys = [
    {
      algorithm: 'RS256' as const,
      publicKey: c.env.JWT_RS256_PUBLIC_KEY,
      kid: 'rs256-key-1',
    },
    {
      algorithm: 'ES256' as const,
      publicKey: c.env.JWT_ES256_PUBLIC_KEY,
      kid: 'es256-key-1',
    },
  ]

  const jwks = await getJWKS(publicKeys)
  return c.json(jwks)
})

// 認証ルートをマウント
app.route('/auth/hs256', hs256)
app.route('/auth/rs256', rs256)
app.route('/auth/es256', es256)
app.route('/auth/password', password)

// ログ関連エンドポイント
app.get('/logs', async (c) => {
  const limit = parseInt(c.req.query('limit') || '100', 10)
  const logs = await getRecentLogs(c.env.DB, Math.min(limit, 1000))
  return c.json({
    count: logs.length,
    logs,
  })
})

app.get('/logs/stats', async (c) => {
  const stats = await getLogStats(c.env.DB)
  return c.json(stats)
})

// ログクリア（負荷試験用）
app.post('/logs/clear', async (c) => {
  const result = await clearLogs(c.env.DB)
  return c.json({
    success: true,
    deleted: result.deleted,
    message: `Cleared ${result.deleted} log records`,
  })
})

// 404ハンドラー
app.notFound((c) => {
  return c.json(
    {
      error: 'Not Found',
      message: `The requested endpoint ${c.req.path} does not exist`,
    },
    404
  )
})

// エラーハンドラー
app.onError((err, c) => {
  // HTTPExceptionの場合はそのステータスコードを使用
  if (err instanceof Error && 'status' in err && typeof err.status === 'number') {
    const status = err.status as 400 | 401 | 403 | 404 | 500
    console.error(`HTTP ${status} Error:`, err.message)
    return c.json(
      {
        error: status >= 500 ? 'Internal Server Error' : 'Request Error',
        message: err.message,
      },
      status
    )
  }

  console.error('Error:', err)
  return c.json(
    {
      error: 'Internal Server Error',
      message: err.message,
    },
    500
  )
})

export default app
