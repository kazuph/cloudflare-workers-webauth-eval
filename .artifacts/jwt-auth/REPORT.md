# JWT Auth API 検証レポート

**日時**: 2026-01-07
**プロジェクト**: cloudflare-workers-webauth-eval
**デプロイ先**: https://jwt-auth-eval.<your-subdomain>.workers.dev

## 概要

Hono + Cloudflare Workers を使用したJWT認証APIの実装・検証が完了しました。
3種類のJWT署名アルゴリズム（HS256, RS256, ES256）をサポートしています。

## テスト結果

### ローカル環境テスト (localhost:8787)

| アルゴリズム | Login | Verify | Protected | Refresh | 結果 |
|-------------|-------|--------|-----------|---------|------|
| HS256 | 200 | 200 | 200 | 200 | PASS |
| RS256 | 200 | 200 | 200 | 200 | PASS |
| ES256 | 200 | 200 | 200 | 200 | PASS |

**全テストPASS**

### リモート環境テスト (Cloudflare Workers)

| アルゴリズム | Login | Verify | Protected | Refresh | 結果 |
|-------------|-------|--------|-----------|---------|------|
| HS256 | 200 | 200 | 200 | 200 | PASS |
| RS256 | 200 | 200 | 200 | 200 | PASS |
| ES256 | 200 | 200 | 200 | 200 | PASS |

**全テストPASS**

## 実装したエンドポイント

### メタエンドポイント
- `GET /` - API情報
- `GET /health` - ヘルスチェック
- `GET /algorithms` - サポートアルゴリズム一覧
- `GET /.well-known/jwks.json` - 公開鍵（JWKS形式）

### 認証エンドポイント（各アルゴリズム共通）
- `POST /auth/{alg}/login` - ログイン（トークン発行）
- `POST /auth/{alg}/refresh` - トークンリフレッシュ
- `GET /auth/{alg}/verify` - トークン検証
- `GET /auth/{alg}/protected` - 保護されたリソース

## アルゴリズム詳細

| アルゴリズム | 種別 | 説明 |
|-------------|------|------|
| **HS256** | 対称鍵（HMAC） | シークレットキーを共有する最も一般的な方式 |
| **RS256** | 非対称鍵（RSA） | 公開鍵/秘密鍵ペア。公開鍵で検証可能 |
| **ES256** | 非対称鍵（ECDSA） | 楕円曲線暗号。RSAより鍵サイズが小さい |

## JWKSレスポンス例

```json
{
  "keys": [
    {
      "kty": "RSA",
      "kid": "rs256-key-1",
      "alg": "RS256",
      "use": "sig"
    },
    {
      "kty": "EC",
      "crv": "P-256",
      "kid": "es256-key-1",
      "alg": "ES256",
      "use": "sig"
    }
  ]
}
```

## 保護されたリソースのレスポンス例

```json
{
  "message": "Access granted to protected resource",
  "algorithm": "HS256",
  "user": {
    "id": "user-1",
    "email": "test@example.com"
  },
  "data": {
    "secretInfo": "This is protected data only accessible with a valid HS256 JWT",
    "timestamp": "2026-01-07T10:13:23.106Z"
  }
}
```

## 技術スタック

- **フレームワーク**: Hono
- **ランタイム**: Cloudflare Workers
- **JWT**: jose（Web Crypto API対応）
- **テスト**: Vitest + @cloudflare/vitest-pool-workers
- **言語**: TypeScript
- **パッケージマネージャー**: pnpm

## エビデンス

### テスト結果ファイル
- `local-test-result.txt` - ローカルテスト結果
- `remote-test-result.txt` - リモートテスト結果
- `deploy-result.txt` - デプロイ結果

### スクリーンショット・JSONレスポンス
- `images/20260107_191321_01_api_info.png` - API情報
- `images/20260107_191321_03_algorithms.png` - アルゴリズム一覧
- `images/20260107_191321_04_jwks.png` - JWKS公開鍵

### テストスクリプト
- `scripts/test_local.py` - 統合テストスクリプト
- `scripts/capture_evidence.py` - エビデンス収集スクリプト

## デプロイ情報

```
Deployed jwt-auth-eval triggers (1.45 sec)
  https://jwt-auth-eval.<your-subdomain>.workers.dev
Current Version ID: 9ce32718-bb4c-445d-8265-43088a53ffb6
```

## D1ログ機能（追加実装）

### 負荷想定
- 2000リクエスト/分（約33 RPS）
- トークン失効: 自然失効（Revocation不要）
- キーローテーション: 不要（検証用）

### 追加エンドポイント
- `GET /logs` - 最新ログ取得（limit指定可）
- `GET /logs/stats` - 統計情報

### ログ項目（フルログ）
```
request_id, timestamp, method, path, status, latency_ms,
user_id, algorithm, token_type, ip, user_agent, error_message
```

### D1ログ統計（リモート）
```json
{"total":13,"byStatus":{"200":13},"byAlgorithm":{"ES256":4,"HS256":4,"RS256":4},"avgLatency":0}
```

### 追加エビデンス
- `deploy-result-d1.txt` - D1対応デプロイ結果
- `remote-test-result-d1.txt` - D1対応リモートテスト結果

## 負荷試験結果

### 試験概要
- **対象**: https://jwt-auth-eval.<your-subdomain>.workers.dev
- **ツール**: k6 (Grafana Labs)
- **目的**: JWT署名検証の性能限界確認
- **負荷設定**: 33 RPS × 1分 × 3アルゴリズム（約2000リクエスト/分）

### 試験シナリオ
| シナリオ | アルゴリズム | 開始時間 | 継続時間 | 目標RPS |
|---------|-------------|---------|---------|---------|
| hs256_load | HS256 | 0s | 1m | 33 |
| rs256_load | RS256 | 1m10s | 1m | 33 |
| es256_load | ES256 | 2m20s | 1m | 33 |

### 結果サマリ

| 指標 | 値 |
|------|-----|
| **総リクエスト数** | 5,944 |
| **成功率** | 100%（5,941 iterations, 0 failures） |
| **総試験時間** | 200.36秒 |
| **実効スループット** | 29.67 RPS |

### アルゴリズム別結果

| アルゴリズム | リクエスト数 | 成功数 | 失敗数 | 成功率 |
|-------------|-------------|--------|--------|--------|
| **HS256** | 1,980 | 1,980 | 0 | 100% |
| **RS256** | 1,981 | 1,981 | 0 | 100% |
| **ES256** | 1,980 | 1,980 | 0 | 100% |

### レイテンシ分布

| パーセンタイル | HTTP Duration | JWT検証 |
|---------------|---------------|---------|
| **min** | 20.19ms | 20.19ms |
| **avg** | 24.53ms | 24.49ms |
| **med (p50)** | 23.95ms | 23.95ms |
| **p90** | 26.74ms | 26.73ms |
| **p95** | 28.27ms | 28.24ms |
| **max** | 108.27ms | 91.48ms |

### 閾値判定

| 閾値 | 基準 | 実測値 | 結果 |
|------|------|--------|------|
| http_req_duration | p(95) < 500ms | 28.27ms | ✅ PASS |
| errors | rate < 0.01 | 0% | ✅ PASS |

### 性能評価

1. **スループット**: 33 RPS（約2000リクエスト/分）を安定処理
2. **レイテンシ**: p95で28ms以下、非常に高速
3. **安定性**: エラー率0%、全リクエスト成功
4. **アルゴリズム差異**: HS256/RS256/ES256間で有意な性能差なし

### 負荷試験スクリプト
- `scripts/load_test.js` - k6負荷試験スクリプト（1x）
- `load-test-result.json` - 詳細結果JSON（1x）

---

## 負荷試験結果（5倍負荷）

### 試験概要
- **対象**: https://jwt-auth-eval.<your-subdomain>.workers.dev
- **ツール**: k6 (Grafana Labs)
- **目的**: JWT署名検証の性能限界確認（5倍負荷）
- **負荷設定**: 165 RPS × 1分 × 3アルゴリズム（約10,000リクエスト/分）

### 試験シナリオ
| シナリオ | アルゴリズム | 開始時間 | 継続時間 | 目標RPS |
|---------|-------------|---------|---------|---------|
| hs256_load | HS256 | 0s | 1m | 165 |
| rs256_load | RS256 | 1m10s | 1m | 165 |
| es256_load | ES256 | 2m20s | 1m | 165 |

### 結果サマリ

| 指標 | 値 |
|------|-----|
| **総リクエスト数** | 29,705 |
| **成功率** | 100%（29,702 iterations, 0 failures） |
| **総試験時間** | 200.36秒 |
| **実効スループット** | 148.24 RPS |

### アルゴリズム別結果

| アルゴリズム | リクエスト数 | 成功数 | 失敗数 | 成功率 |
|-------------|-------------|--------|--------|--------|
| **HS256** | 9,900 | 9,900 | 0 | 100% |
| **RS256** | 9,901 | 9,901 | 0 | 100% |
| **ES256** | 9,901 | 9,901 | 0 | 100% |

### レイテンシ分布

| パーセンタイル | HTTP Duration | JWT検証 |
|---------------|---------------|---------|
| **min** | 19.94ms | 19.94ms |
| **avg** | 24.46ms | 24.46ms |
| **med (p50)** | 23.80ms | 23.80ms |
| **p90** | 26.69ms | 26.69ms |
| **p95** | 28.26ms | 28.26ms |
| **max** | 283.35ms | 283.35ms |

### 閾値判定

| 閾値 | 基準 | 実測値 | 結果 |
|------|------|--------|------|
| http_req_duration | p(95) < 500ms | 28.26ms | ✅ PASS |
| errors | rate < 0.05 | 0% | ✅ PASS |

### 性能評価（5倍負荷）

1. **スループット**: 165 RPS（約10,000リクエスト/分）を安定処理
2. **レイテンシ**: **1x負荷時とほぼ同等（p95: 28.26ms）**
3. **安定性**: エラー率0%、全29,702リクエスト成功
4. **スケーラビリティ**: 5倍負荷でもレイテンシ増加なし

### 1x vs 5x 比較

| 指標 | 1x (33 RPS) | 5x (165 RPS) | 変化 |
|------|-------------|--------------|------|
| 総リクエスト | 5,944 | 29,705 | 5倍 |
| 成功率 | 100% | 100% | 維持 |
| p95レイテンシ | 28.27ms | 28.26ms | **変化なし** |
| エラー率 | 0% | 0% | 維持 |

### 負荷試験スクリプト
- `scripts/load_test_5x.js` - k6負荷試験スクリプト（5x）
- `load-test-result-5x.json` - 詳細結果JSON（5x）

### 結論

Cloudflare Workersは**10,000リクエスト/分（165 RPS）の負荷でも性能劣化なし**。

- 5倍負荷でもp95レイテンシは28ms台を維持
- エラー率0%を維持
- アルゴリズム間の性能差なし
- **Cloudflare Workersの無料枠でも高いスケーラビリティを確認**

## TODO完了状況

- [x] Phase 1: プロジェクトセットアップ
- [x] Phase 2: 鍵生成スクリプト
- [x] Phase 3: JWT基盤実装
- [x] Phase 4: ルート実装（HS256, RS256, ES256）
- [x] Phase 5: テスト実装（Vitest）
- [x] Phase 6: 動作検証・デプロイ
- [x] D1ログ機能追加
- [x] ローカルテスト: 全PASS
- [x] リモートテスト: 全PASS
- [x] エビデンス収集
- [x] **負荷試験(1x): 全PASS（5,944リクエスト、エラー率0%）**
- [x] **負荷試験(5x): 全PASS（29,705リクエスト、エラー率0%）**

## 結論

JWT認証APIの実装・検証・負荷試験がすべて正常に完了しました。

### 機能検証
- ローカル環境およびCloudflare Workers環境の両方で、3種類のJWT署名アルゴリズム（HS256, RS256, ES256）すべてが正常に動作することを確認

### 性能検証
- **10,000リクエスト/分（165 RPS）の5倍負荷試験をクリア**
- p95レイテンシ: 28.26ms（5倍負荷でも劣化なし）
- エラー率: 0%（29,705リクエスト全成功）
- アルゴリズム間の性能差なし（HS256/RS256/ES256すべて同等の性能）
- **スケーラビリティ**: 負荷5倍でもレイテンシ変化なし

### インフラ
- D1によるリクエストログ機能で全リクエストを記録
- Cloudflare Workersのエッジ環境で安定した低レイテンシを実現

## Security Review

**レビュー日時**: 2026-01-07
**レビュアー**: Security Auditor Agent
**対象ファイル**: 
- src/routes/*.ts
- src/middleware/jwt-verify.ts
- src/utils/jwt.ts
- scripts/generate-keys.ts
- src/index.ts

### 検出された脆弱性

| 重大度 | カテゴリ | ファイル:行 | 問題 | 推奨対策 |
|--------|---------|-------------|------|----------|
| High | 認可 | src/index.ts:136-148 | `/logs`と`/logs/stats`エンドポイントが未認証で公開 | 管理者認証ミドルウェアを追加 |
| High | CORS | src/index.ts:36 | `cors()`がワイルドカード設定（全オリジン許可） | 許可オリジンを明示的に指定 |
| High | ブルートフォース | src/routes/*.ts:21-28 | ログインエンドポイントにレート制限なし | rate-limiterミドルウェアを追加 |
| Medium | JWT Claims | src/utils/jwt.ts:141-152 | issuer(iss)、audience(aud)の検証なし | jwtVerifyにissuer/audience検証を追加 |
| Medium | Token Revocation | 全体 | リフレッシュトークンの失効機構なし | D1にトークンブラックリストを実装 |
| Medium | JWT Header | src/utils/jwt.ts:80-93 | JWTヘッダーにkid(Key ID)が含まれない | setProtectedHeaderにkidを追加 |
| Medium | Token Tracking | src/utils/jwt.ts:72-93 | jti(JWT ID)クレームなし | トークン追跡・失効のためjtiを追加 |
| Low | 暗号化 | scripts/generate-keys.ts:29 | RSA鍵長2048ビット（最低限） | 4096ビットを推奨 |
| Low | セキュリティヘッダー | src/index.ts | Helmet等のセキュリティヘッダーなし | helmetミドルウェアを追加 |
| Low | リクエストサイズ | src/index.ts | リクエストボディサイズ制限なし | bodyLimitミドルウェアを追加 |

### インジェクション攻撃

- **XSS**: [PASS] 安全 - JSONレスポンスのみ、HTMLレンダリングなし
- **SQL/NoSQL**: [PASS] 安全 - D1でprepared statements使用（`src/middleware/request-logger.ts:43-61`）
- **Command**: [PASS] 安全 - シェルコマンド実行なし

### 認証・認可

- **ハードコード認証情報**: [PASS] なし - 環境変数で管理
- **アルゴリズム混同攻撃**: [PASS] 対策済み - `algorithms: ['HS256']`等で明示的に指定（`src/utils/jwt.ts:141-152`）
- **トークンタイプ検証**: [PASS] 適切 - access/refreshトークンを区別（`src/middleware/jwt-verify.ts:62-67, 110-115`）
- **認可チェック**: [WARN] 一部不足 - `/logs`エンドポイントが未保護

### 機密データ

- **ログ出力**: [WARN] 要確認 - JWTエラー詳細がconsole.errorに出力（`src/middleware/jwt-verify.ts:79, 126`）
- **エラーメッセージ**: [PASS] 安全 - ユーザーには汎用メッセージのみ返却
- **.env管理**: [PASS] 適切 - .gitignoreで除外済み
- **.env.example**: [WARN] 弱いテスト認証情報（`password123`）が記載

### 暗号化

- **アルゴリズム**: [PASS] 安全 - HS256/RS256/ES256のみサポート
- **乱数生成**: [PASS] 安全 - `crypto.randomBytes()`使用（`scripts/generate-keys.ts:24`）、`crypto.randomUUID()`使用（`src/middleware/request-logger.ts:27`）
- **鍵長**: [INFO] RSA 2048ビット（許容範囲、将来的に4096推奨）
- **ECDSA曲線**: [PASS] 安全 - P-256(prime256v1)使用

### セキュリティ設定

- **CORS**: [FAIL] 危険 - ワイルドカード設定
- **セキュリティヘッダー**: [WARN] 欠落 - CSP, X-Frame-Options等なし
- **Cookie**: [N/A] Cookie未使用（Bearer Token方式）

### 良好な実装点

1. **joseライブラリ使用**: 信頼性の高いJWTライブラリを採用
2. **アルゴリズム固定検証**: Algorithm Confusion攻撃を防止
3. **環境変数による鍵管理**: ハードコードを回避
4. **トークンタイプ分離**: access/refreshトークンを明確に区別
5. **パラメータ化クエリ**: SQLインジェクション対策済み
6. **Base64エンコード鍵**: PEM鍵を環境変数で安全に管理

### 総合判定

- **リスクレベル**: 中
- **本番運用可否**: 条件付きで可（下記対策実施後）

### 推奨アクション（優先度順）

1. **[緊急]** `/logs`エンドポイントに認証を追加、または非公開化
2. **[緊急]** CORS設定で許可オリジンを明示的に指定
3. **[高]** ログインエンドポイントにレート制限を追加
4. **[中]** JWT検証にissuer/audience検証を追加
5. **[中]** JWTヘッダーにkidを追加（キーローテーション対応）
6. **[中]** トークンブラックリスト機構の実装検討
7. **[低]** Helmetミドルウェアでセキュリティヘッダーを追加
8. **[低]** リクエストボディサイズ制限の追加

### OWASP Top 10 対応状況

| カテゴリ | 状態 | 備考 |
|----------|------|------|
| A01 Broken Access Control | [WARN] | ログエンドポイント未保護 |
| A02 Cryptographic Failures | [PASS] | 適切な暗号アルゴリズム使用 |
| A03 Injection | [PASS] | prepared statements使用 |
| A04 Insecure Design | [INFO] | トークン失効機構なし |
| A05 Security Misconfiguration | [WARN] | CORS設定要改善 |
| A06 Vulnerable Components | [PASS] | 最新ライブラリ使用 |
| A07 Auth Failures | [INFO] | レート制限なし |
| A08 Software/Data Integrity | [PASS] | JWT署名検証済み |
| A09 Logging Failures | [PASS] | D1でログ記録 |
| A10 SSRF | [N/A] | 外部リクエストなし |

## E2E Integrity Review

**レビュー日時**: 2026-01-07
**レビュー対象**:
- test/*.test.ts (HS256, RS256, ES256)
- test/helpers.ts
- .artifacts/jwt-auth/scripts/test_local.py

### ユーザーフロー再現性

| チェック項目 | 状態 | 詳細 |
|-------------|------|------|
| ページ遷移 | N/A | API専用（UIなし） |
| 認証フロー | ✅ | UIログイン相当のAPI呼び出し（login -> verify/protected） |
| フォーム操作 | N/A | API専用（UIなし） |
| エラーハンドリング | ✅ | 401エラーケースをカバー（invalid credentials, invalid token, no token） |

**評価**: API E2Eとして適切なユーザーフロー再現

### ショートカット・バイパス検出

| ファイル | 問題 | 状態 |
|----------|------|------|
| test/*.test.ts | localStorage直接設定 | ✅ なし |
| test/*.test.ts | goto()ショートカット | N/A（API専用） |
| test/helpers.ts | 認証トークン直接注入 | ✅ なし（loginを経由） |
| src/routes/*.ts | テスト用バックドア | ✅ なし |

**評価**: ショートカットは検出されず、正規フローでテスト実行

### モック汚染

| 種類 | 状態 | 検出箇所 |
|------|------|---------|
| 関数モック (jest.fn/vi.fn/sinon) | ✅ なし | - |
| ネットワークモック (nock/msw/route.fulfill) | ✅ なし | - |
| 時間モック (useFakeTimers/advanceTimersByTime) | ✅ なし | - |
| DBモック | ✅ なし | - |

**評価**: テストコードにモック汚染なし

### DI設定

| 項目 | 状態 | 詳細 |
|------|------|------|
| 環境変数DI | ✅ 適切 | `c.env.JWT_HS256_SECRET` 等で注入 |
| テスト環境 | ✅ 適切 | wrangler.toml + .env から読み込み |
| 本番環境 | ✅ 適切 | Cloudflare Secrets を使用 |
| エミュレーター使用 | N/A | 外部サービス依存なし |

**DI対象環境変数**:
```
JWT_HS256_SECRET       # HS256用シークレット
JWT_RS256_PRIVATE_KEY  # RS256用秘密鍵
JWT_RS256_PUBLIC_KEY   # RS256用公開鍵
JWT_ES256_PRIVATE_KEY  # ES256用秘密鍵
JWT_ES256_PUBLIC_KEY   # ES256用公開鍵
TEST_USER_EMAIL        # テストユーザーメール
TEST_USER_PASSWORD     # テストユーザーパスワード
```

### 待機戦略

| パターン | 件数 | 評価 |
|---------|------|------|
| 固定時間待機 (sleep/setTimeout/waitForTimeout) | 0件 | ✅ 適切 |
| 要素ベース待機 | N/A | API専用 |
| 状態ベース待機 | N/A | API専用 |

**評価**: 固定時間待機は使用されていない

### テストデータ

| 項目 | 状態 | 詳細 |
|------|------|------|
| シード使用 | N/A | ステートレスAPI |
| クリーンアップ | N/A | ステートレスAPI |
| ハードコードデータ | ⚠️ あり | test@example.com / password123 |

**テストデータの取り扱い**:
- テストユーザー情報は環境変数から取得（DI）
- `.env.example`にデフォルト値としてハードコード
- 本番環境では異なる認証情報を使用可能

### アルゴリズム別テストカバレッジ

| アルゴリズム | Login | Verify | Protected | Refresh | エラーケース |
|-------------|-------|--------|-----------|---------|-------------|
| HS256 | ✅ | ✅ | ✅ | ✅ | ✅ invalid credentials, invalid token, no token, wrong token type |
| RS256 | ✅ | ✅ | ✅ | ✅ | ✅ invalid credentials, invalid token, no token, wrong token type |
| ES256 | ✅ | ✅ | ✅ | ✅ | ✅ invalid credentials, invalid token, no token, wrong token type |

### テスト実行方式

| テスト種別 | ツール | 対象 | 評価 |
|-----------|--------|------|------|
| 統合テスト | Vitest + @cloudflare/vitest-pool-workers | test/*.test.ts | ✅ 実際のWorkerに対してテスト |
| E2Eテスト | Playwright (Python) | scripts/test_local.py | ✅ HTTP経由で実サーバーテスト |

### 不足しているテストケース

| テストケース | 重要度 | 推奨 |
|-------------|--------|------|
| トークン有効期限切れ | 中 | 期限切れトークンでの401検証 |
| 改ざんトークン | 中 | 署名検証の失敗確認 |
| アルゴリズム混同攻撃 | 高 | RS256トークンをHS256で検証しない確認 |
| JWKSエンドポイント | 低 | 公開鍵取得のテスト |

### 総合判定

- **整合性スコア**: 4.5/5
- **評価**: 優良

### 推奨アクション

1. **高優先**: アルゴリズム混同攻撃のテストケース追加
   - RS256トークンをHS256エンドポイントで検証しようとした際の401確認
2. **中優先**: トークン有効期限テストの追加
   - 期限切れトークンでの認証失敗確認
3. **低優先**: テストユーザー情報の分離
   - `.env.test`ファイルでテスト専用設定を管理

### 結論

JWT Auth APIのE2Eテストは、モック汚染がなく、実際のAPIフローを再現した適切なテスト構成となっています。Cloudflare Workers統合テスト環境（vitest-pool-workers）を使用し、実際のWorkerランタイムでテストを実行しているため、本番環境との差異が最小化されています。

3種類のJWT署名アルゴリズム（HS256, RS256, ES256）すべてに対して、正常系・異常系のテストケースがカバーされており、E2Eテストとしての整合性は高いと評価できます。

## Code Quality Review

**レビュー日時**: 2026-01-07
**レビューア**: Claude Code Quality Reviewer

### 可読性・保守性

| 指標 | 状態 | 詳細 |
|------|------|------|
| 関数の長さ | OK | 全関数30行以内。最長はrequestLogger()で約65行だが、適切にセクション化されている |
| ネストの深さ | OK | 最大2段階のネスト。複雑な制御フローなし |
| 命名の明確さ | OK | 関数名・変数名が意図を明確に表現（例: `generateAccessToken`, `extractToken`, `saveLog`） |
| コメント | OK | JSDocコメントが適切に記述。日本語コメントで可読性向上 |
| ファイル構成 | OK | routes/middleware/utils の分離が適切 |

**総合評価**: 5/5 - コードは読みやすく保守しやすい構造

### DRY原則

| 問題 | 重大度 | 詳細 |
|------|--------|------|
| ルートファイルの重複 | 中 | `hs256.ts`, `rs256.ts`, `es256.ts` が122-125行でほぼ同一構造 |
| テストファイルの重複 | 低 | 3つのテストファイルが完全に同一構造（アルゴリズム名のみ異なる） |
| トークン生成関数の重複 | 低 | `generateAccessToken`/`generateRefreshToken` で同様のパターン |

**重複箇所**:
- `/src/routes/hs256.ts` (122行)
- `/src/routes/rs256.ts` (125行)
- `/src/routes/es256.ts` (125行)
- `/test/hs256.test.ts`, `/test/rs256.test.ts`, `/test/es256.test.ts` (各141行)

**共通化提案**:
```typescript
// 提案: ファクトリ関数でルートを生成
function createAuthRoutes<T extends Bindings>(config: {
  algorithm: Algorithm
  getKeys: (env: T) => JWTConfig
  authMiddleware: MiddlewareHandler
  refreshMiddleware: MiddlewareHandler
}): Hono<{ Bindings: T }>
```

**総合評価**: 3/5 - 改善の余地あり（機能的には問題なし）

### 型安全性

| 問題 | 件数 | 箇所 |
|------|------|------|
| any型 | 0件 | なし |
| `as unknown as` キャスト | 7件 | `/src/utils/jwt.ts:80,89,113,122,144,152,161` |
| non-null assertion (`!.`) | 0件 | なし |
| その他の型アサーション | 1件 | `/src/middleware/request-logger.ts:130` (`c.env.DB as D1Database`) |

**詳細分析**:
- `as unknown as jose.JWTPayload`: joseライブラリとカスタム型の橋渡しに必要。型の互換性は実行時に保証
- `as unknown as TokenPayload`: JWT検証後のペイロード変換。joseの返り値型との不一致を解消
- `as D1Database | undefined`: 環境変数の型付けに起因。Cloudflare Workersの制約

**総合評価**: 4/5 - 型安全性は高いが、ライブラリとの型変換でキャストが必要

### エラーハンドリング

| 項目 | 状態 | 詳細 |
|------|------|------|
| グローバルエラーハンドラ | OK | `/src/index.ts:162-184` HTTPExceptionと一般エラーを適切に分離 |
| 認証エラー | OK | HTTPException(401)で一貫したエラーレスポンス |
| 空catchブロック | 0件 | 全てのcatchでエラー処理実施 |
| サイレント失敗 | 1件 | `/src/middleware/request-logger.ts:62-64` ログ保存失敗時 |

**懸念点**:
- `saveLog`関数のエラーは`console.error`のみでサイレント失敗
- 入力バリデーション不足（emailフォーマット、パスワード要件）
- レート制限なし

**総合評価**: 4/5 - 基本的なエラーハンドリングは適切

### テストカバレッジ

| 対象 | テスト有無 | カバー率(推定) |
|------|------------|----------------|
| HS256認証フロー | あり | ~90% |
| RS256認証フロー | あり | ~90% |
| ES256認証フロー | あり | ~90% |
| index.ts (メタエンドポイント) | なし | 0% |
| jwt.ts (ユーティリティ) | 間接的 | ~60% |
| jwt-verify.ts (ミドルウェア) | 間接的 | ~70% |
| request-logger.ts | なし | 0% |

**テスト済みシナリオ**:
- 正常ログイン・認証失敗
- トークン検証（有効/無効/欠落）
- 保護リソースアクセス
- リフレッシュトークン（有効/アクセストークン使用時の拒否）

**不足しているテスト**:
1. `/`, `/health`, `/algorithms`, `/.well-known/jwks.json` エンドポイント
2. `/logs`, `/logs/stats` エンドポイント
3. 期限切れトークンの検証
4. 不正な形式のトークン
5. 404ハンドラー
6. グローバルエラーハンドラー
7. request-loggerの単体テスト

**総合評価**: 3/5 - コア機能はカバー、周辺機能のテスト不足

### 総合判定

| 項目 | スコア |
|------|--------|
| 可読性・保守性 | 5/5 |
| DRY原則 | 3/5 |
| 型安全性 | 4/5 |
| エラーハンドリング | 4/5 |
| テストカバレッジ | 3/5 |
| **総合スコア** | **3.8/5** |

### 推奨アクション

**優先度: 高**
1. メタエンドポイント(`/`, `/health`, `/algorithms`, `/jwks`)のテスト追加
2. 期限切れトークン・不正形式トークンのテストケース追加

**優先度: 中**
3. ルートファイルのファクトリ関数化によるDRY改善
4. テストのパラメータ化（`describe.each`使用）で重複削減
5. 入力バリデーション（email形式、必須フィールド）の追加

**優先度: 低**
6. `saveLog`のエラー通知メカニズム追加（オプショナル）
7. jwt.ts内の型キャストをType Guardに置き換え検討
8. request-loggerの単体テスト追加

### セキュリティ所見

- 秘密鍵・シークレットは環境変数経由で適切に管理
- JWTペイロードにtype（access/refresh）を含め、用途外使用を防止
- HTTPExceptionでエラー詳細を適切に制限（内部エラーを外部に漏らさない）
- **注意**: レート制限未実装（本番運用時は要追加）
