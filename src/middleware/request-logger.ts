/**
 * D1リクエストログミドルウェア
 * 全リクエストをD1データベースに非同期で保存
 */

import type { Context, MiddlewareHandler } from 'hono'

export interface RequestLog {
  request_id: string
  timestamp: string
  method: string
  path: string
  status: number
  latency_ms: number
  user_id: string | null
  algorithm: string | null
  token_type: string | null
  ip: string | null
  user_agent: string | null
  error_message: string | null
}

/**
 * UUID生成（crypto.randomUUID）
 */
function generateRequestId(): string {
  return crypto.randomUUID()
}

/**
 * パスからアルゴリズムを抽出
 */
function extractAlgorithm(path: string): string | null {
  const match = path.match(/\/auth\/(hs256|rs256|es256)\//)
  return match ? match[1].toUpperCase() : null
}

/**
 * リクエストログをD1に保存
 */
async function saveLog(db: D1Database, log: RequestLog): Promise<void> {
  try {
    await db.prepare(`
      INSERT INTO request_logs (
        request_id, timestamp, method, path, status, latency_ms,
        user_id, algorithm, token_type, ip, user_agent, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      log.request_id,
      log.timestamp,
      log.method,
      log.path,
      log.status,
      log.latency_ms,
      log.user_id,
      log.algorithm,
      log.token_type,
      log.ip,
      log.user_agent,
      log.error_message
    ).run()
  } catch (error) {
    console.error('Failed to save request log:', error)
  }
}

/**
 * リクエストログミドルウェア
 * c.executionCtx.waitUntil を使用して非同期でD1に書き込み
 */
export function requestLogger(): MiddlewareHandler {
  return async (c, next) => {
    const requestId = generateRequestId()
    const startTime = Date.now()
    const timestamp = new Date().toISOString()

    // リクエスト情報を収集
    const method = c.req.method
    const path = c.req.path
    const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || null
    const userAgent = c.req.header('user-agent') || null
    const algorithm = extractAlgorithm(path)

    // リクエストIDをコンテキストに保存（後で参照可能）
    c.set('requestId', requestId)

    let status = 200
    let errorMessage: string | null = null
    let userId: string | null = null
    let tokenType: string | null = null

    try {
      await next()
      status = c.res.status

      // JWT payloadからユーザー情報を取得（認証後のリクエストの場合）
      const payload = c.get('jwtPayload')
      if (payload) {
        userId = payload.sub || null
        tokenType = payload.type || null
      }
    } catch (error) {
      status = 500
      if (error instanceof Error) {
        errorMessage = error.message
        if ('status' in error && typeof error.status === 'number') {
          status = error.status
        }
      }
      throw error
    } finally {
      const latencyMs = Date.now() - startTime

      const log: RequestLog = {
        request_id: requestId,
        timestamp,
        method,
        path,
        status,
        latency_ms: latencyMs,
        user_id: userId,
        algorithm,
        token_type: tokenType,
        ip,
        user_agent: userAgent,
        error_message: errorMessage,
      }

      // D1に非同期で書き込み（レスポンスをブロックしない）
      const db = c.env.DB as D1Database | undefined
      if (db) {
        c.executionCtx.waitUntil(saveLog(db, log))
      }
    }
  }
}

/**
 * ログ取得エンドポイント用: 最新のログを取得
 */
export async function getRecentLogs(
  db: D1Database,
  limit: number = 100
): Promise<RequestLog[]> {
  const result = await db.prepare(`
    SELECT * FROM request_logs
    ORDER BY timestamp DESC
    LIMIT ?
  `).bind(limit).all<RequestLog>()

  return result.results
}

/**
 * ログをすべて削除（負荷試験用）
 */
export async function clearLogs(db: D1Database): Promise<{ deleted: number }> {
  const countResult = await db.prepare('SELECT COUNT(*) as count FROM request_logs').first<{ count: number }>()
  const countBefore = countResult?.count || 0

  await db.prepare('DELETE FROM request_logs').run()

  return { deleted: countBefore }
}

/**
 * ログ統計取得
 */
export async function getLogStats(db: D1Database): Promise<{
  total: number
  byStatus: Record<string, number>
  byAlgorithm: Record<string, number>
  avgLatency: number
}> {
  const [totalResult, statusResult, algorithmResult, latencyResult] = await Promise.all([
    db.prepare('SELECT COUNT(*) as count FROM request_logs').first<{ count: number }>(),
    db.prepare(`
      SELECT status, COUNT(*) as count
      FROM request_logs
      GROUP BY status
    `).all<{ status: number; count: number }>(),
    db.prepare(`
      SELECT algorithm, COUNT(*) as count
      FROM request_logs
      WHERE algorithm IS NOT NULL
      GROUP BY algorithm
    `).all<{ algorithm: string; count: number }>(),
    db.prepare('SELECT AVG(latency_ms) as avg FROM request_logs').first<{ avg: number }>(),
  ])

  const byStatus: Record<string, number> = {}
  for (const row of statusResult.results) {
    byStatus[row.status.toString()] = row.count
  }

  const byAlgorithm: Record<string, number> = {}
  for (const row of algorithmResult.results) {
    byAlgorithm[row.algorithm] = row.count
  }

  return {
    total: totalResult?.count || 0,
    byStatus,
    byAlgorithm,
    avgLatency: latencyResult?.avg || 0,
  }
}
