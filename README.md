# JWT Auth Evaluation API

Cloudflare Workers + Hono + jose で構築したJWT認証APIの性能評価プロジェクト。

## 概要

3種類のJWT署名アルゴリズム（HS256, RS256, ES256）をサポートし、k6による負荷試験でCloudflare Workersの処理性能を検証します。

## 技術スタック

- **Runtime**: Cloudflare Workers
- **Framework**: Hono
- **JWT**: jose (Web Crypto API)
- **Database**: D1 (リクエストログ)
- **Load Testing**: k6

## セットアップ

### 前提条件

- Node.js 18+
- pnpm
- k6 (`brew install k6`)
- Wrangler CLI (`pnpm install -g wrangler`)

### インストール

```bash
pnpm install
```

### 環境変数の設定

1. 鍵を生成:
```bash
pnpm generate-keys
```

2. `.env.example`を参考に、Cloudflare Workersに環境変数を設定:
```bash
wrangler secret put JWT_HS256_SECRET
wrangler secret put JWT_RS256_PRIVATE_KEY
wrangler secret put JWT_RS256_PUBLIC_KEY
wrangler secret put JWT_ES256_PRIVATE_KEY
wrangler secret put JWT_ES256_PUBLIC_KEY
```

### D1データベースのセットアップ

```bash
# D1データベースを作成
wrangler d1 create jwt-auth-logs

# マイグレーションを実行
wrangler d1 execute jwt-auth-logs --file=./migrations/0001_create_request_logs.sql
```

### デプロイ

```bash
pnpm deploy
```

## API エンドポイント

### JWT認証 (HS256/RS256/ES256)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/{alg}/login` | ログイン（トークン発行） |
| POST | `/auth/{alg}/refresh` | トークンリフレッシュ |
| GET | `/auth/{alg}/verify` | トークン検証 |
| GET | `/auth/{alg}/protected` | 保護されたリソース |

`{alg}` は `hs256`, `rs256`, `es256` のいずれか。

### パスワードハッシュ認証

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/password/login` | PBKDF2によるパスワード認証 |
| POST | `/auth/password/hash` | ハッシュ計算ベンチマーク |
| GET | `/auth/password/benchmark` | 反復回数別ベンチマーク |

### ログ管理

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/logs` | リクエストログ取得 |
| GET | `/logs/stats` | ログ統計 |
| POST | `/logs/clear` | ログクリア（負荷試験用） |

## 負荷試験

### JWT署名検証（5倍負荷: 165 RPS）

```bash
pnpm load-test:jwt
```

3つのアルゴリズム（HS256, RS256, ES256）を順番に各1分間、165 RPSで試験します。

### D1書き込み検証

```bash
pnpm load-test:d1-verify
```

D1クリア → 負荷試験 → レコード数検証を自動で行います。

### パスワードハッシュ（PBKDF2）

```bash
# 100,000 iterations（デフォルト）
pnpm load-test:password

# 10,000 iterations（軽量）
pnpm load-test:password:light
```

## 試験結果

### JWT署名検証（165 RPS）

| 指標 | 結果 |
|------|------|
| 総リクエスト数 | 29,705 |
| 成功率 | 100% |
| p95レイテンシ | 28.26ms |
| 実効スループット | 148.24 RPS |

### パスワードハッシュ（PBKDF2 100,000 iterations）

| 指標 | 結果 |
|------|------|
| 総リクエスト数 | 301 |
| 成功率 | 100% |
| p95レイテンシ | 149.79ms |
| 実効スループット | 10 RPS |

### Cloudflare Workers制限

- **PBKDF2反復回数**: 最大100,000回（bcrypt cost ~10相当）
- **CPU時間**: 無料枠 10ms/リクエスト
- **リクエスト数**: 100,000/日

## ライセンス

MIT
