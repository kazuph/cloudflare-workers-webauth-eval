/**
 * Hono JWT検証ミドルウェア
 * 各アルゴリズム（HS256, RS256, ES256）に対応したミドルウェアを提供
 */

import type { Context, MiddlewareHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { verifyToken, type Algorithm, type JWTConfig, type TokenPayload } from '../utils/jwt'

// Contextに追加するJWTペイロードの型定義
declare module 'hono' {
  interface ContextVariableMap {
    jwtPayload: TokenPayload
  }
}

export interface JWTMiddlewareConfig {
  algorithm: Algorithm
  secret?: string
  publicKey?: string
}

// 環境変数から鍵を取得する関数の型
export type KeyGetter = (c: Context) => string

/**
 * Authorizationヘッダーからトークンを抽出
 */
function extractToken(c: Context): string | null {
  const authHeader = c.req.header('Authorization')
  if (!authHeader) return null

  const parts = authHeader.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null

  return parts[1]
}

/**
 * JWT検証ミドルウェアを作成
 * Honoのレイヤーでリクエストを認証・検証する
 */
export function jwtAuth(config: JWTMiddlewareConfig): MiddlewareHandler {
  return async (c, next) => {
    const token = extractToken(c)

    if (!token) {
      throw new HTTPException(401, {
        message: 'Authorization header is missing or invalid',
      })
    }

    try {
      const jwtConfig: JWTConfig = {
        algorithm: config.algorithm,
        secret: config.secret,
        publicKey: config.publicKey,
      }

      const payload = await verifyToken(token, jwtConfig)

      // アクセストークンのみ許可
      if (payload.type !== 'access') {
        throw new HTTPException(401, {
          message: 'Invalid token type. Access token required.',
        })
      }

      // ペイロードをコンテキストに設定
      c.set('jwtPayload', payload)

      await next()
    } catch (error) {
      if (error instanceof HTTPException) {
        throw error
      }

      // JWTエラーの詳細をログに出力（本番環境では適切なログ出力に変更）
      console.error('JWT verification failed:', error)

      throw new HTTPException(401, {
        message: 'Invalid or expired token',
      })
    }
  }
}

/**
 * リフレッシュトークン検証ミドルウェアを作成
 */
export function refreshTokenAuth(config: JWTMiddlewareConfig): MiddlewareHandler {
  return async (c, next) => {
    const token = extractToken(c)

    if (!token) {
      throw new HTTPException(401, {
        message: 'Authorization header is missing or invalid',
      })
    }

    try {
      const jwtConfig: JWTConfig = {
        algorithm: config.algorithm,
        secret: config.secret,
        publicKey: config.publicKey,
      }

      const payload = await verifyToken(token, jwtConfig)

      // リフレッシュトークンのみ許可
      if (payload.type !== 'refresh') {
        throw new HTTPException(401, {
          message: 'Invalid token type. Refresh token required.',
        })
      }

      // ペイロードをコンテキストに設定
      c.set('jwtPayload', payload)

      await next()
    } catch (error) {
      if (error instanceof HTTPException) {
        throw error
      }

      console.error('Refresh token verification failed:', error)

      throw new HTTPException(401, {
        message: 'Invalid or expired refresh token',
      })
    }
  }
}

/**
 * HS256用のJWT検証ミドルウェア
 * @param secretGetter - コンテキストからシークレットを取得する関数
 */
export function hs256Auth(secretGetter: KeyGetter): MiddlewareHandler {
  return async (c, next) => {
    const secret = secretGetter(c)
    return jwtAuth({ algorithm: 'HS256', secret })(c, next)
  }
}

/**
 * RS256用のJWT検証ミドルウェア
 * @param publicKeyGetter - コンテキストから公開鍵を取得する関数
 */
export function rs256Auth(publicKeyGetter: KeyGetter): MiddlewareHandler {
  return async (c, next) => {
    const publicKey = publicKeyGetter(c)
    return jwtAuth({ algorithm: 'RS256', publicKey })(c, next)
  }
}

/**
 * ES256用のJWT検証ミドルウェア
 * @param publicKeyGetter - コンテキストから公開鍵を取得する関数
 */
export function es256Auth(publicKeyGetter: KeyGetter): MiddlewareHandler {
  return async (c, next) => {
    const publicKey = publicKeyGetter(c)
    return jwtAuth({ algorithm: 'ES256', publicKey })(c, next)
  }
}

/**
 * HS256用のリフレッシュトークン検証ミドルウェア
 * @param secretGetter - コンテキストからシークレットを取得する関数
 */
export function hs256RefreshAuth(secretGetter: KeyGetter): MiddlewareHandler {
  return async (c, next) => {
    const secret = secretGetter(c)
    return refreshTokenAuth({ algorithm: 'HS256', secret })(c, next)
  }
}

/**
 * RS256用のリフレッシュトークン検証ミドルウェア
 * @param publicKeyGetter - コンテキストから公開鍵を取得する関数
 */
export function rs256RefreshAuth(publicKeyGetter: KeyGetter): MiddlewareHandler {
  return async (c, next) => {
    const publicKey = publicKeyGetter(c)
    return refreshTokenAuth({ algorithm: 'RS256', publicKey })(c, next)
  }
}

/**
 * ES256用のリフレッシュトークン検証ミドルウェア
 * @param publicKeyGetter - コンテキストから公開鍵を取得する関数
 */
export function es256RefreshAuth(publicKeyGetter: KeyGetter): MiddlewareHandler {
  return async (c, next) => {
    const publicKey = publicKeyGetter(c)
    return refreshTokenAuth({ algorithm: 'ES256', publicKey })(c, next)
  }
}
