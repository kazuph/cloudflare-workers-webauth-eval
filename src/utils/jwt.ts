/**
 * JWT生成・検証ユーティリティ
 * jose ライブラリを使用してHS256, RS256, ES256をサポート
 */

import * as jose from 'jose'

export type Algorithm = 'HS256' | 'RS256' | 'ES256'

export interface TokenPayload {
  sub: string // subject (user id)
  email: string
  iat?: number // issued at
  exp?: number // expiration
  type?: 'access' | 'refresh'
}

export interface JWTConfig {
  algorithm: Algorithm
  secret?: string // HS256用
  privateKey?: string // RS256/ES256用（Base64エンコード）
  publicKey?: string // RS256/ES256用（Base64エンコード）
  accessTokenExpiry?: string // default: '15m'
  refreshTokenExpiry?: string // default: '7d'
}

/**
 * Base64エンコードされたPEM鍵をデコード
 */
function decodeBase64Key(base64Key: string): string {
  return Buffer.from(base64Key, 'base64').toString('utf-8')
}

/**
 * HS256用のシークレットキーを取得
 */
async function getHS256Key(secret: string): Promise<Uint8Array> {
  return new TextEncoder().encode(secret)
}

/**
 * RS256/ES256用の秘密鍵をインポート
 */
async function importPrivateKey(
  base64Key: string,
  algorithm: 'RS256' | 'ES256'
) {
  const pem = decodeBase64Key(base64Key)
  return jose.importPKCS8(pem, algorithm)
}

/**
 * RS256/ES256用の公開鍵をインポート
 */
async function importPublicKey(
  base64Key: string,
  algorithm: 'RS256' | 'ES256'
) {
  const pem = decodeBase64Key(base64Key)
  return jose.importSPKI(pem, algorithm)
}

/**
 * アクセストークンを生成
 */
export async function generateAccessToken(
  payload: Omit<TokenPayload, 'iat' | 'exp' | 'type'>,
  config: JWTConfig
): Promise<string> {
  const { algorithm, secret, privateKey, accessTokenExpiry = '15m' } = config

  const tokenPayload: TokenPayload = {
    ...payload,
    type: 'access',
  }

  if (algorithm === 'HS256') {
    if (!secret) throw new Error('Secret is required for HS256')
    const key = await getHS256Key(secret)
    return new jose.SignJWT(tokenPayload as unknown as jose.JWTPayload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(accessTokenExpiry)
      .sign(key)
  }

  if (!privateKey) throw new Error('Private key is required for RS256/ES256')
  const key = await importPrivateKey(privateKey, algorithm)
  return new jose.SignJWT(tokenPayload as unknown as jose.JWTPayload)
    .setProtectedHeader({ alg: algorithm })
    .setIssuedAt()
    .setExpirationTime(accessTokenExpiry)
    .sign(key)
}

/**
 * リフレッシュトークンを生成
 */
export async function generateRefreshToken(
  payload: Omit<TokenPayload, 'iat' | 'exp' | 'type'>,
  config: JWTConfig
): Promise<string> {
  const { algorithm, secret, privateKey, refreshTokenExpiry = '7d' } = config

  const tokenPayload: TokenPayload = {
    ...payload,
    type: 'refresh',
  }

  if (algorithm === 'HS256') {
    if (!secret) throw new Error('Secret is required for HS256')
    const key = await getHS256Key(secret)
    return new jose.SignJWT(tokenPayload as unknown as jose.JWTPayload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(refreshTokenExpiry)
      .sign(key)
  }

  if (!privateKey) throw new Error('Private key is required for RS256/ES256')
  const key = await importPrivateKey(privateKey, algorithm)
  return new jose.SignJWT(tokenPayload as unknown as jose.JWTPayload)
    .setProtectedHeader({ alg: algorithm })
    .setIssuedAt()
    .setExpirationTime(refreshTokenExpiry)
    .sign(key)
}

/**
 * トークンを検証してペイロードを返す
 */
export async function verifyToken(
  token: string,
  config: JWTConfig
): Promise<TokenPayload> {
  const { algorithm, secret, publicKey } = config

  if (algorithm === 'HS256') {
    if (!secret) throw new Error('Secret is required for HS256')
    const key = await getHS256Key(secret)
    const { payload } = await jose.jwtVerify(token, key, {
      algorithms: ['HS256'],
    })
    return payload as unknown as TokenPayload
  }

  if (!publicKey) throw new Error('Public key is required for RS256/ES256')
  const key = await importPublicKey(publicKey, algorithm)
  const { payload } = await jose.jwtVerify(token, key, {
    algorithms: [algorithm],
  })
  return payload as unknown as TokenPayload
}

/**
 * トークンをデコード（検証なし）
 */
export function decodeToken(token: string): TokenPayload | null {
  try {
    const decoded = jose.decodeJwt(token)
    return decoded as unknown as TokenPayload
  } catch {
    return null
  }
}

/**
 * 公開鍵をJWKS形式で取得
 */
export async function getJWKS(
  publicKeys: { algorithm: 'RS256' | 'ES256'; publicKey: string; kid: string }[]
): Promise<jose.JSONWebKeySet> {
  const keys: jose.JWK[] = []

  for (const { algorithm, publicKey, kid } of publicKeys) {
    const key = await importPublicKey(publicKey, algorithm)
    const jwk = await jose.exportJWK(key)
    keys.push({
      ...jwk,
      kid,
      alg: algorithm,
      use: 'sig',
    })
  }

  return { keys }
}
