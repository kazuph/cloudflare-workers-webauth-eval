/**
 * パスワードハッシュ認証ルート
 * PBKDF2を使用したパスワードハッシュ化（bcrypt相当の計算負荷）
 * Cloudflare Workersの処理時間制限を検証するための実装
 */

import { Hono } from 'hono'

type Bindings = {
  TEST_USER_EMAIL: string
  TEST_USER_PASSWORD: string
  DB: D1Database
}

type Variables = {
  jwtPayload?: { sub?: string; type?: string }
}

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

/**
 * PBKDF2によるパスワードハッシュ化
 * bcryptの代替として使用（Web Crypto API対応）
 *
 * @param password - 平文パスワード
 * @param salt - ソルト（16バイト推奨）
 * @param iterations - 反復回数（bcryptのコストファクターに相当）
 *   - 10,000: 軽量（約5-10ms）
 *   - 100,000: 中程度（約50-100ms）- bcrypt cost=10相当
 *   - 310,000: OWASP推奨（約150-300ms）
 *   - 600,000: 高セキュリティ（約300-600ms）- bcrypt cost=12相当
 */
async function hashPassword(
  password: string,
  salt: Uint8Array,
  iterations: number = 100000
): Promise<string> {
  const encoder = new TextEncoder()
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  )

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256',
    },
    passwordKey,
    256 // 32 bytes
  )

  // Base64エンコードして返す
  const hashArray = new Uint8Array(derivedBits)
  return btoa(String.fromCharCode(...hashArray))
}

/**
 * パスワード検証
 */
async function verifyPassword(
  password: string,
  salt: Uint8Array,
  storedHash: string,
  iterations: number = 100000
): Promise<boolean> {
  const computedHash = await hashPassword(password, salt, iterations)
  return computedHash === storedHash
}

/**
 * ランダムソルト生成
 */
function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16))
}

/**
 * Uint8Array <-> Base64 変換
 */
function saltToBase64(salt: Uint8Array): string {
  return btoa(String.fromCharCode(...salt))
}

function base64ToSalt(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

// 仮のユーザーストア（実際はD1やKVに保存）
interface StoredUser {
  id: string
  email: string
  passwordHash: string
  salt: string
  iterations: number
}

const userStore: Map<string, StoredUser> = new Map()

/**
 * POST /login - パスワード認証
 * クエリパラメータで反復回数を指定可能（負荷試験用）
 * ?iterations=10000 | 100000 | 310000 | 600000
 */
app.post('/login', async (c) => {
  const startTime = Date.now()

  const body = await c.req.json<{ email: string; password: string }>()
  const { email, password } = body

  // クエリパラメータから反復回数を取得（デフォルト: 100,000）
  const iterationsParam = c.req.query('iterations')
  const iterations = iterationsParam ? parseInt(iterationsParam, 10) : 100000

  // 反復回数の制限（Cloudflare Workers制限: 100,000まで）
  const safeIterations = Math.min(Math.max(iterations, 1000), 100000)

  // テストユーザーの認証
  const testEmail = c.env.TEST_USER_EMAIL || 'test@example.com'
  const testPassword = c.env.TEST_USER_PASSWORD || 'password123'

  // まず、ユーザーが存在するか確認（存在しない場合は初回登録扱い）
  let user = userStore.get(email)

  if (!user && email === testEmail) {
    // 初回アクセス時にパスワードをハッシュ化して保存
    const salt = generateSalt()
    const passwordHash = await hashPassword(testPassword, salt, safeIterations)
    user = {
      id: 'user-1',
      email: testEmail,
      passwordHash,
      salt: saltToBase64(salt),
      iterations: safeIterations,
    }
    userStore.set(email, user)
  }

  if (!user) {
    // ユーザーが存在しない場合でも、タイミング攻撃を防ぐためにハッシュ計算を実行
    const dummySalt = generateSalt()
    await hashPassword(password, dummySalt, safeIterations)

    return c.json(
      { error: 'Authentication failed', message: 'Invalid email or password' },
      401
    )
  }

  // パスワード検証
  const salt = base64ToSalt(user.salt)
  const isValid = await verifyPassword(password, salt, user.passwordHash, user.iterations)

  const processingTime = Date.now() - startTime

  if (!isValid) {
    return c.json(
      {
        error: 'Authentication failed',
        message: 'Invalid email or password',
        processingTimeMs: processingTime,
      },
      401
    )
  }

  return c.json({
    success: true,
    message: 'Authentication successful',
    user: {
      id: user.id,
      email: user.email,
    },
    meta: {
      algorithm: 'PBKDF2-SHA256',
      iterations: user.iterations,
      processingTimeMs: processingTime,
    },
  })
})

/**
 * POST /hash - パスワードハッシュのベンチマーク
 * 純粋なハッシュ計算時間を測定
 */
app.post('/hash', async (c) => {
  const body = await c.req.json<{ password?: string; iterations?: number }>()
  const password = body.password || 'test-password'
  // Cloudflare Workers制限: 100,000まで
  const iterations = Math.min(Math.max(body.iterations || 100000, 1000), 100000)

  const salt = generateSalt()

  const startTime = Date.now()
  const hash = await hashPassword(password, salt, iterations)
  const processingTime = Date.now() - startTime

  return c.json({
    success: true,
    algorithm: 'PBKDF2-SHA256',
    iterations,
    processingTimeMs: processingTime,
    hashLength: hash.length,
    saltBase64: saltToBase64(salt),
  })
})

/**
 * GET /benchmark - 各反復回数でのベンチマーク
 * Cloudflare WorkersはPBKDF2の反復回数を100,000までに制限
 */
app.get('/benchmark', async (c) => {
  // Cloudflare Workersの制限: 100,000回まで
  const iterationsList = [1000, 10000, 50000, 100000]
  const results: { iterations: number; processingTimeMs: number; error?: string }[] = []
  const salt = generateSalt()
  const password = 'benchmark-password'

  for (const iterations of iterationsList) {
    try {
      const startTime = Date.now()
      await hashPassword(password, salt, iterations)
      const processingTime = Date.now() - startTime
      results.push({ iterations, processingTimeMs: processingTime })
    } catch (error) {
      results.push({
        iterations,
        processingTimeMs: -1,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  return c.json({
    algorithm: 'PBKDF2-SHA256',
    benchmarks: results,
    limits: {
      cloudflareWorkers: {
        maxIterations: 100000,
        reason: 'Cloudflare Workers limits PBKDF2 iterations to prevent CPU time exceeded errors',
      },
      bcryptEquivalent: {
        '10000': 'bcrypt cost ~8',
        '100000': 'bcrypt cost ~10',
        note: 'bcrypt cost 12+ (600,000+ iterations) is NOT supported on Cloudflare Workers',
      },
    },
  })
})

export default app
