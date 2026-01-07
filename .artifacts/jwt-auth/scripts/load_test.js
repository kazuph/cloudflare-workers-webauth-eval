import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// カスタムメトリクス
const errorRate = new Rate('errors');
const verifyLatency = new Trend('jwt_verify_latency');

const BASE_URL = __ENV.BASE_URL || 'https://jwt-auth-eval.<your-subdomain>.workers.dev';

// 2000リクエスト/分 = 約33 RPS
// 1分間のテスト
export const options = {
  scenarios: {
    hs256_load: {
      executor: 'constant-arrival-rate',
      rate: 33,
      timeUnit: '1s',
      duration: '1m',
      preAllocatedVUs: 50,
      maxVUs: 100,
      exec: 'testHS256',
    },
    rs256_load: {
      executor: 'constant-arrival-rate',
      rate: 33,
      timeUnit: '1s',
      duration: '1m',
      preAllocatedVUs: 50,
      maxVUs: 100,
      exec: 'testRS256',
      startTime: '1m10s',
    },
    es256_load: {
      executor: 'constant-arrival-rate',
      rate: 33,
      timeUnit: '1s',
      duration: '1m',
      preAllocatedVUs: 50,
      maxVUs: 100,
      exec: 'testES256',
      startTime: '2m20s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500'],
    errors: ['rate<0.01'],
  },
};

// トークンキャッシュ
let tokens = {
  hs256: null,
  rs256: null,
  es256: null,
};

// セットアップ: 各アルゴリズムのトークンを取得
export function setup() {
  const credentials = JSON.stringify({
    email: 'test@example.com',
    password: 'password123',
  });
  const headers = { 'Content-Type': 'application/json' };

  // HS256トークン取得
  const hs256Resp = http.post(`${BASE_URL}/auth/hs256/login`, credentials, { headers });
  if (hs256Resp.status === 200) {
    tokens.hs256 = hs256Resp.json('accessToken');
  }

  // RS256トークン取得
  const rs256Resp = http.post(`${BASE_URL}/auth/rs256/login`, credentials, { headers });
  if (rs256Resp.status === 200) {
    tokens.rs256 = rs256Resp.json('accessToken');
  }

  // ES256トークン取得
  const es256Resp = http.post(`${BASE_URL}/auth/es256/login`, credentials, { headers });
  if (es256Resp.status === 200) {
    tokens.es256 = es256Resp.json('accessToken');
  }

  console.log(`Tokens acquired: HS256=${!!tokens.hs256}, RS256=${!!tokens.rs256}, ES256=${!!tokens.es256}`);
  return tokens;
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
    tags: { algorithm: 'HS256' },
  });

  const success = check(resp, {
    'HS256 status 200': (r) => r.status === 200,
  });

  errorRate.add(!success);
  verifyLatency.add(resp.timings.duration);
}

// RS256署名検証テスト
export function testRS256(data) {
  const token = data.rs256;
  if (!token) {
    errorRate.add(1);
    return;
  }

  const resp = http.get(`${BASE_URL}/auth/rs256/protected`, {
    headers: { Authorization: `Bearer ${token}` },
    tags: { algorithm: 'RS256' },
  });

  const success = check(resp, {
    'RS256 status 200': (r) => r.status === 200,
  });

  errorRate.add(!success);
  verifyLatency.add(resp.timings.duration);
}

// ES256署名検証テスト
export function testES256(data) {
  const token = data.es256;
  if (!token) {
    errorRate.add(1);
    return;
  }

  const resp = http.get(`${BASE_URL}/auth/es256/protected`, {
    headers: { Authorization: `Bearer ${token}` },
    tags: { algorithm: 'ES256' },
  });

  const success = check(resp, {
    'ES256 status 200': (r) => r.status === 200,
  });

  errorRate.add(!success);
  verifyLatency.add(resp.timings.duration);
}

export function handleSummary(data) {
  return {
    '/Users/kazuph/src/github.com/kazuph/cloudflare-workers-webauth-eval/.artifacts/jwt-auth/load-test-result.json': JSON.stringify(data, null, 2),
  };
}
