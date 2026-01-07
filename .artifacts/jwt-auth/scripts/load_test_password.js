/**
 * パスワードハッシュ（PBKDF2）負荷試験スクリプト
 *
 * Cloudflare Workers上でのパスワードベース認証の性能を測定
 * PBKDF2反復回数による処理時間の変化を検証
 *
 * 使用方法:
 *   k6 run load_test_password.js
 *   k6 run -e ITERATIONS=10000 load_test_password.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// カスタムメトリクス
const errorRate = new Rate('errors');
const hashLatency = new Trend('password_hash_latency');
const requestCount = new Counter('total_requests');

const BASE_URL = __ENV.BASE_URL || 'https://jwt-auth-eval.kazu-san.workers.dev';
const ITERATIONS = __ENV.ITERATIONS || '100000';

// 負荷設定: 10 RPS × 30秒（パスワードハッシュは計算負荷が高いため控えめ）
export const options = {
  scenarios: {
    password_auth: {
      executor: 'constant-arrival-rate',
      rate: 10,
      timeUnit: '1s',
      duration: '30s',
      preAllocatedVUs: 50,
      maxVUs: 100,
      exec: 'testPasswordAuth',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<1000'], // パスワードハッシュは遅いので1秒まで許容
    errors: ['rate<0.01'],
  },
};

// テスト: パスワード認証
export function testPasswordAuth() {
  const credentials = JSON.stringify({
    email: 'test@example.com',
    password: 'password123',
  });

  const resp = http.post(
    `${BASE_URL}/auth/password/login?iterations=${ITERATIONS}`,
    credentials,
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );

  const success = check(resp, {
    'Password auth status 200': (r) => r.status === 200,
    'Has processing time': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.meta && typeof body.meta.processingTimeMs === 'number';
      } catch {
        return false;
      }
    },
  });

  errorRate.add(!success);
  hashLatency.add(resp.timings.duration);
  requestCount.add(1);

  // レスポンスから処理時間を取得してログ
  if (resp.status === 200) {
    try {
      const body = JSON.parse(resp.body);
      if (body.meta) {
        // console.log(`Server processing: ${body.meta.processingTimeMs}ms, iterations: ${body.meta.iterations}`);
      }
    } catch {
      // ignore
    }
  }
}

export function setup() {
  console.log('=== Password Hash Load Test ===');
  console.log(`PBKDF2 Iterations: ${ITERATIONS}`);
  console.log('');

  // ベンチマーク情報を取得
  const benchResp = http.get(`${BASE_URL}/auth/password/benchmark`);
  if (benchResp.status === 200) {
    const data = benchResp.json();
    console.log('Cloudflare Workers PBKDF2 limits:');
    console.log(`  Max iterations: ${data.limits.cloudflareWorkers.maxIterations}`);
    console.log(`  Reason: ${data.limits.cloudflareWorkers.reason}`);
    console.log('');
  }

  // 初回ログインでユーザーを初期化
  const credentials = JSON.stringify({
    email: 'test@example.com',
    password: 'password123',
  });
  const initResp = http.post(
    `${BASE_URL}/auth/password/login?iterations=${ITERATIONS}`,
    credentials,
    { headers: { 'Content-Type': 'application/json' } }
  );

  if (initResp.status === 200) {
    const data = initResp.json();
    console.log(`Initial login successful:`);
    console.log(`  Algorithm: ${data.meta.algorithm}`);
    console.log(`  Iterations: ${data.meta.iterations}`);
    console.log(`  Processing time: ${data.meta.processingTimeMs}ms`);
  } else {
    console.log(`Initial login failed: ${initResp.status}`);
  }

  console.log('');
  console.log('Starting load test...');
  console.log('');

  return { iterations: ITERATIONS };
}

export function teardown(data) {
  console.log('');
  console.log('=== Password Hash Test Complete ===');
  console.log(`Tested with ${data.iterations} PBKDF2 iterations`);
}

export function handleSummary(data) {
  const iterations = data.metrics.iterations?.values?.count || 0;
  const p95Latency = data.metrics.http_req_duration?.values?.['p(95)'] || 0;
  const avgLatency = data.metrics.http_req_duration?.values?.avg || 0;
  const errorRateValue = data.metrics.errors?.values?.rate || 0;

  const summary = {
    test: 'password-hash-load-test',
    pbkdf2Iterations: ITERATIONS,
    results: {
      totalRequests: iterations,
      p95LatencyMs: p95Latency,
      avgLatencyMs: avgLatency,
      errorRate: errorRateValue,
    },
    limits: {
      cloudflareWorkersMaxIterations: 100000,
      note: 'PBKDF2 iterations > 100,000 are blocked by Cloudflare Workers',
    },
  };

  return {
    '/Users/kazuph/src/github.com/kazuph/cloudflare-workers-webauth-eval/.artifacts/jwt-auth/password-test-result.json':
      JSON.stringify(summary, null, 2),
    stdout: `
=================================
  PASSWORD HASH LOAD TEST SUMMARY
=================================

PBKDF2 Iterations:  ${ITERATIONS}

Results:
  Total Requests:   ${iterations}
  p95 Latency:      ${p95Latency.toFixed(2)}ms
  Avg Latency:      ${avgLatency.toFixed(2)}ms
  Error Rate:       ${(errorRateValue * 100).toFixed(2)}%

Cloudflare Workers Limit:
  Max PBKDF2 iterations: 100,000
  bcrypt equivalent: ~cost 10

=================================
`,
  };
}
