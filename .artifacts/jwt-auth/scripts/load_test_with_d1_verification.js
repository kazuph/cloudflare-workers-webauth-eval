/**
 * D1検証付き負荷試験スクリプト
 *
 * 機能:
 * 1. 負荷試験前にD1をクリア
 * 2. 負荷試験を実行
 * 3. 負荷試験後にD1レコード数を検証
 *
 * 使用方法:
 *   k6 run load_test_with_d1_verification.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// カスタムメトリクス
const errorRate = new Rate('errors');
const verifyLatency = new Trend('jwt_verify_latency');
const requestCount = new Counter('total_requests');

const BASE_URL = __ENV.BASE_URL || 'https://jwt-auth-eval.<your-subdomain>.workers.dev';

// 検証用の小規模負荷設定（33 RPS × 30秒 = 約990リクエスト）
export const options = {
  scenarios: {
    // HS256のみで検証（シンプルに）
    hs256_verification: {
      executor: 'constant-arrival-rate',
      rate: 33,
      timeUnit: '1s',
      duration: '30s',
      preAllocatedVUs: 50,
      maxVUs: 100,
      exec: 'testHS256',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500'],
    errors: ['rate<0.01'],
  },
};

// セットアップ: D1クリア & トークン取得
export function setup() {
  console.log('=== D1 Verification Load Test ===');
  console.log('');

  // Step 1: D1クリア前の状態を取得
  console.log('Step 1: Getting current D1 stats...');
  const beforeStats = http.get(`${BASE_URL}/logs/stats`);
  let beforeCount = 0;
  if (beforeStats.status === 200) {
    const stats = beforeStats.json();
    beforeCount = stats.total || 0;
    console.log(`  Before: ${beforeCount} records in D1`);
  }

  // Step 2: D1をクリア（DELETEエンドポイントが必要 - 後で追加）
  // 今回は /logs/clear エンドポイントを使用
  console.log('Step 2: Clearing D1 database...');
  const clearResp = http.post(`${BASE_URL}/logs/clear`, null, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (clearResp.status === 200) {
    console.log('  D1 cleared successfully');
  } else {
    console.log(`  Warning: D1 clear failed (status: ${clearResp.status})`);
    console.log('  Proceeding with existing data...');
  }

  // Step 3: クリア後の状態を確認
  const afterClearStats = http.get(`${BASE_URL}/logs/stats`);
  if (afterClearStats.status === 200) {
    const stats = afterClearStats.json();
    console.log(`  After clear: ${stats.total || 0} records in D1`);
  }

  // Step 4: トークン取得
  console.log('Step 3: Acquiring tokens...');
  const credentials = JSON.stringify({
    email: 'test@example.com',
    password: 'password123',
  });
  const headers = { 'Content-Type': 'application/json' };

  const hs256Resp = http.post(`${BASE_URL}/auth/hs256/login`, credentials, { headers });
  let token = null;
  if (hs256Resp.status === 200) {
    token = hs256Resp.json('accessToken');
    console.log('  Token acquired successfully');
  } else {
    console.log(`  Warning: Token acquisition failed (status: ${hs256Resp.status})`);
  }

  console.log('');
  console.log('Starting load test...');
  console.log('');

  return {
    hs256: token,
    expectedRequests: 0, // Will be calculated from k6 metrics
  };
}

// HS256署名検証テスト
export function testHS256(data) {
  const token = data.hs256;
  if (!token) {
    errorRate.add(1);
    return;
  }

  const resp = http.get(`${BASE_URL}/auth/hs256/protected`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const success = check(resp, {
    'HS256 status 200': (r) => r.status === 200,
  });

  errorRate.add(!success);
  verifyLatency.add(resp.timings.duration);
  requestCount.add(1);
}

// ティアダウン: D1レコード数を検証
export function teardown(data) {
  console.log('');
  console.log('=== D1 Verification ===');
  console.log('');

  // 少し待ってD1への非同期書き込みが完了するのを待つ
  sleep(3);

  // D1統計を取得
  const statsResp = http.get(`${BASE_URL}/logs/stats`);
  if (statsResp.status !== 200) {
    console.log('ERROR: Failed to get D1 stats');
    return;
  }

  const stats = statsResp.json();
  const d1RecordCount = stats.total || 0;

  console.log(`D1 Record Count: ${d1RecordCount}`);
  console.log(`By Status: ${JSON.stringify(stats.byStatus)}`);
  console.log(`By Algorithm: ${JSON.stringify(stats.byAlgorithm)}`);
  console.log(`Average Latency: ${stats.avgLatency.toFixed(2)}ms`);
  console.log('');

  // k6のiterations数と比較するには handleSummary を使用する必要がある
  // ここでは D1 に記録されたことを確認
  if (d1RecordCount > 0) {
    console.log('✅ D1 records were successfully written');
    console.log('');
    console.log('Note: Compare this count with k6 iterations in the summary');
  } else {
    console.log('❌ No D1 records found - verification FAILED');
  }
}

// サマリーハンドラー: k6メトリクスとD1レコード数の最終検証
export function handleSummary(data) {
  const iterations = data.metrics.iterations?.values?.count || 0;
  const httpReqs = data.metrics.http_reqs?.values?.count || 0;

  // 最終検証: D1統計を取得
  const statsResp = http.get(`${BASE_URL}/logs/stats`);
  let d1Count = 'N/A';
  let verificationResult = 'UNKNOWN';

  if (statsResp && statsResp.status === 200) {
    try {
      const stats = JSON.parse(statsResp.body);
      d1Count = stats.total || 0;

      // iterations と D1レコード数を比較
      // setup/teardownのリクエストも含まれるので、近似値での比較
      const diff = Math.abs(d1Count - iterations);
      const tolerance = iterations * 0.05; // 5%の誤差許容

      if (diff <= tolerance + 10) { // +10 for setup/teardown requests
        verificationResult = 'PASS';
      } else {
        verificationResult = 'FAIL';
      }
    } catch (e) {
      d1Count = 'Error parsing';
    }
  }

  const summary = {
    verification: {
      k6_iterations: iterations,
      k6_http_requests: httpReqs,
      d1_record_count: d1Count,
      result: verificationResult,
    },
    metrics: {
      p95_latency_ms: data.metrics.http_req_duration?.values?.['p(95)'] || 0,
      avg_latency_ms: data.metrics.http_req_duration?.values?.avg || 0,
      error_rate: data.metrics.errors?.values?.rate || 0,
    },
  };

  return {
    '/Users/kazuph/src/github.com/kazuph/cloudflare-workers-webauth-eval/.artifacts/jwt-auth/d1-verification-result.json': JSON.stringify(summary, null, 2),
    stdout: `
=================================
  D1 VERIFICATION SUMMARY
=================================

k6 Iterations:      ${iterations}
k6 HTTP Requests:   ${httpReqs}
D1 Record Count:    ${d1Count}

Verification:       ${verificationResult}

Performance:
  p95 Latency:      ${(summary.metrics.p95_latency_ms).toFixed(2)}ms
  Avg Latency:      ${(summary.metrics.avg_latency_ms).toFixed(2)}ms
  Error Rate:       ${(summary.metrics.error_rate * 100).toFixed(2)}%

=================================
`,
  };
}
